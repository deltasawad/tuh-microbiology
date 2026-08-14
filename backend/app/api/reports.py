import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.submission import Submission
from app.models.report import ReportVersion
from app.models.user import User
from app.services.pdf_service import PdfService

router = APIRouter(prefix="/reports", tags=["Reports & PDF Generation"])

@router.post("/generate/{submission_id}")
def generate_report(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    pdf_url, sha256_hash = PdfService.generate_air_sampling_pdf(db, submission_id, current_user)
    return {
        "message": "Report generated successfully",
        "pdf_url": pdf_url,
        "sha256_hash": sha256_hash,
        "is_amended": submission.is_amended
    }

@router.get("/versions/{submission_id}")
def get_report_versions(submission_id: int, db: Session = Depends(get_db)):
    versions = db.query(ReportVersion).filter(ReportVersion.submission_id == submission_id).order_by(ReportVersion.version_no.desc()).all()
    return [
        {
            "id": v.id,
            "version_no": v.version_no,
            "pdf_file_path": v.pdf_file_path,
            "sha256_hash": v.sha256_hash,
            "created_at": v.created_at,
            "created_by": v.created_by.full_name if v.created_by else "SYSTEM"
        }
        for v in versions
    ]

@router.get("/download/{submission_id}")
def download_latest_report(submission_id: int, db: Session = Depends(get_db)):
    latest = db.query(ReportVersion).filter(ReportVersion.submission_id == submission_id).order_by(ReportVersion.version_no.desc()).first()
    if not latest or not os.path.exists(latest.pdf_file_path):
        # Auto-generate if not exists yet
        pdf_url, sha256_hash = PdfService.generate_air_sampling_pdf(db, submission_id)
        latest = db.query(ReportVersion).filter(ReportVersion.submission_id == submission_id).order_by(ReportVersion.version_no.desc()).first()
        
    return FileResponse(
        latest.pdf_file_path,
        media_type="application/pdf",
        filename=os.path.basename(latest.pdf_file_path)
    )
