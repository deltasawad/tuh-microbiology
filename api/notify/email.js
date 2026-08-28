/**
 * ==============================================================================
 * ส่งใบรายงานผลตรวจทางอีเมล  (Vercel Serverless Function)
 * POST /api/notify/email     body: { "reportId": "<uuid>" }
 *                        หรือ { "submissionNo": "AIR-2026-08-26-01" }
 * ==============================================================================
 *
 * ทำไมผู้รับต้องมาจากฐานข้อมูล ไม่ใช่จาก request
 * ------------------------------------------------------------------------------
 * ถ้ารับที่อยู่ผู้รับจาก body ตรง ๆ ฟังก์ชันนี้จะกลายเป็น open relay ทันที
 * ใครก็ตามที่รู้ URL ยิง POST เข้ามาก็ส่งเมลในนามโรงพยาบาลได้ทุกฉบับ
 * จึงรับมาแค่ "ใบไหน" แล้วไปอ่าน recipient_email ของใบนั้นจากฐานข้อมูลเอง
 * ถ้าจะเปลี่ยนผู้รับ ต้องแก้ที่ใบผ่านหน้าเว็บซึ่งมีการล็อกอินและ RLS คุมอยู่
 *
 * ข้อมูลลับทั้งหมดมาจาก Environment Variables เท่านั้น ไม่มีค่าสำรองในโค้ด
 * repo นี้เป็นสาธารณะ การฝังค่าไว้เท่ากับเผยแพร่
 *
 * ------------------------------------------------------------------------------
 * ตัวแปรที่ต้องตั้งบน Vercel (Settings -> Environment Variables -> Production)
 * ------------------------------------------------------------------------------
 *   SUPABASE_URL        https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY   anon key (ตัวเดียวกับที่หน้าเว็บใช้ ไม่ใช่ service role)
 *   MAIL_FROM           ผู้ส่ง เช่น  TUH Microbiology <lab@ธนาคารโดเมนที่ยืนยันแล้ว>
 *   แล้วเลือกผู้ให้บริการอย่างใดอย่างหนึ่ง
 *   RESEND_API_KEY      ถ้าใช้ Resend
 *   SENDGRID_API_KEY    ถ้าใช้ SendGrid
 *
 *   MAIL_REPLY_TO       (ไม่บังคับ) อีเมลห้องแล็บให้ผู้รับตอบกลับ
 *   PUBLIC_BASE_URL     (ไม่บังคับ) ปกติเดาจาก header ของคำขอได้เอง
 *
 * ถ้าตั้งไม่ครบ จะตอบกลับพร้อมบอกชื่อตัวแปรที่ขาด ไม่เงียบให้ไปหาสาเหตุเอง
 * ==============================================================================
 */

const OPEN_STATUSES = ['draft', 'pending', 'waiting_for_testing', 'in_progress', 'received', 'submitted'];

/**
 * เกณฑ์มาตรฐานประจำแต่ละบริการ
 * ------------------------------------------------------------------------------
 * ยกมาจาก report_view.html ให้ตรงกันคำต่อคำ เพราะเป็นเอกสารคุณภาพชุดเดียวกัน
 * ถ้าสองที่เขียนไม่ตรงกัน คนอ่านจะไม่รู้ว่าจะเชื่อฉบับไหน
 *
 * รายการย่อยส่วนใหญ่ในฐานข้อมูลไม่ได้เก็บ standard_criteria ไว้ ช่องนี้จึงขึ้น "-"
 * ทั้งที่บริการนั้นมีเกณฑ์ชัดเจนอยู่ ใช้ค่าประจำบริการเป็นตัวสำรองแทน
 */
