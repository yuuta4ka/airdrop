# Общие функции для скриптов АирДроп
# shellcheck shell=bash

airdrop_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
}

setup_node() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
  fi
  if ! command -v node &>/dev/null; then
    if [ -x "$HOME/.nvm/versions/node/v24.18.0/bin/node" ]; then
      export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
    fi
  fi
  if ! command -v node &>/dev/null; then
    echo "❌ Node.js не найден."
    echo "Установите: https://nodejs.org"
    echo "Или: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    exit 1
  fi
}

load_env() {
  if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
}

airdrop_port() {
  echo "${PORT:-8080}"
}

port_pids() {
  local port
  port="$(airdrop_port)"
  lsof -ti:"$port" 2>/dev/null || true
}

stop_server() {
  local pids port
  port="$(airdrop_port)"
  pids="$(port_pids)"
  if [ -z "$pids" ]; then
    echo "Сервер не запущен (порт $port свободен)."
    return 0
  fi
  echo "Останавливаем сервер на порту $port..."
  # shellcheck disable=SC2086
  kill -9 $pids 2>/dev/null || true
  sleep 0.5
  if [ -n "$(port_pids)" ]; then
    echo "❌ Не удалось остановить процесс."
    return 1
  fi
  echo "✅ Сервер остановлен."
}

server_status() {
  local port pids
  port="$(airdrop_port)"
  pids="$(port_pids)"
  if [ -n "$pids" ]; then
    echo "🟢 Сервер запущен: http://localhost:$port  (PID: $pids)"
    return 0
  fi
  echo "⚪ Сервер не запущен (порт $port)"
  return 1
}

open_site_hint() {
  local port
  port="$(airdrop_port)"
  echo ""
  echo "  Сайт:    http://localhost:$port"
  echo "  Админка: http://localhost:$port/admin"
  echo "  Стоп:    bash scripts/stop-local.sh  или  click/Stop.command  (Windows: click-win\\Stop.bat)"
  echo ""
}
