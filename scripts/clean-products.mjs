import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '../site/data/products.json')
const PHONE_CATS = new Set(['iphone', 'samsung', 'xiaomi', 'huawei'])

function isMeaningfulStorage(label) {
  if (!label || label === 'Стандарт') return false
  if (/^\d+\s*(ГБ|ТБ)/i.test(label)) return true
  if (/Wi-Fi|Cellular|LTE|мм/i.test(label)) return true
  if (/\d+\/\d+/i.test(label)) return true
  return label !== 'Стандарт'
}

function hasImage(p) {
  return !!(p.image || p.coverImage || (p.images && p.images.length))
}

function isAutoJunk(p) {
  const desc = (p.description || '').toLowerCase()
  return !hasImage(p) && /оригинальная техника|под заказ/.test(desc)
}

function cleanProduct(p) {
  if (PHONE_CATS.has(p.category)) {
    p.storage = (p.storage || []).filter((s) => isMeaningfulStorage(s.label))
    p.variants = (p.variants || []).filter((v) => isMeaningfulStorage(v.storage))
    p.stock = (p.stock || []).filter((s) => isMeaningfulStorage(s.storageLabel))
    p.colors = (p.colors || []).filter((c) => c.name !== 'Стандарт' || c.importNames)
  }
  return p
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'))
const before = data.products.length
const removed = []
data.products = data.products
  .filter((p) => {
    if (isAutoJunk(p)) {
      removed.push(p.name)
      return false
    }
    return true
  })
  .map(cleanProduct)

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
console.log(`Removed ${removed.length} auto-created products (${before} → ${data.products.length})`)
if (removed.length) console.log(removed.join('\n'))
