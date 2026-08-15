-- ==============================================================================
-- DATABASE SCHEMA: TUH MICROBIOLOGY ENVIRONMENTAL BOOKING & REPORTING SYSTEM
-- ระบบปฏิทินจองคิวและรายงานผลการตรวจสิ่งแวดล้อม งานจุลชีววิทยา รพ.ธรรมศาสตร์เฉลิมพระเกียรติ
-- มาตรฐาน ISO 15189 | Supabase PostgreSQL 16
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. DROP EXISTING CONFLICTING TABLES (CLEAN SLATE RESET)
-- เพื่อป้องกัน Error 42703 ในกรณีที่มีตาราง bookings/reports เดิมที่คอลัมน์ไม่ตรงกัน
-- ==============================================================================
DROP TABLE IF EXISTS public.report_attachments CASCADE;
DROP TABLE IF EXISTS public.report_items CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.master_holidays CASCADE;

-- ==============================================================================
-- 3. CREATE NEW TABLES
-- ==============================================================================

-- 3.1 Table: bookings (ปฏิทินจองวันส่งตรวจ)
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_date DATE NOT NULL,
    sender_name TEXT NOT NULL,
    department TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    service_code TEXT NOT NULL, -- 'AIR_01', 'STR_02', 'WTS_03', 'WTO_04', 'WTM_05', 'FOD_06', 'DRG_07', 'DRG_08'
    service_name TEXT NOT NULL,
    sample_count INTEGER NOT NULL DEFAULT 1 CHECK (sample_count > 0 AND sample_count <= 200),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3.2 Table: reports (รายงานผลตรวจสิ่งแวดล้อม - Master Header)
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_no TEXT UNIQUE NOT NULL, -- เช่น AIR-202608-001, STR-202608-001
    service_code TEXT NOT NULL,         -- 'AIR_01', 'STR_02', 'WTS_03', 'WTO_04', 'WTM_05', 'FOD_06', 'DRG_07', 'DRG_08'
    service_name TEXT NOT NULL,
    department TEXT NOT NULL,
    ward_room TEXT,
    sampling_date DATE NOT NULL,
    received_date DATE,
    reported_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sampler_name TEXT,
    reporter_name TEXT NOT NULL,        -- ชื่อเจ้าหน้าที่ผู้ตรวจและรายงานผล
    approver_name TEXT,                 -- ผู้ตรวจสอบและอนุมัติผล (ทนพ./หัวหน้าห้องปฏิบัติการ)
    overall_result TEXT NOT NULL DEFAULT 'pass' CHECK (overall_result IN ('pass', 'fail', 'normal', 'abnormal', 'pending', 'growth', 'no_growth')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
    remarks TEXT,
    report_pdf_url TEXT,                -- Supabase Storage Public / Signed URL
    report_pdf_path TEXT,               -- Storage Object Path (เช่น reports/AIR-202608-001.pdf)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3.3 Table: report_items (รายการตัวอย่างย่อยในใบส่งตรวจ)
CREATE TABLE public.report_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    item_no INTEGER NOT NULL DEFAULT 1,
    location_name TEXT,                 -- จุดตรวจ / ห้อง / อุปกรณ์ / ชื่อตัวอย่าง
    sample_description TEXT,            -- รายละเอียดสิ่งส่งตรวจ
    bacteria_count TEXT,                -- จำนวนโคโลนีเชื้อแบคทีเรีย (CFU/plate, CFU/m3, CFU/g, CFU/mL)
    fungus_count TEXT,                  -- จำนวนโคโลนีเชื้อรา
    microorganism_found TEXT,           -- เชื้อจุลชีพที่ตรวจพบ (ถ้ามี)
    standard_limit TEXT,                -- เกณฑ์มาตรฐานอ้างอิง
    item_result TEXT NOT NULL DEFAULT 'pass' CHECK (item_result IN ('pass', 'fail', 'growth', 'no_growth', 'pending', 'normal', 'abnormal', 'not_applicable')),
    raw_data JSONB DEFAULT '{}'::jsonb, -- ข้อมูลเฉพาะของแต่ละบริการ (เช่น lot_no, temp, autoclave_cycle, incubation_days)
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.4 Table: report_attachments (ไฟล์แนบเพิ่มเติม รูปถ่าย หรือไฟล์ดิบ)
CREATE TABLE public.report_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3.5 Table: master_holidays (วันหยุดราชการ/นักขัตฤกษ์ สำหรับปฏิทิน)
CREATE TABLE public.master_holidays (
    id SERIAL PRIMARY KEY,
    holiday_date DATE UNIQUE NOT NULL,
    holiday_name TEXT NOT NULL
);

-- ==============================================================================
-- 4. INDEXES FOR FAST PERFORMANCE
-- ==============================================================================
CREATE INDEX idx_bookings_date ON public.bookings(booking_date);
CREATE INDEX idx_bookings_service ON public.bookings(service_code);
CREATE INDEX idx_bookings_dept ON public.bookings(department);

CREATE INDEX idx_reports_submission_no ON public.reports(submission_no);
CREATE INDEX idx_reports_service ON public.reports(service_code);
CREATE INDEX idx_reports_department ON public.reports(department);
CREATE INDEX idx_reports_reported_date ON public.reports(reported_date);
CREATE INDEX idx_reports_status ON public.reports(status);

CREATE INDEX idx_report_items_report_id ON public.report_items(report_id);
CREATE INDEX idx_report_attachments_report_id ON public.report_attachments(report_id);

-- ==============================================================================
-- 5. SUPABASE STORAGE BUCKET CONFIGURATION
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'microbiology-files',
    'microbiology-files',
    true,
    15728640, -- 15 MB limit
    ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 15728640;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 6.1 Enable RLS on all tables
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_holidays ENABLE ROW LEVEL SECURITY;

-- 6.2 Policies for `bookings`
DROP POLICY IF EXISTS "Public can view bookings" ON public.bookings;
CREATE POLICY "Public can view bookings" 
ON public.bookings FOR SELECT 
TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Public can create booking" ON public.bookings;
CREATE POLICY "Public can create booking" 
ON public.bookings FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can update bookings" ON public.bookings;
CREATE POLICY "Staff can update bookings" 
ON public.bookings FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can delete bookings" ON public.bookings;
CREATE POLICY "Staff can delete bookings" 
ON public.bookings FOR DELETE 
TO authenticated 
USING (true);


-- 6.3 Policies for `reports`
DROP POLICY IF EXISTS "Public can view completed reports" ON public.reports;
CREATE POLICY "Public can view completed reports" 
ON public.reports FOR SELECT 
TO anon, authenticated 
USING (status = 'completed' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff can insert reports" ON public.reports;
CREATE POLICY "Staff can insert reports" 
ON public.reports FOR INSERT 
TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can update reports" ON public.reports;
CREATE POLICY "Staff can update reports" 
ON public.reports FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can delete reports" ON public.reports;
CREATE POLICY "Staff can delete reports" 
ON public.reports FOR DELETE 
TO authenticated 
USING (true);


-- 6.4 Policies for `report_items`
DROP POLICY IF EXISTS "Public can view report items" ON public.report_items;
CREATE POLICY "Public can view report items" 
ON public.report_items FOR SELECT 
TO anon, authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.reports 
        WHERE public.reports.id = public.report_items.report_id 
        AND (public.reports.status = 'completed' OR auth.role() = 'authenticated')
    )
);

