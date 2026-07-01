import { calcRetailFromPurchase } from './site/js/pricing.js'
import { CATALOG_SECTIONS, filterCatalogEntries, extractPriceEntries } from './price-pdf-parser.mjs'

const COLOR_ALIASES = {
  silver: ['silver', 'серебро', 'серебристый', 'starlight', 'сияющая звезда', 'whitesilver', 'silvershadow'],
  white: ['white', 'белый', 'silver', 'starlight'],
  black: ['black', 'чёрный', 'черный', 'jet black', 'midnight', 'graphite', 'space black', 'space gray', 'gray', 'grey', 'jetblack'],
  blue: ['blue', 'синий', 'deep blue', 'ultramarine', 'sky blue', 'mist blue', 'cobalt violet', 'silverblue', 'indigo'],
  orange: ['orange', 'оранжевый', 'cosmic orange'],
  green: ['green', 'зелёный', 'sage', 'teal', 'бирюзовый'],
  pink: ['pink', 'розовый', 'rose gold', 'light blush', 'lavender', 'lilac', 'purple', 'violet', 'фиолетовый', 'mist purple'],
  gold: ['gold', 'золотой', 'champagne'],
  natural: ['natural', 'desert', 'titanium', 'titan'],
  yellow: ['yellow', 'жёлтый'],
  red: ['red', 'красный', 'crimson'],
  brown: ['brown', 'коричневый', 'cream'],
  navy: ['navy', 'тёмно-синий'],
}

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function normalizeStorage(raw) {
  const m = String(raw).match(/(\d+)\s*(tb|тб|gb|гб)/i)
  if (!m) return null
  const unit = /tb|тб/i.test(m[2]) ? 'ТБ' : 'ГБ'
  return `${m[1]} ${unit}`
}

function normalizeSim(raw) {
  const s = String(raw).toLowerCase().replace(/\s+/g, '')
  if (/esim\+esim|esimesim|dualesim/i.test(s)) return 'eSIM only'
  if (/sim\+esim|esim\+sim|simesim|dual\s*sim/i.test(s)) return 'eSIM + SIM'
  return ''
}

function findColorId(name, colors) {
  const t = name.toLowerCase()
  for (const col of colors) {
    const aliases = [col.name, col.id, ...(col.importNames ? col.importNames.split(/[,;]+/) : [])]
      .map((a) => a.trim().toLowerCase()).filter(Boolean)
    for (const a of aliases) {
      if (a.length >= 3 && t.includes(a)) return col.id
    }
  }
  for (const col of colors) {
    for (const a of COLOR_ALIASES[col.id] || []) {
      if (t.includes(a)) return col.id
    }
  }
  return null
}

function ensureColor(product, colorName) {
  const clean = colorName.trim() || 'Стандарт'
  const id = slugify(clean).slice(0, 24) || `c${Date.now()}`
  let col = product.colors.find((c) => c.id === id || c.name.toLowerCase() === clean.toLowerCase())
  if (!col) {
    col = { id, name: clean, hex: '#888888', image: '', importNames: clean }
    product.colors.push(col)
  }
  return col.id
}

function ensureStorage(product, label) {
  if (!label) return 'Стандарт'
  if (!product.storage.find((x) => x.label === label)) {
    product.storage.push({ label })
  }
  return label
}

function ensureSimTypes(product, simType) {
  if (!simType) return null
  if (!product.simTypes) product.simTypes = []
  if (!product.simTypes.includes(simType)) product.simTypes.push(simType)
  return simType
}

function parseIphoneVariant(line, product) {
  const simMatch = line.match(/\(([^)]+)\)\s*$/)
  const simRaw = simMatch ? simMatch[1] : ''
  const withoutSim = simMatch ? line.slice(0, simMatch.index).trim() : line
  const storageMatch = withoutSim.match(/\b(\d+)\s*(Tb|TB|GB|Gb|ТБ|ГБ)\b/i)
  const storage = storageMatch ? normalizeStorage(storageMatch[0]) : null
  let rest = withoutSim
  if (storageMatch) {
    rest = withoutSim.slice(0, storageMatch.index) + withoutSim.slice(storageMatch.index + storageMatch[0].length)
  }
  rest = rest.replace(/^\d+\s+Pro\s+Max\s+|^\d+\s+Pro\s+|^\d+\s+/i, '').trim()
  const colorName = rest.trim()
  const colorId = findColorId(colorName, product.colors) || ensureColor(product, colorName.split(/\s+/).slice(-2).join(' ') || 'Стандарт')
  const simType = ensureSimTypes(product, normalizeSim(simRaw))
  const storageLabel = ensureStorage(product, storage || 'Стандарт')
  return { colorId, storage: storageLabel, simType: simType || '' }
}

