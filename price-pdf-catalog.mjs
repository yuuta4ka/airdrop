import { calcRetailFromPurchase } from './site/js/pricing.js'
import { CATALOG_SECTIONS, filterCatalogEntries, extractPriceEntries, resolveCatalogSection } from './price-pdf-parser.mjs'

const COLOR_ALIASES = {
  silver: ['silver', 'серебро', 'серебристый', 'starlight', 'сияющая звезда', 'whitesilver', 'silvershadow'],
  white: ['white', 'белый', 'silver', 'starlight'],
  black: ['black', 'чёрный', 'черный', 'jet black', 'midnight', 'graphite', 'space black', 'space gray', 'gray', 'grey', 'jetblack', 'charcoal'],
  blue: ['blue', 'синий', 'deep blue', 'ultramarine', 'sky blue', 'mist blue', 'cobalt violet', 'silverblue', 'indigo'],
  orange: ['orange', 'оранжевый', 'cosmic orange'],
  green: ['green', 'зелёный', 'sage', 'teal', 'бирюзовый'],
  pink: ['pink', 'розовый', 'rose gold', 'light blush', 'lavender', 'lilac', 'purple', 'violet', 'фиолетовый', 'mist purple', 'cobalt violet'],
  gray: ['gray', 'grey', 'графитовый', 'космический серый', 'space gray', 'graphite'],
  gold: ['gold', 'золотой', 'champagne', 'light gold'],
  natural: ['natural', 'desert', 'titanium', 'titan'],
  yellow: ['yellow', 'жёлтый'],
  red: ['red', 'красный', 'crimson'],
  brown: ['brown', 'коричневый'],
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

/** Точное совпадение имени/id/importNames цвета (без фаззи-алиасов COLOR_ALIASES) */
function findExactColorId(name, colors) {
  const t = String(name).trim().toLowerCase()
  if (!t) return null
  for (const col of colors) {
    const aliases = [col.name, col.id, ...(col.importNames ? col.importNames.split(/[,;]+/) : [])]
      .map((a) => a.trim().toLowerCase()).filter(Boolean)
    if (aliases.includes(t)) return col.id
  }
  return null
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

function normalizeSamsungPhoneStorage(raw, product = null) {
  const slash = String(raw).match(/(\d+)\s*\/\s*(\d+)\s*(Gb|GB|ГБ)?/i)
  if (slash) {
    const ram = slash[1]
    const rom = slash[2]
    const usesCombined = product?.storage?.some((s) => /\d+\s*\/\s*\d+/.test(s.label))
    if (usesCombined) {
      const inProduct = product.storage.find((s) => {
        const n = s.label.replace(/\s/g, '').toLowerCase()
        return n === `${ram}/${rom}гб` || n.startsWith(`${ram}/${rom}`)
      })
      if (inProduct) return inProduct.label
      return `${ram}/${rom} ГБ`
    }
    return `${rom} ГБ`
  }
  let storage = String(raw).replace(/\s*Gb/i, ' ГБ').replace(/GB/i, ' ГБ').trim()
  if (!/ГБ|ТБ/.test(storage)) storage += ' ГБ'
  return storage
}

function resolveStorageLabel(label, product, meta) {
  if (!label || label === 'Стандарт') {
    if (meta.type === 'airpods' && !product.storage?.length) return 'Стандарт'
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
      const combined = `${slash[1]}/${slash[2]}`
      const byCombined = product.storage?.find((s) => {
        const n = s.label.replace(/\s/g, '').toLowerCase()
        return n.startsWith(combined.toLowerCase())
      })
      if (byCombined) return byCombined.label
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
    const storage = normalizeSamsungPhoneStorage(m[1], product)
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
    let storageLabel = resolveWatchStorageLabel(sizeLabel, product, meta)
    if (!storageLabel && sizeLabel && sizeLabel !== 'Стандарт') storageLabel = sizeLabel
    if (!storageLabel) storageLabel = 'Стандарт'
    return { colorId, storage: storageLabel, simType: '' }
  }

  if (meta.type === 'airpods') {
    if (/^Ray\s+Ban\s+Meta/i.test(name)) return parseRayBanVariant(name, product, false)
    if (/^Samsung\s+(?:Galaxy\s+)?Buds/i.test(name)) return parseSamsungBudsVariant(name, product, false)
    if (/^Google\s+Fitbit/i.test(name)) return parseFitbitVariant(name, product, false)
    const colorName = matchAirpodsColorSuffix(name)
    const colorId = colorName
      ? (findExactColorId(colorName, product.colors) || ensureColor(product, colorName))
      : (product.colors?.[0]?.id || ensureColor(product, 'Стандарт'))
    const storageLabel = resolveStorageLabel('Стандарт', product, meta)
      || product.storage?.[0]?.label
      || 'Стандарт'
    return { colorId, storage: storageLabel, simType: '' }
  }

  if (meta.type === 'xiaomi' || meta.type === 'huawei') {
    if (meta.type === 'huawei' && /watch/i.test(name)) {
      return parseHuaweiWatchVariant(name, product, false)
    }
    return parsePhoneStorageColorVariant(name, product, meta, false)
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
  'Midnight Blue', 'Space Gray', 'Space Grey',
  'Midnight', 'Purple', 'Starlight', 'Orange', 'Black', 'White', 'Blue', 'Red', 'Green',
  'Cream', 'Brown', 'Silver', 'Gold', 'Pink', 'Yellow',
]

/** Ищет самый длинный (наиболее специфичный) суффикс-цвет в конце названия */
function matchAirpodsColorSuffix(name) {
  let best = ''
  for (const color of AIRPODS_COLOR_SUFFIXES) {
    const re = new RegExp(`\\s+${color.replace(/\s+/g, '\\s+')}\\s*$`, 'i')
    if (re.test(name) && color.length > best.length) best = color
  }
  return best
}

function stripAirpodsColorSuffix(name) {
  let base = String(name).trim()
  for (const color of AIRPODS_COLOR_SUFFIXES) {
    const re = new RegExp(`\\s+${color.replace(/\s+/g, '\\s+')}\\s*$`, 'i')
    if (re.test(base)) return base.replace(re, '').trim()
  }
  return base
}

/** Ключ товара AirPods/Marshall — более специфичные шаблоны раньше коротких */
export function extractAirpodsProductKey(base) {
  const patterns = [
    /^Marshall\s+Major\s+\d+/i,
    /^AirPods\s+Max\s*\(\d{4}\)/i,
    /^AirPods\s+Pro\s+3/i,
    /^AirPods\s+Pro\s+2(?:\s+Type-C)?/i,
    /^AirPods\s+\d+\s+ANC/i,
    /^AirPods\s+\d+/i,
    /^AirPods\s+Max(?:\s+USB-C)?/i,
    /^AirPods\s+Pro/i,
    /^Samsung\s+(?:Galaxy\s+)?Buds\s+\d+(?:\s+Pro)?/i,
    /^Google\s+Fitbit\s+\w+/i,
    /^Ray\s+Ban\s+Meta\s+\w+\s*(?:\([^)]+\))?/i,
  ]
  for (const re of patterns) {
    const m = String(base).trim().match(re)
    if (m) return m[0].trim()
  }
  return String(base).trim()
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
  if (m) return normalizeWatchSizeLabel(m[1])
  const se = String(name).match(/\bSE\s+(\d{2})\b/i)
  if (se) return `${se[1]} мм`
  return 'Стандарт'
}

function parseWatchColorPart(name) {
  const ultra = String(name).match(/^Ultra\s+\d+\s+(.+)$/i)
  if (ultra) return ultra[1].trim()
  const sizeColor = String(name).match(/\b(?:S\d+|SE)\s+(?:\d{2}\s*mm|\d{2}\s*\(\d{4}\)|\d{2})\s+(.+)$/i)
  if (sizeColor) return sizeColor[1].trim()
  const seColor = String(name).match(/^SE\s+(?:\d{2}\s*)?(?:\(\d{4}\)\s*)?(.+)$/i)
  if (seColor) return seColor[1].trim()
  const afterGen = String(name).match(/^S\d+\s+(.+)$/i)
  if (afterGen && !/\d{2}\s*mm/i.test(name)) return afterGen[1].trim()
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
    storage = normalizeSamsungPhoneStorage(m[1], product)
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

function parseRayBanVariant(name, product, mutate = true) {
  const sizeM = String(name).match(/\s+(S\d{2})\s*$/i)
  const storage = sizeM ? sizeM[1] : 'Стандарт'
  const colorPart = sizeM ? name.slice(0, sizeM.index).trim() : name
  const frameM = colorPart.match(/^Ray\s+Ban\s+Meta\s+\w+\s*(?:\([^)]+\))?\s*(.*)$/i)
  const colorName = frameM?.[1]?.trim() || 'Стандарт'
  const colorId = findColorId(colorName, product.colors)
    || (mutate ? ensureColor(product, colorName) : null)
  if (!colorId) return null
  if (mutate) ensureStorage(product, storage)
  return { colorId, storage, simType: '' }
}

function parseSamsungBudsVariant(name, product, mutate = true) {
  const m = String(name).match(/^(?:Samsung\s+(?:Galaxy\s+)?)?Buds\s+\d+(?:\s+Pro)?\s+(.+)$/i)
  const colorName = m?.[1]?.trim() || 'Стандарт'
  const colorId = findColorId(colorName, product.colors)
    || (mutate ? ensureColor(product, colorName) : null)
  if (!colorId) return null
  if (mutate) ensureStorage(product, 'Стандарт')
  return { colorId, storage: 'Стандарт', simType: '' }
}

function parseFitbitVariant(name, product, mutate = true) {
  const m = String(name).match(/^Google\s+Fitbit\s+\w+\s+(.+)$/i)
  const colorName = m?.[1]?.trim() || 'Стандарт'
  const colorId = findColorId(colorName, product.colors)
    || (mutate ? ensureColor(product, colorName) : null)
  if (!colorId) return null
  if (mutate) ensureStorage(product, 'Стандарт')
  return { colorId, storage: 'Стандарт', simType: '' }
}

function parseHuaweiWatchVariant(name, product, mutate = true) {
  const paren = String(name).match(/\(([^)]+)\)\s*$/)
  const colorName = paren?.[1]?.trim() || 'Стандарт'
  const colorId = findColorId(colorName, product.colors)
    || (mutate ? ensureColor(product, colorName) : null)
  if (!colorId) return null
  if (mutate) ensureStorage(product, 'Стандарт')
  return { colorId, storage: 'Стандарт', simType: '' }
}

function parsePhoneStorageColorVariant(name, product, meta, mutate = true) {
  const paren = String(name).match(/\(([^)]+)\)\s*$/)
  if (paren) {
    const storageMatch = name.match(/(\d+\/\d+\s*Gb?|\d+\s*Gb)/i)
    if (!storageMatch) return null
    const storage = normalizeSamsungPhoneStorage(storageMatch[0], product)
    const colorName = paren[1].trim()
    const colorId = findColorId(colorName, product.colors)
      || (mutate ? ensureColor(product, colorName) : null)
    if (!colorId) return null
    const storageLabel = resolveStorageLabel(storage, product, meta)
      || (mutate ? ensureStorage(product, storage) : storage)
    if (!storageLabel) return null
    return { colorId, storage: storageLabel, simType: '' }
  }
  const m = String(name).match(/(\d+\/\d+\s*Gb?|\d+\s*Gb)\s+(.+)$/i)
  if (!m) return null
  const storage = normalizeSamsungPhoneStorage(m[1], product)
  const colorName = m[2].trim()
  const colorId = findColorId(colorName, product.colors)
    || (mutate ? ensureColor(product, colorName) : null)
  if (!colorId) return null
  const storageLabel = resolveStorageLabel(storage, product, meta)
    || (mutate ? ensureStorage(product, storage) : storage)
  if (!storageLabel) return null
  return { colorId, storage: storageLabel, simType: '' }
}

