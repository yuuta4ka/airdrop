import { calcRetailFromPurchase } from './pricing.js'

const COLOR_ALIASES = {
  silver: ['silver', 'серебро', 'серебристый'],
  white: ['white', 'белый', 'белый титан', 'silver', 'серебро', 'серебристый'],
  orange: ['orange', 'оранжевый', 'cosmic orange'],
  blue: ['blue', 'синий', 'deep blue', 'ultramarine'],
  black: ['black', 'чёрный', 'черный', 'black titanium', 'midnight'],
  natural: ['natural', 'натуральный', 'natural titanium'],
  desert: ['desert', 'пустынный', 'desert titanium'],
  gold: ['gold', 'золотой', 'gold titanium'],
}

function normalizeText(s) {
  return String(s ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDigits(line) {
  const digits = String(line).replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function isPriceLine(line) {
  const n = normalizeText(line)
  if (!n) return false
  const withoutCurrency = n.replace(/₽|руб\.?|rub/gi, '').trim()
  if (/[a-zA-Zа-яА-Я]{2,}/.test(withoutCurrency)) return false
  const digits = withoutCurrency.replace(/\D/g, '')
  return digits.length >= 4
}

function normalizeStorage(raw) {
  const m = String(raw).match(/(\d+)\s*(tb|тб|gb|гб)/i)
  if (!m) return null
  const num = m[1]
  const unit = /tb|тб/i.test(m[2]) ? 'ТБ' : 'ГБ'
  return `${num} ${unit}`
}

function normalizeSim(raw) {
  const s = String(raw).toLowerCase().replace(/\s+/g, '')
  // Сначала dual eSIM (eSim+eSim), иначе «sim» внутри «esim» даёт ложное совпадение
  if (/esim\+esim|esimesim|dualesim|2esim/i.test(s)) return 'eSIM only'
  if (/sim\+esim|esim\+sim|физ/i.test(s)) return 'eSIM + SIM'
  return 'eSIM only'
}

function colorAliases(color) {
  const list = new Set()
  if (color.name) list.add(color.name.toLowerCase())
  if (color.id) list.add(color.id.toLowerCase())
  if (color.importNames) {
    String(color.importNames).split(/[,;]+/).forEach((n) => list.add(n.trim().toLowerCase()))
  }
  for (const [key, aliases] of Object.entries(COLOR_ALIASES)) {
    if (list.has(key) || [...list].some((n) => aliases.includes(n))) {
      aliases.forEach((a) => list.add(a))
    }
  }
  return [...list]
}

function matchColor(text, colors) {
  const t = text.toLowerCase()
  for (const col of colors) {
    for (const alias of colorAliases(col)) {
      if (alias.length >= 3 && t.includes(alias)) return col
    }
  }
  const words = text.split(/\s+/)
  for (let len = 2; len >= 1; len--) {
    const candidate = words.slice(-len).join(' ').toLowerCase()
    for (const col of colors) {
      if (col.name.toLowerCase() === candidate) return col
      if (col.id.toLowerCase() === candidate) return col
    }
  }
  return null
}

function matchSim(simTypes, parsedSim) {
  if (!simTypes?.length) return ''
  const norm = parsedSim.toLowerCase()
  const found = simTypes.find((t) => t.toLowerCase() === norm)
  if (found) return found
  if (norm.includes('sim') && simTypes.some((t) => /sim.*sim/i.test(t))) {
    return simTypes.find((t) => /\+/.test(t) && /sim/i.test(t)) || simTypes[1] || simTypes[0]
  }
  return simTypes.find((t) => /only/i.test(t)) || simTypes[0]
}

function matchStorage(storageLabels, parsed) {
  if (!parsed) return null
  const norm = parsed.toLowerCase().replace(/\s+/g, ' ')
  const exact = storageLabels.find((l) => l.toLowerCase().replace(/\s+/g, ' ') === norm)
  if (exact) return exact
  const num = parsed.match(/(\d+)/)?.[1]
  if (!num) return null
  return storageLabels.find((l) => l.includes(num)) || parsed
}

function parseTitleLine(line) {
  const normalized = normalizeText(line)
  const simMatch = normalized.match(/\(([^)]+)\)\s*$/)
  const simRaw = simMatch ? simMatch[1] : ''
  const withoutSim = simMatch ? normalized.slice(0, simMatch.index).trim() : normalized

  const storageMatch = withoutSim.match(/\b(\d+)\s*(Tb|TB|GB|Gb|ТБ|ГБ)\b/i)
  const storage = storageMatch ? normalizeStorage(storageMatch[0]) : null

  let beforeColor = withoutSim
  if (storageMatch) {
    beforeColor = normalizeText(
      withoutSim.slice(0, storageMatch.index) + withoutSim.slice(storageMatch.index + storageMatch[0].length),
    )
  }

  return {
    storage,
    simType: simRaw ? normalizeSim(simRaw) : '',
    colorText: beforeColor,
    raw: normalized,
  }
}

function lineMatchesProduct(title, productName) {
  const titleNorm = title.toLowerCase()
  const nameNorm = productName.toLowerCase()
  const keywords = nameNorm
    .replace(/apple|iphone|ipad|airpods|watch/gi, '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1)

  if (keywords.length) {
    const hits = keywords.filter((k) => titleNorm.includes(k))
    if (hits.length >= Math.min(2, keywords.length)) return true
  }
  return /\d+\s*(gb|tb|гб|тб)/i.test(title)
}

function normalizeSupplierText(text) {
  const out = []
  for (const raw of String(text).split(/\r?\n/)) {
    const line = normalizeText(raw)
    if (!line) continue
    const eq = line.match(/^(.+?)\s*=\s*(.+)$/)
    if (eq) {
      out.push(eq[1].trim(), eq[2].trim())
      continue
    }
    out.push(line)
  }
  return out
}

function pairLines(lines) {
  const pairs = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (isPriceLine(line)) {
      i += 1
      continue
    }
    const title = line
    i += 1
    let price = 0
    while (i < lines.length && normalizeText(lines[i]) === '') i += 1
    if (i < lines.length && isPriceLine(lines[i])) {
      price = parseDigits(lines[i])
      i += 1
    }
    pairs.push({ title, price })
  }
  return pairs
}

export function parseSupplierPriceList(text, product) {
  const lines = normalizeSupplierText(text)
  const pairs = pairLines(lines)
  const storageLabels = product.sizes?.length > 1
    ? product.sizes.map((s) => s.label)
    : product.storage.map((s) => s.label)
  const simTypes = product.simTypes?.length ? product.simTypes : ['']

  const imported = []
  const errors = []
  let skipped = 0

  for (const { title, price } of pairs) {
    if (!lineMatchesProduct(title, product.name)) {
      skipped += 1
      continue
    }
    if (!price) {
      errors.push({ title, message: 'Не найдена цена' })
      continue
    }

    const parsed = parseTitleLine(title)
    const color = matchColor(parsed.colorText, product.colors)
    const storage = matchStorage(storageLabels, parsed.storage)
    const simType = product.simTypes?.length ? matchSim(product.simTypes, parsed.simType) : ''

    if (!color) {
      errors.push({ title, message: `Не распознан цвет: «${parsed.colorText}»` })
      continue
    }
    if (!storage) {
      errors.push({ title, message: `Не распознан объём памяти: «${title}»` })
      continue
    }

    imported.push({
      colorId: color.id,
      storage,
      simType: simType || '',
      purchasePrice: price,
      orderable: true,
    })
  }

  return { imported, errors, skipped, total: pairs.length }
}

function variantMatchKey(v) {
  return `${v.colorId}::${v.storage}::${v.simType || ''}`
}

export function applySupplierImport(product, text, markup = {}) {
  const { imported, errors, skipped, total } = parseSupplierPriceList(text, product)
  if (!imported.length) {
    return { product, errors, skipped, total, merged: 0, removed: 0 }
  }

  if (!product.variants) product.variants = []
  const variantsBefore = product.variants.length
  let merged = 0
  const importedKeys = new Set()

  for (const row of imported) {
    importedKeys.add(variantMatchKey(row))
    const idx = product.variants.findIndex((v) => variantMatchKey(v) === variantMatchKey(row))
    const price = calcRetailFromPurchase(row.purchasePrice, markup)
    if (idx >= 0) {
      product.variants[idx].purchasePrice = row.purchasePrice
      product.variants[idx].price = price
      product.variants[idx].orderable = true
    } else {
      product.variants.push({ ...row, price })
    }
    merged += 1
  }

  const beforeFilter = product.variants.length
  product.variants = product.variants.filter((v) => importedKeys.has(variantMatchKey(v)))
  const removed = beforeFilter - product.variants.length

  return { product, errors, skipped, total, merged, removed, variantsBefore, variantsAfter: product.variants.length }
}
