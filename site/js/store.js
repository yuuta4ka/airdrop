import {
  usesSupplierPricing, findVariant, getOrderableVariants,
  calcRetailFromPurchase, recalcAllVariants,
} from './pricing.js'

let storeCache = null
let productsCache = null

function showOfflineBanner() {
  if (document.getElementById('site-offline-banner')) return
  const banner = document.createElement('div')
  banner.id = 'site-offline-banner'
  banner.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#0a0f0d;color:#eef2ef;padding:24px;text-align:center;font-family:Inter,sans-serif;'
  banner.innerHTML = `
    <div>
      <h1 style="margin-bottom:12px;font-size:1.4rem">Сайт нужно открыть через сервер</h1>
      <p style="color:#8a9a90;margin-bottom:16px;line-height:1.6">
        Запустите в терминале:<br><code style="background:#1c2420;padding:4px 8px;border-radius:6px">bash dev.sh</code><br>
        Затем откройте <a href="http://localhost:8080" style="color:#5d9469">http://localhost:8080</a>
      </p>
    </div>
  `
  document.body.appendChild(banner)
}

function mergeStoreData() {
  const products = Array.isArray(productsCache?.products)
    ? productsCache.products
    : Array.isArray(storeCache?.products)
      ? storeCache.products
      : []
  const merged = { ...storeCache, products }
  return merged
}

export async function loadStore() {
  if (storeCache && productsCache) {
    return mergeStoreData()
  }
  let sRes, pRes
  try {
    ;[sRes, pRes] = await Promise.all([
      fetch('/api/store'),
      fetch('/api/products'),
    ])
  } catch {
    showOfflineBanner()
    throw new Error('Сервер не запущен')
  }
  if (!sRes.ok || !pRes.ok) {
    showOfflineBanner()
    throw new Error('Не удалось загрузить данные')
  }
  storeCache = await sRes.json()
  productsCache = await pRes.json()
  return mergeStoreData()
}

export async function loadProductsOnly() {
  if (productsCache) return productsCache
  const res = await fetch('/api/products')
  if (!res.ok) throw new Error('Не удалось загрузить товары')
  productsCache = await res.json()
  return productsCache
}

export function invalidateStore() {
  storeCache = null
  productsCache = null
}

export function getProductById(store, id) {
  return store.products.find((p) => p.id === Number(id))
}

export function calcPrice(product, colorIdx = 0, storageIdx = 0, sizeIdx = 0, simType = null) {
  const color = product.colors?.[colorIdx]
  const storage = product.storage?.[storageIdx]
  const storageLabel = product.sizes?.length > 1
    ? product.sizes[sizeIdx ?? 0]?.label
    : storage?.label

  if (usesSupplierPricing(product) && color && storageLabel) {
    const variant = findVariant(product, color.id, storageLabel, simType)
    return variant?.price ?? 0
  }

  if (!usesSupplierPricing(product)) {
    let price = 0
    if (product.sizes?.length > 1) {
      price = product.sizes[sizeIdx ?? 0]?.price ?? 0
    } else {
      price = storage?.price ?? 0
    }
    return price
  }

  return 0
}

export function getMinPrice(product) {
  if (usesSupplierPricing(product)) {
    const prices = getOrderableVariants(product).map((v) => v.price).filter((p) => p > 0)
    return prices.length ? Math.min(...prices) : 0
  }

  const simTypes = product.simTypes?.length ? product.simTypes : [null]
  let min = Infinity

  product.colors?.forEach((_, ci) => {
    product.storage?.forEach((_, si) => {
      if (product.sizes?.length > 1) {
        product.sizes.forEach((_, zi) => {
          simTypes.forEach((sim) => {
            const p = calcPrice(product, ci, si, zi, sim)
            if (p > 0 && p < min) min = p
          })
        })
      } else {
        simTypes.forEach((sim) => {
          const p = calcPrice(product, ci, si, 0, sim)
          if (p > 0 && p < min) min = p
        })
      }
    })
  })

  return min === Infinity ? 0 : min
}

export { usesSupplierPricing, findVariant, getOrderableVariants, calcRetailFromPurchase, recalcAllVariants } from './pricing.js'
export { isComboOrderable, isComboUnavailable, isOptionUnavailable, getAvailableOptions, roundPriceTo900, recalcVariantPrice, getMarkupSettings } from './pricing.js'

export function formatPrice(price) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(price)
}

export function badgeClass(badge) {
  if (badge === 'Скидка') return 'product-card__badge product-card__badge--sale'
  if (badge === 'Премиум') return 'product-card__badge product-card__badge--premium'
  if (badge === 'В наличии') return 'product-card__badge product-card__badge--stock'
  return 'product-card__badge'
}

export function makeCartKey(productId, colorId, storageLabel, sizeLabel, simType) {
  return `${productId}|${colorId}|${storageLabel}|${sizeLabel || ''}|${simType || ''}`
}

export function getAllProductImages(product) {
  const merged = []
  const add = (img) => {
    if (img && !merged.includes(img)) merged.push(img)
  }

  add(product.coverImage)

  if (product.images?.length) {
    product.images.forEach(add)
  } else if (product.image) {
    add(product.image)
  }

  product.colors?.forEach((color) => {
    add(color.image)
    color.images?.forEach(add)
  })

  return merged.length ? merged : ['assets/logo.png']
}

export function findColorIndexByImage(product, image) {
  if (!image || !product.colors?.length) return -1
  return product.colors.findIndex((c) =>
    c.image === image || c.images?.includes(image),
  )
}

export function getInitialColorIndex(product) {
  const coverIdx = findColorIndexByImage(product, product.coverImage)
  if (coverIdx >= 0) return coverIdx
  const imageIdx = findColorIndexByImage(product, product.image)
  if (imageIdx >= 0) return imageIdx
  return 0
}

/** Фото для карточки товара: сначала выбранный цвет, затем остальная галерея */
export function getProductImages(product, colorIdx = 0) {
  const all = getAllProductImages(product)
  const color = product.colors?.[colorIdx]
  if (!color?.image) return all

  const prioritized = [color.image]
  const add = (img) => {
    if (img && !prioritized.includes(img)) prioritized.push(img)
  }
  color.images?.forEach(add)
  all.forEach(add)
  return prioritized
}

/** Превью в каталоге — всегда главное фото */
export function getProductImage(product, colorIdx = 0) {
  if (product.coverImage) return product.coverImage
  if (product.image) return product.image
  const color = product.colors?.[colorIdx]
  if (color?.image) return color.image
  return getAllProductImages(product)[0]
}

export function getStockForVariant(product, colorId, simType, storageLabel) {
  if (!product.stock?.length) return null
  return product.stock.find((s) => {
    if (s.colorId !== colorId || s.qty <= 0) return false
    if (simType && s.simType && s.simType !== simType) return false
    if (storageLabel && s.storageLabel && s.storageLabel !== storageLabel) return false
    return true
  }) || null
}

export function getInStockItems(product) {
  if (!product.stock?.length) return []
  return product.stock.filter((s) => s.qty > 0)
}

export function hasAnyStock(product) {
  return product.stock?.some((s) => s.qty > 0)
}

export const CATALOG_MODE_KEY = 'airdrop_catalog_mode'

export function getCatalogMode() {
  return sessionStorage.getItem(CATALOG_MODE_KEY) || 'new'
}

export function setCatalogMode(mode) {
  sessionStorage.setItem(CATALOG_MODE_KEY, mode)
}

export function isCatalogPage() {
  const path = window.location.pathname.replace(/\.html$/, '')
  return path === '/catalog' || path.endsWith('/catalog')
}