DROP POLICY IF EXISTS "Staff can insert report items" ON public.report_items;
CREATE POLICY "Staff can insert report items" 
ON public.report_items FOR INSERT 
TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can update report items" ON public.report_items;
CREATE POLICY "Staff can update report items" 
ON public.report_items FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can delete report items" ON public.report_items;
CREATE POLICY "Staff can delete report items" 
ON public.report_items FOR DELETE 
TO authenticated 
USING (true);


-- 6.5 Policies for `report_attachments`
DROP POLICY IF EXISTS "Public can view attachments" ON public.report_attachments;
CREATE POLICY "Public can view attachments" 
ON public.report_attachments FOR SELECT 
TO anon, authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.reports 
        WHERE public.reports.id = public.report_attachments.report_id 
        AND (public.reports.status = 'completed' OR auth.role() = 'authenticated')
    )
);

DROP POLICY IF EXISTS "Staff can manage attachments" ON public.report_attachments;
CREATE POLICY "Staff can manage attachments" 
ON public.report_attachments FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);


-- 6.6 Policies for `master_holidays`
DROP POLICY IF EXISTS "Public can view holidays" ON public.master_holidays;
CREATE POLICY "Public can view holidays" 
ON public.master_holidays FOR SELECT 
TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Staff can manage holidays" ON public.master_holidays;
CREATE POLICY "Staff can manage holidays" 
ON public.master_holidays FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);


