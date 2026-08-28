/**
 * ==============================================================================
 * WORKFLOW & REPORTING SYSTEM (workflow.js)
 * แท็บ 1: 📅 ปฏิทินจองวัน (Booking Calendar - จันทร์-พุธ)
 * แท็บ 2: 📝 แบบฟอร์มส่งตรวจ (Sample Submission Form + Email)
 * แท็บ 3: 📋 รายงานผลตรวจทั้งหมด (All Reports Archive - แสดงชื่อหน่วยงานที่เข้าไปวางเพลต & แยกสิทธิ์ตามหน่วยงาน)
 * แท็บ 4: 🔬 ลงผลตรวจ Data Grid (เห็นและเข้าถึงเฉพาะ ADMIN เท่านั้น!)
 * งานจุลชีววิทยา โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ (ISO 15189:2022)
 * ==============================================================================
 */

// ==============================================================================
// CONFIGURATION & API KEYS
// ==============================================================================
const WORKFLOW_CONFIG = {
  telegram: {
    enabled: true,
    botToken: '',
    chatId: ''
  },
  line: {
    enabled: true,
    token: '',
    groupId: ''
  },
  supabasePingIntervalMs: 30000
};

// Thai Date Constants
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
const THAI_DAYS = [
  'วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'
];

// State Variables
let currentActiveTab = 'calendar'; // 'calendar', 'submission', 'reports', 'result-grid'
let calYear = 2026; // ปี พ.ศ. 2569
let calMonth = 8;   // สิงหาคม (August 2569)
let cachedBookings = [];
let cachedHolidays = [];
let activeSubmissionData = null;
let healthCheckTimer = null;
let currentLoggedUser = null;
let adminDeptFilter = ''; // Filter selected by Admin in Reports Archive

// Mock Fallback Data (Categorized by Department & Sorted with Newest on Top)
// ==============================================================================
// STATUS HELPER — ตัวตัดสินสถานะ "รอตรวจ" / "ตรวจแล้ว" ชุดเดียวทั้งระบบ
// ==============================================================================
const WAITING_STATUSES = ['pending', 'waiting_for_testing', 'in_progress', 'draft', 'received', 'submitted', 'รอตรวจ'];
const TESTED_STATUSES = ['tested', 'completed', 'approved', 'reported', 'ตรวจแล้ว'];

function isWaitingReport(r) {
  if (!r) return false;
  const st = String(r.status || '').toLowerCase();
  if (WAITING_STATUSES.includes(st)) return true;
  if (TESTED_STATUSES.includes(st)) return false;
  return String(r.overall_result || 'pending').toLowerCase() === 'pending';
}
window.isWaitingReport = isWaitingReport;

/**
 * วันที่ที่แสดงในตารางรายงาน = "วันที่กดบันทึกแบบฟอร์มส่งตรวจ"
 */
function getSubmittedDateLabel(r) {
  const raw = r.created_at || r.submitted_at || r.received_date || r.sampling_date || r.formatted_date;
  const p = window.parseDateObj ? window.parseDateObj(raw) : null;
  if (!p) return r.formatted_date || r.sampling_date || '-';
  return `${p.day}/${p.month}/${p.year + 543}`;
}
window.getSubmittedDateLabel = getSubmittedDateLabel;

// ข้อมูลตัวอย่างถูกตัดออก — แสดงเฉพาะข้อมูลจริงจาก Supabase
const MOCK_REPORTS_ARCHIVE = [];
window.MOCK_REPORTS_ARCHIVE = MOCK_REPORTS_ARCHIVE;

// ==============================================================================
// INITIALIZATION
// ==============================================================================
async function bootWorkflow() {
  try {
    if (window.AuthManager) {
      currentLoggedUser = await window.AuthManager.getCurrentUser();
    }
  } catch (e) {
    console.warn('Auth init failed:', e);
  }

  // If on calendar container
  if (document.getElementById('calendar-days-grid')) {
    await initBookingCalendar();
  }

  // If on workflow container
  if (document.getElementById('workflow-main-container')) {
    await checkUserRoleAndInitTabs();
    initSubmissionForm();
    initResultEntryGrid();
    await initReportsArchive();
  }

  // Background Health Check
  checkSupabaseHealth();
  if (!healthCheckTimer) {
    healthCheckTimer = setInterval(checkSupabaseHealth, WORKFLOW_CONFIG.supabasePingIntervalMs);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootWorkflow);
} else {
  bootWorkflow();
}


// ==============================================================================
// รายการยาที่ส่งตรวจเพาะเชื้อประจำ (DRG-07 งานผลิตยา)
// ------------------------------------------------------------------------------
// คัดจากแบบฟอร์มกระดาษ "ผลเพาะเชื้อ" ที่งานผลิตยาใช้อยู่ เรียงตามลำดับเดิม
// ใช้เป็นตัวเลือกในช่อง "ชนิดของยา" แต่ยังพิมพ์ชื่ออื่นเองได้
// (ใช้ datalist ไม่ใช่ select เพราะรายการยาเปลี่ยนได้ ไม่ควรบังคับให้เลือกเฉพาะที่มี)
//
// ตรงกับของจริงในระบบ: รายการย่อยของ DRG-07 ทั้ง 144 รายการจาก 48 ใบ
// เป็นยา 4 ตัวนี้เท่านั้น ไม่มีตัวอื่นเลย
//
// ใช้ 'Zinc sulphate solution' เต็มคำ เพราะใบเก่าทุกใบเขียนแบบนี้
// ถ้าใส่แค่ 'Zinc sulphate' ใบใหม่จะกลายเป็นคนละชื่อกับใบเก่าเวลาค้นหรือจัดกลุ่ม
//
// เลขล็อตในวงเล็บบนกระดาษเปลี่ยนทุกรอบผลิต จึงไม่ใส่ไว้ในตัวเลือก
// ==============================================================================
const DRUG_SAMPLE_LIST = [
  'Zinc sulphate solution',
  'Trace element',
  'Magnesium Chloride',
  'Phosphate solution'
];

/** วาง datalist ไว้ครั้งเดียวในหน้า ให้ทุกแถวใช้ร่วมกัน */
function ensureDrugDatalist() {
  if (document.getElementById('drug-sample-list')) return;
  const dl = document.createElement('datalist');
  dl.id = 'drug-sample-list';
  dl.innerHTML = DRUG_SAMPLE_LIST.map(d => '<option value="' + d + '"></option>').join('');
  document.body.appendChild(dl);
}

/** เติมชื่อยามาตรฐานลงทุกแถวตามลำดับในแบบฟอร์มกระดาษ */
function fillStandardDrugList() {
  const inputs = document.querySelectorAll('.sub-item-drug');
  if (!inputs.length) return;
  inputs.forEach((el, i) => {
    if (i < DRUG_SAMPLE_LIST.length) el.value = DRUG_SAMPLE_LIST[i];
  });
  if (window.Swal) {
    Swal.fire({ icon: 'success', title: 'เติมรายการยาแล้ว',
      text: 'เติม ' + Math.min(inputs.length, DRUG_SAMPLE_LIST.length) + ' รายการตามลำดับในแบบฟอร์ม แก้ไขแต่ละช่องได้',
      timer: 1800, showConfirmButton: false });
  }
}

Object.assign(window, { DRUG_SAMPLE_LIST, fillStandardDrugList, ensureDrugDatalist });


// ==============================================================================
// รายการยาเตรียมประจำ (DRG-08 ยาผลิตปราศจากเชื้อ)
// ------------------------------------------------------------------------------
// คัดจากแบบฟอร์มกระดาษของหน่วยงาน เรียงตามลำดับเดิม
// ใช้เป็นตัวเลือกทั้งช่อง "ยาเตรียม" ของแต่ละแถว และช่องหัวตาราง
//
// เป็นคนละชุดกับ DRUG_SAMPLE_LIST ของ DRG-07 สองหน่วยงานส่งยาคนละกลุ่มกัน
// ใช้ datalist ไม่ใช่ select เพราะรายการยาเปลี่ยนได้ ไม่ควรบังคับให้เลือกเฉพาะที่มี
// ==============================================================================
const PREPARED_MEDICINE_LIST = [
  'ACTH',
  'Amikacin',
  'Cefotaxime',
  'Gentamicin',
  'Norepinephrine',
  'Vancomycin',
  'Heparin 4 U',
  'Heparin 100 U',
  'TPN-S',
  'Insulin ED'
];

/**
 * เติมตัวเลือกลง datalist ที่มีอยู่แล้วในหน้า (ถ้าไม่มีก็สร้างให้)
 * รายชื่อยาเก็บไว้ที่เดียวในไฟล์นี้ ไม่ได้เขียนซ้ำใน HTML
 */
function ensurePreparedMedicineDatalist() {
  let dl = document.getElementById('prepared-medicine-list');
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = 'prepared-medicine-list';
    document.body.appendChild(dl);
  }
  if (dl.children.length) return;   // เติมไว้แล้ว
  dl.innerHTML = PREPARED_MEDICINE_LIST.map(d => '<option value="' + d + '"></option>').join('');
}

/** เติมชื่อยาเตรียมลงทุกแถวตามลำดับในแบบฟอร์มกระดาษ */
function fillStandardPreparedMedicineList() {
  const inputs = document.querySelectorAll('.sub-item-drug2');
  if (!inputs.length) return;
  inputs.forEach((el, i) => {
    if (i < PREPARED_MEDICINE_LIST.length) el.value = PREPARED_MEDICINE_LIST[i];
  });
  if (window.Swal) {
    Swal.fire({ icon: 'success', title: 'เติมรายการยาเตรียมแล้ว',
      text: 'เติม ' + Math.min(inputs.length, PREPARED_MEDICINE_LIST.length) + ' รายการตามลำดับในแบบฟอร์ม แก้ไขแต่ละช่องได้',
      timer: 1800, showConfirmButton: false });
  }
}

Object.assign(window, { PREPARED_MEDICINE_LIST, fillStandardPreparedMedicineList, ensurePreparedMedicineDatalist });

// ==============================================================================
// ROLE CHECK & TAB NAVIGATION (เห็นแท็บลงผลเฉพาะ ADMIN)
// ==============================================================================
// ROLE CHECK & TAB NAVIGATION (เห็นแท็บลงผลเฉพาะ ADMIN)
// ==============================================================================
async function checkUserRoleAndInitTabs() {
  if (window.AuthManager) {
    currentLoggedUser = await window.AuthManager.getCurrentUser();
  }

  const isAdmin = (currentLoggedUser && (currentLoggedUser.role === 'admin' || currentLoggedUser.username === 'admin'));
  const adminTabPill = document.getElementById('tab-pill-result-grid');
  const userBanner = document.getElementById('workflow-user-banner');
  const adminDeptFilterContainer = document.getElementById('admin-dept-filter-container');

  if (isAdmin) {
    if (adminTabPill) adminTabPill.classList.remove('hidden');
    if (adminDeptFilterContainer) adminDeptFilterContainer.classList.remove('hidden');
    if (userBanner) {
      userBanner.innerHTML = `
        <div class="inline-flex items-center gap-2 bg-[#fefaf0] text-[#b8860b] text-xs px-3.5 py-1.5 rounded-full border border-[#fde8a8]">
          <span class="w-2 h-2 rounded-full bg-[#f9d56e] animate-pulse"></span>
          <span>เข้าสู่ระบบ: <strong>ADMIN MASTER</strong> (สิทธิ์ลงผลตรวจ Data Grid & ดูทุกหน่วยงาน)</span>
        </div>
      `;
    }
  } else {
    if (adminTabPill) adminTabPill.classList.add('hidden');
    if (adminDeptFilterContainer) adminDeptFilterContainer.classList.add('hidden');
    if (userBanner && currentLoggedUser) {
      userBanner.innerHTML = `
        <div class="inline-flex items-center gap-2 bg-[#f7f2f8] text-[#6c5070] text-xs px-3.5 py-1.5 rounded-full border border-[#6c5070]/20">
          <i class="fas fa-building text-[#df6a6a]"></i>
          <span>เข้าสู่ระบบ: <strong>${currentLoggedUser.department || currentLoggedUser.displayName}</strong></span>
        </div>
      `;
    }
  }

  // ตรวจสอบ URL Search Params (เช่น ?tab=calendar, ?tab=submission, ?service=DRG-08, ?service=WTM-05)
  const urlParams = (typeof window !== 'undefined' && window.location && typeof URLSearchParams !== 'undefined') 
    ? new URLSearchParams(window.location.search) 
    : { get: (k) => null };
  const targetService = urlParams.get('service');
  let targetTab = urlParams.get('tab') || (targetService ? 'submission' : 'calendar');

  // ถ้าไม่ใช่ Admin แต่ระบุแท็บ result-grid ให้บังคับกลับไปที่ calendar
  if (targetTab === 'result-grid' && !isAdmin) {
    targetTab = 'calendar';
  }

  if (targetService) {
    const srvMap = {
      'str': 'STR_02',
      'str-02': 'STR_02',
      'str_02': 'STR_02',
      'bloodbank': 'STR_02',
      'blood': 'STR_02',
      'air': 'AIR_01',
      'air-01': 'AIR_01',
      'air_01': 'AIR_01',
      'occ': 'AIR_01',
      'wts': 'WTS_03',
      'wts-03': 'WTS_03',
      'wts_03': 'WTS_03',
      'water': 'WTS_03',
      'surface': 'WTS_03',
      'icn': 'WTS_03',
      'or': 'WTO_04',
      'wto': 'WTO_04',
      'wto-04': 'WTO_04',
      'wto_04': 'WTO_04',
      'thamc': 'WTM_05',
      'wtm': 'WTM_05',
      'wtm-05': 'WTM_05',
      'wtm_05': 'WTM_05',
      'food': 'FOD_06',
      'fod': 'FOD_06',
      'fod-06': 'FOD_06',
      'fod_06': 'FOD_06',
      'nutrition': 'FOD_06',
      'drg': 'DRG_07',
      'drg-07': 'DRG_07',
      'drg_07': 'DRG_07',
      'drg-08': 'DRG_08',
      'drg_08': 'DRG_08',
      'drug': 'DRG_07',
      'drug1': 'DRG_07',
      'drug2': 'DRG_08',
      'pharma': 'DRG_08',
      'pharma1': 'DRG_07',
      'pharma2': 'DRG_08',
      'compounding': 'DRG_07',
      'bioburden': 'DRG_08',
      'ผลิตยา': 'DRG_07',
      'ผลิตยา1': 'DRG_07',
      'ผลิตยา2': 'DRG_08',
      'ยาผลิตปราศจากเชื้อ': 'DRG_08'
    };
    const mappedSrv = srvMap[targetService.toLowerCase()] || targetService.toUpperCase();
    const srvSelect = document.getElementById('sub-service-select');
    if (srvSelect) {
      srvSelect.value = mappedSrv;
      onServiceSelectionChange();
    }
  }

  switchWorkflowTab(targetTab);
}

function switchWorkflowTab(tabName) {
  const isAdmin = (currentLoggedUser && (currentLoggedUser.role === 'admin' || currentLoggedUser.username === 'admin'));

  if (tabName === 'result-grid') {
    if (!isAdmin) {
      Swal.fire({
        icon: 'warning',
        title: 'เฉพาะผู้ดูแลระบบ (Admin Only)',
        text: 'หน้าลงผลการตรวจวิเคราะห์สงวนสิทธิ์เฉพาะผู้ดูแลระบบห้องปฏิบัติการเท่านั้น',
        confirmButtonColor: '#6c5070',
        customClass: { popup: 'k-swal' }
      });
      tabName = 'calendar';
    }
  }

  currentActiveTab = tabName;

  const tabPills = {
    'calendar': document.getElementById('tab-pill-calendar'),
    'submission': document.getElementById('tab-pill-submission'),
    'reports': document.getElementById('tab-pill-reports'),
    'result-grid': document.getElementById('tab-pill-result-grid')
  };

  const panels = {
    'calendar': document.getElementById('panel-calendar'),
    'submission': document.getElementById('panel-submission'),
    'reports': document.getElementById('panel-reports'),
    'result-grid': document.getElementById('panel-result-grid')
  };

  Object.keys(tabPills).forEach(key => {
    const pill = tabPills[key];
    if (pill) {
      if (key === 'result-grid') {
        if (!isAdmin) {
          pill.className = 'hidden';
          return;
        }
      }

      if (key === tabName) {
        pill.className = 'step-pill flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#6c5070] text-white font-bold shadow-sm transition text-xs';
      } else {
        pill.className = 'step-pill flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-[#f7f2f8] text-[#78687e] font-semibold transition text-xs border border-slate-200';
      }
    }
  });

  Object.keys(panels).forEach(key => {
    const p = panels[key];
    if (p) {
      if (key === 'result-grid' && !isAdmin) {
        p.classList.add('hidden');
        return;
      }

      if (key === tabName) {
        p.classList.remove('hidden');
      } else {
        p.classList.add('hidden');
      }
    }
  });

  if (tabName === 'calendar') {
    renderCalendar(calYear, calMonth);
  } else if (tabName === 'submission') {
    const countInput = document.getElementById('sub-sample-count');
    const sampleCount = parseInt(countInput?.value || '10', 10);
    buildSampleItemsMatrix(sampleCount);
  } else if (tabName === 'reports') {
    loadReportsArchiveTable();
  } else if (tabName === 'result-grid' && isAdmin) {
    loadWaitingQueueIntoGrid();
  }
}
window.switchWorkflowTab = switchWorkflowTab;

async function initBookingCalendar() {
  try {
    cachedHolidays = await window.MasterDB.getHolidays();
  } catch (e) {
    cachedHolidays = [];
  }

  initCalendarControls();
  await renderCalendar(calYear, calMonth);
}

function initCalendarControls() {
  const prevBtn = document.getElementById('prev-month-btn');
  const nextBtn = document.getElementById('next-month-btn');
  const todayBtn = document.getElementById('today-btn');
  const refreshBtn = document.getElementById('refresh-calendar-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      calMonth--;
      if (calMonth < 1) {
        calMonth = 12;
        calYear--;
      }
      renderCalendar(calYear, calMonth);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      calMonth++;
      if (calMonth > 12) {
        calMonth = 1;
        calYear++;
      }
      renderCalendar(calYear, calMonth);
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const now = new Date();
      calYear = now.getFullYear();
      calMonth = now.getMonth() + 1;
      renderCalendar(calYear, calMonth);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      renderCalendar(calYear, calMonth);
    });
  }
}

async function renderCalendar(year, month) {
  const titleEl = document.getElementById('calendar-month-title') || document.getElementById('calendar-month-year');
  const gridEl = document.getElementById('calendar-days-grid');
  if (!gridEl) return;

  const thaiYear = year + 543;
  if (titleEl) {
    titleEl.textContent = `${THAI_MONTHS[month - 1]} ${thaiYear}`;
  }

  gridEl.innerHTML = `
    <div class="col-span-7 p-12 text-center text-[#78687e]">
      <i class="fas fa-spinner fa-spin text-3xl mb-3 text-[#6c5070]"></i>
      <p class="text-xs font-bold">กำลังโหลดข้อมูลปฏิทินส่งตรวจ...</p>
    </div>
  `;

  try {
    if (!cachedHolidays || cachedHolidays.length === 0) {
      cachedHolidays = window.MasterDB ? await window.MasterDB.getHolidays() : [];
    }
  } catch (e) {
    cachedHolidays = [];
  }

  try {
    cachedBookings = window.BookingDB ? await window.BookingDB.getBookingsByMonth(year, month) : [];
  } catch (e) {
    cachedBookings = [];
  }

  const firstDayIndex = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  let html = '';

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevDay = daysInPrevMonth - i;
    html += `
      <div class="min-h-[90px] sm:min-h-[110px] p-2.5 bg-slate-100/40 border border-slate-200/50 rounded-2xl sm:rounded-3xl opacity-35 cursor-not-allowed flex flex-col justify-between">
        <span class="text-xs text-slate-400 font-semibold">${prevDay}</span>
        <div class="text-[10px] text-slate-300 text-center">-</div>
      </div>
    `;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;

    const holiday = cachedHolidays.find(h => h.holiday_date === dateStr);
    const isHoliday = !!holiday;

    // เปิดรับตรวจวันจันทร์ - ศุกร์ ที่ไม่ใช่วันหยุดราชการ (เสาร์-อาทิตย์ ปิดทำการ)
    // เปิดรับส่งตรวจเฉพาะ จันทร์ - พุธ
    const isOpenDay = (dayOfWeek >= 1 && dayOfWeek <= 3) && !isHoliday;
    const dayBookings = cachedBookings.filter(b => b.booking_date === dateStr && b.status !== 'cancelled');
    const bookingCount = dayBookings.length;

    if (isPast) {
      html += `
        <div class="min-h-[95px] sm:min-h-[115px] p-2.5 sm:p-3 bg-[#f3f4f6]/85 border border-slate-200/90 rounded-2xl sm:rounded-3xl cursor-not-allowed flex flex-col justify-between opacity-60 select-none shadow-2xs" 
             title="วันที่ ${d} ผ่านไปแล้ว (ระบบล็อคอัตโนมัติ - ไม่สามารถจองหรือแก้ไขได้)">
          
          <div class="flex items-center justify-between">
            <span class="text-xs sm:text-sm font-bold text-slate-400">
              ${d}
            </span>
            <span class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-200/90 border border-slate-300/70 px-2 py-0.5 rounded-full">
              <i class="fas fa-lock text-[8px] text-slate-400"></i>
              <span>ผ่านแล้ว</span>
            </span>
          </div>

          <div class="my-1 text-center">
            ${bookingCount > 0 
              ? `<div class="text-[10px] text-slate-600 font-semibold bg-slate-200/70 rounded-xl px-2 py-0.5 border border-slate-300/50 truncate"><i class="fas fa-clipboard-check text-[9px] mr-1 text-slate-500"></i>จองแล้ว ${bookingCount} คิว</div>` 
              : `<span class="text-[10px] text-slate-400 font-medium">ปิดรอบรับตรวจ</span>`}
          </div>

          <div class="text-[10px] text-center font-medium text-slate-400 pt-1 border-t border-slate-200/80 flex items-center justify-center gap-1">
            <i class="fas fa-lock text-[8px]"></i>
            <span>ล็อควันในอดีต</span>
          </div>
        </div>
      `;
    } else if (isOpenDay) {
      if (bookingCount > 0) {
        html += `
          <div onclick="handleDayClick('${dateStr}', '${d} ${THAI_MONTHS[month - 1]} ${thaiYear}')" 
               class="min-h-[95px] sm:min-h-[115px] p-2.5 sm:p-3 bg-[#fff8f8] hover:bg-[#ffefef] border border-[#f9d2d2] hover:border-[#df6a6a] rounded-2xl sm:rounded-3xl shadow-2xs hover:shadow-md hover:scale-[1.02] transition cursor-pointer flex flex-col justify-between group ${isToday ? 'ring-2 ring-[#df6a6a]' : ''}" 
               title="มีการจองแล้ว ${bookingCount} คิว (คลิกดูรายละเอียด / จองเพิ่ม)">
            
            <div class="flex items-center justify-between">
              <span class="text-xs sm:text-sm font-black ${isToday ? 'w-6 h-6 rounded-full bg-[#df6a6a] text-white flex items-center justify-center text-xs' : 'text-[#7a272b]'}">
                ${d}
              </span>
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-[#df6a6a] bg-[#fdf0f0] border border-[#f9d2d2] px-2 py-0.5 rounded-full">
                <span class="w-1.5 h-1.5 rounded-full bg-[#df6a6a] animate-pulse"></span>
                <span>มีการจอง</span>
              </span>
            </div>

            <div class="my-1">
              <div class="text-[11px] font-bold text-[#7a272b] bg-[#fce8e8] border border-[#f8c4c4] rounded-xl px-2 py-0.5 text-center truncate">
                <i class="fas fa-clipboard-check text-[10px] mr-1 text-[#df6a6a]"></i>จอง ${bookingCount} คิว
              </div>
            </div>

            <div class="text-[10px] text-center font-bold text-[#df6a6a] group-hover:underline pt-1 border-t border-[#f9d2d2] flex items-center justify-center gap-1">
              <span>จองเพิ่ม / ดูคิว</span>
              <i class="fas fa-chevron-right text-[8px] transform group-hover:translate-x-0.5 transition"></i>
            </div>
          </div>
        `;
      } else {
        html += `
          <div onclick="handleDayClick('${dateStr}', '${d} ${THAI_MONTHS[month - 1]} ${thaiYear}')" 
               class="min-h-[95px] sm:min-h-[115px] p-2.5 sm:p-3 bg-[#fbfdfb] hover:bg-[#f2f8f2] border border-[#c2dbc1] hover:border-[#527c51] rounded-2xl sm:rounded-3xl shadow-2xs hover:shadow-md hover:scale-[1.02] transition cursor-pointer flex flex-col justify-between group ${isToday ? 'ring-2 ring-emerald-500' : ''}" 
               title="ว่าง (เปิดรับส่งตรวจ - คลิกเพื่อจองคิว)">
            
            <div class="flex items-center justify-between">
              <span class="text-xs sm:text-sm font-black ${isToday ? 'w-6 h-6 rounded-full bg-[#527c51] text-white flex items-center justify-center text-xs' : 'text-[#285b2a]'}">
                ${d}
              </span>
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-[#285b2a] bg-[#d4edda] border border-[#c3e6cb] px-2 py-0.5 rounded-full">
                <span class="w-1.5 h-1.5 rounded-full bg-[#285b2a]"></span>
                <span>ว่าง</span>
              </span>
            </div>

            <div class="my-1 text-center">
              <span class="text-[11px] text-[#467345] font-semibold">
                พร้อมรับส่งตรวจ
              </span>
            </div>

            <div class="text-[10px] text-center font-bold text-[#3d5e3c] group-hover:text-[#285b2a] transition pt-1 border-t border-[#c2dbc1]/50 flex items-center justify-center gap-1">
              <i class="fas fa-plus text-[9px]"></i>
              <span>คลิกเพื่อจอง</span>
            </div>
          </div>
        `;
      }
    } else {
      const holidayName = isHoliday ? (holiday.holiday_name || 'วันหยุดนักขัตฤกษ์') : 'วันหยุดประจำสัปดาห์ (ส.-อา.)';
      const badgeText = isHoliday ? 'วันหยุด' : 'ปิดทำการ';

      html += `
        <div class="min-h-[95px] sm:min-h-[115px] p-2.5 sm:p-3 bg-[#f8f9fa] border border-[#eaedf0] rounded-2xl sm:rounded-3xl cursor-default flex flex-col justify-between text-[#6c757d]" 
             title="${holidayName}">
          
          <div class="flex items-center justify-between">
            <span class="text-xs sm:text-sm font-bold text-[#94a3b8]">
              ${d}
            </span>
            <span class="inline-flex items-center gap-1 text-[10px] font-bold text-[#64748b] bg-[#eaedf0] border border-[#d6dadf] px-2 py-0.5 rounded-full">
              <span>${badgeText}</span>
            </span>
          </div>

          <div class="my-1 text-center">
            <p class="text-[10px] sm:text-[11px] text-[#94a3b8] font-medium line-clamp-2 leading-tight">
              ${holidayName}
            </p>
          </div>

          <div class="text-[10px] text-center font-medium text-[#94a3b8] pt-1 border-t border-slate-200/60">
            <i class="fas fa-lock text-[9px] mr-1"></i>ไม่เปิดรับตรวจ
          </div>
        </div>
      `;
    }
  }

  const trailingEmptyDays = (7 - ((firstDayIndex + daysInMonth) % 7)) % 7;
  for (let nextD = 1; nextD <= trailingEmptyDays; nextD++) {
    html += `
      <div class="min-h-[90px] sm:min-h-[110px] p-2.5 bg-slate-100/40 border border-slate-200/50 rounded-2xl sm:rounded-3xl opacity-35 cursor-not-allowed flex flex-col justify-between">
        <span class="text-xs text-slate-400 font-semibold">${nextD}</span>
        <div class="text-[10px] text-slate-300 text-center">-</div>
      </div>
    `;
  }

  gridEl.innerHTML = html;
}

