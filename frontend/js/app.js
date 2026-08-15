/**
 * ==============================================================================
 * PUBLIC PORTAL APP (index.html logic)
 * ค้นหารายงานผลตรวจ, แสดงบริการทั้ง 8 รายการ, และสถิติภาพรวม
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  initServicesGrid();
  initSearchHandler();
  loadStats();
});

/**
 * สร้างการ์ดแสดง 8 บริการตรวจสิ่งแวดล้อม
 */
function initServicesGrid() {
  const container = document.getElementById('services-grid-container');
  if (!container) return;

  const services = window.MasterDB.getServices();
  container.innerHTML = services.map(srv => `
    <div class="group bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
      <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/5 to-teal-500/10 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
      
      <div>
        <div class="flex items-center justify-between mb-4">
          <span class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-xl shadow-xs group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
            <i class="fas ${srv.icon}"></i>
          </span>
          <span class="text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full border ${srv.badgeColor}">
            ${srv.code}
          </span>
        </div>

        <h3 class="font-bold text-slate-800 text-base group-hover:text-emerald-700 transition-colors leading-snug mb-1">
          ${srv.name}
        </h3>
        
        <p class="text-xs text-slate-500 mb-4 line-clamp-2">
          ${srv.category}
        </p>

        <div class="bg-slate-50 rounded-xl p-3 mb-5 border border-slate-100 text-xs space-y-1.5">
          <div class="flex justify-between items-center text-slate-600">
            <span class="font-semibold text-slate-700"><i class="fas fa-clock text-teal-600 mr-1"></i> ระยะเวลา (TAT):</span>
            <span class="font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded text-[11px]">3-5 วันทำการ</span>
          </div>
          <div class="flex justify-between items-center text-slate-600">
            <span class="font-semibold text-slate-700"><i class="fas fa-ruler-combined text-emerald-600 mr-1"></i> หน่วยวัด:</span>
            <span class="font-mono text-emerald-800 bg-emerald-50/80 px-1.5 py-0.5 rounded text-[11px]">${srv.unit}</span>
          </div>
          <div class="text-[11px] text-slate-500 truncate" title="${srv.standard}">
            <i class="fas fa-shield-halved text-amber-500 mr-1"></i> เกณฑ์: ${srv.standard}
          </div>
        </div>
      </div>

      <div class="pt-2 border-t border-slate-100 flex items-center gap-2">
        <a href="workflow.html?service=${srv.code}&tab=calendar" class="flex-1 text-center bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-sm transition flex items-center justify-center gap-1">
          <i class="fas fa-calendar-plus"></i>
          <span>จองวันส่งตรวจ</span>
        </a>
        <button onclick="filterReportByService('${srv.code}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-2.5 rounded-lg transition" title="ดูรายงานผลล่าสุดของบริการนี้">
          <i class="fas fa-search"></i>
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * จัดการระบบค้นหาผลการตรวจ (Public Report Search)
 */
function initSearchHandler() {
  const searchInput = document.getElementById('public-search-input');
  const searchBtn = document.getElementById('public-search-btn');
  const resultsContainer = document.getElementById('search-results-container');
  const resultsSection = document.getElementById('search-results-section');

  if (!searchInput || !searchBtn) return;

  const performSearch = async () => {
    const term = searchInput.value.trim();
    if (!term) {
      Swal.fire({
        icon: 'info',
        title: 'กรุณากรอกคำค้นหา',
        text: 'ระบุเลขที่ใบส่งตรวจ (เช่น AIR-202608-001) หรือชื่อหน่วยงาน/หอผู้ป่วย',
        confirmButtonColor: '#059669'
      });
      return;
    }

    searchBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> กำลังค้นหา...`;
    searchBtn.disabled = true;

    try {
      const results = await window.ReportDB.searchPublicReports(term);
      renderSearchResults(results, term);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      searchBtn.innerHTML = `<i class="fas fa-search mr-1"></i> ค้นหาผลตรวจ`;
      searchBtn.disabled = false;
    }
  };

  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
  });
}

/**
 * เรนเดอร์ผลการค้นหารายงานตรวจ
 */
