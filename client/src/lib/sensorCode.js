// Reads the Dexcom sensor's DataMatrix barcode from a photo, entirely in the browser.
// The barcode is GS1: (01) GTIN, (21) serial, (11) made, (17) expiry, (240) pairing code.
// zxing-wasm (~1 MB) is loaded only when the camera is actually used.

let readerPromise = null

function loadReader() {
  if (!readerPromise) {
    readerPromise = Promise.all([
      import('zxing-wasm/reader'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ]).then(([zx, wasm]) => {
      // Serve the .wasm from our own build instead of the default CDN
      zx.prepareZXingModule({
        overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasm.default : prefix + path) },
      })
      return zx
    })
  }
  return readerPromise
}

function toImageData(img, maxPx) {
  const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = URL.createObjectURL(file)
  })
}

// GS1 (17) is YYMMDD; DD = 00 means the last day of that month
function parseExpiry(hri) {
  const m = hri.match(/\(17\)(\d{2})(\d{2})(\d{2})/)
  if (!m) return null
  const y = 2000 + Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  if (mo < 1 || mo > 12) return null
  return d === 0 ? new Date(y, mo, 0) : new Date(y, mo - 1, d)
}

/** Returns { serial, expiry (Date | null), raw } or null when no sensor barcode was found. */
export async function readSensorSerial(file) {
  const [zx, img] = await Promise.all([loadReader(), loadImage(file)])
  try {
    // Small first (fast and usually enough), larger if the code is small in the frame
    for (const maxPx of [1200, 2000, 800]) {
      const results = await zx.readBarcodes(toImageData(img, maxPx), {
        formats: ['DataMatrix'], tryHarder: true, textMode: 'HRI', maxNumberOfSymbols: 1,
      })
      for (const r of results) {
        const m = r.text.match(/\(21\)([0-9A-Za-z]{4,20})/)
        if (m) return { serial: m[1], expiry: parseExpiry(r.text), raw: r.text }
      }
    }
    return null
  } finally {
    URL.revokeObjectURL(img.src)
  }
}
