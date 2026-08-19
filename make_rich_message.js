/**
 * ==============================================================================
 * สร้างภาพ Rich Message สำหรับ LINE Official Account Manager
 * ==============================================================================
 *
 * รันด้วย: node make_rich_message.js
 *
 * ได้ไฟล์ออกมา 2 ภาพ (ขนาด 1040x1040 ตามที่ LINE กำหนดสำหรับ Rich Message)
 *   richmessage_services_6.png  เลย์เอาต์ 6 ช่อง — ใช้กับเทมเพลตมาตรฐานของ LINE ได้เลย
 *   richmessage_services_8.png  เลย์เอาต์ 8 ช่อง — ครบทุกบริการ ต้องใช้เทมเพลตแบบกำหนดเอง
 *
 * ทำไมมีสองแบบ:
 *   Rich Message ในหน้า OA Manager มีเทมเพลตสำเร็จรูปให้เลือกจำนวนช่องจำกัด
 *   (ปกติ 1 / 2 / 3 / 4 / 6 ช่อง) ถ้าบัญชีของคุณเลือกได้ถึง 6 ให้ใช้ไฟล์ _6
 *   ถ้ามีตัวเลือกกำหนดพื้นที่เองได้ ให้ใช้ _8 เพื่อให้ครบทั้ง 8 บริการ
 *
 * ธีมสีและฟอนต์ใช้ชุดเดียวกับเว็บแอปและ Rich Menu
 */

const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const SIZE = 1040;
const INK = '#342838';
const PLUM = '#6c5070';
const GOLD = '#f9d56e';
const PAPER = '#faf7fb';

// ฟอนต์ไทยที่มีอยู่บน Windows — ถ้าไม่เจอ canvas จะถอยไปใช้ฟอนต์ระบบซึ่งอาจไม่รองรับสระไทย
const THAI_FONTS = [
  'C:/Windows/Fonts/LeelaUIb.ttf',
  'C:/Windows/Fonts/LeelawUI.ttf',
  'C:/Windows/Fonts/tahomabd.ttf',
  'C:/Windows/Fonts/tahoma.ttf'
];
let FAMILY = 'sans-serif';
for (const f of THAI_FONTS) {
  if (fs.existsSync(f)) {
    GlobalFonts.registerFromPath(f, 'TH');
    FAMILY = 'TH';
    break;
  }
}

const SERVICES = [
  { label: 'AIR-01', icon: '💨', name: 'Air Sampling',      who: 'อาชีวอนามัย',        accent: '#0f766e' },
  { label: 'STR-02', icon: '🩸', name: 'Sterility',         who: 'ธนาคารเลือด',        accent: '#be123c' },
  { label: 'WTS-03', icon: '🧼', name: 'Water / Surface',   who: 'ควบคุมโรคติดเชื้อ',  accent: '#0369a1' },
  { label: 'WTO-04', icon: '🚿', name: 'Water OR',          who: 'ห้องผ่าตัด',          accent: '#4338ca' },
  { label: 'WTM-05', icon: '💧', name: 'Water THAMC',       who: 'ศูนย์การแพทย์',       accent: '#0e7490' },
  { label: 'FOD-06', icon: '🍲', name: 'Food Sanitation',   who: 'โภชนาการ',            accent: '#047857' },
  { label: 'DRG-07', icon: '💊', name: 'Drug ปลอดเชื้อ',    who: 'ผลิตยา 1',            accent: '#7e22ce' },
  { label: 'DRG-08', icon: '🧪', name: 'Drug ปนเปื้อน',     who: 'ผลิตยา 2',            accent: '#a16207' }
];

