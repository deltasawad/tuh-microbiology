from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict

class ServiceBase(BaseModel):
    code: str
    name_th: str
    name_en: Optional[str] = None
    department_owner: Optional[str] = None
    tat_target_hours: int = 24
    form_schema: Optional[Any] = None
    is_active: bool = True

class ServiceResponse(ServiceBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class DepartmentResponse(BaseModel):
    id: int
    code: Optional[str] = None
    name_th: str
    contact_phone: Optional[str] = None
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)

class WardResponse(BaseModel):
    id: int
    department_id: Optional[int] = None
    name_th: str
    floor: Optional[str] = None
    building: Optional[str] = None
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)

class StaffResponse(BaseModel):
    id: int
    title: str
    first_name: str
    last_name: str
    license_no: str
    full_name_with_license: str
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)

class OrganismResponse(BaseModel):
    id: int
    name: str
    is_pathogen: bool = True
    model_config = ConfigDict(from_attributes=True)

class ReferenceRangeResponse(BaseModel):
    id: int
    service_id: int
    analyte_code: str
    room_grade: Optional[str] = None
    limit_min: Optional[float] = None
    limit_max: Optional[float] = None
    unit: str
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
