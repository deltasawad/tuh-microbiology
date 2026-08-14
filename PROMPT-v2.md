# Claude Code Implementation Prompt v2 — Microbiology Environmental Reporting System (TUH)

> **สถานะ:** ปรับปรุงจาก v1 หลังกู้ซอร์สโค้ดจริงจาก Google Sites ได้ครบทั้ง 12 หน้าแล้ว
> ช่อง `[[ ]]` ใน v1 ถูกเติมด้วยข้อมูลจริงแล้วเกือบทั้งหมด — เหลือเพียง 2 ข้อที่ต้องถามเจ้าของระบบ (ดูข้อ 8)
> **ซอร์สโค้ดจริงอยู่ที่ `recovered/` — ใช้ไฟล์ในโฟลเดอร์นี้เป็นแหล่งอ้างอิง ไม่ใช่ `legacy/` (ไฟล์เปล่า 0 bytes ทั้งหมด)**

---

## 0. บทบาทและเป้าหมาย

คุณคือ senior full-stack engineer ที่ทำงานกับ Laboratory Information System ในโรงพยาบาล
งานนี้คือ **migrate ระบบเดิม (Google Sites + Apps Script + Google Sheets) → self-hosted web application** โดยรวม 8 บริการที่แยกกันอยู่ให้เป็นระบบเดียว

**ข้อกำหนดสำคัญ:** ห้องปฏิบัติการรับรอง ISO 15189 — ข้อมูลผลตรวจต้องมี traceability ครบ ห้ามออกแบบให้แก้ผลย้อนหลังได้โดยไม่ทิ้งร่องรอย

---

## 1. สิ่งที่มีอยู่จริงใน repo นี้

### 1.1 ซอร์สโค้ดที่กู้คืนแล้ว — `recovered/` (576 KB, ~9,800 บรรทัด)

โค้ดทั้งหมดฝังอยู่ใน attribute `data-code` ของ embed block ในหน้า Google Sites
ดึงกลับมาแล้วครบ **ไม่ต้องกู้ซ้ำ** ใช้ไฟล์เหล่านี้เป็น source of truth ของ business logic เดิม

| ไฟล์ | บรรทัด | บริการ | GAS actions ที่เรียก |
|---|---|---|---|
| `air.html` | 955 | AIR-01 Air Sampling | `load`, `save`, `sendEmail` |
| `sterility.html` | 927 | STR-02 Sterility | `getData`, `getSummary`, `saveData` |
| `water_surface.html` | 874 | WTS-03 Water/Surface | `fetch`, `save` |
| `water_or.html` | 725 | WTO-04 Water (OR) | *(ไม่พบ — ตรวจซ้ำใน `.gs`)* |
| `water_thamc.html` | 1006 | WTM-05 Water (THAMC) | `fetch`, `save`, `sendResult` |
| `food.html` | 770 | FOD-06 Food | `read`, `sendEmail`, `updateStatus` |
| `drug1.html` | 700 | DRG-07 Drug ปลอดเชื้อ | `read`, `write` |
| `drug2.html` | 1266 | DRG-08 Drug ปนเปื้อน | *(ไม่พบ — ตรวจซ้ำใน `.gs`)* |
| `booking.html` | 365 | ปฏิทินจองวันส่งตรวจ | `read`, `save`, `delete` |
| `dashboard.html` | 573 | Specimen Dashboard | `read` |
| `cmlar.html` | 1331 | TUH CMLAR (React/MALDI-TOF) | `read`, `readAll`, `save`, `delete` |
| `home.html` | 359 | หน้ารวมลิงก์ | — |

**หมายเหตุ:** `.gs` (Apps Script ฝั่ง server) **ยังกู้ไม่ได้** — เข้าถึงได้เฉพาะเจ้าของผ่าน Apps Script editor
ต้อง export เองก่อนเริ่ม Phase 3 (migration) เพราะมี business logic ที่ client ไม่เห็น เช่น การคำนวณ TAT ฝั่ง server, การเขียน audit_log, และ mapping คอลัมน์จริง

