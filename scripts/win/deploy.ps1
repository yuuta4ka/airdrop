# Деплой на GitHub (Windows) → Render обновится автоматически
param(
    [string]$Message = 'Deploy: Airdrop updates'
)

. "$PSScriptRoot\lib.ps1"
Set-AirdropLocation

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Host 'Git не найден. Установите: https://git-scm.com/download/win' -ForegroundColor Red
    exit 1
}

Write-Host '=== Деплой АирДроп ==='
Write-Host ''

git rev-parse --git-dir 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Это не git-репозиторий.' -ForegroundColor Red
    exit 1
}

$branch = (git branch --show-current).Trim()
if ($branch -ne 'main') {
    Write-Host "Текущая ветка: $branch (обычно деплоят из main)"
}

git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "Коммит: $Message"
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host 'Нет изменений для коммита.'
}

git remote get-url origin 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Remote origin не настроен.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host "git push origin $branch ..."
git push origin $branch
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Код отправлен на GitHub.' -ForegroundColor Green
Write-Host 'Render обновит сайт за 1–3 минуты.'
Write-Host 'Прод: https://airdrop-hxpo.onrender.com'
Write-Host ''
