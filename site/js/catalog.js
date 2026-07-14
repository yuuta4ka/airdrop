import { loadStore, getMinPrice, formatPrice, badgeClass, getProductImage, hasAnyStock, isProductFullyUnavailable, getCatalogMode, buildProductHref } from './store.js'
import { renderHeader, renderFooter } from './layout.js'
import { initCartUI, resetCartOverlay, showToast } from './cart-ui.js'

let store
let activeCategory = 'all'
let searchQuery = ''
let searchTimer = null
let restoreScrollPending = false

const SCROLL_KEY = 'airdrop:catalog-scroll'
const els = {}

function $(id) { return document.getElementById(id) }

function showCatalogSkeleton() {
  const grid = $('products-grid')
  if (!grid || grid.dataset.ready === '1') return
  grid.innerHTML = Array.from({ length: 8 }, () => `
    <div class="product-card product-card--skeleton" aria-hidden="true">
      <div class="product-card__image skeleton-block"></div>
      <div class="product-card__body">
        <div class="skeleton-line skeleton-line--sm"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line skeleton-line--price"></div>
      </div>
    </div>
  `).join('')
}

function showCatalogError(msg) {
  const grid = $('products-grid')
  if (!grid) return
  grid.innerHTML = `
    <div class="catalog-error">
      <p>${msg}</p>
      <button type="button" class="btn btn--secondary" onclick="location.reload()">Обновить страницу</button>
    </div>
  `
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search)
  const cat = params.get('cat')
  if (cat) activeCategory = cat
  const q = params.get('q')
  if (q) searchQuery = q
}

function syncUrlState({ replace = true } = {}) {
  const params = new URLSearchParams(window.location.search)
  // preserve unrelated params briefly then rebuild
  const next = new URLSearchParams()
  if (activeCategory && activeCategory !== 'all') next.set('cat', activeCategory)
  if (searchQuery.trim()) next.set('q', searchQuery.trim())
  // keep toast/cart one-shots only if still present and no cat/q yet — drop them after init
  const qs = next.toString()
  const url = qs ? `/catalog?${qs}` : '/catalog'
  if (replace) history.replaceState({ cat: activeCategory, q: searchQuery }, '', url)
  else history.pushState({ cat: activeCategory, q: searchQuery }, '', url)
}

function saveScrollForReturn() {
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({
      y: window.scrollY,
      cat: activeCategory,
      q: searchQuery,
    }))
  } catch { /* ignore */ }
}

function restoreScrollIfNeeded() {
  if (!restoreScrollPending) return
  restoreScrollPending = false
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    sessionStorage.removeItem(SCROLL_KEY)
    if (data.cat !== activeCategory || (data.q || '') !== (searchQuery || '')) return
    const y = Number(data.y) || 0
    // Instant jump — CSS scroll-behavior:smooth must not animate this
    const html = document.documentElement
    html.style.scrollBehavior = 'auto'
    document.body.style.scrollBehavior = 'auto'
    html.scrollTop = y
    document.body.scrollTop = y
    window.scrollTo(0, y)
  } catch { /* ignore */ }
}

function setupSearch() {
  const input = $('catalog-search')
  if (!input) return
  input.value = searchQuery
  input.addEventListener('input', () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchQuery = input.value.trim()
      syncUrlState()
      renderProducts()
    }, 180)
  })
}

