import base64
import binascii
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, case, exists, func, literal, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.selectable import Subquery

from app.core.errors import BadRequestError, TooManyRequestsError
from app.core.config import get_settings
from app.core.recommendations import RECOMMENDATION_FIELDS, character_recommendation_terms, normalize_recommendation_terms
from app.models import Character, CharacterFollow, CharacterPostLike, FeedRequestLimit, PublicFeedPost, SharedCharacter, User, UserBlock, UserModerationStatus
from app.schemas.feed import FeedKind, FeedPage, FeedPageItem


FeedCursor = tuple[datetime, str, UUID, int]
_PROFILE_WEIGHTS = (("interests", 6), ("world", 4), ("persona", 2), ("surface", 2))
_MAX_RECOMMENDATION_TERMS = 24
_RECOMMENDATION_SCAN_MULTIPLIER = 6
_RECOMMENDATION_CANDIDATE_LIMIT = 2400
_MAX_POSTS_PER_AUTHOR = 2


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
        excluded = await self._excluded_owner_ids(user_id)
        weights = await self._recommendation_weights(user_id, active, excluded)
        score = self._recommendation_score(weights)
        candidate_statement = self._recommendation_base(user_id, active, excluded)
        candidates = self._recent_recommendation_posts(candidate_statement)
        candidate_match = and_(candidates.c.author_character_id == PublicFeedPost.author_character_id, candidates.c.post_id == PublicFeedPost.post_id)
        statement = self._base_statement().join(candidates, candidate_match)
        statement = statement.with_only_columns(PublicFeedPost, Character, SharedCharacter, score.label("score"))
        statement = self._apply_ranked_cursor(statement, cursor, score).order_by(score.desc(), PublicFeedPost.created_at.desc(), PublicFeedPost.post_id.desc(), PublicFeedPost.author_character_id.desc())
        scan_limit = limit * _RECOMMENDATION_SCAN_MULTIPLIER
        rows = list((await self.session.execute(statement.limit(scan_limit + 1))).all())
        return self._recommendation_page_from_rows(rows, limit, scan_limit)

    def _recommendation_base(self, user_id: UUID, active: Character, excluded: set[UUID]) -> object:
        followed = select(CharacterFollow.id).where(CharacterFollow.follower_id == user_id, CharacterFollow.follower_account_id == active.source_account_id, CharacterFollow.target_shared_character_id == SharedCharacter.id)
        statement = self._base_statement().where(PublicFeedPost.author_character_id != active.id, ~exists(followed))
        return self._apply_exclusions(statement, excluded)

    def _recent_recommendation_posts(self, statement: object) -> Subquery:
        statement = statement.with_only_columns(PublicFeedPost.author_character_id, PublicFeedPost.post_id)
        statement = statement.order_by(PublicFeedPost.created_at.desc(), PublicFeedPost.post_id.desc(), PublicFeedPost.author_character_id.desc())
        return statement.limit(_RECOMMENDATION_CANDIDATE_LIMIT).subquery("recent_recommendation_posts")

    async def _recommendation_weights(self, user_id: UUID, active: Character, excluded: set[UUID]) -> dict[str, int]:
        weights = self._profile_weights(active)
        followed = await self._followed_signals(user_id, active.source_account_id, excluded)
        liked = await self._liked_signals(user_id, active.source_account_id, excluded)
        for shared in followed:
            self._add_signal(weights, shared, 3)
        for shared in liked:
            self._add_signal(weights, shared, 1)
        ranked = sorted(weights.items(), key=lambda item: (-item[1], item[0]))
        return dict(ranked[:_MAX_RECOMMENDATION_TERMS])

    async def _followed_signals(self, user_id: UUID, source_account_id: str, excluded: set[UUID]) -> list[SharedCharacter]:
        statement = select(SharedCharacter).join(CharacterFollow, CharacterFollow.target_shared_character_id == SharedCharacter.id)
        statement = statement.where(CharacterFollow.follower_id == user_id, CharacterFollow.follower_account_id == source_account_id)
        statement = self._apply_exclusions(statement, excluded)
        result = await self.session.execute(statement.order_by(CharacterFollow.created_at.desc()).limit(80))
        return list(result.scalars().all())

    async def _liked_signals(self, user_id: UUID, source_account_id: str, excluded: set[UUID]) -> list[SharedCharacter]:
        linked = and_(SharedCharacter.owner_id == Character.owner_id, SharedCharacter.source_account_id == Character.source_account_id)
        statement = select(SharedCharacter).join(Character, linked).join(CharacterPostLike, CharacterPostLike.target_character_id == Character.id)
        statement = statement.where(CharacterPostLike.liker_owner_id == user_id, CharacterPostLike.liker_account_id == source_account_id)
        statement = self._apply_exclusions(statement, excluded)
        result = await self.session.execute(statement.order_by(CharacterPostLike.created_at.desc()).limit(80))
        return list(result.scalars().all())

    def _profile_weights(self, active: Character) -> dict[str, int]:
        weights: dict[str, int] = {}
        for field, weight in _PROFILE_WEIGHTS:
            terms = normalize_recommendation_terms([active.character.get(field)], 10)
            for term in terms:
                weights[term] = max(weights.get(term, 0), weight)
        return weights

    def _add_signal(self, weights: dict[str, int], shared: SharedCharacter, boost: int) -> None:
        profile_terms = character_recommendation_terms(dict(shared.character or {}))
        terms = normalize_recommendation_terms([*profile_terms, *list(shared.tags or [])])
        for term in terms:
            weights[term] = min(12, weights.get(term, 0) + boost)

    def _recommendation_score(self, weights: dict[str, int]) -> ColumnElement[int]:
        score = literal(0)
        if not weights:
            return score
        document = self._recommendation_document()
        for term, weight in weights.items():
            matches = or_(SharedCharacter.tags.overlap([term]), func.strpos(document, term) > 0)
            score += case((matches, weight), else_=0)
        return score

    def _recommendation_document(self) -> ColumnElement[str]:
        fields = [SharedCharacter.character[field].astext for field in RECOMMENDATION_FIELDS]
        tags = func.array_to_string(SharedCharacter.tags, " ")
        return func.lower(func.concat_ws(" ", tags, SharedCharacter.persona, *fields))

    def _recommendation_page_from_rows(self, rows: list[object], limit: int, scan_limit: int) -> FeedPage:
        visible: list[object] = []
        scanned: list[object] = []
        author_counts: dict[str, int] = {}
        for row in rows[:scan_limit]:
            scanned.append(row)
            author_id = str(row[1].id)
            if author_counts.get(author_id, 0) >= _MAX_POSTS_PER_AUTHOR:
                continue
            author_counts[author_id] = author_counts.get(author_id, 0) + 1
            visible.append(row)
            if len(visible) == limit:
                break
        has_more = len(rows) > len(scanned)
        cursor = self._cursor_from_row(scanned[-1], "recommendations") if has_more and scanned else ""
        return FeedPage(items=[self._item_from_row(row, "recommendations") for row in visible], has_more=has_more, next_cursor=cursor)

    def _base_statement(self, *extra: object) -> object:
        statement = select(PublicFeedPost, Character, SharedCharacter, *extra).join(Character, Character.id == PublicFeedPost.author_character_id)
        statement = statement.join(SharedCharacter, and_(SharedCharacter.owner_id == Character.owner_id, SharedCharacter.source_account_id == Character.source_account_id)).join(User, User.id == SharedCharacter.owner_id)
        return statement.where(Character.is_public.is_(True), User.moderation_status == UserModerationStatus.active)

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
        return statement.where(self._cursor_time_condition(cursor))

    def _apply_ranked_cursor(self, statement: object, cursor: FeedCursor | None, score: ColumnElement[int]) -> object:
        if not cursor:
            return statement
        cursor_score = cursor[3]
        return statement.where(or_(score < cursor_score, and_(score == cursor_score, self._cursor_time_condition(cursor))))

    def _cursor_time_condition(self, cursor: FeedCursor) -> ColumnElement[bool]:
        created_at, post_id, author_id, _ = cursor
        older_time = PublicFeedPost.created_at < created_at
        older_post = and_(PublicFeedPost.created_at == created_at, PublicFeedPost.post_id < post_id)
        older_author = and_(PublicFeedPost.created_at == created_at, PublicFeedPost.post_id == post_id, PublicFeedPost.author_character_id < author_id)
        return or_(older_time, older_post, older_author)

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
