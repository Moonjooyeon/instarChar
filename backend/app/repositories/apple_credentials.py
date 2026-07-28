from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AppleOAuthCredential


class AppleCredentialsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert(self, user_id: UUID, client_id: str, subject: str, refresh_token: str, access_token: str | None, expires_at: datetime | None) -> None:
        values = self._values(user_id, client_id, subject, refresh_token, access_token, expires_at)
        updates = {key: value for key, value in values.items() if key not in {"id", "user_id", "client_id"}}
        updates["updated_at"] = func.now()
        statement = insert(AppleOAuthCredential).values(values)
        await self.session.execute(statement.on_conflict_do_update(index_elements=["user_id", "client_id"], set_=updates))

    async def list_for_user(self, user_id: UUID) -> list[AppleOAuthCredential]:
        result = await self.session.execute(select(AppleOAuthCredential).where(AppleOAuthCredential.user_id == user_id))
        return list(result.scalars().all())

    def _values(self, user_id: UUID, client_id: str, subject: str, refresh_token: str, access_token: str | None, expires_at: datetime | None) -> dict[str, object]:
        return {"id": uuid4(), "user_id": user_id, "client_id": client_id, "subject": subject, "refresh_token_encrypted": refresh_token, "access_token_encrypted": access_token, "access_token_expires_at": expires_at}
