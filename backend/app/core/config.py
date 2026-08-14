import os
from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "TUH Microbiology Environmental Reporting System"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite:///./tuh_microbiology.db"

    # JWT Authentication
    JWT_SECRET_KEY: str = "9f8234ab8e76c12d3450918ef029c81726a45b9012cd34ef567890abcdef1234"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Pluggable Auth: 'local' | 'ldap'
    AUTH_PROVIDER: str = "local"

    # Storage Path for PDFs
    STORAGE_PATH: str = "./storage"

    # CORS Origins
    CORS_ORIGINS: List[str] = ["*"]

    # Notification integrations (server-side only)
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
