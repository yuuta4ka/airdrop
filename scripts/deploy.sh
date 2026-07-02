#!/bin/bash
# Деплой на GitHub → Render подхватывает push автоматически
set -e
# shellcheck disable=SC1091
source "$(dirname "$0")/lib.sh"
airdrop_root

MSG="${1:-Deploy: Airdrop updates}"

unset GIT_ASKPASS
unset SSH_ASKPASS
export GIT_TERMINAL_PROMPT=1

echo "=== Деплой АирДроп ==="
echo ""

if ! git rev-parse --git-dir &>/dev/null; then
  echo "❌ Это не git-репозиторий."
  exit 1
fi

BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "main" ]; then
  echo "⚠️  Текущая ветка: $BRANCH (обычно деплоят из main)"
fi

git add -A

if git diff --cached --quiet; then
  echo "Нет изменений для коммита."
else
  echo "Коммит: $MSG"
  git commit -m "$MSG"
fi

if ! git remote get-url origin &>/dev/null; then
  echo "❌ Remote origin не настроен."
  echo "   bash scripts/push-to-github.sh"
  exit 1
fi

echo ""
echo "git push origin $BRANCH ..."
git push origin "$BRANCH"

echo ""
echo "✅ Код отправлен на GitHub."
echo "   Render обновит сайт за 1–3 минуты."
echo "   Прод: https://airdrop-hxpo.onrender.com"
echo ""
