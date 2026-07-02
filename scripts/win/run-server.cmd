@echo off
REM Запуск server.mjs (чистый CMD, без PowerShell)
setlocal EnableExtensions

if not defined PORT set "PORT=8080"

if not exist "server.mjs" (
  echo [ОШИБКА] Файл server.mjs не найден.
  echo Запускайте из корня проекта airdrop.
  endlocal & exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] Node.js не найден в PATH.
  echo.
  echo 1. Установите Node.js: https://nodejs.org
  echo 2. Перезагрузите компьютер
  echo 3. Откройте новое окно cmd и проверьте: node -v
  endlocal & exit /b 1
)

call "%~dp0kill-port.cmd" %PORT%

if not exist "node_modules\" (
  echo Установка зависимостей npm install ...
  call npm install
  if errorlevel 1 (
    echo [ОШИБКА] npm install не удался
    endlocal & exit /b 1
  )
)

echo.
echo Node.js:
node -v
echo.
echo   Сайт:    http://localhost:%PORT%
echo   Админка: http://localhost:%PORT%/admin
echo.
echo   Остановка: Ctrl+C или click-win\Stop.bat
echo.

set "PORT=%PORT%"
node server.mjs
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo Сервер завершился с кодом %RC%
)
endlocal & exit /b %RC%
