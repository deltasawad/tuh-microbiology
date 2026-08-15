/**
 * ==============================================================================
 * AUTHENTICATION MODULE (Supabase Auth)
 * ระบบล็อกอินและจัดการสิทธิ์เจ้าหน้าที่ห้องปฏิบัติการ
 * ==============================================================================
 */

const AuthManager = {
  /**
   * เข้าสู่ระบบด้วย Email และ Password
   * @param {string} email 
   * @param {string} password 
   */
  async signIn(email, password) {
    if (!window.supabaseClient) {
      // โหมด Mock/Demo หากยังไม่ได้ใส่ Supabase Keys
      if (email && password) {
        const mockUser = {
          id: 'demo-staff-uuid-1234',
          email: email,
          user_metadata: {
            full_name: email.includes('admin') ? 'ทนพ.มานพ นันตาบุตร (Admin)' : 'เจ้าหน้าที่ห้องปฏิบัติการ',
            role: 'staff'
          }
        };
        localStorage.setItem('tuh_mock_auth_user', JSON.stringify(mockUser));
        return { user: mockUser, session: { access_token: 'mock-token' }, error: null };
      }
      throw new Error('กรุณากรอกอีเมลและรหัสผ่าน');
    }

    try {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) throw error;
      return { user: data.user, session: data.session, error: null };
    } catch (err) {
      console.error('Sign in error:', err);
      return { user: null, session: null, error: err };
    }
  },

  /**
   * ออกจากระบบ (Logout)
   */
  async signOut() {
    localStorage.removeItem('tuh_mock_auth_user');

    if (window.supabaseClient) {
      try {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) console.error('Sign out error:', error);
      } catch (err) {
        console.error('Sign out exception:', err);
      }
    }
    
    // Redirect ไปหน้าแรก
    window.location.href = 'index.html';
  },

  /**
   * ตรวจสอบ Session ปัจจุบัน
   */
  async getSession() {
    if (window.supabaseClient) {
      try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error) return null;
        return session;
      } catch (e) {
        return null;
      }
    }

    // Mock session
    const mockUserStr = localStorage.getItem('tuh_mock_auth_user');
    if (mockUserStr) {
      return { user: JSON.parse(mockUserStr), access_token: 'mock-token' };
    }
    return null;
  },

  /**
   * รับข้อมูล User ปัจจุบัน
   */
  async getCurrentUser() {
    const session = await this.getSession();
    if (!session) return null;
    return session.user;
  },

  /**
   * ตรวจสอบว่าล็อกอินอยู่หรือไม่
   */
  async isAuthenticated() {
    const user = await this.getCurrentUser();
    return !!user;
  },

  /**
   * ปิดกั้นหน้าสำหรับผู้ใช้ทั่วไป (ใช้ใน admin.html)
   * หากยังไม่ได้ล็อกอิน จะถูก Redirect ไปหน้า login.html ทันที
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
   * ตรวจสอบหน้า Login ถ้าล็อกอินอยู่แล้วให้เด้งไป admin.html
   */
  async redirectIfAuthenticated(redirectUrl = 'admin.html') {
    const isAuth = await this.isAuthenticated();
    if (isAuth) {
      window.location.href = redirectUrl;
      return true;
    }
    return false;
  },

  /**
   * อัปเดต UI ของ Navbar (แสดงชื่อผู้ใช้ และปุ่ม Logout)
   */
  async updateNavbarUI() {
    const user = await this.getCurrentUser();
    const authContainer = document.getElementById('navbar-auth-container') || document.getElementById('auth-nav-item');
    if (!authContainer) return;

    if (user) {
      const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'เจ้าหน้าที่';
      authContainer.innerHTML = `
        <div class="flex items-center gap-3">
          <a href="admin.html" class="inline-flex items-center gap-2 bg-emerald-700/80 hover:bg-emerald-800 text-white text-xs font-semibold py-1.5 px-3 rounded-lg border border-emerald-500/30 transition shadow-sm">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="hidden sm:inline">${displayName}</span>
            <span class="sm:hidden">Admin</span>
          </a>
          <button onclick="AuthManager.signOut()" title="ออกจากระบบ" class="text-xs text-rose-200 hover:text-white bg-rose-900/40 hover:bg-rose-900/80 border border-rose-500/30 px-2.5 py-1.5 rounded-lg transition">
            <i class="fas fa-sign-out-alt mr-1"></i> ออกจากระบบ
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
  }
};

// Listen to Supabase Auth State changes
if (window.supabaseClient) {
  window.supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('🔔 Supabase Auth Event:', event);
    AuthManager.updateNavbarUI();
  });
}

// Auto init on page load
document.addEventListener('DOMContentLoaded', () => {
  AuthManager.updateNavbarUI();
});

window.AuthManager = AuthManager;
