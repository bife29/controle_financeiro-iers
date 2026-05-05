from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # App
    APP_NAME: str = "IERS Sistema Integrado"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/iers_db"

    # JWT Auth
    SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 horas

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = str(BASE_DIR / ".env")
        extra = "ignore"
        env_file_encoding = "utf-8"


settings = Settings()
