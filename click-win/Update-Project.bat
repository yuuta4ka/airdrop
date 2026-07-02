@echo off
setlocal EnableExtensions
title Airdrop - Update from GitHub

set "ROOT=%~dp0.."
cd /d "%ROOT%" || (
  echo [ERROR] Cannot open project folder
  goto :end
)

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git not installed.
  echo https://git-scm.com/download/win
  goto :end
)

if not exist ".git\" (
  echo [ERROR] This folder is NOT from git clone.
  echo It is probably an old copy from USB or Telegram.
  echo.
  echo FIX:
  echo   1. Delete folder: %ROOT%
  echo   2. Run Get-Project.bat from a fresh download
  echo   OR in cmd:
  echo   cd %USERPROFILE%\Desktop
  echo   rmdir /s /q airdrop
  echo   git clone https://github.com/yuuta4ka/airdrop.git
  goto :end
)

REM Phase 2 runs in a NEW cmd after git pull replaced .bat files on disk.
if /i "%~1"=="--deps-only" goto :deps

echo Updating from GitHub...
git pull
if errorlevel 1 (
  echo.
  echo git pull failed. Try fresh clone (see above).
  goto :end
)

echo.
echo Continuing in a fresh process (Windows cannot safely run a .bat after git pull rewrites it)...
cmd /c ""%~f0" --deps-only"
exit /b %ERRORLEVEL%

:deps
echo Installing dependencies...
call "%ROOT%\scripts\win\npm-install.cmd"
if errorlevel 1 goto :end

echo.
echo Update OK. Now run:
echo   click-win\Diagnose.bat
echo   click-win\Start.bat
echo.

:end
pause
endlocal
