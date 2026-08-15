/**
 * ==============================================================================
 * SUPABASE & NOTIFICATION CONFIGURATION
 * ระบบปฏิทินจองคิวและรายงานผลการตรวจสิ่งแวดล้อม งานจุลชีววิทยา รพ.ธรรมศาสตร์ฯ
 * ==============================================================================
 * 
 * คำแนะนำ:
 * 1. นำ URL และ Anon Key จาก Supabase Dashboard (Project Settings -> API) มาวางในช่องด้านล่าง
 * 2. นำ LINE Notify Access Token หรือ Discord/Telegram Webhook URL มาวางสำหรับระบบแจ้งเตือน
 */

// ==============================================================================
// 1. SUPABASE CREDENTIALS (ใส่ค่าจาก Supabase Project ของท่านที่นี่)
// ==============================================================================
const SUPABASE_CONFIG = {
  // ตัวอย่าง: 'https://xyzcompany.supabase.co'
  url: 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co',
  
  // ตัวอย่าง: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' (anon public key)
  anonKey: 'YOUR_SUPABASE_ANON_PUBLIC_KEY',

  // ชื่อ Storage Bucket สำหรับจัดเก็บไฟล์เอกสารและรูปภาพ
  storageBucket: 'microbiology-files'
};

// ==============================================================================
// 2. NOTIFICATION CONFIGURATION (LINE Notify / Discord / Telegram Webhook)
// ==============================================================================
const NOTIFY_CONFIG = {
  // เปิด/ปิดการแจ้งเตือนเริ่มต้น
  enabled: true,

  // [ตัวเลือกที่ 1] LINE Notify API Token (หรือส่งผ่าน Cloudflare Worker Webhook Proxy)
  // วิธีสร้าง: เข้า https://notify-bot.line.me/ -> My Services -> Generate token
  lineNotifyToken: 'YOUR_LINE_NOTIFY_TOKEN',
  
  // Cloudflare Worker Proxy URL สำหรับแก้ปัญหา CORS เมื่อเรียก LINE Notify จาก Browser โดยตรง
  // หากไม่มี สามารถใช้ Discord Webhook หรือ Telegram Bot แทนได้ทันที
  lineProxyUrl: 'https://your-line-proxy.workers.dev/notify',

  // [ตัวเลือกที่ 2 - แนะนำ ฟรี 100% ไม่ติด CORS] Discord Webhook URL
  // วิธีสร้าง: Discord Server -> Server Settings -> Integrations -> Webhooks -> New Webhook
  discordWebhookUrl: '',

  // [ตัวเลือกที่ 3] Telegram Bot Token & Chat ID
  telegramBotToken: '',
  telegramChatId: ''
};

// ==============================================================================
// 3. INITIALIZE SUPABASE CLIENT
// ==============================================================================
let supabaseClient = null;

const isSupabaseConfigured = () => {
  return SUPABASE_CONFIG.url && 
         !SUPABASE_CONFIG.url.includes('YOUR_SUPABASE_PROJECT_ID') &&
         SUPABASE_CONFIG.anonKey && 
         !SUPABASE_CONFIG.anonKey.includes('YOUR_SUPABASE_ANON_PUBLIC_KEY');
};

if (typeof supabase !== 'undefined' && isSupabaseConfigured()) {
  try {
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    console.log('✅ Supabase Client Initialized Successfully');
  } catch (error) {
    console.error('❌ Supabase Initialization Error:', error);
  }
} else {
  console.warn('⚠️ Supabase credentials have not been configured yet. Running in configuration guide mode.');
}

// Export to Global window object
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.NOTIFY_CONFIG = NOTIFY_CONFIG;
window.supabaseClient = supabaseClient;
window.isSupabaseConfigured = isSupabaseConfigured;
