# Общие функции для скриптов АирДроп (Windows)
$ErrorActionPreference = 'Stop'

function Get-AirdropRoot {
    if ($script:AirdropRoot) { return $script:AirdropRoot }
    $script:AirdropRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    return $script:AirdropRoot
}

function Get-AirdropPort {
    if ($env:PORT) { return [int]$env:PORT }
    return 8080
}

function Set-AirdropLocation {
    Set-Location (Get-AirdropRoot)
}

function Import-AirdropEnv {
    $envFile = Join-Path (Get-AirdropRoot) '.env'
    if (-not (Test-Path $envFile)) { return }
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) { return }
        $eq = $line.IndexOf('=')
        if ($eq -lt 1) { return }
        $key = $line.Substring(0, $eq).Trim()
        $val = $line.Substring($eq + 1).Trim()
        if ($val.StartsWith('"') -and $val.EndsWith('"')) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        Set-Item -Path "Env:$key" -Value $val
    }
}

function Ensure-Node {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) { return $node.Source }

    $candidates = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "$env:ProgramFiles (x86)\nodejs\node.exe",
        "$env:APPDATA\nvm\*\node.exe",
        "$env:NVM_HOME\node.exe"
    )
    foreach ($pattern in $candidates) {
        $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $dir = Split-Path $found.FullName -Parent
            $env:PATH = "$dir;$env:PATH"
            return $found.FullName
        }
    }

    Write-Host 'Node.js не найден.' -ForegroundColor Red
    Write-Host 'Установите: https://nodejs.org'
    exit 1
}

function Get-PortListenerPids {
    param([int]$Port = (Get-AirdropPort))
    $pids = @()

    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
        }
    }

    if (-not $pids) {
        $lines = netstat -ano | Select-String ":$Port\s" | Select-String 'LISTENING'
        foreach ($line in $lines) {
            $parts = ($line -replace '\s+', ' ').ToString().Trim().Split(' ')
            $pid = [int]$parts[-1]
            if ($pid -gt 0) { $pids += $pid }
        }
        $pids = $pids | Select-Object -Unique
    }

    return $pids
}

function Stop-AirdropServer {
    $port = Get-AirdropPort
    $pids = Get-PortListenerPids -Port $port
    if (-not $pids) {
        Write-Host "Сервер не запущен (порт $port свободен)."
        return
    }
    Write-Host "Останавливаем сервер на порту $port..."
    foreach ($procId in $pids) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 500
    if (Get-PortListenerPids -Port $port) {
        Write-Host 'Не удалось остановить процесс.' -ForegroundColor Red
        exit 1
    }
    Write-Host 'Сервер остановлен.' -ForegroundColor Green
}

function Show-AirdropStatus {
    $port = Get-AirdropPort
    $pids = Get-PortListenerPids -Port $port
    if ($pids) {
        $pidList = ($pids -join ', ')
        Write-Host "Сервер запущен: http://localhost:$port  (PID: $pidList)" -ForegroundColor Green
        return
    }
    Write-Host "Сервер не запущен (порт $port)"
}

function Show-SiteHint {
    $port = Get-AirdropPort
    Write-Host ''
    Write-Host "  Сайт:    http://localhost:$port"
    Write-Host "  Админка: http://localhost:$port/admin"
    Write-Host '  Стоп:    click-win\Stop.bat'
    Write-Host ''
}
