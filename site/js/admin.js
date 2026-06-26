import { invalidateStore } from './store.js'
import { THEME_LABELS, getThemeVarKeys } from './theme.js'

const AUTH_KEY = 'airdrop_admin_token'
let storeData = null
let productsData = null
let activeTab = 'general'
let editingProductIdx = null

const TITLES = {
  general: 'Основное',
  contacts: 'Контакты',
  content: 'Тексты сайта',
  links: 'Ссылки',
  navigation: 'Меню',
  categories: 'Категории',
  products: 'Товары',
  theme: 'Темы и цвета',
  installment: 'Рассрочка',
  reviews: 'Отзывы',
  config: 'Конфиги',
}

const $ = (id) => document.getElementById(id)
const val = (id) => $(id)?.value?.trim() ?? ''
const num = (id) => Number(val(id)) || 0

function getToken() { return sessionStorage.getItem(AUTH_KEY) }
function setToken(t) { sessionStorage.setItem(AUTH_KEY, t) }
function clearToken() { sessionStorage.removeItem(AUTH_KEY) }

function loginError(msg) {
  const el = $('login-error')
  if (!msg) { el.hidden = true; el.textContent = ''; return }
  el.textContent = msg
  el.hidden = false
}

function status(msg, type = 'info') {
  const el = $('admin-status')
  el.textContent = msg
  el.className = `admin-status admin-status--${type}`
  if (type === 'success') setTimeout(() => { el.textContent = '' }, 3000)
}

async function loadData() {
  const [sRes, pRes] = await Promise.all([fetch('/api/store'), fetch('/api/products')])
  if (!sRes.ok || !pRes.ok) throw new Error('Сервер недоступен')
  storeData = await sRes.json()
  productsData = await pRes.json()
}

async function saveStore() {
  const res = await fetch('/api/store', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(storeData),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Ошибка сохранения')
  invalidateStore()
  status('Настройки сохранены!', 'success')
}

async function saveProducts() {
  const res = await fetch('/api/products', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(productsData),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Ошибка сохранения товаров')
  invalidateStore()
  status('Товары сохранены!', 'success')
}

function scrollAdminToTop() {
  const content = $('admin-content')
  requestAnimationFrame(() => {
    if (content) {
      content.scrollTop = 0
      content.focus({ preventScroll: true })
    }
    const activeBtn = document.querySelector('.admin-nav__btn--active')
    activeBtn?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    window.scrollTo(0, 0)
  })
}

function showApp() {
  $('login-screen').hidden = true
  $('admin-app').hidden = false
  renderTab()
  scrollAdminToTop()
}

function field(label, id, value = '', type = 'text', hint = '') {
  const input = type === 'textarea'
    ? `<textarea id="${id}" rows="4">${value}</textarea>`
    : `<input type="${type}" id="${id}" value="${escAttr(value)}" />`
  return `<label class="field"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`
}

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function section(title, content) {
  return `<section class="admin-section"><h3 class="admin-section__title">${title}</h3>${content}</section>`
}

function productCategories() {
  return storeData.categories.filter((c) => c.id !== 'all')
}

function categoryLabel(id) {
  return storeData.categories.find((c) => c.id === id)?.label || id
}

function categorySelect(id, selected) {
  const opts = productCategories().map((c) =>
    `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>${c.label}</option>`
  ).join('')
  return `<label class="field"><span>Категория</span><select id="${id}">${opts}</select></label>`
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Login ───
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  loginError('')
  const btn = $('login-submit')
  btn.disabled = true
  btn.textContent = 'Вход...'
  try {
    await loadData()
    if (val('login-password') === storeData.adminPassword) {
      setToken(val('login-password'))
      showApp()
    } else loginError('Неверный пароль')
  } catch {
    loginError('Запустите сервер: bash start.sh')
  } finally {
    btn.disabled = false
    btn.textContent = 'Войти'
  }
})

if (getToken()) loadData().then(showApp).catch(() => { clearToken(); loginError('Войдите снова') })

$('btn-logout')?.addEventListener('click', () => { clearToken(); location.reload() })

$('btn-save')?.addEventListener('click', async () => {
  try {
    collectTab()
    if (activeTab === 'products') await saveProducts()
    else if (activeTab !== 'config') await saveStore()
    else status('Используйте кнопки экспорта/импорта', 'info')
  } catch (err) { status(err.message, 'error') }
})

document.querySelectorAll('.admin-nav__btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (editingProductIdx !== null && activeTab === 'products') collectProduct()
    else collectTab()
    activeTab = btn.dataset.tab
    editingProductIdx = null
    document.querySelectorAll('.admin-nav__btn').forEach((b) => b.classList.toggle('admin-nav__btn--active', b === btn))
    $('tab-title').textContent = TITLES[activeTab]
    $('btn-save').style.display = activeTab === 'config' ? 'none' : ''
    renderTab()
  })
})

