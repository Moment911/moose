// Site style-token extraction for topic-campaign pages.
//
// The deployed pages use clean, semantic koto markup (good for SEO + the
// omit-when-empty E-E-A-T blocks), NOT a clone of the source DOM. So matching
// "the rest of the site" is a re-theming job, not a layout clone: pull the
// site's real design tokens (fonts, color palette, link/button treatment) and
// feed them into the base CSS as CSS custom properties.
//
// Source of truth, in precedence order:
//   1. Elementor global kit vars (--e-global-color-*, --e-global-typography-*)
//      — exact brand values, the best case (pilot site is Elementor Pro).
//   2. Theme :root custom properties (--color-primary, --brand, etc).
//   3. Plain body / h1-h2 / a / button rules parsed from the CSS text.
//
// Everything emitted by buildBrandTokenCss() is sanitized first — even though
// the input is the operator's own site, the values land inside a <style> block
// we ship to WordPress, so a stray `}` or `;` could break the page or inject
// rules. Unparseable values are dropped (the base CSS literal fallback wins).

export interface StyleTokens {
    fontBody?: string
    fontHeading?: string
    /** Brand primary — links, CTA background, accents. */
    colorPrimary?: string
    /** Secondary brand color — CTA gradient end / accent. */
    colorAccent?: string
    /** Heading text color. */
    colorHeading?: string
    /** Body text color. */
    colorText?: string
    /** Muted / secondary text color. */
    colorMuted?: string
    /** Card / section surface background. */
    colorSurface?: string
    /** Border / hairline color. */
    colorBorder?: string
    /** Corner radius for cards / buttons. */
    radius?: string
    /** Heading font-weight (e.g. "700", "800") — a big "looks like the site"
     *  signal; the base CSS otherwise hard-codes its own weights. */
    headingWeight?: string
    /** CTA / primary button background — captured from the site's button rule
     *  so our CTA + booking buttons match. Falls back to colorPrimary. */
    colorButtonBg?: string
    /** CTA / primary button text color. Falls back to #fff. */
    colorButtonText?: string
    /** Button corner radius (themes often differ from card radius). */
    buttonRadius?: string
    /** A webfont stylesheet URL captured from the source page's <link>/@import
     *  (Google Fonts / Bunny / Adobe). Emitted as a sanitized @import so the
     *  brand font actually loads — names alone don't render in preview. */
    fontCssUrl?: string
    /** Base body font-size (e.g. "18px", "1.125rem") — matches overall text
     *  scale in standalone preview / where the theme size isn't inherited. */
    fontSize?: string
    /** Base body line-height (unitless 1-3, or a sized value). */
    lineHeight?: string
}

// Hosts we trust to @import a webfont stylesheet from. Anything else is dropped
// — the URL lands in a <style> we ship to WordPress, so it must be locked down.
const FONT_HOST_ALLOWLIST = /^https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|fonts\.bunny\.net|use\.typekit\.net|use\.fontawesome\.com)\//i

