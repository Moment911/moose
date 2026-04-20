import 'server-only'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 07 — Magic-byte file type detection
//
// Authoritative classification based on the first 12 bytes of the buffer.
// MIME type from the upload is NEVER trusted (polyglot mitigation T-08-60).
// ─────────────────────────────────────────────────────────────────────────────

export type FileKind = 'pdf' | 'docx' | 'png' | 'jpeg' | 'webp' | 'heic' | 'unknown'

export type DetectResult = {
  kind: FileKind
  mime: string | null
  ext: string | null
  valid: boolean
  reason?: string
}

const MAGIC = {
  pdf:  [0x25, 0x50, 0x44, 0x46],                                // %PDF
  zip:  [0x50, 0x4b, 0x03, 0x04],                                // PK\x03\x04
  png:  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff],
  webpRiff: [0x52, 0x49, 0x46, 0x46],                            // RIFF
  webpSig:  [0x57, 0x45, 0x42, 0x50],                            // WEBP (offset 8)
}

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']

function startsWith(buf: Uint8Array, sig: number[], off = 0): boolean {
  if (buf.length < off + sig.length) return false
  for (let i = 0; i < sig.length; i++) {
    if (buf[off + i] !== sig[i]) return false
  }
  return true
}

export function detectFileType(buffer: Uint8Array): DetectResult {
  if (startsWith(buffer, MAGIC.pdf)) {
    return { kind: 'pdf', mime: 'application/pdf', ext: 'pdf', valid: true }
  }
  if (startsWith(buffer, MAGIC.png)) {
    return { kind: 'png', mime: 'image/png', ext: 'png', valid: true }
  }
  if (startsWith(buffer, MAGIC.jpeg)) {
    return { kind: 'jpeg', mime: 'image/jpeg', ext: 'jpg', valid: true }
  }
  if (startsWith(buffer, MAGIC.webpRiff) && startsWith(buffer, MAGIC.webpSig, 8)) {
    return { kind: 'webp', mime: 'image/webp', ext: 'webp', valid: true }
  }
  // HEIC: offset 4 = 'ftyp', offset 8 = brand
  if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    const brand = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]).toLowerCase()
    if (HEIC_BRANDS.includes(brand)) {
      return { kind: 'heic', mime: 'image/heic', ext: 'heic', valid: true }
    }
  }
  if (startsWith(buffer, MAGIC.zip)) {
    // Peek for DOCX marker in the first 4 KB
    const head = new TextDecoder('latin1').decode(buffer.subarray(0, Math.min(buffer.length, 4096)))
    if (head.includes('word/') || head.includes('[Content_Types].xml')) {
      return {
        kind: 'docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ext: 'docx',
        valid: true,
      }
    }
    return { kind: 'unknown', mime: null, ext: null, valid: false, reason: 'zip_but_not_docx' }
  }
  return { kind: 'unknown', mime: null, ext: null, valid: false, reason: 'unsupported_type' }
}
