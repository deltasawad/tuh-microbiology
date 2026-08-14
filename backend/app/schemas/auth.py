from typing import Optional
from pydantic import BaseModel, ConfigDict

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_info: dict

class TokenPayload(BaseModel):
    sub: str
    role: str
    type: str

class UserBase(BaseModel):
    username: str
    full_name: str
    email: Optional[str] = None
    role: str = "technician"
    department_id: Optional[int] = None
    staff_id: Optional[int] = None
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