function parseSamsungPhoneVariant(name, product) {
  const m = name.match(/(\d+\/\d+\s*Gb?|\d+\s*Gb|\d+\/\d+)\s*(.+)$/i)
  let storage = 'Стандарт'
  let colorPart = name
  if (m) {
    storage = m[1].replace(/\s*Gb/i, ' ГБ').trim()
    if (!/ГБ|ТБ/.test(storage)) storage += ' ГБ'
    colorPart = m[2]
  }
  const colorId = findColorId(colorPart, product.colors) || ensureColor(product, colorPart.trim())
  ensureStorage(product, storage)
  product.simTypes = null
  return { colorId, storage, simType: '' }
}

function parseIpadVariant(name, product) {
  const storageMatch = name.match(/(\d+\s*Gb|\d+\s*ТБ)/i)
  const storage = storageMatch ? normalizeStorage(storageMatch[0]) : 'Стандарт'
  const wifi = /cellular|lte/i.test(name.toLowerCase()) ? ' Wi-Fi + Cellular' : ' Wi-Fi'
  const storageLabel = ensureStorage(product, `${storage}${wifi}`)
  const colorName = name.split(/\s+/).pop() || 'Стандарт'
  const colorId = findColorId(name, product.colors) || ensureColor(product, colorName)
  product.simTypes = null
  return { colorId, storage: storageLabel, simType: '' }
}

function parseMacbookVariant(name, product) {
  const m = name.match(/(\d+\/\d+GB|\d+\/\d+)\s+(.+)$/i)
  let storage = 'Стандарт'
  let colorName = 'Стандарт'
  if (m) {
    storage = m[1].replace(/GB/i, ' ГБ').replace('/', '/')
    colorName = m[2].trim()
  }
  ensureStorage(product, storage)
  const colorId = findColorId(colorName, product.colors) || ensureColor(product, colorName)
  product.simTypes = null
  return { colorId, storage, simType: '' }
}

function parseWatchVariant(name, product) {
  const colorId = findColorId(name, product.colors) || ensureColor(product, name.split(/\s+/).slice(2).join(' ') || 'Стандарт')
  ensureStorage(product, 'Стандарт')
  product.simTypes = null
  return { colorId, storage: 'Стандарт', simType: '' }
}

function parseAirpodsVariant(name, product) {
  const colorMatch = name.match(/\(([^)]+)\)\s*$/)
  let colorName = 'Стандарт'
  if (colorMatch) colorName = colorMatch[1]
  else {
    for (const w of ['Purple', 'Orange', 'Midnight', 'Black', 'White', 'Blue', 'Red', 'Green', 'Cream', 'Brown']) {
      if (name.includes(w)) { colorName = w; break }
    }
  }
  const colorId = colorName === 'Стандарт'
    ? ensureColor(product, 'Стандарт')
    : (findColorId(colorName, product.colors) || ensureColor(product, colorName))
  ensureStorage(product, 'Стандарт')
  product.simTypes = null
  return { colorId, storage: 'Стандарт', simType: '' }
}

function parseGenericVariant(name, product) {
  const storageMatch = name.match(/(\d+\/\d+\s*Gb?|\d+\/\d+GB|\d+\s*Gb)/i)
  let storage = 'Стандарт'
  if (storageMatch) {
    storage = storageMatch[0].replace(/\s*Gb/i, ' ГБ').replace(/GB/i, ' ГБ')
    if (!/ГБ|ТБ/.test(storage)) storage += ' ГБ'
  }
  ensureStorage(product, storage)
  const colorName = name.split(/\s+/).pop() || 'Стандарт'
  const colorId = findColorId(name, product.colors) || ensureColor(product, colorName)
  product.simTypes = null
  return { colorId, storage, simType: '' }
}

