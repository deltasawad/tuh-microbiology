-- ==============================================================================
-- LIFF MIGRATION : เก็บตัวตนผู้ใช้จาก LINE (LINE userId / displayName)
-- โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ — งานจุลชีววิทยา
-- ------------------------------------------------------------------------------
-- รันไฟล์นี้ใน Supabase Dashboard -> SQL Editor -> New query -> Run
-- ปลอดภัยต่อการรันซ้ำ (ใช้ IF NOT EXISTS ทั้งหมด)
--
-- หมายเหตุ: โค้ดฝั่งหน้าเว็บ (liff-app.js) ออกแบบให้ทำงานได้แม้ยังไม่ได้รันไฟล์นี้
-- โดยจะตรวจจับ error 42703 / PGRST204 แล้วบันทึกซ้ำโดยตัดคอลัมน์ LINE ออก
-- แต่ถ้าไม่รัน จะไม่สามารถย้อนดูได้ว่าใบไหนถูกส่งโดย LINE ของใคร
-- ==============================================================================

-- 1) ตาราง bookings : ใครเป็นคนจองคิวผ่าน LINE
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS line_user_id      VARCHAR(64);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS line_display_name VARCHAR(255);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS source            VARCHAR(20) DEFAULT 'web';

COMMENT ON COLUMN public.bookings.line_user_id      IS 'LINE userId (U....) จาก liff.getProfile() — ใช้ push ผลกลับหาผู้จองรายบุคคล';
COMMENT ON COLUMN public.bookings.line_display_name IS 'ชื่อที่แสดงใน LINE ของผู้จอง ณ เวลาที่จอง';
COMMENT ON COLUMN public.bookings.source            IS 'ช่องทางที่สร้างรายการ: web | liff';

-- 2) ตาราง reports : ใครเป็นคนส่งตรวจผ่าน LINE
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS line_user_id      VARCHAR(64);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS line_display_name VARCHAR(255);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS source            VARCHAR(20) DEFAULT 'web';

COMMENT ON COLUMN public.reports.line_user_id IS 'LINE userId ของผู้ส่งตรวจ — ใช้แจ้งเตือนกลับเมื่อผลออก';

-- 3) Index สำหรับหน้า "ใบส่งตรวจของฉัน" ใน LIFF (ค้นด้วย line_user_id)
CREATE INDEX IF NOT EXISTS idx_bookings_line_user ON public.bookings(line_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_line_user  ON public.reports(line_user_id);

-- ==============================================================================
-- 4) RLS : ผู้ส่งตรวจผ่าน LIFF ใช้สิทธิ์ anon จึงต้อง INSERT ได้ แต่ห้ามแก้ผลตรวจ
--    (นโยบายเดิมใน supabase_schema.sql ครอบคลุมอยู่แล้ว — ส่วนนี้เป็นการยืนยันซ้ำ)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bookings' AND policyname = 'liff_anon_can_create_booking'
  ) THEN
    CREATE POLICY liff_anon_can_create_booking
      ON public.bookings FOR INSERT TO anon WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reports' AND policyname = 'liff_anon_can_create_report'
  ) THEN
    CREATE POLICY liff_anon_can_create_report
      ON public.reports FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

-- ==============================================================================
-- ตรวจผลลัพธ์
-- ==============================================================================
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('line_user_id', 'line_display_name', 'source')
ORDER BY table_name, column_name;