function renderSearchResults(results, term) {
  const resultsSection = document.getElementById('search-results-section');
  const resultsContainer = document.getElementById('search-results-container');
  const termDisplay = document.getElementById('search-term-display');
  
  if (!resultsContainer || !resultsSection) return;

  resultsSection.classList.remove('hidden');
  if (termDisplay) termDisplay.textContent = term;

  if (results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center max-w-xl mx-auto">
        <i class="fas fa-file-circle-question text-4xl text-amber-500 mb-3"></i>
        <h4 class="font-bold text-amber-900 text-lg mb-1">ไม่พบผลตรวจที่ตรงกับ "${term}"</h4>
        <p class="text-xs text-amber-700 mb-4">
          อาจอยู่ระหว่างการเพาะเชื้อและตรวจวิเคราะห์ หรือโปรดตรวจสอบเลขที่ใบส่งตรวจอีกครั้ง
        </p>
        <a href="workflow.html?tab=calendar" class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition">
          <i class="fas fa-calendar-check"></i> ตรวจสอบสถานะในปฏิทินส่งตรวจ
        </a>
      </div>
    `;
    resultsSection.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  resultsContainer.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${results.map(rep => {
        const isPass = ['pass', 'normal', 'no_growth'].includes(rep.overall_result?.toLowerCase());
        return `
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-emerald-500 transition-all flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md border border-slate-200">
                  ${rep.submission_no}
                </span>
                <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                  <i class="fas ${isPass ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i>
                  ${isPass ? 'ผ่านเกณฑ์มาตรฐาน' : 'ไม่ผ่านเกณฑ์ / พบเชื้อ'}
                </span>
              </div>

              <h4 class="font-bold text-slate-900 text-sm mb-1">${rep.service_name}</h4>
              <p class="text-xs text-slate-600 mb-3"><i class="fas fa-hospital-user text-slate-400 mr-1"></i> ${rep.department} ${rep.ward_room ? `(${rep.ward_room})` : ''}</p>

              <div class="text-xs text-slate-500 space-y-1 bg-slate-50 p-2.5 rounded-lg mb-4">
                <div class="flex justify-between">
                  <span>วันที่เก็บ:</span>
                  <span class="font-medium text-slate-700">${rep.sampling_date}</span>
                </div>
                <div class="flex justify-between">
                  <span>วันที่รายงาน:</span>
                  <span class="font-medium text-slate-700">${rep.reported_date}</span>
                </div>
                <div class="flex justify-between">
                  <span>ผู้รายงานผล:</span>
                  <span class="font-medium text-slate-700">${rep.reporter_name}</span>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center gap-2">
              <button onclick="previewReportModal('${rep.id || rep.submission_no}')" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded-lg text-center transition">
                <i class="fas fa-file-pdf mr-1"></i> ดูใบรายงานผล (PDF)
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * ดูตัวอย่างใบรายงานผลตรวจแบบ Modal
 */
async function previewReportModal(reportId) {
  Swal.fire({
    title: 'กำลังโหลดข้อมูลรายงาน...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const { data: rep, error } = await window.ReportDB.getReportById(reportId);
  Swal.close();

  if (error || !rep) {
    Swal.fire({ icon: 'error', title: 'ไม่พบรายงาน', text: 'ไม่สามารถดึงข้อมูลรายงานตรวจนี้ได้' });
    return;
  }

  const isPass = ['pass', 'normal', 'no_growth'].includes(rep.overall_result?.toLowerCase());
  const itemsHtml = (rep.report_items || rep.items || []).map((it, idx) => `
    <tr class="border-b border-slate-100 text-xs">
      <td class="p-2 text-center text-slate-500">${idx + 1}</td>
      <td class="p-2 font-medium text-slate-800">${it.location_name || it.sample_description || '-'}</td>
      <td class="p-2 text-center text-slate-700 font-mono">${it.bacteria_count ?? '-'}</td>
      <td class="p-2 text-center text-slate-700 font-mono">${it.fungus_count ?? '-'}</td>
      <td class="p-2 text-center">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${['pass','normal','no_growth'].includes(it.item_result?.toLowerCase()) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
          ${it.item_result || 'Pass'}
        </span>
      </td>
      <td class="p-2 text-slate-500 text-[11px]">${it.remarks || '-'}</td>
    </tr>
  `).join('');

  Swal.fire({
    title: `<div class="text-left"><span class="text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">${rep.submission_no}</span><div class="text-base font-bold text-slate-800 mt-1">${rep.service_name}</div></div>`,
    html: `
      <div class="text-left text-xs space-y-3 font-sans">
        <div class="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div><span class="text-slate-500">หน่วยงาน:</span> <strong>${rep.department}</strong></div>
          <div><span class="text-slate-500">สถานที่:</span> <strong>${rep.ward_room || '-'}</strong></div>
          <div><span class="text-slate-500">วันที่เก็บ:</span> <strong>${rep.sampling_date}</strong></div>
          <div><span class="text-slate-500">วันที่รายงาน:</span> <strong>${rep.reported_date}</strong></div>
          <div><span class="text-slate-500">ผู้รายงาน:</span> <strong>${rep.reporter_name}</strong></div>
          <div><span class="text-slate-500">ผลสรุป:</span> <strong class="${isPass ? 'text-emerald-700' : 'text-rose-700'}">${isPass ? 'ผ่านเกณฑ์มาตรฐาน' : 'ไม่ผ่านเกณฑ์'}</strong></div>
        </div>

        <div class="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
          <table class="w-full text-left">
            <thead class="bg-slate-100 text-slate-600 font-semibold">
              <tr>
                <th class="p-2 text-center">#</th>
                <th class="p-2">จุดตรวจ / รายการ</th>
                <th class="p-2 text-center">แบคทีเรีย</th>
                <th class="p-2 text-center">เชื้อรา</th>
                <th class="p-2 text-center">ผลตรวจ</th>
                <th class="p-2">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || '<tr><td colspan="6" class="p-4 text-center text-slate-400">ไม่มีรายการย่อย</td></tr>'}
            </tbody>
          </table>
        </div>

        ${rep.remarks ? `<div class="p-2.5 bg-amber-50 rounded-lg text-amber-800 text-[11px] border border-amber-200"><i class="fas fa-info-circle mr-1"></i> <strong>ข้อคิดเห็นทางเทคนิค:</strong> ${rep.remarks}</div>` : ''}
      </div>
    `,
    width: '700px',
    showCancelButton: true,
    confirmButtonText: rep.report_pdf_url ? '<i class="fas fa-download mr-1"></i> ดาวน์โหลดไฟล์ PDF แนบ' : '<i class="fas fa-print mr-1"></i> พิมพ์ใบรายงานผล',
    cancelButtonText: 'ปิดหน้าต่าง',
    confirmButtonColor: '#059669',
    cancelButtonColor: '#64748b'
  }).then((res) => {
    if (res.isConfirmed) {
      if (rep.report_pdf_url) {
        window.open(rep.report_pdf_url, '_blank');
      } else {
        window.open(`report_view.html?id=${encodeURIComponent(rep.id || rep.submission_no)}`, '_blank');
      }
    }
  });
}

/**
 * กรองผลตามบริการ
 */
async function filterReportByService(serviceCode) {
  const resultsSection = document.getElementById('search-results-section');
  const resultsContainer = document.getElementById('search-results-container');
  const termDisplay = document.getElementById('search-term-display');
  
  if (!resultsContainer || !resultsSection) return;

  resultsSection.classList.remove('hidden');
  const srv = window.SERVICES_CONFIG[serviceCode];
  if (termDisplay) termDisplay.textContent = `บริการ ${srv?.name || serviceCode}`;

  resultsContainer.innerHTML = `<div class="p-8 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p>กำลังโหลดรายงาน...</p></div>`;
  resultsSection.scrollIntoView({ behavior: 'smooth' });

  const { data: reports } = await window.ReportDB.getReports({ serviceCode });
  renderSearchResults(reports || [], srv?.name || serviceCode);
}

/**
 * โหลดตัวนับสถิติ KPI
 */
async function loadStats() {
  try {
    const stats = await window.ReportDB.getStats();
    const elTotal = document.getElementById('kpi-total-num');
    const elReported = document.getElementById('kpi-reported-num');
    const elProgress = document.getElementById('kpi-progress-num');
    const elBookings = document.getElementById('kpi-bookings-num');

    if (elTotal) elTotal.textContent = Number(stats.totalSpecimens).toLocaleString();
    if (elReported) elReported.textContent = Number(stats.completedSpecimens).toLocaleString();
    if (elProgress) elProgress.textContent = Number(stats.inProgressSpecimens).toLocaleString();
    if (elBookings) elBookings.textContent = Number(stats.totalBookings).toLocaleString();
  } catch (e) {
    console.warn('Error updating KPI stats:', e);
  }
}

/**
 * จัดการเปิด/ปิด เมนูนำทางบนมือถือ (Mobile Navigation Drawer)
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

window.filterReportByService = filterReportByService;
window.previewReportModal = previewReportModal;
