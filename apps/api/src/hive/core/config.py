from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    jwt_secret_key: str = "H-e2JvC_RmwGQrqo54A9cmbqvhWrMZPqJe0lXG0W0OYIF5z9cxxq8pgqtgiNfcRF"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()