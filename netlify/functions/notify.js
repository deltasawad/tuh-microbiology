const https = require('https');

exports.handler = async function(event, context) {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const text = body.text || 'TUH Microbiology Notification';
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const lineGroupId = process.env.LINE_GROUP_ID;
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;

  const results = [];

  // 1. Send Telegram
  if (tgToken && tgChatId) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: text,
          parse_mode: 'HTML'
        })
      });
      const tgData = await tgRes.json();
      results.push({ channel: 'Telegram', ok: tgData.ok });
    } catch (e) {
      results.push({ channel: 'Telegram', ok: false, error: e.message });
    }
  }

  // 2. Send LINE
  if (lineToken && lineGroupId) {
    try {
      const cleanText = text.replace(/<[^>]*>?/gm, '');
      const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${lineToken}`
        },
        body: JSON.stringify({
          to: lineGroupId,
          messages: [{ type: 'text', text: cleanText }]
        })
      });
      results.push({ channel: 'LINE', ok: lineRes.ok, status: lineRes.status });
    } catch (e) {
      results.push({ channel: 'LINE', ok: false, error: e.message });
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, results })
  };
};
