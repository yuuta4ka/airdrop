@echo off
setlocal EnableExtensions
set "MSG=%~1"
if "%MSG%"=="" set "MSG=Deploy: Airdrop updates"

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git not found. Install: https://git-scm.com/download/win
  endlocal & exit /b 1
)

echo === Airdrop deploy ===
echo.

git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Not a git repository.
  endlocal & exit /b 1
)

git add -A
git diff --cached --quiet
if errorlevel 1 (
  echo Commit: %MSG%
  git commit -m "%MSG%"
  if errorlevel 1 endlocal & exit /b 1
) else (
  echo No changes to commit.
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Remote origin is not configured.
  endlocal & exit /b 1
)

for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
echo.
echo git push origin %BRANCH% ...
git push origin %BRANCH%
if errorlevel 1 endlocal & exit /b 1

echo.
echo Done. Render will update in 1-3 minutes.
echo https://airdrop-hxpo.onrender.com
echo.
endlocal & exit /b 0