-- 6.7 Policies for Supabase Storage (`storage.objects`)
DROP POLICY IF EXISTS "Public read storage" ON storage.objects;
CREATE POLICY "Public read storage" 
ON storage.objects FOR SELECT 
TO anon, authenticated 
USING (bucket_id = 'microbiology-files');

DROP POLICY IF EXISTS "Staff upload storage" ON storage.objects;
CREATE POLICY "Staff upload storage" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'microbiology-files');

DROP POLICY IF EXISTS "Staff update storage" ON storage.objects;
CREATE POLICY "Staff update storage" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'microbiology-files')
WITH CHECK (bucket_id = 'microbiology-files');

DROP POLICY IF EXISTS "Staff delete storage" ON storage.objects;
CREATE POLICY "Staff delete storage" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'microbiology-files');


-- ==============================================================================
-- 7. INITIAL SEED DATA (วันหยุดนักขัตฤกษ์ & ตัวอย่างข้อมูลเริ่มต้น)
-- ==============================================================================

-- 7.1 วันหยุดนักขัตฤกษ์
INSERT INTO public.master_holidays (holiday_date, holiday_name) VALUES
('2026-01-01', 'วันขึ้นปีใหม่'),
('2026-02-12', 'วันมาฆบูชา'),
('2026-04-06', 'วันพระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราชและวันที่ระลึกมหาจักรีบรมราชวงศ์'),
('2026-04-13', 'วันสงกรานต์'),
('2026-04-14', 'วันสงกรานต์'),
('2026-04-15', 'วันสงกรานต์'),
('2026-05-01', 'วันแรงงานแห่งชาติ'),
('2026-05-04', 'วันฉัตรมงคล'),
('2026-05-31', 'วันวิสาขบูชา'),
('2026-06-03', 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี'),
('2026-07-28', 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว'),
('2026-07-29', 'วันอาสาฬหบูชา'),
('2026-07-30', 'วันเข้าพรรษา'),
('2026-08-12', 'วันแม่แห่งชาติ / วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง'),
('2026-10-13', 'วันนวมินทรมหาราช'),
('2026-10-23', 'วันปิยมหาราช'),
('2026-12-05', 'วันพ่อแห่งชาติ / วันชาติ'),
('2026-12-10', 'วันรัฐธรรมนูญ'),
('2026-12-31', 'วันสิ้นปี')
ON CONFLICT (holiday_date) DO NOTHING;

-- 7.2 ตัวอย่างข้อมูลการจองเริ่มต้น (Seed Bookings)
INSERT INTO public.bookings (booking_date, sender_name, department, contact_number, service_code, service_name, sample_count, notes, status) VALUES
(CURRENT_DATE + INTERVAL '2 days', 'พว.สุดาพร นามสมมุติ', 'ICU CVT', '081-234-5678', 'AIR_01', 'Air Sampling (งานอาชีวอนามัย)', 6, 'ตรวจคุณภาพอากาศประจำเดือน', 'confirmed'),
(CURRENT_DATE + INTERVAL '3 days', 'นายสมเกียรติ มั่นคง', 'ธนาคารเลือด', '089-876-5432', 'STR_02', 'Sterility (ธนาคารเลือด)', 4, 'ทดสอบหม้อนึ่ง Autoclave รอบสัปดาห์', 'confirmed'),
(CURRENT_DATE + INTERVAL '5 days', 'พว.วิไลลักษณ์ ศรีสุข', 'งานควบคุมโรคติดเชื้อ (IC)', '086-555-1234', 'WTS_03', 'Water & Surface (งาน IC)', 10, 'Swab พื้นผิวห้องแยกโรคความดันลบ', 'confirmed');

-- 7.3 ฟังก์ชันอัตโนมัติอัปเดต updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reports_updated_at ON public.reports;
CREATE TRIGGER trigger_reports_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_bookings_updated_at ON public.bookings;
CREATE TRIGGER trigger_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
