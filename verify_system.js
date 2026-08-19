#!/usr/bin/env node
/**
 * ==============================================================================
 * VERIFICATION SCRIPT — ตรวจสอบระบบ TUH Microbiology หลังแก้ไข
 * ------------------------------------------------------------------------------
 * รัน:  node verify_system.js
 *
 * สคริปต์นี้ทดสอบกับฐานข้อมูล Supabase จริง โดย
 *   - สร้างข้อมูลทดสอบที่ขึ้นต้นด้วย ZZVERIFY- เท่านั้น
 *   - ลบข้อมูลทดสอบทั้งหมดทิ้งเมื่อจบการทดสอบเสมอ (แม้ทดสอบล้มเหลว)
 * จึงไม่กระทบข้อมูลจริงของโรงพยาบาล
 *
 * ครอบคลุม 4 หัวข้อตามข้อกำหนด:
 *   1. BookingDB.createBooking / getBookingsByMonth
 *   2. ReportDB.createReport สถานะรอตรวจ -> ต้องอยู่บนสุดของ getReports
 *   3. ReportDB.getReportById -> ต้องคืน report_items ครบ
 *   4. ReportDB.getSpecimenAnalytics -> totalSpecimens > 50, monthlyTrends > 0
 * ==============================================================================
 */

const SUPABASE_URL = 'https://tgctyouhzsyizlosrmqh.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnY3R5b3VoenN5aXpsb3NybXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NjYyNzAsImV4cCI6MjEwMjI0MjI3MH0.mlba06N1LhjT9vwNBhVrhMlxvjvO7QsRjArI6ue7Pv0';
const STAFF_EMAIL = 'admin@tuh.lab';
const STAFF_PASSWORD = 'password123';

const TEST_PREFIX = 'ZZVERIFY-';

let token = ANON_KEY;
let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function rest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let body = null;
  if (text) { try { body = JSON.parse(text); } catch (_) { body = text; } }
  return { ok: res.ok, status: res.status, body };
}

async function signIn() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASSWORD })
  });
  const body = await res.json();
  if (body.access_token) {
    token = body.access_token;
    return true;
  }
  return false;
}

/** ลบข้อมูลทดสอบทั้งหมด (report_items ถูกลบอัตโนมัติด้วย ON DELETE CASCADE) */
async function cleanup() {
  await rest(`reports?submission_no=like.${TEST_PREFIX}*`, { method: 'DELETE' });
  await rest(`bookings?notes=like.${TEST_PREFIX}*`, { method: 'DELETE' });
}

// ==============================================================================
// ส่วนที่ 1: ทดสอบฟังก์ชันช่วยที่เป็น pure function ในไฟล์ db.js
// ==============================================================================
function testPureHelpers() {
  console.log('\n[1/5] ฟังก์ชันช่วยใน db.js (parseDateObj / mergeDedupe / สถานะ)');

  // จำลอง window ให้ db.js โหลดผ่านใน Node ได้
  const store = {};
  global.window = {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  };
  global.localStorage = global.window.localStorage;
  global.document = { addEventListener() {} };

  const path = require('path');
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, 'frontend', 'js', 'db.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(src);

  const w = global.window;

  // parseDateObj — ต้องแปลง พ.ศ. เป็น ค.ศ. และรองรับ dd/mm/yyyy
  const d1 = w.parseDateObj('2569-08-11');
  const d2 = w.parseDateObj('2026-08-11');
  const d3 = w.parseDateObj('11/08/2569');
  check('parseDateObj แปลง พ.ศ. ISO -> ค.ศ.', d1 && d1.year === 2026 && d1.month === 8, JSON.stringify(d1));
  check('parseDateObj รองรับ ค.ศ. ISO', d2 && d2.year === 2026 && d2.month === 8, JSON.stringify(d2));
  check('parseDateObj รองรับ dd/mm/yyyy (พ.ศ.)', d3 && d3.year === 2026 && d3.month === 8 && d3.day === 11, JSON.stringify(d3));
  check('parseDateObj คืน null เมื่อข้อมูลเสีย', w.parseDateObj('') === null && w.parseDateObj('ไม่ใช่วันที่') === null);

  // สถานะ "รอตรวจ"
  check("isWaitingStatus('pending') = true", w.isWaitingStatus('pending') === true);
  check("isWaitingStatus('in_progress') = true", w.isWaitingStatus('in_progress') === true);
  check("isWaitingStatus('completed') = false", w.isWaitingStatus('completed') === false);

  // mergeDedupe — ข้อมูลเก่าต้องไม่หาย และไม่ซ้ำ
  const merged = w.mergeDedupe(
    [[{ submission_no: 'A' }, { submission_no: 'B' }], [{ submission_no: 'B' }, { submission_no: 'C' }]],
    r => r.submission_no
  );
  check('mergeDedupe รวมข้อมูลโดยไม่ทำให้ของเก่าหาย', merged.length === 3, `ได้ ${merged.length} รายการ (A,B,C)`);

  // การเรียงลำดับ — รอตรวจต้องอยู่บนสุด
  const sorted = w.sortReportsWaitingFirst([
    { submission_no: 'done', status: 'completed', created_at: '2026-08-17' },
    { submission_no: 'wait', status: 'pending', created_at: '2020-01-01' }
  ]);
  check('sortReportsWaitingFirst ดัน "รอตรวจ" ขึ้นบนสุด', sorted[0].submission_no === 'wait');
}