### 1.2 ข้อมูลจริง (นับจาก export แล้ว)

| บริการ | ไฟล์ข้อมูล | แถวจริง | submissions |
|---|---|---|---|
| AIR-01 | `.xlsx` Sheet1 | 367 | 76 |
| STR-02 | `.xlsx` | 128 | 19 |
| WTS-03 | `.xlsx` | 154 | 22 |
| WTO-04 | `.xlsx` (+24 audit_log) | 28 | 5 |
| WTM-05 | `.xlsx` | 10 | 1 |
| FOD-06 | `.xlsx` | 62 | **ไม่มีคอลัมน์ SubmissionID** |
| DRG-07 | `.csv` | 132 | 44 |
| DRG-08 | `.xlsx` | 111 | 13 |
| Bookings | `.xlsx` | 133 | — |
| **รวม** | | **~1,125** | **~180** |

**ปริมาณงานจริง ≈ 15–20 ใบส่งตรวจ/เดือน ทุกบริการรวมกัน** — เล็กมาก ให้ออกแบบให้เรียบง่าย อย่า over-engineer

---

## 2. ⚠️ ปัญหาความปลอดภัยที่ **ยืนยันแล้ว** (ไม่ใช่ข้อสงสัย)

ทั้งหมดนี้ตรวจสอบจากซอร์สจริงที่ดึงมาได้แบบ **ไม่ต้อง login** จากอินเทอร์เน็ตสาธารณะ

### P0-1 — Telegram bot token + chat ID รั่วสู่สาธารณะ
- อยู่ที่ `recovered/cmlar.html:143` (token) และ `:144` (chat ID)
- ใครก็ตามที่เปิดหน้าเว็บนี้อ่านค่าได้ทันที และส่งข้อความในนามบอทได้
- **ต้อง revoke ทันที** ผ่าน @BotFather → `/revoke` → สร้าง token ใหม่ → เก็บฝั่ง server เท่านั้น

### P0-2 — รหัสผ่าน hardcode ใน client-side JavaScript (7 หน้า)
เปรียบเทียบรหัสผ่านแบบ plain-text ใน JS ที่ผู้ใช้เปิดดูได้:

| ไฟล์ | บรรทัด |
|---|---|
| `air.html` | 424 |
| `cmlar.html` | 268 |
| `drug1.html` | 415 |
| `food.html` | 394 |
| `sterility.html` | 398 |
| `water_surface.html` | 445 |
| `water_thamc.html` | 487 |

ชื่อโฟลเดอร์บนดิสก์ยังมีรหัสผ่านติดมาด้วย (`... - admin 1234`) — ต้องเปลี่ยนชื่อโฟลเดอร์ด้วย

### P0-3 — GAS endpoint เรียกได้โดยไม่ต้อง auth (พิสูจน์แล้ว)
เรียก `GET .../exec` แบบไม่ login ได้ผลลัพธ์ JSONP กลับมา:
```
callback({"result":"error","message":"Invalid action specified.", "stack":"... at doGet (รหัส:33:17)"})
```
แปลว่า `doGet` ทำงานให้ผู้ใช้ที่ไม่ระบุตัวตน และ **leak stack trace** ด้วย
ใครมี URL ก็เรียก `action=save` / `action=delete` ได้ทันที (ดูรายการ action ในตารางข้อ 1.1)

**URL ทั้ง 12 endpoint ต้องถือว่ารั่วแล้วทั้งหมด** — หลัง cutover ให้ยกเลิก deployment ทุกตัว

### P0-4 — ข้อมูลผู้ป่วยในช่อง Remarks
ไฟล์ Sterility มีแถวที่บันทึกว่า `คนไข้ผู้รับเลือด <ชื่อ-สกุล> HN<เลข 7 หลัก>` ในช่อง Remarks แบบ free-text
→ ระบบใหม่ต้องมี field ที่ถูกต้องสำหรับกรณีนี้ + ควบคุมสิทธิ์การเข้าถึง + ไม่ส่งออก third-party

