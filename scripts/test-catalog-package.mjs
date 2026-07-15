#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  BACKUP_FORMAT,
  buildBackupPayload,
  collectProductAssetPaths,
  mergeProducts,
  normalizeImportPayload,
  summarizeProducts,
  validateBackupData,
  validateProductsData,
} from '../catalog-package.mjs'

const existing = {
  products: [
    { id: 1, slug: 'a', name: 'Phone A', category: 'iphone', colors: [{ id: 'b', name: 'Black' }], images: ['assets/products/a.webp'] },
    { id: 2, slug: 'b', name: 'Phone B', category: 'iphone', colors: [{ id: 'w', name: 'White' }] },
  ],
}

const incoming = {
  products: [
    { id: 1, slug: 'a', name: 'Phone A Updated', category: 'iphone', colors: [{ id: 'b', name: 'Black' }], image: 'assets/products/new.webp' },
    { slug: 'c', name: 'Phone C', category: 'iphone', colors: [{ id: 'g', name: 'Gold' }] },
  ],
}

validateProductsData(incoming)
const merged = mergeProducts(existing, incoming, 'merge')
assert.equal(merged.products.length, 3)
assert.equal(merged.products.find((p) => p.id === 1).name, 'Phone A Updated')
assert.equal(merged.products.find((p) => p.slug === 'c').id, 3)

const replaced = mergeProducts(existing, incoming, 'replace')
assert.equal(replaced.products.length, 2)

const paths = collectProductAssetPaths(merged.products)
assert.ok(paths.includes('assets/products/new.webp'))

const backup = buildBackupPayload({ settings: { name: 'Test' } }, merged)
assert.equal(backup.format, BACKUP_FORMAT)
validateBackupData(backup)

const summary = summarizeProducts(merged)
assert.equal(summary.count, 3)

const normalized = normalizeImportPayload({ products: [{ name: 'X', image: 'assets/products/x.webp' }] })
assert.equal(normalized.products[0].colors.length, 1)
validateProductsData(normalized)

const priced = {
  products: [{
    id: 10,
    slug: 'priced',
    name: 'Priced',
    category: 'iphone',
    colors: [{ id: 'b', name: 'Black' }],
    variants: [{ colorId: 'b', storage: '128 ГБ', simType: '', purchasePrice: 1, price: 2 }],
    stock: [{ colorId: 'b', qty: 2 }],
    markupPercent: 12,
  }],
}
const wiped = mergeProducts(priced, {
  products: [{
    id: 10,
    slug: 'priced',
    name: 'Priced Photo Only',
    category: 'iphone',
    colors: [{ id: 'b', name: 'Black' }],
    variants: [],
    stock: [],
  }],
}, 'merge')
assert.equal(wiped.products[0].name, 'Priced Photo Only')
assert.equal(wiped.products[0].variants.length, 1)
assert.equal(wiped.products[0].stock.length, 1)
assert.equal(wiped.products[0].markupPercent, 12)

console.log('catalog-package tests OK')
