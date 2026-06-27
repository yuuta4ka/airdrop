#!/bin/bash
# Запуск локально (Node через nvm — не нужны brew/npm в PATH)
cd "$(dirname "$0")"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
if ! command -v node &>/dev/null; then
  export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
fi
if ! command -v node &>/dev/null; then
  echo "Node.js не найден. Установите: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  exit 1
fi

PORT="${PORT:-8080}"
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "Порт $PORT занят — останавливаем предыдущий процесс..."
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export PORT
exec node server.mjs
