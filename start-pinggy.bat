@echo off
title Pinggy Tunnel -> ESP32 BLE Server (Port 5000)
color 0B
echo ===================================================================
echo   MO PINGGY TUNNEL CHO ESP32 BLE SERVER (PORT 5000)
echo ===================================================================
echo.
echo  * Luu y: Neu thay dong "password:", chi can bam phim ENTER (de trong).
echo  * Copy link https://xxxx.a.pinggy.link hien ra de dung tu xa.
echo.
ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R0:127.0.0.1:5000 a.pinggy.io
pause
