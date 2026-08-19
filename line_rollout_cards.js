// การ์ดเชิญใช้งาน สำหรับส่งเข้ากลุ่ม LINE ของแต่ละหน่วยงาน
// ใช้ปุ่ม uri ทั้งหมด เพราะการ์ดนี้ส่งเข้ากลุ่มที่บอทอาจไม่ได้อยู่ด้วย
const SITE = 'https://tuh-microbiology.vercel.app';
const OA   = 'https://line.me/R/ti/p/@569knxox';

const row = (label, value) => ({
  type: 'box', layout: 'baseline', spacing: 'sm',
  contents: [
    { type: 'text', text: label, color: '#9aa0a6', size: 'sm', flex: 4 },
    { type: 'text', text: value, wrap: true, size: 'sm', flex: 7, color: '#333333' }
  ]
});

function buildRolloutFlex(dept) {
  return {
    type: 'flex',
    altText: 'เริ่มใช้ระบบส่งตรวจสิ่งแวดล้อมผ่าน LINE — ' + dept.dept,
    contents: {
      type: 'bubble', size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#6c5070', paddingAll: '18px',
        contents: [
          { type: 'text', text: '🧫 ส่งตรวจสิ่งแวดล้อมผ่าน LINE', color: '#ffffff', weight: 'bold', size: 'md', wrap: true },
          { type: 'text', text: 'งานจุลชีววิทยา รพ.ธรรมศาสตร์เฉลิมพระเกียรติ', color: '#ffffffcc', size: 'xxs', wrap: true, margin: 'xs' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', text: dept.icon + ' ' + dept.dept, weight: 'bold', size: 'md', wrap: true, color: '#111111' },
          { type: 'text', size: 'sm', wrap: true, color: '#555555',
            text: 'จองคิว ส่งแบบฟอร์ม ติดตามสถานะ และดูผลตรวจ ครบในที่เดียว ไม่ต้องโทรถาม ไม่ต้องเดินเอกสาร' },
          { type: 'separator', margin: 'md' },
          { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: [
            row('บริการ', dept.short + ' · ' + dept.name),
            row('เลขที่เอกสาร', dept.pre + '-2026-08-19-01'),
            row('ผลออกภายใน', '3–5 วันทำการ'),
            row('แก้ไข/ยกเลิก', 'ทำเองได้จนกว่าผลจะออก')
          ]},
          { type: 'box', layout: 'vertical', margin: 'md', backgroundColor: '#f7f2f8',
            cornerRadius: 'md', paddingAll: '12px', contents: [
              { type: 'text', size: 'xs', color: '#6c5070', weight: 'bold', text: 'เริ่มยังไง' },
              { type: 'text', size: 'xs', color: '#342838', wrap: true, margin: 'sm',
                text: '1. แตะ "เพิ่มเพื่อน" ด้านล่าง\n2. เปิดห้องแชท จะเห็นเมนู 6 ปุ่ม\n3. แตะปุ่มที่ต้องการได้เลย' }
            ]}
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'button', style: 'primary', height: 'sm', color: '#06c755',
            action: { type: 'uri', label: 'เพิ่มเพื่อน @569knxox', uri: OA } },
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'uri', label: 'อ่านวิธีใช้ทั้งหมด', uri: SITE + '/guide?dept=' + dept.key } }
        ]
      }
    }
  };
}

const DEPTS = [
  { key:'occ',         pre:'AIR', short:'AIR-01', icon:'💨', name:'Air Sampling',      dept:'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร' },
  { key:'icn',         pre:'WTS', short:'WTS-03', icon:'🧼', name:'Water or Surface',  dept:'งานควบคุมโรคติดเชื้อ' },
  { key:'bloodbank',   pre:'STR', short:'STR-02', icon:'🩸', name:'Sterility Test',    dept:'งานธนาคารเลือด' },
  { key:'compounding', pre:'DR1', short:'DRG-07', icon:'💊', name:'Drug ปลอดเชื้อ',    dept:'งานผลิตยา (หน่วยเตรียมยาปราศจากเชื้อ)' },
  { key:'pharma',      pre:'DR2', short:'DRG-08', icon:'🧪', name:'Drug การปนเปื้อน',  dept:'งานผลิตยา' },
  { key:'thamc',       pre:'WTM', short:'WTM-05', icon:'💧', name:'Water THAMC',       dept:'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)' },
  { key:'or',          pre:'WTO', short:'WTO-04', icon:'🚿', name:'Water ห้องผ่าตัด',  dept:'ห้องผ่าตัด (OR)' },
  { key:'nutrition',   pre:'FOD', short:'FOD-06', icon:'🍲', name:'Food Sanitation',   dept:'งานโภชนาการ' }
];

module.exports = { DEPTS, buildRolloutFlex };

if (require.main === module) {
  const fs = require('fs');
  const all = {};
  DEPTS.forEach(d => { all[d.key] = buildRolloutFlex(d); });
  fs.writeFileSync(__dirname + '/rollout_flex.json', JSON.stringify(all, null, 2));
  console.log('สร้างการ์ด Flex ครบ ' + DEPTS.length + ' หน่วยงาน');
  DEPTS.forEach(d => {
    const size = JSON.stringify(all[d.key]).length;
    console.log('  ' + d.icon + ' ' + d.dept.padEnd(45) + ' ' + size + ' bytes' + (size > 10000 ? '  ⚠️ เกิน 10KB' : ''));
  });
}
