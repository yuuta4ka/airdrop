@echo off
chcp 65001 >nul
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\win\restart-local.ps1"
if errorlevel 1 pause
