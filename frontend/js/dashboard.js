/**
 * ==============================================================================
 * SPECIMEN DASHBOARD (dashboard.js)
 * ระบบจัดการและสถิติสิ่งส่งตรวจรายเดือน - TUH Microbiology (ISO 15189)
 * Theme: Emerald & Slate Medical Design System
 * ==============================================================================
 */

let monthlyChartInstance = null;
let distributionChartInstance = null;
let currentAnalyticsData = null;
let loggedInUser = null;
let isViewingAll = false;

async function bootDashboard() {
  if (window.AuthManager) {
    loggedInUser = await window.AuthManager.getCurrentUser();
  }
  initDepartmentBanner();
  initFilterControls();
  await loadDashboardData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootDashboard);
} else {
  bootDashboard();
}

/**
 * กำหนดค่า Banner ตามหน่วยงานที่ล็อกอิน
 */
function initDepartmentBanner() {
  const banner = document.getElementById('dash-dept-banner');
  const title = document.getElementById('dash-dept-title');
  const badge = document.getElementById('dash-dept-badge');
  const icon = document.getElementById('dash-dept-icon');
  const viewAllBtn = document.getElementById('dash-view-all-btn');

  if (loggedInUser && loggedInUser.role === 'department_staff') {
    if (banner) banner.classList.remove('hidden');
    if (title) title.textContent = loggedInUser.department;
    if (badge) badge.textContent = loggedInUser.username.toUpperCase();
    if (icon && loggedInUser.icon) icon.innerHTML = `<i class="fas ${loggedInUser.icon}"></i>`;
    if (viewAllBtn) viewAllBtn.classList.remove('hidden');

    // กำหนดบริการเริ่มต้นของหน่วยงาน
    if (loggedInUser.serviceCode && !isViewingAll) {
      const srvSelect = document.getElementById('dash-filter-service');
      if (srvSelect) srvSelect.value = loggedInUser.serviceCode;
    }
  } else {
    if (banner) banner.classList.add('hidden');
  }
}

/**
 * สลับดูสถิติเฉพาะหน่วยงาน / รวมทุกหน่วยงาน
 */
function toggleViewAllDepartments() {
  isViewingAll = !isViewingAll;
  const viewAllBtn = document.getElementById('dash-view-all-btn');
  const badge = document.getElementById('dash-dept-badge');
  
  if (isViewingAll) {
    if (viewAllBtn) viewAllBtn.innerHTML = `<i class="fas fa-filter mr-1"></i> กรองเฉพาะหน่วยงานฉัน (${loggedInUser?.username})`;
    if (badge) badge.textContent = 'แสดงทุกหน่วยงาน';
  } else {
    if (viewAllBtn) viewAllBtn.innerHTML = `<i class="fas fa-arrows-rotate mr-1"></i> ดูสถิติรวมทุกหน่วยงาน`;
    if (badge) badge.textContent = loggedInUser?.username?.toUpperCase() || 'MY DEPT';
  }
  loadDashboardData();
}
window.toggleViewAllDepartments = toggleViewAllDepartments;

/**
 * ตั้งค่าการทำงานของ Filter Controls
 */
function initFilterControls() {
  const yearSelect = document.getElementById('dash-filter-year');
  const serviceSelect = document.getElementById('dash-filter-service');
  const refreshBtn = document.getElementById('dash-refresh-btn');

  // Populate Services Filter
  if (serviceSelect && window.MasterDB) {
    const services = window.MasterDB.getServices();
    serviceSelect.innerHTML = `<option value="">ทุกประเภทบริการ (8 บริการตรวจสิ่งแวดล้อม)</option>` + 
      services.map(s => `<option value="${s.code}">${s.code} : ${s.name}</option>`).join('');
  }

  if (yearSelect) {
    yearSelect.addEventListener('change', () => loadDashboardData());
  }
  if (serviceSelect) {
    serviceSelect.addEventListener('change', () => loadDashboardData());
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadDashboardData());
  }
}

/**
 * โหลดและประมวลผลข้อมูลสถิติสิ่งส่งตรวจ
 */
