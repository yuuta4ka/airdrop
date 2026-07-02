@echo off
setlocal EnableExtensions
set "MSG=%~1"
if "%MSG%"=="" set "MSG=Deploy: Airdrop updates"

where git >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] Git не найден. Установите: https://git-scm.com/download/win
  endlocal & exit /b 1
)

echo === Деплой АирДроп ===
echo.

git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] Это не git-репозиторий.
  endlocal & exit /b 1
)

git add -A
git diff --cached --quiet
if errorlevel 1 (
  echo Коммит: %MSG%
  git commit -m "%MSG%"
  if errorlevel 1 endlocal & exit /b 1
) else (
  echo Нет изменений для коммита.
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] Remote origin не настроен.
  endlocal & exit /b 1
)

for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
echo.
echo git push origin %BRANCH% ...
git push origin %BRANCH%
if errorlevel 1 endlocal & exit /b 1

echo.
echo Готово. Render обновит сайт за 1-3 минуты.
echo Прод: https://airdrop-hxpo.onrender.com
echo.
endlocal & exit /b 0