### อื่น ๆ
- `.innerHTML =` ใช้กับข้อมูลจากผู้ใช้ 90+ จุด → เสี่ยง XSS ระบบใหม่ต้อง escape/ใช้ textContent
- `https://cdn.tailwindcss.com` (12 หน้า) — CDN build ห้ามใช้ production, ต้อง pin เวอร์ชันและ self-host

---

## 3. สถาปัตยกรรมเป้าหมาย

```
Nginx (reverse proxy + TLS)
   ├── Frontend (static: HTML + Tailwind + Alpine.js)
   └── FastAPI backend (REST + OpenAPI, JWT auth)
          ├── PostgreSQL 16   (data)
          └── MinIO / local FS (PDF archive)
```

**Stack (ตัดสินใจแล้ว):**
- Backend: Python 3.11+ / FastAPI / SQLAlchemy 2.0 / Alembic
- DB: PostgreSQL 16
- **Frontend: Vanilla HTML + Tailwind (build จริง ไม่ใช่ CDN) + Alpine.js** ← ตอบช่อง `[[ ]]` ข้อ 2 ของ v1
  - เหตุผล: ใกล้ของเดิมที่สุด, migrate ทีละหน้าได้, ไม่ต้องมี Node build chain ให้ทีมโรงพยาบาลดูแล, เหมาะกับปริมาณงาน ~180 submission
  - ยกเว้น `cmlar.html` ที่เป็น React + Babel standalone — ให้ทำเป็น Phase หลัง แยกจาก 8 บริการหลัก
- Auth: JWT (access + refresh), hash ด้วย `argon2`
- **Auth ต้องออกแบบเป็น pluggable provider** ← ตอบช่อง `[[ ]]` ข้อ 8.4 (ยังไม่ทราบว่ามี AD หรือไม่)
  ```python
  class AuthProvider(Protocol):
      async def authenticate(self, username: str, password: str) -> UserIdentity | None: ...
  # LocalPasswordProvider (เริ่มด้วยตัวนี้)  |  LDAPProvider (เสียบทีหลังได้ ไม่ต้องรื้อ)
  ```
  เลือกด้วย env var `AUTH_PROVIDER=local|ldap` — `users` table เก็บ `external_id` ไว้ผูก AD ภายหลัง
- Deployment: Docker Compose
- Notification: Telegram Bot API (token ฝั่ง server เท่านั้น) + SMTP

**ห้ามใช้:** JSONP, credentials ใน frontend, `eval()`, `.innerHTML` กับ user input, secret ใน git, Tailwind CDN

---

## 4. Master Data — กู้มาครบแล้ว ให้ import จาก `recovered/master_data_recovered.json`

| ชุดข้อมูล | จำนวน | แหล่งในซอร์สเดิม |
|---|---|---|
| `wards` | **78** | `air.html` → `wardOptionsList` |
| `departments` | **80** (รวม `--กรุณาเลือก--`) | `water_thamc.html` → `departmentOptions` |
| `organisms` | **14** (รวม placeholder) | `water_thamc.html` → `suspectedOrganismOptions` |
| `staff` | **6 คนจริง** | `water_or.html`, `drug2.html` → `staffNames` |
| `specimen_types` | 6 | `specimenTypeOptions` |
| `test_types` (booking) | 6 | `booking.html` → `testTypes` |
| `public_holidays` | 21 | `booking.html` → `publicHolidays` |

**รายชื่อ staff จริง (พร้อมเลขใบประกอบวิชาชีพ):**
```
ทนพ.มานพ นันตาบุตร (ทน.17500)
ทนพญ.นริศรา มังกรแก้ว (ทน.5596)
ทนพญ.อนันตพร ฉันท์ผ่อง (ทน.5653)
ทนพญ.พนารัตน์ เหมะธุลิน (ทน.5969)
ทนพญ.รุจิรา แย้มนวล (ทน.11667)
ทนพญ.ปราญชลี หรั่งอ่อน (ทน.23412)
```
→ แยกเป็น column: `title`, `first_name`, `last_name`, `license_no` **ห้ามเก็บเป็น string ก้อนเดียว**
(ปัญหาสะกดชื่อไม่ตรงกันใน v1 เกิดจากเก็บเป็น string ก้อนเดียวใน dropdown แต่ละหน้า)

