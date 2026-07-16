import { loadStore } from './store.js'
import { renderHeader } from './layout.js'
import { ICON_STAR } from './review-icons.js'

const store = await loadStore()
document.getElementById('review-title').textContent =
  `Оцените работу ${store.settings.reviewBrand}`
await renderHeader('reviews')

const buttons = [...document.querySelectorAll('.star-btn')]
buttons.forEach((btn) => {
  btn.innerHTML = ICON_STAR
  btn.addEventListener('mouseenter', () => highlight(Number(btn.dataset.rating)))
  btn.addEventListener('focus', () => highlight(Number(btn.dataset.rating)))
  btn.addEventListener('click', () => {
    const rating = Number(btn.dataset.rating)
    location.href = rating <= 3
      ? `/review-negative?stars=${rating}`
      : `/review-positive?stars=${rating}`
  })
})

document.getElementById('stars').addEventListener('mouseleave', () => {
  buttons.forEach((b) => b.classList.remove('star-btn--active'))
})

function highlight(upTo) {
  buttons.forEach((b) => {
    b.classList.toggle('star-btn--active', Number(b.dataset.rating) <= upTo)
  })
}
