import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import {
  CATALOG_MANIFEST,
  collectProductAssetPaths,
  mergeProducts,
  summarizeProducts,
  validateProductsData,
} from './catalog-package.mjs'

export function buildCatalogZip(siteDir, productsData) {
  const validated = validateProductsData(structuredClone(productsData))
  const products = validated.products
  const assetPaths = collectProductAssetPaths(products)
  const zip = new AdmZip()

  const manifest = {
    format: CATALOG_MANIFEST,
    exportedAt: new Date().toISOString(),
    ...summarizeProducts({ products }),
    assetFiles: [],
    missingAssets: [],
  }

  for (const rel of assetPaths) {
    const abs = path.join(siteDir, rel)
    if (fs.existsSync(abs)) {
      zip.addLocalFile(abs, path.dirname(rel))
      manifest.assetFiles.push(rel)
    } else {
      manifest.missingAssets.push(rel)
    }
  }

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'))
  zip.addFile('products.json', Buffer.from(JSON.stringify({ products }, null, 2), 'utf8'))
  return zip.toBuffer()
}

export function applyCatalogZip(siteDir, zipBuffer, existingProducts, mode = 'merge') {
  const zip = new AdmZip(zipBuffer)
  const productsEntry = zip.getEntry('products.json')
  if (!productsEntry) throw new Error('В архиве нет products.json')

  const incoming = JSON.parse(productsEntry.getData().toString('utf8'))
  validateProductsData(incoming)

  let assetsCopied = 0
  for (const entry of zip.getEntries()) {
    const name = entry.entryName.replace(/\\/g, '/')
    if (!name.startsWith('assets/') || entry.isDirectory) continue
    const out = path.join(siteDir, name)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, entry.getData())
    assetsCopied += 1
  }

  const merged = mergeProducts(existingProducts, incoming, mode)
  return {
    products: merged,
    stats: {
      ...summarizeProducts(merged),
      assetsCopied,
      mode,
    },
  }
}
