# Остановка локального сервера (PowerShell → CMD-обёртка)
. "$PSScriptRoot\lib.ps1"
Set-AirdropLocation
& (Join-Path $PSScriptRoot 'stop-server.cmd')
exit $LASTEXITCODE
