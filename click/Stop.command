#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
bash scripts/stop-local.sh
echo ""
read -r -p "Нажмите Enter для закрытия..."
