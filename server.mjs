import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SITE_DIR = path.join(__dirname, 'site')
const STORE_FILE = path.join(SITE_DIR, 'data', 'store.json')
const PRODUCTS_FILE = path.join(SITE_DIR, 'data', 'products.json')
const PORT = process.env.PORT || 8080

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

  if (p === '/admin') {
    res.writeHead(302, { Location: '/admin.html' })
    return res.end()
  }

  if (p === '/api/store' && req.method === 'GET') {
    return sendJson(res, 200, readStore())
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

server.listen(PORT, () => {
  console.log(`АирДроп: http://localhost:${PORT}`)
  console.log(`Админка: http://localhost:${PORT}/admin`)
})
