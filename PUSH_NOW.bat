@echo off
chcp 65001 > nul
title ส่งโค้ดขึ้น GitHub (TUH Microbiology)
echo ======================================================================
echo   ระบบส่งโค้ดขึ้น GitHub สำหรับ Render.com Deployment
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/3] ตรวจสอบไฟล์ในโปรเจกต์...
git add .
git commit -m "Update TUH Microbiology System for Render" >nul 2>&1
git branch -M main
git remote remove origin >nul 2>&1
git remote add origin https://github.com/deltasawad/tuh-microbiology.git

echo.
echo [2/3] เข้าสู่ระบบ GitHub...
echo (จะมีเบราว์เซอร์เปิดขึ้นมา ให้กดปุ่มสีเขียว Authorize github)
echo.
"C:\Program Files\GitHub CLI\gh.exe" auth login -w -p https -h github.com

echo.
echo [3/3] กำลังส่งไฟล์ขึ้น GitHub (Uploading files)...
git push -u origin main --force

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo   [สำเร็จ 100%!] โค้ดทั้งหมดถูกส่งขึ้น GitHub เรียบร้อยแล้วครับ
    echo.
    echo   ขั้นตอนต่อไป:
    echo   1. กลับไปที่หน้า Render.com (ในเว็บเบราว์เซอร์)
    echo   2. กดปุ่มสีขาวมุมบนขวา "Manual Deploy" -> "Deploy latest commit"
    echo ======================================================================
) else (
    echo.
    echo เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง
)

echo.
pause
