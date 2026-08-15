@echo off
chcp 65001 > nul
title TUH Microbiology - Local Web Server
color 0A

echo ======================================================================
echo   TUH MICROBIOLOGY ENVIRONMENTAL BOOKING & REPORTING SYSTEM
echo   ระบบปฏิทินจองคิวและรายงานผลการตรวจสิ่งแวดล้อม รพ.ธรรมศาสตร์ฯ
echo ======================================================================
echo.

cd /d "%~dp0frontend"

echo [1/2] กำลังเปิดเว็บเบราว์เซอร์...
start "" http://localhost:5500/

echo [2/2] เริ่มต้น Local Web Server ที่ http://localhost:5500 ...
echo.
echo ======================================================================
echo   เข้าใช้งานระบบได้ที่: http://localhost:5500/
echo   - หน้าแรก (พอร์ทัล 8 บริการ): http://localhost:5500/index.html
echo   - ปฏิทินจองวัน: http://localhost:5500/booking.html
echo   - แดชบอร์ดเจ้าหน้าที่: http://localhost:5500/admin.html
echo   - ล็อกอินเจ้าหน้าที่: http://localhost:5500/login.html
echo.
echo   กด Ctrl + C เพื่อหยุดการทำงานเมื่อต้องการปิด
echo ======================================================================
echo.

python -m http.server 5500
if %ERRORLEVEL% NEQ 0 (
    echo Python http.server ไม่พร้อมใช้งาน กำลังเปิดไฟล์ index.html โดยตรง...
    start "" "%~dp0frontend\index.html"
)

pause
