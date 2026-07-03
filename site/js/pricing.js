/** Округление розничной цены до …900 (123600 → 123900) */
export function roundPriceTo900(price) {
  const n = Number(price) || 0
  if (n <= 0) return 0
  return Math.ceil((n - 900) / 1000) * 1000 + 900
}

/**
 * Розница из закупки.
 * markup: { percent?: number, fixed?: number }
 */
export function calcRetailFromPurchase(purchasePrice, markup = {}) {
  const base = Number(purchasePrice) || 0
  if (base <= 0) return 0
  const percent = Number(markup.percent ?? markup.markupPercent ?? 0) || 0
  const fixed = Number(markup.fixed ?? markup.markupFixed ?? 0) || 0
  const raw = base * (1 + percent / 100) + fixed
  return roundPriceTo900(raw)
}

export function getMarkupSettings(product, variant = null) {
  return {
    percent: variant?.markupPercent ?? product?.markupPercent ?? 0,
    fixed: variant?.markupFixed ?? product?.markupFixed ?? 0,
  }
}

export function usesSupplierPricing(product) {
  return Boolean(product?.variants?.length)
}

export function findVariant(product, colorId, storageLabel, simType = null) {
  if (!product?.variants?.length) return null
  return product.variants.find((v) =>
    v.colorId === colorId &&
    v.storage === storageLabel &&
    (simType ? v.simType === simType : !v.simType) &&
    Number(v.purchasePrice) > 0
  ) || null
}

export function getStockForVariant(product, colorId, simType, storageLabel) {
  if (!product?.stock?.length) return null
  return product.stock.find((s) => {
    if (s.colorId !== colorId || s.qty <= 0) return false
    if (simType && s.simType && s.simType !== simType) return false
    if (storageLabel && s.storageLabel && s.storageLabel !== storageLabel) return false
    return true
  }) || null
}

export function hasPhysicalStock(product, colorId, storageLabel, simType = null) {
  return Boolean(getStockForVariant(product, colorId, simType, storageLabel)?.qty)
}

function stockMatchesPartial(stock, partial) {
  if (!stock?.qty) return false
  if (partial.colorId && stock.colorId !== partial.colorId) return false
  if (partial.storage && stock.storageLabel && stock.storageLabel !== partial.storage) return false
  if (partial.simType !== undefined && partial.simType !== null && stock.simType && stock.simType !== partial.simType) {
    return false
  }
  return true
}

export function hasStockMatching(product, partial) {
  if (!product?.stock?.length) return false
  return product.stock.some((s) => stockMatchesPartial(s, partial))
}

/** Цена для позиции в наличии без строки в прайсе поставщика */
export function getStockFallbackPrice(product, colorId, storageLabel, simType = null) {
  const stock = getStockForVariant(product, colorId, simType, storageLabel)
  if (stock?.price > 0) return stock.price

  const sameStorage = getOrderableVariants(product).filter((v) => v.storage === storageLabel && v.price > 0)
  if (sameStorage.length) return Math.min(...sameStorage.map((v) => v.price))

  const sameColor = getOrderableVariants(product).filter((v) => v.colorId === colorId && v.price > 0)
  if (sameColor.length) return Math.min(...sameColor.map((v) => v.price))

  const all = getOrderableVariants(product).filter((v) => v.price > 0)
  return all.length ? Math.min(...all.map((v) => v.price)) : 0
}

export function getOrderableVariants(product) {
  if (!product?.variants?.length) return []
  return product.variants.filter((v) => Number(v.purchasePrice) > 0 && Number(v.price) > 0)
}

export function hasAnyPurchasePrice(product) {
  return (product?.variants || []).some((v) => Number(v.purchasePrice) > 0)
}

export function isComboOrderable(product, colorId, storageLabel, simType = null) {
  if (!usesSupplierPricing(product)) return true
  if (findVariant(product, colorId, storageLabel, simType)) return true
  return hasPhysicalStock(product, colorId, storageLabel, simType)
}

/** Есть ли у поставщика эта комбинация (для подсветки недоступных кнопок) */
export function isComboUnavailable(product, colorId, storageLabel, simType = null) {
  if (!usesSupplierPricing(product)) return false
  if (findVariant(product, colorId, storageLabel, simType)) return false
  if (hasPhysicalStock(product, colorId, storageLabel, simType)) return false
  return true
}

export function isOptionUnavailable(product, type, value, selected = {}) {
  if (!usesSupplierPricing(product)) return false

  const variants = getOrderableVariants(product)
  const partial = { ...selected }
  if (type === 'color') partial.colorId = value
  if (type === 'storage') partial.storage = value
  if (type === 'sim') partial.simType = value

  const matches = (v, p) => {
    if (p.colorId && v.colorId !== p.colorId) return false
    if (p.storage && v.storage !== p.storage) return false
    if (p.simType !== undefined && p.simType !== null && (v.simType || '') !== (p.simType || '')) return false
    return true
  }

  if (variants.some((v) => matches(v, partial))) return false
  if (hasStockMatching(product, partial)) return false

  if (!variants.length && !product.stock?.length) return true
  return true
}

export function recalcVariantPrice(variant, product) {
  const markup = getMarkupSettings(product, variant)
  if (Number(variant.purchasePrice) > 0) {
    variant.price = calcRetailFromPurchase(variant.purchasePrice, markup)
  }
  return variant
}

export function recalcAllVariants(product) {
  if (!product.variants?.length) return product
  product.variants.forEach((v) => recalcVariantPrice(v, product))
  return product
}

export function getAvailableOptions(product, selected = {}) {
  const orderable = getOrderableVariants(product)
  if (!orderable.length) {
    return {
      colorIds: product.colors?.map((c) => c.id) || [],
      storageLabels: product.storage?.map((s) => s.label) || [],
      simTypes: product.simTypes?.length ? product.simTypes : [null],
    }
  }

  const matches = (v, partial) => {
    if (partial.colorId && v.colorId !== partial.colorId) return false
    if (partial.storage && v.storage !== partial.storage) return false
    if (partial.simType !== undefined && partial.simType !== null && (v.simType || '') !== (partial.simType || '')) return false
    return true
  }

  const unique = (values) => [...new Set(values.filter(Boolean))]

  return {
    colorIds: unique(orderable.filter((v) => matches(v, { storage: selected.storage, simType: selected.simType })).map((v) => v.colorId)),
    storageLabels: unique(orderable.filter((v) => matches(v, { colorId: selected.colorId, simType: selected.simType })).map((v) => v.storage)),
    simTypes: unique(orderable.filter((v) => matches(v, { colorId: selected.colorId, storage: selected.storage })).map((v) => v.simType || null)),
  }
}
