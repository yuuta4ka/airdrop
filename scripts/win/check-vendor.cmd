@echo off
REM Quick check that git clone includes bundled vendor deps
setlocal EnableExtensions

if exist "vendor\adm-zip\adm-zip.js" (
  if exist "vendor\pdf-parse\dist\pdf-parse\esm\index.js" (
    if exist "vendor\pdfjs-dist\legacy\build\pdf.mjs" (
      endlocal & exit /b 0
    )
  )
)

echo [ERROR] Server packages missing in vendor\
echo.
echo This project ships dependencies inside the repo - no npm download needed.
echo.
echo FIX:
echo   git pull
echo.
echo If still broken, re-clone:
echo   git clone https://github.com/yuuta4ka/airdrop.git
echo.
endlocal & exit /b 1
