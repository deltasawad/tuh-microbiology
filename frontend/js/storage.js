/**
 * ==============================================================================
 * STORAGE MODULE (Supabase Storage)
 * ระบบอัปโหลดและจัดการไฟล์แนบ PDF และรูปถ่ายผลตรวจสิ่งแวดล้อม
 * ==============================================================================
 */

const StorageDB = {
  BUCKET_NAME: 'microbiology-files',

  // ขนาดไฟล์สูงสุดที่อนุญาต (15 MB)
  MAX_FILE_SIZE: 15 * 1024 * 1024,

  // ประเภทไฟล์ที่อนุญาต
  ALLOWED_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],

  /**
   * ตรวจสอบความถูกต้องของไฟล์ก่อนอัปโหลด
   */
  validateFile(file) {
    if (!file) {
      return { valid: false, message: 'ไม่พบไฟล์ที่ต้องการอัปโหลด' };
    }

    if (file.size > this.MAX_FILE_SIZE) {
      return { 
        valid: false, 
        message: `ขนาดไฟล์ (${this.formatFileSize(file.size)}) เกินขีดจำกัดสูงสุด 15 MB` 
      };
    }

    // ตรวจสอบ MIME type หรือนามสกุลไฟล์
    const isValidType = this.ALLOWED_TYPES.includes(file.type) || 
      /\.(pdf|jpg|jpeg|png|webp|xlsx|docx)$/i.test(file.name);

    if (!isValidType) {
      return { 
        valid: false, 
        message: 'รองรับเฉพาะไฟล์ PDF, รูปภาพ (JPG, PNG), Word หรือ Excel เท่านั้น' 
      };
    }

    return { valid: true, message: 'OK' };
  },

  /**
   * แปลงขนาดไฟล์เป็นหน่วยที่อ่านง่าย (B, KB, MB)
   */
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * อัปโหลดไฟล์ขึ้น Supabase Storage
   * @param {File} file - ไฟล์ที่ผู้ใช้อัปโหลด
   * @param {string} folder - โฟลเดอร์ปลายทาง (เช่น 'reports', 'attachments')
   * @param {string} submissionNo - เลขที่เอกสารอ้างอิง
   */
  async uploadFile(file, folder = 'reports', submissionNo = '') {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    // สร้างชื่อไฟล์ที่ปลอดภัยและไม่ซ้ำกัน
    const timestamp = Date.now();
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const prefix = submissionNo ? `${submissionNo.replace(/[^a-zA-Z0-9_-]/g, '_')}_` : '';
    const filePath = `${folder}/${prefix}${timestamp}_${cleanName}`;

    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient.storage
          .from(this.BUCKET_NAME)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (error) throw error;

        // รับ Public URL ของไฟล์
        const { data: urlData } = window.supabaseClient.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(filePath);

        return {
          file_name: file.name,
          file_path: filePath,
          file_url: urlData.publicUrl,
          file_size: file.size,
          file_type: file.type || 'application/octet-stream',
          uploaded_at: new Date().toISOString()
        };
      } catch (err) {
        console.error('Supabase Storage upload error:', err);
        throw new Error(`การอัปโหลดไฟล์ล้มเหลว: ${err.message || 'Storage error'}`);
      }
    }

    // Mock Upload (สร้าง Local Blob URL สำหรับทดสอบก่อนใส่ Keys)
    const blobUrl = URL.createObjectURL(file);
    return {
      file_name: file.name,
      file_path: `mock/${filePath}`,
      file_url: blobUrl,
      file_size: file.size,
      file_type: file.type,
      uploaded_at: new Date().toISOString()
    };
  },

  /**
   * ลบไฟล์ออกจาก Supabase Storage
   */
  async deleteFile(filePath) {
    if (!filePath) return true;

    if (window.supabaseClient && !filePath.startsWith('mock/')) {
      try {
        const { error } = await window.supabaseClient.storage
          .from(this.BUCKET_NAME)
          .remove([filePath]);

        if (error) console.warn('Storage delete warning:', error);
        return true;
      } catch (err) {
        console.warn('Storage delete exception:', err);
        return false;
      }
    }
    return true;
  }
};

window.StorageDB = StorageDB;
