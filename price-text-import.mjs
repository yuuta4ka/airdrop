import { CATALOG_SECTIONS } from './price-pdf-parser.mjs'
import { buildCatalogFromEntries } from './price-pdf-catalog.mjs'

function parsePriceCell(cell) {
  const digits = String(cell ?? '').replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function detectSection(name) {
  const n = String(name).trim()
  if (/^iPhone\s+17\s+Pro\s+Max/i.test(n)) return 'iPhone 17 Pro Max'
  if (/^iPhone\s+17\s+Pro/i.test(n)) return 'iPhone 17 Pro'
  if (/^iPhone\s+17/i.test(n)) return 'iPhone 17'
  if (/^iPhone\s+16/i.test(n)) return 'iPhone 16'
  if (/^iPhone\s+15/i.test(n)) return 'iPhone 16'
  if (/^Apple\s+iPad/i.test(n)) return 'Apple iPad'
  if (/^Apple\s+Mac/i.test(n)) return 'Apple MacBook'
  if (/^Apple\s+Watch\s+Ultra/i.test(n)) return 'Apple Watch Ultra'
  if (/^Apple\s+Watch/i.test(n)) return 'Apple Watch S / SE'
  if (/^Apple\s+AirPods|^Marshall/i.test(n)) return 'Apple AirPods / Marshall'
  if (/^Samsung\s+Galaxy\s+Z/i.test(n)) return 'Samsung Серия Z'
  if (/^Samsung\s+Galaxy\s+S26/i.test(n)) return 'Samsung Серия S26'
  if (/^Samsung\s+Galaxy\s+S25/i.test(n)) return 'Samsung Серия S25'
  if (/^Samsung\s+Galaxy\s+Watch/i.test(n)) return 'Samsung Watch'
  if (/^(Redmi|Poco|OnePlus|Xiaomi)\b/i.test(n)) return 'Xiaomi'
  if (/^Huawei\s+Watch/i.test(n)) return 'Умные устройства Huawei'
  if (/^(HUAWEI|Huawei|Honor)\b/i.test(n)) return 'Huawei'
  return null
}

function productKeyFromTextName(name, meta) {
  const n = String(name).trim()
  if (meta.type === 'iphone') {
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
    if (/^Apple\s+Watch\s+SE/i.test(n)) return 'Apple Watch SE'
    const s = n.match(/^Apple\s+Watch\s+(S\d+)/i)
    if (s) return `Apple Watch ${s[1]}`
    return n.replace(/^Apple\s+Watch\s+/i, 'Apple Watch ').split(/\d{2}\s*mm/i)[0].trim()
  }
  if (meta.type === 'airpods') {
    const base = n.replace(/^Apple\s+/i, '')
    const m = base.match(/^(AirPods(?:\s+Pro)?(?:\s+Max)?(?:\s+USB-C)?(?:\s*\(\d{4}\))?|AirPods\s+Pro\s+\d+|AirPods\s+\d+(?:\s+ANC)?|Marshall\s+Major\s+\d+)/i)
    if (m) return m[1].trim()
    return base.split(/\s+(?:Midnight|Purple|Starlight|Orange|Black|White|Blue|Brown|Cream)\s*$/i)[0].trim()
  }
  if (meta.type === 'samsung-phone') {
    const withoutBrand = n.replace(/^Samsung\s+Galaxy\s+/i, '')
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
    const honor = n.match(/^Honor\s+(\S+(?:\s+\S+)?)/i)
    if (honor) return `Honor ${honor[1].replace(/\s+\d+\/\d+\s*Gb?.*/i, '').trim()}`
    return n.split(/\d+\/\d+/)[0].trim()
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
  if (meta.type === 'samsung-phone') return n.replace(/^Samsung\s+Galaxy\s+/i, '')
  if (meta.type === 'samsung-watch') return n.replace(/^Samsung\s+Galaxy\s+/i, '')
  if (meta.type === 'huawei') return n.replace(/^(HUAWEI|Huawei|Honor)\s+/i, '')
  return n
}

export function parseTextPriceLines(text) {
  const entries = []
  const skipped = []

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\u00a0/g, ' ').trim()
    if (!line || line.startsWith('#')) continue

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

    const section = detectSection(name)
    if (!section) {
      skipped.push(name)
      continue
    }

    entries.push({ section, name, price })
  }

  return { entries, skipped }
}

export function buildCatalogFromPriceText(text, existingProducts, markup = { percent: 15, fixed: 0 }, options = {}) {
  const { entries, skipped } = parseTextPriceLines(text)
  const result = buildCatalogFromEntries(entries, existingProducts, markup, {
    pricesOnly: true,
    filterSections: false,
    getProductKey: (entry, meta) => productKeyFromTextName(entry.name, meta),
    getVariantName: (entry, meta) => variantNameFromText(entry.name, meta),
    ...options,
  })
  result.stats.unrecognized = skipped.length
  return result
}
