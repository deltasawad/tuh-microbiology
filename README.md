# ระบบปฏิทินจองคิวและรายงานผลการตรวจสิ่งแวดล้อม งานจุลชีววิทยา รพ.ธรรมศาสตร์เฉลิมพระเกียรติ
### (Environmental Microbiology Booking & Reporting System - ISO 15189)

ระบบเว็บแอปพลิเคชันสำหรับบริหารจัดการการจองคิวส่งตรวจ และการบันทึก/ค้นหา/พิมพ์ใบรายงานผลการตรวจสิ่งแวดล้อมทั้ง 8 บริการ งานจุลชีววิทยา โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ พัฒนาขึ้นเพื่อทดแทนระบบเดิม (Google Sheets + Apps Script) เพื่อแก้ปัญหาพื้นที่ Google Drive เต็ม โดยเปลี่ยนมาใช้สถาปัตยกรรมคลาวด์มาตรฐานระดับองค์กรบนโควต้าฟรี (100% Free Tier Platforms)

---

## 🚀 สถาปัตยกรรมระบบและ Tech Stack

| ส่วนประกอบ (Component) | เทคโนโลยีที่ใช้ (Tech Stack) | แพลตฟอร์มที่โฮสต์ (Hosting/Provider) | โควต้าและการใช้งาน (Free Tier) |
|---|---|---|---|
| **Frontend UI/UX** | HTML5, Vanilla JavaScript, Tailwind CSS, SweetAlert2 | **Cloudflare Pages** | ฟรีตลอดชีพ ไม่จำกัด Bandwidth / Requests |
| **Database** | PostgreSQL 16 (พร้อม Row Level Security - RLS) | **Supabase** | ฟรี 500 MB DB + Database Webhooks |
| **File Storage** | Supabase Storage (`microbiology-files`) | **Supabase Storage** | ฟรี 1 GB Storage สำหรับไฟล์ PDF และรูปถ่าย |
| **Authentication** | Supabase Auth (Email/Password) | **Supabase Auth** | ฟรี 50,000 Active Users/เดือน |
| **Notification** | LINE Notify API / Discord Webhook / Telegram Bot | Direct API / Cloudflare Worker | ฟรี 100% แจ้งเตือนทันทีเมื่อออกผล |

---

## 📋 8 บริการตรวจสิ่งแวดล้อมที่ระบบรองรับ (ISO 15189)

1. **`AIR-01` Air Sampling (สำหรับงานอาชีวอนามัย)**: ตรวจคุณภาพอากาศในหอผู้ป่วย, ICU, ห้องแยกโรค, ห้องผ่าตัด (วัด CFU/m³ แบคทีเรียและเชื้อรา)
2. **`STR-02` Sterility (สำหรับงานธนาคารเลือด)**: ทดสอบความปลอดเชื้อของเครื่อง Autoclave และน้ำยาธนาคารเลือดด้วย Biological Indicator (G. stearothermophilus)
3. **`WTS-03` Water or Surface (สำหรับงานควบคุมโรคติดเชื้อ IC)**: สว็อบพื้นผิว อุปกรณ์ และสิ่งแวดล้อมในโรงพยาบาล (Colony Count & Organisms identification)
4. **`WTO-04` Water (สำหรับห้องผ่าตัด OR)**: ตรวจคุณภาพน้ำและระดับ Endotoxin ในห้องผ่าตัด (Total Viable Count < 10 CFU/100mL, Endotoxin < 0.25 EU/mL)
5. **`WTM-05` Water (สำหรับศูนย์การแพทย์ธรรมศาสตร์ THAMC)**: ตรวจวิเคราะห์น้ำบริสุทธิ์และน้ำไตเทียมตามมาตรฐาน ISO 23500
6. **`FOD-06` Food (สำหรับงานโภชนาการ)**: ตรวจการปนเปื้อนจุลินทรีย์ในอาหารผู้ป่วย (Total Plate Count, E. coli, Salmonella, S. aureus)
7. **`DRG-07` Drug 1 (สำหรับงานผลิตยา - ปลอดเชื้อ)**: ตรวจสอบความปราศจากเชื้อของผลิตภัณฑ์ยา (Sterility Test USP <71> บ่มเชื้อ 14 วัน)
8. **`DRG-08` Drug 2 (สำหรับงานผลิตยา - วิเคราะห์การปนเปื้อน)**: รายงานปริมาณเชื้อและการปนเปื้อนในยาไม่ปราศจากเชื้อ (USP <61> TAMC/TYMC และ USP <62>)

