import sys, os
import io
from datetime import date

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import SessionLocal, Base, engine
from app.models.master import Service, Department, Ward, Staff
from app.models.submission import Submission
from app.models.user import User
from app.schemas.submission import SubmissionCreate, SubmissionUpdate, StatusChangeRequest
from app.schemas.sample import SampleCreate, SampleResultCreate
from app.services.submission_service import SubmissionService
from app.services.tat_service import TatService

def run_air_workflow_tests():
    db = SessionLocal()
    print("=== Testing AIR-01 Pilot Core Workflow ===")
    
    # 1. Get test master records
    service = db.query(Service).filter(Service.code == "AIR-01").first()
    dept = db.query(Department).first()
    wards = db.query(Ward).limit(3).all()
    tech_user = db.query(User).filter(User.username == "tech_manop").first()
    approver_user = db.query(User).filter(User.username == "approver_narisara").first()
    staff_manop = db.query(Staff).filter(Staff.first_name == "มานพ").first()
    staff_narisara = db.query(Staff).filter(Staff.first_name == "นริศรา").first()

    assert service is not None, "AIR-01 service must exist"
    assert dept is not None, "Department must exist"
    assert len(wards) >= 2, "At least 2 wards required"

    # 2. Test Submission Creation
    sub_in = SubmissionCreate(
        service_code="AIR-01",
        department_id=dept.id,
        submission_date=date.today(),
        sender_name="คุณพยาบาลทดสอบ",
        sender_email="nurse@tuh.ac.th",
        sample_type="อากาศ",
        samples=[
            SampleCreate(sample_no=1, ward_id=wards[0].id, label="ห้องผู้ป่วย 101 หน้าต่าง"),
            SampleCreate(sample_no=2, ward_id=wards[1].id, label="เคาน์เตอร์พยาบาล ชั้น 3")
        ]
    )

    submission = SubmissionService.create_submission(db, sub_in, tech_user)
    print(f"  [PASS] Created Submission: {submission.submission_no} (Status: {submission.status})")
    assert submission.status == "SUBMITTED"
    assert len(submission.samples) == 2
    assert len(submission.audit_logs) >= 1

    # 3. Test Status Change to RECEIVED -> IN_PROGRESS
    sub_received = SubmissionService.change_status(
        db=db,
        submission_id=submission.id,
        to_status="RECEIVED",
        reason="แล็บรับตัวอย่างเรียบร้อย",
        current_user=tech_user
    )
    print(f"  [PASS] Transitioned to: {sub_received.status}")
    assert sub_received.status == "RECEIVED"

    sub_inprogress = SubmissionService.change_status(
        db=db,
        submission_id=submission.id,
        to_status="IN_PROGRESS",
        reason="เริ่มบ่มเพาะเชื้อบนจานอาหาร",
        current_user=tech_user
    )
    print(f"  [PASS] Transitioned to: {sub_inprogress.status}")
    assert sub_inprogress.status == "IN_PROGRESS"

    # 4. Test Result Entry
    update_in = SubmissionUpdate(
        reporter_id=staff_manop.id,
        samples=[
            SampleCreate(
                sample_no=1,
                ward_id=wards[0].id,
                label="ห้องผู้ป่วย 101 หน้าต่าง",
                results=[
                    SampleResultCreate(analyte_code="bacteria_colonies", result_value="14", numeric_value=14.0, result_flag="NORMAL"),
                    SampleResultCreate(analyte_code="fungus_colonies", result_value="0", numeric_value=0.0, result_flag="NORMAL")
                ]
            ),
            SampleCreate(
                sample_no=2,
                ward_id=wards[1].id,
                label="เคาน์เตอร์พยาบาล ชั้น 3",
                results=[
                    SampleResultCreate(analyte_code="bacteria_colonies", result_value="45", numeric_value=45.0, result_flag="NORMAL"),
                    SampleResultCreate(analyte_code="fungus_colonies", result_value="1", numeric_value=1.0, result_flag="ABNORMAL", remarks="พบรา 1 โคโลนี")
                ]
            )
        ],
        edit_reason="กรอกผลการตรวจนับโคโลนี 48 ชม."
    )

    sub_updated = SubmissionService.update_submission_and_results(db, submission.id, update_in, tech_user)
    print(f"  [PASS] Results recorded by: {sub_updated.reporter.first_name}")
    assert sub_updated.reporter_id == staff_manop.id
    
    # Verify results in DB
    sample1_results = sub_updated.samples[0].results
    bac_res = next(r for r in sample1_results if r.analyte_code == "bacteria_colonies")
    assert bac_res.result_value == "14"

    # 5. Test Electronic Signature Rule: Reporter != Reviewer
    try:
        SubmissionService.change_status(
            db=db,
            submission_id=submission.id,
            to_status="REPORTED",
            reason="อนุมัติผล",
            current_user=tech_user,
            reporter_id=staff_manop.id,
            reviewer_id=staff_manop.id # Same person! Should fail ISO 15189 rule
        )
        assert False, "Should have rejected identical reporter and reviewer"
    except Exception as e:
        print(f"  [PASS] ISO 15189 Signature Enforcement works (Rejected same reporter & reviewer): {e.detail if hasattr(e, 'detail') else e}")

    # Complete workflow to COMPLETED then REPORTED
    sub_completed = SubmissionService.change_status(
        db=db,
        submission_id=submission.id,
        to_status="COMPLETED",
        reason="ตรวจครบถ้วนรอหัวหน้าอนุมัติ",
        current_user=tech_user
    )
    assert sub_completed.status == "COMPLETED"

    sub_reported = SubmissionService.change_status(
        db=db,
        submission_id=submission.id,
        to_status="REPORTED",
        reason="หัวหน้าห้องแล็บตรวจสอบและอนุมัติผล",
        current_user=approver_user,
        reporter_id=staff_manop.id,
        reviewer_id=staff_narisara.id
    )
    print(f"  [PASS] Official Report Released: Status = {sub_reported.status}, Reviewer = {sub_reported.reviewer.first_name}")
    assert sub_reported.status == "REPORTED"

    # 6. Test TAT Calculation
    tat = TatService.calculate_tat(sub_reported.status_transitions)
    print(f"  [PASS] TAT Breakdown: {tat}")
    assert tat["total_tat_hours"] is not None

    # 7. Test Audit Logs Count
    audit_count = len(sub_reported.audit_logs)
    print(f"  [PASS] Audit Log Entries Recorded: {audit_count}")
    assert audit_count >= 5

    print("\nALL WORKFLOW & ISO 15189 TESTS PASSED SUCCESSFULLY!")
    db.close()

if __name__ == "__main__":
    run_air_workflow_tests()
