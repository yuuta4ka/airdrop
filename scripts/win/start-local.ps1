# Запуск локального сервера (PowerShell → CMD-обёртка)
. "$PSScriptRoot\lib.ps1"
Set-AirdropLocation
& (Join-Path $PSScriptRoot 'run-server.cmd')
exit $LASTEXITCODE
