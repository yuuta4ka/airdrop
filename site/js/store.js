import {
  usesSupplierPricing, findVariant, getOrderableVariants, hasAnyPurchasePrice,
  calcRetailFromPurchase, recalcAllVariants, getStockFallbackPrice,
  getStockForVariant, hasPhysicalStock, isComboOrderable,
} from './pricing.js'
import { getDisplayStorage, getProductSizeLabels, resolveVariantStorageLabel } from './product-options.js'

const DEFAULT_CATEGORY_LABELS = {
  all: 'Все',
  iphone: 'iPhone',
  ipad: 'iPad',
  macbook: 'MacBook',
  'apple-watch': 'Apple Watch',
  airpods: 'AirPods',
  samsung: 'Samsung',
  xiaomi: 'Xiaomi',
  'galaxy-watch': 'Galaxy Watch',
  huawei: 'Huawei',
}

function applyCategoryDefaults(store) {
  store?.categories?.forEach((cat) => {
    if (!String(cat.label || '').trim() && DEFAULT_CATEGORY_LABELS[cat.id]) {
      cat.label = DEFAULT_CATEGORY_LABELS[cat.id]
    }
  })
}

let storeCache = null
let productsCache = null

const SESSION_CACHE_KEY = 'airdrop:catalog-cache:v1'
const SESSION_CACHE_TTL_MS = 300_000

function readSessionCache() {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.store || !parsed?.products || !parsed?.ts) return null
    if (Date.now() - parsed.ts > SESSION_CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeSessionCache(store, products) {
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      store,
      products,
      ts: Date.now(),
    }))
  } catch {
    /* quota / private mode — ignore */
  }
}

