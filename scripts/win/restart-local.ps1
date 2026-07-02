# Restart local server (Windows)
. "$PSScriptRoot\lib.ps1"
Set-AirdropLocation
Stop-AirdropServer
& (Join-Path $PSScriptRoot 'run-server.cmd')
exit $LASTEXITCODE
