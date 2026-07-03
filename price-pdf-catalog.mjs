import { calcRetailFromPurchase } from './site/js/pricing.js'
import { CATALOG_SECTIONS, filterCatalogEntries, extractPriceEntries, resolveCatalogSection } from './price-pdf-parser.mjs'

const COLOR_ALIASES = {
  silver: ['silver', 'серебро', 'серебристый', 'starlight', 'сияющая звезда', 'whitesilver', 'silvershadow'],
  white: ['white', 'белый', 'silver', 'starlight'],
  black: ['black', 'чёрный', 'черный', 'jet black', 'midnight', 'graphite', 'space black', 'space gray', 'gray', 'grey', 'jetblack'],
  blue: ['blue', 'синий', 'deep blue', 'ultramarine', 'sky blue', 'mist blue', 'cobalt violet', 'silverblue', 'indigo'],
  orange: ['orange', 'оранжевый', 'cosmic orange'],
  green: ['green', 'зелёный', 'sage', 'teal', 'бирюзовый'],
  pink: ['pink', 'розовый', 'rose gold', 'light blush', 'lavender', 'lilac', 'purple', 'violet', 'фиолетовый', 'mist purple'],
  gray: ['gray', 'grey', 'графитовый', 'космический серый', 'space gray', 'graphite'],
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
  const t = name.toLowerCase().trim()
  if (!t) return null
  let best = null
  let bestLen = 0
  for (const col of colors) {
    const aliases = [col.name, col.id, ...(col.importNames ? col.importNames.split(/[,;]+/) : [])]
      .map((a) => a.trim().toLowerCase()).filter(Boolean)
    for (const a of aliases) {
      if (a.length < 3) continue
      const hit = t.includes(a) || (t.length >= 3 && a.includes(t))
      if (hit && a.length > bestLen) {
        best = col.id
        bestLen = a.length
      }
    }
    for (const a of COLOR_ALIASES[col.id] || []) {
      const al = a.toLowerCase()
      if (al.length < 3) continue
      const hit = t.includes(al) || (t.length >= 3 && al.includes(t))
      if (hit && al.length > bestLen) {
        best = col.id
        bestLen = al.length
      }
    }
  }
  return best
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
  if (!label || label === 'Стандарт') return null
  if (!product.storage.find((x) => x.label === label)) {
    product.storage.push({ label })
  }
  return label
}

function resolveColorId(name, product) {
  return findColorId(name, product.colors || [])
}

function normalizeSamsungPhoneStorage(raw) {
  const slash = String(raw).match(/(\d+)\s*\/\s*(\d+)\s*(Gb|GB|ГБ)?/i)
  if (slash) return `${slash[2]} ГБ`
  let storage = String(raw).replace(/\s*Gb/i, ' ГБ').replace(/GB/i, ' ГБ').trim()
  if (!/ГБ|ТБ/.test(storage)) storage += ' ГБ'
  return storage
}

function resolveStorageLabel(label, product, meta) {
  if (!label || label === 'Стандарт') {
    if (['watch', 'watch-ultra', 'airpods', 'samsung-watch'].includes(meta.type)) {
      return product.storage?.some((s) => s.label === 'Стандарт') ? 'Стандарт' : null
    }
    return null
  }
  const exact = product.storage?.find((s) => s.label === label)
  if (exact) return exact.label
  const norm = label.replace(/\s/g, '').toLowerCase()
  const fuzzy = product.storage?.find((s) => s.label.replace(/\s/g, '').toLowerCase() === norm)
  if (fuzzy) return fuzzy.label
  if (['samsung-phone', 'xiaomi', 'huawei'].includes(meta.type)) {
    const slash = String(label).match(/(\d+)\s*\/\s*(\d+)/)
    if (slash) {
      const romNum = slash[2]
      const byRom = product.storage?.find((s) => new RegExp(`\\b${romNum}\\s*(ГБ|ТБ)`, 'i').test(s.label))
      if (byRom) return byRom.label
    }
    const num = String(label).match(/(\d+)\s*(ГБ|ТБ)/i)?.[1]
    if (num) {
      const byNum = product.storage?.find((s) => new RegExp(`\\b${num}\\s*(ГБ|ТБ)`, 'i').test(s.label))
      if (byNum) return byNum.label
    }
  }
  return label
}

