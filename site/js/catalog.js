import { loadStore, getMinPrice, formatPrice, badgeClass, getProductImage, hasAnyStock, getCatalogMode } from './store.js'
import { renderHeader, renderFooter } from './layout.js'
import { initCartUI, resetCartOverlay, showToast } from './cart-ui.js'

let store
let activeCategory = 'all'

const els = {}

function $(id) { return document.getElementById(id) }

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

async function init() {
  try {
    store = await loadStore()
    await renderHeader('catalog')
    await renderFooter()

    els.categories = $('categories')
    els.productsGrid = $('products-grid')
    els.productsCount = $('products-count')
    els.usedPanel = $('used-panel')
    els.newCatalog = $('new-catalog')
    els.catalogTop = $('catalog-top')
    els.whyUsList = $('why-us-list')
    els.heroTitle = $('hero-title')
    els.heroText = $('hero-text')

    const s = store.settings
    if (els.heroTitle) els.heroTitle.innerHTML = `${s.heroTitle}<br /><span>${s.heroSubtitle}</span>`
    if (els.heroText) els.heroText.textContent = s.heroText
    if (els.whyUsList) els.whyUsList.innerHTML = s.whyUs.map((item) => `<li>${item}</li>`).join('')

    $('used-vk-link')?.setAttribute('href', s.links.vkMarket)

    try {
      initCartUI(store)
      resetCartOverlay()
    } catch (err) {
      console.error('Cart init failed:', err)
    }

    window.addEventListener('catalog-mode-change', renderCatalogMode)
    renderCategories()
    renderCatalogMode()

    const params = new URLSearchParams(window.location.search)
    if (params.get('added')) {
      showToast('Товар добавлен в корзину')
      history.replaceState({}, '', 'catalog.html')
    }
    if (params.get('openCart')) {
      history.replaceState({}, '', 'catalog.html')
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
      renderCategories()
      renderProducts()
    })
  })
}

function renderProducts() {
  if (!els.productsGrid || !els.productsCount) return

  const products = Array.isArray(store?.products) ? store.products : []
  const filtered = activeCategory === 'all'
    ? products
    : products.filter((p) => p.category === activeCategory)

  els.productsCount.textContent = `${filtered.length} товаров`

  if (!filtered.length) {
    els.productsGrid.innerHTML = `<div class="catalog-error"><p>Товары не найдены</p></div>`
    return
  }

  els.productsGrid.innerHTML = filtered.map((p) => {
    const minPrice = getMinPrice(p)
    const img = getProductImage(p)
    const inStock = hasAnyStock(p)
    const stockBadge = inStock ? '<span class="product-card__badge product-card__badge--stock">В наличии</span>' : ''
    const badge = p.badge && !inStock ? `<span class="${badgeClass(p.badge)}">${p.badge}</span>` : stockBadge || (p.badge ? `<span class="${badgeClass(p.badge)}">${p.badge}</span>` : '')
    const specText = inStock ? 'Есть в наличии' : `Под заказ ${store.settings.orderDays}`
    const specOverlay = p.showCatalogSpec ? `<span class="product-card__spec product-card__spec--overlay">${specText}</span>` : ''

    return `
    <a href="product.html#${p.id}" class="product-card product-card--link is-visible">
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
            <span class="product-card__price">от ${formatPrice(minPrice)}</span>
          </div>
          <span class="product-card__more">Подробнее →</span>
        </div>
      </div>
    </a>
  `}).join('')

  window.dispatchEvent(new CustomEvent('catalog-rendered'))
}

init()