/** กล่องมุมมน */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** ตัดข้อความให้พอดีความกว้าง เติม … ถ้ายาวเกิน */
function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function drawTile(ctx, s, x, y, w, h) {
  // พื้นการ์ด
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, w, h, 26);
  ctx.fill();

  // แถบสีประจำบริการด้านซ้าย ทำให้แยกออกจากกันได้แม้ภาพเล็ก
  ctx.fillStyle = s.accent;
  roundRect(ctx, x, y, 14, h, 7);
  ctx.fill();

  const padL = x + 44;
  let cy = y + h / 2;

  // ไอคอน
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(h * 0.34)}px ${FAMILY}`;
  ctx.fillText(s.icon, padL, cy - h * 0.12);

  // รหัสบริการ
  ctx.fillStyle = s.accent;
  ctx.font = `bold ${Math.round(h * 0.17)}px ${FAMILY}`;
  ctx.fillText(s.label, padL + h * 0.42, cy - h * 0.17);

  // ชื่อบริการ
  ctx.fillStyle = INK;
  ctx.font = `bold ${Math.round(h * 0.155)}px ${FAMILY}`;
  ctx.fillText(fit(ctx, s.name, w - (padL - x) - 40), padL, cy + h * 0.14);

  // หน่วยงานที่ใช้
  ctx.fillStyle = '#8b7f90';
  ctx.font = `${Math.round(h * 0.125)}px ${FAMILY}`;
  ctx.fillText(fit(ctx, 'สำหรับงาน' + s.who, w - (padL - x) - 40), padL, cy + h * 0.34);
}

function build(count, outFile) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // พื้นหลัง
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // หัวเรื่อง
  const HEAD = 168;
  ctx.fillStyle = PLUM;
  ctx.fillRect(0, 0, SIZE, HEAD);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, HEAD - 8, SIZE, 8);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 50px ${FAMILY}`;
  ctx.fillText('บริการตรวจวิเคราะห์สิ่งแวดล้อม', SIZE / 2, HEAD / 2 - 22);
  ctx.fillStyle = '#ffffffcc';
  ctx.font = `28px ${FAMILY}`;
  ctx.fillText('งานจุลชีววิทยา รพ.ธรรมศาสตร์เฉลิมพระเกียรติ · ผลออก 3–5 วันทำการ', SIZE / 2, HEAD / 2 + 34);

  // ตารางการ์ด
  const items = SERVICES.slice(0, count);
  const cols = 2;
  const rows = count / cols;
  const GAP = 22;
  const PAD = 28;
  const gridTop = HEAD + PAD;
  const gridH = SIZE - gridTop - PAD;
  const tileW = (SIZE - PAD * 2 - GAP * (cols - 1)) / cols;
  const tileH = (gridH - GAP * (rows - 1)) / rows;

  const areas = [];
  items.forEach((s, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = PAD + c * (tileW + GAP);
    const y = gridTop + r * (tileH + GAP);
    drawTile(ctx, s, x, y, tileW, tileH);
    areas.push({
      service: s.label,
      x: Math.round(x), y: Math.round(y),
      width: Math.round(tileW), height: Math.round(tileH)
    });
  });

  fs.writeFileSync(outFile, canvas.toBuffer('image/png'));
  const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
  console.log(`${path.basename(outFile)}  ${SIZE}x${SIZE}  ${kb} KB  ${count} ช่อง`);
  return areas;
}

const areas8 = build(8, 'richmessage_services_8.png');
const areas6 = build(6, 'richmessage_services_6.png');

fs.writeFileSync('richmessage_areas.json', JSON.stringify({
  note: 'พิกัดพื้นที่กดสำหรับตั้งค่าใน LINE Official Account Manager (ภาพขนาด 1040x1040)',
  liff: 'https://liff.line.me/2011162657-GE5HlbQR',
  areas_8: areas8,
  areas_6: areas6
}, null, 2));

console.log('\nพิกัดพื้นที่กด (แบบ 8 ช่อง):');
areas8.forEach(a => console.log(`  ${a.service}  x=${a.x} y=${a.y} w=${a.width} h=${a.height}`));
console.log('\nบันทึกพิกัดไว้ที่ richmessage_areas.json');
