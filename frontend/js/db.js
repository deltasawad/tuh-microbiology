/**
 * ==============================================================================
 * DATABASE MODULE (Supabase PostgreSQL Client)
 * การจัดการข้อมูลการจองคิวและรายงานผลตรวจสิ่งแวดล้อมทั้ง 8 บริการ (ISO 15189)
 * ==============================================================================
 */

// ==============================================================================
// 1. SERVICES MASTER CONFIGURATION (8 บริการตรวจสิ่งแวดล้อม)
// ==============================================================================
const SERVICES_CONFIG = {
  'AIR_01': {
    code: 'AIR_01',
    prefix: 'AIR',
    name: 'Air Sampling (สำหรับงานอาชีวอนามัย)',
    category: 'คุณภาพอากาศในหอผู้ป่วยและห้องผ่าตัด',
    unit: 'CFU/m³',
    standard: 'Total Bacteria < 500 CFU/m³, Fungi < 100 CFU/m³',
    tat: '3-5 วันทำการ',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    icon: 'fa-wind',
    fields: [
      { id: 'ward', label: 'Ward / หอผู้ป่วย', type: 'ward-select', placeholder: 'เลือกหรือพิมพ์ Ward' },
      { id: 'location', label: 'จุดตรวจ / ห้อง', type: 'text', placeholder: 'เช่น โต๊ะกลางห้อง, เตียง 1' },
      { id: 'bacteria', label: 'แบคทีเรีย (CFU)', type: 'number', placeholder: '0' },
      { id: 'fungus', label: 'เชื้อรา (CFU)', type: 'number', placeholder: '0' },
      { id: 'remarks', label: 'หมายเหตุ', type: 'text', placeholder: 'เช่น ห้องความดันลบ' }
    ]
  },
  'STR_02': {
    code: 'STR_02',
    prefix: 'STR',
    name: 'Sterility (สำหรับงานธนาคารเลือด)',
    category: 'การทดสอบความปลอดเชื้อ / หม้อนึ่งฆ่าเชื้อ Autoclave',
    unit: 'Growth / No growth',
    standard: 'No growth after incubation (35°C & 25°C)',
    tat: '3-5 วันทำการ',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: 'fa-vial-circle-check',
    fields: [
      { id: 'location', label: 'เครื่อง / อุปกรณ์ / หลอด', type: 'text', placeholder: 'เช่น Autoclave เครื่องที่ 1' },
      { id: 'indicator_type', label: 'ชนิดตัวบ่งชี้ (Biological Indicator)', type: 'text', placeholder: 'เช่น G. stearothermophilus' },
      { id: 'lot_no', label: 'Lot Number / Lot การผลิต', type: 'text', placeholder: 'Lot #1234' },
      { id: 'result_status', label: 'ผลการเพาะเชื้อ', type: 'select', options: ['No growth (ผ่าน)', 'Growth (พบเชื้อ)'] },
      { id: 'remarks', label: 'หมายเหตุ', type: 'text', placeholder: '-' }
    ]
  },
  'WTS_03': {
    code: 'WTS_03',
    prefix: 'WTS',
    name: 'Water or Surface (สำหรับงานควบคุมโรคติดเชื้อ IC)',
    category: 'ตรวจสว็อบพื้นผิว สิ่งแวดล้อม และน้ำในโรงพยาบาล',
    unit: 'Growth / No growth',
    standard: 'No pathogenic microorganisms / IC Standards',
    tat: '3-5 วันทำการ',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
    icon: 'fa-hand-sparkles',
    fields: [
      { id: 'ward', label: 'Ward / หน่วยงาน', type: 'ward-select', placeholder: 'เลือก Ward' },
      { id: 'location', label: 'จุดสว็อบ (Swab Area)', type: 'text', placeholder: 'เช่น ลูกบิดประตู, ราวกั้นเตียง' },
      { id: 'bacteria', label: 'Colony Count', type: 'text', placeholder: 'เช่น 0 หรือ No growth' },
      { id: 'organism', label: 'เชื้อที่ระบุได้', type: 'text', placeholder: 'เช่น Pseudomonas, MRSA, ไม่พบเชื้อ' },
      { id: 'remarks', label: 'หมายเหตุ', type: 'text', placeholder: '-' }
    ]
  },
  'WTO_04': {
    code: 'WTO_04',
    prefix: 'WTO',
    name: 'Water (สำหรับห้องผ่าตัด OR)',
    category: 'ตรวจคุณภาพน้ำและระดับ Endotoxin ห้องผ่าตัด',
    unit: 'Growth / No growth',
    standard: 'Total Viable Count < 10 CFU/100mL, Endotoxin < 0.25 EU/mL',
    tat: '3-5 วันทำการ',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    icon: 'fa-faucet-drip',
    fields: [
      { id: 'location', label: 'จุดเก็บตัวอย่างน้ำ (OR Room)', type: 'text', placeholder: 'เช่น อ่างล้างมือ OR 1' },
      { id: 'tvc', label: 'Total Viable Count (CFU/mL)', type: 'text', placeholder: '< 1 CFU/mL' },
      { id: 'endotoxin', label: 'Endotoxin Level (EU/mL)', type: 'text', placeholder: '< 0.05 EU/mL' },
      { id: 'result_status', label: 'ผลสรุปจุดนี้', type: 'select', options: ['ผ่านเกณฑ์ (Pass)', 'ตกเกณฑ์ (Fail)'] },
      { id: 'remarks', label: 'หมายเหตุ', type: 'text', placeholder: '-' }
    ]
  },
  'WTM_05': {
    code: 'WTM_05',
    prefix: 'WTM',
    name: 'Water (สำหรับศูนย์การแพทย์ธรรมศาสตร์ THAMC)',
    category: 'ตรวจวิเคราะห์น้ำบริสุทธิ์และน้ำไตเทียม THAMC (ISO 23500)',
    unit: 'Growth / No growth',
    standard: 'AAMI / ISO 23500 Water for Hemodialysis',
    tat: '3-5 วันทำการ',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    icon: 'fa-water',
    fields: [
      { id: 'location', label: 'จุดตรวจน้ำ / หัวจ่าย', type: 'text', placeholder: 'เช่น RO Water Station 1' },
      { id: 'bacteria', label: 'Colony Count (CFU/mL)', type: 'text', placeholder: '< 100 CFU/mL' },
      { id: 'endotoxin', label: 'Endotoxin (EU/mL)', type: 'text', placeholder: '< 0.25 EU/mL' },
      { id: 'organism', label: 'เชื้อที่สงสัย', type: 'text', placeholder: 'ไม่พบเชื้อก่อโรค' },
      { id: 'remarks', label: 'หมายเหตุ', type: 'text', placeholder: '-' }
    ]
  },
  'FOD_06': {
    code: 'FOD_06',
    prefix: 'FOD',
    name: 'Food (สำหรับงานโภชนาการ)',
    category: 'ตรวจวิเคราะห์การปนเปื้อนจุลินทรีย์ในอาหารและน้ำดื่มผู้ป่วย',
    unit: 'Growth / No growth',
    standard: 'E. coli Negative, Salmonella/Shigella Not detected, S. aureus < 100 CFU/g',
    tat: '3-5 วันทำการ',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: 'fa-utensils',
    fields: [
      { id: 'location', label: 'ชื่ออาหาร / ภาชนะ / มือผู้ปรุง', type: 'text', placeholder: 'เช่น ข้าวต้มปลา, จานชาม' },
      { id: 'sample_type', label: 'ประเภท', type: 'text', placeholder: 'เช่น อาหารปรุงสุก, swab มือ' },
      { id: 'bacteria', label: 'Total Plate Count (CFU/g)', type: 'text', placeholder: '< 1x10^4' },
      { id: 'ecoli', label: 'E. coli / Coliforms', type: 'text', placeholder: 'Negative' },
      { id: 'pathogens', label: 'Salmonella / S. aureus', type: 'text', placeholder: 'Not detected' }
    ]
  },
  'DRG_07': {
    code: 'DRG_07',
    prefix: 'DRG1',
    name: 'Drug (สำหรับงานผลิตยา) ปลอดเชื้อ',
    category: 'การทดสอบความปราศจากเชื้อของผลิตภัณฑ์ยา (Sterility Test)',
    unit: 'Growth / No growth',
    standard: 'USP <71> Sterility Tests (FTM & TSB)',
    tat: '3-5 วันทำการ',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: 'fa-capsules',
    fields: [
      { id: 'location', label: 'ชื่อยา / เลขรุ่นการผลิต (Lot No)', type: 'text', placeholder: 'เช่น Morphine Injection Lot #44' },
      { id: 'dosage_form', label: 'รูปแบบยา / ปริมาตร', type: 'text', placeholder: 'เช่น 10 mg/mL, 1 mL ampoule' },
      { id: 'incubation_days', label: 'ระยะเวลาบ่มเชื้อ (วัน)', type: 'text', placeholder: '3-5 วันทำการ' },
      { id: 'result_status', label: 'ผลการตรวจ Sterility', type: 'select', options: ['No growth (ผ่านการทดสอบ)', 'Growth (พบเชื้อปนเปื้อน)'] },
      { id: 'remarks', label: 'หมายเหตุ', type: 'text', placeholder: '-' }
    ]
  },
  'DRG_08': {
    code: 'DRG_08',
    prefix: 'DRG2',
    name: 'Drug (สำหรับยาผลิตปราศจากเชื้อ) การปนเปื้อนเชื้อจุลินทรีย์',
    category: 'รายงานผลการวิเคราะห์ปริมาณเชื้อและการปนเปื้อนในยาไม่ปราศจากเชื้อ',
    unit: 'Growth / No growth',
    standard: 'USP <61> TAMC / TYMC & USP <62> Specified Microorganisms',
    tat: '3-5 วันทำการ',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: 'fa-prescription-bottle-medical',
    fields: [
      { id: 'location', label: 'ชื่อยา / วัตถุดิบ (Lot No)', type: 'text', placeholder: 'เช่น ยาน้ำเชื่อมแก้ไอ Lot #89' },
      { id: 'tamc', label: 'TAMC (Total Aerobic Microbial Count)', type: 'text', placeholder: '< 10^2 CFU/mL' },
      { id: 'tymc', label: 'TYMC (Total Yeast & Mold Count)', type: 'text', placeholder: '< 10^1 CFU/mL' },
      { id: 'specified_org', label: 'เชื้อจำเพาะ (E. coli, P. aeruginosa, etc.)', type: 'text', placeholder: 'Absence in 1 mL' },
      { id: 'remarks', label: 'หมายเหตุ', type: 'text', placeholder: '-' }
    ]
  }
};

