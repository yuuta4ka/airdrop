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

REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
if [ -z "$REMOTE_URL" ]; then
  echo "❌ Remote origin не настроен."
  echo "   bash scripts/push-to-github.sh"
  exit 1
fi

HAD_COMMIT=0
git add -A

if git diff --cached --quiet; then
  echo "Нет новых изменений для коммита (рабочая папка уже совпадает с последним коммитом)."
else
  echo "Коммит: $MSG"
  git commit -m "$MSG"
  HAD_COMMIT=1
fi

echo ""
echo "git push origin $BRANCH ..."
echo "   remote: $REMOTE_URL"
set +e
PUSH_OUT="$(git push origin "$BRANCH" 2>&1)"
PUSH_STATUS=$?
set -e
echo "$PUSH_OUT"
if [ "$PUSH_STATUS" -ne 0 ]; then
  echo ""
  echo "❌ Push не удался. Код не ушёл на GitHub."
  exit "$PUSH_STATUS"
fi

LAST_CI="$(git log -1 --format='%ci (%cr)')"
LAST_MSG="$(git log -1 --format='%s')"
SHORT="$(git rev-parse --short HEAD)"

echo ""
if echo "$PUSH_OUT" | grep -qi 'Everything up-to-date'; then
  echo "ℹ️  На GitHub уже лежит этот же коммит — нового деплоя не было."
  echo "   Последний коммит: $SHORT — $LAST_MSG"
  echo "   Время: $LAST_CI"
  echo "   Репозиторий: https://github.com/yuuta4ka/airdrop"
  echo ""
  echo "   Если ждали обновление сайта: сначала измените файлы проекта,"
  echo "   потом снова запустите Deploy.command."
else
  echo "✅ Новый код отправлен на GitHub ($SHORT)."
  if [ "$HAD_COMMIT" -eq 1 ]; then
    echo "   Render обычно обновляет сайт за 1–3 минуты."
  fi
  echo "   Коммит: https://github.com/yuuta4ka/airdrop/commit/$SHORT"
fi
echo "   Прод: https://airdrop-hxpo.onrender.com"
echo ""
