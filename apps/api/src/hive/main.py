from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from hive.api.v1.router import api_router
from hive.core.config import settings


def create_application() -> FastAPI:
    application = FastAPI(
        title="Hive API",
        version="0.1.0",
        description="Blackbird device-management platform API",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(api_router, prefix="/api/v1")
    return application


app = create_application()
