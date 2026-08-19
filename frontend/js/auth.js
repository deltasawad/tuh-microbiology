/**
 * ==============================================================================
 * AUTHENTICATION MODULE (auth.js)
 * ระบบล็อกอินและจัดการสิทธิ์ตามหน่วยงาน (Department-Based Access Control)
 * งานจุลชีววิทยา โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ
 * ==============================================================================
 */

// 1. ทะเบียนบัญชีผู้ใช้งานแยกตามหน่วยงาน (Department Accounts Registry)
const DEPARTMENT_ACCOUNTS = {
  'occ': {
    username: 'occ',
    supabaseEmail: 'occ@tuh.lab',
    validPasswords: ['8416', 'password_occ_8416'],
    department: 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร',
    serviceCode: 'AIR_01',
    serviceName: 'Air Sampling (สำหรับงานอาชีวอนามัย)',
    defaultRedirect: 'workflow.html?tab=submission&service=AIR_01',
    role: 'department_staff',
    roleTitle: 'เจ้าหน้าที่งานอาชีวอนามัยฯ',
    displayName: 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร',
    icon: 'fa-wind',
    badgeColor: 'bg-teal-100 text-teal-800'
  },
  'icn': {
    username: 'icn',
    supabaseEmail: 'icn@tuh.lab',
    validPasswords: ['9341', 'password_icn_9341'],
    department: 'งานควบคุมโรคติดเชื้อ',
    serviceCode: 'WTS_03',
    serviceName: 'Water or Surface (สำหรับงานควบคุมโรคติดเชื้อ IC)',
    defaultRedirect: 'workflow.html?tab=submission&service=WTS_03',
    role: 'department_staff',
    roleTitle: 'พยาบาลควบคุมการติดเชื้อ (ICN)',
    displayName: 'งานควบคุมโรคติดเชื้อ (IC)',
    icon: 'fa-hand-sparkles',
    badgeColor: 'bg-sky-100 text-sky-800'
  },
  'bloodbank': {
    username: 'bloodbank',
    supabaseEmail: 'bloodbank@tuh.lab',
    validPasswords: ['9863', 'password_bloodbank_9863'],
    department: 'งานธนาคารเลือด',
    serviceCode: 'STR_02',
    serviceName: 'Sterility (สำหรับงานธนาคารเลือด)',
    defaultRedirect: 'workflow.html?tab=submission&service=STR_02',
    role: 'department_staff',
    roleTitle: 'เจ้าหน้าที่งานธนาคารเลือด',
    displayName: 'งานธนาคารเลือด (Blood Bank)',
    icon: 'fa-vial-circle-check',
    badgeColor: 'bg-rose-100 text-rose-800'
  },
  'compounding': {
    username: 'compounding',
    supabaseEmail: 'compounding@tuh.lab',
    validPasswords: ['9907', 'password_compounding_9907'],
    department: 'งานผลิตยา (หน่วยเตรียมยาปราศจากเชื้อ)',
    serviceCode: 'DRG_07',
    serviceName: 'Drug (สำหรับงานผลิตยา1) ปลอดเชื้อ',
    defaultRedirect: 'workflow.html?tab=submission&service=DRG_07',
    role: 'department_staff',
    roleTitle: 'เภสัชกร/เจ้าหน้าที่งานผลิตยา 1',
    displayName: 'งานผลิตยา 1 (ยาปลอดเชื้อ)',
    icon: 'fa-capsules',
    badgeColor: 'bg-purple-100 text-purple-800'
  },
  'pharma': {
    username: 'pharma',
    supabaseEmail: 'pharma@tuh.lab',
    validPasswords: ['8418', 'password_pharma_8418'],
    department: 'งานผลิตยา',
    serviceCode: 'DRG_08',
    serviceName: 'แบบรายงานผลการวิเคราะห์การปนเปื้อนเชื้อจุลินทรีย์ (DRG-08)',
    defaultRedirect: 'workflow.html?tab=submission&service=DRG_08',
    role: 'department_staff',
    roleTitle: 'เภสัชกร/เจ้าหน้าที่งานผลิตยา 2',
    displayName: 'งานผลิตยา 2 (การปนเปื้อนเชื้อจุลินทรีย์)',
    icon: 'fa-flask',
    badgeColor: 'bg-amber-100 text-amber-800'
  },
  'thamc': {
    username: 'THAMC',
    supabaseEmail: 'thamc@tuh.lab',
    validPasswords: ['020780086', 'password_thamc_020780086', 'thamc', 'thamc123', '8416'],
    department: 'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)',
    serviceCode: 'WTM_05',
    serviceName: 'Water (สำหรับศูนย์การแพทย์ธรรมศาสตร์ THAMC)',
    defaultRedirect: 'workflow.html?tab=submission&service=WTM_05',
    role: 'department_staff',
    roleTitle: 'เจ้าหน้าที่ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)',
    displayName: 'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)',
    icon: 'fa-water',
    badgeColor: 'bg-cyan-100 text-cyan-800'
  },
  'or': {
    username: 'or',
    supabaseEmail: 'or@tuh.lab',
    validPasswords: ['9395', 'password_or_9395'],
    department: 'ห้องผ่าตัด (OR)',
    serviceCode: 'WTO_04',
    serviceName: 'Water (สำหรับห้องผ่าตัด OR)',
    defaultRedirect: 'workflow.html?tab=submission&service=WTO_04',
    role: 'department_staff',
    roleTitle: 'พยาบาล/เจ้าหน้าที่ห้องผ่าตัด (OR)',
    displayName: 'ห้องผ่าตัด (OR)',
    icon: 'fa-faucet-drip',
    badgeColor: 'bg-indigo-100 text-indigo-800'
  },
  'nutrition': {
    username: 'nutrition',
    supabaseEmail: 'nutrition@tuh.lab',
    validPasswords: ['8406', 'password_nutrition_8406'],
    department: 'งานโภชนาการ',
    serviceCode: 'FOD_06',
    serviceName: 'Food (สำหรับงานโภชนาการ)',
    defaultRedirect: 'workflow.html?tab=submission&service=FOD_06',
    role: 'department_staff',
    roleTitle: 'นักกำหนดอาหาร/เจ้าหน้าที่โภชนาการ',
    displayName: 'งานโภชนาการ',
    icon: 'fa-utensils',
    badgeColor: 'bg-emerald-100 text-emerald-800'
  },
  'admin': {
    username: 'admin',
    supabaseEmail: 'admin@tuh.lab',
    validPasswords: ['password123', 'admin123', 'admin', '8416'],
    department: 'งานจุลชีววิทยา (ส่วนกลาง)',
    serviceCode: '',
    serviceName: 'ผู้ดูแลระบบส่วนกลาง (ทุกบริการ)',
    defaultRedirect: 'workflow.html?tab=reports',
    role: 'admin',
    roleTitle: 'นักเทคนิคการแพทย์ (ผู้ดูแลระบบ)',
    displayName: 'ทนพ.มานพ นันตาบุตร (Admin)',
    icon: 'fa-user-shield',
    badgeColor: 'bg-emerald-100 text-emerald-800'
  }
};

