# Deploy to GitHub (Windows)
param(
    [string]$Message = 'Deploy: Airdrop updates'
)

. "$PSScriptRoot\lib.ps1"
Set-AirdropLocation

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Host 'Git not found. Install: https://git-scm.com/download/win' -ForegroundColor Red
    exit 1
}

Write-Host '=== Airdrop deploy ==='
Write-Host ''

git rev-parse --git-dir 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Not a git repository.' -ForegroundColor Red
    exit 1
}

$branch = (git branch --show-current).Trim()
if ($branch -ne 'main') {
    Write-Host "Current branch: $branch"
}

git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit: $Message"
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host 'No changes to commit.'
}

git remote get-url origin 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Remote origin is not configured.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host "git push origin $branch ..."
git push origin $branch
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Pushed to GitHub.' -ForegroundColor Green
Write-Host 'https://airdrop-hxpo.onrender.com'
Write-Host ''
