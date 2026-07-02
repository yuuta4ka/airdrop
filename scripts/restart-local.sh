#!/bin/bash
# Перезапуск локального сервера
set -e
DIR="$(dirname "$0")"
bash "$DIR/stop-local.sh"
exec bash "$DIR/start-local.sh"
