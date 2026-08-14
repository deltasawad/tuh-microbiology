# Claude Code Implementation Prompt — Microbiology Environmental Reporting System (TUH)

> **วิธีใช้:** วางทั้งไฟล์นี้ให้ Claude Code ใน repo เปล่า พร้อมแนบไฟล์ HTML เดิมทั้ง 9 ไฟล์ไว้ใน `legacy/`
> **ปรับก่อนใช้:** ส่วนที่ทำเครื่องหมาย `[[ ]]` ต้องเติมข้อมูลจริงก่อน

---

## 0. บทบาทและเป้าหมาย

คุณคือ senior full-stack engineer ที่ทำงานกับระบบ Laboratory Information System ในโรงพยาบาล
งานนี้คือการ **migrate ระบบเดิม (Google Sites + Apps Script + Google Sheets) ไปเป็น self-hosted web application** โดยรวม 8 ระบบย่อยที่แยกกันอยู่ให้เป็นระบบเดียว

**ข้อกำหนดสำคัญ:** ระบบนี้ใช้ในห้องปฏิบัติการที่รับรอง ISO 15189 ข้อมูลผลตรวจต้องมี traceability ครบถ้วน ห้ามออกแบบให้แก้ผลย้อนหลังได้โดยไม่ทิ้งร่องรอย

---

## 1. บริบทระบบเดิม

### 1.1 สถาปัตยกรรมปัจจุบัน

```
Google Sites (หน้ารวมลิงก์)
  └── 8 หน้า HTML แยกอิสระ (แต่ละหน้ามี GAS Web App URL + Google Sheet ของตัวเอง)
       └── สื่อสารผ่าน JSONP (<script src=...&callback=xxx>)
  └── 1 หน้า React (TUH CMLAR E-Report — MALDI-TOF Biotyper)
  └── ปฏิทินจองวันส่งตรวจ
```

### 1.2 บริการทั้ง 8 (จากหน้า Home เดิม)

| รหัส | ชื่อบริการ | หน่วยงานผู้ใช้ | TAT เป้าหมาย |
|---|---|---|---|
| AIR-01 | Air Sampling | งานอาชีวอนามัยฯ | 24h |
| STR-02 | Sterility | งานธนาคารเลือด | 48h |
| WTS-03 | Water or Surface | งานควบคุมโรคติดเชื้อ | 24h |
| WTO-04 | Water (OR) | ห้องผ่าตัด | 24h |
| WTM-05 | Water (Med) | ศูนย์การแพทย์ธรรมศาสตร์ (THAMC) | 48h |
| FOD-06 | Food | งานโภชนาการ | 72h |
| DRG-07 | Drug (ปลอดเชื้อ) | งานผลิตยา 1 | 5 วัน |
| DRG-08 | Drug (ปนเปื้อน) | งานผลิตยา 2 | 5 วัน |

### 1.3 ปัญหาที่ต้องแก้ (จัดลำดับความสำคัญ)

**P0 — Security (แก้ก่อนอื่นใด)**
- Credentials hardcode ใน client-side JavaScript: `doctor/1234`, `admin/1234`, `air/8416`
- Telegram Bot Token + Chat ID ฝังใน client (ไฟล์ TUH CMLAR) → token นี้รั่วแล้ว ต้อง revoke
- ไม่มี session management, ไม่มี role-based access control จริง
- ทุกคนที่มี URL ของ GAS เรียก `action=save` / `action=delete` ได้โดยตรงโดยไม่ต้อง auth

**P1 — Data integrity**
- แก้ผลตรวจได้โดยไม่บันทึกว่าใครแก้ เมื่อไหร่ ค่าเดิมคืออะไร
- ไม่มี versioning ของรายงานที่ออกไปแล้ว
- ชื่อผู้ตรวจสอบสะกดไม่ตรงกันระหว่างไฟล์ (`ทนพญ.นริศรา มังกรแก้ว` vs `มังการแก้ว`) → ต้องมี master data ตารางเดียว

**P2 — Maintainability**
- โค้ดซ้ำ 8 ชุด (logo, รายชื่อ ward, staff list, PDF export logic, chart)
- รายชื่อ ward ~78 รายการ hardcode ซ้ำในหลายไฟล์
- JSONP ไม่รองรับ POST, มี URL length limit, error handling แย่

