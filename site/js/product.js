import {
  loadStore, getProductById, getProductBySlug, buildProductHref,
  matchStorageLabel, matchSimType,
  calcPrice, formatPrice, makeCartKey,
  getProductImages, getInitialSelection, getStockForVariant,
  usesSupplierPricing, isComboOrderable, isOptionUnavailable,
} from './store.js'
import { getDisplayStorage, getProductSizeLabels, resolveVariantStorageLabel, shouldShowStorageOptions, shouldShowSizesOptions, shouldShowColorOptions } from './product-options.js'
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
let buyDock = null
let syncBuyDock = () => {}

const els = {}

function applySelectionFromUrl() {
  const params = new URLSearchParams(location.search)
  const colorId = params.get('color')
  if (colorId) {
    const idx = product.colors.findIndex((c) => c.id === colorId || c.id.toLowerCase() === colorId.toLowerCase())
    if (idx >= 0) selectedColor = idx
  }
  const storageParam = params.get('storage')
  if (storageParam) {
    const sizes = getSizeLabels()
    if (sizes.length) {
      const matched = matchStorageLabel(sizes, storageParam)
      const idx = matched ? sizes.indexOf(matched) : -1
      if (idx >= 0) selectedSize = idx
    } else {
      const visible = getDisplayStorage(product)
      const labels = visible.map((s) => s.label)
      const matched = matchStorageLabel(labels, storageParam)
      const idx = matched ? labels.indexOf(matched) : -1
      if (idx >= 0) selectedStorage = idx
    }
  }
  const simParam = params.get('sim')
  if (simParam && product.simTypes?.length) {
    const matched = matchSimType(product.simTypes, simParam)
    const idx = matched ? product.simTypes.indexOf(matched) : -1
    if (idx >= 0) selectedSim = idx
  }
  const w = Number(params.get('w'))
  if (w) {
    const idx = WARRANTY_OPTIONS.findIndex((o) => o.months === w)
    if (idx >= 0) selectedWarranty = idx
  }
}

function syncSelectionToUrl() {
  if (!product) return
  const url = buildProductHref(product, {
    color: product.colors[selectedColor]?.id,
    storage: getCurrentStorageLabel(),
    sim: getSelectedSimType(),
    warranty: getWarrantyOption()?.months,
  })
  const current = `${location.pathname}${location.search}`
  if (current !== url || location.hash) {
    history.replaceState(null, '', url)
  }
}

function initMobileBuyDock() {
  if (!window.matchMedia('(max-width: 768px)').matches) return
  const slot = document.getElementById('buy-bar-slot')
  if (!slot || !els.addBtn || buyDock) return

  buyDock = document.createElement('div')
  buyDock.className = 'product-buy-dock'
  buyDock.hidden = true
  buyDock.innerHTML = `
    <div class="product-buy-dock__price" id="buy-dock-price"></div>
    <button type="button" class="product-detail__buy" id="buy-dock-btn">Купить</button>
  `
  document.body.appendChild(buyDock)

  const dockPrice = buyDock.querySelector('#buy-dock-price')
  const dockBtn = buyDock.querySelector('#buy-dock-btn')
  dockBtn.addEventListener('click', (e) => {
    e.preventDefault()
    els.addBtn?.click()
  })

  syncBuyDock = () => {
    if (!buyDock) return
    if (dockPrice) dockPrice.textContent = els.price?.textContent || ''
    if (dockBtn && els.addBtn) {
      dockBtn.disabled = els.addBtn.disabled
      dockBtn.textContent = els.addBtn.textContent
      dockBtn.className = els.addBtn.className
    }
  }

  const refreshVisibility = (inView) => {
    const cartOpen = document.getElementById('cart-panel')?.classList.contains('cart--open')
    const checkout = document.getElementById('checkout-modal')
    const checkoutOpen = checkout && !checkout.hasAttribute('hidden')
    const lightbox = document.querySelector('.lightbox:not([hidden])')
    const hide = inView || cartOpen || checkoutOpen || !!lightbox
    buyDock.hidden = hide
    document.body.classList.toggle('has-buy-dock', !hide)
  }

  let slotInView = true
  const io = new IntersectionObserver(([entry]) => {
    slotInView = entry.isIntersecting
    refreshVisibility(slotInView)
  }, { threshold: 0.2, rootMargin: '0px 0px -80px 0px' })
  io.observe(slot)

  // прячем dock, когда открыта корзина/лайтбокс
  const mo = new MutationObserver(() => refreshVisibility(slotInView))
  const cartPanel = document.getElementById('cart-panel')
  if (cartPanel) mo.observe(cartPanel, { attributes: true, attributeFilter: ['class'] })
  document.body.addEventListener('click', () => {
    setTimeout(() => refreshVisibility(slotInView), 0)
  }, true)

  syncBuyDock()
}