window.prevMonth = () => {
  calMonth--;
  if (calMonth < 1) {
    calMonth = 12;
    calYear--;
  }
  renderCalendar(calYear, calMonth);
};

window.nextMonth = () => {
  calMonth++;
  if (calMonth > 12) {
    calMonth = 1;
    calYear++;
  }
  renderCalendar(calYear, calMonth);
};

window.goToToday = () => {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth() + 1;
  renderCalendar(calYear, calMonth);
};

window.refreshCalendar = () => {
  renderCalendar(calYear, calMonth);
};

async function handleDayClick(dateStr, thaiDateStr) {
  const todayStr = new Date().toISOString().split('T')[0];
  if (dateStr < todayStr) {
    Swal.fire({
      icon: 'info',
      title: 'วันที่ผ่านไปแล้ว',
      text: 'ไม่สามารถจองคิวหรือแก้ไขวันส่งตรวจในอดีตได้ เนื่องจากวันดังกล่าวได้ผ่านไปแล้ว',
      confirmButtonColor: '#6c5070',
      customClass: { popup: 'k-swal' }
    });
    return;
  }

  // ต้องเขียนกลับเข้า currentLoggedUser ด้วย ไม่ใช่เก็บไว้ในตัวแปรของตัวเอง
  // เพราะ canManageReport / canManageBooking อ่านจากตัวแปรส่วนกลางตัวนี้
  // ถ้าฟังก์ชันนี้ทำงานก่อน checkUserRoleAndInitTabs() ตัวแปรส่วนกลางจะยังเป็น null
  // ผลคือรายการแสดงครบแต่ปุ่มจัดการหายไปทั้งตาราง
  if (!currentLoggedUser && window.AuthManager) {
    currentLoggedUser = await window.AuthManager.getCurrentUser();
  }
  const user = currentLoggedUser;
  let defaultDept = user?.department || '';
  let defaultSender = user?.displayName || user?.name || '';
  let defaultService = 'AIR_01';
  let defaultPhone = user?.contactNumber || user?.phone || '02-926-9460';

  if (user) {
    if (user.username === 'thamc') {
      defaultService = 'WTM_05';
      defaultDept = defaultDept || 'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)';
      defaultSender = defaultSender || 'เจ้าหน้าที่ศูนย์การแพทย์ (THAMC)';
      defaultPhone = defaultPhone || '9510';
    } else if (user.username === 'or') {
      defaultService = 'WTO_04';
      defaultDept = defaultDept || 'ห้องผ่าตัด (OR)';
      defaultSender = defaultSender || 'เจ้าหน้าที่ห้องผ่าตัด';
      defaultPhone = defaultPhone || '9420';
    } else if (user.username === 'nutrition') {
      defaultService = 'FOD_06';
      defaultDept = defaultDept || 'งานโภชนาการ';
      defaultSender = defaultSender || 'เจ้าหน้าที่โภชนาการ';
      defaultPhone = defaultPhone || '8406';
    } else if (user.username === 'compounding') {
      defaultService = 'DRG_07';
      defaultDept = defaultDept || 'งานผลิตยา';
      defaultSender = defaultSender || 'เจ้าหน้าที่งานผลิตยา';
      defaultPhone = defaultPhone || '9907';
    } else if (user.username === 'pharma') {
      defaultService = 'DRG_08';
      defaultDept = defaultDept || 'ยาผลิตปราศจากเชื้อ';
      defaultSender = defaultSender || 'เจ้าหน้าที่ยาผลิตปราศจากเชื้อ';
      defaultPhone = defaultPhone || '9907';
    } else if (user.username === 'bloodbank') {
      defaultService = 'STR_02';
      defaultDept = defaultDept || 'งานธนาคารเลือด';
      defaultSender = defaultSender || 'เจ้าหน้าที่ธนาคารเลือด';
      defaultPhone = defaultPhone || '9863';
    } else if (user.username === 'icn') {
      defaultService = 'WTS_03';
      defaultDept = defaultDept || 'งานควบคุมโรคติดเชื้อ (IC)';
      defaultSender = defaultSender || 'เจ้าหน้าที่ควบคุมโรคติดเชื้อ';
      defaultPhone = defaultPhone || '9341';
    } else if (user.username === 'occ') {
      defaultService = 'AIR_01';
      defaultDept = defaultDept || 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร';
      defaultSender = defaultSender || 'เจ้าหน้าที่อาชีวอนามัย';
      defaultPhone = defaultPhone || '02-926-9460';
    } else if (user.serviceCode) {
      defaultService = user.serviceCode;
    }
  }

  const dayBookings = cachedBookings.filter(b => b.booking_date === dateStr && b.status !== 'cancelled');
  const count = dayBookings.length;

  let existingBookingsHtml = '';
  if (count > 0) {
    existingBookingsHtml = `
      <div class="bg-[#faf7f5] border border-[#6c5070]/15 rounded-2xl p-3.5 space-y-2 mb-3">
        <div class="flex items-center justify-between text-xs font-bold text-[#342838]">
          <span><i class="fas fa-list-check text-[#df6a6a] mr-1"></i> รายการจองในวันนี้ (${count} คิว):</span>
          <span class="text-[10px] bg-[#fad5d7] text-[#7a272b] px-2 py-0.5 rounded-full font-black">มีการจอง</span>
        </div>
        <div class="max-h-36 overflow-y-auto space-y-1.5 text-[11px] pr-1">
          ${dayBookings.map((b, idx) => `
            <div class="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <span class="font-bold text-[#6c5070]">${idx + 1}. ${b.department}</span>
                <span class="text-[#78687e] block text-[10px]">${b.service_name || b.service_code} (${b.sample_count || 1} ตัวอย่าง)</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <span class="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">${b.contact_number || '-'}</span>
                ${canManageBooking(b) ? `
                  <button type="button" onclick="webEditBooking('${b.id}')" title="แก้ไขคิวนี้"
                          class="w-6 h-6 rounded-lg border border-slate-300 text-slate-500 hover:text-[#6c5070] hover:border-[#6c5070]/50 transition">
                    <i class="fas fa-pen text-[9px]"></i></button>
                  <button type="button" onclick="webCancelBooking('${b.id}')" title="ยกเลิกคิวนี้"
                          class="w-6 h-6 rounded-lg border border-slate-300 text-slate-500 hover:text-rose-600 hover:border-rose-300 transition">
                    <i class="fas fa-xmark text-[9px]"></i></button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  Swal.fire({
    title: `<div class="text-left"><div class="text-xs text-[#df6a6a] font-bold">ปฏิทินจองวันส่งตรวจสิ่งแวดล้อม</div><div class="text-base font-bold text-[#342838] mt-0.5">${thaiDateStr}</div></div>`,
    html: `
      ${existingBookingsHtml}
      <form id="swal-booking-form" class="text-left text-xs font-sans space-y-3 pt-1">
        <div>
          <label class="block font-bold text-[#342838] mb-1">ชื่อ-สกุล ผู้ส่งตรวจ <span class="text-[#df6a6a]">*</span></label>
          <input type="text" id="bk-sender-name" class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" placeholder="ระบุชื่อและตำแหน่ง" value="${defaultSender}" required>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-[#342838] mb-1">หน่วยงานส่งตรวจ <span class="text-[#df6a6a]">*</span></label>
            <input type="text" id="bk-department" class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" placeholder="ระบุหน่วยงาน" value="${defaultDept}" required>
          </div>
          <div>
            <label class="block font-bold text-[#342838] mb-1">เบอร์โทรศัพท์ติดต่อ</label>
            <input type="tel" id="bk-contact" class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" placeholder="เช่น 02-926-9460 หรือเบอร์ภายใน" value="${defaultPhone}">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-[#342838] mb-1">บริการส่งตรวจ <span class="text-[#df6a6a]">*</span></label>
            <select id="bk-service" class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-[#342838] focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" required>
              <option value="AIR_01" ${defaultService === 'AIR_01' ? 'selected' : ''}>AIR-01 : Air Sampling</option>
              <option value="STR_02" ${defaultService === 'STR_02' ? 'selected' : ''}>STR-02 : Sterility Test</option>
              <option value="WTS_03" ${defaultService === 'WTS_03' ? 'selected' : ''}>WTS-03 : Water or Surface (IC)</option>
              <option value="WTO_04" ${defaultService === 'WTO_04' ? 'selected' : ''}>WTO-04 : Water (OR)</option>
              <option value="WTM_05" ${defaultService === 'WTM_05' ? 'selected' : ''}>WTM-05 : Water (THAMC)</option>
              <option value="FOD_06" ${defaultService === 'FOD_06' ? 'selected' : ''}>FOD-06 : Food Sanitation</option>
              <option value="DRG_07" ${defaultService === 'DRG_07' ? 'selected' : ''}>DRG_07 : Drug (ปลอดเชื้อ)</option>
              <option value="DRG_08" ${defaultService === 'DRG_08' ? 'selected' : ''}>DRG_08 : Drug (การปนเปื้อน)</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-[#342838] mb-1">จำนวนสิ่งส่งตรวจ (ชิ้น)</label>
            <input type="number" id="bk-sample-count" min="1" max="200" value="10" class="w-full px-3 py-2.5 bg-[#f7f2f8] border border-[#6c5070]/20 rounded-2xl text-xs font-bold text-[#6c5070] focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" required>
          </div>
        </div>

        <div>
          <label class="block font-bold text-[#342838] mb-1">หมายเหตุ / จุดที่เข้าไปวางเพลต</label>
          <input type="text" id="bk-notes" class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" placeholder="เช่น หอผู้ป่วย ICU, ตรวจประจำเดือน, Big Cleaning">
        </div>
      </form>
    `,
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-check mr-1"></i> ยืนยันการจองวัน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#6c5070',
    cancelButtonColor: '#78687e',
    customClass: { popup: 'k-swal' },
    preConfirm: () => {
      const sender = document.getElementById('bk-sender-name').value.trim();
      const dept = document.getElementById('bk-department').value.trim();
      const phone = document.getElementById('bk-contact').value.trim() || defaultPhone || '-';
      const service = document.getElementById('bk-service').value;
      const count = parseInt(document.getElementById('bk-sample-count').value, 10) || 1;
      const notes = document.getElementById('bk-notes').value.trim();

      if (!sender || !dept || !service) {
        Swal.showValidationMessage('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
        return false;
      }

      const srvObj = window.SERVICES_CONFIG[service] || { name: service };

      return {
        booking_date: dateStr,
        sender_name: sender,
        department: dept,
        contact_number: phone,
        service_code: service,
        service_name: srvObj.name,
        sample_count: count,
        notes: notes,
        status: 'confirmed'
      };
    }
  }).then(async (result) => {
    if (result.isConfirmed && result.value) {
      const bookingData = result.value;

      Swal.fire({
        title: 'กำลังบันทึกการจอง...',
        html: '<div class="text-xs text-[#78687e] mt-1">กรุณารอสักครู่ ระบบกำลังบันทึกข้อมูลและส่งแจ้งเตือน</div>',
        allowOutsideClick: false,
        customClass: { popup: 'k-swal' },
        didOpen: () => Swal.showLoading()
      });

      await window.BookingDB.createBooking(bookingData);
      await renderCalendar(calYear, calMonth);

      // ส่งแจ้งเตือนทั้ง LINE และ Telegram
      if (window.NotifyService) {
        window.NotifyService.sendBookingNotification(bookingData).catch(e => console.warn(e));
      } else {
        sendWebhookNotification({
          title: `📅 จองวันส่งตรวจใหม่ [${bookingData.service_name}]`,
          message: `หน่วยงาน: ${bookingData.department}\nผู้ส่ง: ${bookingData.sender_name} (${bookingData.contact_number})\nวันที่นัดหมาย: ${dateStr}\nจำนวน: ${bookingData.sample_count} ชิ้น`
        }).catch(e => console.warn(e));
      }

      Swal.fire({
        icon: 'success',
        title: 'จองวันส่งตรวจสำเร็จ!',
        html: `
          <div class="text-xs text-[#78687e] space-y-2 text-left bg-[#faf7f5] p-3.5 rounded-2xl border border-[#6c5070]/15 mt-2">
            <div>วันที่นัดหมาย: <strong class="text-[#6c5070] font-bold">${dateStr}</strong></div>
            <div>หน่วยงาน: <strong class="text-[#342838]">${result.value.department}</strong></div>
            <div>บริการ: <strong class="text-[#df6a6a]">${result.value.service_name}</strong> (${result.value.sample_count} ชิ้น)</div>
          </div>
          <p class="text-xs text-[#6c5070] font-semibold mt-3">ท่านต้องการกรอกแบบฟอร์มส่งตรวจต่อทันทีเลยหรือไม่?</p>
        `,
        confirmButtonText: '<i class="fas fa-file-pen mr-1"></i> ไปกรอกแบบฟอร์มส่งตรวจ (Tab 2) ➔',
        confirmButtonColor: '#6c5070',
        showCancelButton: true,
        cancelButtonText: 'ปิด',
        cancelButtonColor: '#78687e',
        customClass: { popup: 'k-swal' }
      }).then(r => {
        if (r.isConfirmed) {
          const deptInput = document.getElementById('sub-department');
          if (deptInput) {
            const dateInput = document.getElementById('sub-sampling-date');
            const srvSelect = document.getElementById('sub-service-select');
            const countInput = document.getElementById('sub-sample-count');

            deptInput.value = result.value.department;
            if (dateInput) dateInput.value = dateStr;
            if (srvSelect) srvSelect.value = result.value.service_code;
            if (countInput) countInput.value = result.value.sample_count;

            buildSampleItemsMatrix(result.value.sample_count);
            switchWorkflowTab('submission');
          } else {
            window.location.href = `workflow.html?tab=submission&service=${result.value.service_code}&date=${dateStr}&dept=${encodeURIComponent(result.value.department)}`;
          }
        }
        renderCalendar(calYear, calMonth);
      });
    }
  });
}
window.handleDayClick = handleDayClick;

// ==============================================================================
// 2. แบบฟอร์มส่งตรวจ (SAMPLE SUBMISSION FORM)
// ==============================================================================
function onDepartmentSelectChange(dept) {
  const hiddenDept = document.getElementById('sub-department');
  if (hiddenDept) hiddenDept.value = dept;

  const srvSelect = document.getElementById('sub-service-select');
  if (dept === 'งานธนาคารเลือด' && srvSelect) {
    srvSelect.value = 'STR_02';
    onServiceSelectionChange();
  } else if (dept === 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร' && srvSelect) {
    srvSelect.value = 'AIR_01';
    onServiceSelectionChange();
  }
}
window.onDepartmentSelectChange = onDepartmentSelectChange;

function initSubmissionForm() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateInput = document.getElementById('sub-sampling-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }

  const srvSelect = document.getElementById('sub-service-select');
  const countInput = document.getElementById('sub-sample-count');
  const deptSelect = document.getElementById('sub-department-select');
  const deptInput = document.getElementById('sub-department');
  const specimenTypeInput = document.getElementById('sub-specimen-type-input');

  // Check URL parameters e.g. ?service=WTS_03 or ?service=water or ?dept=icn
  const urlParams = (typeof window !== 'undefined' && window.location && typeof URLSearchParams !== 'undefined') ? new URLSearchParams(window.location.search) : { get: () => null };
  const paramService = urlParams.get('service');
  const paramDept = urlParams.get('dept');

  if (paramService) {
    const srvMap = {
      'str': 'STR_02',
      'str_02': 'STR_02',
      'bloodbank': 'STR_02',
      'blood': 'STR_02',
      'air': 'AIR_01',
      'air_01': 'AIR_01',
      'occ': 'AIR_01',
      'wts': 'WTS_03',
      'wts_03': 'WTS_03',
      'water': 'WTS_03',
      'surface': 'WTS_03',
      'icn': 'WTS_03',
      'or': 'WTO_04',
      'wto': 'WTO_04',
      'wto_04': 'WTO_04',
      'thamc': 'WTM_05',
      'wtm': 'WTM_05',
      'wtm_05': 'WTM_05',
      'food': 'FOD_06',
      'fod': 'FOD_06',
      'fod_06': 'FOD_06',
      'nutrition': 'FOD_06',
      'drg': 'DRG_07',
      'drg_07': 'DRG_07',
      'drg_08': 'DRG_08',
      'drug': 'DRG_07',
      'drug1': 'DRG_07',
      'drug2': 'DRG_08',
      'pharma': 'DRG_08',
      'pharma1': 'DRG_07',
      'pharma2': 'DRG_08',
      'compounding': 'DRG_07',
      'bioburden': 'DRG_08',
      'ผลิตยา': 'DRG_07',
      'ผลิตยา1': 'DRG_07',
      'ผลิตยา2': 'DRG_08',
      'ยาผลิตปราศจากเชื้อ': 'DRG_08'
    };
    const mappedSrv = srvMap[paramService.toLowerCase()] || paramService.toUpperCase();
    if (srvSelect) srvSelect.value = mappedSrv;
  } else if (currentLoggedUser && currentLoggedUser.serviceCode) {
    if (srvSelect) srvSelect.value = currentLoggedUser.serviceCode;
  }

  // Auto-Fill Department
  if (paramDept) {
    if (deptSelect) deptSelect.value = paramDept;
    if (deptInput) deptInput.value = paramDept;
  } else if (currentLoggedUser && currentLoggedUser.department) {
    if (deptSelect) deptSelect.value = currentLoggedUser.department;
    if (deptInput) deptInput.value = currentLoggedUser.department;
  } else if (!deptInput?.value) {
    if (srvSelect?.value === 'AIR_01') {
      if (deptInput) deptInput.value = 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร';
    } else if (srvSelect?.value === 'STR_02') {
      if (deptInput) deptInput.value = 'งานธนาคารเลือด';
    } else if (srvSelect?.value === 'WTS_03') {
      if (deptInput) deptInput.value = 'งานควบคุมโรคติดเชื้อ';
    } else if (srvSelect?.value === 'WTO_04') {
      if (deptInput) deptInput.value = 'งานการพยาบาลผู้ป่วยผ่าตัด (ห้องผ่าตัด OR)';
    } else if (srvSelect?.value === 'WTM_05') {
      if (deptInput) deptInput.value = 'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)';
    } else if (srvSelect?.value === 'FOD_06') {
      if (deptInput) deptInput.value = 'งานโภชนาการ';
    } else if (srvSelect?.value === 'DRG_07') {
      if (deptInput) deptInput.value = 'งานผลิตยา';
    } else if (srvSelect?.value === 'DRG_08') {
      if (deptInput) deptInput.value = 'ยาผลิตปราศจากเชื้อ';
    }
  }

  // Auto-Fill Specimen Type
  if (specimenTypeInput && !specimenTypeInput.value) {
    if (srvSelect?.value === 'AIR_01') {
      specimenTypeInput.value = 'อากาศ (Air)';
    } else if (srvSelect?.value === 'STR_02') {
      specimenTypeInput.value = 'น้ำยา/Biological Indicator';
    } else if (srvSelect?.value === 'WTS_03') {
      specimenTypeInput.value = 'พื้นผิว';
    } else if (srvSelect?.value === 'WTO_04') {
      specimenTypeInput.value = 'น้ำห้องผ่าตัด';
    } else if (srvSelect?.value === 'WTM_05') {
      specimenTypeInput.value = 'น้ำล้างไต';
    } else if (srvSelect?.value === 'FOD_06') {
      specimenTypeInput.value = 'อาหาร';
    } else if (srvSelect?.value === 'DRG_08') {
      specimenTypeInput.value = 'ยาเตรียม';
    } else if (srvSelect?.value === 'DRG_07') {
      specimenTypeInput.value = 'ยาปราศจากเชื้อ';
    }
  }

  // Auto-Fill Drug Fields (วันที่เตรียม, วันที่สุ่มตรวจ, ผู้ปฏิบัติงาน, วันที่รับตัวอย่าง, วันที่วิเคราะห์, ผลิตเมื่อวันที่, ผู้ส่งตรวจ)
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const prepDateInput = document.getElementById('sub-prep-date');
  const sampleDateInput = document.getElementById('sub-sample-date');
  const operatorInput = document.getElementById('sub-operator');
  const receiptDateInput = document.getElementById('sub-receipt-date');
  const analysisDateInput = document.getElementById('sub-analysis-date');
  const productionDateInput = document.getElementById('sub-production-date');
  const drugVolumeInput = document.getElementById('sub-drug-volume');
  const senderNameInput = document.getElementById('sub-sender-name');
  const drug2HeaderInput = document.getElementById('sub-drug2-header');

  if (prepDateInput && !prepDateInput.value) prepDateInput.value = todayStr;
  if (sampleDateInput && !sampleDateInput.value) sampleDateInput.value = todayStr;
  if (operatorInput && !operatorInput.value) operatorInput.value = currentLoggedUser?.displayName || currentLoggedUser?.name || '';
  if (receiptDateInput && !receiptDateInput.value) receiptDateInput.value = todayStr;
  if (analysisDateInput && !analysisDateInput.value) analysisDateInput.value = todayStr;
  if (productionDateInput && !productionDateInput.value) productionDateInput.value = todayStr;
  if (drugVolumeInput && !drugVolumeInput.value) drugVolumeInput.value = '0';
  if (senderNameInput && !senderNameInput.value) senderNameInput.value = currentLoggedUser?.displayName || currentLoggedUser?.name || '';

  if (drug2HeaderInput) {
    drug2HeaderInput.addEventListener('input', (e) => {
      const val = e.target.value;
      document.querySelectorAll('.sub-item-drug2').forEach(input => {
        if (!input.value || input.dataset.autofilled === 'true') {
          input.value = val;
          input.dataset.autofilled = 'true';
        }
      });
    });
  }

  // ตัด Auto-Fill Email ออก — ระบบไม่เก็บอีเมลผู้ส่งตรวจแล้ว


  if (countInput) {
    countInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) || 5;
      buildSampleItemsMatrix(Math.min(Math.max(val, 1), 50));
    });
  }

  if (srvSelect) {
    srvSelect.addEventListener('change', onServiceSelectionChange);
    srvSelect.addEventListener('input', onServiceSelectionChange);
  }

  generateSubmissionNo();
  const initialCount = parseInt(countInput?.value || '10', 10);
  buildSampleItemsMatrix(initialCount);
}

/**
 * ส่งออกรายงานผลตรวจเป็นไฟล์ Excel / CSV (UTF-8 BOM สำหรับเปิดใน MS Excel ภาษาไทย)
 */
function exportReportsToCSV() {
  const reports = window.CURRENT_WORKFLOW_REPORTS || [];
  if (reports.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'ไม่มีข้อมูลรายงานสำหรับส่งออก',
      text: 'กรุณาเลือกหรือค้นหารายงานที่ต้องการก่อนดาวน์โหลด',
      confirmButtonColor: '#059669'
    });
    return;
  }

  const headers = ['วันที่ส่งตรวจ', 'เลขที่เอกสาร', 'หน่วยงาน', 'สถานที่/จุดตรวจ', 'ประเภทบริการ', 'จำนวนตัวอย่าง', 'สถานะ', 'ผลสรุป', 'ผู้รายงานผล', 'วันที่รายงาน'];
  
  const rows = reports.map(r => {
    const isTested = !isWaitingReport(r);
    const resultText = ['pass', 'normal', 'no_growth'].includes(r.overall_result?.toLowerCase()) ? 'ผ่านเกณฑ์' : (isTested ? 'ไม่ผ่านเกณฑ์ / พบเชื้อ' : 'รอผลตรวจ');
    const sampleCount = r.sample_count || (r.report_items ? r.report_items.length : (r.items ? r.items.length : 5));
    
    return [
      `"${r.sampling_date || r.formatted_date || '-'}"`,
      `"${r.submission_no || r.id || '-'}"`,
      `"${(r.department || '').replace(/"/g, '""')}"`,
      `"${(r.ward_room || '-').replace(/"/g, '""')}"`,
      `"${(r.service_name || '-').replace(/"/g, '""')}"`,
      sampleCount,
      `"${isTested ? 'ตรวจแล้ว' : 'รอตรวจ'}"`,
      `"${resultText}"`,
      `"${(r.reporter_name || '-').replace(/"/g, '""')}"`,
      `"${r.reported_date || '-'}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', `TUH_Microbiology_Reports_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  Swal.fire({
    icon: 'success',
    title: 'ส่งออกไฟล์ Excel สำเร็จ!',
    text: `ดาวน์โหลดรายงานจำนวน ${reports.length} รายการเรียบร้อยแล้ว`,
    timer: 1500,
    showConfirmButton: false
  });
}
window.exportReportsToCSV = exportReportsToCSV;

/**
 * ตัวย่อหน้าเลขที่เอกสารของแต่ละบริการ (ถอดจากข้อมูลจริงในระบบ)
 * ห้ามใช้ serviceCode.split('_')[0] เพราะ DRG_07 กับ DRG_08 จะได้ 'DRG' ชนกัน
 * ของจริงแยกเป็น DR1 (งานผลิตยา) และ DR2 (ยาผลิตปราศจากเชื้อ)
 */
const SUBMISSION_PREFIX = {
  AIR_01: 'AIR', STR_02: 'STR', WTS_03: 'WTS', WTO_04: 'WTO',
  WTM_05: 'WTM', FOD_06: 'FOD', DRG_07: 'DR1', DRG_08: 'DR2'
};

/**
 * ออกเลขที่ใบส่งตรวจรูปแบบ PREFIX-YYYY-MM-DD-NN  เช่น AIR-2026-08-19-77
 *   YYYY-MM-DD = วันเก็บตัวอย่าง (ถ้ายังไม่กรอก ใช้วันนี้)
 *   NN         = เลขลำดับสะสมของบริการนั้น ต่อจากใบล่าสุดในฐานข้อมูล
 */
async function generateSubmissionNo() {
  const subNoInput = document.getElementById('sub-submission-no');
  const srvSelect = document.getElementById('sub-service-select');
  const dateInput = document.getElementById('sub-sampling-date');
  const serviceCode = srvSelect?.value || 'AIR_01';
  const prefix = SUBMISSION_PREFIX[serviceCode] || serviceCode.split('_')[0];

  const d = dateInput?.value ? new Date(dateInput.value + 'T00:00:00') : new Date();
  const datePart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let next = 1;
  if (window.supabaseClient) {
    try {
      const { data } = await window.supabaseClient
        .from('reports').select('submission_no').like('submission_no', prefix + '-%').limit(1000);
      next = (data || []).reduce((max, r) => {
        const mm = String(r.submission_no).match(/-(\d+)$/);
        return mm ? Math.max(max, parseInt(mm[1], 10)) : max;
      }, 0) + 1;
    } catch (e) {
      console.warn('อ่านเลขล่าสุดไม่ได้ ใช้เลขเริ่มต้นแทน:', e && e.message);
    }
  }

  if (subNoInput) {
    subNoInput.value = `${prefix}-${datePart}-${String(next).padStart(2, '0')}`;
  }
}

function onServiceSelectionChange() {
  generateSubmissionNo();
  const rowCount = parseInt(document.getElementById('sub-sample-count')?.value || '10', 10);
  buildSampleItemsMatrix(rowCount);
}
window.onServiceSelectionChange = onServiceSelectionChange;

function buildSampleItemsMatrix(rowCount = 10) {
  const srvSelect = document.getElementById('sub-service-select');
  const serviceCode = srvSelect ? srvSelect.value : 'WTS_03';
  const thead = document.getElementById('sub-items-thead');
  const tbody = document.getElementById('sub-items-tbody');
  const titleEl = document.getElementById('sub-form-main-title');
  const descEl = document.getElementById('sub-form-main-desc');
  const deptLabel = document.getElementById('sub-dept-label');
  const deptInput = document.getElementById('sub-department');
  const specimenTypeInput = document.getElementById('sub-specimen-type-input');
  const suspectedOrganismContainer = document.getElementById('sub-suspected-organism-container');
  const footerHint = document.getElementById('sub-form-footer-hint');

  if (!tbody) return;

  const defaultDept = currentLoggedUser?.department || '';
  const prepDateContainer = document.getElementById('sub-prep-date-container');
  const sampleDateContainer = document.getElementById('sub-sample-date-container');
  const operatorContainer = document.getElementById('sub-operator-container');

  const receiptDateContainer = document.getElementById('sub-receipt-date-container');
  const analysisDateContainer = document.getElementById('sub-analysis-date-container');
  const drug2HeaderContainer = document.getElementById('sub-drug2-header-container');
  const lotNoContainer = document.getElementById('sub-lot-no-container');
  const productionDateContainer = document.getElementById('sub-production-date-container');
  const volumeContainer = document.getElementById('sub-volume-container');
  const senderNameContainer = document.getElementById('sub-sender-name-container');

  // Toggle Drug Extra Fields
  if (serviceCode === 'DRG_08') {
    receiptDateContainer?.classList.remove('hidden');
    analysisDateContainer?.classList.remove('hidden');
    drug2HeaderContainer?.classList.remove('hidden');
    lotNoContainer?.classList.remove('hidden');
    productionDateContainer?.classList.remove('hidden');
    volumeContainer?.classList.remove('hidden');
    senderNameContainer?.classList.remove('hidden');

    prepDateContainer?.classList.add('hidden');
    sampleDateContainer?.classList.add('hidden');
    operatorContainer?.classList.add('hidden');
  } else if (serviceCode === 'DRG_07') {
    prepDateContainer?.classList.remove('hidden');
    sampleDateContainer?.classList.remove('hidden');
    operatorContainer?.classList.remove('hidden');

    receiptDateContainer?.classList.add('hidden');
    analysisDateContainer?.classList.add('hidden');
    drug2HeaderContainer?.classList.add('hidden');
    lotNoContainer?.classList.add('hidden');
    productionDateContainer?.classList.add('hidden');
    volumeContainer?.classList.add('hidden');
    senderNameContainer?.classList.add('hidden');
  } else {
    prepDateContainer?.classList.add('hidden');
    sampleDateContainer?.classList.add('hidden');
    operatorContainer?.classList.add('hidden');

    receiptDateContainer?.classList.add('hidden');
    analysisDateContainer?.classList.add('hidden');
    drug2HeaderContainer?.classList.add('hidden');
    lotNoContainer?.classList.add('hidden');
    productionDateContainer?.classList.add('hidden');
    volumeContainer?.classList.add('hidden');
    senderNameContainer?.classList.add('hidden');
  }

  // =========================================================================
  // 1A. แบบรายงานผลการวิเคราะห์การปนเปื้อนเชื้อจุลินทรีย์ (DRG_08 - ยาผลิตปราศจากเชื้อ)
  // =========================================================================
  if (serviceCode === 'DRG_08') {
    if (titleEl) {
      titleEl.innerHTML = `<i class="fas fa-flask text-[#df6a6a]"></i> <span>แบบรายงานผลการวิเคราะห์การปนเปื้อนเชื้อจุลินทรีย์</span>`;
    }
    if (descEl) {
      descEl.textContent = 'สำหรับยาผลิตปราศจากเชื้อ โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ';
    }
    if (deptLabel) {
      deptLabel.innerHTML = `หน่วยงานส่งตรวจ <span class="text-[#df6a6a]">*</span>`;
    }
    if (deptInput && !deptInput.value) {
      deptInput.value = 'ยาผลิตปราศจากเชื้อ';
    }
    if (specimenTypeInput && !specimenTypeInput.value) {
      specimenTypeInput.value = 'ยาเตรียม';
    }
    if (suspectedOrganismContainer) {
      suspectedOrganismContainer.classList.add('hidden');
    }
    if (footerHint) {
      // ปุ่มลัดเติมรายการยาตามลำดับในแบบฟอร์มกระดาษ ช่วยให้ไม่ต้องเลือกทีละแถว
      footerHint.innerHTML = `<i class="fas fa-info-circle text-[#6c5070]"></i>
        <span>ช่อง ผลการตรวจเพาะเชื้อที่ 72 ชม. ล็อคไว้สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ</span>
        <button type="button" onclick="fillStandardPreparedMedicineList()"
                class="ml-2 inline-flex items-center gap-1 bg-[#f7f2f8] hover:bg-[#f0e8f2] text-[#6c5070] border border-[#6c5070]/25 text-[11px] font-bold px-3 py-1.5 rounded-xl transition">
          <i class="fas fa-wand-magic-sparkles"></i> เติมรายการยาเตรียมมาตรฐาน ${PREPARED_MEDICINE_LIST.length} รายการ
        </button>`;
    }

    if (thead) {
      thead.className = 'bg-[#f0eaf1] text-[#6c5070] font-bold border-b border-[#6c5070]/20';
      thead.innerHTML = `
        <tr>
          <th class="p-3 text-center w-14 rounded-tl-2xl bg-[#e5dce6]">ลำดับ</th>
          <th class="p-3">ยาเตรียม</th>
          <th class="p-3 text-center w-56">ผลการตรวจเพาะเชื้อที่ 72 ชม.</th>
          <th class="p-3 w-48 rounded-tr-2xl">หมายเหตุ (Remarks)</th>
        </tr>
      `;
    }

    // ชื่อยาจากช่องหัวตารางถูกส่งต่อลงทุกแถวได้ แต่ห้ามเดาชื่อยาใส่ให้เอง
    // เดิมวนใส่ Zinc sulphate / Trace element / Phosphate / Magnesium ให้อัตโนมัติ
    // ถ้าผู้กรอกไม่ทันสังเกต ใบส่งตรวจจะได้ชื่อยาที่ไม่มีใครกรอกติดไปด้วย
    const defaultDrugHeader = document.getElementById('sub-drug2-header')?.value || '';

    ensurePreparedMedicineDatalist();
    tbody.innerHTML = '';
    for (let i = 1; i <= rowCount; i++) {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 hover:bg-[#f7f2f8]/30 text-xs transition';
      const defaultVal = defaultDrugHeader;
      tr.innerHTML = `
        <td class="p-3 text-center font-bold text-slate-500 bg-[#f7f2f8]/40">${i}</td>
        <td class="p-2">
          <input type="text" list="prepared-medicine-list" class="sub-item-drug2 w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden font-medium" placeholder="เลือกหรือพิมพ์ชื่อยาเตรียม" value="${defaultVal}">
        </td>
        <td class="p-2 text-center">
          <input type="text" disabled value="กำลังส่งตรวจ" class="w-full px-3 py-2.5 bg-[#fafafa] border border-slate-200 rounded-2xl text-slate-400 text-center font-mono cursor-not-allowed text-xs" title="🔒 สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ">
        </td>
        <td class="p-2">
          <input type="text" class="sub-item-notes w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" placeholder="ระบุหมายเหตุ (ถ้ามี)">
        </td>
      `;
      tbody.appendChild(tr);
    }
    return;
  }

  // =========================================================================
  // 1B. ตรวจเพาะเชื้อจากน้ำและพื้นผิว (WTS_03 - งานควบคุมโรคติดเชื้อ & ห้องผ่าตัด & THAMC)
  // =========================================================================
  if (serviceCode === 'WTS_03' || serviceCode === 'WTO_04' || serviceCode === 'WTM_05') {
    if (titleEl) {
      titleEl.innerHTML = `<i class="fas fa-hand-holding-droplet text-[#df6a6a]"></i> <span>แบบฟอร์มส่งตรวจเพาะเชื้อ</span>`;
    }
    if (descEl) {
      descEl.textContent = 'สำหรับงานควบคุมโรคติดเชื้อและห้องผ่าตัด';
    }
    if (deptLabel) {
      deptLabel.innerHTML = `หน่วยงานส่งตรวจ <span class="text-[#df6a6a]">*</span>`;
    }
    if (deptInput && !deptInput.value) {
      deptInput.value = (serviceCode === 'WTO_04' ? 'ห้องผ่าตัด (OR)' : (serviceCode === 'WTM_05' ? 'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)' : 'งานควบคุมโรคติดเชื้อ'));
    }
    if (specimenTypeInput && !specimenTypeInput.value) {
      specimenTypeInput.value = (serviceCode === 'WTO_04' || serviceCode === 'WTM_05') ? 'น้ำ' : 'พื้นผิว';
    }
    if (suspectedOrganismContainer) {
      suspectedOrganismContainer.classList.remove('hidden');
      const suspectedInput = document.getElementById('sub-suspected-organism');
      if (suspectedInput && !suspectedInput.value) {
        suspectedInput.value = 'ไม่ได้ระบุ';
      }
    }
    if (footerHint) {
      footerHint.innerHTML = `<i class="fas fa-lock text-[#df6a6a]"></i> <span>ช่อง ผลเพาะเชื้อ ล็อคไว้สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ</span>`;
    }

    if (thead) {
      thead.className = 'bg-gray-100 text-gray-700 font-semibold border-b border-gray-200';
      thead.innerHTML = `
        <tr>
          <th class="p-3 text-center w-14 bg-gray-200/60 rounded-tl-2xl">ลำดับ</th>
          <th class="p-3">สถานที่/หน่วยงาน</th>
          <th class="p-3 text-center w-60">ผลเพาะเชื้อ</th>
          <th class="p-3 w-56 rounded-tr-2xl">หมายเหตุ</th>
        </tr>
      `;
    }

    tbody.innerHTML = '';
    for (let i = 1; i <= rowCount; i++) {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 hover:bg-[#f7f2f8]/30 text-xs transition';
      tr.innerHTML = `
        <td class="p-3 text-center font-bold text-slate-500 bg-[#f7f2f8]/40">${i}</td>
        <td class="p-2">
          <input type="text" class="sub-item-loc w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden font-medium" placeholder="พิมพ์หรือเลือกสถานที่">
        </td>
        <td class="p-2 text-center">
          <input type="text" disabled value="" class="w-full px-3 py-2.5 bg-[#fafafa] border border-slate-200 rounded-2xl text-slate-400 text-center font-mono cursor-not-allowed text-xs" placeholder="ผลเพาะเชื้อ" title="🔒 สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ">
        </td>
        <td class="p-2">
          <input type="text" class="sub-item-notes w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" placeholder="หมายเหตุ">
        </td>
      `;
      tbody.appendChild(tr);
    }
    return;
  }

  // =========================================================================
  // 1C. ตรวจเพาะเชื้อจากยาปลอดเชื้อ (DRG_07 - งานผลิตยา ปลอดเชื้อ)
  // =========================================================================
  if (serviceCode === 'DRG_07') {
    if (titleEl) {
      titleEl.innerHTML = `<i class="fas fa-pills text-[#df6a6a]"></i> <span>แบบฟอร์มส่งตรวจ</span>`;
    }
    if (descEl) {
      descEl.textContent = 'ระบบส่งตรวจเพาะเชื้อจากยา (สำหรับงานผลิตยา)';
    }
    if (deptLabel) {
      deptLabel.innerHTML = `หน่วยงานส่งตรวจ <span class="text-[#df6a6a]">*</span>`;
    }
    if (deptInput && !deptInput.value) {
      deptInput.value = 'งานผลิตยา';
    }
    if (specimenTypeInput && !specimenTypeInput.value) {
      specimenTypeInput.value = 'ยา';
    }
    if (suspectedOrganismContainer) {
      suspectedOrganismContainer.classList.remove('hidden');
    }
    if (footerHint) {
      // ปุ่มลัดเติมรายการยาตามลำดับในแบบฟอร์มกระดาษ ช่วยให้ไม่ต้องเลือกทีละแถว
      footerHint.innerHTML = `<i class="fas fa-lock text-[#df6a6a]"></i>
        <span>ช่อง ผลเพาะเชื้อ และ ผล (Pass/Fail) ถูกล็อคไว้สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ</span>
        <button type="button" onclick="fillStandardDrugList()"
                class="ml-2 inline-flex items-center gap-1 bg-[#f7f2f8] hover:bg-[#f0e8f2] text-[#6c5070] border border-[#6c5070]/25 text-[11px] font-bold px-3 py-1.5 rounded-xl transition">
          <i class="fas fa-wand-magic-sparkles"></i> เติมรายการยามาตรฐาน ${DRUG_SAMPLE_LIST.length} รายการ
        </button>`;
    }

    if (thead) {
      thead.className = 'bg-[#6c5070] text-white font-bold border-b border-[#6c5070]';
      thead.innerHTML = `
        <tr>
          <th class="p-3 text-center w-12 bg-[#573e5a] rounded-tl-2xl">ลำดับ</th>
          <th class="p-3 w-56">ชนิดของยา</th>
          <th class="p-3 text-center w-36">ผลเพาะเชื้อ</th>
          <th class="p-3 text-center w-28">ผล</th>
          <th class="p-3 w-40 rounded-tr-2xl">หมายเหตุ</th>
        </tr>
      `;
    }

    ensureDrugDatalist();
    tbody.innerHTML = '';
    for (let i = 1; i <= rowCount; i++) {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 hover:bg-[#f7f2f8]/30 text-xs transition';
      tr.innerHTML = `
        <td class="p-3 text-center font-bold text-slate-500 bg-[#f7f2f8]/40">${i}</td>
        <td class="p-2">
          <input type="text" list="drug-sample-list"
                 class="sub-item-drug w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden font-medium"
                 placeholder="เลือกหรือพิมพ์ชื่อยา">
        </td>
        <td class="p-2 text-center">
          <input type="text" disabled value="-" class="w-full px-3 py-2.5 bg-[#fafafa] border border-slate-200 rounded-2xl text-slate-400 text-center font-mono cursor-not-allowed text-xs" placeholder="ผลเพาะเชื้อ" title="🔒 สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ">
        </td>
        <td class="p-2 text-center">
          <input type="text" disabled value="-" class="w-full px-3 py-2.5 bg-[#fafafa] border border-slate-200 rounded-2xl text-slate-400 text-center font-mono cursor-not-allowed text-xs" placeholder="Pass/Fail" title="🔒 สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ">
        </td>
        <td class="p-2">
          <input type="text" class="sub-item-notes w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" placeholder="หมายเหตุ">
        </td>
      `;
      tbody.appendChild(tr);
    }
    return;
  }

  // =========================================================================
  // 3. ตรวจความปลอดภัยทางจุลชีววิทยาของอาหาร (Food Sanitation - งานโภชนาการ)
  // =========================================================================
  if (serviceCode === 'FOD_06') {
    if (titleEl) {
      titleEl.innerHTML = `<i class="fas fa-utensils text-[#df6a6a]"></i> <span>แบบฟอร์มส่งตรวจเพาะเชื้อจากอาหาร</span>`;
    }
    if (descEl) {
      descEl.textContent = 'สำหรับงานโภชนาการ (ตรวจวิเคราะห์การปนเปื้อนเชื้อ E.coli และ P.aeruginosa ในอาหารและนม)';
    }
    if (deptLabel) {
      deptLabel.innerHTML = `หน่วยงานส่งตรวจ <span class="text-[#df6a6a]">*</span>`;
    }
    if (deptInput && !deptInput.value) {
      deptInput.value = 'งานโภชนาการ';
    }
    if (specimenTypeInput && !specimenTypeInput.value) {
      specimenTypeInput.value = 'อาหาร';
    }
    if (suspectedOrganismContainer) {
      suspectedOrganismContainer.classList.add('hidden');
    }
    if (footerHint) {
      footerHint.innerHTML = `<i class="fas fa-lock text-[#df6a6a]"></i> <span>ช่อง E.coli และ P.aeruginosa ถูกล็อคไว้สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ</span>`;
    }

    if (thead) {
      thead.className = 'bg-gray-100 text-gray-700 font-bold border-b border-gray-200';
      thead.innerHTML = `
        <tr>
          <th class="p-3 text-center w-14 bg-gray-200/60 rounded-tl-2xl">ลำดับ</th>
          <th class="p-3">อาหาร</th>
          <th class="p-3 text-center w-36">E.COLI</th>
          <th class="p-3 text-center w-36">P.AERUGINOSA</th>
          <th class="p-3 w-48 rounded-tr-2xl">หมายเหตุ</th>
        </tr>
      `;
    }

    tbody.innerHTML = '';
    for (let i = 1; i <= rowCount; i++) {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 hover:bg-[#f7f2f8]/30 text-xs transition';
      tr.innerHTML = `
        <td class="p-3 text-center font-bold text-slate-500 bg-[#f7f2f8]/40">${i}</td>
        <td class="p-2">
          <input type="text" class="sub-item-food w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden font-medium" placeholder="เช่น อาหารปั่น เบาหวาน, นม PF, นม T1, อาหารปั่น ธรรมดา">
        </td>
        <td class="p-2 text-center">
          <input type="text" disabled value="-" class="w-full px-3 py-2.5 bg-[#fafafa] border border-slate-200 rounded-2xl text-slate-400 text-center font-mono cursor-not-allowed text-xs" placeholder="E.COLI" title="🔒 สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ">
        </td>
        <td class="p-2 text-center">
          <input type="text" disabled value="-" class="w-full px-3 py-2.5 bg-[#fafafa] border border-slate-200 rounded-2xl text-slate-400 text-center font-mono cursor-not-allowed text-xs" placeholder="P.AERUGINOSA" title="🔒 สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ">
        </td>
        <td class="p-2">
          <input type="text" class="sub-item-notes w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" placeholder="หมายเหตุ">
        </td>
      `;
      tbody.appendChild(tr);
    }
    return;
  }

  // =========================================================================
  // 4. ตรวจความปราศจากเชื้อ สำหรับงานธนาคารเลือด (Sterility Test - Blood Bank)
  // =========================================================================
  if (serviceCode === 'STR_02') {
    if (titleEl) {
      titleEl.innerHTML = `<i class="fas fa-droplet text-[#df6a6a]"></i> <span>แบบฟอร์มส่งตรวจ Sterility test (Blood)</span>`;
    }
    if (descEl) {
      descEl.textContent = 'สำหรับงานธนาคารเลือด (ระบุหมายเลขถุงเลือด, ชนิดผลิตภัณฑ์ และวันหมดอายุ)';
    }
    if (deptLabel) {
      deptLabel.innerHTML = `แผนก/หน่วยงาน <span class="text-[#df6a6a]">*</span>`;
    }
    if (deptInput && !deptInput.value) {
      deptInput.value = 'งานธนาคารเลือด';
    }
    if (suspectedOrganismContainer) {
      suspectedOrganismContainer.classList.add('hidden');
    }
    if (footerHint) {
      footerHint.innerHTML = `<i class="fas fa-lock text-[#df6a6a]"></i> <span>ช่อง ปลอดเชื้อ / ไม่ปลอดเชื้อ ล็อคไว้สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ</span>`;
    }

    if (thead) {
      thead.className = 'bg-[#6c5070] text-white font-bold border-b border-[#6c5070]';
      thead.innerHTML = `
        <tr>
          <th class="p-3 text-center w-12 bg-[#573e5a] rounded-tl-2xl">ลำดับ</th>
          <th class="p-3 w-48">หมายเลขถุงเลือด</th>
          <th class="p-3">ชนิดผลิตภัณฑ์เลือด</th>
          <th class="p-3 text-center w-28">ปลอดเชื้อ</th>
          <th class="p-3 text-center w-28">ไม่ปลอดเชื้อ</th>
          <th class="p-3 w-36 rounded-tr-2xl">หมายเหตุ</th>
        </tr>
      `;
    }

    tbody.innerHTML = '';
    for (let i = 1; i <= rowCount; i++) {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 hover:bg-[#f7f2f8]/30 text-xs transition';
      tr.innerHTML = `
        <td class="p-3 text-center font-bold text-slate-500 bg-[#f7f2f8]/40">${i}</td>
        <td class="p-2">
          <input type="text" class="sub-item-blood-bag w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden font-mono" placeholder="e.g., B123456">
        </td>
        <td class="p-2.5">
          <div class="space-y-1.5 py-0.5">
            <div class="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-700 font-medium">
              <label class="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" class="sub-cb-type accent-[#6c5070] rounded h-3.5 w-3.5" value="PRC"> PRC</label>
              <label class="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" class="sub-cb-type accent-[#6c5070] rounded h-3.5 w-3.5" value="LPRC"> LPRC</label>
              <label class="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" class="sub-cb-type accent-[#6c5070] rounded h-3.5 w-3.5" value="LDPPC"> LDPPC</label>
              <label class="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" class="sub-cb-type accent-[#6c5070] rounded h-3.5 w-3.5" value="FFP"> FFP</label>
              <label class="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" class="sub-cb-type accent-[#6c5070] rounded h-3.5 w-3.5" value="SDP"> SDP</label>
              <label class="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" class="sub-cb-type accent-[#6c5070] rounded h-3.5 w-3.5" value="LPPC"> LPPC</label>
            </div>
            <div class="flex items-center gap-4 text-xs text-slate-700">
              <label class="inline-flex items-center gap-1 cursor-pointer font-medium"><input type="checkbox" class="sub-cb-type accent-[#6c5070] rounded h-3.5 w-3.5" value="Normal"> Normal</label>
              <div class="flex items-center gap-1.5 text-slate-500 text-xs">
                <span>exprid:</span>
                <input type="text" class="sub-item-exprid px-2.5 py-1 bg-[#fafafa] border border-slate-200 rounded-xl text-xs w-36 placeholder:text-slate-300 focus:bg-white focus:outline-hidden" placeholder="วันหมดอายุ">
              </div>
            </div>
          </div>
        </td>
        <td class="p-2 text-center">
          <input type="text" disabled value="-" class="w-full px-2 py-2.5 bg-[#fafafa] border border-slate-200 rounded-2xl text-slate-400 text-center font-mono cursor-not-allowed text-xs" title="🔒 สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ">
        </td>
        <td class="p-2 text-center">
          <input type="text" disabled value="-" class="w-full px-2 py-2.5 bg-[#fafafa] border border-slate-200 rounded-2xl text-slate-400 text-center font-mono cursor-not-allowed text-xs" title="🔒 สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ">
        </td>
        <td class="p-2">
          <input type="text" class="sub-item-notes w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" placeholder="หมายเหตุ">
        </td>
      `;
      tbody.appendChild(tr);
    }
    return;
  }

  // =========================================================================
  // 5. ตรวจอากาศในอาคาร (Air Sampling - Settle Plate) และแบบฟอร์มเริ่มต้นทั่วไป
  // =========================================================================
  if (titleEl) {
    titleEl.innerHTML = `<i class="fas fa-wind text-[#df6a6a]"></i> <span>แบบฟอร์มส่งตรวจ Air Sampling (Settle Plate)</span>`;
  }
  if (descEl) {
    descEl.textContent = 'สำหรับงานอาชีวอนามัย (กรอกรายละเอียดจุดตรวจและตำแหน่งที่เก็บตัวอย่าง)';
  }
  if (deptLabel) {
    deptLabel.innerHTML = `หน่วยงานส่งตรวจ (ชื่อหน่วยงานที่เข้าไปวางเพลต) <span class="text-[#df6a6a]">*</span>`;
  }
  if (suspectedOrganismContainer) {
    suspectedOrganismContainer.classList.add('hidden');
  }
  if (footerHint) {
    footerHint.innerHTML = `<i class="fas fa-lock text-[#df6a6a]"></i> <span>ช่อง Number of colonies ถูกล็อคไว้สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ</span>`;
  }

  if (thead) {
    thead.className = 'bg-[#faf7f5] text-[#342838] font-bold border-b border-[#6c5070]/10';
    thead.innerHTML = `
      <tr>
        <th class="p-3.5 text-center w-12 bg-[#f7f2f8]">ลำดับ</th>
        <th class="p-3.5 w-52">หน่วยงาน</th>
        <th class="p-3.5 w-52">ตำแหน่งที่เก็บ</th>
        <th class="p-3.5 text-center w-40">Number of colonies (Bacteria)</th>
        <th class="p-3.5 text-center w-40">Number of colonies (Fungus)</th>
        <th class="p-3.5">หมายเหตุ</th>
      </tr>
    `;
  }

  tbody.innerHTML = '';
  for (let i = 1; i <= rowCount; i++) {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100 hover:bg-[#f7f2f8]/30 text-xs transition';
    tr.innerHTML = `
      <td class="p-3 text-center font-bold text-slate-500 bg-[#f7f2f8]/40">${i}</td>
      <td class="p-2">
        <input type="text" class="sub-item-ward w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" placeholder="พิมพ์หรือเลือก Ward" value="${defaultDept}">
      </td>
      <td class="p-2">
        <input type="text" class="sub-item-loc w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" placeholder="เช่น บริเวณเตียงผู้ป่วย">
      </td>
      <td class="p-2 text-center">
        <input type="text" disabled value="-" class="w-full px-3 py-2.5 bg-[#fafafa] border border-slate-200 rounded-2xl text-slate-400 text-center font-mono cursor-not-allowed text-xs" placeholder="Bacteria" title="🔒 สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ">
      </td>
      <td class="p-2 text-center">
        <input type="text" disabled value="-" class="w-full px-3 py-2.5 bg-[#fafafa] border border-slate-200 rounded-2xl text-slate-400 text-center font-mono cursor-not-allowed text-xs" placeholder="Fungus" title="🔒 สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผลตรวจ">
      </td>
      <td class="p-2">
        <input type="text" class="sub-item-notes w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden" placeholder="หมายเหตุ">
      </td>
    `;
    tbody.appendChild(tr);
  }
}

/**
 * บันทึกข้อมูลการส่งตรวจ (Universal Dynamic Submit)
 */
async function handleSubmissionFormSubmit(e) {
  e.preventDefault();
  
  const submissionNo = document.getElementById('sub-submission-no')?.value;
  const srvSelect = document.getElementById('sub-service-select');
  const serviceCode = srvSelect ? srvSelect.value : 'WTS_03';
  const samplingDate = document.getElementById('sub-sampling-date')?.value;
  const department = document.getElementById('sub-department')?.value.trim();
  const specimenType = document.getElementById('sub-specimen-type-input')?.value.trim() || 'สิ่งแวดล้อม';
  const suspectedOrganism = document.getElementById('sub-suspected-organism')?.value.trim() || '';
  // ตามข้อกำหนด: ไม่มีช่อง Email ผู้ส่งตรวจบนแบบฟอร์มแล้ว

  if (!submissionNo || !samplingDate || !department) {
    Swal.fire({
      icon: 'warning',
      title: 'กรุณากรอกข้อมูลให้ครบถ้วน',
      text: 'กรุณาระบุ วันที่ส่งตรวจ, แผนก/หน่วยงานส่งตรวจ'
    });
    return;
  }

  const rows = document.querySelectorAll('#sub-items-tbody tr');
  if (rows.length === 0) {
    Swal.fire({ icon: 'warning', title: 'ไม่มีรายการตัวอย่าง', text: 'กรุณาระบุจำนวนตัวอย่างอย่างน้อย 1 รายการ' });
    return;
  }

  const items = [];
  const prepDate = document.getElementById('sub-prep-date')?.value || samplingDate;
  const sampleDate = document.getElementById('sub-sample-date')?.value || samplingDate;
  const operator = document.getElementById('sub-operator')?.value.trim() || currentLoggedUser?.displayName || currentLoggedUser?.name || '';

  const receiptDate = document.getElementById('sub-receipt-date')?.value || samplingDate;
  const analysisDate = document.getElementById('sub-analysis-date')?.value || samplingDate;
  const drug2Header = document.getElementById('sub-drug2-header')?.value.trim() || '';
  // ⚠️ ช่องที่เว้นว่างต้องเก็บเป็นค่าว่าง ห้ามเดาค่าแทนผู้กรอก
  //    เดิม productionDate เว้นว่างแล้วเอา "วันที่เก็บตัวอย่าง" มาใส่แทน
  //    ทำให้ใบรายงานพิมพ์วันผลิตที่ไม่เคยมีใครกรอก ซึ่งเป็นข้อมูลคุณภาพที่ตรวจสอบย้อนกลับได้
  //    เช่นเดียวกับ drugVolume ที่เคยใส่ '0' และ senderName ที่เคยใส่ชื่อคนไว้ตายตัว
  const lotNo = document.getElementById('sub-lot-no')?.value.trim() || '';
  const productionDate = document.getElementById('sub-production-date')?.value || '';
  const drugVolume = document.getElementById('sub-drug-volume')?.value || '';
  const senderName = document.getElementById('sub-sender-name')?.value.trim()
                     || currentLoggedUser?.displayName || currentLoggedUser?.name || '';

  rows.forEach((tr, idx) => {
    if (serviceCode === 'DRG_08') {
      const drug = tr.querySelector('.sub-item-drug2')?.value.trim() || drug2Header || `รายการยาเตรียมที่ ${idx + 1}`;
      const notes = tr.querySelector('.sub-item-notes')?.value.trim() || '';

      items.push({
        item_no: idx + 1,
        drug_name: drug,
        prepared_medicine: drug,
        location_name: drug,
        sample_description: drug,
        ward_name: department || 'งานผลิตยา',
        culture_result: 'กำลังส่งตรวจ',
        bacteria_count: 'กำลังส่งตรวจ',
        fungus_count: '-',
        item_result: 'pending',
        notes: notes
      });
    } else if (serviceCode === 'DRG_07') {
      const drug = tr.querySelector('.sub-item-drug')?.value.trim() || `รายการยาที่ ${idx + 1}`;
      const culture = tr.querySelector('.sub-item-culture')?.value.trim() || 'No growth';
      const notes = tr.querySelector('.sub-item-notes')?.value.trim() || '';

      items.push({
        item_no: idx + 1,
        drug_name: drug,
        location_name: drug,
        sample_description: drug,
        ward_name: department || 'งานผลิตยา',
        culture_result: culture,
        bacteria_count: culture,
        fungus_count: '-',
        item_result: (culture === 'Growth' ? 'fail' : 'pass'),
        notes: notes
      });
    } else if (serviceCode === 'FOD_06') {
      const food = tr.querySelector('.sub-item-food')?.value.trim() || `ตัวอย่างอาหารที่ ${idx + 1}`;
      const notes = tr.querySelector('.sub-item-notes')?.value.trim() || '';

      items.push({
        item_no: idx + 1,
        ward_name: department || 'งานโภชนาการ',
        location_name: food,
        food_name: food,
        sample_description: food,
        ecoli_result: '-',
        paeruginosa_result: '-',
        bacteria_count: '-',
        fungus_count: '-',
        item_result: 'pending',
        notes: notes
      });
    } else if (serviceCode === 'WTS_03' || serviceCode === 'WTO_04' || serviceCode === 'WTM_05') {
      const loc = tr.querySelector('.sub-item-loc')?.value.trim() || `จุดตรวจที่ ${idx + 1}`;
      const notes = tr.querySelector('.sub-item-notes')?.value.trim() || '';

      items.push({
        item_no: idx + 1,
        ward_name: department,
        location_name: loc,
        sample_description: `${department} - ${loc}`,
        specimen_type: specimenType,
        suspected_organism: suspectedOrganism,
        culture_result: '-',
        bacteria_count: '-',
        fungus_count: '-',
        item_result: 'pending',
        notes: notes
      });
    } else if (serviceCode === 'STR_02') {
      const bloodBag = tr.querySelector('.sub-item-blood-bag')?.value.trim() || '';
      const checkedBoxes = tr.querySelectorAll('.sub-cb-type:checked');
      const selectedTypes = Array.from(checkedBoxes).map(cb => cb.value);
      const exprid = tr.querySelector('.sub-item-exprid')?.value.trim() || '';
      const notes = tr.querySelector('.sub-item-notes')?.value.trim() || '';

      if (exprid) selectedTypes.push(`exprid: ${exprid}`);
      const productTypeStr = selectedTypes.join(', ') || 'PRC';
      const bloodBagDisplay = bloodBag || `ถุงเลือดที่ ${idx + 1}`;

      items.push({
        item_no: idx + 1,
        blood_bag_no: bloodBagDisplay,
        product_type: productTypeStr,
        location_name: bloodBagDisplay,
        ward_name: department || 'งานธนาคารเลือด',
        sample_description: `${bloodBagDisplay} (${productTypeStr})`,
        bacteria_count: '-',
        fungus_count: '-',
        item_result: 'pending',
        notes: notes
      });
    } else {
      const ward = tr.querySelector('.sub-item-ward')?.value.trim() || department;
      const loc = tr.querySelector('.sub-item-loc')?.value.trim() || `จุดตรวจที่ ${idx + 1}`;
      const notes = tr.querySelector('.sub-item-notes')?.value.trim() || '';

      items.push({
        item_no: idx + 1,
        ward_name: ward,
        location_name: loc,
        sample_description: `${ward} - ${loc}`,
        bacteria_count: '-',
        fungus_count: '-',
        item_result: 'pending',
        notes: notes
      });
    }
  });

  const srvObj = window.SERVICES_CONFIG[serviceCode] || { 
    name: (serviceCode === 'DRG_08' ? 'Drug (สำหรับยาผลิตปราศจากเชื้อ) การปนเปื้อนเชื้อจุลินทรีย์' : 
          (serviceCode === 'DRG_07' ? 'Drug (สำหรับงานผลิตยา) ปลอดเชื้อ' : 
          (serviceCode === 'FOD_06' ? 'Food Sanitation (สำหรับงานโภชนาการ)' : 'ตรวจวิเคราะห์สิ่งแวดล้อม')))
  };
  const targetWard = items.length > 0 ? (items[0].drug_name || items[0].food_name || items[0].location_name || items[0].ward_name || department) : department;

  // อีเมลผู้รับผล — ไม่บังคับกรอก ปล่อยว่างแล้วส่งเป็น null
  // ห้ามส่งสตริงว่าง เพราะจะทำให้ปุ่มส่งเมลเข้าใจว่ามีผู้รับแล้วทั้งที่ไม่มี
  const recipientEmail = (document.getElementById('sub-recipient-email')?.value || '').trim() || null;

  const reportPayload = {
    submission_no: submissionNo,
    recipient_email: recipientEmail,
    service_code: serviceCode,
    service_name: srvObj.name,
    department: department,
    ward_room: targetWard,
    sampler_name: currentLoggedUser?.name || 'เจ้าหน้าที่ประจำหน่วยงาน',
    sampling_date: samplingDate,
    preparation_date: prepDate,
    sample_date: sampleDate,
    operator_name: operator,
    receipt_date: receiptDate,
    analysis_date: analysisDate,
    lot_no: lotNo,
    production_date: productionDate,
    volume: drugVolume,
    sender_name: senderName,
    prepared_medicine_header: drug2Header,
    prepared_medicine: drug2Header || (items[0] && items[0].drug_name) || 'Trace element',
    sample_count: items.length,
    status: 'pending',
    overall_result: 'pending',
    specimen_type: specimenType,
    suspected_organism: suspectedOrganism,
    remarks: (serviceCode === 'DRG_08')
      ? 'นำส่งตัวอย่างแล้ว อยู่ระหว่างรอผลการตรวจวิเคราะห์การปนเปื้อนเชื้อจุลินทรีย์'
      : ((serviceCode === 'DRG_07') 
          ? 'นำส่งตัวอย่างแล้ว อยู่ระหว่างรอผลตรวจเพาะเชื้อยาที่ 72 ชม.'
          : (serviceCode === 'FOD_06' ? 'นำส่งตัวอย่างอาหารแล้ว อยู่ระหว่างรอผลเพาะเชื้อ E.coli และ P.aeruginosa' : 'นำส่งตัวอย่างแล้ว อยู่ระหว่างรอห้องปฏิบัติการเพาะเชื้อและดำเนินการตรวจวิเคราะห์'))
  };

  Swal.fire({
    title: 'กำลังบันทึกส่งรายการตรวจ...',
    html: '<div class="text-xs text-[#78687e] mt-1">กรุณารอสักครู่ ระบบกำลังบันทึกข้อมูลและส่งแจ้งเตือน</div>',
    allowOutsideClick: false,
    customClass: { popup: 'k-swal' },
    didOpen: () => Swal.showLoading()
  });

  try {
    const newReportObj = {
      ...reportPayload,
      id: 'REP-' + Date.now(),
      created_at: new Date().toISOString(),
      formatted_date: new Date().toLocaleDateString('th-TH'),
      reported_date: '-',
      status: 'pending',
      overall_result: 'pending',
      report_items: items
    };

    // 1. บันทึกลงใน localStorage สำหรับประวัติส่งตรวจแบบเรียลไทม์
    const currentLocalSubmitted = JSON.parse(localStorage.getItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS') || '[]');
    currentLocalSubmitted.unshift(newReportObj);
    localStorage.setItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS', JSON.stringify(currentLocalSubmitted));

    // 2. แทรกเข้า MOCK_REPORTS_ARCHIVE ใน memory ทันที
    if (typeof MOCK_REPORTS_ARCHIVE !== 'undefined' && Array.isArray(MOCK_REPORTS_ARCHIVE)) {
      MOCK_REPORTS_ARCHIVE.unshift(newReportObj);
    }

    // 3. บันทึกผ่าน ReportDB (Supabase / Local)
    try {
      await window.ReportDB.createReport(reportPayload, items, []);
    } catch (dbErr) {
      console.warn('ReportDB create notice:', dbErr);
    }

    // ตามข้อกำหนด: กดบันทึกแบบฟอร์มส่งตรวจ "ไม่ต้อง" แจ้งเตือน LINE / Telegram
    // (แจ้งเตือนเฉพาะตอนจองคิว และตอนออกผลตรวจ)

    Swal.fire({
      icon: 'success',
      title: 'บันทึกส่งรายการตรวจสำเร็จ!',
      html: `
        <div class="text-xs text-[#78687e] space-y-2 text-left bg-[#faf7f5] p-3.5 rounded-2xl border border-[#6c5070]/15 mt-2">
          <div>เลขที่เอกสาร: <strong class="font-mono text-[#6c5070]">${submissionNo}</strong></div>
          <div>หน่วยงานส่งตรวจ: <strong class="text-[#342838]">${department}</strong></div>
          <div>สถานที่เข้าไปวางเพลต/จุดตรวจ: <strong class="text-[#df6a6a]">${targetWard}</strong></div>
          <div>สถานะ: <span class="bg-[#fefaf0] text-[#b8860b] font-bold px-2 py-0.5 rounded-full text-[11px] border border-[#fde8a8]"><i class="fas fa-clock mr-1"></i>รอตรวจ (Waiting for testing)</span></div>
        </div>
      `,
      confirmButtonText: '<i class="fas fa-file-waveform mr-1"></i> ดูรายการรายงานผลตรวจ ➔',
      confirmButtonColor: '#6c5070',
      showCancelButton: true,
      cancelButtonText: 'ปิดหน้าต่าง',
      cancelButtonColor: '#78687e',
      customClass: { popup: 'k-swal' }
    }).then(res => {
      if (res.isConfirmed) {
        switchWorkflowTab('reports');
      }
    });

  } catch (err) {
    console.error('Submit error:', err);
    Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message || 'Database error' });
  }
}
window.handleSubmissionFormSubmit = handleSubmissionFormSubmit;

// ==============================================================================
// 3. รายงานผลตรวจทั้งหมด (ALL REPORTS ARCHIVE - DEPARTMENT ISOLATION & BALANCED)
// ==============================================================================
async function initReportsArchive() {
  const searchInput = document.getElementById('rep-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterReportsTable(searchInput.value.trim().toLowerCase());
    });
  }

  await loadReportsArchiveTable();
}

/**
 * โหลดตารางรายงานผลตรวจทั้งหมด พร้อมแยกสิทธิ์ตามหน่วยงานอย่างเข้มงวด
 */
async function loadReportsArchiveTable() {
  const tbody = document.getElementById('rep-archive-tbody');
  const scopeBadge = document.getElementById('reports-scope-badge');
  const countBadge = document.getElementById('reports-count-badge');
  if (!tbody) return;

  // ==========================================================================
  // 🔒 ต้องเข้าสู่ระบบก่อนจึงจะดูรายงานผลตรวจได้
  // ผลตรวจสิ่งแวดล้อมเป็นข้อมูลภายในของโรงพยาบาล ไม่เปิดให้บุคคลทั่วไปดู
  // ==========================================================================
  // ต้องเขียนกลับเข้า currentLoggedUser ด้วย ไม่ใช่เก็บไว้ในตัวแปรของตัวเอง
  // เพราะ canManageReport / canManageBooking อ่านจากตัวแปรส่วนกลางตัวนี้
  // ถ้าฟังก์ชันนี้ทำงานก่อน checkUserRoleAndInitTabs() ตัวแปรส่วนกลางจะยังเป็น null
  // ผลคือรายการแสดงครบแต่ปุ่มจัดการหายไปทั้งตาราง
  if (!currentLoggedUser && window.AuthManager) {
    currentLoggedUser = await window.AuthManager.getCurrentUser();
  }
  const user = currentLoggedUser;

  if (!user) {
    if (scopeBadge) {
      scopeBadge.innerHTML =
        '<span class="inline-flex items-center gap-1.5 bg-[#fdf0f0] text-[#c25353] text-[11px] font-bold px-3 py-1 rounded-full border border-[#f9d2d2]">'
        + '<i class="fas fa-lock"></i> ต้องเข้าสู่ระบบก่อน</span>';
    }
    if (countBadge) countBadge.textContent = 'ยังไม่ได้เข้าสู่ระบบ';

    const backTo = encodeURIComponent(window.location.href);
    tbody.innerHTML =
      '<tr><td colspan="6" class="p-12 text-center">'
      + '<div class="w-14 h-14 bg-[#f7f2f8] text-[#6c5070] rounded-full flex items-center justify-center mx-auto mb-3 text-xl">'
      + '<i class="fas fa-lock"></i></div>'
      + '<div class="text-sm font-bold text-[#342838] mb-1">กรุณาเข้าสู่ระบบเพื่อดูรายงานผลตรวจ</div>'
      + '<div class="text-[11px] text-[#78687e] mb-4 max-w-md mx-auto leading-relaxed">'
      + 'ผลการตรวจวิเคราะห์สิ่งแวดล้อมเป็นข้อมูลภายในของโรงพยาบาล<br>'
      + 'เจ้าหน้าที่แต่ละหน่วยงานจะเห็นเฉพาะผลตรวจของหน่วยงานตนเอง</div>'
      + '<a href="login.html?redirect=' + backTo + '" '
      + 'class="inline-flex items-center gap-2 bg-[#6c5070] hover:bg-[#573e5a] text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-sm transition">'
      + '<i class="fas fa-user-shield text-[#f9d56e]"></i> เข้าสู่ระบบเจ้าหน้าที่</a>'
      + '</td></tr>';

    window.CURRENT_WORKFLOW_REPORTS = [];
    return;
  }

  tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-lg mr-2"></i> กำลังโหลดรายงานผลตรวจ...</td></tr>`;

  let allReports = [];
  try {
    // 1. ดึงรายการที่ส่งตรวจใหม่ในเครื่อง (localStorage)
    // ใช้สำเนาในเครื่องเฉพาะใบที่ยังส่งขึ้นฐานข้อมูลไม่สำเร็จ
    const allLocalSubmitted = JSON.parse(localStorage.getItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS') || '[]');
    const localSubmitted = window.supabaseClient ? allLocalSubmitted.filter(r => !r.synced) : allLocalSubmitted;

    // 2. ดึงรายการจาก Database (Supabase)
    let dbReports = [];
    try {
      const { data } = await window.ReportDB.getReports({ pageSize: 150 });
      if (data && data.length > 0) dbReports = data;
    } catch (dbErr) {
      console.warn('DB fetch warning:', dbErr);
    }

    // 3. รวมทุกแหล่งข้อมูล: ส่งตรวจใหม่ + ข้อมูลฐานข้อมูล + ประวัติเดิม (MOCK_REPORTS_ARCHIVE)
    // ฐานข้อมูลต้องมาก่อนเสมอ (เป็นแหล่งข้อมูลหลัก)
    const combined = [...dbReports, ...localSubmitted, ...MOCK_REPORTS_ARCHIVE];
    const seen = new Set();
    allReports = combined.filter(r => {
      const key = r.submission_no || r.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (e) {
    allReports = MOCK_REPORTS_ARCHIVE;
  }

  // ตรวจสอบสิทธิ์การเข้าถึงข้อมูลตามหน่วยงาน (Department Access Isolation)
  // ใช้ตัวแปร user ที่ตรวจสิทธิ์ไว้แล้วด้านบน (บรรทัด ~1832)
  const isAdmin = user && user.role === 'admin';

  let filteredReports = [];

  if (isAdmin) {
    // ADMIN เห็นทุกหน่วยงาน และสามารถเลือกกรองจาก dropdown ได้
    if (scopeBadge) {
      scopeBadge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 bg-purple-50 text-purple-800 text-[11px] font-bold px-3 py-1 rounded-full border border-purple-200">
          <i class="fas fa-user-shield"></i> สิทธิ์ ADMIN: แสดงรายงานทุกหน่วยงาน
        </span>
      `;
    }

    if (adminDeptFilter) {
      filteredReports = allReports.filter(r => {
        const dept = (r.department || '').toLowerCase();
        const ward = (r.ward_room || '').toLowerCase();
        return dept.includes(adminDeptFilter.toLowerCase()) || ward.includes(adminDeptFilter.toLowerCase());
      });
    } else {
      filteredReports = allReports;
    }

  } else if (user && user.department) {
    // 🔒 ขอบเขตของเจ้าหน้าที่หน่วยงาน: เห็นเฉพาะใบของหน่วยงานตนเอง
    //    กติกาเดียวกันนี้ถูกใช้ตัดสินสิทธิ์ แก้ไข/ยกเลิก/ลบ ด้วย
    //    จึงย้ายไปไว้ที่ isRecordInUserScope() ที่เดียว ไม่ให้สองที่เพี้ยนจากกัน
    //    แล้วเกิดกรณี "เห็นใบอยู่ตรงหน้าแต่กดปุ่มแล้วบอกไม่มีสิทธิ์"
    if (scopeBadge) {
      scopeBadge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-200">
          <i class="fas fa-lock text-emerald-600"></i> แสดงเฉพาะหน่วยงาน: ${user.displayName || user.department}
        </span>
      `;
    }

    filteredReports = allReports.filter(r => isRecordInUserScope(r, user));

  } else {
    // 👤 ผู้ใช้ทั่วไป / โหมดทดสอบ (Guest View): แสดงรายการที่เพิ่งส่งตรวจใหม่ + ประวัติรายงานทั้งหมดทันที
    if (scopeBadge) {
      scopeBadge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 text-[11px] font-bold px-3 py-1 rounded-full border border-blue-200">
          <i class="fas fa-list-check text-blue-600"></i> แสดงรายการส่งตรวจทั้งหมด (Guest / Public Mode)
        </span>
      `;
    }
    filteredReports = allReports;
  }

  // เรียงลำดับให้อันที่ "รอตรวจ" (Pending) และอันล่าสุดอยู่บนสุดเสมอ
  filteredReports.sort((a, b) => {
    const isPendingA = a.status === 'pending' || a.overall_result === 'pending';
    const isPendingB = b.status === 'pending' || b.overall_result === 'pending';
    if (isPendingA && !isPendingB) return -1;
    if (!isPendingA && isPendingB) return 1;

    const dateA = new Date(a.created_at || a.sampling_date || a.reported_date || 0);
    const dateB = new Date(b.created_at || b.sampling_date || b.reported_date || 0);
    return dateB - dateA;
  });

  window.CURRENT_WORKFLOW_REPORTS = filteredReports;
  
  if (countBadge) {
    countBadge.textContent = `พบรายงานทั้งหมด ${filteredReports.length} รายการ`;
  }

  renderReportsArchiveTable(filteredReports);
}
window.loadReportsArchiveTable = loadReportsArchiveTable;

function handleAdminDeptFilterChange(selectedDept) {
  adminDeptFilter = selectedDept;
  loadReportsArchiveTable();
}
window.handleAdminDeptFilterChange = handleAdminDeptFilterChange;

/**
 * ปุ่มจัดการใบส่งตรวจสำหรับตารางรายงาน
 * ------------------------------------------------------------------------------
 * ตารางรายงานมีเลย์เอาต์ 5 แบบตามชนิดบริการ (ยา2 / ยา1 / อาหาร / น้ำ-พื้นผิว / ทั่วไป)
 * ต้องเรียกตัวนี้ในทุกแบบ ไม่งั้นหน่วยงานที่ใช้เลย์เอาต์เฉพาะจะไม่มีปุ่มให้กดเลย
 * คืนค่าว่างถ้าผู้ใช้ไม่มีสิทธิ์กับใบนี้
 */
function manageButtonsHtml(r, subNo) {
  if (!canManageReport(r)) return '';
  const id = r.id || subNo;
  return `
    <button type="button" onclick="editReportRecord('${id}')" title="แก้ไขใบนี้"
            class="bg-white border border-[#6c5070]/40 hover:bg-[#f7f2f8] text-[#6c5070] text-xs font-bold px-2 py-1 rounded-lg transition inline-flex items-center">
      <i class="fas fa-pen-to-square"></i>
    </button>
    <button type="button" onclick="cancelReportRecord('${id}')" title="ยกเลิกใบนี้ (ข้อมูลยังเก็บไว้ ตรวจสอบย้อนกลับได้)"
            class="bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 text-xs font-bold px-2 py-1 rounded-lg transition inline-flex items-center">
      <i class="fas fa-xmark"></i>
    </button>
    <button type="button" onclick="deleteReportRecord('${id}')" title="ลบใบนี้ถาวร (กู้คืนไม่ได้)"
            class="bg-white border border-rose-300 hover:bg-rose-50 text-rose-600 text-xs font-bold px-2 py-1 rounded-lg transition inline-flex items-center">
      <i class="fas fa-trash-can"></i>
    </button>`;
}

function renderReportsArchiveTable(reports) {
  const tbody = document.getElementById('rep-archive-tbody');
  const thead = document.getElementById('rep-archive-thead');
  if (!tbody) return;

  const isDrug2View = (currentLoggedUser && currentLoggedUser.username === 'pharma') || (reports && reports.length > 0 && reports.every(r => r.service_code === 'DRG_08' || (r.service_name && r.service_name.includes('ปนเปื้อน'))));
  const isDrug1View = !isDrug2View && ((currentLoggedUser && currentLoggedUser.username === 'compounding') || (reports && reports.length > 0 && reports.every(r => r.service_code === 'DRG_07' || (r.service_name && r.service_name.includes('ปลอดเชื้อ')))));
  const isNutritionView = !isDrug2View && !isDrug1View && ((currentLoggedUser && currentLoggedUser.username === 'nutrition') || (adminDeptFilter && (adminDeptFilter.includes('โภชนาการ') || adminDeptFilter.includes('อาหาร'))) || (reports && reports.length > 0 && reports.every(r => r.service_code === 'FOD_06' || r.department === 'งานโภชนาการ')));
  const isWaterSurfaceView = !isDrug2View && !isDrug1View && !isNutritionView && ((currentLoggedUser && (currentLoggedUser.username === 'icn' || currentLoggedUser.serviceCode === 'WTS_03')) || (adminDeptFilter && (adminDeptFilter.includes('ควบคุมโรค') || adminDeptFilter.includes('IC'))) || (reports && reports.length > 0 && reports.every(r => r.service_code === 'WTS_03' || (r.department && r.department.includes('ควบคุมโรค')))));

  if (thead) {
    if (isDrug2View) {
      thead.className = 'bg-slate-100 text-slate-700 font-bold border-b border-slate-200';
      thead.innerHTML = `
        <tr>
          <th class="py-3.5 px-4 font-semibold w-36 text-center">วันที่ส่ง</th>
          <th class="py-3.5 px-4 font-semibold w-1/3">หน่วยงาน</th>
          <th class="py-3.5 px-4 font-semibold w-1/3">ยาเตรียม</th>
          <th class="py-3.5 px-4 font-semibold text-center w-40">สถานะ</th>
          <th class="py-3.5 px-4 font-semibold text-center w-32">จัดการ</th>
        </tr>
      `;
    } else if (isDrug1View) {
      thead.className = 'hidden';
    } else if (isNutritionView) {
      thead.className = 'bg-gray-100 text-gray-700 font-bold border-b border-gray-200';
      thead.innerHTML = `
        <tr>
          <th class="p-3 text-center w-14 bg-gray-200/60 rounded-tl-2xl">ลำดับ</th>
          <th class="p-3 text-center w-28">วันที่ส่งตรวจ</th>
          <th class="p-3">อาหาร</th>
          <th class="p-3 text-center w-32">E.COLI</th>
          <th class="p-3 text-center w-32">P.AERUGINOSA</th>
          <th class="p-3 text-center w-28">สถานะ</th>
          <th class="p-3 w-32">หมายเหตุ</th>
          <th class="p-3 text-center w-28 rounded-tr-2xl">รายงาน</th>
        </tr>
      `;
    } else if (isWaterSurfaceView) {
      thead.className = 'bg-slate-100 text-slate-700 font-bold border-b border-slate-200';
      thead.innerHTML = `
        <tr>
          <th class="py-3 px-4 font-semibold w-28">วันที่ส่ง</th>
          <th class="py-3 px-4 font-semibold">สถานที่/หน่วยงาน</th>
          <th class="py-3 px-4 font-semibold w-48">ประเภท</th>
          <th class="py-3 px-4 font-semibold text-center w-28">สถานะ</th>
          <th class="py-3 px-4 font-semibold text-center w-24">ดูรายงาน</th>
        </tr>
      `;
    } else {
      thead.className = 'bg-[#6c5070] text-white font-bold border-b border-[#503854]';
      thead.innerHTML = `
        <tr>
          <th class="p-3.5 text-center w-28 bg-[#583f5c]">วันที่ส่งตรวจ</th>
          <th class="p-3.5 w-36">เลขที่เอกสาร</th>
          <th class="p-3.5">หน่วยงานส่งตรวจ / จุดเก็บตัวอย่าง</th>
          <th class="p-3.5 text-center w-32">จำนวนตัวอย่าง</th>
          <th class="p-3.5 text-center w-28">สถานะ</th>
          <th class="p-3.5 text-center w-28">รายงานผล</th>
        </tr>
      `;
    }
  }

  if (!reports || reports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${isNutritionView ? '8' : (isDrug2View || isWaterSurfaceView ? '5' : '6')}" class="p-10 text-center">
          <div class="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2 text-lg">
            <i class="fas fa-folder-open"></i>
          </div>
          <div class="text-xs font-bold text-slate-700">ไม่พบข้อมูลรายงานผลตรวจ</div>
          <div class="text-[11px] text-slate-400 mt-0.5">ยังไม่มีรายการส่งตรวจในสิทธิ์หน่วยงานนี้ หรือลองเปลี่ยนคำค้นหา</div>
        </td>
      </tr>
    `;
    return;
  }

  // View: ยาผลิตปราศจากเชื้อ (DRG_08) -> 5 Columns Table Layout
  if (isDrug2View) {
    tbody.innerHTML = reports.map((r, idx) => {
      const formattedDate = r.formatted_date || r.sampling_date || '23/07/2569';
      const isTested = !isWaitingReport(r);
      const subNo = r.submission_no || r.id || `DRG-${idx + 1}`;
      const departmentName = r.department || 'งานผลิตยา';
      let preparedMed = r.prepared_medicine;
      if (!preparedMed || preparedMed === 'งานผลิตยา' || preparedMed === 'ยาเตรียม') {
        if (r.report_items && r.report_items.length > 0) {
          preparedMed = r.report_items[0].drug_name || r.report_items[0].prepared_medicine || r.report_items[0].location_name;
        }
      }
      if (!preparedMed || preparedMed === 'งานผลิตยา' || preparedMed === 'ยาเตรียม') {
        preparedMed = r.sample_description || (r.ward_room && r.ward_room !== 'งานผลิตยา' ? r.ward_room : '') || 'Trace element';
      }

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs transition">
          <td class="p-3.5 font-mono text-slate-700 text-center">${formattedDate}</td>
          <td class="p-3.5 font-semibold text-slate-800">${departmentName}</td>
          <td class="p-3.5 font-bold text-slate-800">${preparedMed}</td>
          <td class="p-3.5 text-center">
            <span class="inline-block px-3 py-1 rounded-full text-[11px] font-bold ${isTested ? 'bg-[#d4edda] text-[#155724]' : 'bg-amber-100 text-amber-800'}">
              ${isTested ? '✓ ตรวจแล้ว' : 'รอตรวจ'}
            </span>
          </td>
          <td class="p-3.5 text-center">
            <a href="report_view.html?id=${r.id || subNo}" target="_blank" class="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 rounded-lg transition shadow-2xs inline-flex items-center gap-1.5">
              <i class="far fa-eye text-slate-500"></i>
              <span>ดูผล</span>
            </a>
            ${manageButtonsHtml(r, subNo)}
          </td>
        </tr>
      `;
    }).join('');
    return;
  }

  // View: งานผลิตยา (DRG_07) -> Card Layout
  if (isDrug1View) {
    tbody.innerHTML = reports.map((r, idx) => {
      const formattedDate = r.formatted_date || r.sampling_date || '24/05/2569';
      const isTested = !isWaitingReport(r);
      const subNo = r.submission_no || r.id || `DRG-${idx + 1}`;
      const sampleCount = r.sample_count || (r.report_items ? r.report_items.length : 10);
      const departmentName = r.department || 'งานผลิตยา';

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs transition">
          <td class="p-4" colspan="4">
            <div class="font-bold text-slate-800 text-sm">หน่วยงาน: ${departmentName}</div>
            <div class="text-xs text-slate-500 mt-1">วันที่ส่ง: ${formattedDate} | ${sampleCount} ตัวอย่าง</div>
          </td>
          <td class="p-4 text-center">
            <span class="inline-block px-3 py-1 rounded-full text-xs font-bold ${isTested ? 'bg-[#d4edda] text-[#155724]' : 'bg-amber-100 text-amber-800'}">
              ${isTested ? 'ตรวจแล้ว' : 'รอตรวจ'}
            </span>
          </td>
          <td class="p-4 text-center">
            <a href="report_view.html?id=${r.id || subNo}" target="_blank" class="bg-[#a3c9a8] hover:bg-[#8eb894] text-slate-800 text-xs font-bold px-4 py-1.5 rounded-xl transition shadow-xs inline-flex items-center gap-1.5">
              <span>ดูรายงาน</span>
            </a>
            <div class="inline-flex items-center gap-1 ml-1">${manageButtonsHtml(r, subNo)}</div>
          </td>
        </tr>
      `;
    }).join('');
    return;
  }

  if (isNutritionView) {
    tbody.innerHTML = reports.map((r, idx) => {
      const formattedDate = r.formatted_date || r.sampling_date || '19-08-2026';
      const isTested = !isWaitingReport(r);
      const subNo = r.submission_no || r.id || `FOD-${idx + 1}`;
      const foodName = r.ward_room || (r.report_items && r.report_items[0] && (r.report_items[0].food_name || r.report_items[0].location_name)) || r.sample_description || 'อาหารปั่น ธรรมดา';
      
      const firstItem = (r.report_items && r.report_items[0]) || {};
      const ecoli = firstItem.ecoli_result || (isTested ? 'ไม่พบเชื้อ' : '-');
      const paeruginosa = firstItem.paeruginosa_result || (isTested ? 'ไม่พบเชื้อ' : '-');
      const notes = r.remarks || firstItem.notes || '-';

      return `
        <tr class="border-b border-slate-100 hover:bg-blue-50/20 text-xs transition">
          <td class="p-3.5 text-center font-bold text-slate-500 bg-slate-50/50">${reports.length - idx}</td>
          <td class="p-3.5 text-center font-mono text-slate-700 font-medium">${formattedDate}</td>
          <td class="p-3.5 font-bold text-slate-800">${foodName}</td>
          <td class="p-3.5 text-center font-mono font-bold ${ecoli === 'ไม่พบเชื้อ' ? 'text-emerald-700' : (ecoli === '-' ? 'text-slate-400' : 'text-rose-700')}">${ecoli}</td>
          <td class="p-3.5 text-center font-mono font-bold ${paeruginosa === 'ไม่พบเชื้อ' ? 'text-emerald-700' : (paeruginosa === '-' ? 'text-slate-400' : 'text-rose-700')}">${paeruginosa}</td>
          <td class="p-3.5 text-center">
            <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isTested ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
              ${isTested ? 'ตรวจแล้ว' : 'รอตรวจ'}
            </span>
          </td>
          <td class="p-3.5 text-slate-500">${notes}</td>
          <td class="p-3.5 text-center">
            <a href="report_view.html?id=${r.id || subNo}" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1 rounded-xl transition shadow-2xs inline-flex items-center gap-1">
              <span>ดูรายงาน</span>
            </a>
            <div class="inline-flex items-center gap-1 mt-1">${manageButtonsHtml(r, subNo)}</div>
          </td>
        </tr>
      `;
    }).join('');
    return;
  }

  // View: งานควบคุมโรคติดเชื้อ (WTS_03) -> 5 Columns Table Layout
  if (isWaterSurfaceView) {
    tbody.innerHTML = reports.map((r, idx) => {
      const formattedDate = r.formatted_date || r.sampling_date || '11/08/2569';
      const isTested = !isWaitingReport(r);
      const subNo = r.submission_no || r.id || `WTS-${idx + 1}`;
      const departmentName = r.department || r.ward_room || 'งานควบคุมโรคติดเชื้อ';
      const specimenType = r.specimen_type || r.sample_type || (r.report_items && r.report_items[0] && r.report_items[0].specimen_type) || 'พื้นผิว';

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs transition">
          <td class="p-3.5 font-mono text-slate-700">${formattedDate}</td>
          <td class="p-3.5 font-semibold text-slate-800">${departmentName}</td>
          <td class="p-3.5 text-slate-700 font-medium">${specimenType}</td>
          <td class="p-3.5 text-center">
            <span class="inline-block px-3 py-1 rounded-full text-[11px] font-bold ${isTested ? 'bg-[#d4edda] text-[#155724]' : 'bg-amber-100 text-amber-800'}">
              ${isTested ? 'ตรวจแล้ว' : 'รอตรวจ'}
            </span>
          </td>
          <td class="p-3.5 text-center">
            <a href="report_view.html?id=${r.id || subNo}" target="_blank" class="bg-[#c2dbc1]/50 hover:bg-[#a8caa7] text-slate-800 text-xs p-2 rounded-xl transition shadow-2xs inline-flex items-center justify-center">
              <i class="far fa-eye text-slate-700"></i>
            </a>
            ${manageButtonsHtml(r, subNo)}
          </td>
        </tr>
      `;
    }).join('');
    return;
  }

  tbody.innerHTML = reports.map((r, idx) => {
    const formattedDate = getSubmittedDateLabel(r);
    const isTested = !isWaitingReport(r);
    const sampleCount = r.sample_count || (r.report_items ? r.report_items.length : (r.items ? r.items.length : 5));
    const subNo = r.submission_no || r.id || `AIR-${idx + 1}`;
    const targetWard = r.ward_room || r.department;

    return `
      <tr class="border-b border-slate-100 hover:bg-emerald-50/20 text-xs transition">
        <!-- วันที่ส่งตรวจ -->
        <td class="p-3.5 text-center font-mono text-slate-700 font-semibold bg-slate-50/40">
          <div class="flex items-center justify-center gap-1">
            <i class="fas fa-calendar-day text-[10px] text-slate-400"></i>
            <span>${formattedDate}</span>
          </div>
        </td>

        <!-- เลขที่เอกสาร -->
        <td class="p-3.5 font-mono text-emerald-950 font-bold">
          <span class="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
            ${subNo}
          </span>
        </td>

        <!-- หน่วยงานส่งตรวจ (ชื่อหน่วยงานที่เข้าไปวางเพลต / จุดเก็บตัวอย่าง) -->
        <td class="p-3.5">
          <div class="font-bold text-slate-900 flex items-center gap-1.5">
            <i class="fas fa-location-dot text-emerald-600 text-xs shrink-0"></i>
            <span>${targetWard}</span>
          </div>
          <div class="text-[11px] text-slate-500 font-medium flex flex-wrap items-center gap-1.5 mt-0.5">
            <span>ผู้ส่งตรวจ: <strong class="text-slate-700 font-semibold">${r.department}</strong></span>
            <span class="text-slate-300">•</span>
            <span class="text-emerald-700 font-semibold">${r.service_name || 'ตรวจวิเคราะห์สิ่งแวดล้อม'}</span>
          </div>
        </td>

        <!-- จำนวนตัวอย่าง -->
        <td class="p-3.5 text-center">
          <span class="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold font-mono text-[11px] border border-slate-200">
            ${sampleCount} รายการ
          </span>
        </td>

        <!-- สถานะ -->
        <td class="p-3.5 text-center">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${isTested ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">
            <span class="w-1.5 h-1.5 rounded-full ${isTested ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}"></span>
            <span>${isTested ? 'ตรวจแล้ว' : 'รอตรวจ'}</span>
          </span>
        </td>

        <!-- ปุ่มจัดการ -->
        <td class="p-3.5 text-center">
          <div class="flex items-center justify-center gap-1.5 flex-wrap">
            <a href="report_view.html?id=${r.id || subNo}" target="_blank" class="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs inline-flex items-center gap-1">
              <i class="fas fa-file-lines"></i>
              <span>ดูรายงาน</span>
            </a>
            ${manageButtonsHtml(r, subNo)}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}


// ==============================================================================
// แก้ไข / ลบ ใบรายงานผล จากหน้ารายงานผลตรวจ
// ------------------------------------------------------------------------------
// ผู้ใช้ทุกหน่วยงานเรียกได้ แต่ทำได้เฉพาะใบที่อยู่ในขอบเขตของตน (canManageReport)
// admin อยู่นอกข้อจำกัดนี้ จัดการได้ทุกหน่วยงาน
// ฝั่งฐานข้อมูลยังบังคับด้วย RLS อีกชั้น (UPDATE/DELETE ต้องล็อกอินเป็น authenticated)
// ==============================================================================


// ==============================================================================
// ช่องเฉพาะแบบฟอร์มงานผลิตยา (DRG-07 / DRG-08) สำหรับกล่องแก้ไขใบรายงาน
// ------------------------------------------------------------------------------
// ใบที่บันทึกไว้ก่อนวันที่ 25 ส.ค. 2569 ไม่มีค่าเหล่านี้เก็บไว้เลย
// เพราะตัวกรองคอลัมน์ใน db.js ทิ้งค่าตั้งแต่ก่อนถึงฐานข้อมูล
// ช่องเหล่านี้จึงจำเป็นสำหรับกรอกย้อนหลัง ไม่งั้นใบเก่าจะขึ้น "-" ตลอดไป
// ==============================================================================
const DRUG_SERVICES = ['DRG_07', 'DRG_08'];
const isDrugService = (rep) => DRUG_SERVICES.includes(String(rep && rep.service_code || '').toUpperCase());

const edField = (id, label, value, type) =>
  '<div><label class="block font-semibold text-slate-700 mb-1">' + label + '</label>'
  + '<input type="' + (type || 'text') + '" id="' + id + '" value="' + String(value == null ? '' : value).replace(/"/g, '&quot;')
  + '" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"></div>';

/** ส่วน HTML ของช่องงานผลิตยา — คืนค่าว่างถ้าไม่ใช่บริการยา */
function drugFieldsHtml(rep) {
  if (!isDrugService(rep)) return '';
  const d = (v) => String(v || '').slice(0, 10);   // คอลัมน์ DATE ส่งกลับมาเป็น YYYY-MM-DD
  return ''
    + '<div class="border-t border-slate-200 pt-3 mt-1">'
    + '<div class="font-bold text-[#6c5070] mb-2">ข้อมูลผลิตภัณฑ์ยา</div>'
    + '<div class="grid grid-cols-2 gap-3">'
    +   edField('ed-lot', 'Lot No.', rep.lot_no)
    +   edField('ed-prod-date', 'ผลิตเมื่อวันที่', d(rep.production_date), 'date')
    +   edField('ed-volume', 'ปริมาณ (ml)', rep.volume, 'number')
    +   edField('ed-medicine', 'ยาเตรียม / ประเภท', rep.prepared_medicine || rep.ward_room)
    +   edField('ed-prep-date', 'วันที่เตรียม', d(rep.preparation_date), 'date')
    +   edField('ed-receipt-date', 'วันที่รับตัวอย่าง', d(rep.receipt_date), 'date')
    +   edField('ed-analysis-date', 'วันที่วิเคราะห์', d(rep.analysis_date), 'date')
    +   edField('ed-operator', 'ผู้ปฏิบัติงาน', rep.operator_name)
    +   edField('ed-sender', 'ผู้ส่งตรวจ', rep.sender_name)
    + '</div></div>';
}

/** อ่านค่าจากช่องงานผลิตยา — ช่องที่เว้นว่างส่ง null ไม่เดาค่าแทนผู้กรอก */
function readDrugFields(rep) {
  if (!isDrugService(rep)) return {};
  const v = (id) => {
    const el = document.getElementById(id);
    const val = el ? String(el.value).trim() : '';
    return val === '' ? null : val;
  };
  const num = (id) => {
    const val = v(id);
    if (val === null) return null;
    const n = parseFloat(val);
    return Number.isFinite(n) ? n : null;
  };
  return {
    lot_no: v('ed-lot'),
    production_date: v('ed-prod-date'),
    volume: num('ed-volume'),
    prepared_medicine: v('ed-medicine'),
    preparation_date: v('ed-prep-date'),
    receipt_date: v('ed-receipt-date'),
    analysis_date: v('ed-analysis-date'),
    operator_name: v('ed-operator'),
    sender_name: v('ed-sender')
  };
}

/** ผู้ใช้คนนี้เป็น admin ของงานจุลชีววิทยาหรือไม่ (ใช้กับแท็บลงผลตรวจ) */
function isAdminUser() {
  return !!(currentLoggedUser && currentLoggedUser.role === 'admin');
}
window.isAdminUser = isAdminUser;

/** แก้ไขข้อมูลส่วนหัวของใบรายงาน (หน่วยงาน / สถานที่ / วันที่ / สถานะ) */
async function editReportRecord(reportId) {
  // กันไม่ให้คีย์ข้อมูลจนเสร็จแล้วเพิ่งมารู้ว่าสิทธิ์เขียนหลุด
  if (!(await requireWriteSession())) return;

  const res = await window.ReportDB.getReportById(reportId);
  const rep = res?.data || (res && res.submission_no ? res : null);
  if (!rep) {
    Swal.fire({ icon: 'error', title: 'ไม่พบใบรายงาน', text: 'ไม่สามารถโหลดข้อมูลใบนี้ได้' });
    return;
  }

  // ต้องเช็คหลังโหลดใบ เพราะขอบเขตสิทธิ์ตัดสินจากหน่วยงานที่อยู่บนใบ
  if (!canManageReport(rep)) {
    Swal.fire({ icon: 'info', title: 'แก้ไขไม่ได้',
      text: 'แก้ไขได้เฉพาะใบส่งตรวจของหน่วยงานตนเอง', confirmButtonColor: '#6c5070' });
    return;
  }

  const waiting = isWaitingReport(rep);

  const { value: form } = await Swal.fire({
    title: '<div class="text-left"><div class="text-xs text-[#6c5070] font-semibold">แก้ไขใบส่งตรวจ / ใบรายงานผล</div>'
         + '<div class="text-base font-bold text-slate-900 mt-0.5 font-mono">' + (rep.submission_no || '') + '</div></div>',
    html:
      '<div class="text-left text-xs space-y-3 pt-1">'
      + '<div><label class="block font-semibold text-slate-700 mb-1">หน่วยงานส่งตรวจ</label>'
      + '<input id="ed-dept" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs" value="' + (rep.department || '') + '"></div>'
      + '<div><label class="block font-semibold text-slate-700 mb-1">สถานที่ / จุดเก็บตัวอย่าง</label>'
      + '<input id="ed-ward" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs" value="' + (rep.ward_room || '') + '"></div>'
      + '<div><label class="block font-semibold text-slate-700 mb-1">ผู้เก็บตัวอย่าง / ผู้ส่งตรวจ</label>'
      + '<input id="ed-sampler-name" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs" value="' + (rep.sampler_name || '') + '"></div>'
      + '<div><label class="block font-semibold text-slate-700 mb-1">อีเมลรับผลตรวจ <span class="font-normal text-slate-400">(ไม่บังคับ)</span></label>'
      + '<input type="email" id="ed-recipient-email" placeholder="name@tu.ac.th" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs" value="' + (rep.recipient_email || '') + '"></div>'
      + '<div class="grid grid-cols-2 gap-3">'
      + '<div><label class="block font-semibold text-slate-700 mb-1">วันที่เก็บตัวอย่าง</label>'
      + '<input type="date" id="ed-sampling" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs" value="' + (rep.sampling_date || '') + '"></div>'
      + '<div><label class="block font-semibold text-slate-700 mb-1">สถานะ</label>'
      + '<select id="ed-status" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">'
      + '<option value="pending"' + (waiting ? ' selected' : '') + '>⏳ รอตรวจ</option>'
      + '<option value="completed"' + (!waiting ? ' selected' : '') + '>✅ ตรวจแล้ว</option>'
      + '</select></div>'
      + '</div>'
      + '<div><label class="block font-semibold text-slate-700 mb-1">หมายเหตุ / ความเห็นทางเทคนิค</label>'
      + '<textarea id="ed-remarks" rows="2" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs">' + (rep.remarks || '') + '</textarea></div>'
      + drugFieldsHtml(rep)
      + '</div>',
    width: 560,
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-save mr-1"></i> บันทึกการแก้ไข',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#6c5070',
    cancelButtonColor: '#94a3b8',
    preConfirm: () => {
      const dept = document.getElementById('ed-dept').value.trim();
      if (!dept) { Swal.showValidationMessage('กรุณาระบุหน่วยงานส่งตรวจ'); return false; }
      return Object.assign({
        department: dept,
        ward_room: document.getElementById('ed-ward').value.trim(),
        sampler_name: document.getElementById('ed-sampler-name').value.trim(),
        recipient_email: document.getElementById('ed-recipient-email').value.trim() || null,
        sampling_date: document.getElementById('ed-sampling').value,
        status: document.getElementById('ed-status').value,
        remarks: document.getElementById('ed-remarks').value.trim()
      }, readDrugFields(rep));
    }
  });

  if (!form) return;

  Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  // ⚠️ ใบที่ยังไม่ sync มี id ชั่วคราวแบบ 'REP-...' ซึ่งไม่ใช่ UUID
  //    ต้องหา UUID จริงจาก submission_no ก่อน ไม่งั้น Postgres จะตอบ
  //    invalid input syntax for type uuid
  let targetId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(rep.id || '')) ? rep.id : null;
  if (!targetId && window.supabaseClient && rep.submission_no) {
    try {
      const { data } = await window.supabaseClient
        .from('reports').select('id').eq('submission_no', rep.submission_no).maybeSingle();
      if (data && data.id) targetId = data.id;
    } catch (e) { /* ไม่พบในฐานข้อมูล */ }
  }

  if (!targetId) {
    Swal.fire({
      icon: 'warning',
      title: 'แก้ไขไม่ได้',
      text: 'ใบนี้ยังไม่ได้บันทึกขึ้นฐานข้อมูลกลาง (มีเฉพาะในเครื่องนี้) จึงยังแก้ไขไม่ได้',
      confirmButtonColor: '#6c5070'
    });
    return;
  }

  // สถานะที่ฐานข้อมูลยอมรับ: ลองค่าที่เลือกก่อน แล้วถอยไปค่าที่ CHECK constraint รับได้
  const candidates = form.status === 'pending' ? ['pending', 'in_progress'] : ['completed', 'tested'];
  let saved = false, lastErr = null;

  for (const st of candidates) {
    // ⚠️ ต้องกระจายค่าจากกล่องแก้ไขทั้งหมด ไม่ใช่ไล่เขียนทีละช่อง
    //    เดิมระบุแค่ 5 ช่องตายตัว ช่องของงานผลิตยา (Lot No. ผลิตเมื่อวันที่ ปริมาณ ฯลฯ)
    //    ที่ผู้ใช้กรอกมาจึงถูกมองข้าม กดบันทึกแล้ว updated_at เปลี่ยนแต่ค่ายังเป็น null
    //    ทำให้ดูเหมือนบันทึกสำเร็จทั้งที่ไม่ได้บันทึก
    // ⚠️ ต้องขอแถวที่แก้จริงกลับมาด้วย .select() แล้วนับเอง
    //    RLS ที่ปฏิเสธ UPDATE ไม่คืน error แต่แก้ 0 แถว จะดูเหมือนบันทึกสำเร็จ
    const { data, error } = await window.supabaseClient
      .from('reports')
      .update({
        ...form,
        status: st,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetId)
      .select();

    if (!error && (data || []).length) { saved = true; break; }

    if (!error) {
      lastErr = new Error('ไม่มีแถวใดถูกแก้ไข — สิทธิ์เขียนอาจหลุด กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
      break;
    }

    lastErr = error;
    const isCheck = error.code === '23514' || /violates check constraint/i.test(error.message || '');
    if (!isCheck) break;
  }

  if (!saved) {
    Swal.fire({
      icon: 'error',
      title: 'แก้ไขไม่สำเร็จ',
      html: '<div class="text-xs text-left text-slate-600"><div class="font-mono text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 break-all">'
          + ((lastErr && lastErr.message) || 'ไม่ทราบสาเหตุ') + '</div>'
          + '<div class="mt-2 text-[11px] text-slate-500">การแก้ไขต้องเข้าสู่ระบบด้วยสิทธิ์เจ้าหน้าที่ (RLS)</div></div>',
      confirmButtonColor: '#6c5070'
    });
    return;
  }

  // ล้างสำเนาในเครื่องของใบนี้ ไม่ให้ข้อมูลเก่าค้างทับ
  try {
    const cached = JSON.parse(localStorage.getItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS') || '[]');
    localStorage.setItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS',
      JSON.stringify(cached.filter(x => x.submission_no !== rep.submission_no)));
  } catch (e) { /* ไม่เป็นไร */ }

  await Swal.fire({ icon: 'success', title: 'แก้ไขเรียบร้อย', timer: 1200, showConfirmButton: false });
  loadReportsArchiveTable();
}
window.editReportRecord = editReportRecord;
window.adminEditReport = editReportRecord;   // ชื่อเดิม เผื่อมีที่เรียกค้างอยู่

/** ตรวจว่าเป็น UUID จริงหรือไม่ (แถวใน Supabase ใช้ UUID เท่านั้น) */
function isRealUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
}

/** ลบสำเนาใบรายงานออกจาก localStorage ทุกที่ที่เก็บไว้ */
function purgeLocalReport(submissionNo, localId) {
  const KEYS = ['TUH_MICROBIOLOGY_SUBMITTED_REPORTS', 'tuh_mock_reports', 'TUH_MOCK_REPORTS_V3'];
  let removed = 0;
  KEYS.forEach(k => {
    try {
      const arr = JSON.parse(localStorage.getItem(k) || '[]');
      if (!Array.isArray(arr)) return;
      const left = arr.filter(r => {
        const hit = (submissionNo && r.submission_no === submissionNo) || (localId && r.id === localId);
        if (hit) removed++;
        return !hit;
      });
      localStorage.setItem(k, JSON.stringify(left));
    } catch (e) { /* ข้ามคีย์ที่อ่านไม่ได้ */ }
  });
  return removed;
}

/** ลบใบรายงานผล (ต้องพิมพ์ยืนยัน เพราะลบแล้วกู้คืนไม่ได้) */
async function deleteReportRecord(reportId) {
  // กันไม่ให้คีย์ข้อมูลจนเสร็จแล้วเพิ่งมารู้ว่าสิทธิ์เขียนหลุด
  if (!(await requireWriteSession())) return;

  const res = await window.ReportDB.getReportById(reportId);
  const rep = res?.data || (res && res.submission_no ? res : null);
  if (!rep) {
    Swal.fire({ icon: 'error', title: 'ไม่พบใบรายงาน' });
    return;
  }

  if (!canManageReport(rep)) {
    Swal.fire({ icon: 'info', title: 'ลบไม่ได้',
      text: 'ลบได้เฉพาะใบส่งตรวจของหน่วยงานตนเอง', confirmButtonColor: '#6c5070' });
    return;
  }

  const itemCount = (rep.report_items || rep.items || []).length;

  // ⚠️ ใบที่ยังไม่ได้ sync ขึ้นคลาวด์จะมี id ชั่วคราวแบบ 'REP-...' ซึ่งไม่ใช่ UUID
  //    ถ้ายิง .eq('id', 'REP-...') เข้า Postgres จะได้ error:
  //    invalid input syntax for type uuid: "REP-1787025265254"
  //    จึงต้องหา UUID จริงจาก submission_no ก่อน ถ้าไม่มีในฐานข้อมูลก็ลบเฉพาะในเครื่อง
  let dbId = isRealUuid(rep.id) ? rep.id : null;
  if (!dbId && window.supabaseClient && rep.submission_no) {
    try {
      const { data } = await window.supabaseClient
        .from('reports').select('id').eq('submission_no', rep.submission_no).maybeSingle();
      if (data && data.id) dbId = data.id;
    } catch (e) { /* ไม่พบก็ถือว่ามีเฉพาะในเครื่อง */ }
  }

  const localOnly = !dbId;

  const confirm = await Swal.fire({
    icon: 'warning',
    title: 'ยืนยันการลบใบรายงานผล',
    html:
      '<div class="text-left text-xs text-slate-600 space-y-2">'
      + '<div>เลขที่เอกสาร: <strong class="font-mono text-[#6c5070]">' + rep.submission_no + '</strong></div>'
      + '<div>หน่วยงาน: <strong>' + (rep.department || '-') + '</strong></div>'
      + '<div>รายการตัวอย่างที่จะถูกลบด้วย: <strong class="text-rose-700">' + itemCount + ' รายการ</strong></div>'
      + (localOnly
          ? '<div class="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px]">'
            + '<i class="fas fa-hard-drive mr-1"></i> ใบนี้มีเฉพาะในเครื่องนี้ (ยังไม่ได้บันทึกขึ้นฐานข้อมูลกลาง) จะลบออกจากเครื่องเท่านั้น</div>'
          : '')
      + '<div class="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px]">'
      + '<i class="fas fa-triangle-exclamation mr-1"></i> ลบแล้ว<strong>กู้คืนไม่ได้</strong> กรุณาพิมพ์คำว่า <strong>ลบ</strong> เพื่อยืนยัน</div>'
      + '</div>',
    input: 'text',
    inputPlaceholder: 'พิมพ์ ลบ',
    showCancelButton: true,
    confirmButtonText: 'ลบถาวร',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#94a3b8',
    inputValidator: (v) => (String(v).trim() !== 'ลบ' ? 'กรุณาพิมพ์คำว่า ลบ ให้ถูกต้อง' : undefined)
  });

  if (!confirm.isConfirmed) return;

  Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  if (dbId) {
    // ⚠️ RLS ที่ปฏิเสธ DELETE ไม่คืน error — ตอบ 204 แล้วลบ 0 แถว
    //    ต้องขอแถวที่ลบจริงกลับมาแล้วนับเอง ไม่งั้นจะขึ้นว่าสำเร็จทั้งที่ใบยังอยู่
    const { data, error } = await window.supabaseClient
      .from('reports').delete().eq('id', dbId).select();

    if (error || !(data || []).length) {
      Swal.fire({
        icon: 'error',
        title: 'ลบไม่สำเร็จ',
        html: '<div class="text-xs text-left text-slate-600">'
            + '<div class="font-mono text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 break-all">'
            + ((error && error.message) || 'ไม่มีแถวใดถูกลบ') + '</div>'
            + '<div class="mt-2 text-[11px] text-slate-500">การลบต้องเข้าสู่ระบบด้วยสิทธิ์เจ้าหน้าที่ (RLS) — ลองออกจากระบบแล้วเข้าใหม่</div></div>',
        confirmButtonColor: '#6c5070'
      });
      return;
    }
  }

  const removed = purgeLocalReport(rep.submission_no, rep.id);

  await Swal.fire({
    icon: 'success',
    title: 'ลบเรียบร้อย',
    html: '<div class="text-xs text-slate-600">'
        + '<div class="font-mono">' + rep.submission_no + '</div>'
        + '<div class="mt-1 text-[11px]">' + (dbId ? 'ลบจากฐานข้อมูลกลางแล้ว' : 'ลบออกจากเครื่องแล้ว')
        + (removed ? ' • ล้างสำเนาในเครื่อง ' + removed + ' รายการ' : '') + '</div></div>',
    timer: 1800,
    showConfirmButton: false
  });
  loadReportsArchiveTable();
}
window.deleteReportRecord = deleteReportRecord;
window.adminDeleteReport = deleteReportRecord;   // ชื่อเดิม เผื่อมีที่เรียกค้างอยู่


function filterReportsTable(query) {
  const allReports = window.CURRENT_WORKFLOW_REPORTS || MOCK_REPORTS_ARCHIVE;
  if (!query) {
    renderReportsArchiveTable(allReports);
    return;
  }
  const filtered = allReports.filter(r => 
    (r.department && r.department.toLowerCase().includes(query)) ||
    (r.ward_room && r.ward_room.toLowerCase().includes(query)) ||
    (r.submission_no && r.submission_no.toLowerCase().includes(query)) ||
    (r.service_name && r.service_name.toLowerCase().includes(query)) ||
    (r.sampling_date && r.sampling_date.includes(query))
  );
  renderReportsArchiveTable(filtered);
}

function handleReportsDateFilter(selectedDate) {
  const allReports = window.CURRENT_WORKFLOW_REPORTS || MOCK_REPORTS_ARCHIVE;
  if (!selectedDate) {
    renderReportsArchiveTable(allReports);
    return;
  }
  const filtered = allReports.filter(r => {
    const sDate = r.sampling_date || r.formatted_date || '';
    return sDate.includes(selectedDate);
  });
  renderReportsArchiveTable(filtered);
}
window.handleReportsDateFilter = handleReportsDateFilter;

// ==============================================================================
// 4. ลงผลตรวจ DATA GRID (เห็นเฉพาะ ADMIN เท่านั้น!)
// ==============================================================================
function initResultEntryGrid() {
  const queueSelect = document.getElementById('grid-queue-select');
  if (queueSelect) {
    queueSelect.addEventListener('change', (e) => {
      loadSubmissionIntoAdminGrid(e.target.value);
    });
  }
}

async function loadWaitingQueueIntoGrid() {
  const select = document.getElementById('grid-queue-select');
  if (!select) return;

  select.innerHTML = '<option value="">-- กำลังโหลดรายการรอตรวจ... --</option>';

  const { data: reports } = await window.ReportDB.getReports({ pageSize: 50 });
  const pendingReports = reports && reports.length > 0 ? reports : MOCK_REPORTS_ARCHIVE;

  select.innerHTML = `<option value="">-- เลือกใบส่งตรวจที่ต้องการลงผล (${pendingReports.length} รายการ) --</option>` +
    pendingReports.map(r => `
      <option value="${r.id || r.submission_no}">
        [${isWaitingReport(r) ? '⏳ รอตรวจ' : '✅ ตรวจแล้ว'}] ${r.submission_no || r.id} - ${r.ward_room || r.department} (${r.service_name})
      </option>
    `).join('');

  if (pendingReports.length > 0) {
    select.value = pendingReports[0].id || pendingReports[0].submission_no;
    loadSubmissionIntoAdminGrid(select.value);
  }
}

// ==============================================================================
// DATA GRID ลงผลตรวจ — ใช้คอลัมน์ชุดเดียวกับ "แบบฟอร์มส่งตรวจ" ของแต่ละบริการ
// ------------------------------------------------------------------------------
// เดิมตารางลงผลเป็นแบบ Air Sampling (แบคทีเรีย/เชื้อรา CFU) ตายตัวทุกบริการ
// ทำให้งานน้ำ/พื้นผิว งานอาหาร และงานยา ต้องกรอก CFU ทั้งที่รายงานจริงเป็น
// Growth / No growth ตามที่ผู้ใช้กรอกไว้ในแบบฟอร์มส่งตรวจ
// ==============================================================================
const GRID_SCHEMAS = {
  AIR_01: {
    subjects: [
      { key: 'ward_name', label: 'หน่วยงาน', width: 'w-40' },
      { key: 'location_name', label: 'ตำแหน่งที่เก็บ', width: '' }
    ],
    results: [
      { key: 'bacteria_count', label: 'Number of colonies (Bacteria)', type: 'text', width: 'w-32', placeholder: '0' },
      { key: 'fungus_count', label: 'Number of colonies (Fungus)', type: 'text', width: 'w-32', placeholder: '0' }
    ]
  },
  WTS_03: {
    subjects: [{ key: 'location_name', label: 'สถานที่/หน่วยงาน', width: '' }],
    results: [{ key: 'bacteria_count', label: 'ผลเพาะเชื้อ', type: 'growth', width: 'w-56' }]
  },
  FOD_06: {
    subjects: [{ key: 'location_name', label: 'อาหาร', width: '' }],
    results: [
      { key: 'bacteria_count', label: 'E.COLI', type: 'negative', width: 'w-44' },
      { key: 'fungus_count', label: 'P.AERUGINOSA', type: 'negative', width: 'w-44' }
    ]
  },
  STR_02: {
    subjects: [
      { key: 'location_name', label: 'หมายเลขถุงเลือด', width: 'w-48' },
      { key: 'sample_description', label: 'ชนิดผลิตภัณฑ์เลือด', width: 'w-40' }
    ],
    results: [{ key: 'bacteria_count', label: 'ผลเพาะเชื้อ', type: 'growth', width: 'w-56' }]
  },
  DRG_07: {
    subjects: [{ key: 'location_name', label: 'ชนิดยา', width: '' }],
    results: [{ key: 'bacteria_count', label: 'ผลการตรวจเพาะเชื้อที่ 72 ชม.', type: 'growth', width: 'w-56' }]
  },
  DRG_08: {
    subjects: [{ key: 'location_name', label: 'ยาเตรียม', width: '' }],
    results: [{ key: 'bacteria_count', label: 'ผล 72 ชม. (Growth/No growth)', type: 'growth', width: 'w-56' }]
  }
};
GRID_SCHEMAS.WTO_04 = GRID_SCHEMAS.WTS_03;
GRID_SCHEMAS.WTM_05 = GRID_SCHEMAS.WTS_03;

function getGridSchema(serviceCode) {
  return GRID_SCHEMAS[String(serviceCode || '').toUpperCase()] || GRID_SCHEMAS.AIR_01;
}

/** สร้างช่องกรอกผลตามชนิดของฟิลด์ (ตัวเลข CFU หรือ Growth/No growth) */
function buildGridField(field, value) {
  const v = (value === undefined || value === null || value === '-') ? '' : String(value);

  if (field.type === 'growth' || field.type === 'negative') {
    const isGrowth = /^(growth|พบเชื้อ|fail)/i.test(v);
    const optNo = field.type === 'negative' ? 'ไม่พบเชื้อ' : 'No growth';
    const optYes = field.type === 'negative' ? 'พบเชื้อ' : 'Growth';
    return '<select data-field="' + field.key + '" class="grid-input w-full px-2 py-1.5 rounded-lg border border-emerald-300 font-bold text-xs bg-white">'
      + '<option value="' + optNo + '"' + (!isGrowth ? ' selected' : '') + '>✅ ' + optNo + '</option>'
      + '<option value="' + optYes + '"' + (isGrowth ? ' selected' : '') + '>⚠️ ' + optYes + '</option>'
      + '</select>';
  }

  return '<input type="text" data-field="' + field.key + '" value="' + v + '" placeholder="' + (field.placeholder || '') + '"'
    + ' class="grid-input w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg font-mono text-center font-bold text-emerald-950 text-xs">';
}

async function loadSubmissionIntoAdminGrid(reportId) {
  const tbody = document.getElementById('admin-grid-tbody');
  const thead = document.getElementById('admin-grid-thead');
  const metaEl = document.getElementById('grid-active-meta');

  if (!reportId) {
    activeSubmissionData = null;
    if (metaEl) metaEl.innerHTML = '';
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-400 text-xs">กรุณาเลือกใบส่งตรวจ</td></tr>';
    return;
  }

  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-400 text-xs">กำลังโหลด...</td></tr>';

  const res = await window.ReportDB.getReportById(reportId);
  const report = res?.data || (res && res.submission_no ? res : null);

  if (!report) {
    activeSubmissionData = null;
    if (metaEl) metaEl.innerHTML = '';
    const msg = (res && res.error && res.error.message) || 'ไม่พบใบรายงาน';
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-rose-600 text-xs">โหลดใบส่งตรวจไม่สำเร็จ: ' + msg + '</td></tr>';
    return;
  }

  activeSubmissionData = report;
  const schema = getGridSchema(report.service_code);
  const statusLabel = isWaitingReport(report) ? '⏳ รอตรวจ' : '✅ ตรวจแล้ว';

  if (metaEl) {
    metaEl.innerHTML =
      '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#f2f8f2] p-4 rounded-2xl border border-[#c2dbc1]">'
      + '<div><span class="text-[#78687e] block">เลขที่เอกสาร:</span> <strong class="font-mono text-[#6c5070]">' + (report.submission_no || report.id) + '</strong></div>'
      + '<div><span class="text-[#78687e] block">หน่วยงาน / สถานที่:</span> <strong>' + (report.ward_room || report.department || '-') + '</strong></div>'
      + '<div><span class="text-[#78687e] block">บริการ:</span> <strong>' + (report.service_name || report.service_code) + '</strong></div>'
      + '<div><span class="text-[#78687e] block">สถานะปัจจุบัน:</span> <strong>' + statusLabel + '</strong></div>'
      + '</div>';
  }

  // หัวตารางเปลี่ยนตามบริการ
  if (thead) {
    let head = '<tr><th class="p-3 text-center w-12 bg-[#583f5c]">#</th>';
    schema.subjects.forEach(c => { head += '<th class="p-3 ' + c.width + '">' + c.label + '</th>'; });
    schema.results.forEach(c => { head += '<th class="p-3 text-center ' + c.width + '">' + c.label + '</th>'; });
    head += '<th class="p-3 text-center w-36">ผลการทดสอบ</th><th class="p-3 w-44">หมายเหตุเพิ่มเติม</th></tr>';
    thead.innerHTML = head;
  }

  if (!tbody) return;

  const items = report.report_items || report.items || [];
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-amber-700 text-xs">ใบส่งตรวจนี้ยังไม่มีรายการตัวอย่างในฐานข้อมูล (report_items)</td></tr>';
    return;
  }

  const sorted = items.slice().sort((a, b) => (a.item_no || 0) - (b.item_no || 0));

  tbody.innerHTML = sorted.map((item, idx) => {
    const no = item.item_no || idx + 1;
    let row = '<tr class="border-b border-slate-200 hover:bg-[#f2f8f2]/50 text-xs transition"'
      + ' data-item-idx="' + idx + '" data-item-id="' + (item.id || '') + '" data-item-no="' + no + '">'
      + '<td class="p-2.5 text-center font-bold text-slate-500 bg-slate-50">' + no + '</td>';

    schema.subjects.forEach(c => {
      const fallback = (c.key === 'ward_name') ? (report.ward_room || report.department || '') : '';
      const val = item[c.key] || fallback;
      row += '<td class="p-2.5"><input type="text" data-field="' + c.key + '" value="' + val + '"'
        + ' class="grid-input w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"></td>';
    });

    schema.results.forEach(c => {
      row += '<td class="p-2.5 text-center">' + buildGridField(c, item[c.key]) + '</td>';
    });

    row += '<td class="p-2.5 text-center">'
      + '<select data-field="item_result" class="grid-result px-2.5 py-1.5 rounded-lg border font-bold text-xs bg-emerald-50 text-emerald-800 border-emerald-300">'
      + '<option value="pass"' + (item.item_result !== 'fail' ? ' selected' : '') + '>✅ ผ่านเกณฑ์ (Pass)</option>'
      + '<option value="fail"' + (item.item_result === 'fail' ? ' selected' : '') + '>⚠️ ตกเกณฑ์ (Fail)</option>'
      + '</select></td>';

    row += '<td class="p-2.5"><input type="text" data-field="remarks" value="' + (item.remarks || item.notes || '') + '"'
      + ' placeholder="หมายเหตุ" class="grid-input w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"></td>';

    return row + '</tr>';
  }).join('');
}

function fastPassAllGridRows() {
  // ตั้งผ่านเกณฑ์ทุกแถว รองรับทุกบริการ (ช่องตัวเลข -> 0, ช่อง Growth -> No growth/ไม่พบเชื้อ)
  document.querySelectorAll("#admin-grid-tbody tr[data-item-idx]").forEach(tr => {
    tr.querySelectorAll("[data-field]").forEach(el => {
      const f = el.dataset.field;
      if (f === "item_result") { el.value = "pass"; return; }
      if (f !== "bacteria_count" && f !== "fungus_count") return;
      if (el.tagName === "SELECT") { el.selectedIndex = 0; }
      else if (!el.value || el.value === "-") { el.value = "0"; }
    });
  });
  Swal.fire({ icon: "success", title: "ตั้งค่าผลผ่านเกณฑ์ทุกรายการแล้ว", timer: 1000, showConfirmButton: false });
}
window.fastPassAllGridRows = fastPassAllGridRows;

async function handleAdminSaveResults() {
  if (!activeSubmissionData) {
    Swal.fire({ icon: 'warning', title: 'กรุณาเลือกใบส่งตรวจก่อน' });
    return;
  }

  // กันไม่ให้คีย์ข้อมูลจนเสร็จแล้วเพิ่งมารู้ว่าสิทธิ์เขียนหลุด
  if (!(await requireWriteSession())) return;

  Swal.fire({
    title: 'กำลังบันทึกผลการตรวจ...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    // อ่านค่าจากตารางแบบไม่ผูกกับคอลัมน์ตายตัว
    // ใช้ data-field ที่ตารางสร้างไว้ตามบริการ จึงรองรับครบทั้ง 8 บริการ
    const rows = document.querySelectorAll('#admin-grid-tbody tr[data-item-idx]');
    const updatedItems = [];
    let hasFail = false;

    rows.forEach((tr, idx) => {
      const field = {};
      tr.querySelectorAll('[data-field]').forEach(el => {
        field[el.dataset.field] = String(el.value ?? '').trim();
      });

      const res = field.item_result || 'pass';
      if (res === 'fail') hasFail = true;

      const ward = field.ward_name || activeSubmissionData.ward_room || activeSubmissionData.department || '';
      const loc = field.location_name || `จุดตรวจที่ ${idx + 1}`;

      updatedItems.push({
        item_no: parseInt(tr.dataset.itemNo, 10) || idx + 1,
        ward_name: ward,
        location_name: loc,
        sample_description: field.sample_description || `${ward} - ${loc}`,
        bacteria_count: field.bacteria_count !== undefined && field.bacteria_count !== '' ? field.bacteria_count : '-',
        fungus_count: field.fungus_count !== undefined && field.fungus_count !== '' ? field.fungus_count : '-',
        item_result: res,
        notes: field.remarks || ''
      });
    });

    if (updatedItems.length === 0) {
      Swal.fire({ icon: 'warning', title: 'ไม่มีรายการตัวอย่างให้บันทึก' });
      return;
    }

    const overallResult = hasFail ? 'fail' : 'pass';
    const updatePayload = {
      status: 'completed',
      overall_result: overallResult,
      reported_date: new Date().toISOString().split('T')[0],
      reporter_name: document.getElementById('grid-reporter-name')?.value || 'ทนพ.มานพ นันตาบุตร',
      approver_name: document.getElementById('grid-approver-name')?.value || 'ทนพญ.ปราญชลี หรั่งอ่อน',
      remarks: document.getElementById('grid-remarks')?.value || (overallResult === 'pass' ? 'ผลการตรวจวิเคราะห์คุณภาพอากาศ (Settle Plate) เป็นไปตามเกณฑ์มาตรฐานความปลอดภัยทางชีวภาพ' : 'พบปริมาณเชื้อแบคทีเรียหรือเชื้อราเกินเกณฑ์มาตรฐาน แนะนำทำความสะอาดและตรวจสอบระบบระบายอากาศ')
    };

    activeSubmissionData.report_items = updatedItems;
    activeSubmissionData.status = 'tested';
    activeSubmissionData.overall_result = overallResult;
    activeSubmissionData.reported_date = updatePayload.reported_date;
    activeSubmissionData.reporter_name = updatePayload.reporter_name;
    activeSubmissionData.approver_name = updatePayload.approver_name;
    activeSubmissionData.remarks = updatePayload.remarks;

    // Update in Mock LocalStorage as well
    const localReports = JSON.parse(localStorage.getItem('TUH_MOCK_REPORTS_V3') || '[]');
    const idx = localReports.findIndex(r => r.id === activeSubmissionData.id || r.submission_no === activeSubmissionData.submission_no);
    if (idx !== -1) {
      localReports[idx] = { ...localReports[idx], ...updatePayload, report_items: updatedItems };
      localStorage.setItem('TUH_MOCK_REPORTS_V3', JSON.stringify(localReports));
    }

    // ==========================================================================
    // บันทึกลงฐานข้อมูลจริง — แก้ 2 บั๊กสำคัญ:
    //   1) เดิมอัปเดตเฉพาะส่วนหัว ไม่เคยบันทึกผลรายตัวอย่าง → ค่า CFU ที่คีย์หายหมด
    //   2) status: 'tested' ถูก CHECK constraint ปฏิเสธ (ค่าที่รับคือ 'completed')
    //      และเดิมไม่ได้เช็ค error → สถานะไม่เคยเปลี่ยนเป็น "ตรวจแล้ว"
    // ==========================================================================
    let saveWarning = '';

    if (window.supabaseClient && activeSubmissionData.id && !String(activeSubmissionData.id).startsWith('REP-')) {
      let headerSaved = false, lastErr = null;

      // ใช้ 'completed' เป็นค่าหลัก ให้ตรงกับใบเดิมทั้งหมดและนโยบาย RLS
      for (const candidate of ['completed', 'tested']) {
        const { error } = await window.supabaseClient
          .from('reports')
          .update({ ...updatePayload, status: candidate })
          .eq('id', activeSubmissionData.id);
        if (!error) { headerSaved = true; activeSubmissionData.status = candidate; break; }
        lastErr = error;
        const isCheck = error.code === '23514' || /violates check constraint/i.test(error.message || '');
        if (!isCheck) break;
      }

      if (!headerSaved) {
        saveWarning = `บันทึกสถานะไม่สำเร็จ: ${(lastErr && lastErr.message) || 'ไม่ทราบสาเหตุ'}`;
        console.error('❌', saveWarning);
      } else {
        // บันทึกผลรายตัวอย่างกลับเข้าแถวเดิม — จับคู่ด้วย item_no กันรายการซ้ำ
        const { data: existingRows, error: fetchErr } = await window.supabaseClient
          .from('report_items').select('id, item_no').eq('report_id', activeSubmissionData.id);

        if (fetchErr) {
          saveWarning = `อ่านรายการตัวอย่างเดิมไม่สำเร็จ: ${fetchErr.message}`;
        } else {
          const byItemNo = new Map((existingRows || []).map(r => [Number(r.item_no), r.id]));
          for (const item of updatedItems) {
            const payload = {
              item_no: item.item_no,
              location_name: item.location_name,
              sample_description: item.sample_description,
              bacteria_count: String(item.bacteria_count ?? '-'),
              fungus_count: String(item.fungus_count ?? '-'),
              item_result: item.item_result,
              remarks: item.notes || ''
            };
            const existingId = byItemNo.get(Number(item.item_no));
            const { error: itemErr } = existingId
              ? await window.supabaseClient.from('report_items').update(payload).eq('id', existingId)
              : await window.supabaseClient.from('report_items').insert([{ ...payload, report_id: activeSubmissionData.id }]);
            if (itemErr) { saveWarning = `บันทึกผลรายตัวอย่างไม่สำเร็จ: ${itemErr.message}`; break; }
            byItemNo.delete(Number(item.item_no));
          }
          for (const leftoverId of byItemNo.values()) {
            await window.supabaseClient.from('report_items').delete().eq('id', leftoverId);
          }
        }
      }
    }

    // อัปเดตสำเนาในเครื่อง ไม่งั้นสถานะ "รอตรวจ" จะค้าง
    try {
      const cached = JSON.parse(localStorage.getItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS') || '[]');
      const pos = cached.findIndex(r => r.submission_no === activeSubmissionData.submission_no || r.id === activeSubmissionData.id);
      if (pos !== -1) {
        cached[pos] = { ...cached[pos], ...updatePayload, status: activeSubmissionData.status || 'completed', report_items: updatedItems, synced: true };
        localStorage.setItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS', JSON.stringify(cached));
      }
    } catch (e) { console.warn(e); }

    // ไม่ส่งผลทางอีเมลแล้ว

    if (window.NotifyService) {
      await window.NotifyService.sendReportNotification({
        ...activeSubmissionData,
        overall_result: overallResult,
        remarks: updatePayload.remarks
      });
    }

    Swal.fire({
      icon: 'success',
      title: 'บันทึกและออกผลตรวจสำเร็จ',
      html: `
        <div class="text-xs text-[#78687e] space-y-2 text-left bg-[#faf7f5] p-3.5 rounded-2xl border border-[#6c5070]/15 mt-2">
          <div>เลขที่เอกสาร: <strong class="font-mono text-[#6c5070]">${activeSubmissionData.submission_no}</strong></div>
          <div>หน่วยงาน / สถานที่: <strong class="text-[#342838]">${activeSubmissionData.ward_room || activeSubmissionData.department}</strong></div>
          <div>สถานะ: <span class="bg-[#f2f8f2] text-[#3d5e3c] font-bold px-2 py-0.5 rounded-full text-[11px] border border-[#dbe9da]">ตรวจแล้ว (Tested)</span></div>
          <div>ผลการประเมิน: <strong>${overallResult === 'pass' ? '✅ ผ่านเกณฑ์' : '⚠️ ตกเกณฑ์'}</strong></div>
          ${saveWarning ? `<div class="mt-2 text-[11px] text-[#b8860b] bg-[#fefaf0] border border-[#fde8a8] rounded-xl p-2.5"><i class="fas fa-triangle-exclamation mr-1"></i> ${saveWarning}</div>` : `<div class="text-[#3d5e3c] font-semibold"><i class="fas fa-circle-check mr-1"></i> บันทึกผลรายตัวอย่าง ${updatedItems.length} รายการ เรียบร้อย</div>`}
        </div>
      `,
      confirmButtonText: '<i class="fas fa-file-lines mr-1"></i> ไปดูตารางรายงานผลตรวจ ➔',
      confirmButtonColor: '#6c5070',
      showCancelButton: true,
      cancelButtonText: 'ปิด',
      cancelButtonColor: '#78687e',
      customClass: { popup: 'k-swal' }
    }).then(res => {
      if (res.isConfirmed) {
        switchWorkflowTab('reports');
      }
    });

  } catch (err) {
    console.error('Save results error:', err);
    Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message || 'Database error' });
  }
}
window.handleAdminSaveResults = handleAdminSaveResults;

// ==============================================================================
// NOTIFICATIONS & EMAIL
// ==============================================================================
// ยกเลิกการแจ้งผลตรวจทางอีเมลแล้ว

async function sendWebhookNotification({ title, message }) {
  if (window.NotifyService) {
    const fullText = `🏥 <b>[TUH Microbiology Alert]</b>\n<b>${title}</b>\n━━━━━━━━━━━━━━━━━━━━━\n${message}\n━━━━━━━━━━━━━━━━━━━━━\n🌐 ${window.location.origin}/workflow.html`;
    return await window.NotifyService.broadcastMessage(fullText);
  }
  console.log('🔔 Webhook Alert:', title, message);
  return true;
}

// ==============================================================================
// LIVE SUPABASE HEALTH CHECK
// ==============================================================================
async function checkSupabaseHealth() {
  const footerDot = document.getElementById('footer-supabase-dot');
  const footerText = document.getElementById('footer-supabase-status');
  try {
    if (!window.supabaseClient) throw new Error('Supabase client not loaded');
    const start = performance.now();
    await window.supabaseClient.from('reports').select('id', { count: 'exact', head: true });
    const latency = Math.round(performance.now() - start);

    if (footerDot) footerDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    if (footerText) footerText.textContent = `Supabase Online (${latency}ms)`;
  } catch (e) {
    if (footerDot) footerDot.className = 'w-2 h-2 rounded-full bg-rose-500';
    if (footerText) footerText.textContent = 'Supabase Disconnected';
  }
}
window.checkSupabaseHealth = checkSupabaseHealth;


// ==============================================================================
// สิทธิ์หน่วยงาน: เพิ่ม / แก้ไข / ยกเลิก / ลบ ใบส่งตรวจของหน่วยงานตนเอง
// ------------------------------------------------------------------------------
// กติกา:
//   หน่วยงานผู้ส่งตรวจ  -> จัดการใบของหน่วยงานตนเองได้ครบทุกอย่าง
//                        รวมใบที่ห้องแล็บออกผลแล้ว (ตามที่ผู้ใช้ระบบกำหนด)
//   admin (งานจุลชีววิทยา) -> จัดการได้ทุกหน่วยงาน
//
// มีสองระดับความรุนแรงให้เลือกใช้ ไม่ได้เหมือนกัน:
//   "ยกเลิก" ตั้ง status = 'cancelled' แถวยังอยู่ ตรวจสอบย้อนกลับได้
//   "ลบ"     ลบแถวถาวร report_items หายตาม ON DELETE CASCADE กู้คืนไม่ได้
//
// ⚠️ ใบที่ออกผลแล้วถูกเปิดให้แก้และลบตามคำสั่งของผู้ดูแลระบบ
//    ข้อกำหนด ISO 15189 ต้องการให้ผลที่ออกไปแล้วตรวจสอบย้อนกลับได้
//    ถ้าต้องการคงร่องรอยไว้ ควรใช้ "ยกเลิก" แทน "ลบ"
// ==============================================================================

const OPEN_STATUSES = ['draft', 'pending', 'waiting_for_testing', 'in_progress', 'received', 'submitted'];
const isOpenReport = (r) => OPEN_STATUSES.includes(String(r && r.status || '').toLowerCase());

/**
 * รายการนี้ (ใบส่งตรวจ หรือ คิวจอง) อยู่ในขอบเขตของผู้ใช้คนนี้หรือไม่
 * ------------------------------------------------------------------------------
 * ใช้ทั้งตอนกรองรายการที่แสดง และตอนตัดสินว่ากดปุ่ม แก้ไข/ยกเลิก/ลบ ได้ไหม
 * ต้องเป็นชุดกติกาเดียวกันเสมอ ไม่งั้นจะเกิดกรณี "เห็นใบแต่กดปุ่มไม่ได้"
 *
 * ตัวชี้ขาดเจ้าของใบคือ "รหัสบริการ" ไม่ใช่ชื่อหน่วยงานบนใบ
 * ------------------------------------------------------------------------------
 * ดูจากข้อมูลจริง 206 ใบ ช่องหน่วยงานของ AIR-01 และ WTS-03 เก็บ
 * "หอผู้ป่วยที่ไปเก็บตัวอย่าง" เช่น NICU, Stroke, ศูนย์ต้อกระจก
 * ไม่ใช่หน่วยงานที่ส่งตรวจ (งานอาชีวอนามัย / งานควบคุมโรคติดเชื้อ เป็นผู้ส่ง)
 *
 * ถ้าเทียบด้วยชื่อหน่วยงาน จะมีใบที่สองหน่วยงานอ้างสิทธิ์ทับกันถึง 55 ใบ เช่น
 *   DRG-07 48 ใบเขียนหน่วยงานว่า "งานผลิตยา" -> pharma อ้างได้ทั้งที่เป็นของ compounding
 *   AIR-01 ที่ไปเก็บตัวอย่างในธนาคารเลือด    -> bloodbank อ้างได้ทั้งที่เป็นของ occ
 * ตอนที่กติกานี้คุมแค่การมองเห็นยังพอทน แต่ตอนนี้มันคุมปุ่มลบด้วย
 * ทับกันเมื่อไหร่แปลว่าหน่วยงานหนึ่งลบใบของอีกหน่วยงานได้
 *
 * รหัสบริการประจำหน่วยงานอ่านจาก serviceCode ใน auth.js ที่เดียว
 * ทั้ง 8 หน่วยงานมีรหัสไม่ซ้ำกัน จับคู่กันแบบหนึ่งต่อหนึ่งพอดี
 */
function isRecordInUserScope(r, user) {
  const u = user || currentLoggedUser;
  if (!u || !r) return false;
  if (u.role === 'admin') return true;

  const rSrv = String(r.service_code || '').toLowerCase();
  const uSrv = String(u.serviceCode || '').toLowerCase();

  if (rSrv && uSrv) return rSrv === uSrv;

  // ใบที่ไม่มีรหัสบริการ (ของเก่าหรือที่ยังไม่ sync) ถอยไปเทียบชื่อหน่วยงาน
  if (!u.department) return false;
  const userDept = u.department.toLowerCase();
  return (r.department || '').toLowerCase().includes(userDept)
      || (r.ward_room || '').toLowerCase().includes(userDept);
}
window.isRecordInUserScope = isRecordInUserScope;

/** จัดการใบนี้ได้ไหม — ทุกใบที่อยู่ในขอบเขตของผู้ใช้ ไม่จำกัดสถานะ */
function canManageReport(r) {
  if (!currentLoggedUser || !r) return false;
  return isRecordInUserScope(r, currentLoggedUser);
}

const escD = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

async function findReportRow(id) {
  const pool = (typeof allReports !== 'undefined' && allReports) ? allReports : [];
  let r = pool.find(x => String(x.id) === String(id) || String(x.submission_no) === String(id));
  if (r) return r;
  // id ที่ส่งมาอาจเป็นเลขที่เอกสารแทน uuid (ตารางใช้ r.id || subNo)
  const col = isDbId(id) ? 'id' : 'submission_no';
  const res = await window.supabaseClient.from('reports').select('*').eq(col, id).maybeSingle();
  return res.data || null;
}

/**
 * ยกเลิกใบส่งตรวจ — ทางเลือกที่อ่อนกว่าการลบ
 * ตั้ง status = 'cancelled' แถวยังอยู่ในฐานข้อมูล ตรวจสอบย้อนกลับได้
 * ใช้อันนี้แทน deleteReportRecord ทุกครั้งที่ทำได้
 */
async function cancelReportRecord(id) {
  if (!(await requireWriteSession())) return;
  const r = await findReportRow(id);
  if (!r) return Swal.fire({ icon: 'error', title: 'ไม่พบใบส่งตรวจ', confirmButtonColor: '#6c5070' });

  if (!canManageReport(r)) {
    return Swal.fire({ icon: 'info', title: 'ยกเลิกไม่ได้',
      text: 'ยกเลิกได้เฉพาะใบส่งตรวจของหน่วยงานตนเอง', confirmButtonColor: '#6c5070' });
  }

  const ok = await Swal.fire({
    icon: 'warning', title: 'ยกเลิกใบส่งตรวจนี้?',
    html: '<div class="text-sm text-slate-600 leading-relaxed">'
        + '<div class="font-mono font-bold text-rose-600">' + escD(r.submission_no) + '</div>'
        + '<div class="mt-1 text-xs">ใบจะถูกทำเครื่องหมายว่ายกเลิกและหลุดจากคิวรอตรวจ<br>'
        + 'ข้อมูลยังเก็บไว้เพื่อการตรวจสอบย้อนกลับ ไม่ได้ลบทิ้ง</div>'
        + (isOpenReport(r) ? '' :
            '<div class="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] text-left">'
          + '⚠️ ใบนี้ห้องแล็บออกผลไปแล้ว การยกเลิกเท่ากับถอนผลที่รายงานออกไป '
          + 'หากมีผู้รับรายงานไปใช้แล้ว ควรแจ้งให้ทราบด้วย</div>')
        + '</div>',
    showCancelButton: true, confirmButtonText: 'ยกเลิกใบนี้', cancelButtonText: 'ไม่ใช่ตอนนี้',
    confirmButtonColor: '#e11d48', cancelButtonColor: '#64748b'
  });
  if (!ok.isConfirmed) return;

  const upd = await window.supabaseClient.from('reports')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', r.id).select();

  if (upd.error || !(upd.data || []).length) {
    return Swal.fire({ icon: 'error', title: 'ยกเลิกไม่สำเร็จ',
      text: (upd.error && upd.error.message) || 'ใบนี้อาจเพิ่งถูกลงผล จึงยกเลิกไม่ได้แล้ว',
      confirmButtonColor: '#6c5070' });
  }

  await Swal.fire({ icon: 'success', title: 'ยกเลิกใบส่งตรวจแล้ว', timer: 1400, showConfirmButton: false });
  if (typeof loadReportsArchiveTable === 'function') await loadReportsArchiveTable();
}

Object.assign(window, {
  cancelReportRecord, canManageReport, isOpenReport,
  deptCancelSubmission: cancelReportRecord   // ชื่อเดิม เผื่อมีที่เรียกค้างอยู่
});

// ==============================================================================
// สิทธิ์หน่วยงาน: แก้ไข / ยกเลิก คิวจองของหน่วยงานตนเอง
// ------------------------------------------------------------------------------
//   หน่วยงานผู้ส่งตรวจ -> จัดการคิวของหน่วยงานตนเองได้
//   admin              -> จัดการได้ทุกหน่วยงาน
// "ยกเลิก" ตั้ง status = 'cancelled' ไม่ลบแถว ปฏิทินกรองค่านี้ออกแล้ว
// ==============================================================================


/**
 * id ที่ใช้กับฐานข้อมูลได้จริงหรือไม่
 * ------------------------------------------------------------------------------
 * คิวที่ถูกสร้างไว้ก่อนหน้านี้อาจค้างอยู่ใน localStorage ด้วย id ปลอม 'BK-<timestamp>'
 * ถ้าส่งเข้า PostgREST จะได้ invalid input syntax for type uuid
 * ต้องดักไว้ก่อนแล้วจัดการกับสำเนาในเครื่องแทน
 */
const isDbId = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));

/** ลบคิวที่มีอยู่แค่ในเครื่องออก แล้วรีเฟรชปฏิทิน */
async function dropLocalBooking(id) {
  try {
    const KEY = 'tuh_mock_bookings';
    const local = JSON.parse(localStorage.getItem(KEY) || '[]');
    localStorage.setItem(KEY, JSON.stringify(local.filter(b => String(b.id) !== String(id))));
  } catch (e) {
    console.warn('ลบสำเนาในเครื่องไม่สำเร็จ:', e);
  }
  await renderCalendar(calYear, calMonth);
}

/**
 * จัดการคิวจองนี้ได้ไหม
 * ------------------------------------------------------------------------------
 * ใช้กติกาเดียวกับใบส่งตรวจ คือดูที่รหัสบริการเป็นหลัก
 * เดิมเทียบชื่อหน่วยงานแบบตรงตัวเป๊ะ ๆ ซึ่งพังกับข้อมูลจริง 12 จาก 18 คิว
 * เพราะคนจองพิมพ์ย่อไม่เหมือนกัน เช่น "งานอาชีวอนามัยฯ" "ผลิตยา"
 * "เวชศาสตร์การบริการโลหิต" ทำให้หน่วยงานเจ้าของคิวแก้คิวตัวเองไม่ได้
 */
function canManageBooking(b) {
  if (!currentLoggedUser || !b) return false;
  return isRecordInUserScope(b, currentLoggedUser);
}

const escBk = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const BK_FIELD = 'w-full px-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-[#6c5070] focus:outline-hidden';
const bkRow = (label, inner) =>
  '<label class="block text-left mb-2.5"><span class="block font-bold text-[#342838] mb-1 text-[11px]">'
  + label + '</span>' + inner + '</label>';

async function webEditBooking(id) {
  if (window.Swal) Swal.close();
  const b = (cachedBookings || []).find(x => String(x.id) === String(id));
  if (!b) return;
  if (!canManageBooking(b)) {
    return Swal.fire({ icon: 'info', title: 'แก้ไขไม่ได้',
      text: 'แก้ไขได้เฉพาะคิวของหน่วยงานตนเอง', confirmButtonColor: '#6c5070' });
  }
  if (!isDbId(id)) {
    await Swal.fire({ icon: 'warning', title: 'คิวนี้ไม่ได้อยู่ในฐานข้อมูล',
      html: '<div class="text-sm text-slate-600 leading-relaxed">คิวนี้เป็นข้อมูลค้างในเครื่องจากการจองที่บันทึกไม่สำเร็จ '
          + 'แก้ไขไม่ได้<br><br>ระบบจะล้างรายการค้างนี้ออก กรุณาจองใหม่อีกครั้ง</div>',
      confirmButtonColor: '#6c5070' });
    return dropLocalBooking(id);
  }

  if (!(await requireWriteSession())) return;

  const res = await Swal.fire({
    title: 'แก้ไขคิวที่จอง',
    width: '520px',
    html:
      bkRow('วันที่ส่งตรวจ', '<input id="wb-date" type="date" value="' + escBk(String(b.booking_date).slice(0, 10)) + '" class="' + BK_FIELD + '">') +
      bkRow('หน่วยงานส่งตรวจ', '<input id="wb-dept" value="' + escBk(b.department) + '" class="' + BK_FIELD + '">') +
      bkRow('ชื่อ-สกุล ผู้ส่งตรวจ', '<input id="wb-sender" value="' + escBk(b.sender_name) + '" class="' + BK_FIELD + '">') +
      bkRow('เบอร์โทรศัพท์ติดต่อ', '<input id="wb-contact" value="' + escBk(b.contact_number) + '" class="' + BK_FIELD + '">') +
      bkRow('จำนวนตัวอย่าง', '<input id="wb-count" type="number" min="1" max="60" value="' + (b.sample_count || 1) + '" class="' + BK_FIELD + '">') +
      bkRow('หมายเหตุ', '<input id="wb-notes" value="' + escBk(b.notes) + '" class="' + BK_FIELD + '">'),
    showCancelButton: true, confirmButtonText: 'บันทึกการแก้ไข', cancelButtonText: 'ปิด',
    confirmButtonColor: '#6c5070', cancelButtonColor: '#94a3b8',
    customClass: { popup: 'k-swal' },
    preConfirm: () => {
      const v = (i) => document.getElementById(i).value.trim();
      const n = parseInt(v('wb-count'), 10);
      if (!v('wb-date')) return Swal.showValidationMessage('กรุณาเลือกวันที่');
      if (!v('wb-sender')) return Swal.showValidationMessage('กรุณาระบุชื่อผู้ส่งตรวจ');
      if (!(n >= 1 && n <= 60)) return Swal.showValidationMessage('จำนวนตัวอย่างต้องอยู่ระหว่าง 1-60');
      return { booking_date: v('wb-date'), department: v('wb-dept'), sender_name: v('wb-sender'),
               contact_number: v('wb-contact'), sample_count: n, notes: v('wb-notes') };
    }
  });
  if (!res.isConfirmed) return;

  // RLS ปฏิเสธ UPDATE โดยไม่คืน error — แก้ 0 แถวแล้วเงียบ จึงต้องนับแถวเอง
  const upd = await window.supabaseClient.from('bookings')
    .update({ ...res.value, updated_at: new Date().toISOString() }).eq('id', id).select();

  if (upd.error || !(upd.data || []).length) {
    return Swal.fire({ icon: 'error', title: 'แก้ไขไม่สำเร็จ',
      text: (upd.error && upd.error.message) || 'ไม่มีแถวใดถูกแก้ไข', confirmButtonColor: '#6c5070' });
  }

  await Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1300, showConfirmButton: false });
  await renderCalendar(calYear, calMonth);
}

async function webCancelBooking(id) {
  if (window.Swal) Swal.close();
  const b = (cachedBookings || []).find(x => String(x.id) === String(id));
  if (!b) return;
  if (!canManageBooking(b)) {
    return Swal.fire({ icon: 'info', title: 'ยกเลิกไม่ได้',
      text: 'ยกเลิกได้เฉพาะคิวของหน่วยงานตนเอง', confirmButtonColor: '#6c5070' });
  }
  if (!isDbId(id)) {
    const ok = await Swal.fire({ icon: 'warning', title: 'ล้างคิวค้างในเครื่อง?',
      html: '<div class="text-sm text-slate-600 leading-relaxed">คิวนี้เป็นข้อมูลค้างในเครื่องจากการจองที่บันทึกไม่สำเร็จ '
          + 'ไม่มีอยู่ในฐานข้อมูล<br><br>ห้องแล็บไม่เห็นคิวนี้อยู่แล้ว ล้างออกได้เลย</div>',
      showCancelButton: true, confirmButtonText: 'ล้างออก', cancelButtonText: 'ไม่ใช่ตอนนี้',
      confirmButtonColor: '#e11d48', cancelButtonColor: '#94a3b8' });
    if (ok.isConfirmed) await dropLocalBooking(id);
    return;
  }

  if (!(await requireWriteSession())) return;

  const ok = await Swal.fire({
    icon: 'warning', title: 'ยกเลิกคิวนี้?',
    html: '<div class="text-sm text-slate-600">' + escBk(b.department) + '<br>'
        + '<span class="text-xs">' + escBk(b.service_name || b.service_code) + '</span><br>'
        + '<span class="text-xs text-slate-400">ข้อมูลยังเก็บไว้ ไม่ได้ลบทิ้ง</span></div>',
    showCancelButton: true, confirmButtonText: 'ยกเลิกคิว', cancelButtonText: 'ไม่ใช่ตอนนี้',
    confirmButtonColor: '#e11d48', cancelButtonColor: '#94a3b8',
    customClass: { popup: 'k-swal' }
  });
  if (!ok.isConfirmed) return;

  const upd = await window.supabaseClient.from('bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id).select();

  if (upd.error || !(upd.data || []).length) {
    return Swal.fire({ icon: 'error', title: 'ยกเลิกไม่สำเร็จ',
      text: (upd.error && upd.error.message) || 'ไม่มีแถวใดถูกแก้ไข', confirmButtonColor: '#6c5070' });
  }

  await Swal.fire({ icon: 'success', title: 'ยกเลิกคิวแล้ว', timer: 1300, showConfirmButton: false });
  await renderCalendar(calYear, calMonth);
}

Object.assign(window, { webEditBooking, webCancelBooking, canManageBooking });

// ==============================================================================
// ด่านตรวจสิทธิ์เขียนก่อนบันทึกลงฐานข้อมูล
// ------------------------------------------------------------------------------
// AuthManager.signIn ทำงานสองชั้นแยกกัน: เก็บโปรไฟล์ลง localStorage (ชั้นหน้าจอ)
// แล้วค่อยล็อกอิน Supabase ในพื้นหลัง (ชั้นสิทธิ์ฐานข้อมูล)
// ถ้าเปิดหน้าใหม่ทั้งที่ localStorage ยังจำว่าล็อกอินอยู่ signIn จะไม่ถูกเรียกอีก
// หน้าจอจึงยังบอกว่าล็อกอินแล้ว แต่ฐานข้อมูลมองเห็นเป็น anon
//
// อาการที่เจอจริง: กดบันทึกผลแล้วได้ 42501
// "new row violates row-level security policy for table reports"
// เพราะสิทธิ์ anon แก้ใบให้เป็น tested/completed ไม่ได้ตามนโยบาย
//
// ฟังก์ชันนี้พยายามต่อ session ให้เงียบ ๆ ก่อน ถ้าไม่ได้จริง ๆ ค่อยบอกผู้ใช้
// ==============================================================================
async function ensureWriteSession() {
  if (!window.supabaseClient) return false;

  const read = async () => {
    try {
      const res = await window.supabaseClient.auth.getSession();
      return res && res.data ? res.data.session : null;
    } catch (e) { return null; }
  };

  if (await read()) return true;

  if (window.AuthManager && window.AuthManager.refreshWriteSession) {
    try { await window.AuthManager.refreshWriteSession(); } catch (e) { /* เช็คผลด้านล่าง */ }
  }
  return !!(await read());
}

/** เรียกก่อนทุกคำสั่งเขียน — คืน true เมื่อเขียนได้จริง */
async function requireWriteSession() {
  if (await ensureWriteSession()) return true;

  await Swal.fire({
    icon: 'error',
    title: 'บันทึกไม่ได้ — สิทธิ์เขียนหลุด',
    html: '<div class="text-sm text-slate-600 leading-relaxed text-left">'
        + 'ระบบยังจำว่าคุณล็อกอินอยู่ แต่การเชื่อมต่อสิทธิ์กับฐานข้อมูลหมดอายุแล้ว '
        + 'ข้อมูลที่กรอกไว้ยังอยู่บนหน้าจอ<br><br>'
        + '<b>กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่</b> จากนั้นกดบันทึกอีกครั้ง</div>',
    confirmButtonText: 'ไปหน้าเข้าสู่ระบบ',
    showCancelButton: true,
    cancelButtonText: 'ไว้ทีหลัง',
    confirmButtonColor: '#6c5070',
    cancelButtonColor: '#94a3b8'
  }).then(r => {
    if (r.isConfirmed) location.href = '/login.html?redirect=' + encodeURIComponent(location.href);
  });
  return false;
}

Object.assign(window, { ensureWriteSession, requireWriteSession });
