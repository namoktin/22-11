@echo off
title ESP32 BLE Tour Guide & KiemThu AI Voice Server
color 0E
cd /d "%~dp0"

echo ===================================================================
echo   KHOI DONG HE THONG ESP32 TOUR GUIDE & KIEMTHU AI VOICE SERVER
echo ===================================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tu: https://nodejs.org/
    pause
    exit /b
)

echo [1/3] Dang khoi dong KiemThu Conversational AI Engine (Port 4001)...
start cmd /k "title KiemThu AI Engine Console (Port 4001) && cd /d "%~dp0..\kiemthu" && node smart_ai_server.js"

timeout /t 2 /nobreak >nul

echo [2/3] Dang khoi dong ESP32 BLE Server & Audio WAV Stream (Port 5000)...
start cmd /k "title ESP32 BLE Server Console (Port 5000) && cd /d "%~dp0" && node server.js"

timeout /t 2 /nobreak >nul

echo [3/3] Dang mo Man Hinh Truc Quan tren Trinh Duyet Web...
start http://localhost:5000

echo.
echo ===================================================================
echo  He thong da khoi dong hoan tat:
echo   - KiemThu AI Engine : http://localhost:4001/api/chat/ask
echo   - ESP32 BLE Server  : http://localhost:5000
echo   - IP LAN cho ESP32  : Xem truc tiep tren giao dien Web
echo ===================================================================
echo.