**P3 — Operational**
- Google Drive quota เต็ม
- Apps Script quota: 20,000 UrlFetch/วัน, 6 นาที/execution
- ไม่มี backup strategy ที่ควบคุมได้

---

## 2. สถาปัตยกรรมเป้าหมาย

```
┌─────────────────────────────────────────────┐
│  Nginx (reverse proxy + TLS)                │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────────┐   ┌────────▼─────────┐
│ Frontend   │   │ FastAPI backend  │
│ (static)   │   │ - REST + OpenAPI │
│            │   │ - JWT auth       │
└────────────┘   └────────┬─────────┘
                          │
              ┌───────────┴────────────┐
              │                        │
        ┌─────▼──────┐         ┌───────▼───────┐
        │ PostgreSQL │         │ MinIO / local │
        │  (data)    │         │ (PDF archive) │
        └────────────┘         └───────────────┘
```

**Stack ที่กำหนด:**
- Backend: Python 3.11+ / FastAPI / SQLModel หรือ SQLAlchemy 2.0 / Alembic (migrations)
- DB: PostgreSQL 16
- Auth: JWT (access + refresh), password hash ด้วย `argon2` หรือ `bcrypt`
- Frontend: **[[เลือก 1: (a) Vanilla HTML + Tailwind + Alpine.js — ใกล้ของเดิม, migrate ง่าย | (b) Next.js/React SPA — ยืดหยุ่นกว่า แต่ใช้เวลามากกว่า]]**
- Deployment: Docker Compose
- Notification: Telegram Bot API (token อยู่ฝั่ง server เท่านั้น) + SMTP

**ห้ามใช้:** JSONP, credentials ใน frontend, `eval()`, การเก็บ secret ใน git

---

## 3. Data Model

หัวใจของงานนี้คือ **การรวม 8 ฟอร์มที่มีฟิลด์ต่างกันให้เป็น schema เดียว** อย่าสร้าง 8 ตาราง ใช้แนวทาง service definition + typed attributes

### 3.1 ตารางหลัก

```sql
-- Master data
services              -- นิยามบริการ 8 ตัว (code, name, tat_hours, form_schema JSONB)
departments           -- หน่วยงาน/ward ~78 รายการ (ดึงจาก wardOptionsList ในโค้ดเดิม)
users                 -- ผู้ใช้ระบบ + role
staff                 -- ทนพ./ทนพญ. + เลขใบประกอบวิชาชีพ (ทน.xxxxx) + signature_image
organisms             -- รายชื่อเชื้อที่สงสัย (ดึงจาก suspectedOrganismOptions)

-- Transaction
submissions           -- ใบส่งตรวจ 1 ใบ (header)
samples               -- ตัวอย่างในใบส่งตรวจ (1..n)
sample_results        -- ผลตรวจต่อ analyte (EAV — รองรับฟิลด์ที่ต่างกันแต่ละบริการ)
status_transitions    -- ประวัติการเปลี่ยนสถานะ + timestamp (ใช้คำนวณ TAT)
audit_log             -- ทุกการ INSERT/UPDATE/DELETE (who, when, before, after)
report_versions       -- snapshot ของรายงานที่ออก + hash
bookings              -- ปฏิทินจองวันส่งตรวจ
```

### 3.2 การจัดการฟิลด์ที่ต่างกันแต่ละบริการ

แต่ละบริการมีฟิลด์เฉพาะดังนี้ — ให้ออกแบบเป็น `services.form_schema` (JSONB) ที่ frontend render ฟอร์มจาก schema นี้:

| บริการ | ฟิลด์ระดับ submission | ฟิลด์ระดับ sample | analytes ที่วัด |
|---|---|---|---|
| AIR-01 | department, sender_email | ward, location | bacteria_colonies (int), fungus_colonies (int) |
| STR-02 | department | blood_bag_no, product_type (multi: PRC/LPRC/LDPPC/FFP/SDP/LPPC/Normal), exprid | sterile, non_sterile |
| WTS-03 | department, specimen_type, suspected_organism | location | culture_result (text) |
| WTO-04 | department, specimen_type, suspected_organism, sender_email | location | culture_result |
| WTM-05 | department (THAMC), suspected_organism, sender_email | location | culture_result |
| FOD-06 | department (โภชนาการ), sender_email | food_item | ecoli, paeruginosa |
| DRG-07 | date_prep, date_sample, operator, department | drug_type | result_72h (No growth / Growth) |
| DRG-08 | receipt_date, analysis_date, prepared_medicine, lot_no, production_date, volume_ml, submitted_by | prepared_medicine | culture_result_72h |

