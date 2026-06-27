import {
  loadStore, getProductById, calcPrice, formatPrice, makeCartKey,
  getProductImage, getStockForVariant,
} from './store.js'
import { renderHeader, renderFooter } from './layout.js'
import { initCartUI, addItem, openCart, showToast } from './cart-ui.js'

let store, product
let selectedColor = 0
let selectedStorage = 0
let selectedSize = 0
let selectedSim = 0

const els = {}

async function init() {
  const hash = location.hash.replace('#', '')
  const productId = Number(hash)
  if (!productId) {
    location.href = 'catalog.html'
    return
  }

  store = await loadStore()
  product = getProductById(store, productId)
  if (!product) {
    location.href = 'catalog.html'
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
  els.image = document.getElementById('product-image')
  els.badge = document.getElementById('product-badge')
  els.price = document.getElementById('product-price')
  els.stockInfo = document.getElementById('stock-info')
  els.colors = document.getElementById('option-colors')
  els.storage = document.getElementById('option-storage')
  els.sizes = document.getElementById('option-sizes')
  els.simTypes = document.getElementById('option-sim')
  els.storageGroup = document.getElementById('group-storage')
  els.sizesGroup = document.getElementById('group-sizes')
  els.simGroup = document.getElementById('group-sim')
  els.addBtn = document.getElementById('add-to-cart')

  document.getElementById('add-to-cart')?.addEventListener('click', addToCart)
  renderOptions()
}

function getSelectedSimType() {
  if (!product.simTypes?.length) return null
  return product.simTypes[selectedSim]
}

function getCurrentPrice() {
  return calcPrice(product, selectedColor, selectedStorage, selectedSize, getSelectedSimType())
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
  return parts.join(' · ')
}

function updateStockInfo() {
  const colorId = product.colors[selectedColor].id
  const sim = getSelectedSimType()
  const stock = getStockForVariant(product, colorId, sim)

  if (stock && stock.qty > 0) {
    els.stockInfo.innerHTML = `<span class="stock-badge stock-badge--in">✓ В наличии: ${stock.qty} шт.</span>`
    els.stockInfo.style.display = 'block'
  } else if (product.stock?.length) {
    els.stockInfo.innerHTML = `<span class="stock-badge stock-badge--order">Под заказ · ${store.settings.orderDays}</span>`
    els.stockInfo.style.display = 'block'
  } else {
    els.stockInfo.innerHTML = `<span class="stock-badge stock-badge--order">Под заказ · ${store.settings.orderDays}</span>`
    els.stockInfo.style.display = 'block'
  }
}

function updateUI() {
  const img = getProductImage(product, selectedColor)
  els.photo.src = img
  els.photo.alt = product.name
  els.price.textContent = formatPrice(getCurrentPrice())
  updateStockInfo()

  els.colors.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('option-btn--active', i === selectedColor)
  })
  els.storage?.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('option-btn--active', i === selectedStorage)
  })
  els.sizes?.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('option-btn--active', i === selectedSize)
  })
  els.simTypes?.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('option-btn--active', i === selectedSim)
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

  els.colors.innerHTML = product.colors.map((c, i) => {
    const stock = product.stock?.find((s) => s.colorId === c.id)
    const stockLabel = stock?.qty > 0 ? ` <span class="option-stock">(${stock.qty} шт.)</span>` : ''
    return `
    <button class="option-btn option-btn--color" data-idx="${i}" title="${c.name}">
      <span class="option-btn__swatch" style="background: ${c.hex}"></span>
      <span class="option-btn__label">${c.name}${stockLabel}</span>
    </button>
  `}).join('')

  els.colors.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedColor = Number(btn.dataset.idx)
      updateUI()
    })
  })

  if (product.simTypes?.length) {
    els.simGroup.style.display = 'block'
    els.simTypes.innerHTML = product.simTypes.map((s, i) => `
      <button class="option-btn" data-idx="${i}">${s}</button>
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
      <button class="option-btn" data-idx="${i}">${s.label}</button>
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
      <button class="option-btn" data-idx="${i}">${s.label}</button>
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

  updateUI()
}

function addToCart() {
  const color = product.colors[selectedColor]
  const sim = getSelectedSimType()
  const storageLabel = product.sizes?.length > 1
    ? product.sizes[selectedSize].label
    : product.storage[selectedStorage].label
  const sizeLabel = product.sizes?.length > 1 ? product.sizes[selectedSize].label : ''
  const key = makeCartKey(product.id, color.id, storageLabel, sizeLabel, sim)
  const price = getCurrentPrice()
  const variantLabel = getVariantLabel()
  const image = getProductImage(product, selectedColor)

  addItem({ key, productId: product.id, name: product.name, image, variantLabel, price, qty: 1 })
  showToast('Товар добавлен в корзину')
  openCart()
}

init()
