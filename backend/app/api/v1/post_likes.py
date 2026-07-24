from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models import User
from app.repositories.post_likes import PostLikesRepository
from app.schemas.post_likes import PostLikeItem, PostLikesQuery, PostLikesResponse, PostLikeUpdate


router = APIRouter(prefix="/post-likes", tags=["post-likes"])


@router.post("/query", response_model=PostLikesResponse)
async def query_post_likes(payload: PostLikesQuery, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> PostLikesResponse:
    return await PostLikesRepository(session).query(user, payload)


@router.put("", response_model=PostLikeItem)
async def update_post_like(payload: PostLikeUpdate, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> PostLikeItem:
    return await PostLikesRepository(session).update(user, payload)
