from datetime import date, datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.submission import Submission
from app.models.sample import Sample, SampleResult
from app.models.master import Service, Department, Ward, Staff
from app.models.status_transition import StatusTransition
from app.models.user import User
from app.schemas.submission import SubmissionCreate, SubmissionUpdate
from app.services.audit_service import AuditService

class SubmissionService:
    @staticmethod
    def generate_submission_no(db: Session, service_code: str, sub_date: date) -> str:
        """Generate formatted Thai Buddhist year submission number: SUB-CODE-YYMM-XXX"""
        th_year = (sub_date.year + 543) % 100
        prefix = f"SUB-{service_code.replace('-', '')}-{th_year:02d}{sub_date.month:02d}"
        
        # Count existing today/month
        count = db.query(Submission).filter(Submission.submission_no.like(f"{prefix}-%")).count()
        next_seq = count + 1
        return f"{prefix}-{next_seq:03d}"

    @staticmethod
    def create_submission(db: Session, data: SubmissionCreate, current_user: Optional[User] = None) -> Submission:
        service = db.query(Service).filter(Service.code == data.service_code, Service.is_active == True).first()
        if not service:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Service {data.service_code} not found")
        
        dept = db.query(Department).filter(Department.id == data.department_id, Department.is_active == True).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

        sub_no = SubmissionService.generate_submission_no(db, service.code, data.submission_date)
        
        submission = Submission(
            submission_no=sub_no,
            service_id=service.id,
            department_id=dept.id,
            submission_date=data.submission_date,
            sender_name=data.sender_name,
            sender_email=data.sender_email.lower() if data.sender_email else None,
            sample_type=data.sample_type or "อากาศ",
            specimen_type=data.specimen_type,
            suspected_organism=data.suspected_organism,
            sample_count=len(data.samples),
            status="SUBMITTED",
            extra_data=data.extra_data
        )
        db.add(submission)
        db.flush()

        # Add initial status transition
        transition = StatusTransition(
            submission_id=submission.id,
            from_status=None,
            to_status="SUBMITTED",
            actor_user_id=current_user.id if current_user else None,
            reason="สร้างใบส่งตรวจใหม่"
        )
        db.add(transition)

        # Create Samples and Results
        for s_in in data.samples:
            sample = Sample(
                submission_id=submission.id,
                sample_no=s_in.sample_no,
                label=s_in.label,
                ward_id=s_in.ward_id,
                sample_metadata=s_in.sample_metadata
            )
            db.add(sample)
            db.flush()

            # If results were passed, add them; otherwise create default analyte slots
            if s_in.results:
                for r_in in s_in.results:
                    res = SampleResult(
                        sample_id=sample.id,
                        analyte_code=r_in.analyte_code,
                        result_value=r_in.result_value,
                        numeric_value=r_in.numeric_value,
                        result_flag=r_in.result_flag,
                        remarks=r_in.remarks
                    )
                    db.add(res)
            elif service.code == "AIR-01":
                # Default 2 analytes for Air Sampling
                db.add(SampleResult(sample_id=sample.id, analyte_code="bacteria_colonies", result_value=None, result_flag="NORMAL"))
                db.add(SampleResult(sample_id=sample.id, analyte_code="fungus_colonies", result_value=None, result_flag="NORMAL"))

        # Log audit entry
        AuditService.log_change(
            db=db,
            entity_name="submissions",
            entity_id=submission.id,
            action="INSERT",
            user=current_user,
            submission_id=submission.id,
            after_data={"submission_no": sub_no, "sample_count": len(data.samples)},
            reason="สร้างใบส่งตรวจ"
        )

        db.commit()
        db.refresh(submission)
        return submission

    @staticmethod
    def update_submission_and_results(
        db: Session,
        submission_id: int,
        data: SubmissionUpdate,
        current_user: User
    ) -> Submission:
        submission = db.query(Submission).filter(Submission.id == submission_id, Submission.deleted_at == None).first()
        if not submission:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

        # Snapshot before data for Audit Log
        before_snapshot = {
            "status": submission.status,
            "reporter_id": submission.reporter_id,
            "reviewer_id": submission.reviewer_id,
            "samples": [
                {
                    "id": s.id,
                    "sample_no": s.sample_no,
                    "label": s.label,
                    "ward_id": s.ward_id,
                    "results": [{"analyte": r.analyte_code, "value": r.result_value, "flag": r.result_flag} for r in s.results]
                }
                for s in submission.samples
            ]
        }

        # Check signature validation
        if data.reporter_id and data.reviewer_id and data.reporter_id == data.reviewer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ISO 15189 Requirement: ผู้รายงานผล (Reporter) และผู้ตรวจสอบ/อนุมัติผล (Reviewer) ต้องเป็นคนละคนกัน"
            )

        if data.reporter_id:
            submission.reporter_id = data.reporter_id
            submission.reported_at = datetime.now(timezone.utc)
        if data.reviewer_id:
            submission.reviewer_id = data.reviewer_id
            submission.reviewed_at = datetime.now(timezone.utc)

        if data.sender_name is not None:
            submission.sender_name = data.sender_name
        if data.sender_email is not None:
            submission.sender_email = data.sender_email.lower()
        if data.extra_data is not None:
            submission.extra_data = data.extra_data

        # Update samples and results
        if data.samples:
            for s_in in data.samples:
                sample = db.query(Sample).filter(Sample.submission_id == submission.id, Sample.sample_no == s_in.sample_no).first()
                if not sample:
                    sample = Sample(
                        submission_id=submission.id,
                        sample_no=s_in.sample_no,
                        label=s_in.label,
                        ward_id=s_in.ward_id
                    )
                    db.add(sample)
                    db.flush()
                else:
                    sample.label = s_in.label
                    sample.ward_id = s_in.ward_id

                if s_in.results:
                    for r_in in s_in.results:
                        res = db.query(SampleResult).filter(
                            SampleResult.sample_id == sample.id,
                            SampleResult.analyte_code == r_in.analyte_code
                        ).first()
                        if not res:
                            res = SampleResult(
                                sample_id=sample.id,
                                analyte_code=r_in.analyte_code,
                                result_value=r_in.result_value,
                                numeric_value=r_in.numeric_value,
                                result_flag=r_in.result_flag,
                                remarks=r_in.remarks
                            )
                            db.add(res)
                        else:
                            res.result_value = r_in.result_value
                            res.numeric_value = r_in.numeric_value
                            res.result_flag = r_in.result_flag
                            res.remarks = r_in.remarks

        # If already reported, mark as amended
        if submission.status == "REPORTED":
            submission.is_amended = True
            submission.amended_reason = data.edit_reason or "แก้ไขผลตรวจหลังออกรายงาน"

        # Log ISO 15189 Audit Trail
        AuditService.log_change(
            db=db,
            entity_name="submissions",
            entity_id=submission.id,
            action="UPDATE",
            user=current_user,
            submission_id=submission.id,
            before_data=before_snapshot,
            after_data={"edit_reason": data.edit_reason, "is_amended": submission.is_amended},
            reason=data.edit_reason or "บันทึกผลการตรวจ"
        )

        db.commit()
        db.refresh(submission)
        return submission

    @staticmethod
    def change_status(
        db: Session,
        submission_id: int,
        to_status: str,
        reason: Optional[str],
        current_user: User,
        reporter_id: Optional[int] = None,
        reviewer_id: Optional[int] = None
    ) -> Submission:
        submission = db.query(Submission).filter(Submission.id == submission_id, Submission.deleted_at == None).first()
        if not submission:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

        valid_transitions = {
            "DRAFT": ["SUBMITTED", "REJECTED"],
            "SUBMITTED": ["RECEIVED", "REJECTED"],
            "RECEIVED": ["IN_PROGRESS", "REJECTED"],
            "IN_PROGRESS": ["COMPLETED", "REJECTED"],
            "COMPLETED": ["REPORTED", "IN_PROGRESS", "REJECTED"],
            "REPORTED": ["COMPLETED"], # Allowed only for amended review
            "REJECTED": []
        }

        allowed = valid_transitions.get(submission.status, [])
        if to_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"ไม่สามารถเปลี่ยนสถานะจาก {submission.status} ไปเป็น {to_status} ได้"
            )

        if to_status == "REJECTED" and not reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="การยกเลิก/ปฏิเสธสิ่งส่งตรวจ (REJECTED) บังคับต้องระบุเหตุผล"
            )

        if to_status == "REPORTED":
            if reporter_id:
                submission.reporter_id = reporter_id
            if reviewer_id:
                submission.reviewer_id = reviewer_id
                
            if not submission.reporter_id or not submission.reviewer_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="การอนุมัติออกรายงานผล (REPORTED) ต้องระบุผู้รายงานผลและผู้ตรวจสอบผลให้ครบถ้วน"
                )
            if submission.reporter_id == submission.reviewer_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="ISO 15189 Requirement: ผู้รายงานผลและผู้อนุมัติผลต้องเป็นคนละคนกัน"
                )
            submission.reported_at = datetime.now(timezone.utc)

        from_status = submission.status
        submission.status = to_status

        transition = StatusTransition(
            submission_id=submission.id,
            from_status=from_status,
            to_status=to_status,
            actor_user_id=current_user.id,
            reason=reason
        )
        db.add(transition)

        AuditService.log_change(
            db=db,
            entity_name="submissions",
            entity_id=submission.id,
            action="STATUS_CHANGE",
            user=current_user,
            submission_id=submission.id,
            before_data={"status": from_status},
            after_data={"status": to_status},
            reason=reason
        )

        db.commit()
        db.refresh(submission)
        return submission