---

## 5. Data Model

รวม 8 ฟอร์มเป็น schema เดียว — **ห้ามสร้าง 8 ตาราง**

```sql
-- Master data
services            -- 8 บริการ (code, name, tat_hours, form_schema JSONB)
departments         -- 80 รายการ
wards               -- 78 รายการ
staff               -- title, first_name, last_name, license_no, signature_image
organisms           -- 14 รายการ
users               -- + role, external_id (สำหรับผูก AD ภายหลัง)

-- Transaction
submissions         -- ใบส่งตรวจ (header)
samples             -- ตัวอย่างในใบ (1..n)
sample_results      -- ผลต่อ analyte (EAV)
status_transitions  -- ประวัติสถานะ + timestamp (ใช้คำนวณ TAT)
audit_log           -- ทุก mutation (who, when, before, after, reason)
report_versions     -- snapshot รายงาน + hash
bookings            -- ปฏิทินจอง
reference_ranges    -- เกณฑ์ตัดสินผลต่อ service/analyte (ดูข้อ 8)
```

### 5.1 ฟิลด์เฉพาะแต่ละบริการ — **แก้ไขจาก v1 (v1 สลับ DRG-07/08)**

⚠️ **v1 ระบุฟิลด์ DRG-07 กับ DRG-08 สลับกัน** ค่าที่ถูกต้องตามไฟล์จริง:

| บริการ | ฟิลด์ระดับ submission | ฟิลด์ระดับ sample | analytes |
|---|---|---|---|
| AIR-01 | department, sender_email | ward, location | bacteria_cfu, fungus_cfu |
| STR-02 | department | blood_bag_no, product_type, exprid | sterile, non_sterile |
| WTS-03 | department, specimen_type, suspected_organism | location | culture_result |
| WTO-04 | department, specimen_type, sample_count | location | ecoli, paeruginosa |
| WTM-05 | department (THAMC), suspected_organism, sender_email | location | culture_result |
| FOD-06 | department (โภชนาการ), sender_email | food_item | ecoli, paeruginosa |
| **DRG-07**<br>(ผลิตยา1, `.csv`) | receipt_date, analysis_date, prepared_medicine, lot_no, production_date, volume_ml, submitted_by, sample_count | prepared_medicine | culture_result_72h |
| **DRG-08**<br>(ผลิตยา2, `.xlsx`) | prep_date, sample_date, submit_date, operator, department | drug_type | result_72h |

**เกณฑ์:** ฟิลด์ที่มีทุกบริการ → column จริง | เฉพาะบางบริการ → `extra_data JSONB` + validate ด้วย JSON Schema จาก `services.form_schema`

### 5.2 Status workflow

สถานะเดิมในระบบ (จาก `statuses` array ใน `water_or.html`, `drug2.html`) → map เป็น enum ใหม่:

| เดิม (ไทย) | ใหม่ |
|---|---|
| `กำลังส่งตรวจ` | `SUBMITTED` |
| `รับสิ่งส่งตรวจแล้ว` | `RECEIVED` |
| `รอตรวจ` | `IN_PROGRESS` |
| `ตรวจแล้ว` | `COMPLETED` |
| `ยกเลิก` | `REJECTED` (บังคับกรอกเหตุผล) |
| *(ไม่มีในระบบเดิม)* | `DRAFT`, `REPORTED` |

```
DRAFT → SUBMITTED → RECEIVED → IN_PROGRESS → COMPLETED → REPORTED
                          ↓
                      REJECTED (บังคับกรอกเหตุผล)
```

ทุก transition บันทึกลง `status_transitions` — **TAT คำนวณจากตารางนี้ ไม่ใช่จาก column ที่ overwrite ได้**

