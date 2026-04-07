// ══════════════════════════════════════════════════════════════════════════════
// KOTO DESIGN SYSTEM — Single source of truth for all UI tokens
// Import as: import { KOTO, colors, fonts, radius } from '../styles/koto-design-system'
// ══════════════════════════════════════════════════════════════════════════════

export const KOTO = {
  colors: {
    pageBg:     '#f2f2f0',
    white:      '#ffffff',
    black:      '#0a0a0a',
    red:        '#ea2729',
    redLight:   '#fef2f2',
    redHover:   '#d42224',
    teal:       '#5bc6d0',
    tealLight:  '#f0fafb',
    green:      '#16a34a',
    greenLight: '#f0fdf4',
    amber:      '#f59e0b',
    amberLight: '#fffbeb',
    purple:     '#7c3aed',
    gray50:     '#f9fafb',
    gray100:    '#f3f4f6',
    gray200:    '#e5e7eb',
    gray300:    '#d1d5db',
    gray400:    '#9ca3af',
    gray500:    '#6b7280',
    gray600:    '#4b5563',
    gray700:    '#374151',
    gray800:    '#1f2937',
    gray900:    '#111827',
    border:     '#e5e7eb',
    borderLight:'#f3f4f6',
  },
  fonts: {
    heading: "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif",
    body:    "'Raleway','Helvetica Neue',sans-serif",
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    pill: 20,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
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
  fontSize: 18,
  fontWeight: 800,
  color: '#fff',
  letterSpacing: '-.02em',
}

export const card = {
  background: KOTO.colors.white,
  borderRadius: KOTO.radius.lg,
  border: `1px solid ${KOTO.colors.border}`,
  padding: '20px',
}

export const sectionLabel = {
  fontFamily: KOTO.fonts.heading,
  fontSize: 11,
  fontWeight: 700,
  color: KOTO.colors.gray400,
  textTransform: 'uppercase',
  letterSpacing: '.08em',
  marginBottom: 10,
}

export const bodyText = {
  fontFamily: KOTO.fonts.body,
  fontSize: 14,
  color: KOTO.colors.gray700,
  lineHeight: 1.6,
}

export const primaryButton = {
  background: KOTO.colors.red,
  color: KOTO.colors.white,
  border: 'none',
  borderRadius: KOTO.radius.md,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: KOTO.fonts.heading,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

export const secondaryButton = {
  background: KOTO.colors.white,
  color: KOTO.colors.gray700,
  border: `1px solid ${KOTO.colors.border}`,
  borderRadius: KOTO.radius.md,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: KOTO.fonts.heading,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

export const inputField = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: KOTO.radius.md,
  border: `1px solid ${KOTO.colors.border}`,
  fontSize: 13,
  fontFamily: KOTO.fonts.body,
  outline: 'none',
  boxSizing: 'border-box',
  color: KOTO.colors.black,
  background: KOTO.colors.white,
}

export const tableHeader = {
  background: KOTO.colors.gray50,
  fontFamily: KOTO.fonts.heading,
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
  borderRadius: KOTO.radius.lg,
  border: `1px solid ${KOTO.colors.border}`,
  padding: '18px 20px',
}

export const badge = (color = KOTO.colors.red) => ({
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: KOTO.radius.pill,
  background: color + '18',
  color: color,
  fontFamily: KOTO.fonts.heading,
})

export const navItemActive = {
  background: KOTO.colors.redLight,
  borderLeft: `3px solid ${KOTO.colors.red}`,
  color: KOTO.colors.red,
  fontWeight: 700,
}

export const navItemInactive = {
  background: 'transparent',
  borderLeft: '3px solid transparent',
  color: KOTO.colors.gray700,
  fontWeight: 400,
}
