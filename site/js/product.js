import {
  loadStore, getProductById, calcPrice, formatPrice, makeCartKey,
  getProductImages, getInitialColorIndex, getStockForVariant,
  usesSupplierPricing, isComboOrderable, isOptionUnavailable,
} from './store.js'
import { renderHeader, renderFooter } from './layout.js'
import { initCartUI, addItem, openCart, showToast } from './cart-ui.js'
import { mountProductInstallmentCalc } from './installment-calc.js'
import { initProductGallery } from './product-gallery.js'

const WARRANTY_OPTIONS = [
  { id: '12', months: 12, label: '12 месяцев', percent: 0 },
  { id: '18', months: 18, label: '18 месяцев', percent: 3 },
]

let store, product
let selectedColor = 0
let selectedStorage = 0
let selectedSize = 0
let selectedSim = 0
let selectedWarranty = 0
let gallery
let colorTipTimer = null

const els = {}

async function init() {
  const hash = location.hash.replace('#', '')
  const productId = Number(hash)
  if (!productId) {
    location.href = '/catalog'
    return
  }

  store = await loadStore()
  product = getProductById(store, productId)
  if (!product) {
    location.href = '/catalog'
    return
  }

  document.body.dataset.showCatalogToggle = 'true'
  document.body.dataset.cart = 'true'
  await renderHeader('catalog')
  await renderFooter()
  initCartUI(store)

  els.breadcrumb = document.getElementById('breadcrumb-name')
  els.title = document.getElementById('product-title')
  els.brand = document.getElementById('product-brand')
  els.description = document.getElementById('product-description')
  els.photo = document.getElementById('product-photo')
  els.badge = document.getElementById('product-badge')
  els.price = document.getElementById('product-price')
  els.stockInfo = document.getElementById('stock-info')
  els.colors = document.getElementById('option-colors')
  els.storage = document.getElementById('option-storage')
  els.sizes = document.getElementById('option-sizes')
  els.simTypes = document.getElementById('option-sim')
  els.warranty = document.getElementById('option-warranty')
  els.storageGroup = document.getElementById('group-storage')
  els.sizesGroup = document.getElementById('group-sizes')
  els.simGroup = document.getElementById('group-sim')
  els.warrantyGroup = document.getElementById('group-warranty')
  els.addBtn = document.getElementById('add-to-cart')
  els.installmentCalc = document.getElementById('product-installment-calc')
  els.colorTip = document.getElementById('color-cursor-tip')

  gallery = initProductGallery({
    stage: document.getElementById('product-gallery-stage'),
    mainImg: els.photo,
    prevBtn: document.getElementById('gallery-prev'),
    nextBtn: document.getElementById('gallery-next'),
    getImages: () => getProductImages(product, selectedColor),
    getAlt: () => product.name,
  })

  els.addBtn?.addEventListener('click', addToCart)
  renderOptions()
}

function getSelectedSimType() {
  if (!product.simTypes?.length) return null
  return product.simTypes[selectedSim]
}

function getSelectionContext() {
  return {
    colorId: product.colors[selectedColor]?.id,
    storage: getCurrentStorageLabel(),
    simType: getSelectedSimType(),
  }
}

function ensureValidSelection() {
  if (!usesSupplierPricing(product)) return
  const orderable = isComboOrderable(
    product,
    product.colors[selectedColor]?.id,
    getCurrentStorageLabel(),
    getSelectedSimType(),
  )
  if (orderable) return

  for (const ci of product.colors.keys()) {
    for (const si of product.storage.keys()) {
      for (const simi of (product.simTypes?.length ? product.simTypes.keys() : [0])) {
        const sim = product.simTypes?.[simi] ?? null
        if (isComboOrderable(product, product.colors[ci].id, product.storage[si].label, sim)) {
          selectedColor = ci
          selectedStorage = si
          if (product.simTypes?.length) selectedSim = simi
          return
        }
      }
    }
  }
}

function isOptionGrayed(type, value) {
  if (!usesSupplierPricing(product)) return false
  return isOptionUnavailable(product, type, value, getSelectionContext())
}

function getCurrentStorageLabel() {
  if (product.sizes?.length > 1) return product.sizes[selectedSize]?.label || ''
  return product.storage[selectedStorage]?.label || ''
}

function getBasePrice() {
  return calcPrice(product, selectedColor, selectedStorage, selectedSize, getSelectedSimType())
}

function getWarrantyOption() {
  return WARRANTY_OPTIONS[selectedWarranty] || WARRANTY_OPTIONS[0]
}

function getWarrantyPrice(base = getBasePrice()) {
  const opt = getWarrantyOption()
  return opt.percent ? Math.round(base * opt.percent / 100) : 0
}

function getTotalPrice() {
  const base = getBasePrice()
  return base + getWarrantyPrice(base)
}

