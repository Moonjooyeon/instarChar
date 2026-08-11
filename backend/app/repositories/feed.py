import base64
import binascii
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, case, exists, literal, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError, TooManyRequestsError
from app.core.config import get_settings
from app.models import Character, CharacterFollow, FeedRequestLimit, PublicFeedPost, SharedCharacter, User, UserBlock
from app.schemas.feed import FeedKind, FeedPage, FeedPageItem


FeedCursor = tuple[datetime, str, UUID, int]


class FeedRepository:
    def __init__(self, session: AsyncSession, cursor_secret: str | None = None) -> None:
        self.session = session
        self.cursor_secret = cursor_secret or get_settings().auth_secret_key

    async def page(self, user: User, source_account_id: str, kind: FeedKind, cursor: str, limit: int) -> FeedPage:
        active = await self._active_character(user.id, source_account_id)
        await self._consume_rate_limit(user.id)
        decoded = self._decode_cursor(cursor, kind)
        if kind == "timeline":
            return await self._timeline_page(user.id, source_account_id, decoded, limit)
        return await self._recommendation_page(user.id, active, decoded, limit)

    async def _consume_rate_limit(self, user_id: UUID) -> None:
        now = datetime.now(timezone.utc)
        reset_before = now - timedelta(minutes=1)
        reset = FeedRequestLimit.window_started_at < reset_before
        statement = insert(FeedRequestLimit).values(user_id=user_id, request_count=1, window_started_at=now).on_conflict_do_update(
            index_elements=[FeedRequestLimit.user_id],
            set_={"request_count": case((reset, 1), else_=FeedRequestLimit.request_count + 1), "window_started_at": case((reset, now), else_=FeedRequestLimit.window_started_at)},
        ).returning(FeedRequestLimit.request_count)
        count = int((await self.session.execute(statement)).scalar_one())
        if count > get_settings().feed_requests_per_minute:
            raise TooManyRequestsError("Feed request limit reached")

    async def _timeline_page(self, user_id: UUID, source_account_id: str, cursor: FeedCursor | None, limit: int) -> FeedPage:
        statement = self._base_statement().join(CharacterFollow, CharacterFollow.target_shared_character_id == SharedCharacter.id).where(CharacterFollow.follower_id == user_id, CharacterFollow.follower_account_id == source_account_id)
        statement = self._apply_exclusions(statement, await self._excluded_owner_ids(user_id))
        statement = self._apply_cursor(statement, cursor).order_by(PublicFeedPost.created_at.desc(), PublicFeedPost.post_id.desc(), PublicFeedPost.author_character_id.desc()).limit(limit + 1)
        rows = list((await self.session.execute(statement)).all())
        return self._page_from_rows(rows, "timeline", limit)

    async def _recommendation_page(self, user_id: UUID, active: Character, cursor: FeedCursor | None, limit: int) -> FeedPage:
        terms = self._recommendation_terms(active)
        followed = select(CharacterFollow.id).where(CharacterFollow.follower_id == user_id, CharacterFollow.follower_account_id == active.source_account_id, CharacterFollow.target_shared_character_id == SharedCharacter.id)
        statement = self._base_statement().where(PublicFeedPost.author_character_id != active.id, ~exists(followed))
        statement = self._apply_exclusions(statement, await self._excluded_owner_ids(user_id))
        if cursor and cursor[3] == 0:
            return await self._recommendation_segment(statement, terms, False, cursor, limit)
        if not terms:
            return await self._recommendation_segment(statement, terms, False, cursor, limit)
        interests = await self._recommendation_segment(statement, terms, True, cursor, limit, keep_cursor=True)
        if interests.has_more:
            return interests
        return await self._append_recent_recommendations(statement, terms, interests, limit)

    async def _recommendation_segment(self, statement: object, terms: list[str], interested: bool, cursor: FeedCursor | None, limit: int, keep_cursor: bool = False) -> FeedPage:
        if limit < 1:
            return FeedPage(has_more=False)
        score = 1 if interested else 0
        if terms:
            tag_match = SharedCharacter.tags.overlap(terms)
            statement = statement.where(tag_match if interested else ~tag_match)
        statement = statement.with_only_columns(PublicFeedPost, Character, SharedCharacter, literal(score).label("score"))
        statement = self._apply_cursor(statement, cursor).order_by(PublicFeedPost.created_at.desc(), PublicFeedPost.post_id.desc(), PublicFeedPost.author_character_id.desc()).limit(limit + 1)
        rows = list((await self.session.execute(statement)).all())
        return self._page_from_rows(rows, "recommendations", limit, keep_cursor)

    async def _append_recent_recommendations(self, statement: object, terms: list[str], interests: FeedPage, limit: int) -> FeedPage:
        remaining = limit - len(interests.items)
        recents = await self._recommendation_segment(statement, terms, False, None, max(remaining, 1))
        if not recents.items:
            return FeedPage(items=interests.items, has_more=False)
        if remaining < 1:
            return FeedPage(items=interests.items, has_more=True, next_cursor=interests.next_cursor)
        return FeedPage(items=[*interests.items, *recents.items], has_more=recents.has_more, next_cursor=recents.next_cursor)

    def _base_statement(self, *extra: object) -> object:
        return select(PublicFeedPost, Character, SharedCharacter, *extra).join(Character, Character.id == PublicFeedPost.author_character_id).join(SharedCharacter, and_(SharedCharacter.owner_id == Character.owner_id, SharedCharacter.source_account_id == Character.source_account_id)).where(Character.is_public.is_(True))

    async def _active_character(self, owner_id: UUID, source_account_id: str) -> Character:
        statement = select(Character).where(Character.owner_id == owner_id, Character.source_account_id == source_account_id)
        row = (await self.session.execute(statement)).scalar_one_or_none()
        if not row:
            raise BadRequestError("Character not found")
        return row

    async def _excluded_owner_ids(self, viewer_id: UUID) -> set[UUID]:
        statement = select(UserBlock.blocker_id, UserBlock.blocked_id).where((UserBlock.blocker_id == viewer_id) | (UserBlock.blocked_id == viewer_id))
        rows = (await self.session.execute(statement)).all()
        return {blocked if blocker == viewer_id else blocker for blocker, blocked in rows}

    def _apply_exclusions(self, statement: object, excluded: set[UUID]) -> object:
        return statement.where(SharedCharacter.owner_id.not_in(excluded)) if excluded else statement

    def _apply_cursor(self, statement: object, cursor: FeedCursor | None) -> object:
        if not cursor:
            return statement
        created_at, post_id, author_id, _ = cursor
        return statement.where(or_(PublicFeedPost.created_at < created_at, and_(PublicFeedPost.created_at == created_at, PublicFeedPost.post_id < post_id), and_(PublicFeedPost.created_at == created_at, PublicFeedPost.post_id == post_id, PublicFeedPost.author_character_id < author_id)))

    def _page_from_rows(self, rows: list[object], kind: FeedKind, limit: int, keep_cursor: bool = False) -> FeedPage:
        has_more = len(rows) > limit
        visible = rows[:limit]
        items = [self._item_from_row(row, kind) for row in visible]
        cursor = self._cursor_from_row(visible[-1], kind) if (has_more or keep_cursor) and visible else ""
        return FeedPage(items=items, has_more=has_more, next_cursor=cursor)

    def _item_from_row(self, row: object, kind: FeedKind) -> FeedPageItem:
        post, character, shared, *rest = row
        score = int(rest[0] or 0) if rest else 0
        return FeedPageItem(author_character_id=str(character.id), author_handle=shared.handle, author_name=shared.name, author_owner_id=str(shared.owner_id), author_shared_id=str(shared.id), post_id=post.post_id, post=dict(post.payload), recommendation_reason="interest" if kind == "recommendations" and score else "recent")

    def _cursor_from_row(self, row: object, kind: FeedKind) -> str:
        post, character, _, *rest = row
        score = int(rest[0] or 0) if rest else 0
        payload = {"authorCharacterId": str(character.id), "createdAt": post.created_at.isoformat(), "kind": kind, "postId": post.post_id, "score": score}
        encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
        signature = hmac.new(self.cursor_secret.encode(), encoded.encode(), hashlib.sha256).digest()
        return f"{encoded}.{base64.urlsafe_b64encode(signature).decode().rstrip('=')}"

    def _decode_cursor(self, value: str, kind: FeedKind) -> FeedCursor | None:
        if not value:
            return None
        try:
            encoded, signature = value.split(".")
            expected = hmac.new(self.cursor_secret.encode(), encoded.encode(), hashlib.sha256).digest()
            padded_signature = signature + "=" * (-len(signature) % 4)
            if not hmac.compare_digest(base64.urlsafe_b64decode(padded_signature), expected):
                raise ValueError
            padded = encoded + "=" * (-len(encoded) % 4)
            payload = json.loads(base64.urlsafe_b64decode(padded).decode())
            if payload.get("kind") != kind:
                raise ValueError
            return datetime.fromisoformat(str(payload["createdAt"])), str(payload["postId"]), UUID(str(payload["authorCharacterId"])), int(payload.get("score") or 0)
        except (binascii.Error, KeyError, TypeError, ValueError, json.JSONDecodeError):
            raise BadRequestError("Invalid feed cursor") from None

    def _recommendation_terms(self, character: Character) -> list[str]:
        fields = ("interests", "world", "persona", "surface")
        values = [str(character.character.get(field) or "") for field in fields]
        terms = [term.strip() for value in values for term in value.lower().replace("·", " ").replace("/", " ").split()]
        return [term for term in terms if len(term) >= 2][:18]
