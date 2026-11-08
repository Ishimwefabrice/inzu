@echo off
title Inzu - House Rent Reminder
cd /d "%~dp0"

echo.
echo  ========================================
echo   INZU - House Rent Reminder
echo  ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install it from https://nodejs.org then run this file again.
  pause
  exit /b 1
)

if not exist "server\node_modules\" (
  echo First time setup: installing server...
  call npm install --prefix server
)

if not exist "client\node_modules\" (
  echo First time setup: installing app...
  call npm install --prefix client
)

if not exist "node_modules\" (
  call npm install
)

echo Starting Inzu...
echo Browser will open at http://127.0.0.1:5173
echo Keep this window open while using Inzu.
echo.

start "" "http://127.0.0.1:5173"
call npx concurrently -k -n server,app -c teal,yellow "node server/index.js" "npm run dev --prefix client -- --host 127.0.0.1 --port 5173"

pause
