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

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthManager) {
    loggedInUser = await window.AuthManager.getCurrentUser();
  }
  initDepartmentBanner();
  initFilterControls();
  await loadDashboardData();
});

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
  const deptFilter = (!isViewingAll && loggedInUser && loggedInUser.role === 'department_staff') ? loggedInUser.department : '';

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
function updateKPICards(data) {
  const elTotal = document.getElementById('kpi-total-specimens');
  const elType = document.getElementById('kpi-top-type');
  const elDept = document.getElementById('kpi-top-dept');
  const elPeak = document.getElementById('kpi-peak-month');

  if (elTotal) elTotal.textContent = Number(data.totalSpecimens).toLocaleString();
  if (elType) elType.textContent = data.topSpecimenType || '-';
  if (elDept) {
    elDept.textContent = data.topDepartment || '-';
    elDept.title = data.topDepartment || '';
  }
  if (elPeak) elPeak.textContent = data.peakMonth || '-';
}

/**
 * อัปเดตกล่องสรุปประเด็นสำคัญ (Executive Insights)
 */
function updateInsightsBanner(data) {
  const container = document.getElementById('dashboard-insights-container');
  if (!container) return;

  const topType = data.specimenTypeRankings[0] || { name: 'อากาศ', percentage: '37.4' };
  const topDept = data.departmentRankings[0] || { name: 'งานอาชีวอนามัยฯ', percentage: '27.7' };

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="flex items-start gap-3 bg-emerald-50/80 border border-emerald-200/70 p-3.5 rounded-xl">
        <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 text-sm shadow-xs">
          <i class="fas fa-chart-line"></i>
        </div>
        <div>
          <h4 class="font-bold text-slate-800 text-xs">ภาระงานตรวจสูงสุด</h4>
          <p class="text-[11px] text-slate-600 mt-0.5 leading-snug">
            เดือน <strong>${data.peakMonth}</strong> มีการส่งตรวจมากที่สุด รวม <strong>${data.peakCount} ตัวอย่าง</strong>
          </p>
        </div>
      </div>

      <div class="flex items-start gap-3 bg-teal-50/80 border border-teal-200/70 p-3.5 rounded-xl">
        <div class="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 text-sm shadow-xs">
          <i class="fas fa-boxes-stacked"></i>
        </div>
        <div>
          <h4 class="font-bold text-slate-800 text-xs">สิ่งส่งตรวจหลัก</h4>
          <p class="text-[11px] text-slate-600 mt-0.5 leading-snug">
            <strong>${topType.name}</strong> คิดเป็น <strong>${topType.percentage}%</strong> ของตัวอย่างทั้งหมดในระบบ
          </p>
        </div>
      </div>

      <div class="flex items-start gap-3 bg-sky-50/80 border border-sky-200/70 p-3.5 rounded-xl">
        <div class="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 text-sm shadow-xs">
          <i class="fas fa-shield-halved"></i>
        </div>
        <div>
          <h4 class="font-bold text-slate-800 text-xs">คุณภาพและมาตรฐาน</h4>
          <p class="text-[11px] text-slate-600 mt-0.5 leading-snug">
            อัตราผลตรวจผ่านเกณฑ์ (Pass Rate) อยู่ที่ <strong class="text-emerald-700 font-bold">${data.passRate}%</strong>
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * เรนเดอร์กราฟแท่งแนวโน้มปริมาณงานรายเดือน (Monthly Trends Bar Chart - Emerald Theme)
 */
function renderMonthlyTrendsChart(monthlyData) {
  const canvas = document.getElementById('monthly-trends-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
  }

  const labels = monthlyData.map(m => m.label);
  const counts = monthlyData.map(m => m.count);

  // Emerald to Teal modern gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, '#059669'); // emerald-600
  gradient.addColorStop(1, '#0d9488'); // teal-600

  monthlyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'จำนวนสิ่งส่งตรวจ (ตัวอย่าง)',
        data: counts,
        backgroundColor: gradient,
        hoverBackgroundColor: '#047857',
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 14,
        maxBarThickness: 18
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Sarabun', size: 12, weight: 'bold' },
          bodyFont: { family: 'Sarabun', size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (context) => ` ปริมาณส่งตรวจ: ${context.parsed.y} ตัวอย่าง`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Sarabun', size: 11 },
            color: '#64748b'
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9',
            drawBorder: false
          },
          ticks: {
            font: { family: 'Sarabun', size: 11 },
            color: '#64748b',
            stepSize: 20
          }
        }
      }
    }
  });
}

/**
 * เรนเดอร์กราฟวงกลมสัดส่วนประเภทสิ่งส่งตรวจ (Doughnut Chart - Cohesive Medical Palette)
 */
function renderDistributionChart(typeRankings) {
  const canvas = document.getElementById('specimen-distribution-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (distributionChartInstance) {
    distributionChartInstance.destroy();
  }

  const labels = typeRankings.map(t => t.name);
  const dataCounts = typeRankings.map(t => t.count);

  // Medical Harmonious Palette
  const colors = [
    '#059669', // emerald-600
    '#0d9488', // teal-600
    '#0284c7', // sky-600
    '#4f46e5', // indigo-600
    '#d97706', // amber-600
    '#e11d48', // rose-600
    '#7c3aed', // violet-600
    '#64748b'  // slate-500
  ];

  distributionChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: dataCounts,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: { family: 'Sarabun', size: 11 },
            color: '#334155',
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            padding: 10
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Sarabun', size: 12, weight: 'bold' },
          bodyFont: { family: 'Sarabun', size: 12 },
          padding: 10,
          cornerRadius: 8,
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
 * เรนเดอร์ตารางสรุปจำนวนสิ่งส่งตรวจ แยกตามหน่วยงาน
 */
function renderDepartmentTable(rankings) {
  const tbody = document.getElementById('department-rankings-tbody');
  if (!tbody) return;

  if (rankings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-slate-400">ไม่มีข้อมูลหน่วยงาน</td></tr>`;
    return;
  }

  tbody.innerHTML = rankings.map((item, idx) => {
    let rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">#${idx + 1}</span>`;
    if (idx === 0) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-extrabold text-xs">#1</span>`;
    else if (idx === 1) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs">#2</span>`;
    else if (idx === 2) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-700 font-bold text-xs">#3</span>`;

    return `
      <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
        <td class="py-3 px-3 w-14 text-center">${rankBadge}</td>
        <td class="py-3 px-3">
          <div class="font-semibold text-slate-800 text-xs">${item.name}</div>
          <div class="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div class="bg-emerald-600 h-full rounded-full" style="width: ${item.percentage}%"></div>
          </div>
        </td>
        <td class="py-3 px-3 text-right">
          <span class="font-mono font-bold text-emerald-800 text-xs">${item.count}</span>
          <span class="text-[10px] text-slate-400 ml-1">(${item.percentage}%)</span>
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