⚠️ **บั๊กที่ต้องไม่คัดลอกมา — ยืนยันแล้วที่ `recovered/water_or.html:628`:**
```js
{ label: 'กำลังส่งตรวจ → รับแล้ว', time: tsSubmitting && tsReceived ? tsReceived - tsReceived : null },
//                                                                    ^^^^^^^^^^^^^^^^^^^^^^^ = 0 เสมอ
```
ค่าที่ถูกคือ `tsReceived - tsSubmitting`

---

## 6. Requirements ตาม ISO 15189

1. **Audit trail** — ทุกการเปลี่ยนแปลงบันทึก user, timestamp, ค่าก่อน, ค่าหลัง, เหตุผล (บังคับถ้าแก้ผลที่ report แล้ว)
2. **Amended report** — แก้หลังออกรายงาน → สร้าง version ใหม่ ติดป้าย "AMENDED" ไม่ลบฉบับเดิม
3. **Electronic signature** — ผู้รายงานผลกับผู้ตรวจสอบผลต้องคนละคน enforce ใน backend
   ⚠️ **ข้อมูลเดิมละเมิดข้อนี้อยู่แล้ว:** DRG-07 มี 3 แถว (1 submission) ที่ ReporterName = ReviewerName = `ทนพ.มานพ นันตาบุตร(ทน.17500)`
   → migration ต้องมี policy: import เข้าแต่ flag `legacy_signature_violation = true` + รายงานให้ผู้ตรวจสอบทราบ **ห้ามแก้ข้อมูลเงียบ ๆ**
4. **Reference range / critical value** — เก็บใน `reference_ranges` table (ไม่ใช่ค่าคงที่ในโค้ด) ดูข้อ 8
5. **Retention** — soft delete + `deleted_at` เท่านั้น ห้าม hard delete ดูข้อ 8
6. **Backup** — automated daily `pg_dump` + verify restore ทุกเดือน + SOP
7. **Access control** — 4 role: `requester`, `technician`, `approver`, `admin`

---

## 7. ฟีเจอร์

### 7.1 คงจากระบบเดิม
- [ ] ฟอร์มส่งตรวจแบบตาราง กำหนดจำนวนแถวได้ (1–100)
- [ ] Autocomplete หน่วยงาน/ward/เชื้อ จาก master data
- [ ] Dashboard: การ์ดสรุป + กราฟรายเดือน (พ.ศ.) + รายการล่าสุด
- [ ] Export PDF, ส่งผลทางอีเมล, แจ้งเตือน Telegram, QR code ติดตามสถานะ
- [ ] ปฏิทินจองวันส่งตรวจ (+ `publicHolidays` 21 รายการ)

### 7.2 เพิ่มใหม่
- [ ] Single sign-on หน้าเดียว (แทน login แยก 8 ครั้ง)
- [ ] Dashboard รวมข้ามบริการ, TAT monitoring, trend analysis
- [ ] Export Excel, Full-text search ข้ามบริการ

### 7.3 PDF Export
เดิมใช้ `html2canvas` + `jsPDF` (8 หน้า) → ได้ PDF ที่เป็นรูปภาพ ค้นหาข้อความไม่ได้
**เปลี่ยนเป็น server-side:** WeasyPrint หรือ Playwright → text layer จริง + embed TH Sarabun New / Noto Sans Thai

---

## 8. คำถามที่ยังต้องถามเจ้าของระบบ (เหลือ 2 ข้อ)

ข้ออื่นใน v1 ตอบได้จากซอร์สที่กู้มาแล้ว เหลือ:

1. **เกณฑ์ CFU ของ Air Sampling** — ไม่พบเกณฑ์ตัดสินในซอร์สเดิมเลย ระบบเดิมบันทึกตัวเลขดิบอย่างเดียว ไม่มี flag
   (ข้อมูลจริง: CFU สูงสุดที่เคยบันทึก = 208, มีค่า `-` ปนอยู่ในคอลัมน์ตัวเลข)
   → ระหว่างรอคำตอบ: สร้าง `reference_ranges` table ให้ admin กรอกเองได้ ไม่ block งาน
