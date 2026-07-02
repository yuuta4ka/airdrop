@echo off
setlocal EnableExtensions
title Airdrop - Fix Dependencies

set "ROOT=%~dp0.."
cd /d "%ROOT%" || (
  echo [ERROR] Cannot open project folder
  goto :end
)

echo === Fix npm dependencies ===
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not in PATH. Install Node.js and reboot.
  goto :end
)

call "%ROOT%\scripts\win\npm-install.cmd"
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" (
  echo Done. Now run click-win\Start.bat
) else (
  echo Fix failed. See messages above.
)

:end
pause
endlocal & exit /b %RC%
