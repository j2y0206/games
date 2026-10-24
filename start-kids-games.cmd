@echo off
setlocal
cd /d "%~dp0"
echo.
echo Starlight Village
echo This PC : http://127.0.0.1:8081/
echo iPad    : http://YOUR_PC_IP:8081/
echo.
echo Press Ctrl+C to stop.
call npm run dev
endlocal
