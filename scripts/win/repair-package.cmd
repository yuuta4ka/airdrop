@echo off
REM Remove corrupted package folder so npm can reinstall cleanly
setlocal EnableExtensions
set "PKG_DIR=%~1"
set "MARKER=%~2"

if "%PKG_DIR%"=="" exit /b 0
if "%MARKER%"=="" exit /b 0
if not exist "%PKG_DIR%\" exit /b 0
if exist "%MARKER%" exit /b 0

echo Removing broken package: %PKG_DIR%
rmdir /s /q "%PKG_DIR%" 2>nul
if exist "%PKG_DIR%\" (
  echo [WARN] Could not remove %PKG_DIR% - close Node/antivirus and retry
  endlocal & exit /b 1
)
endlocal & exit /b 0
