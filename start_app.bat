@echo off
chcp 65001 > nul
title TUH Microbiology Environmental Reporting System
color 0A

echo ======================================================================
echo   TUH Microbiology Environmental Reporting System (ISO 15189)
echo   ระบบรายงานผลตรวจสิ่งแวดล้อม งานจุลชีววิทยา รพ.ธรรมศาสตร์เฉลิมพระเกียรติ
echo ======================================================================
echo.

cd /d "%~dp0backend"

echo [1/3] ตรวจสอบความพร้อมของฐานข้อมูล Supabase Cloud...
echo [2/3] กำลังเปิดเว็บเบราว์เซอร์อัตโนมัติ...

start "" timeout /t 2 /nobreak >nul ^& start "" http://localhost:8000/

echo [3/3] กำลังเริ่มต้นเซิร์ฟเวอร์ Local (http://localhost:8000)...
echo.
echo ======================================================================
echo   ระบบพร้อมใช้งานแล้ว! กด Ctrl+C เพื่อหยุดการทำงานเมื่อใช้งานเสร็จ
echo ======================================================================
echo.

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [แจ้งเตือน] ไม่สามารถเริ่มเซิร์ฟเวอร์ได้ กำลังติดตั้งโมดูลที่จำเป็น...
    pip install -r requirements.txt
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
)

pause
