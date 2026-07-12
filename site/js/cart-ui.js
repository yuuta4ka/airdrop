import { loadCart, saveCart, getCartCount, getCartTotal } from './cart.js'
import { formatPrice, assetUrl } from './store.js'
import { bindRuPhoneInput, isValidRuPhone } from './phone.js'

let cart = loadCart()
if (!Array.isArray(cart)) cart = []
let store = null
let els = {}
let toastTimer
let toastHideTimer
let cartUiReady = false
let submitting = false

function $(id) { return document.getElementById(id) }

function contactLinks() {
  const links = store?.settings?.links || {}
  const telegram = links.telegram || 'https://t.me/airdrop_196'
  const vk = links.vk || 'https://vk.com/airdrop196'
  const vkMatch = String(links.vkMarket || vk).match(/(?:club|public|market-|write-|-)(\d{5,})/i)
  const vkWrite = vkMatch ? `https://vk.com/write-${vkMatch[1]}` : vk
  return { telegram, vk: vkWrite }
}

function ensureCheckoutModal() {
  if ($('checkout-modal')) return

  document.body.insertAdjacentHTML('beforeend', `
    <div class="checkout-overlay" id="checkout-overlay" hidden></div>
    <div class="checkout-modal" id="checkout-modal" hidden role="dialog" aria-labelledby="checkout-title">
      <div class="checkout-modal__header">
        <h2 id="checkout-title">Оформление заказа</h2>
        <button type="button" class="checkout-modal__close" id="checkout-close" aria-label="Закрыть">✕</button>
      </div>
      <div class="checkout-modal__body">
        <form class="checkout-modal__form" id="checkout-form">
          <label class="field">
            <span>Ваше имя</span>
            <input type="text" id="checkout-name" placeholder="Иван" required autocomplete="name" />
          </label>
          <label class="field">
            <span>Номер телефона</span>
            <input type="tel" id="checkout-phone" placeholder="+7 (999) 123-45-67" required autocomplete="tel" inputmode="tel" maxlength="18" />
          </label>
          <button type="submit" class="btn btn--primary checkout-modal__submit" id="checkout-submit">Отправить заказ</button>
        </form>
        <div class="checkout-success" id="checkout-success" hidden>
          <div class="checkout-success__icon" aria-hidden="true">✓</div>
          <h3 class="checkout-success__title">Заказ принят</h3>
          <p class="checkout-success__id">Номер: <strong id="checkout-success-id"></strong></p>
          <p class="checkout-success__hint">Мы свяжемся с вами по телефону в ближайшее время.</p>
          <p class="checkout-success__subhint">Или напишите нам сами:</p>
          <div class="checkout-success__contacts">
            <a class="btn btn--secondary" id="checkout-link-telegram" href="#" target="_blank" rel="noopener">Telegram</a>
            <a class="btn btn--secondary" id="checkout-link-vk" href="#" target="_blank" rel="noopener">ВКонтакте</a>
          </div>
          <button type="button" class="btn btn--primary" id="checkout-success-close">Готово</button>
        </div>
      </div>
    </div>
  `)

  bindRuPhoneInput($('checkout-phone'))

  $('checkout-overlay')?.addEventListener('click', closeCheckout)
  $('checkout-close')?.addEventListener('click', closeCheckout)
  $('checkout-success-close')?.addEventListener('click', closeCheckout)
  $('checkout-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    submitOrder()
  })
}

const CHECKOUT_CONTACT_KEY = 'airdrop_checkout_contact'

function loadCheckoutContact() {
  try {
    const raw = localStorage.getItem(CHECKOUT_CONTACT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return {
      name: String(data.name || '').trim(),
      phone: String(data.phone || '').trim(),
    }
  } catch {
    return null
  }
}

function saveCheckoutContact(name, phone) {
  try {
    localStorage.setItem(CHECKOUT_CONTACT_KEY, JSON.stringify({ name, phone }))
  } catch { /* ignore */ }
}

function resetCheckoutView({ keepContact = false } = {}) {
  const modal = $('checkout-modal')
  modal?.classList.remove('checkout-modal--success')
  $('checkout-form')?.removeAttribute('hidden')
  $('checkout-success')?.setAttribute('hidden', '')
  if (!keepContact) {
    $('checkout-name').value = ''
    $('checkout-phone').value = ''
  }
  $('checkout-phone')?.setCustomValidity('')
  const btn = $('checkout-submit')
  if (btn) {
    btn.disabled = false
    btn.textContent = 'Отправить заказ'
  }
  submitting = false
}

function showCheckoutSuccess(orderId) {
  const links = contactLinks()
  $('checkout-form')?.setAttribute('hidden', '')
  $('checkout-success')?.removeAttribute('hidden')
  $('checkout-modal')?.classList.add('checkout-modal--success')
  $('checkout-success-id').textContent = orderId
  $('checkout-link-telegram')?.setAttribute('href', links.telegram)
  $('checkout-link-vk')?.setAttribute('href', links.vk)
  $('checkout-title').textContent = 'Заказ принят'
}

async function submitOrder() {
  if (submitting) return

  const name = $('checkout-name')?.value.trim()
  const phone = $('checkout-phone')?.value.trim()
  const phoneInput = $('checkout-phone')
  const submitBtn = $('checkout-submit')

  if (!name || !phone || !cart.length) return

  if (!isValidRuPhone(phone)) {
    phoneInput?.setCustomValidity('Введите номер в формате +7 (999) 123-45-67')
    phoneInput?.reportValidity()
    return
  }

  submitting = true
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.textContent = 'Отправка…'
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        items: cart,
        total: getCartTotal(cart),
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Не удалось отправить заказ')

    saveCheckoutContact(name, phone)
    cart = []
    saveCart(cart)
    updateCartUI()
    showCheckoutSuccess(data.orderId)
    closeCart()
  } catch (err) {
    showToast(err.message || 'Не удалось отправить заказ')
    submitting = false
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.textContent = 'Отправить заказ'
    }
  }
}

