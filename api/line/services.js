/**
 * ==============================================================================
 * ข้อมูลบริการส่งตรวจ + ตัวสร้างข้อความสำหรับ LINE OA
 * ==============================================================================
 *
 * ไฟล์นี้เป็นแหล่งข้อมูลเดียวของฝั่ง LINE (single source) ใช้ร่วมกันระหว่าง
 *   - api/line/webhook.js   ตอบข้อความและต้อนรับเพื่อนใหม่
 *   - สคริปต์ส่งการ์ดเข้ากลุ่ม
 *
 * ค่าทั้งหมดคัดลอกมาจาก SERVICES_CONFIG ใน frontend/js/db.js
 * ถ้าแก้ฝั่งนั้นต้องแก้ที่นี่ด้วย ไม่งั้นข้อมูลบนหน้าเว็บกับใน LINE จะไม่ตรงกัน
 *
 * ขนาดข้อความ: ตรวจกับ LINE ด้วย /v2/bot/message/validate/push ทุกครั้งที่แก้
 *   carousel 9 ใบ ~17 KB · ผ่านการตรวจแล้ว (ตรวจไม่กินโควตา)
 */

const LIFF = 'https://liff.line.me/2011162657-GE5HlbQR';
const SITE = 'https://tuh-microbiology.vercel.app';
const BRAND = '#6c5070';
const GOLD = '#f9d56e';

const SERVICES = [
  { code: 'AIR_01', label: 'AIR-01', icon: '💨', accent: '#0f766e',
    name: 'Air Sampling',
    forWho: 'งานอาชีวอนามัย',
    what: 'คุณภาพอากาศในหอผู้ป่วยและห้องผ่าตัด',
    unit: 'CFU/m³',
    std: 'Bacteria < 500, Fungi < 100 CFU/m³' },

  { code: 'STR_02', label: 'STR-02', icon: '🩸', accent: '#be123c',
    name: 'Sterility',
    forWho: 'งานธนาคารเลือด',
    what: 'ความปลอดเชื้อ / หม้อนึ่งฆ่าเชื้อ Autoclave',
    unit: 'Growth / No growth',
    std: 'No growth หลังบ่ม 35°C และ 25°C' },

  { code: 'WTS_03', label: 'WTS-03', icon: '🧼', accent: '#0369a1',
    name: 'Water or Surface',
    forWho: 'งานควบคุมโรคติดเชื้อ (IC)',
    what: 'สว็อบพื้นผิว สิ่งแวดล้อม และน้ำในโรงพยาบาล',
    unit: 'Growth / No growth',
    std: 'ไม่พบเชื้อก่อโรค ตามเกณฑ์ IC' },

  { code: 'WTO_04', label: 'WTO-04', icon: '🚿', accent: '#4338ca',
    name: 'Water — ห้องผ่าตัด',
    forWho: 'ห้องผ่าตัด (OR)',
    what: 'คุณภาพน้ำและระดับ Endotoxin',
    unit: 'Growth / No growth',
    std: 'TVC < 10 CFU/100mL, Endotoxin < 0.25 EU/mL' },

  { code: 'WTM_05', label: 'WTM-05', icon: '💧', accent: '#0e7490',
    name: 'Water — THAMC',
    forWho: 'ศูนย์การแพทย์ธรรมศาสตร์',
    what: 'น้ำบริสุทธิ์และน้ำไตเทียม (ISO 23500)',
    unit: 'Growth / No growth',
    std: 'AAMI / ISO 23500 Water for Hemodialysis' },

  { code: 'FOD_06', label: 'FOD-06', icon: '🍲', accent: '#047857',
    name: 'Food Sanitation',
    forWho: 'งานโภชนาการ',
    what: 'การปนเปื้อนจุลินทรีย์ในอาหารและน้ำดื่มผู้ป่วย',
    unit: 'Growth / No growth',
    std: 'E. coli Negative, Salmonella ไม่พบ, S. aureus < 100 CFU/g' },

  { code: 'DRG_07', label: 'DRG-07', icon: '💊', accent: '#7e22ce',
    name: 'Drug — ยาปลอดเชื้อ',
    forWho: 'งานผลิตยา 1',
    what: 'ความปราศจากเชื้อของผลิตภัณฑ์ยา',
    unit: 'Growth / No growth',
    std: 'USP <71> Sterility Tests (FTM & TSB)' },

  { code: 'DRG_08', label: 'DRG-08', icon: '🧪', accent: '#a16207',
    name: 'Drug — การปนเปื้อน',
    forWho: 'งานผลิตยา 2',
    what: 'ปริมาณเชื้อและการปนเปื้อนในยาไม่ปราศจากเชื้อ',
    unit: 'Growth / No growth',
    std: 'USP <61> TAMC/TYMC และ USP <62>' }
];

