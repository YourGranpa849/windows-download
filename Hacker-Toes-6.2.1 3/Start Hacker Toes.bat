@echo off
setlocal
cd /d "%~dp0"
title Hacker Toes 6.0 - Local host
echo.
echo   HACKER TOES 6.0
echo   Your local hangout is getting ready.
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer from https://nodejs.org, then open this file again.
  start "" "https://nodejs.org"
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)"
if errorlevel 1 (
  echo Please update Node.js to version 22.12 or newer at https://nodejs.org.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing app files. Internet is needed only for this first setup.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm run build
if errorlevel 1 (
  echo The interface could not be built. Check the error above.
  pause
  exit /b 1
)
set OPEN_BROWSER=1
node server.js
if errorlevel 1 pause
endlocal
