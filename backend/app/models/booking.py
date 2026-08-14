from datetime import date
from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class Booking(Base, TimestampMixin):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_date = Column(Date, index=True, nullable=False)
    test_type = Column(String(50), nullable=False) # น้ำ, อาหาร, อากาศ, ยา, เลือด, Stool checkup
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    department_name = Column(String(200), nullable=True)
    full_name = Column(String(150), nullable=False)
    contact_number = Column(String(50), nullable=False)
    sample_count = Column(Integer, default=1, nullable=False)
    status = Column(String(30), default="PENDING", nullable=False) # PENDING, CONFIRMED, CANCELLED
    remarks = Column(Text, nullable=True)

    department = relationship("Department", back_populates="bookings")
