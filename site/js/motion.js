const REVEAL_SELECTOR = [
  '.why-us li',
  '.info-card',
  '.used-card',
  '.review-card',
  '.page-main .page-content',
  '.product-detail__gallery',
  '.product-detail__info',
  '.stores-section',
  '.features .section-title',
].join(',')

let motionReady = false

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Анимированный ambient — только на телефонах; на ноутбуках жрёт GPU */
function shouldUseAmbientLayer() {
  if (prefersReducedMotion()) return false
  return window.matchMedia('(max-width: 768px)').matches
}

export function initMotion() {
  if (motionReady) return
  motionReady = true

  if (shouldUseAmbientLayer()) injectAmbient()
  setupReveal()
  observeCartBadge()
}

const HEADER_COMPACT_THRESHOLD = 56

export function initHeaderScroll() {
  const header = document.getElementById('site-header')
  if (!header) return

  const mobileQuery = window.matchMedia('(max-width: 768px)')
  let ticking = false

  const update = () => {
    ticking = false
    if (!mobileQuery.matches) {
      header.classList.remove('header--compact')
      return
    }
    header.classList.toggle('header--compact', window.scrollY > HEADER_COMPACT_THRESHOLD)
  }

  if (!header.dataset.scrollBound) {
    header.dataset.scrollBound = '1'
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }, { passive: true })
    mobileQuery.addEventListener('change', update)
  }

  update()
}

function injectAmbient() {
  if (document.querySelector('.ambient')) return

  const layer = document.createElement('div')
  layer.className = 'ambient'
  layer.setAttribute('aria-hidden', 'true')
  layer.innerHTML = `
    <div class="ambient__mesh"></div>
    <div class="ambient__orb ambient__orb--1"></div>
    <div class="ambient__orb ambient__orb--2"></div>
    <div class="ambient__orb ambient__orb--3"></div>
    <div class="ambient__grid"></div>
  `
  document.body.prepend(layer)
}

function setupReveal() {
  const reduceMotion = prefersReducedMotion()

  const applyReveal = () => {
    document.querySelectorAll(REVEAL_SELECTOR).forEach((el, i) => {
      if (el.classList.contains('reveal')) return
      el.classList.add('reveal')
      if (reduceMotion) {
        el.classList.add('is-visible')
      } else {
        el.style.setProperty('--reveal-delay', `${Math.min(i * 60, 400)}ms`)
      }
    })
  }

  applyReveal()

  if (reduceMotion) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
  )

  const watch = () => {
    document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => observer.observe(el))
  }

  watch()
  window.addEventListener('catalog-rendered', applyReveal)
  window.addEventListener('catalog-rendered', watch)
  window.addEventListener('products-rendered', watch)
}

function observeCartBadge() {
  const badge = document.getElementById('cart-badge')
  if (!badge) return

  let lastCount = badge.textContent
  let animating = false

  new MutationObserver(() => {
    if (animating || badge.textContent === lastCount) return
    lastCount = badge.textContent
    if (badge.style.display === 'none' || badge.textContent === '0') return
    animating = true
    badge.classList.remove('cart-btn__badge--pop')
    void badge.offsetWidth
    badge.classList.add('cart-btn__badge--pop')
    animating = false
  }).observe(badge, { childList: true, characterData: true, subtree: true })
}
