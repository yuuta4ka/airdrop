import { loadStore, getMinPrice, formatPrice, badgeClass, getProductImage, hasAnyStock, getCatalogMode } from './store.js'
import { loadCart, saveCart, getCartCount, getCartTotal } from './cart.js'
import { renderHeader, renderFooter } from './layout.js'

let store
let activeCategory = 'all'
let cart = loadCart()

const els = {}

function $(id) { return document.getElementById(id) }

async function init() {
  store = await loadStore()
  await renderHeader('catalog')
  await renderFooter()

  els.categories = $('categories')
  els.productsGrid = $('products-grid')
  els.productsCount = $('products-count')
  els.usedPanel = $('used-panel')
  els.newCatalog = $('new-catalog')
  els.catalogTop = $('catalog-top')
  els.cartBtn = $('cart-btn')
  els.cartBadge = $('cart-badge')
  els.cartOverlay = $('cart-overlay')
  els.cartPanel = $('cart-panel')
  els.cartClose = $('cart-close')
  els.cartItems = $('cart-items')
  els.cartTitle = $('cart-title')
  els.cartTotal = $('cart-total')
  els.cartCheckout = $('cart-checkout')
  els.toast = $('toast')
  els.whyUsList = $('why-us-list')
  els.heroTitle = $('hero-title')
  els.heroText = $('hero-text')

  const s = store.settings
  if (els.heroTitle) els.heroTitle.innerHTML = `${s.heroTitle}<br /><span>${s.heroSubtitle}</span>`
  if (els.heroText) els.heroText.textContent = s.heroText
  if (els.whyUsList) els.whyUsList.innerHTML = s.whyUs.map((item) => `<li>${item}</li>`).join('')

  $('used-vk-link')?.setAttribute('href', s.links.vkMarket)

  els.cartBtn?.addEventListener('click', openCart)
  els.cartClose?.addEventListener('click', closeCart)
  els.cartOverlay?.addEventListener('click', closeCart)
  els.cartCheckout?.addEventListener('click', checkout)

  window.addEventListener('catalog-mode-change', renderCatalogMode)
  renderCategories()
  renderCatalogMode()

  const params = new URLSearchParams(window.location.search)
  if (params.get('added')) {
    showToast('Товар добавлен в корзину')
    history.replaceState({}, '', 'catalog.html')
  }
  updateCartUI()
}

function renderCatalogMode() {
  const mode = getCatalogMode()
  const isUsed = mode === 'used'

  els.usedPanel.style.display = isUsed ? 'block' : 'none'
  els.newCatalog.style.display = isUsed ? 'none' : 'block'
  if (els.catalogTop) els.catalogTop.style.display = isUsed ? 'none' : 'block'

  if (!isUsed) renderProducts()
}

function renderCategories() {
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
  const filtered = activeCategory === 'all'
    ? store.products
    : store.products.filter((p) => p.category === activeCategory)

  els.productsCount.textContent = `${filtered.length} товаров`

  els.productsGrid.innerHTML = filtered.map((p) => {
    const minPrice = getMinPrice(p)
    const img = getProductImage(p)
    const inStock = hasAnyStock(p)
    const stockBadge = inStock ? '<span class="product-card__badge product-card__badge--stock">В наличии</span>' : ''
    const badge = p.badge && !inStock ? `<span class="${badgeClass(p.badge)}">${p.badge}</span>` : stockBadge || (p.badge ? `<span class="${badgeClass(p.badge)}">${p.badge}</span>` : '')

    return `
    <a href="product.html#${p.id}" class="product-card product-card--link">
      <div class="product-card__image">
        ${badge}
        <img src="${img}" alt="${p.name}" class="product-card__photo" loading="lazy" />
      </div>
      <div class="product-card__body">
        <div class="product-card__brand">${p.brand}</div>
        <h3 class="product-card__name">${p.name}</h3>
        <div class="product-card__specs">
          <span class="product-card__spec">${inStock ? 'Есть в наличии' : `Под заказ ${store.settings.orderDays}`}</span>
        </div>
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

function updateCartUI() {
  const totalCount = getCartCount(cart)
  const total = getCartTotal(cart)

  els.cartBadge.textContent = totalCount
  els.cartBadge.style.display = totalCount > 0 ? 'flex' : 'none'
  els.cartTitle.textContent = totalCount > 0 ? `Корзина (${totalCount})` : 'Корзина'
  els.cartTotal.textContent = formatPrice(total)
  els.cartCheckout.disabled = cart.length === 0

  if (cart.length === 0) {
    els.cartItems.innerHTML = `<div class="cart__empty"><div class="cart__empty-icon">🛒</div><p>Корзина пуста</p></div>`
    return
  }

  els.cartItems.innerHTML = cart.map((item) => `
    <div class="cart-item">
      <img src="${item.image || 'assets/logo.png'}" alt="" class="cart-item__photo" />
      <div class="cart-item__info">
        <div class="cart-item__name">${item.name}</div>
        <div class="cart-item__variant">${item.variantLabel}</div>
        <div class="cart-item__price">${formatPrice(item.price)}</div>
        <div class="cart-item__controls">
          <button class="cart-item__qty-btn" data-key="${item.key}" data-action="minus">−</button>
          <span class="cart-item__qty">${item.qty}</span>
          <button class="cart-item__qty-btn" data-key="${item.key}" data-action="plus">+</button>
          <button class="cart-item__remove" data-key="${item.key}">Удалить</button>
        </div>
      </div>
    </div>
  `).join('')

  els.cartItems.querySelectorAll('.cart-item__qty-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = cart.find((i) => i.key === btn.dataset.key)
      if (!item) return
      updateQty(btn.dataset.key, btn.dataset.action === 'plus' ? item.qty + 1 : item.qty - 1)
    })
  })
  els.cartItems.querySelectorAll('.cart-item__remove').forEach((btn) => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.key))
  })
}

function updateQty(key, qty) {
  cart = qty <= 0 ? cart.filter((i) => i.key !== key) : cart.map((i) => i.key === key ? { ...i, qty } : i)
  saveCart(cart)
  updateCartUI()
}

function removeFromCart(key) {
  cart = cart.filter((i) => i.key !== key)
  saveCart(cart)
  updateCartUI()
}

function openCart() {
  els.cartOverlay.classList.add('cart-overlay--open')
  els.cartPanel.classList.add('cart--open')
  document.body.style.overflow = 'hidden'
}

function closeCart() {
  els.cartOverlay.classList.remove('cart-overlay--open')
  els.cartPanel.classList.remove('cart--open')
  document.body.style.overflow = ''
}

function checkout() {
  if (!cart.length) return
  const items = cart.map((i) => `${i.name} (${i.variantLabel}) × ${i.qty} — ${formatPrice(i.price * i.qty)}`).join('\n')
  const text = encodeURIComponent(`Здравствуйте! Хочу оформить заказ:\n\n${items}\n\nИтого: ${formatPrice(getCartTotal(cart))}`)
  window.open(`${store.settings.links.telegram}?text=${text}`, '_blank')
}

let toastTimer
function showToast(msg) {
  els.toast.textContent = msg
  els.toast.classList.add('toast--visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => els.toast.classList.remove('toast--visible'), 2500)
}

init()
