import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only
vi.mock('server-only', () => ({}))

import { detectFileType } from '@/lib/kotoiq/profileUploadDetect'

describe('Phase 8 — profileUploadDetect', () => {
  describe('detectFileType magic-byte classification', () => {
    it('detects PDF from %PDF header', () => {
      const buf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0, 0, 0, 0])
      const result = detectFileType(buf)
      expect(result).toEqual({ kind: 'pdf', mime: 'application/pdf', ext: 'pdf', valid: true })
    })

    it('detects PNG from 8-byte signature', () => {
      const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
      const result = detectFileType(buf)
      expect(result).toEqual({ kind: 'png', mime: 'image/png', ext: 'png', valid: true })
    })

    it('detects JPEG from FF D8 FF', () => {
      const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
      const result = detectFileType(buf)
      expect(result).toEqual({ kind: 'jpeg', mime: 'image/jpeg', ext: 'jpg', valid: true })
    })

    it('detects WebP from RIFF + WEBP at offset 8', () => {
      // RIFF....WEBP
      const buf = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // size (don't care)
        0x57, 0x45, 0x42, 0x50, // WEBP
      ])
      const result = detectFileType(buf)
      expect(result).toEqual({ kind: 'webp', mime: 'image/webp', ext: 'webp', valid: true })
    })

    it('detects HEIC from ftyp + heic brand', () => {
      // bytes 0-3: size (don't care), 4-7: ftyp, 8-11: heic
      const buf = new Uint8Array([
        0x00, 0x00, 0x00, 0x1c, // size
        0x66, 0x74, 0x79, 0x70, // ftyp
        0x68, 0x65, 0x69, 0x63, // heic
      ])
      const result = detectFileType(buf)
      expect(result).toEqual({ kind: 'heic', mime: 'image/heic', ext: 'heic', valid: true })
    })

    it('detects HEIC from ftyp + heix brand', () => {
      const buf = new Uint8Array([
        0x00, 0x00, 0x00, 0x1c,
        0x66, 0x74, 0x79, 0x70,
        0x68, 0x65, 0x69, 0x78, // heix
      ])
      const result = detectFileType(buf)
      expect(result.kind).toBe('heic')
      expect(result.valid).toBe(true)
    })

    it('detects DOCX from PK header + word/ in first 4KB', () => {
      // PK\x03\x04 + some padding + "word/" marker
      const header = [0x50, 0x4b, 0x03, 0x04]
      const padding = new Array(50).fill(0)
      const marker = Array.from(new TextEncoder().encode('word/document.xml'))
      const buf = new Uint8Array([...header, ...padding, ...marker])
      const result = detectFileType(buf)
      expect(result).toEqual({
        kind: 'docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ext: 'docx',
        valid: true,
      })
    })

    it('detects DOCX from PK header + [Content_Types].xml', () => {
      const header = [0x50, 0x4b, 0x03, 0x04]
      const padding = new Array(30).fill(0)
      const marker = Array.from(new TextEncoder().encode('[Content_Types].xml'))
      const buf = new Uint8Array([...header, ...padding, ...marker])
      const result = detectFileType(buf)
      expect(result.kind).toBe('docx')
      expect(result.valid).toBe(true)
    })

    it('rejects ZIP without DOCX markers', () => {
      const buf = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0])
      const result = detectFileType(buf)
      expect(result.kind).toBe('unknown')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('zip_but_not_docx')
    })

    it('rejects HTML as unsupported_type', () => {
      const buf = new TextEncoder().encode('<html><body>hello</body></html>')
      const result = detectFileType(buf)
      expect(result.kind).toBe('unknown')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('unsupported_type')
    })

    it('rejects empty buffer', () => {
      const buf = new Uint8Array(0)
      const result = detectFileType(buf)
      expect(result.valid).toBe(false)
    })

    it('rejects random bytes', () => {
      const buf = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c])
      const result = detectFileType(buf)
      expect(result.valid).toBe(false)
    })
  })
})
