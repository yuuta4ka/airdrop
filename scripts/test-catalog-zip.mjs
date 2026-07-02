#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { applyCatalogZip, buildCatalogZip } from '../catalog-zip.mjs'
import { validateProductsData } from '../catalog-package.mjs'

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
    variants: [],
    stock: [],
  }],
}

const zip = buildCatalogZip(siteDir, products)
assert.ok(zip.length > 100)

const siteDir2 = path.join(tmp, 'site2')
fs.mkdirSync(siteDir2, { recursive: true })
const result = applyCatalogZip(siteDir2, zip, { products: [] }, 'replace')
validateProductsData(result.products)
assert.equal(result.products.products.length, 1)
assert.equal(result.stats.assetsCopied, 1)
assert.ok(fs.existsSync(path.join(siteDir2, imgPath)))

console.log('catalog-zip tests OK')
