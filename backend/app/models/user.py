from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=True)
    role = Column(String(50), default="technician", nullable=False) # requester, technician, approver, admin
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    external_id = Column(String(100), nullable=True) # for hospital Active Directory integration
    is_active = Column(Boolean, default=True, nullable=False)

    department = relationship("Department", back_populates="users")
    staff = relationship("Staff")
