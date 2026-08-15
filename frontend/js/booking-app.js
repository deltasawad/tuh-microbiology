/**
 * ==============================================================================
 * BOOKING CALENDAR APP (booking.html logic)
 * ระบบปฏิทินจองวันส่งตรวจสิ่งแวดล้อม งานจุลชีววิทยา รพ.ธรรมศาสตร์ฯ
 * ==============================================================================
 */

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
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
          text: 'กรุณาคลิกเลือกวันที่ต้องการส่งตรวจบนปฏิทิน',
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

  gridEl.innerHTML = `<div class="col-span-7 p-12 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-3xl mb-2"></i><p>กำลังโหลดข้อมูลการจอง...</p></div>`;

  // ดึงข้อมูลการจองในเดือนนี้
  cachedBookings = await window.BookingDB.getBookingsByMonth(year, month);

  // คำนวณวันแรกและจำนวนวัน
  const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const todayStr = new Date().toISOString().split('T')[0];

  let html = '';

  // เติมวันจากเดือนก่อนหน้า
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    html += `
      <div class="min-h-[100px] p-2 bg-slate-50/50 border border-slate-100 rounded-xl opacity-40 cursor-not-allowed">
        <span class="text-xs text-slate-400 font-medium">${day}</span>
      </div>
    `;
  }

  // เติมวันในเดือนปัจจุบัน
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;
    const isToday = dateStr === todayStr;

    // ตรวจสอบวันหยุด
    const holiday = cachedHolidays.find(h => h.holiday_date === dateStr);
    const isHoliday = !!holiday;

    // รายการจองของวันนี้
    const dayBookings = cachedBookings.filter(b => b.booking_date === dateStr && b.status !== 'cancelled');
    const totalSamples = dayBookings.reduce((sum, b) => sum + (parseInt(b.sample_count, 10) || 1), 0);

    let cellClass = 'bg-white hover:border-emerald-500 hover:shadow-md';
    if (isToday) cellClass = 'bg-emerald-50/30 border-2 border-emerald-500 shadow-xs';
    if (isHoliday) cellClass = 'bg-rose-50/40 border-rose-200';
    else if (isSunday) cellClass = 'bg-slate-50/80';

    html += `
      <div onclick="handleDayClick('${dateStr}', ${isHoliday}, '${holiday?.holiday_name || ''}')" 
           class="min-h-[110px] p-2.5 border border-slate-200 rounded-xl transition-all duration-200 cursor-pointer flex flex-col justify-between ${cellClass} relative group">
        
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-bold ${isSunday ? 'text-rose-600' : isSaturday ? 'text-purple-600' : isToday ? 'text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full' : 'text-slate-800'}">
              ${d}
            </span>
            ${dayBookings.length > 0 ? `
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ${dayBookings.length > 3 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
                ${dayBookings.length} คิว (${totalSamples} ชิ้น)
              </span>
            ` : ''}
          </div>

          ${isHoliday ? `
            <div class="text-[10px] text-rose-700 bg-rose-100/90 font-medium px-1.5 py-0.5 rounded mb-1 truncate" title="${holiday.holiday_name}">
              <i class="fas fa-flag text-rose-500 mr-0.5"></i> ${holiday.holiday_name}
            </div>
          ` : ''}

          <!-- รายการจองย่อในแต่ละวัน -->
          <div class="space-y-1 overflow-hidden">
            ${dayBookings.slice(0, 2).map(b => `
              <div class="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium truncate border-l-2 border-emerald-500" title="${b.department}: ${b.service_name}">
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

        <div class="pt-1 opacity-0 group-hover:opacity-100 transition-opacity text-right">
          <span class="text-[10px] text-emerald-600 font-bold"><i class="fas fa-plus-circle"></i> จองคิว</span>
        </div>
      </div>
    `;
  }

  gridEl.innerHTML = html;
}

/**
 * จัดการเมื่อผู้ใช้คลิกเลือกวันที่บนปฏิทิน
 */
function handleDayClick(dateStr, isHoliday, holidayName) {
  const [year, month, day] = dateStr.split('-');
  const thaiDateStr = `${parseInt(day, 10)} ${THAI_MONTHS[parseInt(month, 10) - 1]} ${parseInt(year, 10) + 543}`;

  const dayBookings = cachedBookings.filter(b => b.booking_date === dateStr && b.status !== 'cancelled');

  let bookingsListHtml = '';
  if (dayBookings.length === 0) {
    bookingsListHtml = `<div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs text-center"><i class="fas fa-check-circle mr-1"></i> ยังไม่มีคิวจองในวันนี้ สามารถส่งตรวจได้ตามปกติ</div>`;
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

  Swal.fire({
    title: `<div class="text-left"><div class="text-xs text-emerald-600 font-semibold">ปฏิทินส่งตรวจงานจุลชีววิทยา</div><div class="text-base font-bold text-slate-900 mt-0.5">วันที่ ${thaiDateStr}</div></div>`,
    html: `
      <div class="text-left font-sans space-y-3">
        ${isHoliday ? `<div class="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs"><i class="fas fa-exclamation-triangle text-rose-500 mr-1"></i> <strong>วันหยุดนักขัตฤกษ์:</strong> ${holidayName} (กรุณาประสานงานเจ้าหน้าที่ล่วงหน้าหากมีกรณีเร่งด่วน)</div>` : ''}
        
        <div>
          <div class="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
            <span>รายการคิวจองในวันนี้ (${dayBookings.length} รายการ):</span>
          </div>
          ${bookingsListHtml}
        </div>
      </div>
    `,
    width: '580px',
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-calendar-plus mr-1"></i> จองคิวส่งตรวจในวันนี้',
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
function showBookingFormModal(dateStr, thaiDateStr) {
  const services = window.MasterDB.getServices();
  const wards = window.MasterDB.getWards();

  const servicesOptions = services.map(s => `<option value="${s.code}">${s.name}</option>`).join('');
  const wardsOptions = wards.map(w => `<option value="${w}">${w}</option>`).join('');

  Swal.fire({
    title: `<div class="text-left"><div class="text-xs text-emerald-600 font-semibold">แบบฟอร์มจองคิวส่งตรวจ</div><div class="text-base font-bold text-slate-900 mt-0.5">วันที่: ${thaiDateStr}</div></div>`,
    html: `
      <form id="swal-booking-form" class="text-left text-xs font-sans space-y-3 pt-2">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">ชื่อ-สกุล ผู้ส่งตรวจ <span class="text-rose-500">*</span></label>
          <input type="text" id="bk-sender-name" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" placeholder="ระบุชื่อและตำแหน่งผู้ส่ง" required>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">หน่วยงาน / Ward <span class="text-rose-500">*</span></label>
            <input list="swal-wards-list" id="bk-department" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" placeholder="เลือกหรือพิมพ์หน่วยงาน" required>
            <datalist id="swal-wards-list">
              ${wardsOptions}
            </datalist>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์ติดต่อ <span class="text-rose-500">*</span></label>
            <input type="tel" id="bk-contact" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" placeholder="เช่น 081-234-5678 หรือ เบอร์ภายใน" required>
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

      const { data, error } = await window.BookingDB.createBooking(result.value);

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
          html: `<div class="text-xs text-slate-600">บันทึกคิวส่งตรวจวันที่ <strong>${thaiDateStr}</strong> เรียบร้อยแล้ว เจ้าหน้าที่จะเตรียมอุปกรณ์และอาหารเพาะเชื้อตามที่นัดหมาย</div>`,
          confirmButtonColor: '#059669'
        });

        // รีเฟรชปฏิทินทันที
        await renderCalendar(currentYear, currentMonth);
      }
    }
  });
}

window.handleDayClick = handleDayClick;
