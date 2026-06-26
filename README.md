# АирДроп — как запустить сайт

## Быстрый запуск (рекомендуется)

Откройте **Терминал** и выполните:

```bash
cd /Users/yuuta/airdrop
bash start.sh
```

**Не используйте `sudo`** — он не нужен и мешает найти Node.js.

После запуска откройте в браузере: **http://localhost:8080**

Остановить сервер: `Ctrl + C`

---

## Если `npm: command not found`

Node.js у вас установлен через **nvm**, но терминал его не подхватывает автоматически. Используйте `bash start.sh` — он сам найдёт Node.js.

Или вручную:

```bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
cd /Users/yuuta/airdrop
node server.mjs
```

---

## Почему пишет «Not found»?

Сайт **нельзя** открывать двойным кликом по файлу `index.html`. Нужен запущенный сервер (`bash start.sh`), и адрес в браузере:

- ✅ `http://localhost:8080`
- ❌ `file:///Users/yuuta/airdrop/site/index.html`

Если сервер не запущен — страницы не откроются.

---

## Админка

http://localhost:8080/admin.html — пароль: `airdrop196`
