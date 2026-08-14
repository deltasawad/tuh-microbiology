# คู่มือการติดตั้งระบบบน Render.com + Supabase (ฟรี 100%)
### TUH Microbiology Environmental Reporting System

ระบบนี้ออกแบบมาให้สามารถรวม Frontend และ Backend อยู่ใน **Render Web Service ตัวเดียว (Single Service)** ทำให้ใช้งานฟรี 100% โดยไม่มีค่าใช้จ่ายรายเดือน และเชื่อมต่อกับ **Supabase PostgreSQL Free Database**

---

## 🛠️ ขั้นตอนที่ 1: สร้างฐานข้อมูล PostgreSQL บน Supabase (ใช้เวลา 2 นาที)

1. เข้าเว็บไซต์ **[https://supabase.com](https://supabase.com)** และกด **Sign Up** (สามารถล็อกอินผ่าน GitHub หรือ Email)
2. กดปุ่ม **"New Project"**
3. กรอกข้อมูลโปรเจกต์:
   - **Name**: `tuh-microbiology`
   - **Database Password**: ตั้งรหัสผ่านฐานข้อมูลที่ปลอดภัย (เช่น `TUH_SecurePass2026!`) *(จดรหัสผ่านนี้ไว้)*
   - **Region**: เลือก `Singapore (ap-southeast-1)` (ใกล้ประเทศไทยที่สุด โหลดเร็ว)
   - **Pricing Plan**: `Free` ($0/month)
4. กด **"Create new project"** และรอประมาณ 1 นาทีให้ระบบสร้างฐานข้อมูลเสร็จ
5. คัดลอก Connection String:
   - ไปที่เมนู **Project Settings (รูปฟันเฟืองล่างซ้าย)** → **Database**
   - เลื่อนลงมาที่หัวข้อ **Connection string**
   - เลือกแท็บ **URI** และเลือกโหมด **Session** (หรือ Direct)
   - จะได้ Connection String หน้าตาแบบนี้:
     ```
     postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
     ```
   - **สำคัญ**: ให้เปลี่ยน `[YOUR-PASSWORD]` เป็นรหัสผ่านจริงที่คุณตั้งไว้ในข้อ 3

---

## 🚀 ขั้นตอนที่ 2: อัปโหลดโค้ดขึ้น GitHub

1. นำโฟลเดอร์โปรเจกต์นี้ Push ขึ้นไปที่ GitHub Repository ของท่าน (สร้างเป็น Private หรือ Public ก็ได้)
   ```bash
   git init
   git add .
   git commit -m "Initial commit for TUH Microbiology System"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USER>/tuh-microbiology.git
   git push -u origin main
   ```

---

## 🌐 ขั้นตอนที่ 3: สร้างและ Deploy บน Render.com (ใช้เวลา 3 นาที)

1. เข้าเว็บไซต์ **[https://render.com](https://render.com)** และกด **Sign Up** (เชื่อมต่อด้วยบัญชี GitHub)
2. เมื่อเข้าสู่หน้า Dashboard ให้กดปุ่ม **"New +"** (มุมบนขวา) → เลือก **"Web Service"**
3. เลือก **"Build and deploy from a Git repository"** และกดเลือก Repository `tuh-microbiology` ที่เพิ่ง Push ขึ้นไป
4. ตั้งค่าหน้าต่าง Deployment ดังนี้:
   - **Name**: `tuh-microbiology` (หรือชื่อที่ต้องการ จะได้ URL เช่น `https://tuh-microbiology.onrender.com`)
   - **Region**: `Singapore (Southeast Asia)`
   - **Branch**: `main`
   - **Root Directory**: *(ปล่อยว่างไว้)*
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     cd backend && pip install -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type**: เลือก **`Free`** ($0/month)

5. เลื่อนลงมาที่หัวข้อ **"Environment Variables"** และกดปุ่ม **"Add Environment Variable"** เพิ่มค่า 3 ตัวนี้:
   
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | *วาง Connection string จาก Supabase ที่ได้จากขั้นตอนที่ 1* |
   | `JWT_SECRET_KEY` | `c9284fa6e3d298b417c80ef748b92d04a6e84d2f091482ba83` *(หรือสุ่มข้อความยาวๆ)* |
   | `ENVIRONMENT` | `production` |

6. กดปุ่ม **"Create Web Service"** ด้านล่างสุด

---

## 🎉 ขั้นตอนที่ 4: เสร็จสมบูรณ์และเริ่มใช้งาน

- Render จะทำการ Build และ Deploy อัตโนมัติ (ใช้เวลาประมาณ 2-3 นาที)
- เมื่อเสร็จแล้ว สถานะจะขึ้นเป็น **`Live`** สีเขียว
- ระบบจะทำการสร้างตารางบน Supabase อัตโนมัติ พร้อมนำเข้าข้อมูล Master Data:
  - 78 หอผู้ป่วย (Wards)
  - 79 หน่วยงาน (Departments)
  - 6 นักเทคนิคการแพทย์ (Staff)
  - 13 เชื้อจุลินทรีย์ (Organisms)
  - 21 วันหยุดราชการ และสร้างบัญชีผู้ใช้งานให้ทันที!

### 🔗 ลิงก์สำหรับเข้าใช้งาน:
- **Web App**: `https://<YOUR_APP_NAME>.onrender.com/`
- **Swagger API Docs**: `https://<YOUR_APP_NAME>.onrender.com/docs`

### 🔑 บัญชีล็อกอินเริ่มต้น (Default Logins):
- **Admin**: `admin` / `AdminTUH@2026!`
- **Technician (ผู้ตรวจ/รายงานผล)**: `tech_manop` / `Tech@1234`
- **Approver (ผู้อนุมัติผล)**: `approver_narisara` / `Approver@1234`
- **Requester (งานอาชีวอนามัย)**: `occhealth` / `Occ@1234`

---

## 💡 คำแนะนำเพิ่มเติมสำหรับการใช้งาน Render Free Tier
1. **Sleep Mode**: ในแพ็กเกจฟรีของ Render หากไม่มีการเรียกใช้งานเกิน 15 นาที ระบบจะเข้าสู่โหมด Sleep และจะใช้เวลาตื่นประมาณ 30-50 วินาทีเมื่อมีคนเข้าเว็บครั้งแรก
2. **หากต้องการให้ตื่นตลอดเวลา (Keep-Alive ฟรี 100%)**: สามารถนำ URL ของเว็บเราไปใส่ในบริการเช็กสถานะฟรี เช่น **[UptimeRobot](https://uptimerobot.com)** หรือ **[Cron-Job.org](https://cron-job.org)** ให้ยิงเรียก `/api/health` ทุกๆ 10 นาที เซิร์ฟเวอร์ก็จะไม่หลับเลยครับ
