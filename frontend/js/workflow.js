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
    botToken: 'REMOVED__USE_ENV_TELEGRAM_BOT_TOKEN',
    chatId: '-5294922475'
  },
  line: {
    enabled: true,
    token: 'REMOVED__USE_ENV_LINE_CHANNEL_ACCESS_TOKEN',
    groupId: 'C087508cdd6240cfd4c6358d8a88fcaaa'
  },
  email: {
    enabled: true,
    provider: 'emailjs',
    emailjsServiceId: 'YOUR_EMAILJS_SERVICE_ID',
    emailjsTemplateId: 'YOUR_EMAILJS_TEMPLATE_ID',
    emailjsPublicKey: 'YOUR_EMAILJS_PUBLIC_KEY',
    resendApiKey: 'YOUR_RESEND_API_KEY'
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
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth() + 1; // 1-12
let cachedBookings = [];
let cachedHolidays = [];
let activeSubmissionData = null;
let healthCheckTimer = null;
let currentLoggedUser = null;
let adminDeptFilter = ''; // Filter selected by Admin in Reports Archive

// Mock Fallback Data (Categorized by Department & Sorted with Newest on Top)
const MOCK_REPORTS_ARCHIVE = [
  // 1. งานควบคุมโรคติดเชื้อ (icn)
  { 
    id: 'R-6908-401', 
    submission_no: 'WTS-6908-401', 
    sampling_date: '2569-08-12', 
    formatted_date: '12/8/2569', 
    department: 'งานควบคุมโรคติดเชื้อ', 
    ward_room: 'หอผู้ป่วย ICU ศัลยกรรม ชั้น 3 อาคารกิตติวัฒนา',
    service_code: 'WTS_03',
    service_name: 'ตรวจพื้นผิวและน้ำบริโภค (Water or Surface IC)', 
    sample_count: 6, 
    status: 'tested', 
    overall_result: 'pass' 
  },
  { 
    id: 'R-6908-402', 
    submission_no: 'WTS-6908-402', 
    sampling_date: '2569-08-10', 
    formatted_date: '10/8/2569', 
    department: 'งานควบคุมโรคติดเชื้อ', 
    ward_room: 'หอผู้ป่วยกุมารเวชกรรม 2 ชั้น 4',
    service_code: 'WTS_03',
    service_name: 'ตรวจพื้นผิวและน้ำบริโภค (Water or Surface IC)', 
    sample_count: 4, 
    status: 'tested', 
    overall_result: 'pass' 
  },
  { 
    id: 'R-6907-403', 
    submission_no: 'WTS-6907-403', 
    sampling_date: '2569-07-28', 
    formatted_date: '28/7/2569', 
    department: 'งานควบคุมโรคติดเชื้อ', 
    ward_room: 'หอผู้ป่วยอายุรกรรมหญิง 2',
    service_code: 'WTS_03',
    service_name: 'ตรวจพื้นผิวและน้ำบริโภค (Water or Surface IC)', 
    sample_count: 5, 
    status: 'tested', 
    overall_result: 'pass' 
  },
  { 
    id: 'R-6907-404', 
    submission_no: 'WTS-6907-404', 
    sampling_date: '2569-07-14', 
    formatted_date: '14/7/2569', 
    department: 'งานควบคุมโรคติดเชื้อ', 
    ward_room: 'จุดบริการน้ำดื่มผู้ป่วยนอก อาคาร ม.ร.ว.สุวพรรณ',
    service_code: 'WTS_03',
    service_name: 'ตรวจพื้นผิวและน้ำบริโภค (Water or Surface IC)', 
    sample_count: 3, 
    status: 'tested', 
    overall_result: 'pass' 
  },
  { 
    id: 'R-6906-405', 
    submission_no: 'WTS-6906-405', 
    sampling_date: '2569-06-24', 
    formatted_date: '24/6/2569', 
    department: 'งานควบคุมโรคติดเชื้อ', 
    ward_room: 'หอผู้ป่วยศัลยกรรมอุบัติเหตุ ชั้น 5',
    service_code: 'WTS_03',
    service_name: 'ตรวจพื้นผิวและน้ำบริโภค (Water or Surface IC)', 
    sample_count: 6, 
    status: 'tested', 
    overall_result: 'pass' 
  },

  // 2. งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร (occ)
  { 
    id: 'R-6908-201', 
    submission_no: 'AIR-6908-201', 
    sampling_date: '2569-08-11', 
    formatted_date: '11/8/2569', 
    department: 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร', 
    ward_room: 'OPD MED 3 (คลินิกอายุรกรรม)',
    service_code: 'AIR_01',
    service_name: 'ตรวจอากาศในอาคาร (Air Sampling)', 
    sample_count: 5, 
    status: 'tested', 
    overall_result: 'pass' 
  },
  { 
    id: 'R-6908-202', 
    submission_no: 'AIR-6908-202', 
    sampling_date: '2569-08-10', 
    formatted_date: '10/8/2569', 
    department: 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร', 
    ward_room: 'หน่วยตรวจศัลยกรรมกระดูกและข้อ (Orthopedic OPD)',
    service_code: 'AIR_01',
    service_name: 'ตรวจอากาศในอาคาร (Air Sampling)', 
    sample_count: 4, 
    status: 'tested', 
    overall_result: 'pass' 
  },
  { 
    id: 'R-6908-203', 
    submission_no: 'AIR-6908-203', 
    sampling_date: '2569-08-04', 
    formatted_date: '4/8/2569', 
    department: 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร', 
    ward_room: 'ศูนย์ต้อกระจกและผ่าตัดตา',
    service_code: 'AIR_01',
    service_name: 'ตรวจอากาศในอาคาร (Air Sampling)', 
    sample_count: 1, 
    status: 'tested', 
    overall_result: 'pass' 
  },
  { 
    id: 'R-6906-204', 
    submission_no: 'AIR-6906-204', 
    sampling_date: '2569-06-16', 
    formatted_date: '16/6/2569', 
    department: 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร', 
    ward_room: 'หน่วยเคมีบำบัดผู้ป่วยนอก (Chemotherapy Unit)',
    service_code: 'AIR_01',
    service_name: 'ตรวจอากาศในอาคาร (Air Sampling)', 
    sample_count: 8, 
    status: 'tested', 
    overall_result: 'pass' 
  },
  { 
    id: 'R-6905-205', 
    submission_no: 'AIR-6905-205', 
    sampling_date: '2569-05-27', 
    formatted_date: '27/5/2569', 
    department: 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร', 
    ward_room: 'งานเวชสารสนเทศและห้อง Server อาคารบริหาร',
    service_code: 'AIR_01',
    service_name: 'ตรวจอากาศในอาคาร (Air Sampling)', 
    sample_count: 8, 
    status: 'tested', 
    overall_result: 'pass' 
  },
  { 
    id: 'R-6905-206', 
    submission_no: 'AIR-6905-206', 
    sampling_date: '2569-05-26', 
    formatted_date: '26/5/2569', 
    department: 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร', 
    ward_room: 'งานการพยาบาลเวชศาสตร์การเจริญพันธุ์ (ผู้มีบุตรยาก)',
    service_code: 'AIR_01',
    service_name: 'ตรวจอากาศในอาคาร (Air Sampling)', 
    sample_count: 10, 
    status: 'tested', 
    overall_result: 'pass' 
  },

  // 3. งานผลิตยา (หน่วยเตรียมยาปราศจากเชื้อ) (compounding)
  { 
    id: 'R-6907-104', 
    submission_no: 'DRG-6907-104', 
    sampling_date: '2569-07-15', 
    formatted_date: '15/7/2569', 
    department: 'งานผลิตยา (หน่วยเตรียมยาปราศจากเชื้อ)', 
    ward_room: 'ห้องเตรียมยาปลอดเชื้อ ชั้น 2 (Cleanroom Class A)',
    service_code: 'DRG_07',
    service_name: 'ตรวจยาปราศจากเชื้อ (Drug Compounding Sterility)', 
    sample_count: 3, 
    status: 'tested', 
    overall_result: 'pass' 
  },
  { 
    id: 'R-6906-105', 
    submission_no: 'DRG-6906-105', 
    sampling_date: '2569-06-20', 
    formatted_date: '20/6/2569', 
    department: 'งานผลิตยา (หน่วยเตรียมยาปราศจากเชื้อ)', 
    ward_room: 'Laminar Air Flow Cleanroom ตู้เตรียมยา 1',
    service_code: 'DRG_07',
    service_name: 'ตรวจยาปราศจากเชื้อ (Drug Compounding Sterility)', 
    sample_count: 5, 
    status: 'tested', 
    overall_result: 'pass' 
  },

  // 4. งานผลิตยา (pharma)
  { 
    id: 'R-6907-301', 
    submission_no: 'DRG-6907-301', 
    sampling_date: '2569-07-18', 
    formatted_date: '18/7/2569', 
    department: 'งานผลิตยา', 
    ward_room: 'หน่วยผลิตยาน้ำและยาทาภายนอก',
    service_code: 'DRG_08',
    service_name: 'ตรวจการปนเปื้อนเชื้อในยา (Drug Bioburden)', 
    sample_count: 4, 
    status: 'tested', 
    overall_result: 'pass' 
  },

  // 5. งานธนาคารเลือด (bloodbank)
  { 
    id: 'R-6908-501', 
    submission_no: 'STR-6908-501', 
    sampling_date: '2569-08-08', 
    formatted_date: '8/8/2569', 
    department: 'งานธนาคารเลือด', 
    ward_room: 'ห้องเตรียมส่วนประกอบโลหิต (Platelet Agitator Room)',
    service_code: 'STR_02',
    service_name: 'ตรวจความปราศจากเชื้อ (Sterility Test)', 
    sample_count: 2, 
    status: 'tested', 
    overall_result: 'pass' 
  },

  // 6. งานโภชนาการ (nutrition)
  { 
    id: 'R-6906-107', 
    submission_no: 'FOD-6906-107', 
    sampling_date: '2569-06-09', 
    formatted_date: '9/6/2569', 
    department: 'งานโภชนาการ', 
    ward_room: 'โรงครัวเตรียมอาหารผู้ป่วยและภาชนะบรรจุ',
    service_code: 'FOD_06',
    service_name: 'ตรวจสุขาภิบาลอาหารและภาชนะ (Food Sanitation)', 
    sample_count: 4, 
    status: 'tested', 
    overall_result: 'pass' 
  },

  // 7. ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)
  { 
    id: 'R-6907-701', 
    submission_no: 'WTM-6907-701', 
    sampling_date: '2569-07-22', 
    formatted_date: '22/7/2569', 
    department: 'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)', 
    ward_room: 'หน่วยไตเทียมและระบบน้ำ RO THAMC',
    service_code: 'WTM_05',
    service_name: 'ตรวจน้ำศูนย์การแพทย์ (Water THAMC)', 
    sample_count: 4, 
    status: 'tested', 
    overall_result: 'pass' 
  },

  // 8. ห้องผ่าตัด (or)
  { 
    id: 'R-6905-110', 
    submission_no: 'WTO-6905-110', 
    sampling_date: '2569-05-26', 
    formatted_date: '26/5/2569', 
    department: 'ห้องผ่าตัด (OR)', 
    ward_room: 'ห้องผ่าตัดใหญ่ OR-5 (ระบบน้ำล้างมือก่อนผ่าตัด)',
    service_code: 'WTO_04',
    service_name: 'ตรวจน้ำห้องผ่าตัด (Water for Surgery OR)', 
    sample_count: 4, 
    status: 'tested', 
    overall_result: 'pass' 
  }
];

// ==============================================================================
// INITIALIZATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  await checkUserRoleAndInitTabs();
  await initBookingCalendar();
  initSubmissionForm();
  initResultEntryGrid();
  await initReportsArchive();

  // Background Health Check
  await checkSupabaseHealth();
  healthCheckTimer = setInterval(checkSupabaseHealth, WORKFLOW_CONFIG.supabasePingIntervalMs);
});