// ─── Render tabs ───
function renderTab() {
  const c = $('admin-content')
  if (activeTab === 'general') renderGeneral(c)
  else if (activeTab === 'contacts') renderContacts(c)
  else if (activeTab === 'content') renderContent(c)
  else if (activeTab === 'links') renderLinks(c)
  else if (activeTab === 'navigation') renderNavigation(c)
  else if (activeTab === 'categories') renderCategories(c)
  else if (activeTab === 'products') renderProducts(c)
  else if (activeTab === 'theme') renderTheme(c)
  else if (activeTab === 'installment') renderInstallment(c)
  else if (activeTab === 'reviews') renderReviews(c)
  else if (activeTab === 'config') renderConfig(c)
  scrollAdminToTop()
}

function renderGeneral(c) {
  const s = storeData.settings
  c.innerHTML = section('Магазин', `
    <div class="admin-grid">${field('Название', 'g-name', s.name)}${field('Слоган', 'g-tagline', s.tagline)}${field('Логотип (путь к файлу)', 'g-logo', s.logo)}${field('Бренд для отзывов', 'g-reviewBrand', s.reviewBrand)}</div>
  `) + section('Безопасность', field('Пароль админки', 'g-password', storeData.adminPassword, 'password'))
}

function renderContacts(c) {
  const s = storeData.settings
  c.innerHTML = section('Телефон', `
    <div class="admin-grid">${field('Имя контакта', 'c-name', s.phoneContactName, 'text', 'Отображается на странице контактов')}${field('Телефон', 'c-phone', s.phone)}${field('Телефон (красиво)', 'c-phoneDisplay', s.phoneDisplay)}</div>
  `) + section('Часы работы', `
    <div class="admin-grid">${field('Будни', 'c-hours-wd', s.hours.weekdays)}${field('Выходные', 'c-hours-we', s.hours.weekends)}</div>
  `) + section('Юридическая информация', field('Подпись внизу сайта', 'c-legal', s.legalName)) + section('Адреса магазинов', `
    <div id="addr-list"></div><button type="button" class="btn btn--secondary" id="add-addr">+ Добавить адрес</button>
  `)
  renderAddressList()
  $('add-addr').onclick = () => { storeData.settings.addresses.push({ city: '', street: '', note: '', yandexMaps: '' }); renderAddressList() }
}

function renderAddressList() {
  const wrap = $('addr-list')
  wrap.innerHTML = storeData.settings.addresses.map((a, i) => `
    <div class="admin-card">
      <div class="admin-card__head"><strong>Адрес ${i + 1}</strong><button type="button" class="btn btn--danger btn--sm" data-del-addr="${i}">Удалить</button></div>
      <div class="admin-grid">${field('Город', `a-city-${i}`, a.city)}${field('Улица', `a-street-${i}`, a.street)}${field('Примечание', `a-note-${i}`, a.note)}${field('Яндекс.Карты (ссылка)', `a-maps-${i}`, a.yandexMaps)}</div>
    </div>
  `).join('')
  wrap.querySelectorAll('[data-del-addr]').forEach((b) => {
    b.onclick = () => { storeData.settings.addresses.splice(Number(b.dataset.delAddr), 1); renderAddressList() }
  })
}

function renderContent(c) {
  const s = storeData.settings
  c.innerHTML = section('Главная страница', `
    <div class="admin-grid">${field('Заголовок', 't-heroTitle', s.heroTitle)}${field('Подзаголовок', 't-heroSubtitle', s.heroSubtitle)}${field('Срок заказа', 't-orderDays', s.orderDays)}</div>
    ${field('Текст под заголовком', 't-heroText', s.heroText, 'textarea')}
    ${field('Краткое описание', 't-description', s.description, 'textarea')}
    ${field('Страница «О нас»', 't-about', s.aboutText, 'textarea')}
  `) + section('Почему мы', `
    <div id="why-list"></div><button type="button" class="btn btn--secondary" id="add-why">+ Добавить пункт</button>
  `)
  renderWhyList()
  $('add-why').onclick = () => { storeData.settings.whyUs.push(''); renderWhyList() }
}

