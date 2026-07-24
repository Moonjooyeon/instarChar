from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import token_urlsafe
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import BadRequestError
from app.core.security import sign_session
from app.models import NativeOAuthCode


class NativeOAuthService:
    def __init__(self, settings: Settings, session: AsyncSession) -> None:
        self.settings = settings
        self.session = session

    async def issue(self, user_id: UUID) -> str:
        code = token_urlsafe(32)
        expires_at = self._now() + timedelta(seconds=self.settings.native_oauth_code_ttl_seconds)
        self.session.add(NativeOAuthCode(code_hash=self._hash(code), user_id=user_id, expires_at=expires_at))
        await self.session.commit()
        return code

    async def consume(self, code: str) -> str:
        record = await self._locked_code(code)
        if not record or record.used_at or record.expires_at <= self._now():
            raise BadRequestError("Invalid or expired native OAuth code")
        record.used_at = self._now()
        await self.session.commit()
        return sign_session(record.user_id, self.settings.auth_session_ttl_seconds, self.settings.auth_secret_key)

    async def _locked_code(self, code: str) -> NativeOAuthCode | None:
        statement = select(NativeOAuthCode).where(NativeOAuthCode.code_hash == self._hash(code)).with_for_update()
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    def _hash(self, code: str) -> str:
        return sha256(code.encode("utf-8")).hexdigest()

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)
