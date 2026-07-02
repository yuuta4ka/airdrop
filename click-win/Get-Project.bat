@echo off
setlocal EnableExtensions
title Airdrop - Get project from GitHub

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git not installed.
  echo Download: https://git-scm.com/download/win
  goto :end
)

set "TARGET=%USERPROFILE%\Desktop\airdrop"
echo.
echo This will clone the project to:
echo %TARGET%
echo.
set /p "OK=Continue? [Y/N]: "
if /i not "%OK%"=="Y" goto :end

if exist "%TARGET%" (
  echo Folder exists. Updating with git pull ...
  cd /d "%TARGET%" || goto :end
  git pull
) else (
  git clone https://github.com/yuuta4ka/airdrop.git "%TARGET%"
  cd /d "%TARGET%" || goto :end
)

echo.
echo Done. Next steps:
echo   1. Install Node.js and reboot if you have not yet
echo   2. Run: %TARGET%\click-win\Diagnose.bat
echo   3. Run: %TARGET%\click-win\Start.bat
echo.

:end
pause
endlocal