async function init() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  showCatalogSkeleton()
  readUrlState()
  try {
    const rawScroll = sessionStorage.getItem(SCROLL_KEY)
    if (rawScroll) restoreScrollPending = true
  } catch { /* ignore */ }

  try {
    store = await loadStore()
    // validate category from URL
    if (activeCategory !== 'all' && !(store.categories || []).some((c) => c.id === activeCategory)) {
      activeCategory = 'all'
    }
    await renderHeader('catalog')
    await renderFooter()

    els.categories = $('categories')
    els.productsGrid = $('products-grid')
    els.productsCount = $('products-count')
    els.usedPanel = $('used-panel')
    els.newCatalog = $('new-catalog')
    els.catalogTop = $('catalog-top')
    els.whyUsList = $('why-us-list')

    const s = store.settings
    if (els.whyUsList) els.whyUsList.innerHTML = s.whyUs.map((item) => `<li>${item}</li>`).join('')

    $('used-vk-link')?.setAttribute('href', s.links.vkMarket)

    try {
      initCartUI(store)
      resetCartOverlay()
    } catch (err) {
      console.error('Cart init failed:', err)
    }

    setupSearch()
    window.addEventListener('catalog-mode-change', renderCatalogMode)
    window.addEventListener('popstate', () => {
      readUrlState()
      if (activeCategory !== 'all' && !(store.categories || []).some((c) => c.id === activeCategory)) {
        activeCategory = 'all'
      }
      const input = $('catalog-search')
      if (input) input.value = searchQuery
      renderCategories()
      renderCatalogMode()
    })

    renderCategories()
    renderCatalogMode()
    syncUrlState()

    const params = new URLSearchParams(window.location.search)
    if (params.get('added')) {
      showToast('Товар добавлен в корзину')
      syncUrlState()
    }
    if (params.get('openCart')) {
      syncUrlState()
      setTimeout(() => document.getElementById('cart-btn')?.click(), 300)
    }
  } catch (err) {
    console.error('Catalog init failed:', err)
    showCatalogError('Не удалось загрузить каталог. Убедитесь, что сервер запущен: bash dev.sh')
  }
}

function renderCatalogMode() {
  const mode = getCatalogMode()
  const isUsed = mode === 'used'

  document.body.classList.toggle('catalog--used', isUsed)

  if (els.usedPanel) els.usedPanel.style.display = isUsed ? 'block' : 'none'
  if (els.newCatalog) els.newCatalog.style.display = isUsed ? 'none' : 'block'
  if (els.catalogTop) els.catalogTop.style.display = isUsed ? 'none' : 'block'

  if (!isUsed) renderProducts()
}

function renderCategories() {
  if (!els.categories || !store?.categories) return

  els.categories.innerHTML = store.categories.map((cat) => `
    <button class="category-btn${activeCategory === cat.id ? ' category-btn--active' : ''}" data-id="${cat.id}">
      ${cat.label}
    </button>
  `).join('')

  els.categories.querySelectorAll('.category-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.id
      syncUrlState()
      renderCategories()
      renderProducts()
    })
  })
}

function getCategorySortMode(categoryId) {
  return store?.categorySortModes?.[categoryId] === 'manual' ? 'manual' : 'auto'
}

function compareByPriceDesc(a, b) {
  return getMinPrice(b) - getMinPrice(a)
}

function compareByManualOrder(a, b) {
  const oa = typeof a.order === 'number' ? a.order : Infinity
  const ob = typeof b.order === 'number' ? b.order : Infinity
  if (oa !== ob) return oa - ob
  return compareByPriceDesc(a, b)
}

function sortWithinCategory(products, categoryId) {
  const cmp = getCategorySortMode(categoryId) === 'manual' ? compareByManualOrder : compareByPriceDesc
  return [...products].sort((a, b) => {
    const ua = isProductFullyUnavailable(a) ? 1 : 0
    const ub = isProductFullyUnavailable(b) ? 1 : 0
    if (ua !== ub) return ua - ub
    return cmp(a, b)
  })
}

function sortForAllCategories(products) {
  const catOrder = (store?.categories || []).filter((c) => c.id !== 'all').map((c) => c.id)
  const byCategory = new Map()
  for (const p of products) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, [])
    byCategory.get(p.category).push(p)
  }
  const result = []
  for (const catId of catOrder) {
    const group = byCategory.get(catId)
    if (!group) continue
    result.push(...sortWithinCategory(group, catId))
    byCategory.delete(catId)
  }
  for (const [catId, group] of byCategory) {
    result.push(...sortWithinCategory(group, catId))
  }
  return result
}

function matchesSearch(p, q) {
  if (!q) return true
  const hay = `${p.name || ''} ${p.brand || ''} ${p.importNames || ''}`.toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((part) => hay.includes(part))
}

