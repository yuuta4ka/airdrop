#!/usr/bin/env node
/**
 * Ensure runtime packages exist in node_modules.
 * Prefers packages already installed by npm; falls back to vendor/* symlinks.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const packages = ['adm-zip', 'pdf-parse', 'pdfjs-dist']

function vendorPath(name) {
  return path.join(root, 'vendor', name)
}

function linkPath(name) {
  return path.join(root, 'node_modules', name)
}

function vendorOk(name) {
  if (name === 'adm-zip') return fs.existsSync(path.join(vendorPath(name), 'adm-zip.js'))
  if (name === 'pdf-parse') {
    return fs.existsSync(path.join(vendorPath(name), 'dist', 'pdf-parse', 'esm', 'index.js'))
  }
  return fs.existsSync(path.join(vendorPath(name), 'legacy', 'build', 'pdf.mjs'))
}

function npmPackageOk(name) {
  const dest = linkPath(name)
  return fs.existsSync(path.join(dest, 'package.json'))
}

function pointsToVendor(name) {
  const link = linkPath(name)
  if (!fs.existsSync(link)) return false
  try {
    return fs.realpathSync(link) === fs.realpathSync(vendorPath(name))
  } catch {
    return false
  }
}

for (const name of packages) {
  if (npmPackageOk(name) || pointsToVendor(name)) {
    console.log(`[ok] ${name}`)
    continue
  }

  if (!vendorOk(name)) {
    console.error(`[ERROR] ${name} is missing. Run: npm install`)
    console.error(`        (or ensure vendor/${name} is present)`)
    process.exit(1)
  }

  const dest = linkPath(name)
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true })
  }

  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'
  fs.symlinkSync(vendorPath(name), dest, linkType)
  console.log(`[ok] ${name} → vendor/${name}`)
}
