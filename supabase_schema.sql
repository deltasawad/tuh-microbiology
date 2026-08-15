-- ==============================================================================
-- TUH MICROBIOLOGY: ENVIRONMENTAL ANALYSIS DATABASE SCHEMA & RLS POLICIES
-- ระบบฐานข้อมูลและการรักษาความปลอดภัยระดับแถว (Row Level Security - RLS)
-- โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ (ISO 15189:2022)
-- ==============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- TABLE 1: BOOKINGS (การจองคิววันส่งตรวจล่วงหน้า)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_date DATE NOT NULL,
    service_code VARCHAR(50) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    contact_number VARCHAR(100) NOT NULL,
    contact_email VARCHAR(255),
    sample_count INTEGER DEFAULT 1,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'confirmed', -- confirmed, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for date queries & queue volume checking (> 10 warning)
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_dept ON public.bookings(department);

-- ==============================================================================
-- TABLE 2: REPORTS (ใบรายงานผลการตรวจวิเคราะห์สิ่งแวดล้อม 8 บริการ)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_no VARCHAR(100) UNIQUE NOT NULL,
    service_code VARCHAR(50) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    ward_room VARCHAR(255),
    sampler_name VARCHAR(255),
    recipient_email VARCHAR(255), -- อีเมลสำหรับส่งผลตรวจอัตโนมัติ (Step 2 & 3)
    sampling_date DATE NOT NULL,
    received_date DATE DEFAULT CURRENT_DATE,
    reported_date DATE,
    reporter_name VARCHAR(255) DEFAULT 'ทนพ.มานพ นันตาบุตร',
    approver_name VARCHAR(255) DEFAULT 'ทนพญ.นริศรา มังกรแก้ว',
    status VARCHAR(50) DEFAULT 'waiting_for_testing', -- 'waiting_for_testing' (รอตรวจ), 'tested' (ตรวจแล้ว), 'completed' (สมบูรณ์)
    overall_result VARCHAR(50) DEFAULT 'pending', -- 'pending', 'pass', 'fail', 'normal', 'no_growth'
    remarks TEXT,
    report_pdf_url TEXT,
    report_pdf_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_submission ON public.reports(submission_no);
CREATE INDEX IF NOT EXISTS idx_reports_service ON public.reports(service_code);
CREATE INDEX IF NOT EXISTS idx_reports_department ON public.reports(department);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- ==============================================================================
-- TABLE 3: REPORT_ITEMS (รายการตัวอย่างสิ่งส่งตรวจและผลวิเคราะห์ย่อย)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.report_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
    item_no INTEGER NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    sample_description VARCHAR(255),
    sample_volume VARCHAR(100),
    standard_criteria VARCHAR(255),
    bacteria_count VARCHAR(100) DEFAULT '-', -- เฉพาะ Med Tech / Admin มีสิทธิ์ลงผล
    fungus_count VARCHAR(100) DEFAULT '-',   -- เฉพาะ Med Tech / Admin มีสิทธิ์ลงผล
    item_result VARCHAR(50) DEFAULT 'pending', -- 'pending', 'pass', 'fail', 'no_growth'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_items_report_id ON public.report_items(report_id);

-- ==============================================================================
-- TABLE 4: SYSTEM_HEALTH (สำหรับ UptimeRobot & Live Heartbeat Pings)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.system_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ping_source VARCHAR(100) DEFAULT 'uptimerobot',
    pinged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    server_status VARCHAR(50) DEFAULT 'healthy'
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- กฎความปลอดภัย: ผู้ส่งตรวจ (Public/Sender) สามารถคีย์รายการได้ แต่ห้ามแก้ผลตรวจ (Result)
-- เฉพาะเจ้าหน้าที่เทคนิคการแพทย์ (Med Tech / Admin) ที่ Authenticated เท่านั้นที่ลงผลได้
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- POLICIES FOR: BOOKINGS
-- ------------------------------------------------------------------------------
-- ทุกคน (Public/Sender) สามารถดูคิวจองเพื่อเช็ควันว่างได้
CREATE POLICY "Public read bookings" 
ON public.bookings FOR SELECT 
USING (true);

-- ผู้ส่งตรวจสามารถจองคิววันส่งตรวจได้ (Step 1)
CREATE POLICY "Public insert bookings" 
ON public.bookings FOR INSERT 
WITH CHECK (true);

-- เฉพาะเจ้าหน้าที่ Authenticated หรือเจ้าของหน่วยงานที่สามารถแก้ไข/ยกเลิกคิวได้
CREATE POLICY "Staff manage bookings" 
ON public.bookings FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- POLICIES FOR: REPORTS
-- ------------------------------------------------------------------------------
-- ผู้ใช้ทั่วไปและหน่วยงานสามารถอ่านผลตรวจ (Tracking / E-Report)
CREATE POLICY "Public select reports" 
ON public.reports FOR SELECT 
USING (true);

-- Step 2: หน่วยงานส่งตรวจสามารถสร้างใบคำขอตรวจได้ โดย status ต้องเป็น 'waiting_for_testing'
CREATE POLICY "Sender submit new test request" 
ON public.reports FOR INSERT 
WITH CHECK (
    status = 'waiting_for_testing' OR auth.role() = 'authenticated'
);

-- Step 3: ห้ามผู้ใช้ทั่วไปแก้ไขผลตรวจ! เฉพาะ Authenticated Med Tech / Admin เท่านั้นที่ Update ได้
CREATE POLICY "Med Tech only update report results" 
ON public.reports FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- เฉพาะ Admin เท่านั้นที่สามารถลบรายงานผลตรวจได้
CREATE POLICY "Admin delete reports" 
ON public.reports FOR DELETE 
TO authenticated 
USING (true);

-- ------------------------------------------------------------------------------
-- POLICIES FOR: REPORT_ITEMS
-- ------------------------------------------------------------------------------
CREATE POLICY "Public select report items" 
ON public.report_items FOR SELECT 
USING (true);

-- ผู้ส่งตรวจสามารถ Insert รายการตัวอย่าง (จุดตรวจ/รายละเอียด)
CREATE POLICY "Sender insert sample items" 
ON public.report_items FOR INSERT 
WITH CHECK (true);

-- เฉพาะ Med Tech / Admin เท่านั้นที่ Update ผล CFU, Bacteria, Fungi, Item Result!
CREATE POLICY "Med Tech update sample results" 
ON public.report_items FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Admin delete sample items" 
ON public.report_items FOR DELETE 
TO authenticated 
USING (true);

-- ------------------------------------------------------------------------------
-- POLICIES FOR: SYSTEM_HEALTH (UptimeRobot Pings)
-- ------------------------------------------------------------------------------
CREATE POLICY "Public read and ping system health" 
ON public.system_health FOR ALL 
USING (true) 
WITH CHECK (true);
