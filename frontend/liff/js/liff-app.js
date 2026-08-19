/**
 * ==============================================================================
 * LIFF ENVIRONMENTAL ANALYSIS APP  (liff-app.js)
 * ฝั่งผู้ส่งตรวจ — ออกแบบ Mobile First สำหรับใช้ในแอป LINE
 * งานจุลชีววิทยา โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ
 * ==============================================================================
 *
 * ลำดับการทำงาน 4 ขั้น (ตรงกับ Stepper ที่ติดอยู่ด้านบนจอ)
 *   1. จองคิว      -> เลือกวันในปฏิทิน (เปิดรับเฉพาะ จันทร์–พุธ) แล้วบันทึกการจอง
 *   2. ส่งตรวจ     -> กรอกแบบฟอร์มสิ่งส่งตรวจ + รายการตัวอย่าง
 *   3. รอผล        -> ติดตามใบที่ห้องปฏิบัติการกำลังตรวจ
 *   4. ดูผล        -> เปิดใบรายงานผลที่ออกแล้ว
 *
 * ตัวตนผู้ใช้มาจาก LINE ทั้งหมด (liff.getProfile) ไม่มีการตั้งรหัสผ่านซ้ำ
 * userId ถูกบันทึกลง Supabase ทุกครั้ง เพื่อให้ push ผลกลับหาผู้ส่งได้รายบุคคล
 */

/* ============================================================================
 * ส่วนที่ 0 : สถานะกลางของแอป
 * ========================================================================== */
const App = {
  profile: null,        // { userId, displayName, pictureUrl }
  isMock: false,        // true = โหมดพัฒนา ไม่ได้อยู่ในแอป LINE จริง
  step: 1,
  calCursor: new Date(),
  selectedDate: null,   // 'YYYY-MM-DD'
  bookingsOfMonth: [],
  items: [],            // รายการตัวอย่างใน Step 2
  myReports: [],
  histMode: 'dept',     // 'mine' = เฉพาะที่ส่งด้วย LINE นี้ | 'dept' = ทั้งหน่วยงาน
  histService: null,
  queueMode: 'mine',    // โหมดของหน้า 3 'รอผล'
  queueService: null
};

/* ============================================================================
 * ส่วนที่ 1 : ตัวช่วยทั่วไป
 * ========================================================================== */
const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_MONTHS_ABBR = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const TH_DOW = ['อา','จ','อ','พ','พฤ','ศ','ส'];

/* ----------------------------------------------------------------------------
 * ลิงก์ลัดจาก Rich Menu — ?step=1..4
 * --------------------------------------------------------------------------
 * เปิดจากเบราว์เซอร์ปกติ  URL จะเป็น  .../liff?step=2  ตรงไปตรงมา
 * เปิดจากในแอป LINE      LINE จะห่อ query เดิมไว้ใน liff.state แทน เช่น
 *     https://tuh-microbiology.vercel.app/liff?liff.state=%3Fstep%3D2
 * และ SDK จะเขียน URL ทับหลัง liff.init() เสร็จ ค่าเดิมจึงหายไป
 * -> ต้องเก็บ URL ตั้งต้นไว้ตั้งแต่ไฟล์ถูกโหลด แล้วอ่านจากทั้งสองทาง
 * -------------------------------------------------------------------------- */
const INITIAL_URL = (typeof window !== 'undefined') ? window.location.href : '';

function readStepFrom(urlString) {
  let qs;
  try { qs = new URL(urlString).searchParams; } catch (e) { return null; }

  const pick = (v) => {
    const n = parseInt(v, 10);
    return (n >= 1 && n <= 4) ? n : null;
  };

  // ก) ?step=2 ตรง ๆ
  const direct = pick(qs.get('step'));
  if (direct) return direct;

  // ข) ?liff.state=%3Fstep%3D2  (LINE ห่อไว้ให้)
  const state = qs.get('liff.state');
  if (state) {
    try {
      const inner = new URLSearchParams(state.charAt(0) === '?' ? state.slice(1) : state);
      const nested = pick(inner.get('step'));
      if (nested) return nested;
    } catch (e) { /* รูปแบบไม่ตรง ข้ามไป */ }
  }
  return null;
}

/** ขั้นที่ผู้ใช้ขอมาจาก Rich Menu ถ้าไม่ได้ระบุจะได้ 1 */
function getRequestedStep() {
  return readStepFrom(window.location.href) || readStepFrom(INITIAL_URL) || 1;
}

