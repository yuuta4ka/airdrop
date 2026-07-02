@echo off
setlocal EnableExtensions
title Airdrop - Status

set "ROOT=%~dp0.."
cd /d "%ROOT%" || (
  echo [ERROR] Cannot open project folder
  goto :end
)

call "%ROOT%\scripts\win\status-server.cmd"

:end
echo.
pause
endlocal
