from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models import User
from app.repositories.profile_state import ProfileStateRepository
from app.schemas.profile import OnboardingUpdate, ProfileStateResponse, ProfileStateUpdate, StructuredStateUpdate


router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/state", response_model=ProfileStateResponse)
async def get_profile_state(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> ProfileStateResponse:
    return await ProfileStateRepository(session).get_state(user)


@router.put("/state", status_code=status.HTTP_204_NO_CONTENT)
async def update_profile_state(payload: ProfileStateUpdate, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await ProfileStateRepository(session).update_state(user, payload)


@router.post("/structured-state", status_code=status.HTTP_204_NO_CONTENT)
async def update_structured_state(payload: StructuredStateUpdate, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await ProfileStateRepository(session).upsert_structured_state(user, payload)


@router.post("/onboarding", status_code=status.HTTP_204_NO_CONTENT)
async def update_onboarding(payload: OnboardingUpdate, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await ProfileStateRepository(session).update_onboarding(user, payload.display_name)
