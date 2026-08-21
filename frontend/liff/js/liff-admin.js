/**
 * ==============================================================================
 * MED TECH / ADMIN DATA GRID  (liff-admin.js)
 * ฝั่งนักเทคนิคการแพทย์ — ออกแบบสำหรับ "จอกว้าง" เพื่อพิมพ์ผลได้เร็วที่สุด
 * ==============================================================================
 *
 * ทำไมหน้านี้ไม่ได้อยู่ใน LIFF:
 *   LIFF ทำงานในเบราว์เซอร์ของแอป LINE บนมือถือ ซึ่งพิมพ์ตัวเลขจำนวนมากไม่ไหว
 *   งานลงผลเป็นการคีย์ข้อมูลต่อเนื่องหลายสิบแถว จึงแยกมาเป็นเว็บบนคอมพิวเตอร์
 *   และบังคับล็อกอินด้วยบัญชีเจ้าหน้าที่ (auth.js) ก่อนเข้าถึงข้อมูลได้
 *
 * จุดที่ทำให้คีย์เร็ว:
 *   • Enter / ลูกศรลง  = ลงแถวถัดไปในคอลัมน์เดิม (ไม่ต้องละมือไปจับเมาส์)
 *   • ลูกศรขึ้น        = ขึ้นแถวก่อนหน้า
 *   • Tab             = ข้ามไปคอลัมน์ถัดไปตามปกติ
 *   • ปุ่ม "ผ่านทั้งหมด" = เติมค่าปกติให้ทุกแถวในคลิกเดียว แล้วค่อยแก้เฉพาะแถวที่ผิดปกติ
 */

const Admin = {
  user: null,
  isAdmin: false,   // ผู้ดูแลระบบเท่านั้นที่ เพิ่ม/แก้/ลบ ใบส่งตรวจได้
  queueAll: [],     // ใบทั้งหมดที่ดึงมาตามตัวกรอง (ก่อนกรองด้วยคำค้น)
  queue: [],        // ใบที่แสดงอยู่จริงในคิว
  queueFilter: 'waiting',   // waiting | done | all
  active: null,     // ใบที่กำลังลงผล (พร้อม report_items)
  schema: []        // คอลัมน์ผลตรวจของบริการนั้น
};

/* เลขที่เอกสารรูปแบบเดียวกับฝั่งผู้ส่งตรวจ (liff-app.js) — ต้องตรงกัน ไม่งั้นเลขจะชนกัน */
const ADMIN_PREFIX = {
  AIR_01: 'AIR', STR_02: 'STR', WTS_03: 'WTS', WTO_04: 'WTO',
  WTM_05: 'WTM', FOD_06: 'FOD', DRG_07: 'DR1', DRG_08: 'DR2'
};

const $a = (id) => document.getElementById(id);

const WAITING_STATUSES = ['pending', 'waiting_for_testing', 'in_progress', 'draft', 'received', 'submitted'];
const isWaitingStatus = (s) => WAITING_STATUSES.includes(String(s || '').toLowerCase());

const TH_MONTHS_A = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function fmtThaiShort(iso) {
  if (!iso) return '-';
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  return isNaN(d) ? String(iso) : `${d.getDate()} ${TH_MONTHS_A[d.getMonth()]} ${d.getFullYear() + 543}`;
}
const todayISO = () => new Date().toISOString().slice(0, 10);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* ============================================================================
 * 1) ประตูล็อกอิน — ต้องเป็นเจ้าหน้าที่เท่านั้น
 * ========================================================================== */
async function bootAdmin() {
  Admin.user = window.AuthManager ? await window.AuthManager.getCurrentUser() : null;

  if (!Admin.user) {
    $a('gate').classList.remove('hidden');
    $a('gate-link').href = '/login.html?redirect=' + encodeURIComponent(location.href);
    return;
  }

  $a('who-name').textContent = Admin.user.displayName || Admin.user.username;
  $a('who-role').textContent = Admin.user.roleTitle || Admin.user.role || '';
  $a('app').classList.remove('hidden');

  // ------------------------------------------------------------------------
  // สองบทบาทเท่านั้น:
  //   admin (งานจุลชีววิทยา) -> ลงผล + เพิ่ม/แก้ไข/ลบ
  //   department_staff (8 หน่วยงานผู้ส่งตรวจ) -> ดูอย่างเดียว
  // หน่วยงานผู้ส่งตรวจเป็นผู้ "ส่ง" ตัวอย่าง ไม่ใช่ผู้ตรวจ จึงไม่ควรแก้ผลของตัวเองได้
  // ฐานข้อมูลยังอนุญาตให้ authenticated เขียนได้อยู่ ด่านนี้จึงเป็นการกันที่หน้าจอ
  // (ถ้าต้องการกันระดับฐานข้อมูลด้วย ต้องเพิ่ม RLS ที่อิงบทบาทในตาราง)
  // ------------------------------------------------------------------------
  Admin.isAdmin = String(Admin.user.role || '') === 'admin';

  if (Admin.isAdmin) {
    $a('btn-new').classList.remove('hidden');
  } else {
    $a('readonly-bar').classList.remove('hidden');
    ['btn-fill-pass', 'save-bar'].forEach(id => {
      const el = $a(id);
      if (el) el.classList.add('hidden');
    });
  }

  setQueueFilterUI(Admin.queueFilter);
  await checkWriteAccess();
  await loadQueue();
}

/**
 * ตรวจว่ามีสิทธิ์ "เขียน" จริงหรือไม่
 * ------------------------------------------------------------------------------
 * AuthManager.signIn ทำงาน 2 ชั้นแยกกัน: เก็บโปรไฟล์ลง localStorage (ชั้นหน้าจอ)
 * แล้วค่อยล็อกอิน Supabase ในพื้นหลัง (ชั้นสิทธิ์ฐานข้อมูล)
 * ถ้าชั้นหลังล้มเหลว หน้าจอจะยังโชว์ว่าล็อกอินแล้ว แต่ฐานข้อมูลเห็นเป็นสิทธิ์ anon
 *
 * ที่ร้ายคือ PostgreSQL ไม่ตอบ error เมื่อ RLS ปฏิเสธ UPDATE — มันตอบ 204 แล้วแก้ 0 แถว
 * จึงต้องดักตั้งแต่เปิดหน้า ไม่ใช่ปล่อยให้เจ้าหน้าที่คีย์ผลจนเสร็จแล้วค่อยพัง
 */
async function getSupabaseSession() {
  try {
    const res = await window.supabaseClient.auth.getSession();
    return res && res.data ? res.data.session : null;
  } catch (e) {
    return null;
  }
}

