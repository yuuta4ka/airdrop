#!/bin/bash
# Публикация на GitHub + подсказка для Render
set -e
cd "$(dirname "$0")/.."

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "=== 1. Git ==="
if [ ! -d .git ]; then
  git init -b main
fi

if ! git rev-parse HEAD &>/dev/null; then
  git add -A
  git -c user.name="Airdrop" -c user.email="deploy@airdrop.local" commit -m "Deploy: Airdrop store"
else
  git add -A
  if ! git diff --cached --quiet; then
    git -c user.name="Airdrop" -c user.email="deploy@airdrop.local" commit -m "Update site"
  fi
fi

echo ""
echo "=== 2. GitHub ==="
if ! command -v gh &>/dev/null; then
  echo "GitHub CLI (gh) не установлен."
  echo "Установите: https://cli.github.com — или создайте репозиторий на github.com вручную и выполните:"
  echo "  git remote add origin https://github.com/ВАШ_ЛОГИН/airdrop.git"
  echo "  git push -u origin main"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "Войдите в GitHub (откроется браузер):"
  gh auth login -h github.com -p https -w
fi

REPO_NAME="${1:-airdrop}"
if ! gh repo view "$REPO_NAME" &>/dev/null 2>&1; then
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
else
  git remote remove origin 2>/dev/null || true
  gh repo set-default "$(gh api user -q .login)/$REPO_NAME"
  git remote add origin "https://github.com/$(gh api user -q .login)/$REPO_NAME.git"
  git push -u origin main
fi

echo ""
echo "=== 3. Render ==="
echo "Откройте: https://dashboard.render.com/select-repo?type=blueprint"
echo "Выберите репозиторий $REPO_NAME — Render подхватит render.yaml автоматически."
echo "Или: New → Web Service → репозиторий → Start: node server.mjs"
