@echo off
echo Starting in development mode...
cd /d "%~dp0"
start "Flask Backend" cmd /k "python app.py"
timeout /t 1 /nobreak >nul
cd client
start "React Dev Server" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:5173
