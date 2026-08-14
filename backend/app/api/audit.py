from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.booking import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["ISO 15189 Audit Trail"])

@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    submission_id: Optional[int] = None,
    action: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_roles(["technician", "approver", "admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if submission_id:
        query = query.filter(AuditLog.submission_id == submission_id)
    if action:
        query = query.filter(AuditLog.action == action)
        
    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    return logs
