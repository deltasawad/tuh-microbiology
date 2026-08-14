# ระบบรายงานผลตรวจสิ่งแวดล้อม งานจุลชีววิทยา โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ
## Microbiology Environmental Reporting System (TUH) — ISO 15189 Compliant Web Application

---

## 📌 บทนำและเป้าหมาย (Overview)
ระบบเว็บแอพพลิเคชันสำหรับงานตรวจวิเคราะห์ทางจุลชีววิทยาสิ่งแวดล้อม (Environmental Microbiology) โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ ซึ่งได้รับการปรับปรุงและย้ายระบบ (Migration) จากเดิมที่ทำงานแยกส่วนบน **Google Sites + Google Apps Script + Google Sheets** มาสู่ **Modern Unified Web Application** แบบรวมศูนย์

### 🎯 ปัญหาที่ได้รับการแก้ไข:
1. **แก้ปัญหา Google Drive เต็ม 100%**: จัดเก็บข้อมูลโครงสร้างทั้งหมดบนฐานข้อมูล **PostgreSQL** เชิงสัมพันธ์ และบันทึกไฟล์รายงาน PDF ลงบน Server Storage โดยตรง ไม่พึ่งพา Google Drive Quota อีกต่อไป
2. **ปิดช่องโหว่ความปลอดภัยระดับวิกฤต (P0)**:
   - ปิดการเข้าถึง Apps Script แบบ Unauthenticated
   - ยกเลิกการ Hardcode รหัสผ่านในหน้าเว็บ เปลี่ยนมาใช้ **JWT Authentication** + **Password Hashing (Argon2 / PBKDF2)**
   - แยก Telegram Bot Token เก็บฝั่ง Backend Server เท่านั้น
3. **รองรับข้อกำหนดมาตรฐาน ISO 15189**:
   - **Immutable Audit Trail**: บันทึกทุกการเปลี่ยนแปลงข้อมูล (ใคร, เมื่อไหร่, ค่าก่อนแก้, ค่าหลังแก้, เหตุผล)
   - **Electronic Signature Enforcement**: บังคับให้ผู้ตรวจ/รายงานผล (Reporter) และผู้อนุมัติผล (Reviewer) ต้องเป็นคนละท่านกัน
   - **Amended Report & Versioning**: การแก้ไขผลตรวจที่ออกรายงานแล้วจะสร้างเวอร์ชันใหม่และติดป้าย "AMENDED" พร้อมบันทึก Hash ป้องกันการปลอมแปลง
   - **Accurate TAT Monitoring**: คำนวณระยะเวลาตรวจวิเคราะห์ (Turnaround Time) จากการเปลี่ยนสถานะจริง

---

## 🏥 บริการทั้ง 8 ที่รองรับในระบบ

| รหัส | ชื่อบริการ | หน่วยงานหลักที่ส่งตรวจ | เป้าหมาย TAT | สถานะในระบบ |
|---|---|---|---|---|
| **AIR-01** | Air Sampling (ตรวจคุณภาพอากาศ) | งานอาชีวอนามัยและความปลอดภัย | 24 ชม. | **Pilot สมบูรณ์ 100%** |
| **STR-02** | Sterility (ตรวจความปลอดเชื้อถุงเลือด) | งานธนาคารเลือด | 48 ชม. | Ready on Unified Schema |
| **WTS-03** | Water or Surface (ตรวจน้ำ/พื้นผิว) | งานควบคุมโรคติดเชื้อ | 24 ชม. | Ready on Unified Schema |
| **WTO-04** | Water (สำหรับห้องผ่าตัด OR) | ห้องผ่าตัด OR | 24 ชม. | Ready on Unified Schema |
| **WTM-05** | Water (ศูนย์การแพทย์ธรรมศาสตร์ THAMC) | ศูนย์การแพทย์ธรรมศาสตร์ | 48 ชม. | Ready on Unified Schema |
| **FOD-06** | Food (ตรวจการปนเปื้อนในอาหาร) | งานโภชนาการ | 72 ชม. | Ready on Unified Schema |
| **DRG-07** | Drug 1 (ตรวจความปลอดเชื้อยาเตรียม) | งานผลิตยา 1 | 5 วัน | Ready on Unified Schema |
| **DRG-08** | Drug 2 (วิเคราะห์การปนเปื้อนเชื้อในยาเตรียม) | งานผลิตยา 2 | 5 วัน | Ready on Unified Schema |
| **QUEUE** | ปฏิทินจองวันส่งตรวจสิ่งแวดล้อม | ทุกหน่วยงาน | — | **สมบูรณ์ 100% (พร้อมวันหยุด 21 วัน)** |

---

## 🏗️ สถาปัตยกรรมระบบ (Architecture)

