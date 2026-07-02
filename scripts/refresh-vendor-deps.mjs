#!/usr/bin/env node
/**
 * Refresh vendor/adm-zip, vendor/pdf-parse, vendor/pdfjs-dist from node_modules.
 * Run after: npm install adm-zip@0.5.18 pdf-parse@2.4.5 (once on a machine with network).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const nm = path.join(root, 'node_modules')

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true })
  fs.cpSync(src, dest, { recursive: true })
}

const admZip = path.join(nm, 'adm-zip')
const pdfParse = path.join(nm, 'pdf-parse')
const pdfjs = path.join(nm, 'pdfjs-dist')

for (const dir of [admZip, pdfParse, pdfjs]) {
  if (!fs.existsSync(dir)) {
    console.error(`Missing ${dir}. Run: npm install adm-zip@0.5.18 pdf-parse@2.4.5`)
    process.exit(1)
  }
}

copyDir(admZip, path.join(root, 'vendor', 'adm-zip'))
fs.mkdirSync(path.join(root, 'vendor', 'pdf-parse'), { recursive: true })
fs.copyFileSync(path.join(pdfParse, 'package.json'), path.join(root, 'vendor', 'pdf-parse', 'package.json'))
copyDir(path.join(pdfParse, 'dist'), path.join(root, 'vendor', 'pdf-parse', 'dist'))
copyDir(pdfjs, path.join(root, 'vendor', 'pdfjs-dist'))

console.log('Vendor deps refreshed in vendor/')
