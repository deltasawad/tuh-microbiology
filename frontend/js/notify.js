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
      telegramBotToken: 'REMOVED__USE_ENV_TELEGRAM_BOT_TOKEN',
      telegramChatId: '-5294922475',
      lineAccessToken: 'REMOVED__USE_ENV_LINE_CHANNEL_ACCESS_TOKEN',
      lineGroupId: 'C087508cdd6240cfd4c6358d8a88fcaaa'
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

    // 1. ส่งผ่าน Telegram Bot API
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

    // 2. ส่งผ่าน LINE Messaging API (Push to Group)
    if (config.lineAccessToken && config.lineGroupId) {
      try {
        const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.lineAccessToken}`
          },
          body: JSON.stringify({
            to: config.lineGroupId,
            messages: [{
              type: 'text',
              text: text.replace(/<[^>]*>?/gm, '') // Strip HTML tags for LINE
            }]
          })
        });
        results.push({ channel: 'LINE', ok: lineRes.ok, status: lineRes.status });
        console.log('💬 LINE Push Notify Dispatched:', lineRes.ok);
      } catch (err) {
        console.warn('LINE notify error:', err);
        results.push({ channel: 'LINE', ok: false, error: err.message });
      }
    }

    return { success: true, results };
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

    return await this.broadcastMessage(text);
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
📧 <b>อีเมลรับผล:</b> ${subData.recipient_email || '-'}
⏳ <b>สถานะ:</b> รอตรวจ (Waiting for testing)
━━━━━━━━━━━━━━━━━━━━━
🌐 ดูรายละเอียดในระบบ: ${window.location.origin}/workflow.html?tab=reports`;

    return await this.broadcastMessage(text);
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

    return await this.broadcastMessage(text);
  }
};

window.NotifyService = NotifyService;
