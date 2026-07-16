import { loadStore } from './store.js'
import {
  ICON_FORM,
  ICON_TELEGRAM,
  ICON_VK,
  actionButton,
  renderStarsDisplay,
} from './review-icons.js'

const params = new URLSearchParams(window.location.search)
const stars = Math.min(5, Math.max(1, Number(params.get('stars')) || 3))
renderStarsDisplay(document.getElementById('stars-display'), stars)

const store = await loadStore()
const { negative } = store.settings.reviews

document.getElementById('review-actions').innerHTML = [
  actionButton({
    id: 'link-form',
    href: negative.yandexForm,
    variant: 'primary',
    icon: ICON_FORM,
    title: 'Написать в форму',
    subtitle: 'Только для владельца магазина',
  }),
  actionButton({
    id: 'link-telegram',
    href: negative.telegram,
    variant: 'telegram',
    icon: ICON_TELEGRAM,
    title: 'Telegram',
    subtitle: 'Быстрый ответ',
  }),
  actionButton({
    id: 'link-vk',
    href: negative.vk,
    variant: 'vk',
    icon: ICON_VK,
    title: 'ВКонтакте',
    subtitle: 'Личное сообщение',
  }),
].join('')