/** Разбор строки прайса без изменения карточки товара (только для обновления цен) */
function parseVariantForUpdate(name, product, meta) {
  if (meta.type === 'iphone') {
    const simMatch = name.match(/\(([^)]+)\)\s*$/)
    const simRaw = simMatch ? simMatch[1] : ''
    const withoutSim = simMatch ? name.slice(0, simMatch.index).trim() : name
    const storageMatch = withoutSim.match(/\b(\d+)\s*(Tb|TB|GB|Gb|ТБ|ГБ)\b/i)
    const storage = storageMatch ? normalizeStorage(storageMatch[0]) : null
    let rest = withoutSim
    if (storageMatch) {
      rest = withoutSim.slice(0, storageMatch.index) + withoutSim.slice(storageMatch.index + storageMatch[0].length)
    }
    rest = rest.replace(/^\d+\s+Pro\s+Max\s+|^\d+\s+Pro\s+|^\d+\s+/i, '').trim()
    const colorId = findColorId(rest.trim(), product.colors)
    if (!colorId || !storage) return null
    const simType = normalizeSim(simRaw) || ''
    if (simType && product.simTypes?.length && !product.simTypes.includes(simType)) return null
    const storageLabel = resolveStorageLabel(storage, product, meta)
    if (!storageLabel) return null
    return { colorId, storage: storageLabel, simType }
  }

  if (meta.type === 'samsung-phone') {
    const m = name.match(/(\d+\/\d+\s*Gb?|\d+\s*Gb|\d+\/\d+)\s*(.+)$/i)
    if (!m) return null
    const storage = normalizeSamsungPhoneStorage(m[1])
    const colorId = findColorId(m[2].trim(), product.colors)
    if (!colorId) return null
    const storageLabel = resolveStorageLabel(storage, product, meta)
    if (!storageLabel) return null
    return { colorId, storage: storageLabel, simType: '' }
  }

  if (meta.type === 'ipad') {
    const storageMatch = name.match(/(\d+\s*Gb|\d+\s*ТБ)/i)
    const storage = storageMatch ? normalizeStorage(storageMatch[0]) : null
    const wifi = /cellular|lte/i.test(name.toLowerCase()) ? 'Wi-Fi + Cellular' : 'Wi-Fi'
    const storageLabel = storage ? resolveStorageLabel(`${storage} ${wifi}`, product, meta) : resolveStorageLabel(wifi, product, meta)
    const colorId = findColorId(name, product.colors)
    if (!colorId || !storageLabel) return null
    return { colorId, storage: storageLabel, simType: '' }
  }

  if (meta.type === 'macbook') {
    const m = name.match(/(\d+\/\d+GB|\d+\/\d+)\s+(.+)$/i)
    if (!m) return null
    const storage = m[1].replace(/GB/i, ' ГБ')
    const colorId = findColorId(m[2].trim(), product.colors)
    if (!colorId) return null
    const storageLabel = resolveStorageLabel(storage, product, meta)
    if (!storageLabel) return null
    return { colorId, storage: storageLabel, simType: '' }
  }

  if (meta.type === 'watch' || meta.type === 'watch-ultra' || meta.type === 'samsung-watch') {
    const sizeLabel = parseWatchSizeLabel(name)
    const colorPart = parseWatchColorPart(name)
    const colorId = findColorId(colorPart, product.colors) || findColorId(name, product.colors)
    if (!colorId) return null
    const storageLabel = resolveWatchStorageLabel(sizeLabel, product, meta)
    if (!storageLabel) return null
    return { colorId, storage: storageLabel, simType: '' }
  }

  if (meta.type === 'airpods') {
    let colorName = ''
    for (const w of AIRPODS_COLOR_SUFFIXES) {
      const re = new RegExp(`\\s+${w.replace(/\s+/g, '\\s+')}\\s*$`, 'i')
      if (re.test(name)) { colorName = w; break }
    }
    const colorId = colorName ? findColorId(colorName, product.colors) : product.colors?.[0]?.id
    if (!colorId) return null
    const storageLabel = resolveStorageLabel('Стандарт', product, meta) || product.storage?.[0]?.label
    if (!storageLabel) return null
    return { colorId, storage: storageLabel, simType: '' }
  }

  const storageMatch = name.match(/(\d+\/\d+\s*Gb?|\d+\/\d+GB|\d+\s*Gb)/i)
  if (!storageMatch) return null
  let storage = storageMatch[0].replace(/\s*Gb/i, ' ГБ').replace(/GB/i, ' ГБ')
  if (!/ГБ|ТБ/.test(storage)) storage += ' ГБ'
  const colorId = findColorId(name, product.colors)
  if (!colorId) return null
  const storageLabel = resolveStorageLabel(storage, product, meta)
  if (!storageLabel) return null
  return { colorId, storage: storageLabel, simType: '' }
}

