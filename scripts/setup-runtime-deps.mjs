#!/usr/bin/env node
/**
 * Link vendor/* into node_modules (no npm registry). Safe to run every start.
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
  if (!vendorOk(name)) {
    console.error(`[ERROR] vendor/${name} is missing or incomplete. Run: git pull`)
    process.exit(1)
  }

  if (pointsToVendor(name)) continue

  const dest = linkPath(name)
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true })
  }

  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'
  fs.symlinkSync(vendorPath(name), dest, linkType)
}
