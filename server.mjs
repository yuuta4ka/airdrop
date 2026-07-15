import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCatalogFromPdfText, extractTextFromPdfBuffer } from './price-pdf-catalog.mjs'
import {
  buildCatalogFromPriceText,
  buildPriceJsonlPrompt,
  buildProductStubFromPriceName,
  defaultPromptCategoryRows,
  promptCategoryProductCounts,
} from './price-text-import.mjs'
import {
  buildBackupPayload,
  mergeProducts,
  validateBackupData,
  validateProductsData,
} from './catalog-package.mjs'
import { applyCatalogZip, buildCatalogZip } from './catalog-zip.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_STARTED_AT = new Date().toISOString()
const SITE_DIR = path.join(__dirname, 'site')
const STORE_FILE = path.join(SITE_DIR, 'data', 'store.json')
const PRODUCTS_FILE = path.join(SITE_DIR, 'data', 'products.json')
const ORDERS_FILE = path.join(SITE_DIR, 'data', 'orders.json')
const AUTH_STATE_FILE = path.join(SITE_DIR, 'data', 'auth-state.json')
const ENV_FILE = path.join(__dirname, '.env')
const PORT = process.env.PORT || 8080

const AUTH_LIMITS = {
  resetRequestsPerHour: 3,
  changeRequestsPerHour: 5,
  loginFailuresPer15Min: 10,
  codeTtlMs: 10 * 60 * 1000,
  maxCodeAttempts: 5,
  minPasswordLength: 6,
}

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

console.log(`Starting Airdrop (Node ${process.version}), PORT=${PORT}`)

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

function readAuthState() {
  if (!fs.existsSync(AUTH_STATE_FILE)) return { codes: {}, rateLimits: {} }
  try {
    return readJson(AUTH_STATE_FILE)
  } catch {
    return { codes: {}, rateLimits: {} }
  }
}

function writeAuthState(data) {
  writeJson(AUTH_STATE_FILE, data)
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (fwd) return String(fwd).split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

function checkRateLimit(state, key, max, windowMs) {
  const now = Date.now()
  const entry = state.rateLimits[key] || { count: 0, resetAt: now + windowMs }
  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + windowMs
  }
  if (entry.count >= max) {
    return { ok: false, retrySec: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count += 1
  state.rateLimits[key] = entry
  return { ok: true }
}

function generateAuthCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function getAdminChatIds() {
  const rawIds = process.env.TELEGRAM_ADMIN_CHAT_IDS || process.env.TELEGRAM_ADMIN_CHAT_ID || ''
  return [...new Set(rawIds.split(/[,\s]+/).map((id) => id.trim()).filter(Boolean))]
}

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) throw new Error('Telegram не настроен')
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(10000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.description || `HTTP ${res.status}`)
  return data
}

async function sendTelegramToAdmins(text) {
  const chatIds = getAdminChatIds()
  if (!chatIds.length) return { ok: false, error: 'Telegram не настроен' }
  const results = await Promise.allSettled(chatIds.map((chatId) => sendTelegramMessage(chatId, text)))
  const sent = results.filter((r) => r.status === 'fulfilled').length
  return sent > 0 ? { ok: true, sent } : { ok: false, error: 'Не удалось отправить в Telegram' }
}

function createAuthCode(state, type, meta = {}) {
  const code = generateAuthCode()
  state.codes[type] = {
    code,
    expiresAt: Date.now() + AUTH_LIMITS.codeTtlMs,
    attempts: 0,
    used: false,
    createdAt: new Date().toISOString(),
    ...meta,
  }
  return code
}

function verifyAuthCode(state, type, inputCode) {
  const entry = state.codes[type]
  if (!entry || entry.used) return { ok: false, error: 'Код не запрошен или уже использован' }
  if (Date.now() > entry.expiresAt) return { ok: false, error: 'Код истёк — запросите новый' }
  entry.attempts += 1
  if (entry.attempts > AUTH_LIMITS.maxCodeAttempts) {
    entry.used = true
    writeAuthState(state)
    return { ok: false, error: 'Превышено число попыток' }
  }
  if (String(inputCode ?? '').trim() !== entry.code) {
    writeAuthState(state)
    return { ok: false, error: 'Неверный код' }
  }
  entry.used = true
  return { ok: true, entry }
}

