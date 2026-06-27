#!/bin/bash
# Добавить Node.js в PATH для текущего терминала (nvm)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
if ! command -v node &>/dev/null; then
  export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
fi
if command -v node &>/dev/null; then
  echo "Node.js: $(node --version) — можно использовать команду node"
else
  echo "Node.js не найден. Запускайте сайт: bash dev.sh"
fi