-- ==============================================================================
-- ภาคผนวก (2026-08-19) : แก้ปัญหา "หน้า 2 บันทึกไม่สำเร็จ"
--   new row violates row-level security policy for table "reports"
-- ------------------------------------------------------------------------------
-- สาเหตุจริง 2 ข้อ (ไม่ใช่ข้อเดียว):
--
--  1) policy SELECT เดิม "Public can view completed reports" ยอมให้ anon อ่านได้
--     เฉพาะแถวที่ status='completed' เท่านั้น
--     เมื่อ supabase-js เรียก .insert().select() จะกลายเป็น INSERT ... RETURNING
--     ซึ่ง PostgreSQL บังคับว่าแถวที่คืนต้องผ่าน policy SELECT ด้วย
--     ใบ "รอตรวจ" (in_progress) จึงอ่านกลับไม่ได้ -> ขึ้น error 42501
--     >> แก้ที่ฝั่งแอป: สร้าง UUID เองแล้วสั่ง insert แบบไม่อ่านค่ากลับ
--        (ปลอดภัยกว่าการเปิดสิทธิ์ SELECT ให้ anon อ่านใบที่ยังไม่ออกผล)
--
--  2) report_items ยังไม่มี policy ให้ anon เพิ่มรายการตัวอย่าง
--     (ของเดิมเป็น "Staff can insert report items" -> authenticated เท่านั้น)
--     ถ้าไม่แก้ ต่อให้บันทึกหัวใบผ่าน รายการตัวอย่างก็จะหายทั้งหมด
-- ==============================================================================

-- ฟังก์ชันช่วยตรวจว่า report_id ที่อ้างถึงเป็นใบที่สร้างจาก LIFF หรือไม่
-- ต้องเป็น SECURITY DEFINER เพราะถ้าเขียน EXISTS ตรง ๆ ใน policy
-- ตัว subquery จะโดน RLS ของตาราง reports บังคับซ้ำ แล้วมองไม่เห็นใบรอตรวจ -> ตรวจไม่ผ่านเสมอ
CREATE OR REPLACE FUNCTION public.is_liff_report(rid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.reports r WHERE r.id = rid AND r.source = 'liff');
$$;

COMMENT ON FUNCTION public.is_liff_report(uuid) IS
  'ใช้ใน RLS policy ของ report_items — จำกัดให้ anon เพิ่มรายการได้เฉพาะใบที่ส่งผ่าน LIFF เท่านั้น ห้ามแตะใบเดิมของโรงพยาบาล';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'report_items' AND policyname = 'liff_anon_can_create_report_items'
  ) THEN
    -- anon เพิ่ม "รายการตัวอย่าง" ได้เฉพาะกับใบที่มาจาก LIFF
    -- ยังคงแก้ผลตรวจ (bacteria_count / item_result) ไม่ได้ เพราะ UPDATE ยังเป็นของ authenticated เท่านั้น
    CREATE POLICY liff_anon_can_create_report_items
      ON public.report_items FOR INSERT TO anon
      WITH CHECK (public.is_liff_report(report_id));
  END IF;
END $$;

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND policyname LIKE 'liff_%'
ORDER BY tablename, policyname;

-- ==============================================================================
-- ภาคผนวก 2 (2026-08-19) : บันทึกว่าใครเป็นคนแก้ไข (ISO 15189 traceability)
-- ------------------------------------------------------------------------------
-- ก่อนหน้านี้ทุกหน่วยงานล็อกอิน Supabase ด้วยบัญชีกลางตัวเดียวกัน (admin@tuh.lab)
-- ฐานข้อมูลจึงเห็นทุกการแก้ไขเป็นคนเดียวกันหมด สืบย้อนไม่ได้ว่าใครลงผลใบไหน
--
-- ตอนนี้แต่ละหน่วยงานมีบัญชีของตัวเองแล้ว จึงบันทึก auth.uid() ลงไปทุกครั้ง
-- ใช้ trigger ไม่ใช่ให้ฝั่งเบราว์เซอร์ส่งมา เพราะค่าที่ฝั่งผู้ใช้ส่งมาปลอมได้
-- ==============================================================================

ALTER TABLE public.reports      ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.report_items ADD COLUMN IF NOT EXISTS updated_by uuid;

COMMENT ON COLUMN public.reports.updated_by      IS 'auth.uid() ของผู้บันทึก/แก้ไขล่าสุด — ตั้งโดย trigger ปลอมจากฝั่งผู้ใช้ไม่ได้';
COMMENT ON COLUMN public.report_items.updated_by IS 'auth.uid() ของผู้ลงผลล่าสุด — ตั้งโดย trigger';

