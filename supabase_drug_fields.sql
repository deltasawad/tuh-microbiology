-- ==============================================================================
-- คอลัมน์ที่แบบฟอร์มงานผลิตยาเก็บมาแต่ไม่มีที่เก็บในฐานข้อมูล
-- วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์ -> Run
-- ==============================================================================
--
-- ที่มาของปัญหา (ตรวจกับฐานข้อมูลจริงแล้ว):
--   แบบฟอร์ม DRG-07 / DRG-08 เก็บค่า 11 ช่อง เช่น "ผลิตเมื่อวันที่" และ "ปริมาณ (ml)"
--   frontend/js/workflow.js ใส่ค่าเหล่านี้ลง payload ครบ
--   แต่ createReport() ใน frontend/js/db.js กรองด้วยรายชื่อคอลัมน์ที่อนุญาต 14 ตัว
--   ซึ่งไม่มีช่องเหล่านี้อยู่เลย ค่าจึงถูกทิ้งเงียบ ๆ ตั้งแต่ก่อนถึงฐานข้อมูล
--   และตารางจริงก็ไม่มีคอลัมน์รองรับอยู่แล้ว
--
--   ผลคือหน้ารายงานอ่านค่าไม่ได้ แล้วไปแสดงค่าที่ฝังไว้ในโค้ดแทน
--   (Lot No. 'TE-6907', ผลิตเมื่อ '20/07/2569', ปริมาณ '500')
--   ทุกใบจึงขึ้นค่าชุดเดียวกันหมดไม่ว่าจะกรอกอะไรไป
--
-- หลังรันไฟล์นี้ ต้องแก้ฝั่งหน้าเว็บด้วย (db.js เพิ่มคอลัมน์เข้ารายการที่อนุญาต
-- และ report_view.html เอาค่าที่ฝังไว้ออก) ไม่งั้นค่าก็ยังไม่ถูกบันทึกอยู่ดี
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- วันที่ต่าง ๆ ในกระบวนการผลิตและวิเคราะห์
-- ------------------------------------------------------------------------------
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS preparation_date DATE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS sample_date      DATE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS receipt_date     DATE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS analysis_date    DATE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS production_date  DATE;

-- ------------------------------------------------------------------------------
-- ข้อมูลผลิตภัณฑ์และผู้ปฏิบัติงาน
-- ------------------------------------------------------------------------------
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS lot_no                   VARCHAR(100);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS prepared_medicine        VARCHAR(255);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS prepared_medicine_header VARCHAR(255);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS operator_name            VARCHAR(255);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS sender_name              VARCHAR(255);

-- ปริมาณเป็นจำนวนจริง ไม่ใช่ข้อความ จะได้เอาไปคำนวณและตรวจสอบย้อนหลังได้
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS volume NUMERIC(12,2);

COMMENT ON COLUMN public.reports.production_date IS 'วันที่ผลิตยา (DRG-08 ผลิตเมื่อวันที่)';
COMMENT ON COLUMN public.reports.volume          IS 'ปริมาณตัวอย่างเป็นมิลลิลิตร (DRG-08)';
COMMENT ON COLUMN public.reports.lot_no          IS 'Lot number ของผลิตภัณฑ์ยา';

-- ------------------------------------------------------------------------------
-- ตรวจผลลัพธ์
-- ------------------------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reports'
  AND column_name IN ('preparation_date','sample_date','receipt_date','analysis_date',
                      'production_date','lot_no','prepared_medicine','prepared_medicine_header',
                      'operator_name','sender_name','volume')
ORDER BY column_name;
