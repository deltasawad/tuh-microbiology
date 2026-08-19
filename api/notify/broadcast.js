/**
 * ==============================================================================
 * SERVER-SIDE NOTIFICATION PROXY  (Vercel Serverless Function)
 * POST /api/notify/broadcast
 * ==============================================================================
 *
 * ทำไมต้องมีไฟล์นี้ (สาเหตุที่ LINE ไม่แจ้งเตือน แต่ Telegram แจ้งได้ปกติ):
 *   - Telegram Bot API (api.telegram.org) ส่ง CORS header กลับมา เบราว์เซอร์จึงยิงตรงได้
 *   - LINE Messaging API (api.line.me) **ไม่ส่ง** Access-Control-Allow-Origin
 *     เบราว์เซอร์จะบล็อกตั้งแต่ preflight -> ข้อความไม่เคยถูกส่งออกไปเลย
 *     (ยืนยันแล้วว่า Token ใช้ได้: GET api.line.me/v2/bot/info -> 200, bot = microlabtuh)
 *   => การ push LINE ต้องเรียกจากฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * โปรเจกต์นี้มี netlify/functions/notify.js อยู่แล้วสำหรับ Netlify
 * ไฟล์นี้คือตัวเดียวกันสำหรับ Vercel (ซึ่งไม่อ่านโฟลเดอร์ netlify/functions)
 * frontend/js/notify.js เรียก '/api/notify/broadcast' เป็นอันดับแรกอยู่แล้ว
 *
 * ข้อมูลลับทั้งหมดมาจาก Environment Variables เท่านั้น ไม่มีค่าสำรองในโค้ด:
 *    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, LINE_CHANNEL_ACCESS_TOKEN, LINE_GROUP_ID
 * repo นี้เป็นสาธารณะ การฝังค่าไว้เท่ากับเผยแพร่ และประวัติ git ลบทีหลังได้ยาก
 * ถ้าตั้งไม่ครบ ช่องทางนั้นจะข้ามไปพร้อมบอกเหตุผล ดีกว่าเงียบแล้วหาสาเหตุไม่เจอ
 */


/** LINE รับได้เฉพาะ plain text -> ตัด HTML tag ของ Telegram ทิ้ง และจำกัดความยาว */
function toPlainText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .slice(0, 4900);
}

async function pushTelegram(text, token, chatId) {
  if (!token || !chatId) {
    return { channel: 'Telegram', ok: false, skipped: true, error: 'ยังไม่ได้ตั้งค่า Telegram Token / Chat ID' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    const body = await res.json().catch(() => ({}));
    return { channel: 'Telegram', ok: res.ok && body.ok !== false, status: res.status, error: body.description || null };
  } catch (err) {
    return { channel: 'Telegram', ok: false, error: err.message };
  }
}

/**
 * ตรวจว่า payload ที่ส่งมาเป็น Flex Message ที่ใช้ได้จริงหรือไม่
 * ถ้ารูปแบบผิด LINE จะตอบ 400 แล้วข้อความหายทั้งใบ จึงต้องถอยไปส่งเป็น text แทน
 */
function isValidFlex(flex) {
  return !!(flex && flex.type === 'flex' && typeof flex.altText === 'string' && flex.altText.trim()
    && flex.contents && (flex.contents.type === 'bubble' || flex.contents.type === 'carousel'));
}

async function pushLine(text, token, groupId, flex) {
  if (!token || !groupId) {
    return { channel: 'LINE', ok: false, skipped: true, error: 'ยังไม่ได้ตั้งค่า LINE Token / Group ID' };
  }
  try {
    // ถ้า frontend ส่ง Flex Message มา ให้ส่งเป็นการ์ด ไม่งั้นส่งข้อความธรรมดา
    // altText = ข้อความสำรองที่โชว์ในรายการแชทและอุปกรณ์ที่แสดงการ์ดไม่ได้
    const message = isValidFlex(flex)
      ? { type: 'flex', altText: String(flex.altText).slice(0, 400), contents: flex.contents }
      : { type: 'text', text: toPlainText(text) };

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: groupId, messages: [message] })
    });

    // LINE ตอบ 200 พร้อม body ว่างเมื่อสำเร็จ / ตอบ JSON ที่มี message เมื่อผิดพลาด
    const raw = await res.text();
    let detail = null;
    if (raw) {
      try { detail = JSON.parse(raw).message || null; } catch (_) { detail = raw.slice(0, 300); }
    }
    return { channel: 'LINE', ok: res.ok, status: res.status, error: res.ok ? null : detail };
  } catch (err) {
    return { channel: 'LINE', ok: false, error: err.message };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET = health check ใช้ตรวจว่า proxy ออนไลน์หรือยัง (ไม่ส่งข้อความจริง)
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'tuh-notify-proxy' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const text = body.text;
  if (!text || !String(text).trim()) {
    return res.status(400).json({ success: false, error: 'ต้องระบุฟิลด์ text' });
  }

  // ปลายทางมาจาก Environment Variables เท่านั้น
  // เดิมรับ token จาก request body ได้ด้วย แต่ไม่มีผู้เรียกรายไหนส่งมา
  // และ endpoint นี้เปิดสาธารณะ การรับข้อมูลลับจาก body จึงเป็นช่องทางที่ไม่ควรมี
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChat = process.env.TELEGRAM_CHAT_ID;
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const lineGroup = process.env.LINE_GROUP_ID;

  // body.flex = Flex Message จาก LIFF (frontend/liff/js/liff-flex.js)
  // Telegram ไม่รองรับการ์ด จึงใช้ text เสมอ ส่วน LINE จะได้การ์ดถ้าส่ง flex มา
  const results = await Promise.all([
    pushTelegram(String(text), tgToken, tgChat),
    pushLine(String(text), lineToken, lineGroup, body.flex)
  ]);

  return res.status(200).json({ success: results.some(r => r.ok), results });
};