function ensureSimTypes(product, simType) {
  if (!simType) return null
  if (!product.simTypes) product.simTypes = []
  if (!product.simTypes.includes(simType)) product.simTypes.push(simType)
  return simType
}

function stripSamsungStorage(name) {
  return String(name).replace(/\s+\d+\/\d+\s*Gb?.*/i, '').trim()
}

const AIRPODS_COLOR_SUFFIXES = [
  'Midnight', 'Purple', 'Starlight', 'Orange', 'Black', 'White', 'Blue', 'Red', 'Green',
  'Cream', 'Brown', 'Silver', 'Gold', 'Pink', 'Yellow', 'Space Gray', 'Space Grey',
]

function stripAirpodsColorSuffix(name) {
  let base = String(name).trim()
  for (const color of AIRPODS_COLOR_SUFFIXES) {
    const re = new RegExp(`\\s+${color.replace(/\s+/g, '\\s+')}\\s*$`, 'i')
    if (re.test(base)) return base.replace(re, '').trim()
  }
  return base
}

function normalizeWatchSizeLabel(label) {
  const s = String(label || '').trim()
  if (!s) return ''
  if (/мм/i.test(s)) return s.replace(/\bmm\b/gi, 'мм').replace(/\s+/g, ' ').trim()
  const m = s.match(/^(\d{2})$/)
  if (m) return `${m[1]} мм`
  const m2 = s.match(/^(\d{2})\s*mm$/i)
  if (m2) return `${m2[1]} мм`
  return s
}

function parseWatchSizeLabel(name) {
  const m = String(name).match(/\b(\d{2})\s*mm\b/i)
  return m ? normalizeWatchSizeLabel(m[1]) : 'Стандарт'
}

function parseWatchColorPart(name) {
  const sizeColor = String(name).match(/\b(?:S\d+|SE)\s+\d{2}\s*mm\s+(.+)$/i)
  if (sizeColor) return sizeColor[1].trim()
  const seColor = String(name).match(/^SE\s+\S+\s+(.+)$/i)
  if (seColor) return seColor[1].trim()
  return String(name).split(/\s+/).slice(2).join(' ') || String(name)
}

function normalizeSizeKey(label) {
  const m = String(label || '').match(/(\d{2})/)
  return m ? m[1] : String(label || '').toLowerCase()
}

function resolveWatchStorageLabel(sizeLabel, product, meta) {
  const variants = product.variants || []
  const allStandard = variants.length > 0 && variants.every((v) => !v.storage || v.storage === 'Стандарт')
  if (allStandard) return 'Стандарт'

  const norm = normalizeSizeKey(sizeLabel)
  const fromStorage = product.storage?.find((s) => normalizeSizeKey(s.label) === norm)
  if (fromStorage) return fromStorage.label
  const fromSizes = product.sizes?.find((s) => normalizeSizeKey(s.label) === norm)
  if (fromSizes) return fromSizes.label
  return resolveStorageLabel(sizeLabel, product, meta) || sizeLabel
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
  if (!storage) return null
  const storageLabel = ensureStorage(product, storage)
  if (!storageLabel) return null
  return { colorId, storage: storageLabel, simType: simType || '' }
}

