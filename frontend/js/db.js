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
    unit: 'CFU/swab หรือ CFU/100mL',
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
    unit: 'CFU/100mL & EU/mL',
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
    unit: 'CFU/mL & EU/mL',
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
    unit: 'CFU/g & Detection',
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
    name: 'Drug (สำหรับงานผลิตยา1) ปลอดเชื้อ',
    category: 'การทดสอบความปราศจากเชื้อของผลิตภัณฑ์ยา (Sterility Test)',
    unit: 'Sterile / Non-sterile',
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
    name: 'Drug (สำหรับงานผลิตยา2) การปนเปื้อนเชื้อจุลินทรีย์',
    category: 'รายงานผลการวิเคราะห์ปริมาณเชื้อและการปนเปื้อนในยาไม่ปราศจากเชื้อ',
    unit: 'CFU/g หรือ CFU/mL',
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
  "หน่วยการพยาบาลตรวจโรคเวชศาสตร์ฟื้นฟู", "ธนาคารเลือด", "งานโภชนาการ", "งานผลิตยา", "งานควบคุมโรคติดเชื้อ (IC)"
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
    approver_name: 'ทนพญ.นริศรา มังกรแก้ว',
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
    approver_name: 'ทนพญ.นริศรา มังกรแก้ว',
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

const getInitialMockBookings = () => [
  {
    id: 'mock-book-001',
    booking_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    sender_name: 'พว.สุดาพร นามสมมุติ',
    department: 'ICU CVT',
    contact_number: '081-234-5678',
    service_code: 'AIR_01',
    service_name: 'Air Sampling (สำหรับงานอาชีวอนามัย)',
    sample_count: 6,
    notes: 'ตรวจคุณภาพอากาศประจำเดือน',
    status: 'confirmed'
  },
  {
    id: 'mock-book-002',
    booking_date: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
    sender_name: 'นายสมเกียรติ มั่นคง',
    department: 'ธนาคารเลือด',
    contact_number: '089-876-5432',
    service_code: 'STR_02',
    service_name: 'Sterility (สำหรับงานธนาคารเลือด)',
    sample_count: 4,
    notes: 'ทดสอบหม้อนึ่ง Autoclave',
    status: 'confirmed'
  }
];

