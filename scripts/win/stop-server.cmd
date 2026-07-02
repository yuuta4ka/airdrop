@echo off
setlocal EnableExtensions

if not defined PORT set "PORT=8080"

echo Stopping port %PORT% ...
call "%~dp0kill-port.cmd" %PORT%
timeout /t 1 /nobreak >nul

where powershell >nul 2>&1
if not errorlevel 1 (
  powershell -NoProfile -Command "exit ((Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0)" >nul 2>&1
  if errorlevel 1 (
    echo Server stopped. Port %PORT% is free.
    endlocal & exit /b 0
  )
)

netstat -ano | findstr ":%PORT% " | findstr /i "LISTENING" >nul 2>&1
if errorlevel 1 (
  echo Server stopped. Port %PORT% is free.
  endlocal & exit /b 0
)

echo [ERROR] Port %PORT% is still in use. Run Diagnose.bat
endlocal & exit /b 1
