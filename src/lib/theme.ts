// ── Koto Design System — Single source of truth for all visual tokens ────────
// Import this instead of redeclaring R, T, BLK, etc. in every file.

// Brand colors
export const R   = '#E6007E'   // Koto Pink — primary accent
export const T   = '#00C2CB'   // Koto Teal — secondary accent
export const BLK = '#111111'   // Near-black for text
export const GRY = '#f9fafb'   // Light gray background
export const GRN = '#16a34a'   // Success green
export const AMB = '#f59e0b'   // Warning amber
export const W   = '#ffffff'   // White

// Font stacks
export const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"  // Headings
export const FB = "'Raleway','Helvetica Neue',sans-serif"                      // Body

// Common inline style patterns
export const cardStyle = {
  background: W,
  borderRadius: 14,
  border: '1px solid #e5e7eb',
  padding: '20px 22px',
  marginBottom: 14,
} as const

export const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  fontFamily: FH,
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '.06em',
  marginBottom: 6,
  display: 'block',
} as const

export const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  fontSize: 14,
  fontFamily: FB,
  color: BLK,
  outline: 'none',
} as const

export const cardTitleStyle = {
  fontSize: 15,
  fontWeight: 800,
  fontFamily: FH,
  color: BLK,
  marginBottom: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
} as const

export const badgeStyle = (color: string) => ({
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 20,
  background: color + '15',
  color,
  textTransform: 'uppercase' as const,
  letterSpacing: '.04em',
}) as const

export const buttonPrimary = {
  padding: '10px 20px',
  borderRadius: 10,
  border: 'none',
  background: R,
  color: W,
  fontSize: 14,
  fontWeight: 700,
  fontFamily: FH,
  cursor: 'pointer',
} as const

export const buttonSecondary = {
  padding: '10px 20px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: W,
  color: BLK,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: FH,
  cursor: 'pointer',
} as const

// ── Phase 7 destructive action token (UI-SPEC §3) ────────────────────────────
// Used ONLY for field-rejection confirmation in the Launch Page (D-05 delete
// flow + D-10 margin-note "reject" action).  Koto Pink (R) stays reserved for
// accent + the D-11 discrepancy callout; reusing it for destructive would
// collide visually with discrepancy dots.
export const DST = '#DC2626'
