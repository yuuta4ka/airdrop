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

echo.
echo --- Bundled server packages (vendor\) ---
if exist "vendor\adm-zip\adm-zip.js" (echo adm-zip: OK) else (echo adm-zip: MISSING - run git pull)
if exist "vendor\pdf-parse\dist\pdf-parse\esm\index.js" (echo pdf-parse: OK) else (echo pdf-parse: MISSING)
if exist "vendor\pdfjs-dist\legacy\build\pdf.mjs" (echo pdfjs-dist: OK) else (echo pdfjs-dist: MISSING)

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
echo --- npm (optional, only for Vite dev) ---
where npm >nul 2>&1
if errorlevel 1 (
  echo npm not in PATH - OK for running the site
) else (
  for /f "delims=" %%V in ('npm -v 2^>^&1') do echo npm %%V
)

echo.
echo --- Git ---
where git >nul 2>&1
if errorlevel 1 (
  echo Git not installed (only needed for Update-Project.bat)
) else (
  for /f "delims=" %%V in ('git --version 2^>^&1') do echo %%V
)

echo.
echo --- Port 8080 ---
call "%ROOT%\scripts\win\status-server.cmd"

where node >nul 2>&1
if not errorlevel 1 (
  echo.
  echo --- Runtime links ---
  node "%ROOT%\scripts\setup-runtime-deps.mjs" >nul 2>&1
  if errorlevel 1 (
    echo setup-runtime-deps: FAILED
  ) else (
    echo setup-runtime-deps: OK
  )
  echo.
  echo --- Node import test ---
  node "%ROOT%\scripts\verify-server-deps.mjs" >nul 2>&1
  if errorlevel 1 (
    echo node import test: FAILED
  ) else (
    echo node import test: OK
  )
)

:end
echo.
echo Site needs only Node.js + git clone. No npm install required.
echo Do NOT copy project via Telegram ZIP - use git clone (see SETUP-WINDOWS.txt).
echo.
pause
endlocal