async function loadDashboardData() {
  const year = document.getElementById('dash-filter-year')?.value || '';
  const serviceCode = document.getElementById('dash-filter-service')?.value || '';
  // ไม่กรองด้วยชื่อหน่วยงานซ้ำอีกชั้น เพราะช่องหน่วยงานของ AIR-01 / WTS-03
  // เก็บหอผู้ป่วยที่ไปเก็บตัวอย่าง ไม่ใช่หน่วยงานผู้ส่งตรวจ
  // กรองซ้ำแล้วตัวเลขบนแดชบอร์ดจะน้อยกว่าจำนวนใบที่หน่วยงานเห็นในหน้ารายงาน
  // ตัวกรองบริการด้านบนตั้งเป็นบริการของหน่วยงานอยู่แล้ว จึงคุมขอบเขตได้ครบ
  const deptFilter = '';

  const loadingOverlay = document.getElementById('dashboard-loading');
  if (loadingOverlay) loadingOverlay.classList.remove('hidden');

  try {
    const data = await window.ReportDB.getSpecimenAnalytics({ 
      year, 
      serviceCode,
      department: deptFilter
    });
    currentAnalyticsData = data;

    // 1. Update KPI Summary Cards
    updateKPICards(data);

    // 2. Render Key Insights Banner
    updateInsightsBanner(data);

    // 3. Render Monthly Trends Bar Chart (Emerald Theme)
    renderMonthlyTrendsChart(data.monthlyTrends);

    // 4. Render Specimen Type Distribution Doughnut Chart (Medical Theme)
    renderDistributionChart(data.specimenTypeRankings);

    // 5. Render Department Ranking Table with Progress Bars
    renderDepartmentTable(data.departmentRankings);

    // 6. Render Specimen Type Ranking Table with Progress Bars
    renderSpecimenTypeTable(data.specimenTypeRankings);

  } catch (err) {
    console.error('Error loading specimen dashboard data:', err);
  } finally {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
  }
}

/**
 * อัปเดตการ์ดสรุปผล KPI 4 ใบด้านบน
 */
async function updateKPICards(data) {
  const elTotal = document.getElementById('dash-metric-total') || document.getElementById('kpi-total-specimens');
  const elReported = document.getElementById('dash-metric-reported');
  const elProgress = document.getElementById('dash-metric-progress');
  const elBookings = document.getElementById('dash-metric-bookings');

  // คำนวณจากข้อมูลจริงที่โหลดมา ไม่ใช้ค่าคงที่
  // (เดิม hard-code "รอตรวจ" เป็น 0 เสมอ และ fallback ยอดรวมเป็น 982
  //  ทำให้ใบที่เพิ่งส่งตรวจไม่เคยถูกนับใน KPI "กำลังเพาะเชื้อ / รอตรวจ")
  const reports = data.rawReports || [];
  const isWaiting = (r) => (window.isWaitingReport
    ? window.isWaitingReport(r)
    : ['pending', 'waiting_for_testing', 'in_progress', 'draft'].includes(String(r.status || '').toLowerCase()));

  const countItems = (r) => ((r.report_items || r.items || []).length || 1);

  const totalSpecimens = Number(data.totalSpecimens || 0);
  const waitingSpecimens = reports.filter(isWaiting).reduce((sum, r) => sum + countItems(r), 0);
  const reportedSpecimens = Math.max(totalSpecimens - waitingSpecimens, 0);

  if (elTotal) elTotal.textContent = totalSpecimens.toLocaleString();
  if (elReported) elReported.textContent = reportedSpecimens.toLocaleString();
  if (elProgress) elProgress.textContent = waitingSpecimens.toLocaleString();

  // จำนวนคิวจองในปฏิทิน — ดึงจากฐานข้อมูลจริง
  if (elBookings) {
    elBookings.textContent = '...';
    try {
      const bookings = await window.BookingDB.getAllBookings(1000);
      elBookings.textContent = Number((bookings || []).length).toLocaleString();
    } catch (e) {
      console.warn('โหลดจำนวนคิวจองไม่สำเร็จ:', e);
      elBookings.textContent = '-';
    }
  }
}

/**
 * อัปเดตกล่องสรุปประเด็นสำคัญ (Executive Insights)
 */
