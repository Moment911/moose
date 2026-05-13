// ── Koto Design System — DESIGN.md tokens ───────────────────────────────────
// All new UI must reference these tokens. Do not hardcode colors or sizes.
// Import: import { colors, fonts, spacing, radius, shadows } from '../styles/design-tokens'

// ── Colors ──────────────────────────────────────────────────────────────────
export const colors = {
  // Backgrounds
  bg: {
    primary: '#FFFFFF',         // Cards, modals, content areas
    secondary: '#F7F5F2',       // Page background (warm linen)
    tertiary: '#FAFAF8',        // Table headers, subtle sections
    canvas: '#F2EFEC',          // Hover states
  },

  // Borders
  border: {
    default: '#E8E4E0',         // Cards, inputs, dividers (warm)
    subtle: '#F0ECE8',          // Table row separators
    focus: '#E6007E',           // Focus rings on inputs
  },

  // Text
  text: {
    primary: '#1A1A1A',         // Headings, important text
    secondary: '#4A4545',       // Body text, descriptions (warm)
    tertiary: '#8A8580',        // Labels, captions, placeholders
    muted: '#8A8580',           // Alias for tertiary
    inverse: '#FFFFFF',         // Text on dark/colored backgrounds
  },

  // Brand
  brand: {
    pink: '#E6007E',            // Primary accent — buttons, active states, links
    pinkHover: '#CC006E',       // Hover state for pink
    pinkLight: 'rgba(230,0,126,0.07)',  // Light pink tint for backgrounds
    pinkLighter: 'rgba(230,0,126,0.04)', // Subtle hover tint
    teal: '#00C2CB',            // Data-positive metrics ONLY
    tealLight: 'rgba(0,194,203,0.07)',
  },

  // Semantic
  success: {
    text: '#16A34A',
    bg: '#F0FDF4',
    border: '#BBF7D0',
  },
  warning: {
    text: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  danger: {
    text: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
  },
  info: {
    text: '#2563EB',
    bg: '#EFF6FF',
    border: '#93C5FD',
  },

  // Annotation status
  annotation: {
    open: '#E6007E',
    inProgress: '#D97706',
    resolved: '#16A34A',
    measure: '#6366F1',
    approve: '#22C55E',
  },

  // Dark mode overrides
  dark: {
    bgPrimary: '#141414',
    bgPage: '#0D0D0D',
    bgSurface: '#1C1C1C',
    bgHover: '#242220',
    textPrimary: '#F0EDE6',
    textSecondary: '#A09A94',
    textMuted: '#5A5550',
    border: '#2A2725',
    borderSubtle: '#1F1D1B',
    accent: '#F0288E',
    accentHover: '#E6007E',
  },
} as const

// ── Typography ──────────────────────────────────────────────────────────────
export const fonts = {
  display: "'Instrument Serif',Georgia,serif",
  body: "'DM Sans',-apple-system,sans-serif",
  mono: "'JetBrains Mono','SF Mono',monospace",
} as const

export const fontSize = {
  xs: 11,        // Badges, tiny labels
  sm: 12,        // Secondary labels, timestamps
  base: 14,      // Body text, inputs, buttons
  md: 15,        // Slightly larger body
  lg: 16,        // Card titles, important body
  xl: 18,        // Section headers
  '2xl': 20,     // Section headings (Instrument Serif)
  '3xl': 24,     // Page titles (Instrument Serif)
  '4xl': 28,     // Hero numbers, large headings (Instrument Serif)
} as const

export const fontWeight = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

// ── Spacing ─────────────────────────────────────────────────────────────────
export const spacing = {
  '2xs': 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const

// ── Border Radius ───────────────────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const

// ── Shadows ─────────────────────────────────────────────────────────────────
export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,.04)',
  card: '0 1px 3px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.03)',
  dropdown: '0 4px 16px rgba(0,0,0,.08)',
  modal: '0 20px 48px rgba(0,0,0,.12)',
  pin: '0 2px 6px rgba(0,0,0,.3)',
} as const

// ── Common Style Patterns ───────────────────────────────────────────────────

export const cardStyle = {
  background: colors.bg.primary,
  border: `1px solid ${colors.border.default}`,
  borderRadius: radius.md,
  padding: `${spacing.xl}px`,
  boxShadow: shadows.card,
} as const

export const inputStyle = {
  width: '100%',
  padding: `${spacing.sm}px ${spacing.md}px`,
  borderRadius: radius.sm,
  border: `1px solid ${colors.border.default}`,
  fontSize: fontSize.base,
  color: colors.text.primary,
  outline: 'none',
  fontFamily: fonts.body,
} as const

export const labelStyle = {
  fontSize: 13,
  fontWeight: fontWeight.semibold,
  color: colors.text.primary,
  display: 'block' as const,
  marginBottom: spacing.xs,
  fontFamily: fonts.body,
} as const

export const buttonPrimary = {
  padding: `${spacing.sm}px ${spacing.lg}px`,
  borderRadius: radius.sm,
  border: 'none',
  background: colors.brand.pink,
  color: colors.text.inverse,
  fontSize: fontSize.base,
  fontWeight: fontWeight.semibold,
  fontFamily: fonts.body,
  cursor: 'pointer',
} as const

export const buttonSecondary = {
  padding: `${spacing.sm}px ${spacing.lg}px`,
  borderRadius: radius.sm,
  border: `1px solid ${colors.border.default}`,
  background: colors.bg.primary,
  color: colors.text.primary,
  fontSize: fontSize.base,
  fontWeight: fontWeight.medium,
  fontFamily: fonts.body,
  cursor: 'pointer',
} as const

export const sectionHeader = {
  fontSize: fontSize['2xl'],
  fontWeight: fontWeight.normal,
  color: colors.text.primary,
  fontFamily: fonts.display,
  letterSpacing: '-.01em',
} as const

export const tableHeader = {
  fontSize: fontSize.xs,
  fontWeight: fontWeight.bold,
  color: colors.text.tertiary,
  textTransform: 'uppercase' as const,
  letterSpacing: '.06em',
  padding: `${spacing.sm}px ${spacing.md}px`,
  background: colors.bg.tertiary,
} as const

export const badge = (color: string) => ({
  fontSize: fontSize.xs,
  fontWeight: fontWeight.semibold,
  padding: `3px ${spacing.xs}px`,
  borderRadius: radius.full,
  background: color + '12',
  color,
  letterSpacing: '.02em',
  whiteSpace: 'nowrap' as const,
  display: 'inline-block' as const,
}) as const
