@echo off
REM Install only what the server needs; avoid full node_modules rebuild on Windows
setlocal EnableExtensions EnableDelayedExpansion

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not in PATH
  endlocal & exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json not found
  endlocal & exit /b 1
)

REM Free port 8080 so pdfjs-dist / node files are not locked (EPERM)
call "%~dp0kill-port.cmd" 8080

set "NEED=0"
if not exist "node_modules\" set "NEED=1"
if not exist "node_modules\adm-zip\" set "NEED=1"
if not exist "node_modules\pdf-parse\" set "NEED=1"

if "!NEED!"=="0" (
  endlocal & exit /b 0
)

if not exist "node_modules\" (
  echo Installing dependencies - production only, first clone...
  echo.
  call "%~dp0npm-install-retry.cmd" install --omit=dev
  if errorlevel 1 goto :failed
  goto :verify
)

echo Installing missing server packages only...
echo (Skips dev tools - faster and fewer file locks on Windows)
echo.

if not exist "node_modules\adm-zip\" (
  echo   + adm-zip
  call "%~dp0npm-install-retry.cmd" install adm-zip@0.5.18
  if errorlevel 1 goto :failed
)

if not exist "node_modules\pdf-parse\" (
  echo   + pdf-parse
  call "%~dp0npm-install-retry.cmd" install pdf-parse@2.4.5
  if errorlevel 1 goto :failed
)

:verify
if not exist "node_modules\adm-zip\" goto :failed_missing
if not exist "node_modules\pdf-parse\" goto :failed_missing
echo.
echo Dependencies OK.
endlocal & exit /b 0

:failed_missing
echo [ERROR] Required packages still missing after install.
goto :hints

:failed
echo [ERROR] npm install failed
:hints
echo.
echo EPERM / cleanup errors:
echo   1. Run click-win\Stop.bat
echo   2. Close other cmd windows in this folder
echo   3. Temporarily pause antivirus on the airdrop folder
echo.
echo ECONNRESET / network errors:
echo   1. Check Wi-Fi or try phone hotspot
echo   2. Run click-win\Fix-Dependencies.bat again
echo   3. Manual: npm install adm-zip@0.5.18 pdf-parse@2.4.5
echo.
endlocal & exit /b 1