function parseSamsungPhoneVariant(name, product) {
  const m = name.match(/(\d+\/\d+\s*Gb?|\d+\s*Gb|\d+\/\d+)\s*(.+)$/i)
  let storage = 'Стандарт'
  let colorPart = name
  if (m) {
    storage = normalizeSamsungPhoneStorage(m[1])
    colorPart = m[2]
  }
  const colorId = findColorId(colorPart, product.colors) || ensureColor(product, colorPart.trim())
  ensureStorage(product, storage)
  product.simTypes = null
  return { colorId, storage, simType: '' }
}

function parseIpadVariant(name, product) {
  const storageMatch = name.match(/(\d+\s*Gb|\d+\s*ТБ)/i)
  const storage = storageMatch ? normalizeStorage(storageMatch[0]) : null
  const wifi = /cellular|lte/i.test(name.toLowerCase()) ? 'Wi-Fi + Cellular' : 'Wi-Fi'
  const storageLabel = ensureStorage(product, storage ? `${storage} ${wifi}` : wifi)
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
  const sizeLabel = parseWatchSizeLabel(name)
  const colorPart = parseWatchColorPart(name)
  const colorId = findColorId(colorPart, product.colors) || findColorId(name, product.colors) || ensureColor(product, colorPart)
  ensureStorage(product, sizeLabel)
  if (!product.sizes) product.sizes = []
  if (sizeLabel !== 'Стандарт' && !product.sizes.some((s) => normalizeSizeKey(s.label) === normalizeSizeKey(sizeLabel))) {
    product.sizes.push({ label: sizeLabel })
  }
  product.simTypes = null
  return { colorId, storage: sizeLabel, simType: '' }
}

