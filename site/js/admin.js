import { invalidateStore } from './store.js'
import { THEME_LABELS, getThemeVarKeys } from './theme.js'
import { calcRetailFromPurchase, recalcAllVariants, getMarkupSettings } from './pricing.js'
import { applySupplierImport } from './supplier-import.js'
import { PDF_IMPORT_SECTIONS, groupPdfImportSections } from './pdf-import-sections.js'
import {
  getDisplayStorage, isPhoneCategory, isWatchCategory, isAccessoryCategory, isMeaningfulStorageLabel,
  productUsesPhoneStorage,
  normalizeWatchSizeLabel,
} from './product-options.js'

const DEFAULT_CATEGORY_LABELS = {
  all: 'Все',
  iphone: 'iPhone',
  ipad: 'iPad',
  macbook: 'MacBook',
  'apple-watch': 'Apple Watch',
  airpods: 'AirPods',
  samsung: 'Samsung',
  xiaomi: 'Xiaomi',
  'galaxy-watch': 'Galaxy Watch',
  huawei: 'Huawei',
}

const DEFAULT_PROMPT_CATEGORY_ROWS = [
  { name: 'iPhone 17 Pro Max', selected: true },
  { name: 'iPhone 17 Pro', selected: true },
  { name: 'iPhone 17', selected: true },
  { name: 'iPhone 17 Air', selected: true },
  { name: 'iPhone 16', selected: true },
  { name: 'iPhone 15 / 14 / 13', selected: true },
  { name: 'Apple iPad', selected: true },
  { name: 'Apple MacBook', selected: true },
  { name: 'Apple Watch S / SE', selected: true },
  { name: 'Apple Watch Ultra', selected: true },
  { name: 'Apple AirPods / Marshall', selected: true },
  { name: 'Apple iPhone (обменки в коробке, не активирован)', selected: false },
  { name: 'Samsung Серия Z', selected: true },
  { name: 'Samsung Серия S26', selected: true },
  { name: 'Samsung Серия S25', selected: true },
  { name: 'Samsung Серия S25Fe', selected: true },
  { name: 'Samsung Серия A', selected: true },
  { name: 'Умные очки Ray Ban', selected: true },
  { name: 'Аксессуары Apple Original', selected: false },
  { name: 'Премиум Аксессуры Pitaka', selected: false },
  { name: 'PlayStation', selected: false },
  { name: 'Игры на PlayStation', selected: false },
  { name: 'Яндекс Станции', selected: false },
  { name: 'Xiaomi', selected: true },
  { name: 'Poco', selected: true },
  { name: 'Huawei', selected: true },
  { name: 'Умные устройства Huawei', selected: true },
  { name: 'Honor', selected: true },
  { name: 'Redmi 15', selected: true },
  { name: 'Наушники Китай', selected: true },
  { name: 'Google', selected: true },
  { name: 'Samsung Watch', selected: true },
  { name: 'JBL и Marshall Колонки', selected: true },
  { name: 'Samsung Buds', selected: true },
  { name: 'Redmi 14', selected: true },
  { name: 'OnePlus', selected: true },
  { name: 'Защитные Стекла', selected: false },
  { name: 'Планшеты', selected: true },
  { name: 'Провода и блоки', selected: false },
  { name: 'Doogee', selected: false },
  { name: 'Камера', selected: false },
  { name: 'Муляжи', selected: false },
  { name: 'Кнопочные Телефоны', selected: false },
  { name: 'Коробки и пакеты', selected: false },
  { name: 'AirPods (запчасти)', selected: false },
  { name: 'Микрофоны', selected: false },
  { name: 'Карты Памяти', selected: false },
  { name: 'USB', selected: false },
  { name: 'SSD', selected: false },
  { name: 'Кнопочные Телефоны Nokia', selected: false },
  { name: 'Power Bank', selected: false },
  { name: 'Проекторы Umiio', selected: false },
  { name: 'Наушники', selected: true },
  { name: 'Мини Телефоны', selected: false },
  { name: 'Ноутбуки', selected: false },
]

function ensureStoreDefaults() {
  if (!storeData) return
  storeData.categories?.forEach((cat) => {
    if (!String(cat.label || '').trim() && DEFAULT_CATEGORY_LABELS[cat.id]) {
      cat.label = DEFAULT_CATEGORY_LABELS[cat.id]
    }
  })
  if (!storeData.categorySortModes || typeof storeData.categorySortModes !== 'object') {
    storeData.categorySortModes = {}
  }
  if (!storeData.priceImport || typeof storeData.priceImport !== 'object') {
    storeData.priceImport = { markupPercent: 15, markupFixed: 0 }
  }
  if (!Array.isArray(storeData.priceImport.promptCategories) || !storeData.priceImport.promptCategories.length) {
    storeData.priceImport.promptCategories = DEFAULT_PROMPT_CATEGORY_ROWS.map((r) => ({ ...r }))
  }
}

const AUTH_KEY = 'airdrop_admin_token'
const DRAFT_KEY = 'airdrop_admin_draft'
let storeData = null
let productsData = null
let activeTab = 'general'
let editingProductIdx = null
let adminProductView = 'active'
let sortCategoryId = null
let draftSaveTimer = null

const TITLES = {
  general: 'Основное',
  contacts: 'Контакты',
  content: 'Тексты сайта',
  links: 'Ссылки',
  navigation: 'Меню',
  categories: 'Категории',
  products: 'Товары',
  'price-import': 'Импорт прайса',
  'price-prompt': 'Промпт для прайса',
  theme: 'Темы и цвета',
  installment: 'Рассрочка',
  orders: 'Заказы',
  reviews: 'Отзывы',
  config: 'Экспорт / импорт',
}

const $ = (id) => document.getElementById(id)
const val = (id) => $(id)?.value?.trim() ?? ''
const num = (id) => Number(val(id)) || 0

function getToken() { return sessionStorage.getItem(AUTH_KEY) }
function setToken(t) { sessionStorage.setItem(AUTH_KEY, t) }
function clearToken() { sessionStorage.removeItem(AUTH_KEY) }

function clearDraft() { sessionStorage.removeItem(DRAFT_KEY) }

function persistDraft() {
  if (!storeData || $('admin-app')?.hidden) return
  try {
    collectTab()
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      storeData,
      productsData,
      activeTab,
      editingProductIdx,
      savedAt: Date.now(),
    }))
  } catch { /* quota */ }
}

function scheduleDraftSave() {
  clearTimeout(draftSaveTimer)
  draftSaveTimer = setTimeout(persistDraft, 500)
}

function flushDraft() {
  clearTimeout(draftSaveTimer)
  persistDraft()
}

function restoreDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return false
    const draft = JSON.parse(raw)
    if (!draft.storeData || !draft.productsData) return false
    storeData = draft.storeData
    productsData = draft.productsData
    if (draft.activeTab) activeTab = draft.activeTab
    editingProductIdx = draft.editingProductIdx ?? null
    ensureStoreDefaults()
    return true
  } catch {
    return false
  }
}

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

async function parseApiJson(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    if (res.status === 404) {
      throw new Error(
        'Сервер устарел (404). Остановите и перезапустите: click-win\\Start.bat или click/Start.command',
      )
    }
    throw new Error(`Ошибка сервера (${res.status}): ${text.slice(0, 160)}`)
  }
}

async function loadData() {
  const headers = getToken() ? { Authorization: `Bearer ${getToken()}` } : {}
  const [sRes, pRes] = await Promise.all([
    fetch('/api/store', { headers }),
    fetch('/api/products'),
  ])
  if (!sRes.ok || !pRes.ok) throw new Error('Сервер недоступен')
  storeData = await sRes.json()
  productsData = await pRes.json()
  ensureStoreDefaults()
}