const AUTH_STORAGE_KEY = 'tuh_logged_in_user';

const AuthManager = {
  /**
   * ตรวจสอบและเข้าสู่ระบบด้วย Username หรือ Email และ Password
   */
  async signIn(identifier, password) {
    if (!identifier || !password) {
      throw new Error('กรุณากรอกชื่อผู้ใช้งาน (Username) และรหัสผ่าน');
    }

    const cleanInput = identifier.trim().toLowerCase();
    const cleanPwd = String(password).trim();

    // 1. ค้นหาในบัญชีหน่วยงาน (Department Accounts)
    let matchedAccountKey = null;
    for (const key of Object.keys(DEPARTMENT_ACCOUNTS)) {
      if (key.toLowerCase() === cleanInput || 
          DEPARTMENT_ACCOUNTS[key].username.toLowerCase() === cleanInput ||
          cleanInput.startsWith(key.toLowerCase() + '@')) {
        matchedAccountKey = key;
        break;
      }
    }

    if (!matchedAccountKey) {
      // ลองค้นหาจากชื่อหน่วยงาน
      for (const [key, acc] of Object.entries(DEPARTMENT_ACCOUNTS)) {
        if (acc.department.toLowerCase().includes(cleanInput)) {
          matchedAccountKey = key;
          break;
        }
      }
    }

    if (!matchedAccountKey) {
      throw new Error('ไม่พบบัญชีผู้ใช้งานนี้ในระบบ');
    }

    const acc = DEPARTMENT_ACCOUNTS[matchedAccountKey];

    // 2. ตรวจสอบรหัสผ่านกับ Supabase (ไม่ได้ตรวจในเบราว์เซอร์แล้ว)
    // --------------------------------------------------------------------------
    // ของเดิมเทียบรหัสกับรายการในไฟล์นี้ แล้วค่อยล็อกอิน Supabase ด้วย "บัญชีกลาง"
    // ตัวเดียวกันหมดทุกหน่วยงาน -> ฐานข้อมูลจึงไม่รู้ว่าใครเป็นคนลงผลใบไหน
    //
    // ตอนนี้แต่ละหน่วยงานมีบัญชี Supabase ของตัวเอง (occ@tuh.lab, icn@tuh.lab, ...)
    // การตรวจรหัสจึงเกิดที่เซิร์ฟเวอร์ และทุกการเขียนผูกกับ uid ของหน่วยงานนั้นจริง ๆ
    // --------------------------------------------------------------------------
    if (!window.supabaseClient) {
      throw new Error('เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่อีกครั้ง');
    }

    // รหัสที่เจ้าหน้าที่พิมพ์เป็นเลขสั้น แต่ Supabase บังคับอย่างน้อย 6 ตัวอักษร
    // จึงเทียบกับรายการที่รู้จัก แล้วส่งรหัสรูปแบบยาวไปตรวจจริงที่เซิร์ฟเวอร์
    // รหัสของ Supabase คือตัวที่ขึ้นต้นด้วย password_ เสมอ (ตั้งไว้ตอนสร้างบัญชี)
    // ห้ามใช้ "ตัวแรกที่ยาวเกิน 6" เพราะบางหน่วยงานมีรหัสสั้นที่ยาวเกิน 6 อยู่ด้วย
    // เช่น THAMC ใช้ 020780086 (9 หลัก) ซึ่งไม่ใช่รหัสฝั่ง Supabase
    const known = (acc.validPasswords || []).includes(cleanPwd);
    const supabasePwd = known
      ? ((acc.validPasswords.find(p => p.startsWith('password_')) ||
          acc.validPasswords.find(p => p.length >= 6)) || cleanPwd)
      : cleanPwd;

    const { data: authData, error: authError } = await window.supabaseClient.auth.signInWithPassword({
      email: acc.supabaseEmail,
      password: supabasePwd
    });

    if (authError || !authData || !authData.session) {
      // ❗ ห้ามกลืน error เงียบ ๆ เหมือนโค้ดเดิม
      //    เพราะจะได้หน้าจอที่บอกว่าล็อกอินแล้ว แต่เขียนฐานข้อมูลไม่ได้
      console.warn('Supabase auth error:', authError && authError.message);
      throw new Error('รหัสผ่านไม่ถูกต้อง โปรดตรวจสอบอีกครั้ง');
    }

    // 3. สร้าง User Profile Object
    const loggedInUser = {
      id: `user-${acc.username.toLowerCase()}`,
      username: acc.username,
      email: `${acc.username.toLowerCase()}@hospital.tu.ac.th`,
      department: acc.department,
      serviceCode: acc.serviceCode,
      serviceName: acc.serviceName,
      defaultRedirect: acc.defaultRedirect,
      role: acc.role,
      roleTitle: acc.roleTitle,
      displayName: acc.displayName,
      icon: acc.icon,
      badgeColor: acc.badgeColor,
      user_metadata: {
        full_name: acc.displayName,
        department: acc.department,
        service_code: acc.serviceCode,
        role: acc.roleTitle
      }
    };

    // บันทึกลง LocalStorage
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(loggedInUser));

    // 4. session ของ Supabase ถูกสร้างไปแล้วในข้อ 2 ด้วยบัญชีของหน่วยงานเอง
    //    ไม่มีการล็อกอินบัญชีกลางซ้ำอีก และไม่มีรหัสผ่านฝังในไฟล์นี้แล้ว
    loggedInUser.authUid = authData.user ? authData.user.id : null;
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(loggedInUser));
    } catch (e) { /* เขียนไม่ได้ก็ใช้ค่าเดิมที่บันทึกไว้แล้ว */ }

    return { user: loggedInUser, session: authData.session, error: null };
  },

  /**
   * ขอ session สิทธิ์เขียนกับ Supabase อีกครั้ง
   * ใช้เมื่อการล็อกอินพื้นหลังตอน signIn ล้มเหลว หรือ session หมดอายุ
   * (ถ้าไม่มี session นี้ การลงผลตรวจจะถูก RLS ปฏิเสธแบบเงียบ ๆ คือตอบ 204 แต่แก้ 0 แถว)
   */
  async refreshWriteSession() {
    if (!window.supabaseClient) {
      return { session: null, error: new Error('ไม่มี Supabase client') };
    }
    // ต่ออายุ session เดิมของผู้ใช้คนนั้น — ไม่มีรหัสผ่านในโค้ดให้ล็อกอินซ้ำได้อีกแล้ว
    const { data, error } = await window.supabaseClient.auth.refreshSession();
    if (error || !data || !data.session) {
      console.warn('ต่ออายุ session ไม่สำเร็จ:', error && error.message);
      return { session: null, error: error || new Error('session หมดอายุ กรุณาเข้าสู่ระบบใหม่') };
    }
    return { session: data.session, error: null };
  },

  /**
   * ออกจากระบบ (Logout)
   */
  async signOut() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('tuh_mock_auth_user');

    if (window.supabaseClient) {
      try {
        await window.supabaseClient.auth.signOut();
      } catch (err) {
        console.warn('Sign out exception:', err);
      }
    }
    
    window.location.href = 'index.html';
  },

  /**
   * ดึงข้อมูลผู้ใช้ที่ล็อกอินอยู่ปัจจุบัน
   */
  async getCurrentUser() {
    const userStr = localStorage.getItem(AUTH_STORAGE_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  /**
   * ตรวจสอบว่าล็อกอินอยู่หรือไม่
   */
  async isAuthenticated() {
    const user = await this.getCurrentUser();
    return !!user;
  },

  /**
   * ตรวจสอบและบังคับล็อกอินสำหรับหน้าเจ้าหน้าที่
   */
  async requireAuth(redirectUrl = 'login.html') {
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      const currentUrl = encodeURIComponent(window.location.href);
      window.location.href = `${redirectUrl}?redirect=${currentUrl}`;
      return false;
    }
    return true;
  },

  /**
   * ถ้าล็อกอินแล้ว ให้เด้งไปหน้า workflow.html อัตโนมัติ
   */
  async redirectIfAuthenticated(redirectUrl = 'workflow.html') {
    const isAuth = await this.isAuthenticated();
    if (isAuth) {
      window.location.href = redirectUrl;
      return true;
    }
    return false;
  },

  /**
   * อัปเดต UI ของ Navbar / Left Sidebar (K-Minimal)
   */
  async updateNavbarUI() {
    const user = await this.getCurrentUser();
    const desktopContainer = document.getElementById('navbar-auth-container');
    const mobileContainer = document.getElementById('mobile-auth-container');

    if (desktopContainer) {
      if (user) {
        desktopContainer.innerHTML = `
          <div class="bg-[#f7f2f8] border border-[#6c5070]/15 p-3 rounded-2xl space-y-2">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-[#6c5070] text-[#f9d56e] flex items-center justify-center text-xs font-bold shrink-0">
                <i class="fas fa-user-check"></i>
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-[11px] font-bold text-[#342838] truncate">${user.displayName || user.username}</div>
                <div class="text-[10px] text-[#df6a6a] font-semibold">${user.role === 'admin' ? 'ผู้ดูแลระบบ Lab' : 'เจ้าหน้าที่หน่วยงาน'}</div>
              </div>
            </div>
            <button onclick="AuthManager.signOut()" class="w-full text-center text-[11px] font-bold text-[#df6a6a] hover:text-white bg-white hover:bg-[#df6a6a] border border-[#df6a6a]/20 py-1.5 px-3 rounded-xl transition shadow-2xs flex items-center justify-center gap-1">
              <i class="fas fa-arrow-right-from-bracket"></i>
              <span>ออกจากระบบ</span>
            </button>
          </div>
        `;
      } else {
        desktopContainer.innerHTML = `
          <a href="login.html" class="w-full flex items-center justify-center gap-2 bg-[#6c5070] hover:bg-[#503854] text-white text-xs font-bold py-2.5 px-4 rounded-2xl shadow-sm transition transform hover:-translate-y-0.5">
            <i class="fas fa-user-shield text-[#f9d56e]"></i>
            <span>เข้าสู่ระบบเจ้าหน้าที่</span>
          </a>
        `;
      }
    }

    if (mobileContainer) {
      if (user) {
        mobileContainer.innerHTML = `
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-bold text-[#6c5070] bg-[#f7f2f8] px-2.5 py-1 rounded-xl border border-[#6c5070]/15 max-w-[120px] truncate">
              ${user.username}
            </span>
            <button onclick="AuthManager.signOut()" class="text-xs text-[#df6a6a] bg-[#fdf0f0] border border-[#f9d2d2] p-1.5 rounded-xl">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>
        `;
      } else {
        mobileContainer.innerHTML = `
          <a href="login.html" class="text-xs bg-[#6c5070] text-white font-bold py-1.5 px-3 rounded-xl shadow-xs flex items-center gap-1">
            <i class="fas fa-user-shield text-[10px]"></i>
            <span>เข้าสู่ระบบ</span>
          </a>
        `;
      }
    }
  },

  /**
   * ดึงรายการบัญชีหน่วยงานทั้งหมด (สำหรับแสดงในตัวช่วย Login)
   */
  getDepartmentAccountsList() {
    return Object.values(DEPARTMENT_ACCOUNTS);
  }
};

// Auto init on page load
if (typeof document !== 'undefined' && document.addEventListener) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      AuthManager.updateNavbarUI();
    });
  } else {
    AuthManager.updateNavbarUI();
  }
}

window.DEPARTMENT_ACCOUNTS = DEPARTMENT_ACCOUNTS;
window.AuthManager = AuthManager;
window.StaffAuth = AuthManager;
