import { loadStore } from './store.js'

const params = new URLSearchParams(window.location.search)
const stars = Math.min(5, Math.max(1, Number(params.get('stars')) || 3))

document.getElementById('stars-display').textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars)

const store = await loadStore()
const { negative } = store.settings.reviews

document.getElementById('link-form').href = negative.yandexForm
document.getElementById('link-telegram').href = negative.telegram
document.getElementById('link-vk').href = negative.vk
