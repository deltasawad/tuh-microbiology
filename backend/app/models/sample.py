from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Numeric
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class Sample(Base, TimestampMixin):
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    sample_no = Column(Integer, nullable=False) # 1..N
    label = Column(String(255), nullable=True) # Location / Food item / Prepared medicine
    ward_id = Column(Integer, ForeignKey("wards.id"), nullable=True)
    collected_at = Column(DateTime, nullable=True)
    
    # Extra sample metadata (e.g. blood_bag_no, product_type, exprid for Sterility)
    sample_metadata = Column(JSON, nullable=True)

    submission = relationship("Submission", back_populates="samples")
    ward = relationship("Ward", back_populates="samples")
    results = relationship("SampleResult", back_populates="sample", cascade="all, delete-orphan")

class SampleResult(Base, TimestampMixin):
    __tablename__ = "sample_results"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    analyte_code = Column(String(100), nullable=False) # bacteria_colonies, fungus_colonies, ecoli, paeruginosa, sterile, result_72h
    result_value = Column(String(255), nullable=True) # Text value e.g. "12", "No growth", "sterile"
    numeric_value = Column(Numeric(10, 2), nullable=True) # Numeric representation if applicable e.g. 12.00
    result_flag = Column(String(50), default="NORMAL", nullable=False) # NORMAL, ABNORMAL, CRITICAL, NOT_REPORTED
    remarks = Column(Text, nullable=True)

    sample = relationship("Sample", back_populates="results")
