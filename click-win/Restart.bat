@echo off
setlocal EnableExtensions
title Airdrop - Restart
chcp 65001 >nul 2>&1

set "ROOT=%~dp0.."
cd /d "%ROOT%" || (
  echo [ОШИБКА] Не удалось открыть папку проекта
  goto :end
)

call "%ROOT%\scripts\win\stop-server.cmd"
echo.
call "%ROOT%\scripts\win\run-server.cmd"
if errorlevel 1 goto :end

endlocal
exit /b 0

:end
echo.
pause
endlocal
