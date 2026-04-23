// ─────────────────────────────────────────────────────────────────────────────
// Trainer design tokens — Apple 2026 pass.
// Shared SF Pro stack, warm-white surfaces, layered shadows, glass, press-scale.
// ─────────────────────────────────────────────────────────────────────────────

export const T_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", system-ui, "Segoe UI", Roboto, sans-serif'

// Surfaces
export const T_BG = '#faf9f6'       // warm-white page canvas
export const T_BG_DIM = '#f4f2ec'   // slightly deeper warm
export const T_SURFACE = '#ffffff'
export const T_BRD = '#e7e4dc'      // warmer hairline than neutral grey
export const T_INK = '#0f1115'
export const T_INK_DIM = '#5f6470'

// Accents (unchanged from existing app)
export const T_RED = '#dc2626'
export const T_BLUE = '#2563eb'

// Layered shadows — cast on warm-white, so use slightly warm ink shadows.
export const T_SHADOW_SM =
  '0 1px 2px rgba(17, 17, 17, 0.04), 0 1px 1px rgba(17, 17, 17, 0.04)'
export const T_SHADOW_MD =
  '0 1px 2px rgba(17, 17, 17, 0.04), 0 4px 16px rgba(17, 17, 17, 0.06)'
export const T_SHADOW_LG =
  '0 2px 4px rgba(17, 17, 17, 0.04), 0 12px 32px rgba(17, 17, 17, 0.08), 0 24px 48px rgba(17, 17, 17, 0.06)'

// Glass (used for the dark sidebar + any translucent overlays).
export const T_GLASS_DARK = {
  background: 'rgba(10, 10, 10, 0.78)',
  backdropFilter: 'saturate(1.8) blur(20px)',
  WebkitBackdropFilter: 'saturate(1.8) blur(20px)',
}

export const T_GLASS_LIGHT = {
  background: 'rgba(255, 255, 255, 0.72)',
  backdropFilter: 'saturate(1.6) blur(18px)',
  WebkitBackdropFilter: 'saturate(1.6) blur(18px)',
}

// Apple-ish type scale
export const T_TYPE = {
  display: { fontSize: 34, fontWeight: 700, letterSpacing: '-0.022em', lineHeight: 1.08 },
  title1:  { fontSize: 28, fontWeight: 700, letterSpacing: '-0.018em', lineHeight: 1.12 },
  title2:  { fontSize: 22, fontWeight: 700, letterSpacing: '-0.014em', lineHeight: 1.18 },
  title3:  { fontSize: 20, fontWeight: 600, letterSpacing: '-0.012em', lineHeight: 1.22 },
  headline:{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.008em', lineHeight: 1.3 },
  body:    { fontSize: 15, fontWeight: 400, letterSpacing: '-0.003em', lineHeight: 1.47 },
  callout: { fontSize: 14, fontWeight: 500, lineHeight: 1.42 },
  subhead: { fontSize: 13, fontWeight: 500, lineHeight: 1.38 },
  footnote:{ fontSize: 12, fontWeight: 500, lineHeight: 1.33 },
  caption: { fontSize: 11, fontWeight: 500, lineHeight: 1.28 },
}

// ── Press-scale motion primitive ─────────────────────────────────────────────
// Adds .t-press class globally. Components only need className="t-press".
// Injected once per app load; safe to call repeatedly.
let _cssInjected = false
export function injectTrainerUICSS() {
  if (_cssInjected) return
  if (typeof document === 'undefined') return
  const css = `
    .t-press { transition: transform 120ms cubic-bezier(.2,.7,.3,1), box-shadow 160ms ease, background-color 120ms ease, border-color 120ms ease; }
    .t-press:active { transform: scale(.97); }
    .t-press:focus-visible { outline: 2px solid ${T_BLUE}; outline-offset: 2px; }
    .t-lift { transition: transform 160ms cubic-bezier(.2,.7,.3,1), box-shadow 200ms ease; }
    .t-lift:hover { transform: translateY(-1px); }
  `
  const el = document.createElement('style')
  el.setAttribute('data-trainer-ui', '1')
  el.textContent = css
  document.head.appendChild(el)
  _cssInjected = true
}
