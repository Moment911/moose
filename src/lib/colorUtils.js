export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.substring(0, 2), 16) || 0, g: parseInt(h.substring(2, 4), 16) || 0, b: parseInt(h.substring(4, 6), 16) || 0 }
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')
}

export function rgbToCmyk(r, g, b) {
  if (r === 0 && g === 0 && b === 0) return { c: 0, m: 0, y: 0, k: 100 }
  const c1 = 1 - r / 255, m1 = 1 - g / 255, y1 = 1 - b / 255
  const k = Math.min(c1, m1, y1)
  return { c: Math.round(((c1 - k) / (1 - k)) * 100), m: Math.round(((m1 - k) / (1 - k)) * 100), y: Math.round(((y1 - k) / (1 - k)) * 100), k: Math.round(k * 100) }
}

export function cmykToRgb(c, m, y, k) {
  const c1 = c / 100, m1 = m / 100, y1 = y / 100, k1 = k / 100
  return { r: Math.round(255 * (1 - c1) * (1 - k1)), g: Math.round(255 * (1 - m1) * (1 - k1)), b: Math.round(255 * (1 - y1) * (1 - k1)) }
}

export function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0, s = max === 0 ? 0 : d / max
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  return { h, s, v: max }
}

export function hexToCmyk(hex) { const { r, g, b } = hexToRgb(hex); return rgbToCmyk(r, g, b) }
export function cmykToHex(c, m, y, k) { const { r, g, b } = cmykToRgb(c, m, y, k); return rgbToHex(r, g, b) }