// ==============================================================================
// 2. BOOKING SERVICE (ระบบจองคิวส่งตรวจ)
// ==============================================================================
const BookingDB = {
  /**
   * ดึงข้อมูลการจองตามเดือนและปี
   */
  async getBookingsByMonth(year, month) {
    if (window.supabaseClient) {
      try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        // หาวันสิ้นเดือน
        const endDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

        const { data, error } = await window.supabaseClient
          .from('bookings')
          .select('*')
          .gte('booking_date', startDate)
          .lte('booking_date', endDate)
          .order('booking_date', { ascending: true });

        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Error fetching bookings from Supabase:', err);
      }
    }

    // Fallback Local Mock Data
    const local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_BOOKINGS) || 'null') || getInitialMockBookings();
    return local.filter(b => b.booking_date.startsWith(`${year}-${String(month).padStart(2, '0')}`));
  },

  /**
   * ดึงรายการจองล่าสุดทั้งหมด
   */
  async getAllBookings(limit = 100) {
    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('bookings')
          .select('*')
          .order('booking_date', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Error fetching all bookings:', err);
      }
    }

    const local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_BOOKINGS) || 'null') || getInitialMockBookings();
    return local;
  },

  /**
   * สร้างรายการจองคิวใหม่
   */
  async createBooking(bookingData) {
    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('bookings')
          .insert([bookingData])
          .select()
          .single();

        if (error) throw error;
        return { data, error: null };
      } catch (err) {
        console.error('Error inserting booking:', err);
        return { data: null, error: err };
      }
    }

    // Mock insert
    const local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_BOOKINGS) || 'null') || getInitialMockBookings();
    const newBooking = {
      ...bookingData,
      id: 'mock-book-' + Date.now(),
      created_at: new Date().toISOString()
    };
    local.push(newBooking);
    localStorage.setItem(MOCK_STORAGE_KEY_BOOKINGS, JSON.stringify(local));
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
  async getReports({ serviceCode = '', department = '', search = '', status = '', page = 1, pageSize = 50 } = {}) {
    if (window.supabaseClient) {
      try {
        let query = window.supabaseClient
          .from('reports')
          .select('*, report_items(*)', { count: 'exact' })
          .order('reported_date', { ascending: false });

        if (serviceCode) {
          query = query.eq('service_code', serviceCode);
        }
        if (department) {
          query = query.ilike('department', `%${department}%`);
        }
        if (status) {
          query = query.eq('status', status);
        }
        if (search) {
          query = query.or(`submission_no.ilike.%${search}%,department.ilike.%${search}%,ward_room.ilike.%${search}%`);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;

        return { data: data || [], totalCount: count || 0, error: null };
      } catch (err) {
        console.error('Error fetching reports from Supabase:', err);
      }
    }

    // Mock local reports
    let local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_REPORTS) || 'null') || getInitialMockReports();
    if (serviceCode) {
      local = local.filter(r => r.service_code === serviceCode);
    }
    if (department) {
      local = local.filter(r => r.department && r.department.includes(department));
    }
    if (search) {
      const q = search.toLowerCase();
      local = local.filter(r => 
        r.submission_no.toLowerCase().includes(q) || 
        r.department.toLowerCase().includes(q) ||
        (r.ward_room && r.ward_room.toLowerCase().includes(q))
      );
    }
    return { data: local, totalCount: local.length, error: null };
  },

  /**
   * ดึงรายงานชิ้นเดียวอย่างละเอียด พร้อม items และ attachments
   */
  async getReportById(id) {
    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('reports')
          .select(`
            *,
            report_items (*),
            report_attachments (*)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        return { data, error: null };
      } catch (err) {
        console.error('Error fetching report by ID:', err);
        return { data: null, error: err };
      }
    }

    const local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_REPORTS) || 'null') || getInitialMockReports();
    const rep = local.find(r => r.id === id || r.submission_no === id);
    return { data: rep || null, error: rep ? null : 'Report not found' };
  },

  /**
   * ค้นหารายงานผลสำหรับผู้ใช้ทั่วไป (Public Report Search)
   */
  async searchPublicReports(term) {
    if (!term || term.trim().length === 0) return [];

    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('reports')
          .select('*, report_items(*)')
          .eq('status', 'completed')
          .or(`submission_no.ilike.%${term.trim()}%,department.ilike.%${term.trim()}%`)
          .order('reported_date', { ascending: false })
          .limit(20);

        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Error searching public reports:', err);
      }
    }

    const local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_REPORTS) || 'null') || getInitialMockReports();
    const q = term.trim().toLowerCase();
    return local.filter(r => 
      r.submission_no.toLowerCase().includes(q) || 
      r.department.toLowerCase().includes(q)
    );
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

    // Default 001
    return `${prefix}-001`;
  },

  /**
   * บันทึกรายงานผลตรวจฉบับใหม่ พร้อมรายการตัวอย่างและไฟล์แนบ
   */
  async createReport(reportHeader, items = [], attachments = []) {
    if (window.supabaseClient) {
      try {
        // 1. Insert Report Header
        const { data: newReport, error: reportErr } = await window.supabaseClient
          .from('reports')
          .insert([reportHeader])
          .select()
          .single();

        if (reportErr) throw reportErr;

        // 2. Insert Items if any
        if (items && items.length > 0) {
          const itemsPayload = items.map((item, idx) => ({
            report_id: newReport.id,
            item_no: item.item_no || idx + 1,
            location_name: item.location_name || '',
            sample_description: item.sample_description || '',
            bacteria_count: String(item.bacteria_count || ''),
            fungus_count: String(item.fungus_count || ''),
            microorganism_found: item.microorganism_found || '',
            standard_limit: item.standard_limit || '',
            item_result: item.item_result || 'pass',
            raw_data: item.raw_data || {},
            remarks: item.remarks || ''
          }));

          const { error: itemsErr } = await window.supabaseClient
            .from('report_items')
            .insert(itemsPayload);

          if (itemsErr) throw itemsErr;
        }

        // 3. Insert Attachments if any
        if (attachments && attachments.length > 0) {
          const attachPayload = attachments.map(att => ({
            report_id: newReport.id,
            file_name: att.file_name,
            file_url: att.file_url,
            file_path: att.file_path,
            file_size: att.file_size,
            file_type: att.file_type
          }));

          await window.supabaseClient.from('report_attachments').insert(attachPayload);
        }

        return { data: newReport, error: null };
      } catch (err) {
        console.error('Error creating report in Supabase:', err);
        return { data: null, error: err };
      }
    }

    // Mock create
    const local = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_REPORTS) || 'null') || getInitialMockReports();
    const mockId = 'mock-rep-' + Date.now();
    const newReport = {
      ...reportHeader,
      id: mockId,
      created_at: new Date().toISOString(),
      items: items.map((it, idx) => ({ ...it, id: `item-${mockId}-${idx}`, item_no: idx + 1 }))
    };
    local.unshift(newReport);
    localStorage.setItem(MOCK_STORAGE_KEY_REPORTS, JSON.stringify(local));
    return { data: newReport, error: null };
  },

  /**
   * ลบรายงานผลตรวจ
   */
  async deleteReport(id) {
    if (window.supabaseClient) {
      try {
        const { error } = await window.supabaseClient
          .from('reports')
          .delete()
          .eq('id', id);

        if (error) throw error;
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
   * ดึงข้อมูลสถิติสิ่งส่งตรวจสำหรับ Specimen Dashboard
   */
  async getSpecimenAnalytics({ year = '', department = '', serviceCode = '' } = {}) {
    let allReports = [];

    if (window.supabaseClient) {
      try {
        let query = window.supabaseClient
          .from('reports')
          .select('id, submission_no, service_code, service_name, department, sampling_date, reported_date, overall_result, status, report_items(id, item_no, location_name, sample_description, item_result, bacteria_count, fungus_count)')
          .order('sampling_date', { ascending: true })
          .limit(2000);

        if (serviceCode) query = query.eq('service_code', serviceCode);
        if (department) query = query.eq('department', department);

        const { data, error } = await query;
        if (!error && data) {
          allReports = data;
        }
      } catch (err) {
        console.warn('Error fetching specimen analytics from Supabase:', err);
      }
    }

    if (allReports.length === 0) {
      allReports = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_REPORTS) || 'null') || getInitialMockReports();
    }

    if (department) {
      allReports = allReports.filter(r => r.department && r.department.includes(department));
    }

    // Apply Year Filter if provided
    if (year) {
      allReports = allReports.filter(r => {
        const d = r.sampling_date || r.reported_date || '';
        return d.startsWith(year);
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
      if (d.includes('ผลิตยา') || d.includes('เตรียมยา')) return 'งานผลิตยา (หน่วยเตรียมยาปราศจากเชื้อ)';
      if (d.includes('ควบคุมโรค') || d.includes('IC')) return 'งานควบคุมโรคติดเชื้อ (IC)';
      if (d.includes('ธนาคารเลือด') || d.includes('Blood')) return 'งานธนาคารเลือด';
      if (d.includes('โภชนาการ') || d.includes('อาหาร')) return 'งานโภชนาการ';
      if (d.includes('ผ่าตัด') || d.includes('OR')) return 'ห้องผ่าตัด (OR)';
      if (d.includes('เจริญพันธุ์') || d.includes('ผู้มีบุตรยาก') || d.includes('IUI')) return 'หน่วยเวชศาสตร์การเจริญพันธุ์ (ผู้มีบุตรยาก)';
      return d;
    };

    // Helper: Standardize Specimen Types into Clean Professional Categories
    const normalizeSpecimenType = (srvCode, descStr) => {
      const desc = (descStr || '').trim();
      if (srvCode === 'AIR_01' || desc.includes('อากาศ') || desc.includes('Air')) {
        return 'อากาศ (Air Sampling)';
      }
      if (['DRG_07', 'DRG_08'].includes(srvCode) || desc.includes('ยา') || desc.includes('Drug') || desc.includes('Volume')) {
        return 'ยาและผลิตภัณฑ์ยา (Pharmaceuticals)';
      }
      if (['WTO_04', 'WTM_05'].includes(srvCode) || desc.includes('น้ำ') || desc.includes('Water')) {
        return 'น้ำเพื่อการแพทย์และห้องผ่าตัด (Medical Water)';
      }
      if (srvCode === 'STR_02' || desc.includes('เลือด') || desc.includes('PRC') || desc.includes('Autoclave')) {
        return 'ผลิตภัณฑ์เลือดและตัวบ่งชี้ชีวภาพ (Sterility)';
      }
      if (srvCode === 'FOD_06' || desc.includes('อาหาร') || desc.includes('Food')) {
        return 'อาหารและสุขาภิบาล (Food & Nutrition)';
      }
      if (srvCode === 'WTS_03' || desc.includes('พื้นผิว') || desc.includes('Surface') || desc.includes('Swab')) {
        return 'พื้นผิวสิ่งแวดล้อมและ Swab (Surfaces)';
      }
      return 'สิ่งส่งตรวจสิ่งแวดล้อมทั่วไป';
    };

    allReports.forEach(r => {
      const items = r.report_items || r.items || [];
      const count = items.length > 0 ? items.length : 1;
      totalSpecimens += count;

      // Pass / Fail statistics
      const overall = (r.overall_result || 'pass').toLowerCase();
      if (overall === 'pass' || overall === 'normal' || overall === 'no_growth') {
        passCount += count;
      } else {
        failCount += count;
      }

      // 1. Clean Department Aggregate
      const cleanDept = normalizeDepartment(r.department);
      deptMap[cleanDept] = (deptMap[cleanDept] || 0) + count;

      // 2. Month Aggregate (Sorted chronologically)
      const sdate = r.sampling_date || r.reported_date || '';
      if (sdate && sdate.length >= 7) {
        const y = parseInt(sdate.substring(0, 4), 10);
        const m = parseInt(sdate.substring(5, 7), 10);
        const thaiY = (y + 543) % 100;
        const monthKey = `${y}-${String(m).padStart(2, '0')}`;
        const monthLabel = `${THAI_MONTHS_SHORT[m]} ${thaiY}`;
        
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { key: monthKey, label: monthLabel, count: 0, year: y, month: m };
        }
        monthlyMap[monthKey].count += count;
      }

      // 3. Clean Specimen Type Aggregate
      items.forEach(it => {
        const cleanType = normalizeSpecimenType(r.service_code, it.sample_description);
        typeMap[cleanType] = (typeMap[cleanType] || 0) + 1;
      });
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
      topSpecimenType,
      topDepartment,
      peakMonth,
      peakCount,
      monthlyTrends,
      specimenTypeRankings,
      departmentRankings,
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
window.SERVICES_CONFIG = SERVICES_CONFIG;
window.WARDS_LIST = WARDS_LIST;
window.BookingDB = BookingDB;
window.ReportDB = ReportDB;
window.MasterDB = MasterDB;
