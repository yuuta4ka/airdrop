import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SITE_DIR = path.join(__dirname, 'site')
const STORE_FILE = path.join(SITE_DIR, 'data', 'store.json')
const PRODUCTS_FILE = path.join(SITE_DIR, 'data', 'products.json')
const ORDERS_FILE = path.join(SITE_DIR, 'data', 'orders.json')
const ENV_FILE = path.join(__dirname, '.env')
const PORT = process.env.PORT || 8080

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile()

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

function readStore() { return readJson(STORE_FILE) }
function writeStore(data) { writeJson(STORE_FILE, data) }
function readProducts() { return readJson(PRODUCTS_FILE) }
function writeProducts(data) { writeJson(PRODUCTS_FILE, data) }
function readOrders() {
  if (!fs.existsSync(ORDERS_FILE)) return { orders: [] }
  return readJson(ORDERS_FILE)
}
function writeOrders(data) { writeJson(ORDERS_FILE, data) }

function normalizePhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('8')) digits = '7' + digits.slice(1)
  if (!digits.startsWith('7') && digits.length) digits = '7' + digits
  return digits.slice(0, 11)
}

function formatPhoneDisplay(digits) {
  if (digits.length !== 11 || !digits.startsWith('7')) return digits
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
}

function buildOrderMessage(order) {
  const items = order.items.map((item) =>
    `• ${item.name} (${item.variantLabel}) × ${item.qty} — ${item.price * item.qty} ₽`
  ).join('\n')

  return [
    '🛒 Новый заказ — АирДроп',
    '',
    `№ ${order.id}`,
    `👤 ${order.name}`,
    `📞 ${order.phoneDisplay}`,
    '',
    items,
    '',
    `💰 Итого: ${order.total} ₽`,
  ].join('\n')
}

async function notifyTelegramOrder(order) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const rawIds = process.env.TELEGRAM_ADMIN_CHAT_IDS || process.env.TELEGRAM_ADMIN_CHAT_ID || ''
  const chatIds = [...new Set(rawIds.split(/[,\s]+/).map((id) => id.trim()).filter(Boolean))]
  if (!token || !chatIds.length) return { ok: false, chats: [] }

  const text = buildOrderMessage(order)
  const results = await Promise.allSettled(
    chatIds.map(async (chatId) => {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(10000),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.description || `HTTP ${res.status}`)
      return chatId
    }),
  )

  const chats = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  const errors = results
    .filter((r) => r.status === 'rejected')
    .map((r) => r.reason?.message || String(r.reason))
  for (const message of errors) console.error('Telegram notify error:', message)

  return { ok: chats.length > 0, chats, errors }
}

function getTelegramStatus() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const rawIds = process.env.TELEGRAM_ADMIN_CHAT_IDS || process.env.TELEGRAM_ADMIN_CHAT_ID || ''
  const chatIds = rawIds.split(/[,\s]+/).map((id) => id.trim()).filter(Boolean)
  return { configured: Boolean(token && chatIds.length), chatCount: chatIds.length }
}

