@echo off
setlocal
cd /d "%~dp0"
echo.
echo Kids Roleplay Games
echo This PC : http://127.0.0.1:8081/games/tiny-garage/
echo iPad    : http://YOUR_PC_IP:8081/games/tiny-garage/
echo.
echo Press Ctrl+C to stop.
python -m http.server 8081 --bind 0.0.0.0
endlocal
