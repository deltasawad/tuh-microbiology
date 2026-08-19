import os
import json
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.master import Service, Department, Ward, Staff, Organism, ReferenceRange
from app.models.user import User
from app.models.booking import Booking

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("Seeding Master Data...")

        # 1. Services (8 services)
        services_data = [
            {"code": "AIR-01", "name_th": "Air Sampling (ตรวจคุณภาพอากาศ)", "department_owner": "งานอาชีวอนามัยและความปลอดภัย", "tat_target_hours": 120},
            {"code": "STR-02", "name_th": "Sterility Test (ถุงเลือดและผลิตภัณฑ์)", "department_owner": "งานธนาคารเลือด", "tat_target_hours": 120},
            {"code": "WTS-03", "name_th": "Water or Surface Test (ตรวจน้ำและพื้นผิว)", "department_owner": "งานควบคุมและป้องกันการติดเชื้อ (IC)", "tat_target_hours": 120},
            {"code": "WTO-04", "name_th": "Water OR (ตรวจน้ำห้องผ่าตัด)", "department_owner": "งานห้องผ่าตัด (OR)", "tat_target_hours": 120},
            {"code": "WTM-05", "name_th": "Water Med (ตรวจน้ำศูนย์การแพทย์)", "department_owner": "ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)", "tat_target_hours": 120},
            {"code": "FOD-06", "name_th": "Food Contamination Test (ตรวจอาหาร)", "department_owner": "งานโภชนาการ", "tat_target_hours": 120},
            {"code": "DRG-07", "name_th": "Drug Sterility (ยาเตรียมปราศจากเชื้อ)", "department_owner": "งานผลิตยา 1", "tat_target_hours": 120},
            {"code": "DRG-08", "name_th": "Drug Contamination (ยาเตรียมทั่วไป)", "department_owner": "งานผลิตยา 2", "tat_target_hours": 120},
        ]

        for s_data in services_data:
            existing = db.query(Service).filter(Service.code == s_data["code"]).first()
            if not existing:
                db.add(Service(**s_data))

        # 2. Staff (6 Medical Technologists)
        staff_data = [
            {"title": "ทนพญ.", "first_name": "ปราญชลี", "last_name": "หรั่งอ่อน", "license_no": "ทน.5596"},
            {"title": "ทนพ.", "first_name": "มานพ", "last_name": "นันตาบุตร", "license_no": "ทน.17500"},
            {"title": "ทนพญ.", "first_name": "อนันตพร", "last_name": "ฉันท์ผ่อง", "license_no": "ทน.5653"},
            {"title": "ทนพญ.", "first_name": "พนารัตน์", "last_name": "เหมะธุลิน", "license_no": "ทน.5969"},
            {"title": "ทนพญ.", "first_name": "รุจิรา", "last_name": "แย้มนวล", "license_no": "ทน.11667"},
            {"title": "ทนพญ.", "first_name": "ปราญชลี", "last_name": "หรั่งอ่อน", "license_no": "ทน.23412"}
        ]

        for st in staff_data:
            existing = db.query(Staff).filter(Staff.first_name == st["first_name"], Staff.last_name == st["last_name"]).first()
            if not existing:
                db.add(Staff(**st))

        db.flush()

        # 3. Departments and Wards from JSON
        json_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "recovered", "master_data_recovered.json")
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                recovered_master = json.load(f)

            # Departments
            for dept_name in recovered_master.get("departments", []):
                dept_name = dept_name.strip()
                if dept_name and not db.query(Department).filter(Department.name_th == dept_name).first():
                    db.add(Department(name_th=dept_name))

            db.flush()

            # Wards
            default_dept = db.query(Department).first()
            for ward_name in recovered_master.get("wards", []):
                ward_name = ward_name.strip()
                if ward_name and not db.query(Ward).filter(Ward.name_th == ward_name).first():
                    db.add(Ward(name_th=ward_name, department_id=default_dept.id if default_dept else None))

            # Organisms
            for org_name in recovered_master.get("organisms", []):
                org_name = org_name.strip()
                if org_name and not db.query(Organism).filter(Organism.name == org_name).first():
                    db.add(Organism(name=org_name, is_pathogen=True))

        db.flush()

        # 4. Reference Ranges (Air Sampling default)
        air_service = db.query(Service).filter(Service.code == "AIR-01").first()
        if air_service:
            ranges = [
                {"service_id": air_service.id, "analyte_code": "bacteria_colonies", "room_grade": "OR", "limit_max": 10, "unit": "CFU/plate", "description": "ห้องผ่าตัดมาตรฐาน (≤10 CFU)"},
                {"service_id": air_service.id, "analyte_code": "bacteria_colonies", "room_grade": "ICU", "limit_max": 25, "unit": "CFU/plate", "description": "หอผู้ป่วยวิกฤต (≤25 CFU)"},
                {"service_id": air_service.id, "analyte_code": "bacteria_colonies", "room_grade": "General", "limit_max": 50, "unit": "CFU/plate", "description": "หอผู้ป่วยทั่วไป (≤50 CFU)"},
                {"service_id": air_service.id, "analyte_code": "fungus_colonies", "room_grade": "General", "limit_max": 0, "unit": "CFU/plate", "description": "ไม่ควรพบสปอร์เชื้อรา (0 CFU)"}
            ]
            for r in ranges:
                if not db.query(ReferenceRange).filter(ReferenceRange.service_id == r["service_id"], ReferenceRange.room_grade == r["room_grade"], ReferenceRange.analyte_code == r["analyte_code"]).first():
                    db.add(ReferenceRange(**r))

        # 5. Default Users with Secure Argon2/Bcrypt Hashing
        staff_manop = db.query(Staff).filter(Staff.first_name == "มานพ").first()
        staff_narisara = db.query(Staff).filter(Staff.first_name == "ปราญชลี").first()
        
        users_data = [
            {"username": "admin", "password_hash": get_password_hash("AdminTUH@2026!"), "full_name": "ผู้ดูแลระบบ งานจุลชีววิทยา", "role": "admin"},
            {"username": "tech_manop", "password_hash": get_password_hash("Tech@1234"), "full_name": "ทนพ.มานพ นันตาบุตร", "role": "technician", "staff_id": staff_manop.id if staff_manop else None},
            {"username": "approver_pranchalee", "password_hash": get_password_hash("Approver@1234"), "full_name": "ทนพญ.ปราญชลี หรั่งอ่อน", "role": "approver", "staff_id": staff_narisara.id if staff_narisara else None},
            {"username": "occhealth", "password_hash": get_password_hash("Occ@1234"), "full_name": "เจ้าหน้าที่ งานอาชีวอนามัย", "role": "requester"}
        ]

        for u in users_data:
            existing = db.query(User).filter(User.username == u["username"]).first()
            if not existing:
                db.add(User(**u))

        db.commit()
        print("Master Data Seeded Successfully!")
        print("Default Users Created:")
        print("  - Admin: admin / AdminTUH@2026!")
        print("  - Technician (Reporter): tech_manop / Tech@1234")
        print("  - Approver (Reviewer): approver_pranchalee / Approver@1234")
        print("  - Requester: occhealth / Occ@1234")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
