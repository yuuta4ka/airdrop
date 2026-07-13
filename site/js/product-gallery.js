const FADE_MS = 180
const LIGHTBOX_SWAP_MS = 280
const SWIPE_THRESHOLD = 36

function preloadImages(urls) {
  urls.forEach((url) => {
    if (!url) return
    loadImage(url).catch(() => {})
  })
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) {
      resolve()
      return
    }
    const img = new Image()
    img.onload = () => resolve(url)
    img.onerror = () => resolve(url) // не блокируем смену навсегда
    img.src = url
    if (img.complete) resolve(url)
  })
}

function waitTransition(el, prop, ms) {
  return new Promise((resolve) => {
    if (!el) {
      resolve()
      return
    }
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.removeEventListener('transitionend', onEnd)
      resolve()
    }
    const onEnd = (e) => {
      if (e.target === el && (!prop || e.propertyName === prop)) finish()
    }
    el.addEventListener('transitionend', onEnd)
    setTimeout(finish, ms)
  })
}

function bindSwipe(el, { onSwipe, canSwipe, suppressClickEl }) {
  if (!el) return

  let startX = 0
  let startY = 0
  let tracking = false
  let axis = null
  let swiped = false
  let pointerId = null

  const reset = () => {
    tracking = false
    axis = null
    pointerId = null
  }

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target.closest?.('button')) return
    if (!canSwipe?.()) return
    tracking = true
    swiped = false
    axis = null
    pointerId = e.pointerId
    startX = e.clientX
    startY = e.clientY
    try { el.setPointerCapture?.(e.pointerId) } catch { /* ignore */ }
  })

  el.addEventListener('pointermove', (e) => {
    if (!tracking || e.pointerId !== pointerId) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (!axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      if (axis === 'y') {
        reset()
        return
      }
    }
    if (axis === 'x' && e.cancelable) e.preventDefault()
  }, { passive: false })

  const end = (e) => {
    if (!tracking || (pointerId != null && e.pointerId !== pointerId)) return
    const dx = e.clientX - startX
    if (axis === 'x' && Math.abs(dx) >= SWIPE_THRESHOLD) {
      swiped = true
      onSwipe(dx > 0 ? -1 : 1)
    }
    reset()
  }

  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', () => reset())

  if (suppressClickEl) {
    suppressClickEl.addEventListener('click', (e) => {
      if (!swiped) return
      e.preventDefault()
      e.stopPropagation()
      swiped = false
    }, true)
  }
}