function renderProducts() {
  if (!els.productsGrid || !els.productsCount) return

  const products = (Array.isArray(store?.products) ? store.products : []).filter((p) => !p.hidden)
  let filtered = activeCategory === 'all'
    ? products
    : products.filter((p) => p.category === activeCategory)
  filtered = filtered.filter((p) => matchesSearch(p, searchQuery))

  els.productsCount.textContent = `${filtered.length} товаров`
  els.productsGrid.dataset.ready = '1'

  if (!filtered.length) {
    els.productsGrid.innerHTML = `<div class="catalog-error"><p>${searchQuery ? 'Ничего не найдено по запросу' : 'Товары не найдены'}</p></div>`
    return
  }

  const sorted = activeCategory === 'all'
    ? sortForAllCategories(filtered)
    : sortWithinCategory(filtered, activeCategory)

  els.productsGrid.innerHTML = sorted.map((p) => {
    const minPrice = getMinPrice(p)
    const img = getProductImage(p)
    const inStock = hasAnyStock(p)
    const fullyUnavailable = isProductFullyUnavailable(p)
    const stockBadge = inStock ? '<span class="product-card__badge product-card__badge--stock">В наличии</span>' : ''
    const badge = p.badge && !inStock ? `<span class="${badgeClass(p.badge)}">${p.badge}</span>` : stockBadge || (p.badge ? `<span class="${badgeClass(p.badge)}">${p.badge}</span>` : '')
    const specText = fullyUnavailable ? 'Нет в наличии' : (inStock ? 'Есть в наличии' : `Под заказ ${store.settings.orderDays}`)
    const specOverlay = p.showCatalogSpec ? `<span class="product-card__spec product-card__spec--overlay${fullyUnavailable ? ' product-card__spec--unavailable' : ''}">${specText}</span>` : ''
    const priceHtml = fullyUnavailable
      ? '<span class="product-card__price product-card__price--unavailable">Нет в наличии</span>'
      : `<span class="product-card__price">от ${formatPrice(minPrice)}</span>`

    return `
    <a href="${buildProductHref(p)}" class="product-card product-card--link is-visible${fullyUnavailable ? ' product-card--unavailable' : ''}" data-product-id="${p.id}">
      <div class="product-card__image">
        ${badge}
        ${specOverlay}
        <img src="${img}" alt="${p.name}" class="product-card__photo" loading="lazy" />
      </div>
      <div class="product-card__body">
        <div class="product-card__brand">${p.brand}</div>
        <h3 class="product-card__name">${p.name}</h3>
        <div class="product-card__footer">
          <div class="product-card__prices">
            ${priceHtml}
          </div>
          <span class="product-card__more">Подробнее →</span>
        </div>
      </div>
    </a>
  `}).join('')

  els.productsGrid.querySelectorAll('a.product-card--link').forEach((a) => {
    a.addEventListener('click', () => saveScrollForReturn())
  })

  window.dispatchEvent(new CustomEvent('catalog-rendered'))
  setupProductPrefetch()
  restoreScrollIfNeeded()
}

let productPrefetchBound = false
const prefetchedUrls = new Set()

function prefetchUrl(url) {
  if (!url || prefetchedUrls.has(url)) return
  prefetchedUrls.add(url)
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = url
  if (url.includes('.js')) link.as = 'script'
  document.head.appendChild(link)
}

function setupProductPrefetch() {
  if (!els.productsGrid || productPrefetchBound) return
  productPrefetchBound = true
  const prefetchFromEvent = (e) => {
    const card = e.target.closest?.('a.product-card--link')
    if (!card?.href) return
    prefetchUrl(card.getAttribute('href') || card.href)
    prefetchUrl('/js/product.js?v=20260715b')
    prefetchUrl('/css/product-mobile.css?v=20260714r')
  }
  // Desktop hover + mobile touch start (до click)
  els.productsGrid.addEventListener('pointerenter', prefetchFromEvent, true)
  els.productsGrid.addEventListener('touchstart', prefetchFromEvent, { capture: true, passive: true })
}

init()
