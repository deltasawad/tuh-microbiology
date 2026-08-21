/**
 * ==============================================================================
 * NOTIFICATION MODULE (notify.js)
 * ระบบแจ้งเตือนอัตโนมัติผ่าน Telegram Bot & LINE Messaging API
 * งานจุลชีววิทยา โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ
 * ==============================================================================
 */

const NotifyService = {
  /**
   * ดึงการตั้งค่า Token & Chat/Group IDs
   */
  getConfig() {
    return window.NOTIFY_CONFIG || {
      enabled: true,
      telegramBotToken: '',
      telegramChatId: '',
      lineAccessToken: '',
      lineGroupId: ''
    };
  },

  /**
   * ส่งข้อความทั่วไปผ่าน Telegram และ LINE พร้อมกัน
   */
  async broadcastMessage(text, options = {}) {
    const config = this.getConfig();
    if (!config.enabled) {
      console.log('ℹ️ Notification is disabled.');
      return { success: true };
    }

    const results = [];

    // 0. ลองส่งผ่าน Backend Proxy API ก่อน เพื่อหลีกเลี่ยงข้อจำกัด CORS ของ LINE API
    try {
      const backendUrls = [
        '/api/notify/broadcast',
        'http://127.0.0.1:8001/api/notify/broadcast',
        'http://localhost:8001/api/notify/broadcast',
        '/.netlify/functions/notify',
        'http://127.0.0.1:8000/api/notify/broadcast',
        'http://localhost:8000/api/notify/broadcast'
      ];

      for (const bUrl of backendUrls) {
        try {
          const proxyRes = await fetch(bUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // ส่งเฉพาะข้อความ ไม่ส่ง token ใด ๆ จากฝั่งเบราว์เซอร์
            // token ทั้งหมดอยู่ใน Environment Variables ฝั่งเซิร์ฟเวอร์เท่านั้น
            // event บอกเซิร์ฟเวอร์ว่าเป็นเหตุการณ์อะไร
            // เซิร์ฟเวอร์เป็นคนตัดสินว่าจะส่งเข้า LINE ด้วยไหม (ปัจจุบันเฉพาะ booking)
            body: JSON.stringify({ text: text, event: options.event || 'other' }),
            signal: AbortSignal.timeout(4000)
          });
          if (proxyRes.ok) {
            const proxyData = await proxyRes.json();
            console.log('🚀 Notification dispatched via backend proxy:', proxyData);
            return { success: true, results: proxyData.results || [] };
          }
        } catch (e) {
          // Continue to next URL or direct fallback
        }
      }
    } catch (proxyErr) {
      console.log('Backend proxy unavailable, falling back to direct delivery');
    }

    // 1. Telegram (Direct) — ใช้ได้เฉพาะกรณีที่ตั้ง token ไว้ใน NOTIFY_CONFIG เอง
    //    ปกติจะไม่มี token ฝั่งเบราว์เซอร์แล้ว จึงข้ามไปโดยอัตโนมัติ
    if (config.telegramBotToken && config.telegramChatId) {
      try {
        const tgUrl = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
        const res = await fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: config.telegramChatId,
            text: text,
            parse_mode: 'HTML'
          })
        });
        const tgResult = await res.json();
        results.push({ channel: 'Telegram', ok: tgResult.ok, detail: tgResult });
        console.log('✈️ Telegram Notify Dispatched:', tgResult.ok);
      } catch (err) {
        console.warn('Telegram notify error:', err);
        results.push({ channel: 'Telegram', ok: false, error: err.message });
      }
    }

    // 2. LINE Messaging API — ยิงตรงจากเบราว์เซอร์ "ไม่ได้"
    //    api.line.me ไม่ส่ง Access-Control-Allow-Origin กลับมา เบราว์เซอร์จึงบล็อก
    //    ตั้งแต่ preflight ข้อความไม่เคยถูกส่งออกไปเลย (ยืนยันแล้วว่า Token ใช้งานได้ปกติ:
    //    GET https://api.line.me/v2/bot/info -> 200 OK, bot = microlabtuh)
    //    => ต้องส่งผ่าน proxy ฝั่งเซิร์ฟเวอร์ที่ /api/notify/broadcast เท่านั้น
    //    (ไฟล์ api/notify/broadcast.js สำหรับ Vercel, netlify/functions/notify.js สำหรับ Netlify)
    if (config.lineAccessToken && config.lineGroupId) {
      results.push({
        channel: 'LINE',
        ok: false,
        error: 'ส่ง LINE จากเบราว์เซอร์โดยตรงไม่ได้ (ถูก CORS บล็อก) — ต้อง deploy proxy /api/notify/broadcast หรือเปิดเว็บผ่านเซิร์ฟเวอร์ที่มี proxy'
      });
      console.warn('💬 LINE: ' + results[results.length - 1].error);
    }

    if (results.length === 0) {
      results.push({
        channel: 'ทั้งหมด',
        ok: false,
        error: 'ติดต่อ /api/notify/broadcast ไม่ได้ และไม่มี token ฝั่งเบราว์เซอร์ (ถูกย้ายไป Environment Variables แล้ว) — ต้องเปิดเว็บผ่านเซิร์ฟเวอร์ที่ deploy serverless function ไว้'
      });
    }

    // ❗ เดิม return success: true เสมอ ทำให้หน้าจอขึ้นว่าแจ้งเตือนสำเร็จทั้งที่ LINE ไม่เคยส่งออกไป
    return { success: results.some(r => r.ok), results };
  },

  /** แปลงผลการส่งเป็นข้อความสั้น ๆ สำหรับแสดงบนหน้าจอ */
  summarize(result) {
    if (!result || !result.results || result.results.length === 0) return 'ไม่ได้ส่งการแจ้งเตือน';
    return result.results
      .map(r => `${r.channel}: ${r.ok ? 'ส่งสำเร็จ ✅' : 'ส่งไม่สำเร็จ ⚠️'}`)
      .join(' • ');
  },

  /**
   * 1. แจ้งเตือนเมื่อมีการจองวันส่งตรวจในปฏิทิน (Booking Alert)
   */
  async sendBookingNotification(bookingData) {
    const text = 
`🏥 <b>[TUH Microbiology Alert]</b>
📅 <b>มีการจองวันส่งตรวจใหม่!</b>
━━━━━━━━━━━━━━━━━━━━━
🔬 <b>บริการ:</b> ${bookingData.service_name || bookingData.service_code || '-'}
🏢 <b>หน่วยงาน:</b> ${bookingData.department || '-'}
👤 <b>ผู้ส่งตรวจ:</b> ${bookingData.sender_name || '-'} (โทร: ${bookingData.contact_number || '-'})
📆 <b>วันที่นัดหมาย:</b> ${bookingData.booking_date || '-'}
📦 <b>จำนวนสิ่งส่งตรวจ:</b> ${bookingData.sample_count || 1} ตัวอย่าง
📝 <b>หมายเหตุ/จุดตรวจ:</b> ${bookingData.notes || '-'}
━━━━━━━━━━━━━━━━━━━━━
🌐 ระบบส่งตรวจและรายงานผล: ${window.location.origin}/workflow.html`;

    // การจองคิวเป็นเหตุการณ์เดียวที่ส่งเข้ากลุ่ม LINE ด้วย
    return await this.broadcastMessage(text, { event: 'booking' });
  },

  /**
   * 2. แจ้งเตือนเมื่อได้รับตัวอย่างส่งตรวจ (Sample Submission Alert)
   */
  async sendSubmissionNotification(subData) {
    const text = 
`🏥 <b>[TUH Microbiology Alert]</b>
📥 <b>ได้รับสิ่งส่งตรวจเข้าระบบแล้ว (รอตรวจ)</b>
━━━━━━━━━━━━━━━━━━━━━
📄 <b>เลขที่ใบส่งตรวจ:</b> ${subData.submission_no}
🔬 <b>บริการ:</b> ${subData.service_name}
🏢 <b>หน่วยงาน:</b> ${subData.department}
📍 <b>สถานที่วางเพลต/จุดตรวจ:</b> ${subData.ward_room || subData.department}
📅 <b>วันที่เก็บตัวอย่าง:</b> ${subData.sampling_date}
📦 <b>จำนวนตัวอย่าง:</b> ${subData.sample_count || (subData.items ? subData.items.length : 1)} รายการ
⏳ <b>สถานะ:</b> รอตรวจ (Waiting for testing)
━━━━━━━━━━━━━━━━━━━━━
🌐 ดูรายละเอียดในระบบ: ${window.location.origin}/workflow.html?tab=reports`;

    return await this.broadcastMessage(text, { event: 'submission' });
  },

  /**
   * 3. แจ้งเตือนเมื่อออกผลตรวจและอนุมัติผลเรียบร้อย (Result Report Alert)
   */
  async sendReportNotification(reportData) {
    const isPass = ['pass', 'normal', 'no_growth', 'tested', 'completed'].includes(reportData.overall_result?.toLowerCase());
    const resultEmoji = isPass ? '✅ ผ่านเกณฑ์มาตรฐาน (Pass)' : '⚠️ ตกเกณฑ์ / พบเชื้อปนเปื้อน (Fail)';
    const reportLink = `${window.location.origin}/report_view.html?id=${encodeURIComponent(reportData.id || reportData.submission_no)}`;

    const text = 
`🏥 <b>[TUH Microbiology Alert]</b>
📋 <b>รายงานผลการตรวจวิเคราะห์สิ่งแวดล้อม</b>
━━━━━━━━━━━━━━━━━━━━━
📄 <b>เลขที่:</b> ${reportData.submission_no || reportData.id}
🔬 <b>บริการ:</b> ${reportData.service_name}
🏢 <b>หน่วยงาน:</b> ${reportData.department}
📍 <b>สถานที่:</b> ${reportData.ward_room || reportData.department}
📅 <b>วันที่ออกผล:</b> ${reportData.reported_date || new Date().toLocaleDateString('th-TH')}
📊 <b>ผลสรุป:</b> ${resultEmoji}
👨‍🔬 <b>ผู้รายงานผล:</b> ${reportData.reporter_name || 'ทนพ.มานพ นันตาบุตร'}
📝 <b>ข้อคิดเห็น:</b> ${reportData.remarks || 'ผลการตรวจวิเคราะห์อยู่ในเกณฑ์มาตรฐานความปลอดภัยทางชีวภาพ'}
━━━━━━━━━━━━━━━━━━━━━
📄 <b>เปิดดูใบรายงานผลทางการ (PDF):</b>
${reportData.report_pdf_url || reportLink}`;

    return await this.broadcastMessage(text, { event: 'result' });
  }
};

window.NotifyService = NotifyService;
