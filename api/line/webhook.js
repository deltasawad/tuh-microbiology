/**
 * ==============================================================================
 * LINE WEBHOOK  (Vercel Serverless Function)
 * POST /api/line/webhook
 * ==============================================================================
 *
 * ทำไมต้องมี:
 *   - การ push หาผู้ใช้ต้องรู้ userId ที่ถูกต้องของ channel นี้ และผู้ใช้ต้องเป็นเพื่อนกับบอท
 *     ถ้า userId มาจากคนละ channel/provider จะได้ 404 ตลอด หาสาเหตุยาก
 *     webhook ทำให้ได้ userId ที่ถูกต้องแน่นอน เพราะ LINE ส่งมาเอง
 *   - การตอบด้วย replyToken "ไม่ถูกนับโควตา" ต่างจาก push ที่หักตามจำนวนผู้รับ
 *     ซึ่งสำคัญมากเพราะแผนฟรีมีแค่ 300 ข้อความ/เดือน และกลุ่มมี 14 คน
 *
 * ความปลอดภัย:
 *   ถ้าตั้ง LINE_CHANNEL_SECRET ไว้ใน Environment Variables จะตรวจลายเซ็นทุกคำขอ
 *   ถ้าไม่ได้ตั้ง จะยังทำงานได้แต่ไม่ตรวจ (ใครก็ยิงเข้ามาได้)
 *   -> handler นี้จึงทำได้แค่ "ตอบกลับ" อย่างเดียว ไม่แตะข้อมูลผลตรวจใด ๆ
 */

const crypto = require('crypto');

const LIFF_URL = 'https://liff.line.me/2011162657-GE5HlbQR';

/** ตรวจลายเซ็นจาก LINE (ทำได้เฉพาะเมื่อมี channel secret) */
function verifySignature(rawBody, signature, secret) {
  if (!secret) return null;                       // null = ตรวจไม่ได้
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature || '')));
  } catch (e) {
    return false;                                  // ความยาวไม่เท่ากัน = ไม่ผ่าน
  }
}

const row = (label, value, color) => ({
  type: 'box', layout: 'baseline', spacing: 'sm',
  contents: [
    { type: 'text', text: label, color: '#9aa0a6', size: 'sm', flex: 4 },
    { type: 'text', text: value, wrap: true, size: 'sm', flex: 7,
      color: color || '#333333', weight: color ? 'bold' : 'regular' }
  ]
});

function welcomeCard(userId) {
  return {
    type: 'flex',
    altText: 'ระบบส่งตรวจสิ่งแวดล้อมพร้อมใช้งานแล้ว',
    contents: {
      type: 'bubble', size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#6c5070', paddingAll: '16px',
        contents: [
          { type: 'text', text: '🧫 ระบบพร้อมใช้งานแล้ว', color: '#ffffff', weight: 'bold', size: 'md' },
          { type: 'text', text: 'งานจุลชีววิทยา รพ.ธรรมศาสตร์เฉลิมพระเกียรติ',
            color: '#ffffffcc', size: 'xxs', wrap: true }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', size: 'sm', wrap: true, color: '#555555',
            text: 'ข้อความนี้ตอบกลับอัตโนมัติ เพื่อยืนยันว่าการ์ดแสดงผลถูกต้องและช่องทาง LINE ใช้งานได้' },
          { type: 'separator', margin: 'md' },
          { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: [
            row('เมนูลัด', 'ติดตั้งแล้ว 6 ปุ่ม', '#6c5070'),
            row('ลิงก์ลัด', 'เข้าตรงขั้นตอนได้'),
            row('บัญชีเจ้าหน้าที่', 'แยก 9 หน่วยงาน'),
            row('ใบรายงานในระบบ', '194 ใบ')
          ]},
          { type: 'box', layout: 'vertical', margin: 'md', backgroundColor: '#f7f2f8',
            cornerRadius: 'md', paddingAll: '10px', contents: [
              { type: 'text', size: 'xxs', color: '#6c5070', wrap: true,
                text: 'LINE userId ของคุณสำหรับ channel นี้' },
              { type: 'text', size: 'xxs', color: '#342838', wrap: true, margin: 'sm',
                text: userId || '(ไม่ทราบ)' }
            ]}
        ]
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
          type: 'button', style: 'primary', height: 'sm', color: '#6c5070',
          action: { type: 'uri', label: 'เปิดระบบส่งตรวจ', uri: LIFF_URL }
        }]
      }
    }
  };
}