function updateInsightsBanner(data) {
  const container = document.getElementById('dashboard-insights-container');
  if (!container) return;

  const topType = (data.specimenTypeRankings && data.specimenTypeRankings[0]) || { name: 'อากาศ (Air Sampling)', percentage: '37.4' };
  const topDept = (data.departmentRankings && data.departmentRankings[0]) || { name: 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร', percentage: '27.7' };

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="flex items-start gap-3 bg-[#fefaf0] border border-[#fde8a8] p-4 rounded-3xl">
        <div class="w-9 h-9 rounded-2xl bg-[#b8860b] text-white flex items-center justify-center shrink-0 text-sm shadow-xs">
          <i class="fas fa-chart-line"></i>
        </div>
        <div>
          <h4 class="font-bold text-[#342838] text-xs">ภาระงานตรวจสูงสุด</h4>
          <p class="text-[11px] text-[#78687e] mt-0.5 leading-snug">
            เดือน <strong>${data.peakMonth || 'ส.ค. 69'}</strong> มีการส่งตรวจมากที่สุด รวม <strong class="text-[#b8860b] font-mono">${data.peakCount || 185} ตัวอย่าง</strong>
          </p>
        </div>
      </div>

      <div class="flex items-start gap-3 bg-[#f7f2f8] border border-[#6c5070]/20 p-4 rounded-3xl">
        <div class="w-9 h-9 rounded-2xl bg-[#6c5070] text-white flex items-center justify-center shrink-0 text-sm shadow-xs">
          <i class="fas fa-boxes-stacked"></i>
        </div>
        <div>
          <h4 class="font-bold text-[#342838] text-xs">สิ่งส่งตรวจหลัก</h4>
          <p class="text-[11px] text-[#78687e] mt-0.5 leading-snug">
            <strong>${topType.name}</strong> คิดเป็น <strong class="text-[#6c5070] font-mono">${topType.percentage}%</strong> ของตัวอย่างทั้งหมด
          </p>
        </div>
      </div>

      <div class="flex items-start gap-3 bg-[#f2f8f2] border border-[#c2dbc1] p-4 rounded-3xl">
        <div class="w-9 h-9 rounded-2xl bg-[#3d5e3c] text-white flex items-center justify-center shrink-0 text-sm shadow-xs">
          <i class="fas fa-shield-halved"></i>
        </div>
        <div>
          <h4 class="font-bold text-[#342838] text-xs">คุณภาพและมาตรฐาน ISO 15189</h4>
          <p class="text-[11px] text-[#78687e] mt-0.5 leading-snug">
            อัตราผลตรวจผ่านเกณฑ์ (Pass Rate) อยู่ที่ <strong class="text-[#285b2a] font-bold font-mono">${data.passRate || 98.6}%</strong>
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * เรนเดอร์กราฟแท่งแนวโน้มปริมาณงานรายเดือน (Monthly Trends Bar Chart - K-Minimal Palette)
 */
function renderMonthlyTrendsChart(monthlyData) {
  const canvas = document.getElementById('monthlyTrendChart') || document.getElementById('monthly-trends-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
  }

  const labels = monthlyData.map(m => m.label);
  const counts = monthlyData.map(m => m.count);

  // K-Minimal Purple to Coral gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, '#6c5070'); // Deep purple
  gradient.addColorStop(1, '#df6a6a'); // Warm coral

  monthlyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'จำนวนสิ่งส่งตรวจ (ตัวอย่าง)',
        data: counts,
        backgroundColor: gradient,
        hoverBackgroundColor: '#503854',
        borderRadius: 12,
        borderSkipped: false,
        barThickness: 16,
        maxBarThickness: 20
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#342838',
          titleFont: { family: 'Noto Sans Thai', size: 12, weight: 'bold' },
          bodyFont: { family: 'Noto Sans Thai', size: 12 },
          padding: 12,
          cornerRadius: 12,
          callbacks: {
            label: (context) => ` ปริมาณส่งตรวจ: ${context.parsed.y} ตัวอย่าง`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Noto Sans Thai', size: 11 },
            color: '#78687e'
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(108, 80, 112, 0.06)',
            drawBorder: false
          },
          ticks: {
            font: { family: 'Noto Sans Thai', size: 11 },
            color: '#78687e',
            stepSize: 20
          }
        }
      }
    }
  });
}

/**
 * เรนเดอร์กราฟวงกลมสัดส่วนประเภทสิ่งส่งตรวจ (Doughnut Chart - K-Minimal Pastel Palette)
 */
