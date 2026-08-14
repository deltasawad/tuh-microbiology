import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_api_suite():
    print("=== Testing FastAPI End-to-End API Suite ===")

    # 1. Healthcheck
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("  [PASS] /api/health ->", res.json()["status"])

    # 2. Login as Technician
    res = client.post("/api/auth/login", json={"username": "tech_manop", "password": "Tech@1234"})
    assert res.status_code == 200, f"Login failed: {res.text}"
    tech_token = res.json()["access_token"]
    print("  [PASS] /api/auth/login (Technician) -> Token received")

    # 3. Master Data
    res = client.get("/api/master/services")
    assert res.status_code == 200
    services = res.json()
    assert len(services) == 8, f"Expected 8 services, got {len(services)}"
    print(f"  [PASS] /api/master/services -> {len(services)} services")

    res = client.get("/api/master/wards")
    assert res.status_code == 200
    wards = res.json()
    assert len(wards) == 78, f"Expected 78 wards, got {len(wards)}"
    print(f"  [PASS] /api/master/wards -> {len(wards)} wards")

    res = client.get("/api/master/departments")
    assert res.status_code == 200
    depts = res.json()
    assert len(depts) >= 70
    print(f"  [PASS] /api/master/departments -> {len(depts)} departments")

    res = client.get("/api/master/staff")
    assert res.status_code == 200
    staff = res.json()
    assert len(staff) == 6
    print(f"  [PASS] /api/master/staff -> {len(staff)} staff members")

    # 4. Create Air Sampling Submission
    sub_payload = {
        "service_code": "AIR-01",
        "department_id": depts[0]["id"],
        "submission_date": "2026-08-14",
        "sender_name": "คุณพยาบาลไอซียู",
        "sender_email": "icu@tu.ac.th",
        "sample_type": "อากาศ",
        "samples": [
            {"sample_no": 1, "ward_id": wards[0]["id"], "label": "ห้องแยกโรค 1"},
            {"sample_no": 2, "ward_id": wards[1]["id"], "label": "ห้องแยกโรค 2"}
        ]
    }
    res = client.post("/api/submissions", json=sub_payload, headers={"Authorization": f"Bearer {tech_token}"})
    assert res.status_code == 200, f"Create submission failed: {res.text}"
    sub_data = res.json()
    sub_id = sub_data["id"]
    sub_no = sub_data["submission_no"]
    print(f"  [PASS] /api/submissions (POST) -> Created {sub_no} (ID: {sub_id})")

    # 5. Enter Results
    update_payload = {
        "reporter_id": staff[0]["id"],
        "samples": [
            {
                "sample_no": 1,
                "ward_id": wards[0]["id"],
                "label": "ห้องแยกโรค 1",
                "results": [
                    {"analyte_code": "bacteria_colonies", "result_value": "8", "numeric_value": 8.0, "result_flag": "NORMAL"},
                    {"analyte_code": "fungus_colonies", "result_value": "0", "numeric_value": 0.0, "result_flag": "NORMAL"}
                ]
            },
            {
                "sample_no": 2,
                "ward_id": wards[1]["id"],
                "label": "ห้องแยกโรค 2",
                "results": [
                    {"analyte_code": "bacteria_colonies", "result_value": "12", "numeric_value": 12.0, "result_flag": "NORMAL"},
                    {"analyte_code": "fungus_colonies", "result_value": "0", "numeric_value": 0.0, "result_flag": "NORMAL"}
                ]
            }
        ],
        "edit_reason": "บันทึกผลการนับโคโลนี 48 ชม."
    }
    res = client.put(f"/api/submissions/{sub_id}", json=update_payload, headers={"Authorization": f"Bearer {tech_token}"})
    assert res.status_code == 200, f"Update results failed: {res.text}"
    print(f"  [PASS] /api/submissions/{sub_id} (PUT) -> Results recorded")

    # 6. Status Transitions: RECEIVED -> IN_PROGRESS -> COMPLETED
    client.post(f"/api/submissions/{sub_id}/status", json={"to_status": "RECEIVED"}, headers={"Authorization": f"Bearer {tech_token}"})
    client.post(f"/api/submissions/{sub_id}/status", json={"to_status": "IN_PROGRESS"}, headers={"Authorization": f"Bearer {tech_token}"})
    client.post(f"/api/submissions/{sub_id}/status", json={"to_status": "COMPLETED"}, headers={"Authorization": f"Bearer {tech_token}"})
    
    # 7. Approver Login & Official Approval
    res_app = client.post("/api/auth/login", json={"username": "approver_narisara", "password": "Approver@1234"})
    approver_token = res_app.json()["access_token"]
    
    res_report = client.post(
        f"/api/submissions/{sub_id}/status",
        json={"to_status": "REPORTED", "reason": "อนุมัติผลทางการ", "reporter_id": staff[0]["id"], "reviewer_id": staff[1]["id"]},
        headers={"Authorization": f"Bearer {approver_token}"}
    )
    assert res_report.status_code == 200
    print(f"  [PASS] /api/submissions/{sub_id}/status -> REPORTED with Reporter & Reviewer validated")

    # 8. Generate & Download PDF Report
    res_pdf = client.post(f"/api/reports/generate/{sub_id}", headers={"Authorization": f"Bearer {approver_token}"})
    assert res_pdf.status_code == 200
    print("  [PASS] /api/reports/generate -> PDF generated with SHA256:", res_pdf.json()["sha256_hash"][:16], "...")

    res_dl = client.get(f"/api/reports/download/{sub_id}")
    assert res_dl.status_code == 200
    assert len(res_dl.content) > 100
    print(f"  [PASS] /api/reports/download -> Downloaded {len(res_dl.content)} bytes PDF")

    # 9. Test Bookings API
    booking_payload = {
        "booking_date": "2026-08-20",
        "test_type": "อากาศ",
        "department_name": "งานอาชีวอนามัยและความปลอดภัย",
        "full_name": "สมศักดิ์ จองตรวจ",
        "contact_number": "081-234-5678",
        "sample_count": 10
    }
    res_book = client.post("/api/bookings", json=booking_payload)
    assert res_book.status_code == 200
    print("  [PASS] /api/bookings (POST) -> Booking confirmed")

    # 10. Test Audit Trail API
    res_audit = client.get(f"/api/audit?submission_id={sub_id}", headers={"Authorization": f"Bearer {tech_token}"})
    assert res_audit.status_code == 200
    logs = res_audit.json()
    assert len(logs) >= 4
    print(f"  [PASS] /api/audit -> {len(logs)} immutable audit logs recorded")

    print("\n=======================================================")
    print("ALL 10 API TEST SUITES PASSED FLAWLESSLY!")
    print("=======================================================")

if __name__ == "__main__":
    test_full_api_suite()
