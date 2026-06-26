from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.dm_threads import router as dm_threads_router
from app.api.v1.profiles import router as profile_router
from app.api.v1.shared_characters import router as shared_characters_router


api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(profile_router)
api_router.include_router(shared_characters_router)
api_router.include_router(dm_threads_router)
