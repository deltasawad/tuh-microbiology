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
  url: 'https://tgctyouhzsyizlosrmqh.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnY3R5b3VoenN5aXpsb3NybXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NjYyNzAsImV4cCI6MjEwMjI0MjI3MH0.mlba06N1LhjT9vwNBhVrhMlxvjvO7QsRjArI6ue7Pv0',
  storageBucket: 'microbiology-files'
};

// ==============================================================================
// 2. NOTIFICATION CONFIGURATION (LINE Messaging API & Telegram Bot)
// ==============================================================================
const NOTIFY_CONFIG = {
  // เปิด/ปิดการแจ้งเตือนเริ่มต้น
  enabled: true,

  // [ตัวเลือกที่ 1] LINE Messaging API Channel Access Token & Group ID
  lineAccessToken: '',
  lineGroupId: '',
  
  // [ตัวเลือกที่ 2] Discord Webhook URL (ทางเลือกเสริม)
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
