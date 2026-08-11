@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\nodemailer" (
  echo Pakete fehlen. Starte zuerst installieren-und-starten.bat
  pause
  exit /b 1
)

if not exist "node_modules\xlsx" (
  echo Excel-Paket fehlt. Starte zuerst installieren-und-starten.bat
  pause
  exit /b 1
)

if not exist ".env" (
  echo .env fehlt. Starte zuerst installieren-und-starten.bat
  pause
  exit /b 1
)

echo Starte App auf http://localhost:3000
echo Anmeldung: Passwort aus APP_PASSWORD in der .env Datei.
start "" "http://localhost:3000"
npm start

pause
