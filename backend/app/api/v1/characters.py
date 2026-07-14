from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models import User
from app.repositories.profile_state import ProfileStateRepository


router = APIRouter(prefix="/characters", tags=["characters"])


@router.delete("/{source_account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character_data(source_account_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await ProfileStateRepository(session).delete_character_data(user, source_account_id)
