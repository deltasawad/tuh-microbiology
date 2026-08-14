from sqlalchemy import Column, Integer, String, Text, Boolean, Numeric, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class Service(Base, TimestampMixin):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False) # e.g. AIR-01, STR-02
    name_th = Column(String(200), nullable=False)
    name_en = Column(String(200), nullable=True)
    department_owner = Column(String(200), nullable=True)
    tat_target_hours = Column(Integer, default=24) # Target TAT in hours
    form_schema = Column(JSON, nullable=True) # JSON schema defining dynamic fields
    is_active = Column(Boolean, default=True, nullable=False)

    submissions = relationship("Submission", back_populates="service")
    reference_ranges = relationship("ReferenceRange", back_populates="service")

class Department(Base, TimestampMixin):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=True)
    name_th = Column(String(255), unique=True, index=True, nullable=False)
    contact_phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    wards = relationship("Ward", back_populates="department")
    users = relationship("User", back_populates="department")
    submissions = relationship("Submission", back_populates="department")
    bookings = relationship("Booking", back_populates="department")

class Ward(Base, TimestampMixin):
    __tablename__ = "wards"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    name_th = Column(String(255), unique=True, index=True, nullable=False)
    floor = Column(String(50), nullable=True)
    building = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    department = relationship("Department", back_populates="wards")
    samples = relationship("Sample", back_populates="ward")

class Staff(Base, TimestampMixin):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(50), default="ทนพ.")
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    license_no = Column(String(50), nullable=False) # เลข ทน.
    signature_image = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    @property
    def full_name_with_license(self) -> str:
        return f"{self.title}{self.first_name} {self.last_name} ({self.license_no})"

class Organism(Base, TimestampMixin):
    __tablename__ = "organisms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    is_pathogen = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True, nullable=False)

class ReferenceRange(Base, TimestampMixin):
    __tablename__ = "reference_ranges"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    analyte_code = Column(String(50), nullable=False) # e.g. bacteria_colonies, fungus_colonies
    room_grade = Column(String(50), nullable=True) # e.g. OR, ICU, Cleanroom Class A/B/C/D
    limit_min = Column(Numeric(10, 2), nullable=True)
    limit_max = Column(Numeric(10, 2), nullable=True)
    unit = Column(String(50), default="CFU/plate")
    description = Column(Text, nullable=True)

    service = relationship("Service", back_populates="reference_ranges")
