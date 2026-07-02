# Start local server (wrapper -> run-server.cmd)
. "$PSScriptRoot\lib.ps1"
Set-AirdropLocation
& (Join-Path $PSScriptRoot 'run-server.cmd')
exit $LASTEXITCODE