**เกณฑ์ตัดสิน:** ฟิลด์ที่มีทุกบริการ → column จริง | ฟิลด์ที่มีเฉพาะบางบริการ → `extra_data JSONB` + validate ด้วย JSON Schema จาก `services.form_schema`

### 3.3 Status workflow (มาตรฐานเดียวทุกบริการ)

```
DRAFT → SUBMITTED → RECEIVED → IN_PROGRESS → COMPLETED → REPORTED
                                    ↓
                                REJECTED (พร้อมเหตุผลบังคับกรอก)
```

ทุก transition ต้องบันทึกลง `status_transitions` (submission_id, from_status, to_status, actor_id, timestamp, note)
TAT คำนวณจากตารางนี้ ไม่ใช่จาก column ที่ overwrite ได้

**หมายเหตุ:** โค้ดเดิมมีบั๊กใน `displayTatSummary()` — บรรทัด `time: tsSubmitting && tsReceived ? tsReceived - tsReceived : null` คำนวณเป็น 0 เสมอ ระวังอย่าคัดลอกมา

---

## 4. Requirements ตาม ISO 15189

ต้องมีครบทุกข้อ:

1. **Audit trail** — ทุกการเปลี่ยนแปลงข้อมูลผลตรวจบันทึก: user, timestamp, ค่าก่อน, ค่าหลัง, เหตุผล (บังคับถ้าเป็นการแก้ผลที่ report แล้ว)
2. **Amended report** — แก้ผลหลังออกรายงานแล้ว ต้องสร้าง version ใหม่ ติดป้าย "AMENDED" ระบุว่าแก้อะไรจากฉบับก่อน ไม่ลบฉบับเดิม
3. **Electronic signature** — ผู้รายงานผลและผู้ตรวจสอบผลต้องเป็นคนละคน (enforce ใน backend) บันทึก user_id + timestamp จริง ไม่ใช่แค่ชื่อใน dropdown
4. **Reference range / critical value flag** — ถ้าผลเกินเกณฑ์ ต้อง flag และบันทึกการแจ้งเตือน (สำหรับ Air Sampling ใช้เกณฑ์ **[[ระบุเกณฑ์ CFU ที่ห้องปฏิบัติการใช้]]**)
5. **Retention** — ข้อมูลเก็บไม่น้อยกว่า **[[ระบุปีตามระเบียบ รพ.]]** ปี ห้าม hard delete (ใช้ soft delete + `deleted_at`)
6. **Backup** — automated daily `pg_dump` + verify restore ทุกเดือน เขียน script + เอกสาร SOP
7. **Access control** — 4 role ขั้นต่ำ:
   - `requester` — หน่วยงานผู้ส่งตรวจ: สร้างใบส่งตรวจ, ดูเฉพาะของหน่วยงานตัวเอง
   - `technician` — เจ้าหน้าที่ห้องแล็บ: รับตัวอย่าง, กรอกผล
   - `approver` — หัวหน้าห้องแล็บ: อนุมัติและออกรายงาน
   - `admin` — จัดการ master data, ดู audit log

---

## 5. ฟีเจอร์ที่ต้องมี

### 5.1 คงจากระบบเดิม
- [ ] ฟอร์มส่งตรวจแบบตาราง กำหนดจำนวนแถวได้ (1-100)
- [ ] Autocomplete หน่วยงาน/ward/เชื้อ จาก master data
- [ ] Dashboard: การ์ดสรุป (ทั้งหมด/รอตรวจ/ตรวจแล้ว) + กราฟรายเดือน (พ.ศ.) + รายการล่าสุด
- [ ] Export PDF รายงานผล
- [ ] ส่งผลทางอีเมล
- [ ] แจ้งเตือน Telegram เมื่อมีใบส่งตรวจใหม่
- [ ] QR code บนรายงาน สำหรับติดตามสถานะ
- [ ] ปฏิทินจองวันส่งตรวจ

