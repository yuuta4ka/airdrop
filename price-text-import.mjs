import { CATALOG_SECTIONS } from './price-pdf-parser.mjs'
import { buildCatalogFromEntries, extractAirpodsProductKey, resolveProductExact } from './price-pdf-catalog.mjs'

function parsePriceCell(cell) {
  const digits = String(cell ?? '').replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

/** Секция каталога по имени товара из JSON (без свободного текста конфигурации). */
function detectSection(name) {
  const n = String(name).trim()
  if (/^iPhone\s+17\s+Pro\s+Max/i.test(n)) return 'iPhone 17 Pro Max'
  if (/^iPhone\s+17\s+Pro\b/i.test(n)) return 'iPhone 17 Pro'
  if (/^iPhone\s+17\s+Air/i.test(n)) return 'iPhone 17'
  if (/^iPhone\s+17\b/i.test(n)) return 'iPhone 17'
  if (/^iPhone\s+16\s+Pro\s+Max/i.test(n)) return 'iPhone 16'
  if (/^iPhone\s+16\s+Pro\b/i.test(n)) return 'iPhone 16'
  if (/^iPhone\s+16\b/i.test(n)) return 'iPhone 16'
  if (/^iPhone\s+15/i.test(n)) return 'iPhone 16'
  if (/^iPad\b|^Apple\s+iPad/i.test(n)) return 'Apple iPad'
  if (/^MacBook\b|^Macbook\b|^Apple\s+Mac/i.test(n)) return 'Apple MacBook'
  if (/^Watch\s+Ultra|^Apple\s+Watch\s+Ultra/i.test(n)) return 'Apple Watch Ultra'
  if (/^Watch\b|^Apple\s+Watch/i.test(n)) return 'Apple Watch S / SE'
  if (/^AirPods\b|^Marshall\b|^JBL\b|^Apple\s+AirPods/i.test(n)) return 'Apple AirPods / Marshall'
  if (/^Samsung\s+(?:Galaxy\s+)?Buds|^Galaxy\s+Buds/i.test(n)) return 'Samsung Buds'
  if (/^Ray[-\s]?Ban\s+Meta/i.test(n)) return 'Ray Ban Meta'
  if (/^Google\s+Fitbit|^Fitbit\b/i.test(n)) return 'Google Fitbit'
  if (/^Samsung\s+Galaxy\s+Z|^Galaxy\s+Z\b/i.test(n)) return 'Samsung Серия Z'
  if (/^Samsung\s+Galaxy\s+S26|^Galaxy\s+S26/i.test(n)) return 'Samsung Серия S26'
  if (/^Samsung\s+Galaxy\s+S25|^Galaxy\s+S25/i.test(n)) return 'Samsung Серия S25'
  if (/^Samsung\s+(?:Galaxy\s+)?Watch|^Galaxy\s+Watch/i.test(n)) return 'Samsung Watch'
  if (/^(Redmi|Poco|OnePlus|Xiaomi)\b/i.test(n)) return 'Xiaomi'
  if (/^Huawei\s+Watch/i.test(n)) return 'Умные устройства Huawei'
  if (/^(HUAWEI|Huawei|Honor)\b/i.test(n)) return 'Huawei'
  return null
}

/** Если regex-секция не сработала — ищем товар по точному имени/importNames и берём подходящую секцию. */
function detectSectionFromProducts(name, products) {
  if (!Array.isArray(products) || !products.length) return null
  const raw = String(name || '').trim()
  if (!raw) return null
  const norm = raw.toLowerCase().replace(/\s+/g, ' ')
  let hit = null
  let hitLen = 0
  for (const p of products) {
    const aliases = [p.name, ...(String(p.importNames || '').split(/[,;]+/))]
      .map((s) => String(s || '').trim())
      .filter(Boolean)
    for (const alias of aliases) {
      const a = alias.toLowerCase().replace(/\s+/g, ' ')
      if (a === norm && alias.length >= hitLen) {
        hit = p
        hitLen = alias.length
      }
    }
  }
  if (!hit) return null

  // Подбираем секцию по категории/бренду карточки
  if (hit.category === 'samsung' && /buds/i.test(`${hit.name} ${hit.importNames || ''}`)) return 'Samsung Buds'
  if (hit.category === 'airpods' && /ray/i.test(`${hit.brand || ''} ${hit.name}`)) return 'Ray Ban Meta'
  if (hit.category === 'airpods') return 'Apple AirPods / Marshall'
  if (hit.category === 'iphone') {
    if (/17\s+Pro\s+Max/i.test(hit.name)) return 'iPhone 17 Pro Max'
    if (/17\s+Pro/i.test(hit.name)) return 'iPhone 17 Pro'
    if (/17/i.test(hit.name)) return 'iPhone 17'
    return 'iPhone 16'
  }
  if (hit.category === 'ipad') return 'Apple iPad'
  if (hit.category === 'macbook') return 'Apple MacBook'
  if (hit.category === 'apple-watch') {
    return /ultra/i.test(hit.name) ? 'Apple Watch Ultra' : 'Apple Watch S / SE'
  }
  if (hit.category === 'galaxy-watch') return 'Samsung Watch'
  if (hit.category === 'samsung') {
    if (/z\s+fold|z\s+flip/i.test(hit.name)) return 'Samsung Серия Z'
    if (/s26/i.test(hit.name)) return 'Samsung Серия S26'
    if (/s25/i.test(hit.name)) return 'Samsung Серия S25'
    return 'Samsung Серия S25'
  }
  if (hit.category === 'xiaomi') return 'Xiaomi'
  if (hit.category === 'huawei') {
    return /watch/i.test(hit.name) ? 'Умные устройства Huawei' : 'Huawei'
  }
  return null
}

/**
 * Каноническое имя карточки. Для JSON-импорта почти всегда берём product как есть,
 * только лёгкие алиасы к уже существующим карточкам.
 */
const PRODUCT_ALIASES = new Map([
  ['airpods max (2026)', 'AirPods Max (2026)'],
  ['airpods max 2 (2026)', 'AirPods Max (2026)'],
  ['airpods max (2024)', 'Airpods Max (2024)'],
  ['watch ultra 3', 'Apple Watch Ultra 3'],
  ['apple watch ultra 3', 'Apple Watch Ultra 3'],
  ['watch se (2025)', 'Apple Watch SE'],
  ['apple watch se', 'Apple Watch SE'],
  ['samsung watch 8 ultra 2025', 'Galaxy Watch 8 Ultra'],
  ['samsung galaxy watch 8 ultra', 'Galaxy Watch 8 Ultra'],
  ['samsung watch 8 classic', 'Galaxy Watch 8 Classic'],
  ['samsung galaxy watch 8 classic', 'Galaxy Watch 8 Classic'],
  ['samsung galaxy z fold 7', 'Galaxy Z Fold 7'],
  ['samsung galaxy s26', 'Galaxy S26'],
  ['macbook air 13 m5', 'MacBook Air 13 M5'],
  ['macbook air 13.6" m5', 'MacBook Air 13 M5'],
  ['macbook air 13.6 m5', 'MacBook Air 13 M5'],
  ['ipad air 11 m4 (2026)', 'iPad Air 11 M4 (2026)'],
  ['ipad 11 (2025)', 'iPad 11 (2025)'],
])

function normalizeProductKey(name) {
  const raw = String(name || '').trim()
  const alias = PRODUCT_ALIASES.get(raw.toLowerCase())
  return alias || raw
}

function productKeyFromTextName(name, meta) {
  const n = String(name).trim()
  if (meta.type === 'iphone') {
    if (/^iPhone\s+17\s+Air/i.test(n)) return 'iPhone 17 Air'
    const m = n.match(/^iPhone\s+(\d+(?:\s+(?:Pro(?:\s+Max)?|Air|Plus))?)/i)
    if (m) return `iPhone ${m[1].replace(/\s+/g, ' ').trim()}`
    return meta.productName
  }
  if (meta.type === 'ipad') {
    const known = n.match(/^Apple\s+(iPad\s+Air\s+11\s+M4\s*\(\d{4}\))/i)
      || n.match(/^Apple\s+(iPad\s+mini\s*\([^)]+\))/i)
      || n.match(/^Apple\s+(iPad\s+11\s*\(\d{4}\))/i)
      || n.match(/^Apple\s+(iPad\s+.+?)(?=\s+\d+\s*Gb|\s+Wi-Fi|\s+Wifi)/i)
    if (known) return known[1].trim()
    return n.replace(/^Apple\s+/i, '').split(/\d+\s*Gb/i)[0].trim()
  }
  if (meta.type === 'macbook') {
    const neo = n.match(/^Apple\s+(MacBook Neo\s+\d+"\s+A\d+\s+Pro)/i)
    if (neo) return neo[1]
    const air = n.match(/^Apple\s+(Macbook Air\s+\d+\s+M\d+)/i)
      || n.match(/^Apple\s+(MacBook Air\s+\d+\s+M\d+)/i)
    if (air) return air[1].replace(/\s+/g, ' ').trim()
    return n.replace(/^Apple\s+/i, '').replace(/\s+\d+\/\d+\s*Gb?.*/i, '').trim()
  }
  if (meta.type === 'watch-ultra') return 'Apple Watch Ultra 3'
  if (meta.type === 'watch') {
    if (/^Apple\s+Watch\s+SE|^Watch\s+SE/i.test(n)) return 'Apple Watch SE'
    const s = n.match(/^(?:Apple\s+Watch\s+)?(S\d+)/i)
    if (s) return `Apple Watch ${s[1]}`
    return n.replace(/^Apple\s+Watch\s+/i, 'Apple Watch ').split(/\d{2}\s*mm/i)[0].trim()
  }
  if (meta.type === 'airpods') {
    const base = n.replace(/^Apple\s+/i, '').replace(/Цветные\s+/i, '')
    return extractAirpodsProductKey(base)
  }
  if (meta.type === 'samsung-phone') {
    let withoutBrand = n.replace(/^Samsung\s+Galaxy\s+/i, '')
    withoutBrand = withoutBrand.replace(/\bS(\d+)\+/gi, 'S$1 Plus')
    const m = withoutBrand.match(/^(Z\s+Fold\s+\d+|S\d+\s+Ultra|S\d+\s+Plus|S\d+)/i)
    if (m) return `Galaxy ${m[1].replace(/\s+/g, ' ').trim()}`
    return withoutBrand.replace(/\s+\d+\/\d+\s*Gb?.*/i, '').trim()
  }
  if (meta.type === 'samsung-watch') {
    const m = n.match(/Watch\s+(\d+)\s+(Ultra|Classic)/i)
    if (m) return `Samsung Galaxy Watch ${m[1]} ${m[2]}`
    const m2 = n.match(/Watch\s+(\d+)\b/i)
    if (m2) return `Samsung Galaxy Watch ${m2[1]}`
    return n.replace(/^Samsung\s+Galaxy\s+/i, 'Samsung ').split(/\d{2}\s*mm/i)[0].trim()
  }
  if (meta.type === 'huawei') {
    const pura = n.match(/^HUAWEI\s+(Pura\s+\d+(?:\s+Pro)?)/i)
    if (pura) return `HUAWEI ${pura[1]}`
    const watch = n.match(/^Huawei\s+(Watch\s+Fit\s+\d+(?:\s+Pro)?)/i)
    if (watch) return `Huawei ${watch[1]}`
    const honor = n.match(/^Honor\s+(.+?)(?=\s+\d+\/\d+\s*Gb?|\s+\d+\s*Gb\b)/i)
    if (honor) return `Honor ${honor[1].trim()}`
    return n.split(/\d+\/\d+/)[0].trim()
  }
  if (meta.type === 'xiaomi') {
    return n
      .replace(/\s+\d+\/\d+\s*Gb?.*/i, '')
      .replace(/\s+\([^)]+\)\s*$/, '')
      .trim()
  }
  return n
}

function variantNameFromText(name, meta) {
  const n = String(name).trim()
  if (meta.type === 'iphone') return n.replace(/^iPhone\s+/i, '')
  if (meta.type === 'ipad') return n.replace(/^Apple\s+/i, '')
  if (meta.type === 'macbook') return n.replace(/^Apple\s+/i, '')
  if (meta.type === 'watch' || meta.type === 'watch-ultra') return n.replace(/^Apple\s+Watch\s+/i, '')
  if (meta.type === 'airpods') return n.replace(/^Apple\s+/i, '')
  if (meta.type === 'samsung-phone') return n.replace(/^Samsung\s+Galaxy\s+/i, '').replace(/\bS(\d+)\+/gi, 'S$1 Plus')
  if (meta.type === 'samsung-watch') return n.replace(/^Samsung\s+Galaxy\s+/i, '')
  if (meta.type === 'huawei') return n.replace(/^(HUAWEI|Huawei|Honor)\s+/i, '')
  return n
}

/** Чинит дюймовые кавычки вроде MacBook Neo 13" внутри JSON-строки. */
function repairJsonLine(line) {
  return line.replace(/(\d)"(?=[^,:}\]])/g, '$1\\"')
}

function parseJsonPriceLine(line) {
  let data
  try {
    data = JSON.parse(line)
  } catch {
    try {
      data = JSON.parse(repairJsonLine(line))
    } catch {
      return null
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const product = String(data.product || '').trim()
  const price = Number(data.price)
  if (!product || !Number.isFinite(price) || price < 1000) return null
  return {
    product,
    storage: data.storage == null ? '' : String(data.storage),
    color: data.color == null ? '' : String(data.color),
    sim: data.sim == null ? '' : String(data.sim),
    size: data.size == null ? '' : String(data.size),
    price,
  }
}

function looksLikeJsonLine(line) {
  return line.startsWith('{') && line.includes('"product"')
}

export function parseTextPriceLines(text, options = {}) {
  const products = options.products || []
  const entries = []
  const skipped = []
  let jsonMode = null

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\u00a0/g, ' ').trim()
    if (!line || line.startsWith('#')) continue

    if (jsonMode === null) jsonMode = looksLikeJsonLine(line)

    if (jsonMode || looksLikeJsonLine(line)) {
      const row = parseJsonPriceLine(line)
      if (!row) {
        skipped.push(line.slice(0, 120))
        continue
      }
      const section = detectSection(row.product) || detectSectionFromProducts(row.product, products)
      if (!section) {
        skipped.push(row.product)
        continue
      }
      entries.push({
        section,
        name: row.product,
        price: row.price,
        fields: {
          product: row.product,
          storage: row.storage,
          color: row.color,
          sim: row.sim,
          size: row.size,
        },
      })
      continue
    }

    // Legacy: «Название = цена»
    const eq = line.match(/^(.+?)\s*=\s*(.+)$/)
    if (!eq) {
      skipped.push(line)
      continue
    }

    const name = eq[1].trim()
    const price = parsePriceCell(eq[2])
    if (price < 1000) {
      skipped.push(line)
      continue
    }

    const section = detectSection(name) || detectSectionFromProducts(name, products)
    if (!section) {
      skipped.push(name)
      continue
    }

    entries.push({ section, name, price })
  }

  return { entries, skipped, format: jsonMode ? 'jsonl' : 'legacy' }
}

export function buildCatalogFromPriceText(text, existingProducts, markup = { percent: 15, fixed: 0 }, options = {}) {
  const { entries, skipped, format } = parseTextPriceLines(text, { products: existingProducts })
  const isJson = format === 'jsonl'
  const result = buildCatalogFromEntries(entries, existingProducts, markup, {
    pricesOnly: true,
    upsertVariants: true,
    upsertProducts: true,
    filterSections: false,
    getProductKey: (entry, meta) => {
      if (entry.fields?.product) return normalizeProductKey(entry.fields.product)
      return productKeyFromTextName(entry.name, meta)
    },
    getVariantName: (entry, meta) => variantNameFromText(entry.name, meta),
    findProduct: isJson
      ? (productName, meta, _groupEntries, productMap, products) =>
        resolveProductExact(productName, meta, productMap, products)
      : undefined,
    ...options,
  })
  result.stats.unrecognized = skipped.length
  result.stats.unrecognizedNames = [...new Set(skipped.map((s) => String(s || '').trim()).filter(Boolean))].slice(0, 40)
  result.stats.importFormat = isJson ? 'jsonl' : 'legacy'
  if (skipped.length && isJson) {
    result.stats.skippedVariantSamples = [
      ...(result.stats.skippedVariantSamples || []),
      ...result.stats.unrecognizedNames.slice(0, 8),
    ].slice(0, 12)
  }
  return result
}

/** Сколько карточек каталога попадает под каждую категорию промпта (по имени/importNames). */
export function promptCategoryProductCounts(products, categoryNames = []) {
  const names = (categoryNames.length
    ? categoryNames
    : DEFAULT_PRICE_PROMPT_CATEGORIES).map((n) => String(n || '').trim()).filter(Boolean)
  const counts = Object.fromEntries(names.map((n) => [n, 0]))

  for (const product of products || []) {
    const aliases = [
      product.name,
      ...(String(product.importNames || '').split(/[,;]+/)),
    ].map((s) => String(s || '').trim()).filter(Boolean)

    const matched = new Set()
    for (const alias of aliases) {
      const section = detectSection(alias) || detectSectionFromProducts(alias, [product])
      if (section && Object.prototype.hasOwnProperty.call(counts, section)) matched.add(section)
    }
    for (const section of matched) counts[section] += 1
  }
  return counts
}

/** Категории секций из PDF-прайса (можно дополнять в админке). */
export const DEFAULT_PRICE_PROMPT_CATEGORIES = [
  'iPhone 17 Pro Max',
  'iPhone 17 Pro',
  'iPhone 17',
  'iPhone 17 Air',
  'iPhone 16',
  'iPhone 15 / 14 / 13',
  'Apple iPad',
  'Apple MacBook',
  'Apple Watch S / SE',
  'Apple Watch Ultra',
  'Apple AirPods / Marshall',
  'Apple iPhone (обменки в коробке, не активирован)',
  'Samsung Серия Z',
  'Samsung Серия S26',
  'Samsung Серия S25',
  'Samsung Серия S25Fe',
  'Samsung Серия A',
  'Умные очки Ray Ban',
  'Аксессуары Apple Original',
  'Премиум Аксессуры Pitaka',
  'PlayStation',
  'Игры на PlayStation',
  'Яндекс Станции',
  'Xiaomi',
  'Poco',
  'Huawei',
  'Умные устройства Huawei',
  'Honor',
  'Redmi 15',
  'Наушники Китай',
  'Google',
  'Samsung Watch',
  'JBL и Marshall Колонки',
  'Samsung Buds',
  'Redmi 14',
  'OnePlus',
  'Защитные Стекла',
  'Планшеты',
  'Провода и блоки',
  'Doogee',
  'Камера',
  'Муляжи',
  'Кнопочные Телефоны',
  'Коробки и пакеты',
  'AirPods (запчасти)',
  'Микрофоны',
  'Карты Памяти',
  'USB',
  'SSD',
  'Кнопочные Телефоны Nokia',
  'Power Bank',
  'Проекторы Umiio',
  'Наушники',
  'Мини Телефоны',
  'Ноутбуки',
]

const DEFAULT_SELECTED_PROMPT_CATEGORIES = new Set([
  'iPhone 17 Pro Max',
  'iPhone 17 Pro',
  'iPhone 17',
  'iPhone 17 Air',
  'iPhone 16',
  'iPhone 15 / 14 / 13',
  'Apple iPad',
  'Apple MacBook',
  'Apple Watch S / SE',
  'Apple Watch Ultra',
  'Apple AirPods / Marshall',
  'Samsung Серия Z',
  'Samsung Серия S26',
  'Samsung Серия S25',
  'Samsung Серия S25Fe',
  'Samsung Серия A',
  'Умные очки Ray Ban',
  'Xiaomi',
  'Poco',
  'Huawei',
  'Умные устройства Huawei',
  'Honor',
  'Redmi 15',
  'Наушники Китай',
  'Google',
  'Samsung Watch',
  'JBL и Marshall Колонки',
  'Samsung Buds',
  'Redmi 14',
  'OnePlus',
  'Планшеты',
  'Наушники',
])

export function defaultPromptCategoryRows() {
  return DEFAULT_PRICE_PROMPT_CATEGORIES.map((name) => ({
    name,
    selected: DEFAULT_SELECTED_PROMPT_CATEGORIES.has(name),
  }))
}

/** Промпт для LLM: превратить PDF прайса в JSONL для импорта. */
export function buildPriceJsonlPrompt(selectedCategories = []) {
  const cats = (Array.isArray(selectedCategories) ? selectedCategories : [])
    .map((c) => String(c || '').trim())
    .filter(Boolean)
  const categoriesBlock = cats.length
    ? `Бери позиции ТОЛЬКО из этих секций/категорий прайса (остальные полностью игнорируй):\n${cats.map((c) => `- ${c}`).join('\n')}`
    : 'Если категории не указаны — извлекай все товарные позиции из прайса.'

  return `Ты извлекаешь закупочные цены из PDF-прайса поставщика (файл price.pdf или приложенный PDF) и возвращаешь ТОЛЬКО валидный JSONL — по одному JSON-объекту на строку, без markdown, без пояснений, без нумерации.

${categoriesBlock}

Схема каждой строки:
{"product":"...","storage":"...","color":"...","sim":"...","size":"...","price":12345}

Правила полей:
1) product — только имя товара/карточки, БЕЗ памяти, цвета, SIM и размера.
   Примеры правильно: "iPhone 16 Pro", "iPhone 17 Pro Max", "AirPods Pro 3", "Watch Series 11", "MacBook Neo 13\\" A18 Pro"
   Примеры неправильно: "iPhone 16 Pro Desert", "iPhone 17 256Gb Black"
2) storage — объём памяти, как в прайсе: "128Gb", "256Gb", "512Gb", "1Tb", "12/256Gb", "16/512Gb".
   Если памяти нет (наушники и т.п.) — "".
3) color — цвет/комплектация цвета. Если цвета нет — "".
4) sim — только для iPhone: "Sim+eSim", "eSim+eSim", "Dual Sim". Для остальных товаров — "".
   Если у iPhone в прайсе НЕ указана спецификация SIM/eSIM (типично для iPhone 15 и iPhone 16) — всегда пиши "Sim+eSim".
   "eSim+eSim" / "Dual Sim" ставь только когда это явно написано в строке прайса.
5) size — только для часов: "42mm", "46mm", "49mm", "40mm", "47mm". Для остальных поле можно опустить или "".
6) price — целое число в рублях без пробелов и символа ₽.

Важно:
- Дюйм в названии экрана экранируй: "MacBook Neo 13\\" A18 Pro"
- Не смешивай модели: iPhone 16 ≠ iPhone 16 Pro ≠ iPhone 16 Pro Max
- AirPods Max (2024) и AirPods Max (2026) — разные товары
- Не добавляй позиции без цены
- Не пиши ничего кроме JSONL-строк

Пример:
{"product":"iPhone 17 Pro Max","storage":"256Gb","color":"Orange","sim":"eSim+eSim","price":90000}
{"product":"iPhone 16","storage":"128Gb","color":"Teal","sim":"Sim+eSim","price":52700}
{"product":"iPhone 15","storage":"128Gb","color":"Black","sim":"Sim+eSim","price":47000}
{"product":"AirPods Pro 3","color":"","price":15800}
{"product":"Watch Series 11","size":"42mm","color":"Silver","price":26800}
`
}

/** @deprecated используйте buildPriceJsonlPrompt */
export const PRICE_JSONL_PROMPT = buildPriceJsonlPrompt(
  [...DEFAULT_SELECTED_PROMPT_CATEGORIES],
)