async function checkWriteAccess(opts = {}) {
  const { autoRepair = true } = opts;
  let session = await getSupabaseSession();

  // ---------------------------------------------------------------------------
  // ต่อ session ให้เองอัตโนมัติ
  // ---------------------------------------------------------------------------
  // session ฝั่ง Supabase ถูกสร้างที่เดียวคือตอน AuthManager.signIn()
  // จึงหลุดได้ง่ายมากใน 2 กรณีที่เกิดจริงประจำ:
  //   1) เปิดหน้าใหม่ทั้งที่ localStorage ยังจำว่าล็อกอินอยู่ -> signIn ไม่ถูกเรียกอีก
  //   2) เปิดหน้าค้างไว้ทั้งวัน -> access token หมดอายุ
  // ทั้งสองกรณีหน้าจอยังบอกว่าล็อกอินอยู่ แต่ฐานข้อมูลมองเป็น anon จึงเขียนไม่ได้
  // และ PostgreSQL ไม่ตอบ error — ตอบ 204 แล้วแก้ 0 แถว
  // ฉะนั้นแทนที่จะขึ้นแถบแดงให้ผู้ใช้ไปกดเอง ให้ลองต่อ session เงียบ ๆ ก่อน
  if (!session && autoRepair && Admin.user && window.AuthManager && window.AuthManager.refreshWriteSession) {
    console.info('ไม่พบ session ของ Supabase — กำลังต่อสิทธิ์เขียนอัตโนมัติ');
    try {
      await window.AuthManager.refreshWriteSession();
      session = await getSupabaseSession();
    } catch (e) {
      console.warn('ต่อสิทธิ์เขียนอัตโนมัติไม่สำเร็จ:', e && e.message);
    }
  }

  Admin.canWrite = !!session;
  // บัญชีที่ดูอย่างเดียวไม่ต้องเห็นแถบแดง "บันทึกผลไม่ได้" — ไม่ใช่ความผิดปกติสำหรับเขา
  const warn = $a('write-warning');
  if (warn) warn.classList.toggle('hidden', Admin.canWrite || !Admin.isAdmin);
  if (!Admin.canWrite && Admin.isAdmin) console.warn('ยังไม่มีสิทธิ์เขียน — ลงผลไม่ได้');
  return Admin.canWrite;
}

