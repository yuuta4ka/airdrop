#!/usr/bin/env node
/** Exit 0 when server runtime deps load; used by Windows install scripts. */
try {
  await import('./pdf-dom-polyfill.mjs')
  await import('adm-zip')
  await import('pdf-parse')
} catch (err) {
  console.error(err?.message || err)
  process.exit(1)
}
