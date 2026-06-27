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
  const storageLabel = storage?.label

  if (product.variants?.length && color && storageLabel) {
    const exact = product.variants.find((v) =>
      v.colorId === color.id &&
      v.storage === storageLabel &&
      (simType ? v.simType === simType : !v.simType)
    )
    if (exact) return exact.price
  }

  let price = 0
  if (product.sizes?.length > 1) {
    price = product.sizes[sizeIdx ?? 0]?.price ?? 0
  } else {
    price = storage?.price ?? 0
  }

  price += color?.priceAdd ?? 0

  if (simType && product.simModifiers?.length) {
    const simMod = product.simModifiers.find((s) => s.type === simType)
    price += simMod?.priceAdd ?? 0
  }

  return price
}

export function getMinPrice(product) {
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

export function getProductImage(product, colorIdx = 0) {
  const color = product.colors?.[colorIdx]
  if (color?.image) return color.image
  return product.image || 'assets/logo.png'
}

export function getStockForVariant(product, colorId, simType) {
  if (!product.stock?.length) return null
  return product.stock.find((s) => s.colorId === colorId && (!simType || s.simType === simType)) || null
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
