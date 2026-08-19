-- ==============================================================================
-- สิทธิ์ของหน่วยงานผู้ส่งตรวจ (8 หน่วยงาน) — ทั้งเว็บแอปและ LIFF
-- วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์ -> Run
-- ==============================================================================
--
-- กติกาที่ต้องการ:
--   หน่วยงานผู้ส่งตรวจ  คีย์จอง / กรอกฟอร์ม  -> สร้าง แก้ไข ยกเลิก ของตัวเองได้
--                       หน้ารายงานผล          -> ดูอย่างเดียว
--   admin (งานจุลชีววิทยา)                    -> ทำได้ทุกอย่าง
--
-- "ยกเลิก" ใช้วิธีตั้ง status = 'cancelled' ไม่ลบแถวทิ้ง
-- เพราะใบส่งตรวจเป็นเอกสารคุณภาพตาม ISO 15189 ต้องตรวจสอบย้อนกลับได้
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. คืนค่า 'cancelled' เข้า CHECK constraint ของ reports
--    supabase_migration_fix_safe.sql ทำค่านี้หลุดไป ทั้งที่ของเดิมมี
-- ------------------------------------------------------------------------------
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports
    ADD CONSTRAINT reports_status_check CHECK (
        status IN ('draft', 'pending', 'waiting_for_testing', 'in_progress',
                   'received', 'submitted', 'tested', 'reported', 'completed',
                   'rejected', 'cancelled')
    );

-- ------------------------------------------------------------------------------
-- 2. ตัวช่วย: ใบนี้ยัง "ยังไม่ออกผล" อยู่หรือไม่
--    ใช้ SECURITY DEFINER เพื่อไม่ให้เกิด recursion เวลาเรียกจากใน policy
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_is_open(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.reports
        WHERE id = p_id
          AND status IN ('draft', 'pending', 'waiting_for_testing',
                         'in_progress', 'received', 'submitted')
    );
$$;

-- ------------------------------------------------------------------------------
-- 3. LIFF (สิทธิ์ anon) — แก้ไข/ยกเลิก "ใบที่ยังไม่ออกผล" ได้
--
--    ⚠️ ข้อจำกัดที่ต้องรู้: ผู้ใช้ LIFF ไม่ได้ล็อกอิน ฐานข้อมูลจึงแยกไม่ออกว่า
--    คำขอมาจากใคร policy นี้เปิดให้ anon แก้ใบที่ยังไม่ออกผล "ใบไหนก็ได้"
--    การจำกัดให้เห็นและแก้เฉพาะของตัวเองทำที่ฝั่งแอปด้วย line_user_id
--
--    ที่กันไว้จริงในระดับฐานข้อมูลคือ: ใบที่ออกผลแล้วแก้ไม่ได้เด็ดขาด
--    ซึ่งเป็นข้อกำหนดสำคัญที่สุด — ผลตรวจที่ออกไปแล้วห้ามเปลี่ยน
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS liff_anon_can_edit_open_report ON public.reports;
CREATE POLICY liff_anon_can_edit_open_report
  ON public.reports FOR UPDATE TO anon
  USING (status IN ('draft','pending','waiting_for_testing','in_progress','received','submitted'))
  WITH CHECK (status IN ('draft','pending','waiting_for_testing','in_progress',
                         'received','submitted','cancelled'));

DROP POLICY IF EXISTS liff_anon_can_edit_open_items ON public.report_items;
CREATE POLICY liff_anon_can_edit_open_items
  ON public.report_items FOR UPDATE TO anon
  USING (public.report_is_open(report_id))
  WITH CHECK (public.report_is_open(report_id));

DROP POLICY IF EXISTS liff_anon_can_delete_open_items ON public.report_items;
CREATE POLICY liff_anon_can_delete_open_items
  ON public.report_items FOR DELETE TO anon
  USING (public.report_is_open(report_id));

-- ------------------------------------------------------------------------------
-- 4. LIFF — แก้ไข/ยกเลิกคิวจองของตัวเองได้
--    คิวจองไม่ใช่เอกสารผลตรวจ ความเสี่ยงต่ำกว่ามาก
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS liff_anon_can_edit_booking ON public.bookings;
CREATE POLICY liff_anon_can_edit_booking
  ON public.bookings FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. ตรวจผลลัพธ์
-- ------------------------------------------------------------------------------
SELECT pg_get_constraintdef(oid) AS reports_status_check
FROM pg_constraint WHERE conname = 'reports_status_check';

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('reports','report_items','bookings')
ORDER BY tablename, cmd, policyname;
