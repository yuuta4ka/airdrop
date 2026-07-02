@echo off
setlocal EnableExtensions
if not defined PORT set "PORT=8080"

netstat -ano | findstr ":%PORT% " | findstr /i "LISTENING ПРОСЛУШИВАНИЕ" >nul 2>&1
if errorlevel 1 (
  echo Сервер не запущен ^(порт %PORT%^).
) else (
  echo Сервер запущен: http://localhost:%PORT%
  for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr /i "LISTENING ПРОСЛУШИВАНИЕ"') do echo PID: %%P
)
endlocal & exit /b 0
