@echo off
setlocal EnableExtensions
title Airdrop - Stop

set "ROOT=%~dp0.."
cd /d "%ROOT%" || (
  echo [ERROR] Cannot open project folder
  goto :end
)

call "%ROOT%\scripts\win\stop-server.cmd"

:end
echo.
pause
endlocal