function getVariantLabel() {
  const parts = [product.colors[selectedColor].name]
  const sim = getSelectedSimType()
  if (sim) parts.push(sim)
  if (product.sizes?.length > 1) {
    parts.push(product.sizes[selectedSize].label)
  } else if (product.storage[selectedStorage]?.label !== 'Стандарт') {
    parts.push(product.storage[selectedStorage].label)
  }
  const warranty = getWarrantyOption()
  parts.push(`Гарантия ${warranty.months} мес.`)
  return parts.join(' · ')
}

function optionStockBadge(stock) {
  if (!stock?.qty) return ''
  return `<span class="option-btn__stock">${stock.qty} шт.</span>`
}

function hideColorTip() {
  clearTimeout(colorTipTimer)
  colorTipTimer = null
  if (els.colorTip) {
    els.colorTip.hidden = true
    els.colorTip.textContent = ''
  }
}

function bindColorSwatchTip(btn, name) {
  let tipX = 0
  let tipY = 0

  btn.addEventListener('mouseenter', () => {
    hideColorTip()
    colorTipTimer = setTimeout(() => {
      if (!els.colorTip) return
      els.colorTip.textContent = name
      els.colorTip.style.left = `${tipX}px`
      els.colorTip.style.top = `${tipY}px`
      els.colorTip.hidden = false
    }, 2500)
  })

  btn.addEventListener('mousemove', (e) => {
    tipX = e.clientX
    tipY = e.clientY
    if (!els.colorTip?.hidden) {
      els.colorTip.style.left = `${tipX}px`
      els.colorTip.style.top = `${tipY}px`
    }
  })

  btn.addEventListener('mouseleave', hideColorTip)
}

function updateStockInfo() {
  const stock = getStockForVariant(
    product,
    product.colors[selectedColor].id,
    getSelectedSimType(),
    getCurrentStorageLabel(),
  )

  if (stock?.qty > 0) {
    els.stockInfo.innerHTML = `<span class="stock-badge stock-badge--in">В наличии</span>`
  } else {
    els.stockInfo.innerHTML = `<span class="stock-badge stock-badge--order">Под заказ · ${store.settings.orderDays}</span>`
  }
}

function renderWarrantyOptions() {
  const base = getBasePrice()
  els.warranty.innerHTML = WARRANTY_OPTIONS.map((opt, i) => {
    const extra = opt.percent ? Math.round(base * opt.percent / 100) : 0
    const priceLabel = extra ? `+${formatPrice(extra)}` : '0 ₽'
    return `
      <button type="button" class="option-btn option-btn--warranty" data-idx="${i}">
        <span class="option-btn__warranty-label">${opt.label}</span>
        <span class="option-btn__warranty-price">${priceLabel}</span>
      </button>
    `
  }).join('')

  els.warranty.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedWarranty = Number(btn.dataset.idx)
      updateUI()
    })
  })
}

function updateUI(resetGallery = false) {
  const basePrice = getBasePrice()
  const orderable = isComboOrderable(
    product,
    product.colors[selectedColor]?.id,
    getCurrentStorageLabel(),
    getSelectedSimType(),
  )

  gallery?.update(resetGallery)
  els.price.textContent = orderable && basePrice > 0 ? formatPrice(getTotalPrice()) : 'Нет в наличии'
  if (els.addBtn) {
    els.addBtn.disabled = !orderable || basePrice <= 0
    els.addBtn.textContent = orderable && basePrice > 0 ? 'Купить' : 'Нет в наличии'
    els.addBtn.classList.toggle('product-detail__buy--unavailable', !orderable || basePrice <= 0)
  }
  updateStockInfo()
  renderWarrantyOptions()
  mountProductInstallmentCalc(els.installmentCalc, getTotalPrice(), store.settings.installment)

  els.colors.querySelectorAll('.color-swatch').forEach((btn, i) => {
    const colorId = product.colors[i].id
    const unavailable = isOptionGrayed('color', colorId)
    const hasStock = product.stock?.some((s) => s.colorId === colorId && s.qty > 0)
    btn.classList.toggle('color-swatch--active', i === selectedColor)
    btn.classList.toggle('color-swatch--instock', !!hasStock)
    btn.classList.toggle('color-swatch--unavailable', unavailable)
  })

  els.storage?.querySelectorAll('.option-btn').forEach((btn, i) => {
    const label = product.storage[i].label
    const unavailable = isOptionGrayed('storage', label)
    const stock = getStockForVariant(product, product.colors[selectedColor].id, getSelectedSimType(), label)
    btn.classList.toggle('option-btn--active', i === selectedStorage)
    btn.classList.toggle('option-btn--instock', stock?.qty > 0)
    btn.classList.toggle('option-btn--unavailable', unavailable)
    const badge = btn.querySelector('.option-btn__stock')
    const next = optionStockBadge(stock)
    if (badge) badge.outerHTML = next
    else if (next) btn.insertAdjacentHTML('beforeend', next)
  })

  els.sizes?.querySelectorAll('.option-btn').forEach((btn, i) => {
    const label = product.sizes[i].label
    const unavailable = isOptionGrayed('storage', label)
    const stock = getStockForVariant(product, product.colors[selectedColor].id, getSelectedSimType(), label)
    btn.classList.toggle('option-btn--active', i === selectedSize)
    btn.classList.toggle('option-btn--instock', stock?.qty > 0)
    btn.classList.toggle('option-btn--unavailable', unavailable)
    const badge = btn.querySelector('.option-btn__stock')
    const next = optionStockBadge(stock)
    if (badge) badge.outerHTML = next
    else if (next) btn.insertAdjacentHTML('beforeend', next)
  })

  els.simTypes?.querySelectorAll('.option-btn').forEach((btn, i) => {
    const sim = product.simTypes[i]
    const unavailable = isOptionGrayed('sim', sim)
    const stock = getStockForVariant(product, product.colors[selectedColor].id, sim, getCurrentStorageLabel())
    btn.classList.toggle('option-btn--active', i === selectedSim)
    btn.classList.toggle('option-btn--instock', stock?.qty > 0)
    btn.classList.toggle('option-btn--unavailable', unavailable)
    const badge = btn.querySelector('.option-btn__stock')
    const next = optionStockBadge(stock)
    if (badge) badge.outerHTML = next
    else if (next) btn.insertAdjacentHTML('beforeend', next)
  })

  els.warranty.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('option-btn--active', i === selectedWarranty)
  })
}

