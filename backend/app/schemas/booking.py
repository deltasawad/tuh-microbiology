from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class BookingBase(BaseModel):
    booking_date: date
    test_type: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    full_name: str
    contact_number: str
    sample_count: int = 1
    remarks: Optional[str] = None

class BookingCreate(BookingBase):
    pass

class BookingUpdate(BaseModel):
    booking_date: Optional[date] = None
    test_type: Optional[str] = None
    department_name: Optional[str] = None
    full_name: Optional[str] = None
    contact_number: Optional[str] = None
    sample_count: Optional[int] = None
    status: Optional[str] = None
    remarks: Optional[str] = None

class BookingResponse(BookingBase):
    id: int
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AuditLogResponse(BaseModel):
    id: int
    submission_id: Optional[int] = None
    entity_name: str
    entity_id: int
    action: str
    user_name: Optional[str] = None
    timestamp: datetime
    before_data: Optional[dict] = None
    after_data: Optional[dict] = None
    reason: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