CREATE OR REPLACE FUNCTION public.stamp_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- auth.uid() คืน NULL เมื่อเรียกจาก connection ตรง (เช่น สคริปต์ดูแลระบบ) ซึ่งถูกต้องแล้ว
  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reports_updated_by ON public.reports;
CREATE TRIGGER trg_reports_updated_by
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.stamp_updated_by();

DROP TRIGGER IF EXISTS trg_report_items_updated_by ON public.report_items;
CREATE TRIGGER trg_report_items_updated_by
  BEFORE INSERT OR UPDATE ON public.report_items
  FOR EACH ROW EXECUTE FUNCTION public.stamp_updated_by();

-- มุมมองสำหรับตรวจสอบย้อนหลังว่าใบไหนใครลงผล
CREATE OR REPLACE VIEW public.report_audit AS
SELECT r.submission_no, r.department, r.status, r.reported_date,
       r.reporter_name        AS ชื่อที่ระบุในใบ,
       u.email                AS บัญชีที่บันทึกจริง,
       r.updated_at
FROM public.reports r
LEFT JOIN auth.users u ON u.id = r.updated_by;

SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public' AND column_name='updated_by' ORDER BY table_name;

-- ==============================================================================
-- ภาคผนวก 3 (2026-08-19) : ให้ผู้ส่งตรวจเห็น "คิวรอตรวจของหน่วยงาน" ได้
-- ------------------------------------------------------------------------------
-- policy เดิม "Public can view completed reports" ยอมให้ anon อ่านเฉพาะใบที่ออกผลแล้ว
-- หน้า "รอผล" ในแอป LINE จึงเห็นได้แค่ใบที่ตัวเองส่ง (จากสำเนาในเครื่อง)
-- มองไม่เห็นว่าหน่วยงานตัวเองมีใบค้างอยู่กี่ใบ
--
-- สิ่งที่เปิดเพิ่มคือ "ข้อมูลปฏิบัติการ" ของใบที่ยังไม่ออกผล — เลขที่ใบ หน่วยงาน
-- จุดเก็บตัวอย่าง วันที่ ไม่ใช่ผลตรวจ เพราะใบที่ยังไม่ออกผลมีค่าผลเป็น '-' ทั้งหมด
-- (การลงผลจะเปลี่ยนสถานะเป็น completed ในการบันทึกครั้งเดียวกัน)
--
-- ใบที่ออกผลแล้วพร้อมผลเต็ม anon อ่านได้อยู่ก่อนแล้วตาม policy เดิมของระบบ
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reports' AND policyname = 'liff_anon_can_view_pending_reports'
  ) THEN
    CREATE POLICY liff_anon_can_view_pending_reports
      ON public.reports FOR SELECT TO anon
      USING (status IS DISTINCT FROM 'completed');
  END IF;
END $$;

-- ต้องเป็น SECURITY DEFINER ไม่งั้น subquery จะโดน RLS ของ reports บังคับซ้ำ
-- แล้วมองไม่เห็นใบที่ยังไม่ออกผล ทำให้เงื่อนไขเป็นเท็จเสมอ (ปัญหาเดียวกับ is_liff_report)
CREATE OR REPLACE FUNCTION public.is_report_pending(rid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = rid AND r.status IS DISTINCT FROM 'completed'
  );
$$;

COMMENT ON FUNCTION public.is_report_pending(uuid) IS
  'ใช้ใน RLS ของ report_items — ให้ anon นับจำนวนรายการของใบที่ยังรอตรวจได้ (ค่าผลยังเป็น - ทั้งหมด)';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'report_items' AND policyname = 'liff_anon_can_view_pending_items'
  ) THEN
    CREATE POLICY liff_anon_can_view_pending_items
      ON public.report_items FOR SELECT TO anon
      USING (public.is_report_pending(report_id));
  END IF;
END $$;

SELECT tablename, policyname, cmd, roles FROM pg_policies
WHERE schemaname='public' AND policyname LIKE 'liff_%' ORDER BY tablename, policyname;
