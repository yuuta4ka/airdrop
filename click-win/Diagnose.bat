@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Airdrop - Diagnose

echo === Airdrop diagnose ===
echo.

set "ROOT=%~dp0.."
echo Project folder: %ROOT%
cd /d "%ROOT%" && (
  echo Current folder: OK
) || (
  echo [ERROR] Cannot open project folder
  goto :end
)

if exist "server.mjs" (echo server.mjs: OK) else (echo [ERROR] server.mjs not found)
if exist "node_modules\" (echo node_modules: OK) else (echo node_modules: missing - will run npm install on first start)

echo.
echo --- Node.js ---
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] node is not in PATH
  echo Install Node.js and REBOOT Windows
) else (
  for /f "delims=" %%V in ('node -v 2^>^&1') do echo node %%V
  where node
)

echo.
echo --- npm ---
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not in PATH
) else (
  for /f "delims=" %%V in ('npm -v 2^>^&1') do echo npm %%V
)

echo.
echo --- Git ---
where git >nul 2>&1
if errorlevel 1 (
  echo Git not installed (only needed for Deploy.bat)
) else (
  for /f "delims=" %%V in ('git --version 2^>^&1') do echo %%V
)

echo.
echo --- Port 8080 ---
call "%ROOT%\scripts\win\status-server.cmd"

echo.
echo --- PowerShell ---
where powershell >nul 2>&1
if errorlevel 1 (echo PowerShell not found) else (echo PowerShell: OK)

:end
echo.
echo If node is missing, reboot after installing Node.js.
echo Do NOT copy project via Telegram ZIP - use git clone (see SETUP-WINDOWS.txt).
echo.
pause
endlocal
