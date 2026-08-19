import os
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings

# ⚠️ ห้ามฝังรหัสผ่านฐานข้อมูลไว้ในไฟล์นี้ — ไฟล์นี้ถูก commit เข้า git
#    ค่าจริงต้องมาจาก Environment Variable ชื่อ DATABASE_URL เท่านั้น
#    (ตั้งใน Render Dashboard > Environment หรือไฟล์ .env ที่ไม่ได้ commit)
SUPABASE_POOLER_URL = os.getenv("DATABASE_URL", "")

class Settings(BaseSettings):
    PROJECT_NAME: str = "TUH Microbiology Environmental Reporting System"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database (Supabase Cloud PostgreSQL Pooler)
    DATABASE_URL: str = SUPABASE_POOLER_URL

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v):
        if not v or not isinstance(v, str) or v.strip() == "" or "sqlite" in v:
            if not SUPABASE_POOLER_URL:
                raise ValueError(
                    "ไม่พบ DATABASE_URL — กรุณาตั้ง Environment Variable "
                    "DATABASE_URL ใน Render Dashboard หรือไฟล์ .env ก่อนเริ่มระบบ"
                )
            return SUPABASE_POOLER_URL
        return v.strip()

    # JWT Authentication
    # ⚠️ ค่าจริงต้องมาจาก Environment Variable ชื่อ JWT_SECRET_KEY
    #    ค่าด้านล่างเป็นค่าสำหรับรันทดสอบในเครื่องเท่านั้น ห้ามใช้จริง
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "dev-only-change-me")
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
