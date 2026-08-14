from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class ReportVersion(Base):
    __tablename__ = "report_versions"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    version_no = Column(Integer, default=1, nullable=False) # 1, 2 (Amended)
    pdf_file_path = Column(String(255), nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    submission = relationship("Submission", back_populates="report_versions")
    created_by = relationship("User")
