/**
 * ==============================================================================
 * LIFF CONFIGURATION  (liff-config.js)
 * ระบบจองคิว/ส่งตรวจสิ่งแวดล้อมผ่าน LINE — งานจุลชีววิทยา รพ.ธรรมศาสตร์ฯ
 * ==============================================================================
 *
 *  ┌──────────────────────────────────────────────────────────────────────┐
 *  │  ⬇️  ใส่ค่าตรงนี้ที่เดียว  ⬇️                                          │
 *  └──────────────────────────────────────────────────────────────────────┘
 *
 *  1) LIFF ID — เอามาจากไหน
 *     LINE Developers Console  ->  เลือก Provider  ->  เลือก Channel (Messaging API)
 *     ->  แท็บ "LIFF"  ->  ปุ่ม "Add"
 *         • LIFF app name : TUH Microbiology
 *         • Size          : Full
 *         • Endpoint URL  : https://tuh-microbiology.vercel.app/liff
 *                           (ใช้ URL สั้นแบบนี้ ไม่ต้องมี /index.html เพราะ
 *                            Vercel ตั้ง cleanUrls ไว้ จะ redirect 308 ทิ้ง)
 *         • Scopes        : ✅ profile   ✅ openid   (ต้องติ๊ก profile ไม่งั้น
 *                            liff.getProfile() จะ error 403)
 *         • Bot link      : On (Aggressive)  ← เพื่อให้ผู้ใช้แอดบอทอัตโนมัติ
 *     ->  Copy ค่า "LIFF ID" (รูปแบบ 1234567890-abcdefgh) มาวางด้านล่าง
 *
 *  2) Supabase URL / anon key — ไม่ต้องใส่ซ้ำที่นี่
 *     ใช้ร่วมกับเว็บหลัก อยู่ในไฟล์  frontend/js/supabase-config.js
 *     (หน้า HTML ทั้งสองไฟล์โหลด ../js/supabase-config.js ไว้ให้แล้ว)
 *     ถ้าจะย้าย LIFF ไป deploy แยกโดเมน ให้ก๊อปไฟล์นั้นไปด้วย
 *
 *  3) LINE Group ID ของห้องแล็บ — ไม่ต้องใส่ที่นี่เช่นกัน
 *     token/group id อยู่ฝั่งเซิร์ฟเวอร์ที่ api/notify/broadcast.js เท่านั้น
 *     ห้ามใส่ Channel Access Token ลงไฟล์นี้เด็ดขาด เพราะผู้ใช้เปิดอ่านได้
 */

const LIFF_CONFIG = {
  // ⬇️⬇️⬇️ วาง LIFF ID ของคุณตรงนี้ ⬇️⬇️⬇️
  liffId: '2011162657-GE5HlbQR',
  // ⬆️ LIFF URL สำหรับเปิดจากใน LINE: https://liff.line.me/2011162657-GE5HlbQR

  /**
   * โหมดพัฒนา (โปรไฟล์จำลอง) — ตัดสินให้อัตโนมัติจากชื่อโฮสต์ ไม่ต้องมาสลับเอง
   *
   *   เปิดเครื่องตัวเอง (localhost / 127.0.0.1 / เปิดไฟล์ตรง ๆ)  -> อนุญาต ทดสอบฟอร์มได้เลย
   *   ขึ้นโดเมนจริง (vercel.app หรือโดเมนโรงพยาบาล)              -> ไม่อนุญาต เด็ดขาด
   *
   * เหตุผลที่ไม่ใช้สวิตช์มือ: ถ้าลืมปิดก่อน deploy ผู้ใช้ทุกคนจะกลายเป็น
   * "ผู้ทดสอบระบบ" คนเดียวกันหมด ใบส่งตรวจจะแยกไม่ออกว่าเป็นของใคร
   * และหน้า "ใบของฉัน" จะเห็นข้ามหน่วยงานกัน
   *
   * ถ้าจำเป็นต้องบังคับค่าเอง (เช่น เปิดเดโมบนโดเมนจริงชั่วคราว)
   * ให้เปลี่ยนบรรทัด allowMockProfile ด้านล่างเป็น true/false ตรง ๆ ได้
   */
  isDevHost(hostname) {
    return ['localhost', '127.0.0.1', '[::1]', '0.0.0.0', ''].includes(String(hostname || '').toLowerCase());
  },
  get allowMockProfile() {
    return this.isDevHost(typeof location !== 'undefined' ? location.hostname : '');
  },

  /** โปรไฟล์จำลองสำหรับโหมดพัฒนา */
  mockProfile: {
    userId: 'U-DEV-LOCAL-TESTER',
    displayName: 'ผู้ทดสอบระบบ (โหมดพัฒนา)',
    pictureUrl: ''
  },

  /** ปลายทาง proxy ฝั่งเซิร์ฟเวอร์สำหรับส่ง LINE Flex Message เข้ากลุ่มห้องแล็บ */
  notifyEndpoints: [
    '/api/notify/broadcast',
    '/.netlify/functions/notify',
    'http://127.0.0.1:8001/api/notify/broadcast'
  ],

  /** วันที่ห้องปฏิบัติการเปิดรับสิ่งส่งตรวจ (0=อาทิตย์ ... 6=เสาร์) — จันทร์ถึงพุธ */
  openWeekdays: [1, 2, 3],

  /** จองล่วงหน้าได้ไม่เกินกี่วัน */
  maxAdvanceDays: 90,

  /** เตือนเมื่อคิวในวันนั้นเกินจำนวนนี้ */
  queueWarningThreshold: 10
};