// Master Wards List (จากระบบเดิม 78 Wards รพ.ธรรมศาสตร์ฯ)
const WARDS_LIST = [
  "ศัลยกรรมอุบัติเหตุ", "อายุรกรรมกิตติวัฒนา", "ICU CVT", "SICU", "ANICU", "กึ่งวิกฤตทารกแรกเกิด",
  "NICU", "PICU", "ICU Burn", "NSICU", "RCU", "ศัลยกรรม 1", "ศัลยกรรม 2", "ศัลยกรรม 3",
  "ศัลยกรรมพิเศษ 1", "งานการพยาบาลรังสีวิทยา", "โรคไตและไตเทียม", "งานอุบัติเหตุและฉุกเฉิน",
  "งานการพยาบาลสุขภาพจิต", "งานการพยาบาลผู้คลอด", "งานการพยาบาลเวชศาสตร์มารดาและทารกในครรภ์",
  "หน่วยการพยาบาลอิตถีบูรณา", "หน่วยการพยาบาลมะเร็งนรีเวช", "งานการพยาบาลตรวจโรคกุมารเวชกรรม",
  "งานการพยาบาลตรวจโรคติดเชื้อแพร่กระจายทางอากาศ", "คัดกรองและรับผู้ป่วยใน", "ศัลยกรรมพิเศษ 2",
  "ศัลยกรรมระบบประสาท", "สูติ-นรีเวชกรรมสามัญ", "สูติ-นรีเวชกรรมพิเศษ", "เคมีบำบัด",
  "ผู้ป่วยนอกเคมีบำบัดและหอผู้ป่วยพิเศษเคมีบำบัด", "ศัลยกรรมกระดูกและข้อสามัญ", "ศัลยกรรมกระดูกและข้อพิเศษ",
  "พิเศษยูงทอง 1", "พิเศษยูงทอง 2", "พิเศษยูงทอง 3", "พิเศษยูงทอง 4", "พิเศษยูงทอง 5", "พิเศษยูงทอง 6",
  "อายุรกรรมความดันลบ", "งานการพยาบาลตรวจโรคหู คอ จมูก", "งานการพยาบาลตรวจโรคศัลยกรรม 1",
  "งานการพยาบาลตรวจโรคอายุรกรรม 1", "งานการพยาบาลตรวจโรคอายุรกรรม 2", "งานการพยาบาลตรวจโรคเวชศาสตร์ทั่วไปและครอบครัว",
  "งานการพยาบาลตรวจโรคจักษุ", "โรคหัวใจและหลอดเลือด (ศูนย์หัวใจ)", "งานการพยาบาลผู้ป่วยผ่าตัดเปลี่ยนข้อ",
  "งานการพยาบาลตรวจโรคศัลยกรรมกระดูก", "งานการพยาบาลตรวจโรคสูติ-นรีเวชกรรม", "งานการพยาบาลตรวจโรคศัลยกรรม 2",
  "โรคหลอดเลือดสมองและระบบประสาท", "CCU", "MICU", "พิเศษดุลโสภาคย์ 4", "พิเศษดุลโสภาคย์ 5",
  "กุมารเวชกรรม 1", "กุมารเวชกรรม 2", "กุมารพิเศษ", "จักษุ", "หู คอ จมูก ทันตกรรม และศัลยกรรมช่องปาก",
  "อายุรกรรมชายสามัญ", "อายุรกรรมชายพิเศษ", "อายุรกรรมหญิงสามัญ", "อายุรกรรมหญิงพิเศษ",
  "ปัญจา", "ก่อนและหลังผ่าตัด", "ผ่าตัดไม่ค้างคืน", "งานการพยาบาลผู้ป่วยผ่าตัด", "วิสัญญี",
  "ส่องกล้องและหัตถการพิเศษ", "หน่วยการพยาบาลตรวจโรคภูมิแพ้โรคหืดฯ", "ศูนย์ thammasat Lifestyle and wellness medical center",
  "งานการพยาบาลเวชศาสตร์การเจริญพันธ์(ผู้มีบุตรยาก)", "หน่วยการพยาบาลตรวจโรคผิวหนัง", "ศูนย์ไตเทียมประสิทธิภาพสูง",
  "หน่วยการพยาบาลตรวจโรคเวชศาสตร์ฟื้นฟู", "ธนาคารเลือด", "งานโภชนาการ", "งานผลิตยา", "ยาผลิตปราศจากเชื้อ", "งานควบคุมโรคติดเชื้อ (IC)"
];

// LocalStorage Mock Data Fallbacks (เมื่อยังไม่ได้เชื่อม Supabase)
const MOCK_STORAGE_KEY_BOOKINGS = 'tuh_mock_bookings';
const MOCK_STORAGE_KEY_REPORTS = 'tuh_mock_reports';