function renderWhyList() {
  const wrap = $('why-list')
  wrap.innerHTML = storeData.settings.whyUs.map((item, i) => `
    <div class="admin-row">
      <input type="text" id="why-${i}" value="${escAttr(item)}" placeholder="Пункт ${i + 1}" />
      <button type="button" class="btn btn--danger btn--sm" data-del-why="${i}">✕</button>
    </div>
  `).join('')
  wrap.querySelectorAll('[data-del-why]').forEach((b) => {
    b.onclick = () => { storeData.settings.whyUs.splice(Number(b.dataset.delWhy), 1); renderWhyList() }
  })
}

function renderLinks(c) {
  const l = storeData.settings.links
  c.innerHTML = section('Соцсети', `
    <div class="admin-grid">${field('Telegram', 'l-tg', l.telegram)}${field('ВКонтакте', 'l-vk', l.vk)}${field('VK Market (б/у)', 'l-vkMarket', l.vkMarket)}${field('VK Отзывы', 'l-vkReviews', l.vkReviews)}</div>
  `) + section('Avito', `
    <div class="admin-grid">${field('Карпинск', 'l-avitoK', l.avitoKarpinsk)}${field('Краснотурьинск', 'l-avitoKT', l.avitoKrasnoturinsk)}</div>
  `)
}

function renderNavigation(c) {
  c.innerHTML = section('Пункты меню', `<p class="admin-hint">Перетащите для изменения порядка</p><div id="nav-list"></div><button type="button" class="btn btn--secondary" id="add-nav">+ Пункт</button>`)
  const wrap = $('nav-list')
  wrap.innerHTML = storeData.navigation.map((item, i) => `
    <div class="admin-card admin-card--drag" draggable="true" data-nav="${i}">
      <span class="drag-handle">⠿</span>
      <input type="text" id="nav-label-${i}" value="${escAttr(item.label)}" placeholder="Название" />
      <input type="text" id="nav-href-${i}" value="${escAttr(item.href)}" placeholder="Ссылка (catalog.html)" />
      <button type="button" class="btn btn--danger btn--sm" data-del-nav="${i}">✕</button>
    </div>
  `).join('')
  let dragIdx = null
  wrap.querySelectorAll('[data-nav]').forEach((card) => {
    card.ondragstart = () => { dragIdx = Number(card.dataset.nav) }
    card.ondragover = (e) => e.preventDefault()
    card.ondrop = () => {
      const drop = Number(card.dataset.nav)
      if (dragIdx === null || dragIdx === drop) return
      const [item] = storeData.navigation.splice(dragIdx, 1)
      storeData.navigation.splice(drop, 0, item)
      collectNavigation()
      renderNavigation(c)
    }
  })
  wrap.querySelectorAll('[data-del-nav]').forEach((b) => {
    b.onclick = () => { storeData.navigation.splice(Number(b.dataset.delNav), 1); renderNavigation(c) }
  })
  $('add-nav').onclick = () => { storeData.navigation.push({ id: 'new', label: 'Новый', href: '#' }); renderNavigation(c) }
}

function renderCategories(c) {
  c.innerHTML = section('Категории товаров', `
    <p class="admin-hint">«Все» — системная категория, её нельзя удалить. Перетащите остальные для изменения порядка.</p>
    <div id="cat-list"></div>
    <button type="button" class="btn btn--secondary" id="add-cat">+ Категория</button>
  `)
  const wrap = $('cat-list')
  wrap.innerHTML = storeData.categories.map((cat, i) => {
    const isAll = cat.id === 'all'
    return `
      <div class="admin-card admin-card--drag${isAll ? ' admin-card--fixed' : ''}" ${isAll ? '' : 'draggable="true"'} data-cat="${i}">
        ${isAll ? '<span class="drag-handle drag-handle--disabled">—</span>' : '<span class="drag-handle">⠿</span>'}
        <input type="text" id="cat-id-${i}" value="${escAttr(cat.id)}" placeholder="id" ${isAll ? 'readonly' : ''} />
        <input type="text" id="cat-label-${i}" value="${escAttr(cat.label)}" placeholder="Название" />
        ${isAll ? '' : `<button type="button" class="btn btn--danger btn--sm" data-del-cat="${i}">✕</button>`}
      </div>
    `
  }).join('')

  let dragIdx = null
  wrap.querySelectorAll('[data-cat]').forEach((card) => {
    if (card.classList.contains('admin-card--fixed')) return
    card.ondragstart = () => { dragIdx = Number(card.dataset.cat) }
    card.ondragover = (e) => e.preventDefault()
    card.ondrop = () => {
      const drop = Number(card.dataset.cat)
      if (dragIdx === null || dragIdx === drop || drop === 0) return
      const [item] = storeData.categories.splice(dragIdx, 1)
      storeData.categories.splice(drop, 0, item)
      collectCategories()
      renderCategories(c)
    }
  })
  wrap.querySelectorAll('[data-del-cat]').forEach((b) => {
    b.onclick = () => {
      const idx = Number(b.dataset.delCat)
      const id = storeData.categories[idx].id
      if (productsData.products.some((p) => p.category === id)) {
        status('Сначала переназначьте товары из этой категории', 'error')
        return
      }
      storeData.categories.splice(idx, 1)
      renderCategories(c)
    }
  })
  $('add-cat').onclick = () => {
    storeData.categories.push({ id: `cat-${Date.now()}`, label: 'Новая категория' })
    renderCategories(c)
  }
}

