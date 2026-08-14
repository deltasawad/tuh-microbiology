from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=True)
    entity_name = Column(String(50), nullable=False) # e.g. submissions, sample_results
    entity_id = Column(Integer, nullable=False)
    action = Column(String(20), nullable=False) # INSERT, UPDATE, DELETE, STATUS_CHANGE
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(150), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    before_data = Column(JSON, nullable=True)
    after_data = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)

    submission = relationship("Submission", back_populates="audit_logs")
    user = relationship("User")