function parseAirpodsVariant(name, product) {
  if (/^Ray\s+Ban\s+Meta/i.test(name)) return parseRayBanVariant(name, product)
  if (/^Samsung\s+(?:Galaxy\s+)?Buds/i.test(name)) return parseSamsungBudsVariant(name, product)
  if (/^Google\s+Fitbit/i.test(name)) return parseFitbitVariant(name, product)
  const colorName = matchAirpodsColorSuffix(name) || 'Стандарт'
  const colorId = colorName === 'Стандарт'
    ? ensureColor(product, 'Стандарт')
    : (findExactColorId(colorName, product.colors) || ensureColor(product, colorName))
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
    const base = stripAirpodsColorSuffix(name).replace(/^Apple\s+/i, '').replace(/Цветные\s+/i, '')
    return extractAirpodsProductKey(base)
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
  const isWatch = ['watch', 'watch-ultra', 'samsung-watch'].includes(meta.type)
  const isIpad = meta.type === 'ipad'
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
      : meta.type === 'airpods'
        ? []
        : [{ id: 'default', name: 'Стандарт', hex: '#888888', image: '', importNames: '' }],
    storage: isWatch || isIpad ? [] : [{ label: 'Стандарт' }],
    variants: [],
    sizes: isWatch ? [] : null,
    stock: [],
    images: [],
    markupPercent: 15,
    markupFixed: 0,
    showCatalogSpec: false,
    importNames: name,
    hidden: true,
    isNew: true,
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
  if (meta.type === 'xiaomi' || meta.type === 'huawei') {
    if (meta.type === 'huawei' && /watch/i.test(name)) {
      return parseHuaweiWatchVariant(name, product, true)
    }
    return parsePhoneStorageColorVariant(name, product, meta, true)
  }
  return parseGenericVariant(name, product)
}