function renderTheme(c) {
  if (!storeData.theme) {
    storeData.theme = { active: 'dark-green', presets: {} }
  }
  const { theme } = storeData
  const presets = Object.entries(theme.presets || {})

  c.innerHTML = section('Активная тема', `
    <div class="theme-presets" id="theme-presets">
      ${presets.map(([id, p]) => `
        <button type="button" class="theme-preset-btn${theme.active === id ? ' theme-preset-btn--active' : ''}" data-preset="${id}">
          <span class="theme-preset-btn__swatch" style="background:${p.bg}; border: 2px solid ${p.accent}"></span>
          ${p.name || id}
        </button>
      `).join('')}
    </div>
  `) + section('Цвета текущей темы', `
    <div class="admin-grid admin-grid--colors" id="theme-colors"></div>
    <p class="admin-hint">Изменения применятся на сайте после сохранения и обновления страницы.</p>
  `)

  const renderColors = () => {
    const preset = theme.presets[theme.active]
    if (!preset) return
    $('theme-colors').innerHTML = getThemeVarKeys().map((key) => {
      const v = preset[key] || ''
      const isColor = /^#[0-9a-f]{3,8}$/i.test(v) || v.startsWith('rgba')
      if (isColor) {
        const hex = v.startsWith('#') ? v : '#4a7c59'
        return `<label class="field field--color"><span>${THEME_LABELS[key] || key}</span>
          <div class="color-input-row"><input type="color" id="th-${key}" value="${hex.length === 7 ? hex : '#4a7c59'}" />
          <input type="text" id="th-text-${key}" value="${escAttr(v)}" /></div></label>`
      }
      return field(THEME_LABELS[key] || key, `th-text-${key}`, v)
    }).join('')

    getThemeVarKeys().forEach((key) => {
      const colorInp = $(`th-${key}`)
      const textInp = $(`th-text-${key}`)
      if (colorInp && textInp) {
        colorInp.oninput = () => { textInp.value = colorInp.value; updatePreview() }
        textInp.oninput = updatePreview
      }
    })
    updatePreview()
  }

  const updatePreview = () => {
    const preset = theme.presets[theme.active]
    if (!preset) return
    getThemeVarKeys().forEach((key) => {
      const v = $(`th-text-${key}`)?.value
      if (v !== undefined) preset[key] = v
    })
  }

  $('theme-presets').querySelectorAll('[data-preset]').forEach((btn) => {
    btn.onclick = () => {
      collectTheme()
      theme.active = btn.dataset.preset
      renderTheme(c)
    }
  })

  renderColors()
}

function renderProducts(c) {
  if (editingProductIdx !== null) { renderProductEditor(c); return }
  const products = productsData.products
  c.innerHTML = `<div class="admin-toolbar"><span>${products.length} товаров</span><button type="button" class="btn btn--primary" id="add-product">+ Добавить товар</button></div><div id="product-list"></div>`
  $('product-list').innerHTML = products.map((p, i) => `
    <div class="admin-product-row">
      <img src="${p.image || 'assets/logo.png'}" alt="" />
      <div><strong>${p.name}</strong><span>${p.brand} · ${categoryLabel(p.category)}</span></div>
      <button type="button" class="btn btn--secondary btn--sm" data-edit="${i}">Изменить</button>
      <button type="button" class="btn btn--danger btn--sm" data-del="${i}">Удалить</button>
    </div>
  `).join('')
  $('product-list').querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => { editingProductIdx = Number(b.dataset.edit); renderProducts(c) }
  })
  $('product-list').querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => { if (confirm('Удалить?')) { productsData.products.splice(Number(b.dataset.del), 1); renderProducts(c) } }
  })
  $('add-product').onclick = () => {
    const id = Math.max(0, ...products.map((p) => p.id)) + 1
    const defaultCat = productCategories()[0]?.id || 'iphone'
    productsData.products.push({
      id, slug: `product-${id}`, name: 'Новый товар', category: defaultCat, brand: 'Apple',
      badge: null, image: '', description: '', simTypes: null, simModifiers: [],
      colors: [{ id: 'black', name: 'Чёрный', hex: '#1a1a1a', priceAdd: 0, image: '' }],
      storage: [{ label: '128 ГБ', price: 0 }], sizes: null, stock: [], variants: [],
    })
    editingProductIdx = productsData.products.length - 1
    renderProducts(c)
  }
}

