@echo off
setlocal EnableExtensions
if not defined PORT set "PORT=8080"

echo Проверка порта %PORT%...
call "%~dp0kill-port.cmd" %PORT%

timeout /t 1 /nobreak >nul

netstat -ano | findstr ":%PORT% " | findstr /i "LISTENING ПРОСЛУШИВАНИЕ" >nul 2>&1
if errorlevel 1 (
  echo Сервер остановлен ^(порт %PORT% свободен^).
  endlocal & exit /b 0
)

echo [ОШИБКА] Порт %PORT% всё ещё занят. Запустите Diagnose.bat
endlocal & exit /b 1
