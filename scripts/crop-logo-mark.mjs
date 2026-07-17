import fs from 'fs'
import zlib from 'zlib'
import { execFileSync } from 'child_process'

function readPng(path) {
  const buf = fs.readFileSync(path)
  let offset = 8
  let width, height, bitDepth, colorType
  const idat = []
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset); offset += 4
    const type = buf.toString('ascii', offset, offset + 4); offset += 4
    const data = buf.subarray(offset, offset + len); offset += len + 4
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
  }
  const inflated = zlib.inflateSync(Buffer.concat(idat))
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`unsupported ${bitDepth}/${colorType}`)
  const stride = width * 4
  const pixels = Buffer.alloc(height * stride)
  let ip = 0, op = 0
  const prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = inflated[ip++]
    const row = inflated.subarray(ip, ip + stride); ip += stride
    const out = pixels.subarray(op, op + stride)
    if (filter === 0) row.copy(out)
    else if (filter === 1) {
      for (let i = 0; i < stride; i++) out[i] = (row[i] + (i >= 4 ? out[i - 4] : 0)) & 255
    } else if (filter === 2) {
      for (let i = 0; i < stride; i++) out[i] = (row[i] + prev[i]) & 255
    } else if (filter === 3) {
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? out[i - 4] : 0
        out[i] = (row[i] + Math.floor((a + prev[i]) / 2)) & 255
      }
    } else if (filter === 4) {
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? out[i - 4] : 0
        const b = prev[i]
        const c = i >= 4 ? prev[i - 4] : 0
        let p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        out[i] = (row[i] + pr) & 255
      }
    } else throw new Error('filter ' + filter)
    out.copy(prev)
    op += stride
  }
  return { width, height, pixels, stride }
}

const src = '/Users/yuuta/airdrop/site/assets/logo.png'
const dest = '/Users/yuuta/airdrop/site/assets/logo-mark.png'
const { width, height, pixels, stride } = readPng(src)
let minx = width, miny = height, maxx = 0, maxy = 0
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = y * stride + x * 4
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3]
    if (a < 16) continue
    if (r + g + b < 60) continue
    if (x < minx) minx = x
    if (y < miny) miny = y
    if (x > maxx) maxx = x
    if (y > maxy) maxy = y
  }
}
const pad = 48
const side = Math.max(maxx - minx + 1, maxy - miny + 1) + pad * 2
const cx = Math.floor((minx + maxx) / 2)
const cy = Math.floor((miny + maxy) / 2)
let sx = Math.max(0, cx - Math.floor(side / 2))
let sy = Math.max(0, cy - Math.floor(side / 2))
let s = Math.min(side, width - sx, height - sy)
console.log({ minx, miny, maxx, maxy, sx, sy, s })
fs.copyFileSync(src, dest)
// sips --cropOffset is Y X (row col)
execFileSync('sips', ['--cropToHeightWidth', String(s), String(s), '--cropOffset', String(sy), String(sx), dest])
execFileSync('sips', ['-z', '256', '256', dest])
console.log('wrote', dest)