async function reply(replyToken, messages, token) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ replyToken, messages })
  });
  const body = await res.text();
  return { status: res.status, body };
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    // ใช้ตรวจว่า endpoint ออนไลน์ (LINE เรียก POST เท่านั้น)
    return res.status(200).json({ ok: true, service: 'tuh-line-webhook' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // ไม่มีค่าสำรองในโค้ด — repo เป็นสาธารณะ
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error('[webhook] ไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN — ตอบกลับไม่ได้');
    return res.status(200).json({ ok: false, error: 'missing LINE_CHANNEL_ACCESS_TOKEN' });
  }
  const secret = process.env.LINE_CHANNEL_SECRET || '';

  let raw = req.body;
  if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
  if (typeof raw !== 'string') raw = JSON.stringify(raw || {});

  const ok = verifySignature(raw, req.headers['x-line-signature'], secret);
  if (ok === false) return res.status(401).json({ error: 'bad signature' });

  let body = {};
  try { body = JSON.parse(raw); } catch (e) { body = {}; }
  const events = body.events || [];

  console.log('[webhook] events =', events.length, '| signatureChecked =', ok === null ? 'ข้าม' : ok);

  for (const ev of events) {
    const userId = ev.source && ev.source.userId;
    const isDirect = ev.source && ev.source.type === 'user';

    console.log('[webhook] event', JSON.stringify({
      type: ev.type,
      sourceType: ev.source && ev.source.type,
      userId: userId || null,
      // groupId ต้องได้จากตรงนี้เท่านั้น ไม่มี API ให้ค้นหา
      // ใช้ตอนเชิญบอทเข้ากลุ่มใหม่ เพื่อนำไปตั้งเป็นปลายทางแจ้งเตือน
      groupId: (ev.source && (ev.source.groupId || ev.source.roomId)) || null,
      hasReplyToken: !!ev.replyToken,
      messageType: ev.message && ev.message.type
      // ไม่บันทึกเนื้อความลง log โดยตั้งใจ — webhook รับ event จากกลุ่มด้วย
      // การเก็บข้อความของผู้ใช้ไว้ใน log ของผู้ให้บริการภายนอกไม่เหมาะกับข้อมูลโรงพยาบาล
    }));

    // ถูกเชิญเข้ากลุ่ม -> ตอบยืนยันพร้อมแสดง groupId (ตอบด้วย replyToken ไม่กินโควตา)
    if (ev.type === 'join' && ev.replyToken) {
      const gid = (ev.source && (ev.source.groupId || ev.source.roomId)) || '(ไม่ทราบ)';
      console.log('[webhook] เข้ากลุ่มใหม่ groupId =', gid);
      await reply(ev.replyToken, [{ type: 'text',
        text: 'เชื่อมต่อระบบส่งตรวจสิ่งแวดล้อมเรียบร้อย\n\nรหัสกลุ่มสำหรับตั้งค่าแจ้งเตือน:\n' + gid }], token);
      continue;
    }

    // ตอบกลับเมื่อเพิ่งเพิ่มเพื่อน หรือส่งข้อความมา (เฉพาะแชท 1:1 ไม่ตอบในกลุ่ม)
    if (ev.replyToken && isDirect && (ev.type === 'follow' || ev.type === 'message')) {
      const r = await reply(ev.replyToken, [welcomeCard(userId)], token);
      console.log('[webhook] reply ->', r.status, r.body ? r.body.slice(0, 300) : '(ว่าง = สำเร็จ)');

      // ถ้าการ์ดถูกปฏิเสธ ลองส่งข้อความธรรมดาแทน จะได้รู้ว่าเป็นที่การ์ดหรือที่สิทธิ์
      if (r.status !== 200) {
        const r2 = await reply(ev.replyToken,
          [{ type: 'text', text: 'ระบบส่งตรวจสิ่งแวดล้อมพร้อมใช้งานแล้ว\nuserId ของคุณ: ' + (userId || '-') }],
          token);
        console.log('[webhook] reply ข้อความธรรมดา ->', r2.status, r2.body ? r2.body.slice(0, 300) : '(ว่าง = สำเร็จ)');
      }
    } else {
      console.log('[webhook] ไม่เข้าเงื่อนไขตอบกลับ');
    }
  }

  // LINE ต้องการ 200 เสมอ ไม่งั้นจะ retry และปิด webhook ในที่สุด
  return res.status(200).json({ ok: true, received: events.length });
};