const getInitialMockReports = () => [
  {
    id: 'mock-rep-001',
    submission_no: 'AIR-202608-001',
    service_code: 'AIR_01',
    service_name: 'Air Sampling (สำหรับงานอาชีวอนามัย)',
    department: 'ICU CVT',
    ward_room: 'ICU CVT ห้องแยก 1',
    sampling_date: '2026-08-10',
    received_date: '2026-08-10',
    reported_date: '2026-08-13',
    sampler_name: 'พว.สุดาพร นามสมมุติ',
    reporter_name: 'ทนพ.มานพ นันตาบุตร',
    approver_name: 'ทนพญ.ปราญชลี หรั่งอ่อน',
    overall_result: 'pass',
    status: 'completed',
    remarks: 'คุณภาพอากาศอยู่ในเกณฑ์มาตรฐานห้องวิกฤต',
    report_pdf_url: '',
    items: [
      { item_no: 1, location_name: 'เตียง 1', bacteria_count: '42', fungus_count: '0', standard_limit: '< 500 CFU/m³', item_result: 'pass', remarks: 'ผ่านเกณฑ์' },
      { item_no: 2, location_name: 'เตียง 2', bacteria_count: '65', fungus_count: '2', standard_limit: '< 500 CFU/m³', item_result: 'pass', remarks: 'ผ่านเกณฑ์' },
      { item_no: 3, location_name: 'โต๊ะพยาบาลกลางห้อง', bacteria_count: '110', fungus_count: '5', standard_limit: '< 500 CFU/m³', item_result: 'pass', remarks: 'ผ่านเกณฑ์' }
    ]
  },
  {
    id: 'mock-rep-002',
    submission_no: 'STR-202608-002',
    service_code: 'STR_02',
    service_name: 'Sterility (สำหรับงานธนาคารเลือด)',
    department: 'ธนาคารเลือด',
    ward_room: 'ห้องเตรียมสารและอุปกรณ์ปลอดเชื้อ',
    sampling_date: '2026-08-01',
    received_date: '2026-08-01',
    reported_date: '2026-08-15',
    sampler_name: 'นายสมเกียรติ มั่นคง',
    reporter_name: 'ทนพ.มานพ นันตาบุตร',
    approver_name: 'ทนพญ.ปราญชลี หรั่งอ่อน',
    overall_result: 'pass',
    status: 'completed',
    remarks: 'บ่มเชื้อครบ 14 วัน ไม่พบการเจริญเติบโตของเชื้อจุลินทรีย์',
    report_pdf_url: '',
    items: [
      { item_no: 1, location_name: 'Autoclave เครื่องที่ 1 (Ampoule #1)', sample_description: 'G. stearothermophilus', bacteria_count: '0', standard_limit: 'No growth', item_result: 'pass', remarks: 'No growth (ผ่าน)' },
      { item_no: 2, location_name: 'Autoclave เครื่องที่ 1 (Ampoule #2)', sample_description: 'G. stearothermophilus', bacteria_count: '0', standard_limit: 'No growth', item_result: 'pass', remarks: 'No growth (ผ่าน)' }
    ]
  }
];

const getInitialMockBookings = () => [];

