import { categories, products, formatPrice, badgeClass } from './products.js'

let activeCategory = 'all'
let cart = []
let cartOpen = false

const els = {
  categories: document.getElementById('categories'),
  productsGrid: document.getElementById('products-grid'),
  productsCount: document.getElementById('products-count'),
  cartBtn: document.getElementById('cart-btn'),
  cartBadge: document.getElementById('cart-badge'),
  cartOverlay: document.getElementById('cart-overlay'),
  cartPanel: document.getElementById('cart-panel'),
  cartClose: document.getElementById('cart-close'),
  cartItems: document.getElementById('cart-items'),
  cartTitle: document.getElementById('cart-title'),
  cartTotal: document.getElementById('cart-total'),
  cartCheckout: document.getElementById('cart-checkout'),
  toast: document.getElementById('toast'),
}

function renderCategories() {
  els.categories.innerHTML = categories.map((cat) => `
    <button class="category-btn${activeCategory === cat.id ? ' category-btn--active' : ''}" data-id="${cat.id}">
      <span>${cat.icon}</span> ${cat.label}
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

function isInCart(id) {
  return cart.some((item) => item.product.id === id)
}

function renderProducts() {
  const filtered = activeCategory === 'all'
    ? products
    : products.filter((p) => p.category === activeCategory)

  els.productsCount.textContent = `${filtered.length} товаров`

  els.productsGrid.innerHTML = filtered.map((p) => `
    <article class="product-card">
      <div class="product-card__image" style="background: linear-gradient(160deg, ${p.color}33 0%, ${p.color}11 100%)">
        ${p.badge ? `<span class="${badgeClass(p.badge)}">${p.badge}</span>` : ''}
        <span class="product-card__emoji">${p.emoji}</span>
      </div>
      <div class="product-card__body">
        <div class="product-card__brand">${p.brand}</div>
        <h3 class="product-card__name">${p.name}</h3>
        <div class="product-card__specs">
          ${p.specs.map((s) => `<span class="product-card__spec">${s}</span>`).join('')}
        </div>
        <div class="product-card__footer">
          <div class="product-card__prices">
            <span class="product-card__price">${formatPrice(p.price)}</span>
            ${p.oldPrice ? `<span class="product-card__old-price">${formatPrice(p.oldPrice)}</span>` : ''}
          </div>
          <button class="product-card__add${isInCart(p.id) ? ' product-card__add--added' : ''}" data-id="${p.id}">
            ${isInCart(p.id) ? '✓ В корзине' : 'В корзину'}
          </button>
        </div>
      </div>
    </article>
  `).join('')

  els.productsGrid.querySelectorAll('.product-card__add').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(Number(btn.dataset.id)))
  })
}

function addToCart(id) {
  const product = products.find((p) => p.id === id)
  const existing = cart.find((item) => item.product.id === id)
  if (existing) {
    existing.qty += 1
  } else {
    cart.push({ product, qty: 1 })
  }
  showToast(`${product.name} добавлен в корзину`)
  updateCartUI()
  renderProducts()
}

function updateQty(id, qty) {
  if (qty <= 0) {
    cart = cart.filter((item) => item.product.id !== id)
  } else {
    const item = cart.find((i) => i.product.id === id)
    if (item) item.qty = qty
  }
  updateCartUI()
  renderProducts()
}

function removeFromCart(id) {
  cart = cart.filter((item) => item.product.id !== id)
  updateCartUI()
  renderProducts()
}

function updateCartUI() {
  const totalCount = cart.reduce((s, i) => s + i.qty, 0)
  const total = cart.reduce((s, i) => s + i.product.price * i.qty, 0)

  els.cartBadge.textContent = totalCount
  els.cartBadge.style.display = totalCount > 0 ? 'flex' : 'none'
  els.cartTitle.textContent = totalCount > 0 ? `Корзина (${totalCount})` : 'Корзина'
  els.cartTotal.textContent = formatPrice(total)
  els.cartCheckout.disabled = cart.length === 0

  if (cart.length === 0) {
    els.cartItems.innerHTML = `
      <div class="cart__empty">
        <div class="cart__empty-icon">🛒</div>
        <p>Корзина пуста</p>
        <p style="font-size: 0.85rem; margin-top: 8px">Добавьте товары из каталога</p>
      </div>
    `
    return
  }

  els.cartItems.innerHTML = cart.map((item) => `
    <div class="cart-item">
      <div class="cart-item__emoji">${item.product.emoji}</div>
      <div class="cart-item__info">
        <div class="cart-item__name">${item.product.name}</div>
        <div class="cart-item__price">${formatPrice(item.product.price)}</div>
        <div class="cart-item__controls">
          <button class="cart-item__qty-btn" data-id="${item.product.id}" data-action="minus">−</button>
          <span class="cart-item__qty">${item.qty}</span>
          <button class="cart-item__qty-btn" data-id="${item.product.id}" data-action="plus">+</button>
          <button class="cart-item__remove" data-id="${item.product.id}">Удалить</button>
        </div>
      </div>
    </div>
  `).join('')

  els.cartItems.querySelectorAll('.cart-item__qty-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id)
      const item = cart.find((i) => i.product.id === id)
      if (!item) return
      updateQty(id, btn.dataset.action === 'plus' ? item.qty + 1 : item.qty - 1)
    })
  })

  els.cartItems.querySelectorAll('.cart-item__remove').forEach((btn) => {
    btn.addEventListener('click', () => removeFromCart(Number(btn.dataset.id)))
  })
}

function openCart() {
  cartOpen = true
  els.cartOverlay.classList.add('cart-overlay--open')
  els.cartPanel.classList.add('cart--open')
  document.body.style.overflow = 'hidden'
}

function closeCart() {
  cartOpen = false
  els.cartOverlay.classList.remove('cart-overlay--open')
  els.cartPanel.classList.remove('cart--open')
  document.body.style.overflow = ''
}

let toastTimer
function showToast(message) {
  els.toast.textContent = message
  els.toast.classList.add('toast--visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => els.toast.classList.remove('toast--visible'), 2500)
}

els.cartBtn.addEventListener('click', openCart)
els.cartClose.addEventListener('click', closeCart)
els.cartOverlay.addEventListener('click', closeCart)

renderCategories()
renderProducts()
updateCartUI()