/**
 * ทะเบียนบริการ 8 รายการ (ต้องตรงกับเว็บหลักและตาราง reports)
 * icon ใช้ emoji เพราะแสดงได้ทั้งในเว็บและใน LINE Flex Message
 */
const LIFF_SERVICES = {
  AIR_01: { code: 'AIR_01', short: 'AIR-01', name: 'Air Sampling (ตรวจเชื้อในอากาศ)',            dept: 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร', icon: '💨', subjectLabel: 'ตำแหน่งที่เก็บ',  accent: '#0f766e' },
  STR_02: { code: 'STR_02', short: 'STR-02', name: 'Sterility Test (ความปลอดเชื้อ)',              dept: 'งานธนาคารเลือด',                            icon: '🩸', subjectLabel: 'หมายเลขถุงเลือด', accent: '#be123c' },
  WTS_03: { code: 'WTS_03', short: 'WTS-03', name: 'Water or Surface (งานควบคุมโรคติดเชื้อ)',     dept: 'งานควบคุมโรคติดเชื้อ',                       icon: '🧼', subjectLabel: 'สถานที่/หน่วยงาน', accent: '#0369a1' },
  WTO_04: { code: 'WTO_04', short: 'WTO-04', name: 'Water (ห้องผ่าตัด OR)',                       dept: 'ห้องผ่าตัด (OR)',                            icon: '🚿', subjectLabel: 'จุดเก็บน้ำ',      accent: '#4338ca' },
  WTM_05: { code: 'WTM_05', short: 'WTM-05', name: 'Water (ศูนย์การแพทย์ธรรมศาสตร์ THAMC)',       dept: 'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)',            icon: '💧', subjectLabel: 'จุดเก็บน้ำ',      accent: '#0e7490' },
  FOD_06: { code: 'FOD_06', short: 'FOD-06', name: 'Food Sanitation (สุขาภิบาลอาหาร)',            dept: 'งานโภชนาการ',                                icon: '🍲', subjectLabel: 'รายการอาหาร',    accent: '#047857' },
  DRG_07: { code: 'DRG_07', short: 'DRG-07', name: 'Drug — การปนเปื้อนเชื้อจุลินทรีย์ (งานผลิตยา)', dept: 'งานผลิตยา',      icon: '💊', subjectLabel: 'ชนิดยา',         accent: '#7e22ce' },
  DRG_08: { code: 'DRG_08', short: 'DRG-08', name: 'Drug — ยาปลอดเชื้อ',                          dept: 'ยาผลิตปราศจากเชื้อ',                                  icon: '🧪', subjectLabel: 'ยาเตรียม',       accent: '#b45309' }
};

/**
 * คอลัมน์ผลตรวจของแต่ละบริการ (ใช้ในหน้า admin.html เท่านั้น)
 * type: 'text'     = พิมพ์จำนวนโคโลนี (CFU)
 *       'growth'   = เลือก No growth / Growth
 *       'negative' = เลือก ไม่พบเชื้อ / พบเชื้อ
 */
const LIFF_RESULT_SCHEMAS = {
  AIR_01: [
    { key: 'bacteria_count', label: 'Bacteria (CFU)', type: 'text', placeholder: '0' },
    { key: 'fungus_count',   label: 'Fungus (CFU)',   type: 'text', placeholder: '0' }
  ],
  STR_02: [{ key: 'bacteria_count', label: 'ผลเพาะเชื้อ', type: 'growth' }],
  WTS_03: [{ key: 'bacteria_count', label: 'ผลเพาะเชื้อ', type: 'growth' }],
  WTO_04: [{ key: 'bacteria_count', label: 'ผลเพาะเชื้อ', type: 'growth' }],
  WTM_05: [{ key: 'bacteria_count', label: 'ผลเพาะเชื้อ', type: 'growth' }],
  FOD_06: [
    { key: 'bacteria_count', label: 'E. COLI',        type: 'negative' },
    { key: 'fungus_count',   label: 'P. AERUGINOSA',  type: 'negative' }
  ],
  DRG_07: [{ key: 'bacteria_count', label: 'ผลเพาะเชื้อ 72 ชม.', type: 'growth' }],
  DRG_08: [{ key: 'bacteria_count', label: 'ผล 72 ชม. (Growth/No growth)', type: 'growth' }]
};

/**
 * เกณฑ์เชิงตัวเลขสำหรับบริการที่รายงานเป็นปริมาณ
 * ------------------------------------------------------------------------------
 * ใช้เตือนตอนลงผล ถ้าค่าที่คีย์เกินเกณฑ์แต่สรุปผลเป็น "ผ่าน"
 * ตั้งใจให้เป็นแค่คำเตือน ไม่เปลี่ยนคำตัดสินให้อัตโนมัติ
 * เพราะการสรุปผลเป็นดุลพินิจของนักเทคนิคการแพทย์
 *
 * ค่าอ้างอิงจาก SERVICES_CONFIG.standard ใน frontend/js/db.js
 */
const LIFF_RESULT_LIMITS = {
  AIR_01: {
    bacteria_count: { max: 500, label: 'Bacteria', unit: 'CFU/m³' },
    fungus_count:   { max: 100, label: 'Fungus',   unit: 'CFU/m³' }
  }
};

window.LIFF_RESULT_LIMITS = LIFF_RESULT_LIMITS;
window.LIFF_CONFIG = LIFF_CONFIG;
window.LIFF_SERVICES = LIFF_SERVICES;
window.LIFF_RESULT_SCHEMAS = LIFF_RESULT_SCHEMAS;
