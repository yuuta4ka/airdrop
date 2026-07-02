@echo off
setlocal EnableExtensions
title Airdrop - Status
chcp 65001 >nul 2>&1

set "ROOT=%~dp0.."
cd /d "%ROOT%" || (
  echo [ОШИБКА] Не удалось открыть папку проекта
  goto :end
)

call "%ROOT%\scripts\win\status-server.cmd"

:end
echo.
pause
endlocal
