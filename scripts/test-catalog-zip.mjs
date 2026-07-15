#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { applyCatalogZip, buildCatalogZip, resolveSafeAssetPath } from '../catalog-zip.mjs'
import { mergeProducts, validateProductsData } from '../catalog-package.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'airdrop-zip-'))
const siteDir = path.join(tmp, 'site')
fs.mkdirSync(path.join(siteDir, 'assets', 'products'), { recursive: true })

const imgPath = 'assets/products/test.webp'
fs.writeFileSync(path.join(siteDir, imgPath), 'fake-webp')

const products = {
  products: [{
    id: 1,
    slug: 'test-phone',
    name: 'Test Phone',
    category: 'iphone',
    image: imgPath,
    images: [imgPath],
    colors: [{ id: 'b', name: 'Black', hex: '#000', image: imgPath }],
    variants: [{ colorId: 'b', storage: '128 ГБ', simType: '', purchasePrice: 10, price: 100 }],
    stock: [{ colorId: 'b', qty: 1, note: 'В наличии' }],
    markupPercent: 15,
    markupFixed: 0,
  }],
}

const zip = buildCatalogZip(siteDir, products)
assert.ok(zip.length > 100)

const listed = new AdmZip(zip).getEntries().map((e) => e.entryName.replace(/\\/g, '/'))
assert.ok(listed.includes('products.json'))
assert.ok(listed.includes('manifest.json'))
assert.ok(listed.includes(imgPath))

const siteDir2 = path.join(tmp, 'site2')
fs.mkdirSync(siteDir2, { recursive: true })
const result = applyCatalogZip(siteDir2, zip, { products: [] }, 'replace')
validateProductsData(result.products)
assert.equal(result.products.products.length, 1)
assert.equal(result.stats.assetsCopied, 1)
assert.ok(fs.existsSync(path.join(siteDir2, imgPath)))

// zip-slip: путь с .. не должен писаться вне assets/
assert.equal(resolveSafeAssetPath(siteDir2, 'assets/../../../etc/passwd'), null)
assert.equal(resolveSafeAssetPath(siteDir2, 'assets/products/../../evil.txt'), null)
assert.ok(resolveSafeAssetPath(siteDir2, 'assets/products/ok.webp'))

const evilZip = new AdmZip()
evilZip.addFile('products.json', Buffer.from(JSON.stringify({
  products: [{ id: 2, slug: 'x', name: 'X', category: 'iphone', colors: [{ id: 'a', name: 'A' }] }],
}), 'utf8'))
// AdmZip может нормализовать путь — проверяем, что вне assets/ ничего не пишется
evilZip.addFile('assets/products/../../evil-slip.txt', Buffer.from('pwned'))
evilZip.addFile('not-assets/secret.txt', Buffer.from('nope'))
const siteSlip = path.join(tmp, 'slip')
fs.mkdirSync(siteSlip, { recursive: true })
const slipResult = applyCatalogZip(siteSlip, evilZip.toBuffer(), { products: [] }, 'merge')
assert.equal(slipResult.stats.assetsCopied, 0)
assert.equal(fs.existsSync(path.join(siteSlip, 'evil-slip.txt')), false)
assert.equal(fs.existsSync(path.join(siteSlip, 'not-assets', 'secret.txt')), false)
assert.equal(fs.existsSync(path.join(siteSlip, 'secret.txt')), false)

// merge не затирает прайс пустым variants из входящего пакета
const mergedSafe = mergeProducts(
  products,
  {
    products: [{
      id: 1,
      slug: 'test-phone',
      name: 'Test Phone Updated',
      category: 'iphone',
      colors: [{ id: 'b', name: 'Black', hex: '#000', image: imgPath }],
      variants: [],
      stock: [],
      image: imgPath,
    }],
  },
  'merge',
)
assert.equal(mergedSafe.products[0].name, 'Test Phone Updated')
assert.equal(mergedSafe.products[0].variants.length, 1)
assert.equal(mergedSafe.products[0].stock.length, 1)

console.log('catalog-zip tests OK')
