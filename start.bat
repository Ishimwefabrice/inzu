@echo off
title Inzu - House Rent Reminder
cd /d "%~dp0"

echo.
echo  ========================================
echo   INZU - phone app preview on this PC
echo  ========================================
echo.
echo  Dad should use the phone link:
echo  https://ishimwefabrice.github.io/inzu/
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install it from https://nodejs.org then run this file again.
  pause
  exit /b 1
)

if not exist "client\node_modules\" (
  echo First time setup: installing app...
  call npm install --prefix client
)

echo Starting local preview at http://127.0.0.1:5173/inzu/
echo.

start "" "http://127.0.0.1:5173/inzu/"
call npm run dev --prefix client -- --host 127.0.0.1 --port 5173

pause
