/** Категории, где «Стандарт» не показываем как объём памяти */
const PHONE_CATEGORIES = new Set(['iphone', 'samsung', 'xiaomi', 'huawei'])

export function isPhoneCategory(category) {
  return PHONE_CATEGORIES.has(category)
}

export function isWatchCategory(category) {
  return category === 'apple-watch' || category === 'galaxy-watch'
}

export function isAccessoryCategory(category) {
  return category === 'airpods'
}

/** Есть ли у товара реальные объёмы памяти (не «Стандарт») — тогда UI как у телефона */
export function productUsesPhoneStorage(product) {
  if (!product || !isPhoneCategory(product.category)) return false
  const fromStorage = (product.storage || []).some((s) => isMeaningfulStorageLabel(s.label))
  if (fromStorage) return true
  return (product.variants || []).some((v) => isMeaningfulStorageLabel(v.storage))
}

export function isMeaningfulStorageLabel(label) {
  if (!label) return false
  if (label === 'Стандарт') return false
  if (/^\d+\s*(ГБ|ТБ)/i.test(label)) return true
  if (/Wi-Fi|Cellular|LTE|мм/i.test(label)) return true
  if (/\d+\/\d+/i.test(label)) return true
  return label !== 'Стандарт'
}

const GB_PER_TB = 1024

/** Число > 5 → ГБ, иначе → ТБ (для «голых» объёмов вроде 128 или 1). */
export function storageUnitForNumber(n) {
  const num = Number(n)
  if (!Number.isFinite(num) || num <= 0) return 'ГБ'
  return num > 5 ? 'ГБ' : 'ТБ'
}

function normalizeUnitToken(unit) {
  const u = String(unit || '').trim().toUpperCase().replace('ГБ', 'GB').replace('ТБ', 'TB')
  if (u === 'TB' || u === 'ТБ') return 'ТБ'
  if (u === 'GB' || u === 'ГБ') return 'ГБ'
  return ''
}

/**
 * Объём для сортировки в «гигабайтах» (1 ТБ = 1024).
 * Для Android «12/512 ГБ» берём второе число (накопитель), RAM — вторичный ключ.
 */
export function parseStorageSortKey(label) {
  const s = String(label || '').trim()
  if (!s || s === 'Стандарт') return { gb: Number.POSITIVE_INFINITY, ram: 0, raw: s }

  const combo = s.match(/(\d+)\s*\/\s*(\d+)\s*(ГБ|ТБ|GB|TB)?/i)
  if (combo) {
    const ram = Number(combo[1])
    const storageNum = Number(combo[2])
    const unit = normalizeUnitToken(combo[3]) || storageUnitForNumber(storageNum)
    const gb = unit === 'ТБ' ? storageNum * GB_PER_TB : storageNum
    return { gb, ram, raw: s }
  }

  const single = s.match(/(\d+(?:[.,]\d+)?)\s*(ГБ|ТБ|GB|TB)/i)
  if (single) {
    const storageNum = Number(String(single[1]).replace(',', '.'))
    const unit = normalizeUnitToken(single[2])
    const gb = unit === 'ТБ' ? storageNum * GB_PER_TB : storageNum
    return { gb, ram: 0, raw: s }
  }

  // Голое число без единицы — те же правила, что в админке
  const bare = s.match(/^(\d+(?:[.,]\d+)?)$/)
  if (bare) {
    const storageNum = Number(String(bare[1]).replace(',', '.'))
    const unit = storageUnitForNumber(storageNum)
    const gb = unit === 'ТБ' ? storageNum * GB_PER_TB : storageNum
    return { gb, ram: 0, raw: s }
  }

  const mm = s.match(/(\d+)\s*мм/i)
  if (mm) return { gb: Number(mm[1]), ram: 0, raw: s }

  return { gb: Number.POSITIVE_INFINITY, ram: 0, raw: s }
}

export function compareStorageLabels(a, b) {
  const ka = parseStorageSortKey(a)
  const kb = parseStorageSortKey(b)
  if (ka.gb !== kb.gb) return ka.gb - kb.gb
  if (ka.ram !== kb.ram) return ka.ram - kb.ram
  return String(a || '').localeCompare(String(b || ''), 'ru', { numeric: true })
}

export function sortStorageEntries(list) {
  return [...(list || [])].sort((a, b) => compareStorageLabels(a?.label ?? a, b?.label ?? b))
}

/**
 * Автоподпись ГБ/ТБ:
 * - «128» → «128 ГБ», «1» → «1 ТБ»
 * - «12/512» → «12/512 ГБ» (единица по накопителю)
 * Уже подписанные и не-объёмы (мм, Wi-Fi alone, Стандарт) не ломаем.
 */
export function normalizeStorageLabel(raw) {
  const original = String(raw || '').trim().replace(/\s+/g, ' ')
  if (!original) return ''
  if (/^стандарт$/i.test(original)) return 'Стандарт'
  if (/^\d+\s*мм$/i.test(original) || /^(wi-?fi|cellular|lte)$/i.test(original)) return original

  const combo = original.match(/^(\d+)\s*\/\s*(\d+)\s*(ГБ|ТБ|GB|TB)?(?:\s+(.+))?$/i)
  if (combo) {
    const ram = combo[1]
    const storageNum = Number(combo[2])
    const unit = normalizeUnitToken(combo[3]) || storageUnitForNumber(storageNum)
    const rest = (combo[4] || '').trim()
    return rest ? `${ram}/${storageNum} ${unit} ${rest}` : `${ram}/${storageNum} ${unit}`
  }

  const single = original.match(/^(\d+(?:[.,]\d+)?)\s*(ГБ|ТБ|GB|TB)?(?:\s+(.+))?$/i)
  if (single) {
    const numStr = String(single[1]).replace(',', '.')
    const storageNum = Number(numStr)
    if (!Number.isFinite(storageNum)) return original
    const unit = normalizeUnitToken(single[2]) || storageUnitForNumber(storageNum)
    const rest = (single[3] || '').trim()
    const pretty = Number.isInteger(storageNum) ? String(storageNum) : numStr
    return rest ? `${pretty} ${unit} ${rest}` : `${pretty} ${unit}`
  }

  return original
}

