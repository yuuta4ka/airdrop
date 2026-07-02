@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Airdrop - Diagnose
chcp 65001 >nul 2>&1

echo === Диагностика АирДроп ===
echo.

set "ROOT=%~dp0.."
echo Папка проекта: %ROOT%
cd /d "%ROOT%" && (
  echo Текущая папка: OK
) || (
  echo [ОШИБКА] Не удалось открыть папку проекта
  goto :end
)

if exist "server.mjs" (echo server.mjs: OK) else (echo [ОШИБКА] server.mjs не найден)
if exist "node_modules\" (echo node_modules: OK) else (echo node_modules: нет — при первом запуске установится автоматически)

echo.
echo --- Node.js ---
where node >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] node не в PATH
  echo Установите Node.js и ПЕРЕЗАГРУЗИТЕ компьютер
) else (
  for /f "delims=" %%V in ('node -v 2^>^&1') do echo node %%V
  where node
)

echo.
echo --- npm ---
where npm >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] npm не в PATH
) else (
  for /f "delims=" %%V in ('npm -v 2^>^&1') do echo npm %%V
)

echo.
echo --- Git ---
where git >nul 2>&1
if errorlevel 1 (
  echo Git не установлен ^(нужен только для Deploy.bat^)
) else (
  for /f "delims=" %%V in ('git --version 2^>^&1') do echo %%V
)

echo.
echo --- Порт 8080 ---
netstat -ano | findstr ":8080 " | findstr /i "LISTENING ПРОСЛУШИВАНИЕ" >nul 2>&1
if errorlevel 1 (
  echo Порт 8080 свободен
) else (
  echo Порт 8080 занят:
  netstat -ano | findstr ":8080 " | findstr /i "LISTENING ПРОСЛУШИВАНИЕ"
)

echo.
echo --- PowerShell ---
where powershell >nul 2>&1
if errorlevel 1 (echo PowerShell не найден) else (echo PowerShell: OK)

:end
echo.
echo Если node не найден — перезагрузите ПК после установки Node.js.
echo.
pause
endlocal
