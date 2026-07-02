@echo off
setlocal EnableExtensions

if not defined PORT set "PORT=8080"

if not exist "server.mjs" (
  echo [ERROR] server.mjs not found.
  echo Run from the airdrop project folder.
  endlocal & exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not in PATH.
  echo.
  echo 1. Install Node.js: https://nodejs.org
  echo 2. Reboot Windows
  echo 3. Open cmd and run: node -v
  endlocal & exit /b 1
)

call "%~dp0kill-port.cmd" %PORT%

if not exist "node_modules\" (
  echo Running npm install ...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed
    endlocal & exit /b 1
  )
)

echo.
echo Node.js:
node -v
echo.
echo   Site:  http://localhost:%PORT%
echo   Admin: http://localhost:%PORT%/admin
echo.
echo   Stop: Ctrl+C or click-win\Stop.bat
echo.

set "PORT=%PORT%"
node server.mjs
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo Server exited with code %RC%
)
endlocal & exit /b %RC%
