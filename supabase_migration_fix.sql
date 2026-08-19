-- ==============================================================================
-- MIGRATION FIX — เพิ่มคอลัมน์ที่ขาดหายในฐานข้อมูลจริง
-- โครงการ: tgctyouhzsyizlosrmqh (TUH Microbiology)
-- วิธีใช้: Supabase Dashboard -> SQL Editor -> วางไฟล์นี้ทั้งหมด -> Run
-- ==============================================================================
--
-- ที่มาของปัญหา (ตรวจสอบกับฐานข้อมูลจริงแล้ว):
--   GET /rest/v1/reports?select=recipient_email
--   -> {"code":"42703","message":"column reports.recipient_email does not exist"}
--
--   ไฟล์ supabase_schema.sql ประกาศคอลัมน์ recipient_email ไว้ แต่ตารางจริงบนคลาวด์
--   ถูกสร้างก่อนหน้าโดยไม่มีคอลัมน์นี้ (CREATE TABLE IF NOT EXISTS จึงไม่เพิ่มให้)
--   เมื่อหน้าจอ "แบบฟอร์มส่งตรวจ" ส่ง recipient_email ไปด้วย PostgREST จะปฏิเสธทั้งแถว
--   ผลคือ ใบส่งตรวจไม่ถูกบันทึก -> ไม่มีรายการสถานะ "รอตรวจ" ไปโผล่ในหน้ารายงานผล
--
-- หลังรันไฟล์นี้ ระบบจะเก็บอีเมลผู้รับผลและจำนวนตัวอย่างลงคอลัมน์จริงได้ครบถ้วน
-- (โค้ดฝั่งหน้าเว็บถูกแก้ให้ทำงานได้ทั้งก่อนและหลังรันไฟล์นี้แล้ว)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ตาราง reports — เพิ่มคอลัมน์ที่ขาด
-- ------------------------------------------------------------------------------
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS sample_count INTEGER;

-- เชื่อมใบส่งตรวจกลับไปยังคิวที่จองไว้ในปฏิทิน (ถ้ามี)
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.reports.recipient_email IS 'อีเมลของหน่วยงานผู้ส่งตรวจ สำหรับส่งผลอัตโนมัติในขั้นตอนที่ 3';
COMMENT ON COLUMN public.reports.sample_count  IS 'จำนวนตัวอย่างที่แจ้งไว้ตอนส่งตรวจ';

-- ย้ายอีเมลที่ระบบเคยบันทึกแฝงไว้ในช่องหมายเหตุ ให้มาอยู่ในคอลัมน์ที่ถูกต้อง
UPDATE public.reports
SET recipient_email = substring(remarks FROM '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}')
WHERE recipient_email IS NULL
  AND remarks ~ '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}';

-- เติมจำนวนตัวอย่างย้อนหลังจากจำนวนแถวจริงในตาราง report_items
UPDATE public.reports r
SET sample_count = sub.cnt
FROM (
    SELECT report_id, COUNT(*) AS cnt
    FROM public.report_items
    GROUP BY report_id
) AS sub
WHERE r.id = sub.report_id
  AND r.sample_count IS NULL;

-- ------------------------------------------------------------------------------
-- 1.1 reporter_name / approver_name เป็น NOT NULL แต่ไม่มีค่า DEFAULT บนตารางจริง
--     ตอนผู้ส่งตรวจสร้างใบใหม่ยังไม่รู้ว่าใครจะเป็นผู้ตรวจ การ INSERT จึงถูกปฏิเสธด้วย
--     ข้อความ: null value in column "reporter_name" violates not-null constraint
--     -> ใส่ค่า DEFAULT ให้ เพื่อให้สร้างใบส่งตรวจได้โดยไม่ต้องระบุผู้ตรวจล่วงหน้า
-- ------------------------------------------------------------------------------
ALTER TABLE public.reports
    ALTER COLUMN reporter_name SET DEFAULT 'รอห้องปฏิบัติการลงผล';

ALTER TABLE public.reports
    ALTER COLUMN approver_name SET DEFAULT 'รอห้องปฏิบัติการลงผล';

-- ------------------------------------------------------------------------------
-- 2. ตาราง report_items — เพิ่มคอลัมน์ที่ไฟล์ schema อ้างถึงแต่ตารางจริงไม่มี
-- ------------------------------------------------------------------------------
ALTER TABLE public.report_items
    ADD COLUMN IF NOT EXISTS sample_volume VARCHAR(100);

