/** Export/import helpers for admin catalog packages */

export const BACKUP_FORMAT = 'airdrop-backup-v1'
export const CATALOG_MANIFEST = 'airdrop-catalog-v1'

export function collectProductAssetPaths(products) {
  const paths = new Set()
  const add = (value) => {
    if (typeof value !== 'string') return
    const p = value.trim().replace(/^\//, '')
    if (p) paths.add(p)
  }

  for (const product of products || []) {
    add(product.image)
    add(product.coverImage)
    for (const img of product.images || []) add(img)
    for (const col of product.colors || []) add(col.image)
  }

  return [...paths].filter((p) => p.startsWith('assets/') && !p.includes('..'))
}

export function validateProductsData(data) {
  if (!data || typeof data !== 'object') throw new Error('Некорректный JSON товаров')
  if (!Array.isArray(data.products)) throw new Error('Нет поля products')
  data.products.forEach((p, i) => {
    if (!p || typeof p !== 'object') throw new Error(`Товар #${i + 1}: некорректная запись`)
    if (!String(p.name || '').trim()) throw new Error(`Товар #${i + 1}: нет названия`)
    if (!String(p.category || '').trim()) throw new Error(`Товар «${p.name}»: нет категории`)
    if (!Array.isArray(p.colors) || !p.colors.length) {
      throw new Error(`Товар «${p.name}»: нужен хотя бы один цвет`)
    }
  })
  return data
}

export function validateStoreData(data) {
  if (!data || typeof data !== 'object') throw new Error('Некорректный JSON настроек')
  if (!data.settings || typeof data.settings !== 'object') {
    throw new Error('Нет поля settings в store.json')
  }
  return data
}

export function validateBackupData(data) {
  if (!data || data.format !== BACKUP_FORMAT) {
    throw new Error(`Ожидается format: ${BACKUP_FORMAT}`)
  }
  validateStoreData(data.store)
  validateProductsData(data.products)
  return data
}

export function sanitizeStoreForExport(store) {
  const copy = structuredClone(store)
  delete copy.adminPassword
  return copy
}

export function buildBackupPayload(store, products) {
  return {
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    store: sanitizeStoreForExport(store),
    products: validateProductsData(structuredClone(products)),
  }
}

export function nextProductId(products) {
  const max = products.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0)
  return max + 1
}

export function normalizeImportedProduct(product, fallbackId) {
  const p = structuredClone(product)
  p.id = Number(p.id) || fallbackId
  p.slug = String(p.slug || '').trim() || `product-${p.id}`
  p.name = String(p.name || '').trim()
  p.category = String(p.category || '').trim()
  p.colors = Array.isArray(p.colors) ? p.colors : []
  p.images = Array.isArray(p.images) ? p.images : []
  p.variants = Array.isArray(p.variants) ? p.variants : []
  p.stock = Array.isArray(p.stock) ? p.stock : []
  if (!p.image && p.images[0]) p.image = p.images[0]
  if (!p.coverImage && p.image) p.coverImage = p.image
  return p
}

export function mergeProducts(existing, incoming, mode = 'merge') {
  const validated = validateProductsData(incoming)

  if (mode === 'replace') {
    let id = 1
    return {
      products: validated.products.map((p) => normalizeImportedProduct(p, id++)),
    }
  }

  const result = existing.products.map((p) => structuredClone(p))
  const byId = new Map(result.map((p) => [p.id, p]))
  const bySlug = new Map(result.filter((p) => p.slug).map((p) => [p.slug, p]))

  for (const raw of validated.products) {
    const slug = String(raw.slug || '').trim()
    const existingMatch = (raw.id && byId.get(raw.id)) || (slug && bySlug.get(slug))
    const id = existingMatch?.id ?? nextProductId(result)
    const normalized = normalizeImportedProduct(
      existingMatch ? { ...existingMatch, ...raw, id: existingMatch.id } : raw,
      id,
    )
    if (existingMatch) {
      const idx = result.findIndex((p) => p.id === existingMatch.id)
      result[idx] = normalized
      byId.set(normalized.id, normalized)
      if (normalized.slug) bySlug.set(normalized.slug, normalized)
    } else {
      result.push(normalized)
      byId.set(normalized.id, normalized)
      if (normalized.slug) bySlug.set(normalized.slug, normalized)
    }
  }

  return { products: result }
}

export function summarizeProducts(products) {
  const list = products?.products || products || []
  const withPhotos = list.filter((p) =>
    p.image
    || (p.images?.length)
    || p.colors?.some((c) => c.image),
  ).length
  return {
    count: list.length,
    withPhotos,
    assets: collectProductAssetPaths(list).length,
  }
}
