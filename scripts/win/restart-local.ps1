# Перезапуск локального сервера (Windows)
. "$PSScriptRoot\lib.ps1"
Set-AirdropLocation
Stop-AirdropServer
& "$PSScriptRoot\start-local.ps1"
exit $LASTEXITCODE
