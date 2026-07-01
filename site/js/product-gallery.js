export function initProductGallery({ stage, mainImg, prevBtn, nextBtn, getImages, getAlt }) {
  if (!stage || !mainImg) return { update: () => {} }

  let index = 0
  let lightbox = null
  let closing = false

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

  function show(nextIndex, inLightbox = false) {
    const images = getImages()
    if (!images.length) return
    if (images.length <= 1 && !inLightbox) return
    const next = (nextIndex + images.length) % images.length
    if (next === index) return

    if (inLightbox) {
      const frame = lightbox?.querySelector('.lightbox__frame')
      const lbImg = lightbox?.querySelector('.lightbox__img')
      frame?.classList.add('lightbox__frame--swap')
      setTimeout(() => {
        index = next
        if (lbImg) {
          lbImg.src = images[index]
          lbImg.alt = getAlt?.() || ''
        }
        const counter = lightbox?.querySelector('.lightbox__counter')
        if (counter) counter.textContent = `${index + 1} / ${images.length}`
        frame?.classList.remove('lightbox__frame--swap')
      }, 150)
      return
    }

    mainImg.classList.add('product-detail__photo--fade')
    setTimeout(() => {
      index = next
      mainImg.src = images[index]
      mainImg.classList.remove('product-detail__photo--fade')
    }, 150)
  }

  function render(inLightbox = false) {
    const images = getImages()
    const alt = getAlt?.() || ''
    const hasMany = images.length > 1

    if (!images.length) {
      mainImg.removeAttribute('src')
      prevBtn?.setAttribute('hidden', '')
      nextBtn?.setAttribute('hidden', '')
      stage.classList.remove('product-gallery__stage--multi')
      return
    }

    if (index >= images.length) index = 0

    if (!inLightbox) {
      mainImg.src = images[index]
      mainImg.alt = alt
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

  let touchStartX = 0
  stage.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX }, { passive: true })
  stage.addEventListener('touchend', (e) => {
    const images = getImages()
    if (images.length <= 1) return
    const diff = e.changedTouches[0].screenX - touchStartX
    if (Math.abs(diff) < 40) return
    show(diff > 0 ? index - 1 : index + 1)
  }, { passive: true })

  return {
    update(reset = false) {
      if (reset) index = 0
      render(false)
    },
  }
}
