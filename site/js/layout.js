import { loadStore, getCatalogMode, setCatalogMode, isCatalogPage, assetUrl } from './store.js'
import { applyTheme } from './theme.js'
import { initMotion, initHeaderScroll } from './motion.js'

const NAV_ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"/></svg>',
  catalog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  installment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  reviews: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8l-4.8 2.5.9-5.4L4.2 8.7l5.4-.8L12 3Z"/></svg>',
  contacts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>',
  about: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><path d="M12 7h.01"/></svg>',
}

export async function initSite() {
  const store = await loadStore()
  applyTheme(store.theme)
  initMotion()
}

function cartButtonHtml() {
  return `
    <button class="cart-btn" id="cart-btn" aria-label="Корзина">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="9" cy="20" r="1.4"/>
        <circle cx="18" cy="20" r="1.4"/>
        <path d="M2.5 3.5h2.2l2.1 11.2a1.6 1.6 0 0 0 1.6 1.3h8.7a1.6 1.6 0 0 0 1.55-1.2L20.5 8H6.2"/>
      </svg>
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

function catalogSearchHtml(query = '') {
  const safe = String(query)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
  return `
    <label class="header-search liquid-glass">
      <span class="visually-hidden">Поиск</span>
      <input type="search" id="catalog-search" placeholder="Поиск по сайту" value="${safe}" autocomplete="off" enterkeyhint="search" />
      <span class="header-search__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      </span>
    </label>
  `
}

export async function renderHeader(activeId = '') {
  const store = await loadStore()
  applyTheme(store.theme)
  const { settings, navigation } = store
  const mode = getCatalogMode()
  const showToggle = document.body.dataset.showCatalogToggle === 'true'
  const showCart = document.body.dataset.cart === 'true'
  const catalogBar = document.body.dataset.catalogBar === 'true'

  const header = document.getElementById('site-header')
  if (!header) return

  header.classList.toggle('header--catalog', catalogBar)

  if (catalogBar) {
    const q = new URLSearchParams(location.search).get('q') || ''
    header.innerHTML = `
      <div class="header__stack">
        <div class="header__nav-row">
          <div class="container">
            <nav class="nav" id="main-nav">
              ${navigation.map((item) => `
                <a href="${item.href}" class="nav__link${activeId === item.id ? ' nav__link--active' : ''}">${item.label}</a>
              `).join('')}
            </nav>
          </div>
        </div>
        <div class="container header__inner header__inner--catalog">
          <a href="/" class="logo" aria-label="${settings.name}">
            <span class="logo__badge">
              <span class="logo__faces">
                <img src="${assetUrl(settings.logo)}" alt="" class="logo__img-text" aria-hidden="true" />
                <img src="${assetUrl(settings.logoIcon || 'assets/logo.png')}" alt="" class="logo__img-icon" aria-hidden="true" />
              </span>
            </span>
          </a>
          ${catalogSearchHtml(q)}
          <div class="header__actions">
            <div class="header__actions-slot header__actions-slot--toggle">
              ${showToggle ? catalogToggleHtml(mode) : ''}
            </div>
            <div class="header__actions-slot header__actions-slot--cart">
              ${showCart ? cartButtonHtml() : ''}
            </div>
          </div>
        </div>
      </div>
    `
  } else {
    header.innerHTML = `
      <div class="container header__inner">
        <a href="/" class="logo">
          <span class="logo__badge">
            <span class="logo__faces">
              <img src="${assetUrl(settings.logo)}" alt="${settings.name}" class="logo__img-text" />
              <img src="${assetUrl(settings.logoIcon || 'assets/logo.png')}" alt="" class="logo__img-icon" aria-hidden="true" />
            </span>
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
  }

  header.querySelectorAll('.catalog-toggle__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setCatalogMode(btn.dataset.mode)
      header.querySelectorAll('.catalog-toggle__btn').forEach((b) => {
        b.classList.toggle('catalog-toggle__btn--active', b.dataset.mode === btn.dataset.mode)
      })
      if (isCatalogPage()) {
        window.dispatchEvent(new CustomEvent('catalog-mode-change'))
      } else {
        window.location.href = '/catalog'
      }
    })
  })

  await renderMobileNav(activeId)
  initHeaderScroll()
  initMotion()
}

const MOBILE_NAV_LABELS = {
  home: 'Главная',
  catalog: 'Каталог',
  installment: 'Расср.',
  reviews: 'Отзывы',
  contacts: 'Контакты',
  about: 'О нас',
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

  nav.innerHTML = `
    <div class="mobile-nav__glass">
      ${navigation.map((item) => `
        <a href="${item.href}" class="mobile-nav__link${activeId === item.id ? ' mobile-nav__link--active' : ''}" title="${item.label}">
          <span class="mobile-nav__icon">${NAV_ICONS[item.id] || NAV_ICONS.about}</span>
          <span class="mobile-nav__label">${MOBILE_NAV_LABELS[item.id] || item.label}</span>
        </a>
      `).join('')}
    </div>
  `

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
          <a href="/" class="logo">
            <span class="logo__badge">
              <img src="${assetUrl(settings.logo)}" alt="${settings.name}" class="logo__img-text" />
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