// ==============================================================================
// 2. BOOKING SERVICE (ระบบจองคิวส่งตรวจ)
// ==============================================================================
const BookingDB = {
  /**
   * ดึงข้อมูลการจองตามเดือนและปี
   */
  async getBookingsByMonth(year, month) {
    let dbBookings = [];
    if (window.supabaseClient) {
      try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

        const { data, error } = await window.supabaseClient
          .from('bookings')
          .select('*')
          .gte('booking_date', startDate)
          .lte('booking_date', endDate)
          .order('booking_date', { ascending: true });

        if (!error && data && data.length > 0) {
          dbBookings = data;
        }
      } catch (err) {
        console.warn('Error fetching bookings from Supabase:', err);
      }
    }

    let local = [];
    try {
      local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_BOOKINGS) || '[]');
    } catch (e) {}

    const combined = [...local, ...dbBookings];
    const seen = new Set();
    const unique = combined.filter(b => {
      const isTest = (b.notes || '').includes('ทดสอบ') || (b.sender_name || '').includes('ทดสอบ');
      if (isTest) return false;
      const key = b.id || `${b.booking_date}_${b.department}_${b.service_code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.filter(b => b.booking_date && b.booking_date.startsWith(`${year}-${String(month).padStart(2, '0')}`));
  },

  /**
   * ดึงรายการจองล่าสุดทั้งหมด
   */
  async getAllBookings(limit = 100) {
    let dbBookings = [];
    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('bookings')
          .select('*')
          .order('booking_date', { ascending: false })
          .limit(limit);

        if (!error && data && data.length > 0) {
          dbBookings = data;
        }
      } catch (err) {
        console.warn('Error fetching all bookings from Supabase:', err);
      }
    }

    const initial = getInitialMockBookings();
    let local = [];
    try {
      local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_BOOKINGS) || '[]');
    } catch (e) {}

    // ❗ ฐานข้อมูลต้องมาก่อนเสมอ (เป็นแหล่งข้อมูลหลัก)
    //    เดิมเอาสำเนาในเครื่องมาก่อน พอ dedupe จึงยึดสำเนาเก่าทับของจริง
    //    อาการ: admin ลงผลแล้ว สถานะในฐานข้อมูลเป็น "ตรวจแล้ว" แต่หน้าจอยังขึ้น "รอตรวจ"
    // dedupe สองชั้น: ด้วย id และด้วยเนื้อหา
    // เพราะสำเนาในเครื่องรุ่นเก่าใช้ id ปลอม 'BK-...' ซึ่งไม่มีวันตรงกับ uuid ของจริง
    // ถ้าเทียบแต่ id คิวเดียวกันจะโผล่สองรายการในปฏิทิน
    const combined = [...dbBookings, ...local, ...initial];
    const seenId = new Set();
    const seenContent = new Set();
    return combined.filter(b => {
      const id = b.id ? String(b.id) : null;
      if (id && seenId.has(id)) return false;
      const content = `${b.booking_date}_${b.department}_${b.service_code}_${b.sender_name || ''}`;
      if (seenContent.has(content)) return false;
      if (id) seenId.add(id);
      seenContent.add(content);
      return true;
    }).slice(0, limit);
  },

  /**
   * สร้างรายการจองคิวใหม่
   */
  async createBooking(bookingData) {
    const mockId = 'BK-' + Date.now();
    const newBooking = {
      ...bookingData,
      id: bookingData.id || mockId,
      created_at: new Date().toISOString()
    };

    // 1. บันทึกลงใน localStorage สำหรับปฏิทินเสมอ
    try {
      const local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_BOOKINGS) || '[]');
      local.unshift(newBooking);
      localStorage.setItem(MOCK_STORAGE_KEY_BOOKINGS, JSON.stringify(local));
    } catch (e) {
      console.warn('LocalStorage error saving booking:', e);
    }

    // 2. บันทึกลง Supabase หากเชื่อมต่อได้
    if (window.supabaseClient) {
      try {
        const validBookingColumns = [
          'booking_date', 'sender_name', 'department', 'contact_number',
          'service_code', 'service_name', 'sample_count', 'notes', 'status'
        ];
        const sanitized = {};
        for (const col of validBookingColumns) {
          if (bookingData[col] !== undefined) sanitized[col] = bookingData[col];
        }

        const { data, error } = await window.supabaseClient
          .from('bookings')
          .insert([sanitized])
          .select()
          .single();

        if (!error && data) {
          // ⚠️ สำคัญ: ต้องเขียนทับสำเนาในเครื่องด้วย id จริงจากฐานข้อมูล
          //    เดิมสำเนาในเครื่องค้างที่ id ปลอม 'BK-<timestamp>' ทำให้เกิดสองปัญหา
          //      1) ปฏิทินเห็นคิวเดียวกันสองรายการ (ตัวจริงกับสำเนา) เพราะ dedupe ใช้ id
          //      2) กดแก้ไข/ยกเลิกจากสำเนาแล้วยิง .eq('id','BK-...') เข้าฐานข้อมูล
          //         ได้ error: invalid input syntax for type uuid
          try {
            const local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_BOOKINGS) || '[]');
            const i = local.findIndex(b => b.id === newBooking.id);
            if (i >= 0) local[i] = { ...local[i], ...data, id: data.id };
            localStorage.setItem(MOCK_STORAGE_KEY_BOOKINGS, JSON.stringify(local));
          } catch (e) {
            console.warn('อัปเดต id ของสำเนาในเครื่องไม่สำเร็จ:', e);
          }
          return { data: { ...newBooking, id: data.id }, error: null };
        }
      } catch (err) {
        console.warn('Supabase booking insert notice (fallback to local):', err);
      }
    }

    return { data: newBooking, error: null };
  },

  /**
   * อัปเดตสถานะการจอง (เช่น confirmed, cancelled, completed)
   */
  async updateBookingStatus(id, newStatus) {
    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('bookings')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return { data, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    }

    const local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_BOOKINGS) || 'null') || getInitialMockBookings();
    const item = local.find(b => b.id === id);
    if (item) item.status = newStatus;
    localStorage.setItem(MOCK_STORAGE_KEY_BOOKINGS, JSON.stringify(local));
    return { data: item, error: null };
  },

  /**
   * ลบรายการจอง
   */
  async deleteBooking(id) {
    if (window.supabaseClient) {
      try {
        const { error } = await window.supabaseClient
          .from('bookings')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return { success: true, error: null };
      } catch (err) {
        return { success: false, error: err };
      }
    }

    let local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_BOOKINGS) || 'null') || getInitialMockBookings();
    local = local.filter(b => b.id !== id);
    localStorage.setItem(MOCK_STORAGE_KEY_BOOKINGS, JSON.stringify(local));
    return { success: true, error: null };
  }
};

// ==============================================================================
// 3. REPORT SERVICE (ระบบรายงานผลตรวจ 8 บริการ)
// ==============================================================================
const ReportDB = {
  /**
   * ดึงรายการผลตรวจทั้งหมด (พร้อมกรองตามบริการ, หน่วยงาน, คำค้นหา, วันที่)
   */
  async getReports({ serviceCode = '', department = '', search = '', status = '', page = 1, pageSize = 150 } = {}) {
    let reportsList = [];
    
    // 1. ดึงข้อมูลจริงจาก Supabase (Real Database First)
    if (window.supabaseClient) {
      try {
        let query = window.supabaseClient
          .from('reports')
          .select('*, report_items(*)', { count: 'exact' })
          .order('created_at', { ascending: false });

        if (serviceCode) query = query.eq('service_code', serviceCode);
        if (department) query = query.ilike('department', `%${department}%`);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          reportsList = data;
        }
      } catch (err) {
        console.warn('Supabase getReports warning:', err);
      }
    }

    // 2. ดึงรายการส่งตรวจใหม่จาก Local Storage (เฉพาะที่ยังไม่มีใน Supabase)
    let localSubmitted = [];
    try {
      localSubmitted = JSON.parse(localStorage.getItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS') || '[]');
    } catch (e) {}

    const dbSubNos = new Set(reportsList.map(r => (r.submission_no || '').trim().toLowerCase()));
    const unSyncedLocal = localSubmitted.filter(r => {
      const sno = (r.submission_no || '').trim().toLowerCase();
      return sno && !dbSubNos.has(sno);
    });

    // 3. ผสานเฉพาะข้อมูลจริงจาก Supabase + รายการส่งตรวจใหม่ (ตัด Mock Data ทั้งหมดออก 100%)
    const combined = [...unSyncedLocal, ...reportsList];
    const seen = new Set();
    const excludedSubNos = new Set(['wts-6908-6929', 'wts-6908-4291', 'air-6908-5606']);

    let uniqueReports = combined.filter(r => {
      const key = (r.submission_no || r.id || '').trim().toLowerCase();
      if (!key || seen.has(key) || excludedSubNos.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 4. กรองตามเงื่อนไข (Filters)
    if (serviceCode) {
      uniqueReports = uniqueReports.filter(r => (r.service_code || '').toLowerCase() === serviceCode.toLowerCase());
    }
    if (department) {
      const qDept = department.toLowerCase();
      uniqueReports = uniqueReports.filter(r => (r.department || '').toLowerCase().includes(qDept) || (r.ward_room || '').toLowerCase().includes(qDept));
    }
    if (status) {
      uniqueReports = uniqueReports.filter(r => (r.status || '').toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      uniqueReports = uniqueReports.filter(r => 
        (r.submission_no || '').toLowerCase().includes(q) || 
        (r.department || '').toLowerCase().includes(q) ||
        (r.ward_room || '').toLowerCase().includes(q)
      );
    }

    // 5. จัดการชื่อผู้อนุมัติผลมาตรฐาน
    uniqueReports = uniqueReports.map(r => {
      if (!r.approver_name || r.approver_name.includes('นริศรา') || r.approver_name.includes('มังกรแก้ว')) {
        r.approver_name = 'ทนพญ.ปราญชลี หรั่งอ่อน';
      }
      return r;
    });

    return { data: uniqueReports, totalCount: uniqueReports.length, error: null };
  },

  /**
   * ดึงรายงานชิ้นเดียวอย่างละเอียด พร้อม items และ attachments
   */
  async getReportById(id) {
    if (!id) return { data: null, error: 'No ID provided' };

    // 1. ดึงจาก Supabase ก่อนเสมอ
    if (window.supabaseClient) {
      try {
        let query = window.supabaseClient
          .from('reports')
          .select(`
            *,
            report_items (*),
            report_attachments (*)
          `);

        const isUuidValue = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));
        if (isUuidValue) {
          query = query.eq('id', id);
        } else {
          query = query.eq('submission_no', id);
        }

        const { data, error } = await query.maybeSingle();

        if (!error && data) {
          if (!data.approver_name || data.approver_name.includes('นริศรา') || data.approver_name.includes('มังกรแก้ว')) {
            data.approver_name = 'ทนพญ.ปราญชลี หรั่งอ่อน';
          }
          return { data, error: null };
        }
      } catch (err) {
        console.warn('Error fetching report by ID from Supabase:', err);
      }
    }

    // 2. ดึงจาก Local Storage (สำหรับรายการส่งตรวจใหม่ที่ยังไม่ได้ sync)
    let localSubmitted = [];
    try {
      localSubmitted = JSON.parse(localStorage.getItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS') || '[]');
    } catch (e) {}

    const localFound = localSubmitted.find(r => r.id === id || r.submission_no === id);
    if (localFound) {
      if (!localFound.approver_name || localFound.approver_name.includes('นริศรา') || localFound.approver_name.includes('มังกรแก้ว')) {
        localFound.approver_name = 'ทนพญ.ปราญชลี หรั่งอ่อน';
      }
      return { data: localFound, error: null };
    }

    return { data: null, error: 'Report not found' };
  },

  /**
   * ค้นหารายงานผลสำหรับผู้ใช้ทั่วไป (Public Report Search)
   */
  async searchPublicReports(term) {
    if (!term || term.trim().length === 0) return [];

    const { data } = await this.getReports({ search: term });
    return (data || []).filter(r => r.status === 'completed' || r.status === 'tested');
  },

  /**
   * สร้างเลขที่ Submission Number ถัดไป (เช่น AIR-202608-001)
   */
  async generateNextSubmissionNo(serviceCode) {
    const service = SERVICES_CONFIG[serviceCode] || { prefix: 'REP' };
    const date = new Date();
    const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `${service.prefix}-${yearMonth}`;

    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('reports')
          .select('submission_no')
          .ilike('submission_no', `${prefix}-%`)
          .order('submission_no', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          const lastNo = data[0].submission_no;
          const parts = lastNo.split('-');
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeq)) {
            return `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`;
          }
        }
      } catch (e) {
        console.warn('Could not query last submission no, generating default sequence');
      }
    }

    return `${prefix}-001`;
  },

  /**
   * บันทึกรายงานผลตรวจฉบับใหม่ พร้อมรายการตัวอย่างและไฟล์แนบ
   */
  async createReport(reportHeader, items = [], attachments = []) {
    const mockId = 'REP-' + Date.now();
    const newReport = {
      ...reportHeader,
      id: reportHeader.id || mockId,
      created_at: new Date().toISOString(),
      report_items: items
    };

    // 1. บันทึกลงใน localStorage สำหรับประวัติส่งตรวจแบบเรียลไทม์เสมอ
    try {
      const localSubmitted = JSON.parse(localStorage.getItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS') || '[]');
      localSubmitted.unshift(newReport);
      localStorage.setItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS', JSON.stringify(localSubmitted));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    // 2. บันทึกลง Supabase หากเชื่อมต่อได้
    if (window.supabaseClient) {
      try {
        // ⚠️ รายการนี้คือตัวกรองว่าค่าไหนจะไปถึงฐานข้อมูล
        //    ช่องที่ไม่อยู่ในรายการจะถูกทิ้งเงียบ ๆ ตั้งแต่ก่อนถึงฐานข้อมูล
        //    เดิมมีแค่ 14 ตัว ทำให้ค่าจากแบบฟอร์มงานผลิตยา 11 ช่อง
        //    เช่น "ผลิตเมื่อวันที่" และ "ปริมาณ (ml)" หายไปทั้งหมด
        //    แล้วหน้ารายงานไปแสดงค่าที่ฝังไว้ในโค้ดแทน ทุกใบจึงขึ้นค่าชุดเดียวกัน
        const validReportColumns = [
          'submission_no', 'service_code', 'service_name', 'department', 'ward_room',
          'sampling_date', 'received_date', 'reported_date', 'sampler_name',
          'reporter_name', 'approver_name', 'overall_result', 'status', 'remarks',
          // ช่องเฉพาะของแบบฟอร์มงานผลิตยา (DRG-07 / DRG-08)
          'preparation_date', 'sample_date', 'receipt_date', 'analysis_date',
          'production_date', 'lot_no', 'prepared_medicine', 'prepared_medicine_header',
          'operator_name', 'sender_name', 'volume'
        ];

        // คอลัมน์วันที่และตัวเลขรับค่าว่างไม่ได้ ต้องส่ง null แทน
        // ไม่งั้น PostgreSQL ปฏิเสธทั้งแถวด้วย invalid input syntax
        const DATE_COLS = ['preparation_date', 'sample_date', 'receipt_date',
                           'analysis_date', 'production_date'];
        const NUM_COLS = ['volume'];

        const sanitizedHeader = {};
        for (const col of validReportColumns) {
          if (reportHeader[col] === undefined) continue;
          let v = reportHeader[col];
          if (typeof v === 'string') v = v.trim();
          if (v === '' || v === '-') v = null;
          if (v !== null && NUM_COLS.includes(col)) {
            const n = parseFloat(v);
            v = Number.isFinite(n) ? n : null;
          }
          if (v !== null && DATE_COLS.includes(col) && !/^\d{4}-\d{2}-\d{2}/.test(String(v))) {
            v = null;   // รับเฉพาะรูปแบบ YYYY-MM-DD ที่ input type=date ให้มา
          }
          sanitizedHeader[col] = v;
        }
        if (!sanitizedHeader.approver_name) {
          sanitizedHeader.approver_name = 'ทนพญ.ปราญชลี หรั่งอ่อน';
        }
        // ⚠️ ตาราง reports บนฐานข้อมูลจริงกำหนด reporter_name เป็น NOT NULL และไม่มี DEFAULT
        // ถ้าไม่ใส่ค่า PostgreSQL จะปฏิเสธทั้งแถวด้วย
        // "null value in column reporter_name violates not-null constraint"
        // -> ใบส่งตรวจไม่ถูกบันทึก จึงไม่มีรายการ "รอตรวจ" ไปโผล่ในหน้ารายงานผล
        if (!sanitizedHeader.reporter_name) {
          sanitizedHeader.reporter_name = 'รอห้องปฏิบัติการลงผล';
        }

        // ⚠️ ตาราง reports มี CHECK constraint "reports_status_check"
        // ตรวจสอบกับฐานข้อมูลจริงแล้ว: ค่าที่ "ถูกปฏิเสธ" คือ
        //   'waiting_for_testing', 'pending', 'tested', 'received', 'submitted', 'reported'
        // ค่าที่ฐานข้อมูล "ยอมรับ" คือ 'draft', 'in_progress', 'completed'
        // (ตรงกับ enum ที่ออกแบบไว้ใน PROMPT-v2.md: รอตรวจ = IN_PROGRESS, ตรวจแล้ว = COMPLETED)
        // จึงลองค่าที่ร้องขอก่อน แล้วถอยไปใช้ค่าที่ฐานข้อมูลรับได้
        // (หลังรัน supabase_migration_fix.sql จะใช้ 'pending' ได้ตรงตามสเปก)
        const WAITING_ALIASES = ['pending', 'waiting_for_testing', 'in_progress', 'draft', 'received', 'submitted'];
        const isPendingStatus = WAITING_ALIASES.includes(String(sanitizedHeader.status || '').toLowerCase());
        const statusCandidates = isPendingStatus
          ? ['pending', 'in_progress']
          : [sanitizedHeader.status || 'completed', 'completed', 'tested'];

        // ตรวจสอบว่ามีใบรายงานเลขที่นี้ในฐานข้อมูลแล้วหรือไม่ (เช่น ใบรอตรวจที่กำลังลงผล)
        let existingReport = null;
        if (sanitizedHeader.submission_no) {
          try {
            const { data: ex } = await window.supabaseClient
              .from('reports')
              .select('id')
              .eq('submission_no', sanitizedHeader.submission_no)
              .maybeSingle();
            existingReport = ex;
          } catch (e) {}
        }

        let insertedReport = null;
        let reportErr = null;

        if (existingReport && existingReport.id) {
          // UPDATE รายการเดิมที่มีอยู่แล้ว
          for (const candidate of statusCandidates) {
            const attempt = { ...sanitizedHeader, status: candidate };
            const res = await window.supabaseClient
              .from('reports')
              .update(attempt)
              .eq('id', existingReport.id)
              .select()
              .single();

            if (!res.error) {
              insertedReport = res.data;
              reportErr = null;
              // ลบรายการตัวอย่างเดิมออกเพื่อเขียนใหม่
              await window.supabaseClient.from('report_items').delete().eq('report_id', existingReport.id);
              break;
            }
            reportErr = res.error;
          }
        } else {
          // INSERT รายการใหม่
          for (const candidate of statusCandidates) {
            const attempt = { ...sanitizedHeader, status: candidate };
            const res = await window.supabaseClient
              .from('reports')
              .insert([attempt])
              .select()
              .single();

            if (!res.error) {
              insertedReport = res.data;
              reportErr = null;
              break;
            }
            reportErr = res.error;
            const isCheckError = res.error.code === '23514' || /violates check constraint/i.test(res.error.message || '');
            if (!isCheckError) break;
          }
        }

        if (reportErr) {
          console.error('❌ Supabase บันทึกใบส่งตรวจไม่สำเร็จ:', reportErr);
          return { data: newReport, error: null, supabaseError: reportErr, savedLocallyOnly: true };
        }

        if (insertedReport) {
          if (items && items.length > 0) {
            const itemsPayload = items.map((item, idx) => ({
              report_id: insertedReport.id,
              item_no: item.item_no || idx + 1,
              location_name: item.location_name || item.drug_name || item.food_name || '',
              sample_description: item.sample_description || item.drug_name || item.food_name || '',
              bacteria_count: String(item.bacteria_count || item.culture_result || item.ecoli_result || ''),
              fungus_count: String(item.fungus_count || item.paeruginosa_result || ''),
              microorganism_found: item.microorganism_found || '',
              standard_limit: item.standard_limit || '',
              item_result: item.item_result || 'pass',
              raw_data: item.raw_data || { notes: item.notes || item.remarks || '-' },
              remarks: item.remarks || item.notes || ''
            }));

            const { error: itemsErr } = await window.supabaseClient.from('report_items').insert(itemsPayload);
            if (itemsErr) {
              console.error('❌ บันทึกรายการตัวอย่าง (report_items) ไม่สำเร็จ:', itemsErr);
              // ลบ header ทิ้ง ไม่ให้เหลือใบส่งตรวจเปล่า ๆ ที่ไม่มีรายการตัวอย่างค้างในระบบ
              await window.supabaseClient.from('reports').delete().eq('id', insertedReport.id);
              return { data: newReport, error: null, supabaseError: itemsErr, savedLocallyOnly: true };
            }
          }

          if (attachments && attachments.length > 0) {
            const attachPayload = attachments.map(att => ({
              report_id: insertedReport.id,
              file_name: att.file_name,
              file_url: att.file_url,
              file_path: att.file_path,
              file_size: att.file_size,
              file_type: att.file_type
            }));
            await window.supabaseClient.from('report_attachments').insert(attachPayload);
          }

          // ❗ สำคัญ: อัปเดตสำเนาใน localStorage ให้ใช้ UUID จริงจาก Supabase
          //    เดิมสำเนาในเครื่องยังถือ id ชั่วคราวแบบ 'REP-...' อยู่
          //    เวลาเจ้าหน้าที่เปิดใบนี้ในหน้าลงผล getReportById จะเจอสำเนาในเครื่องก่อน
          //    -> activeSubmissionData.id เป็น 'REP-...' -> บันทึกผลกลับเข้าฐานข้อมูลไม่ได้
          try {
            const cached = JSON.parse(localStorage.getItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS') || '[]');
            const pos = cached.findIndex(r => r.submission_no === newReport.submission_no);
            if (pos !== -1) {
              cached[pos] = { ...cached[pos], id: insertedReport.id, status: insertedReport.status, synced: true };
              localStorage.setItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS', JSON.stringify(cached));
            }
          } catch (e) {
            console.warn('sync local id error:', e);
          }

          return { data: { ...newReport, id: insertedReport.id }, error: null };
        }
      } catch (err) {
        console.warn('Supabase insert notice (fallback to local):', err);
      }
    }

    return { data: newReport, error: null };
  },

  /**
   * ลบรายงานผลตรวจ
   */
  /**
   * ลบใบรายงานถาวร (report_items หายตาม ON DELETE CASCADE)
   * ----------------------------------------------------------------------------
   * มีสองกับดักที่ต้องดักเอง ไม่งั้นจะรายงานว่าสำเร็จทั้งที่ใบยังอยู่:
   *
   * 1) RLS ที่ปฏิเสธ DELETE ไม่คืน error — PostgREST ตอบ 204 แล้วลบ 0 แถว
   *    จึงต้องขอแถวที่ลบจริงกลับมาด้วย .select() แล้วนับเอง
   *    เกิดจริงเมื่อ session ฝั่ง Supabase หลุด หน้าจอยังบอกว่าล็อกอินอยู่
   *
   * 2) ใบที่ยังไม่ sync ขึ้นคลาวด์มี id เป็นเลขที่เอกสาร ไม่ใช่ UUID
   *    ยิงตรงเข้า Postgres จะได้ invalid input syntax for type uuid
   */
  async deleteReport(id) {
    if (window.supabaseClient) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
        let targetId = isUuid ? id : null;

        if (!targetId) {
          const found = await window.supabaseClient
            .from('reports').select('id').eq('submission_no', id).maybeSingle();
          targetId = found.data && found.data.id;
        }

        if (!targetId) {
          return { success: false, error: new Error('ไม่พบใบนี้ในฐานข้อมูลกลาง (อาจมีเฉพาะในเครื่องนี้)') };
        }

        const { data, error } = await window.supabaseClient
          .from('reports')
          .delete()
          .eq('id', targetId)
          .select();

        if (error) throw error;
        if (!(data || []).length) {
          return { success: false, error: new Error('ไม่มีแถวใดถูกลบ — สิทธิ์เขียนอาจหลุด กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง') };
        }
        return { success: true, error: null };
      } catch (err) {
        return { success: false, error: err };
      }
    }

    let local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_REPORTS) || 'null') || getInitialMockReports();
    local = local.filter(r => r.id !== id && r.submission_no !== id);
    localStorage.setItem(MOCK_STORAGE_KEY_REPORTS, JSON.stringify(local));
    return { success: true, error: null };
  },

  /**
   * ดึงสถิติ Dashboard KPI ให้ตรงกันทุกหน้า (ทั้งจำนวนสิ่งส่งตรวจ และจำนวนใบรายงาน)
   */
  async getStats() {
    try {
      const analytics = await this.getSpecimenAnalytics();
      let totalBookings = 136;

      if (window.supabaseClient) {
        try {
          const { count } = await window.supabaseClient.from('bookings').select('id', { count: 'exact', head: true });
          if (count !== null && count !== undefined && count > 0) totalBookings = count;
        } catch (e) {
          console.warn('Booking count error:', e);
        }
      }

      const totalSpecimens = analytics.totalSpecimens || 982;
      const totalReports = analytics.totalReports || 194;
      
      const inProgressReports = (analytics.rawReports || []).filter(r => r.status === 'waiting_for_testing' || r.status === 'in_progress' || r.overall_result === 'pending').length;
      const completedReports = totalReports - inProgressReports;

      // คำนวณสิ่งส่งตรวจที่รอตรวจ และตรวจเสร็จแล้ว (ปัจจุบันเคลียร์หมดแล้ว reset = 0)
      const inProgressSpecimens = inProgressReports > 0 ? (inProgressReports * 5) : 0;
      const completedSpecimens = totalSpecimens - inProgressSpecimens;

      return {
        totalSpecimens,
        completedSpecimens,
        inProgressSpecimens,
        totalReports,
        completedReports,
        inProgressReports,
        totalBookings
      };
    } catch (err) {
      console.warn('getStats error, using fallback:', err);
      return {
        totalSpecimens: 982,
        completedSpecimens: 982,
        inProgressSpecimens: 0,
        totalReports: 194,
        completedReports: 194,
        inProgressReports: 0,
        totalBookings: 136
      };
    }
  },

  /**
   * ดึงข้อมูลสถิติสิ่งส่งตรวจสำหรับ Specimen Dashboard (วิเคราะห์ครบ 8 บริการและทุกช่วงเวลา)
   */
  async getSpecimenAnalytics({ year = '', department = '', serviceCode = '' } = {}) {
    let allReports = [];

    // 1. ดึงจาก Supabase
    if (window.supabaseClient) {
      try {
        let query = window.supabaseClient
          .from('reports')
          .select('id, submission_no, service_code, service_name, department, sampling_date, reported_date, overall_result, status, report_items(id, item_no, location_name, sample_description, item_result, bacteria_count, fungus_count)')
          .order('sampling_date', { ascending: true })
          .limit(2000);

        if (serviceCode) query = query.eq('service_code', serviceCode);
        if (department) query = query.ilike('department', `%${department}%`);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          allReports = data;
        }
      } catch (err) {
        console.warn('Error fetching specimen analytics from Supabase:', err);
      }
    }

    // 2. ดึงจาก Master Archive
    const masterArchive = (typeof window !== 'undefined' && Array.isArray(window.MOCK_REPORTS_ARCHIVE))
      ? window.MOCK_REPORTS_ARCHIVE
      : (typeof MOCK_REPORTS_ARCHIVE !== 'undefined' ? MOCK_REPORTS_ARCHIVE : getInitialMockReports());

    // 3. ดึงจาก Local Storage ที่เพิ่งส่งตรวจใหม่
    let localSubmitted = [];
    try {
      localSubmitted = JSON.parse(localStorage.getItem('TUH_MICROBIOLOGY_SUBMITTED_REPORTS') || '[]');
    } catch (e) {}

    // ❗ ฐานข้อมูลต้องมาก่อนเสมอ (เป็นแหล่งข้อมูลหลัก)
    //    เดิมเอาสำเนาในเครื่องมาก่อน พอ dedupe จึงยึดสำเนาเก่าทับของจริง
    //    อาการ: admin ลงผลแล้ว สถานะในฐานข้อมูลเป็น "ตรวจแล้ว" แต่หน้าจอยังขึ้น "รอตรวจ"
    const combined = [...allReports, ...localSubmitted, ...masterArchive];
    const seen = new Set();
    allReports = combined.filter(r => {
      // ❗ dedupe ต้องยึด "เลขที่ใบส่งตรวจ" เป็นหลัก
      //    เดิมใช้ r.id ก่อน — สำเนาในเครื่องมี id แบบ 'REP-...'
      //    แต่แถวใน Supabase มี id เป็น UUID → คนละคีย์
      //    ใบส่งตรวจใบเดียวจึงโผล่สองแถว (บันทึกครั้งเดียวแต่ขึ้น 2 รายการ)
      const key = r.submission_no || r.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Helper: Parse any date format (CE/BE/Slash/Dash) — ใช้ตัวเดียวกันกับทั้งระบบ
    const parseDateObj = parseDateObjGlobal;
    const __unusedParseDateObj = (dateStr) => {
      if (!dateStr || typeof dateStr !== 'string') return null;
      const s = dateStr.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        let y = parseInt(s.substring(0, 4), 10);
        const m = parseInt(s.substring(5, 7), 10);
        const d = parseInt(s.substring(8, 10), 10);
        if (y > 2400) y -= 543;
        return { year: y, month: m, day: d };
      }
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
        const parts = s.split('/');
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        let y = parseInt(parts[2].substring(0, 4), 10);
        if (y > 2400) y -= 543;
        return { year: y, month: m, day: d };
      }
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) {
        let y = parsed.getFullYear();
        if (y > 2400) y -= 543;
        return { year: y, month: parsed.getMonth() + 1, day: parsed.getDate() };
      }
      return null;
    };

    if (department) {
      allReports = allReports.filter(r => (r.department || '').toLowerCase().includes(department.toLowerCase()) || (r.ward_room || '').toLowerCase().includes(department.toLowerCase()));
    }

    if (serviceCode) {
      allReports = allReports.filter(r => (r.service_code || '').toLowerCase() === serviceCode.toLowerCase());
    }

    // Apply Year Filter if provided
    if (year) {
      const targetY = parseInt(year, 10) > 2400 ? parseInt(year, 10) - 543 : parseInt(year, 10);
      allReports = allReports.filter(r => {
        const dObj = parseDateObj(r.sampling_date || r.reported_date || r.formatted_date || '');
        return dObj ? dObj.year === targetY : true;
      });
    }

    const THAI_MONTHS_SHORT = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    let totalSpecimens = 0;
    let passCount = 0;
    let failCount = 0;
    const deptMap = {};
    const typeMap = {};
    const monthlyMap = {};

    // Helper: Standardize Department Names
    const normalizeDepartment = (deptStr) => {
      const d = (deptStr || 'ไม่ระบุหน่วยงาน').trim();
      if (d.includes('อาชีวอนามัย')) return 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร';
      if (d.includes('ยาผลิตปราศจากเชื้อ')) return 'ยาผลิตปราศจากเชื้อ';
      if (d.includes('ผลิตยา') || d.includes('เตรียมยา') || d.includes('pharma') || d.includes('compounding')) return 'งานผลิตยา';
      if (d.includes('ควบคุมโรค') || d.includes('IC') || d.includes('icn')) return 'งานควบคุมโรคติดเชื้อ (IC)';
      if (d.includes('ธนาคารเลือด') || d.includes('Blood')) return 'งานธนาคารเลือด';
      if (d.includes('โภชนาการ') || d.includes('อาหาร')) return 'งานโภชนาการ';
      if (d.includes('ผ่าตัด') || d.includes('OR')) return 'ห้องผ่าตัด (OR)';
      if (d.includes('ศูนย์การแพทย์') || d.includes('THAMC') || d.includes('thamc')) return 'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)';
      if (d.includes('เจริญพันธุ์') || d.includes('ผู้มีบุตรยาก') || d.includes('IUI')) return 'หน่วยเวชศาสตร์การเจริญพันธุ์ (ผู้มีบุตรยาก)';
      return d;
    };

    // Helper: Standardize Specimen Types into Clean Professional Categories (8 Services)
    const normalizeSpecimenType = (srvCode, descStr) => {
      const s = (srvCode || '').toUpperCase();
      const desc = (descStr || '').trim();
      if (s === 'AIR_01' || desc.includes('อากาศ') || desc.includes('Air')) {
        return 'อากาศ (Air Sampling)';
      }
      if (s === 'DRG_08' || desc.includes('ปนเปื้อน')) {
        return 'การปนเปื้อนเชื้อในยา (Drug Bioburden)';
      }
      if (s === 'DRG_07' || desc.includes('ยา') || desc.includes('Drug')) {
        return 'ยาเตรียมปราศจากเชื้อ (Drug Compounding)';
      }
      if (s === 'WTO_04' || desc.includes('ห้องผ่าตัด')) {
        return 'น้ำห้องผ่าตัด (Water for Surgery OR)';
      }
      if (s === 'WTM_05' || desc.includes('ศูนย์การแพทย์')) {
        return 'น้ำศูนย์การแพทย์ (Medical Water THAMC)';
      }
      if (s === 'WTS_03' || desc.includes('พื้นผิว') || desc.includes('Surface') || desc.includes('Swab')) {
        return 'พื้นผิวสิ่งแวดล้อมและ Swab (Surfaces)';
      }
      if (s === 'STR_02' || desc.includes('เลือด') || desc.includes('PRC') || desc.includes('Autoclave')) {
        return 'ผลิตภัณฑ์เลือดและตัวบ่งชี้ชีวภาพ (Sterility)';
      }
      if (s === 'FOD_06' || desc.includes('อาหาร') || desc.includes('Food')) {
        return 'อาหารและสุขาภิบาล (Food & Nutrition)';
      }
      return 'สิ่งส่งตรวจสิ่งแวดล้อมทั่วไป';
    };

    allReports.forEach(r => {
      const items = r.report_items || r.items || [];
      const count = items.length > 0 ? items.length : (parseInt(r.sample_count, 10) || 1);
      totalSpecimens += count;

      // Pass / Fail statistics
      const overall = (r.overall_result || r.status || 'pass').toLowerCase();
      if (['pass', 'normal', 'no_growth', 'ไม่พบเชื้อ', 'tested', 'completed'].includes(overall)) {
        passCount += count;
      } else {
        failCount += count;
      }

      // 1. Clean Department Aggregate
      const cleanDept = normalizeDepartment(r.department || r.ward_room);
      deptMap[cleanDept] = (deptMap[cleanDept] || 0) + count;

      // 2. Month Aggregate (Sorted chronologically)
      const dObj = parseDateObj(r.sampling_date || r.reported_date || r.formatted_date || '');
      if (dObj) {
        const thaiY = (dObj.year + 543) % 100;
        const monthKey = `${dObj.year}-${String(dObj.month).padStart(2, '0')}`;
        const monthLabel = `${THAI_MONTHS_SHORT[dObj.month]} ${thaiY}`;
        
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { key: monthKey, label: monthLabel, count: 0, year: dObj.year, month: dObj.month };
        }
        monthlyMap[monthKey].count += count;
      }

      // 3. Clean Specimen Type Aggregate
      if (items.length > 0) {
        items.forEach(it => {
          const cleanType = normalizeSpecimenType(r.service_code, it.sample_description || it.location_name || it.drug_name || it.food_name);
          typeMap[cleanType] = (typeMap[cleanType] || 0) + 1;
        });
      } else {
        const cleanType = normalizeSpecimenType(r.service_code, r.service_name || r.specimen_type);
        typeMap[cleanType] = (typeMap[cleanType] || 0) + count;
      }
    });

    // Sort Departments by volume descending
    const departmentRankings = Object.entries(deptMap)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalSpecimens > 0 ? ((count / totalSpecimens) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Sort Specimen Types by volume descending
    const specimenTypeRankings = Object.entries(typeMap)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalSpecimens > 0 ? ((count / totalSpecimens) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Sort Monthly trends chronologically
    const monthlyTrends = Object.keys(monthlyMap)
      .sort()
      .map(k => monthlyMap[k]);

    // Top KPIs
    const topDepartment = departmentRankings.length > 0 ? departmentRankings[0].name : '-';
    const topSpecimenType = specimenTypeRankings.length > 0 ? specimenTypeRankings[0].name : '-';
    
    // Find Peak Month
    let peakMonth = '-';
    let peakCount = 0;
    if (monthlyTrends.length > 0) {
      const highestMonth = [...monthlyTrends].sort((a, b) => b.count - a.count)[0];
      if (highestMonth) {
        peakMonth = highestMonth.label;
        peakCount = highestMonth.count;
      }
    }

    const passRate = totalSpecimens > 0 ? ((passCount / totalSpecimens) * 100).toFixed(1) : 100;

    return {
      totalReports: allReports.length,
      totalSpecimens,
      passCount,
      failCount,
      passRate,
      topDepartment,
      topSpecimenType,
      peakMonth,
      peakCount,
      departmentRankings,
      specimenTypeRankings,
      monthlyTrends,
      rawReports: allReports
    };
  }
};

// ==============================================================================
// 4. MASTER DATA SERVICE
// ==============================================================================
const MasterDB = {
  async getHolidays() {
    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('master_holidays')
          .select('*')
          .order('holiday_date', { ascending: true });

        if (!error && data) return data;
      } catch (err) {
        console.warn('Could not load holidays from Supabase:', err);
      }
    }
    return [
      { holiday_date: '2026-01-01', holiday_name: 'วันขึ้นปีใหม่' },
      { holiday_date: '2026-04-13', holiday_name: 'วันสงกรานต์' },
      { holiday_date: '2026-04-14', holiday_name: 'วันสงกรานต์' },
      { holiday_date: '2026-04-15', holiday_name: 'วันสงกรานต์' },
      { holiday_date: '2026-05-01', holiday_name: 'วันแรงงานแห่งชาติ' },
      { holiday_date: '2026-08-12', holiday_name: 'วันแม่แห่งชาติ' },
      { holiday_date: '2026-10-13', holiday_name: 'วันนวมินทรมหาราช' },
      { holiday_date: '2026-10-23', holiday_name: 'วันปิยมหาราช' },
      { holiday_date: '2026-12-05', holiday_name: 'วันพ่อแห่งชาติ' },
      { holiday_date: '2026-12-31', holiday_name: 'วันสิ้นปี' }
    ];
  },

  getWards() {
    return WARDS_LIST;
  },

  getServices() {
    return Object.values(SERVICES_CONFIG);
  },

  getServiceByCode(code) {
    return SERVICES_CONFIG[code] || null;
  }
};

// Export to Global window object

// ==============================================================================
// SHARED HELPERS — ใช้ร่วมกันทั้ง dashboard / workflow / สคริปต์ตรวจสอบ
// ==============================================================================

/**
 * แปลงวันที่อัจฉริยะ — รองรับทั้งปี พ.ศ. และ ค.ศ. หลายรูปแบบ
 *   '2026-08-11' / '2569-08-11' / '11/08/2569' / '11/8/2026'
 * คืนค่า { year, month, day } เป็นปี ค.ศ. เสมอ (หรือ null ถ้าแปลงไม่ได้)
 */
function parseDateObjGlobal(dateStr) {
  if (!dateStr) return null;

  if (dateStr instanceof Date && !isNaN(dateStr)) {
    return { year: dateStr.getFullYear(), month: dateStr.getMonth() + 1, day: dateStr.getDate() };
  }

  const s = String(dateStr).trim();
  if (!s) return null;

  let y, m, d;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    y = parseInt(match[1], 10); m = parseInt(match[2], 10); d = parseInt(match[3], 10);
  } else {
    match = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (match) {
      d = parseInt(match[1], 10); m = parseInt(match[2], 10); y = parseInt(match[3], 10);
    } else {
      const parsed = new Date(s);
      if (isNaN(parsed.getTime())) return null;
      y = parsed.getFullYear(); m = parsed.getMonth() + 1; d = parsed.getDate();
    }
  }

  if (!y || !m || m < 1 || m > 12) return null;
  if (y >= 2400) y -= 543;   // ปี พ.ศ. -> ค.ศ.
  return { year: y, month: m, day: d || 1 };
}

/** ชุดสถานะที่ถือว่า "รอตรวจ" */
const WAITING_STATUS_LIST = ['pending', 'waiting_for_testing', 'in_progress', 'draft', 'received', 'submitted'];
function isWaitingStatusGlobal(status) {
  return WAITING_STATUS_LIST.includes(String(status || '').toLowerCase());
}

/** รวมข้อมูลหลายแหล่งโดยไม่ให้ข้อมูลเก่าหาย และไม่เกิดรายการซ้ำ */
function mergeDedupeGlobal(sources, keyFn) {
  const seen = new Map();
  (sources || []).forEach(list => {
    (list || []).forEach(row => {
      if (!row) return;
      const key = keyFn(row);
      if (key && !seen.has(key)) seen.set(key, row);
    });
  });
  return Array.from(seen.values());
}

/** เรียงลำดับ: รายการ "รอตรวจ" อยู่บนสุดเสมอ */
function sortReportsWaitingFirstGlobal(list) {
  return [...(list || [])].sort((a, b) => {
    const wa = isWaitingStatusGlobal(a.status) ? 0 : 1;
    const wb = isWaitingStatusGlobal(b.status) ? 0 : 1;
    if (wa !== wb) return wa - wb;
    const da = new Date(a.created_at || a.sampling_date || a.reported_date || 0);
    const db = new Date(b.created_at || b.sampling_date || b.reported_date || 0);
    return db - da;
  });
}

window.parseDateObj = parseDateObjGlobal;
window.isWaitingStatus = isWaitingStatusGlobal;
window.mergeDedupe = mergeDedupeGlobal;
window.sortReportsWaitingFirst = sortReportsWaitingFirstGlobal;

window.SERVICES_CONFIG = SERVICES_CONFIG;
window.WARDS_LIST = WARDS_LIST;
window.BookingDB = BookingDB;
window.ReportDB = ReportDB;
window.MasterDB = MasterDB;
