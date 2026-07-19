import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import {
  CATALOG_MANIFEST,
  collectProductAssetPaths,
  mergeProducts,
  normalizeImportPayload,
  summarizeProducts,
  validateProductsData,
} from './catalog-package.mjs'

function normalizeZipPath(name) {
  return String(name || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
}

/**
 * Путь ассета на диске или null (защита от zip-slip).
 * `assets/products/*` → uploadDir (persistent), остальные `assets/*` → siteDir/assets.
 * @param {string} [uploadDir] каталог фото товаров; по умолчанию siteDir/assets/products
 */
export function resolveSafeAssetPath(siteDir, entryName, uploadDir) {
  const norm = normalizeZipPath(entryName)
  if (!norm.startsWith('assets/')) return null
  if (norm.includes('\0') || norm.split('/').some((part) => part === '..')) return null

  if (norm.startsWith('assets/products/')) {
    const productsRoot = path.resolve(uploadDir || path.join(siteDir, 'assets', 'products'))
    const rest = norm.slice('assets/products/'.length)
    if (!rest) return null
    const out = path.resolve(productsRoot, ...rest.split('/'))
    if (out !== productsRoot && !out.startsWith(productsRoot + path.sep)) return null
    return out
  }

  const assetsRoot = path.resolve(siteDir, 'assets')
  const out = path.resolve(siteDir, ...norm.split('/'))
  if (out !== assetsRoot && !out.startsWith(assetsRoot + path.sep)) return null
  return out
}

function findZipEntry(zip, baseName) {
  const target = baseName.toLowerCase()
  return zip.getEntries().find((entry) => {
    const norm = normalizeZipPath(entry.entryName)
    if (norm === target) return true
    return norm.split('/').pop()?.toLowerCase() === target
  }) || null
}

function parseZipJson(entry) {
  const raw = entry.getData().toString('utf8').replace(/^\uFEFF/, '')
  const data = JSON.parse(raw)
  return normalizeImportPayload(data)
}

export function buildCatalogZip(siteDir, productsData, uploadDir) {
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
    const abs = resolveSafeAssetPath(siteDir, rel, uploadDir)
    if (abs && fs.existsSync(abs)) {
      // Всегда POSIX-пути в ZIP — иначе на Windows коллега получит кривую структуру
      const zipDir = path.posix.dirname(rel.replace(/\\/g, '/'))
      const zipName = path.posix.basename(rel.replace(/\\/g, '/'))
      zip.addLocalFile(abs, zipDir === '.' ? '' : zipDir, zipName)
      manifest.assetFiles.push(rel.replace(/\\/g, '/'))
    } else {
      manifest.missingAssets.push(rel.replace(/\\/g, '/'))
    }
  }

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'))
  zip.addFile('products.json', Buffer.from(JSON.stringify({ products }, null, 2), 'utf8'))
  return zip.toBuffer()
}

export function applyCatalogZip(siteDir, zipBuffer, existingProducts, mode = 'merge', uploadDir) {
  const zip = new AdmZip(zipBuffer)
  const productsEntry = findZipEntry(zip, 'products.json')
  if (!productsEntry) throw new Error('В архиве нет products.json')

  const incoming = parseZipJson(productsEntry)
  validateProductsData(incoming)

  let assetsCopied = 0
  let assetsSkipped = 0
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    const out = resolveSafeAssetPath(siteDir, entry.entryName, uploadDir)
    if (!out) {
      const name = normalizeZipPath(entry.entryName)
      if (name.startsWith('assets/')) assetsSkipped += 1
      continue
    }
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
      assetsSkipped,
      mode,
    },
  }
}
