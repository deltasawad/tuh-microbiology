/**
 * ==============================================================================
 * BOOKING CALENDAR APP (booking.html logic)
 * ระบบปฏิทินจองวันส่งตรวจสิ่งแวดล้อม งานจุลชีววิทยา รพ.ธรรมศาสตร์ฯ
 * กฎการรับสิ่งส่งตรวจ:
 * - เปิดรับส่งตรวจเฉพาะ: วันจันทร์, วันอังคาร, วันพุธ (จองซ้ำในวันเดียวกันได้ไม่จำกัด)
 * - ล็อคห้ามส่งตรวจ: วันพฤหัสบดี, วันศุกร์, วันเสาร์, วันอาทิตย์ และวันหยุดนักขัตฤกษ์
 * ==============================================================================
 */

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_DAYS = [
  'วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'
];

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1; // 1-12
let cachedBookings = [];
let cachedHolidays = [];

document.addEventListener('DOMContentLoaded', async () => {
  // ตรวจสอบ query param (เช่น ?service=AIR_01)
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedService = urlParams.get('service');

  await initHolidays();
  await renderCalendar(currentYear, currentMonth);

  initCalendarControls();

  if (preselectedService) {
    const srv = window.SERVICES_CONFIG[preselectedService];
    if (srv) {
      setTimeout(() => {
        Swal.fire({
          icon: 'info',
          title: `จองคิว: ${srv.name}`,
          html: `<div class="text-xs text-slate-600">กรุณาคลิกเลือก **วันจันทร์ - วันพุธ** บนปฏิทิน เพื่อจองวันส่งตรวจ (สามารถจองซ้ำในวันเดียวกันได้ไม่จำกัดจำนวน)</div>`,
          confirmButtonColor: '#059669'
        });
      }, 500);
    }
  }
});

async function initHolidays() {
  try {
    cachedHolidays = await window.MasterDB.getHolidays();
  } catch (e) {
    cachedHolidays = [];
  }
}

function initCalendarControls() {
  const prevBtn = document.getElementById('prev-month-btn');
  const nextBtn = document.getElementById('next-month-btn');
  const todayBtn = document.getElementById('today-btn');
  const refreshBtn = document.getElementById('refresh-calendar-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
      }
      renderCalendar(currentYear, currentMonth);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
      renderCalendar(currentYear, currentMonth);
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const now = new Date();
      currentYear = now.getFullYear();
      currentMonth = now.getMonth() + 1;
      renderCalendar(currentYear, currentMonth);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      renderCalendar(currentYear, currentMonth);
    });
  }
}

/**
 * เรนเดอร์ปฏิทินประจำเดือน พร้อมระบบล็อควันตามกฎห้องปฏิบัติการ
 */