export function initProductGallery({ stage, mainImg, prevBtn, nextBtn, getImages, getAlt }) {
  if (!stage || !mainImg) return { update: () => {} }

  let index = 0
  let lightbox = null
  let closing = false
  let currentSrc = null
  let hasRenderedOnce = false
  let swapToken = 0

  async function setMainImage(src, alt, { animate } = {}) {
    if (src === currentSrc) {
      mainImg.alt = alt || ''
      return
    }
    const token = ++swapToken

    // Первый кадр — сразу в DOM, без ожидания сети (быстрее открытие карточки)
    if (!animate || !hasRenderedOnce) {
      currentSrc = src
      mainImg.src = src
      mainImg.alt = alt || ''
      hasRenderedOnce = true
      loadImage(src).catch(() => {})
      return
    }

    // Смена кадра — ждём загрузку, чтобы анимация не опережала фото
    await loadImage(src)
    if (token !== swapToken) return

    const FADE_CLASS = 'product-detail__photo--fade'
    mainImg.classList.add(FADE_CLASS)
    await waitTransition(mainImg, 'opacity', FADE_MS + 60)
    if (token !== swapToken) return

    currentSrc = src
    mainImg.src = src
    mainImg.alt = alt || ''
    try {
      if (typeof mainImg.decode === 'function') await mainImg.decode()
    } catch { /* ignore */ }
    if (token !== swapToken) return

    requestAnimationFrame(() => {
      if (token !== swapToken) return
      mainImg.classList.remove(FADE_CLASS)
    })
  }

  function ensureLightbox() {
    if (lightbox) return lightbox

    lightbox = document.createElement('div')
    lightbox.className = 'lightbox'
    lightbox.hidden = true
    lightbox.innerHTML = `
      <button type="button" class="lightbox__backdrop" aria-label="Закрыть"></button>
      <button type="button" class="lightbox__close" aria-label="Закрыть">✕</button>
      <button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="Назад">‹</button>
      <div class="lightbox__frame">
        <img class="lightbox__img" alt="" />
      </div>
      <button type="button" class="lightbox__nav lightbox__nav--next" aria-label="Вперёд">›</button>
      <div class="lightbox__counter"></div>
    `
    document.body.appendChild(lightbox)

    lightbox.querySelector('.lightbox__backdrop')?.addEventListener('click', closeLightbox)
    lightbox.querySelector('.lightbox__close')?.addEventListener('click', closeLightbox)
    lightbox.querySelector('.lightbox__nav--prev')?.addEventListener('click', () => show(index - 1, true))
    lightbox.querySelector('.lightbox__nav--next')?.addEventListener('click', () => show(index + 1, true))

    const frame = lightbox.querySelector('.lightbox__frame')
    bindSwipe(frame, {
      canSwipe: () => getImages().length > 1,
      onSwipe: (dir) => show(index + dir, true),
      suppressClickEl: frame,
    })

    document.addEventListener('keydown', (e) => {
      if (lightbox.hidden) return
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') show(index - 1, true)
      if (e.key === 'ArrowRight') show(index + 1, true)
    })

    return lightbox
  }

  function openLightbox() {
    const images = getImages()
    if (!images.length || closing) return
    const lb = ensureLightbox()
    if (index >= images.length) index = 0
    const lbImg = lb.querySelector('.lightbox__img')
    const hasMany = images.length > 1
    if (lbImg) {
      lbImg.src = images[index]
      lbImg.alt = getAlt?.() || ''
    }
    lb.querySelector('.lightbox__counter').textContent = `${index + 1} / ${images.length}`
    lb.querySelector('.lightbox__nav--prev')?.toggleAttribute('hidden', !hasMany)
    lb.querySelector('.lightbox__nav--next')?.toggleAttribute('hidden', !hasMany)
    lb.hidden = false
    requestAnimationFrame(() => lb.classList.add('lightbox--open'))
    document.body.style.overflow = 'hidden'
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden || closing) return
    closing = true
    lightbox.classList.remove('lightbox--open')
    lightbox.classList.add('lightbox--closing')
    setTimeout(() => {
      lightbox.hidden = true
      lightbox.classList.remove('lightbox--closing')
      closing = false
      const cartOpen = document.getElementById('cart-panel')?.classList.contains('cart--open')
      const checkout = document.getElementById('checkout-modal')
      const checkoutOpen = checkout && !checkout.hasAttribute('hidden')
      if (!cartOpen && !checkoutOpen) document.body.style.overflow = ''
    }, 280)
  }

  async function show(nextIndex, inLightbox = false) {
    const images = getImages()
    if (!images.length) return
    if (images.length <= 1 && !inLightbox) return
    const next = (nextIndex + images.length) % images.length
    if (next === index) return

    if (inLightbox) {
      const frame = lightbox?.querySelector('.lightbox__frame')
      const lbImg = lightbox?.querySelector('.lightbox__img')
      const token = ++swapToken
      const src = images[next]
      frame?.classList.add('lightbox__frame--swap')
      await Promise.all([
        loadImage(src),
        waitTransition(frame, 'opacity', LIGHTBOX_SWAP_MS + 60),
      ])
      if (token !== swapToken) return
      index = next
      if (lbImg) {
        lbImg.src = src
        lbImg.alt = getAlt?.() || ''
        try {
          if (typeof lbImg.decode === 'function') await lbImg.decode()
        } catch { /* ignore */ }
      }
      if (token !== swapToken) return
      const counter = lightbox?.querySelector('.lightbox__counter')
      if (counter) counter.textContent = `${index + 1} / ${images.length}`
      frame?.classList.remove('lightbox__frame--swap')
      preloadImages([images[(index + 1) % images.length], images[(index - 1 + images.length) % images.length]])
      return
    }

    index = next
    await setMainImage(images[index], getAlt?.(), { animate: true })
    preloadImages([images[(index + 1) % images.length], images[(index - 1 + images.length) % images.length]])
  }

  function render(inLightbox = false) {
    const images = getImages()
    const alt = getAlt?.() || ''
    const hasMany = images.length > 1

    if (!images.length) {
      mainImg.removeAttribute('src')
      currentSrc = null
      prevBtn?.setAttribute('hidden', '')
      nextBtn?.setAttribute('hidden', '')
      stage.classList.remove('product-gallery__stage--multi')
      return
    }

    if (index >= images.length) index = 0

    if (!inLightbox) {
      setMainImage(images[index], alt, { animate: true })
      preloadImages([images[(index + 1) % images.length], images[(index - 1 + images.length) % images.length]])
    }

    if (prevBtn) prevBtn.toggleAttribute('hidden', !hasMany)
    if (nextBtn) nextBtn.toggleAttribute('hidden', !hasMany)
    stage.classList.toggle('product-gallery__stage--multi', hasMany)

    if (inLightbox && lightbox) {
      const lbImg = lightbox.querySelector('.lightbox__img')
      const counter = lightbox.querySelector('.lightbox__counter')
      if (lbImg) {
        lbImg.src = images[index]
        lbImg.alt = alt
      }
      if (counter) counter.textContent = `${index + 1} / ${images.length}`
      lightbox.querySelector('.lightbox__nav--prev')?.toggleAttribute('hidden', !hasMany)
      lightbox.querySelector('.lightbox__nav--next')?.toggleAttribute('hidden', !hasMany)
    }
  }

  prevBtn?.addEventListener('click', (e) => { e.stopPropagation(); show(index - 1) })
  nextBtn?.addEventListener('click', (e) => { e.stopPropagation(); show(index + 1) })
  mainImg.addEventListener('click', openLightbox)

  bindSwipe(stage, {
    canSwipe: () => getImages().length > 1,
    onSwipe: (dir) => show(index + dir),
    suppressClickEl: mainImg,
  })

  return {
    update(reset = false) {
      if (reset) index = 0
      render(false)
    },
  }
}