const SERVICE_STANDARD = {
  AIR_01: { unit: 'CFU/m³', std: 'Total Bacteria < 500 CFU/m³, Fungi < 100 CFU/m³',
            perItem: 'แบคทีเรีย < 500 · เชื้อรา < 100 CFU/m³' },
  STR_02: { unit: 'Growth / No growth', std: 'ไม่พบเชื้อจุลชีพ (Sterile / No Growth)',
            perItem: 'ไม่พบเชื้อจุลชีพ' },
  WTS_03: { unit: 'Growth / No growth', std: 'ไม่พบเชื้อจุลชีพก่อโรค (No Growth after 3 days)',
            perItem: 'ไม่พบเชื้อจุลชีพก่อโรค' },
  WTO_04: { unit: 'Growth / No growth', std: 'ไม่พบเชื้อจุลชีพก่อโรค (No Growth after 3 days)',
            perItem: 'ไม่พบเชื้อจุลชีพก่อโรค' },
  WTM_05: { unit: 'Growth / No growth', std: 'ไม่พบเชื้อจุลชีพก่อโรค (No Growth after 3 days)',
            perItem: 'ไม่พบเชื้อจุลชีพก่อโรค' },
  FOD_06: { unit: 'Growth / No growth', std: 'ไม่พบเชื้อ E.coli และ P.aeruginosa (NEGATIVE / NO GROWTH)',
            perItem: 'ไม่พบ E.coli / P.aeruginosa' },
  DRG_07: { unit: 'Growth / No growth', std: 'ไม่พบเชื้อจุลชีพ (No growth at 72 hrs)',
            perItem: 'ไม่พบเชื้อจุลชีพ' },
  DRG_08: { unit: 'Growth / No growth', std: 'ไม่พบเชื้อจุลินทรีย์ปนเปื้อน (No growth at 72 hrs)',
            perItem: 'ไม่พบเชื้อปนเปื้อน' }
};

const stdOf = (rep) => SERVICE_STANDARD[String(rep.service_code || '').toUpperCase()] || null;

/**
 * หน่วยงานที่เข้าไปเก็บสิ่งส่งตรวจ
 * ไม่ใช่หน่วยงานผู้ส่งตรวจ — AIR-01 กับ WTS-03 งานอาชีวอนามัย/IC เป็นผู้ส่ง
 * แต่ไปเก็บตัวอย่างที่หอผู้ป่วยอื่น ค่าที่ถูกต้องจึงอยู่ที่ระดับรายการย่อยก่อน
 * ใช้ลำดับเดียวกับ report_view.html
 */
const itemWard = (it, rep) => it.ward_name || rep.ward_room || rep.department || '-';

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dash = (v) => {
  const s = String(v == null ? '' : v).trim();
  return s === '' ? '-' : s;
};

/** รูปแบบวันที่ไทย พ.ศ. — ค่าที่ไม่ใช่วันที่ส่งคืนเดิม ไม่เดาแทน */
function thaiDate(v) {
  const s = String(v || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return dash(v);
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
             'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${M[m - 1]} ${y + 543}`;
}

/**
 * วันเวลาที่ส่ง ตามเขตเวลาไทย
 * ฟังก์ชันบน Vercel รันด้วยเขตเวลา UTC จึงต้องบวก 7 ชั่วโมงเอง
 * ห้ามใช้ toLocaleString('th-TH') เพราะ runtime อาจไม่มีข้อมูล locale ไทยติดมา
 */
function thaiNow() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
             'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear() + 543} ` +
         `เวลา ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} น.`;
}

/** เวลาสั้นสำหรับต่อท้ายหัวเรื่อง เช่น "27 ส.ค. 13:20:45 น." */
function thaiStamp() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
             'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ` +
         `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} น.`;
}

/**
 * ผลของรายการย่อยหนึ่งแถว
 * ------------------------------------------------------------------------------
 * AIR-01 รายงานเป็น "จำนวนโคโลนี" ของแบคทีเรียและเชื้อรา (หน่วย CFU/m³)
 * บริการที่เหลือรายงานเป็น Growth / No growth ตามหน่วยวัดของแต่ละงาน
 *
 * ข้อมูลจริงในฐานข้อมูลเก็บไว้คนละแบบในคอลัมน์เดียวกัน จึงต้องแปลงเอง:
 *   WTS-03  bacteria_count เก็บ "ชื่อเชื้อที่พบ" หรือ "No growth"
 *   FOD-06  bacteria_count เก็บ "พบเชื้อ" / "ไม่พบเชื้อ"
 *   DRG-08  bacteria_count เก็บ "< 10^2 CFU/g"
 *   STR-02  bacteria_count เก็บ "0"
 * ใช้ item_result เป็นตัวชี้ขาดก่อน เพราะเป็นคอลัมน์เดียวที่ทุกบริการกรอกตรงกัน
 * แล้วค่อยหยิบชื่อเชื้อมาต่อท้ายเมื่อพบเชื้อ ซึ่งเป็นข้อมูลที่ห้ามตกหล่น
 */