async function renderCalendar(year, month) {
  const titleEl = document.getElementById('calendar-month-title');
  const gridEl = document.getElementById('calendar-days-grid');
  if (!gridEl) return;

  const thaiYear = year + 543;
  if (titleEl) {
    titleEl.textContent = `${THAI_MONTHS[month - 1]} ${thaiYear}`;
  }

  gridEl.innerHTML = `<div class="col-span-7 p-12 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-3xl mb-2"></i><p>กำลังโหลดข้อมูลการจอง...</p></div>`;

  // ดึงข้อมูลการจองในเดือนนี้
  cachedBookings = await window.BookingDB.getBookingsByMonth(year, month);

  // คำนวณวันแรกและจำนวนวัน
  const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const todayStr = new Date().toISOString().split('T')[0];

  let html = '';

  // เติมวันจากเดือนก่อนหน้า (Disabled)
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    html += `
      <div class="min-h-[110px] p-2 bg-slate-100/40 border border-slate-100 rounded-xl opacity-30 cursor-not-allowed">
        <span class="text-xs text-slate-400 font-medium">${day}</span>
      </div>
    `;
  }

  // เติมวันในเดือนปัจจุบัน
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay(); // 0:Sun, 1:Mon, 2:Tue, 3:Wed, 4:Thu, 5:Fri, 6:Sat
    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;

    // ตรวจสอบวันหยุดนักขัตฤกษ์
    const holiday = cachedHolidays.find(h => h.holiday_date === dateStr);
    const isHoliday = !!holiday;

    // 🎯 เปิดรับส่งตรวจวันจันทร์ - ศุกร์ ที่ไม่ใช่วันหยุดนักขัตฤกษ์และไม่ใช่วันในอดีต
    // เปิดรับส่งตรวจเฉพาะ วันจันทร์ - พุธ (งดรับ พฤหัส-ศุกร์ และเสาร์-อาทิตย์ รวมถึงวันหยุดนักขัตฤกษ์)
    const isOpenDay = (dayOfWeek >= 1 && dayOfWeek <= 3) && !isHoliday && !isPast;
    
    // รายการจองของวันนี้
    const dayBookings = cachedBookings.filter(b => b.booking_date === dateStr && b.status !== 'cancelled');
    const totalSamples = dayBookings.reduce((sum, b) => sum + (parseInt(b.sample_count, 10) || 1), 0);

    // กำหนดรูปแบบและการจัดสไตล์ของกล่องแต่ละวัน
    let cellClass = '';
    let statusBadge = '';
    let cursorClass = isPast ? 'cursor-not-allowed opacity-60' : 'cursor-pointer';

    if (isPast) {
      // วันที่ผ่านไปแล้ว (ล็อคอัตโนมัติ)
      cellClass = 'bg-slate-100/80 border-slate-200';
      statusBadge = `
        <div class="text-[9px] text-slate-500 bg-slate-200 font-medium px-1.5 py-0.5 rounded mb-1 truncate">
          <i class="fas fa-lock text-slate-400 mr-0.5"></i> ผ่านแล้ว (ล็อค)
        </div>
      `;
    } else if (isHoliday) {
      // วันหยุดนักขัตฤกษ์ (ล็อค)
      cellClass = 'bg-rose-50/60 border-rose-200 hover:border-rose-400';
      statusBadge = `
        <div class="text-[10px] text-rose-700 bg-rose-100 font-semibold px-1.5 py-0.5 rounded mb-1 truncate border border-rose-200" title="${holiday.holiday_name}">
          <i class="fas fa-ban text-rose-500 mr-0.5"></i> วันหยุด: ${holiday.holiday_name}
        </div>
      `;
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
      // วันเสาร์ / อาทิตย์ (ล็อค)
      cellClass = 'bg-slate-100/90 border-slate-200/80 hover:border-slate-300';
      statusBadge = `
        <div class="text-[9px] text-slate-400 bg-slate-200/60 font-medium px-1.5 py-0.5 rounded mb-1 truncate">
          <i class="fas fa-lock text-slate-400 mr-0.5"></i> ปิดทำการ
        </div>
      `;
    } else if (dayOfWeek === 4 || dayOfWeek === 5) {
      // วันพฤหัสบดี / ศุกร์ (งดรับส่งตรวจ - ล็อค)
      cellClass = 'bg-slate-100/90 border-slate-200/80 hover:border-slate-300';
      statusBadge = `
        <div class="text-[9px] text-slate-500 bg-slate-200/80 font-medium px-1.5 py-0.5 rounded mb-1 truncate">
          <i class="fas fa-ban text-slate-400 mr-0.5"></i> งดรับส่งตรวจ (จ.-พ. เท่านั้น)
        </div>
      `;
    } else if (isOpenDay) {
      // วันจันทร์ - พุธ (เปิดรับส่งตรวจ - จองได้)
      cellClass = 'bg-white border-emerald-300/80 hover:border-emerald-500 hover:shadow-md ring-1 ring-emerald-500/20';
      statusBadge = `
        <div class="text-[9px] text-emerald-700 bg-emerald-50 font-bold px-1.5 py-0.5 rounded mb-1 border border-emerald-200 truncate flex items-center justify-between">
          <span><i class="fas fa-circle-check text-emerald-500 mr-0.5"></i> เปิดรับส่งตรวจ</span>
          <span class="text-[8px] bg-emerald-600 text-white px-1 rounded">จองได้</span>
        </div>
      `;
    }

    if (isToday) {
      cellClass += ' ring-2 ring-amber-400 bg-amber-50/20';
    }

    html += `
      <div onclick="handleDayClick('${dateStr}', ${isHoliday}, '${holiday?.holiday_name || ''}', ${isOpenDay}, ${dayOfWeek})" 
           class="min-h-[115px] p-2.5 border rounded-xl transition-all duration-200 ${cursorClass} flex flex-col justify-between ${cellClass} relative group">
        
        <div>
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-1">
              <span class="text-xs font-bold ${isPast ? 'text-slate-400' : (isHoliday ? 'text-rose-600' : (dayOfWeek === 0 || dayOfWeek === 6) ? 'text-slate-400' : isOpenDay ? 'text-emerald-800' : 'text-slate-600')} ${isToday ? 'bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full font-extrabold' : ''}">
                ${d}
              </span>
              <span class="text-[10px] text-slate-400">(${THAI_DAYS[dayOfWeek].replace('วัน', '')})</span>
            </div>

            ${dayBookings.length > 0 ? `
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isOpenDay ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-600'}">
                ${dayBookings.length} คิว (${totalSamples} ชิ้น)
              </span>
            ` : ''}
          </div>

          <!-- ป้ายสถานะการเปิด/ปิดรับตรวจ -->
          ${statusBadge}

          <!-- รายการจองในวันนี้ (ถ้ามี) -->
          <div class="space-y-1 overflow-hidden mt-1">
            ${dayBookings.slice(0, 2).map(b => `
              <div class="text-[10px] bg-slate-50 text-slate-700 px-1.5 py-0.5 rounded font-medium truncate border-l-2 ${isOpenDay ? 'border-emerald-500' : 'border-slate-400'}" title="${b.department}: ${b.service_name}">
                ${b.department}
              </div>
            `).join('')}
            ${dayBookings.length > 2 ? `
              <div class="text-[9px] text-slate-500 font-semibold pl-1">
                + อีก ${dayBookings.length - 2} รายการ
              </div>
            ` : ''}
          </div>
        </div>

        <div class="pt-1.5 text-right">
          ${isOpenDay ? `
            <span class="text-[10px] text-emerald-600 font-bold group-hover:text-emerald-700 transition">
              <i class="fas fa-plus-circle"></i> จองคิวส่งตรวจ
            </span>
          ` : `
            <span class="text-[9px] text-slate-400">
              <i class="fas fa-lock"></i> ล็อควัน
            </span>
          `}
        </div>

      </div>
    `;
  }

  gridEl.innerHTML = html;
}

