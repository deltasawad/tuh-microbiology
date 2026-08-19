/**
 * ==============================================================================
 * LINE FLEX MESSAGE BUILDER + SENDER  (liff-flex.js)
 * ==============================================================================
 *
 * ทำไมต้องส่งผ่านเซิร์ฟเวอร์:
 *   api.line.me ไม่ส่ง header Access-Control-Allow-Origin กลับมา
 *   เบราว์เซอร์จึงบล็อกตั้งแต่ preflight — ยิงตรงจากหน้าเว็บไม่มีทางสำเร็จ
 *   และถ้ายิงตรงได้ ก็แปลว่า Channel Access Token ต้องอยู่ในโค้ดฝั่งผู้ใช้ ซึ่งอันตราย
 *   => ทุกข้อความส่งผ่าน POST /api/notify/broadcast (api/notify/broadcast.js)
 *
 * โหมด MOCK:
 *   ถ้าติดต่อ proxy ไม่ได้ (เช่น เปิดไฟล์แบบ file:// หรือยังไม่ได้ deploy)
 *   จะไม่ throw แต่จะพิมพ์ JSON ของ Flex Message ลง console แล้วคืน mocked:true
 *   ทำให้ทดสอบ flow ได้ครบโดยไม่ต้องมี LINE จริง
 */

