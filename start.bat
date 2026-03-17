@echo off
echo Starting Debi Diabetes Manager...
cd /d "%~dp0"
start "Flask Backend" cmd /k "python app.py"
timeout /t 2 /nobreak >nul
start http://localhost:5000
