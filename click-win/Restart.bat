@echo off
setlocal EnableExtensions
title Airdrop - Restart

set "ROOT=%~dp0.."
cd /d "%ROOT%" || (
  echo [ERROR] Cannot open project folder
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
