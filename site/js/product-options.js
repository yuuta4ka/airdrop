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

/** Память для отображения на сайте и в админке (без «Стандарт» у телефонов) */
export function getDisplayStorage(product) {
  const list = product.storage || []
  if (isPhoneCategory(product.category)) {
    return list.filter((s) => isMeaningfulStorageLabel(s.label))
  }
  if (isAccessoryCategory(product.category) && list.every((s) => s.label === 'Стандарт')) {
    return []
  }
  return list.filter((s) => s.label)
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

export function resolveVariantStorageLabel(product, storageIdx = 0, sizeIdx = 0) {
  const sizeLabels = getProductSizeLabels(product)
  if (sizeLabels.length) {
    const idx = Math.min(Math.max(sizeIdx ?? 0, 0), sizeLabels.length - 1)
    return sizeLabels[idx] || sizeLabels[0] || ''
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

/** Размеры часов: из блока «Размеры» + из прайса (variants.storage) */
export function getProductSizeLabels(product) {
  const fromSizes = (product.sizes || [])
    .map((s) => normalizeWatchSizeLabel(s.label))
    .filter(Boolean)

  if (!isWatchCategory(product.category) && product.category !== 'galaxy-watch') {
    return fromSizes.length > 1 ? fromSizes : []
  }

  const fromVariants = [...new Set(
    (product.variants || [])
      .map((v) => v.storage)
      .filter((l) => l && (l === 'Стандарт' || /мм|mm/i.test(l)))
      .map((l) => normalizeWatchSizeLabel(l)),
  )]

  const merged = [...new Set([...fromSizes, ...fromVariants])]
  const order = (a, b) => {
    const na = Number(String(a).match(/(\d+)/)?.[1] || 0)
    const nb = Number(String(b).match(/(\d+)/)?.[1] || 0)
    if (na && nb && na !== nb) return na - nb
    if (a === 'Стандарт') return 1
    if (b === 'Стандарт') return -1
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