const TAT = '3–5 วันทำการ';

/** แถวข้อมูลในการ์ด: ป้ายซ้าย ค่าขวา */
const row = (label, value, color) => ({
  type: 'box', layout: 'baseline', spacing: 'sm',
  contents: [
    { type: 'text', text: label, color: '#9aa0a6', size: 'xs', flex: 3 },
    { type: 'text', text: value, wrap: true, size: 'xs', flex: 7,
      color: color || '#333333', weight: color ? 'bold' : 'regular' }
  ]
});

/** การ์ด 1 ใบต่อ 1 บริการ */
function serviceBubble(s) {
  return {
    type: 'bubble', size: 'micro',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: s.accent, paddingAll: '12px',
      contents: [
        { type: 'text', text: s.icon + '  ' + s.label, color: '#ffffff', weight: 'bold', size: 'sm' },
        { type: 'text', text: s.forWho, color: '#ffffffcc', size: 'xxs', wrap: true }
      ]
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
      contents: [
        { type: 'text', text: s.name, weight: 'bold', size: 'sm', wrap: true, color: '#111111' },
        { type: 'text', text: s.what, size: 'xxs', wrap: true, color: '#666666' },
        { type: 'separator', margin: 'sm' },
        { type: 'box', layout: 'vertical', margin: 'sm', spacing: 'xs', contents: [
          row('ผลออก', TAT, s.accent),
          row('หน่วยวัด', s.unit),
          row('เกณฑ์', s.std)
        ]}
      ]
    },
    footer: {
      type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: '10px',
      contents: [
        { type: 'button', style: 'primary', height: 'sm', color: s.accent,
          action: { type: 'uri', label: 'จองคิว', uri: LIFF + '?step=1' } },
        { type: 'button', style: 'link', height: 'sm',
          action: { type: 'uri', label: 'ส่งแบบฟอร์ม', uri: LIFF + '?step=2' } }
      ]
    }
  };
}

/** การ์ดปิดท้าย carousel — ทางลัดไปหน้าอื่น */
function moreBubble() {
  return {
    type: 'bubble', size: 'micro',
    body: {
      type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
      contents: [
        { type: 'text', text: '📋', size: 'xxl' },
        { type: 'text', text: 'ดูทั้งหมด', weight: 'bold', size: 'sm', color: '#111111' },
        { type: 'text', text: 'คู่มือใช้งาน ติดตามสถานะ และผลตรวจย้อนหลัง',
          size: 'xxs', wrap: true, color: '#666666' }
      ]
    },
    footer: {
      type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: '10px',
      contents: [
        { type: 'button', style: 'primary', height: 'sm', color: BRAND,
          action: { type: 'uri', label: 'ติดตามสถานะ', uri: LIFF + '?step=3' } },
        { type: 'button', style: 'link', height: 'sm',
          action: { type: 'uri', label: 'คู่มือใช้งาน', uri: SITE + '/guide' } }
      ]
    }
  };
}

/** Carousel รวมทุกบริการ */
function buildServicesCarousel() {
  return {
    type: 'flex',
    altText: 'บริการตรวจวิเคราะห์สิ่งแวดล้อม 8 รายการ',
    contents: {
      type: 'carousel',
      contents: SERVICES.map(serviceBubble).concat([moreBubble()])
    }
  };
}

