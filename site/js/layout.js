import { loadStore, getCatalogMode, setCatalogMode } from './store.js'
import { applyTheme } from './theme.js'
import { initMotion } from './motion.js'

const NAV_ICONS = {
  home: '🏠',
  catalog: '📦',
  about: 'ℹ️',
  installment: '💳',
  contacts: '📞',
  reviews: '⭐',
}

export async function initSite() {
  const store = await loadStore()
  applyTheme(store.theme)
  initMotion()
}

function cartButtonHtml() {
  return `
    <button class="cart-btn" id="cart-btn" aria-label="Корзина">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
      <span class="cart-btn__badge" id="cart-badge" style="display:none">0</span>
    </button>
  `
}

function catalogToggleHtml(mode) {
  return `
    <div class="catalog-toggle" id="catalog-toggle">
      <button class="catalog-toggle__btn${mode === 'new' ? ' catalog-toggle__btn--active' : ''}" data-mode="new">Новые</button>
      <button class="catalog-toggle__btn${mode === 'used' ? ' catalog-toggle__btn--active' : ''}" data-mode="used">Б/У</button>
    </div>
  `
}

export async function renderHeader(activeId = '') {
  const store = await loadStore()
  applyTheme(store.theme)
  const { settings, navigation } = store
  const mode = getCatalogMode()
  const showToggle = document.body.dataset.showCatalogToggle === 'true'
  const showCart = document.body.dataset.cart === 'true'

  const header = document.getElementById('site-header')
  if (!header) return

  header.innerHTML = `
    <div class="container header__inner">
      <a href="index.html" class="logo">
        <span class="logo__badge">
          <img src="${settings.logo}" alt="${settings.name}" class="logo__img-text" />
        </span>
      </a>
      <nav class="nav" id="main-nav">
        ${navigation.map((item) => `
          <a href="${item.href}" class="nav__link${activeId === item.id ? ' nav__link--active' : ''}">${item.label}</a>
        `).join('')}
      </nav>
      <div class="header__actions">
        <div class="header__actions-slot header__actions-slot--toggle">
          ${showToggle ? catalogToggleHtml(mode) : ''}
        </div>
        <div class="header__actions-slot header__actions-slot--cart">
          ${showCart ? cartButtonHtml() : ''}
        </div>
      </div>
    </div>
  `

  header.querySelectorAll('.catalog-toggle__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setCatalogMode(btn.dataset.mode)
      header.querySelectorAll('.catalog-toggle__btn').forEach((b) => {
        b.classList.toggle('catalog-toggle__btn--active', b.dataset.mode === btn.dataset.mode)
      })
      if (window.location.pathname.endsWith('catalog.html')) {
        window.dispatchEvent(new CustomEvent('catalog-mode-change'))
      } else {
        window.location.href = 'catalog.html'
      }
    })
  })

  await renderMobileNav(activeId)
  initMotion()
}

export async function renderMobileNav(activeId = '') {
  const store = await loadStore()
  const { navigation } = store

  let nav = document.getElementById('mobile-nav')
  if (!nav) {
    nav = document.createElement('nav')
    nav.id = 'mobile-nav'
    nav.className = 'mobile-nav'
    nav.setAttribute('aria-label', 'Мобильное меню')
    document.body.appendChild(nav)
  }

  nav.innerHTML = navigation.map((item) => `
    <a href="${item.href}" class="mobile-nav__link${activeId === item.id ? ' mobile-nav__link--active' : ''}">
      <span class="mobile-nav__icon">${NAV_ICONS[item.id] || '•'}</span>
      <span class="mobile-nav__label">${item.label}</span>
    </a>
  `).join('')

  document.body.classList.add('has-mobile-nav')
}

export async function renderFooter() {
  const store = await loadStore()
  const { settings } = store
  const footer = document.getElementById('site-footer')
  if (!footer) return

  footer.innerHTML = `
    <div class="container">
      <div class="footer__grid">
        <div class="footer__brand">
          <a href="index.html" class="logo">
            <span class="logo__badge">
              <img src="${settings.logo}" alt="${settings.name}" class="logo__img-text" />
            </span>
          </a>
          <p>${settings.description}</p>
        </div>
        <div class="footer__col">
          <h4>Магазины</h4>
          <ul>
            ${settings.addresses.map((a) => `
              <li>
                <a href="${a.yandexMaps}" target="_blank" rel="noopener" class="footer__address-link">
                  ${a.city}, ${a.street}${a.note ? ` (${a.note})` : ''}
                </a>
                <span class="footer__hours">${settings.hours.weekdays} · ${settings.hours.weekends}</span>
              </li>
            `).join('')}
          </ul>
        </div>
        <div class="footer__col">
          <h4>Мы в сети</h4>
          <ul>
            <li><a href="${settings.links.telegram}" target="_blank" rel="noopener">Telegram</a></li>
            <li><a href="${settings.links.vk}" target="_blank" rel="noopener">ВКонтакте</a></li>
            <li><a href="${settings.links.avitoKarpinsk}" target="_blank" rel="noopener">Avito — Карпинск</a></li>
            <li><a href="${settings.links.avitoKrasnoturinsk}" target="_blank" rel="noopener">Avito — Краснотурьинск</a></li>
          </ul>
        </div>
        <div class="footer__col">
          <h4>Контакты</h4>
          <ul>
            <li><a href="tel:${settings.phone}">${settings.phoneContactName || 'Илья'}: ${settings.phoneDisplay}</a></li>
          </ul>
        </div>
      </div>
      <div class="footer__bottom">
        <span>© ${new Date().getFullYear()} ${settings.name}. ${settings.legalName || ''}</span>
      </div>
    </div>
  `
}
