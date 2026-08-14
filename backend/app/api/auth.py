from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_token, get_password_hash, verify_password
from app.core.auth_provider import get_auth_provider
from app.models.user import User
from app.schemas.auth import LoginRequest, Token, UserResponse, UserCreate

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    auth_provider = get_auth_provider(settings.AUTH_PROVIDER)
    user_identity = auth_provider.authenticate(db, data.username, data.password)
    
    if not user_identity:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (Invalid username or password)"
        )
        
    access_token = create_access_token(subject=user_identity.user_id, role=user_identity.role)
    refresh_token = create_refresh_token(subject=user_identity.user_id)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user_info={
            "id": user_identity.user_id,
            "username": user_identity.username,
            "full_name": user_identity.full_name,
            "role": user_identity.role,
            "department_id": user_identity.department_id
        }
    )

@router.post("/refresh", response_model=Token)
def refresh_token(refresh_token_str: str, db: Session = Depends(get_db)):
    payload = decode_token(refresh_token_str)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        
    new_access = create_access_token(subject=user.id, role=user.role)
    new_refresh = create_refresh_token(subject=user.id)
    
    return Token(
        access_token=new_access,
        refresh_token=new_refresh,
        user_info={
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "department_id": user.department_id
        }
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
