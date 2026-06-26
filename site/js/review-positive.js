import { loadStore } from './store.js'

const params = new URLSearchParams(window.location.search)
const stars = Math.min(5, Math.max(4, Number(params.get('stars')) || 5))

document.getElementById('stars-display').textContent = '★'.repeat(stars)

const store = await loadStore()
const { positive } = store.settings.reviews

document.getElementById('review-text').textContent =
  `Помогите нам стать лучше. Оставьте отзыв на удобной площадке и получите ${positive.bonus}.`

document.getElementById('bonus-text').textContent = `🎁 Бонус: ${positive.bonus}`

document.getElementById('link-avito-k').href = positive.avitoKarpinsk
document.getElementById('link-avito-kt').href = positive.avitoKrasnoturinsk
document.getElementById('link-vk').href = positive.vk
document.getElementById('link-yandex-k').href = positive.yandexKarpinsk
document.getElementById('link-yandex-kt').href = positive.yandexKrasnoturinsk
