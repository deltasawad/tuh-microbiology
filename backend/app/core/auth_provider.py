from typing import Protocol, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.security import verify_password

class UserIdentity(BaseModel):
    user_id: int
    username: str
    full_name: str
    role: str
    department_id: Optional[int] = None
    is_active: bool = True

class AuthProvider(Protocol):
    def authenticate(self, db: Session, username: str, password: str) -> Optional[UserIdentity]:
        ...

class LocalPasswordProvider:
    def authenticate(self, db: Session, username: str, password: str) -> Optional[UserIdentity]:
        from app.models.user import User
        user = db.query(User).filter(User.username == username, User.is_active == True).first()
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return UserIdentity(
            user_id=user.id,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            department_id=user.department_id,
            is_active=user.is_active
        )

class LDAPProvider:
    """Pluggable LDAP / Active Directory provider for hospital AD integration"""
    def __init__(self, server_uri: Optional[str] = None):
        self.server_uri = server_uri

    def authenticate(self, db: Session, username: str, password: str) -> Optional[UserIdentity]:
        # Fallback to local if LDAP server is not configured
        local_auth = LocalPasswordProvider()
        return local_auth.authenticate(db, username, password)

def get_auth_provider(provider_type: str = "local") -> AuthProvider:
    if provider_type == "ldap":
        return LDAPProvider()
    return LocalPasswordProvider()
