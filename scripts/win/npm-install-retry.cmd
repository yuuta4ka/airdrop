@echo off
REM Run npm with up to 3 attempts (helps flaky Wi-Fi / ECONNRESET)
setlocal EnableExtensions
set "ATTEMPT=0"

:loop
set /a ATTEMPT+=1
if %ATTEMPT% gtr 3 (
  endlocal & exit /b 1
)
if %ATTEMPT% gtr 1 (
  echo Network error - retry %ATTEMPT%/3 in 5 sec...
  timeout /t 5 /nobreak >nul
)
call npm %*
if not errorlevel 1 (
  endlocal & exit /b 0
)
goto loop