2. **ระยะเวลาเก็บข้อมูลตามระเบียบ รพ.** → ระหว่างรอ: ตั้ง `RETENTION_YEARS` เป็น env var, soft delete เท่านั้น

**คำถามเชิงปฏิบัติการที่ยังต้องถาม:** มี server ให้ deploy หรือไม่ (spec/OS/ผู้ดูแล/Docker), ต้องผ่าน security review ของ รพ. หรือไม่, เข้าถึงจากนอกโรงพยาบาลหรือไม่, **มี LDAP/AD หรือไม่** (ออกแบบเผื่อไว้แล้ว)

---

## 9. ปัญหาคุณภาพข้อมูล — ต้องจัดการใน Phase 3 (migration)

| ปัญหา | ที่พบ | แนวทาง |
|---|---|---|
| **FOD-06 ไม่มี SubmissionID** | Food 62 แถว | group ด้วย `(Timestamp, SubmissionDate)` แล้ว generate ID ใหม่ |
| **DRG-08 ไม่มี traceability เลย** | 111 แถว — Status/Reporter/Reviewer/timestamp ว่างทั้งหมด | import เป็น `COMPLETED` + flag `legacy_no_traceability` |
| **AIR Sheet1 ซ้ำกับ ชีต2** | 367 vs 233 แถว ID ซ้ำ | ใช้ Sheet1 เป็นหลัก dedupe ด้วย `(SubmissionID, SampleNo)` |
| **Bookings ซ้ำกับ ชีต3** | 133 vs 92 | ใช้ `Bookings` เป็นหลัก |
| **Blood Bag No. เป็น float** | `3.7968115171E10`, `4.05.` | อ่านเป็น string ตั้งแต่ต้น — ค่าที่เสียแล้วต้อง flag ให้ตรวจสอบ |
| **Product Type ปนกับ exprid** | `FFP, exprid: 02/06/70` (111 distinct) | parse แยก 2 column, ปี = พ.ศ. |
| **Drug Type ปนกับ lot** | `IV-A (260568)` (49 distinct) | parse แยก |
| **DRG-08 Remarks เก็บวันที่** | `120569.0` (ddmmyy พ.ศ.) | ย้ายเข้า column วันที่ที่ถูกต้อง |
| **CFU มีค่า `-`** | AIR bacteria/fungus | `NULL` + `result_flag='not_reported'` **ห้ามแปลงเป็น 0** |
| **TAT format ไม่ตรงกัน** | WTO-04 = Excel fraction, DRG-07 = `61:36:42` | คำนวณใหม่จาก `status_transitions` ทั้งหมด |
| **ชื่อหน่วยงานสะกดต่างกัน** | `OPD MED 3`/`OPD Med 3`, `งานควบคุมโรคติดเชื้` (ขาด อ), `หน่วยเตรียมยาปราศจาคเชื้อ` | mapping table + validation report |
| **อีเมลต่างตัวพิมพ์** | `Occhealth94@` vs `occhealth94@` | normalize เป็น lowercase |
| **เบอร์โทรเป็น float** | `2.0780086E7` | อ่านเป็น string |
| **วันที่เป็น Excel serial** | ทุกไฟล์ | แปลงเป็น UTC timestamptz, แสดงผล พ.ศ. (Asia/Bangkok) |

---

## 10. แผนการทำงาน — ขอบเขตงานนี้: **Phase 0 + 1 + 2**

### Phase 0 — Security hotfix (ทำทันที ห้ามข้าม)
1. **Revoke Telegram bot token** (`recovered/cmlar.html:143`) ผ่าน @BotFather → `/revoke`
2. เปลี่ยนรหัสผ่านทุกบัญชีที่ hardcode (7 หน้า ตามตารางข้อ 2)
3. เปลี่ยนชื่อโฟลเดอร์ที่มีรหัสผ่านติดมา (`... - admin 1234`)
4. ตรวจ Apps Script deployment permission ทั้ง 12 ตัว → ตั้งเป็น "Anyone with Google account" ขั้นต่ำ
5. เขียน `SECURITY-FINDINGS.md` ส่งเจ้าของระบบ
6. **ยังไม่แตะโค้ดเดิม** — แค่ปิดช่องโหว่และ document