async function init() {
  store = await loadStore()

  const pathMatch = location.pathname.match(/^\/product\/([^/]+)\/?$/)
  const hashId = Number(location.hash.replace('#', ''))
  if (pathMatch) {
    product = getProductBySlug(store, pathMatch[1])
  }
  if (!product && hashId) {
    product = getProductById(store, hashId)
  }
  if (!product || product.hidden) {
    location.href = '/catalog'
    return
  }

  document.title = `${product.name} — АирДроп`
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
  els.colorsGroup = document.getElementById('group-colors')
  els.storageGroup = document.getElementById('group-storage')
  els.sizesGroup = document.getElementById('group-sizes')
  els.simGroup = document.getElementById('group-sim')
  els.warrantyGroup = document.getElementById('group-warranty')
  els.addBtn = document.getElementById('add-to-cart')
  els.installmentCalc = document.getElementById('product-installment-calc')
  els.colorTip = document.getElementById('color-cursor-tip')
  els.colorSelectionStatus = document.getElementById('color-selection-status')

  gallery = initProductGallery({
    stage: document.getElementById('product-gallery-stage'),
    mainImg: els.photo,
    prevBtn: document.getElementById('gallery-prev'),
    nextBtn: document.getElementById('gallery-next'),
    getImages: () => getProductImages(product, selectedColor),
    getAlt: () => product.name,
  })

  els.addBtn?.addEventListener('click', addToCart)
  initMobileBuyDock()
  renderOptions()
  document.getElementById('product-skeleton')?.setAttribute('hidden', '')
  document.getElementById('product-breadcrumb')?.removeAttribute('hidden')
  document.getElementById('product-detail')?.removeAttribute('hidden')
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

function getAvailabilityStorageLabels() {
  // Ключи из прайса важнее UI-размеров (у часов мм в карточке, а variant.storage может быть «64 ГБ»)
  const fromVariants = [...new Set(
    (product.variants || [])
      .filter((v) => Number(v.purchasePrice) > 0)
      .map((v) => v.storage)
      .filter(Boolean),
  )]
  if (fromVariants.length) return fromVariants
  const sizes = getSizeLabels()
  if (sizes.length) return sizes
  const visible = getDisplayStorage(product).map((s) => s.label).filter(Boolean)
  if (visible.length) return visible
  // У AirPods и т.п. память в UI скрыта, но в прайсе — «Стандарт»
  const resolved = getCurrentStorageLabel()
  return resolved ? [resolved] : ['Стандарт']
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

  const storages = getAvailabilityStorageLabels()

  for (const ci of product.colors.keys()) {
    for (const storageLabel of storages) {
      for (const sim of (product.simTypes?.length ? product.simTypes : [null])) {
        if (isComboOrderable(product, product.colors[ci].id, storageLabel, sim)) {
          selectedColor = ci
          if (getSizeLabels().length) {
            selectedSize = getSizeLabels().findIndex((l) => l === storageLabel)
            if (selectedSize < 0) selectedSize = 0
          } else if (product.sizes?.length > 1) {
            selectedSize = product.sizes.findIndex((s) => s.label === storageLabel)
          } else {
            const visible = getDisplayStorage(product)
            selectedStorage = visible.findIndex((s) => s.label === storageLabel)
            if (selectedStorage < 0) selectedStorage = 0
          }
          if (product.simTypes?.length) selectedSim = product.simTypes.indexOf(sim)
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
  return resolveVariantStorageLabel(product, selectedStorage, selectedSize)
}

function getSizeLabels() {
  return getProductSizeLabels(product)
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
  if (getSizeLabels().length) {
    parts.push(getSizeLabels()[selectedSize]?.label || getCurrentStorageLabel())
  } else if (product.sizes?.length > 1) {
    parts.push(product.sizes[selectedSize].label)
  } else {
    const label = getCurrentStorageLabel()
    if (label) parts.push(label)
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

function isColorFullyUnavailable(colorId) {
  if (!usesSupplierPricing(product)) return false
  if (product.stock?.some((s) => s.colorId === colorId && s.qty > 0)) return false

  const storages = getAvailabilityStorageLabels()
  const sims = product.simTypes?.length ? product.simTypes : [null]

  for (const storageLabel of storages) {
    for (const sim of sims) {
      if (isComboOrderable(product, colorId, storageLabel, sim)) return false
    }
  }
  return true
}

function updateColorSelectionStatus() {
  if (!els.colorSelectionStatus) return
  const color = product.colors[selectedColor]
  if (!color) {
    els.colorSelectionStatus.hidden = true
    return
  }

  // Рядом с цветом — только название; статус «В наличии / Под заказ» только в плашке
  els.colorSelectionStatus.hidden = false
  els.colorSelectionStatus.className = 'color-selection-status'
  els.colorSelectionStatus.innerHTML = `
    <span class="color-selection-status__name">${color.name}</span>
  `
}

function updateStockInfo() {
  if (!els.stockInfo) return
  const color = product.colors[selectedColor]
  if (!color) {
    els.stockInfo.innerHTML = ''
    return
  }

  const simType = getSelectedSimType()
  const storageLabel = getCurrentStorageLabel()
  const orderable = isComboOrderable(product, color.id, storageLabel, simType)
  const stock = getStockForVariant(product, color.id, simType, storageLabel)

  if (!orderable) {
    els.stockInfo.innerHTML = '<span class="stock-badge stock-badge--unavailable">Нет в наличии</span>'
    return
  }
  if (stock?.qty > 0) {
    const qty = stock.qty > 1 ? ` · ${stock.qty} шт.` : ''
    els.stockInfo.innerHTML = `<span class="stock-badge stock-badge--in">В наличии${qty}</span>`
    return
  }
  const days = store.settings.orderDays || '3–5 дней'
  els.stockInfo.innerHTML = `<span class="stock-badge stock-badge--order">Под заказ · ${days}</span>`
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
  syncBuyDock()
  syncSelectionToUrl()
  updateStockInfo()
  updateColorSelectionStatus()
  renderWarrantyOptions()
  mountProductInstallmentCalc(els.installmentCalc, getTotalPrice(), store.settings.installment)

  els.colors.querySelectorAll('.color-swatch').forEach((btn, i) => {
    const colorId = product.colors[i].id
    const unavailable = isColorFullyUnavailable(colorId)
    const inactiveUnavailable = isOptionGrayed('color', colorId)
    const hasStock = product.stock?.some((s) => s.colorId === colorId && s.qty > 0)
    const isActive = i === selectedColor
    const selectedUnavailable = isActive && !isComboOrderable(
      product,
      colorId,
      getCurrentStorageLabel(),
      getSelectedSimType(),
    )

    btn.classList.toggle('color-swatch--active', isActive)
    btn.classList.toggle('color-swatch--instock', !!hasStock)
    // Не зачёркиваем активный доступный цвет; «недоступен» — только если реально нельзя заказать ни в какой комбинации
    // или цвет несовместим с текущими памятью/SIM (и не выбран)
    const showUnavailable = unavailable || (!isActive && inactiveUnavailable)
    btn.classList.toggle('color-swatch--unavailable', showUnavailable)
    btn.classList.toggle('color-swatch--active-unavailable', selectedUnavailable)
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false')
    btn.setAttribute(
      'aria-label',
      `${product.colors[i].name}${unavailable ? ', нет в наличии' : hasStock ? ', в наличии' : ', под заказ'}`,
    )
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
    const label = getSizeLabels()[i] || product.sizes[i]?.label
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

  if (product.badge && product.badge !== 'В наличии') {
    els.badge.textContent = product.badge
    els.badge.style.display = 'inline-block'
  } else if (els.badge) {
    els.badge.style.display = 'none'
  }

  if (els.colorsGroup) {
    els.colorsGroup.style.display = shouldShowColorOptions(product) ? '' : 'none'
  }

  els.colors.innerHTML = product.colors.map((c, i) => `
    <button type="button" class="color-swatch" data-idx="${i}" data-name="${c.name}" aria-label="${c.name}">
      <span class="color-swatch__fill" style="background: ${c.hex}"></span>
      <span class="color-swatch__status" aria-hidden="true"></span>
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

  const visibleStorage = getDisplayStorage(product)
  const hasSizes = shouldShowSizesOptions(product)
  const hasMultipleStorage = shouldShowStorageOptions(product)

  if (hasSizes) {
    const sizeLabels = getSizeLabels()
    els.sizesGroup.style.display = 'block'
    els.sizes.innerHTML = sizeLabels.map((label, i) => `
      <button type="button" class="option-btn" data-idx="${i}">${label}</button>
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
    els.storage.innerHTML = visibleStorage.map((s, i) => `
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
  const initial = getInitialSelection(product)
  selectedColor = initial.colorIdx
  selectedStorage = initial.storageIdx
  selectedSize = initial.sizeIdx
  selectedSim = initial.simIdx
  applySelectionFromUrl()
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

  const sizeLabel = getSizeLabels().length ? getCurrentStorageLabel() : (product.sizes?.length > 1 ? product.sizes[selectedSize].label : '')
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