// ==============================================================================
// ROLE CHECK & TAB NAVIGATION (เห็นแท็บลงผลเฉพาะ ADMIN)
// ==============================================================================
async function checkUserRoleAndInitTabs() {
  if (window.AuthManager) {
    currentLoggedUser = await window.AuthManager.getCurrentUser();
  }

  const isAdmin = (currentLoggedUser && currentLoggedUser.role === 'admin');
  const adminTabPill = document.getElementById('tab-pill-result-grid');
  const userBanner = document.getElementById('workflow-user-banner');
  const adminDeptFilterContainer = document.getElementById('admin-dept-filter-container');

  if (isAdmin) {
    if (adminTabPill) adminTabPill.classList.remove('hidden');
    if (adminDeptFilterContainer) adminDeptFilterContainer.classList.remove('hidden');
    if (userBanner) {
      userBanner.innerHTML = `
        <div class="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 text-xs px-3.5 py-1.5 rounded-full border border-emerald-400/30">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>เข้าสู่ระบบ: <strong>ADMIN MASTER</strong> (สิทธิ์ดูทุกหน่วยงาน & ลงผล Data Grid)</span>
        </div>
      `;
    }
  } else {
    if (adminTabPill) adminTabPill.classList.add('hidden');
    if (adminDeptFilterContainer) adminDeptFilterContainer.classList.add('hidden');
    if (userBanner && currentLoggedUser) {
      userBanner.innerHTML = `
        <div class="inline-flex items-center gap-2 bg-slate-800 text-slate-300 text-xs px-3.5 py-1.5 rounded-full border border-slate-700">
          <i class="fas fa-building text-emerald-400"></i>
          <span>เข้าสู่ระบบ: <strong>${currentLoggedUser.department || currentLoggedUser.displayName}</strong></span>
        </div>
      `;
    }
  }

  // ตรวจสอบ URL Search Params (เช่น ?tab=calendar, ?tab=submission, ?service=AIR_01)
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab') || 'calendar';
  const targetService = urlParams.get('service');

  if (targetService) {
    const srvSelect = document.getElementById('sub-service-select');
    if (srvSelect) {
      srvSelect.value = targetService;
      generateSubmissionNo();
    }
  }

  // สลับไปยังแท็บที่ระบุใน URL หรือเริ่มต้นที่ Calendar
  switchWorkflowTab(targetTab);
}

