from fastapi import APIRouter

from hive.modules.assignments.router import router as assignments_router
from hive.modules.auth.router import router as auth_router
from hive.modules.device_agent.router import router as device_agent_router
from hive.modules.devices.router import router as devices_router
from hive.modules.enrollment.router import (
    public_router as public_enrollment_router,
)
from hive.modules.enrollment.router import (
    router as enrollment_router,
)
from hive.modules.events.router import router as events_router
from hive.modules.organizations.router import router as organizations_router
from hive.modules.users.router import router as users_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(devices_router)
api_router.include_router(enrollment_router)
api_router.include_router(public_enrollment_router)
api_router.include_router(device_agent_router)
api_router.include_router(events_router)
api_router.include_router(assignments_router)
api_router.include_router(users_router)
api_router.include_router(organizations_router)