function renderProductEditor(c) {
  const p = productsData.products[editingProductIdx]
  c.innerHTML = `
    <button type="button" class="btn btn--ghost" id="back-products">← К списку товаров</button>
    <h3 class="admin-editor-title">${p.name}</h3>

    ${section('Основное', `<div class="admin-grid">
      ${field('Название', 'p-name', p.name)}${field('Бренд', 'p-brand', p.brand)}
      ${categorySelect('p-category', p.category)}
      ${field('Бейдж', 'p-badge', p.badge || '', 'text', 'Новинка, Хит, В наличии — или пусто')}
      ${field('Фото (URL или путь)', 'p-image', p.image)}
    </div>
    <label class="btn btn--secondary admin-upload-btn">Загрузить фото<input type="file" id="p-upload" accept="image/*" hidden /></label>
    ${field('Описание', 'p-desc', p.description, 'textarea')}`)}

    ${section('Цвета', `<div id="color-list"></div><button type="button" class="btn btn--secondary" id="add-color">+ Цвет</button>
    <p class="admin-hint">Надбавка к цене — сколько добавить к базовой цене за этот цвет (₽)</p>`)}

    ${section('Память', `<div id="storage-list"></div><button type="button" class="btn btn--secondary" id="add-storage">+ Объём</button>
    <p class="admin-hint">Базовая цена телефона за этот объём памяти</p>`)}

    ${section('Версия SIM', `
      <label class="field field--check"><input type="checkbox" id="p-hasSim" ${p.simTypes?.length ? 'checked' : ''} /> Есть выбор SIM (eSIM / eSIM+SIM)</label>
      <div id="sim-block" ${p.simTypes?.length ? '' : 'hidden'}>
        <div id="sim-list"></div><button type="button" class="btn btn--secondary" id="add-sim">+ Версия SIM</button>
        <p class="admin-hint">Надбавка — доплата за eSIM+SIM относительно eSIM only</p>
      </div>
    `)}

    ${section('Размер (для часов)', `<div id="size-list"></div><button type="button" class="btn btn--secondary" id="add-size">+ Размер</button>
    <p class="admin-hint">Оставьте пустым для телефонов и iPad</p>`)}

    ${section('Наличие', `<div id="stock-list"></div><button type="button" class="btn btn--secondary" id="add-stock">+ Позиция в наличии</button>`)}
  `

  $('back-products').onclick = () => { collectProduct(); editingProductIdx = null; renderProducts(c) }

  const renderColors = () => {
    $('color-list').innerHTML = p.colors.map((col, i) => `
      <div class="admin-card admin-card--compact">
        <div class="admin-grid admin-grid--4">
          <label class="field"><span>Название</span><input type="text" id="col-name-${i}" value="${escAttr(col.name)}" /></label>
          <label class="field"><span>Цвет</span><input type="color" id="col-hex-${i}" value="${col.hex || '#000000'}" /></label>
          <label class="field"><span>Надбавка ₽</span><input type="number" id="col-add-${i}" value="${col.priceAdd || 0}" /></label>
          <button type="button" class="btn btn--danger btn--sm" data-del-col="${i}">Удалить</button>
        </div>
      </div>
    `).join('')
    $('color-list').querySelectorAll('[data-del-col]').forEach((b) => {
      b.onclick = () => { p.colors.splice(Number(b.dataset.delCol), 1); renderColors() }
    })
  }
  renderColors()
  $('add-color').onclick = () => { p.colors.push({ id: `c${Date.now()}`, name: '', hex: '#888888', priceAdd: 0, image: '' }); renderColors() }

  const renderStorage = () => {
    $('storage-list').innerHTML = p.storage.map((s, i) => `
      <div class="admin-row">
        <input type="text" id="stor-label-${i}" value="${escAttr(s.label)}" placeholder="256 ГБ" />
        <input type="number" id="stor-price-${i}" value="${s.price}" placeholder="Цена ₽" />
        <button type="button" class="btn btn--danger btn--sm" data-del-stor="${i}">✕</button>
      </div>
    `).join('')
    $('storage-list').querySelectorAll('[data-del-stor]').forEach((b) => {
      b.onclick = () => { p.storage.splice(Number(b.dataset.delStor), 1); renderStorage() }
    })
  }
  renderStorage()
  $('add-storage').onclick = () => { p.storage.push({ label: '', price: 0 }); renderStorage() }

  if (!p.simModifiers) p.simModifiers = []
  if (!p.simTypes) p.simTypes = []
  const renderSim = () => {
    $('sim-list').innerHTML = p.simTypes.map((t, i) => `
      <div class="admin-row">
        <input type="text" id="sim-type-${i}" value="${escAttr(t)}" placeholder="eSIM only" />
        <input type="number" id="sim-add-${i}" value="${p.simModifiers[i]?.priceAdd || 0}" placeholder="Надбавка ₽" />
        <button type="button" class="btn btn--danger btn--sm" data-del-sim="${i}">✕</button>
      </div>
    `).join('')
    $('sim-list').querySelectorAll('[data-del-sim]').forEach((b) => {
      b.onclick = () => { p.simTypes.splice(Number(b.dataset.delSim), 1); p.simModifiers.splice(Number(b.dataset.delSim), 1); renderSim() }
    })
  }
  renderSim()
  $('p-hasSim').onchange = (e) => { $('sim-block').hidden = !e.target.checked; if (e.target.checked && !p.simTypes.length) { p.simTypes = ['eSIM only', 'eSIM + SIM']; p.simModifiers = [{ type: 'eSIM only', priceAdd: 0 }, { type: 'eSIM + SIM', priceAdd: 8000 }]; renderSim() } }
  $('add-sim').onclick = () => { p.simTypes.push(''); p.simModifiers.push({ type: '', priceAdd: 0 }); renderSim() }

  if (!p.sizes) p.sizes = []
  const renderSizes = () => {
    $('size-list').innerHTML = p.sizes.map((s, i) => `
      <div class="admin-row">
        <input type="text" id="size-label-${i}" value="${escAttr(s.label)}" placeholder="42 мм" />
        <input type="number" id="size-price-${i}" value="${s.price}" placeholder="Цена ₽" />
        <button type="button" class="btn btn--danger btn--sm" data-del-size="${i}">✕</button>
      </div>
    `).join('')
    $('size-list').querySelectorAll('[data-del-size]').forEach((b) => {
      b.onclick = () => { p.sizes.splice(Number(b.dataset.delSize), 1); renderSizes() }
    })
  }
  renderSizes()
  $('add-size').onclick = () => { if (!p.sizes) p.sizes = []; p.sizes.push({ label: '', price: 0 }); renderSizes() }

  if (!p.stock) p.stock = []
  const colorOptions = () => p.colors.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')
  const renderStock = () => {
    $('stock-list').innerHTML = p.stock.map((s, i) => `
      <div class="admin-card admin-card--compact">
        <div class="admin-grid admin-grid--4">
          <label class="field"><span>Цвет</span><select id="stk-color-${i}">${colorOptions()}</select></label>
          <label class="field"><span>SIM</span><input type="text" id="stk-sim-${i}" value="${escAttr(s.simType || '')}" placeholder="eSIM only" /></label>
          <label class="field"><span>Кол-во</span><input type="number" id="stk-qty-${i}" value="${s.qty}" min="0" /></label>
          <button type="button" class="btn btn--danger btn--sm" data-del-stk="${i}">Удалить</button>
        </div>
      </div>
    `).join('')
    p.stock.forEach((s, i) => { const sel = $(`stk-color-${i}`); if (sel) sel.value = s.colorId })
    $('stock-list').querySelectorAll('[data-del-stk]').forEach((b) => {
      b.onclick = () => { p.stock.splice(Number(b.dataset.delStk), 1); renderStock() }
    })
  }
  renderStock()
  $('add-stock').onclick = () => { p.stock.push({ colorId: p.colors[0]?.id || '', simType: '', qty: 1, note: 'В наличии' }); renderStock() }

  $('p-upload').onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ filename: file.name, data: reader.result }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        $('p-image').value = data.path
        status('Фото загружено', 'success')
      } catch (err) { status(err.message, 'error') }
    }
    reader.readAsDataURL(file)
  }
}

