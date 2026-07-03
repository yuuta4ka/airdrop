/** Парсинг текста прайса THLS (3 колонки, табы) */

const SKIP_LINE = /^(Прайс THLS|ОПТОВЫЙ|Цены указаны|Сформировано|\+7 \(|Наименование\s|Условия продажи|Обмен и возврат|Правила гарантий|• |— Google —|-- \d)/i

export function isSectionHeader(text) {
  return /^—\s*.+\s*—$/.test(String(text).trim())
}

export function parseSectionName(text) {
  return String(text).trim().replace(/^—\s*/, '').replace(/\s*—$/, '').trim()
}

export function parsePriceCell(cell) {
  const digits = String(cell ?? '').replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

export function looksLikePriceCell(cell) {
  const s = String(cell ?? '').trim()
  if (!s) return false
  if (/₽|руб\.?/i.test(s)) return true
  return /^\d[\d\s]{2,}$/.test(s)
}

export function isProductPriceCell(cell) {
  if (!looksLikePriceCell(cell)) return false
  const n = parsePriceCell(cell)
  return n >= 1000
}

function looksLikePriceName(name) {
  return looksLikePriceCell(name)
}

function normalizeLine(line) {
  return String(line ?? '').replace(/\u00a0/g, ' ').trim()
}

const SKIP_PRODUCT = /^(Чехол|Пылесос|Стайлер|Диск |Геймпад|Пакет|Коробк|Муляж|Gl-|USB-|Adapter|Наушники Apple|Lightning|Картхолдер|Зарядка|Сумка|Гравировка|Клавиатура|Magic Mouse|Apple Power Adapter|Apple Pencil|Apple AirTag|Mini Phone|Mini телефон|Iphone 16 Mini|Land Rover|Nokia|Vertu|Senior|F\+|Mobile |NoviSea|UNIWA|Кнопочный|Проектор|Power Bank|HDD |Sandisk|SanDisk|Benks|Momax|Планшет |OnePlus|Redmi A|Redmi Note|Honor |Poco |Яндекс |Playstation|Sony PS|JBL |Dyson|It Takes|Фитнес|Фотоаппарат|GoPro|DJI |Экшн|Стилус|SUPGLASS|OpenRun|Ухо |Кейс |Портативная|Вентилятор|Дисковод|PlayStation DualSens|DOBE|Hot Wheels|Камера |Doogee|DK10|Air pods Pro 2 Lux|Выпрямитель)/i

function shouldSkipProduct(name) {
  return SKIP_PRODUCT.test(String(name).trim())
}

function sectionColumnForHeader(parts, priceIndices, index) {
  let col = priceIndices.filter((pi) => pi < index).length
  if (index > 0 && isSectionHeader(parts[index - 1])) col += 1
  return Math.min(col, 2)
}

/** Извлекает все позиции: { section, name, price, country, column } */
export function extractPriceEntries(text) {
  const lines = text.split(/\r?\n/)
  const entries = []
  const sections = ['', '', '']

  for (const raw of lines) {
    const line = normalizeLine(raw)
    if (!line || SKIP_LINE.test(line)) continue
    if (line.includes('Условия продажи')) break

    const parts = line.split('\t').map((p) => p.trim())
    const nonEmpty = parts.filter(Boolean)
    const allHeaders = nonEmpty.length > 0 && nonEmpty.every((p) => isSectionHeader(p))

    if (allHeaders) {
      nonEmpty.slice(0, 3).forEach((h, idx) => {
        sections[idx] = parseSectionName(h)
      })
      continue
    }

    const priceIndices = []
    for (let i = 1; i < parts.length; i++) {
      const prev = parts[i - 1]
      if (!prev || isSectionHeader(prev)) continue
      if (isProductPriceCell(parts[i])) priceIndices.push(i)
    }

    for (let i = 0; i < parts.length; i++) {
      if (!isSectionHeader(parts[i])) continue
      const col = priceIndices.length
        ? sectionColumnForHeader(parts, priceIndices, i)
        : Math.min(i, 2)
      sections[col] = parseSectionName(parts[i])
    }

    for (let p = 0; p < priceIndices.length; p++) {
      const priceIdx = priceIndices[p]
      const name = parts[priceIdx - 1]
      const price = parsePriceCell(parts[priceIdx])
      if (price < 1000 || shouldSkipProduct(name) || looksLikePriceName(name)) continue

      const col = Math.min(p, 2)
      const next = parts[priceIdx + 1]
      const country = next && !isProductPriceCell(next) && !isSectionHeader(next) ? next : null

      entries.push({
        section: sections[col],
        name,
        price,
        country,
        column: col,
      })
    }
  }

  return entries
}

/** Секции, которые импортируем в каталог */
export const CATALOG_SECTIONS = new Map([
  ['iPhone 17 Pro Max', { category: 'iphone', productName: 'iPhone 17 Pro Max', brand: 'Apple', type: 'iphone' }],
  ['iPhone 17 Pro', { category: 'iphone', productName: 'iPhone 17 Pro', brand: 'Apple', type: 'iphone' }],
  ['iPhone 17', { category: 'iphone', productName: 'iPhone 17', brand: 'Apple', type: 'iphone' }],
  ['iPhone 16', { category: 'iphone', productName: 'iPhone 16', brand: 'Apple', type: 'iphone' }],
  ['Apple iPad', { category: 'ipad', brand: 'Apple', type: 'ipad' }],
  ['Apple MacBook', { category: 'macbook', brand: 'Apple', type: 'macbook' }],
  ['Apple Watch S / SE', { category: 'apple-watch', brand: 'Apple', type: 'watch' }],
  ['Apple Watch Ultra', { category: 'apple-watch', brand: 'Apple', type: 'watch-ultra' }],
  ['Apple AirPods / Marshall', { category: 'airpods', brand: 'Apple', type: 'airpods' }],
  ['Samsung Watch', { category: 'galaxy-watch', brand: 'Samsung', type: 'samsung-watch' }],
  ['Samsung Серия Z', { category: 'samsung', brand: 'Samsung', type: 'samsung-phone' }],
  ['Samsung Серия S26', { category: 'samsung', brand: 'Samsung', type: 'samsung-phone' }],
  ['Samsung Серия S25', { category: 'samsung', brand: 'Samsung', type: 'samsung-phone' }],
  ['Xiaomi', { category: 'xiaomi', brand: 'Xiaomi', type: 'xiaomi' }],
  ['Huawei', { category: 'huawei', brand: 'Huawei', type: 'huawei' }],
  ['Умные устройства Huawei', { category: 'huawei', brand: 'Huawei', type: 'huawei' }],
  ['Samsung Buds', { category: 'airpods', brand: 'Samsung', type: 'airpods' }],
  ['Ray Ban Meta', { category: 'airpods', brand: 'Ray-Ban', type: 'airpods' }],
  ['Google Fitbit', { category: 'airpods', brand: 'Google', type: 'airpods' }],
])

const SECTION_ALIASES = new Map([
  ['умные устройства huawei', 'Умные устройства Huawei'],
])

export function resolveCatalogSection(section) {
  const key = String(section || '').trim()
  if (CATALOG_SECTIONS.has(key)) return key
  const alias = SECTION_ALIASES.get(key.toLowerCase())
  return alias && CATALOG_SECTIONS.has(alias) ? alias : key
}

export function filterCatalogEntries(entries) {
  return entries
    .map((e) => ({ ...e, section: resolveCatalogSection(e.section) }))
    .filter((e) => CATALOG_SECTIONS.has(e.section))
}
