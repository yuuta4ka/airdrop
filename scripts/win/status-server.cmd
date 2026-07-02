@echo off
setlocal EnableExtensions

if not defined PORT set "PORT=8080"

where powershell >nul 2>&1
if not errorlevel 1 (
  powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue; if($c){$c|ForEach-Object{Write-Host ('Server running: http://localhost:%PORT% PID '+$_.OwningProcess)}}else{Write-Host 'Server not running on port %PORT%.'}" 2>nul
  endlocal & exit /b 0
)

netstat -ano | findstr ":%PORT% " | findstr /i "LISTENING" >nul 2>&1
if errorlevel 1 (
  echo Server not running on port %PORT%.
) else (
  echo Server running: http://localhost:%PORT%
  netstat -ano | findstr ":%PORT% " | findstr /i "LISTENING"
)
endlocal & exit /b 0
