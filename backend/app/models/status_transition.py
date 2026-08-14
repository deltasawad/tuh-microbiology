from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class StatusTransition(Base):
    __tablename__ = "status_transitions"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    transitioned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    reason = Column(Text, nullable=True) # Required for REJECTED / AMENDED

    submission = relationship("Submission", back_populates="status_transitions")
    actor = relationship("User")
