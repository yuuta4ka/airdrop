@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Airdrop - Start
chcp 65001 >nul 2>&1

set "ROOT=%~dp0.."
cd /d "%ROOT%" || goto :fail_cd

call "%ROOT%\scripts\win\run-server.cmd"
set "RC=!ERRORLEVEL!"
if not "!RC!"=="0" goto :fail

endlocal
exit /b 0

:fail_cd
echo [ОШИБКА] Не удалось открыть папку проекта:
echo %ROOT%
goto :pause_fail

:fail
echo.
echo Не удалось запустить сервер.
echo Запустите Diagnose.bat для проверки Node.js и путей.
goto :pause_fail

:pause_fail
echo.
pause
endlocal
exit /b 1
