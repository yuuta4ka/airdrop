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

export function getOrderableVariants(product) {
  if (!product?.variants?.length) return []
  return product.variants.filter((v) => Number(v.purchasePrice) > 0 && Number(v.price) > 0)
}

export function isComboOrderable(product, colorId, storageLabel, simType = null) {
  if (!usesSupplierPricing(product)) return true
  return Boolean(findVariant(product, colorId, storageLabel, simType))
}

/** Есть ли у поставщика эта комбинация (для подсветки недоступных кнопок) */
export function isComboUnavailable(product, colorId, storageLabel, simType = null) {
  if (!usesSupplierPricing(product)) return false
  return !findVariant(product, colorId, storageLabel, simType)
}

export function isOptionUnavailable(product, type, value, selected = {}) {
  if (!usesSupplierPricing(product)) return false

  const variants = getOrderableVariants(product)
  if (!variants.length) return true

  const matches = (v, partial) => {
    if (partial.colorId && v.colorId !== partial.colorId) return false
    if (partial.storage && v.storage !== partial.storage) return false
    if (partial.simType !== undefined && partial.simType !== null && (v.simType || '') !== (partial.simType || '')) return false
    return true
  }

  const partial = { ...selected }
  if (type === 'color') partial.colorId = value
  if (type === 'storage') partial.storage = value
  if (type === 'sim') partial.simType = value

  return !variants.some((v) => matches(v, partial))
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
