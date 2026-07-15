from fastapi import APIRouter

from hive.api.v1.routes_health import router as health_router
from hive.modules.devices.router import router as devices_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["system"])
api_router.include_router(devices_router)