/** ปุ่ม "ลองเชื่อมต่อใหม่" บนแถบเตือน */
async function retryWriteAuth() {
  Swal.fire({ title: 'กำลังเชื่อมต่อใหม่...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  try {
    if (window.AuthManager && window.AuthManager.refreshWriteSession) {
      await window.AuthManager.refreshWriteSession();
    }
  } catch (e) { /* ไปเช็คผลด้านล่าง */ }

  const ok = await checkWriteAccess({ autoRepair: false });
  Swal.fire({
    icon: ok ? 'success' : 'error',
    title: ok ? 'เชื่อมต่อสำเร็จ บันทึกผลได้แล้ว' : 'ยังเชื่อมต่อไม่ได้',
    text: ok ? '' : 'กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่อีกครั้ง',
    timer: ok ? 1600 : undefined,
    showConfirmButton: !ok,
    confirmButtonColor: '#6c5070'
  });
}

async function doLogout() {
  if (window.AuthManager) await window.AuthManager.signOut();
  location.href = '/login.html';
}

/* ============================================================================
 * 2) คิวใบที่รอลงผล
 * --------------------------------------------------------------------------
 * admin เห็นทุกหน่วยงาน / เจ้าหน้าที่หน่วยงานเห็นเฉพาะของตนเอง
 * ========================================================================== */
function setQueueFilterUI(mode) {
  const on = 'bg-[#6c5070] text-white';
  const off = 'bg-[#f2edf4] text-[#6c5070] hover:bg-[#e9e0ed]';
  [['qf-waiting', 'waiting'], ['qf-done', 'done'], ['qf-all', 'all']].forEach(([id, m]) => {
    const el = $a(id);
    if (el) el.className = 'flex-1 text-[11px] font-bold py-1.5 rounded-lg transition ' + (mode === m ? on : off);
  });
}

function setQueueFilter(mode) {
  Admin.queueFilter = mode;
  setQueueFilterUI(mode);
  loadQueue();
}

/**
 * ดึงใบส่งตรวจตามตัวกรอง
 * เดิมดึงมาแล้วคัดเหลือเฉพาะใบที่ยังรอลงผล ทำให้เปิดใบที่ออกผลแล้วไม่ได้เลย
 * ตอนนี้เลือกได้ 3 แบบ และค้นด้วยข้อความได้
 */
async function loadQueue() {
  const list = $a('queue-list');
  list.innerHTML = `<div class="p-6 text-center text-slate-400 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลดคิว...</div>`;

  let q = window.supabaseClient
    .from('reports')
    .select('*, report_items(count)')
    .order('created_at', { ascending: false })
    .limit(300);

  if (Admin.user.role !== 'admin' && Admin.user.department) {
    q = q.eq('department', Admin.user.department);
  }

  const { data, error } = await q;
  if (error) {
    list.innerHTML = `<div class="p-6 text-center text-rose-600 text-sm">โหลดคิวไม่สำเร็จ: ${esc(error.message)}</div>`;
    return;
  }

  const rows = data || [];
  Admin.queueAll = Admin.queueFilter === 'all' ? rows
    : Admin.queueFilter === 'done' ? rows.filter(r => !isWaitingStatus(r.status))
    : rows.filter(r => isWaitingStatus(r.status));

  renderQueue();
}

/** กรองด้วยคำค้นแล้ววาดรายการ (แยกจาก loadQueue เพื่อไม่ต้องยิงฐานข้อมูลทุกตัวอักษร) */
function renderQueue() {
  const list = $a('queue-list');
  const term = ($a('queue-search') ? $a('queue-search').value : '').trim().toLowerCase();

  Admin.queue = !term ? Admin.queueAll : Admin.queueAll.filter(r =>
    [r.submission_no, r.department, r.ward_room, r.service_code, r.sampler_name]
      .some(v => String(v || '').toLowerCase().includes(term)));

  $a('queue-count').textContent = Admin.queue.length;

  if (!Admin.queue.length) {
    const msg = term ? 'ไม่พบใบที่ตรงกับคำค้น'
      : Admin.queueFilter === 'done' ? 'ยังไม่มีใบที่ออกผลแล้ว' : 'ไม่มีใบค้างรอลงผล';
    list.innerHTML = `<div class="p-8 text-center">
      <div class="text-3xl mb-2">${term ? '🔍' : '🎉'}</div>
      <div class="text-sm font-bold text-slate-600">${msg}</div>
      <div class="text-xs text-slate-400 mt-1">ใบส่งตรวจใหม่จากผู้ใช้ LINE จะมาแสดงที่นี่</div></div>`;
    return;
  }

  list.innerHTML = Admin.queue.map(r => {
    const svc = (window.LIFF_SERVICES || {})[r.service_code] || {};
    const n = (r.report_items && r.report_items[0] && r.report_items[0].count) || 0;
    const fromLine = r.source === 'liff' || r.line_user_id;
    const waiting = isWaitingStatus(r.status);
    return `<button type="button" onclick="openSubmission('${r.id}')" data-qid="${r.id}"
      class="queue-row w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-[#f7f2f8] transition">
      <div class="flex items-center justify-between gap-2">
        <span class="font-mono font-bold text-sm text-[#342838]">${esc(r.submission_no)}</span>
        <span class="flex items-center gap-1">
          ${fromLine ? '<span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"><i class="fab fa-line"></i></span>' : ''}
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${waiting
            ? 'text-amber-700 bg-amber-50 border-amber-200'
            : 'text-slate-600 bg-slate-100 border-slate-200'}">${waiting ? 'รอลงผล' : 'ออกผลแล้ว'}</span>
        </span>
      </div>
      <div class="text-[11px] text-slate-500 mt-1 truncate">${svc.icon || '🔬'} ${esc(svc.short || r.service_code)} · ${esc(r.ward_room || r.department || '-')}</div>
      <div class="text-[10px] text-slate-400 mt-1">${fmtThaiShort(r.sampling_date)} · ${n} รายการ</div>
    </button>`;
  }).join('');
}

/* ============================================================================
 * 3) Data Grid — ตารางลงผล
 * ========================================================================== */
async function openSubmission(reportId) {
  document.querySelectorAll('.queue-row').forEach(el => {
    el.classList.toggle('bg-[#f0e8f2]', el.dataset.qid === reportId);
  });

  $a('grid-empty').classList.add('hidden');
  $a('grid-wrap').classList.remove('hidden');
  $a('grid-tbody').innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลด...</td></tr>`;

  const { data, error } = await window.supabaseClient
    .from('reports').select('*, report_items(*)').eq('id', reportId).single();

  if (error || !data) {
    $a('grid-tbody').innerHTML = `<tr><td colspan="9" class="p-8 text-center text-rose-600">โหลดใบส่งตรวจไม่สำเร็จ</td></tr>`;
    return;
  }

  Admin.active = data;
  Admin.schema = (window.LIFF_RESULT_SCHEMAS || {})[data.service_code] || [{ key: 'bacteria_count', label: 'ผลตรวจ', type: 'text' }];

  // ปุ่มที่แก้ไขข้อมูลได้ เปิดให้เฉพาะผู้ดูแลระบบ
  ['btn-add-row', 'btn-edit-header', 'btn-delete-report'].forEach(id => {
    const el = $a(id);
    if (el) el.classList.toggle('hidden', !Admin.isAdmin);
  });

  // เดิมช่องหมายเหตุว่างทุกครั้งที่เปิดใบ ทำให้กดบันทึกซ้ำแล้วข้อความเดิมหาย
  $a('grid-remarks').value = data.remarks || '';

  renderGridHeader();
  renderGridBody();
  renderGridMeta();
}

function renderGridMeta() {
  const r = Admin.active;
  const svc = (window.LIFF_SERVICES || {})[r.service_code] || {};
  $a('grid-meta').innerHTML = `
    <div><span class="text-slate-400 block text-[10px]">เลขที่ใบส่งตรวจ</span><b class="font-mono text-[#6c5070]">${esc(r.submission_no)}</b></div>
    <div><span class="text-slate-400 block text-[10px]">บริการ</span><b>${svc.icon || ''} ${esc(svc.short || r.service_code)}</b></div>
    <div><span class="text-slate-400 block text-[10px]">หน่วยงาน</span><b>${esc(r.department || '-')}</b></div>
    <div><span class="text-slate-400 block text-[10px]">สถานที่เก็บ</span><b>${esc(r.ward_room || '-')}</b></div>
    <div><span class="text-slate-400 block text-[10px]">วันที่เก็บ</span><b>${fmtThaiShort(r.sampling_date)}</b></div>
    <div><span class="text-slate-400 block text-[10px]">ผู้ส่งตรวจ</span><b>${esc(r.sampler_name || '-')}</b>
      ${r.line_user_id ? '<span class="text-[9px] text-emerald-600 ml-1"><i class="fab fa-line"></i></span>' : ''}</div>
    ${Admin.isAdmin ? '' : readOnlyMeta(r)}`;
}

/**
 * ข้อมูลสรุปสำหรับบัญชีที่ดูอย่างเดียว
 * แถบบันทึกผลท้ายตารางถูกซ่อนไป ความเห็นทางเทคนิคจึงต้องมาแสดงตรงนี้แทน
 * ไม่งั้นหน่วยงานจะไม่เห็นข้อสรุปของห้องแล็บเลย
 */
function readOnlyMeta(r) {
  const waiting = isWaitingStatus(r.status);
  return `<div class="col-span-6 pt-3 mt-1 border-t border-slate-200 flex flex-wrap items-start gap-x-8 gap-y-2">
    <div><span class="text-slate-400 block text-[10px]">สถานะ</span>
      <b class="${waiting ? 'text-amber-600' : 'text-emerald-700'}">${waiting ? '⏳ รอตรวจ' : '✅ ออกผลแล้ว'}</b></div>
    <div><span class="text-slate-400 block text-[10px]">วันที่รายงานผล</span>
      <b>${r.reported_date ? fmtThaiShort(r.reported_date) : '-'}</b></div>
    <div><span class="text-slate-400 block text-[10px]">ผู้รายงานผล</span>
      <b>${esc(r.reporter_name || '-')}</b></div>
    <div class="flex-1 min-w-[240px]"><span class="text-slate-400 block text-[10px]">ความเห็นทางเทคนิค</span>
      <b class="font-normal text-slate-600">${esc(r.remarks || '-')}</b></div>
  </div>`;
}

function renderGridHeader() {
  $a('grid-thead').innerHTML = `<tr class="bg-[#f7f2f8] text-[11px] text-[#6c5070]">
    <th class="px-3 py-2.5 text-center w-14 font-bold border-b border-[#e6d9ea]">#</th>
    <th class="px-3 py-2.5 text-left font-bold border-b border-[#e6d9ea] min-w-[220px]">ตำแหน่ง / สิ่งส่งตรวจ</th>
    <th class="px-3 py-2.5 text-left font-bold border-b border-[#e6d9ea] min-w-[180px]">รายละเอียด</th>
    ${Admin.schema.map(f => `<th class="px-3 py-2.5 text-center font-bold border-b border-[#e6d9ea] bg-emerald-50 text-emerald-800 min-w-[150px]">${esc(f.label)}</th>`).join('')}
    <th class="px-3 py-2.5 text-center font-bold border-b border-[#e6d9ea] w-32">สรุปผล</th>
    <th class="px-3 py-2.5 text-left font-bold border-b border-[#e6d9ea] min-w-[160px]">หมายเหตุ</th>
    ${Admin.isAdmin ? '<th class="px-2 py-2.5 text-center font-bold border-b border-[#e6d9ea] w-12"></th>' : ''}
  </tr>`;
}

/** เซลล์แบบอ่านอย่างเดียว (บัญชีหน่วยงาน) — ไม่ใช่ input ที่ disabled เพื่อไม่ให้ดูเหมือนกรอกได้ */
const roCell = (v, extra) =>
  `<td class="px-3 py-2.5 border-b border-slate-100 text-sm ${extra || ''}">${esc(
    v == null || v === '' ? '-' : v)}</td>`;

/** ช่องกรอกผล: ตัวเลข CFU หรือ dropdown Growth/No growth */
function fieldInput(f, value, row) {
  const v = (value == null || value === '-') ? '' : String(value);
  const common = `data-field="${f.key}" data-row="${row}" onkeydown="gridKey(event)" class="grid-cell w-full px-2 py-2 rounded-lg border border-emerald-300 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500"`;

  if (f.type === 'growth' || f.type === 'negative') {
    const no = f.type === 'negative' ? 'ไม่พบเชื้อ' : 'No growth';
    const yes = f.type === 'negative' ? 'พบเชื้อ' : 'Growth';
    const isYes = /^(growth|พบเชื้อ|fail)/i.test(v);
    return `<select ${common} onchange="syncVerdict(${row})">
      <option value="${no}"${isYes ? '' : ' selected'}>✅ ${no}</option>
      <option value="${yes}"${isYes ? ' selected' : ''}>⚠️ ${yes}</option></select>`;
  }
  return `<input type="text" inputmode="numeric" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${common}>`;
}

function renderGridBody() {
  const items = (Admin.active.report_items || []).slice().sort((a, b) => (a.item_no || 0) - (b.item_no || 0));
  if (!items.length) {
    $a('grid-tbody').innerHTML = `<tr><td colspan="12" class="p-8 text-center text-slate-400">
      ใบนี้ไม่มีรายการตัวอย่าง${Admin.isAdmin ? ' — กด <b>เพิ่มแถว</b> เพื่อเริ่ม' : ''}</td></tr>`;
    $a('grid-row-count').textContent = 0;
    return;
  }

  // ---- โหมดดูอย่างเดียว: แสดงผลที่ห้องแล็บลงไว้ ไม่มีช่องให้แก้ ----
  if (!Admin.isAdmin) {
    $a('grid-tbody').innerHTML = items.map((it, i) => {
      const fail = String(it.item_result) === 'fail';
      const pending = String(it.item_result) === 'pending';
      return `<tr class="hover:bg-slate-50">
        <td class="px-3 py-2.5 text-center text-xs font-bold text-slate-400 border-b border-slate-100">${it.item_no || i + 1}</td>
        ${roCell(it.location_name)}
        ${roCell(it.sample_description)}
        ${Admin.schema.map(f => roCell(it[f.key], 'text-center font-bold bg-emerald-50/40')).join('')}
        <td class="px-3 py-2.5 border-b border-slate-100 text-center">
          <span class="text-xs font-bold px-2 py-1 rounded-lg border ${pending
            ? 'text-amber-700 bg-amber-50 border-amber-200'
            : fail ? 'text-rose-700 bg-rose-50 border-rose-200'
                   : 'text-emerald-700 bg-emerald-50 border-emerald-200'}">${
            pending ? '⏳ รอผล' : fail ? '⚠️ ไม่ผ่าน' : '✅ ผ่าน'}</span></td>
        ${roCell(it.remarks != null ? it.remarks : it.notes, 'text-slate-500')}
      </tr>`;
    }).join('');
    $a('grid-row-count').textContent = items.length;
    return;
  }

  $a('grid-tbody').innerHTML = items.map((it, i) => `
    <tr data-item-no="${it.item_no || i + 1}" class="hover:bg-slate-50">
      <td class="px-3 py-2 text-center text-xs font-bold text-slate-400 border-b border-slate-100">${it.item_no || i + 1}</td>
      <td class="px-3 py-2 border-b border-slate-100">
        <input type="text" data-field="location_name" data-row="${i}" onkeydown="gridKey(event)" value="${esc(it.location_name)}"
               class="grid-cell w-full px-2 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#6c5070]/30"></td>
      <td class="px-3 py-2 border-b border-slate-100">
        <input type="text" data-field="sample_description" data-row="${i}" onkeydown="gridKey(event)" value="${esc(it.sample_description)}"
               class="grid-cell w-full px-2 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#6c5070]/30"></td>
      ${Admin.schema.map(f => `<td class="px-3 py-2 border-b border-slate-100 bg-emerald-50/40">${fieldInput(f, it[f.key], i)}</td>`).join('')}
      <td class="px-3 py-2 border-b border-slate-100">
        <select data-field="item_result" data-row="${i}" onkeydown="gridKey(event)"
                class="grid-cell w-full px-2 py-2 rounded-lg border text-xs font-bold outline-none ${String(it.item_result) === 'fail' ? 'border-rose-300 text-rose-700 bg-rose-50' : 'border-emerald-300 text-emerald-700 bg-white'}">
          <option value="pass"${String(it.item_result) === 'fail' ? '' : ' selected'}>✅ ผ่าน</option>
          <option value="fail"${String(it.item_result) === 'fail' ? ' selected' : ''}>⚠️ ไม่ผ่าน</option>
        </select></td>
      <td class="px-3 py-2 border-b border-slate-100">
        <input type="text" data-field="remarks" data-row="${i}" onkeydown="gridKey(event)" value="${esc(it.remarks != null ? it.remarks : it.notes)}"
               class="grid-cell w-full px-2 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#6c5070]/30"></td>
      ${Admin.isAdmin ? `<td class="px-2 py-2 border-b border-slate-100 text-center">
        <button type="button" onclick="deleteGridRow(${it.item_no || i + 1})" title="ลบแถวนี้"
                class="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
          <i class="fas fa-trash-can text-xs"></i></button></td>` : ''}
    </tr>`).join('');

  $a('grid-row-count').textContent = items.length;
}

/**
 * คีย์ลัดสำหรับคีย์ผลเร็ว ๆ
 * Enter / ArrowDown = แถวถัดไปคอลัมน์เดิม, ArrowUp = แถวก่อนหน้า
 * (Tab ปล่อยให้เบราว์เซอร์จัดการเอง = ข้ามคอลัมน์)
 */
function gridKey(ev) {
  const key = ev.key;
  if (key !== 'Enter' && key !== 'ArrowDown' && key !== 'ArrowUp') return;
  // ใน <select> ลูกศรขึ้นลงใช้เลือกตัวเลือก จึงรับเฉพาะ Enter
  if (ev.target.tagName === 'SELECT' && key !== 'Enter') return;

  ev.preventDefault();
  const row = Number(ev.target.dataset.row);
  const field = ev.target.dataset.field;
  const next = row + (key === 'ArrowUp' ? -1 : 1);
  const target = document.querySelector(`.grid-cell[data-field="${field}"][data-row="${next}"]`);
  if (target) { target.focus(); if (target.select) target.select(); }
}

/** เลือก Growth แล้วให้ช่องสรุปผลเด้งเป็น "ไม่ผ่าน" อัตโนมัติ */
function syncVerdict(row) {
  const growth = Array.from(document.querySelectorAll(`.grid-cell[data-row="${row}"]`))
    .some(el => /^(growth|พบเชื้อ)/i.test(el.value || ''));
  const verdict = document.querySelector(`.grid-cell[data-field="item_result"][data-row="${row}"]`);
  if (!verdict) return;
  verdict.value = growth ? 'fail' : 'pass';
  verdict.className = verdict.className.replace(/border-(rose|emerald)-300 text-(rose|emerald)-700 bg-(rose-50|white)/,
    growth ? 'border-rose-300 text-rose-700 bg-rose-50' : 'border-emerald-300 text-emerald-700 bg-white');
}

/** เติมค่าปกติให้ทุกแถวในคลิกเดียว แล้วค่อยแก้เฉพาะแถวที่ผิดปกติ */
function fillAllPass() {
  if (!Admin.isAdmin) return;
  document.querySelectorAll('#grid-tbody tr').forEach((tr, i) => {
    Admin.schema.forEach(f => {
      const el = tr.querySelector(`.grid-cell[data-field="${f.key}"]`);
      if (!el) return;
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else if (!el.value) el.value = '0';
    });
    const verdict = tr.querySelector('.grid-cell[data-field="item_result"]');
    if (verdict) verdict.value = 'pass';
  });
  Swal.fire({ icon: 'success', title: 'เติมค่าปกติให้ทุกแถวแล้ว', text: 'แก้เฉพาะแถวที่ผิดปกติ แล้วกดบันทึกผล', timer: 1600, showConfirmButton: false });
}

/* ============================================================================
 * 4) บันทึกผล
 * ========================================================================== */
async function saveResults() {
  if (!Admin.active) return;

  // ปุ่มถูกซ่อนไว้อยู่แล้ว แต่กันไว้อีกชั้นเผื่อถูกเรียกจาก console
  if (!Admin.isAdmin) {
    return Swal.fire({ icon: 'info', title: 'ลงผลตรวจไม่ได้',
      text: 'บัญชีหน่วยงานผู้ส่งตรวจดูข้อมูลได้อย่างเดียว การลงผลทำโดยงานจุลชีววิทยาเท่านั้น',
      confirmButtonColor: '#6c5070' });
  }

  // กันไม่ให้คีย์ผลจนเสร็จแล้วเพิ่งมารู้ว่าบันทึกไม่ได้
  if (!(await checkWriteAccess())) {
    return Swal.fire({
      icon: 'error',
      title: 'บันทึกผลไม่ได้',
      html: '<div class="text-sm text-slate-600 leading-relaxed">ระบบยังไม่ได้รับสิทธิ์เขียนจากฐานข้อมูล<br>'
          + 'ผลที่คีย์ไว้ยังอยู่บนหน้าจอ กรุณากด <b>ลองเชื่อมต่อใหม่</b> ที่แถบสีแดงด้านบน '
          + 'แล้วกดบันทึกอีกครั้ง</div>',
      confirmButtonColor: '#6c5070'
    });
  }

  const rows = Array.from(document.querySelectorAll('#grid-tbody tr[data-item-no]'));
  if (!rows.length) return;

  const items = rows.map((tr, i) => {
    const f = {};
    tr.querySelectorAll('.grid-cell').forEach(el => { f[el.dataset.field] = String(el.value ?? '').trim(); });
    return {
      item_no: parseInt(tr.dataset.itemNo, 10) || i + 1,
      location_name: f.location_name || `จุดตรวจที่ ${i + 1}`,
      sample_description: f.sample_description || '',
      bacteria_count: f.bacteria_count || '-',
      fungus_count: f.fungus_count || '-',
      item_result: f.item_result || 'pass',
      // ⚠️ ตาราง report_items บนฐานข้อมูลจริงใช้ชื่อคอลัมน์ 'remarks' (ไม่ใช่ 'notes')
      //    ถ้าส่งชื่อผิด PostgREST จะปฏิเสธทั้งแถว -> ผลตรวจไม่ถูกบันทึกแบบเงียบ ๆ
      remarks: f.remarks || ''
    };
  });

  const hasFail = items.some(it => it.item_result === 'fail');

  // ----------------------------------------------------------------------------
  // ค่าที่คีย์เกินเกณฑ์แต่สรุปว่า "ผ่าน" ต้องถามก่อน
  // เจอจริงในใบ AIR-2026-08-21-79: Fungus 200 CFU/m³ (เกณฑ์ < 100) แต่สรุปผ่าน
  // ใบรายงานจึงพิมพ์ตัวเลขที่เกินเกณฑ์คู่กับคำว่าผ่าน ซึ่งขัดกันเอง
  // ไม่เปลี่ยนคำตัดสินให้อัตโนมัติ เพราะเป็นดุลพินิจของนักเทคนิคการแพทย์
  // ----------------------------------------------------------------------------
  const limits = (window.LIFF_RESULT_LIMITS || {})[Admin.active.service_code] || {};
  const overLimit = [];
  items.forEach(it => {
    if (it.item_result !== 'pass') return;
    Object.keys(limits).forEach(k => {
      const lim = limits[k];
      const n = parseFloat(it[k]);
      if (Number.isFinite(n) && n >= lim.max) {
        overLimit.push(`แถวที่ ${it.item_no}: ${lim.label} = ${n} ${lim.unit} (เกณฑ์ < ${lim.max})`);
      }
    });
  });

  if (overLimit.length) {
    const go = await Swal.fire({
      icon: 'warning',
      title: 'ค่าเกินเกณฑ์แต่สรุปว่าผ่าน',
      html: '<div class="text-left text-sm text-slate-600 leading-relaxed">'
          + '<div class="mb-2">พบ <b class="text-amber-600">' + overLimit.length + ' รายการ</b> ที่ค่าถึงหรือเกินเกณฑ์มาตรฐาน แต่ช่องสรุปผลเลือกไว้ว่า <b>ผ่าน</b></div>'
          + '<div class="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2.5 font-mono">'
          + overLimit.join('<br>') + '</div>'
          + '<div class="mt-2 text-xs text-slate-500">ถ้ายืนยัน ใบรายงานจะพิมพ์ตัวเลขนี้คู่กับผลว่าผ่าน</div></div>',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันตามที่คีย์',
      cancelButtonText: 'กลับไปแก้',
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#6c5070'
    });
    if (!go.isConfirmed) return;
  }

  const confirm = await Swal.fire({
    icon: hasFail ? 'warning' : 'question',
    title: 'ยืนยันการลงผลตรวจ',
    html: `<div class="text-sm text-slate-600">
             <div class="font-mono font-bold text-[#6c5070]">${esc(Admin.active.submission_no)}</div>
             <div class="mt-1">${items.length} รายการ · สรุป
               <b class="${hasFail ? 'text-rose-600' : 'text-emerald-600'}">${hasFail ? 'พบเชื้อ / ตกเกณฑ์' : 'ผ่านเกณฑ์ทั้งหมด'}</b></div>
             <div class="mt-2 text-xs text-slate-400">ผู้รายงานผล: ${esc(Admin.user.displayName || Admin.user.username)}</div>
           </div>`,
    showCancelButton: true, confirmButtonText: 'บันทึกและออกผล', cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#6c5070', cancelButtonColor: '#94a3b8'
  });
  if (!confirm.isConfirmed) return;

  Swal.fire({ title: 'กำลังบันทึกผล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  // 4.1 อัปเดตรายการย่อยทีละรายการ โดยจับคู่ด้วย item_no
  //     (ห้าม delete+insert เพราะจะทำให้เกิดรายการซ้ำถ้าบันทึกหลายรอบ)
  const failed = [];
  for (const it of items) {
    const { item_no, ...values } = it;
    let res = await window.supabaseClient
      .from('report_items').update(values)
      .eq('report_id', Admin.active.id).eq('item_no', item_no).select();

    // ถ้าฐานข้อมูลไม่รู้จักคอลัมน์ remarks ให้ลองใหม่โดยใช้ notes แทน
    if (res.error && /remarks/.test(res.error.message || '')) {
      const { remarks, ...rest } = values;
      res = await window.supabaseClient
        .from('report_items').update({ ...rest, notes: remarks })
        .eq('report_id', Admin.active.id).eq('item_no', item_no).select();
    }

    // update ที่ถูก RLS บล็อกจะไม่คืน error แต่จะไม่มีแถวไหนถูกแก้ -> ต้องเช็คจำนวนแถวด้วย
    if (res.error || !(res.data || []).length) {
      failed.push({ item_no, reason: (res.error && res.error.message) || 'ไม่มีแถวใดถูกแก้ไข (อาจถูก RLS ปฏิเสธ)' });
    }
  }

  // ห้ามปิดใบเป็น "ตรวจแล้ว" ถ้าผลยังบันทึกไม่ครบ ไม่งั้นใบจะหลุดจากคิวทั้งที่ยังไม่มีผล
  if (failed.length) {
    return Swal.fire({
      icon: 'error',
      title: 'บันทึกผลไม่สำเร็จ',
      html: '<div class="text-xs text-left text-slate-600">'
        + '<div class="mb-2">บันทึกผลไม่สำเร็จ <b class="text-rose-600">' + failed.length + ' จาก ' + items.length + ' รายการ</b> '
        + 'ใบนี้ยังคงสถานะ <b>รอตรวจ</b> ไว้เหมือนเดิม</div>'
        + '<div class="font-mono text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 break-all">'
        + failed.map(f => 'แถวที่ ' + f.item_no + ': ' + f.reason).join('<br>') + '</div></div>',
      confirmButtonColor: '#6c5070'
    });
  }

  // 4.2 อัปเดตหัวใบ
  //     ⚠️ CHECK constraint บนฐานข้อมูลจริงรับ 'completed' แต่ปฏิเสธ 'tested'
  //        (ก่อนรัน supabase_migration_fix.sql) จึงลองเรียงตามลำดับ
  let ok = false, lastErr = null;
  // ลำดับสำคัญ: 194 ใบเดิมในระบบใช้ 'completed' ทั้งหมด และนโยบาย RLS
  // "Public can view completed reports" ผูกกับค่านี้ตรง ๆ
  // ก่อนรัน migration ฐานข้อมูลไม่รับ 'tested' จึงตกมาที่ 'completed' เองโดยบังเอิญ
  // หลัง migration 'tested' ผ่านได้ ถ้าไม่สลับลำดับข้อมูลจะแตกเป็นสองมาตรฐาน
  for (const status of ['completed', 'tested']) {
    const { error } = await window.supabaseClient.from('reports').update({
      status,
      overall_result: hasFail ? 'fail' : 'pass',
      reported_date: todayISO(),
      reporter_name: Admin.user.displayName || Admin.user.username,
      approver_name: 'ทนพญ.ปราญชลี หรั่งอ่อน',
      remarks: $a('grid-remarks').value.trim() || Admin.active.remarks || null,
      updated_at: new Date().toISOString()
    }).eq('id', Admin.active.id);

    if (!error) { ok = true; break; }
    lastErr = error;
    if (!(error.code === '23514' || /check constraint/i.test(error.message || ''))) break;
  }

  if (!ok) {
    return Swal.fire({ icon: 'error', title: 'บันทึกผลไม่สำเร็จ', text: (lastErr && lastErr.message) || '', confirmButtonColor: '#6c5070' });
  }

  // 4.3 แจ้งผลกลับเข้ากลุ่ม LINE ด้วย Flex Message
  const flex = window.LiffFlex.buildResultFlex({
    submission_no: Admin.active.submission_no,
    service_code: Admin.active.service_code,
    service_name: Admin.active.service_name,
    department: Admin.active.department,
    reported_date_th: fmtThaiShort(todayISO()),
    item_count: items.length,
    has_fail: hasFail,
    reporter_name: Admin.user.displayName || Admin.user.username,
    link: location.origin + '/report_view.html?id=' + encodeURIComponent(Admin.active.submission_no)
  });
  const notify = await window.LiffFlex.sendToLabGroup(flex,
    `ผลตรวจ ${Admin.active.submission_no} ${hasFail ? 'พบเชื้อ' : 'ผ่านเกณฑ์'}`);

  await Swal.fire({
    icon: 'success', title: 'ออกผลเรียบร้อย',
    html: `<div class="text-sm text-slate-600">
             <div class="font-mono font-bold text-[#6c5070]">${esc(Admin.active.submission_no)}</div>
             <div class="mt-2 text-xs ${notify.mocked ? 'text-amber-600' : 'text-emerald-600'}">
               ${notify.mocked ? '⚠️ ยังไม่ได้ส่งแจ้งเตือนจริง (ดู JSON ใน console)' : '✅ แจ้งผลเข้ากลุ่ม LINE แล้ว'}</div>
           </div>`,
    timer: 2200, showConfirmButton: false
  });

  Admin.active = null;
  $a('grid-wrap').classList.add('hidden');
  $a('grid-empty').classList.remove('hidden');
  $a('grid-remarks').value = '';
  await loadQueue();
}


/* ============================================================================
 * 5) เพิ่ม / แก้ไข / ลบ  — เฉพาะบัญชีผู้ดูแลระบบ
 * --------------------------------------------------------------------------
 * ฐานข้อมูลอนุญาต INSERT/UPDATE/DELETE เฉพาะผู้ที่ผ่าน Supabase Auth แล้วเท่านั้น
 * (นโยบาย "Admin delete reports" / "Med Tech only update report results")
 * ฝั่งหน้าจอจึงกันอีกชั้นด้วย role และตรวจ session ก่อนทุกครั้ง
 * เพราะ RLS ปฏิเสธ UPDATE/DELETE โดยไม่คืน error — มันแก้ 0 แถวแล้วเงียบ
 * ทุกคำสั่งจึงต่อท้ายด้วย .select() เพื่อนับแถวที่เปลี่ยนจริง
 * ========================================================================== */

const newUuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }));

/** ด่านตรวจก่อนทำอะไรที่เปลี่ยนข้อมูล */
async function guardAdmin() {
  if (!Admin.isAdmin) {
    Swal.fire({ icon: 'info', title: 'เฉพาะผู้ดูแลระบบ',
      text: 'บัญชีของคุณลงผลตรวจได้ แต่เพิ่ม แก้ไข หรือลบใบส่งตรวจไม่ได้',
      confirmButtonColor: '#6c5070' });
    return false;
  }
  if (!(await checkWriteAccess())) {
    Swal.fire({ icon: 'error', title: 'ยังไม่มีสิทธิ์เขียน',
      text: 'กด "ลองเชื่อมต่อใหม่" ที่แถบสีแดงด้านบน แล้วลองอีกครั้ง',
      confirmButtonColor: '#6c5070' });
    return false;
  }
  return true;
}

/** เลขที่เอกสาร PREFIX-YYYY-MM-DD-NN (ต้องตรงกับฝั่งผู้ส่งตรวจใน liff-app.js) */
async function genAdminSubmissionNo(serviceCode, samplingDate) {
  const prefix = ADMIN_PREFIX[serviceCode] || String(serviceCode).split('_')[0];
  const d = samplingDate ? new Date(samplingDate + 'T00:00:00') : new Date();
  const datePart = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  let next = 1;
  try {
    const { data } = await window.supabaseClient
      .from('reports').select('submission_no').like('submission_no', prefix + '-%').limit(1000);
    next = (data || []).reduce((max, r) => {
      const m = String(r.submission_no).match(/-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0) + 1;
  } catch (e) {
    console.warn('อ่านเลขล่าสุดไม่ได้:', e && e.message);
  }
  return prefix + '-' + datePart + '-' + String(next).padStart(2, '0');
}

const serviceOptions = (selected) => Object.values(window.LIFF_SERVICES || {})
  .map(s => '<option value="' + s.code + '"' + (s.code === selected ? ' selected' : '') + '>'
          + s.icon + ' ' + s.short + ' · ' + esc(s.name) + '</option>').join('');

const SWAL_INPUT = 'w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#6c5070]/30';
const swalField = (label, inner) =>
  '<label class="block text-left mb-3"><span class="block text-[11px] font-bold text-slate-600 mb-1">'
  + label + '</span>' + inner + '</label>';

/* ---------------------------------------------------------------- สร้างใบใหม่ */
async function newSubmission() {
  if (!(await guardAdmin())) return;

  const res = await Swal.fire({
    title: 'สร้างใบส่งตรวจใหม่',
    width: 560,
    html:
      swalField('บริการ', '<select id="nf-service" class="' + SWAL_INPUT + '">' + serviceOptions('AIR_01') + '</select>') +
      swalField('หน่วยงานผู้ส่งตรวจ', '<input id="nf-dept" class="' + SWAL_INPUT + '" placeholder="เว้นว่างเพื่อใช้ค่าตามบริการ">') +
      swalField('สถานที่ / จุดเก็บตัวอย่าง', '<input id="nf-ward" class="' + SWAL_INPUT + '" placeholder="เช่น ห้องผ่าตัด OR-1">') +
      swalField('วันที่เก็บตัวอย่าง', '<input id="nf-date" type="date" value="' + todayISO() + '" class="' + SWAL_INPUT + '">') +
      swalField('ผู้ส่งตรวจ', '<input id="nf-sampler" class="' + SWAL_INPUT + '" placeholder="ชื่อผู้นำส่ง">') +
      swalField('จำนวนรายการตัวอย่าง', '<input id="nf-count" type="number" min="1" max="60" value="1" class="' + SWAL_INPUT + '">'),
    showCancelButton: true, confirmButtonText: 'สร้างใบส่งตรวจ', cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#6c5070', cancelButtonColor: '#94a3b8',
    didOpen: () => {
      const sync = () => {
        const svc = (window.LIFF_SERVICES || {})[document.getElementById('nf-service').value] || {};
        document.getElementById('nf-dept').placeholder = svc.dept || '';
      };
      document.getElementById('nf-service').addEventListener('change', sync);
      sync();
    },
    preConfirm: () => {
      const v = (id) => document.getElementById(id).value.trim();
      const count = parseInt(v('nf-count'), 10);
      if (!v('nf-ward')) return Swal.showValidationMessage('กรุณาระบุสถานที่ / จุดเก็บตัวอย่าง');
      if (!(count >= 1 && count <= 60)) return Swal.showValidationMessage('จำนวนรายการต้องอยู่ระหว่าง 1–60');
      return { code: v('nf-service'), dept: v('nf-dept'), ward: v('nf-ward'),
               date: v('nf-date') || todayISO(), sampler: v('nf-sampler'), count: count };
    }
  });
  if (!res.isConfirmed) return;

  const f = res.value;
  const svc = (window.LIFF_SERVICES || {})[f.code] || {};
  Swal.fire({ title: 'กำลังสร้างใบส่งตรวจ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  const id = newUuid();
  let submissionNo = await genAdminSubmissionNo(f.code, f.date);
  const header = {
    id: id, service_code: f.code, service_name: svc.name || f.code,
    department: f.dept || svc.dept || '-', ward_room: f.ward,
    sampler_name: f.sampler || (Admin.user.displayName || Admin.user.username),
    sampling_date: f.date, received_date: todayISO(),
    reporter_name: 'รอห้องปฏิบัติการลงผล', approver_name: 'ทนพญ.ปราญชลี หรั่งอ่อน',
    overall_result: 'pending', source: 'admin'
  };

  // เลขชนกันได้ถ้ามีคนสร้างพร้อมกัน -> ขยับเลขแล้วลองใหม่
  // และ CHECK constraint บนฐานข้อมูลจริงยังไม่รับ 'pending' -> ไล่ค่าที่รับได้
  let saved = null, lastErr = null;
  outer:
  for (let attempt = 0; attempt < 20; attempt++) {
    for (const status of ['pending', 'in_progress', 'draft']) {
      const ins = await window.supabaseClient.from('reports')
        .insert(Object.assign({}, header, { submission_no: submissionNo, status: status }));
      if (!ins.error) { saved = status; break outer; }
      lastErr = ins.error;

      if (ins.error.code === '23505' || /duplicate key/i.test(ins.error.message || '')) {
        const m = String(submissionNo).match(/^(.*-)(\d+)$/);
        if (m) submissionNo = m[1] + String(parseInt(m[2], 10) + 1).padStart(m[2].length, '0');
        continue outer;
      }
      if (!(ins.error.code === '23514' || /check constraint/i.test(ins.error.message || ''))) break outer;
    }
  }

  if (!saved) {
    return Swal.fire({ icon: 'error', title: 'สร้างใบไม่สำเร็จ',
      text: (lastErr && lastErr.message) || 'ไม่ทราบสาเหตุ', confirmButtonColor: '#6c5070' });
  }

  const items = Array.from({ length: f.count }, (_, i) => ({
    report_id: id, item_no: i + 1,
    location_name: f.ward + ' - จุดที่ ' + (i + 1),
    sample_description: f.ward,
    bacteria_count: '-', fungus_count: '-', item_result: 'pending'
  }));
  const itemIns = await window.supabaseClient.from('report_items').insert(items);

  await Swal.fire({
    icon: itemIns.error ? 'warning' : 'success',
    title: itemIns.error ? 'สร้างใบแล้ว แต่รายการย่อยไม่ครบ' : 'สร้างใบส่งตรวจเรียบร้อย',
    html: '<div class="text-sm text-slate-600">'
        + '<div class="font-mono font-bold text-[#6c5070] text-base">' + esc(submissionNo) + '</div>'
        + '<div class="mt-1">' + f.count + ' รายการ · สถานะ <b class="text-amber-600">รอตรวจ</b></div>'
        + (itemIns.error ? '<div class="mt-2 text-xs text-amber-700">' + esc(itemIns.error.message) + '</div>' : '')
        + '</div>',
    confirmButtonColor: '#6c5070'
  });

  Admin.queueFilter = 'waiting';
  setQueueFilterUI('waiting');
  await loadQueue();
  await openSubmission(id);
}

/* ------------------------------------------------------------- แก้ไขหัวใบ */
async function editHeader() {
  if (!Admin.active || !(await guardAdmin())) return;
  const r = Admin.active;

  const res = await Swal.fire({
    title: 'แก้ไขข้อมูลหัวใบ',
    width: 560,
    html:
      '<div class="text-left mb-3 font-mono font-bold text-[#6c5070]">' + esc(r.submission_no) + '</div>' +
      swalField('บริการ', '<select id="ef-service" class="' + SWAL_INPUT + '">' + serviceOptions(r.service_code) + '</select>') +
      swalField('หน่วยงานผู้ส่งตรวจ', '<input id="ef-dept" class="' + SWAL_INPUT + '" value="' + esc(r.department || '') + '">') +
      swalField('สถานที่ / จุดเก็บตัวอย่าง', '<input id="ef-ward" class="' + SWAL_INPUT + '" value="' + esc(r.ward_room || '') + '">') +
      swalField('วันที่เก็บตัวอย่าง', '<input id="ef-date" type="date" value="' + esc(String(r.sampling_date || '').slice(0, 10)) + '" class="' + SWAL_INPUT + '">') +
      swalField('ผู้ส่งตรวจ', '<input id="ef-sampler" class="' + SWAL_INPUT + '" value="' + esc(r.sampler_name || '') + '">') +
      '<div class="text-left text-[11px] text-slate-400 mt-1">เปลี่ยน "บริการ" จะเปลี่ยนคอลัมน์ผลตรวจของใบนี้ แต่ไม่เปลี่ยนเลขที่เอกสาร</div>',
    showCancelButton: true, confirmButtonText: 'บันทึกการแก้ไข', cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#6c5070', cancelButtonColor: '#94a3b8',
    preConfirm: () => {
      const v = (id) => document.getElementById(id).value.trim();
      if (!v('ef-ward')) return Swal.showValidationMessage('กรุณาระบุสถานที่ / จุดเก็บตัวอย่าง');
      return { service_code: v('ef-service'), department: v('ef-dept'), ward_room: v('ef-ward'),
               sampling_date: v('ef-date') || r.sampling_date, sampler_name: v('ef-sampler') };
    }
  });
  if (!res.isConfirmed) return;

  const svc = (window.LIFF_SERVICES || {})[res.value.service_code] || {};
  const patch = Object.assign({}, res.value, {
    service_name: svc.name || res.value.service_code,
    updated_at: new Date().toISOString()
  });

  const upd = await window.supabaseClient.from('reports').update(patch).eq('id', r.id).select();

  if (upd.error || !(upd.data || []).length) {
    return Swal.fire({ icon: 'error', title: 'แก้ไขไม่สำเร็จ',
      text: (upd.error && upd.error.message) || 'ไม่มีแถวใดถูกแก้ไข (อาจถูก RLS ปฏิเสธ)',
      confirmButtonColor: '#6c5070' });
  }

  Swal.fire({ icon: 'success', title: 'บันทึกการแก้ไขแล้ว', timer: 1400, showConfirmButton: false });
  await loadQueue();
  await openSubmission(r.id);
}

/* --------------------------------------------------------------- เพิ่มแถว */
async function addGridRow() {
  if (!Admin.active || !(await guardAdmin())) return;

  const items = Admin.active.report_items || [];
  const nextNo = items.reduce((m, it) => Math.max(m, it.item_no || 0), 0) + 1;

  const ins = await window.supabaseClient.from('report_items').insert({
    report_id: Admin.active.id, item_no: nextNo,
    location_name: (Admin.active.ward_room || 'จุดตรวจ') + ' - จุดที่ ' + nextNo,
    sample_description: Admin.active.ward_room || '',
    bacteria_count: '-', fungus_count: '-', item_result: 'pending'
  });

  if (ins.error) {
    return Swal.fire({ icon: 'error', title: 'เพิ่มแถวไม่สำเร็จ', text: ins.error.message, confirmButtonColor: '#6c5070' });
  }
  await openSubmission(Admin.active.id);
}

/* ---------------------------------------------------------------- ลบแถว */
async function deleteGridRow(itemNo) {
  if (!Admin.active || !(await guardAdmin())) return;

  const it = (Admin.active.report_items || []).find(x => (x.item_no || 0) === itemNo);
  const confirm = await Swal.fire({
    icon: 'warning', title: 'ลบรายการนี้?',
    html: '<div class="text-sm text-slate-600">แถวที่ ' + itemNo + ' · ' + esc((it && it.location_name) || '-')
        + '<br><span class="text-xs text-slate-400">ลบแล้วกู้คืนไม่ได้</span></div>',
    showCancelButton: true, confirmButtonText: 'ลบรายการ', cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#e11d48', cancelButtonColor: '#94a3b8'
  });
  if (!confirm.isConfirmed) return;

  const del = await window.supabaseClient.from('report_items')
    .delete().eq('report_id', Admin.active.id).eq('item_no', itemNo).select();

  if (del.error || !(del.data || []).length) {
    return Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ',
      text: (del.error && del.error.message) || 'ไม่มีแถวใดถูกลบ (อาจถูก RLS ปฏิเสธ)', confirmButtonColor: '#6c5070' });
  }
  await openSubmission(Admin.active.id);
}

/* --------------------------------------------------------------- ลบทั้งใบ */
async function deleteSubmission() {
  if (!Admin.active || !(await guardAdmin())) return;
  const r = Admin.active;
  const n = (r.report_items || []).length;
  const done = !isWaitingStatus(r.status);

  // ใบรายงานผลเป็นเอกสารคุณภาพตาม ISO 15189 การลบจึงต้องจงใจ
  // ให้พิมพ์เลขที่เอกสารยืนยัน กันกดพลาดตอนเลือกผิดใบจากคิว
  const confirm = await Swal.fire({
    icon: 'warning', title: 'ลบใบส่งตรวจทั้งใบ?',
    html: '<div class="text-sm text-slate-600 leading-relaxed text-left">'
        + '<div class="font-mono font-bold text-rose-600 text-center text-base mb-2">' + esc(r.submission_no) + '</div>'
        + 'จะลบรายการตัวอย่าง <b>' + n + ' รายการ</b> ที่ผูกอยู่ไปด้วย และ<b>กู้คืนไม่ได้</b>'
        + (done ? '<div class="mt-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 text-xs">'
                + '<b>ใบนี้ออกผลไปแล้ว</b> — ถ้าส่งผลให้หน่วยงานไปแล้ว การลบจะทำให้ตรวจสอบย้อนกลับไม่ได้</div>' : '')
        + '<div class="mt-3 text-xs text-slate-500">พิมพ์เลขที่เอกสารด้านบนเพื่อยืนยัน</div></div>',
    input: 'text', inputPlaceholder: r.submission_no,
    showCancelButton: true, confirmButtonText: 'ลบถาวร', cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#e11d48', cancelButtonColor: '#94a3b8',
    inputValidator: (val) => (String(val || '').trim() === r.submission_no ? undefined : 'เลขที่เอกสารไม่ตรง')
  });
  if (!confirm.isConfirmed) return;

  Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  // ลบลูกก่อนเสมอ ไม่พึ่ง ON DELETE CASCADE ซึ่งอาจไม่ได้ตั้งไว้บนตารางจริง
  const itemRes = await window.supabaseClient.from('report_items')
    .delete().eq('report_id', r.id).select();
  if (itemRes.error) {
    return Swal.fire({ icon: 'error', title: 'ลบรายการย่อยไม่สำเร็จ',
      text: itemRes.error.message, confirmButtonColor: '#6c5070' });
  }

  const repRes = await window.supabaseClient.from('reports').delete().eq('id', r.id).select();
  if (repRes.error || !(repRes.data || []).length) {
    return Swal.fire({ icon: 'error', title: 'ลบใบไม่สำเร็จ',
      html: '<div class="text-sm text-slate-600">'
          + esc((repRes.error && repRes.error.message) || 'ไม่มีแถวใดถูกลบ (อาจถูก RLS ปฏิเสธ)')
          + '<div class="mt-2 text-xs text-amber-700">รายการย่อย ' + (itemRes.data || []).length
          + ' รายการถูกลบไปแล้ว</div></div>',
      confirmButtonColor: '#6c5070' });
  }

  await Swal.fire({ icon: 'success', title: 'ลบเรียบร้อย',
    html: '<div class="text-sm text-slate-600"><span class="font-mono">' + esc(r.submission_no) + '</span>'
        + '<div class="text-xs text-slate-400 mt-1">พร้อมรายการย่อย ' + (itemRes.data || []).length + ' รายการ</div></div>',
    timer: 1800, showConfirmButton: false });

  Admin.active = null;
  $a('grid-wrap').classList.add('hidden');
  $a('grid-empty').classList.remove('hidden');
  await loadQueue();
}

document.addEventListener('DOMContentLoaded', bootAdmin);

Object.assign(window, {
  Admin, openSubmission, saveResults, fillAllPass, gridKey, syncVerdict, loadQueue, doLogout,
  checkWriteAccess, retryWriteAuth, getSupabaseSession,
  renderQueue, setQueueFilter, setQueueFilterUI,
  newSubmission, editHeader, deleteSubmission, addGridRow, deleteGridRow
});