---

## 📁 โครงสร้างไฟล์ในโปรเจกต์ (File Organization)

```
├── supabase_schema.sql          # SQL Script สร้างตาราง, RLS Policies, Storage Bucket และ Master Data
├── README.md                    # คู่มือการติดตั้งและใช้งานระบบ
└── frontend/                    # โฟลเดอร์สำหรับ Deploy ขึ้น Cloudflare Pages
    ├── index.html               # พอร์ทัลหลัก: รวม 8 บริการ + ระบบค้นหาผลตรวจ (E-Report Tracking)
    ├── booking.html             # ปฏิทินจองวันส่งตรวจออนไลน์ (Interactive Thai Calendar)
    ├── admin.html               # แดชบอร์ดเจ้าหน้าที่: ฟอร์มบันทึกผล 8 บริการ + อัปโหลดไฟล์ + จัดการคิว
    ├── login.html               # หน้าเข้าสู่ระบบสำหรับเจ้าหน้าที่ (Staff Login)
    ├── report_view.html         # หน้าพิมพ์ใบรายงานผลตรวจทางการตามมาตรฐาน ISO 15189 (Print / PDF)
    └── js/                      # โมดูลจาวาสคริปต์แยกเป็นสัดส่วน
        ├── supabase-config.js   # จุดใส่ Supabase URL, Anon Key และ Token แจ้งเตือน (LINE/Discord)
        ├── auth.js              # ระบบตรวจสอบสิทธิ์ Session และ Route Guards
        ├── db.js                # ฟังก์ชัน CRUD ฐานข้อมูล (Bookings, Reports, Master Data)
        ├── storage.js           # ระบบอัปโหลดและลบไฟล์ใน Supabase Storage
        ├── notify.js            # ระบบยิงแจ้งเตือน LINE / Discord / Telegram
        ├── app.js               # ตรรกะหน้าแรก (ค้นหาผล, พรีวิวรายงาน)
        ├── booking-app.js       # ตรรกะปฏิทินจองคิว
        └── admin.js             # ตรรกะระบบจัดการของเจ้าหน้าที่
```

---

## 🛠️ ขั้นตอนการติดตั้งและเปิดใช้งาน (Setup Guide)

