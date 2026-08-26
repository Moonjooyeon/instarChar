from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import NativeOAuthCode


class NativeOAuthCodeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def delete_expired(self, cutoff: datetime, batch_size: int) -> int:
        candidates = select(NativeOAuthCode.id).where(NativeOAuthCode.expires_at <= cutoff).order_by(NativeOAuthCode.expires_at, NativeOAuthCode.id).limit(batch_size).with_for_update(skip_locked=True)
        statement = delete(NativeOAuthCode).where(NativeOAuthCode.id.in_(candidates))
        result = await self.session.execute(statement)
        return result.rowcount or 0