function productKeyFromEntry(entry, meta) {
  const { name } = entry
  if (meta.type === 'iphone') return meta.productName
  if (meta.type === 'watch-ultra') return 'Apple Watch Ultra 3'
  if (meta.type === 'watch') {
    if (/^SE\s/i.test(name)) return `Apple Watch ${name.match(/^SE\s+\S+/i)?.[0] || 'SE'}`
    if (/^S\d+/i.test(name)) return `Apple Watch ${name.match(/^S\d+\s+\d+mm/i)?.[0] || name.split(/\s+/).slice(0, 2).join(' ')}`
    return `Apple Watch ${name.split(/\s+/).slice(0, 3).join(' ')}`
  }
  if (meta.type === 'macbook') {
    const neo = name.match(/^(MacBook Neo\s+\d+"\s+A\d+\s+Pro)/i)
    if (neo) return neo[1]
    const air = name.match(/^(MacBook Air\s+\d+(?:"|\s)\s*M\d+)/i)
    if (air) return air[1].replace(/\s+/g, ' ').trim()
    const pro = name.match(/^(MacBook Pro\s+\d+(?:"|\s)\s*M\d+(?:\s+Max)?)/i)
    if (pro) return pro[1].replace(/\s+/g, ' ').trim()
    return name.replace(/\s+\d+\/\d+\s*GB?\s+\S+$/i, '').trim()
  }
  if (meta.type === 'ipad') {
    const known = [
      /^iPad Air 11 M4 \(2026\)/i,
      /^iPad Air 11 M4 \(2025\)/i,
      /^iPad Air 13 M4 \(2026\)/i,
      /^iPad mini \(A17 Pro\)/i,
      /^iPad 11 \(2025\)/i,
    ]
    for (const re of known) {
      const m = name.match(re)
      if (m) return m[0].trim()
    }
    const generic = name.match(/^(iPad(?:\s+(?:Pro|Air|mini))?(?:\s+\d+(?:\.\d+)?")?(?:\s+M\d+)?(?:\s*\([^)]+\))?)/i)
    return generic ? generic[1].trim() : name.split(/\d+\s*Gb/i)[0].trim()
  }
  if (meta.type === 'airpods') {
    if (/Marshall/i.test(name)) return name.match(/^Marshall[^\d]+/i)?.[0]?.trim() || name
    const m = name.match(/AirPods[^(\[]*(?:\(\d+\))?[^(\[]*|Apple AirPods[^(\[]*/i)
    if (m) return m[0].replace(/Цветные\s+/i, '').trim()
    return name.split(/\(/)[0].trim()
  }
  if (meta.type === 'samsung-phone') {
    const m = name.match(/Galaxy\s+[A-Z]\w+\s*(?:FE|Ultra|Plus|Fold|Flip)?\s*\d*/i)
    return m ? m[0].trim() : name.split(/\d+\/\d+/)[0].trim()
  }
  if (meta.type === 'samsung-watch') {
    const m = name.match(/^Watch\s+(\d+)\s+(Ultra|Classic)(?:\s+\d{4})?/i)
    if (m) return `Samsung Galaxy Watch ${m[1]} ${m[2]}`
    const m2 = name.match(/^Watch\s+(\d+)\s+/i)
    if (m2) return `Samsung Galaxy Watch ${m2[1]}`
    return `Samsung ${name.split(/\s+\d+\s*Gb/i)[0].trim()}`
  }
  if (meta.type === 'huawei') {
    if (/^HUAWEI\s/i.test(name)) {
      const base = name.match(/^HUAWEI\s+(Pura\s+\d+\s+Pro|Pura\s+\d+|\S+(?:\s+\S+)?)/i)?.[1]
      return base ? `HUAWEI ${base.replace(/\s+\d+\/\d+GB.*/i, '').trim()}` : name.split(/\d+\/\d+/)[0].trim()
    }
    const watch = name.match(/Huawei\s+(Watch\s+\S+(?:\s+\S+)?)/i)
    if (watch) return `Huawei ${watch[1].replace(/\s*\([^)]+\)\s*$/, '').trim()}`
    return name.split(/\(/)[0].trim()
  }
  return name.split(/\d+\/\d+/)[0].trim() || name
}

function createEmptyProduct(name, meta, id) {
  return {
    id,
    slug: slugify(name),
    name,
    category: meta.category,
    brand: meta.brand,
    badge: null,
    image: '',
    coverImage: '',
    description: `${name} — оригинальная техника, под заказ от 3–5 дней.`,
    simTypes: meta.type === 'iphone' ? ['eSIM only', 'eSIM + SIM'] : null,
    simModifiers: [],
    colors: meta.type === 'iphone'
      ? [
        { id: 'blue', name: 'Синий', hex: '#2a4a7a', image: '', importNames: 'Deep Blue, Blue' },
        { id: 'white', name: 'Белый', hex: '#f0f0f0', image: '', importNames: 'Silver, White, Starlight' },
        { id: 'orange', name: 'Оранжевый', hex: '#e88a40', image: '', importNames: 'Orange, Cosmic Orange' },
      ]
      : [{ id: 'default', name: 'Стандарт', hex: '#888888', image: '', importNames: '' }],
    storage: [{ label: 'Стандарт' }],
    variants: [],
    sizes: null,
    stock: [],
    images: [],
    markupPercent: 15,
    markupFixed: 0,
    showCatalogSpec: false,
  }
}

function parseVariant(entry, product, meta) {
  const { name } = entry
  if (meta.type === 'iphone') return parseIphoneVariant(name, product)
  if (meta.type === 'ipad') return parseIpadVariant(name, product)
  if (meta.type === 'macbook') return parseMacbookVariant(name, product)
  if (meta.type === 'watch' || meta.type === 'watch-ultra') return parseWatchVariant(name, product)
  if (meta.type === 'airpods') return parseAirpodsVariant(name, product)
  if (meta.type === 'samsung-phone') return parseSamsungPhoneVariant(name, product)
  return parseGenericVariant(name, product)
}

function upsertVariant(product, variant, purchasePrice, markup) {
  if (!Array.isArray(product.variants)) product.variants = []
  const price = calcRetailFromPurchase(purchasePrice, markup)
  const idx = product.variants.findIndex((v) =>
    v.colorId === variant.colorId &&
    v.storage === variant.storage &&
    (v.simType || '') === (variant.simType || '')
  )
  const row = { ...variant, purchasePrice, price }
  if (idx >= 0) product.variants[idx] = row
  else product.variants.push(row)
}

export function buildCatalogFromPdfText(text, existingProducts, markup = { percent: 15, fixed: 0 }, options = {}) {
  let entries = filterCatalogEntries(extractPriceEntries(text))
  if (Array.isArray(options.sections) && options.sections.length) {
    const allowed = new Set(options.sections)
    entries = entries.filter((e) => allowed.has(e.section))
  }
  const products = existingProducts.map((p) => {
    const copy = structuredClone(p)
    if (!Array.isArray(copy.variants)) copy.variants = []
    if (!Array.isArray(copy.colors)) copy.colors = [{ id: 'default', name: 'Стандарт', hex: '#888888', image: '', importNames: '' }]
    if (!Array.isArray(copy.storage)) copy.storage = [{ label: 'Стандарт' }]
    return copy
  })
  let nextId = Math.max(0, ...products.map((p) => p.id)) + 1
  const stats = { entries: entries.length, updated: 0, created: 0, variants: 0, errors: [] }

  const productMap = new Map()
  for (const p of products) {
    productMap.set(`${p.category}::${p.name.toLowerCase()}`, p)
    productMap.set(`${p.category}::${p.slug}`, p)
  }

  for (const entry of entries) {
    const meta = CATALOG_SECTIONS.get(entry.section)
    if (!meta) continue

    try {
      const productName = productKeyFromEntry(entry, meta)
      const key = `${meta.category}::${productName.toLowerCase()}`
      let product = productMap.get(key)

      if (!product) {
        product = createEmptyProduct(productName, meta, nextId++)
        products.push(product)
        productMap.set(key, product)
        stats.created += 1
      } else {
        stats.updated += 1
      }

      const variant = parseVariant(entry, product, meta)
      upsertVariant(product, variant, entry.price, markup)
      stats.variants += 1
    } catch (err) {
      stats.errors.push({ name: entry.name, error: err.message })
    }
  }

  return { products, stats }
}

export async function extractTextFromPdfBuffer(buffer) {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  await parser.destroy()
  return result.text
}