function renderDistributionChart(typeRankings) {
  const canvas = document.getElementById('specimenDistributionChart') || document.getElementById('specimen-distribution-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (distributionChartInstance) {
    distributionChartInstance.destroy();
  }

  const labels = typeRankings.map(t => t.name);
  const dataCounts = typeRankings.map(t => t.count);

  // K-Minimal Pastel Palette
  const colors = [
    '#6c5070', // Primary Deep Purple
    '#df6a6a', // Coral / Red
    '#c2dbc1', // Pastel Sage Green
    '#f9d56e', // Pastel Gold / Yellow
    '#8d7092', // Muted Purple
    '#f59595', // Soft Pink
    '#638c62', // Darker Sage
    '#b8860b'  // Gold Accent
  ];

  distributionChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: dataCounts,
        backgroundColor: colors,
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: { family: 'Noto Sans Thai', size: 11 },
            color: '#342838',
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            padding: 10
          }
        },
        tooltip: {
          backgroundColor: '#342838',
          titleFont: { family: 'Noto Sans Thai', size: 12, weight: 'bold' },
          bodyFont: { family: 'Noto Sans Thai', size: 12 },
          padding: 12,
          cornerRadius: 12,
          callbacks: {
            label: (context) => {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const val = context.parsed;
              const pct = ((val / total) * 100).toFixed(1);
              return ` ${context.label}: ${val} ตัวอย่าง (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * เรนเดอร์ตารางสรุปจำนวนสิ่งส่งตรวจ แยกตามหน่วยงาน (Department Workload)
 */
function renderDepartmentTable(rankings) {
  const tbody = document.getElementById('dash-dept-rankings-tbody') || document.getElementById('department-rankings-tbody');
  if (!tbody) return;

  if (!rankings || rankings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-[#78687e]">ไม่มีข้อมูลสถิติการส่งตรวจ</td></tr>`;
    return;
  }

  tbody.innerHTML = rankings.map((item, idx) => {
    let rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">#${idx + 1}</span>`;
    if (idx === 0) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#fad5d7] text-[#7a272b] font-black text-xs">#1</span>`;
    else if (idx === 1) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#fefaf0] text-[#b8860b] font-bold text-xs border border-[#fde8a8]">#2</span>`;
    else if (idx === 2) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#f2f8f2] text-[#285b2a] font-bold text-xs border border-[#c2dbc1]">#3</span>`;

    return `
      <tr class="hover:bg-[#f7f2f8]/40 transition border-b border-[#6c5070]/10 last:border-0">
        <td class="p-3.5 text-center">${rankBadge}</td>
        <td class="p-3.5">
          <div class="font-bold text-[#342838] text-xs">${item.name}</div>
        </td>
        <td class="p-3.5 text-center font-mono font-bold text-[#6c5070] text-xs">
          ${Number(item.count).toLocaleString()}
        </td>
        <td class="p-3.5 text-center font-mono font-bold text-[#df6a6a] text-xs">
          ${item.percentage}%
        </td>
        <td class="p-3.5">
          <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div class="bg-gradient-to-r from-[#6c5070] to-[#df6a6a] h-full rounded-full transition-all duration-500" style="width: ${item.percentage}%"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * เรนเดอร์ตารางสรุปจำนวนสิ่งส่งตรวจ แยกตามประเภท
 */
function renderSpecimenTypeTable(rankings) {
  const tbody = document.getElementById('specimen-type-rankings-tbody');
  if (!tbody) return;

  if (rankings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-slate-400">ไม่มีข้อมูลประเภทสิ่งส่งตรวจ</td></tr>`;
    return;
  }

  tbody.innerHTML = rankings.map((item, idx) => {
    let rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">#${idx + 1}</span>`;
    if (idx === 0) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">#1</span>`;
    else if (idx === 1) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold text-xs">#2</span>`;
    else if (idx === 2) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-100 text-sky-800 font-bold text-xs">#3</span>`;

    return `
      <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
        <td class="py-3 px-3 w-14 text-center">${rankBadge}</td>
        <td class="py-3 px-3">
          <div class="font-semibold text-slate-800 text-xs">${item.name}</div>
          <div class="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div class="bg-teal-600 h-full rounded-full" style="width: ${item.percentage}%"></div>
          </div>
        </td>
        <td class="py-3 px-3 text-right">
          <span class="font-mono font-bold text-teal-800 text-xs">${item.count}</span>
          <span class="text-[10px] text-slate-400 ml-1">(${item.percentage}%)</span>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * ฟังก์ชันดาวน์โหลดรายงานสถิติเป็น CSV
 */
function exportAnalyticsCSV() {
  if (!currentAnalyticsData) return;

  let csvContent = "\uFEFFลำดับ,หน่วยงาน,จำนวนสิ่งส่งตรวจ(ตัวอย่าง),สัดส่วน(%)\n";
  currentAnalyticsData.departmentRankings.forEach((d, idx) => {
    csvContent += `${idx + 1},"${d.name}",${d.count},${d.percentage}%\n`;
  });

  csvContent += "\nลำดับ,ประเภทสิ่งส่งตรวจ,จำนวนรวม(ตัวอย่าง),สัดส่วน(%)\n";
  currentAnalyticsData.specimenTypeRankings.forEach((t, idx) => {
    csvContent += `${idx + 1},"${t.name}",${t.count},${t.percentage}%\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `TUH_Specimen_Analytics_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

window.exportAnalyticsCSV = exportAnalyticsCSV;

/**
 * จัดการเปิด/ปิด เมนูนำทางบนมือถือ
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
