// ── Koto Design System — Single source of truth for all visual tokens ────────
// Aligned with DESIGN.md (2026-05-16 unification): Bebas Neue display,
// DM Sans body, navy #201b51 + cream #faf9f6 + pink #cb1c6b. The exported
// short names (R, T, BLK, GRY, FH, FB, W, GRN, AMB, DST) stay so the 59
// tabs that import them get the new palette without code changes.
//
// New code should prefer the explicit names — `koto` token map below —
// or the koto/ui primitives in `src/components/ui/koto/`.

// Brand colors (DESIGN.md §Color)
export const R    = '#cb1c6b'   // Koto Pink — primary accent (unchanged)
export const T    = '#0d9e6e'   // Koto Teal — secondary accent (charts only, dark teal)
export const BLK  = '#201b51'   // Navy — primary text + structure (was #111111)
export const GRY  = '#faf9f6'   // Warm cream — page surface (was #f9fafb)
export const GRN  = '#16A34A'   // Success
export const AMB  = '#D97706'   // Warning
export const W    = '#ffffff'

// Destructive (DESIGN.md §Color · usage rules: never collide with accent pink)
export const DST  = '#DC2626'

// Font stacks (DESIGN.md §Typography)
//
// IMPORTANT: FH used to be Proxima Nova — a body-weight sans. Many of the
// 143 files that import it apply it to BUTTONS, LABELS, and SMALL UI TEXT
// (10-14px) where Bebas Neue (a condensed all-caps display font) would look
// SHOUTY and unreadable. So FH is aliased to DM Sans for backward compat.
//
// For an actual display headline, import FD (Bebas Neue) explicitly, or
// declare a local DISPLAY constant like the new tabs do. DESIGN.md reserves
// Bebas Neue for headlines, hero numerals, and KPI stats — never below 18px.
//
// Display = Bebas Neue   (FD — headlines, hero numerals, KPI stats; ≥18px)
// Heading = DM Sans      (FH — alias to body, kept for back-compat across 143 files)
// Body    = DM Sans      (FB — UI text, labels, controls)
// Accent  = DM Serif Display italic (FA — editorial accent word inside hero copy)
// Mono    = JetBrains Mono (FM — data, code, monospaced inputs)
export const FD = "'Bebas Neue', 'Arial Narrow', sans-serif"
export const FH = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
export const FB = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
export const FA = "'DM Serif Display', Georgia, serif"
export const FM = "'JetBrains Mono', 'SF Mono', Menlo, monospace"

// Extended palette (canonical names — prefer these in new code)
export const koto = {
  // Color
  navy: BLK,
  navyDeep: '#15113a',          // dark mode page bg (matches Unified Marketing style guide)
  pink: R,
  pinkHover: '#a8155a',
  pinkSoft: 'rgba(203, 28, 107, 0.08)',
  cream: GRY,
  off: '#f5f3ee',               // off-white surface
  white: W,
  text: BLK,
  dim: '#4a4674',
  muted: '#6b6789',
  faint: '#9d9ab3',
  line: 'rgba(32, 27, 81, .12)',
  lineSoft: 'rgba(32, 27, 81, .06)',
  success: GRN,
  warning: AMB,
  danger: DST,
  info: '#2563EB',
  // Fonts (alias)
  fontDisplay: FD,
  fontHeading: FH,
  fontBody: FB,
  fontAccent: FA,
  fontMono: FM,
} as const

// Common inline style patterns — updated to new tokens.
// All consumers continue to import { cardStyle, buttonPrimary, ... } and get
// the new look automatically.

export const cardStyle = {
  background: W,
  borderRadius: 16,
  border: `1px solid ${koto.line}`,
  padding: '20px 22px',
  marginBottom: 14,
  boxShadow: '0 4px 24px rgba(32, 27, 81, .05)',
  fontFamily: FB,
} as const

export const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  fontFamily: FB,
  color: koto.muted,
  textTransform: 'uppercase' as const,
  letterSpacing: '.14em',
  marginBottom: 6,
  display: 'block',
} as const

export const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${koto.line}`,
  fontSize: 14,
  fontFamily: FB,
  color: BLK,
  outline: 'none',
  boxSizing: 'border-box' as const,
} as const

export const cardTitleStyle = {
  fontSize: 16,
  fontWeight: 600,
  fontFamily: FB,
  color: BLK,
  marginBottom: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
} as const

export const badgeStyle = (color: string) => ({
  fontSize: 10,
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: 999,
  background: color + '15',
  color,
  textTransform: 'uppercase' as const,
  letterSpacing: '.06em',
  fontFamily: FB,
}) as const

// Pill primary — pink, uppercase, soft pink shadow (DESIGN.md §Geometry)
export const buttonPrimary = {
  padding: '12px 22px',
  borderRadius: 9999,
  border: 'none',
  background: R,
  color: W,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: FB,
  letterSpacing: '.08em',
  textTransform: 'uppercase' as const,
  boxShadow: '0 4px 20px rgba(203, 28, 107, .25)',
  cursor: 'pointer',
  transition: 'background .25s, transform .25s, box-shadow .25s',
} as const

export const buttonSecondary = {
  padding: '10px 18px',
  borderRadius: 9999,
  border: `1px solid ${koto.line}`,
  background: W,
  color: BLK,
  fontSize: 12,
  fontWeight: 500,
  fontFamily: FB,
  letterSpacing: '.04em',
  cursor: 'pointer',
  transition: 'background 200ms ease-out, border-color 200ms',
} as const
