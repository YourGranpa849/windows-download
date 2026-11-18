@echo off
setlocal
cd /d "%~dp0"
title Hacker Toes - Build Windows App
echo.
echo HACKER TOES - BUILD WINDOWS APP
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer from https://nodejs.org first.
  start "" "https://nodejs.org"
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)"
if errorlevel 1 (
  echo Please install Node.js 22.12 or newer.
  pause
  exit /b 1
)
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo Dependency installation failed.
  pause
  exit /b 1
)
call npm run dist:win
if errorlevel 1 (
  echo The Windows app build failed.
  pause
  exit /b 1
)
echo.
echo Build finished. Look inside the release folder for the Windows installer.
pause
endlocal
