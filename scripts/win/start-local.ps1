# Запуск локального сервера АирДроп (Windows)
. "$PSScriptRoot\lib.ps1"
Set-AirdropLocation
Import-AirdropEnv
Ensure-Node | Out-Null

$port = Get-AirdropPort
if (-not $env:PORT) { $env:PORT = "$port" }

if (Get-PortListenerPids -Port $port) {
    Write-Host "Порт $port занят — останавливаем предыдущий процесс..."
    Stop-AirdropServer
}

Write-Host "Node.js: $(node --version)"
Write-Host 'Запуск сервера...'
Show-SiteHint

& node server.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