function validateNewPassword(password, confirm) {
  const p = String(password ?? '')
  const c = String(confirm ?? '')
  if (p.length < AUTH_LIMITS.minPasswordLength) {
    return { ok: false, error: `Пароль не короче ${AUTH_LIMITS.minPasswordLength} символов` }
  }
  if (p !== c) return { ok: false, error: 'Пароли не совпадают' }
  return { ok: true, password: p }
}

let telegramOffset = 0

async function handleTelegramUpdate(update) {
  const msg = update.message
  if (!msg?.text) return
  const chatId = String(msg.chat.id)
  const adminIds = getAdminChatIds()
  if (!adminIds.includes(chatId)) return

  const text = msg.text.trim()
  if (text === '/start' || text === '/code' || text === '/код') {
    await sendTelegramMessage(chatId, [
      '🔐 Бот АирДроп Admin',
      '',
      'Коды приходят автоматически при:',
      '• сбросе пароля (кнопка «Забыли пароль?»)',
      '• смене пароля в админке',
      '',
      'Код действует 10 минут.',
    ].join('\n'))
  }
}

async function pollTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) return
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${telegramOffset}&timeout=25`,
      { signal: AbortSignal.timeout(35000) },
    )
    const data = await res.json()
    if (data.ok && data.result?.length) {
      for (const update of data.result) {
        telegramOffset = update.update_id + 1
        await handleTelegramUpdate(update).catch((err) => {
          console.error('Telegram update error:', err.message)
        })
      }
    }
  } catch (err) {
    if (err.name !== 'TimeoutError') console.error('Telegram poll error:', err.message)
  }
  setTimeout(pollTelegram, 500)
}

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

function sendJson(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  })
  res.end(JSON.stringify(data))
}

function fileEtag(filePath) {
  try {
    const st = fs.statSync(filePath)
    return `"${st.mtimeMs.toFixed(0)}-${st.size}"`
  } catch {
    return `"${Date.now()}"`
  }
}

function sendJsonCached(req, res, filePath, data, { publicCache = false } = {}) {
  const etag = fileEtag(filePath)
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, {
      ETag: etag,
      'Cache-Control': publicCache ? 'public, max-age=30, must-revalidate' : 'private, max-age=15, must-revalidate',
    })
    return res.end()
  }
  return sendJson(res, 200, data, {
    ETag: etag,
    'Cache-Control': publicCache ? 'public, max-age=30, must-revalidate' : 'private, max-age=15, must-revalidate',
  })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

/** Бинарное тело (ZIP каталога и т.п.) — без склейки в строку. */
function readBodyBuffer(req, { maxBytes = 512 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (c) => {
      total += c.length
      if (total > maxBytes) {
        reject(new Error(`Файл слишком большой (лимит ${Math.round(maxBytes / 1024 / 1024)} МБ)`))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function cacheControlFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const rel = path.relative(SITE_DIR, filePath).replace(/\\/g, '/')
  if (ext === '.html' || rel === 'admin.html') return 'no-cache'
  if (rel.startsWith('data/')) return 'no-store'
  if (['.css', '.js', '.mjs', '.woff', '.woff2', '.ttf'].includes(ext)) {
    return 'public, max-age=86400, stale-while-revalidate=604800'
  }
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.avif'].includes(ext)) {
    return 'public, max-age=604800, stale-while-revalidate=2592000'
  }
  return 'public, max-age=300'
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': cacheControlFor(filePath),
  })
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

  // Красивые ссылки: /product или /product/iphone-17-pro-max (только один сегмент)
  if (p === '/product' || /^\/product\/[^/]+\/?$/.test(p)) {
    return serveFile(res, path.join(SITE_DIR, 'product.html'))
  }

  if (p === '/api/store' && req.method === 'GET') {
    const store = readStore()
    if (checkAuth(req)) {
      // Не кэшируем полный store с админ-сессией — тело отличается от публичного
      return sendJson(res, 200, store, { 'Cache-Control': 'no-store' })
    }
    const { adminPassword, ...publicStore } = store
    return sendJsonCached(req, res, STORE_FILE, publicStore, { publicCache: true })
  }

  if (p === '/api/admin/login' && req.method === 'POST') {
    try {
      const ip = getClientIp(req)
      const state = readAuthState()
      const limit = checkRateLimit(state, `login:${ip}`, AUTH_LIMITS.loginFailuresPer15Min, 15 * 60 * 1000)
      if (!limit.ok) {
        writeAuthState(state)
        return sendJson(res, 429, { error: `Слишком много попыток. Подождите ${limit.retrySec} сек.` })
      }

      const { password } = JSON.parse(await readBody(req))
      if (String(password ?? '') === readStore().adminPassword) {
        state.rateLimits[`login:${ip}`] = { count: 0, resetAt: Date.now() + 15 * 60 * 1000 }
        writeAuthState(state)
        return sendJson(res, 200, { ok: true })
      }
      writeAuthState(state)
      return sendJson(res, 401, { error: 'Неверный пароль' })
    } catch {
      return sendJson(res, 400, { error: 'Некорректный запрос' })
    }
  }

  if (p === '/api/admin/request-reset-code' && req.method === 'POST') {
    try {
      const ip = getClientIp(req)
      const state = readAuthState()
      const limit = checkRateLimit(state, `reset-req:${ip}`, AUTH_LIMITS.resetRequestsPerHour, 60 * 60 * 1000)
      if (!limit.ok) {
        writeAuthState(state)
        return sendJson(res, 429, { error: `Лимит запросов. Повторите через ${Math.ceil(limit.retrySec / 60)} мин.` })
      }

      const code = createAuthCode(state, 'reset', { ip })
      writeAuthState(state)

      const notify = await sendTelegramToAdmins([
        '🔑 Сброс пароля админки',
        '',
        `Код: ${code}`,
        'Действует 10 минут.',
        '',
        `IP: ${ip}`,
      ].join('\n'))

      if (!notify.ok) return sendJson(res, 503, { error: notify.error || 'Telegram не настроен' })
      return sendJson(res, 200, { ok: true, message: 'Код отправлен в Telegram' })
    } catch {
      return sendJson(res, 400, { error: 'Ошибка запроса' })
    }
  }

  if (p === '/api/admin/reset-password' && req.method === 'POST') {
    try {
      const ip = getClientIp(req)
      const { code, password, confirm } = JSON.parse(await readBody(req))
      const passCheck = validateNewPassword(password, confirm)
      if (!passCheck.ok) return sendJson(res, 400, { error: passCheck.error })

      const state = readAuthState()
      const verify = verifyAuthCode(state, 'reset', code)
      if (!verify.ok) {
        writeAuthState(state)
        return sendJson(res, 400, { error: verify.error })
      }

      const store = readStore()
      store.adminPassword = passCheck.password
      writeStore(store)
      delete state.codes.reset
      writeAuthState(state)
      return sendJson(res, 200, { ok: true })
    } catch {
      return sendJson(res, 400, { error: 'Некорректный запрос' })
    }
  }

  if (p === '/api/admin/request-change-code' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const ip = getClientIp(req)
      const state = readAuthState()
      const limit = checkRateLimit(state, `change-req:${ip}`, AUTH_LIMITS.changeRequestsPerHour, 60 * 60 * 1000)
      if (!limit.ok) {
        writeAuthState(state)
        return sendJson(res, 429, { error: `Лимит запросов. Повторите через ${Math.ceil(limit.retrySec / 60)} мин.` })
      }

      const code = createAuthCode(state, 'change', { ip })
      writeAuthState(state)

      const notify = await sendTelegramToAdmins([
        '🔐 Смена пароля админки',
        '',
        `Код: ${code}`,
        'Действует 10 минут.',
      ].join('\n'))

      if (!notify.ok) return sendJson(res, 503, { error: notify.error || 'Telegram не настроен' })
      return sendJson(res, 200, { ok: true, message: 'Код отправлен в Telegram' })
    } catch {
      return sendJson(res, 400, { error: 'Ошибка запроса' })
    }
  }

  if (p === '/api/admin/change-password' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const { code, password, confirm } = JSON.parse(await readBody(req))
      const passCheck = validateNewPassword(password, confirm)
      if (!passCheck.ok) return sendJson(res, 400, { error: passCheck.error })

      const state = readAuthState()
      const verify = verifyAuthCode(state, 'change', code)
      if (!verify.ok) {
        writeAuthState(state)
        return sendJson(res, 400, { error: verify.error })
      }

      const store = readStore()
      store.adminPassword = passCheck.password
      writeStore(store)
      delete state.codes.change
      writeAuthState(state)
      return sendJson(res, 200, { ok: true })
    } catch {
      return sendJson(res, 400, { error: 'Некорректный запрос' })
    }
  }

  if (p === '/api/products' && req.method === 'GET') {
    return sendJsonCached(req, res, PRODUCTS_FILE, readProducts(), { publicCache: true })
  }

  if (p === '/api/store' && req.method === 'PUT') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const data = JSON.parse(await readBody(req))
      const current = readStore()
      // Пароль меняется только через /api/admin/change-password
      delete data.adminPassword
      writeStore({ ...data, adminPassword: current.adminPassword })
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

  if (p === '/api/ping' && req.method === 'GET') {
    const store = readStore()
    return sendJson(res, 200, {
      ok: true,
      importPdf: true,
      importPriceText: true,
      importCatalogZip: true,
      domPolyfill: true,
      startedAt: SERVER_STARTED_AT,
      lastTextImportAt: store.priceImport?.lastTextImportAt || null,
      lastPdfImportAt: store.priceImport?.lastImportAt || null,
    })
  }

  if (p === '/api/prompt-category-coverage' && req.method === 'GET') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    const store = readStore()
    const names = (store.priceImport?.promptCategories?.length
      ? store.priceImport.promptCategories
      : defaultPromptCategoryRows()
    ).map((row) => row.name).filter(Boolean)
    const products = readProducts().products || []
    return sendJson(res, 200, {
      coverage: promptCategoryProductCounts(products, names),
    })
  }

  if (p === '/api/price-jsonl-prompt' && (req.method === 'GET' || req.method === 'POST')) {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    let categories = []
    let allCategories = []
    if (req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req))
        categories = Array.isArray(body.categories) ? body.categories : []
        allCategories = Array.isArray(body.allCategories) ? body.allCategories : []
      } catch {
        return sendJson(res, 400, { error: 'Некорректный JSON' })
      }
    } else {
      const store = readStore()
      const rows = store.priceImport?.promptCategories?.length
        ? store.priceImport.promptCategories
        : defaultPromptCategoryRows()
      allCategories = rows.map((row) => row?.name).filter(Boolean)
      categories = rows
        .filter((row) => row?.selected && row?.name)
        .map((row) => row.name)
      if (!categories.length) {
        categories = defaultPromptCategoryRows().filter((r) => r.selected).map((r) => r.name)
      }
    }
    if (!allCategories.length) {
      allCategories = defaultPromptCategoryRows().map((r) => r.name)
    }
    return sendJson(res, 200, {
      prompt: buildPriceJsonlPrompt(categories, allCategories),
      categories,
      allCategories,
    })
  }

  if (p === '/api/import-price-pdf' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const body = JSON.parse(await readBody(req))
      const raw = body.data ?? body.pdf
      if (!raw) return sendJson(res, 400, { error: 'Файл не передан' })

      const buffer = Buffer.from(String(raw).replace(/^data:[^;]+;base64,/, ''), 'base64')
      if (buffer.length < 100) return sendJson(res, 400, { error: 'Пустой или повреждённый PDF' })

      const text = await extractTextFromPdfBuffer(buffer)
      const store = readStore()
      const markup = {
        percent: Number(body.markupPercent ?? store.priceImport?.markupPercent ?? 15),
        fixed: Number(body.markupFixed ?? store.priceImport?.markupFixed ?? 0),
      }

      const existing = readProducts()
      const sections = Array.isArray(body.sections)
        ? body.sections.filter((s) => typeof s === 'string' && s.trim())
        : null
      const { products, stats } = buildCatalogFromPdfText(text, existing.products, markup, {
        sections: sections?.length ? sections : null,
        pricesOnly: body.pricesOnly !== false,
      })

      if (!body.dryRun) {
        writeProducts({ products })
        if (body.saveMarkup !== false) {
          store.priceImport = {
            markupPercent: markup.percent,
            markupFixed: markup.fixed,
            lastImportAt: new Date().toISOString(),
            lastSections: sections?.length ? sections : store.priceImport?.lastSections,
          }
          writeStore(store)
        }
      }

      return sendJson(res, 200, {
        ok: true,
        stats,
        productCount: products.length,
        pricesOnly: body.pricesOnly !== false,
      })
    } catch (err) {
      console.error('PDF import error:', err)
      return sendJson(res, 500, { error: err.message || 'Ошибка импорта PDF' })
    }
  }

  if (p === '/api/admin/create-from-price-name' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const body = JSON.parse(await readBody(req))
      const name = String(body.name || '').trim()
      if (!name) return sendJson(res, 400, { error: 'Не передано название' })
      const existing = readProducts()
      const result = buildProductStubFromPriceName(name, existing.products)
      if (result.error) {
        return sendJson(res, 400, { error: result.error, existingId: result.existingId })
      }
      existing.products.push(result.product)
      writeProducts(existing)
      return sendJson(res, 200, {
        ok: true,
        product: result.product,
        section: result.section,
      })
    } catch (err) {
      console.error('Create from price name error:', err)
      return sendJson(res, 500, { error: err.message || 'Ошибка создания карточки' })
    }
  }

  if (p === '/api/import-price-text' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const body = JSON.parse(await readBody(req))
      const text = body.text ?? body.data
      if (!text || !String(text).trim()) return sendJson(res, 400, { error: 'Текст не передан' })

      const store = readStore()
      const markup = {
        percent: Number(body.markupPercent ?? store.priceImport?.markupPercent ?? 15),
        fixed: Number(body.markupFixed ?? store.priceImport?.markupFixed ?? 0),
      }
      const dryRun = !!body.dryRun
      const replaceVariants = body.replaceVariants !== false
      const preserveVariantProductIds = Array.isArray(body.preserveVariantProductIds)
        ? body.preserveVariantProductIds
        : []

      const existing = readProducts()
      const { products, stats } = buildCatalogFromPriceText(String(text), existing.products, markup, {
        replaceVariants,
        preserveVariantProductIds,
      })

      if (!dryRun) {
        const importedAt = new Date().toISOString()
        const touched = new Set(stats.touchedProductIds || [])
        for (const product of products) {
          if (touched.has(product.id)) product.lastPriceImportAt = importedAt
        }
        writeProducts({ products })
        store.priceImport = {
          ...store.priceImport,
          markupPercent: markup.percent,
          markupFixed: markup.fixed,
          lastTextImportAt: importedAt,
          lastTextImportMode: replaceVariants ? 'replace' : 'keep',
          lastTouchedProductIds: [...touched],
        }
        writeStore(store)
      }

      return sendJson(res, 200, {
        ok: true,
        dryRun,
        replaceVariants,
        stats,
        productCount: products.length,
      })
    } catch (err) {
      console.error('Text price import error:', err)
      return sendJson(res, 500, { error: err.message || 'Ошибка импорта текста' })
    }
  }

  if (p === '/api/admin/export-backup' && req.method === 'GET') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const payload = buildBackupPayload(readStore(), readProducts())
      const body = JSON.stringify(payload, null, 2)
      const filename = `airdrop-backup-${new Date().toISOString().slice(0, 10)}.json`
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
      return res.end(body)
    } catch (err) {
      return sendJson(res, 400, { error: err.message || 'Ошибка экспорта' })
    }
  }

  if (p === '/api/admin/export-catalog' && req.method === 'GET') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const zipBuffer = buildCatalogZip(SITE_DIR, readProducts())
      const filename = `airdrop-catalog-${new Date().toISOString().slice(0, 10)}.zip`
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBuffer.length),
      })
      return res.end(zipBuffer)
    } catch (err) {
      return sendJson(res, 400, { error: err.message || 'Ошибка экспорта каталога' })
    }
  }

  if (p === '/api/admin/import-backup' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const body = JSON.parse(await readBody(req))
      const backup = validateBackupData(body)
      const current = readStore()
      const store = { ...backup.store, adminPassword: current.adminPassword }
      writeStore(store)
      writeProducts(backup.products)
      return sendJson(res, 200, {
        ok: true,
        stats: { products: backup.products.products.length },
      })
    } catch (err) {
      return sendJson(res, 400, { error: err.message || 'Ошибка импорта' })
    }
  }

  if (p === '/api/admin/import-products' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const body = JSON.parse(await readBody(req))
      if (!Array.isArray(body.products)) return sendJson(res, 400, { error: 'Нет поля products' })
      const mode = body.mode === 'replace' ? 'replace' : 'merge'
      const merged = mergeProducts(readProducts(), { products: body.products }, mode)
      writeProducts(merged)
      return sendJson(res, 200, {
        ok: true,
        stats: { count: merged.products.length, mode },
      })
    } catch (err) {
      return sendJson(res, 400, { error: err.message || 'Ошибка импорта товаров' })
    }
  }

  if (p === '/api/admin/import-catalog' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const ct = String(req.headers['content-type'] || '')
      let zipBuffer
      let mode = 'merge'

      // Предпочтительно: сырой ZIP (меньше памяти, без base64)
      if (ct.includes('application/zip') || ct.includes('application/octet-stream') || ct.includes('application/x-zip')) {
        mode = String(req.headers['x-import-mode'] || '').toLowerCase() === 'replace' ? 'replace' : 'merge'
        zipBuffer = await readBodyBuffer(req)
      } else {
        const body = JSON.parse(await readBody(req))
        const raw = String(body.data ?? '')
        const base64 = raw.replace(/^data:[^;]+;base64,/, '')
        if (!base64) return sendJson(res, 400, { error: 'Файл не передан' })
        mode = body.mode === 'replace' ? 'replace' : 'merge'
        zipBuffer = Buffer.from(base64, 'base64')
      }

      if (!zipBuffer?.length) return sendJson(res, 400, { error: 'Пустой файл каталога' })

      const existing = readProducts()
      if (!Array.isArray(existing?.products)) existing.products = []
      let result
      try {
        result = applyCatalogZip(SITE_DIR, zipBuffer, existing, mode)
      } catch (err) {
        if (String(err?.message || '').includes('No END header')) {
          throw new Error('Файл не является корректным ZIP-архивом')
        }
        throw err
      }
      writeProducts(result.products)
      return sendJson(res, 200, { ok: true, stats: result.stats })
    } catch (err) {
      console.error('Catalog import error:', err)
      return sendJson(res, 400, { error: err.message || 'Ошибка импорта каталога' })
    }
  }

  if (p === '/api/upload' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Неверный пароль' })
    try {
      const { filename, data } = JSON.parse(await readBody(req))
      const match = data.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!match) return sendJson(res, 400, { error: 'Некорректное изображение' })

      const mimeExt = String(match[1] || '').toLowerCase().replace('jpeg', 'jpg')
      const rawName = path.basename(String(filename || 'image'))
      const safeBase = rawName.replace(/[^a-zA-Z0-9._-]/g, '_')
      const fromName = path.extname(safeBase)
      const ext = (fromName || (mimeExt ? `.${mimeExt}` : '.jpg')).toLowerCase()
      const stem = (fromName ? path.basename(safeBase, fromName) : safeBase).slice(0, 80) || 'image'
      // Уникальное имя: старые файлы не трогаем, одинаковые исходные имена не перезаписывают друг друга
      const unique = `${stem}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${ext}`

      const dir = path.join(SITE_DIR, 'assets', 'products')
      fs.mkdirSync(dir, { recursive: true })
      const out = path.join(dir, unique)
      fs.writeFileSync(out, Buffer.from(match[2], 'base64'))
      return sendJson(res, 200, { path: `assets/products/${unique}` })
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
    console.error(`\n❌ Порт ${PORT} уже занят — скорее всего работает СТАРАЯ версия сервера.`)
    console.error(`   Выполните: bash start.sh  (он остановит старый процесс и запустит новый)`)
    console.error(`   Или вручную: kill $(lsof -ti:${PORT}) && node server.mjs\n`)
    process.exit(1)
  }
  throw err
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`АирДроп: http://0.0.0.0:${PORT}`)
  console.log(`Админка: http://localhost:${PORT}/admin`)
  console.log(`Импорт PDF + ZIP каталога: /admin → Экспорт / импорт`)
  const tg = getTelegramStatus()
  if (tg.configured) {
    console.log(`Telegram-уведомления: включены (${tg.chatCount} получателей)`)
    pollTelegram()
  } else {
    console.log('Telegram-уведомления: выключены — создайте .env по образцу .env.example')
  }
})
