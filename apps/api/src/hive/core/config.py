from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEVELOPMENT_JWT_SECRET = "development-only-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    environment: str = "development"

    database_url: str = (
        "postgresql+psycopg://"
        "hive:hive_local_password@localhost:5432/hive"
    )

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    jwt_secret_key: str = DEVELOPMENT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.environment.strip().lower() != "production":
            return self

        if self.jwt_secret_key == DEVELOPMENT_JWT_SECRET:
            raise ValueError(
                "JWT_SECRET_KEY must be set to a unique secret in production."
            )

        if "localhost" in self.database_url or "hive_local_password" in self.database_url:
            raise ValueError(
                "DATABASE_URL must point to the production database."
            )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
