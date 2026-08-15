/**
 * ==============================================================================
 * NOTIFICATION MODULE (LINE Notify / Discord / Telegram Webhook)
 * ระบบแจ้งเตือนการออกผลการตรวจวิเคราะห์สิ่งแวดล้อมอัตโนมัติ
 * ==============================================================================
 */

const NotifyService = {
  /**
   * สร้างข้อความแจ้งเตือนมาตรฐานสำหรับผลการตรวจ
   */
  buildMessage(reportData) {
    const isPass = ['pass', 'normal', 'no_growth'].includes(reportData.overall_result?.toLowerCase());
    const resultEmoji = isPass ? '✅ ผ่านเกณฑ์มาตรฐาน' : '⚠️ ตกเกณฑ์ / พบเชื้อปนเปื้อน';
    const currentHost = window.location.origin;
    const reportLink = `${currentHost}/report_view.html?id=${encodeURIComponent(reportData.id || reportData.submission_no)}`;

    let msg = `\n🏥 [TUH Microbiology] แจ้งเตือนผลตรวจสิ่งแวดล้อม\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📄 เลขที่: ${reportData.submission_no}\n`;
    msg += `🔬 บริการ: ${reportData.service_name}\n`;
    msg += `🏢 หน่วยงาน: ${reportData.department}${reportData.ward_room ? ` (${reportData.ward_room})` : ''}\n`;
    msg += `📅 วันที่เก็บ: ${reportData.sampling_date}\n`;
    msg += `📅 วันที่ออกผล: ${reportData.reported_date}\n`;
    msg += `📊 ผลสรุป: ${resultEmoji}\n`;
    msg += `👨‍🔬 ผู้รายงาน: ${reportData.reporter_name}\n`;
    if (reportData.remarks) {
      msg += `📝 หมายเหตุ: ${reportData.remarks}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🔗 ตรวจสอบใบรายงานผลทางการ (PDF):\n${reportData.report_pdf_url || reportLink}`;

    return {
      text: msg,
      isPass,
      link: reportData.report_pdf_url || reportLink
    };
  },

  /**
   * ส่งการแจ้งเตือนผ่านช่องทางที่ตั้งค่าไว้
   * @param {Object} reportData ข้อมูลผลตรวจ
   * @param {Object} options ตัวเลือกเพิ่มเติม
   */
  async sendReportNotification(reportData, options = {}) {
    const config = window.NOTIFY_CONFIG || {};
    if (!config.enabled) {
      console.log('ℹ️ Notification is disabled in settings.');
      return { success: true, message: 'Notification disabled' };
    }

    const { text, isPass, link } = this.buildMessage(reportData);
    const results = [];

    // 1. ส่งผ่าน Discord Webhook (ถ้ามี)
    if (config.discordWebhookUrl && config.discordWebhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      try {
        const discordPayload = {
          username: "TUH Microbiology Alerts",
          avatar_url: "https://img1.pic.in.th/images/core-value-2024.png",
          embeds: [{
            title: `🔬 แจ้งเตือนผลตรวจ: ${reportData.service_name}`,
            description: `หน่วยงาน: **${reportData.department}**\nเลขที่ใบรายงาน: \`${reportData.submission_no}\``,
            color: isPass ? 3066993 : 15158332, // เขียว หรือ แดง
            fields: [
              { name: "📅 วันที่ออกผล", value: reportData.reported_date, inline: true },
              { name: "📊 ผลสรุป", value: isPass ? "✅ ผ่านเกณฑ์" : "⚠️ ตกเกณฑ์ / พบเชื้อ", inline: true },
              { name: "👨‍🔬 ผู้รายงาน", value: reportData.reporter_name, inline: true },
              { name: "📝 หมายเหตุ", value: reportData.remarks || "-" }
            ],
            url: link,
            footer: { text: "TUH Microbiology Environmental Reporting (ISO 15189)" },
            timestamp: new Date().toISOString()
          }]
        };

        const res = await fetch(config.discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload)
        });
        results.push({ channel: 'Discord', ok: res.ok });
      } catch (err) {
        console.warn('Discord notify error:', err);
      }
    }

    // 2. ส่งผ่าน LINE Notify (ผ่าน Proxy Worker เพื่อหลีกเลี่ยง browser CORS)
    if (config.lineNotifyToken && !config.lineNotifyToken.includes('YOUR_LINE_NOTIFY_TOKEN')) {
      try {
        // หากมี Cloudflare Worker proxy
        if (config.lineProxyUrl && !config.lineProxyUrl.includes('your-line-proxy')) {
          const res = await fetch(config.lineProxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: config.lineNotifyToken,
              message: text
            })
          });
          results.push({ channel: 'LINE (Proxy)', ok: res.ok });
        } else {
          console.log('ℹ️ LINE Notify direct call is subject to browser CORS. Please use Cloudflare Worker proxy or Discord Webhook.');
        }
      } catch (err) {
        console.warn('LINE notify error:', err);
      }
    }

    // 3. ส่งผ่าน Telegram Bot (ถ้ามี)
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
        results.push({ channel: 'Telegram', ok: res.ok });
      } catch (err) {
        console.warn('Telegram notify error:', err);
      }
    }

    console.log('📢 Notification dispatched:', results);
    return { success: true, results };
  }
};

window.NotifyService = NotifyService;