### 5.2 เพิ่มใหม่
- [ ] **Single sign-on หน้าเดียว** — เข้าครั้งเดียวใช้ได้ทุกบริการ (แทนที่จะ login แยก 8 ครั้ง)
- [ ] **หน้ารวม dashboard ข้ามบริการ** สำหรับหัวหน้าห้องแล็บ
- [ ] **TAT monitoring** — รายงานว่าบริการไหนเกิน TAT เป้าหมายกี่ %
- [ ] **Trend analysis** — จำนวน positive culture ตามหน่วยงาน/ตามเวลา (ใช้เฝ้าระวัง environmental contamination)
- [ ] **Export Excel** สำหรับงานวิเคราะห์และส่ง audit
- [ ] **Full-text search** ข้าม submission ทุกบริการ

### 5.3 PDF Export — ปรับปรุงจากเดิม

ระบบเดิมใช้ `html2canvas` + `jsPDF` ซึ่งได้ PDF ที่เป็นรูปภาพ (ค้นหาข้อความไม่ได้, ไฟล์ใหญ่, ตัดหน้าเพี้ยน)

**เปลี่ยนเป็น server-side rendering:** WeasyPrint หรือ Playwright → PDF ที่มี text layer จริง แบ่งหน้าถูกต้อง embed ฟอนต์ TH Sarabun New / Noto Sans Thai ได้

---

## 6. แผนการทำงาน (แบ่งเป็น phase — ห้ามทำรวดเดียว)

### Phase 0 — Security hotfix (ทำทันที ก่อนอย่างอื่น)
1. Revoke Telegram bot token ที่รั่ว สร้างใหม่
2. เขียน checklist ให้เจ้าของระบบ: เปลี่ยนรหัสผ่านทุกบัญชี, ตรวจ Apps Script deployment permission
3. **ยังไม่ต้องแตะโค้ดเดิม** — แค่ document ว่ามีช่องโหว่อะไรบ้าง

### Phase 1 — Foundation
- โครงสร้าง repo, Docker Compose, PostgreSQL, Alembic
- Auth: JWT, user/role, password policy
- Master data: services, departments, staff, organisms (import จาก array ในโค้ดเดิม)
- API: OpenAPI docs อัตโนมัติ, health check
- **Deliverable:** `docker compose up` แล้ว login ได้, มี master data ครบ

### Phase 2 — Core workflow (ทำ 1 บริการก่อน)
- เลือก **AIR-01** เป็น pilot (ฟิลด์เรียบง่ายที่สุด, ปริมาณงานพอประมาณ)
- Submission → sample → result → status transition → audit log
- ฟอร์มส่งตรวจ + หน้ากรอกผล + PDF export
- **Deliverable:** ใช้งาน AIR-01 ได้ end-to-end พร้อม audit trail

### Phase 3 — Migration script
- อ่าน Google Sheets ทั้ง 8 ผ่าน Sheets API (read-only) หรือ CSV export
- Map ลง schema ใหม่ พร้อม validation report ว่าแถวไหน map ไม่ได้เพราะอะไร
- **Dry-run mode บังคับ** — รันแล้วออกรายงานก่อน ไม่เขียน DB
- Reconciliation: นับจำนวน submission/sample เทียบต้นทางปลายทาง ต้องตรงกัน
- **Deliverable:** ข้อมูลย้อนหลังเข้าระบบครบ ตรวจสอบได้

### Phase 4 — บริการที่เหลือ 7 ตัว
- ทำทีละตัว ตามลำดับ: WTS-03 → WTO-04 → WTM-05 → FOD-06 → STR-02 → DRG-07 → DRG-08
- แต่ละตัวควรเป็นแค่การเพิ่ม `form_schema` ไม่ใช่เขียนโค้ดใหม่ — ถ้าต้องเขียนใหม่ แปลว่า abstraction ผิด ให้หยุดและ refactor

### Phase 5 — ฟีเจอร์เพิ่ม + hardening
- Dashboard รวม, TAT monitoring, trend analysis
- Backup automation + restore drill
- Load test, penetration test เบื้องต้น
- เอกสาร: SOP การใช้งาน, IT DR plan, validation record สำหรับ audit ISO 15189

### Phase 6 — Parallel run + cutover
- รันคู่ขนานกับระบบเดิม 2-4 สัปดาห์
- เทียบผลทุกใบว่าตรงกัน
- Cutover + freeze ระบบเดิมเป็น read-only archive

---

## 7. ข้อกำหนดด้านโค้ด

