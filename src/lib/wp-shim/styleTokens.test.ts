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

    it('resolves var() references in element rules (Avada/Fusion pattern)', () => {
        const css = `:root{--body_typography-font-family:"Open Sans",sans-serif;--h1_typography-font-family:"Playfair Display",serif;--link_color:#d32f2f}
            body{font-family:var(--body_typography-font-family,inherit);color:var(--link_color)}
            h1{font-family:var(--h1_typography-font-family)}
            a{color:var(--link_color)}`
        const t = extractStyleTokens('', [css])
        expect(t.fontBody).toBe('"Open Sans",sans-serif')
        expect(t.fontHeading).toBe('"Playfair Display",serif')
        expect(t.colorPrimary).toBe('#d32f2f')
    })

    it('returns {} when there is no CSS at all', () => {
        expect(extractStyleTokens('<div>hi</div>', [])).toEqual({})
    })

    it('captures button treatment + heading weight', () => {
        const css = `h1{font-weight:800}
            .elementor-button{background-color:#ff6600;color:#ffffff;border-radius:9999px}`
        const t = extractStyleTokens('', [css])
        expect(t.headingWeight).toBe('800')
        expect(t.colorButtonBg).toBe('#ff6600')
        expect(t.colorButtonText).toBe('#ffffff')
        expect(t.buttonRadius).toBe('9999px')
    })

    it('captures an allowlisted Google Fonts <link> (with ; and @ in the URL)', () => {
        const html = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap">`
        const t = extractStyleTokens(html, [])
        expect(t.fontCssUrl).toBe('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap')
    })

    it('captures an @import font URL from the CSS', () => {
        const t = extractStyleTokens('', [`@import url("https://fonts.bunny.net/css?family=inter:400,700");`])
        expect(t.fontCssUrl).toBe('https://fonts.bunny.net/css?family=inter:400,700')
    })

    it('drops a non-allowlisted / non-https font URL', () => {
        const html = `<link rel="stylesheet" href="https://evil.example.com/x.css">
                      <link rel="stylesheet" href="http://fonts.googleapis.com/css?family=X">`
        expect(extractStyleTokens(html, []).fontCssUrl).toBeUndefined()
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

    it('emits button + heading-weight vars; button bg falls back to primary', () => {
        const css = buildBrandTokenCss({ colorPrimary: '#111', headingWeight: '800', colorButtonText: '#fff', buttonRadius: '4px' })
        expect(css).toContain('--koto-heading-weight:800')
        expect(css).toContain('--koto-color-button-bg:#111')   // falls back to primary
        expect(css).toContain('--koto-color-button-text:#fff')
        expect(css).toContain('--koto-button-radius:4px')
    })

    it('prepends a sanitized @import for a captured font URL (before :root)', () => {
        const css = buildBrandTokenCss({ colorPrimary: '#111', fontCssUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap' })
        expect(css.startsWith('@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap");')).toBe(true)
        expect(css).toContain('\n:root{')
    })

    it('emits only @import when a font URL is present but no other tokens', () => {
        const css = buildBrandTokenCss({ fontCssUrl: 'https://fonts.bunny.net/css?family=inter:400' })
        expect(css).toBe('@import url("https://fonts.bunny.net/css?family=inter:400");')
    })
})
