/**
 * ==============================================================================
 * PUBLIC PORTAL APP (index.html logic)
 * ค้นหารายงานผลตรวจ, แสดงบริการทั้ง 8 รายการ, และสถิติภาพรวม
 * ==============================================================================
 */

function bootApp() {
  renderDailyLabStatus();
  initServicesGrid();
  initSearchHandler();
  loadStats();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

/**
 * แสดงแถบสถานะการเปิดรับสิ่งส่งตรวจประจำวัน (Daily Lab Reception Status Banner - K-Minimal)
 */
function renderDailyLabStatus() {
  const container = document.getElementById('daily-lab-status-container');
  if (!container) return;

  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  const todayName = dayNames[day];

  // วันเปิดรับ: จันทร์ (1), อังคาร (2), พุธ (3)
  const isOpenToday = (day >= 1 && day <= 3);

  if (isOpenToday) {
    container.innerHTML = `
      <div class="bg-[#f2f8f2] border border-[#dbe9da] text-[#2c442b] rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-[#c2dbc1] text-[#2c442b] flex items-center justify-center shrink-0 text-lg shadow-2xs">
            <i class="fas fa-door-open animate-pulse"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#c2dbc1] text-[#2c442b]">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span> เปิดรับตรวจวันนี้
              </span>
              <span class="text-xs font-bold text-[#2c442b]">${todayName}</span>
            </div>
            <p class="text-xs text-[#4b6a4a] mt-0.5 leading-snug">
              ห้องปฏิบัติการเปิดรับสิ่งส่งตรวจเวลา <strong>08:30 - 15:30 น.</strong> (โควต้าไม่เกิน 30 ตัวอย่าง/วัน)
            </p>
          </div>
        </div>
        <a href="workflow.html?tab=calendar" class="k-btn-primary text-xs font-bold px-4 py-2.5 rounded-2xl flex items-center gap-1.5 shrink-0">
          <i class="fas fa-calendar-check text-[#f9d56e]"></i> จองคิวส่งตรวจวันนี้
        </a>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="bg-[#fdf0f0] border border-[#f9d2d2] text-[#842b2b] rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-[#f59595]/30 text-[#df6a6a] flex items-center justify-center shrink-0 text-lg shadow-2xs">
            <i class="fas fa-calendar-xmark"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#df6a6a] text-white">
                วันนี้ไม่เปิดรับสิ่งส่งตรวจ
              </span>
              <span class="text-xs font-bold text-[#842b2b]">${todayName}</span>
            </div>
            <p class="text-xs text-[#a34b4b] mt-0.5 leading-snug">
              เปิดรับสิ่งส่งตรวจเฉพาะ <strong>วันจันทร์, อังคาร, พุธ</strong> เพื่อการเพาะเชื้อที่ได้มาตรฐาน (สามารถจองคิวล่วงหน้าได้ตลอด 24 ชม.)
            </p>
          </div>
        </div>
        <a href="workflow.html?tab=calendar" class="bg-white hover:bg-rose-50 text-[#df6a6a] border border-[#f9d2d2] text-xs font-bold px-4 py-2.5 rounded-2xl transition flex items-center gap-1.5 shrink-0 shadow-2xs">
          <i class="fas fa-calendar-days"></i> จองคิวรอบสัปดาห์หน้า
        </a>
      </div>
    `;
  }
}

/**
 * สร้างการ์ดแสดง 8 บริการตรวจสิ่งแวดล้อม (K-Minimal Rounded Cards)
 */
function initServicesGrid() {
  const container = document.getElementById('services-grid-container');
  if (!container) return;

  const services = window.MasterDB.getServices();
  container.innerHTML = services.map(srv => `
    <div class="k-card p-6 rounded-3xl flex flex-col justify-between group hover:-translate-y-1 transition duration-300">
      <div>
        <div class="flex items-center justify-between mb-4">
          <a href="workflow.html?service=${srv.code}&tab=submission" class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#f7f2f8] text-[#6c5070] border border-[#6c5070]/15 text-xl shadow-2xs group-hover:bg-[#6c5070] group-hover:text-white transition-colors duration-300" title="คลิกเพื่อไปที่แบบฟอร์มส่งตรวจ">
            <i class="fas ${srv.icon}"></i>
          </a>
          <span class="text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-[#fdf0f0] text-[#df6a6a] border border-[#f9d2d2]">
            ${srv.code}
          </span>
        </div>

        <h3 class="font-bold text-[#342838] text-base group-hover:text-[#6c5070] transition-colors leading-snug mb-1.5 font-heading">
          <a href="workflow.html?service=${srv.code}&tab=submission" class="hover:underline">
            ${srv.name}
          </a>
        </h3>
        
        <p class="text-xs text-[#78687e] mb-4 line-clamp-2 leading-relaxed">
          ${srv.category}
        </p>

        <div class="bg-[#faf7f5] rounded-2xl p-3.5 mb-5 border border-[#6c5070]/10 text-xs space-y-2">
          <div class="flex justify-between items-center text-[#78687e]">
            <span class="font-semibold"><i class="fas fa-clock text-[#df6a6a] mr-1"></i> ระยะเวลา (TAT):</span>
            <span class="font-bold text-[#3d5e3c] bg-[#f2f8f2] border border-[#dbe9da] px-2.5 py-0.5 rounded-full text-[11px]">3-5 วันทำการ</span>
          </div>
          <div class="flex justify-between items-center text-[#78687e]">
            <span class="font-semibold"><i class="fas fa-ruler-combined text-[#6c5070] mr-1"></i> หน่วยวัด:</span>
            <span class="font-mono text-[#6c5070] bg-[#f7f2f8] border border-[#6c5070]/20 px-2 py-0.5 rounded-full text-[11px] font-bold">${srv.unit}</span>
          </div>
          <div class="text-[11px] text-[#78687e] truncate" title="${srv.standard}">
            <i class="fas fa-shield-heart text-[#f9d56e] mr-1"></i> เกณฑ์: ${srv.standard}
          </div>
        </div>
      </div>

      <div class="pt-3 border-t border-[#6c5070]/10 space-y-2">
        <a href="workflow.html?service=${srv.code}&tab=submission" class="k-btn-primary w-full text-center text-xs font-bold py-2.5 px-3 rounded-2xl shadow-xs transition flex items-center justify-center gap-1.5" title="ไปที่แบบฟอร์มส่งตรวจ ${srv.code}">
          <i class="fas fa-file-pen text-[#f9d56e]"></i>
          <span>แบบฟอร์มส่งตรวจ (${srv.code})</span>
        </a>
        <a href="workflow.html?service=${srv.code}&tab=calendar" class="w-full text-center text-[11px] font-bold py-2 px-3 rounded-2xl bg-[#f7f2f8] hover:bg-[#ede4ef] text-[#6c5070] border border-[#6c5070]/15 transition flex items-center justify-center gap-1.5" title="ดูปฏิทินจองวัน">
          <i class="fas fa-calendar-days text-xs"></i>
          <span>ปฏิทินจองวันส่งตรวจ</span>
        </a>
      </div>
    </div>
  `).join('');
}

/**
 * จัดการเมื่อกดปุ่มดูผลตรวจในแต่ละการ์ดบริการ (Require Login)
 */
function handleServiceReportClick(serviceCode) {
  const currentUser = window.AuthManager ? window.AuthManager.getCurrentUser() : null;
  if (!currentUser) {
    Swal.fire({
      icon: 'warning',
      title: 'กรุณาเข้าสู่ระบบก่อนดูผลตรวจ',
      html: `
        <div class="text-xs text-[#78687e] space-y-2 text-left bg-[#faf7f5] p-4 rounded-2xl border border-[#6c5070]/15 mt-2">
          <p class="font-bold text-[#342838] flex items-center gap-1.5 text-sm">
            <i class="fas fa-shield-heart text-[#df6a6a]"></i>
            <span>ระบบรักษาความปลอดภัยข้อมูลทางการแพทย์</span>
          </p>
          <p>ข้อมูลผลตรวจสิ่งแวดล้อมทางห้องปฏิบัติการถูกจำกัดสิทธิ์เฉพาะบุคลากรของโรงพยาบาลธรรมศาสตร์ฯ กรุณา <strong>เข้าสู่ระบบเจ้าหน้าที่</strong> ก่อนเปิดดูรายงานผลตรวจ</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-right-to-bracket mr-1"></i> เข้าสู่ระบบเจ้าหน้าที่',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#6c5070',
      cancelButtonColor: '#78687e',
      customClass: { popup: 'k-swal' },
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = `login.html?redirect=${encodeURIComponent(`workflow.html?service=${serviceCode}&tab=reports`)}`;
      }
    });
    return;
  }

  // ถ้าเข้าสู่ระบบแล้ว ให้พาไปยังหน้ารายงานผลตามบริการ
  window.location.href = `workflow.html?service=${serviceCode}&tab=reports`;
}
window.handleServiceReportClick = handleServiceReportClick;
window.filterReportByService = handleServiceReportClick;

/**
 * จัดการระบบค้นหาผลการตรวจ (Public Report Search - Require Login)
 */
function initSearchHandler() {
  const searchInput = document.getElementById('public-search-input');
  const searchBtn = document.getElementById('public-search-btn');
  const resultsContainer = document.getElementById('search-results-container');
  const resultsSection = document.getElementById('search-results-section');

  if (!searchInput || !searchBtn) return;

  const performSearch = async () => {
    // 🔒 1. ตรวจสอบว่าผู้ใช้งานเข้าสู่ระบบแล้วหรือยัง
    const currentUser = window.AuthManager ? window.AuthManager.getCurrentUser() : null;
    if (!currentUser) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณาเข้าสู่ระบบก่อนค้นหาและดูผลตรวจ',
        html: `
          <div class="text-xs text-[#78687e] space-y-2 text-left bg-[#faf7f5] p-4 rounded-2xl border border-[#6c5070]/15 mt-2">
            <p class="font-bold text-[#342838] flex items-center gap-1.5 text-sm">
              <i class="fas fa-shield-heart text-[#df6a6a]"></i>
              <span>ระบบรักษาความปลอดภัยข้อมูลทางการแพทย์</span>
            </p>
            <p>เพื่อความปลอดภัยและการรักษาความลับของผลตรวจสิ่งแวดล้อมทางจุลชีววิทยา บุคลากรและหน่วยงานต้อง <strong>เข้าสู่ระบบเจ้าหน้าที่</strong> ก่อนจึงจะสามารถค้นหาและเปิดดูรายละเอียดใบรายงานผลตรวจได้</p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-right-to-bracket mr-1"></i> เข้าสู่ระบบเจ้าหน้าที่',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#6c5070',
        cancelButtonColor: '#78687e',
        customClass: { popup: 'k-swal' },
        reverseButtons: true
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = 'login.html?redirect=index.html';
        }
      });
      return;
    }

    const term = searchInput.value.trim();
    if (!term) {
      Swal.fire({
        icon: 'info',
        title: 'กรุณากรอกคำค้นหา',
        text: 'ระบุเลขที่ใบส่งตรวจ (เช่น AIR-202608-001) หรือชื่อหน่วยงาน/หอผู้ป่วย',
        confirmButtonColor: '#6c5070',
        customClass: { popup: 'k-swal' }
      });
      return;
    }

    searchBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> กำลังค้นหา...`;
    searchBtn.disabled = true;

    try {
      let results = await window.ReportDB.searchPublicReports(term);
      
      // ถ้าเป็นเจ้าหน้าที่หน่วยงาน ให้แสดงเฉพาะรายการของหน่วยงานตนเอง (Data Isolation)
      if (currentUser.role !== 'admin' && currentUser.department) {
        const userDeptNorm = currentUser.department.toLowerCase().replace(/\s+/g, '');
        results = results.filter(r => {
          const rDeptNorm = (r.department || '').toLowerCase().replace(/\s+/g, '');
          return rDeptNorm.includes(userDeptNorm) || userDeptNorm.includes(rDeptNorm);
        });
      }

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
 * เรนเดอร์ผลการค้นหารายงานตรวจ (K-Minimal Rounded Cards)
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
      <div class="bg-[#fefaf0] border border-[#fde8a8] rounded-3xl p-8 text-center max-w-xl mx-auto">
        <div class="w-12 h-12 rounded-2xl bg-[#f9d56e]/30 text-[#b8860b] flex items-center justify-center mx-auto mb-3 text-xl">
          <i class="fas fa-file-circle-question"></i>
        </div>
        <h4 class="font-bold text-[#342838] text-base mb-1">ไม่พบผลตรวจที่ตรงกับ "${term}"</h4>
        <p class="text-xs text-[#78687e] mb-4">
          อาจอยู่ระหว่างการเพาะเชื้อและตรวจวิเคราะห์ หรือโปรดตรวจสอบเลขที่ใบส่งตรวจอีกครั้ง
        </p>
        <a href="workflow.html?tab=calendar" class="k-btn-primary inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-2xl">
          <i class="fas fa-calendar-check text-[#f9d56e]"></i> ตรวจสอบสถานะในปฏิทินส่งตรวจ
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
          <div class="k-card p-5 rounded-3xl flex flex-col justify-between hover:border-[#6c5070]/30 transition">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="font-mono font-bold text-xs bg-[#f7f2f8] text-[#6c5070] px-2.5 py-1 rounded-xl border border-[#6c5070]/15">
                  ${rep.submission_no}
                </span>
                <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isPass ? 'bg-[#f2f8f2] text-[#3d5e3c] border border-[#dbe9da]' : 'bg-[#fdf0f0] text-[#df6a6a] border border-[#f9d2d2]'}">
                  <i class="fas ${isPass ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i>
                  ${isPass ? 'ผ่านเกณฑ์มาตรฐาน' : 'ไม่ผ่านเกณฑ์ / พบเชื้อ'}
                </span>
              </div>

              <h4 class="font-bold text-[#342838] text-sm mb-1 font-heading">${rep.service_name}</h4>
              <p class="text-xs text-[#78687e] mb-3"><i class="fas fa-hospital-user text-[#df6a6a] mr-1"></i> ${rep.department} ${rep.ward_room ? `(${rep.ward_room})` : ''}</p>

              <div class="text-xs text-[#78687e] space-y-1 bg-[#faf7f5] p-3 rounded-2xl mb-4 border border-[#6c5070]/10">
                <div class="flex justify-between">
                  <span>วันที่เก็บ:</span>
                  <span class="font-medium text-[#342838]">${rep.sampling_date}</span>
                </div>
                <div class="flex justify-between">
                  <span>วันที่รายงาน:</span>
                  <span class="font-medium text-[#342838]">${rep.reported_date}</span>
                </div>
                <div class="flex justify-between">
                  <span>ผู้รายงานผล:</span>
                  <span class="font-medium text-[#342838]">${rep.reporter_name}</span>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-[#6c5070]/10 flex items-center gap-2">
              <button onclick="previewReportModal('${rep.id || rep.submission_no}')" class="k-btn-primary flex-1 text-xs font-bold py-2 px-3 rounded-xl text-center flex items-center justify-center gap-1">
                <i class="fas fa-file-lines text-[#f9d56e]"></i> ดูใบรายงานผล
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
 * ดูตัวอย่างใบรายงานผลตรวจแบบ Modal (รองรับทุก 8 บริการและสถานะรอตรวจ)
 */
async function previewReportModal(reportId) {
  Swal.fire({
    title: 'กำลังโหลดข้อมูลรายงาน...',
    allowOutsideClick: false,
    customClass: { popup: 'k-swal' },
    didOpen: () => Swal.showLoading()
  });

  const res = await window.ReportDB.getReportById(reportId);
  const rep = res?.data || res;
  Swal.close();

  if (!rep) {
    Swal.fire({ icon: 'error', title: 'ไม่พบรายงาน', text: 'ไม่สามารถดึงข้อมูลรายงานตรวจนี้ได้', confirmButtonColor: '#6c5070', customClass: { popup: 'k-swal' } });
    return;
  }

  const srvCode = rep.service_code || '';
  const isPending = rep.status === 'pending' || rep.overall_result === 'pending';
  const isPass = !isPending && (['pass', 'normal', 'no_growth', 'ไม่พบเชื้อ', 'tested', 'completed'].includes(rep.overall_result?.toLowerCase()) || rep.status === 'tested' || rep.status === 'completed');

  const isDrugBioburden = (srvCode === 'DRG_08') || (rep.service_name && rep.service_name.includes('ปนเปื้อน'));
  const isDrugSterility = !isDrugBioburden && ((srvCode === 'DRG_07') || (rep.service_name && (rep.service_name.includes('Drug') || rep.service_name.includes('ยา') || rep.service_name.includes('ปลอดเชื้อ'))));
  const isFood = !isDrugBioburden && !isDrugSterility && ((srvCode === 'FOD_06') || (rep.service_name && rep.service_name.includes('Food')) || (rep.department && rep.department.includes('โภชนาการ')));
  const isWaterSurface = !isDrugBioburden && !isDrugSterility && !isFood && ((srvCode === 'WTS_03' || srvCode === 'WTO_04' || srvCode === 'WTM_05') || (rep.service_name && (rep.service_name.includes('Water') || rep.service_name.includes('Surface'))));
  const isSterility = !isDrugBioburden && !isDrugSterility && !isFood && !isWaterSurface && ((srvCode === 'STR_02') || (rep.service_name && rep.service_name.includes('Sterility')));

  const items = rep.report_items || rep.items || [];
  let tableHeaderHtml = '';
  let itemsHtml = '';

  if (isDrugBioburden) {
    tableHeaderHtml = `
      <tr>
        <th class="p-2 text-center w-12">#</th>
        <th class="p-2">ยาเตรียม</th>
        <th class="p-2 text-center w-36">ผล 72 ชม.</th>
        <th class="p-2 text-center w-28">หมายเหตุ</th>
        <th class="p-2 text-center w-24">สถานะ</th>
      </tr>
    `;
    itemsHtml = items.map((it, idx) => {
      const drugName = it.drug_name || it.prepared_medicine || it.location_name || it.sample_description || (rep.prepared_medicine || `ตัวอย่างที่ ${idx + 1}`);
      const rawRes = String(it.culture_result || it.bacteria_count || 'No growth').trim();
      const isContam = ['growth', 'fail', 'contaminated', 'พบเชื้อ'].includes(rawRes.toLowerCase());
      const resText = isPending ? 'รอตรวจ' : (isContam ? 'Growth' : 'No growth');
      const itPass = !isPending && !isContam;
      return `
        <tr class="border-b border-slate-100 text-xs">
          <td class="p-2 text-center text-slate-500 font-bold">${idx + 1}</td>
          <td class="p-2 font-bold text-slate-800">${drugName}</td>
          <td class="p-2 text-center font-mono font-bold ${isPending ? 'text-amber-700' : (itPass ? 'text-emerald-700' : 'text-rose-700')}">${resText}</td>
          <td class="p-2 text-center text-slate-600">${it.notes || '-'}</td>
          <td class="p-2 text-center">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isPending ? 'bg-amber-100 text-amber-800' : (itPass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}">
              ${isPending ? 'รอตรวจ' : (itPass ? 'ผ่าน' : 'ตกเกณฑ์')}
            </span>
          </td>
        </tr>
      `;
    }).join('');

  } else if (isDrugSterility) {
    tableHeaderHtml = `
      <tr>
        <th class="p-2 text-center w-12">#</th>
        <th class="p-2">ชนิดยา</th>
        <th class="p-2 text-center w-48">ผลการตรวจเพาะเชื้อที่ 72 ชม.</th>
        <th class="p-2 text-center w-28">หมายเหตุ</th>
      </tr>
    `;
    itemsHtml = items.map((it, idx) => {
      const drugName = it.drug_name || it.location_name || it.sample_description || `รายการยาที่ ${idx + 1}`;
      const rawRes = String(it.culture_result || it.bacteria_count || 'No growth').trim();
      const isContam = ['growth', 'fail', 'contaminated', 'พบเชื้อ'].includes(rawRes.toLowerCase());
      const resText = isPending ? 'รอตรวจ' : (isContam ? 'Growth' : 'No growth');
      const itPass = !isPending && !isContam;
      return `
        <tr class="border-b border-slate-100 text-xs">
          <td class="p-2 text-center text-slate-500 font-bold">${idx + 1}</td>
          <td class="p-2 font-bold text-slate-800">${drugName}</td>
          <td class="p-2 text-center font-mono font-bold ${isPending ? 'text-amber-700' : (itPass ? 'text-emerald-700' : 'text-rose-700')}">${resText}</td>
          <td class="p-2 text-center text-slate-600">${it.notes || it.remarks || '-'}</td>
        </tr>
      `;
    }).join('');

  } else if (isFood) {
    tableHeaderHtml = `
      <tr>
        <th class="p-2 text-center w-12">#</th>
        <th class="p-2">รายการอาหาร</th>
        <th class="p-2 text-center w-28">E.coli</th>
        <th class="p-2 text-center w-28">P.aeruginosa</th>
        <th class="p-2 text-center w-24">สถานะ</th>
      </tr>
    `;
    itemsHtml = items.map((it, idx) => {
      const foodName = it.food_name || it.location_name || it.sample_description || `อาหารที่ ${idx + 1}`;
      const ecoli = isPending ? '-' : (it.ecoli_result || 'ไม่พบเชื้อ');
      const pa = isPending ? '-' : (it.paeruginosa_result || 'ไม่พบเชื้อ');
      return `
        <tr class="border-b border-slate-100 text-xs">
          <td class="p-2 text-center text-slate-500 font-bold">${idx + 1}</td>
          <td class="p-2 font-bold text-slate-800">${foodName}</td>
          <td class="p-2 text-center font-bold ${ecoli === 'ไม่พบเชื้อ' ? 'text-emerald-700' : (ecoli === '-' ? 'text-slate-400' : 'text-rose-700')}">${ecoli}</td>
          <td class="p-2 text-center font-bold ${pa === 'ไม่พบเชื้อ' ? 'text-emerald-700' : (pa === '-' ? 'text-slate-400' : 'text-rose-700')}">${pa}</td>
          <td class="p-2 text-center">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isPending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
              ${isPending ? 'รอตรวจ' : 'ตรวจแล้ว'}
            </span>
          </td>
        </tr>
      `;
    }).join('');

  } else if (isWaterSurface) {
    tableHeaderHtml = `
      <tr>
        <th class="p-2 text-center w-12">#</th>
        <th class="p-2">สถานที่เก็บ/จุดตรวจ</th>
        <th class="p-2 text-center w-40">ผลเพาะเชื้อ</th>
        <th class="p-2 text-center w-24">สถานะ</th>
      </tr>
    `;
    itemsHtml = items.map((it, idx) => {
      const loc = it.location_name || it.sample_description || it.ward_name || `จุดตรวจที่ ${idx + 1}`;
      const culture = isPending ? 'รอตรวจ' : (it.culture_result || 'No growth after 3 day');
      return `
        <tr class="border-b border-slate-100 text-xs">
          <td class="p-2 text-center text-slate-500 font-bold">${idx + 1}</td>
          <td class="p-2 font-medium text-slate-800">${loc}</td>
          <td class="p-2 text-center font-mono font-bold ${isPending ? 'text-amber-700' : 'text-emerald-700'}">${culture}</td>
          <td class="p-2 text-center">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isPending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
              ${isPending ? 'รอตรวจ' : 'ตรวจแล้ว'}
            </span>
          </td>
        </tr>
      `;
    }).join('');

  } else {
    // Air Sampling & Sterility default
    tableHeaderHtml = `
      <tr>
        <th class="p-2 text-center w-12">#</th>
        <th class="p-2">จุดตรวจ / รายการ</th>
        <th class="p-2 text-center w-28">แบคทีเรีย</th>
        <th class="p-2 text-center w-28">เชื้อรา</th>
        <th class="p-2 text-center w-24">ผลตรวจ</th>
      </tr>
    `;
    itemsHtml = items.map((it, idx) => `
      <tr class="border-b border-slate-100 text-xs">
        <td class="p-2 text-center text-slate-500 font-bold">${idx + 1}</td>
        <td class="p-2 font-medium text-slate-800">${it.location_name || it.sample_description || `จุดที่ ${idx + 1}`}</td>
        <td class="p-2 text-center font-mono">${isPending ? '-' : (it.bacteria_count ?? '0')}</td>
        <td class="p-2 text-center font-mono">${isPending ? '-' : (it.fungus_count ?? '0')}</td>
        <td class="p-2 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isPending ? 'bg-amber-100 text-amber-800' : (isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}">
            ${isPending ? 'รอตรวจ' : (isPass ? 'Pass' : 'Fail')}
          </span>
        </td>
      </tr>
    `).join('');
  }

  Swal.fire({
    title: `
      <div class="text-left">
        <span class="text-xs font-mono text-[#6c5070] bg-[#f7f2f8] px-2.5 py-1 rounded-full border border-[#6c5070]/20 font-bold">${rep.submission_no || rep.id}</span>
        <div class="text-base font-bold text-[#342838] mt-1">${rep.service_name}</div>
      </div>
    `,
    html: `
      <div class="text-left text-xs space-y-3 font-sans">
        <div class="grid grid-cols-2 gap-2 bg-[#faf7f5] p-3 rounded-2xl border border-[#6c5070]/15">
          <div><span class="text-slate-500 block text-[11px]">หน่วยงาน:</span> <strong class="text-[#342838]">${rep.department}</strong></div>
          <div><span class="text-slate-500 block text-[11px]">สถานที่/จุดตรวจ:</span> <strong class="text-[#df6a6a]">${rep.ward_room || '-'}</strong></div>
          <div><span class="text-slate-500 block text-[11px]">วันที่ส่งตรวจ:</span> <strong class="text-slate-800 font-mono">${rep.sampling_date || '-'}</strong></div>
          <div><span class="text-slate-500 block text-[11px]">สถานะภาพรวม:</span> 
            <strong class="${isPending ? 'text-amber-700' : (isPass ? 'text-emerald-700' : 'text-rose-700')}">
              ${isPending ? '⏳ รอผลการตรวจวิเคราะห์' : (isPass ? '✅ ผ่านเกณฑ์มาตรฐาน' : '⚠️ ไม่ผ่านเกณฑ์')}
            </strong>
          </div>
        </div>

        <div class="max-h-60 overflow-y-auto border border-slate-200 rounded-2xl">
          <table class="w-full text-left">
            <thead class="bg-slate-100 text-slate-700 font-semibold sticky top-0">
              ${tableHeaderHtml}
            </thead>
            <tbody>
              ${itemsHtml || '<tr><td colspan="5" class="p-4 text-center text-slate-400">ไม่มีรายการย่อย</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="p-2.5 bg-slate-50 rounded-xl text-slate-600 text-[11px] border border-slate-200">
          <i class="fas fa-info-circle text-[#6c5070] mr-1"></i> <strong>ข้อคิดเห็น:</strong> ${rep.remarks || 'อยู่ระหว่างห้องปฏิบัติการเพาะเชื้อและดำเนินการตรวจวิเคราะห์'}
        </div>
      </div>
    `,
    width: '720px',
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-file-waveform mr-1"></i> เปิดดูใบรายงานฉบับเต็ม (Full View)',
    cancelButtonText: 'ปิดหน้าต่าง',
    confirmButtonColor: '#6c5070',
    cancelButtonColor: '#78687e',
    customClass: { popup: 'k-swal' }
  }).then((res) => {
    if (res.isConfirmed) {
      window.open(`report_view.html?id=${encodeURIComponent(rep.id || rep.submission_no)}`, '_blank');
    }
  });
}
window.previewReportModal = previewReportModal;

/**
 * กรองผลตามบริการ (Require Login)
 */
async function filterReportByService(serviceCode) {
  // 🔒 1. ตรวจสอบสถานะการเข้าสู่ระบบ
  const currentUser = window.AuthManager ? window.AuthManager.getCurrentUser() : null;
  if (!currentUser) {
    Swal.fire({
      icon: 'warning',
      title: 'กรุณาเข้าสู่ระบบก่อนดูผลตรวจ',
      html: `
        <div class="text-xs text-slate-600 space-y-2 text-left bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
          <p class="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
            <i class="fas fa-shield-halved text-amber-500"></i>
            <span>ระบบรักษาความปลอดภัยข้อมูลทางการแพทย์</span>
          </p>
          <p>เพื่อความปลอดภัยและการรักษาความลับของผลตรวจสิ่งแวดล้อมทางจุลชีววิทยา กรุณา <strong>เข้าสู่ระบบเจ้าหน้าที่</strong> ก่อนเปิดดูผลตรวจ</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-right-to-bracket mr-1"></i> เข้าสู่ระบบเจ้าหน้าที่',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = 'login.html?redirect=index.html';
      }
    });
    return;
  }

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
  let filteredReports = reports || [];

  // ถ้าเป็นเจ้าหน้าที่หน่วยงาน ให้แสดงเฉพาะรายการของหน่วยงานตนเอง
  if (currentUser.role !== 'admin' && currentUser.department) {
    const userDeptNorm = currentUser.department.toLowerCase().replace(/\s+/g, '');
    filteredReports = filteredReports.filter(r => {
      const rDeptNorm = (r.department || '').toLowerCase().replace(/\s+/g, '');
      return rDeptNorm.includes(userDeptNorm) || userDeptNorm.includes(rDeptNorm);
    });
  }

  renderSearchResults(filteredReports, srv?.name || serviceCode);
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
