import { describe, it, expect } from 'vitest'
import { extractStyleTokens, buildBrandTokenCss } from './styleTokens'

describe('extractStyleTokens', () => {
    it('reads Elementor global kit colors + typography', () => {
        const html = `<style id="elementor-kit-7">
            .elementor-kit-7{
                --e-global-color-primary:#1e73be;
                --e-global-color-secondary:#0a0a0a;
                --e-global-color-text:#444444;
                --e-global-color-accent:#61ce70;
                --e-global-typography-primary-font-family:"Montserrat";
                --e-global-typography-text-font-family:"Poppins";
            }
        </style>`
        const t = extractStyleTokens(html, [])
        expect(t.colorPrimary).toBe('#1e73be')
        expect(t.colorAccent).toBe('#61ce70')
        expect(t.colorText).toBe('#444444')
        expect(t.colorHeading).toBe('#0a0a0a') // mapped from secondary
        expect(t.fontBody).toBe('"Poppins"')
        expect(t.fontHeading).toBe('"Montserrat"')
    })

    it('falls back to plain body / heading / link rules', () => {
        const css = `body{font-family:Inter,sans-serif;color:#222;background-color:#fafafa}
            h1{font-family:Georgia,serif;color:#111}
            a{color:#c00}`
        const t = extractStyleTokens('', [css])
        expect(t.fontBody).toBe('Inter,sans-serif')
        expect(t.colorText).toBe('#222')
        expect(t.colorSurface).toBe('#fafafa')
        expect(t.fontHeading).toBe('Georgia,serif')
        expect(t.colorHeading).toBe('#111')
        expect(t.colorPrimary).toBe('#c00') // link color
    })

    it('reads external stylesheet text passed in cssTexts', () => {
        const ext = `:root{--color-primary:#336699;--font-body:Lato}`
        const t = extractStyleTokens('<html></html>', [ext])
        expect(t.colorPrimary).toBe('#336699')
        expect(t.fontBody).toBe('Lato')
    })

    it('drops values that could break or inject CSS', () => {
        // A color value carrying an extra declaration / closing brace must be
        // rejected, not stored — otherwise it would land inside our :root block.
        const css = `body{color:red;} body{} } * { display:none } a{color:#fff;}`
        const malicious = `:root{--color-primary:#fff;} body{evil:1}`
        const t = extractStyleTokens('', [css, malicious])
        // primary resolves to a clean hex (from a{} or :root), never a payload
        if (t.colorPrimary) expect(/^#[0-9a-f]{3,8}$/i.test(t.colorPrimary)).toBe(true)
        // no token value may contain CSS structural punctuation
        for (const v of Object.values(t)) {
            expect(/[{};]/.test(String(v))).toBe(false)
        }
    })

    it('returns {} when there is no CSS at all', () => {
        expect(extractStyleTokens('<div>hi</div>', [])).toEqual({})
    })
})

describe('buildBrandTokenCss', () => {
    it('returns empty string for null/empty tokens (no-tokens path is a no-op)', () => {
        expect(buildBrandTokenCss(null)).toBe('')
        expect(buildBrandTokenCss({})).toBe('')
    })

    it('emits a :root block with only the keys present', () => {
        const css = buildBrandTokenCss({ colorPrimary: '#1e73be', fontBody: 'Poppins' })
        expect(css.startsWith(':root{')).toBe(true)
        expect(css).toContain('--koto-color-primary:#1e73be')
        expect(css).toContain('--koto-font-body:Poppins')
        // heading font defaults to body font when only body is given
        expect(css).toContain('--koto-font-heading:Poppins')
        // absent keys are not emitted
        expect(css).not.toContain('--koto-color-text')
    })

    it('uses accent as the CTA gradient end, falling back to primary', () => {
        expect(buildBrandTokenCss({ colorPrimary: '#111', colorAccent: '#0f0' }))
            .toContain('--koto-color-primary-2:#0f0')
        expect(buildBrandTokenCss({ colorPrimary: '#111' }))
            .toContain('--koto-color-primary-2:#111')
    })
})
