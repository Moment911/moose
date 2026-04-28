// ─────────────────────────────────────────────────────────────────────────────
// Trainer design tokens — Cal-AI aesthetic pass.
// White bg, #0a0a0a ink, #f1f1f6 card, #ececef borders, SF Pro, 500 body.
// Matches /train and /my-plan design language.
// ─────────────────────────────────────────────────────────────────────────────

export const T_FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"

// Sporty condensed font for numbers
export const T_FONT_NUM =
  '"Barlow Condensed", "SF Pro Display", system-ui, sans-serif'

// Surfaces
export const T_BG = '#ffffff'          // clean white canvas
export const T_BG_DIM = '#f9f9fb'     // slightly off-white for depth
export const T_SURFACE = '#f1f1f6'    // card / inset surface — cool-gray, slight lavender
export const T_SURFACE_ELEV = '#ffffff' // elevated tile on top of card
export const T_BRD = '#ececef'        // cool neutral hairline
export const T_DIVIDER = '#e5e5ea'    // section dividers
export const T_INK = '#0a0a0a'        // headlines, primary text
export const T_INK2 = '#1f1f22'       // body text
export const T_INK_DIM = '#6b6b70'    // secondary / subtitle
export const T_INK_FADED = '#a1a1a6'  // disabled / placeholder

// Accents — used sparingly
export const T_ACCENT = '#d89a6a'     // warm tan — highlight, "ready" pill
export const T_RED = '#e9695c'
export const T_BLUE = '#5aa0ff'
export const T_GREEN = '#16a34a'
export const T_STAR = '#f0b400'

// Layered shadows
export const T_SHADOW_SM =
  '0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)'
export const T_SHADOW_MD =
  '0 6px 16px rgba(0,0,0,0.06)'
export const T_SHADOW_LG =
  '0 20px 60px rgba(0,0,0,0.18)'

// Type scale — SF Pro, heavier body weight (500)
export const T_TYPE = {
  display: { fontSize: 34, fontWeight: 800, letterSpacing: '-0.6px', lineHeight: 1.10 },
  title1:  { fontSize: 28, fontWeight: 700, letterSpacing: '-0.4px', lineHeight: 1.15 },
  title2:  { fontSize: 20, fontWeight: 700, letterSpacing: '-0.2px', lineHeight: 1.20 },
  title3:  { fontSize: 17, fontWeight: 600, letterSpacing: '0px',    lineHeight: 1.30 },
  headline:{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.2px', lineHeight: 1.30 },
  body:    { fontSize: 17, fontWeight: 500, letterSpacing: '0px',    lineHeight: 1.40 },
  callout: { fontSize: 15, fontWeight: 500, letterSpacing: '0px',    lineHeight: 1.40 },
  subhead: { fontSize: 15, fontWeight: 500, letterSpacing: '0px',    lineHeight: 1.40 },
  footnote:{ fontSize: 13, fontWeight: 500, letterSpacing: '0px',    lineHeight: 1.30 },
  caption: { fontSize: 13, fontWeight: 400, letterSpacing: '0.1px',  lineHeight: 1.30 },
}

// Radii
export const T_R_SM = 12
export const T_R_MD = 16
export const T_R_LG = 22
export const T_R_PILL = 999

// ── Press-scale motion primitive ─────────────────────────────────────────────
let _cssInjected = false
export function injectTrainerUICSS() {
  if (_cssInjected) return
  if (typeof document === 'undefined') return
  // Load Barlow Condensed for sporty number display
  if (!document.querySelector('link[data-trainer-font]')) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&display=swap'
    link.setAttribute('data-trainer-font', '1')
    document.head.appendChild(link)
  }
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
