@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Airdrop - Start

set "ROOT=%~dp0.."
cd /d "%ROOT%" || goto :fail_cd

call "%ROOT%\scripts\win\run-server.cmd"
set "RC=!ERRORLEVEL!"
if not "!RC!"=="0" goto :fail

endlocal
exit /b 0

:fail_cd
echo [ERROR] Cannot open project folder:
echo %ROOT%
goto :pause_fail

:fail
echo.
echo Failed to start server.
echo Run Diagnose.bat or Fix-Dependencies.bat
goto :pause_fail

:pause_fail
echo.
pause
endlocal
exit /b 1
