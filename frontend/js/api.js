const API_BASE = window.location.origin.includes(':8000') || window.location.origin.includes(':5500') || window.location.origin.includes(':3000') 
  ? 'http://localhost:8000/api'
  : '/api';

const Api = {
  getToken() {
    return localStorage.getItem('tuh_access_token');
  },

  getUser() {
    const userStr = localStorage.getItem('tuh_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setAuth(token, refreshToken, user) {
    localStorage.setItem('tuh_access_token', token);
    localStorage.setItem('tuh_refresh_token', refreshToken);
    localStorage.setItem('tuh_user', JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem('tuh_access_token');
    localStorage.removeItem('tuh_refresh_token');
    localStorage.removeItem('tuh_user');
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        // Token expired
        this.clearAuth();
        if (!window.location.pathname.includes('login.html')) {
          window.location.href = 'login.html';
        }
        throw new Error('กรุณาเข้าสู่ระบบใหม่ (Session expired)');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  },

  // Auth endpoints
  login(username, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  getMe() {
    return this.request('/auth/me');
  },

  // Master Data
  getServices() {
    return this.request('/master/services');
  },

  getDepartments() {
    return this.request('/master/departments');
  },

  getWards() {
    return this.request('/master/wards');
  },

  getStaff() {
    return this.request('/master/staff');
  },

  getOrganisms() {
    return this.request('/master/organisms');
  },

  getHolidays() {
    return this.request('/master/holidays');
  },

  // Submissions
  getSubmissions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/submissions?${query}`);
  },

  getSubmission(id) {
    return this.request(`/submissions/${id}`);
  },

  createSubmission(data) {
    return this.request('/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSubmission(id, data) {
    return this.request(`/submissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  changeStatus(id, to_status, reason, reporter_id, reviewer_id) {
    return this.request(`/submissions/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ to_status, reason, reporter_id, reviewer_id }),
    });
  },

  getTat(id) {
    return this.request(`/submissions/${id}/tat`);
  },

  // Reports
  generateReport(submissionId) {
    return this.request(`/reports/generate/${submissionId}`, { method: 'POST' });
  },

  getReportDownloadUrl(submissionId) {
    return `${API_BASE}/reports/download/${submissionId}`;
  },

  // Bookings
  getBookings(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/bookings?${query}`);
  },

  createBooking(data) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteBooking(id) {
    return this.request(`/bookings/${id}`, { method: 'DELETE' });
  },

  // Dashboard
  getDashboardSummary() {
    return this.request('/dashboard/summary');
  },

  // Audit
  getAuditLogs(submissionId = null) {
    const query = submissionId ? `?submission_id=${submissionId}` : '';
    return this.request(`/audit${query}`);
  }
};
