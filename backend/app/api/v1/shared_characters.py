from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.errors import BadRequestError
from app.db.session import get_db_session
from app.models import User
from app.repositories.shared_characters import SharedCharacterRepository
from app.schemas.shared_characters import (
    DiscoverResponse,
    FollowRequest,
    FollowResponse,
    FollowSnapshotRequest,
    FollowerCountsResponse,
    FollowersResponse,
    RelationshipFollowBackRequest,
    ShareIdResponse,
    SharedCharacterUpdate,
)


router = APIRouter(tags=["shared-characters"])


@router.get("/discover/characters", response_model=DiscoverResponse)
async def discover_characters(session: AsyncSession = Depends(get_db_session)) -> DiscoverResponse:
    rows = await SharedCharacterRepository(session).discover()
    return DiscoverResponse(characters=rows)


@router.get("/shared-characters/follower-counts", response_model=FollowerCountsResponse)
async def get_follower_counts(ids: list[UUID] = Query(default_factory=list), session: AsyncSession = Depends(get_db_session)) -> FollowerCountsResponse:
    counts = await SharedCharacterRepository(session).follower_counts(ids)
    return FollowerCountsResponse(counts=counts)


@router.post("/follows/sync-owned-snapshot", status_code=status.HTTP_204_NO_CONTENT)
async def sync_owned_follow_snapshot(payload: FollowSnapshotRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await SharedCharacterRepository(session).sync_owned_follow_snapshots(user, payload)


@router.get("/shared-characters/{shared_character_id}")
async def get_shared_character(shared_character_id: UUID, session: AsyncSession = Depends(get_db_session)) -> object:
    row = await SharedCharacterRepository(session).get_shared(shared_character_id)
    if not row:
        raise BadRequestError("Shared character not found")
    return row


@router.get("/shared-characters/{shared_character_id}/followers", response_model=FollowersResponse)
async def get_shared_character_followers(shared_character_id: UUID, session: AsyncSession = Depends(get_db_session)) -> FollowersResponse:
    rows = await SharedCharacterRepository(session).followers(shared_character_id)
    return FollowersResponse(rows=rows)


@router.put("/shared-characters/{shared_character_id}/follow", response_model=FollowResponse)
async def follow_shared_character(shared_character_id: UUID, payload: FollowRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> FollowResponse:
    ok = await SharedCharacterRepository(session).follow(user, shared_character_id, payload)
    return FollowResponse(ok=ok)


@router.delete("/shared-characters/{shared_character_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def unfollow_shared_character(shared_character_id: UUID, follower_account_id: str = Query(...), user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await SharedCharacterRepository(session).unfollow(user, shared_character_id, follower_account_id)


@router.post("/shared-characters/{shared_character_id}/relationship-follow-back", response_model=FollowResponse)
async def relationship_follow_back(shared_character_id: UUID, payload: RelationshipFollowBackRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> FollowResponse:
    ok = await SharedCharacterRepository(session).relationship_follow_back(user, payload.follower_shared_character_id, shared_character_id)
    return FollowResponse(ok=ok)


@router.get("/characters/{source_account_id}/share", response_model=ShareIdResponse)
async def get_character_share(source_account_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> ShareIdResponse:
    result = await SharedCharacterRepository(session).get_share_id(user, source_account_id)
    return ShareIdResponse(id=result.value)


@router.put("/shared-characters/by-source/{source_account_id}", response_model=ShareIdResponse)
async def upsert_shared_character(source_account_id: str, payload: SharedCharacterUpdate, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> ShareIdResponse:
    result = await SharedCharacterRepository(session).upsert_shared(user, source_account_id, payload)
    return ShareIdResponse(id=result.value)


@router.patch("/shared-characters/by-source/{source_account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def patch_shared_character(source_account_id: str, payload: SharedCharacterUpdate, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await SharedCharacterRepository(session).patch_shared(user, source_account_id, payload)


@router.delete("/shared-characters/by-source/{source_account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shared_character(source_account_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await SharedCharacterRepository(session).delete_shared(user, source_account_id)