function variantKey(v) {
  return `${v.colorId}::${v.storage}::${v.simType || ''}`
}

function normalizeProductName(name) {
  return String(name)
    .replace(/[""«»]/g, '')
    .replace(/\((?!20\d{2})[^)]*\)/g, '')
    .replace(/\s+M\d+(\s+Max)?/g, '')
    .replace(/\s+A\d+(\s+Pro)?/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function productGroupKey(category, productName) {
  return `${category}::${String(productName).toLowerCase().replace(/\s+/g, ' ').trim()}`
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
  const watchSeries = product.name.match(/^watch\s+series\s+(\d+)/i)
  if (watchSeries && product.category === 'apple-watch') {
    const n = watchSeries[1]
    productMap.set(`${product.category}::apple watch s${n}`, product)
    productMap.set(`${product.category}::watch s${n}`, product)
    productMap.set(`${product.category}::s${n}`, product)
  }
  if (/^watch\s+se\b/i.test(product.name) && product.category === 'apple-watch') {
    productMap.set(`${product.category}::apple watch se`, product)
  }
  if (/ultra/i.test(product.name) && product.category === 'apple-watch') {
    productMap.set(`${product.category}::apple watch ultra 3`, product)
    productMap.set(`${product.category}::apple watch ultra`, product)
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

/** Точный поиск для JSON-импорта: без includes()/fuzzy, чтобы iPhone 16 Pro ≠ iPhone 16. */
export function resolveProductExact(productName, meta, productMap, products) {
  const candidates = [
    productName,
    normalizeProductKeyAlias(productName),
  ]
  if (meta.category === 'samsung') {
    candidates.push(productName.replace(/^Samsung\s+Galaxy\s+/i, 'Galaxy '))
    candidates.push(productName.replace(/^Samsung\s+/i, ''))
    candidates.push(`Samsung Galaxy ${productName.replace(/^Galaxy\s+/i, '')}`)
  }
  if (meta.category === 'apple-watch') {
    candidates.push(productName.replace(/^Watch\s+/i, 'Apple Watch '))
    candidates.push(productName.replace(/^Apple\s+Watch\s+/i, 'Watch '))
  }
  if (meta.category === 'airpods') {
    candidates.push(productName.replace(/^Apple\s+/i, ''))
  }
  if (meta.category === 'macbook' || meta.category === 'ipad') {
    candidates.push(productName.replace(/^Apple\s+/i, ''))
  }

  const seen = new Set()
  for (const cand of candidates) {
    const name = String(cand || '').trim()
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const keys = [
      `${meta.category}::${name.toLowerCase()}`,
      `${meta.category}::${normalizeProductName(name)}`,
      `${meta.category}::${slugify(name)}`,
    ]
    for (const k of keys) {
      if (productMap.has(k)) return productMap.get(k)
    }
  }

  const norm = normalizeProductName(productName)
  const exact = products.filter((p) => p.category === meta.category && normalizeProductName(p.name) === norm)
  if (exact.length === 1) return exact[0]

  // Точное совпадение alias/importNames (равенство, без includes)
  let best = null
  let bestLen = 0
  for (const p of products) {
    if (p.category !== meta.category) continue
    for (const alias of productImportAliases(p)) {
      const an = normalizeProductName(alias)
      if (an === norm && an.length > bestLen) {
        best = p
        bestLen = an.length
      }
    }
  }
  return best
}

function normalizeProductKeyAlias(name) {
  // локальный лёгкий alias-слой; основной — в price-text-import
  return String(name || '').trim()
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

function formatMacbookStorage(raw) {
  return String(raw)
    .replace(/\s*(Gb|GB|ГБ)\b/gi, ' ГБ')
    .replace(/\s*(Tb|TB|ТБ)\b/gi, ' ТБ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Вариант из явных полей JSON-импорта (без угадывания из свободной строки). */
export function variantFromStructuredFields(fields, product, meta) {
  if (!product.colors) product.colors = []
  if (!product.storage) product.storage = []

  let colorName = String(fields.color || '').trim()
  let storageRaw = String(fields.storage || fields.size || '').trim()
  if (storageRaw === '—' || storageRaw === '-') storageRaw = ''
  const simRaw = String(fields.sim || '').trim()

  // Ray-Ban и похожие: размер S50/S53 часто приходит в конце цвета
  if (!storageRaw && colorName) {
    const sizeM = colorName.match(/\s+(S\d{2})$/i)
    if (sizeM) {
      storageRaw = sizeM[1].toUpperCase()
      colorName = colorName.slice(0, sizeM.index).trim()
    }
  }

  const colorId = !colorName
    ? ensureColor(product, 'Стандарт')
    : (findExactColorId(colorName, product.colors) || ensureColor(product, colorName))

  const isWatchLike = ['watch', 'watch-ultra', 'samsung-watch'].includes(meta.type)
    || (meta.type === 'huawei' && (fields.size !== undefined && fields.size !== null) && !fields.storage)

  let storageLabel = 'Стандарт'
  if (isWatchLike) {
    const sizeLabel = storageRaw ? normalizeWatchSizeLabel(storageRaw) || storageRaw : 'Стандарт'
    storageLabel = resolveWatchStorageLabel(sizeLabel, product, meta) || sizeLabel
    if (storageLabel && storageLabel !== 'Стандарт') {
      ensureStorage(product, storageLabel)
      if (!Array.isArray(product.sizes)) product.sizes = []
      if (!product.sizes.some((s) => normalizeSizeKey(s.label) === normalizeSizeKey(storageLabel))) {
        product.sizes.push({ label: storageLabel })
      }
    }
  } else if (meta.type === 'airpods') {
    storageLabel = storageRaw
      ? (resolveStorageLabel(storageRaw, product, meta) || storageRaw)
      : 'Стандарт'
    if (storageLabel && storageLabel !== 'Стандарт') ensureStorage(product, storageLabel)
  } else if (meta.type === 'macbook') {
    const formatted = storageRaw ? formatMacbookStorage(storageRaw) : 'Стандарт'
    storageLabel = resolveStorageLabel(formatted, product, meta) || formatted
    if (storageLabel && storageLabel !== 'Стандарт' && storageLabel === formatted) {
      const prefix = formatted.replace(/\s/g, '').toLowerCase()
      const byPrefix = product.storage?.find((s) => s.label.replace(/\s/g, '').toLowerCase().startsWith(prefix))
      if (byPrefix) storageLabel = byPrefix.label
    }
    if (storageLabel && storageLabel !== 'Стандарт') ensureStorage(product, storageLabel)
  } else if (storageRaw) {
    let formatted = storageRaw
    if (/\d+\s*\/\s*\d+/.test(storageRaw)) {
      formatted = normalizeSamsungPhoneStorage(storageRaw, product)
    } else {
      formatted = normalizeStorage(storageRaw) || storageRaw.replace(/\s*Gb/i, ' ГБ').trim()
    }
    storageLabel = resolveStorageLabel(formatted, product, meta) || formatted
    if (storageLabel && storageLabel !== 'Стандарт') ensureStorage(product, storageLabel)
  } else {
    storageLabel = 'Стандарт'
  }

  let simType = ''
  if (meta.type === 'iphone') {
    simType = ensureSimTypes(product, normalizeSim(simRaw)) || ''
  } else if (!product.simTypes?.length) {
    product.simTypes = null
  }

  return { colorId, storage: storageLabel || 'Стандарт', simType }
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
    productSummaries: [],
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
    const groupKey = productGroupKey(meta.category, productName)
    if (!byProduct.has(groupKey)) {
      byProduct.set(groupKey, { productName, meta, entries: [] })
    }
    byProduct.get(groupKey).entries.push(entry)
  }

  let nextId = Math.max(0, ...products.map((p) => p.id)) + 1
  const touchedProducts = new Set()
  // Несколько строк прайса (например «iPhone 17» и «iPhone 17 Air» без своей карточки)
  // могут через нечёткое сопоставление указывать на один и тот же товар — копим
  // ключи вариантов и «было/стало» по product.id, а не по группе, иначе при удалении
  // устаревших вариантов группы будут затирать варианты друг друга.
  const importedVariantKeysByProduct = new Map()
  const variantsBeforeByProduct = new Map()

  for (const { productName, meta, entries: groupEntries } of byProduct.values()) {
    const sampleLine = groupEntries[0]?.name || ''
    let product = options.findProduct
      ? options.findProduct(productName, meta, groupEntries, productMap, products)
      : resolveProduct(productName, meta, productMap, products, sampleLine)
    if (!product) {
      if (pricesOnly && !options.upsertProducts) {
        stats.skipped += groupEntries.length
        if (stats.notFoundSet.size < 50) stats.notFoundSet.add(productName)
        continue
      }
      product = createEmptyProduct(productName, meta, nextId++)
      products.push(product)
      registerProductKeys(productMap, product)
      stats.productsCreated += 1
    }

    if (!variantsBeforeByProduct.has(product.id)) {
      variantsBeforeByProduct.set(product.id, product.variants.length)
    }
    if (!importedVariantKeysByProduct.has(product.id)) {
      importedVariantKeysByProduct.set(product.id, new Set())
    }
    const importedVariantKeys = importedVariantKeysByProduct.get(product.id)

    for (const entry of groupEntries) {
      try {
        if (pricesOnly) {
          let variant = null
          if (entry.fields) {
            variant = variantFromStructuredFields(entry.fields, product, meta)
          } else {
            const variantName = options.getVariantName ? options.getVariantName(entry, meta) : entry.name
            variant = parseVariantForUpdate(variantName, product, meta)
            if (!variant && options.upsertVariants) {
              variant = parseVariant({ name: variantName }, product, meta)
            }
          }
          if (!variant) {
            stats.skippedVariants += 1
            if (stats.skippedVariantSamples.length < 12) stats.skippedVariantSamples.push(entry.name)
            continue
          }
          importedVariantKeys.add(variantKey(variant))
          const idx = product.variants.findIndex((v) => variantKey(v) === variantKey(variant))
          if (idx < 0) {
            if (options.upsertVariants || entry.fields) {
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

        const variant = entry.fields
          ? variantFromStructuredFields(entry.fields, product, meta)
          : parseVariant(entry, product, meta)
        if (!variant) {
          stats.skippedVariants += 1
          continue
        }
        importedVariantKeys.add(variantKey(variant))
        const action = upsertVariant(product, variant, entry.price, markup)
        if (action === 'added') stats.variantsAdded += 1
        else stats.variantsUpdated += 1
        touchedProducts.add(product.id)
      } catch (err) {
        stats.errors.push({ name: entry.name, error: err.message })
      }
    }

  }

  const replaceVariants = options.replaceVariants !== false
  for (const product of products) {
    const importedVariantKeys = importedVariantKeysByProduct.get(product.id)
    if (!importedVariantKeys) continue
    if (replaceVariants && importedVariantKeys.size) {
      const before = product.variants.length
      product.variants = product.variants.filter((v) => importedVariantKeys.has(variantKey(v)))
      // Убираем дубликаты с одинаковым ключом (оставляем последний)
      const seen = new Map()
      for (const v of product.variants) seen.set(variantKey(v), v)
      product.variants = [...seen.values()]
      stats.variantsRemoved += before - product.variants.length
    }
    if (touchedProducts.has(product.id)) {
      const prices = product.variants.map((v) => Number(v.price)).filter((n) => n > 0)
      stats.productSummaries.push({
        name: product.name,
        category: product.category,
        variantsBefore: variantsBeforeByProduct.get(product.id) ?? 0,
        variantsAfter: product.variants.length,
        minPrice: prices.length ? Math.min(...prices) : null,
      })
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
