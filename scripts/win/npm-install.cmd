@echo off
REM Install npm deps when node_modules is missing or incomplete
setlocal EnableExtensions

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not in PATH
  endlocal & exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json not found
  endlocal & exit /b 1
)

set "NEED_INSTALL=0"
if not exist "node_modules\" set "NEED_INSTALL=1"
if not exist "node_modules\adm-zip\" set "NEED_INSTALL=1"
if not exist "node_modules\pdf-parse\" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="0" (
  endlocal & exit /b 0
)

echo Installing dependencies (npm install)...
echo This is required after git pull or first clone.
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed
  endlocal & exit /b 1
)

echo Dependencies OK.
endlocal & exit /b 0