const COLOR_RE = /^(#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)|[a-z]{3,20})$/i
const RADIUS_RE = /^[0-9]+(?:\.[0-9]+)?(?:px|rem|em|%)$/i

/** Validate a color value; drop anything that could break/inject CSS. */
function sanitizeColor(raw?: string | null): string | undefined {
    if (!raw) return undefined
    const v = raw.trim().replace(/!important/gi, '').trim()
    if (!v || /[{};:@]|\/\*/.test(v)) return undefined
    return COLOR_RE.test(v) ? v : undefined
}

/** Validate + normalize a font-family list; drop anything suspicious. */
function sanitizeFont(raw?: string | null): string | undefined {
    if (!raw) return undefined
    let v = raw.trim().replace(/!important/gi, '').trim()
    if (!v || /[{}@]|\/\*|;|:/.test(v)) return undefined
    v = v.replace(/\s+/g, ' ').slice(0, 120).trim()
    // Must contain at least one real font name character.
    if (!/[a-z0-9]/i.test(v)) return undefined
    return v
}

function sanitizeRadius(raw?: string | null): string | undefined {
    if (!raw) return undefined
    const v = raw.trim().replace(/!important/gi, '').trim()
    return RADIUS_RE.test(v) ? v : undefined
}

const SIZE_RE = /^[0-9]+(?:\.[0-9]+)?(?:px|rem|em|%|pt)$/i

/** A CSS length for font-size (px/rem/em/%/pt). */
function sanitizeSize(raw?: string | null): string | undefined {
    if (!raw) return undefined
    const v = raw.trim().replace(/!important/gi, '').trim()
    return SIZE_RE.test(v) ? v : undefined
}

/** Line-height: unitless 1-3 (typical body range) or a CSS length. */
function sanitizeLineHeight(raw?: string | null): string | undefined {
    if (!raw) return undefined
    const v = raw.trim().replace(/!important/gi, '').trim()
    if (/^[0-9]*\.?[0-9]+$/.test(v)) {
        const n = parseFloat(v)
        return n >= 1 && n <= 3 ? v : undefined
    }
    return SIZE_RE.test(v) ? v : undefined
}

/** Font-weight: a number 100-900 or a known keyword. */
function sanitizeWeight(raw?: string | null): string | undefined {
    if (!raw) return undefined
    const v = raw.trim().replace(/!important/gi, '').trim().toLowerCase()
    if (/^[1-9]00$/.test(v)) return v
    if (v === 'bold' || v === 'bolder' || v === 'normal') return v
    return undefined
}

/** A webfont stylesheet URL — must be https and on the allowlist. Block only
 *  chars that could break OUT of `@import url("...")` (quotes, angle brackets,
 *  whitespace, comments); `;@?&=:` are legal in Google-Fonts URLs and stay. */
function sanitizeFontUrl(raw?: string | null): string | undefined {
    if (!raw) return undefined
    const v = raw.trim().replace(/^url\(/i, '').replace(/\)$/, '').replace(/['"]/g, '').trim()
    if (!v || /["'<>\s)]|\/\*/.test(v)) return undefined
    return FONT_HOST_ALLOWLIST.test(v) ? v : undefined
}

/** First value of a CSS custom property `--name` anywhere in the text. */
function findVar(css: string, name: string): string | undefined {
    // name is a literal we control (no regex metachars), safe to interpolate.
    const re = new RegExp(`--${name}\\s*:\\s*([^;}]+)`, 'i')
    const m = css.match(re)
    return m ? m[1].trim() : undefined
}

/**
 * If `val` is a `var(--xxx, fallback)` reference, resolve it by looking up
 * `--xxx` in the CSS text. Recurses once (single-hop resolution) so
 * `var(--body_typography-font-family, inherit)` becomes the real font name
 * defined elsewhere in the stylesheet. Returns the original value if it's
 * not a var() or the variable isn't found (the fallback inside the var()
 * is used as a last resort).
 */
function resolveVarRef(val: string | undefined, css: string, depth = 0): string | undefined {
    if (!val || depth > 2) return val
    const m = val.match(/^var\(\s*--([a-zA-Z0-9_-]+)\s*(?:,\s*([^)]*))?\)$/)
    if (!m) return val
    const varName = m[1]
    const fallback = m[2]?.trim()
    const resolved = findVar(css, varName)
    if (resolved) {
        // The resolved value might itself be a var() — recurse once.
        return resolveVarRef(resolved, css, depth + 1)
    }
    // No definition found; use the fallback if it's a real value (not 'inherit').
    if (fallback && fallback !== 'inherit' && fallback !== 'initial') return fallback
    return undefined
}

/** Body of the FIRST matching rule for a comma-free selector, e.g. `body`. */
function findRuleBody(css: string, selector: string): string | undefined {
    // Match a rule whose selector list contains `selector` as a whole token,
    // not nested (cheap heuristic — good enough for top-level body/h1/a rules).
    const re = new RegExp(`(?:^|[},])\\s*([^{}]*\\b${selector}\\b[^{}]*)\\{([^{}]*)\\}`, 'i')
    const m = css.match(re)
    return m ? m[2] : undefined
}

/** Pull a single declaration value out of a rule body. */
function decl(body: string | undefined, prop: string): string | undefined {
    if (!body) return undefined
    const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i')
    const m = body.match(re)
    return m ? m[1].trim() : undefined
}

/** Find the first allowlisted webfont stylesheet URL in the page's <link> tags
 *  or the CSS's @import rules. Lives outside the CSS-empty guard because the
 *  font <link> is in the HTML head, not the stylesheet. */
function extractFontCssUrl(html: string, css: string): string | undefined {
    const urls: string[] = []
    const linkRe = /<link\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi
    let lm: RegExpExecArray | null
    while ((lm = linkRe.exec(html))) {
        const u = sanitizeFontUrl(lm[2])
        if (u) urls.push(u)
    }
    const impRe = /@import\s+(?:url\(\s*)?(["']?)([^"')\s]+)\1/gi
    let im: RegExpExecArray | null
    while ((im = impRe.exec(css))) {
        const u = sanitizeFontUrl(im[2])
        if (u) urls.push(u)
    }
    return urls.find(u => /googleapis|bunny|typekit/i.test(u)) || urls[0]
}

/**
 * Extract design tokens from a page's HTML + any external stylesheet texts.
 * Returns only the keys it could confidently resolve; missing keys fall back
 * to the base CSS literals at render time.
 */
export function extractStyleTokens(html: string, cssTexts: string[] = []): StyleTokens {
    // Inline <style> blocks from the page (Elementor often inlines the kit here)
    // plus every external stylesheet we fetched. Cap to keep regex bounded.
    const inlineStyles = (html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi) || [])
        .map(s => s.replace(/<\/?style\b[^>]*>/gi, ''))
        .join('\n')
    const css = [inlineStyles, ...cssTexts].join('\n').slice(0, 2_000_000)

    // Webfont URL can come from an HTML <link> even when there's no inline CSS,
    // so resolve it before the css-empty short-circuit.
    const fontCssUrl = extractFontCssUrl(html, css)
    if (!css.trim()) return fontCssUrl ? { fontCssUrl } : {}

    const t: StyleTokens = {}
    t.fontCssUrl = fontCssUrl

    // ── 1. Elementor global kit (highest fidelity) ────────────────────────────
    t.colorPrimary = sanitizeColor(findVar(css, 'e-global-color-primary'))
    t.colorAccent = sanitizeColor(findVar(css, 'e-global-color-accent'))
        || sanitizeColor(findVar(css, 'e-global-color-secondary'))
    t.colorText = sanitizeColor(findVar(css, 'e-global-color-text'))
    t.colorHeading = sanitizeColor(findVar(css, 'e-global-color-secondary'))
    t.fontBody = sanitizeFont(findVar(css, 'e-global-typography-text-font-family'))
        || sanitizeFont(findVar(css, 'e-global-typography-primary-font-family'))
    t.fontHeading = sanitizeFont(findVar(css, 'e-global-typography-primary-font-family'))

    // ── 2. Generic theme custom properties (conventionally defined in :root) ──
    // Read by var name globally (findVar) rather than scoping to a `:root`
    // rule — a `\b:root\b` match fails because `:` is a non-word char, and the
    // values are unique enough that a global lookup is safe.
    t.colorPrimary = t.colorPrimary
        || sanitizeColor(findVar(css, 'color-primary'))
        || sanitizeColor(findVar(css, 'primary'))
        || sanitizeColor(findVar(css, 'brand'))
        || sanitizeColor(findVar(css, 'accent-color'))
    t.colorText = t.colorText
        || sanitizeColor(findVar(css, 'text-color'))
        || sanitizeColor(findVar(css, 'body-color'))
    t.colorHeading = t.colorHeading
        || sanitizeColor(findVar(css, 'heading-color'))
        || sanitizeColor(findVar(css, 'headings-color'))
    t.fontBody = t.fontBody
        || sanitizeFont(findVar(css, 'font-body'))
        || sanitizeFont(findVar(css, 'body-font'))
        || sanitizeFont(findVar(css, 'font-family-base'))
    t.fontHeading = t.fontHeading
        || sanitizeFont(findVar(css, 'font-heading'))
        || sanitizeFont(findVar(css, 'heading-font'))
    t.radius = sanitizeRadius(findVar(css, 'border-radius'))
        || sanitizeRadius(findVar(css, 'radius'))

    // ── 3. Plain element rules (body / headings / links) ──────────────────────
    // resolveVarRef dereferences var(--xxx) references so we store the real
    // value, not a pointer that only works inside the origin theme.
    const bodyRule = findRuleBody(css, 'body')
    t.fontBody = t.fontBody || sanitizeFont(resolveVarRef(decl(bodyRule, 'font-family'), css))
    t.colorText = t.colorText || sanitizeColor(resolveVarRef(decl(bodyRule, 'color'), css))
    t.colorSurface = t.colorSurface || sanitizeColor(resolveVarRef(decl(bodyRule, 'background-color'), css))
    t.fontSize = sanitizeSize(resolveVarRef(decl(bodyRule, 'font-size'), css))
    t.lineHeight = sanitizeLineHeight(resolveVarRef(decl(bodyRule, 'line-height'), css))

    const h1Rule = findRuleBody(css, 'h1') || findRuleBody(css, 'h2')
    t.fontHeading = t.fontHeading || sanitizeFont(resolveVarRef(decl(h1Rule, 'font-family'), css))
    t.colorHeading = t.colorHeading || sanitizeColor(resolveVarRef(decl(h1Rule, 'color'), css))

    const aRule = findRuleBody(css, 'a')
    t.colorPrimary = t.colorPrimary || sanitizeColor(resolveVarRef(decl(aRule, 'color'), css))

    // ── 4. Heading weight + button treatment (high "looks like the site" signal) ──
    t.headingWeight = sanitizeWeight(resolveVarRef(decl(h1Rule, 'font-weight'), css))

    // Primary button — try common theme/builder button selectors in priority
    // order. The class name (no leading dot) matches inside the selector list.
    const btnRule = findRuleBody(css, 'elementor-button')
        || findRuleBody(css, 'wp-block-button__link')
        || findRuleBody(css, 'btn')
        || findRuleBody(css, 'button')
    t.colorButtonBg = sanitizeColor(resolveVarRef(decl(btnRule, 'background-color') || decl(btnRule, 'background'), css))
    t.colorButtonText = sanitizeColor(resolveVarRef(decl(btnRule, 'color'), css))
    t.buttonRadius = sanitizeRadius(resolveVarRef(decl(btnRule, 'border-radius'), css))

    // Drop empty keys so callers / JSON storage stay clean.
    for (const k of Object.keys(t) as (keyof StyleTokens)[]) {
        if (!t[k]) delete t[k]
    }
    return t
}

/**
 * Emit a `:root{ --koto-* }` override block from captured tokens. Only the
 * keys present are written; the base CSS reads each as `var(--koto-x, <literal>)`
 * so absent tokens transparently fall back to the default styling.
 *
 * Scoped to `:root` and namespaced `--koto-*` — only our `.koto-*` rules read
 * these, so nothing leaks into the rest of the page. Returns '' when there is
 * nothing usable (keeps output byte-identical to the no-tokens path).
 */
export function buildBrandTokenCss(tokens?: StyleTokens | null): string {
    if (!tokens) return ''
    const decls: string[] = []
    const push = (name: string, val?: string) => { if (val) decls.push(`${name}:${val}`) }

    push('--koto-font-body', tokens.fontBody)
    push('--koto-font-heading', tokens.fontHeading || tokens.fontBody)
    push('--koto-color-primary', tokens.colorPrimary)
    // CTA gradient end: prefer an accent, else reuse primary (flat-ish gradient).
    push('--koto-color-primary-2', tokens.colorAccent || tokens.colorPrimary)
    push('--koto-color-heading', tokens.colorHeading)
    push('--koto-color-text', tokens.colorText)
    push('--koto-color-muted', tokens.colorMuted)
    push('--koto-color-surface', tokens.colorSurface)
    push('--koto-color-border', tokens.colorBorder)
    push('--koto-radius', tokens.radius)
    push('--koto-heading-weight', tokens.headingWeight)
    // Button: prefer captured button color, else fall back to the brand primary.
    push('--koto-color-button-bg', tokens.colorButtonBg || tokens.colorPrimary)
    push('--koto-color-button-text', tokens.colorButtonText)
    push('--koto-button-radius', tokens.buttonRadius || tokens.radius)
    push('--koto-font-size', tokens.fontSize)
    push('--koto-line-height', tokens.lineHeight)

    const root = decls.length ? `:root{${decls.join(';')}}` : ''
    // @import must precede other rules. Emitted only for an allowlisted https
    // font URL (already sanitized in extractStyleTokens), so the brand font
    // renders even where the host theme hasn't loaded it.
    const fontImport = tokens.fontCssUrl ? `@import url("${tokens.fontCssUrl}");` : ''
    if (!root && !fontImport) return ''
    return [fontImport, root].filter(Boolean).join('\n')
}
