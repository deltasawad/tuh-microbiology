from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.api.deps import get_db, get_current_user, get_optional_user, require_roles
from app.models.submission import Submission
from app.models.user import User
from app.schemas.submission import (
    SubmissionCreate, SubmissionUpdate, SubmissionResponse, SubmissionDetailResponse, StatusChangeRequest
)
from app.services.submission_service import SubmissionService
from app.services.tat_service import TatService

router = APIRouter(prefix="/submissions", tags=["Submissions"])

@router.get("", response_model=List[SubmissionResponse])
def list_submissions(
    service_code: Optional[str] = None,
    status: Optional[str] = None,
    department_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Submission).filter(Submission.deleted_at == None)
    
    if service_code:
        query = query.join(Submission.service).filter(Submission.service.has(code=service_code))
    if status:
        query = query.filter(Submission.status == status)
    if department_id:
        query = query.filter(Submission.department_id == department_id)
    if start_date:
        query = query.filter(Submission.submission_date >= start_date)
    if end_date:
        query = query.filter(Submission.submission_date <= end_date)
    if search:
        s_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Submission.submission_no.ilike(s_pattern),
                Submission.sender_name.ilike(s_pattern),
                Submission.sender_email.ilike(s_pattern)
            )
        )
        
    submissions = query.order_by(Submission.submission_date.desc(), Submission.id.desc()).offset(offset).limit(limit).all()
    
    result = []
    for s in submissions:
        rep_name = s.reporter.full_name_with_license if s.reporter else None
        rev_name = s.reviewer.full_name_with_license if s.reviewer else None
        result.append(SubmissionResponse(
            id=s.id,
            submission_no=s.submission_no,
            service_code=s.service.code,
            service_name=s.service.name_th,
            department_id=s.department_id,
            department_name=s.department.name_th,
            submission_date=s.submission_date,
            sender_name=s.sender_name,
            sender_email=s.sender_email,
            sample_type=s.sample_type,
            sample_count=s.sample_count,
            status=s.status,
            is_amended=s.is_amended,
            reporter_name=rep_name,
            reviewer_name=rev_name,
            created_at=s.created_at
        ))
    return result

@router.get("/{submission_id}", response_model=SubmissionDetailResponse)
def get_submission_detail(submission_id: int, db: Session = Depends(get_db)):
    s = db.query(Submission).filter(Submission.id == submission_id, Submission.deleted_at == None).first()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    rep_name = s.reporter.full_name_with_license if s.reporter else None
    rev_name = s.reviewer.full_name_with_license if s.reviewer else None

    # Prepare samples
    samples_data = []
    for samp in s.samples:
        ward_name = samp.ward.name_th if samp.ward else None
        samples_data.append({
            "id": samp.id,
            "submission_id": samp.submission_id,
            "sample_no": samp.sample_no,
            "label": samp.label,
            "ward_id": samp.ward_id,
            "ward_name": ward_name,
            "sample_metadata": samp.sample_metadata,
            "results": [
                {
                    "id": r.id,
                    "sample_id": r.sample_id,
                    "analyte_code": r.analyte_code,
                    "result_value": r.result_value,
                    "numeric_value": float(r.numeric_value) if r.numeric_value is not None else None,
                    "result_flag": r.result_flag,
                    "remarks": r.remarks
                }
                for r in samp.results
            ]
        })

    # Prepare status transitions
    transitions_data = [
        {
            "id": t.id,
            "from_status": t.from_status,
            "to_status": t.to_status,
            "transitioned_at": t.transitioned_at,
            "actor_name": t.actor.full_name if t.actor else "SYSTEM",
            "reason": t.reason
        }
        for t in s.status_transitions
    ]

    return SubmissionDetailResponse(
        id=s.id,
        submission_no=s.submission_no,
        service_code=s.service.code,
        service_name=s.service.name_th,
        department_id=s.department_id,
        department_name=s.department.name_th,
        submission_date=s.submission_date,
        sender_name=s.sender_name,
        sender_email=s.sender_email,
        sample_type=s.sample_type,
        specimen_type=s.specimen_type,
        suspected_organism=s.suspected_organism,
        sample_count=s.sample_count,
        status=s.status,
        is_amended=s.is_amended,
        reporter_name=rep_name,
        reviewer_name=rev_name,
        reported_at=s.reported_at,
        reviewed_at=s.reviewed_at,
        extra_data=s.extra_data,
        samples=samples_data,
        status_transitions=transitions_data,
        created_at=s.created_at
    )

@router.post("", response_model=SubmissionDetailResponse)
def create_submission(
    data: SubmissionCreate,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    submission = SubmissionService.create_submission(db, data, current_user)
    return get_submission_detail(submission.id, db)

@router.put("/{submission_id}", response_model=SubmissionDetailResponse)
def update_submission_results(
    submission_id: int,
    data: SubmissionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    submission = SubmissionService.update_submission_and_results(db, submission_id, data, current_user)
    return get_submission_detail(submission.id, db)

@router.post("/{submission_id}/status", response_model=SubmissionDetailResponse)
def change_submission_status(
    submission_id: int,
    req: StatusChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    submission = SubmissionService.change_status(
        db=db,
        submission_id=submission_id,
        to_status=req.to_status,
        reason=req.reason,
        current_user=current_user,
        reporter_id=req.reporter_id,
        reviewer_id=req.reviewer_id
    )
    return get_submission_detail(submission.id, db)

@router.get("/{submission_id}/tat")
def get_submission_tat(submission_id: int, db: Session = Depends(get_db)):
    s = db.query(Submission).filter(Submission.id == submission_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found")
    tat_metrics = TatService.calculate_tat(s.status_transitions)
    return {
        "submission_no": s.submission_no,
        "service_code": s.service.code,
        "tat_target_hours": s.service.tat_target_hours,
        "metrics": tat_metrics,
        "is_within_target": tat_metrics["total_tat_hours"] <= s.service.tat_target_hours if tat_metrics["total_tat_hours"] else None
    }
