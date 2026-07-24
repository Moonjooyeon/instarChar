from typing import Optional
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Character, CharacterFollow, DmThread, Profile, SharedCharacter, SharedDmThread, User, UserPersona
from app.schemas.profile import ProfileStateResponse, ProfileStateUpdate, StructuredStateUpdate


class ProfileStateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_state(self, user: User) -> ProfileStateResponse:
        profile = self._ensure_profile(user)
        return ProfileStateResponse(
            display_name=profile.display_name,
            onboarded=profile.onboarded,
            app_state=profile.app_state,
            characters=await self._characters(user.id),
            personas=await self._personas(user.id),
            dm_threads=await self._dm_threads(user.id),
            shared_dm_threads=await self._shared_dm_threads(user.id),
        )

    async def update_state(self, user: User, payload: ProfileStateUpdate) -> None:
        profile = self._ensure_profile(user)
        profile.display_name = payload.display_name
        profile.onboarded = payload.onboarded
        profile.app_state = payload.app_state
        await self._commit()

    async def update_onboarding(self, user: User, display_name: str) -> None:
        profile = self._ensure_profile(user)
        profile.display_name = display_name
        profile.onboarded = True
        await self._commit()

    async def upsert_structured_state(self, user: User, payload: StructuredStateUpdate) -> None:
        await self._upsert_characters(user.id, payload)
        await self._sync_character_follows(user, payload)
        await self._upsert_personas(user.id, payload)
        await self._upsert_dm_threads(user.id, payload)
        await self._upsert_shared_dm_threads(user.id, payload)
        await self._commit()

    async def delete_character_data(self, user: User, source_account_id: str) -> None:
        await self.session.execute(delete(Character).where(Character.owner_id == user.id, Character.source_account_id == source_account_id))
        await self.session.execute(delete(SharedCharacter).where(SharedCharacter.owner_id == user.id, SharedCharacter.source_account_id == source_account_id))
        await self.session.execute(delete(CharacterFollow).where(CharacterFollow.follower_id == user.id, CharacterFollow.follower_account_id == source_account_id))
        await self.session.execute(delete(DmThread).where(DmThread.owner_id == user.id, DmThread.thread_key.like(f"owner::{source_account_id}::%")))
        await self._commit()

    def _ensure_profile(self, user: User) -> Profile:
        if user.profile:
            return user.profile
        user.profile = Profile(user_id=user.id, display_name="", onboarded=False, app_state={})
        self.session.add(user.profile)
        return user.profile

    async def _characters(self, user_id: UUID) -> list[Character]:
        result = await self.session.execute(select(Character).where(Character.owner_id == user_id).limit(80))
        return list(result.scalars().all())

    async def _personas(self, user_id: UUID) -> list[UserPersona]:
        result = await self.session.execute(select(UserPersona).where(UserPersona.owner_id == user_id).limit(80))
        return list(result.scalars().all())

    async def _dm_threads(self, user_id: UUID) -> list[DmThread]:
        result = await self.session.execute(select(DmThread).where(DmThread.owner_id == user_id).limit(80))
        return list(result.scalars().all())

    async def _shared_dm_threads(self, user_id: UUID) -> list[SharedDmThread]:
        result = await self.session.execute(select(SharedDmThread).where(SharedDmThread.participant_user_ids.contains([user_id])).limit(80))
        return list(result.scalars().all())

    async def _upsert_characters(self, user_id: UUID, payload: StructuredStateUpdate) -> None:
        rows = [item.model_dump(mode="python") | {"owner_id": user_id} for item in payload.characters]
        await self._upsert(Character, rows, ["owner_id", "source_account_id"], {"posts"})

    async def _sync_character_follows(self, user: User, payload: StructuredStateUpdate) -> None:
        rows = self._character_follow_rows(user, payload)
        await self.session.execute(delete(CharacterFollow).where(CharacterFollow.follower_id == user.id))
        if not rows:
            return
        target_ids = {row["target_shared_character_id"] for row in rows}
        result = await self.session.execute(select(SharedCharacter.id).where(SharedCharacter.id.in_(target_ids)))
        valid_ids = set(result.scalars().all())
        valid_rows = [row for row in rows if row["target_shared_character_id"] in valid_ids]
        await self._upsert(CharacterFollow, valid_rows, ["follower_id", "follower_account_id", "target_shared_character_id"])

    def _character_follow_rows(self, user: User, payload: StructuredStateUpdate) -> list[dict[str, object]]:
        rows: dict[tuple[str, UUID], dict[str, object]] = {}
        follower_name = user.profile.display_name or user.email.split("@")[0]
        for character in payload.characters:
            for followed in character.following:
                target_id = self._shared_id(followed)
                if not target_id:
                    continue
                rows[(character.source_account_id, target_id)] = {"follower_id": user.id, "follower_name": follower_name, "follower_account_id": character.source_account_id, "follower_character": character.character, "target_shared_character_id": target_id}
        return list(rows.values())

    def _shared_id(self, value: object) -> Optional[UUID]:
        if not isinstance(value, dict):
            return None
        try:
            return UUID(str(value.get("sharedId") or ""))
        except ValueError:
            return None

    async def _upsert_personas(self, user_id: UUID, payload: StructuredStateUpdate) -> None:
        rows = [item.model_dump(mode="python") | {"owner_id": user_id} for item in payload.personas]
        await self._upsert(UserPersona, rows, ["owner_id", "persona_id"])

    async def _upsert_dm_threads(self, user_id: UUID, payload: StructuredStateUpdate) -> None:
        rows = [item.model_dump(mode="python") | {"owner_id": user_id} for item in payload.dm_threads]
        await self._upsert(DmThread, rows, ["owner_id", "thread_key"])

    async def _upsert_shared_dm_threads(self, user_id: UUID, payload: StructuredStateUpdate) -> None:
        rows = [self._shared_dm_row(user_id, item.model_dump(mode="python")) for item in payload.shared_dm_threads]
        await self._upsert(SharedDmThread, rows, ["thread_key"])

    def _shared_dm_row(self, user_id: UUID, row: dict[str, object]) -> dict[str, object]:
        participant_ids = set(row.get("participant_user_ids", []))
        participant_ids.add(user_id)
        row["participant_user_ids"] = list(participant_ids)
        row["created_by"] = user_id
        return row

    async def _upsert(self, model: object, rows: list[dict[str, object]], conflict: list[str], update_exclude: Optional[set[str]] = None) -> None:
        if not rows:
            return
        stmt = insert(model).values(rows)
        excluded = set(conflict) | (update_exclude or set())
        update_columns = {key: stmt.excluded[key] for key in rows[0] if key not in excluded}
        await self.session.execute(stmt.on_conflict_do_update(index_elements=conflict, set_=update_columns))

    async def _commit(self) -> None:
        await self.session.commit()
