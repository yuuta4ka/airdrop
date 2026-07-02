@echo off
setlocal EnableExtensions
title Airdrop - Stop
chcp 65001 >nul 2>&1

set "ROOT=%~dp0.."
cd /d "%ROOT%" || (
  echo [ОШИБКА] Не удалось открыть папку проекта
  goto :end
)

call "%ROOT%\scripts\win\stop-server.cmd"

:end
echo.
pause
endlocal