function renderInstallment(c) {
  const inst = storeData.settings.installment
  c.innerHTML = section('Рассрочка', field('Описание', 'i-banks', inst.banks, 'textarea')) + section('Комиссии банков', `
    <div id="terms-list"></div><button type="button" class="btn btn--secondary" id="add-term">+ Срок</button>
  `) + section('Долями', `
    <div class="admin-grid">${field('Название', 'i-dol-name', inst.dolyami.name)}${field('Комиссия', 'i-dol-comm', inst.dolyami.commission)}${field('Картинка', 'i-dol-img', inst.dolyami.image)}</div>
    ${field('Описание', 'i-dol-desc', inst.dolyami.description, 'textarea')}
  `)
  const renderTerms = () => {
    $('terms-list').innerHTML = inst.terms.map((t, i) => `
      <div class="admin-row">
        <input type="number" id="term-mo-${i}" value="${t.months}" placeholder="Месяцев" />
        <input type="text" id="term-comm-${i}" value="${escAttr(t.commission)}" placeholder="7%" />
        <button type="button" class="btn btn--danger btn--sm" data-del-term="${i}">✕</button>
      </div>
    `).join('')
    $('terms-list').querySelectorAll('[data-del-term]').forEach((b) => {
      b.onclick = () => { inst.terms.splice(Number(b.dataset.delTerm), 1); renderTerms() }
    })
  }
  renderTerms()
  $('add-term').onclick = () => { inst.terms.push({ months: 6, commission: '12%' }); renderTerms() }
}

