#!/bin/bash
# Остановка локального сервера
set -e
# shellcheck disable=SC1091
source "$(dirname "$0")/lib.sh"
airdrop_root
stop_server