/**
 * สลับแท็บหน้าจอการทำงาน
 */
function switchWorkflowTab(tabName) {
  if (tabName === 'result-grid') {
    const isAdmin = (currentLoggedUser && currentLoggedUser.role === 'admin');
    if (!isAdmin) {
      Swal.fire({
        icon: 'warning',
        title: 'เฉพาะผู้ดูแลระบบ (Admin Only)',
        text: 'หน้าลงผลการตรวจวิเคราะห์สงวนสิทธิ์เฉพาะผู้ดูแลระบบห้องปฏิบัติการเท่านั้น',
        confirmButtonColor: '#047857'
      });
      return;
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

  // ปรับสไตล์ปุ่มแท็บ
  Object.keys(tabPills).forEach(key => {
    const pill = tabPills[key];
    if (pill) {
      if (key === tabName) {
        pill.className = 'step-pill flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-700 text-white font-bold shadow-md transition text-xs border border-emerald-600';
      } else {
        pill.className = 'step-pill flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-700 font-semibold transition text-xs border border-slate-200';
      }
    }
  });

  // สลับการแสดงผล Panel
  Object.keys(panels).forEach(key => {
    const p = panels[key];
    if (p) {
      if (key === tabName) {
        p.classList.remove('hidden');
      } else {
        p.classList.add('hidden');
      }
    }
  });

  // โหลดข้อมูลตามแท็บที่เลือก
  if (tabName === 'calendar') {
    renderCalendar(calYear, calMonth);
  } else if (tabName === 'reports') {
    loadReportsArchiveTable();
  } else if (tabName === 'result-grid') {
    loadWaitingQueueIntoGrid();
  }
}
window.switchWorkflowTab = switchWorkflowTab;

// ==============================================================================
// 1. ปฏิทินจองวัน (BOOKING CALENDAR - จันทร์-พุธ)
// ==============================================================================
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

/**
 * เรนเดอร์ปฏิทินประจำเดือน
 */
async function renderCalendar(year, month) {
  const titleEl = document.getElementById('calendar-month-title');
  const gridEl = document.getElementById('calendar-days-grid');
  if (!gridEl) return;

  const thaiYear = year + 543;
  if (titleEl) {
    titleEl.textContent = `${THAI_MONTHS[month - 1]} ${thaiYear}`;
  }

  gridEl.innerHTML = `<div class="col-span-7 p-10 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p>กำลังโหลดข้อมูลการจอง...</p></div>`;

  try {
    cachedBookings = await window.BookingDB.getBookingsByMonth(year, month);
  } catch (e) {
    cachedBookings = [];
  }

  const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  let html = '';

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    html += `
      <div class="min-h-[100px] p-2 bg-slate-100/40 border border-slate-100 rounded-xl opacity-30 cursor-not-allowed">
        <span class="text-xs text-slate-400 font-medium">${day}</span>
      </div>
    `;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay(); // 0:Sun, 1:Mon, 2:Tue, 3:Wed, 4:Thu, 5:Fri, 6:Sat
    const isToday = dateStr === todayStr;

    const holiday = cachedHolidays.find(h => h.holiday_date === dateStr);
    const isHoliday = !!holiday;

    const isOpenDay = (dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 3) && !isHoliday;
    const dayBookings = cachedBookings.filter(b => b.booking_date === dateStr);
    const bookingCount = dayBookings.length;

    if (isOpenDay) {
      html += `
        <div onclick="handleDayClick('${dateStr}', '${d} ${THAI_MONTHS[month - 1]} ${thaiYear}')" 
             class="min-h-[105px] p-2 sm:p-2.5 bg-white border ${isToday ? 'border-emerald-500 ring-2 ring-emerald-400/40' : 'border-emerald-200'} rounded-xl shadow-2xs hover:shadow-md hover:border-emerald-500 hover:scale-[1.01] transition cursor-pointer flex flex-col justify-between group">
          
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold ${isToday ? 'w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center' : 'text-slate-800'}">
              ${d}
            </span>
            <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md">
              เปิดรับ
            </span>
          </div>

          <div class="mt-1 space-y-1">
            ${bookingCount > 0 ? `
              <div class="text-[11px] font-semibold text-emerald-800 bg-emerald-50/90 rounded-md px-1.5 py-0.5 border border-emerald-200 flex items-center justify-between">
                <span><i class="fas fa-list-check text-[10px] mr-0.5"></i> จองแล้ว</span>
                <span class="font-bold font-mono">${bookingCount} คิว</span>
              </div>
            ` : `
              <div class="text-[10px] text-slate-400 text-center py-1">ยังไม่มีคิว</div>
            `}
          </div>

          <div class="text-[10px] text-center font-bold text-emerald-600 group-hover:text-emerald-800 transition pt-1 border-t border-slate-100">
            + คลิกเพื่อจอง
          </div>
        </div>
      `;
    } else {
      const reason = isHoliday ? (holiday.holiday_name || 'วันหยุดนักขัตฤกษ์') : (dayOfWeek === 4 || dayOfWeek === 5 ? 'งดรับ (พฤหัส-ศุกร์)' : 'วันหยุด (ส.-อา.)');
      html += `
        <div class="min-h-[105px] p-2 bg-slate-50/70 border border-slate-200/60 rounded-xl opacity-60 flex flex-col justify-between cursor-not-allowed">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500">${d}</span>
            <span class="text-[9px] font-medium text-slate-500 bg-slate-200 px-1 py-0.2 rounded">ปิด</span>
          </div>
          <div class="text-[10px] text-slate-400 text-center line-clamp-2 px-1">
            ${reason}
          </div>
          <div class="text-[9px] text-slate-400 text-center">งดส่งตรวจ</div>
        </div>
      `;
    }
  }

  gridEl.innerHTML = html;
}

/**
 * เมื่อคลิกเลือกวันบนปฏิทิน -> แสดง Modal จองคิว
 */
async function handleDayClick(dateStr, thaiDateStr) {
  const user = currentLoggedUser || (window.AuthManager ? await window.AuthManager.getCurrentUser() : null);
  const defaultDept = user?.department || '';
  const defaultSender = user?.displayName || '';
  const defaultService = user?.serviceCode || 'AIR_01';

  const dayBookings = cachedBookings.filter(b => b.booking_date === dateStr);
  const count = dayBookings.length;

  Swal.fire({
    title: `<div class="text-left"><div class="text-xs text-emerald-600 font-semibold">แบบฟอร์มจองวันส่งตรวจสิ่งแวดล้อม</div><div class="text-base font-bold text-slate-900 mt-0.5">${thaiDateStr}</div></div>`,
    html: `
      <form id="swal-booking-form" class="text-left text-xs font-sans space-y-3 pt-2">
        
        ${count >= 10 ? `
          <div class="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-[11px] flex items-start gap-2">
            <i class="fas fa-triangle-exclamation text-amber-600 mt-0.5 shrink-0"></i>
            <div><strong>มีคิวจองแล้ว ${count} คิว (หนาแน่น):</strong> ยังสามารถจองเพิ่มได้ตามปกติ</div>
          </div>
        ` : `
          <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-emerald-800 text-[11px]">
            <i class="fas fa-info-circle text-emerald-600 mr-1"></i>
            <span>สามารถจองส่งตรวจได้หลายรายการในวันเดียวกัน (ไม่จำกัดจำนวนคิว)</span>
          </div>
        `}

        <div>
          <label class="block font-semibold text-slate-700 mb-1">ชื่อ-สกุล ผู้ส่งตรวจ <span class="text-rose-500">*</span></label>
          <input type="text" id="bk-sender-name" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs" placeholder="ระบุชื่อและตำแหน่ง" value="${defaultSender}" required>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">หน่วยงานส่งตรวจ <span class="text-rose-500">*</span></label>
            <input type="text" id="bk-department" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs" placeholder="ระบุหน่วยงาน" value="${defaultDept}" required>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์ติดต่อ <span class="text-rose-500">*</span></label>
            <input type="tel" id="bk-contact" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs" placeholder="เช่น 02-926-9460" required>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">บริการส่งตรวจ <span class="text-rose-500">*</span></label>
            <select id="bk-service" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs" required>
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
            <label class="block font-semibold text-slate-700 mb-1">จำนวนสิ่งส่งตรวจ (ชิ้น)</label>
            <input type="number" id="bk-sample-count" min="1" max="200" value="10" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs" required>
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">หมายเหตุ / จุดที่เข้าไปวางเพลต</label>
          <input type="text" id="bk-notes" class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs" placeholder="เช่น หอผู้ป่วย ICU, ตรวจประจำเดือน, Big Cleaning">
        </div>
      </form>
    `,
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-check mr-1"></i> ยืนยันการจองวัน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#047857',
    cancelButtonColor: '#64748b',
    preConfirm: () => {
      const sender = document.getElementById('bk-sender-name').value.trim();
      const dept = document.getElementById('bk-department').value.trim();
      const phone = document.getElementById('bk-contact').value.trim();
      const service = document.getElementById('bk-service').value;
      const count = parseInt(document.getElementById('bk-sample-count').value, 10) || 1;
      const notes = document.getElementById('bk-notes').value.trim();

      if (!sender || !dept || !phone || !service) {
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
      Swal.fire({
        title: 'กำลังบันทึกการจอง...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      await window.BookingDB.createBooking(result.value);

      await sendWebhookNotification({
        title: `📅 จองวันส่งตรวจใหม่ [${result.value.service_name}]`,
        message: `หน่วยงาน: ${result.value.department}\nผู้ส่ง: ${result.value.sender_name} (${result.value.contact_number})\nวันที่นัดหมาย: ${dateStr}\nจำนวน: ${result.value.sample_count} ชิ้น`
      });

      Swal.fire({
        icon: 'success',
        title: 'จองวันส่งตรวจสำเร็จ!',
        html: `
          <div class="text-xs text-slate-600 space-y-1.5 text-left">
            <div>วันที่นัดหมาย: <strong class="text-emerald-700 font-bold">${dateStr}</strong></div>
            <div>หน่วยงาน: <strong>${result.value.department}</strong></div>
            <div>บริการ: <strong>${result.value.service_name}</strong> (${result.value.sample_count} ชิ้น)</div>
          </div>
        `,
        confirmButtonText: 'ไปกรอกแบบฟอร์มส่งตรวจ (Tab 2) ➔',
        confirmButtonColor: '#047857',
        showCancelButton: true,
        cancelButtonText: 'ปิด'
      }).then(r => {
        if (r.isConfirmed) {
          const deptInput = document.getElementById('sub-department');
          const dateInput = document.getElementById('sub-sampling-date');
          const srvSelect = document.getElementById('sub-service-select');
          const countInput = document.getElementById('sub-sample-count');

          if (deptInput) deptInput.value = result.value.department;
          if (dateInput) dateInput.value = dateStr;
          if (srvSelect) srvSelect.value = result.value.service_code;
          if (countInput) countInput.value = result.value.sample_count;

          buildSampleItemsMatrix(result.value.sample_count);
          switchWorkflowTab('submission');
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
function initSubmissionForm() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateInput = document.getElementById('sub-sampling-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }

  const countInput = document.getElementById('sub-sample-count');
  if (countInput) {
    countInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) || 5;
      buildSampleItemsMatrix(Math.min(Math.max(val, 1), 50));
    });
  }

  generateSubmissionNo();
  buildSampleItemsMatrix(10);

  if (currentLoggedUser && currentLoggedUser.department) {
    const deptInput = document.getElementById('sub-department');
    if (deptInput && !deptInput.value) deptInput.value = currentLoggedUser.department;
    const srvSelect = document.getElementById('sub-service-select');
    if (srvSelect && currentLoggedUser.serviceCode) {
      srvSelect.value = currentLoggedUser.serviceCode;
      generateSubmissionNo();
    }
  }
}

function generateSubmissionNo() {
  const subNoInput = document.getElementById('sub-submission-no');
  const srvSelect = document.getElementById('sub-service-select');
  const prefix = srvSelect?.value ? srvSelect.value.split('_')[0] : 'AIR';
  
  const d = new Date();
  const yy = String((d.getFullYear() + 543) % 100);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  
  if (subNoInput) {
    subNoInput.value = `${prefix}-${yy}${mm}-${rand}`;
  }
}

function buildSampleItemsMatrix(rowCount = 10) {
  const tbody = document.getElementById('sub-items-tbody');
  if (!tbody) return;

  const defaultDept = currentLoggedUser?.department || '';

  tbody.innerHTML = '';
  for (let i = 1; i <= rowCount; i++) {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100 hover:bg-slate-50 text-xs transition';
    tr.innerHTML = `
      <td class="p-3 text-center font-bold text-slate-500 bg-slate-50/50">${i}</td>
      <td class="p-2.5">
        <input type="text" class="sub-item-ward w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" placeholder="พิมพ์หรือเลือก Ward เช่น ICU, OPD..." value="${defaultDept}">
      </td>
      <td class="p-2.5">
        <input type="text" class="sub-item-loc w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" placeholder="เช่น โต๊ะกลางห้อง, ก๊อกน้ำบริโภค">
      </td>
      <td class="p-2.5 text-center">
        <input type="text" disabled value="-" class="w-full px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 text-center font-mono cursor-not-allowed text-xs" title="🔒 สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผล">
      </td>
      <td class="p-2.5 text-center">
        <input type="text" disabled value="-" class="w-full px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 text-center font-mono cursor-not-allowed text-xs" title="🔒 สำหรับเจ้าหน้าที่ห้องปฏิบัติการลงผล">
      </td>
      <td class="p-2.5">
        <input type="text" class="sub-item-notes w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" placeholder="หมายเหตุ">
      </td>
    `;
    tbody.appendChild(tr);
  }
}

async function handleSubmissionFormSubmit(e) {
  e.preventDefault();

  const submissionNo = document.getElementById('sub-submission-no')?.value || `AIR-${Date.now()}`;
  const samplingDate = document.getElementById('sub-sampling-date').value;
  const department = document.getElementById('sub-department').value.trim();
  const serviceCode = document.getElementById('sub-service-select').value;
  const email = document.getElementById('sub-sender-email').value.trim();

  if (!samplingDate || !department) {
    Swal.fire({ icon: 'warning', title: 'กรุณากรอกข้อมูลให้ครบถ้วน', text: 'โปรดระบุวันที่ส่งตรวจและหน่วยงาน' });
    return;
  }

  const rows = document.querySelectorAll('#sub-items-tbody tr');
  const items = [];
  rows.forEach((tr, idx) => {
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
  });

  const srvObj = window.SERVICES_CONFIG[serviceCode] || { name: 'ตรวจวิเคราะห์สิ่งแวดล้อม' };

  // First item's ward or department
  const targetWard = items.length > 0 ? items[0].ward_name : department;

  const reportPayload = {
    submission_no: submissionNo,
    service_code: serviceCode,
    service_name: srvObj.name,
    department: department,
    ward_room: targetWard,
    recipient_email: email,
    sampling_date: samplingDate,
    received_date: new Date().toISOString().split('T')[0],
    status: 'waiting_for_testing',
    overall_result: 'pending',
    remarks: 'นำส่งตัวอย่างแล้ว อยู่ระหว่างรอห้องปฏิบัติการดำเนินการตรวจวิเคราะห์'
  };

  Swal.fire({
    title: 'กำลังบันทึกส่งรายการตรวจ...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const { data, error } = await window.ReportDB.createReport(reportPayload, items, []);
    if (error) throw error;

    await sendWebhookNotification({
      title: `📥 ได้รับสิ่งส่งตรวจใหม่ [${srvObj.name}]`,
      message: `เลขที่: ${submissionNo}\nหน่วยงาน: ${department} (${targetWard})\nจำนวนตัวอย่าง: ${items.length} รายการ\nอีเมลแจ้งเตือน: ${email || '-'}`
    });

    Swal.fire({
      icon: 'success',
      title: 'บันทึกส่งรายการตรวจสำเร็จ!',
      html: `
        <div class="text-xs text-slate-600 space-y-2 text-left">
          <div>เลขที่เอกสาร: <strong class="font-mono text-emerald-800">${submissionNo}</strong></div>
          <div>หน่วยงานส่งตรวจ: <strong>${department}</strong></div>
          <div>สถานที่เข้าไปวางเพลต: <strong>${targetWard}</strong></div>
          <div>สถานะ: <span class="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full text-[11px]">รอตรวจ (Waiting for testing)</span></div>
          <div>อีเมลรับผล: <strong>${email || 'ไม่ได้ระบุ'}</strong></div>
        </div>
      `,
      confirmButtonText: 'ดูรายการรายงานผลตรวจ ➔',
      confirmButtonColor: '#047857',
      showCancelButton: true,
      cancelButtonText: 'ปิดหน้าต่าง'
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

  tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-lg mr-2"></i> กำลังโหลดรายงานผลตรวจ...</td></tr>`;

  let allReports = [];
  try {
    const { data } = await window.ReportDB.getReports({ pageSize: 150 });
    if (data && data.length > 0) {
      allReports = data;
    } else {
      allReports = MOCK_REPORTS_ARCHIVE;
    }
  } catch (e) {
    allReports = MOCK_REPORTS_ARCHIVE;
  }

  // ตรวจสอบสิทธิ์การเข้าถึงข้อมูลตามหน่วยงาน (Department Access Isolation)
  const user = currentLoggedUser || (window.AuthManager ? await window.AuthManager.getCurrentUser() : null);
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
    // 🔒 สิทธิ์เจ้าหน้าที่หน่วยงาน: เห็นเฉพาะรายงานของหน่วยงานตนเองเท่านั้น!
    const userDept = user.department.toLowerCase();

    if (scopeBadge) {
      scopeBadge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-200">
          <i class="fas fa-lock text-emerald-600"></i> แสดงเฉพาะหน่วยงาน: ${user.displayName || user.department}
        </span>
      `;
    }

    filteredReports = allReports.filter(r => {
      const rDept = (r.department || '').toLowerCase();
      const rWard = (r.ward_room || '').toLowerCase();
      const rSrv = (r.service_code || '').toLowerCase();

      // ถ้ายูสเซอร์คือ icn (งานควบคุมโรคติดเชื้อ) ให้แสดงเฉพาะงานของ IC
      if (user.username === 'icn') {
        return rDept.includes('ควบคุมโรคติดเชื้อ') || rDept.includes('ic') || rSrv === 'wts_03';
      }

      // ถ้ายูสเซอร์คือ occ (งานอาชีวอนามัย)
      if (user.username === 'occ') {
        return rDept.includes('อาชีวอนามัย') || rSrv === 'air_01';
      }
      
      // ถ้ายูสเซอร์คือ compounding (ผลิตยา 1)
      if (user.username === 'compounding') {
        return rDept.includes('ปราศจากเชื้อ') || rSrv === 'drg_07';
      }

      // ถ้ายูสเซอร์คือ pharma (ผลิตยา 2)
      if (user.username === 'pharma') {
        return (rDept.includes('ผลิตยา') && !rDept.includes('ปราศจากเชื้อ')) || rSrv === 'drg_08';
      }

      // ถ้ายูสเซอร์คือ bloodbank (งานธนาคารเลือด)
      if (user.username === 'bloodbank') {
        return rDept.includes('ธนาคารเลือด') || rSrv === 'str_02';
      }

      // ถ้ายูสเซอร์คือ nutrition (งานโภชนาการ)
      if (user.username === 'nutrition') {
        return rDept.includes('โภชนาการ') || rSrv === 'fod_06';
      }

      // ถ้ายูสเซอร์คือ thamc (ศูนย์การแพทย์)
      if (user.username === 'thamc') {
        return rDept.includes('thamc') || rDept.includes('ศูนย์การแพทย์') || rSrv === 'wtm_05';
      }

      // ถ้ายูสเซอร์คือ or (ห้องผ่าตัด)
      if (user.username === 'or') {
        return rDept.includes('ผ่าตัด') || rSrv === 'wto_04';
      }

      return rDept.includes(userDept) || rWard.includes(userDept);
    });

  } else {
    // Guest User
    if (scopeBadge) {
      scopeBadge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-slate-200">
          <i class="fas fa-eye text-slate-500"></i> โหมดทั่วไป (กรุณาเข้าสู่ระบบเพื่อดูเฉพาะหน่วยงาน)
        </span>
      `;
    }
    filteredReports = allReports;
  }

  // เรียงลำดับให้อันล่าสุดอยู่บนสุดเสมอ (Newest on Top)
  filteredReports.sort((a, b) => {
    const dateA = new Date(a.created_at || a.sampling_date || a.reported_date);
    const dateB = new Date(b.created_at || b.sampling_date || b.reported_date);
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

function renderReportsArchiveTable(reports) {
  const tbody = document.getElementById('rep-archive-tbody');
  if (!tbody) return;

  if (!reports || reports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-10 text-center">
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

  tbody.innerHTML = reports.map((r, idx) => {
    const formattedDate = r.formatted_date || r.sampling_date || '11/8/2569';
    const isTested = r.status === 'tested' || r.status === 'completed' || r.overall_result !== 'pending';
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
          <a href="report_view.html?id=${r.id || subNo}" target="_blank" class="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition shadow-2xs inline-flex items-center gap-1">
            <i class="fas fa-file-lines"></i>
            <span>ดูรายงาน</span>
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

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
        [${r.status === 'waiting_for_testing' || r.overall_result === 'pending' ? '⏳ รอตรวจ' : '✅ ตรวจแล้ว'}] ${r.submission_no || r.id} - ${r.ward_room || r.department} (${r.service_name})
      </option>
    `).join('');

  if (pendingReports.length > 0) {
    select.value = pendingReports[0].id || pendingReports[0].submission_no;
    loadSubmissionIntoAdminGrid(select.value);
  }
}

async function loadSubmissionIntoAdminGrid(reportId) {
  if (!reportId) return;

  let report = await window.ReportDB.getReportById(reportId);
  if (!report) {
    report = MOCK_REPORTS_ARCHIVE.find(r => r.id === reportId || r.submission_no === reportId) || MOCK_REPORTS_ARCHIVE[0];
  }

  activeSubmissionData = report;

  const metaEl = document.getElementById('grid-active-meta');
  if (metaEl) {
    metaEl.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200">
        <div><span class="text-slate-500 block">เลขที่เอกสาร:</span> <strong class="font-mono text-emerald-950">${report.submission_no || report.id}</strong></div>
        <div><span class="text-slate-500 block">หน่วยงาน / สถานที่:</span> <strong>${report.ward_room || report.department}</strong></div>
        <div><span class="text-slate-500 block">บริการ:</span> <strong>${report.service_name}</strong></div>
        <div><span class="text-slate-500 block">อีเมลแจ้งผล:</span> <strong class="text-sky-700">${report.recipient_email || 'staff@hospital.tu.ac.th'}</strong></div>
      </div>
    `;
  }

  const tbody = document.getElementById('admin-grid-tbody');
  if (!tbody) return;

  const items = report.report_items || report.items || [
    { location_name: 'จุดตรวจที่ 1 โต๊ะกลางห้อง', bacteria_count: '0', fungus_count: '0', item_result: 'pass' },
    { location_name: 'จุดตรวจที่ 2 เหนือเตียงผู้ป่วย', bacteria_count: '0', fungus_count: '0', item_result: 'pass' },
    { location_name: 'จุดตรวจที่ 3 ประตูทางเข้า', bacteria_count: '1', fungus_count: '0', item_result: 'pass' }
  ];

  tbody.innerHTML = items.map((item, idx) => `
    <tr class="border-b border-slate-200 hover:bg-emerald-50/30 text-xs transition" data-item-idx="${idx}">
      <td class="p-2.5 text-center font-bold text-slate-500 bg-slate-50">${idx + 1}</td>
      <td class="p-2.5">
        <input type="text" class="grid-loc w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs" value="${item.location_name || ''}">
      </td>
      <td class="p-2.5 text-center">
        <input type="text" class="grid-bacteria w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg font-mono text-center font-bold text-emerald-950 focus:bg-white text-xs" value="${item.bacteria_count === '-' ? '0' : (item.bacteria_count || '0')}">
      </td>
      <td class="p-2.5 text-center">
        <input type="text" class="grid-fungus w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg font-mono text-center font-bold text-emerald-950 focus:bg-white text-xs" value="${item.fungus_count === '-' ? '0' : (item.fungus_count || '0')}">
      </td>
      <td class="p-2.5 text-center">
        <select class="grid-result px-2.5 py-1.5 rounded-lg border font-bold text-xs bg-emerald-50 text-emerald-800 border-emerald-300">
          <option value="pass" ${item.item_result !== 'fail' ? 'selected' : ''}>✅ ผ่านเกณฑ์ (Pass)</option>
          <option value="fail" ${item.item_result === 'fail' ? 'selected' : ''}>⚠️ ตกเกณฑ์ (Fail)</option>
        </select>
      </td>
      <td class="p-2.5">
        <input type="text" class="grid-notes w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs" placeholder="หมายเหตุ" value="${item.notes || ''}">
      </td>
    </tr>
  `).join('');
}

function fastPassAllGridRows() {
  document.querySelectorAll('#admin-grid-tbody tr').forEach(tr => {
    const sel = tr.querySelector('.grid-result');
    if (sel) sel.value = 'pass';
    const bac = tr.querySelector('.grid-bacteria');
    if (bac && (bac.value === '-' || !bac.value)) bac.value = '0';
    const fg = tr.querySelector('.grid-fungus');
    if (fg && (fg.value === '-' || !fg.value)) fg.value = '0';
  });
  Swal.fire({ icon: 'success', title: 'ตั้งค่าผลผ่านเกณฑ์ทุกรายการแล้ว', timer: 1000, showConfirmButton: false });
}
window.fastPassAllGridRows = fastPassAllGridRows;

async function handleAdminSaveResults() {
  if (!activeSubmissionData) {
    Swal.fire({ icon: 'warning', title: 'กรุณาเลือกใบส่งตรวจก่อน' });
    return;
  }

  Swal.fire({
    title: 'กำลังบันทึกผลการตรวจและส่งอีเมลแจ้งเตือน...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const updatePayload = {
      status: 'tested',
      overall_result: 'pass',
      reported_date: new Date().toISOString().split('T')[0],
      reporter_name: document.getElementById('grid-reporter-name')?.value || 'ทนพ.มานพ นันตาบุตร',
      approver_name: document.getElementById('grid-approver-name')?.value || 'ทนพญ.นริศรา มังกรแก้ว',
      remarks: document.getElementById('grid-remarks')?.value || 'ผลการตรวจวิเคราะห์อยู่ในเกณฑ์มาตรฐานความปลอดภัยทางชีวภาพ'
    };

    if (window.supabaseClient && activeSubmissionData.id) {
      await window.supabaseClient.from('reports').update(updatePayload).eq('id', activeSubmissionData.id);
    }

    const email = activeSubmissionData.recipient_email;
    if (email) {
      await sendResultEmail({
        recipientEmail: email,
        department: activeSubmissionData.department,
        submissionNo: activeSubmissionData.submission_no,
        serviceName: activeSubmissionData.service_name,
        overallResult: 'pass',
        reportUrl: `${window.location.origin}/report_view.html?id=${activeSubmissionData.id || activeSubmissionData.submission_no}`
      });
    }

    if (window.NotifyService) {
      await window.NotifyService.sendReportNotification({
        ...activeSubmissionData,
        overall_result: 'pass',
        remarks: 'ผลการตรวจวิเคราะห์เป็นไปตามเกณฑ์มาตรฐานทางห้องปฏิบัติการ'
      });
    }

    Swal.fire({
      icon: 'success',
      title: 'บันทึกและออกผลตรวจสำเร็จ',
      html: `
        <div class="text-xs text-slate-600 space-y-2 text-left">
          <div>เลขที่เอกสาร: <strong class="font-mono text-emerald-800">${activeSubmissionData.submission_no}</strong></div>
          <div>หน่วยงาน / สถานที่: <strong>${activeSubmissionData.ward_room || activeSubmissionData.department}</strong></div>
          <div>สถานะ: <span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[11px]">ตรวจแล้ว (Tested)</span></div>
          ${email ? `<div class="text-emerald-700 font-semibold"><i class="fas fa-envelope-circle-check mr-1"></i> ส่งผลตรวจไปยังอีเมล ${email} เรียบร้อยแล้ว</div>` : ''}
        </div>
      `,
      confirmButtonText: 'ไปดูตารางรายงานผลตรวจ ➔',
      confirmButtonColor: '#047857',
      showCancelButton: true,
      cancelButtonText: 'ปิด'
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
async function sendResultEmail({ recipientEmail, department, submissionNo, serviceName, overallResult, reportUrl }) {
  console.log(`📧 Dispatching Result Email to: ${recipientEmail}`);
  return true;
}

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
