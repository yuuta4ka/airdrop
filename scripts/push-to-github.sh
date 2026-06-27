#!/bin/bash
# Заливка на GitHub (обходит ошибку credential в Cursor)
set -e
cd "$(dirname "$0")/.."

GITHUB_USER="${1:-yuuta4ka}"
REPO="${2:-airdrop}"
REMOTE="https://github.com/${GITHUB_USER}/${REPO}.git"

# Cursor подставляет свой askpass — из‑за этого «Missing or invalid credentials»
unset GIT_ASKPASS
unset SSH_ASKPASS
export GIT_TERMINAL_PROMPT=1

echo ""
echo "=== Проверка репозитория на GitHub ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://github.com/${GITHUB_USER}/${REPO}")

if [ "$CODE" = "404" ]; then
  echo ""
  echo "Репозиторий https://github.com/${GITHUB_USER}/${REPO} ещё НЕ СОЗДАН."
  echo ""
  echo "Сделайте сейчас:"
  echo "  1. Откройте в браузере: https://github.com/new"
  echo "  2. Repository name: ${REPO}"
  echo "  3. Public"
  echo "  4. НЕ ставьте галочки README / .gitignore / license"
  echo "  5. Create repository"
  echo ""
  read -r -p "Когда создали — нажмите Enter здесь... "
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://github.com/${GITHUB_USER}/${REPO}")
  if [ "$CODE" = "404" ]; then
    echo "Репозиторий всё ещё не виден. Проверьте имя и что вы вошли в GitHub как ${GITHUB_USER}."
    exit 1
  fi
fi

echo "Репозиторий найден."

if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

echo ""
echo "=== git push ==="
echo "Если спросит логин/пароль:"
echo "  Username: ${GITHUB_USER}"
echo "  Password: НЕ пароль от GitHub, а Personal Access Token"
echo "  (создать: https://github.com/settings/tokens → Generate new token (classic) → repo)"
echo ""

git push -u origin main

echo ""
echo "Готово! Дальше Render: https://dashboard.render.com/select-repo?type=blueprint"