const PASS_WORDS = ['pass', 'normal', 'no_growth', 'nogrowth', 'ผ่าน'];
const FAIL_WORDS = ['fail', 'growth', 'contaminated', 'positive', 'ไม่ผ่าน', 'พบเชื้อ'];

/** ข้อความนี้แปลว่า "ไม่พบเชื้อ" หรือเป็นแค่ตัวเลข ไม่ใช่ชื่อเชื้อ */
function isNotOrganismName(v) {
  const t = String(v == null ? '' : v).trim().toLowerCase();
  if (t === '' || t === '-' || t === '0') return true;
  if (/^[\d.,<>=\s]+$/.test(t)) return true;                 // ตัวเลขหรือค่าจำกัด เช่น "< 10^2"
  if (/cfu|ml|g|m³|m3/.test(t)) return true;             // มีหน่วยวัดติดมา
  // คำที่บอก "ผลเป็นอย่างไร" ไม่ใช่ "เชื้ออะไร" — ต่อท้ายไปก็ซ้ำซ้อน
  // เช่น FOD-06 เก็บว่า "พบเชื้อ" จะได้ "Growth — พบเชื้อ" ซึ่งอ่านแล้วงง
  return ['no growth', 'nogrowth', 'ไม่พบเชื้อ', 'ไม่พบ', 'ไม่พบเชื้อก่อโรค',
          'negative', 'sterile', 'ปกติ',
          'พบเชื้อ', 'growth', 'positive', 'ไม่ผ่าน', 'fail', 'ผ่าน',
          'contaminated', 'รอตรวจ', 'pending'].some(w => t.includes(w));
}

function itemResult(it, rep) {
  const code = String(rep && rep.service_code || '').toUpperCase();
  const res = String(it.item_result || '').trim().toLowerCase();

  // ---------- AIR-01: รายงานจำนวนโคโลนี ----------
  if (code === 'AIR_01') {
    const parts = [];
    if (it.bacteria_count != null && String(it.bacteria_count).trim() !== '') {
      parts.push(`แบคทีเรีย ${esc(it.bacteria_count)}`);
    }
    if (it.fungus_count != null && String(it.fungus_count).trim() !== '') {
      parts.push(`เชื้อรา ${esc(it.fungus_count)}`);
    }
    if (parts.length) return parts.join(' · ');
    if (!res) return 'รอตรวจ';
    return '-';
  }

  // ---------- บริการอื่น: Growth / No growth ----------
  if (!res || res === 'pending') return 'รอตรวจ';

  const failed = FAIL_WORDS.includes(res) ||
                 (!PASS_WORDS.includes(res) && FAIL_WORDS.some(w => res.includes(w)));
  if (!failed) return 'No growth';

  // พบเชื้อ — ต่อชื่อเชื้อที่พบไว้ด้วย ห้ามตัดทิ้ง
  const organism = [it.microorganism_found, it.bacteria_count, it.fungus_count]
    .map(v => String(v == null ? '' : v).trim())
    .find(v => v && !isNotOrganismName(v));

  return organism ? `Growth — ${esc(organism)}` : 'Growth';
}

/** ป้ายสถานะผ่าน/ไม่ผ่านของแต่ละแถว */
function itemBadge(it) {
  const r = String(it.item_result || '').toLowerCase();
  if (['pass', 'normal', 'no_growth', 'ผ่าน', 'ไม่พบเชื้อ'].includes(r)) {
    return '<span style="color:#15803d;font-weight:700;">ผ่าน</span>';
  }
  if (['fail', 'growth', 'contaminated', 'ไม่ผ่าน', 'พบเชื้อ'].includes(r)) {
    return '<span style="color:#b91c1c;font-weight:700;">ไม่ผ่าน</span>';
  }
  return '<span style="color:#94a3b8;">-</span>';
}

