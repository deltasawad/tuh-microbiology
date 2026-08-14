from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from app.models.user import User

class AuditService:
    @staticmethod
    def log_change(
        db: Session,
        entity_name: str,
        entity_id: int,
        action: str,
        user: Optional[User] = None,
        submission_id: Optional[int] = None,
        before_data: Optional[Any] = None,
        after_data: Optional[Any] = None,
        reason: Optional[str] = None
    ) -> AuditLog:
        user_id = user.id if user else None
        user_name = user.full_name if user else "SYSTEM"
        
        audit_entry = AuditLog(
            submission_id=submission_id,
            entity_name=entity_name,
            entity_id=entity_id,
            action=action,
            user_id=user_id,
            user_name=user_name,
            before_data=before_data,
            after_data=after_data,
            reason=reason
        )
        db.add(audit_entry)
        db.flush()
        return audit_entry
