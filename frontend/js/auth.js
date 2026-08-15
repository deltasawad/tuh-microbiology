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
    validPasswords: ['8416', 'password_occ_8416'],
    department: 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร',
    serviceCode: 'AIR_01',
    serviceName: 'Air Sampling (สำหรับงานอาชีวอนามัย)',
    role: 'department_staff',
    roleTitle: 'เจ้าหน้าที่งานอาชีวอนามัยฯ',
    displayName: 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร',
    icon: 'fa-wind',
    badgeColor: 'bg-teal-100 text-teal-800'
  },
  'icn': {
    username: 'icn',
    validPasswords: ['9341', 'password_icn_9341'],
    department: 'งานควบคุมโรคติดเชื้อ',
    serviceCode: 'WTS_03',
    serviceName: 'Water or Surface (สำหรับงานควบคุมโรคติดเชื้อ IC)',
    role: 'department_staff',
    roleTitle: 'พยาบาลควบคุมการติดเชื้อ (ICN)',
    displayName: 'งานควบคุมโรคติดเชื้อ (IC)',
    icon: 'fa-hand-sparkles',
    badgeColor: 'bg-sky-100 text-sky-800'
  },
  'bloodbank': {
    username: 'bloodbank',
    validPasswords: ['9863', 'password_bloodbank_9863'],
    department: 'งานธนาคารเลือด',
    serviceCode: 'STR_02',
    serviceName: 'Sterility (สำหรับงานธนาคารเลือด)',
    role: 'department_staff',
    roleTitle: 'เจ้าหน้าที่งานธนาคารเลือด',
    displayName: 'งานธนาคารเลือด (Blood Bank)',
    icon: 'fa-vial-circle-check',
    badgeColor: 'bg-rose-100 text-rose-800'
  },
  'compounding': {
    username: 'compounding',
    validPasswords: ['9907', 'password_compounding_9907'],
    department: 'งานผลิตยา (หน่วยเตรียมยาปราศจากเชื้อ)',
    serviceCode: 'DRG_07',
    serviceName: 'Drug (สำหรับงานผลิตยา1) ปลอดเชื้อ',
    role: 'department_staff',
    roleTitle: 'เภสัชกร/เจ้าหน้าที่งานผลิตยา 1',
    displayName: 'งานผลิตยา 1 (ยาปลอดเชื้อ)',
    icon: 'fa-capsules',
    badgeColor: 'bg-purple-100 text-purple-800'
  },
  'nutrition': {
    username: 'nutrition',
    validPasswords: ['8406', 'password_nutrition_8406'],
    department: 'งานโภชนาการ',
    serviceCode: 'FOD_06',
    serviceName: 'Food (สำหรับงานโภชนาการ)',
    role: 'department_staff',
    roleTitle: 'นักกำหนดอาหาร/เจ้าหน้าที่โภชนาการ',
    displayName: 'งานโภชนาการ',
    icon: 'fa-utensils',
    badgeColor: 'bg-emerald-100 text-emerald-800'
  },
  'pharma': {
    username: 'pharma',
    validPasswords: ['8418', 'password_pharma_8418'],
    department: 'งานผลิตยา',
    serviceCode: 'DRG_08',
    serviceName: 'Drug (สำหรับงานผลิตยา2) การปนเปื้อนเชื้อจุลินทรีย์',
    role: 'department_staff',
    roleTitle: 'เภสัชกร/เจ้าหน้าที่งานผลิตยา 2',
    displayName: 'ผลิตยา 2 (การปนเปื้อนในยา)',
    icon: 'fa-prescription-bottle-medical',
    badgeColor: 'bg-amber-100 text-amber-800'
  },
  'thamc': {
    username: 'THAMC',
    validPasswords: ['020780086', 'password_thamc_020780086'],
    department: 'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)',
    serviceCode: 'WTM_05',
    serviceName: 'Water (สำหรับศูนย์การแพทย์ธรรมศาสตร์ THAMC)',
    role: 'department_staff',
    roleTitle: 'เจ้าหน้าที่ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)',
    displayName: 'ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)',
    icon: 'fa-water',
    badgeColor: 'bg-cyan-100 text-cyan-800'
  },
  'or': {
    username: 'or',
    validPasswords: ['9395', 'password_or_9395'],
    department: 'ห้องผ่าตัด (OR)',
    serviceCode: 'WTO_04',
    serviceName: 'Water (สำหรับห้องผ่าตัด OR)',
    role: 'department_staff',
    roleTitle: 'พยาบาล/เจ้าหน้าที่ห้องผ่าตัด (OR)',
    displayName: 'ห้องผ่าตัด (OR)',
    icon: 'fa-faucet-drip',
    badgeColor: 'bg-indigo-100 text-indigo-800'
  },
  'admin': {
    username: 'admin',
    validPasswords: ['password123', 'admin123', 'admin', '8416'],
    department: 'งานจุลชีววิทยา (ส่วนกลาง)',
    serviceCode: '',
    serviceName: 'ผู้ดูแลระบบส่วนกลาง (ทุกบริการ)',
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

    // 2. ตรวจสอบรหัสผ่าน
    const isPasswordValid = acc.validPasswords.includes(cleanPwd);
    if (!isPasswordValid) {
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

    // 4. เข้าสู่ระบบ Supabase ในพื้นหลัง (ถ้ามี Supabase Client) เพื่อให้ API queries มีสิทธิ์สมบูรณ์
    if (window.supabaseClient) {
      try {
        await window.supabaseClient.auth.signInWithPassword({
          email: 'admin@tuh.lab',
          password: 'password123'
        });
      } catch (e) {
        console.warn('Background Supabase auth token session setup:', e);
      }
    }

    return { user: loggedInUser, session: { access_token: 'tuh-session-token' }, error: null };
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
   * อัปเดต UI ของ Navbar
   */
  async updateNavbarUI() {
    const user = await this.getCurrentUser();
    const authContainer = document.getElementById('navbar-auth-container') || document.getElementById('auth-nav-item');
    if (!authContainer) return;

    if (user) {
      authContainer.innerHTML = `
        <div class="flex items-center gap-2">
          <a href="workflow.html" class="inline-flex items-center gap-1.5 bg-emerald-700/80 hover:bg-emerald-800 text-white text-xs font-semibold py-1.5 px-3 rounded-lg border border-emerald-500/30 transition shadow-xs max-w-[180px] sm:max-w-[240px] truncate" title="${user.displayName}">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span class="truncate">${user.displayName}</span>
          </a>
          <button onclick="AuthManager.signOut()" title="ออกจากระบบ" class="text-xs text-rose-200 hover:text-white bg-rose-900/40 hover:bg-rose-900/80 border border-rose-500/30 px-2 py-1.5 rounded-lg transition">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
      `;
    } else {
      authContainer.innerHTML = `
        <a href="login.html" class="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold py-1.5 px-3.5 rounded-lg transition shadow-sm">
          <i class="fas fa-user-shield"></i>
          <span>เข้าสู่ระบบเจ้าหน้าที่</span>
        </a>
      `;
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
document.addEventListener('DOMContentLoaded', () => {
  AuthManager.updateNavbarUI();
});

window.DEPARTMENT_ACCOUNTS = DEPARTMENT_ACCOUNTS;
window.AuthManager = AuthManager;
