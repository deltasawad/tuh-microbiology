from datetime import date, datetime
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class Submission(Base, TimestampMixin):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    submission_no = Column(String(50), unique=True, index=True, nullable=False) # e.g. SUB-AIR-256908-001
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    
    submission_date = Column(Date, default=date.today, nullable=False)
    sender_name = Column(String(150), nullable=True)
    sender_email = Column(String(150), nullable=True)
    sample_type = Column(String(100), nullable=True)
    specimen_type = Column(String(100), nullable=True)
    suspected_organism = Column(String(150), nullable=True)
    sample_count = Column(Integer, default=1, nullable=False)
    
    # Status: DRAFT, SUBMITTED, RECEIVED, IN_PROGRESS, COMPLETED, REPORTED, REJECTED
    status = Column(String(30), default="SUBMITTED", index=True, nullable=False)
    
    # Signatures (ISO 15189 requirement: Reporter & Reviewer must be different)
    reporter_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    reviewer_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    
    reported_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    # Extra dynamic fields for specific services (e.g. DRG-07/08 lot_no, prep_date)
    extra_data = Column(JSON, nullable=True)
    
    is_amended = Column(Boolean, default=False, nullable=False)
    amended_reason = Column(Text, nullable=True)
    
    # Soft deletion for ISO 15189 compliance (never hard delete audit trail)
    deleted_at = Column(DateTime, nullable=True)

    service = relationship("Service", back_populates="submissions")
    department = relationship("Department", back_populates="submissions")
    reporter = relationship("Staff", foreign_keys=[reporter_id])
    reviewer = relationship("Staff", foreign_keys=[reviewer_id])
    
    samples = relationship("Sample", back_populates="submission", cascade="all, delete-orphan", order_by="Sample.sample_no")
    status_transitions = relationship("StatusTransition", back_populates="submission", cascade="all, delete-orphan", order_by="StatusTransition.id")
    audit_logs = relationship("AuditLog", back_populates="submission", cascade="all, delete-orphan", order_by="AuditLog.id.desc()")
    report_versions = relationship("ReportVersion", back_populates="submission", cascade="all, delete-orphan", order_by="ReportVersion.version_no.desc()")