/**
 * การ์ดต้อนรับเพื่อนใหม่
 * ตั้งใจแยกจาก carousel เพราะข้อความแรกควรบอกว่า "ที่นี่คือที่ไหน ทำอะไรได้"
 * ก่อนจะโยนรายการบริการทั้งหมดใส่
 */
function buildWelcomeCard(displayName) {
  const hello = displayName ? ('สวัสดีคุณ ' + displayName) : 'สวัสดีครับ';
  return {
    type: 'flex',
    altText: 'ยินดีต้อนรับสู่ระบบส่งตรวจสิ่งแวดล้อม',
    contents: {
      type: 'bubble', size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: BRAND, paddingAll: '18px',
        contents: [
          { type: 'text', text: '🧫 ยินดีต้อนรับ', color: '#ffffff', weight: 'bold', size: 'lg' },
          { type: 'text', text: 'งานจุลชีววิทยา รพ.ธรรมศาสตร์เฉลิมพระเกียรติ',
            color: '#ffffffcc', size: 'xxs', wrap: true, margin: 'xs' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', text: hello, weight: 'bold', size: 'md', wrap: true, color: '#111111' },
          { type: 'text', size: 'sm', wrap: true, color: '#555555',
            text: 'ที่นี่คือช่องทางส่งตรวจวิเคราะห์สิ่งแวดล้อม จองคิว ส่งแบบฟอร์ม ติดตามสถานะ และดูผลตรวจ ได้ครบในที่เดียว' },
          { type: 'separator', margin: 'md' },
          { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: [
            row('บริการ', '8 รายการ', BRAND),
            row('ผลออกภายใน', TAT),
            row('แก้ไข/ยกเลิก', 'ทำเองได้จนกว่าผลจะออก'),
            row('เมนูลัด', 'อยู่ใต้ห้องแชทนี้')
          ]},
          { type: 'box', layout: 'vertical', margin: 'md', backgroundColor: '#f7f2f8',
            cornerRadius: 'md', paddingAll: '12px', contents: [
              { type: 'text', size: 'xxs', color: BRAND, weight: 'bold', text: 'พิมพ์คำสั่งลัดได้' },
              { type: 'text', size: 'xxs', color: '#342838', wrap: true, margin: 'sm',
                text: 'บริการ · จองคิว · สถานะ · ผลตรวจ · ติดต่อ' }
            ]}
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'button', style: 'primary', height: 'sm', color: BRAND,
            action: { type: 'uri', label: 'เริ่มจองคิวส่งตรวจ', uri: LIFF + '?step=1' } },
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'uri', label: 'อ่านคู่มือใช้งาน', uri: SITE + '/guide' } }
        ]
      }
    }
  };
}

/** ข้อความติดต่อห้องแล็บ */
function buildContactCard() {
  return {
    type: 'flex',
    altText: 'ติดต่องานจุลชีววิทยา',
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: BRAND, paddingAll: '14px',
        contents: [{ type: 'text', text: '☎️ ติดต่อห้องปฏิบัติการ', color: '#ffffff', weight: 'bold', size: 'sm' }]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          row('หน่วยงาน', 'งานจุลชีววิทยา'),
          row('โทรศัพท์', '02-926-9460', BRAND),
          row('เวลาทำการ', 'จันทร์–ศุกร์ 08:30–16:30'),
          row('รับสิ่งส่งตรวจ', '08:30–15:00 วันทำการ'),
          { type: 'text', margin: 'md', size: 'xxs', wrap: true, color: '#888888',
            text: 'นอกเวลาราชการ กรุณาประสานห้องปฏิบัติการล่วงหน้าก่อนนำส่งตัวอย่าง' }
        ]
      }
    }
  };
}

module.exports = {
  SERVICES, TAT, LIFF, SITE, BRAND, GOLD,
  serviceBubble, buildServicesCarousel, buildWelcomeCard, buildContactCard
};