ALTER TABLE public.report_items
    ADD COLUMN IF NOT EXISTS standard_criteria VARCHAR(255);

-- ------------------------------------------------------------------------------
-- 3. ตาราง bookings — เก็บอีเมลผู้จองไว้ใช้แจ้งเตือน
-- ------------------------------------------------------------------------------
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);

-- ------------------------------------------------------------------------------
-- 4. ดัชนีช่วยให้หน้าคิว "รอตรวจ" และการเรียงลำดับล่าสุดทำงานเร็วขึ้น
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON public.reports(status, created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. RLS — ยืนยันกฎเดิม: ผู้ส่งตรวจสร้างใบได้ แต่แก้ "ผลตรวจ" ไม่ได้
--    (ใช้ DROP ... IF EXISTS ก่อน CREATE เพื่อให้รันซ้ำได้โดยไม่ error 42710)
-- ------------------------------------------------------------------------------
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sender submit new test request" ON public.reports;
CREATE POLICY "Sender submit new test request"
ON public.reports FOR INSERT
WITH CHECK (
    -- ผู้ส่งตรวจทั่วไปสร้างได้เฉพาะใบที่ยังไม่มีผล (สถานะรอตรวจ และผลเป็น pending)
    -- รับได้ทุกชื่อที่หมายถึง "รอตรวจ" เพื่อให้เข้ากันได้กับโค้ดที่มี fallback
    (status IN ('pending', 'waiting_for_testing', 'in_progress', 'draft')
        AND (overall_result IS NULL OR overall_result = 'pending'))
    OR auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Med Tech only update report results" ON public.reports;
CREATE POLICY "Med Tech only update report results"
ON public.reports FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Med Tech update sample results" ON public.report_items;
CREATE POLICY "Med Tech update sample results"
ON public.report_items FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5.1 ⚠️ สำคัญ: ขยาย CHECK constraint ให้รับสถานะ 'pending' ตามสเปกของระบบ
--     ตรวจสอบกับฐานข้อมูลจริงแล้ว constraint เดิมรับเฉพาะ
--     'draft', 'in_progress', 'completed' และ "ปฏิเสธ" 'pending' / 'waiting_for_testing' / 'tested'
--     (โค้ดฝั่งหน้าเว็บถอยไปใช้ in_progress/completed ให้อัตโนมัติอยู่แล้ว
--      รันคำสั่งนี้เพื่อให้ใช้ค่า 'pending'/'tested' ได้ตรงตามสเปก)
-- ------------------------------------------------------------------------------
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports
    ADD CONSTRAINT reports_status_check CHECK (
        status IN ('draft', 'pending', 'waiting_for_testing', 'in_progress',
                   'received', 'submitted', 'tested', 'reported', 'completed', 'rejected')
    );

-- ------------------------------------------------------------------------------
-- 5.2 ⚠️ สำคัญ: ผู้ใช้ทั่วไป (anon / ยังไม่ได้ล็อกอิน) มองไม่เห็นใบที่ "รอตรวจ"
--     ตรวจสอบกับฐานข้อมูลจริงแล้ว:
--       anon          -> SELECT ได้ 194 แถว (เฉพาะ status = 'completed')
--       authenticated -> SELECT ได้ 197 แถว (เห็นใบที่รอตรวจด้วย)
--     ทำให้ใบที่เพิ่งส่งตรวจไม่ปรากฏบนหน้ารายงานผล ถ้าเปิดดูโดยไม่ล็อกอิน
--     (หรือเปิดจากเครื่องอื่นที่ไม่มีข้อมูลใน localStorage)
--     -> เปิดให้อ่านได้ทุกสถานะ ตามข้อกำหนด Guest View
--     (ยังคงห้ามผู้ใช้ทั่วไป "แก้ไขผลตรวจ" เหมือนเดิม — ดูข้อ 5 ด้านบน)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public select reports" ON public.reports;
CREATE POLICY "Public select reports"
ON public.reports FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public select report items" ON public.report_items;
CREATE POLICY "Public select report items"
ON public.report_items FOR SELECT
USING (true);

-- ------------------------------------------------------------------------------
-- 6. ตรวจผลลัพธ์หลังรัน (ควรเห็นครบทุกคอลัมน์)
-- ------------------------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'reports'
  AND column_name IN ('recipient_email', 'sample_count', 'booking_id')
ORDER BY column_name;