function renderReviews(c) {
  const r = storeData.settings.reviews
  c.innerHTML = section('Негативные отзывы (1–3 ★)', `
    <p class="admin-hint">Клиент остаётся внутри — не уходит в интернет</p>
    <div class="admin-grid">${field('Telegram', 'r-neg-tg', r.negative.telegram)}${field('ВКонтакте', 'r-neg-vk', r.negative.vk)}${field('Яндекс.Форма', 'r-neg-form', r.negative.yandexForm)}</div>
  `) + section('Позитивные отзывы (4–5 ★)', `
    <div class="admin-grid">${field('Бонус за отзыв', 'r-bonus', r.positive.bonus)}${field('VK Отзывы', 'r-vk', r.positive.vk)}</div>
    <div class="admin-grid">${field('Avito Карпинск', 'r-avitoK', r.positive.avitoKarpinsk)}${field('Avito Краснотурьинск', 'r-avitoKT', r.positive.avitoKrasnoturinsk)}</div>
    <div class="admin-grid">${field('Яндекс Карпинск', 'r-yk', r.positive.yandexKarpinsk)}${field('Яндекс Краснотурьинск', 'r-ykt', r.positive.yandexKrasnoturinsk)}</div>
  `)
}

function renderConfig(c) {
  c.innerHTML = `
    ${section('Настройки сайта (store.json)', `
      <p class="admin-hint">Меню, контакты, темы, категории, рассрочка, отзывы</p>
      <div class="admin-row admin-row--actions">
        <button type="button" class="btn btn--primary" id="export-store">Скачать store.json</button>
        <label class="btn btn--secondary admin-upload-btn">Импорт store.json<input type="file" id="import-store" accept=".json" hidden /></label>
      </div>
    `)}
    ${section('Товары (products.json)', `
      <p class="admin-hint">Каталог товаров — отдельный файл</p>
      <div class="admin-row admin-row--actions">
        <button type="button" class="btn btn--primary" id="export-products">Скачать products.json</button>
        <label class="btn btn--secondary admin-upload-btn">Импорт products.json<input type="file" id="import-products" accept=".json" hidden /></label>
      </div>
    `)}
  `

  $('export-store').onclick = () => downloadJson('store.json', storeData)
  $('export-products').onclick = () => downloadJson('products.json', productsData)

  $('import-store').onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      storeData = data
      await saveStore()
      renderTab()
    } catch { status('Некорректный JSON', 'error') }
    e.target.value = ''
  }

  $('import-products').onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!data.products) throw new Error('Нет поля products')
      productsData = data
      await saveProducts()
      renderTab()
    } catch (err) { status(err.message || 'Некорректный JSON', 'error') }
    e.target.value = ''
  }
}

// ─── Collect ───
function collectTab() {
  if (!storeData) return
  if (activeTab === 'general') collectGeneral()
  else if (activeTab === 'contacts') collectContacts()
  else if (activeTab === 'content') collectContent()
  else if (activeTab === 'links') collectLinks()
  else if (activeTab === 'navigation') collectNavigation()
  else if (activeTab === 'categories') collectCategories()
  else if (activeTab === 'products' && editingProductIdx !== null) collectProduct()
  else if (activeTab === 'theme') collectTheme()
  else if (activeTab === 'installment') collectInstallment()
  else if (activeTab === 'reviews') collectReviews()
}

function collectGeneral() {
  const s = storeData.settings
  s.name = val('g-name'); s.tagline = val('g-tagline'); s.logo = val('g-logo'); s.reviewBrand = val('g-reviewBrand')
  storeData.adminPassword = val('g-password')
}

