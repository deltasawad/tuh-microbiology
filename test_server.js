/**
 * เซิร์ฟเวอร์ทดสอบระบบในเครื่อง (Local Test Server)
 * รัน:  node test_server.js      แล้วเปิด http://localhost:4180
 *
 * มี /api/notify/broadcast ให้ด้วย เพื่อให้เส้นทางแจ้งเตือน LINE ทำงานเหมือนบน Vercel
 *
 * โหมดเริ่มต้น = DRY-RUN (ไม่ส่งข้อความจริงเข้ากลุ่ม LINE/Telegram)
 * ถ้าต้องการส่งจริง ให้รันด้วย:   node test_server.js --real
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const REAL = process.argv.includes('--real');
const ROOT = path.join(__dirname, 'frontend');
const PORT = 4180;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.json': 'application/json', '.svg': 'image/svg+xml'
};

const notifyHandler = require('./api/notify/broadcast.js');

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // ---- Notify proxy ----
  if (url === '/api/notify/broadcast' || url === '/api/notify') {
    let raw = '';
    req.on('data', c => (raw += c));
    return req.on('end', async () => {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch (_) {}

      if (!REAL) {
        console.log('[DRY-RUN] ไม่ได้ส่งจริง:', String(body.text || '').slice(0, 80).replace(/\n/g, ' | '));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          results: [
            { channel: 'Telegram', ok: false, error: 'โหมดทดสอบในเครื่อง (DRY-RUN) — ยังไม่ได้ส่งข้อความจริง' },
            { channel: 'LINE',     ok: false, error: 'โหมดทดสอบในเครื่อง (DRY-RUN) — ยังไม่ได้ส่งข้อความจริง' }
          ]
        }));
      }

      // โหมดส่งจริง — ใช้ handler ตัวเดียวกับที่ deploy บน Vercel
      const shim = {
        method: 'POST', body,
        setHeader: () => {},
        status(c) { this._c = c; return this; },
        json(p) { res.writeHead(this._c || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(p)); return this; },
        end() { res.writeHead(this._c || 200); res.end(); return this; }
      };
      await notifyHandler(shim, shim);
    });
  }

  // ---- Static files ----
  let file = path.join(ROOT, url === '/' ? 'index.html' : decodeURIComponent(url));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // เลียนพพฎิกรรมเดียวกบ cleanUrls ของ Vercel:
    //   /liff        -> frontend/liff/index.html   (directory index)
    //   /workflow    -> frontend/workflow.html
    // ถ้าไม่รองรับ directory index หน้า preview จะฝัง /liff ไม่ได้ (404)
    const candidates = [file + '.html', path.join(file, 'index.html')];
    const hit = candidates.find(f => fs.existsSync(f) && fs.statSync(f).isFile());
    if (hit) file = hit;
    else { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('ไม่พบไฟล์: ' + url); }
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log('==================================================');
  console.log('  TUH Microbiology - Local Test Server');
  console.log('==================================================');
  console.log('  เปิดที่:  http://localhost:' + PORT);
  console.log('  แจ้งเตือน: ' + (REAL ? '*** ส่งจริง ***' : 'DRY-RUN (ไม่ส่งจริง)'));
  console.log('  หยุดเซิร์ฟเวอร์: กด Ctrl+C');
  console.log('==================================================');
});