/** Память для отображения на сайте и в админке (без «Стандарт» у телефонов) */
export function getDisplayStorage(product) {
  const list = product.storage || []
  let visible
  if (isPhoneCategory(product.category)) {
    visible = list.filter((s) => isMeaningfulStorageLabel(s.label))
  } else if (isAccessoryCategory(product.category) && list.every((s) => s.label === 'Стандарт')) {
    visible = []
  } else {
    visible = list.filter((s) => s.label)
  }
  return sortStorageEntries(visible)
}

/** Скрывать выбор цвета, если у товара только один безымянный «Стандарт»-цвет */
export function shouldShowColorOptions(product) {
  const colors = product.colors || []
  if (colors.length > 1) return true
  if (colors.length === 1) return colors[0].name !== 'Стандарт'
  return false
}

export function shouldShowStorageOptions(product) {
  if (shouldShowSizesOptions(product)) return false
  const visible = getDisplayStorage(product)
  return visible.length > 1 || (visible.length === 1 && isMeaningfulStorageLabel(visible[0].label))
}

function variantStorageKeys(product) {
  return [...new Set(
    (product?.variants || [])
      .filter((v) => Number(v?.purchasePrice) > 0)
      .map((v) => v.storage)
      .filter(Boolean),
  )]
}

export function resolveVariantStorageLabel(product, storageIdx = 0, sizeIdx = 0) {
  const sizeLabels = getProductSizeLabels(product)
  const variantKeys = variantStorageKeys(product)

  if (sizeLabels.length) {
    const idx = Math.min(Math.max(sizeIdx ?? 0, 0), sizeLabels.length - 1)
    const sizeLabel = sizeLabels[idx] || sizeLabels[0] || ''
    const matched = variantKeys.find((s) => normalizeOptionLabel(s) === normalizeOptionLabel(sizeLabel))
    if (matched) return matched

    // В карточке есть мм, а прайс завязан на «64 ГБ» / «Стандарт» — не ломаем наличие
    if (isWatchCategory(product.category)) {
      const nonStandard = variantKeys.filter((s) => s !== 'Стандарт')
      if (nonStandard.length === 1) return nonStandard[0]
      if (variantKeys.length === 1) return variantKeys[0]
      if (variantKeys.length && variantKeys.every((s) => s === 'Стандарт')) return 'Стандарт'
    }

    return sizeLabel
  }
  if (product.sizes?.length > 1) {
    return product.sizes[sizeIdx ?? 0]?.label || ''
  }
  const visible = getDisplayStorage(product)
  if (visible.length) return visible[storageIdx]?.label || visible[0]?.label || ''
  if (product.storage?.length) return product.storage[storageIdx]?.label || product.storage[0]?.label || ''
  return 'Стандарт'
}

export function normalizeWatchSizeLabel(label) {
  const s = String(label || '').trim()
  if (!s) return ''
  if (/мм/i.test(s)) return s.replace(/\bmm\b/gi, 'мм').replace(/\s+/g, ' ').trim()
  const m = s.match(/^(\d{2})$/) || s.match(/^(\d{2})\s*mm$/i)
  if (m) return `${m[1]} мм`
  return s
}

export function normalizeOptionLabel(label) {
  return String(label || '').replace(/\s/g, '').toLowerCase().replace(/mm/g, 'мм')
}

function isWatchSizeLabel(label) {
  const s = String(label || '').trim()
  if (!s || /^стандарт$/i.test(s)) return false
  if (/\d+\s*(гб|тб|gb|tb)\b/i.test(s)) return false
  if (/^\d{2}\s*(мм|mm)$/i.test(s) || /^\d{2}$/.test(s)) return true
  return /мм|mm/i.test(s)
}

/** Размеры часов: из блока «Размеры» + мм из прайса; без ГБ/ТБ и «Стандарт» */
export function getProductSizeLabels(product) {
  const fromSizes = (product.sizes || [])
    .map((s) => normalizeWatchSizeLabel(s.label))
    .filter((l) => isWatchSizeLabel(l))

  if (!isWatchCategory(product.category)) {
    return fromSizes.length > 1 ? fromSizes : []
  }

  const fromVariants = [...new Set(
    (product.variants || [])
      .map((v) => v.storage)
      .filter((l) => isWatchSizeLabel(l))
      .map((l) => normalizeWatchSizeLabel(l)),
  )]

  const merged = [...new Set([...fromSizes, ...fromVariants])]
  const order = (a, b) => {
    const na = Number(String(a).match(/(\d+)/)?.[1] || 0)
    const nb = Number(String(b).match(/(\d+)/)?.[1] || 0)
    if (na && nb && na !== nb) return na - nb
    return a.localeCompare(b, 'ru')
  }
  return merged.sort(order)
}

export function shouldShowSizesOptions(product) {
  if (isWatchCategory(product.category) || product.category === 'galaxy-watch') {
    return getProductSizeLabels(product).length > 1
  }
  return (product.sizes?.length || 0) > 1
}
