@echo off
chcp 65001 > nul
title Push Code to GitHub (deltasawad/tuh-microbiology)
echo ======================================================================
echo   กำลังส่งโค้ดขึ้น GitHub: https://github.com/deltasawad/tuh-microbiology
echo ======================================================================
echo.

cd /d "%~dp0"

git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/deltasawad/tuh-microbiology.git

echo กำลังอัปโหลดโค้ดขึ้น GitHub...
echo (หากมีหน้าต่างเด้งขึ้นมา ให้กดยืนยัน Sign in with your browser)
echo.

git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo   [สำเร็จ 100%!] ส่งโค้ดขึ้น GitHub เรียบร้อยแล้ว
    echo   ท่านสามารถกลับไปที่หน้า Render.com เพื่อกด Connect ได้ทันทีครับ
    echo ======================================================================
) else (
    echo.
    echo เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง หรือเข้าสู่ระบบ GitHub ในเบราว์เซอร์
)

echo.
pause
