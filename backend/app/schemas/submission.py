from datetime import date, datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict
from app.schemas.sample import SampleCreate, SampleResponse

class SubmissionBase(BaseModel):
    service_code: str
    department_id: int
    submission_date: date
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    sample_type: Optional[str] = None
    specimen_type: Optional[str] = None
    suspected_organism: Optional[str] = None
    extra_data: Optional[Any] = None

class SubmissionCreate(SubmissionBase):
    samples: List[SampleCreate]

class SubmissionUpdate(BaseModel):
    department_id: Optional[int] = None
    submission_date: Optional[date] = None
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    sample_type: Optional[str] = None
    specimen_type: Optional[str] = None
    suspected_organism: Optional[str] = None
    extra_data: Optional[Any] = None
    samples: Optional[List[SampleCreate]] = None
    reporter_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    edit_reason: Optional[str] = None # Required for ISO 15189 audit trail if changing recorded results

class StatusChangeRequest(BaseModel):
    to_status: str # RECEIVED, IN_PROGRESS, COMPLETED, REPORTED, REJECTED
    reason: Optional[str] = None
    reporter_id: Optional[int] = None
    reviewer_id: Optional[int] = None

class StatusTransitionResponse(BaseModel):
    id: int
    from_status: Optional[str] = None
    to_status: str
    transitioned_at: datetime
    actor_name: Optional[str] = None
    reason: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class SubmissionResponse(BaseModel):
    id: int
    submission_no: str
    service_code: str
    service_name: str
    department_id: int
    department_name: str
    submission_date: date
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    sample_type: Optional[str] = None
    sample_count: int
    status: str
    is_amended: bool
    reporter_name: Optional[str] = None
    reviewer_name: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SubmissionDetailResponse(SubmissionResponse):
    specimen_type: Optional[str] = None
    suspected_organism: Optional[str] = None
    extra_data: Optional[Any] = None
    reported_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    samples: List[SampleResponse] = []
    status_transitions: List[StatusTransitionResponse] = []
    model_config = ConfigDict(from_attributes=True)