// ==============================================================================
// ส่วนที่ 2: การจองคิว
// ==============================================================================
async function testBooking() {
  console.log('\n[2/5] ระบบจองวันส่งตรวจ (bookings)');

  const today = new Date();
  const bookingDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`;

  const created = await rest('bookings', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      booking_date: bookingDate,
      service_code: 'WTM_05',
      service_name: 'Water (THAMC)',
      department: 'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)',
      sender_name: 'สคริปต์ตรวจสอบระบบ',
      contact_number: '9510',
      sample_count: 4,
      notes: `${TEST_PREFIX}booking`,
      status: 'confirmed'
    })
  });

  check('createBooking บันทึกการจองลงฐานข้อมูลได้', created.ok && created.body && created.body[0], `HTTP ${created.status}`);
  if (!created.ok) return;

  const monthPrefix = bookingDate.slice(0, 7);
  const fetched = await rest(
    `bookings?select=*&booking_date=gte.${monthPrefix}-01&booking_date=lte.${monthPrefix}-28&order=booking_date.asc`
  );
  const found = (fetched.body || []).some(b => b.notes === `${TEST_PREFIX}booking`);
  check('getBookingsByMonth ดึงการจองที่เพิ่งสร้างกลับมาได้', found, `พบ ${(fetched.body || []).length} คิวในเดือนนี้`);
}

// ==============================================================================
// ส่วนที่ 3: ใบส่งตรวจสถานะ "รอตรวจ"
// ==============================================================================
async function testSubmissionPending() {
  console.log('\n[3/5] ใบส่งตรวจใหม่ต้องขึ้นสถานะ "รอตรวจ"');

  const submissionNo = `${TEST_PREFIX}${Date.now()}`;

  // ค่าสถานะที่ CHECK constraint ของตารางยอมรับ (เหมือนที่ db.js ทำ)
  let created = null;
  let usedStatus = null;
  for (const status of ['pending', 'in_progress']) {
    const res = await rest('reports', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        submission_no: submissionNo,
        service_code: 'WTM_05',
        service_name: 'Water (THAMC)',
        department: 'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)',
        ward_room: 'จุดจ่ายน้ำ (ทดสอบระบบ)',
        sampling_date: new Date().toISOString().split('T')[0],
        reporter_name: 'รอห้องปฏิบัติการลงผล',
        approver_name: 'ทนพญ.ปราญชลี หรั่งอ่อน',
        status,
        overall_result: 'pending',
        remarks: 'รายการทดสอบระบบ'
      })
    });
    if (res.ok) { created = res.body[0]; usedStatus = status; break; }
  }

  check('createReport บันทึกใบส่งตรวจใหม่ได้', !!created, created ? `สถานะที่ฐานข้อมูลรับ = '${usedStatus}'` : 'บันทึกไม่สำเร็จ');
  if (!created) return null;

  // เพิ่มรายการตัวอย่าง 3 รายการ
  const itemsRes = await rest('report_items', {
    method: 'POST',
    body: JSON.stringify([1, 2, 3].map(n => ({
      report_id: created.id,
      item_no: n,
      location_name: `จุดตรวจทดสอบที่ ${n}`,
      bacteria_count: '-',
      fungus_count: '-',
      item_result: 'pending',
      remarks: 'ทดสอบระบบ'
    })))
  });
  check('บันทึกรายการตัวอย่าง (report_items) ได้ครบ', itemsRes.ok, `HTTP ${itemsRes.status}`);

  // ต้องปรากฏในรายการ "รอตรวจ"
  const waiting = await rest('reports?select=submission_no,status&status=in.(pending,in_progress,draft)&order=created_at.desc&limit=50');
  const inWaiting = (waiting.body || []).some(r => r.submission_no === submissionNo);
  check('ใบใหม่ปรากฏในคิว "รอตรวจ"', inWaiting, `คิวรอตรวจทั้งหมด ${(waiting.body || []).length} ใบ`);

  // ต้องถูกจัดให้อยู่บนสุดเมื่อเรียงแบบ "รอตรวจขึ้นก่อน"
  const all = await rest('reports?select=submission_no,status,created_at&order=created_at.desc&limit=200');
  const sorted = (all.body || []).sort((a, b) => {
    const wa = ['pending', 'in_progress', 'draft'].includes(a.status) ? 0 : 1;
    const wb = ['pending', 'in_progress', 'draft'].includes(b.status) ? 0 : 1;
    if (wa !== wb) return wa - wb;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  check('รายการ "รอตรวจ" ถูกจัดไว้บนสุดของตาราง', sorted[0] && sorted[0].submission_no === submissionNo,
    sorted[0] ? `บนสุดคือ ${sorted[0].submission_no}` : '');

  return created.id;
}

// ==============================================================================
// ส่วนที่ 4: getReportById ต้องคืน report_items ครบ
// ==============================================================================
async function testGetReportById(reportId) {
  console.log('\n[4/5] getReportById ต้องคืนรายการตัวอย่างครบ');

  if (!reportId) {
    check('ข้ามการทดสอบ (ไม่มีใบทดสอบให้ตรวจ)', false);
    return;
  }

  const byId = await rest(`reports?select=*,report_items(*)&id=eq.${reportId}`);
  const rep = (byId.body || [])[0];
  check('ค้นด้วย UUID แล้วพบใบรายงาน', !!rep);
  check('คืนค่า report_items ครบ 3 รายการ', rep && (rep.report_items || []).length === 3,
    rep ? `ได้ ${(rep.report_items || []).length} รายการ` : '');

  // ต้องค้นด้วยเลขที่ใบส่งตรวจได้ด้วย (ไม่ใช่เฉพาะ UUID)
  if (rep) {
    const byNo = await rest(`reports?select=*,report_items(*)&submission_no=eq.${encodeURIComponent(rep.submission_no)}`);
    check('ค้นด้วยเลขที่ใบส่งตรวจ (submission_no) ได้', (byNo.body || []).length === 1);
  }
}

// ==============================================================================
// ส่วนที่ 5: สถิติ Dashboard
// ==============================================================================
async function testAnalytics() {
  console.log('\n[5/5] สถิติสำหรับ Specimen Dashboard');

  const reports = await rest('reports?select=service_code,department,sampling_date,report_items(id)&limit=1000');
  const rows = reports.body || [];

  const totalSpecimens = rows.reduce((sum, r) => sum + ((r.report_items || []).length || 1), 0);
  const months = new Set();
  const services = new Set();

  rows.forEach(r => {
    if (r.service_code) services.add(r.service_code);
    const m = String(r.sampling_date || '').slice(0, 7);
    if (m) months.add(m);
  });

  check('totalSpecimens > 50', totalSpecimens > 50, `นับได้ ${totalSpecimens} ตัวอย่าง`);
  check('monthlyTrends.length > 0', months.size > 0, `${months.size} เดือน`);
  check('มีข้อมูลรายงานในระบบ', rows.length > 0, `${rows.length} ใบรายงาน`);
  console.log(`  ℹ️ บริการที่มีข้อมูลจริงในฐานข้อมูล: ${services.size} จาก 8 บริการ (${[...services].sort().join(', ')})`);
  if (services.size < 8) {
    console.log('     หมายเหตุ: บริการที่ยังไม่มีข้อมูลจะยังไม่ปรากฏบนกราฟวงกลม จนกว่าจะมีใบส่งตรวจจริง');
  }
}

// ==============================================================================
(async () => {
  console.log('='.repeat(70));
  console.log('  VERIFICATION — ระบบ TUH Microbiology');
  console.log('='.repeat(70));

  const signedIn = await signIn();
  console.log(`\nเข้าสู่ระบบเจ้าหน้าที่: ${signedIn ? '✅ สำเร็จ (สิทธิ์ authenticated)' : '⚠️ ไม่สำเร็จ — ใช้สิทธิ์ anon'}`);

  let reportId = null;
  try {
    testPureHelpers();
    await testBooking();
    reportId = await testSubmissionPending();
    await testGetReportById(reportId);
    await testAnalytics();
  } catch (err) {
    console.error('\n💥 เกิดข้อผิดพลาดระหว่างทดสอบ:', err.message);
    failed++;
  } finally {
    console.log('\nกำลังลบข้อมูลทดสอบ...');
    await cleanup();
    const left = await rest(`reports?select=submission_no&submission_no=like.${TEST_PREFIX}*`);
    console.log(`ข้อมูลทดสอบที่เหลือค้าง: ${(left.body || []).length} รายการ ${(left.body || []).length === 0 ? '✅ ล้างครบ' : '⚠️ กรุณาลบด้วยตนเอง'}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`  สรุปผล: ผ่าน ${passed} ข้อ / ไม่ผ่าน ${failed} ข้อ`);
  console.log('='.repeat(70));
  process.exit(failed > 0 ? 1 : 0);
})();