### Phase 1 — Foundation
- โครงสร้าง repo, Docker Compose, PostgreSQL 16, Alembic
- Auth: JWT + `AuthProvider` protocol (local ก่อน, เผื่อ LDAP)
- Master data: import จาก `recovered/master_data_recovered.json` (78 ward, 80 dept, 14 organism, 6 staff)
- OpenAPI docs อัตโนมัติ, health check
- **Deliverable:** `docker compose up` → login ได้ + master data ครบ

### Phase 2 — Core workflow (pilot = AIR-01)
- Submission → sample → result → status transition → audit log
- ฟอร์มส่งตรวจ + หน้ากรอกผล + PDF export (server-side)
- **Deliverable:** AIR-01 ใช้งานได้ end-to-end พร้อม audit trail

### Phase 3–6 (นอกขอบเขตงานนี้ — วางไว้ให้เห็นทิศทาง)
Phase 3 migration script (**บังคับมี dry-run**) → Phase 4 อีก 7 บริการ (เพิ่มแค่ `form_schema` ถ้าต้องเขียนโค้ดใหม่แปลว่า abstraction ผิด ให้หยุดและ refactor) → Phase 5 ฟีเจอร์เพิ่ม + hardening → Phase 6 parallel run 2–4 สัปดาห์ + cutover

---

## 11. ข้อกำหนดด้านโค้ด

- **ภาษา UI:** ไทยเป็นหลัก ศัพท์เทคนิคใช้อังกฤษได้
- **วันที่:** เก็บ UTC timestamptz, แสดง พ.ศ. (Asia/Bangkok)
- **ฟอนต์:** Noto Sans Thai (เว็บ), TH Sarabun New (PDF ราชการ)
- **Test coverage:** ≥80% business logic — status transition, TAT calculation, permission check ต้อง **100%**
- **Type hints ครบ** — `mypy --strict`
- **Lint:** `ruff` + `black`
- **ห้าม** commit `.env` (ใช้ `.env.example`)
- **Migration:** ผ่าน Alembic เท่านั้น ห้าม `create_all()`
- **ห้ามใช้ `float`** กับค่าที่ต้อง exact → `Decimal` / `numeric`

---

## 12. Definition of Done (ต่อ phase)

- [ ] `docker compose up` แล้วทำงานได้ ไม่ต้อง setup มือ
- [ ] มี seed data สำหรับ development
- [ ] Test ผ่านทั้งหมด, coverage ตามเกณฑ์
- [ ] README: setup, architecture decision, วิธี rollback
- [ ] ไม่มี secret ใน source (ตรวจด้วย `gitleaks`)
- [ ] Audit log บันทึกครบทุก mutation — พิสูจน์ด้วย test
- [ ] `alembic downgrade` ได้

---

## 13. สิ่งที่ห้ามทำ

- ห้ามลบ/แก้ระบบเดิมจนกว่า parallel run จะผ่าน
- ห้ามเขียน migration script ที่ไม่มี dry-run mode
- ห้ามใส่ business logic ใน frontend (TAT, สถานะ, permission → backend ทั้งหมด)
- ห้ามสร้างตารางแยกต่อบริการ
- ห้ามใช้ `float` กับค่าที่ต้อง exact
- ห้ามส่งข้อมูลผู้ป่วยไป third-party API โดยไม่ผ่านการอนุมัติ
- **ห้าม commit `recovered/cmlar.html` โดยไม่ลบ token ออกก่อน**

---

## 14. เริ่มต้น

1. อ่าน `recovered/*.html` ทั้ง 12 ไฟล์ → สรุป data dictionary ต่อบริการ (field name, type, required, ค่าตัวอย่าง, notes)
2. เสนอ ER diagram (Mermaid)
3. ถามคำถามข้อ 8
4. **รอการยืนยันก่อนเขียนโค้ดจริง**
