import { loadStore } from './store.js'
import {
  ICON_AVITO,
  ICON_VK,
  ICON_YANDEX,
  actionButton,
  renderStarsDisplay,
} from './review-icons.js'

const params = new URLSearchParams(window.location.search)
const stars = Math.min(5, Math.max(4, Number(params.get('stars')) || 5))
renderStarsDisplay(document.getElementById('stars-display'), stars)

const store = await loadStore()
const { positive } = store.settings.reviews

document.getElementById('review-text').textContent =
  `Оставьте отзыв на удобной площадке — и получите ${positive.bonus}.`

const bonusEl = document.getElementById('bonus-text')
bonusEl.replaceChildren()
const label = document.createElement('span')
label.className = 'review-bonus__label'
label.textContent = 'Бонус'
const value = document.createElement('span')
value.className = 'review-bonus__value'
value.textContent = positive.bonus
bonusEl.append(label, value)

document.getElementById('review-actions').innerHTML = [
  actionButton({
    id: 'link-avito-k',
    href: positive.avitoKarpinsk,
    variant: 'avito',
    icon: ICON_AVITO,
    title: 'Avito',
    subtitle: 'Карпинск',
  }),
  actionButton({
    id: 'link-avito-kt',
    href: positive.avitoKrasnoturinsk,
    variant: 'avito',
    icon: ICON_AVITO,
    title: 'Avito',
    subtitle: 'Краснотурьинск',
  }),
  actionButton({
    id: 'link-vk',
    href: positive.vk,
    variant: 'vk',
    icon: ICON_VK,
    title: 'ВКонтакте',
    subtitle: 'Публичный отзыв',
  }),
  actionButton({
    id: 'link-yandex-k',
    href: positive.yandexKarpinsk,
    variant: 'yandex',
    icon: ICON_YANDEX,
    title: 'Яндекс.Карты',
    subtitle: 'Карпинск',
  }),
  actionButton({
    id: 'link-yandex-kt',
    href: positive.yandexKrasnoturinsk,
    variant: 'yandex',
    icon: ICON_YANDEX,
    title: 'Яндекс.Карты',
    subtitle: 'Краснотурьинск',
  }),
].join('')