const $ = (id) => document.getElementById(id);
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 2026-08-18 -> 18 ส.ค. 2569 (พุทธศักราช) */
function fmtThai(iso, long = false) {
  if (!iso) return '-';
  const d = new Date(iso + (String(iso).length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return String(iso);
  const m = long ? TH_MONTHS[d.getMonth()] : TH_MONTHS_ABBR[d.getMonth()];
  return `${d.getDate()} ${m} ${d.getFullYear() + 543}`;
}

/** ห้องปฏิบัติการเปิดรับเฉพาะจันทร์–พุธ (พฤหัส–อาทิตย์ งดรับสิ่งส่งตรวจ) */
function isOpenDay(date) {
  return (window.LIFF_CONFIG.openWeekdays || [1, 2, 3]).includes(date.getDay());
}

function toast(icon, title, text) {
  return Swal.fire({ icon, title, text, confirmButtonColor: '#6c5070', confirmButtonText: 'ตกลง' });
}

/**
 * ตัวย่อหน้าเลขที่เอกสารของแต่ละบริการ
 * ถอดมาจากข้อมูลจริงในระบบ ไม่ได้ตั้งขึ้นเอง — สังเกตว่างานผลิตยาแยกเป็น DR1/DR2
 * ห้ามใช้ serviceCode.split('_')[0] เพราะ DRG_07 กับ DRG_08 จะได้ 'DRG' เหมือนกันทั้งคู่
 */
const SUBMISSION_PREFIX = {
  AIR_01: 'AIR', STR_02: 'STR', WTS_03: 'WTS', WTO_04: 'WTO',
  WTM_05: 'WTM', FOD_06: 'FOD', DRG_07: 'DR1', DRG_08: 'DR2'
};

/**
 * สร้างเลขที่ใบส่งตรวจรูปแบบ PREFIX-YYYY-MM-DD-NN
 *   YYYY-MM-DD = วันเก็บตัวอย่าง
 *   NN         = เลขลำดับสะสมของบริการนั้น (ต่อจากใบล่าสุด)
 * เช่น AIR-2026-08-19-77
 *
 * หมายเหตุเรื่องสิทธิ์: ผู้ส่งตรวจใช้สิทธิ์ anon ซึ่งมองเห็นเฉพาะใบที่ออกผลแล้ว
 * เลขที่คำนวณได้จึงอาจชนกับใบที่ยังรอตรวจอยู่ -> ฝั่งบันทึกมีการลองเลขถัดไปให้อัตโนมัติ
 */
async function genSubmissionNo(serviceCode, samplingDate) {
  const prefix = SUBMISSION_PREFIX[serviceCode] || String(serviceCode).split('_')[0];
  const d = samplingDate ? new Date(samplingDate + 'T00:00:00') : new Date();
  const datePart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let next = 1;
  if (window.supabaseClient) {
    try {
      const { data } = await window.supabaseClient
        .from('reports').select('submission_no').like('submission_no', prefix + '-%').limit(1000);
      next = (data || []).reduce((max, r) => {
        const m = String(r.submission_no).match(/-(\d+)$/);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0) + 1;
    } catch (e) {
      console.warn('อ่านเลขล่าสุดไม่ได้ ใช้เลขเริ่มต้นแทน:', e && e.message);
    }
  }
  return `${prefix}-${datePart}-${String(next).padStart(2, '0')}`;
}

/** เพิ่มเลขลำดับท้ายขึ้น 1 (ใช้ตอนเลขชนกัน) */
function bumpSubmissionNo(no) {
  return String(no).replace(/-(\d+)$/, (_, n) =>
    '-' + String(parseInt(n, 10) + 1).padStart(n.length, '0'));
}

/** สร้าง UUID เองฝั่งเบราว์เซอร์ (LIFF Browser รุ่นเก่าอาจไม่มี crypto.randomUUID) */
function newUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = Math.random() * 16 | 0;
    return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * INSERT ลง Supabase โดยทนต่อกรณีที่ยังไม่ได้รัน supabase_liff_migration.sql
 * ถ้าฐานข้อมูลไม่รู้จักคอลัมน์ LINE (error 42703 / PGRST204) จะตัดคอลัมน์นั้นออกแล้วลองใหม่
 */
async function insertTolerant(table, row, opts = {}) {
  const { returning = true, extraOptionalCols = [] } = opts;
  const optional = ['line_user_id', 'line_display_name', 'source', ...extraOptionalCols];
  let payload = { ...row };

  for (let attempt = 0; attempt <= optional.length; attempt++) {
    // returning=false -> ไม่ต่อ .select()
    // เพราะ .select() จะกลายเป็น INSERT ... RETURNING ซึ่ง PostgreSQL บังคับให้แถวที่คืน
    // ต้องผ่าน policy SELECT ด้วย แต่ policy เดิมให้ anon เห็นเฉพาะ status='completed'
    // ใบ 'รอตรวจ' จึงถูกปฏิเสธด้วย error 42501 ทั้งที่ INSERT เองได้รับอนุญาตแล้ว
    const q = window.supabaseClient.from(table).insert([payload]);
    const { data, error } = returning ? await q.select().single() : await q;
    if (!error) return { data: returning ? data : { ...payload }, error: null, droppedColumns: attempt };

    const msg = String(error.message || '');
    const missing = optional.find(c => msg.includes(`'${c}'`) || msg.includes(`"${c}"`) || msg.includes(` ${c} `));
    const isUnknownColumn = error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(msg);

    if (isUnknownColumn) {
      // ตัดคอลัมน์ที่ฐานข้อมูลไม่รู้จักออก แล้วลองใหม่
      const next = { ...payload };
      if (missing) delete next[missing];
      else optional.forEach(c => delete next[c]);
      if (JSON.stringify(next) === JSON.stringify(payload)) return { data: null, error };
      payload = next;
      continue;
    }
    return { data: null, error };
  }
  return { data: null, error: { message: 'insert failed' } };
}

/* ----------------------------------------------------------------------------
 * แคชใบส่งตรวจของตัวเองไว้ในเครื่อง
 * --------------------------------------------------------------------------
 * ทำไมต้องมี: policy SELECT ของฐานข้อมูลยอมให้ anon อ่านได้เฉพาะใบที่ status='completed'
 * ใบที่เพิ่งส่งจึงอ่านกลับมาไม่ได้ หน้า "รอผล" จะว่างทันที
 *
 * ทางเลือกคือเปิดสิทธิ์ให้ anon อ่านใบรอตรวจทั้งหมด แต่นั่นแปลว่าใครก็ดึงใบส่งตรวจ
 * ของทุกหน่วยงานไปอ่านได้ จึงเก็บสำเนาไว้ในเครื่องผู้ส่งแทน พอผลออกแล้วค่อยดึงจากฐานข้อมูลจริง
 * -------------------------------------------------------------------------- */
const MY_SUBS_KEY = 'TUH_LIFF_MY_SUBMISSIONS';

function readMySubs() {
  try {
    const arr = JSON.parse(localStorage.getItem(MY_SUBS_KEY) || '[]');
    if (!Array.isArray(arr)) return [];
    // ทิ้งสำเนาที่เก่ากว่า 1 วันไปเลย ไม่ให้สะสมและไม่ให้กลายเป็นใบผี
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const fresh = arr.filter(r => new Date(r.created_at || 0).getTime() > cutoff);
    if (fresh.length !== arr.length) localStorage.setItem(MY_SUBS_KEY, JSON.stringify(fresh));
    return fresh;
  } catch (e) { return []; }
}

function rememberMySub(rec) {
  try {
    const arr = readMySubs().filter(r => r.submission_no !== rec.submission_no);
    arr.unshift(rec);
    localStorage.setItem(MY_SUBS_KEY, JSON.stringify(arr.slice(0, 60)));
  } catch (e) { console.warn('เก็บสำเนาในเครื่องไม่สำเร็จ:', e); }
}

/** ลบสำเนาที่ฐานข้อมูลมีแล้ว (ผลออกแล้ว) จะได้ไม่ซ้ำ */
function pruneMySubs(dbSubmissionNos) {
  try {
    const left = readMySubs().filter(r => !dbSubmissionNos.has(r.submission_no));
    localStorage.setItem(MY_SUBS_KEY, JSON.stringify(left));
    return left;
  } catch (e) { return readMySubs(); }
}

/* ============================================================================
 * ส่วนที่ 2 : LIFF INITIALIZATION
 * --------------------------------------------------------------------------
 * ต้องเรียก liff.init() ให้เสร็จก่อนใช้ API ตัวอื่นทั้งหมด
 * ถ้าผู้ใช้ยังไม่ได้ล็อกอิน LINE (กรณีเปิดจากเบราว์เซอร์นอกแอป) ให้ liff.login()
 * ========================================================================== */
async function initLiff() {
  const cfg = window.LIFF_CONFIG;
  const statusEl = $('boot-status');

  // ยังไม่ได้ใส่ LIFF ID -> ข้ามไปโหมดพัฒนาเลย ไม่ต้องรอ timeout
  if (!cfg.liffId || cfg.liffId === 'YOUR_LIFF_ID') {
    if (!cfg.allowMockProfile) {
      throw new Error('ยังไม่ได้ตั้งค่า LIFF ID ในไฟล์ js/liff-config.js');
    }
    console.warn('⚠️ ยังไม่ได้ใส่ LIFF ID — ทำงานในโหมดพัฒนา (Mock Profile)');
    App.profile = { ...cfg.mockProfile };
    App.isMock = true;
    return;
  }

  if (statusEl) statusEl.textContent = 'กำลังเชื่อมต่อ LINE...';

  try {
    await liff.init({ liffId: cfg.liffId });

    // ยังไม่ล็อกอิน LINE
    if (!liff.isLoggedIn()) {
      // บนเครื่องพัฒนา (localhost): ห้ามเด้งออกไปหน้าล็อกอินของ LINE
      // เพราะจะหลุดออกจาก localhost แล้วกลับมาไม่ได้ ทดสอบฟอร์มต่อไม่ได้
      // -> ใช้โปรไฟล์จำลองแทน (บนโดเมนจริง allowMockProfile = false จุดนี้จึงไม่ทำงาน)
      if (cfg.allowMockProfile) {
        console.warn('⚠️ ยังไม่ได้ล็อกอิน LINE — อยู่บนเครื่องพัฒนา จึงใช้โปรไฟล์จำลองแทนการ redirect');
        App.profile = { ...cfg.mockProfile };
        App.isMock = true;
        return;
      }
      if (statusEl) statusEl.textContent = 'กำลังพาไปเข้าสู่ระบบ LINE...';
      liff.login({ redirectUri: window.location.href });
      return new Promise(() => {}); // ค้างไว้ระหว่างรอ redirect
    }

    if (statusEl) statusEl.textContent = 'กำลังโหลดโปรไฟล์...';
    const p = await liff.getProfile();          // ต้องเปิด scope "profile" ใน LIFF
    App.profile = { userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl || '' };
    App.isMock = false;
    console.log('✅ LIFF ready:', App.profile.displayName, '| in LINE app:', liff.isInClient());
  } catch (err) {
    console.error('LIFF init error:', err);
    if (!cfg.allowMockProfile) throw err;
    console.warn('⚠️ เข้า LINE ไม่ได้ — ใช้โหมดพัฒนาแทน');
    App.profile = { ...cfg.mockProfile };
    App.isMock = true;
  }
}

/** วาดโปรไฟล์ LINE ลงหัวจอ */
function renderProfile() {
  const { displayName, pictureUrl, userId } = App.profile;
  const av = $('profile-avatar');
  if (pictureUrl) {
    av.innerHTML = `<img src="${pictureUrl}" alt="" class="w-full h-full object-cover">`;
  } else {
    av.textContent = (displayName || '?').trim().charAt(0);
  }
  $('profile-name').textContent = displayName;
  $('profile-sub').textContent = App.isMock ? 'โหมดพัฒนา (ไม่ได้อยู่ใน LINE)' : 'เข้าสู่ระบบด้วย LINE แล้ว';
  $('profile-uid').textContent = userId;
  if (App.isMock) $('mock-banner').classList.remove('hidden');
}

/* ============================================================================
 * ส่วนที่ 3 : STEPPER (แถบขั้นตอนแบบติดหนึบด้านบน)
 * ========================================================================== */
function goStep(n) {
  App.step = n;
  document.querySelectorAll('[data-panel]').forEach(el => {
    el.classList.toggle('hidden', Number(el.dataset.panel) !== n);
  });

  document.querySelectorAll('[data-step]').forEach(el => {
    const s = Number(el.dataset.step);
    const dot = el.querySelector('.step-dot');
    const lbl = el.querySelector('.step-label');
    dot.className = 'step-dot w-8 h-8 rounded-full grid place-items-center text-xs font-bold transition ' +
      (s === n ? 'bg-[#6c5070] text-white ring-4 ring-[#6c5070]/15'
        : s < n ? 'bg-emerald-500 text-white'
          : 'bg-slate-200 text-slate-500');
    dot.innerHTML = s < n ? '<i class="fas fa-check"></i>' : s;
    lbl.className = 'step-label text-[10px] mt-1 font-semibold ' + (s === n ? 'text-[#6c5070]' : 'text-slate-400');
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (n === 3) loadMyReports();
  if (n === 4) loadHistory();
}

/* ============================================================================
 * ส่วนที่ 4 : STEP 1 — ปฏิทินจองคิว
 * ========================================================================== */
async function renderCalendar() {
  const cur = App.calCursor;
  const y = cur.getFullYear(), m = cur.getMonth();
  $('cal-title').textContent = `${TH_MONTHS[m]} ${y + 543}`;

  const grid = $('cal-grid');
  grid.innerHTML = TH_DOW.map(d =>
    `<div class="text-center text-[10px] font-bold text-slate-400 py-1">${d}</div>`).join('');

  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // โหลดจำนวนคิวของเดือนนี้ เพื่อแสดงว่าวันไหนคนจองเยอะแล้ว
  App.bookingsOfMonth = await fetchMonthBookings(y, m);
  const countByDate = {};
  App.bookingsOfMonth.forEach(b => {
    const k = String(b.booking_date).slice(0, 10);
    countByDate[k] = (countByDate[k] || 0) + (b.sample_count || 1);
  });

  for (let i = 0; i < first.getDay(); i++) grid.insertAdjacentHTML('beforeend', '<div></div>');

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + (window.LIFF_CONFIG.maxAdvanceDays || 90));

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const iso = toISO(date);
    const past = date < today;
    const tooFar = date > maxDate;
    const open = isOpenDay(date) && !past && !tooFar;
    const count = countByDate[iso] || 0;
    const busy = count >= (window.LIFF_CONFIG.queueWarningThreshold || 10);
    const selected = App.selectedDate === iso;
    const isToday = iso === toISO(today);

    let cls = 'relative aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-bold transition select-none ';
    if (!open) cls += 'text-slate-300 bg-slate-50 cursor-not-allowed';
    else if (selected) cls += 'bg-[#6c5070] text-white shadow-lg scale-[1.04]';
    else if (busy) cls += 'bg-amber-50 text-amber-700 border border-amber-300 active:scale-95';
    else cls += 'bg-white text-[#342838] border border-slate-200 active:scale-95 active:bg-[#f7f2f8]';

    grid.insertAdjacentHTML('beforeend', `
      <button type="button" class="${cls}" ${open ? `onclick="pickDate('${iso}')"` : 'disabled'}>
        <span>${d}</span>
        ${isToday ? '<span class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500"></span>' : ''}
        ${count ? `<span class="text-[9px] font-semibold ${selected ? 'text-white/80' : busy ? 'text-amber-600' : 'text-[#6c5070]'}">${count}</span>` : ''}
      </button>`);
  }
}

async function fetchMonthBookings(y, m) {
  if (!window.supabaseClient) return [];
  const from = toISO(new Date(y, m, 1));
  const to = toISO(new Date(y, m + 1, 0));
  try {
    const { data, error } = await window.supabaseClient
      .from('bookings').select('booking_date, sample_count, status')
      .gte('booking_date', from).lte('booking_date', to).neq('status', 'cancelled');
    return error ? [] : (data || []);
  } catch (e) { return []; }
}

function pickDate(iso) {
  App.selectedDate = iso;
  $('bk-date-label').textContent = fmtThai(iso, true);
  $('booking-form-card').classList.remove('hidden');
  renderCalendar();
  setTimeout(() => $('booking-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function shiftMonth(delta) {
  App.calCursor = new Date(App.calCursor.getFullYear(), App.calCursor.getMonth() + delta, 1);
  renderCalendar();
}

async function submitBooking(ev) {
  ev.preventDefault();
  if (!App.selectedDate) return toast('warning', 'ยังไม่ได้เลือกวัน', 'กรุณาแตะเลือกวันที่ต้องการส่งตรวจในปฏิทิน');

  const serviceCode = $('bk-service').value;
  const svc = window.LIFF_SERVICES[serviceCode];
  const payload = {
    booking_date: App.selectedDate,
    service_code: serviceCode,
    service_name: svc.name,
    department: $('bk-dept').value.trim() || svc.dept,
    sender_name: $('bk-sender').value.trim(),
    contact_number: $('bk-contact').value.trim(),
    sample_count: parseInt($('bk-count').value, 10) || 1,
    notes: $('bk-notes').value.trim(),
    status: 'confirmed',
    // ▼ ตัวตนจาก LINE — หัวใจของการเชื่อม LIFF เข้ากับฐานข้อมูล
    line_user_id: App.profile.userId,
    line_display_name: App.profile.displayName,
    source: 'liff'
  };

  if (!payload.sender_name) return toast('warning', 'กรอกข้อมูลไม่ครบ', 'กรุณาระบุชื่อผู้ส่งตรวจ');
  if (!payload.contact_number) return toast('warning', 'กรอกข้อมูลไม่ครบ', 'กรุณาระบุเบอร์ติดต่อกลับ');

  Swal.fire({ title: 'กำลังบันทึกการจอง...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  const { data, error } = await insertTolerant('bookings', payload);
  if (error) {
    return toast('error', 'จองคิวไม่สำเร็จ', error.message);
  }

  // แจ้งเตือนเข้ากลุ่ม LINE ของห้องแล็บด้วย Flex Message
  const flex = LiffFlex.buildBookingFlex({
    ...payload,
    booking_date_th: fmtThai(App.selectedDate, true),
    link: location.origin + '/workflow.html'
  });
  const notify = await LiffFlex.sendToLabGroup(flex, `จองคิวส่งตรวจ ${svc.short} วันที่ ${fmtThai(App.selectedDate)}`);

  await Swal.fire({
    icon: 'success',
    title: 'จองคิวเรียบร้อย',
    html: `<div class="text-sm text-slate-600 leading-relaxed">
             <div class="font-bold text-[#6c5070] text-base">${fmtThai(App.selectedDate, true)}</div>
             <div class="mt-1">${svc.icon} ${svc.short} · ${payload.sample_count} ตัวอย่าง</div>
             <div class="mt-3 text-xs ${notify.mocked ? 'text-amber-600' : 'text-emerald-600'}">
               ${notify.mocked ? '⚠️ ยังไม่ได้ส่งแจ้งเตือนจริง (ดู JSON ใน console)' : '✅ แจ้งเตือนเข้ากลุ่มห้องแล็บแล้ว'}
             </div>
           </div>`,
    confirmButtonText: 'ไปกรอกแบบฟอร์มส่งตรวจ',
    confirmButtonColor: '#6c5070'
  });

  // เตรียมข้อมูล Step 2 ต่อจากการจอง ผู้ใช้จะได้ไม่ต้องกรอกซ้ำ
  $('sb-service').value = serviceCode;
  $('sb-dept').value = payload.department;
  $('sb-sampling-date').value = App.selectedDate;
  onServiceChange();
  setItemCount(payload.sample_count);
  goStep(2);
}

/* ============================================================================
 * ส่วนที่ 5 : STEP 2 — แบบฟอร์มส่งตรวจ + รายการตัวอย่าง
 * ========================================================================== */
function onServiceChange() {
  const code = $('sb-service').value;
  const svc = window.LIFF_SERVICES[code];
  $('sb-service-hint').innerHTML =
    `<span class="text-base">${svc.icon}</span> <span class="font-semibold">${svc.short}</span> · ${svc.name}`;
  $('sb-dept').placeholder = svc.dept;
  renderItems();
}

function setItemCount(n) {
  n = Math.max(1, Math.min(50, parseInt(n, 10) || 1));
  const svc = window.LIFF_SERVICES[$('sb-service').value];
  App.items = Array.from({ length: n }, (_, i) => App.items[i] || {
    location_name: '',
    sample_description: '',
    placeholderHint: `${svc.subjectLabel} ที่ ${i + 1}`
  });
  renderItems();
}

function addItem() { setItemCount(App.items.length + 1); }
function removeItem(i) {
  if (App.items.length <= 1) return;
  App.items.splice(i, 1);
  renderItems();
}

function renderItems() {
  const svc = window.LIFF_SERVICES[$('sb-service').value];
  const wrap = $('sb-items');
  $('sb-item-count').textContent = App.items.length;

  wrap.innerHTML = App.items.map((it, i) => `
    <div class="bg-white border border-slate-200 rounded-2xl p-3">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[11px] font-bold text-[#6c5070] bg-[#f7f2f8] px-2.5 py-1 rounded-full">
          ตัวอย่างที่ ${i + 1}
        </span>
        ${App.items.length > 1
          ? `<button type="button" onclick="removeItem(${i})" class="w-8 h-8 grid place-items-center rounded-full text-rose-500 active:bg-rose-50" aria-label="ลบรายการนี้">
               <i class="fas fa-trash-can text-xs"></i></button>`
          : ''}
      </div>
      <label class="block text-[11px] font-bold text-slate-600 mb-1">${svc.subjectLabel} <span class="text-rose-500">*</span></label>
      <input type="text" value="${(it.location_name || '').replace(/"/g, '&quot;')}"
             oninput="App.items[${i}].location_name = this.value"
             placeholder="เช่น ${svc.subjectLabel} ที่ ${i + 1}"
             class="w-full px-3 py-3 border border-slate-300 rounded-xl text-base mb-2 focus:ring-2 focus:ring-[#6c5070]/40 focus:border-[#6c5070] outline-none">
      <input type="text" value="${(it.sample_description || '').replace(/"/g, '&quot;')}"
             oninput="App.items[${i}].sample_description = this.value"
             placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
             class="w-full px-3 py-3 border border-slate-300 rounded-xl text-base focus:ring-2 focus:ring-[#6c5070]/40 focus:border-[#6c5070] outline-none">
    </div>`).join('');
}

async function submitSamples(ev) {
  ev.preventDefault();

  const code = $('sb-service').value;
  const svc = window.LIFF_SERVICES[code];
  const samplingDate = $('sb-sampling-date').value;
  const dept = $('sb-dept').value.trim() || svc.dept;
  const ward = $('sb-ward').value.trim();

  if (!samplingDate) return toast('warning', 'กรอกข้อมูลไม่ครบ', 'กรุณาระบุวันที่เก็บตัวอย่าง');
  if (!ward) return toast('warning', 'กรอกข้อมูลไม่ครบ', 'กรุณาระบุสถานที่/หอผู้ป่วยที่เก็บตัวอย่าง');

  const blank = App.items.findIndex(it => !String(it.location_name || '').trim());
  if (blank >= 0) return toast('warning', 'กรอกข้อมูลไม่ครบ', `กรุณาระบุ${svc.subjectLabel}ของตัวอย่างที่ ${blank + 1}`);

  let submissionNo = await genSubmissionNo(code, samplingDate);

  Swal.fire({ title: 'กำลังบันทึกใบส่งตรวจ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  const header = {
    // กำหนด id เอง จะได้ไม่ต้องอ่านค่ากลับจากฐานข้อมูล (ดูคำอธิบายใน insertTolerant)
    id: newUuid(),
    submission_no: submissionNo,
    service_code: code,
    service_name: svc.name,
    department: dept,
    ward_room: ward,
    sampler_name: App.profile.displayName,
    sampling_date: samplingDate,
    received_date: toISO(new Date()),
    // ⚠️ reporter_name เป็น NOT NULL และไม่มี DEFAULT บนฐานข้อมูลจริง
    //    ถ้าไม่ใส่ค่า ทั้งแถวจะถูกปฏิเสธ และใบ "รอตรวจ" จะไม่ไปโผล่ในหน้ารายงานผล
    reporter_name: 'รอห้องปฏิบัติการลงผล',
    approver_name: 'ทนพญ.ปราญชลี หรั่งอ่อน',
    overall_result: 'pending',
    remarks: $('sb-remarks').value.trim(),
    line_user_id: App.profile.userId,
    line_display_name: App.profile.displayName,
    source: 'liff'
  };

  // ⚠️ ตาราง reports มี CHECK constraint reports_status_check
  //    ก่อนรัน supabase_migration_fix.sql ค่า 'pending' จะถูกปฏิเสธ ต้องใช้ 'in_progress'
  //    จึงลองค่าตามสเปกก่อน แล้วค่อยถอยไปค่าที่ฐานข้อมูลรับได้
  let saved = null, lastErr = null;
  // เลขที่เอกสารเป็น UNIQUE ถ้าชนกับใบที่มีอยู่แล้ว (เช่น มีใบรอตรวจที่ anon มองไม่เห็น)
  // ให้ขยับเลขลำดับขึ้นทีละ 1 แล้วลองใหม่ สูงสุด 20 ครั้ง
  outer:
  for (let attempt = 0; attempt < 20; attempt++) {
    for (const status of ['pending', 'in_progress', 'draft']) {
      const res = await insertTolerant('reports',
        { ...header, submission_no: submissionNo, status }, { returning: false });
      if (!res.error) { saved = res.data; break outer; }
      lastErr = res.error;

      const isDup = res.error.code === '23505' || /duplicate key|already exists/i.test(res.error.message || '');
      if (isDup) { submissionNo = bumpSubmissionNo(submissionNo); continue outer; }

      const isCheck = res.error.code === '23514' || /check constraint/i.test(res.error.message || '');
      if (!isCheck) break outer;
    }
  }

  if (!saved) {
    return toast('error', 'บันทึกไม่สำเร็จ', (lastErr && lastErr.message) || 'ไม่ทราบสาเหตุ');
  }

  // บันทึกรายการตัวอย่างย่อย — ผลตรวจยังว่าง (รอ Med Tech ลงผลในหน้า admin)
  const rows = App.items.map((it, i) => ({
    report_id: saved.id,
    item_no: i + 1,
    location_name: String(it.location_name).trim(),
    sample_description: String(it.sample_description || '').trim() || `${ward} - ${String(it.location_name).trim()}`,
    bacteria_count: '-',
    fungus_count: '-',
    item_result: 'pending'
  }));

  const { error: itemErr } = await window.supabaseClient.from('report_items').insert(rows);
  if (itemErr) console.warn('report_items insert error:', itemErr);

  // จำใบนี้ไว้ในเครื่อง เพื่อให้หน้า "รอผล" แสดงได้ทันที (อ่านกลับจากฐานข้อมูลยังไม่ได้จนกว่าผลจะออก)
  rememberMySub({
    id: saved.id,
    submission_no: submissionNo,
    service_code: code,
    service_name: svc.name,
    department: dept,
    ward_room: ward,
    sampling_date: samplingDate,
    status: 'pending',
    line_user_id: App.profile.userId,
    item_count: rows.length,
    created_at: new Date().toISOString()
  });

  const flex = LiffFlex.buildSubmissionFlex({
    ...header,
    sampling_date_th: fmtThai(samplingDate, true),
    item_count: rows.length,
    link: location.origin + '/liff/admin'
  });
  const notify = await LiffFlex.sendToLabGroup(flex, `รับสิ่งส่งตรวจ ${submissionNo} (${rows.length} รายการ)`);

  await Swal.fire({
    icon: 'success',
    title: 'ส่งตรวจเรียบร้อย',
    html: `<div class="text-sm text-slate-600 leading-relaxed">
             <div class="font-mono font-bold text-[#6c5070] text-base">${submissionNo}</div>
             <div class="mt-1">${rows.length} รายการ · สถานะ <b class="text-amber-600">รอตรวจ</b></div>
             ${itemErr ? '<div class="mt-2 text-xs text-amber-600">⚠️ บันทึกรายการย่อยไม่ครบ กรุณาแจ้งห้องแล็บ</div>' : ''}
             <div class="mt-3 text-xs ${notify.mocked ? 'text-amber-600' : 'text-emerald-600'}">
               ${notify.mocked ? '⚠️ ยังไม่ได้ส่งแจ้งเตือนจริง (ดู JSON ใน console)' : '✅ แจ้งเตือนเข้ากลุ่มห้องแล็บแล้ว'}
             </div>
           </div>`,
    confirmButtonText: 'ติดตามสถานะ',
    confirmButtonColor: '#6c5070'
  });

  // ล้างฟอร์มให้พร้อมใบถัดไป
  App.items = [];
  setItemCount(1);
  $('sb-ward').value = '';
  $('sb-remarks').value = '';
  goStep(3);
}

/* ============================================================================
 * ส่วนที่ 6 : STEP 3 & 4 — ติดตามสถานะ / ดูผล
 * --------------------------------------------------------------------------
 * ดึงเฉพาะใบที่ "ส่งด้วย LINE บัญชีนี้" (line_user_id ตรงกัน)
 * ถ้ายังไม่ได้รัน migration จะไม่มีคอลัมน์นี้ ระบบจะถอยไปค้นด้วยชื่อผู้เก็บตัวอย่างแทน
 * ========================================================================== */
const WAITING = ['pending', 'waiting_for_testing', 'in_progress', 'draft', 'received', 'submitted'];
const isWaiting = (r) => WAITING.includes(String(r.status || '').toLowerCase());

function setQueueModeUI(mode) {
  const on = 'bg-[#6c5070] text-white shadow-sm';
  const off = 'bg-[#f2edf4] text-[#6c5070]';
  if (!$('q-tab-mine')) return;
  $('q-tab-mine').className = 'flex-1 text-xs font-bold py-2.5 rounded-xl transition ' + (mode === 'mine' ? on : off);
  $('q-tab-dept').className = 'flex-1 text-xs font-bold py-2.5 rounded-xl transition ' + (mode === 'dept' ? on : off);
  $('q-service-row').classList.toggle('hidden', mode !== 'dept');
}

function setQueueMode(mode) {
  App.queueMode = mode;
  try { localStorage.setItem('TUH_LIFF_QUEUE_MODE', mode); } catch (e) {}
  setQueueModeUI(mode);
  loadMyReports();
}

/**
 * หน้า 3 "รอผล" — ใบที่ยังไม่ออกผล
 *   mine = ที่ส่งด้วย LINE บัญชีนี้ (รวมสำเนาในเครื่อง เพราะบางใบยังอ่านกลับไม่ได้)
 *   dept = คิวค้างทั้งหมดของบริการที่เลือก
 */
async function loadMyReports() {
  const listPending = $('list-pending');
  if (!listPending) return;
  listPending.innerHTML = `<div class="py-10 text-center text-slate-400 text-sm">
    <i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลด...</div>`;

  const svcSel = $('q-service');
  const svc = svcSel ? svcSel.value : 'AIR_01';
  App.queueService = svc;
  try { localStorage.setItem('TUH_LIFF_QUEUE_SERVICE', svc); } catch (e) {}

  // ---------- โหมดทั้งหน่วยงาน ----------
  if (App.queueMode === 'dept') {
    let rows = [];
    try {
      const res = await window.supabaseClient
        .from('reports').select('*, report_items(*)')
        .eq('service_code', svc)
        .order('sampling_date', { ascending: false })
        .limit(80);
      rows = (res.data || []).filter(isWaiting);
    } catch (e) { console.warn('loadMyReports(dept):', e); }

    App.myReports = rows;
    $('badge-pending').textContent = rows.length;
    const name = (window.LIFF_SERVICES[svc] || {}).short || svc;
    listPending.innerHTML = rows.length
      ? rows.map(r => card(r, true)).join('')
      : empty('🎉', 'ไม่มีใบค้างของ ' + name, 'ทุกใบของบริการนี้ออกผลครบแล้ว');
    return;
  }

  // ---------- โหมดที่ฉันส่ง ----------
  let rows = [];
  try {
    let res = await window.supabaseClient
      .from('reports').select('*, report_items(*)')
      .eq('line_user_id', App.profile.userId)
      .order('created_at', { ascending: false }).limit(50);

    if (res.error) {
      res = await window.supabaseClient
        .from('reports').select('*, report_items(*)')
        .eq('sampler_name', App.profile.displayName)
        .order('created_at', { ascending: false }).limit(50);
    }
    rows = res.data || [];
  } catch (e) {
    console.warn('loadMyReports error:', e);
  }

  // รวมกับสำเนาในเครื่อง — เหลือไว้กันจังหวะที่เพิ่งบันทึกแล้วอ่านกลับไม่ทันเท่านั้น
  // ตั้งแต่เปิดให้ anon อ่านใบรอตรวจได้ ฐานข้อมูลตอบครบอยู่แล้วเกือบทุกกรณี
  //
  // ต้องจำกัดอายุด้วย ไม่งั้นใบที่ถูกลบทิ้งจากฐานข้อมูลจะค้างเป็นผีตลอดไป
  // (pruneMySubs ลบสำเนาเฉพาะตอน "เจอ" ในฐานข้อมูล ใบที่หายไปเลยจึงไม่เคยถูกลบ)
  const FRESH_MS = 10 * 60 * 1000;
  const now = Date.now();
  const dbNos = new Set(rows.map(r => r.submission_no));
  const localPending = pruneMySubs(dbNos)
    .filter(r => !App.profile.userId || !r.line_user_id || r.line_user_id === App.profile.userId)
    .filter(r => {
      const age = now - new Date(r.created_at || 0).getTime();
      return age >= 0 && age < FRESH_MS;
    })
    .map(r => ({ ...r, report_items: new Array(r.item_count || 0).fill({}), _localOnly: true }));

  App.myReports = [...rows, ...localPending];
  const pending = [...rows.filter(isWaiting), ...localPending];

  $('badge-pending').textContent = pending.length;
  listPending.innerHTML = pending.length
    ? pending.map(r => card(r, true)).join('')
    : empty('⏳', 'ยังไม่มีใบที่รอตรวจ',
        'ใบที่คุณส่งผ่าน LINE จะมาแสดงที่นี่<br>กด "ทั้งหน่วยงาน" เพื่อดูคิวค้างของหน่วยงาน');
}

/* ----------------------------------------------------------------------------
 * หน้า 4 "ดูผล" — ประวัติผลตรวจ
 * --------------------------------------------------------------------------
 * เดิมกรองด้วย line_user_id เท่านั้น จึงเห็นเฉพาะใบที่ส่งผ่าน LINE บัญชีนี้
 * ใบเก่าทั้งหมดในระบบส่งผ่านเว็บ (line_user_id เป็น NULL) หน้านี้จึงว่างเปล่าเสมอ
 *
 * เพิ่มโหมด "ทั้งหน่วยงาน" ที่ค้นด้วย service_code แทน ทำให้ย้อนดูประวัติจริงได้
 * (สิทธิ์ anon อ่านใบที่ออกผลแล้วได้อยู่แล้วตาม policy เดิมของระบบ)
 * -------------------------------------------------------------------------- */
function setHistModeUI(mode) {
  const on = 'bg-[#6c5070] text-white shadow-sm';
  const off = 'bg-[#f2edf4] text-[#6c5070]';
  if (!$('hist-tab-mine')) return;
  $('hist-tab-mine').className = 'flex-1 text-xs font-bold py-2.5 rounded-xl transition ' + (mode === 'mine' ? on : off);
  $('hist-tab-dept').className = 'flex-1 text-xs font-bold py-2.5 rounded-xl transition ' + (mode === 'dept' ? on : off);
  $('hist-service-row').classList.toggle('hidden', mode !== 'dept');
}

function setHistMode(mode) {
  App.histMode = mode;
  try { localStorage.setItem('TUH_LIFF_HIST_MODE', mode); } catch (e) {}

  const on = 'bg-[#6c5070] text-white shadow-sm';
  const off = 'bg-[#f2edf4] text-[#6c5070]';
  $('hist-tab-mine').className = 'flex-1 text-xs font-bold py-2.5 rounded-xl transition ' + (mode === 'mine' ? on : off);
  $('hist-tab-dept').className = 'flex-1 text-xs font-bold py-2.5 rounded-xl transition ' + (mode === 'dept' ? on : off);
  $('hist-service-row').classList.toggle('hidden', mode !== 'dept');
  loadHistory();
}

async function loadHistory() {
  const listDone = $('list-done');
  listDone.innerHTML = `<div class="py-10 text-center text-slate-400 text-sm">
    <i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลด...</div>`;

  // อ่านค่าจากช่องเลือกเสมอ ห้ามเขียนทับด้วยค่าที่จำไว้ตรงนี้
  // (ค่าที่จำไว้ถูกใส่ให้ตอน boot แล้ว ถ้าเขียนทับซ้ำ ผู้ใช้จะเลือกบริการอื่นไม่ได้เลย)
  const svcSel = $('hist-service');
  const svc = svcSel ? svcSel.value : 'AIR_01';
  App.histService = svc;
  try { localStorage.setItem('TUH_LIFF_HIST_SERVICE', svc); } catch (e) {}

  let rows = [];
  try {
    let q = window.supabaseClient.from('reports').select('*, report_items(*)');
    q = (App.histMode === 'mine')
      ? q.eq('line_user_id', App.profile.userId)
      : q.eq('service_code', svc);
    const res = await q.order('reported_date', { ascending: false, nullsFirst: false }).limit(80);
    rows = (res.data || []).filter(r => !isWaiting(r));
  } catch (e) {
    console.warn('loadHistory error:', e);
  }

  $('badge-done').textContent = rows.length;

  if (rows.length) {
    listDone.innerHTML = rows.map(r => card(r, false)).join('');
  } else if (App.histMode === 'mine') {
    listDone.innerHTML = empty('📄', 'ยังไม่มีผลตรวจที่คุณส่งเอง',
      'ใบที่ส่งผ่าน LINE บัญชีนี้และออกผลแล้วจะมาแสดงที่นี่<br>กด "ทั้งหน่วยงาน" เพื่อดูประวัติย้อนหลังของหน่วยงาน');
  } else {
    const name = (window.LIFF_SERVICES[svc] || {}).short || svc;
    listDone.innerHTML = empty('📄', 'ยังไม่มีผลตรวจของ ' + name, 'ลองเลือกบริการอื่น');
  }
}

function empty(icon, title, sub) {
  return `<div class="py-12 text-center">
    <div class="text-3xl mb-2">${icon}</div>
    <div class="text-sm font-bold text-slate-600">${title}</div>
    <div class="text-xs text-slate-400 mt-1 px-6">${sub}</div></div>`;
}

function card(r, waiting) {
  const svc = window.LIFF_SERVICES[r.service_code] || {};
  const items = r.report_items || [];
  const hasFail = items.some(it => String(it.item_result).toLowerCase() === 'fail');
  const badge = waiting
    ? '<span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">⏳ รอตรวจ</span>'
    : hasFail
      ? '<span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">⚠️ พบเชื้อ</span>'
      : '<span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">✅ ผ่านเกณฑ์</span>';

  return `<div class="bg-white border border-slate-200 rounded-2xl p-3.5 active:bg-slate-50 transition"
               ${!waiting ? `onclick="openReport('${r.submission_no}')"` : ''}>
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="font-mono font-bold text-sm text-[#342838] truncate">${r.submission_no}</div>
        <div class="text-[11px] text-slate-500 mt-0.5 truncate">${svc.icon || '🔬'} ${svc.short || r.service_code} · ${r.ward_room || r.department || '-'}</div>
      </div>
      ${badge}
    </div>
    <div class="flex items-center gap-4 mt-2.5 text-[11px] text-slate-500">
      <span><i class="far fa-calendar mr-1"></i>${fmtThai(r.sampling_date)}</span>
      <span><i class="fas fa-vial mr-1"></i>${items.length} รายการ</span>
      ${r._localOnly ? '<span class="text-[10px] text-slate-400"><i class="fas fa-mobile-screen mr-1"></i>บันทึกแล้ว</span>' : ''}
      ${!waiting ? '<span class="ml-auto text-[#6c5070] font-bold">ดูผล <i class="fas fa-chevron-right text-[9px]"></i></span>' : ''}
    </div>
  </div>`;
}

/**
 * เปิดใบรายงานผล
 * ถ้าอยู่ในแอป LINE ให้ใช้ liff.openWindow เพื่อเปิดเบราว์เซอร์ภายนอก
 * (หน้า report_view.html บังคับล็อกอินเจ้าหน้าที่ จึงต้องเปิดนอก LIFF)
 */
function openReport(submissionNo) {
  const url = `${location.origin}/report_view.html?id=${encodeURIComponent(submissionNo)}`;
  if (!App.isMock && typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) {
    liff.openWindow({ url, external: true });
  } else {
    window.open(url, '_blank');
  }
}

/** ปิดหน้าต่าง LIFF (ปุ่มมุมขวาบน) */
function closeLiff() {
  if (!App.isMock && typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) liff.closeWindow();
  else toast('info', 'โหมดพัฒนา', 'ปุ่มนี้จะปิดหน้าต่างเมื่อเปิดจากในแอป LINE เท่านั้น');
}

/* ============================================================================
 * ส่วนที่ 7 : BOOTSTRAP
 * ========================================================================== */
async function boot() {
  try {
    await initLiff();
  } catch (err) {
    $('boot').innerHTML = `<div class="text-center px-8">
      <div class="text-4xl mb-3">⚠️</div>
      <div class="font-bold text-slate-700">เชื่อมต่อ LINE ไม่สำเร็จ</div>
      <div class="text-xs text-slate-500 mt-2 leading-relaxed">${err.message}</div>
      <div class="text-[11px] text-slate-400 mt-4">ตรวจสอบ LIFF ID ในไฟล์ js/liff-config.js</div></div>`;
    return;
  }

  if (!window.supabaseClient) {
    console.warn('⚠️ ยังไม่ได้ตั้งค่า Supabase — ดู frontend/js/supabase-config.js');
  }

  renderProfile();

  // ตั้งค่าเริ่มต้นให้ฟอร์ม: เติมชื่อจาก LINE ให้อัตโนมัติ (ผู้ใช้แก้ได้)
  $('bk-sender').value = App.profile.displayName;
  $('sb-sampling-date').value = toISO(new Date());
  onServiceChange();
  setItemCount(1);
  // จำโหมดและบริการที่เลือกไว้ครั้งก่อน
  try {
    App.histMode = localStorage.getItem('TUH_LIFF_HIST_MODE') || 'dept';
    App.histService = localStorage.getItem('TUH_LIFF_HIST_SERVICE') || null;
  } catch (e) {}
  if ($('hist-service') && App.histService) $('hist-service').value = App.histService;
  setHistModeUI(App.histMode);

  try {
    App.queueMode = localStorage.getItem('TUH_LIFF_QUEUE_MODE') || 'mine';
    App.queueService = localStorage.getItem('TUH_LIFF_QUEUE_SERVICE') || null;
  } catch (e) {}
  if ($('q-service') && App.queueService) $('q-service').value = App.queueService;
  setQueueModeUI(App.queueMode);

  await renderCalendar();

  $('boot').classList.add('hidden');
  $('app').classList.remove('hidden');

  // เปิดหน้าตามปุ่มที่กดมาจาก Rich Menu (ถ้าไม่ได้ระบุ จะเป็นขั้น 1 เหมือนเดิม)
  const startStep = getRequestedStep();
  if (startStep !== 1) console.log('เปิดจากลิงก์ลัด -> ขั้นที่', startStep);
  goStep(startStep);
}

document.addEventListener('DOMContentLoaded', boot);

// เปิดให้ inline handler ใน HTML เรียกใช้ได้
Object.assign(window, {
  getRequestedStep, readStepFrom,
  App, goStep, shiftMonth, pickDate, submitBooking, onServiceChange,
  setItemCount, addItem, removeItem, submitSamples, openReport, closeLiff, loadMyReports,
  loadHistory, setHistMode, setHistModeUI,
  setQueueMode, setQueueModeUI
});
