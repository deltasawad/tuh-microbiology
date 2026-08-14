from typing import Optional, Any
from pydantic import BaseModel, ConfigDict

class SampleResultBase(BaseModel):
    analyte_code: str
    result_value: Optional[str] = None
    numeric_value: Optional[float] = None
    result_flag: str = "NORMAL"
    remarks: Optional[str] = None

class SampleResultCreate(SampleResultBase):
    pass

class SampleResultResponse(SampleResultBase):
    id: int
    sample_id: int
    model_config = ConfigDict(from_attributes=True)

class SampleBase(BaseModel):
    sample_no: int
    label: Optional[str] = None
    ward_id: Optional[int] = None
    sample_metadata: Optional[Any] = None

class SampleCreate(SampleBase):
    results: Optional[list[SampleResultCreate]] = None

class SampleResponse(SampleBase):
    id: int
    submission_id: int
    ward_name: Optional[str] = None
    results: list[SampleResultResponse] = []
    model_config = ConfigDict(from_attributes=True)
