import assert from 'node:assert/strict'
import { alignJsonFieldsToCatalog, parseTextPriceLines } from '../price-text-import.mjs'

const products = [
  { id: 1, name: 'Apple Watch Ultra 3', category: 'apple-watch', importNames: 'Watch Ultra 3' },
  { id: 2, name: 'Apple Watch Ultra 2', category: 'apple-watch', importNames: '' },
  { id: 3, name: 'iPhone 16 Pro Max', category: 'iphone', importNames: '' },
  { id: 4, name: 'iPhone 16', category: 'iphone', importNames: '' },
]

assert.deepEqual(
  alignJsonFieldsToCatalog({
    product: 'Watch Ultra 3 Black Ocean Band',
    color: 'Black',
    price: 56500,
  }, products),
  { product: 'Apple Watch Ultra 3', color: 'Black Ocean Band', price: 56500 },
)

assert.deepEqual(
  alignJsonFieldsToCatalog({
    product: 'Apple Watch Ultra 3',
    color: 'Black Ocean Band',
    price: 56500,
  }, products),
  { product: 'Apple Watch Ultra 3', color: 'Black Ocean Band', price: 56500 },
)

// iPhone: не отрезаем Pro Max / цвет из product
assert.equal(
  alignJsonFieldsToCatalog({
    product: 'iPhone 16 Pro Max Desert',
    color: 'Desert',
    price: 90000,
  }, products).product,
  'iPhone 16 Pro Max Desert',
)

// Нет карточки Ultra 9 — не трогаем
assert.equal(
  alignJsonFieldsToCatalog({
    product: 'Watch Ultra 9 Magic Band',
    color: 'Red',
    price: 10000,
  }, products).product,
  'Watch Ultra 9 Magic Band',
)

const parsed = parseTextPriceLines(
  '{"product":"Watch Ultra 3 Black Ocean Band","storage":"","color":"Black","sim":"","size":"","price":56500}',
  { products },
)
assert.equal(parsed.entries[0].fields.product, 'Apple Watch Ultra 3')
assert.equal(parsed.entries[0].fields.color, 'Black Ocean Band')

console.log('test-watch-catalog-peel: ok')