function checkAuth(req) {
  const auth = req.headers.authorization || ''
  return auth === `Bearer ${readStore().adminPassword}`
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const p = url.pathname

  if (p.endsWith('.html') && p !== '/admin.html') {
    let clean = p.slice(0, -5) || '/'
    if (clean === '/index') clean = '/'
    res.writeHead(301, { Location: clean + url.search })
    return res.end()
  }

  if (p === '/admin') {
    return serveFile(res, path.join(SITE_DIR, 'admin.html'))
  }

  if (p === '/api/store' && req.method === 'GET') {
    const store = readStore()
    if (checkAuth(req)) return sendJson(res, 200, store)
    const { adminPassword, ...publicStore } = store
    return sendJson(res, 200, publicStore)
  }

  if (p === '/api/admin/login' && req.method === 'POST') {
    try {
      const { password } = JSON.parse(await readBody(req))
      if (String(password ?? '') === readStore().adminPassword) {
        return sendJson(res, 200, { ok: true })
      }
      return sendJson(res, 401, { error: 'Неверный пароль' })
    } catch {
      return sendJson(res, 400, { error: 'Некорректный запрос' })
    }
  }

  if (p === '/api/products' && req.method === 'GET') {
    return sendJson(res, 200, readProducts())
  }

  if (p === '/api/store' && req.method === 'PUT') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const data = JSON.parse(await readBody(req))
      const current = readStore()
      writeStore({ ...data, adminPassword: data.adminPassword || current.adminPassword })
      return sendJson(res, 200, { ok: true })
    } catch {
      return sendJson(res, 400, { error: 'Некорректный JSON' })
    }
  }

  if (p === '/api/products' && req.method === 'PUT') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const data = JSON.parse(await readBody(req))
      writeProducts(data)
      return sendJson(res, 200, { ok: true })
    } catch {
      return sendJson(res, 400, { error: 'Некорректный JSON' })
    }
  }

  if (p === '/api/upload' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const { filename, data } = JSON.parse(await readBody(req))
      const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_')
      const dir = path.join(SITE_DIR, 'assets', 'products')
      fs.mkdirSync(dir, { recursive: true })
      const match = data.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!match) return sendJson(res, 400, { error: 'Некорректное изображение' })
      const out = path.join(dir, safe)
      fs.writeFileSync(out, Buffer.from(match[2], 'base64'))
      return sendJson(res, 200, { path: `assets/products/${safe}` })
    } catch {
      return sendJson(res, 400, { error: 'Ошибка загрузки' })
    }
  }

  if (p === '/api/orders' && req.method === 'GET') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    const data = readOrders()
    data.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return sendJson(res, 200, data)
  }

  if (p === '/api/orders' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req))
      const name = String(body.name ?? '').trim()
      const phoneDigits = normalizePhone(body.phone)
      const items = Array.isArray(body.items) ? body.items : []
      const total = Number(body.total) || 0

      if (name.length < 2) return sendJson(res, 400, { error: 'Укажите имя' })
      if (phoneDigits.length !== 11 || !phoneDigits.startsWith('7')) {
        return sendJson(res, 400, { error: 'Укажите корректный номер телефона' })
      }
      if (!items.length) return sendJson(res, 400, { error: 'Корзина пуста' })

      const order = {
        id: `AD-${Date.now().toString(36).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        name,
        phone: phoneDigits,
        phoneDisplay: formatPhoneDisplay(phoneDigits),
        items: items.map((item) => ({
          key: String(item.key ?? ''),
          name: String(item.name ?? ''),
          variantLabel: String(item.variantLabel ?? ''),
          qty: Math.max(1, Number(item.qty) || 1),
          price: Number(item.price) || 0,
        })),
        total,
        notified: false,
        notifiedChats: [],
      }

      const data = readOrders()
      data.orders.push(order)
      writeOrders(data)

      notifyTelegramOrder(order)
        .then((notify) => {
          const fresh = readOrders()
          const idx = fresh.orders.findIndex((o) => o.id === order.id)
          if (idx < 0) return
          if (notify.ok) {
            fresh.orders[idx].notified = true
            fresh.orders[idx].notifiedChats = notify.chats
            fresh.orders[idx].notifyError = null
          } else if (notify.errors?.length) {
            fresh.orders[idx].notifyError = notify.errors.join('; ')
          }
          writeOrders(fresh)
        })
        .catch((err) => console.error('Telegram notify failed:', err.message))

      return sendJson(res, 201, { ok: true, orderId: order.id })
    } catch {
      return sendJson(res, 400, { error: 'Некорректные данные заказа' })
    }
  }

  let filePath = path.join(SITE_DIR, p === '/' ? 'index.html' : p)

  if (!filePath.startsWith(SITE_DIR)) {
    res.writeHead(403).end()
    return
  }

  if (!path.extname(filePath) && !fs.existsSync(filePath)) {
    const withHtml = filePath + '.html'
    if (fs.existsSync(withHtml)) filePath = withHtml
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html')
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404).end('Not found')
    return
  }

  serveFile(res, filePath)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Порт ${PORT} уже занят.`)
    console.error(`   Остановите процесс: kill $(lsof -ti:${PORT})`)
    console.error(`   Или запустите: bash dev.sh\n`)
    process.exit(1)
  }
  throw err
})

server.listen(PORT, () => {
  console.log(`АирДроп: http://localhost:${PORT}`)
  console.log(`Админка: http://localhost:${PORT}/admin`)
  const tg = getTelegramStatus()
  if (tg.configured) {
    console.log(`Telegram-уведомления: включены (${tg.chatCount} получателей)`)
  } else {
    console.log('Telegram-уведомления: выключены — создайте .env по образцу .env.example')
  }
})
