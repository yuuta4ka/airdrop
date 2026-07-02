# АирДроп — как запустить сайт

## В один клик (macOS)

В папке **`click/`** лежат файлы для двойного клика в Finder:

| Файл | Действие |
|------|----------|
| `Start.command` | Запустить localhost |
| `Stop.command` | Остановить localhost |
| `Restart.command` | Перезапустить localhost |
| `Deploy.command` | Закоммитить и отправить на GitHub (Render обновится сам) |
| `Status.command` | Проверить, запущен ли сервер |

При первом запуске macOS может спросить разрешение — «Открыть» в настройках безопасности.

---

## Терминал

```bash
cd /Users/yuuta/airdrop
bash scripts/start-local.sh   # запуск
bash scripts/stop-local.sh    # стоп
bash scripts/restart-local.sh # перезапуск
bash scripts/deploy.sh        # деплой на прод
```

Старые команды тоже работают: `bash start.sh`, `bash dev.sh`.

---

## Быстрый запуск

```bash
cd /Users/yuuta/airdrop
bash start.sh
```

**Не используйте `sudo`** — он не нужен и мешает найти Node.js.

После запуска откройте в браузере: **http://localhost:8080**

Остановить сервер: `Ctrl + C` в окне терминала или `bash scripts/stop-local.sh`

---

## Деплой на прод

```bash
bash scripts/deploy.sh "Краткое описание изменений"
```

Или двойной клик по `click/Deploy.command`. Render подхватывает push с GitHub за 1–3 минуты.

Прод: **https://airdrop-hxpo.onrender.com**

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