- **ภาษาใน UI:** ไทยเป็นหลัก ศัพท์เทคนิคใช้อังกฤษได้ (ตามแบบที่ระบบเดิมใช้)
- **วันที่:** เก็บใน DB เป็น UTC timestamptz แสดงผลเป็น พ.ศ. (Asia/Bangkok)
- **ฟอนต์:** Noto Sans Thai บนเว็บ, TH Sarabun New ใน PDF ที่ต้องส่งเป็นเอกสารราชการ
- **Test coverage:** ≥80% สำหรับ business logic (status transition, TAT calculation, permission check) — สามอย่างนี้ต้องมี test ครบ 100%
- **Type hints ครบทุก function** — รัน `mypy --strict`
- **Lint:** `ruff` + `black`
- **ห้าม** commit `.env`, ใช้ `.env.example` แทน
- **Migration:** ทุกการเปลี่ยน schema ต้องผ่าน Alembic ห้าม `create_all()`

---

## 8. สิ่งที่ต้องถามก่อนเริ่มเขียนโค้ด

อย่าเดา ให้ถามก่อน:

1. โรงพยาบาลมี server ให้ deploy หรือไม่ (spec, OS, ใครดูแล, มี Docker หรือเปล่า)
2. นโยบายไอทีของ รพ. เรื่อง self-hosted app — ต้องขออนุมัติใคร ต้องผ่าน security review หรือไม่
3. ระบบต้องเข้าถึงจากนอกโรงพยาบาลหรือไม่ (ถ้าใช่ ต้องคุยเรื่อง VPN / reverse proxy / TLS cert)
4. มี LDAP / Active Directory ของโรงพยาบาลให้ผูก auth หรือไม่ (ดีกว่าสร้าง user เอง)
5. เกณฑ์การตัดสินผล (reference range) ของแต่ละบริการคืออะไร — โดยเฉพาะ CFU count ของ Air Sampling
6. ระยะเวลาเก็บข้อมูลตามระเบียบโรงพยาบาลและ ISO 15189 ที่ใช้อยู่
7. จำนวนใบส่งตรวจต่อเดือนโดยประมาณของแต่ละบริการ (ใช้ประเมิน sizing)
8. ระบบ TUH CMLAR E-Report (MALDI-TOF) จะรวมเข้ามาด้วยหรือแยกไว้ก่อน

---

## 9. เกณฑ์ยอมรับงาน (Definition of Done)

แต่ละ phase ถือว่าเสร็จเมื่อ:

- [ ] `docker compose up` แล้วระบบทำงานได้ตั้งแต่ต้น ไม่ต้อง setup มือ
- [ ] มี seed data สำหรับ development
- [ ] Test ผ่านทั้งหมด, coverage ตามเกณฑ์
- [ ] มี README อธิบาย setup, architecture decision, และวิธี rollback
- [ ] ไม่มี secret ใน source code (ตรวจด้วย `gitleaks` หรือเทียบเท่า)
- [ ] Audit log บันทึกครบทุก mutation — พิสูจน์ด้วย test
- [ ] Migration rollback ได้ (`alembic downgrade`)

---

## 10. สิ่งที่ห้ามทำ

- ห้ามลบหรือแก้ไขระบบเดิมจนกว่า parallel run จะผ่าน
- ห้ามเขียน migration script ที่ไม่มี dry-run mode
- ห้ามใส่ business logic ใน frontend (การคำนวณ TAT, การตัดสินสถานะ, permission — ทั้งหมดอยู่ backend)
- ห้ามสร้างตารางแยกต่อบริการ
- ห้ามใช้ `float` กับค่าที่ต้อง exact (ใช้ `Decimal` / `numeric`)
- ห้ามส่งข้อมูลผู้ป่วยหรือข้อมูลระบุตัวตนไปยัง third-party API โดยไม่ผ่านการอนุมัติ

---

## 11. เริ่มต้น

ให้เริ่มด้วย:
1. อ่านไฟล์ใน `legacy/` ทั้งหมด แล้วสรุป **data dictionary** ของแต่ละบริการออกมาเป็นตาราง (field name, type, required, ค่าตัวอย่าง, notes)
2. เสนอ ER diagram (Mermaid) ของ schema ที่ออกแบบ
3. ถามคำถามในข้อ 8
4. **รอการยืนยันก่อนเขียนโค้ดจริง**