/**
 * จัดการเมื่อผู้ใช้คลิกเลือกวันที่บนปฏิทิน
 */
function handleDayClick(dateStr, isHoliday, holidayName, isOpenDay, dayOfWeek) {
  const todayStr = new Date().toISOString().split('T')[0];
  if (dateStr < todayStr) {
    Swal.fire({
      icon: 'info',
      title: 'วันที่ผ่านไปแล้ว',
      text: 'ไม่สามารถจองคิวหรือแก้ไขวันส่งตรวจในอดีตได้ เนื่องจากวันดังกล่าวได้ผ่านไปแล้ว'
    });
    return;
  }

  const [year, month, day] = dateStr.split('-');
  const dayName = THAI_DAYS[dayOfWeek];
  const thaiDateStr = `${dayName}ที่ ${parseInt(day, 10)} ${THAI_MONTHS[parseInt(month, 10) - 1]} ${parseInt(year, 10) + 543}`;

  const dayBookings = cachedBookings.filter(b => b.booking_date === dateStr && b.status !== 'cancelled');

  // รายการจองที่มีอยู่แล้ว
  let bookingsListHtml = '';
  if (dayBookings.length === 0) {
    bookingsListHtml = `
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs text-center">
        ยังไม่มีคิวจองในวันนี้
      </div>
    `;
  } else {
    bookingsListHtml = `
      <div class="space-y-2 max-h-48 overflow-y-auto">
        ${dayBookings.map((b, idx) => `
          <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex justify-between items-center">
            <div>
              <div class="font-bold text-slate-800">${idx + 1}. ${b.department} - <span class="text-emerald-700 font-normal">${b.service_name}</span></div>
              <div class="text-[11px] text-slate-500">ผู้ส่ง: ${b.sender_name} (${b.contact_number}) • จำนวน: <strong>${b.sample_count} ชิ้น</strong></div>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">${b.status}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ============================================================================
  // กรณีที่ 1: วันที่ถูกล็อค (วันพฤหัสบดี - อาทิตย์ หรือ วันหยุดนักขัตฤกษ์)
  // ============================================================================
  if (!isOpenDay) {
    let reasonTitle = '';
    let reasonDesc = '';

    if (isHoliday) {
      reasonTitle = `🚫 วันหยุดนักขัตฤกษ์ (${holidayName})`;
      reasonDesc = `ห้องปฏิบัติการงดรับสิ่งส่งตรวจในวันหยุดนักขัตฤกษ์ กรุณาเลือกวันทำการปกติ (**วันจันทร์ - วันพุธ**) เพื่อให้การเพาะเชื้อเป็นไปตามมาตรฐาน`;
    } else if (dayOfWeek === 4 || dayOfWeek === 5) {
      reasonTitle = `🔒 ${dayName} (งดรับสิ่งส่งตรวจ)`;
      reasonDesc = `ห้องปฏิบัติการเปิดรับสิ่งส่งตรวจเฉพาะ **วันจันทร์ - วันพุธ** เท่านั้น (เนื่องจากสิ่งส่งตรวจต้องใช้เวลาเพาะเชื้อและอ่านผล 24 - 48 ชม. ให้เสร็จสิ้นก่อนวันหยุดสุดสัปดาห์)`;
    } else {
      reasonTitle = `🔒 ${dayName} (ห้องปฏิบัติการปิดทำการ)`;
      reasonDesc = `วันเสาร์ - อาทิตย์ เป็นวันหยุดทำการ กรุณาเลือกส่งตรวจใน **วันจันทร์ - วันพุธ** สัปดาห์ถัดไป`;
    }

    Swal.fire({
      title: `<div class="text-left"><div class="text-xs text-rose-600 font-semibold">ระบบงดรับส่งตรวจในวันนี้</div><div class="text-base font-bold text-slate-900 mt-0.5">${thaiDateStr}</div></div>`,
      html: `
        <div class="text-left font-sans space-y-3">
          <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
            <div class="font-bold text-rose-800 flex items-center gap-1.5">
              <i class="fas fa-lock text-rose-600"></i>
              <span>${reasonTitle}</span>
            </div>
            <p class="text-rose-700 leading-relaxed">${reasonDesc}</p>
          </div>

          <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
            <i class="fas fa-calendar-check text-emerald-600 mr-1"></i>
            <span><strong>คำแนะนำ:</strong> สามารถคลิกเลือกวันจันทร์, อังคาร หรือพุธ ที่สะดวกเพื่อจองคิวส่งตรวจได้แบบไม่จำกัดจำนวนครับ</span>
          </div>

          ${dayBookings.length > 0 ? `
            <div>
              <div class="text-xs font-bold text-slate-700 mb-1.5">รายการคิวเดิมในระบบ (${dayBookings.length} รายการ):</div>
              ${bookingsListHtml}
            </div>
          ` : ''}
        </div>
      `,
      width: '580px',
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'ปิดหน้าต่าง',
      cancelButtonColor: '#64748b'
    });
    return;
  }

  // ============================================================================
  // กรณีที่ 2: วันที่เปิดรับตรวจ (วันจันทร์ - วันพุธ) -> จองซ้ำได้ไม่จำกัดจำนวน
  // ============================================================================
  Swal.fire({
    title: `<div class="text-left"><div class="text-xs text-emerald-600 font-semibold">เปิดรับส่งตรวจ (จองได้ไม่จำกัด)</div><div class="text-base font-bold text-slate-900 mt-0.5">${thaiDateStr}</div></div>`,
    html: `
      <div class="text-left font-sans space-y-3">
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
          <div class="text-emerald-800">
            <i class="fas fa-circle-check text-emerald-600 mr-1"></i>
            <span><strong>เปิดรับส่งตรวจตามปกติ:</strong> สามารถส่งตัวอย่างได้ตลอดทั้งวัน</span>
          </div>
          <span class="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">ไม่จำกัดคิว</span>
        </div>
        
        <div>
          <div class="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
            <span>รายการคิวที่จองแล้วในวันนี้ (${dayBookings.length} รายการ):</span>
            <span class="text-[11px] text-slate-500 font-normal">จองเพิ่มได้อีก</span>
          </div>
          ${bookingsListHtml}
        </div>
      </div>
    `,
    width: '580px',
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-calendar-plus mr-1"></i> + จองคิวส่งตรวจในวันนี้',
    cancelButtonText: 'ปิดหน้าต่าง',
    confirmButtonColor: '#059669',
    cancelButtonColor: '#64748b'
  }).then((result) => {
    if (result.isConfirmed) {
      showBookingFormModal(dateStr, thaiDateStr);
    }
  });
}

/**
 * แสดง Modal ฟอร์มกรอกข้อมูลการจองคิว
 */
async function showBookingFormModal(dateStr, thaiDateStr) {
  const services = window.MasterDB.getServices();
  const wards = window.MasterDB.getWards();
  const user = window.AuthManager ? await window.AuthManager.getCurrentUser() : null;

  let defaultSender = user?.displayName || user?.name || '';
  let defaultDept = user?.department || '';
  let defaultService = user?.serviceCode || 'AIR_01';
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
      defaultDept = defaultDept || 'งานผลิตยา (ปลอดเชื้อ)';
      defaultSender = defaultSender || 'เจ้าหน้าที่ผลิตยา 1';
      defaultPhone = defaultPhone || '9907';
    } else if (user.username === 'pharma') {
      defaultService = 'DRG_08';
      defaultDept = defaultDept || 'งานผลิตยา';
      defaultSender = defaultSender || 'เจ้าหน้าที่ผลิตยา 2';
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
    }
  }

  const servicesOptions = services.map(s => `<option value="${s.code}" ${s.code === defaultService ? 'selected' : ''}>${s.name}</option>`).join('');
  const wardsOptions = wards.map(w => `<option value="${w}">${w}</option>`).join('');

  Swal.fire({
    title: `<div class="text-left"><div class="text-xs text-emerald-600 font-semibold">แบบฟอร์มจองคิวส่งตรวจสิ่งแวดล้อม</div><div class="text-base font-bold text-slate-900 mt-0.5">${thaiDateStr}</div></div>`,
    html: `
      <form id="swal-booking-form" class="text-left text-xs font-sans space-y-3 pt-2">
        
        <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-emerald-800 text-[11px]">
          <i class="fas fa-info-circle text-emerald-600 mr-1"></i>
          <span>สามารถส่งตรวจตัวอย่างได้หลายรายการในวันเดียวกัน กรุณากรอกข้อมูลผู้ประสานงานให้ถูกต้อง</span>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">ชื่อ-สกุล ผู้ส่งตรวจ <span class="text-rose-500">*</span></label>
          <input type="text" id="bk-sender-name" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" placeholder="ระบุชื่อและตำแหน่งผู้ส่ง" value="${defaultSender}" required>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">หน่วยงาน <span class="text-rose-500">*</span></label>
            <input list="swal-wards-list" id="bk-department" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" placeholder="เลือกหรือพิมพ์หน่วยงาน" value="${defaultDept}" required>
            <datalist id="swal-wards-list">
              ${wardsOptions}
            </datalist>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์ติดต่อ</label>
            <input type="tel" id="bk-contact" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" placeholder="เช่น 02-926-9460 หรือ เบอร์ภายใน" value="${defaultPhone}">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">บริการส่งตรวจสิ่งแวดล้อม <span class="text-rose-500">*</span></label>
            <select id="bk-service" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" required>
              ${servicesOptions}
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">จำนวนสิ่งส่งตรวจ (ชิ้น/ขวด/แผ่น) <span class="text-rose-500">*</span></label>
            <input type="number" id="bk-sample-count" min="1" max="200" value="1" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" required>
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">หมายเหตุเพิ่มเติม / วัตถุประสงค์การส่งตรวจ</label>
          <textarea id="bk-notes" rows="2" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" placeholder="เช่น ตรวจประจำเดือน, หลังทำความสะอาด Big Cleaning"></textarea>
        </div>
      </form>
    `,
    width: '600px',
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-check mr-1"></i> ยืนยันการจองคิว',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#059669',
    cancelButtonColor: '#64748b',
    preConfirm: () => {
      const sender_name = document.getElementById('bk-sender-name').value.trim();
      const department = document.getElementById('bk-department').value.trim();
      const contact_number = document.getElementById('bk-contact').value.trim();
      const service_code = document.getElementById('bk-service').value;
      const sample_count = parseInt(document.getElementById('bk-sample-count').value, 10);
      const notes = document.getElementById('bk-notes').value.trim();

      if (!sender_name || !department || !contact_number || !service_code || !sample_count) {
        Swal.showValidationMessage('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
        return false;
      }

      const srvObj = window.SERVICES_CONFIG[service_code] || { name: service_code };

      return {
        booking_date: dateStr,
        sender_name,
        department,
        contact_number,
        service_code,
        service_name: srvObj.name,
        sample_count,
        notes,
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

      const bookingData = result.value;
      const { data, error } = await window.BookingDB.createBooking(bookingData);

      // ส่งแจ้งเตือน LINE และ Telegram
      if (window.NotifyService) {
        window.NotifyService.sendBookingNotification(bookingData).catch(e => console.warn(e));
      }

      if (error) {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: `ไม่สามารถบันทึกการจองได้: ${error.message || 'Database error'}`
        });
      } else {
        Swal.fire({
          icon: 'success',
          title: 'จองคิวส่งตรวจสำเร็จ!',
          html: `
            <div class="text-xs text-slate-600 space-y-1.5 text-left bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2">
              <div>วันที่นัดหมาย: <strong>${thaiDateStr}</strong></div>
              <div>หน่วยงาน: <strong>${bookingData.department}</strong></div>
              <div>บริการ: <strong>${bookingData.service_name}</strong> (${bookingData.sample_count} ชิ้น)</div>
            </div>
            <p class="text-xs text-emerald-700 font-semibold mt-3">ท่านต้องการกรอกแบบฟอร์มส่งตรวจต่อทันทีเลยหรือไม่?</p>
          `,
          confirmButtonText: '<i class="fas fa-file-pen mr-1"></i> ไปกรอกแบบฟอร์มส่งตรวจ ➔',
          confirmButtonColor: '#059669',
          showCancelButton: true,
          cancelButtonText: 'ปิด',
          cancelButtonColor: '#64748b'
        }).then((res) => {
          if (res.isConfirmed) {
            window.location.href = `workflow.html?tab=submission&service=${bookingData.service_code}&date=${dateStr}&dept=${encodeURIComponent(bookingData.department)}`;
          }
          renderCalendar(currentYear, currentMonth);
        });

        // รีเฟรชปฏิทินทันที
        await renderCalendar(currentYear, currentMonth);
      }
    }
  });
}

window.handleDayClick = handleDayClick;

/**
 * สลับเมนูนำทางบนมือถือ
 */
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-nav-menu');
  const icon = document.getElementById('mobile-menu-icon');
  if (!menu) return;
  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    menu.classList.remove('hidden');
    if (icon) {
      icon.classList.remove('fa-bars');
      icon.classList.add('fa-xmark');
    }
  } else {
    menu.classList.add('hidden');
    if (icon) {
      icon.classList.remove('fa-xmark');
      icon.classList.add('fa-bars');
    }
  }
}
window.toggleMobileMenu = toggleMobileMenu;