async function saveStore() {
  const res = await fetch('/api/store', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(storeData),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Ошибка сохранения')
  invalidateStore()
  clearDraft()
  status('Настройки сохранены!', 'success')
}

async function saveProducts() {
  for (const p of productsData.products) cleanupProductForSave(p)
  const res = await fetch('/api/products', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(productsData),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Ошибка сохранения товаров')
  invalidateStore()
  clearDraft()
  status('Товары сохранены!', 'success')
}

function scrollAdminToTop() {
  const content = $('admin-content')
  if (content) {
    content.scrollTop = 0
    content.scrollTo?.(0, 0)
  }
  window.scrollTo(0, 0)
  requestAnimationFrame(() => {
    if (content) content.scrollTop = 0
    window.scrollTo(0, 0)
  })
}

function showLoginScreen(clearSession = false) {
  if (clearSession) {
    flushDraft()
    clearDraft()
    clearToken()
  }
  $('login-screen').hidden = false
  $('admin-app').hidden = true
  document.documentElement.classList.remove('admin-locked')
  document.body.classList.remove('admin-locked')
  showLoginForm()
  $('login-password')?.focus()
}

function showApp() {
  $('login-screen').hidden = true
  $('admin-app').hidden = false
  document.documentElement.classList.add('admin-locked')
  document.body.classList.add('admin-locked')
  document.querySelectorAll('.admin-nav__btn').forEach((b) => {
    b.classList.toggle('admin-nav__btn--active', b.dataset.tab === activeTab)
  })
  $('tab-title').textContent = TITLES[activeTab] || TITLES.general
  $('btn-save').style.display = (activeTab === 'config' || activeTab === 'orders') ? 'none' : ''
  renderTab()
  scrollAdminToTop()
}

function field(label, id, value = '', type = 'text', hint = '') {
  const input = type === 'textarea'
    ? `<textarea id="${id}" rows="4">${value}</textarea>`
    : `<input type="${type}" id="${id}" value="${escAttr(value)}" />`
  return `<label class="field"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`
}

function passwordField(label, id, value = '', options = {}) {
  const visible = options.visible || false
  const inputType = options.alwaysVisible ? 'text' : (visible ? 'text' : 'password')
  return `<label class="field field--password">
    <span>${label}</span>
    <div class="password-input-wrap">
      <input type="${inputType}" id="${id}" value="${escAttr(value)}" ${options.alwaysVisible ? '' : `data-password-toggle="${id}"`} />
      ${options.alwaysVisible ? '' : `<button type="button" class="password-toggle" data-target="${id}" aria-label="Показать пароль">👁</button>`}
    </div>
    ${options.hint ? `<small>${options.hint}</small>` : ''}
  </label>`
}

function bindPasswordToggles(root = document) {
  root.querySelectorAll('.password-toggle').forEach((btn) => {
    btn.onclick = () => {
      const input = $(btn.dataset.target)
      if (!input) return
      const show = input.type === 'password'
      input.type = show ? 'text' : 'password'
      btn.textContent = show ? '🙈' : '👁'
      btn.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль')
    }
  })
}

function showLoginForm() {
  $('login-form').hidden = false
  $('reset-form').hidden = true
  loginError('')
  resetError('')
}

function showResetForm() {
  $('login-form').hidden = true
  $('reset-form').hidden = false
  loginError('')
  resetError('')
}

function resetError(msg) {
  const el = $('reset-error')
  if (!msg) { el.hidden = true; el.textContent = ''; return }
  el.textContent = msg
  el.hidden = false
}

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function section(title, content) {
  return `<section class="admin-section"><h3 class="admin-section__title">${title}</h3>${content}</section>`
}

function betaBadge() {
  return '<span class="admin-badge admin-badge--beta">BETA</span>'
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
  downloadBlob(filename, blob)
}

function downloadBlob(filename, blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

async function downloadFromApi(url, filename, onProgress) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Ошибка ${res.status}`)
  }
  const total = Number(res.headers.get('content-length')) || 0
  if (!res.body || !onProgress) {
    const blob = await res.blob()
    downloadBlob(filename, blob)
    return
  }
  const reader = res.body.getReader()
  const chunks = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (total > 0) onProgress(Math.min(received / total, 1))
    else onProgress(-1)
  }
  onProgress(1)
  downloadBlob(filename, new Blob(chunks))
}

function syncStorageFromEditor(p) {
  if (!$('storage-list')) return
  const prev = [...(p.storage || [])]
  p.storage = prev.map((_, i) => ({ label: $(`stor-label-${i}`)?.value ?? prev[i]?.label ?? '' }))
  p.storage.forEach((s, i) => {
    const oldLabel = prev[i]?.label
    const newLabel = s.label
    if (oldLabel && newLabel && oldLabel !== newLabel) {
      for (const v of p.variants || []) {
        if (v.storage === oldLabel) v.storage = newLabel
      }
    }
  })
}

function cleanupProductForSave(p) {
  if (p.storage) {
    p.storage = p.storage.map((s) => ({ label: String(s.label || '').trim() })).filter((s) => s.label)
    if (productUsesPhoneStorage(p)) {
      p.storage = p.storage.filter((s) => isMeaningfulStorageLabel(s.label))
      p.variants = (p.variants || []).filter((v) => isMeaningfulStorageLabel(v.storage))
    }
  }
}

function formatPdfImportStats(s) {
  const lines = []
  if (s.dryRun) lines.push('Режим: проверка без записи')
  if (s.importFormat) lines.push(`Формат: ${s.importFormat}`)
  if (s.pricesUpdated) lines.push(`Обновлено цен: ${s.pricesUpdated}`)
  if (s.variantsAdded) lines.push(`Добавлено конфигураций: ${s.variantsAdded}`)
  else if (s.variantsUpdated) lines.push(`Обновлено конфигураций: ${s.variantsUpdated}`)
  if (s.variantsRemoved) lines.push(`Удалено устаревших конфигураций: ${s.variantsRemoved}`)
  if (s.productsCreated) lines.push(`Создано карточек: ${s.productsCreated}`)
  if (s.productsUpdated) lines.push(`Товаров затронуто: ${s.productsUpdated}`)
  if (s.skippedVariants) lines.push(`Не сопоставлено конфигураций: ${s.skippedVariants}`)
  if (s.skipped) lines.push(`Строк без товара в каталоге: ${s.skipped}`)
  if (s.unrecognized) lines.push(`Нераспознанных строк: ${s.unrecognized}`)
  if (!lines.length) lines.push(`Обработано строк: ${s.entries ?? 0}`)
  return lines
}

function formatProductSummaryLine(s) {
  const changed = s.variantsBefore !== s.variantsAfter
  const counts = changed ? `${s.variantsBefore} → ${s.variantsAfter} шт` : `${s.variantsAfter} шт`
  const price = s.minPrice != null ? ` · от ${Number(s.minPrice).toLocaleString('ru-RU')} ₽` : ''
  return `${escAttr(s.name)}: ${counts}${price}`
}

function productSelectOptions(selectedId = '') {
  const list = [...(productsData?.products || [])]
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'))
  return [
    '<option value="">— выбрать товар —</option>',
    ...list.map((p) => `<option value="${p.id}"${String(p.id) === String(selectedId) ? ' selected' : ''}>${escAttr(p.name)} (${escAttr(p.category)})</option>`),
  ].join('')
}

function formatImportResultHtml(s, opts = {}) {
  const dry = !!opts.dryRun || !!s.dryRun
  const lines = formatPdfImportStats({ ...s, dryRun: dry })
  let html = `<div class="admin-import-summary${dry ? ' admin-import-summary--dry' : ''}">`
  html += `<strong>${dry ? 'Проверка (каталог не изменён)' : 'Импорт завершён'}</strong>`
  html += `<div class="admin-import-summary__lines">${lines.map((l) => `<div>${escAttr(l)}</div>`).join('')}</div>`
  html += '</div>'

  if (s.productSummaries?.length) {
    const sorted = [...s.productSummaries].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    const rows = sorted.map((row) => `<div>${formatProductSummaryLine(row)}</div>`).join('')
    html += `<details class="admin-import-report" open><summary>По товарам (${sorted.length})</summary>${rows}</details>`
  }

  const unresolved = [
    ...(s.unrecognizedNames || []),
    ...(s.notFound || []),
  ].filter(Boolean)
  const uniqueUnresolved = [...new Set(unresolved)]

  if (uniqueUnresolved.length) {
    html += `<details class="admin-import-report admin-import-report--warn" open>
      <summary>Не распознано / нет в каталоге (${uniqueUnresolved.length})</summary>
      <p class="admin-hint">Привяжите имя из прайса к карточке — оно добавится в «Названия в прайсе». После этого повторите импорт.</p>
      ${uniqueUnresolved.map((name) => `
        <div class="admin-import-bind-row" data-bind-name="${escAttr(name)}">
          <code class="admin-import-bind-name">${escAttr(name)}</code>
          <select class="admin-import-bind-select">${productSelectOptions()}</select>
          <button type="button" class="btn btn--secondary btn--sm admin-import-bind-btn">Привязать</button>
        </div>
      `).join('')}
    </details>`
  }

  if (s.skippedVariantSamples?.length && !uniqueUnresolved.length) {
    html += `<details class="admin-import-report"><summary>Примеры несопоставленных конфигураций</summary>${s.skippedVariantSamples.slice(0, 8).map((n) => `<div>${escAttr(n)}</div>`).join('')}</details>`
  }
  return html
}

function bindImportSkipHandlers(rootEl) {
  rootEl?.querySelectorAll('.admin-import-bind-btn').forEach((btn) => {
    btn.onclick = async () => {
      const row = btn.closest('.admin-import-bind-row')
      const name = row?.dataset.bindName || ''
      const productId = Number(row?.querySelector('.admin-import-bind-select')?.value)
      if (!name || !productId) {
        status('Выберите товар для привязки', 'error')
        return
      }
      const product = productsData.products.find((p) => p.id === productId)
      if (!product) {
        status('Товар не найден', 'error')
        return
      }
      const aliases = String(product.importNames || '')
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (!aliases.some((a) => a.toLowerCase() === name.toLowerCase())) {
        aliases.push(name)
        product.importNames = aliases.join(', ')
      }
      try {
        await saveProducts()
        row.classList.add('admin-import-bind-row--done')
        btn.textContent = 'Готово'
        btn.disabled = true
        status(`Привязано к «${product.name}» — можно повторить импорт`, 'success')
      } catch (err) {
        status(err.message, 'error')
      }
    }
  })
}

function validateProductStorage(p) {
  const labels = new Set(
    (p.storage || []).map((s) => String(s.label || '').trim()).filter(Boolean),
  )
  if (!labels.size) return null
  for (const v of p.variants || []) {
    if (v.storage && !labels.has(v.storage)) {
      return `В прайсе есть «${v.storage}», но такого объёма нет в блоке «Память». Добавьте или переименуйте.`
    }
  }
  return null
}

function getStorageLabelsFromEditor(p) {
  const labels = (p.storage || []).map((s, i) => {
    const inp = $(`stor-label-${i}`)
    return (inp ? inp.value : s.label || '').trim()
  }).filter((l) => l && (isPhoneCategory(p.category) ? isMeaningfulStorageLabel(l) : true))
  const fromVariants = (p.variants || []).map((v) => v.storage).filter(Boolean)
  return [...new Set([...labels, ...fromVariants])]
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}

// ─── Login ───
$('login-forgot')?.addEventListener('click', () => showResetForm())
$('reset-back')?.addEventListener('click', () => showLoginForm())

$('reset-request-code')?.addEventListener('click', async () => {
  resetError('')
  const btn = $('reset-request-code')
  btn.disabled = true
  btn.textContent = 'Отправка...'
  try {
    const res = await fetch('/api/admin/request-reset-code', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Не удалось отправить код')
    status('Код отправлен в Telegram', 'success')
  } catch (err) {
    resetError(err.message)
  } finally {
    btn.disabled = false
    btn.textContent = 'Получить код в Telegram'
  }
})

$('reset-form')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  resetError('')
  const btn = $('reset-submit')
  btn.disabled = true
  try {
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: val('reset-code'),
        password: val('reset-password'),
        confirm: val('reset-confirm'),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Ошибка сброса')
    setToken(val('reset-password'))
    await loadData()
    showApp()
    status('Пароль изменён', 'success')
  } catch (err) {
    resetError(err.message)
  } finally {
    btn.disabled = false
  }
})

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  loginError('')
  const btn = $('login-submit')
  const password = val('login-password')
  if (!password) return

  btn.disabled = true
  btn.textContent = 'Вход...'
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.status === 404) {
      loginError('Сервер нужно перезапустить: bash dev.sh')
      return
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      loginError(data.error || 'Неверный пароль')
      return
    }
    setToken(password)
    await loadData()
    showApp()
  } catch {
    loginError('Сервер недоступен. Запустите: bash dev.sh')
  } finally {
    btn.disabled = false
    btn.textContent = 'Войти'
  }
})

bindPasswordToggles()

document.addEventListener('input', (e) => {
  if (e.target.closest('#admin-content')) scheduleDraftSave()
}, true)
document.addEventListener('change', (e) => {
  if (e.target.closest('#admin-content')) scheduleDraftSave()
}, true)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushDraft()
})
window.addEventListener('pagehide', flushDraft)
document.addEventListener('pageshow', (e) => {
  if (e.persisted && getToken() && storeData) {
    restoreDraft()
    renderTab()
    status('Черновик восстановлен', 'info')
  }
})

async function initAdmin() {
  if (getToken()) {
    try {
      await loadData()
      const hadDraft = restoreDraft()
      showApp()
      if (hadDraft) status('Восстановлен несохранённый черновик', 'info')
      return
    } catch {
      clearToken()
      clearDraft()
    }
  }
  showLoginScreen()
}

initAdmin()

$('btn-logout')?.addEventListener('click', () => {
  showLoginScreen(true)
  $('login-password').value = ''
})

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
    $('btn-save').style.display = (activeTab === 'config' || activeTab === 'orders') ? 'none' : ''
    renderTab()
  })
})

function formatRelativeAgo(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (diffSec < 60) return 'только что'
  const mins = Math.floor(diffSec / 60)
  if (mins < 60) return `${mins} мин. назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч. назад`
  const days = Math.floor(hours / 24)
  return `${days} дн. назад`
}

function formatWhenWithAgo(iso) {
  if (!iso) return 'ещё не было'
  const abs = new Date(iso).toLocaleString('ru-RU')
  const ago = formatRelativeAgo(iso)
  return ago ? `${ago} · ${abs}` : abs
}

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
  else if (activeTab === 'price-import') renderPriceImport(c)
  else if (activeTab === 'price-prompt') renderPricePrompt(c)
  else if (activeTab === 'theme') renderTheme(c)
  else if (activeTab === 'installment') renderInstallment(c)
  else if (activeTab === 'orders') renderOrders(c)
  else if (activeTab === 'reviews') renderReviews(c)
  else if (activeTab === 'config') renderConfig(c)
  scrollAdminToTop()
}

function renderGeneral(c) {
  const s = storeData.settings
  const pi = storeData.priceImport || {}
  c.innerHTML = section('Статус сервера', `
    <div class="admin-status-panel" id="server-status-panel">
      <div class="admin-status-row"><span>Сайт поднят</span><strong id="server-started-at">загрузка…</strong></div>
      <div class="admin-status-row"><span>Последний текстовый импорт прайса</span><strong>${escAttr(formatWhenWithAgo(pi.lastTextImportAt))}</strong></div>
      <div class="admin-status-row"><span>Последний PDF-импорт прайса</span><strong>${escAttr(formatWhenWithAgo(pi.lastImportAt))}</strong></div>
    </div>
  `) + section('Магазин', `
    <div class="admin-grid">${field('Название', 'g-name', s.name)}${field('Слоган', 'g-tagline', s.tagline)}${field('Логотип (путь к файлу)', 'g-logo', s.logo)}${field('Бренд для отзывов', 'g-reviewBrand', s.reviewBrand)}</div>
  `) + section('Безопасность', `
    ${passwordField('Текущий пароль', 'g-password-view', storeData.adminPassword, { hint: 'Нажмите 👁 чтобы показать или скрыть' })}
    <div class="admin-password-change">
      <p class="admin-hint">Смена пароля требует код из Telegram (защита от взлома).</p>
      <div class="admin-grid">
        ${passwordField('Новый пароль', 'g-password-new', '', { hint: 'Минимум 6 символов' })}
        ${passwordField('Повторите пароль', 'g-password-confirm', '', { alwaysVisible: true, hint: 'Второй раз — открытым текстом' })}
        ${field('Код из Telegram', 'g-change-code', '', 'text', 'Запросите код кнопкой ниже')}
      </div>
      <div class="admin-row admin-row--actions">
        <button type="button" class="btn btn--secondary" id="btn-request-change-code">Получить код в Telegram</button>
        <button type="button" class="btn btn--primary" id="btn-change-password">Сменить пароль</button>
      </div>
    </div>
  `)
  bindPasswordToggles(c)

  fetch('/api/ping')
    .then((r) => r.json())
    .then((data) => {
      const el = $('server-started-at')
      if (el && data?.startedAt) el.textContent = formatWhenWithAgo(data.startedAt)
    })
    .catch(() => {
      const el = $('server-started-at')
      if (el) el.textContent = 'не удалось получить'
    })

  $('btn-request-change-code').onclick = async () => {
    try {
      const res = await fetch('/api/admin/request-change-code', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Ошибка')
      status('Код отправлен в Telegram', 'success')
    } catch (err) { status(err.message, 'error') }
  }

  $('btn-change-password').onclick = async () => {
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          code: val('g-change-code'),
          password: val('g-password-new'),
          confirm: val('g-password-confirm'),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Ошибка')
      setToken(val('g-password-new'))
      storeData.adminPassword = val('g-password-new')
      $('g-password-view').value = val('g-password-new')
      $('g-password-new').value = ''
      $('g-password-confirm').value = ''
      $('g-change-code').value = ''
      status('Пароль изменён', 'success')
    } catch (err) { status(err.message, 'error') }
  }
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
  if ($('addr-list')?.childElementCount) collectContacts()
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
  if ($('why-list')?.childElementCount) collectContent()
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
      <input type="text" id="nav-href-${i}" value="${escAttr(item.href)}" placeholder="Ссылка (/catalog)" />
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
    b.onclick = () => { collectNavigation(); storeData.navigation.splice(Number(b.dataset.delNav), 1); renderNavigation(c) }
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

function categoriesForSort() {
  return (storeData.categories || []).filter((cat) => cat.id !== 'all')
}

function renderSortOrderList(categoryId) {
  const wrap = $('sort-order-list')
  if (!wrap) return
  const items = productsData.products
    .filter((p) => p.category === categoryId)
    .sort((a, b) => {
      const oa = typeof a.order === 'number' ? a.order : Infinity
      const ob = typeof b.order === 'number' ? b.order : Infinity
      if (oa !== ob) return oa - ob
      return a.name.localeCompare(b.name, 'ru')
    })
  if (!items.length) {
    wrap.innerHTML = '<p class="admin-hint">В этой категории пока нет товаров.</p>'
    return
  }
  wrap.innerHTML = `<p class="admin-hint">Перетащите товары, чтобы задать порядок отображения в каталоге.</p>` +
    items.map((p, i) => `
      <div class="admin-card admin-card--drag" draggable="true" data-order-idx="${i}">
        <span class="drag-handle">⠿</span>
        <img src="${p.image || 'assets/logo.png'}" alt="" class="admin-sort-order-list__img" />
        <span class="admin-sort-order-list__name">${escAttr(p.name)}${p.hidden ? ' <em>(скрыт)</em>' : ''}</span>
      </div>
    `).join('')
  let dragIdx = null
  wrap.querySelectorAll('[data-order-idx]').forEach((card) => {
    card.ondragstart = () => { dragIdx = Number(card.dataset.orderIdx) }
    card.ondragover = (e) => e.preventDefault()
    card.ondrop = async () => {
      const drop = Number(card.dataset.orderIdx)
      if (dragIdx === null || dragIdx === drop) return
      const [item] = items.splice(dragIdx, 1)
      items.splice(drop, 0, item)
      items.forEach((p, idx) => { p.order = idx })
      renderSortOrderList(categoryId)
      try { await saveProducts() } catch (err) { status(err.message, 'error') }
    }
  })
}

function renderProducts(c) {
  if (editingProductIdx !== null) { renderProductEditor(c); return }
  scrollAdminToTop()
  const all = productsData.products
  const hiddenCount = all.filter((p) => p.hidden).length
  const newCount = all.filter((p) => p.isNew).length
  const activeCount = all.length - hiddenCount
  const products = all.filter((p) => {
    if (adminProductView === 'hidden') return p.hidden
    if (adminProductView === 'new') return p.isNew
    return !p.hidden
  })
  const sortCats = categoriesForSort()
  if (!sortCategoryId || !sortCats.some((cat) => cat.id === sortCategoryId)) {
    sortCategoryId = sortCats[0]?.id || null
  }
  const sortMode = sortCategoryId ? (storeData.categorySortModes?.[sortCategoryId] === 'manual' ? 'manual' : 'auto') : 'auto'
  c.innerHTML = `
    <div class="admin-toolbar admin-toolbar--products">
      <div class="admin-product-tabs">
        <button type="button" class="btn btn--sm ${adminProductView === 'active' ? 'btn--primary' : 'btn--ghost'}" id="products-tab-active">Товары (${activeCount})</button>
        <button type="button" class="btn btn--sm ${adminProductView === 'hidden' ? 'btn--primary' : 'btn--ghost'}" id="products-tab-hidden">Скрытые (${hiddenCount})</button>
        ${newCount ? `<button type="button" class="btn btn--sm ${adminProductView === 'new' ? 'btn--primary' : 'btn--ghost'}" id="products-tab-new">Новые (${newCount})</button>` : ''}
      </div>
      <button type="button" class="btn btn--primary" id="add-product">+ Добавить товар</button>
    </div>
    <div class="admin-sort-bar">
      <label class="admin-sort-bar__cat">Порядок в категории
        <select id="sort-cat-select">${sortCats.map((cat) => `<option value="${cat.id}" ${cat.id === sortCategoryId ? 'selected' : ''}>${escAttr(cat.label)}</option>`).join('')}</select>
      </label>
      <div class="admin-sort-bar__modes">
        <button type="button" class="btn btn--sm ${sortMode === 'auto' ? 'btn--primary' : 'btn--ghost'}" id="sort-mode-auto">Авто · по цене</button>
        <button type="button" class="btn btn--sm ${sortMode === 'manual' ? 'btn--primary' : 'btn--ghost'}" id="sort-mode-manual">Ручной порядок</button>
      </div>
    </div>
    ${sortMode === 'manual' ? '<div id="sort-order-list" class="admin-sort-order-list"></div>' : ''}
    <div id="product-list"></div>`
  $('products-tab-active').onclick = () => { adminProductView = 'active'; renderProducts(c) }
  $('products-tab-hidden').onclick = () => { adminProductView = 'hidden'; renderProducts(c) }
  if ($('products-tab-new')) $('products-tab-new').onclick = () => { adminProductView = 'new'; renderProducts(c) }
  if (sortCats.length) {
    $('sort-cat-select').onchange = (e) => { sortCategoryId = e.target.value; renderProducts(c) }
    $('sort-mode-auto').onclick = async () => {
      storeData.categorySortModes = storeData.categorySortModes || {}
      storeData.categorySortModes[sortCategoryId] = 'auto'
      renderProducts(c)
      try { await saveStore() } catch (err) { status(err.message, 'error') }
    }
    $('sort-mode-manual').onclick = async () => {
      storeData.categorySortModes = storeData.categorySortModes || {}
      storeData.categorySortModes[sortCategoryId] = 'manual'
      renderProducts(c)
      try { await saveStore() } catch (err) { status(err.message, 'error') }
    }
    if (sortMode === 'manual') renderSortOrderList(sortCategoryId)
  }
  $('product-list').innerHTML = products.map((p) => {
    const i = all.indexOf(p)
    const markup = `${p.markupPercent ?? 15}%${p.markupFixed ? ` + ${p.markupFixed} ₽` : ''}`
    const rowClass = p.hidden ? ' admin-product-row--hidden' : ''
    const touchedIds = storeData.priceImport?.lastTouchedProductIds || []
    const inLastImport = touchedIds.includes(p.id)
    const importBadge = p.lastPriceImportAt
      ? `<span class="admin-badge admin-badge--import" title="${escAttr(new Date(p.lastPriceImportAt).toLocaleString('ru-RU'))}">Импорт ${escAttr(formatRelativeAgo(p.lastPriceImportAt))}</span>`
      : (inLastImport ? '<span class="admin-badge admin-badge--import">В последнем импорте</span>' : '')
    return `
    <div class="admin-product-row${rowClass}">
      <img src="${p.image || 'assets/logo.png'}" alt="" />
      <div><strong>${p.name}${p.isNew ? ' <span class="admin-badge admin-badge--new">Новое</span>' : ''}${importBadge ? ` ${importBadge}` : ''}</strong><span>${p.brand} · ${categoryLabel(p.category)} · наценка ${markup}${p.hidden ? ' · скрыт' : ''}</span></div>
      <button type="button" class="btn btn--secondary btn--sm" data-edit="${i}">Изменить</button>
      <button type="button" class="btn btn--ghost btn--sm" data-toggle-hidden="${i}">${p.hidden ? 'Вернуть' : 'Скрыть'}</button>
      <button type="button" class="btn btn--danger btn--sm" data-del="${i}">Удалить</button>
    </div>
  `}).join('') || `<p class="admin-hint">${adminProductView === 'hidden' ? 'Скрытых товаров нет' : adminProductView === 'new' ? 'Новых товаров нет' : 'Товаров нет'}</p>`
  $('product-list').querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => { editingProductIdx = Number(b.dataset.edit); renderProducts(c) }
  })
  $('product-list').querySelectorAll('[data-toggle-hidden]').forEach((b) => {
    b.onclick = async () => {
      const idx = Number(b.dataset.toggleHidden)
      const p = productsData.products[idx]
      p.hidden = !p.hidden
      if (!p.hidden) p.isNew = false
      renderProducts(c)
      try {
        await saveProducts()
        status(p.hidden ? 'Товар скрыт с сайта' : 'Товар снова в каталоге', 'success')
      } catch (err) { status(err.message, 'error') }
    }
  })
  $('product-list').querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => { if (confirm('Удалить?')) { productsData.products.splice(Number(b.dataset.del), 1); renderProducts(c) } }
  })
  $('add-product').onclick = () => {
    const id = Math.max(0, ...all.map((p) => p.id)) + 1
    const defaultCat = productCategories()[0]?.id || 'iphone'
    productsData.products.push({
      id, slug: `product-${id}`, name: 'Новый товар', category: defaultCat, brand: 'Apple',
      badge: null, image: '', description: '', simTypes: null, simModifiers: [],
      colors: [{ id: 'black', name: 'Чёрный', hex: '#1a1a1a', image: '', importNames: '' }],
      storage: [{ label: '128 ГБ' }], sizes: null, stock: [], images: [], variants: [],
      markupPercent: 15,
      markupFixed: 0,
      showCatalogSpec: false,
      hidden: false,
      importNames: '',
    })
    editingProductIdx = productsData.products.length - 1
    adminProductView = 'active'
    renderProducts(c)
  }
}

function renderProductEditor(c) {
  scrollAdminToTop()
  const p = productsData.products[editingProductIdx]
  if (!p.images) p.images = p.image ? [p.image] : []
  const showStorage = !isAccessoryCategory(p.category) || getDisplayStorage(p).length > 0
  const showSizes = isWatchCategory(p.category) || (p.sizes?.length > 0)
  const showSim = isPhoneCategory(p.category) || p.simTypes?.length > 0

  c.innerHTML = `
    <div class="admin-editor-toolbar">
      <button type="button" class="btn btn--ghost" id="back-products">← К списку</button>
      <button type="button" class="btn btn--primary" id="save-product">Сохранить товар</button>
    </div>
    <h3 class="admin-editor-title">${p.name}</h3>

    ${section('Основное', `<div class="admin-grid">
      ${field('Название', 'p-name', p.name)}${field('Бренд', 'p-brand', p.brand)}
      ${categorySelect('p-category', p.category)}
      ${field('Бейдж', 'p-badge', p.badge || '', 'text', 'Новинка, Хит — или пусто')}
    </div>
    <label class="field field--check"><input type="checkbox" id="p-showCatalogSpec" ${p.showCatalogSpec ? 'checked' : ''} /> Показывать «В наличии / Под заказ» на карточке в каталоге</label>
    <label class="field field--check"><input type="checkbox" id="p-hidden" ${p.hidden ? 'checked' : ''} /> Скрыть с сайта (останется в разделе «Скрытые»)</label>
    ${field('Названия в прайсе', 'p-importNames', p.importNames || '', 'text', 'Samsung Galaxy S26 Plus, Galaxy S26+')}
    <p class="admin-hint">Если в текстовом прайсе товар называется иначе — укажите здесь через запятую. Импорт сопоставит строки с этой карточкой.</p>
    ${field('Описание', 'p-desc', p.description, 'textarea')}`)}

    ${section('Галерея и главное фото', `
      <div id="gallery-list" class="admin-gallery-list"></div>
      <div class="admin-row admin-row--actions">
        <label class="btn btn--secondary admin-upload-btn">Загрузить фото<input type="file" id="p-gallery-upload" accept="image/*" multiple hidden /></label>
        <button type="button" class="btn btn--ghost" id="add-gallery-url">+ URL</button>
      </div>
      <p class="admin-hint">★ — главное фото для каталога. На странице товара фото листаются и открываются на весь экран.</p>
    `)}

    ${section('Цвета', `<div id="color-list"></div><button type="button" class="btn btn--secondary" id="add-color">+ Цвет</button>
    <p class="admin-hint">Перетащите цвет за ⠿, чтобы изменить порядок на сайте. В «Названиях в прайсе» — как у поставщика.</p>`)}

    ${showStorage ? section('Память', `<div id="storage-list"></div><button type="button" class="btn btn--secondary" id="add-storage">+ Объём</button>
    <p class="admin-hint">256 ГБ, 512 ГБ, 1 ТБ. Цены — в блоке прайса ниже.</p>`) : ''}

    ${showSim ? section('Версия SIM', `
      <label class="field field--check"><input type="checkbox" id="p-hasSim" ${p.simTypes?.length ? 'checked' : ''} /> Есть выбор SIM (eSIM / eSIM+SIM)</label>
      <div id="sim-block" ${p.simTypes?.length ? '' : 'hidden'}>
        <div id="sim-list"></div><button type="button" class="btn btn--secondary" id="add-sim">+ Версия SIM</button>
      </div>
    `) : ''}

    ${section('Прайс-лист поставщика', `
      <div class="admin-grid">
        <label class="field"><span>Наценка, %</span><input type="number" id="p-markup" value="${p.markupPercent ?? 15}" min="0" step="0.1" /></label>
        <label class="field"><span>Наценка фикс., ₽</span><input type="number" id="p-markup-fixed" value="${p.markupFixed ?? 0}" min="0" step="100" /></label>
      </div>
      <label class="field"><span>Вставить прайс (только этот товар)</span>
        <textarea id="p-supplier-paste" rows="6" placeholder="17 Pro Max 256Gb Silver (eSim+eSim) = 98 800 ₽"></textarea>
      </label>
      <p class="admin-hint">Импорт обновит цены из прайса и <strong>удалит комбинации, которых в прайсе больше нет</strong> (их нельзя заказать).</p>
      <div class="admin-row admin-row--actions">
        <button type="button" class="btn btn--primary" id="import-supplier">Импортировать и убрать лишние</button>
        <button type="button" class="btn btn--ghost" id="clear-variants">Очистить все цены</button>
        <button type="button" class="btn btn--ghost" id="recalc-variants">Пересчитать розницу</button>
      </div>
      <p class="admin-hint" id="import-result"></p>
      <div id="variant-list"></div>
      <button type="button" class="btn btn--secondary" id="add-variant">+ Позиция вручную</button>
    `)}

    ${showSizes ? section('Размер (часы)', `<div id="size-list"></div><button type="button" class="btn btn--secondary" id="add-size">+ Размер</button>
    <p class="admin-hint">Введите число (42, 46) — «мм» допишется автоматически. Цены задаются в прайсе ниже.</p>`) : ''}

    ${section('Наличие на складе', `<div id="stock-list"></div><button type="button" class="btn btn--secondary" id="add-stock">+ Позиция в наличии</button>
    <p class="admin-hint">Только то, что реально есть у вас в магазине</p>`)}
  `

  $('save-product').onclick = async () => {
    collectProduct()
    const storageErr = validateProductStorage(productsData.products[editingProductIdx])
    if (storageErr) { status(storageErr, 'error'); return }
    try {
      await saveProducts()
      status('Товар сохранён', 'success')
    } catch (err) { status(err.message, 'error') }
  }

  $('back-products').onclick = () => {
    collectProduct()
    adminProductView = p.hidden ? 'hidden' : 'active'
    editingProductIdx = null
    renderProducts(c)
  }

  const uploadImage = async (file) => {
    const reader = new FileReader()
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ filename: file.name, data: reader.result }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          resolve(data.path)
        } catch (err) { reject(err) }
      }
      reader.readAsDataURL(file)
    })
  }

  const syncGalleryFromDom = () => {
    if (!$('gallery-list')?.childElementCount) return
    p.images = (p.images || []).map((_, i) => val(`gal-url-${i}`) || p.images[i]).filter(Boolean)
  }

  const renderGallery = (opts = {}) => {
    if (!opts.skipCollect) syncGalleryFromDom()
    if (!p.coverImage) p.coverImage = p.image || p.images?.[0] || ''
    $('gallery-list').innerHTML = p.images.map((src, i) => {
      const isCover = p.coverImage && src === p.coverImage
      return `
      <div class="admin-gallery-item${isCover ? ' admin-gallery-item--cover' : ''}">
        <img src="${escAttr(src)}" alt="" class="admin-gallery-item__preview" />
        <input type="text" id="gal-url-${i}" value="${escAttr(src)}" placeholder="assets/products/..." />
        <div class="admin-gallery-item__actions">
          <button type="button" class="btn btn--ghost btn--sm${isCover ? ' admin-gallery-item__cover-btn--active' : ''}" data-gal-cover="${i}" title="Главное фото">★</button>
          <button type="button" class="btn btn--ghost btn--sm" data-gal-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn btn--ghost btn--sm" data-gal-down="${i}" ${i === p.images.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="btn btn--danger btn--sm" data-del-gal="${i}">✕</button>
        </div>
      </div>
    `}).join('') || '<p class="admin-hint">Пока нет фото в галерее</p>'

    $('gallery-list').querySelectorAll('[data-gal-cover]').forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.galCover)
        const src = val(`gal-url-${i}`) || p.images[i]
        if (src) {
          p.coverImage = src
          p.image = src
          renderGallery({ skipCollect: true })
          const colorMatch = p.colors?.find((c) => c.image === src || c.images?.includes(src))
          status(colorMatch
            ? `Главное фото выбрано (цвет «${colorMatch.name}»)`
            : 'Главное фото выбрано', 'success')
        }
      }
    })

    $('gallery-list').querySelectorAll('[data-del-gal]').forEach((b) => {
      b.onclick = () => {
        syncGalleryFromDom()
        p.images.splice(Number(b.dataset.delGal), 1)
        renderGallery({ skipCollect: true })
      }
    })
    $('gallery-list').querySelectorAll('[data-gal-up]').forEach((b) => {
      b.onclick = () => {
        syncGalleryFromDom()
        const i = Number(b.dataset.galUp)
        ;[p.images[i - 1], p.images[i]] = [p.images[i], p.images[i - 1]]
        renderGallery({ skipCollect: true })
      }
    })
    $('gallery-list').querySelectorAll('[data-gal-down]').forEach((b) => {
      b.onclick = () => {
        syncGalleryFromDom()
        const i = Number(b.dataset.galDown)
        ;[p.images[i + 1], p.images[i]] = [p.images[i], p.images[i + 1]]
        renderGallery({ skipCollect: true })
      }
    })
  }
  renderGallery()

  $('add-gallery-url').onclick = () => { p.images.push(''); renderGallery() }
  $('p-gallery-upload').onchange = async (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    try {
      for (const file of files) {
        const path = await uploadImage(file)
        p.images.push(path)
      }
      renderGallery({ skipCollect: true })
      status('Фото добавлены в галерею', 'success')
    } catch (err) { status(err.message, 'error') }
    e.target.value = ''
  }

  const renderColors = (opts = {}) => {
    if (!opts.skipCollect && $('color-list')?.childElementCount) collectProductColorsStorageSim(p)
    if (!Array.isArray(p.colors)) p.colors = []
    const wrap = $('color-list')
    wrap.innerHTML = p.colors.map((col, i) => `
      <div class="admin-card admin-card--compact admin-color-card" data-col="${i}">
        <div class="admin-color-card__row">
          <span class="drag-handle" draggable="true" data-col-drag="${i}" title="Перетащите">⠿</span>
          <div class="admin-grid admin-grid--4 admin-color-card__fields">
            <label class="field"><span>Название</span><input type="text" id="col-name-${i}" value="${escAttr(col.name)}" /></label>
            <label class="field"><span>Цвет</span><input type="color" id="col-hex-${i}" value="${col.hex || '#000000'}" /></label>
            <label class="field"><span>Названия в прайсе</span><input type="text" id="col-import-${i}" value="${escAttr(col.importNames || '')}" placeholder="Silver, Deep Blue" /></label>
            <button type="button" class="btn btn--danger btn--sm" data-del-col="${i}">Удалить</button>
          </div>
        </div>
        <div class="admin-row admin-row--color-photo">
          ${col.image
            ? `<img src="${escAttr(col.image)}" alt="" class="admin-color-preview" />`
            : '<span class="admin-hint" style="margin:0">Нет фото</span>'}
          <label class="btn btn--secondary admin-upload-btn btn--sm">Загрузить фото<input type="file" id="col-upload-${i}" accept="image/*" hidden /></label>
          ${col.image ? `<button type="button" class="btn btn--ghost btn--sm" data-clear-col-img="${i}">Убрать</button>` : ''}
        </div>
      </div>
    `).join('')

    let dragIdx = null
    wrap.querySelectorAll('[data-col-drag]').forEach((handle) => {
      handle.ondragstart = (e) => {
        dragIdx = Number(handle.dataset.colDrag)
        e.dataTransfer.effectAllowed = 'move'
        handle.closest('.admin-color-card')?.classList.add('admin-color-card--dragging')
      }
      handle.ondragend = () => {
        wrap.querySelectorAll('.admin-color-card--dragging, .admin-color-card--dragover').forEach((el) => {
          el.classList.remove('admin-color-card--dragging', 'admin-color-card--dragover')
        })
        dragIdx = null
      }
    })
    wrap.querySelectorAll('[data-col]').forEach((card) => {
      card.ondragover = (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        card.classList.add('admin-color-card--dragover')
      }
      card.ondragleave = () => card.classList.remove('admin-color-card--dragover')
      card.ondrop = (e) => {
        e.preventDefault()
        card.classList.remove('admin-color-card--dragover')
        const drop = Number(card.dataset.col)
        if (dragIdx === null || Number.isNaN(drop) || dragIdx === drop) return
        collectProductColorsStorageSim(p)
        const [item] = p.colors.splice(dragIdx, 1)
        p.colors.splice(drop, 0, item)
        renderColors({ skipCollect: true })
        renderVariants({ skipCollect: true })
      }
    })

    wrap.querySelectorAll('[data-del-col]').forEach((b) => {
      b.onclick = () => {
        collectProductColorsStorageSim(p)
        p.colors.splice(Number(b.dataset.delCol), 1)
        renderColors({ skipCollect: true })
      }
    })
    wrap.querySelectorAll('[data-clear-col-img]').forEach((b) => {
      b.onclick = () => {
        collectProductColorsStorageSim(p)
        const idx = Number(b.dataset.clearColImg)
        if (p.colors[idx]) p.colors[idx].image = ''
        renderColors({ skipCollect: true })
      }
    })
    p.colors.forEach((_, i) => {
      const upload = $(`col-upload-${i}`)
      if (!upload) return
      upload.onchange = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        try {
          collectProductColorsStorageSim(p)
          const path = await uploadImage(file)
          p.colors[i].image = path
          renderColors({ skipCollect: true })
          status('Фото цвета загружено', 'success')
        } catch (err) { status(err.message, 'error') }
        e.target.value = ''
      }
    })
  }
  renderColors()
  $('add-color').onclick = () => {
    if ($('color-list')?.childElementCount) collectProductColorsStorageSim(p)
    p.colors.push({ id: `c${Date.now()}`, name: '', hex: '#888888', image: '', importNames: '' })
    renderColors({ skipCollect: true })
  }

  const renderStorage = () => {
    if (!$('storage-list')) return
    if (!p.storage) p.storage = []
    $('storage-list').innerHTML = p.storage.map((s, i) => `
      <div class="admin-row">
        <input type="text" id="stor-label-${i}" value="${escAttr(s.label)}" placeholder="256 ГБ или 128 ГБ Wi-Fi" />
        <button type="button" class="btn btn--danger btn--sm" data-del-stor="${i}">✕</button>
      </div>
    `).join('')
    $('storage-list').querySelectorAll('[data-del-stor]').forEach((b) => {
      b.onclick = () => {
        syncStorageFromEditor(p)
        p.storage.splice(Number(b.dataset.delStor), 1)
        renderStorage()
        renderVariants({ skipCollect: true })
      }
    })
    $('storage-list').querySelectorAll('input').forEach((inp) => {
      inp.oninput = () => { syncStorageFromEditor(p); renderVariants() }
    })
  }
  if (showStorage) {
    renderStorage()
    $('add-storage').onclick = () => {
      if (!p.storage) p.storage = []
      p.storage.push({ label: '' })
      renderStorage()
      renderVariants()
    }
  }

  if (!p.variants) p.variants = []
  const getMarkup = () => ({
    percent: num('p-markup') || p.markupPercent || 0,
    fixed: num('p-markup-fixed') || p.markupFixed || 0,
  })

  const renderVariants = (opts = {}) => {
    if (!opts.skipCollect && $('variant-list')?.querySelector('.admin-variant-row')) collectProductVariants(p)
    const markup = getMarkup()
    const phoneStorage = productUsesPhoneStorage(p)
    const storageLabels = (() => {
      const labels = getStorageLabelsFromEditor(p)
      if (labels.length) return labels
      if (!phoneStorage) {
        const fromVariants = [...new Set((p.variants || []).map((v) => v.storage).filter(Boolean))]
        return fromVariants.length ? fromVariants : ['Стандарт']
      }
      return labels
    })()
    const simList = p.simTypes?.length ? p.simTypes : ['']

    const displayVariants = phoneStorage
      ? p.variants.filter((v) => isMeaningfulStorageLabel(v.storage))
      : p.variants

    const showSimColumn = showSim
    const showStorageColumn = phoneStorage || !(storageLabels.length <= 1 && storageLabels[0] === 'Стандарт')
    const storageColumnLabel = isWatchCategory(p.category) ? 'Размер' : 'Память'

    $('variant-list').innerHTML = displayVariants.map((v) => {
      const i = p.variants.indexOf(v)
      const retail = v.purchasePrice > 0 ? calcRetailFromPurchase(v.purchasePrice, markup) : (v.price || 0)
      const colorName = p.colors.find((c) => c.id === v.colorId)?.name || v.colorId
      const hintParts = [colorName]
      if (showStorageColumn) hintParts.push(v.storage)
      if (showSimColumn && v.simType) hintParts.push(v.simType)
      return `
      <div class="admin-card admin-card--compact admin-variant-row">
        <div class="admin-grid admin-grid--variant">
          <label class="field"><span>Цвет</span><select id="var-color-${i}">${p.colors.map((c) => `<option value="${c.id}"${v.colorId === c.id ? ' selected' : ''}>${escAttr(c.name)}</option>`).join('')}</select></label>
          ${showStorageColumn ? `<label class="field"><span>${storageColumnLabel}</span><select id="var-storage-${i}">${storageLabels.map((l) => `<option value="${escAttr(l)}"${v.storage === l ? ' selected' : ''}>${escAttr(l)}</option>`).join('')}</select></label>` : ''}
          ${showSimColumn ? `<label class="field"><span>SIM</span><select id="var-sim-${i}">${simList.map((s) => `<option value="${escAttr(s)}"${(v.simType || '') === s ? ' selected' : ''}>${escAttr(s || '—')}</option>`).join('')}</select></label>` : ''}
          <label class="field"><span>Закупка ₽</span><input type="number" id="var-purchase-${i}" value="${v.purchasePrice || 0}" min="0" /></label>
          <label class="field"><span>Розница</span><input type="text" id="var-retail-${i}" value="${retail ? retail.toLocaleString('ru-RU') + ' ₽' : '—'}" readonly /></label>
          <button type="button" class="btn btn--danger btn--sm" data-del-var="${i}">✕</button>
        </div>
        <small class="admin-hint">${hintParts.map((part) => escAttr(part)).join(' · ')}</small>
      </div>
    `}).join('') || '<p class="admin-hint">Вставьте прайс поставщика выше или добавьте позиции вручную</p>'

    $('variant-list').querySelectorAll('[data-del-var]').forEach((b) => {
      b.onclick = () => {
        collectProductVariants(p)
        p.variants.splice(Number(b.dataset.delVar), 1)
        renderVariants({ skipCollect: true })
      }
    })

    p.variants.forEach((_, i) => {
      const updateRetail = () => {
        const purchase = num(`var-purchase-${i}`)
        const retail = purchase > 0 ? calcRetailFromPurchase(purchase, getMarkup()) : 0
        const el = $(`var-retail-${i}`)
        if (el) el.value = retail ? `${retail.toLocaleString('ru-RU')} ₽` : '—'
      }
      $(`var-purchase-${i}`)?.addEventListener('input', updateRetail)
      ;['var-color', 'var-storage', 'var-sim'].forEach((prefix) => {
        $(`${prefix}-${i}`)?.addEventListener('change', updateRetail)
      })
    })
  }
  renderVariants()

  $('import-supplier').onclick = () => {
    const text = $('p-supplier-paste')?.value || ''
    if (!text.trim()) { status('Вставьте прайс в текстовое поле', 'error'); return }
    collectProductColorsStorageSim(p)
    const result = applySupplierImport(p, text, getMarkup())
    const storageErr = validateProductStorage(p)
    const msgs = []
    if (result.merged) msgs.push(`Импортировано: ${result.merged}`)
    if (result.removed) msgs.push(`Удалено устаревших: ${result.removed}`)
    if (result.skipped) msgs.push(`Пропущено (другая модель): ${result.skipped}`)
    if (result.errors.length) msgs.push(`Ошибки: ${result.errors.length}`)
    if (typeof result.variantsAfter === 'number') msgs.push(`Всего конфигураций: ${result.variantsAfter}`)
    $('import-result').textContent = msgs.join(' · ')
    if (result.errors.length) {
      $('import-result').innerHTML = msgs.join(' · ') + '<br>' + result.errors.map((e) => `⚠ ${e.title}: ${e.message}`).join('<br>')
    }
    if (storageErr) {
      $('import-result').innerHTML += `<br><span class="admin-hint--warn">${escAttr(storageErr)}</span>`
    }
    renderVariants({ skipCollect: true })
    status(
      result.merged
        ? (result.removed ? `Импортировано ${result.merged}, удалено ${result.removed}` : `Импортировано ${result.merged} позиций`)
        : 'Ничего не импортировано',
      result.merged ? 'success' : 'error',
    )
  }

  $('clear-variants').onclick = () => {
    if (!p.variants?.length) {
      status('Прайс уже пуст', 'info')
      return
    }
    if (!confirm(`Удалить все ${p.variants.length} позиций прайса у этого товара?`)) return
    p.variants = []
    renderVariants({ skipCollect: true })
    $('import-result').textContent = 'Все цены очищены'
    status('Цены удалены', 'success')
  }

  $('add-variant').onclick = () => {
    if (!Array.isArray(p.variants)) p.variants = []
    if ($('variant-list')?.querySelector('.admin-variant-row')) collectProductVariants(p)

    if (!p.colors?.length) {
      p.colors = [{ id: `c${Date.now()}`, name: 'Стандарт', hex: '#888888', image: '', importNames: '' }]
    }

    const phoneStorage = productUsesPhoneStorage(p)
    const storages = getDisplayStorage(p)
    const defaultStorage = phoneStorage
      ? (storages[0]?.label || '')
      : (p.sizes?.[0]?.label || storages[0]?.label || 'Стандарт')

    if (phoneStorage && !defaultStorage) {
      status('Сначала добавьте объём памяти, затем позицию', 'error')
      return
    }

    p.variants.push({
      colorId: p.colors[0].id,
      storage: defaultStorage,
      simType: p.simTypes?.[0] || '',
      purchasePrice: 0,
      price: 0,
    })
    renderVariants({ skipCollect: true })
    status('Позиция добавлена', 'success')
  }
  $('recalc-variants').onclick = () => {
    collectProductVariants(p)
    renderVariants({ skipCollect: true })
    status('Цены пересчитаны', 'success')
  }
  $('p-markup')?.addEventListener('input', () => renderVariants())
  $('p-markup-fixed')?.addEventListener('input', () => renderVariants())

  if (!p.simModifiers) p.simModifiers = []
  if (!p.simTypes) p.simTypes = []
  if (showSim) {
    const renderSim = () => {
      $('sim-list').innerHTML = p.simTypes.map((t, i) => `
        <div class="admin-row">
          <input type="text" id="sim-type-${i}" value="${escAttr(t)}" placeholder="eSIM only" />
          <button type="button" class="btn btn--danger btn--sm" data-del-sim="${i}">✕</button>
        </div>
      `).join('')
      $('sim-list').querySelectorAll('[data-del-sim]').forEach((b) => {
        b.onclick = () => {
          p.simTypes = p.simTypes.map((_, i) => val(`sim-type-${i}`))
          p.simTypes.splice(Number(b.dataset.delSim), 1)
          renderSim()
        }
      })
    }
    renderSim()
    $('p-hasSim').onchange = (e) => {
      $('sim-block').hidden = !e.target.checked
      if (e.target.checked && !p.simTypes.length) {
        p.simTypes = ['eSIM only', 'eSIM + SIM']
        renderSim()
      }
    }
    $('add-sim').onclick = () => { p.simTypes.push(''); renderSim() }
  }

  if (!p.sizes) p.sizes = []
  if (showSizes) {
    const renderSizes = () => {
      $('size-list').innerHTML = p.sizes.map((s, i) => `
        <div class="admin-row">
          <input type="text" id="size-label-${i}" value="${escAttr(s.label)}" placeholder="42" />
          <button type="button" class="btn btn--danger btn--sm" data-del-size="${i}">✕</button>
        </div>
      `).join('')
      $('size-list').querySelectorAll('[data-del-size]').forEach((b) => {
        b.onclick = () => { p.sizes.splice(Number(b.dataset.delSize), 1); renderSizes() }
      })
      $('size-list').querySelectorAll('input').forEach((inp) => {
        inp.onblur = () => {
          const i = Number(inp.id.replace('size-label-', ''))
          const normalized = normalizeWatchSizeLabel(inp.value)
          if (normalized) {
            inp.value = normalized
            p.sizes[i] = { label: normalized }
          }
        }
      })
    }
    renderSizes()
    $('add-size').onclick = () => { if (!p.sizes) p.sizes = []; p.sizes.push({ label: '' }); renderSizes() }
  }

  if (!p.stock) p.stock = []
  const colorOptions = (selected) => p.colors.map((c) => `<option value="${c.id}"${selected === c.id ? ' selected' : ''}>${escAttr(c.name)}</option>`).join('')
  const simOptions = (selected) => {
    const types = p.simTypes?.length ? p.simTypes : ['']
    return types.map((t) => `<option value="${escAttr(t)}"${selected === t ? ' selected' : ''}>${escAttr(t || 'Любая / не указана')}</option>`).join('')
  }
  const storageOptions = (selected) => {
    const items = p.sizes?.length > 1
      ? p.sizes.map((s) => s.label)
      : getDisplayStorage(p).map((s) => s.label).filter((l) => isPhoneCategory(p.category) ? isMeaningfulStorageLabel(l) : true)
    const labels = ['', ...items]
    return labels.map((label) => `<option value="${escAttr(label)}"${selected === label ? ' selected' : ''}>${escAttr(label || 'Любая / не указана')}</option>`).join('')
  }
  const renderStock = () => {
    $('stock-list').innerHTML = p.stock.map((s, i) => `
      <div class="admin-card admin-card--compact">
        <div class="admin-grid admin-grid--5">
          <label class="field"><span>Цвет</span><select id="stk-color-${i}">${colorOptions(s.colorId)}</select></label>
          <label class="field"><span>Версия SIM</span><select id="stk-sim-${i}">${simOptions(s.simType || '')}</select></label>
          <label class="field"><span>Память</span><select id="stk-storage-${i}">${storageOptions(s.storageLabel || '')}</select></label>
          <label class="field"><span>Кол-во</span><input type="number" id="stk-qty-${i}" value="${s.qty}" min="0" /></label>
          <button type="button" class="btn btn--danger btn--sm" data-del-stk="${i}">Удалить</button>
        </div>
      </div>
    `).join('') || '<p class="admin-hint">Нет позиций в наличии</p>'
    $('stock-list').querySelectorAll('[data-del-stk]').forEach((b) => {
      b.onclick = () => { p.stock.splice(Number(b.dataset.delStk), 1); renderStock() }
    })
  }
  renderStock()
  $('add-stock').onclick = () => {
    const storages = getDisplayStorage(p)
    p.stock.push({
      colorId: p.colors[0]?.id || '',
      simType: p.simTypes?.[0] || '',
      storageLabel: storages[0]?.label || p.storage[0]?.label || '',
      qty: 1,
      note: 'В наличии',
    })
    renderStock()
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

async function renderOrders(c) {
  c.innerHTML = '<p class="admin-hint">Загрузка заказов…</p>'
  try {
    const res = await fetch('/api/orders', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (!res.ok) throw new Error('Не удалось загрузить заказы')
    const data = await res.json()
    const orders = data.orders || []

    if (!orders.length) {
      c.innerHTML = section('Заказы', '<p class="admin-hint">Заказов пока нет. Они появятся после оформления на сайте.</p>')
      return
    }

    c.innerHTML = section('Заказы', `
      <p class="admin-hint">${orders.length} заказов · новые сверху. Уведомления в Telegram отправляются автоматически при оформлении на сайте.</p>
      <div id="orders-list"></div>
    `)

    $('orders-list').innerHTML = orders.map((o) => {
      const date = new Date(o.createdAt).toLocaleString('ru-RU')
      const items = o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')
      const tgStatus = o.notified
        ? `✓ Telegram${o.notifiedChats?.length ? ` (${o.notifiedChats.length})` : ''}`
        : o.notifyError
          ? `Telegram: ${o.notifyError}`
          : 'Telegram: ожидание отправки…'
      return `
        <div class="admin-order-row">
          <div class="admin-order-row__head">
            <strong>${o.id}</strong>
            <span>${date}</span>
          </div>
          <div>${o.name} · ${o.phoneDisplay}</div>
          <div class="admin-hint">${items}</div>
          <div class="admin-hint">${tgStatus}</div>
          <div class="admin-order-row__total">${Number(o.total).toLocaleString('ru-RU')} ₽</div>
        </div>
      `
    }).join('')
  } catch (err) {
    c.innerHTML = section('Заказы', `<p class="admin-hint">${err.message}</p>`)
  }
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

function renderPriceImport(c) {
  const pi = storeData.priceImport || { markupPercent: 15, markupFixed: 0 }
  const savedSections = pi.lastSections?.length ? pi.lastSections : PDF_IMPORT_SECTIONS.map((s) => s.id)
  const groups = groupPdfImportSections()

  const sectionChecks = [...groups.entries()].map(([group, items]) => `
    <div class="pdf-import-group">
      <div class="pdf-import-group__head">
        <label class="pdf-import-group__title">
          <input type="checkbox" class="pdf-import-group-toggle" data-group="${group}" checked />
          <span>${group}</span>
        </label>
      </div>
      <div class="pdf-import-group__items">
        ${items.map((s) => `
          <label class="pdf-import-check">
            <input type="checkbox" class="pdf-import-section" data-group="${group}" value="${s.id}" ${savedSections.includes(s.id) ? 'checked' : ''} />
            <span>${s.label}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('')

  c.innerHTML = section(`Импорт прайса PDF (THLS) ${betaBadge()}`, `
    <p class="admin-hint admin-hint--muted">Экспериментальный режим — может работать нестабильно. Рекомендуем текстовый импорт ниже.</p>
    <div class="admin-grid">
      <label class="field"><span>Наценка при импорте, %</span><input type="number" id="pi-markup" value="${pi.markupPercent ?? 15}" min="0" step="0.1" /></label>
      <label class="field"><span>Наценка фикс., ₽</span><input type="number" id="pi-markup-fixed" value="${pi.markupFixed ?? 0}" min="0" step="100" /></label>
    </div>
    <div class="admin-row admin-row--actions">
      <button type="button" class="btn btn--ghost btn--sm" id="pi-select-all">Выбрать все</button>
      <button type="button" class="btn btn--ghost btn--sm" id="pi-select-none">Снять все</button>
    </div>
    <div class="pdf-import-sections">${sectionChecks}</div>
    <label class="btn btn--secondary admin-upload-btn">Выбрать PDF и импортировать<input type="file" id="import-pdf-file" accept=".pdf,application/pdf" hidden /></label>
    <p class="admin-hint" id="pdf-import-status"></p>
    <p class="admin-hint" id="pdf-import-result">${pi.lastImportAt ? `Последний PDF: ${escAttr(formatWhenWithAgo(pi.lastImportAt))}` : ''}</p>
  `) + section('Импорт прайса текстом', `
    <p class="admin-hint">Формат JSONL — по одному JSON на строку. Поля: <code>product</code>, <code>storage</code>, <code>color</code>, <code>sim</code>, <code>size</code>, <code>price</code>.</p>
    <p class="admin-hint">Пример: <code>{"product":"iPhone 16 Pro","storage":"128Gb","color":"Desert","sim":"Sim+eSim","price":98000}</code></p>
    <p class="admin-hint admin-hint--muted">Промпт для LLM — во вкладке <strong>Промпт для прайса</strong>.</p>
    <label class="field"><span>Прайс (JSONL)</span>
      <textarea id="price-text-import" class="admin-textarea" rows="14" placeholder='{"product":"iPhone 17 Pro Max","storage":"256Gb","color":"Orange","sim":"eSim+eSim","price":90000}'></textarea>
    </label>
    <div class="admin-import-modes">
      <p class="admin-hint">Если комбинации (цвет/память/SIM) нет в новом прайсе — её нельзя заказать, значит старую цену нужно убрать.</p>
    </div>
    <div class="admin-row admin-row--actions">
      <button type="button" class="btn btn--secondary" id="preview-price-text">Проверить без записи</button>
      <button type="button" class="btn btn--primary" id="import-price-text">Импортировать и убрать лишние</button>
      <button type="button" class="btn btn--ghost" id="import-price-text-keep">Только обновить цены</button>
    </div>
    <div id="text-import-result" class="admin-hint">${pi.lastTextImportAt ? `Последний текстовый импорт: ${escAttr(formatWhenWithAgo(pi.lastTextImportAt))}` : ''}</div>
  `)

  if (pi.lastTextImport && $('price-text-import')) {
    $('price-text-import').value = pi.lastTextImport
  }

  const runTextImport = async ({ dryRun, replaceVariants }) => {
    const text = $('price-text-import')?.value || ''
    const resultEl = $('text-import-result')
    if (!text.trim()) {
      status('Вставьте прайс в текстовое поле', 'error')
      return
    }
    resultEl.textContent = dryRun ? 'Проверка…' : 'Импорт…'
    try {
      const res = await fetch('/api/import-price-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          text,
          dryRun: !!dryRun,
          replaceVariants: !!replaceVariants,
          markupPercent: num('pi-markup'),
          markupFixed: num('pi-markup-fixed'),
        }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) throw new Error(data?.error || 'Ошибка импорта')
      const s = { ...data.stats, dryRun: !!data.dryRun, importFormat: data.stats?.importFormat }
      resultEl.innerHTML = formatImportResultHtml(s, { dryRun: !!data.dryRun })
      bindImportSkipHandlers(resultEl)

      if (!dryRun) {
        storeData.priceImport = {
          ...storeData.priceImport,
          markupPercent: num('pi-markup'),
          markupFixed: num('pi-markup-fixed'),
          lastTextImportAt: new Date().toISOString(),
          lastTextImport: text,
          lastTextImportMode: replaceVariants ? 'replace' : 'keep',
          lastTouchedProductIds: data.stats?.touchedProductIds || [],
        }
        invalidateStore()
        productsData = await (await fetch('/api/products')).json()
        const removed = s.variantsRemoved || 0
        status(
          removed
            ? `Обновлено цен: ${s.pricesUpdated || 0}, удалено устаревших: ${removed}`
            : `Обновлено цен: ${s.pricesUpdated || 0}`,
          'success',
        )
      } else {
        const warns = (s.unrecognized || 0) + (s.notFound?.length || 0) + (s.skippedVariants || 0)
        const removed = s.variantsRemoved || 0
        status(
          removed
            ? `Проверка: будет удалено устаревших конфигураций: ${removed}`
            : (warns ? `Проверка: есть замечания (${warns})` : 'Проверка: всё сопоставилось'),
          removed || warns ? 'info' : 'success',
        )
      }
    } catch (err) {
      resultEl.textContent = err.message
      status(err.message, 'error')
    }
  }

  // Превью всегда показывает режим «убрать лишние» — это основная логика
  $('preview-price-text')?.addEventListener('click', () => runTextImport({ dryRun: true, replaceVariants: true }))
  $('import-price-text')?.addEventListener('click', () => runTextImport({ dryRun: false, replaceVariants: true }))
  $('import-price-text-keep')?.addEventListener('click', () => runTextImport({ dryRun: false, replaceVariants: false }))

  const sectionInputs = () => [...c.querySelectorAll('.pdf-import-section')]
  const getSelectedSections = () => sectionInputs().filter((el) => el.checked).map((el) => el.value)

  c.querySelector('#pi-select-all')?.addEventListener('click', () => {
    sectionInputs().forEach((el) => { el.checked = true })
    c.querySelectorAll('.pdf-import-group-toggle').forEach((el) => { el.checked = true })
  })

  c.querySelector('#pi-select-none')?.addEventListener('click', () => {
    sectionInputs().forEach((el) => { el.checked = false })
    c.querySelectorAll('.pdf-import-group-toggle').forEach((el) => { el.checked = false })
  })

  c.querySelectorAll('.pdf-import-group-toggle').forEach((groupCb) => {
    groupCb.addEventListener('change', () => {
      const group = groupCb.dataset.group
      c.querySelectorAll(`.pdf-import-section[data-group="${group}"]`).forEach((el) => {
        el.checked = groupCb.checked
      })
    })
  })

  c.querySelectorAll('.pdf-import-section').forEach((el) => {
    el.addEventListener('change', () => {
      const group = el.dataset.group
      const groupItems = c.querySelectorAll(`.pdf-import-section[data-group="${group}"]`)
      const groupToggle = c.querySelector(`.pdf-import-group-toggle[data-group="${group}"]`)
      if (groupToggle) {
        groupToggle.checked = [...groupItems].every((item) => item.checked)
        groupToggle.indeterminate = [...groupItems].some((item) => item.checked) && !groupToggle.checked
      }
    })
  })

  c.querySelectorAll('.pdf-import-group-toggle').forEach((groupCb) => {
    const group = groupCb.dataset.group
    const items = c.querySelectorAll(`.pdf-import-section[data-group="${group}"]`)
    groupCb.checked = [...items].every((item) => item.checked)
    groupCb.indeterminate = [...items].some((item) => item.checked) && !groupCb.checked
  })

  const statusEl = $('pdf-import-status')
  fetch('/api/ping')
    .then((r) => r.json())
    .then((data) => {
      if (data?.importPdf) {
        statusEl.textContent = 'Сервер готов к импорту PDF'
        statusEl.className = 'admin-hint admin-hint--ok'
      } else {
        statusEl.textContent = 'Обновите сервер до последней версии (bash start.sh)'
        statusEl.className = 'admin-hint admin-hint--warn'
      }
    })
    .catch(() => {
      statusEl.textContent = 'Не удалось проверить сервер. Запустите: bash start.sh и откройте http://localhost:8080/admin'
      statusEl.className = 'admin-hint admin-hint--warn'
    })

  $('import-pdf-file').onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const selected = getSelectedSections()
    if (!selected.length) {
      status('Выберите хотя бы одну категорию для импорта', 'error')
      e.target.value = ''
      return
    }
    const resultEl = $('pdf-import-result')
    resultEl.textContent = 'Импорт…'
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64 = String(reader.result).split(',')[1]
        const res = await fetch('/api/import-price-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({
            data: base64,
            markupPercent: num('pi-markup'),
            markupFixed: num('pi-markup-fixed'),
            sections: selected,
          }),
        })
        const data = await parseApiJson(res)
        if (!res.ok) throw new Error(data?.error || 'Ошибка импорта')
        const s = data.stats
        resultEl.innerHTML = formatImportResultHtml(s)
        bindImportSkipHandlers(resultEl)
        if (s.errors?.length) {
          resultEl.innerHTML += '<br>' + s.errors.slice(0, 5).map((e) => `⚠ ${escAttr(e.name)}: ${escAttr(e.error)}`).join('<br>')
        }
        storeData.priceImport = {
          markupPercent: num('pi-markup'),
          markupFixed: num('pi-markup-fixed'),
          lastImportAt: new Date().toISOString(),
          lastSections: selected,
        }
        invalidateStore()
        productsData = await (await fetch('/api/products')).json()
        status('Прайс PDF импортирован', 'success')
      } catch (err) {
        resultEl.textContent = err.message
        status(err.message, 'error')
      }
      e.target.value = ''
    }
    reader.onerror = () => {
      resultEl.textContent = 'Не удалось прочитать файл'
      e.target.value = ''
    }
    reader.readAsDataURL(file)
  }
}

function getPromptCategories() {
  ensureStoreDefaults()
  return storeData.priceImport.promptCategories
}

function syncPromptCategoriesFromDom() {
  if (!$('prompt-categories-list')) return
  const rows = [...document.querySelectorAll('.prompt-cat-row')].map((row) => ({
    name: row.dataset.name || '',
    selected: !!row.querySelector('.prompt-cat-check')?.checked,
  })).filter((r) => r.name)
  storeData.priceImport = storeData.priceImport || {}
  storeData.priceImport.promptCategories = rows
}

function renderPricePrompt(c) {
  ensureStoreDefaults()
  const cats = getPromptCategories()
  const selectedCount = cats.filter((r) => r.selected).length

  const listHtml = cats.length
    ? cats.map((row, idx) => `
      <div class="prompt-cat-row" data-name="${escAttr(row.name)}" data-idx="${idx}">
        <label class="prompt-cat-label">
          <input type="checkbox" class="prompt-cat-check" ${row.selected ? 'checked' : ''} />
          <span>${escAttr(row.name)}</span>
          <em class="prompt-cat-coverage" data-coverage-for="${escAttr(row.name)}">…</em>
        </label>
        <button type="button" class="btn btn--ghost btn--sm prompt-cat-remove" data-idx="${idx}" title="Удалить">✕</button>
      </div>
    `).join('')
    : '<p class="admin-hint">Список пуст — добавьте категории ниже.</p>'

  c.innerHTML = section('Категории для промпта', `
    <p class="admin-hint">Отметьте секции прайса, которые нейросеть должна извлечь. Неотмеченные в промпт не попадут.</p>
    <p class="admin-hint admin-hint--muted">Выбрано: <strong id="prompt-selected-count">${selectedCount}</strong> из ${cats.length}. Справа — сколько карточек в каталоге уже связано с секцией.</p>
    <div class="admin-row admin-row--actions" style="margin-bottom:12px">
      <button type="button" class="btn btn--ghost btn--sm" id="prompt-select-all">Выбрать все</button>
      <button type="button" class="btn btn--ghost btn--sm" id="prompt-select-none">Снять все</button>
      <button type="button" class="btn btn--ghost btn--sm" id="prompt-clear-all">Удалить все</button>
      <button type="button" class="btn btn--ghost btn--sm" id="prompt-reset-defaults">Сбросить к списку по умолчанию</button>
    </div>
    <div class="prompt-categories-list" id="prompt-categories-list">${listHtml}</div>
    <div class="prompt-cat-add">
      <label class="field"><span>Добавить категории (через запятую)</span>
        <input type="text" id="prompt-cat-input" placeholder="Xiaomi, Poco, Honor" />
      </label>
      <button type="button" class="btn btn--secondary" id="prompt-cat-add-btn">Добавить</button>
    </div>
  `) + section('Скопировать промпт', `
    <p class="admin-hint">Промпт учитывает только выбранные категории. Вставьте его в ChatGPT / Claude вместе с файлом <code>price.pdf</code>.</p>
    <button type="button" class="btn btn--primary" id="copy-price-jsonl-prompt">Скопировать промпт</button>
  `)

  fetch('/api/prompt-category-coverage', {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
    .then((r) => parseApiJson(r))
    .then((data) => {
      const coverage = data?.coverage || {}
      c.querySelectorAll('[data-coverage-for]').forEach((el) => {
        const name = el.dataset.coverageFor
        const n = Number(coverage[name] || 0)
        el.textContent = n > 0 ? `${n} в каталоге` : 'нет карточек'
        el.classList.toggle('prompt-cat-coverage--ok', n > 0)
        el.classList.toggle('prompt-cat-coverage--empty', n === 0)
      })
    })
    .catch(() => {
      c.querySelectorAll('[data-coverage-for]').forEach((el) => {
        el.textContent = ''
      })
    })

  const updateSelectedCount = () => {
    const el = $('prompt-selected-count')
    if (!el) return
    const n = c.querySelectorAll('.prompt-cat-check:checked').length
    el.textContent = String(n)
  }

  c.querySelectorAll('.prompt-cat-check').forEach((el) => {
    el.addEventListener('change', () => {
      syncPromptCategoriesFromDom()
      updateSelectedCount()
      scheduleDraftSave()
    })
  })

  c.querySelectorAll('.prompt-cat-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      syncPromptCategoriesFromDom()
      const idx = Number(btn.dataset.idx)
      storeData.priceImport.promptCategories.splice(idx, 1)
      renderTab()
      scheduleDraftSave()
    })
  })

  $('prompt-select-all')?.addEventListener('click', () => {
    c.querySelectorAll('.prompt-cat-check').forEach((el) => { el.checked = true })
    syncPromptCategoriesFromDom()
    updateSelectedCount()
    scheduleDraftSave()
  })

  $('prompt-select-none')?.addEventListener('click', () => {
    c.querySelectorAll('.prompt-cat-check').forEach((el) => { el.checked = false })
    syncPromptCategoriesFromDom()
    updateSelectedCount()
    scheduleDraftSave()
  })

  $('prompt-clear-all')?.addEventListener('click', () => {
    if (!confirm('Удалить все категории из списка?')) return
    storeData.priceImport.promptCategories = []
    renderTab()
    scheduleDraftSave()
  })

  $('prompt-reset-defaults')?.addEventListener('click', () => {
    if (!confirm('Заменить список категориями по умолчанию?')) return
    storeData.priceImport.promptCategories = DEFAULT_PROMPT_CATEGORY_ROWS.map((r) => ({ ...r }))
    renderTab()
    scheduleDraftSave()
  })

  const addCategoriesFromInput = () => {
    const raw = val('prompt-cat-input')
    if (!raw) {
      status('Введите хотя бы одну категорию', 'error')
      return
    }
    syncPromptCategoriesFromDom()
    const existing = new Set(
      storeData.priceImport.promptCategories.map((r) => r.name.trim().toLowerCase()),
    )
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    let added = 0
    for (const name of parts) {
      const key = name.toLowerCase()
      if (existing.has(key)) continue
      existing.add(key)
      storeData.priceImport.promptCategories.push({ name, selected: true })
      added += 1
    }
    if (!added) {
      status('Такие категории уже есть', 'info')
      return
    }
    renderTab()
    scheduleDraftSave()
    status(`Добавлено: ${added}`, 'success')
  }

  $('prompt-cat-add-btn')?.addEventListener('click', addCategoriesFromInput)
  $('prompt-cat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCategoriesFromInput()
    }
  })

  $('copy-price-jsonl-prompt')?.addEventListener('click', async () => {
    const btn = $('copy-price-jsonl-prompt')
    try {
      syncPromptCategoriesFromDom()
      const categories = storeData.priceImport.promptCategories
        .filter((r) => r.selected && r.name)
        .map((r) => r.name)
      if (!categories.length) {
        status('Выберите хотя бы одну категорию', 'error')
        return
      }
      const res = await fetch('/api/price-jsonl-prompt', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categories }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) throw new Error(data?.error || 'Не удалось получить промпт')
      await navigator.clipboard.writeText(data.prompt)
      const prev = btn.textContent
      btn.textContent = 'Скопировано'
      status(`Промпт скопирован (${categories.length} категорий)`, 'success')
      setTimeout(() => { btn.textContent = prev }, 2000)
    } catch (err) {
      status(err.message, 'error')
    }
  })
}

function renderConfig(c) {
  const stamp = new Date().toISOString().slice(0, 10)
  c.innerHTML = `
    ${section(`Каталог для коллеги (товары + фото) ${betaBadge()}`, `
      <p class="admin-hint">Скачайте ZIP и передайте человеку, который наполняет карточки и загружает фото. Он работает в своей локальной админке, потом отдаёт ZIP обратно — вы импортируете сюда.</p>
      <p class="admin-hint"><strong>Слияние</strong> — обновить существующие товары по id/slug и добавить новые. <strong>Заменить всё</strong> — полностью перезаписать каталог.</p>
      <div class="admin-row admin-row--actions">
        <button type="button" class="btn btn--primary" id="export-catalog-zip">Скачать каталог (.zip)</button>
        <label class="btn btn--secondary admin-upload-btn">Импорт каталога (.zip)
          <input type="file" id="import-catalog-zip" accept=".zip,application/zip" hidden />
        </label>
      </div>
      <div class="admin-progress" id="export-catalog-progress" hidden>
        <div class="admin-progress__bar" id="export-catalog-progress-bar"></div>
      </div>
      <p class="admin-hint" id="export-catalog-status"></p>
      <div class="admin-row">
        <label class="field"><span>Режим импорта каталога</span>
          <select id="import-catalog-mode">
            <option value="merge" selected>Слияние (рекомендуется)</option>
            <option value="replace">Заменить весь каталог</option>
          </select>
        </label>
      </div>
      <p class="admin-hint" id="import-catalog-result"></p>
    `)}
    ${section('Полная резервная копия сайта', `
      <p class="admin-hint">Настройки магазина + товары в одном JSON. Пароль админки не экспортируется.</p>
      <div class="admin-row admin-row--actions">
        <button type="button" class="btn btn--primary" id="export-backup">Скачать backup (.json)</button>
        <label class="btn btn--secondary admin-upload-btn">Импорт backup (.json)
          <input type="file" id="import-backup" accept=".json,application/json" hidden />
        </label>
      </div>
    `)}
    ${section('По отдельности (продвинутый режим)', `
      <p class="admin-hint">Только JSON без фотографий — фото придётся загрузить заново на сервере.</p>
      <div class="admin-grid admin-grid--2">
        <div>
          <h4 class="admin-subtitle">store.json</h4>
          <div class="admin-row admin-row--actions">
            <button type="button" class="btn btn--secondary" id="export-store">Скачать</button>
            <label class="btn btn--ghost admin-upload-btn">Импорт<input type="file" id="import-store" accept=".json" hidden /></label>
          </div>
        </div>
        <div>
          <h4 class="admin-subtitle">products.json</h4>
          <div class="admin-row admin-row--actions">
            <button type="button" class="btn btn--secondary" id="export-products">Скачать</button>
            <label class="btn btn--ghost admin-upload-btn">Импорт<input type="file" id="import-products" accept=".json" hidden /></label>
          </div>
          <label class="field" style="margin-top:10px"><span>Режим</span>
            <select id="import-products-mode">
              <option value="merge" selected>Слияние</option>
              <option value="replace">Заменить всё</option>
            </select>
          </label>
        </div>
      </div>
    `)}
  `

  $('export-catalog-zip').onclick = async () => {
    const btn = $('export-catalog-zip')
    const progress = $('export-catalog-progress')
    const bar = $('export-catalog-progress-bar')
    const statusEl = $('export-catalog-status')
    btn.disabled = true
    if (progress) progress.hidden = false
    if (bar) bar.style.width = '0%'
    if (statusEl) statusEl.textContent = 'Подготовка архива…'
    try {
      await downloadFromApi(`/api/admin/export-catalog`, `airdrop-catalog-${stamp}.zip`, (ratio) => {
        if (!bar || !statusEl) return
        if (ratio < 0) {
          bar.classList.add('admin-progress__bar--pulse')
          statusEl.textContent = 'Сборка архива…'
          return
        }
        bar.classList.remove('admin-progress__bar--pulse')
        bar.style.width = `${Math.round(ratio * 100)}%`
        statusEl.textContent = ratio >= 1 ? 'Сохранение файла…' : `Скачивание: ${Math.round(ratio * 100)}%`
      })
      if (statusEl) statusEl.textContent = 'Каталог экспортирован'
      status('Каталог экспортирован', 'success')
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message
      status(err.message, 'error')
    } finally {
      btn.disabled = false
      setTimeout(() => { if (progress) progress.hidden = true }, 1200)
    }
  }

  $('export-backup').onclick = async () => {
    try {
      await downloadFromApi('/api/admin/export-backup', `airdrop-backup-${stamp}.json`)
      status('Backup экспортирован', 'success')
    } catch (err) { status(err.message, 'error') }
  }

  $('import-catalog-zip').onchange = async (e) => {
    const file = e.target.files[0]
    const resultEl = $('import-catalog-result')
    if (!file) return
    resultEl.textContent = 'Импорт…'
    try {
      const ping = await fetch('/api/ping').then((r) => parseApiJson(r)).catch(() => null)
      if (!ping?.importCatalogZip) {
        throw new Error('Сервер устарел. Перезапустите Start.bat / Start.command и обновите страницу (Ctrl+F5).')
      }
      const data = await readFileAsBase64(file)
      const mode = $('import-catalog-mode').value
      const res = await fetch('/api/admin/import-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ data, mode }),
      })
      const payload = await parseApiJson(res)
      if (!res.ok) throw new Error(payload?.error || `Ошибка импорта (${res.status})`)
      productsData = await (await fetch('/api/products')).json()
      invalidateStore()
      clearDraft()
      const s = payload.stats || {}
      resultEl.textContent = `Готово: ${s.count} товаров, фото скопировано: ${s.assetsCopied ?? '—'}, режим: ${s.mode || mode}`
      status('Каталог импортирован', 'success')
      renderTab()
    } catch (err) {
      resultEl.textContent = err.message
      status(err.message, 'error')
    }
    e.target.value = ''
  }

  $('import-backup').onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!confirm('Заменить настройки и товары из backup? Пароль админки останется прежним.')) {
      e.target.value = ''
      return
    }
    try {
      const backup = JSON.parse(await file.text())
      const res = await fetch('/api/admin/import-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(backup),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Ошибка импорта')
      await loadData()
      clearDraft()
      status(`Backup импортирован (${payload.stats?.products ?? '—'} товаров)`, 'success')
      renderTab()
    } catch (err) { status(err.message || 'Некорректный backup', 'error') }
    e.target.value = ''
  }

  $('export-store').onclick = () => {
    const copy = structuredClone(storeData)
    delete copy.adminPassword
    downloadJson('store.json', copy)
  }
  $('export-products').onclick = () => downloadJson('products.json', productsData)

  $('import-store').onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!data.settings) throw new Error('Нет поля settings')
      const password = storeData.adminPassword
      storeData = { ...data, adminPassword: password }
      await saveStore()
      clearDraft()
      renderTab()
    } catch (err) { status(err.message || 'Некорректный JSON', 'error') }
    e.target.value = ''
  }

  $('import-products').onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const mode = $('import-products-mode').value
    if (mode === 'replace' && !confirm('Заменить весь каталог товаров?')) {
      e.target.value = ''
      return
    }
    try {
      const incoming = JSON.parse(await file.text())
      if (!incoming.products) throw new Error('Нет поля products')
      const res = await fetch('/api/admin/import-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ products: incoming.products, mode }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Ошибка импорта')
      productsData = await (await fetch('/api/products')).json()
      invalidateStore()
      clearDraft()
      status(`Товары импортированы (${payload.stats?.count ?? '—'})`, 'success')
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
  else if (activeTab === 'price-import') collectPriceImport()
  else if (activeTab === 'price-prompt') collectPricePrompt()
}

function collectPricePrompt() {
  syncPromptCategoriesFromDom()
}

function collectPriceImport() {
  if (!storeData || !$('pi-markup')) return
  storeData.priceImport = storeData.priceImport || {}
  storeData.priceImport.markupPercent = num('pi-markup')
  storeData.priceImport.markupFixed = num('pi-markup-fixed')
  const sections = [...document.querySelectorAll('.pdf-import-section')]
    .filter((el) => el.checked)
    .map((el) => el.value)
  if (sections.length) storeData.priceImport.lastSections = sections
  const text = $('price-text-import')?.value
  if (text !== undefined) storeData.priceImport.lastTextImport = text
}

function collectGeneral() {
  if (!$('g-name')) return
  const s = storeData.settings
  s.name = val('g-name'); s.tagline = val('g-tagline'); s.logo = val('g-logo'); s.reviewBrand = val('g-reviewBrand')
}

function collectContacts() {
  if (!$('c-name')) return
  const s = storeData.settings
  s.phoneContactName = val('c-name'); s.phone = val('c-phone'); s.phoneDisplay = val('c-phoneDisplay')
  s.legalName = val('c-legal')
  s.hours.weekdays = val('c-hours-wd'); s.hours.weekends = val('c-hours-we')
  s.addresses.forEach((a, i) => {
    const city = val(`a-city-${i}`)
    if (!$(`a-city-${i}`)) return
    a.city = city; a.street = val(`a-street-${i}`); a.note = val(`a-note-${i}`); a.yandexMaps = val(`a-maps-${i}`)
  })
}

function collectContent() {
  if (!$('t-heroTitle')) return
  const s = storeData.settings
  s.heroTitle = val('t-heroTitle'); s.heroSubtitle = val('t-heroSubtitle'); s.orderDays = val('t-orderDays')
  s.heroText = val('t-heroText'); s.description = val('t-description'); s.aboutText = val('t-about')
  s.whyUs = storeData.settings.whyUs.map((_, i) => val(`why-${i}`)).filter(Boolean)
}

function collectLinks() {
  if (!$('l-tg')) return
  const l = storeData.settings.links
  l.telegram = val('l-tg'); l.vk = val('l-vk'); l.vkMarket = val('l-vkMarket'); l.vkReviews = val('l-vkReviews')
  l.avitoKarpinsk = val('l-avitoK'); l.avitoKrasnoturinsk = val('l-avitoKT')
}

function collectNavigation() {
  if (!$('nav-list')) return
  storeData.navigation.forEach((item, i) => {
    const labelEl = $(`nav-label-${i}`)
    const hrefEl = $(`nav-href-${i}`)
    if (!labelEl || !hrefEl) return
    item.label = labelEl.value.trim() || item.label
    item.href = hrefEl.value.trim() || item.href
    if (!item.id || item.id === 'new') item.id = item.label.toLowerCase().replace(/\s+/g, '-')
  })
}

function collectCategories() {
  if (!$('cat-list')) return
  storeData.categories.forEach((cat, i) => {
    const labelEl = $(`cat-label-${i}`)
    if (!labelEl) return
    if (cat.id !== 'all') {
      const idEl = $(`cat-id-${i}`)
      if (idEl?.value.trim()) cat.id = idEl.value.trim()
    }
    const label = labelEl.value.trim()
    if (label) cat.label = label
    else if (!cat.label && DEFAULT_CATEGORY_LABELS[cat.id]) cat.label = DEFAULT_CATEGORY_LABELS[cat.id]
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

function collectProductColorsStorageSim(p) {
  p.colors = p.colors.map((col, i) => ({
    id: col.id || `c${i}`,
    name: val(`col-name-${i}`),
    hex: $(`col-hex-${i}`)?.value || '#000',
    image: col.image || '',
    importNames: val(`col-import-${i}`) || '',
  }))
  if ($('storage-list')) {
    syncStorageFromEditor(p)
  }
  if ($('p-hasSim')?.checked) {
    p.simTypes = p.simTypes.map((_, i) => val(`sim-type-${i}`)).filter(Boolean)
  } else {
    p.simTypes = null
  }
  p.simModifiers = []
}

function collectProductVariants(p) {
  if (!p.variants) p.variants = []
  p.markupPercent = num('p-markup') || 0
  p.markupFixed = num('p-markup-fixed') || 0
  const markup = getMarkupSettings(p)

  p.variants = p.variants.map((v, i) => {
    const colorEl = $(`var-color-${i}`)
    if (!colorEl) return v
    const purchasePrice = num(`var-purchase-${i}`)
    const price = purchasePrice > 0 ? calcRetailFromPurchase(purchasePrice, markup) : 0
    return {
      colorId: colorEl.value || v.colorId || '',
      storage: $(`var-storage-${i}`)?.value ?? v.storage ?? '',
      simType: $(`var-sim-${i}`)?.value ?? v.simType ?? '',
      purchasePrice,
      price,
    }
  }).filter((v) => {
    if (!v.colorId) return false
    if (productUsesPhoneStorage(p)) return isMeaningfulStorageLabel(v.storage)
    return true
  })

  // Нормализуем пустую память у аксессуаров/наушников в «Стандарт»
  if (!productUsesPhoneStorage(p)) {
    p.variants.forEach((v) => {
      if (!v.storage) v.storage = 'Стандарт'
    })
  }

  recalcAllVariants(p)
}

function collectProduct() {
  const p = productsData.products[editingProductIdx]
  p.name = val('p-name'); p.brand = val('p-brand'); p.category = val('p-category')
  p.badge = val('p-badge') || null
  p.description = val('p-desc')
  p.showCatalogSpec = !!$('p-showCatalogSpec')?.checked
  p.hidden = !!$('p-hidden')?.checked
  p.importNames = val('p-importNames')

  p.images = (p.images || []).map((_, i) => val(`gal-url-${i}`)).filter(Boolean)
  if (p.images.length) {
    if (!p.coverImage || !p.images.includes(p.coverImage)) {
      p.coverImage = p.images[0]
    }
    p.image = p.coverImage || p.images[0]
  } else {
    p.coverImage = p.image || ''
    if (p.image) p.images = [p.image]
  }

  p.colors = p.colors.map((col, i) => ({
    id: col.id || `c${i}`,
    name: val(`col-name-${i}`),
    hex: $(`col-hex-${i}`)?.value || '#000',
    image: col.image || '',
    importNames: val(`col-import-${i}`) || '',
  }))

  if ($('storage-list')) {
    syncStorageFromEditor(p)
  }

  if ($('p-hasSim')?.checked) {
    p.simTypes = p.simTypes.map((_, i) => val(`sim-type-${i}`)).filter(Boolean)
  } else {
    p.simTypes = null
  }
  p.simModifiers = []

  if (p.sizes?.length) {
    p.sizes = p.sizes
      .map((_, i) => ({ label: normalizeWatchSizeLabel(val(`size-label-${i}`)) }))
      .filter((s) => s.label)
    if (!p.sizes.length) p.sizes = null
  }

  if (p.stock?.length) {
    p.stock = p.stock.map((_, i) => ({
      colorId: $(`stk-color-${i}`)?.value || '',
      simType: $(`stk-sim-${i}`)?.value || '',
      storageLabel: $(`stk-storage-${i}`)?.value || '',
      qty: num(`stk-qty-${i}`),
      note: 'В наличии',
    }))
  }

  collectProductVariants(p)
}

function collectInstallment() {
  if (!$('i-banks')) return
  const inst = storeData.settings.installment
  const banks = val('i-banks')
  if (banks) inst.banks = banks
  inst.terms = inst.terms.map((t, i) => {
    const moEl = $(`term-mo-${i}`)
    const commEl = $(`term-comm-${i}`)
    if (!moEl && !commEl) return t
    return {
      months: moEl ? (Number(moEl.value) || t.months) : t.months,
      commission: commEl?.value.trim() || t.commission,
    }
  })
  const dolName = val('i-dol-name')
  const dolComm = val('i-dol-comm')
  const dolImg = val('i-dol-img')
  const dolDesc = val('i-dol-desc')
  if (dolName) inst.dolyami.name = dolName
  if (dolComm) inst.dolyami.commission = dolComm
  if (dolImg) inst.dolyami.image = dolImg
  if (dolDesc) inst.dolyami.description = dolDesc
}

function collectReviews() {
  if (!$('r-neg-tg')) return
  const r = storeData.settings.reviews
  r.negative.telegram = val('r-neg-tg'); r.negative.vk = val('r-neg-vk'); r.negative.yandexForm = val('r-neg-form')
  r.positive.bonus = val('r-bonus'); r.positive.vk = val('r-vk')
  r.positive.avitoKarpinsk = val('r-avitoK'); r.positive.avitoKrasnoturinsk = val('r-avitoKT')
  r.positive.yandexKarpinsk = val('r-yk'); r.positive.yandexKrasnoturinsk = val('r-ykt')
}