### ขั้นตอนที่ 1: ติดตั้งฐานข้อมูลบน Supabase
1. สมัครสมาชิกและสร้าง Project ใหม่ที่ [https://supabase.com](https://supabase.com)
2. ไปที่เมนู **SQL Editor** ทางแถบซ้าย
3. คัดลอกโค้ดทั้งหมดจากไฟล์ `supabase_schema.sql` มาวางใน SQL Editor แล้วกด **Run**
4. ระบบจะทำการสร้าง:
   - ตาราง `bookings`, `reports`, `report_items`, `report_attachments`, `master_holidays`
   - Storage Bucket `microbiology-files` (ขนาดสูงสุด 15 MB ต่อไฟล์)
   - นโยบายความปลอดภัย **Row Level Security (RLS)** ให้เรียบร้อยทันที

---

### ขั้นตอนที่ 2: สร้างผู้ใช้งานเจ้าหน้าที่ (Staff Auth)
1. ใน Supabase Dashboard ไปที่เมนู **Authentication** -> **Users**
2. คลิกปุ่ม **Add user** -> **Create user**
3. ใส่อีเมลและรหัสผ่าน เช่น `admin@tuh.lab` หรือ `staff@tuh.lab` พร้อมติ๊กเลือก **Auto Confirm User?** เพื่อให้เข้าใช้งานได้ทันที

---

### ขั้นตอนที่ 3: ใส่ API Keys ในโค้ด Frontend
เปิดไฟล์ `frontend/js/supabase-config.js` แล้วแก้ไขค่าดังนี้:

```javascript
// frontend/js/supabase-config.js

const SUPABASE_CONFIG = {
  // นำมาจาก Supabase Dashboard: Project Settings -> API -> Project URL
  url: 'https://xxxxxxxxxxxx.supabase.co',
  
  // นำมาจาก Supabase Dashboard: Project Settings -> API -> Project API Keys (anon public)
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',

  storageBucket: 'microbiology-files'
};

const NOTIFY_CONFIG = {
  enabled: true,

  // ใส่ Discord Webhook URL (แนะนำ ฟรี 100% ไม่ติด CORS) หรือ LINE Notify Token
  discordWebhookUrl: 'https://discord.com/api/webhooks/xxxx/xxxx',
  
  // หรือใช้ LINE Notify Token ผ่าน Proxy
  lineNotifyToken: 'YOUR_LINE_NOTIFY_TOKEN',
  lineProxyUrl: 'https://your-line-proxy.workers.dev/notify'
};
```

---

### ขั้นตอนที่ 4: Deploy ขึ้น Cloudflare Pages (ฟรี 100%)

#### วิธีที่ 1: Deploy ผ่าน GitHub (แนะนำ)
1. Push โปรเจกต์นี้ขึ้น GitHub Repository
2. เข้าสู่ระบบ [Cloudflare Dashboard](https://dash.cloudflare.com/) -> ไปที่ **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**
3. เลือก Repository ของคุณ
4. ตั้งค่า Build settings:
   - **Framework preset**: `None`
   - **Build command**: (เว้นว่างไว้)
   - **Build output directory**: `frontend`
5. กด **Save and Deploy** — เว็บไซต์จะออนไลน์ทันทีพร้อม HTTPS และ Custom Domain!

#### วิธีที่ 2: Deploy แบบ Drag & Drop
1. เข้า Cloudflare Pages -> เลือกแท็บ **Direct Upload**
2. ลากโฟลเดอร์ `frontend/` ไปวาง แล้วกด **Deploy** ใช้งานได้ทันที

---

## 🔒 ความปลอดภัยและการปฏิบัติตามมาตรฐาน ISO 15189

1. **Row Level Security (RLS)**:
   - บุคคลทั่วไปสามารถ **ดูปฏิทิน** และ **จองคิวส่งตรวจ** ได้
   - บุคคลทั่วไปสามารถ **ค้นหาเฉพาะรายงานที่สถานะ completed** เท่านั้น
   - **เฉพาะเจ้าหน้าที่ที่ล็อกอินผ่าน Supabase Auth เท่านั้น** ที่สามารถเพิ่ม/แก้ไข/ลบ รายงานผลตรวจ และอัปโหลดไฟล์ PDF/รูปภาพได้
2. **Traceability & Audit Trail**:
   - บันทึกชื่อผู้ส่งตรวจ, ผู้ตรวจวิเคราะห์ (Reporter), ผู้อนุมัติผล (Approver), วันที่เก็บ และวันที่รายงานผลไว้อย่างชัดเจน
   - มี Timestamp การสร้างและแก้ไขข้อมูลแบบอัตโนมัติ
3. **No Hardcoded Passwords**:
   - รหัสผ่านและ Access Token ทั้งหมดได้รับการเข้ารหัสและจัดการผ่าน Supabase Auth ปลอดภัยจากการดึงข้อมูลฝั่ง Client

---

## 📞 ติดต่อและข้อมูลงาน
- **งานจุลชีววิทยา ภาควิชาพยาธิวิทยาและนิติเวชศาสตร์**
- ชั้น 3 อาคารคุณากร โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ
- โทร. 0-2926-9650