const LiffFlex = {
  BRAND: '#6c5070',
  LAB_NAME: 'งานจุลชีววิทยา รพ.ธรรมศาสตร์เฉลิมพระเกียรติ',

  /** แถวข้อมูล 1 บรรทัดในการ์ด (ป้ายซ้าย / ค่าขวา) */
  row(label, value, opts = {}) {
    return {
      type: 'box',
      layout: 'baseline',
      spacing: 'sm',
      contents: [
        { type: 'text', text: label, color: '#9aa0a6', size: 'sm', flex: 4 },
        {
          type: 'text',
          text: String(value == null || value === '' ? '-' : value),
          wrap: true,
          size: 'sm',
          flex: 7,
          color: opts.color || '#333333',
          weight: opts.bold ? 'bold' : 'regular'
        }
      ]
    };
  },

  /** โครงการ์ดมาตรฐาน: แถบสีหัวเรื่อง + เนื้อหา + ปุ่มท้ายการ์ด */
  bubble({ headerText, headerColor, title, rows, footerLabel, footerUri, note }) {
    const body = {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        { type: 'text', text: title, weight: 'bold', size: 'md', wrap: true, color: '#111111' },
        { type: 'separator', margin: 'md' },
        { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: rows }
      ]
    };

    if (note) {
      body.contents.push({
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        backgroundColor: '#f7f2f8',
        cornerRadius: 'md',
        paddingAll: '10px',
        contents: [{ type: 'text', text: note, size: 'xs', color: '#6c5070', wrap: true }]
      });
    }

    const bubble = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerColor || this.BRAND,
        paddingAll: '14px',
        contents: [
          { type: 'text', text: headerText, color: '#ffffff', weight: 'bold', size: 'sm' },
          { type: 'text', text: this.LAB_NAME, color: '#ffffffcc', size: 'xxs', wrap: true }
        ]
      },
      body
    };

    if (footerUri) {
      bubble.footer = {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'button',
          style: 'primary',
          height: 'sm',
          color: headerColor || this.BRAND,
          action: { type: 'uri', label: footerLabel || 'เปิดดูในระบบ', uri: footerUri }
        }]
      };
    }

    return bubble;
  },

  /** 1. การ์ดแจ้งเตือน "มีการจองคิวใหม่" */
  buildBookingFlex(b) {
    const svc = (window.LIFF_SERVICES || {})[b.service_code] || {};
    return this.bubble({
      headerText: '📅 มีการจองคิวส่งตรวจใหม่',
      headerColor: '#6c5070',
      title: `${svc.icon || '🔬'} ${svc.short || b.service_code} · ${svc.name || b.service_name}`,
      rows: [
        this.row('วันที่นัดหมาย', b.booking_date_th || b.booking_date, { bold: true, color: '#6c5070' }),
        this.row('หน่วยงาน', b.department),
        this.row('ผู้จอง', b.sender_name),
        this.row('ผ่าน LINE', b.line_display_name || '-'),
        this.row('เบอร์ติดต่อ', b.contact_number),
        this.row('จำนวนตัวอย่าง', `${b.sample_count || 1} ตัวอย่าง`, { bold: true }),
        this.row('หมายเหตุ', b.notes)
      ],
      footerLabel: 'เปิดระบบส่งตรวจ',
      footerUri: b.link || (location.origin + '/workflow.html')
    });
  },

  /** 2. การ์ดแจ้งเตือน "ได้รับสิ่งส่งตรวจแล้ว รอตรวจ" */
  buildSubmissionFlex(s) {
    const svc = (window.LIFF_SERVICES || {})[s.service_code] || {};
    return this.bubble({
      headerText: '📥 รับสิ่งส่งตรวจเข้าระบบแล้ว',
      headerColor: '#b45309',
      title: `${svc.icon || '🔬'} ${s.submission_no}`,
      rows: [
        this.row('บริการ', `${svc.short || s.service_code} ${svc.name || s.service_name}`),
        this.row('หน่วยงาน', s.department),
        this.row('จุดเก็บตัวอย่าง', s.ward_room),
        this.row('วันที่เก็บ', s.sampling_date_th || s.sampling_date),
        this.row('จำนวนรายการ', `${s.item_count} รายการ`, { bold: true }),
        this.row('สถานะ', '⏳ รอตรวจ', { bold: true, color: '#b45309' }),
        this.row('ผู้ส่งผ่าน LINE', s.line_display_name || '-')
      ],
      note: 'ผลจะออกภายใน 3–5 วันทำการ ระบบจะแจ้งกลับทาง LINE เมื่อห้องปฏิบัติการลงผลเรียบร้อย',
      footerLabel: 'ลงผลตรวจ (เจ้าหน้าที่)',
      footerUri: s.link || (location.origin + '/liff/admin.html')
    });
  },

  /** 3. การ์ดแจ้งเตือน "ผลตรวจออกแล้ว" */
  buildResultFlex(r) {
    const svc = (window.LIFF_SERVICES || {})[r.service_code] || {};
    const pass = !r.has_fail;
    return this.bubble({
      headerText: pass ? '✅ ผลตรวจออกแล้ว — ผ่านเกณฑ์' : '⚠️ ผลตรวจออกแล้ว — พบเชื้อ',
      headerColor: pass ? '#047857' : '#be123c',
      title: `${svc.icon || '🔬'} ${r.submission_no}`,
      rows: [
        this.row('บริการ', `${svc.short || r.service_code} ${svc.name || r.service_name}`),
        this.row('หน่วยงาน', r.department),
        this.row('วันที่ออกผล', r.reported_date_th || r.reported_date),
        this.row('รายการที่ตรวจ', `${r.item_count} รายการ`),
        this.row('ผลสรุป', pass ? 'ผ่านเกณฑ์มาตรฐาน' : 'ตกเกณฑ์ / พบเชื้อปนเปื้อน', {
          bold: true,
          color: pass ? '#047857' : '#be123c'
        }),
        this.row('ผู้รายงานผล', r.reporter_name || 'ทนพ.มานพ นันตาบุตร'),
        this.row('ผู้อนุมัติผล', r.approver_name || 'ทนพญ.ปราญชลี หรั่งอ่อน')
      ],
      note: pass ? null : 'กรุณาทบทวนกระบวนการทำความสะอาด/ปลอดเชื้อ และประสานงานจุลชีววิทยาเพื่อวางแผนตรวจซ้ำ',
      footerLabel: 'เปิดใบรายงานผล',
      footerUri: r.link || (location.origin + '/report_view.html?id=' + encodeURIComponent(r.submission_no))
    });
  },

  /** แปลง Flex เป็นข้อความล้วน เผื่อ proxy รุ่นเก่าที่รับเฉพาะ text */
  flexToPlainText(bubble, altText) {
    const lines = [altText, ''];
    const walk = (node) => {
      if (!node) return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (node.type === 'text' && node.text) lines.push(node.text);
      if (node.contents) walk(node.contents);
      ['header', 'body', 'footer'].forEach(k => node[k] && walk(node[k]));
    };
    walk(bubble);
    return lines.join('\n').slice(0, 4900);
  },

  /**
   * ส่ง Flex Message เข้ากลุ่ม LINE ของห้องแล็บ
   *
   * ⚠️ ฟังก์ชันนี้ "ไม่ throw" โดยเด็ดขาด — การแจ้งเตือนล้มเหลวต้องไม่ทำให้
   *    การบันทึกข้อมูลของผู้ใช้ล้มเหลวตามไปด้วย
   *
   * @returns {Promise<{ok:boolean, mocked:boolean, channel:string, detail:any}>}
   */
  async sendToLabGroup(bubble, altText) {
    const payload = {
      // ส่งทั้ง flex และ text: proxy รุ่นใหม่จะใช้ flex, รุ่นเก่าจะใช้ text
      flex: { type: 'flex', altText: altText, contents: bubble },
      altText: altText,
      text: this.flexToPlainText(bubble, altText)
    };

    const endpoints = (window.LIFF_CONFIG && window.LIFF_CONFIG.notifyEndpoints) || ['/api/notify/broadcast'];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) continue;
        const data = await res.json().catch(() => ({}));
        console.log('🚀 Flex message dispatched via', url, data);
        return { ok: data.success !== false, mocked: false, channel: url, detail: data };
      } catch (err) {
        // ลอง endpoint ถัดไป
      }
    }

    // ---- MOCK MODE ----------------------------------------------------------
    // ติดต่อ proxy ไม่ได้: จำลองการส่งเพื่อให้ flow ทำงานต่อได้และตรวจสอบ JSON ได้
    console.group('%c[MOCK] LINE Flex Message → กลุ่มห้องแล็บ', 'color:#6c5070;font-weight:bold');
    console.log('altText:', altText);
    console.log('payload:', JSON.stringify(payload.flex, null, 2));
    console.info('ยังไม่ได้ส่งจริง — deploy /api/notify/broadcast แล้วจะส่งเข้ากลุ่มอัตโนมัติ');
    console.groupEnd();

    return { ok: false, mocked: true, channel: 'mock', detail: payload.flex };
  }
};

window.LiffFlex = LiffFlex;