export function openCheckout() {
  if (!cart.length) return
  ensureCheckoutModal()
  resetCheckoutView({ keepContact: false })
  const saved = loadCheckoutContact()
  if (saved?.name) $('checkout-name').value = saved.name
  if (saved?.phone) $('checkout-phone').value = saved.phone
  $('checkout-title').textContent = 'Оформление заказа'
  $('checkout-overlay')?.removeAttribute('hidden')
  $('checkout-modal')?.removeAttribute('hidden')
  document.body.style.overflow = 'hidden'
  $('checkout-name')?.focus()
}

export function closeCheckout() {
  $('checkout-overlay')?.setAttribute('hidden', '')
  $('checkout-modal')?.setAttribute('hidden', '')
  resetCheckoutView()
  if (!$('cart-panel')?.classList.contains('cart--open')) {
    document.body.style.overflow = ''
  }
}

export function initCartUI(storeData) {
  if (cartUiReady) return
  cartUiReady = true

  store = storeData
  cart = loadCart()
  if (!Array.isArray(cart)) cart = []
  ensureCheckoutModal()

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

  resetCartOverlay()
  els.cartBtn?.addEventListener('click', openCart)
  els.cartClose?.addEventListener('click', closeCart)
  els.cartOverlay?.addEventListener('click', closeCart)
  els.cartCheckout?.addEventListener('click', openCheckout)
  updateCartUI()
}

export function resetCartOverlay() {
  els.cartOverlay?.classList.remove('cart-overlay--open')
  els.cartPanel?.classList.remove('cart--open')
  if (!$('checkout-modal') || $('checkout-modal').hasAttribute('hidden')) {
    document.body.style.overflow = ''
  }
}

export function addItem(item) {
  const existing = cart.find((i) => i.key === item.key)
  if (existing) existing.qty += item.qty || 1
  else cart.push({ ...item, qty: item.qty || 1 })
  saveCart(cart)
  updateCartUI()
}

export function updateCartUI() {
  if (!els.cartBadge) return

  const totalCount = getCartCount(cart)
  const total = getCartTotal(cart)

  els.cartBadge.textContent = totalCount
  els.cartBadge.style.display = totalCount > 0 ? 'flex' : 'none'
  if (els.cartTitle) els.cartTitle.textContent = totalCount > 0 ? `Корзина (${totalCount})` : 'Корзина'
  if (els.cartTotal) els.cartTotal.textContent = formatPrice(total)
  if (els.cartCheckout) els.cartCheckout.disabled = cart.length === 0

  if (!els.cartItems) return

  if (cart.length === 0) {
    els.cartItems.innerHTML = `<div class="cart__empty"><div class="cart__empty-icon">🛒</div><p>Корзина пуста</p></div>`
    return
  }

  els.cartItems.innerHTML = cart.map((item) => `
    <div class="cart-item">
      <div class="cart-item__media">
        <img src="${assetUrl(item.image || 'assets/logo.png')}" alt="" class="cart-item__photo" />
      </div>
      <div class="cart-item__body">
        <div class="cart-item__name">${item.name}</div>
        <div class="cart-item__variant">${item.variantLabel}</div>
        <div class="cart-item__price">${formatPrice(item.price)}</div>
      </div>
      <button type="button" class="cart-item__remove" data-key="${item.key}" aria-label="Удалить из корзины">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9L18 7"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
  `).join('')

  els.cartItems.querySelectorAll('.cart-item__remove').forEach((btn) => {
    btn.addEventListener('click', () => removeItem(btn.dataset.key))
  })
}

function removeItem(key) {
  cart = cart.filter((i) => i.key !== key)
  saveCart(cart)
  updateCartUI()
}

export function openCart() {
  if (!els.cartOverlay || !els.cartPanel) return
  els.cartOverlay.classList.add('cart-overlay--open')
  els.cartPanel.classList.add('cart--open')
  document.body.style.overflow = 'hidden'
}

export function closeCart() {
  els.cartOverlay?.classList.remove('cart-overlay--open')
  els.cartPanel?.classList.remove('cart--open')
  if ($('checkout-modal')?.hasAttribute('hidden')) {
    document.body.style.overflow = ''
  }
}

export function showToast(msg) {
  if (!els.toast) return

  clearTimeout(toastTimer)
  clearTimeout(toastHideTimer)

  els.toast.classList.remove('toast--hiding')
  els.toast.textContent = msg
  void els.toast.offsetWidth
  els.toast.classList.add('toast--visible')

  toastTimer = setTimeout(() => {
    els.toast.classList.remove('toast--visible')
    els.toast.classList.add('toast--hiding')
    toastHideTimer = setTimeout(() => {
      els.toast.classList.remove('toast--hiding')
      els.toast.textContent = ''
    }, 400)
  }, 2500)
}
