/**
 * ==============================================================================
 * ADMIN DASHBOARD SCRIPT (admin.html logic)
 * ระบบจัดการผลการตรวจ 8 บริการ, อัปโหลดไฟล์เข้า Supabase Storage, และจัดการคิวงาน
 * มาตรฐาน ISO 15189 | งานจุลชีววิทยา รพ.ธรรมศาสตร์เฉลิมพระเกียรติ
 * ==============================================================================
 */

let selectedServiceCode = 'AIR_01';
let uploadedAttachments = [];
let isEditingReportId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. ตรวจสอบสิทธิ์ (Security Guard)
  const isAuth = await window.AuthManager.requireAuth('login.html');
  if (!isAuth) return;

  // 2. ตั้งค่า User Info
  initUserInfo();

  // 3. เริ่มต้นระบบ Tabs & Forms
  initTabNavigation();
  initServiceSelect();
  initFormDefaultDates();
  initFileUploadDropzone();

  // 4. โหลดข้อมูลเริ่มต้น
  await loadSubmissionNumber();
  await loadReportsTable();
  await loadBookingsManagerTable();
  await loadDashboardKPIs();
});

/**
 * แสดงชื่อและอีเมลเจ้าหน้าที่
 */
async function initUserInfo() {
  const user = await window.AuthManager.getCurrentUser();
  if (!user) return;

  const displayName = user.user_metadata?.full_name || user.email || 'เจ้าหน้าที่ห้องปฏิบัติการ';
  const roleName = user.user_metadata?.role || 'Medical Technologist';

  const nameEl = document.getElementById('admin-staff-name');
  const roleEl = document.getElementById('admin-staff-role');
  const reporterInput = document.getElementById('rep-reporter-name');

  if (nameEl) nameEl.textContent = displayName;
  if (roleEl) roleEl.textContent = roleName;
  if (reporterInput && !reporterInput.value) {
    reporterInput.value = displayName;
  }
}

/**
 * สลับแท็บการทำงาน
 */
function initTabNavigation() {
  const tabs = document.querySelectorAll('.admin-nav-tab');
  const panels = document.querySelectorAll('.admin-tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = tab.getAttribute('data-target');

      tabs.forEach(t => t.classList.remove('active-tab', 'text-emerald-700', 'border-emerald-600', 'bg-emerald-50/50'));
      tab.classList.add('active-tab', 'text-emerald-700', 'border-emerald-600', 'bg-emerald-50/50');

      panels.forEach(p => {
        if (p.id === targetId) {
          p.classList.remove('hidden');
        } else {
          p.classList.add('hidden');
        }
      });

      // Refresh Data according to active tab
      if (targetId === 'tab-reports-archive') {
        loadReportsTable();
      } else if (targetId === 'tab-bookings-manager') {
        loadBookingsManagerTable();
      }
    });
  });
}

/**
 * ตั้งค่า Dropdown บริการตรวจ 8 รายการ
 */
function initServiceSelect() {
  const select = document.getElementById('rep-service-select');
  if (!select) return;

  const services = window.MasterDB.getServices();
  select.innerHTML = services.map(s => `
    <option value="${s.code}">${s.code} : ${s.name}</option>
  `).join('');

  select.value = selectedServiceCode;

  select.addEventListener('change', async (e) => {
    selectedServiceCode = e.target.value;
    updateServiceFormTheme();
    await loadSubmissionNumber();
    buildDynamicItemsTable();
  });

  updateServiceFormTheme();
  buildDynamicItemsTable();
}

/**
 * อัปเดต UI คำแนะนำและธีมตามบริการที่เลือก
 */
function updateServiceFormTheme() {
  const srv = window.SERVICES_CONFIG[selectedServiceCode];
  if (!srv) return;

  const infoTitle = document.getElementById('service-info-title');
  const infoDesc = document.getElementById('service-info-desc');
  const infoStandard = document.getElementById('service-info-standard');
  const infoUnit = document.getElementById('service-info-unit');

  if (infoTitle) infoTitle.textContent = `${srv.code} - ${srv.name}`;
  if (infoDesc) infoDesc.textContent = srv.category;
  if (infoStandard) infoStandard.textContent = srv.standard;
  if (infoUnit) infoUnit.textContent = srv.unit;
}

/**
 * กำหนดค่าวันที่เริ่มต้นของฟอร์ม
 */
function initFormDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  const samplingDate = document.getElementById('rep-sampling-date');
  const receivedDate = document.getElementById('rep-received-date');
  const reportedDate = document.getElementById('rep-reported-date');

  if (samplingDate && !samplingDate.value) samplingDate.value = today;
  if (receivedDate && !receivedDate.value) receivedDate.value = today;
  if (reportedDate && !reportedDate.value) reportedDate.value = today;

  // Datalist Wards
  const wardDatalist = document.getElementById('admin-wards-datalist');
  if (wardDatalist) {
    const wards = window.MasterDB.getWards();
    wardDatalist.innerHTML = wards.map(w => `<option value="${w}">${w}</option>`).join('');
  }
}

/**
 * สร้างเลขที่ Submission Number ถัดไป
 */
async function loadSubmissionNumber() {
  const subInput = document.getElementById('rep-submission-no');
  if (!subInput || isEditingReportId) return;

  const nextNo = await window.ReportDB.generateNextSubmissionNo(selectedServiceCode);
  subInput.value = nextNo;
}

/**
 * สร้างตารางบันทึกผลตัวอย่างแบบ Dynamic Rows ตามบริการที่เลือก
 */
function buildDynamicItemsTable(rowCount = 5, existingItems = null) {
  const tbody = document.getElementById('rep-items-tbody');
  const thead = document.getElementById('rep-items-thead');
  if (!tbody || !thead) return;

  const srv = window.SERVICES_CONFIG[selectedServiceCode];
  if (!srv) return;

  // 1. Render Table Headers
  let headerHtml = `
    <tr>
      <th class="p-2.5 text-center w-12 text-slate-600">#</th>
  `;

  srv.fields.forEach(f => {
    headerHtml += `<th class="p-2.5 text-left text-slate-700 font-semibold">${f.label}</th>`;
  });

  headerHtml += `
      <th class="p-2.5 text-center w-28 text-slate-700 font-semibold">ผลการประเมิน</th>
      <th class="p-2.5 text-center w-14 text-slate-400"><i class="fas fa-trash"></i></th>
    </tr>
  `;
  thead.innerHTML = headerHtml;

  // 2. Render Rows
  tbody.innerHTML = '';
  const count = existingItems ? existingItems.length : rowCount;

  for (let i = 0; i < count; i++) {
    const itemData = existingItems ? existingItems[i] : null;
    addItemRow(i + 1, itemData);
  }
}

/**
 * เพิ่มแถวรายการตัวอย่าง 1 แถว
 */
