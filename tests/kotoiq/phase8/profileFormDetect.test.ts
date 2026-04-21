import { describe, it, expect } from 'vitest'
import { detectFormProvider } from '../../../src/lib/kotoiq/profileFormDetect'

describe('detectFormProvider', () => {
  // ── Typeform ────────────────────────────────────────────────────────────────
  it('detects a standard Typeform URL', () => {
    const r = detectFormProvider('https://mycompany.typeform.com/to/ABC123')
    expect(r).toEqual({ provider: 'typeform', form_id: 'ABC123' })
  })

  it('detects a Typeform /c/ URL', () => {
    const r = detectFormProvider('https://xyz.typeform.com/c/XYZ789')
    expect(r).toEqual({ provider: 'typeform', form_id: 'XYZ789' })
  })

  it('detects Typeform with http scheme', () => {
    const r = detectFormProvider('http://xyz.typeform.com/to/abc')
    expect(r).toEqual({ provider: 'typeform', form_id: 'abc' })
  })

  it('returns null form_id for typeform.com root with no path match', () => {
    const r = detectFormProvider('https://xyz.typeform.com/')
    expect(r.provider).toBe('typeform')
    expect(r.form_id).toBeNull()
  })

  // ── Jotform ─────────────────────────────────────────────────────────────────
  it('detects a standard Jotform URL', () => {
    const r = detectFormProvider('https://form.jotform.com/251234567890')
    expect(r).toEqual({ provider: 'jotform', form_id: '251234567890' })
  })

  it('detects www.jotform.com', () => {
    const r = detectFormProvider('https://www.jotform.com/251234567890')
    expect(r).toEqual({ provider: 'jotform', form_id: '251234567890' })
  })

  it('detects jotform.com (no subdomain)', () => {
    const r = detectFormProvider('https://jotform.com/251234567890')
    expect(r).toEqual({ provider: 'jotform', form_id: '251234567890' })
  })

  it('returns null form_id for jotform.com with short path', () => {
    const r = detectFormProvider('https://jotform.com/12345')
    expect(r.provider).toBe('jotform')
    expect(r.form_id).toBeNull()
  })

  // ── Google Forms ────────────────────────────────────────────────────────────
  it('detects a Google Forms new-format URL', () => {
    const r = detectFormProvider('https://docs.google.com/forms/d/e/1FAIpQLSf_abc123/viewform')
    expect(r).toEqual({ provider: 'google_forms', form_id: '1FAIpQLSf_abc123' })
  })

  it('detects a Google Forms old-format URL (no /e/)', () => {
    const r = detectFormProvider('https://docs.google.com/forms/d/FORM_ID_HERE/edit')
    expect(r).toEqual({ provider: 'google_forms', form_id: 'FORM_ID_HERE' })
  })

  it('returns google_forms with null form_id for docs.google.com non-forms path', () => {
    // docs.google.com host matches but path has no /forms/d/ → form_id=null
    const r = detectFormProvider('https://docs.google.com/spreadsheets/d/abc')
    expect(r.provider).toBe('google_forms')
    expect(r.form_id).toBeNull()
  })

  // ── Unknown / edge cases ────────────────────────────────────────────────────
  it('returns unknown for a generic URL', () => {
    const r = detectFormProvider('https://example.com/contact')
    expect(r).toEqual({ provider: 'unknown', form_id: null })
  })

  it('returns unknown for malformed / non-URL string', () => {
    const r = detectFormProvider('not a url at all')
    expect(r).toEqual({ provider: 'unknown', form_id: null })
  })

  it('returns unknown for non-http scheme', () => {
    const r = detectFormProvider('ftp://typeform.com/to/abc')
    expect(r).toEqual({ provider: 'unknown', form_id: null })
  })

  it('returns unknown for empty string', () => {
    const r = detectFormProvider('')
    expect(r).toEqual({ provider: 'unknown', form_id: null })
  })
})