function buildHtml(rep, items, reportUrl) {
  const waiting = OPEN_STATUSES.includes(String(rep.status || '').toLowerCase());

  const row = (label, value) => `
    <tr>
      <td style="padding:6px 12px 6px 0;color:#78687e;font-size:13px;white-space:nowrap;">${esc(label)}</td>
      <td style="padding:6px 0;color:#342838;font-size:13px;font-weight:600;">${esc(value)}</td>
    </tr>`;

  const S = stdOf(rep);

  const itemRows = items.map((it, i) => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;color:#78687e;font-size:12px;">${it.item_no || i + 1}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;color:#342838;font-size:12px;font-weight:600;">${esc(itemWard(it, rep))}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;color:#342838;font-size:12px;">${esc(dash(it.location_name || it.sample_description))}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;color:#342838;font-size:12px;">${itemResult(it, rep)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;color:#78687e;font-size:12px;">${esc(dash(it.standard_criteria || it.standard_limit || (S && S.perItem)))}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">${itemBadge(it)}</td>
    </tr>`).join('');

  const itemsTable = items.length ? `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:8px;">
      <tr style="background:#f7f2f8;">
        <th style="padding:8px 6px;text-align:center;color:#6c5070;font-size:12px;width:36px;">ลำดับ</th>
        <th style="padding:8px 6px;text-align:left;color:#6c5070;font-size:12px;">หน่วยงาน</th>
        <th style="padding:8px 6px;text-align:left;color:#6c5070;font-size:12px;">ตำแหน่งที่เก็บ</th>
        <th style="padding:8px 6px;text-align:left;color:#6c5070;font-size:12px;">ผลการตรวจ</th>
        <th style="padding:8px 6px;text-align:left;color:#6c5070;font-size:12px;">เกณฑ์มาตรฐาน</th>
        <th style="padding:8px 6px;text-align:center;color:#6c5070;font-size:12px;width:56px;">สถานะ</th>
      </tr>
      ${itemRows}
    </table>`
    : '<p style="color:#78687e;font-size:13px;margin:8px 0 0;">ยังไม่มีรายการผลการตรวจในใบนี้</p>';

  return `<!doctype html>
<html lang="th"><body style="margin:0;padding:24px 12px;background:#faf7fb;font-family:'Segoe UI',Tahoma,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e6d9ea;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#6c5070;padding:20px 24px;">
      <div style="color:#ffffff;font-size:17px;font-weight:700;">ใบรายงานผลการตรวจวิเคราะห์สิ่งแวดล้อม</div>
      <div style="color:#e8dcea;font-size:12px;margin-top:4px;">งานจุลชีววิทยา โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ</div>
    </td></tr>
    <tr><td style="height:4px;background:#f9d56e;"></td></tr>

    <tr><td style="padding:24px;">
      ${waiting
        ? '<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:10px 14px;font-size:13px;margin-bottom:16px;">ใบนี้ยัง<strong>อยู่ระหว่างรอผลการตรวจ</strong> ข้อมูลด้านล่างจึงยังไม่ใช่ผลฉบับสมบูรณ์</div>'
        : '<div style="background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:12px;padding:10px 14px;font-size:13px;margin-bottom:16px;">ห้องปฏิบัติการ<strong>ออกผลการตรวจเรียบร้อยแล้ว</strong></div>'}

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        ${row('เลขที่เอกสาร', dash(rep.submission_no))}
        ${row('บริการ', dash(rep.service_name))}
        ${row('หน่วยงานส่งตรวจ', dash(rep.department))}
        ${row('สถานที่ / จุดเก็บตัวอย่าง', dash(rep.ward_room))}
        ${row('วันที่เก็บตัวอย่าง', thaiDate(rep.sampling_date))}
        ${row('วันที่รายงานผล', thaiDate(rep.reported_date))}
        ${row('ผู้รายงานผล', dash(rep.reporter_name))}
      </table>

      <div style="margin-top:22px;color:#6c5070;font-size:14px;font-weight:700;">ผลการตรวจวิเคราะห์</div>
      ${S ? `<div style="color:#78687e;font-size:11px;margin-top:3px;">
        <strong>หน่วยวัด:</strong> ${esc(S.unit)} &nbsp;|&nbsp; <strong>เกณฑ์มาตรฐาน:</strong> ${esc(S.std)}
      </div>` : ''}
      ${itemsTable}

      ${rep.remarks ? `<div style="margin-top:18px;padding:12px 14px;background:#faf7fb;border:1px solid #e6d9ea;border-radius:12px;">
        <div style="color:#78687e;font-size:12px;margin-bottom:4px;">ความเห็นทางเทคนิค</div>
        <div style="color:#342838;font-size:13px;line-height:1.6;">${esc(rep.remarks)}</div>
      </div>` : ''}

      ${reportUrl ? `<div style="margin-top:24px;text-align:center;">
        <a href="${esc(reportUrl)}" style="display:inline-block;background:#6c5070;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 26px;border-radius:12px;">เปิดระบบส่งตรวจสิ่งแวดล้อม</a>
        <div style="color:#94a3b8;font-size:11px;margin-top:8px;">ต้องเข้าสู่ระบบด้วยบัญชีหน่วยงานจึงจะใช้งานได้</div>
      </div>` : ''}
    </td></tr>

    <tr><td style="padding:16px 24px;background:#faf7fb;border-top:1px solid #e6d9ea;color:#78687e;font-size:11px;line-height:1.7;">
      อีเมลฉบับนี้ส่งอัตโนมัติจากระบบส่งตรวจและรายงานผลสิ่งแวดล้อม · ส่งเมื่อ ${esc(thaiNow())}<br>
      ห้องปฏิบัติการจุลชีววิทยา ชั้น 3 ตึกกิติวัฒนา · โทร. 0-2926-9460
    </td></tr>
  </table>
</body></html>`;
}

/** ข้อความล้วนสำหรับโปรแกรมเมลที่ไม่แสดง HTML */
function buildText(rep, items, reportUrl) {
  const lines = [
    'ใบรายงานผลการตรวจวิเคราะห์สิ่งแวดล้อม',
    'งานจุลชีววิทยา โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ',
    '',
    `เลขที่เอกสาร      : ${dash(rep.submission_no)}`,
    `บริการ            : ${dash(rep.service_name)}`,
    `หน่วยงานส่งตรวจ   : ${dash(rep.department)}`,
    `สถานที่เก็บตัวอย่าง : ${dash(rep.ward_room)}`,
    `วันที่เก็บตัวอย่าง  : ${thaiDate(rep.sampling_date)}`,
    `วันที่รายงานผล     : ${thaiDate(rep.reported_date)}`,
    '',
    'ผลการตรวจวิเคราะห์'
  ];
  const S = stdOf(rep);
  if (S) lines.push(`หน่วยวัด: ${S.unit} | เกณฑ์มาตรฐาน: ${S.std}`);
  items.forEach((it, i) => {
    const std = it.standard_criteria || it.standard_limit || (S && S.perItem) || '-';
    lines.push(`  ${it.item_no || i + 1}. [${itemWard(it, rep)}] ${dash(it.location_name || it.sample_description)}`);
    lines.push(`      ผล: ${itemResult(it, rep).replace(/<[^>]+>/g, '')}  |  เกณฑ์: ${std}`);
  });
  if (!items.length) lines.push('  (ยังไม่มีรายการผลการตรวจในใบนี้)');
  if (rep.remarks) lines.push('', `ความเห็นทางเทคนิค: ${rep.remarks}`);
  if (reportUrl) lines.push('', `ระบบส่งตรวจสิ่งแวดล้อม: ${reportUrl}`);
  lines.push('', `ส่งเมื่อ ${thaiNow()}`);
  return lines.join('\n');
}

/** ส่งผ่านผู้ให้บริการที่ตั้งค่าไว้ — ไม่มี dependency ใช้ fetch ล้วน */
/**
 * ส่งผ่านผู้ให้บริการที่ตั้งค่าไว้ — ไม่มี dependency ใช้ fetch ล้วน
 * ------------------------------------------------------------------------------
 * X-Entity-Ref-ID: Gmail จะจับเมลที่หัวเรื่องและเนื้อหาคล้ายกันมัดรวมเป็นเธรดเดียว
 * แล้วยุบส่วนที่ซ้ำให้เหลือปุ่ม "..." ผู้รับต้องกดขยายเองถึงจะเห็นตารางผล
 * เกิดจริงเมื่อส่งใบเดิมซ้ำ หรือส่งหลายใบที่หน้าตาเหมือนกันไปหาคนเดียวกัน
 * ใส่ค่าไม่ซ้ำในหัวจดหมายนี้ Gmail จะถือเป็นคนละฉบับ ไม่ยุบเนื้อหา
 */
async function sendMail({ to, subject, html, text, from, replyTo, refId }) {
  const resend = process.env.RESEND_API_KEY;
  const sendgrid = process.env.SENDGRID_API_KEY;

  if (resend) {
    const body = { from, to: [to], subject, html, text, headers: { 'X-Entity-Ref-ID': refId } };
    if (replyTo) body.reply_to = replyTo;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + resend, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Resend ตอบกลับ ' + r.status + ': ' + JSON.stringify(d).slice(0, 300));
    return { provider: 'Resend', id: d.id || null };
  }

  if (sendgrid) {
    const m = String(from).match(/^\s*(.*?)\s*<(.+)>\s*$/);
    const body = {
      personalizations: [{ to: [{ email: to }] }],
      from: m ? { name: m[1], email: m[2] } : { email: String(from).trim() },
      subject,
      content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }],
      headers: { 'X-Entity-Ref-ID': refId }
    };
    if (replyTo) body.reply_to = { email: replyTo };
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + sendgrid, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!(r.status === 202 || r.ok)) {
      const t = await r.text().catch(() => '');
      throw new Error('SendGrid ตอบกลับ ' + r.status + ': ' + t.slice(0, 300));
    }
    return { provider: 'SendGrid', id: r.headers.get('x-message-id') || null };
  }

  throw new Error('ยังไม่ได้ตั้งค่าผู้ให้บริการส่งเมล');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'ใช้ได้เฉพาะ POST' });
  }

  // ---------- ตรวจการตั้งค่าก่อน จะได้บอกได้ว่าขาดอะไร ----------
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_ANON_KEY;
  const FROM = process.env.MAIL_FROM;
  const missing = [];
  if (!SB_URL) missing.push('SUPABASE_URL');
  if (!SB_KEY) missing.push('SUPABASE_ANON_KEY');
  if (!FROM) missing.push('MAIL_FROM');
  if (!process.env.RESEND_API_KEY && !process.env.SENDGRID_API_KEY) {
    missing.push('RESEND_API_KEY หรือ SENDGRID_API_KEY');
  }
  if (missing.length) {
    return res.status(503).json({
      ok: false,
      error: 'ระบบส่งอีเมลยังตั้งค่าไม่ครบ',
      missing,
      hint: 'ตั้งค่าที่ Vercel -> Settings -> Environment Variables (Production) แล้ว deploy ใหม่'
    });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const reportId = String(body.reportId || '').trim();
  const submissionNo = String(body.submissionNo || '').trim();
  if (!reportId && !submissionNo) {
    return res.status(400).json({ ok: false, error: 'ต้องระบุ reportId หรือ submissionNo' });
  }

  try {
    // ---------- อ่านใบรายงานจากฐานข้อมูล ----------
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId);
    const col = isUuid ? 'id' : 'submission_no';
    const key = isUuid ? reportId : (submissionNo || reportId);

    const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
    const q = `${SB_URL}/rest/v1/reports?${col}=eq.${encodeURIComponent(key)}` +
              `&select=*,report_items(*)&limit=1`;
    const r = await fetch(q, { headers: H });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error('อ่านฐานข้อมูลไม่สำเร็จ ' + r.status + ': ' + t.slice(0, 200));
    }
    const rows = await r.json();
    const rep = Array.isArray(rows) ? rows[0] : null;
    if (!rep) return res.status(404).json({ ok: false, error: 'ไม่พบใบรายงานนี้' });

    // ---------- ผู้รับมาจากใบเท่านั้น ----------
    const to = String(rep.recipient_email || '').trim();
    if (!to) {
      return res.status(422).json({
        ok: false,
        error: 'ใบนี้ยังไม่มีอีเมลผู้รับผล',
        hint: 'กรอกอีเมลในช่อง "อีเมลรับผลตรวจ" ของใบนี้ก่อน แล้วกดส่งอีกครั้ง'
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(422).json({ ok: false, error: 'รูปแบบอีเมลผู้รับไม่ถูกต้อง: ' + to });
    }

    const items = (rep.report_items || []).slice()
      .sort((a, b) => (a.item_no || 0) - (b.item_no || 0));

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = (process.env.PUBLIC_BASE_URL || (host ? `${proto}://${host}` : '')).replace(/\/+$/, '');
    // ปลายทางของปุ่มตามที่ผู้ดูแลระบบกำหนด: หน้าส่งตรวจของบริการนั้น
    //
    // ⚠️ ใช้โดเมนหลัก (tuh-microbiology.vercel.app) ไม่ใช่ URL ของ deployment ใดเฉพาะ
    //    URL แบบ tuh-microbiology-<hash>-...vercel.app ผูกกับ deployment ตัวนั้นตลอดไป
    //    deploy ครั้งถัดไปจะไม่อัปเดตตาม อีเมลเป็นเอกสารถาวร ลิงก์ที่ฝังไปจึงต้องเป็น
    //    โดเมนที่ชี้ไปยังเวอร์ชันล่าสุดเสมอ
    const svc = encodeURIComponent(String(rep.service_code || '').toUpperCase());
    const reportUrl = base ? `${base}/workflow?tab=submission&service=${svc}` : '';

    const waiting = OPEN_STATUSES.includes(String(rep.status || '').toLowerCase());

    // หัวเรื่องใช้ "หน่วยงานที่เข้าไปเก็บสิ่งส่งตรวจ" ไม่ใช่หน่วยงานผู้ส่งตรวจ
    // AIR-01 และ WTS-03 งานอาชีวอนามัย/IC เป็นผู้ส่งทุกใบ ถ้าใช้ department
    // หัวเรื่องของทุกใบจะเหมือนกันหมด แยกไม่ออกว่าเป็นผลของหอผู้ป่วยไหน
    const subjWard = String(rep.ward_room || rep.department || '').trim();

    // ต่อท้ายด้วยเวลาที่ส่ง (ถึงระดับวินาที) ให้หัวเรื่องไม่ซ้ำกันเลยสักฉบับ
    // Gmail จับเมลหัวเรื่องเดียวกันมัดเป็นเธรดแล้วยุบเนื้อหาที่ซ้ำเหลือปุ่ม "..."
    // หัวจดหมาย X-Entity-Ref-ID อย่างเดียวยังเอาไม่อยู่ในทางปฏิบัติ
    // ผลพลอยได้: ผู้รับแยกออกทันทีว่าฉบับไหนส่งทีหลัง เวลาส่งใบเดิมซ้ำ
    const subject = `[${rep.submission_no}] ` +
      `${waiting ? 'แจ้งรับตัวอย่าง — อยู่ระหว่างรอผล' : 'ผลการตรวจวิเคราะห์สิ่งแวดล้อม'}` +
      `${subjWard ? ' · ' + subjWard : ''} · ${thaiStamp()}`;

    // ค่าไม่ซ้ำต่อการส่งหนึ่งครั้ง ใช้กับ X-Entity-Ref-ID
    const refId = `${rep.submission_no || rep.id}-${Date.now().toString(36)}`;

    const sent = await sendMail({
      to,
      refId,
      subject,
      html: buildHtml(rep, items, reportUrl),
      text: buildText(rep, items, reportUrl),
      from: FROM,
      replyTo: process.env.MAIL_REPLY_TO || null
    });

    return res.status(200).json({
      ok: true,
      to,
      submission_no: rep.submission_no,
      items: items.length,
      waiting,
      provider: sent.provider,
      messageId: sent.id
    });

  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err && err.message || err) });
  }
};
