# Stop local server (wrapper -> stop-server.cmd)
. "$PSScriptRoot\lib.ps1"
Set-AirdropLocation
& (Join-Path $PSScriptRoot 'stop-server.cmd')
exit $LASTEXITCODE
