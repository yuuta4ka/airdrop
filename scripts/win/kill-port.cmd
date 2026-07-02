@echo off
setlocal EnableExtensions
set "TARGET_PORT=%~1"
if "%TARGET_PORT%"=="" set "TARGET_PORT=8080"

where powershell >nul 2>&1
if not errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort %TARGET_PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul
)

for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":%TARGET_PORT% " ^| findstr /i "LISTENING"') do (
  taskkill /F /PID %%P >nul 2>&1
)

endlocal
exit /b 0
