@echo off
setlocal EnableExtensions
title Airdrop - Deploy

set "ROOT=%~dp0.."
cd /d "%ROOT%" || (
  echo [ERROR] Cannot open project folder
  goto :end
)

call "%ROOT%\scripts\win\deploy.cmd" %*
if errorlevel 1 (
  echo.
  echo Deploy failed.
)

:end
echo.
pause
endlocal