function addItemRow(rowNumber, data = null) {
  const tbody = document.getElementById('rep-items-tbody');
  if (!tbody) return;

  const srv = window.SERVICES_CONFIG[selectedServiceCode];
  const tr = document.createElement('tr');
  tr.className = 'border-b border-slate-200 hover:bg-slate-50/80 transition item-row';
  tr.setAttribute('data-row-num', rowNumber);

  let rowHtml = `<td class="p-2 text-center text-slate-500 font-mono text-xs">${rowNumber}</td>`;

  srv.fields.forEach(f => {
    const val = data ? (data[f.id] || data.raw_data?.[f.id] || data.bacteria_count || data.fungus_count || data.location_name || '') : '';
    
    if (f.type === 'ward-select') {
      rowHtml += `
        <td class="p-2">
          <input list="admin-wards-datalist" data-field="${f.id}" value="${val}" class="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden" placeholder="${f.placeholder}">
        </td>
      `;
    } else if (f.type === 'select') {
      rowHtml += `
        <td class="p-2">
          <select data-field="${f.id}" class="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden">
            ${f.options.map(opt => `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>
        </td>
      `;
    } else {
      rowHtml += `
        <td class="p-2">
          <input type="${f.type || 'text'}" data-field="${f.id}" value="${val}" class="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden" placeholder="${f.placeholder}">
        </td>
      `;
    }
  });

  const selectedResult = data?.item_result || 'pass';
  rowHtml += `
    <td class="p-2 text-center">
      <select data-field="item_result" class="px-2 py-1.5 border border-slate-300 rounded-md text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden ${selectedResult === 'fail' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}">
        <option value="pass" ${selectedResult === 'pass' ? 'selected' : ''}>✅ ผ่าน</option>
        <option value="fail" ${selectedResult === 'fail' ? 'selected' : ''}>⚠️ ตกเกณฑ์</option>
        <option value="no_growth" ${selectedResult === 'no_growth' ? 'selected' : ''}>No growth</option>
        <option value="growth" ${selectedResult === 'growth' ? 'selected' : ''}>Growth</option>
      </select>
    </td>
    <td class="p-2 text-center">
      <button type="button" onclick="removeItemRow(this)" class="text-slate-400 hover:text-rose-600 transition p-1" title="ลบแถวนี้">
        <i class="fas fa-times"></i>
      </button>
    </td>
  `;

  tr.innerHTML = rowHtml;
  tbody.appendChild(tr);
}

function removeItemRow(btn) {
  const tr = btn.closest('tr');
  tr.remove();
  reIndexItemRows();
}

function reIndexItemRows() {
  const rows = document.querySelectorAll('#rep-items-tbody .item-row');
  rows.forEach((r, idx) => {
    r.querySelector('td:first-child').textContent = idx + 1;
    r.setAttribute('data-row-num', idx + 1);
  });
}

function addSingleItemRow() {
  const rows = document.querySelectorAll('#rep-items-tbody .item-row');
  addItemRow(rows.length + 1);
}

function setMultipleRows(count) {
  buildDynamicItemsTable(count);
}

/**
 * จัดการ Dropzone อัปโหลดไฟล์เข้า Supabase Storage
 */
function initFileUploadDropzone() {
  const fileInput = document.getElementById('report-pdf-upload');
  const dropZone = document.getElementById('report-dropzone');
  const previewContainer = document.getElementById('uploaded-files-preview');

  if (!fileInput || !dropZone) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-emerald-500', 'bg-emerald-50/50');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-emerald-500', 'bg-emerald-50/50');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-emerald-500', 'bg-emerald-50/50');
    if (e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFilesUpload(e.target.files);
    }
  });
}

/**
 * ประมวลผลการอัปโหลดไฟล์ขึ้น Storage
 */
async function handleFilesUpload(fileList) {
  const previewContainer = document.getElementById('uploaded-files-preview');
  const subNo = document.getElementById('rep-submission-no')?.value || 'TEMP';

  for (const file of fileList) {
    const validation = window.StorageDB.validateFile(file);
    if (!validation.valid) {
      Swal.fire({ icon: 'warning', title: 'ไฟล์ไม่ถูกต้อง', text: validation.message });
      continue;
    }

    const tempId = 'file-' + Date.now();
    // Render progress card
    const fileCard = document.createElement('div');
    fileCard.id = tempId;
    fileCard.className = 'flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-2xs text-xs';
    fileCard.innerHTML = `
      <div class="flex items-center gap-3">
        <i class="fas fa-file-pdf text-xl text-rose-500"></i>
        <div>
          <div class="font-bold text-slate-800">${file.name}</div>
          <div class="text-[11px] text-slate-500">${window.StorageDB.formatFileSize(file.size)} • กำลังอัปโหลด...</div>
        </div>
      </div>
      <div class="upload-spinner"><i class="fas fa-spinner fa-spin text-emerald-600"></i></div>
    `;
    previewContainer.appendChild(fileCard);

    try {
      const uploadResult = await window.StorageDB.uploadFile(file, 'reports', subNo);
      uploadedAttachments.push(uploadResult);

      // อัปเดต UI เมื่อสำเร็จ
      fileCard.innerHTML = `
        <div class="flex items-center gap-3">
          <i class="fas fa-file-pdf text-xl text-emerald-600"></i>
          <div>
            <div class="font-bold text-slate-800">${file.name}</div>
            <div class="text-[11px] text-emerald-600"><i class="fas fa-check-circle"></i> อัปโหลดสำเร็จ (${window.StorageDB.formatFileSize(file.size)})</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a href="${uploadResult.file_url}" target="_blank" class="p-1.5 text-slate-500 hover:text-emerald-700 transition" title="เปิดดูไฟล์">
            <i class="fas fa-external-link-alt"></i>
          </a>
          <button type="button" onclick="removeAttachment('${uploadResult.file_path}', '${tempId}')" class="p-1.5 text-slate-400 hover:text-rose-600 transition" title="ลบไฟล์">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
    } catch (err) {
      fileCard.innerHTML = `
        <div class="text-rose-600 text-xs flex items-center justify-between w-full">
          <span>❌ ${file.name}: ${err.message}</span>
          <button onclick="this.parentElement.parentElement.remove()" class="text-slate-400 hover:text-slate-700">ปิด</button>
        </div>
      `;
    }
  }
}

async function removeAttachment(filePath, elementId) {
  await window.StorageDB.deleteFile(filePath);
  uploadedAttachments = uploadedAttachments.filter(a => a.file_path !== filePath);
  document.getElementById(elementId)?.remove();
}

/**
 * บันทึกรายงานผลการตรวจ (Submit Form)
 */
async function saveReportHandler(e) {
  if (e) e.preventDefault();

  const subNo = document.getElementById('rep-submission-no').value.trim();
  const department = document.getElementById('rep-department').value.trim();
  const wardRoom = document.getElementById('rep-ward-room').value.trim();
  const samplingDate = document.getElementById('rep-sampling-date').value;
  const receivedDate = document.getElementById('rep-received-date').value;
  const reportedDate = document.getElementById('rep-reported-date').value;
  const samplerName = document.getElementById('rep-sampler-name').value.trim();
  const reporterName = document.getElementById('rep-reporter-name').value.trim();
  const approverName = document.getElementById('rep-approver-name').value.trim();
  const overallResult = document.getElementById('rep-overall-result').value;
  const remarks = document.getElementById('rep-remarks').value.trim();
  const shouldNotify = document.getElementById('rep-notify-toggle').checked;

  if (!subNo || !department || !samplingDate || !reportedDate || !reporterName) {
    Swal.fire({
      icon: 'warning',
      title: 'กรุณากรอกข้อมูลที่จำเป็น',
      text: 'ระบุเลขที่ใบส่งตรวจ, หน่วยงาน, วันที่ และชื่อผู้รายงานผลให้ครบถ้วน',
      confirmButtonColor: '#059669'
    });
    return;
  }

  // เก็บรวบรวมรายการตัวอย่างย่อย
  const itemRows = document.querySelectorAll('#rep-items-tbody .item-row');
  const items = [];

  itemRows.forEach((r, idx) => {
    const itemData = { item_no: idx + 1, raw_data: {} };
    const inputs = r.querySelectorAll('input, select');
    inputs.forEach(inp => {
      const field = inp.getAttribute('data-field');
      if (field) {
        itemData[field] = inp.value;
        itemData.raw_data[field] = inp.value;
      }
    });

    // Map common fields
    itemData.location_name = itemData.location || itemData.ward || itemData.sample_type || `จุดตรวจที่ ${idx + 1}`;
    itemData.bacteria_count = itemData.bacteria || itemData.tvc || itemData.tamc || '';
    itemData.fungus_count = itemData.fungus || itemData.tymc || '';
    itemData.item_result = itemData.item_result || 'pass';

    items.push(itemData);
  });

  const srvObj = window.SERVICES_CONFIG[selectedServiceCode];

  // ไฟล์ PDF หลัก
  const primaryPdf = uploadedAttachments.find(a => a.file_type?.includes('pdf') || a.file_name?.endsWith('.pdf')) || uploadedAttachments[0];

  const reportHeader = {
    submission_no: subNo,
    service_code: selectedServiceCode,
    service_name: srvObj.name,
    department: department,
    ward_room: wardRoom,
    sampling_date: samplingDate,
    received_date: receivedDate || samplingDate,
    reported_date: reportedDate,
    sampler_name: samplerName,
    reporter_name: reporterName,
    approver_name: approverName,
    overall_result: overallResult,
    status: 'completed',
    remarks: remarks,
    report_pdf_url: primaryPdf ? primaryPdf.file_url : '',
    report_pdf_path: primaryPdf ? primaryPdf.file_path : ''
  };

  Swal.fire({
    title: 'กำลังบันทึกรายงานผลตรวจ...',
    text: 'บันทึกข้อมูลเข้าสู่ฐานข้อมูลและจัดเก็บไฟล์',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const { data: savedReport, error } = await window.ReportDB.createReport(reportHeader, items, uploadedAttachments);

    if (error) throw error;

    // ส่งการแจ้งเตือน LINE / Discord / Telegram
    if (shouldNotify) {
      try {
        await window.NotifyService.sendReportNotification({
          ...reportHeader,
          id: savedReport?.id || subNo
        });
      } catch (notifyErr) {
        console.warn('Notification warning:', notifyErr);
      }
    }

    Swal.fire({
      icon: 'success',
      title: 'บันทึกรายงานผลตรวจเรียบร้อย!',
      html: `
        <div class="text-xs text-slate-600 space-y-2">
          <div>เลขที่เอกสาร: <strong class="font-mono text-emerald-700">${subNo}</strong></div>
          <div>บริการ: <strong>${srvObj.name}</strong></div>
          ${shouldNotify ? '<div class="text-emerald-600 font-semibold"><i class="fas fa-bell mr-1"></i> ส่งการแจ้งเตือนเรียบร้อยแล้ว</div>' : ''}
        </div>
      `,
      confirmButtonColor: '#059669',
      showDenyButton: true,
      denyButtonText: '<i class="fas fa-print mr-1"></i> ดูใบรายงานผล (PDF)',
      denyButtonColor: '#0284c7'
    }).then((res) => {
      if (res.isDenied) {
        window.open(`report_view.html?id=${encodeURIComponent(savedReport?.id || subNo)}`, '_blank');
      }
      resetReportForm();
      loadReportsTable();
      loadDashboardKPIs();
    });

  } catch (err) {
    console.error('Save report error:', err);
    Swal.fire({
      icon: 'error',
      title: 'บันทึกไม่สำเร็จ',
      text: err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'
    });
  }
}

/**
 * ล้างข้อมูลฟอร์ม
 */
function resetReportForm() {
  document.getElementById('rep-department').value = '';
  document.getElementById('rep-ward-room').value = '';
  document.getElementById('rep-remarks').value = '';
  uploadedAttachments = [];
  document.getElementById('uploaded-files-preview').innerHTML = '';
  isEditingReportId = null;
  loadSubmissionNumber();
  buildDynamicItemsTable(5);
}

/**
 * โหลดตารางรายงานผลตรวจในแท็บ Archive
 */
async function loadReportsTable() {
  const tbody = document.getElementById('archive-reports-tbody');
  if (!tbody) return;

  const search = document.getElementById('archive-search-input')?.value || '';
  const filterService = document.getElementById('archive-filter-service')?.value || '';

  tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-xl mr-2"></i> กำลังโหลดข้อมูลรายงาน...</td></tr>`;

  const { data: reports } = await window.ReportDB.getReports({
    serviceCode: filterService,
    search: search
  });

  if (!reports || reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">ไม่พบรายงานผลตรวจ</td></tr>`;
    return;
  }

  tbody.innerHTML = reports.map((r, idx) => {
    const isPass = ['pass', 'normal', 'no_growth'].includes(r.overall_result?.toLowerCase());
    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
        <td class="p-3 font-mono font-bold text-slate-800">
          <a href="report_view.html?id=${r.id || r.submission_no}" target="_blank" class="text-emerald-700 hover:underline">
            ${r.submission_no}
          </a>
        </td>
        <td class="p-3 font-semibold text-slate-700">${r.service_name}</td>
        <td class="p-3 text-slate-600">${r.department} ${r.ward_room ? `<span class="text-slate-400">(${r.ward_room})</span>` : ''}</td>
        <td class="p-3 text-slate-500">${r.reported_date}</td>
        <td class="p-3">
          <span class="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[11px] ${isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
            <i class="fas ${isPass ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            ${isPass ? 'ผ่านเกณฑ์' : 'ตกเกณฑ์ / พบเชื้อ'}
          </span>
        </td>
        <td class="p-3 text-center">
          ${r.report_pdf_url ? `
            <a href="${r.report_pdf_url}" target="_blank" class="text-rose-600 hover:text-rose-800 font-semibold" title="ดาวน์โหลดไฟล์ PDF">
              <i class="fas fa-file-pdf text-base"></i>
            </a>
          ` : `
            <a href="report_view.html?id=${r.id || r.submission_no}" target="_blank" class="text-slate-400 hover:text-emerald-700" title="ดูใบรายงานผล">
              <i class="fas fa-print text-base"></i>
            </a>
          `}
        </td>
        <td class="p-3 text-right space-x-1">
          <button onclick="previewReportModal('${r.id || r.submission_no}')" class="p-1 text-slate-400 hover:text-slate-700" title="ดูข้อมูล">
            <i class="fas fa-eye"></i>
          </button>
          <button onclick="deleteReportConfirm('${r.id || r.submission_no}')" class="p-1 text-slate-400 hover:text-rose-600" title="ลบรายงาน">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteReportConfirm(reportId) {
  const result = await Swal.fire({
    title: 'ยืนยันการลบรายงานตรวจ?',
    text: 'การลบรายงานผลตรวจนี้จะไม่สามารถกู้คืนได้ตามมาตรฐาน ISO 15189',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ใช่, ลบรายงานนี้',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    const { success, error } = await window.ReportDB.deleteReport(reportId);
    if (success) {
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', text: 'ลบรายงานตรวจเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false });
      loadReportsTable();
      loadDashboardKPIs();
    } else {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: error?.message || 'Database error' });
    }
  }
}

/**
 * โหลดตารางจัดการคิวจองในแท็บ Booking Manager
 */
async function loadBookingsManagerTable() {
  const tbody = document.getElementById('admin-bookings-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-xl mr-2"></i> กำลังโหลดรายการจอง...</td></tr>`;

  const bookings = await window.BookingDB.getAllBookings(50);

  if (!bookings || bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">ยังไม่มีรายการจองคิว</td></tr>`;
    return;
  }

  tbody.innerHTML = bookings.map((b, idx) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
      <td class="p-3 font-bold text-slate-800">${b.booking_date}</td>
      <td class="p-3 font-semibold text-emerald-800">${b.service_name}</td>
      <td class="p-3 text-slate-700">${b.department}</td>
      <td class="p-3 text-slate-600">${b.sender_name} <span class="text-slate-400 font-mono">(${b.contact_number})</span></td>
      <td class="p-3 text-center font-bold text-slate-800">${b.sample_count} ชิ้น</td>
      <td class="p-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : b.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}">
          ${b.status}
        </span>
      </td>
      <td class="p-3 text-right space-x-1">
        <button onclick="convertBookingToReport('${b.id}')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-2 py-1 rounded text-[11px] border border-emerald-200 transition" title="ออกผลตรวจจากคิวนี้">
          <i class="fas fa-file-signature mr-0.5"></i> ออกผลตรวจ
        </button>
        <button onclick="deleteBookingConfirm('${b.id}')" class="p-1 text-slate-400 hover:text-rose-600" title="ยกเลิก/ลบการจอง">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function convertBookingToReport(bookingId) {
  const bookings = await window.BookingDB.getAllBookings();
  const b = bookings.find(item => item.id === bookingId);
  if (!b) return;

  // Switch to Tab 1
  document.querySelector('[data-target="tab-new-report"]')?.click();

  // Populate form fields
  selectedServiceCode = b.service_code || 'AIR_01';
  const sel = document.getElementById('rep-service-select');
  if (sel) sel.value = selectedServiceCode;

  updateServiceFormTheme();
  await loadSubmissionNumber();

  document.getElementById('rep-department').value = b.department;
  document.getElementById('rep-sampler-name').value = b.sender_name;
  document.getElementById('rep-sampling-date').value = b.booking_date;

  const count = parseInt(b.sample_count, 10) || 5;
  buildDynamicItemsTable(Math.min(count, 50));

  Swal.fire({
    icon: 'info',
    title: 'นำเข้าข้อมูลจากคิวจองสำเร็จ',
    text: `กำลังเตรียมฟอร์มออกผลตรวจสำหรับ ${b.department} (${b.service_name})`,
    timer: 2000,
    showConfirmButton: false
  });
}

async function deleteBookingConfirm(bookingId) {
  const res = await Swal.fire({
    title: 'ยืนยันการยกเลิกคิวจอง?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก'
  });

  if (res.isConfirmed) {
    await window.BookingDB.deleteBooking(bookingId);
    loadBookingsManagerTable();
    loadDashboardKPIs();
  }
}

async function loadDashboardKPIs() {
  const stats = await window.ReportDB.getStats();
  const elTot = document.getElementById('adm-kpi-total');
  const elComp = document.getElementById('adm-kpi-completed');
  const elBook = document.getElementById('adm-kpi-bookings');

  if (elTot) elTot.textContent = stats.totalReports;
  if (elComp) elComp.textContent = stats.completedReports;
  if (elBook) elBook.textContent = stats.totalBookings;
}

window.addSingleItemRow = addSingleItemRow;
window.setMultipleRows = setMultipleRows;
window.removeItemRow = removeItemRow;
window.saveReportHandler = saveReportHandler;
window.resetReportForm = resetReportForm;
window.loadReportsTable = loadReportsTable;
window.deleteReportConfirm = deleteReportConfirm;
window.convertBookingToReport = convertBookingToReport;
window.deleteBookingConfirm = deleteBookingConfirm;
window.removeAttachment = removeAttachment;
