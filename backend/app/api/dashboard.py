from datetime import date, timedelta
from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db
from app.models.submission import Submission
from app.models.master import Service
from app.models.booking import Booking

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Statistics"])

@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)) -> Dict[str, Any]:
    total_submissions = db.query(Submission).filter(Submission.deleted_at == None).count()
    submitted = db.query(Submission).filter(Submission.status == "SUBMITTED", Submission.deleted_at == None).count()
    received = db.query(Submission).filter(Submission.status == "RECEIVED", Submission.deleted_at == None).count()
    in_progress = db.query(Submission).filter(Submission.status == "IN_PROGRESS", Submission.deleted_at == None).count()
    completed = db.query(Submission).filter(Submission.status == "COMPLETED", Submission.deleted_at == None).count()
    reported = db.query(Submission).filter(Submission.status == "REPORTED", Submission.deleted_at == None).count()
    rejected = db.query(Submission).filter(Submission.status == "REJECTED", Submission.deleted_at == None).count()

    today = date.today()
    today_bookings = db.query(Booking).filter(Booking.booking_date == today).count()
    upcoming_bookings = db.query(Booking).filter(Booking.booking_date >= today).count()

    # Submissions by Service
    by_service = db.query(
        Service.code,
        Service.name_th,
        func.count(Submission.id).label("count")
    ).join(Submission, Submission.service_id == Service.id, isouter=True)\
     .filter(Submission.deleted_at == None)\
     .group_by(Service.code, Service.name_th).all()

    return {
        "metrics": {
            "total": total_submissions,
            "submitted": submitted,
            "received": received,
            "in_progress": in_progress,
            "completed": completed,
            "reported": reported,
            "rejected": rejected,
            "today_bookings": today_bookings,
            "upcoming_bookings": upcoming_bookings
        },
        "by_service": [
            {"code": b[0], "name": b[1], "count": b[2]}
            for b in by_service
        ]
    }
