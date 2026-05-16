// ══════════════════════════════════════════════════════════════════════════════
// KOTO DESIGN SYSTEM — Single source of truth for all UI tokens
// Import as: import { KOTO, colors, fonts, radius } from '../styles/koto-design-system'
// See DESIGN.md for rationale and full specification.
// ══════════════════════════════════════════════════════════════════════════════

export const KOTO = {
  colors: {
    pageBg:     '#faf9f6',
    white:      '#FFFFFF',
    black:      '#201b51',
    accent:     '#cb1c6b',
    accentLight:'rgba(203, 28, 107,0.07)',
    accentHover:'#a8155a',
    teal:       '#00C2CB',
    tealLight:  'rgba(0,194,203,0.07)',
    green:      '#16A34A',
    greenLight: '#F0FDF4',
    amber:      '#D97706',
    amberLight: '#FFFBEB',
    danger:     '#DC2626',
    dangerLight:'#FEF2F2',
    info:       '#2563EB',
    infoLight:  '#EFF6FF',
    gray50:     '#f5f3ee',
    gray100:    '#faf9f6',
    gray200:    '#F0ECE8',
    gray300:    '#e8e6ef',
    gray400:    '#6b6789',
    gray500:    '#6B6560',
    gray600:    '#4a4674',
    gray700:    '#3A3535',
    gray800:    '#2A2525',
    gray900:    '#201b51',
    border:     '#e8e6ef',
    borderLight:'#F0ECE8',
    // Legacy aliases (kept for compatibility)
    red:        '#cb1c6b',
    redLight:   'rgba(203, 28, 107,0.07)',
    redHover:   '#a8155a',
    purple:     '#7c3aed',
  },
  fonts: {
    heading: "'Bebas Neue','Arial Narrow',sans-serif",
    body:    "'DM Sans',-apple-system,sans-serif",
    mono:    "'JetBrains Mono','SF Mono',monospace",
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 16,
    pill: 9999,
    full: 9999,
  },
  spacing: {
    '2xs': 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
}

// Shorthand exports
export const colors = KOTO.colors
export const fonts  = KOTO.fonts
export const radius = KOTO.radius

// ── Common style objects ─────────────────────────────────────────────────────

export const pageShell = {
  display: 'flex',
  height: '100vh',
  overflow: 'hidden',
  background: KOTO.colors.pageBg,
}

export const contentArea = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

export const scrollContent = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '20px 24px',
}

export const pageHeader = {
  background: KOTO.colors.black,
  padding: '16px 28px',
  flexShrink: 0,
}

export const pageTitle = {
  fontFamily: KOTO.fonts.heading,
  fontSize: 24,
  fontWeight: 400,
  color: '#fff',
  letterSpacing: '-.01em',
}

export const card = {
  background: KOTO.colors.white,
  borderRadius: KOTO.radius.md,
  border: `1px solid ${KOTO.colors.border}`,
  padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.03)',
}

export const sectionLabel = {
  fontFamily: KOTO.fonts.body,
  fontSize: 11,
  fontWeight: 600,
  color: KOTO.colors.gray400,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: 10,
}

export const bodyText = {
  fontFamily: KOTO.fonts.body,
  fontSize: 14,
  color: KOTO.colors.gray600,
  lineHeight: 1.6,
}

export const primaryButton = {
  background: KOTO.colors.accent,
  color: KOTO.colors.white,
  border: 'none',
  borderRadius: KOTO.radius.sm,
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: KOTO.fonts.body,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

export const secondaryButton = {
  background: KOTO.colors.white,
  color: KOTO.colors.gray900,
  border: `1px solid ${KOTO.colors.border}`,
  borderRadius: KOTO.radius.sm,
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: 500,
  fontFamily: KOTO.fonts.body,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

export const inputField = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: KOTO.radius.sm,
  border: `1px solid ${KOTO.colors.border}`,
  fontSize: 14,
  fontFamily: KOTO.fonts.body,
  outline: 'none',
  boxSizing: 'border-box',
  color: KOTO.colors.black,
  background: KOTO.colors.white,
}

export const tableHeader = {
  background: KOTO.colors.gray50,
  fontFamily: KOTO.fonts.body,
  fontSize: 11,
  fontWeight: 700,
  color: KOTO.colors.gray400,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

export const tableRow = {
  borderBottom: `1px solid ${KOTO.colors.borderLight}`,
  transition: 'background .1s',
}

export const statCard = {
  background: KOTO.colors.white,
  borderRadius: KOTO.radius.md,
  border: `1px solid ${KOTO.colors.border}`,
  padding: '18px 20px',
  boxShadow: '0 1px 3px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.03)',
}

export const badge = (color = KOTO.colors.accent) => ({
  fontSize: 11,
  fontWeight: 600,
  padding: '3px 10px',
  borderRadius: KOTO.radius.pill,
  background: color + '12',
  color: color,
  fontFamily: KOTO.fonts.body,
})

export const navItemActive = {
  background: KOTO.colors.accentLight,
  borderLeft: `3px solid ${KOTO.colors.accent}`,
  color: KOTO.colors.accent,
  fontWeight: 600,
}

export const navItemInactive = {
  background: 'transparent',
  borderLeft: '3px solid transparent',
  color: KOTO.colors.gray600,
  fontWeight: 500,
}