function clearSessionCache() {
  try {
    sessionStorage.removeItem(SESSION_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

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
  applyCategoryDefaults(merged)
  return merged
}

export async function loadStore() {
  if (storeCache && productsCache) {
    return mergeStoreData()
  }

  const cached = readSessionCache()
  if (cached) {
    storeCache = cached.store
    productsCache = cached.products
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
  writeSessionCache(storeCache, productsCache)
  return mergeStoreData()
}

export async function loadProductsOnly() {
  if (productsCache) return productsCache
  const cached = readSessionCache()
  if (cached?.products) {
    productsCache = cached.products
    if (cached.store) storeCache = cached.store
    return productsCache
  }
  const res = await fetch('/api/products')
  if (!res.ok) throw new Error('Не удалось загрузить товары')
  productsCache = await res.json()
  if (storeCache) writeSessionCache(storeCache, productsCache)
  return productsCache
}

export function invalidateStore() {
  storeCache = null
  productsCache = null
  clearSessionCache()
}

export function getProductById(store, id) {
  return store.products.find((p) => p.id === Number(id))
}

export function getProductSlug(product) {
  const slug = String(product?.slug || '').trim()
  if (slug) return slug
  return product?.id != null ? `product-${product.id}` : ''
}

export function getProductBySlug(store, slug) {
  const key = decodeURIComponent(String(slug || '')).trim().toLowerCase()
  if (!key) return null
  return store.products.find((p) => getProductSlug(p).toLowerCase() === key) || null
}

/** Компактный параметр памяти для URL: 256gb, 1tb, 12-512gb */
export function compactStorageParam(label) {
  const s = String(label || '').trim()
  if (!s || s === 'Стандарт') return ''

  const combo = s.match(/^(\d+)\s*\/\s*(\d+)\s*(ГБ|ТБ|GB|TB)?(?:\s+(.+))?$/i)
  if (combo) {
    const unit = combo[3]
      ? (/ТБ|TB/i.test(combo[3]) ? 'tb' : 'gb')
      : (Number(combo[2]) > 5 ? 'gb' : 'tb')
    const rest = (combo[4] || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return `${combo[1]}-${combo[2]}${unit}${rest ? `-${rest}` : ''}`
  }

  const single = s.match(/^(\d+(?:[.,]\d+)?)\s*(ГБ|ТБ|GB|TB)?(?:\s+(.+))?$/i)
  if (single) {
    const num = String(single[1]).replace(',', '.')
    const unit = single[2]
      ? (/ТБ|TB/i.test(single[2]) ? 'tb' : 'gb')
      : (Number(num) > 5 ? 'gb' : 'tb')
    const rest = (single[3] || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return `${num}${unit}${rest ? `-${rest}` : ''}`
  }

  const mm = s.match(/^(\d+)\s*мм$/i)
  if (mm) return `${mm[1]}mm`

  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9а-яё\-]/gi, '')
}

export function compactSimParam(sim) {
  const s = String(sim || '').toLowerCase().replace(/\s+/g, '')
  if (!s) return ''
  if (/esim\+sim|sim\+esim|simesim|dualsim/.test(s)) return 'esim-sim'
  if (/esim/.test(s)) return 'esim'
  return String(sim).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
}

function normalizeForMatch(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '').replace(/гб/g, 'gb').replace(/тб/g, 'tb').replace(/\//g, '-')
}

export function matchStorageLabel(labels, param) {
  const list = (labels || []).filter(Boolean)
  if (!param || !list.length) return null
  const decoded = decodeURIComponent(String(param)).trim()
  const exact = list.find((l) => l === decoded)
  if (exact) return exact
  const compact = normalizeForMatch(compactStorageParam(decoded) || decoded)
  return list.find((l) => normalizeForMatch(compactStorageParam(l)) === compact)
    || list.find((l) => normalizeForMatch(l).includes(compact) || compact.includes(normalizeForMatch(l)))
    || null
}

export function matchSimType(simTypes, param) {
  const list = simTypes || []
  if (!param || !list.length) return null
  const decoded = decodeURIComponent(String(param)).trim()
  const exact = list.find((s) => s === decoded)
  if (exact) return exact
  const want = compactSimParam(decoded)
  return list.find((s) => compactSimParam(s) === want) || null
}

/** Красивая ссылка: /product/iphone-17-pro-max?color=black&storage=256gb&w=12 */
export function buildProductHref(product, selection = {}) {
  const slug = getProductSlug(product)
  if (!slug) return '/catalog'
  const params = new URLSearchParams()
  if (selection.color) params.set('color', selection.color)
  if (selection.storage) {
    const compact = compactStorageParam(selection.storage)
    if (compact) params.set('storage', compact)
  }
  if (selection.sim) {
    const compact = compactSimParam(selection.sim)
    if (compact) params.set('sim', compact)
  }
  if (selection.warranty) params.set('w', String(selection.warranty))
  const qs = params.toString()
  return `/product/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`
}

export function calcPrice(product, colorIdx = 0, storageIdx = 0, sizeIdx = 0, simType = null) {
  const color = product.colors?.[colorIdx]
  const storageLabel = resolveVariantStorageLabel(product, storageIdx, sizeIdx)

  if (usesSupplierPricing(product) && color && storageLabel) {
    const variant = findVariant(product, color.id, storageLabel, simType)
    if (variant?.price) return variant.price
    if (hasPhysicalStock(product, color.id, storageLabel, simType)) {
      return getStockFallbackPrice(product, color.id, storageLabel, simType)
    }
    return 0
  }

  if (!usesSupplierPricing(product)) {
    let price = 0
    if (product.sizes?.length > 1) {
      price = product.sizes[sizeIdx ?? 0]?.price ?? 0
    } else {
      price = product.storage?.[storageIdx]?.price ?? 0
    }
    return price
  }

  return 0
}

export function getMinPrice(product) {
  if (usesSupplierPricing(product)) {
    const prices = getOrderableVariants(product).map((v) => v.price).filter((p) => p > 0)
    product.stock?.forEach((s) => {
      if (s.qty > 0 && s.price > 0) prices.push(s.price)
      else if (s.qty > 0) {
        const fallback = getStockFallbackPrice(product, s.colorId, s.storageLabel, s.simType || null)
        if (fallback > 0) prices.push(fallback)
      }
    })
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

export { usesSupplierPricing, findVariant, getOrderableVariants, hasAnyPurchasePrice, calcRetailFromPurchase, recalcAllVariants } from './pricing.js'
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

/** Корневой путь к ассету — чтобы работало с /product/slug */
export function assetUrl(src) {
  if (!src) return src
  const s = String(src).trim()
  if (!s) return s
  if (/^(https?:|data:|blob:|\/\/)/i.test(s)) return s
  if (s.startsWith('/')) return s
  return `/${s.replace(/^\/+/, '')}`
}

export function getAllProductImages(product) {
  const merged = []
  const add = (img) => {
    const url = assetUrl(img)
    if (url && !merged.includes(url)) merged.push(url)
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

  return merged.length ? merged : [assetUrl('assets/logo.png')]
}

export function findColorIndexByImage(product, image) {
  if (!image || !product.colors?.length) return -1
  const want = assetUrl(image)
  return product.colors.findIndex((c) =>
    assetUrl(c.image) === want || c.images?.some((img) => assetUrl(img) === want),
  )
}

export function getInitialColorIndex(product) {
  const coverIdx = findColorIndexByImage(product, product.coverImage)
  if (coverIdx >= 0) return coverIdx
  const imageIdx = findColorIndexByImage(product, product.image)
  if (imageIdx >= 0) return imageIdx
  return 0
}

/** Первая доступная комбинация (приоритет — позиции в наличии на складе) */
export function getInitialSelection(product) {
  const simTypes = product.simTypes?.length ? product.simTypes : [null]
  const sizeLabels = getProductSizeLabels(product)
  const storageLabels = sizeLabels.length
    ? sizeLabels
    : getDisplayStorage(product).map((s) => s.label).length
      ? getDisplayStorage(product).map((s) => s.label)
      : product.storage?.map((s) => s.label) || ['Стандарт']

  const tryPick = (preferStock) => {
    for (let ci = 0; ci < (product.colors?.length || 0); ci++) {
      const colorId = product.colors[ci].id
      for (let si = 0; si < storageLabels.length; si++) {
        const storage = storageLabels[si]
        for (let ti = 0; ti < simTypes.length; ti++) {
          const sim = simTypes[ti]
          const inStock = hasPhysicalStock(product, colorId, storage, sim)
          const orderable = isComboOrderable(product, colorId, storage, sim)
          if (!orderable) continue
          if (preferStock && !inStock) continue
          return { colorIdx: ci, storageIdx: si, simIdx: ti, sizeIdx: si }
        }
      }
    }
    return null
  }

  return tryPick(true) || tryPick(false) || { colorIdx: getInitialColorIndex(product), storageIdx: 0, simIdx: 0, sizeIdx: 0 }
}

/** Фото для карточки товара: сначала выбранный цвет, затем остальная галерея */
export function getProductImages(product, colorIdx = 0) {
  const all = getAllProductImages(product)
  const color = product.colors?.[colorIdx]
  if (!color?.image) return all

  const prioritized = []
  const add = (img) => {
    const url = assetUrl(img)
    if (url && !prioritized.includes(url)) prioritized.push(url)
  }
  add(color.image)
  color.images?.forEach(add)
  all.forEach(add)
  return prioritized
}

/** Превью в каталоге — всегда главное фото */
export function getProductImage(product, colorIdx = 0) {
  if (product.coverImage) return assetUrl(product.coverImage)
  if (product.image) return assetUrl(product.image)
  const color = product.colors?.[colorIdx]
  if (color?.image) return assetUrl(color.image)
  return getAllProductImages(product)[0]
}

export { getStockForVariant, hasPhysicalStock, getStockFallbackPrice } from './pricing.js'

export function getInStockItems(product) {
  if (!product.stock?.length) return []
  return product.stock.filter((s) => s.qty > 0)
}

export function hasAnyStock(product) {
  return product.stock?.some((s) => s.qty > 0)
}

/** Нет на складе и нельзя оформить под заказ (нет закупочных / розничных цен) */
export function isProductFullyUnavailable(product) {
  if (hasAnyStock(product)) return false
  if (hasAnyPurchasePrice(product)) {
    return getOrderableVariants(product).length === 0
  }
  return getMinPrice(product) <= 0
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