function parseAirpodsVariant(name, product) {
  let colorName = 'Стандарт'
  for (const w of AIRPODS_COLOR_SUFFIXES) {
    const re = new RegExp(`\\s+${w.replace(/\s+/g, '\\s+')}\\s*$`, 'i')
    if (re.test(name)) { colorName = w; break }
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
    if (/^SE\s/i.test(name)) {
      const gen = name.match(/^SE\s+(\d+)/i)
      return gen ? `Apple Watch SE ${gen[1]}` : 'Apple Watch SE'
    }
    if (/^S\d+/i.test(name)) {
      const s = name.match(/^(S\d+)/i)
      return s ? `Apple Watch ${s[1]}` : `Apple Watch ${name.split(/\s+/)[0]}`
    }
    return `Apple Watch ${name.split(/\s+/).slice(0, 2).join(' ')}`
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
    const base = stripAirpodsColorSuffix(name)
    const m = base.match(/^(AirPods(?:\s+Pro)?(?:\s+Max)?(?:\s+USB-C)?(?:\s*\(\d{4}\))?|Apple AirPods[^\d]*)/i)
    return m ? m[1].replace(/Цветные\s+/i, '').trim() : base.split(/\s+\d/)[0].trim()
  }
  if (meta.type === 'samsung-phone') {
    const withoutStorage = stripSamsungStorage(name)
    const m = withoutStorage.match(/Galaxy\s+S\d+\s*(?:FE|Ultra|Plus|Fold|Flip)?/i)
      || withoutStorage.match(/Galaxy\s+[A-Z]\w+\s*(?:FE|Ultra|Plus|Fold|Flip)?/i)
    return m ? m[0].trim() : withoutStorage
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

function variantKey(v) {
  return `${v.colorId}::${v.storage}::${v.simType || ''}`
}

function normalizeProductName(name) {
  return String(name).toLowerCase()
    .replace(/[""«»]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+m\d+(\s+max)?/gi, '')
    .replace(/\s+a\d+(\s+pro)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function productImportAliases(product) {
  return [product.name, ...(String(product.importNames || '').split(/[,;]+/))]
    .map((s) => s.trim()).filter(Boolean)
}

function registerProductKeys(productMap, product) {
  productMap.set(`${product.category}::${product.name.toLowerCase()}`, product)
  productMap.set(`${product.category}::${product.slug}`, product)
  const norm = normalizeProductName(product.name)
  productMap.set(`${product.category}::${norm}`, product)
  if (norm.startsWith('apple ')) {
    productMap.set(`${product.category}::${norm.slice(6)}`, product)
  }
  if (!norm.startsWith('apple ') && (product.category === 'apple-watch' || product.category === 'airpods')) {
    productMap.set(`${product.category}::apple ${norm}`, product)
  }
  for (const alias of productImportAliases(product)) {
    productMap.set(`${product.category}::${alias.toLowerCase()}`, product)
    productMap.set(`${product.category}::${normalizeProductName(alias)}`, product)
  }
  if (product.category === 'samsung' && product.name.startsWith('Galaxy ')) {
    const tail = product.name.slice(7).toLowerCase()
    productMap.set(`${product.category}::samsung galaxy ${tail}`, product)
  }
}

export function resolveProductByLinePrefix(lineName, meta, products) {
  const line = String(lineName).toLowerCase().trim()
  let best = null
  let bestLen = 0
  for (const product of products) {
    if (product.category !== meta.category) continue
    for (const alias of productImportAliases(product)) {
      const al = alias.toLowerCase()
      if (line.startsWith(al) && al.length > bestLen) {
        best = product
        bestLen = al.length
      }
    }
  }
  return best
}

function resolveProduct(productName, meta, productMap, products, lineName = '') {
  const keys = [
    `${meta.category}::${productName.toLowerCase()}`,
    `${meta.category}::${normalizeProductName(productName)}`,
    `${meta.category}::${slugify(productName)}`,
  ]
  const norm = normalizeProductName(productName)
  if (norm.startsWith('apple ')) {
    keys.push(`${meta.category}::${norm.slice(6)}`)
  } else if (meta.category === 'apple-watch' || meta.category === 'airpods') {
    keys.push(`${meta.category}::apple ${norm}`)
  }
  for (const k of keys) {
    if (productMap.has(k)) return productMap.get(k)
  }
  let matches = products.filter((p) => p.category === meta.category && normalizeProductName(p.name) === norm)
  if (matches.length === 1) return matches[0]
  const normShort = norm.replace(/^apple\s+/, '')
  matches = products.filter((p) => {
    if (p.category !== meta.category) return false
    const pn = normalizeProductName(p.name)
    return pn === normShort || pn.endsWith(` ${normShort}`) || normShort.endsWith(` ${pn}`) || pn === norm
  })
  if (matches.length === 1) return matches[0]

  const byAlias = products.filter((p) => {
    if (p.category !== meta.category) return false
    return productImportAliases(p).some((alias) => {
      const an = normalizeProductName(alias)
      return an === norm || norm.includes(an) || an.includes(norm)
    })
  })
  if (byAlias.length === 1) return byAlias[0]

  if (lineName) {
    const byPrefix = resolveProductByLinePrefix(lineName, meta, products)
    if (byPrefix) return byPrefix
  }

  return null
}

function upsertVariant(product, variant, purchasePrice, markup) {
  if (!Array.isArray(product.variants)) product.variants = []
  const price = calcRetailFromPurchase(purchasePrice, markup)
  const idx = product.variants.findIndex((v) => variantKey(v) === variantKey(variant))
  const row = { ...variant, purchasePrice, price }
  if (idx >= 0) product.variants[idx] = row
  else product.variants.push(row)
  return idx >= 0 ? 'updated' : 'added'
}

export function buildCatalogFromEntries(rawEntries, existingProducts, markup = { percent: 15, fixed: 0 }, options = {}) {
  let entries = rawEntries
  if (options.filterSections !== false) {
    entries = entries
      .map((e) => ({ ...e, section: resolveCatalogSection(e.section) }))
      .filter((e) => CATALOG_SECTIONS.has(e.section))
  }

  const pricesOnly = options.pricesOnly !== false
  const products = existingProducts.map((p) => {
    const copy = structuredClone(p)
    if (!Array.isArray(copy.variants)) copy.variants = []
    return copy
  })

  const stats = {
    entries: entries.length,
    productsCreated: 0,
    productsUpdated: 0,
    variantsAdded: 0,
    variantsUpdated: 0,
    variantsRemoved: 0,
    pricesUpdated: 0,
    skipped: 0,
    skippedVariants: 0,
    notFound: [],
    notFoundSet: new Set(),
    skippedVariantSamples: [],
    errors: [],
  }

  const productMap = new Map()
  for (const p of products) registerProductKeys(productMap, p)

  const byProduct = new Map()
  for (const entry of entries) {
    const meta = CATALOG_SECTIONS.get(entry.section)
    if (!meta) continue
    const productName = options.getProductKey
      ? options.getProductKey(entry, meta)
      : productKeyFromEntry(entry, meta)
    const groupKey = `${meta.category}::${normalizeProductName(productName)}`
    if (!byProduct.has(groupKey)) {
      byProduct.set(groupKey, { productName, meta, entries: [] })
    }
    byProduct.get(groupKey).entries.push(entry)
  }

  let nextId = Math.max(0, ...products.map((p) => p.id)) + 1
  const touchedProducts = new Set()

  for (const { productName, meta, entries: groupEntries } of byProduct.values()) {
    const sampleLine = groupEntries[0]?.name || ''
    let product = options.findProduct?.(productName, meta, groupEntries, productMap, products)
      || resolveProduct(productName, meta, productMap, products, sampleLine)
    if (!product) {
      if (pricesOnly) {
        stats.skipped += groupEntries.length
        if (stats.notFoundSet.size < 50) stats.notFoundSet.add(productName)
        continue
      }
      product = createEmptyProduct(productName, meta, nextId++)
      products.push(product)
      registerProductKeys(productMap, product)
      stats.productsCreated += 1
    }

    const pdfVariantKeys = new Set()

    for (const entry of groupEntries) {
      try {
        const variantName = options.getVariantName ? options.getVariantName(entry, meta) : entry.name
        if (pricesOnly) {
          const variant = parseVariantForUpdate(variantName, product, meta)
          if (!variant) {
            stats.skippedVariants += 1
            if (stats.skippedVariantSamples.length < 12) stats.skippedVariantSamples.push(entry.name)
            continue
          }
          const idx = product.variants.findIndex((v) => variantKey(v) === variantKey(variant))
          if (idx < 0) {
            if (options.upsertVariants) {
              upsertVariant(product, variant, entry.price, markup)
              stats.variantsAdded += 1
              stats.pricesUpdated += 1
              stats.variantsUpdated += 1
              touchedProducts.add(product.id)
            } else {
              stats.skippedVariants += 1
              if (stats.skippedVariantSamples.length < 12) stats.skippedVariantSamples.push(entry.name)
            }
            continue
          }
          const price = calcRetailFromPurchase(entry.price, markup)
          product.variants[idx] = {
            ...product.variants[idx],
            purchasePrice: entry.price,
            price,
          }
          stats.pricesUpdated += 1
          stats.variantsUpdated += 1
          touchedProducts.add(product.id)
          continue
        }

        const variant = parseVariant(entry, product, meta)
        if (!variant) {
          stats.skippedVariants += 1
          continue
        }
        pdfVariantKeys.add(variantKey(variant))
        const action = upsertVariant(product, variant, entry.price, markup)
        if (action === 'added') stats.variantsAdded += 1
        else stats.variantsUpdated += 1
        touchedProducts.add(product.id)
      } catch (err) {
        stats.errors.push({ name: entry.name, error: err.message })
      }
    }

    if (!pricesOnly && pdfVariantKeys.size) {
      const before = product.variants.length
      product.variants = product.variants.filter((v) => pdfVariantKeys.has(variantKey(v)))
      stats.variantsRemoved += before - product.variants.length
    }
  }

  stats.productsUpdated = touchedProducts.size
  stats.notFound = [...stats.notFoundSet]
  delete stats.notFoundSet
  return { products, stats }
}

export function buildCatalogFromPdfText(text, existingProducts, markup = { percent: 15, fixed: 0 }, options = {}) {
  let entries = filterCatalogEntries(extractPriceEntries(text))
  if (Array.isArray(options.sections) && options.sections.length) {
    const allowed = new Set(options.sections)
    entries = entries.filter((e) => allowed.has(e.section))
  }

  return buildCatalogFromEntries(entries, existingProducts, markup, options)
}

export async function extractTextFromPdfBuffer(buffer) {
  await import('./scripts/pdf-dom-polyfill.mjs')
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  await parser.destroy()
  return result.text
}
