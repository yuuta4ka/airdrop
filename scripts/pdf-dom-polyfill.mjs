/**
 * DOM APIs required by pdfjs-dist in Node.js (text extraction only).
 * Must run before importing pdf-parse.
 */

function installDomMatrix() {
  if (globalThis.DOMMatrix) return

  class DOMMatrix {
    constructor(init) {
      this.a = 1
      this.b = 0
      this.c = 0
      this.d = 1
      this.e = 0
      this.f = 0
      if (init == null) return
      if (Array.isArray(init)) {
        if (init.length === 6) [this.a, this.b, this.c, this.d, this.e, this.f] = init
        else if (init.length === 16) {
          this.a = init[0]
          this.b = init[1]
          this.c = init[4]
          this.d = init[5]
          this.e = init[12]
          this.f = init[13]
        }
        return
      }
      if (typeof init === 'object') {
        this.a = init.a ?? 1
        this.b = init.b ?? 0
        this.c = init.c ?? 0
        this.d = init.d ?? 1
        this.e = init.e ?? 0
        this.f = init.f ?? 0
      }
    }

  multiply(other) {
      const o = other instanceof DOMMatrix ? other : new DOMMatrix(other)
      const out = new DOMMatrix()
      out.a = this.a * o.a + this.c * o.b
      out.b = this.b * o.a + this.d * o.b
      out.c = this.a * o.c + this.c * o.d
      out.d = this.b * o.c + this.d * o.d
      out.e = this.a * o.e + this.c * o.f + this.e
      out.f = this.b * o.e + this.d * o.f + this.f
      return out
    }

    multiplySelf(other) {
      const m = this.multiply(other)
      Object.assign(this, { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f })
      return this
    }

    preMultiplySelf(other) {
      const o = other instanceof DOMMatrix ? other : new DOMMatrix(other)
      const m = o.multiply(this)
      Object.assign(this, { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f })
      return this
    }

    translateSelf(tx, ty = 0) {
      this.e += this.a * tx + this.c * ty
      this.f += this.b * tx + this.d * ty
      return this
    }

    scaleSelf(sx, sy = sx) {
      this.a *= sx
      this.b *= sx
      this.c *= sy
      this.d *= sy
      return this
    }

    invertSelf() {
      const det = this.a * this.d - this.b * this.c
      if (!det) throw new Error('Matrix not invertible')
      const { a, b, c, d, e, f } = this
      this.a = d / det
      this.b = -b / det
      this.c = -c / det
      this.d = a / det
      this.e = (c * f - d * e) / det
      this.f = (b * e - a * f) / det
      return this
    }
  }

  globalThis.DOMMatrix = DOMMatrix
}

function installPath2D() {
  if (globalThis.Path2D) return
  globalThis.Path2D = class Path2D {
    addPath() {}
  }
}

function installImageData() {
  if (globalThis.ImageData) return
  globalThis.ImageData = class ImageData {
    constructor(width, height) {
      this.width = width
      this.height = height
      this.data = new Uint8ClampedArray(width * height * 4)
    }
  }
}

installDomMatrix()
installPath2D()
installImageData()
