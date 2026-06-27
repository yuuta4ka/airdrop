#!/bin/bash
# Запуск сайта АирДроп — не требует npm в PATH

cd "$(dirname "$0")"

# Подключаем Node.js (установлен через nvm)
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

# Если nvm не сработал — пробуем напрямую
if ! command -v node &>/dev/null; then
  if [ -x "$HOME/.nvm/versions/node/v24.18.0/bin/node" ]; then
    export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
  fi
fi

if ! command -v node &>/dev/null; then
  echo "❌ Node.js не найден."
  echo "Установите Node.js: https://nodejs.org"
  echo "Или выполните: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  exit 1
fi

echo "Node.js: $(node --version)"
echo "Запуск сервера..."
echo ""

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
node server.mjs
