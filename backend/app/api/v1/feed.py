from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models import User
from app.repositories.feed import FeedRepository
from app.schemas.feed import FeedKind, FeedPage


router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("", response_model=FeedPage)
async def get_feed_page(response: Response, source_account_id: str, kind: FeedKind, cursor: str = "", limit: int = Query(default=20, ge=1, le=30), user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> FeedPage:
    response.headers["Cache-Control"] = "private, no-store"
    page = await FeedRepository(session).page(user, source_account_id, kind, cursor, limit)
    await session.commit()
    return page
