@echo off
setlocal
cd /d "%~dp0"

echo.
echo Urlaubshinweis App - Installation und Start
echo ===========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden.
  echo Bitte Node.js LTS installieren: https://nodejs.org/
  echo Danach diese Datei erneut doppelklicken.
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Es wurde eine neue .env Datei erstellt.
  echo Bitte APP_PASSWORD, SMTP_HOST, SMTP_USER, SMTP_PASS und SMTP_FROM lokal eintragen.
  echo Die Datei wird jetzt in Notepad geoeffnet. Danach speichern und Notepad schliessen.
  notepad ".env"
)

echo Installiere oder pruefe benoetigte Pakete...
npm install
if errorlevel 1 (
  echo Installation fehlgeschlagen. Bitte Internetverbindung pruefen.
  pause
  exit /b 1
)

echo.
echo Starte App auf http://localhost:3000
echo Anmeldung: Passwort aus APP_PASSWORD in der .env Datei.
start "" "http://localhost:3000"
npm start

pause
