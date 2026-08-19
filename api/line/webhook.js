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
const {
  buildServicesCarousel, buildWelcomeCard, buildContactCard,
  serviceBubble, SERVICES, LIFF, SITE
} = require('./services');

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


async function reply(replyToken, messages, token) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ replyToken, messages })
  });
  const body = await res.text();
  return { status: res.status, body };
}

/**
 * คำสั่งลัดที่พิมพ์เข้ามาในแชท
 * ------------------------------------------------------------------------------
 * ตอบด้วย replyToken ซึ่งไม่กินโควตา จึงรับคำได้กว้างโดยไม่ต้องกลัวเปลืองข้อความ
 * ถ้าไม่ตรงคำไหนเลย จะส่งการ์ดต้อนรับกลับไป เพื่อไม่ให้ผู้ใช้เจอความเงียบ
 */
function routeText(raw, displayName) {
  const t = String(raw || '').trim().toLowerCase();
  const hit = (words) => words.some(w => t.includes(w));
  const link = (label, url) => [{ type: 'text', text: label + '\n' + url }];

  if (hit(['บริการ', 'รายการตรวจ', 'service', 'menu', 'เมนู'])) return [buildServicesCarousel()];
  if (hit(['จอง', 'คิว', 'booking']))            return link('จองคิวส่งตรวจได้ที่นี่', LIFF + '?step=1');
  if (hit(['ฟอร์ม', 'ส่งตัวอย่าง', 'form']))      return link('กรอกแบบฟอร์มส่งตรวจได้ที่นี่', LIFF + '?step=2');
  if (hit(['สถานะ', 'ติดตาม', 'ถึงไหน', 'status'])) return link('ติดตามสถานะใบส่งตรวจได้ที่นี่', LIFF + '?step=3');
  if (hit(['ผล', 'รายงาน', 'result']))            return link('ดูผลตรวจย้อนหลังได้ที่นี่', LIFF + '?step=4');
  if (hit(['ติดต่อ', 'เบอร์', 'โทร', 'contact'])) return [buildContactCard()];
  if (hit(['คู่มือ', 'วิธีใช้', 'ช่วย', 'help', 'guide'])) return link('คู่มือใช้งานฉบับเต็ม', SITE + '/guide');

  // พิมพ์รหัสบริการตรง ๆ ก็ได้ เช่น "AIR" หรือ "air-01"
  // ต้องหารหัสเต็มให้ครบทุกบริการก่อน แล้วค่อยถอยมาที่คำนำหน้า
  // ไม่งั้น "drg-08" จะไปเข้า DRG-07 เพราะคำนำหน้า "drg" ตรงทั้งคู่
  const svc = SERVICES.find(x => t.includes(x.label.toLowerCase()) || t.includes(x.code.toLowerCase()))
           || SERVICES.find(x => t.includes(x.label.split('-')[0].toLowerCase()));
  if (svc) return [{ type: 'flex', altText: svc.label + ' ' + svc.name, contents: serviceBubble(svc) }];

  return [buildWelcomeCard(displayName)];
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

    // เพิ่มเพื่อนใหม่ -> ทักทาย แล้วตามด้วยรายการบริการทั้งหมด
    // แยกเป็นสองข้อความโดยตั้งใจ ข้อความแรกบอกว่าที่นี่คือที่ไหนทำอะไรได้
    // ถ้ารวมเป็นใบเดียวจะยาวจนไม่มีใครอ่าน
    if (ev.type === 'follow' && ev.replyToken && isDirect) {
      let name = null;
      try {
        const p = await fetch('https://api.line.me/v2/bot/profile/' + userId,
          { headers: { Authorization: 'Bearer ' + token } });
        if (p.ok) name = (await p.json()).displayName;
      } catch (e) { /* ไม่รู้ชื่อก็ทักทายแบบกลาง ๆ ได้ */ }

      const r = await reply(ev.replyToken, [buildWelcomeCard(name), buildServicesCarousel()], token);
      console.log('[webhook] ต้อนรับเพื่อนใหม่ ->', r.status, r.body ? r.body.slice(0, 200) : '(ว่าง = สำเร็จ)');

      if (r.status !== 200) {
        await reply(ev.replyToken, [{ type: 'text',
          text: 'ยินดีต้อนรับสู่ระบบส่งตรวจสิ่งแวดล้อม\nงานจุลชีววิทยา รพ.ธรรมศาสตร์เฉลิมพระเกียรติ\n\nเริ่มที่นี่ ' + LIFF }], token);
      }
      continue;
    }

    // ข้อความในแชท 1:1 -> ตอบตามคำสั่งลัด (ไม่ตอบในกลุ่ม จะกวนคนอื่น)
    if (ev.type === 'message' && ev.replyToken && isDirect) {
      const text = (ev.message && ev.message.type === 'text') ? ev.message.text : '';
      const r = await reply(ev.replyToken, routeText(text, null), token);
      console.log('[webhook] ตอบคำสั่งลัด ->', r.status, r.body ? r.body.slice(0, 200) : '(ว่าง = สำเร็จ)');

      if (r.status !== 200) {
        await reply(ev.replyToken, [{ type: 'text', text: 'เปิดระบบส่งตรวจได้ที่นี่\n' + LIFF }], token);
      }
      continue;
    }

    console.log('[webhook] ไม่เข้าเงื่อนไขตอบกลับ');
  }

  // LINE ต้องการ 200 เสมอ ไม่งั้นจะ retry และปิด webhook ในที่สุด
  return res.status(200).json({ ok: true, received: events.length });
};
