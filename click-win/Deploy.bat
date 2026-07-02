@echo off
setlocal EnableExtensions
title Airdrop - Deploy
chcp 65001 >nul 2>&1

set "ROOT=%~dp0.."
cd /d "%ROOT%" || (
  echo [ОШИБКА] Не удалось открыть папку проекта
  goto :end
)

call "%ROOT%\scripts\win\deploy.cmd" %*
if errorlevel 1 (
  echo.
  echo Деплой не удался.
)

:end
echo.
pause
endlocal
