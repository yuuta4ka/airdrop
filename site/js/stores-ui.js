import { assetUrl } from './store.js'

export function renderStorePhotosHtml(photos, { variant = 'card' } = {}) {
  if (!photos?.length) return ''

  const slides = photos.map((src, i) => `
    <img src="${assetUrl(src)}" alt="" class="store-photos__img${i === 0 ? ' store-photos__img--active' : ''}" loading="lazy" />
  `).join('')

  if (variant === 'inline') {
    return `
      <div class="store-photos store-photos--inline" data-store-photos>
        <div class="store-photos__track">${slides}</div>
        ${photos.length > 1 ? `
          <button type="button" class="store-photos__nav store-photos__nav--prev" aria-label="Предыдущее фото">‹</button>
          <button type="button" class="store-photos__nav store-photos__nav--next" aria-label="Следующее фото">›</button>
        ` : ''}
      </div>
    `
  }

  return `
    <div class="store-photos" data-store-photos>
      <div class="store-photos__track">${slides}</div>
      ${photos.length > 1 ? `
        <button type="button" class="store-photos__nav store-photos__nav--prev" aria-label="Предыдущее фото">‹</button>
        <button type="button" class="store-photos__nav store-photos__nav--next" aria-label="Следующее фото">›</button>
        <div class="store-photos__dots">
          ${photos.map((_, i) => `<span class="store-photos__dot${i === 0 ? ' store-photos__dot--active' : ''}"></span>`).join('')}
        </div>
      ` : ''}
    </div>
  `
}

export function renderStoresSectionHtml(addresses, hours) {
  const withPhotos = (addresses || []).filter((a) => a.photos?.length)
  if (!withPhotos.length) return ''

  return withPhotos.map((a) => `
    <article class="store-card">
      ${renderStorePhotosHtml(a.photos)}
      <div class="store-card__body">
        <h3 class="store-card__city">${a.city}</h3>
        <p class="store-card__address">
          <a href="${a.yandexMaps}" target="_blank" rel="noopener">${a.street}${a.note ? ` (${a.note})` : ''}</a>
        </p>
        <p class="store-card__hours">${hours.weekdays} · ${hours.weekends}</p>
        <a href="${a.yandexMaps}" class="btn btn--secondary btn--sm" target="_blank" rel="noopener">Яндекс.Карты →</a>
      </div>
    </article>
  `).join('')
}

export function initStorePhotoGalleries(root = document) {
  root.querySelectorAll('[data-store-photos]').forEach((gallery) => {
    if (gallery.dataset.bound) return
    gallery.dataset.bound = '1'

    const imgs = [...gallery.querySelectorAll('.store-photos__img')]
    const dots = [...gallery.querySelectorAll('.store-photos__dot')]
    if (imgs.length <= 1) return

    let index = 0

    const show = (next) => {
      index = (next + imgs.length) % imgs.length
      imgs.forEach((img, i) => img.classList.toggle('store-photos__img--active', i === index))
      dots.forEach((dot, i) => dot.classList.toggle('store-photos__dot--active', i === index))
    }

    gallery.querySelector('.store-photos__nav--prev')?.addEventListener('click', () => show(index - 1))
    gallery.querySelector('.store-photos__nav--next')?.addEventListener('click', () => show(index + 1))
    dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)))
  })
}
