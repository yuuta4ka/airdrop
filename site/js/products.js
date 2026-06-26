export const categories = [
  { id: 'all', label: 'Все', icon: '✦' },
  { id: 'iphone', label: 'iPhone', icon: '📱' },
  { id: 'ipad', label: 'iPad', icon: '📲' },
  { id: 'macbook', label: 'MacBook', icon: '💻' },
  { id: 'apple-watch', label: 'Apple Watch', icon: '⌚' },
  { id: 'airpods', label: 'AirPods', icon: '🎧' },
  { id: 'samsung', label: 'Samsung', icon: '📱' },
]

export const products = [
  {
    id: 1,
    slug: 'iphone-16-pro-max',
    name: 'iPhone 16 Pro Max',
    category: 'iphone',
    brand: 'Apple',
    badge: 'Новинка',
    emoji: '📱',
    description: 'Флагманский iPhone с чипом A18 Pro, титановым корпусом и продвинутой камерой 48 МП.',
    colors: [
      { id: 'black', name: 'Чёрный титан', hex: '#2d2d2d' },
      { id: 'natural', name: 'Натуральный титан', hex: '#c4b89a' },
      { id: 'white', name: 'Белый титан', hex: '#e8e8e8' },
      { id: 'desert', name: 'Пустынный титан', hex: '#c4a574' },
    ],
    storage: [
      { label: '256 ГБ', price: 139990 },
      { label: '512 ГБ', price: 159990 },
      { label: '1 ТБ', price: 179990 },
    ],
    sizes: null,
  },
  {
    id: 2,
    slug: 'iphone-16-pro',
    name: 'iPhone 16 Pro',
    category: 'iphone',
    brand: 'Apple',
    badge: 'Хит',
    emoji: '📱',
    description: 'Профессиональный iPhone с A18 Pro, титановым корпусом и кнопкой Camera Control.',
    colors: [
      { id: 'black', name: 'Чёрный титан', hex: '#2d2d2d' },
      { id: 'natural', name: 'Натуральный титан', hex: '#c4b89a' },
      { id: 'white', name: 'Белый титан', hex: '#e8e8e8' },
      { id: 'desert', name: 'Пустынный титан', hex: '#c4a574' },
    ],
    storage: [
      { label: '128 ГБ', price: 119990 },
      { label: '256 ГБ', price: 129990 },
      { label: '512 ГБ', price: 149990 },
    ],
    sizes: null,
  },
  {
    id: 3,
    slug: 'iphone-16',
    name: 'iPhone 16',
    category: 'iphone',
    brand: 'Apple',
    badge: null,
    emoji: '📱',
    description: 'Новый iPhone с чипом A18, USB-C и кнопкой Camera Control.',
    colors: [
      { id: 'black', name: 'Чёрный', hex: '#1a1a1a' },
      { id: 'white', name: 'Белый', hex: '#f5f5f5' },
      { id: 'pink', name: 'Розовый', hex: '#f5b8c8' },
      { id: 'teal', name: 'Бирюзовый', hex: '#4a9e9e' },
      { id: 'ultramarine', name: 'Ультрамарин', hex: '#3d5a9e' },
    ],
    storage: [
      { label: '128 ГБ', price: 89990 },
      { label: '256 ГБ', price: 99990 },
      { label: '512 ГБ', price: 119990 },
    ],
    sizes: null,
  },
  {
    id: 4,
    slug: 'iphone-15',
    name: 'iPhone 15',
    category: 'iphone',
    brand: 'Apple',
    badge: 'Скидка',
    emoji: '📱',
    description: 'iPhone 15 с Dynamic Island, USB-C и отличной камерой 48 МП.',
    colors: [
      { id: 'black', name: 'Чёрный', hex: '#1a1a1a' },
      { id: 'blue', name: 'Голубой', hex: '#a8c8e8' },
      { id: 'green', name: 'Зелёный', hex: '#c8e0c8' },
      { id: 'pink', name: 'Розовый', hex: '#f5c8d8' },
      { id: 'yellow', name: 'Жёлтый', hex: '#f5e8a8' },
    ],
    storage: [
      { label: '128 ГБ', price: 74990 },
      { label: '256 ГБ', price: 84990 },
      { label: '512 ГБ', price: 99990 },
    ],
    sizes: null,
  },
  {
    id: 5,
    slug: 'ipad-pro-13',
    name: 'iPad Pro 13" M4',
    category: 'ipad',
    brand: 'Apple',
    badge: 'Новинка',
    emoji: '📲',
    description: 'Самый тонкий iPad Pro с дисплеем Ultra Retina XDR и чипом M4.',
    colors: [
      { id: 'black', name: 'Космический чёрный', hex: '#2d2d2d' },
      { id: 'silver', name: 'Серебристый', hex: '#d8d8d8' },
    ],
    storage: [
      { label: '256 ГБ', price: 129990 },
      { label: '512 ГБ', price: 149990 },
      { label: '1 ТБ', price: 169990 },
      { label: '2 ТБ', price: 199990 },
    ],
    sizes: null,
  },
  {
    id: 6,
    slug: 'ipad-air-11',
    name: 'iPad Air 11" M2',
    category: 'ipad',
    brand: 'Apple',
    badge: null,
    emoji: '📲',
    description: 'Лёгкий и мощный iPad Air с чипом M2 и дисплеем Liquid Retina.',
    colors: [
      { id: 'blue', name: 'Голубой', hex: '#6a9ec8' },
      { id: 'purple', name: 'Фиолетовый', hex: '#9a8ac8' },
      { id: 'starlight', name: 'Сияющая звезда', hex: '#e8e0d0' },
      { id: 'space-gray', name: 'Космический серый', hex: '#5a5a5a' },
    ],
    storage: [
      { label: '128 ГБ', price: 69990 },
      { label: '256 ГБ', price: 79990 },
      { label: '512 ГБ', price: 99990 },
    ],
    sizes: null,
  },
  {
    id: 7,
    slug: 'ipad-mini-7',
    name: 'iPad mini 7',
    category: 'ipad',
    brand: 'Apple',
    badge: 'Хит',
    emoji: '📲',
    description: 'Компактный iPad mini с A17 Pro — мощь в ладони.',
    colors: [
      { id: 'space-gray', name: 'Космический серый', hex: '#5a5a5a' },
      { id: 'blue', name: 'Голубой', hex: '#6a9ec8' },
      { id: 'purple', name: 'Фиолетовый', hex: '#9a8ac8' },
      { id: 'starlight', name: 'Сияющая звезда', hex: '#e8e0d0' },
    ],
    storage: [
      { label: '128 ГБ', price: 54990 },
      { label: '256 ГБ', price: 64990 },
      { label: '512 ГБ', price: 84990 },
    ],
    sizes: null,
  },
  {
    id: 8,
    slug: 'macbook-air-15',
    name: 'MacBook Air 15" M3',
    category: 'macbook',
    brand: 'Apple',
    badge: 'Новинка',
    emoji: '💻',
    description: 'Большой MacBook Air с чипом M3 — идеален для работы и учёбы.',
    colors: [
      { id: 'midnight', name: 'Полночь', hex: '#2a2a3a' },
      { id: 'starlight', name: 'Сияющая звезда', hex: '#e8e0d0' },
      { id: 'space-gray', name: 'Космический серый', hex: '#6a6a6a' },
      { id: 'silver', name: 'Серебристый', hex: '#d0d0d0' },
    ],
    storage: [
      { label: '256 ГБ', price: 149990 },
      { label: '512 ГБ', price: 169990 },
      { label: '1 ТБ', price: 199990 },
    ],
    sizes: null,
  },
  {
    id: 9,
    slug: 'apple-watch-ultra-2',
    name: 'Apple Watch Ultra 2',
    category: 'apple-watch',
    brand: 'Apple',
    badge: 'Премиум',
    emoji: '⌚',
    description: 'Самые прочные Apple Watch для экстремальных условий и спорта.',
    colors: [
      { id: 'natural', name: 'Натуральный титан', hex: '#c4b89a' },
      { id: 'black', name: 'Чёрный титан', hex: '#2d2d2d' },
    ],
    storage: [
      { label: '64 ГБ', price: 89990 },
    ],
    sizes: [
      { label: '49 мм', price: 89990 },
    ],
  },
  {
    id: 10,
    slug: 'apple-watch-series-10',
    name: 'Apple Watch Series 10',
    category: 'apple-watch',
    brand: 'Apple',
    badge: 'Новинка',
    emoji: '⌚',
    description: 'Тонкие и яркие Apple Watch с расширенными функциями здоровья.',
    colors: [
      { id: 'jet-black', name: 'Глянцевый чёрный', hex: '#1a1a1a' },
      { id: 'silver', name: 'Серебристый', hex: '#d0d0d0' },
      { id: 'rose-gold', name: 'Розовое золото', hex: '#d8b8a8' },
    ],
    storage: [
      { label: '32 ГБ', price: 0 },
    ],
    sizes: [
      { label: '42 мм', price: 39990 },
      { label: '46 мм', price: 44990 },
    ],
  },
  {
    id: 11,
    slug: 'apple-watch-se',
    name: 'Apple Watch SE',
    category: 'apple-watch',
    brand: 'Apple',
    badge: 'Выгодно',
    emoji: '⌚',
    description: 'Доступные Apple Watch с основными функциями здоровья и фитнеса.',
    colors: [
      { id: 'midnight', name: 'Полночь', hex: '#2a2a3a' },
      { id: 'starlight', name: 'Сияющая звезда', hex: '#e8e0d0' },
      { id: 'silver', name: 'Серебристый', hex: '#d0d0d0' },
    ],
    storage: [
      { label: '32 ГБ', price: 0 },
    ],
    sizes: [
      { label: '40 мм', price: 22990 },
      { label: '44 мм', price: 24990 },
    ],
  },
  {
    id: 12,
    slug: 'airpods-pro-2',
    name: 'AirPods Pro 2',
    category: 'airpods',
    brand: 'Apple',
    badge: 'Хит',
    emoji: '🎧',
    description: 'AirPods Pro с активным шумоподавлением и чипом H2.',
    colors: [
      { id: 'white', name: 'Белый', hex: '#f5f5f5' },
    ],
    storage: [
      { label: 'Стандарт', price: 24990 },
    ],
    sizes: null,
  },
  {
    id: 13,
    slug: 'galaxy-s25-ultra',
    name: 'Galaxy S25 Ultra',
    category: 'samsung',
    brand: 'Samsung',
    badge: 'Новинка',
    emoji: '📱',
    description: 'Флагман Samsung с S Pen, Galaxy AI и камерой 200 МП.',
    colors: [
      { id: 'titanium-black', name: 'Титановый чёрный', hex: '#2d2d2d' },
      { id: 'titanium-gray', name: 'Титановый серый', hex: '#8a8a8a' },
      { id: 'titanium-silver', name: 'Титановый серебристый', hex: '#c8c8c8' },
    ],
    storage: [
      { label: '256 ГБ', price: 124990 },
      { label: '512 ГБ', price: 139990 },
      { label: '1 ТБ', price: 159990 },
    ],
    sizes: null,
  },
]

export function getProductById(id) {
  return products.find((p) => p.id === Number(id))
}

export function getMinPrice(product) {
  if (product.sizes && product.sizes.length > 1) {
    return Math.min(...product.sizes.map((s) => s.price))
  }
  if (product.storage && product.storage.length) {
    return Math.min(...product.storage.map((s) => s.price).filter((p) => p > 0))
  }
  return 0
}

export function calcPrice(product, storageIdx, sizeIdx) {
  if (product.sizes && product.sizes.length > 1) {
    return product.sizes[sizeIdx ?? 0].price
  }
  return product.storage[storageIdx ?? 0].price
}

export function formatPrice(price) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(price)
}

export function badgeClass(badge) {
  if (badge === 'Скидка') return 'product-card__badge product-card__badge--sale'
  if (badge === 'Премиум') return 'product-card__badge product-card__badge--premium'
  return 'product-card__badge'
}

export function makeCartKey(productId, colorId, storageLabel, sizeLabel) {
  return `${productId}|${colorId}|${storageLabel}|${sizeLabel || ''}`
}
