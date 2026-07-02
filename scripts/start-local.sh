#!/bin/bash
# Запуск локального сервера (перед стартом освобождает порт)
set -e
# shellcheck disable=SC1091
source "$(dirname "$0")/lib.sh"
airdrop_root
setup_node
load_env

PORT="${PORT:-8080}"
export PORT

if [ -n "$(port_pids)" ]; then
  echo "Порт $PORT занят — останавливаем предыдущий процесс..."
  stop_server
fi

echo "Node.js: $(node --version)"
echo "Запуск сервера..."
open_site_hint
exec node server.mjs
