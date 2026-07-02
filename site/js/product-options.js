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

export function shouldShowStorageOptions(product) {
  if (product.sizes?.length > 1) return false
  const visible = getDisplayStorage(product)
  return visible.length > 1 || (visible.length === 1 && isMeaningfulStorageLabel(visible[0].label))
}

export function shouldShowSizesOptions(product) {
  return product.sizes?.length > 1
}

export function shouldShowSimOptions(product) {
  return product.simTypes?.length > 0
}
