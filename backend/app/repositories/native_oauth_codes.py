from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import NativeOAuthCode


@dataclass(frozen=True)
class NativeOAuthCleanupResult:
    deleted_total: int
    deleted_used: int
    deleted_unused: int
    oldest_expired_at: datetime | None


class NativeOAuthCodeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def delete_expired(self, cutoff: datetime, batch_size: int) -> NativeOAuthCleanupResult:
        candidates = select(NativeOAuthCode.id).where(NativeOAuthCode.expires_at <= cutoff).order_by(NativeOAuthCode.expires_at, NativeOAuthCode.id).limit(batch_size).with_for_update(skip_locked=True)
        statement = delete(NativeOAuthCode).where(NativeOAuthCode.id.in_(candidates)).returning(NativeOAuthCode.used_at, NativeOAuthCode.expires_at)
        result = await self.session.execute(statement)
        rows = result.all()
        used = sum(row.used_at is not None for row in rows)
        oldest = min((row.expires_at for row in rows), default=None)
        return NativeOAuthCleanupResult(len(rows), used, len(rows) - used, oldest)