```
Nginx (Reverse Proxy + Port 80/443)
  ├── Frontend: Modern HTML5 + Responsive CSS + Alpine.js / Pure JS
  │     ├── index.html     (ศูนย์รวม Dashboard & Submissions List)
  │     ├── air.html       (AIR-01 Pilot ฟอร์มส่งตรวจ + กรอกผล + PDF)
  │     ├── booking.html   (ปฏิทินจองคิวส่งตรวจล่วงหน้า)
  │     ├── audit.html     (ISO 15189 Audit Trail Explorer)
  │     └── login.html     (Single Sign-On Authentication)
  │
  └── Backend: Python 3.11+ / FastAPI / SQLAlchemy 2.0 / Uvicorn (Port 8000)
        ├── PostgreSQL 16  (ฐานข้อมูลหลัก จัดเก็บข้อมูล 8 บริการใน Schema เดียว)
        └── Server Storage (/storage/reports - จัดเก็บรายงาน PDF และ Hash)
```

---

## 🚀 วิธีการติดตั้งและรันระบบ (Setup & Running)

### ทางเลือกที่ 1: ติดตั้งผ่าน Docker Compose (แนะนำสำหรับเซิร์ฟเวอร์ภายนอก/Cloud)

1. คัดลอกและตั้งค่า Environment Variables:
   ```bash
   cp .env.example .env
   ```
2. รันระบบทั้งหมดด้วยคำสั่งเดียว:
   ```bash
   docker compose up -d --build
   ```
3. เข้าใช้งานผ่าน Web Browser:
   - **Frontend Web Portal**: `http://<SERVER_IP>/`
   - **FastAPI Interactive Swagger Docs**: `http://<SERVER_IP>/docs`
   - **API Health Check**: `http://<SERVER_IP>/api/health`

---

### ทางเลือกที่ 2: รันแบบ Standalone บนเครื่อง Local PC (ไม่ต้องใช้ Docker)

1. ติดตั้ง Dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
2. รัน FastAPI Backend Server:
   ```bash
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
3. เปิดไฟล์ `frontend/index.html` หรือเปิดผ่าน Static Web Server เพื่อใช้งาน

---

## 👥 บัญชีผู้ใช้งานเริ่มต้นสำหรับการทดสอบ (Default Seed Accounts)

| บทบาท (Role) | Username | Password | ชื่อ-สกุล / สิทธิ์การใช้งาน |
|---|---|---|---|
| **Admin** | `admin` | `AdminTUH@2026!` | ผู้ดูแลระบบสูงสุด (จัดการ Master data และดู Audit log ทั้งหมด) |
| **Technician** | `tech_manop` | `Tech@1234` | ทนพ.มานพ นันตาบุตร (รับตัวอย่าง, บันทึกผลตรวจ, ผู้รายงานผล) |
| **Approver** | `approver_narisara` | `Approver@1234` | ทนพญ.นริศรา มังกรแก้ว (หัวหน้าแล็บ / ผู้ตรวจสอบและอนุมัติผล) |
| **Requester** | `occhealth` | `Occ@1234` | เจ้าหน้าที่งานอาชีวอนามัย (สร้างใบส่งตรวจ, ติดตามสถานะ) |

---

## 🧪 การทดสอบระบบอัตโนมัติ (Automated Tests)

รันชุดทดสอบความถูกต้องของ API และการปฏิบัติตามมาตรฐาน ISO 15189:
```bash
cd backend
python tests/test_api_endpoints.py
python tests/test_air_workflow.py
```

---

## 📂 โครงสร้างโฟลเดอร์ในโปรเจกต์
```
web app/
├── backend/                  # FastAPI Application Core
│   ├── app/
│   │   ├── api/              # API Routers (auth, master, submissions, bookings, reports, audit, dashboard)
│   │   ├── core/             # Configuration, Database session, Security (JWT/Hash), Auth Provider
│   │   ├── models/           # SQLAlchemy Models (Unified ISO 15189 Schema)
│   │   ├── schemas/          # Pydantic Request/Response Models
│   │   ├── services/         # Submission, PDF generation, TAT calculation, Audit logging
│   │   └── seeds/            # Master Data Seeder (78 wards, 79 departments, 6 staff, etc.)
│   ├── tests/                # Automated Workflow & End-to-end API Tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 # Responsive Frontend Web Application
│   ├── css/style.css         # Modern CSS Design System
│   ├── js/api.js             # Unified API Client
│   ├── index.html            # Dashboard & Submissions Overview
│   ├── air.html              # AIR-01 Pilot Form & Results Entry
│   ├── booking.html          # Specimen Queue Calendar
│   ├── audit.html            # ISO 15189 Audit Trail Viewer
│   └── login.html            # SSO Login Portal
├── recovered/                # ซอร์สโค้ดและ Master Data ดั้งเดิมที่กู้คืนมาแล้ว
├── docker-compose.yml        # Multi-container orchestration (Nginx + Backend + Postgres)
├── nginx/nginx.conf          # Nginx Reverse Proxy configuration
├── .env.example              # Template configuration
└── README.md
```
