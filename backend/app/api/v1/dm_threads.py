from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.errors import BadRequestError
from app.db.session import get_db_session
from app.models import User
from app.repositories.dm_threads import DmThreadRepository
from app.schemas.dm_threads import DmThreadPayload, DmThreadResponse, SharedDmThreadPayload, SharedDmThreadResponse


router = APIRouter(tags=["dm-threads"])


@router.get("/dm-threads", response_model=DmThreadResponse)
async def get_owner_dm_thread(thread_key: str = Query(...), user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> DmThreadResponse:
    row = await DmThreadRepository(session).get_owner_thread(user, thread_key)
    if not row:
        raise BadRequestError("DM thread not found")
    return DmThreadResponse.model_validate(row)


@router.put("/dm-threads", status_code=status.HTTP_204_NO_CONTENT)
async def upsert_owner_dm_thread(payload: DmThreadPayload, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await DmThreadRepository(session).upsert_owner_thread(user, payload)


@router.delete("/dm-threads", status_code=status.HTTP_204_NO_CONTENT)
async def delete_owner_dm_thread(thread_key: str = Query(...), user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await DmThreadRepository(session).delete_owner_thread(user, thread_key)


@router.get("/shared-dm-threads", response_model=SharedDmThreadResponse)
async def get_shared_dm_thread(thread_key: str = Query(...), user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> SharedDmThreadResponse:
    row = await DmThreadRepository(session).get_shared_thread(user, thread_key)
    if not row:
        raise BadRequestError("Shared DM thread not found")
    return SharedDmThreadResponse.model_validate(row)


@router.put("/shared-dm-threads", status_code=status.HTTP_204_NO_CONTENT)
async def upsert_shared_dm_thread(payload: SharedDmThreadPayload, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await DmThreadRepository(session).upsert_shared_thread(user, payload)


@router.delete("/shared-dm-threads", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shared_dm_thread(thread_key: str = Query(...), user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await DmThreadRepository(session).delete_shared_thread(user, thread_key)
