const REVEAL_SELECTOR = [
  '.product-card',
  '.why-us li',
  '.info-card',
  '.used-card',
  '.review-card',
  '.page-main .page-content',
  '.product-detail__gallery',
  '.product-detail__info',
  '.features .section-title',
].join(',')

let motionReady = false

export function initMotion() {
  if (motionReady) return
  motionReady = true

  injectAmbient()
  setupReveal()
  setupHeroParallax()
  observeCartBadge()
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
    <div class="ambient__grain"></div>
  `
  document.body.prepend(layer)
}

function setupReveal() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const applyReveal = (root = document) => {
    const items = root.querySelectorAll(REVEAL_SELECTOR)
    items.forEach((el, i) => {
      if (el.classList.contains('reveal')) return
      el.classList.add('reveal')
      if (!reduceMotion) {
        el.style.setProperty('--reveal-delay', `${Math.min(i * 60, 400)}ms`)
      } else {
        el.classList.add('is-visible')
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
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  )

  const watch = () => {
    document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => observer.observe(el))
  }

  watch()

  window.addEventListener('catalog-rendered', watch)
  window.addEventListener('products-rendered', watch)

  new MutationObserver(() => {
    applyReveal()
    watch()
  }).observe(document.body, { childList: true, subtree: true })
}

function setupHeroParallax() {
  const hero = document.querySelector('.hero:not(.hero--compact) .hero__content')
  if (!hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (window.matchMedia('(pointer: coarse)').matches) return

  let raf = 0
  document.addEventListener('mousemove', (e) => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      const x = (e.clientX / window.innerWidth - 0.5) * 10
      const y = (e.clientY / window.innerHeight - 0.5) * 8
      hero.style.transform = `perspective(1200px) rotateY(${x * 0.15}deg) rotateX(${-y * 0.12}deg) translateZ(0)`
    })
  })
}

function observeCartBadge() {
  const badge = document.getElementById('cart-badge')
  if (!badge) return

  new MutationObserver(() => {
    if (badge.style.display !== 'none' && badge.textContent !== '0') {
      badge.classList.remove('cart-btn__badge--pop')
      void badge.offsetWidth
      badge.classList.add('cart-btn__badge--pop')
    }
  }).observe(badge, { attributes: true, childList: true, characterData: true, subtree: true })
}
