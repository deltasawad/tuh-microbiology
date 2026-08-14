@echo off
chcp 65001 > nul
title TUH Microbiology Environmental Reporting System
echo ======================================================================
echo   TUH Microbiology Environmental Reporting System (ISO 15189)
echo   ระบบรายงานผลตรวจสิ่งแวดล้อม งานจุลชีววิทยา รพ.ธรรมศาสตร์
echo ======================================================================
echo.

cd /d "%~dp0backend"
echo [1/2] Checking and starting backend server...
start "" http://localhost:8000/

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause
