/** SVG-иконки для страниц отзывов (без эмодзи) */

export const ICON_STAR = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3.2 2.35 4.76 5.25.76-3.8 3.7.9 5.24L12 15.9l-4.7 2.46.9-5.24-3.8-3.7 5.25-.76L12 3.2Z"/></svg>`

export const ICON_STAR_OUTLINE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m12 3.2 2.35 4.76 5.25.76-3.8 3.7.9 5.24L12 15.9l-4.7 2.46.9-5.24-3.8-3.7 5.25-.76L12 3.2Z"/></svg>`

export const ICON_SPARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.2"/></svg>`

export const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1a7 7 0 0 1-7 7h-1l-4.2 2.5c-.5.3-1.1-.1-1-.7L7.2 17A7 7 0 0 1 4 13v-1Z"/></svg>`

export const ICON_ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>`

export const ICON_AVITO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z"/><path d="M12 12v8"/><path d="m4 8.5 8 3.5 8-3.5"/></svg>`

export const ICON_VK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M7.5 9.5c.2 4.2 2.2 6.5 6.2 6.5h.8V13.8c1.4.2 2.3 1.2 2.8 2.2h1.7c-.6-1.6-1.8-2.7-2.8-3.1 1-.5 2-1.7 2.3-3.4h-1.6c-.4 1.5-1.4 2.7-2.4 2.9V9.5h-1.6v5.2c-1.1 0-2.3-1.2-2.4-5.2H7.5Z"/></svg>`

export const ICON_YANDEX = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.5-5.2 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.8 6.5 11 6.5 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>`

export const ICON_TELEGRAM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 4 3.5 11.2c-.7.3-.7 1.3 0 1.5l4.7 1.5 1.8 5.3c.2.7 1.1.9 1.6.3l2.6-2.8 4.8 3.5c.6.4 1.5.1 1.7-.6L22 5.2c.2-.8-.6-1.5-1.4-1.2Z"/><path d="m9.3 14.2 8.4-6.3"/></svg>`

export const ICON_FORM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h7l3 3v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M15 4v4h4"/><path d="M9.5 12h5"/><path d="M9.5 16h5"/></svg>`

export function renderStarsDisplay(container, filled, { total = 5 } = {}) {
  if (!container) return
  const n = Math.max(0, Math.min(total, Number(filled) || 0))
  container.innerHTML = Array.from({ length: total }, (_, i) => (
    `<span class="review-stars-display__star${i < n ? ' is-on' : ''}">${i < n ? ICON_STAR : ICON_STAR_OUTLINE}</span>`
  )).join('')
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function actionButton({ href, variant, icon, title, subtitle, id }) {
  const safeHref = esc(href || '#')
  return `
    <a class="review-action review-action--${esc(variant)}" id="${esc(id)}" href="${safeHref}" target="_blank" rel="noopener">
      <span class="review-action__icon" aria-hidden="true">${icon}</span>
      <span class="review-action__text">
        <span class="review-action__title">${esc(title)}</span>
        ${subtitle ? `<span class="review-action__sub">${esc(subtitle)}</span>` : ''}
      </span>
      <span class="review-action__go" aria-hidden="true">${ICON_ARROW}</span>
    </a>
  `
}