function renderOptions() {
  els.breadcrumb.textContent = product.name
  els.title.textContent = product.name
  els.brand.textContent = product.brand
  els.description.textContent = product.description

  if (product.badge) {
    els.badge.textContent = product.badge
    els.badge.style.display = 'inline-block'
  } else {
    els.badge.style.display = 'none'
  }

  els.colors.innerHTML = product.colors.map((c, i) => `
    <button type="button" class="color-swatch" data-idx="${i}" data-name="${c.name}" aria-label="${c.name}">
      <span class="color-swatch__fill" style="background: ${c.hex}"></span>
    </button>
  `).join('')

  els.colors.querySelectorAll('.color-swatch').forEach((btn) => {
    const idx = Number(btn.dataset.idx)
    bindColorSwatchTip(btn, btn.dataset.name)
    btn.addEventListener('click', () => {
      hideColorTip()
      selectedColor = idx
      updateUI(true)
    })
  })

  if (product.simTypes?.length) {
    els.simGroup.style.display = 'block'
    els.simTypes.innerHTML = product.simTypes.map((s, i) => `
      <button type="button" class="option-btn" data-idx="${i}">${s}</button>
    `).join('')
    els.simTypes.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedSim = Number(btn.dataset.idx)
        updateUI()
      })
    })
  } else {
    els.simGroup.style.display = 'none'
  }

  const hasSizes = product.sizes?.length > 1
  const hasMultipleStorage = product.storage.length > 1 || product.storage[0].label !== 'Стандарт'

  if (hasSizes) {
    els.sizesGroup.style.display = 'block'
    els.sizes.innerHTML = product.sizes.map((s, i) => `
      <button type="button" class="option-btn" data-idx="${i}">${s.label}</button>
    `).join('')
    els.sizes.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedSize = Number(btn.dataset.idx)
        updateUI()
      })
    })
    els.storageGroup.style.display = 'none'
  } else if (hasMultipleStorage) {
    els.sizesGroup.style.display = 'none'
    els.storageGroup.style.display = 'block'
    els.storage.innerHTML = product.storage.map((s, i) => `
      <button type="button" class="option-btn" data-idx="${i}">${s.label}</button>
    `).join('')
    els.storage.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedStorage = Number(btn.dataset.idx)
        updateUI()
      })
    })
  } else {
    els.sizesGroup.style.display = 'none'
    els.storageGroup.style.display = 'none'
  }

  els.warrantyGroup.style.display = 'block'
  selectedColor = getInitialColorIndex(product)
  ensureValidSelection()
  updateUI(true)
}

function addToCart() {
  const color = product.colors[selectedColor]
  const sim = getSelectedSimType()
  const storageLabel = getCurrentStorageLabel()

  if (!isComboOrderable(product, color.id, storageLabel, sim) || getBasePrice() <= 0) {
    showToast('Эта комбинация недоступна для заказа')
    return
  }

  const sizeLabel = product.sizes?.length > 1 ? product.sizes[selectedSize].label : ''
  const warranty = getWarrantyOption()
  const key = makeCartKey(product.id, color.id, storageLabel, sizeLabel, sim) + `|w${warranty.months}`
  const price = getTotalPrice()
  const variantLabel = getVariantLabel()
  const image = getProductImages(product, selectedColor)[0]

  addItem({ key, productId: product.id, name: product.name, image, variantLabel, price, qty: 1 })
  showToast('Товар добавлен в корзину')
  openCart()
}

init()