function collectContacts() {
  const s = storeData.settings
  s.phoneContactName = val('c-name'); s.phone = val('c-phone'); s.phoneDisplay = val('c-phoneDisplay')
  s.legalName = val('c-legal')
  s.hours.weekdays = val('c-hours-wd'); s.hours.weekends = val('c-hours-we')
  s.addresses.forEach((a, i) => {
    a.city = val(`a-city-${i}`); a.street = val(`a-street-${i}`); a.note = val(`a-note-${i}`); a.yandexMaps = val(`a-maps-${i}`)
  })
}

function collectContent() {
  const s = storeData.settings
  s.heroTitle = val('t-heroTitle'); s.heroSubtitle = val('t-heroSubtitle'); s.orderDays = val('t-orderDays')
  s.heroText = val('t-heroText'); s.description = val('t-description'); s.aboutText = val('t-about')
  s.whyUs = storeData.settings.whyUs.map((_, i) => val(`why-${i}`)).filter(Boolean)
}

function collectLinks() {
  const l = storeData.settings.links
  l.telegram = val('l-tg'); l.vk = val('l-vk'); l.vkMarket = val('l-vkMarket'); l.vkReviews = val('l-vkReviews')
  l.avitoKarpinsk = val('l-avitoK'); l.avitoKrasnoturinsk = val('l-avitoKT')
}

function collectNavigation() {
  storeData.navigation.forEach((item, i) => {
    item.label = val(`nav-label-${i}`); item.href = val(`nav-href-${i}`)
    if (!item.id || item.id === 'new') item.id = item.label.toLowerCase().replace(/\s+/g, '-')
  })
}

function collectCategories() {
  storeData.categories.forEach((cat, i) => {
    if (cat.id !== 'all') cat.id = val(`cat-id-${i}`) || cat.id
    cat.label = val(`cat-label-${i}`)
  })
}

function collectTheme() {
  const { theme } = storeData
  if (!theme?.presets?.[theme.active]) return
  const preset = theme.presets[theme.active]
  getThemeVarKeys().forEach((key) => {
    const v = $(`th-text-${key}`)?.value
    if (v !== undefined) preset[key] = v
  })
}

function collectProduct() {
  const p = productsData.products[editingProductIdx]
  p.name = val('p-name'); p.brand = val('p-brand'); p.category = val('p-category')
  p.badge = val('p-badge') || null; p.image = val('p-image'); p.description = val('p-desc')

  p.colors = p.colors.map((col, i) => ({
    id: col.id || `c${i}`,
    name: val(`col-name-${i}`),
    hex: $(`col-hex-${i}`)?.value || '#000',
    priceAdd: num(`col-add-${i}`),
    image: col.image || '',
  }))

  p.storage = p.storage.map((_, i) => ({ label: val(`stor-label-${i}`), price: num(`stor-price-${i}`) }))

  if ($('p-hasSim')?.checked) {
    p.simTypes = p.simTypes.map((_, i) => val(`sim-type-${i}`)).filter(Boolean)
    p.simModifiers = p.simTypes.map((t, i) => ({ type: t, priceAdd: num(`sim-add-${i}`) }))
  } else {
    p.simTypes = null; p.simModifiers = []
  }

  if (p.sizes?.length) {
    p.sizes = p.sizes.map((_, i) => ({ label: val(`size-label-${i}`), price: num(`size-price-${i}`) }))
    if (!p.sizes.some((s) => s.label)) p.sizes = null
  }

  if (p.stock?.length) {
    p.stock = p.stock.map((_, i) => ({
      colorId: $(`stk-color-${i}`)?.value || '',
      simType: val(`stk-sim-${i}`),
      qty: num(`stk-qty-${i}`),
      note: 'В наличии',
    }))
  }

  p.variants = []
}

function collectInstallment() {
  const inst = storeData.settings.installment
  inst.banks = val('i-banks')
  inst.terms = inst.terms.map((_, i) => ({ months: num(`term-mo-${i}`), commission: val(`term-comm-${i}`) }))
  inst.dolyami.name = val('i-dol-name'); inst.dolyami.commission = val('i-dol-comm')
  inst.dolyami.image = val('i-dol-img'); inst.dolyami.description = val('i-dol-desc')
}

function collectReviews() {
  const r = storeData.settings.reviews
  r.negative.telegram = val('r-neg-tg'); r.negative.vk = val('r-neg-vk'); r.negative.yandexForm = val('r-neg-form')
  r.positive.bonus = val('r-bonus'); r.positive.vk = val('r-vk')
  r.positive.avitoKarpinsk = val('r-avitoK'); r.positive.avitoKrasnoturinsk = val('r-avitoKT')
  r.positive.yandexKarpinsk = val('r-yk'); r.positive.yandexKrasnoturinsk = val('r-ykt')
}
