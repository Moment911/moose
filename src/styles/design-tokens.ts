// ── Koto Design System — Linear-inspired tokens ─────────────────────────────
// All new UI must reference these tokens. Do not hardcode colors or sizes.
// Import: import { colors, fonts, spacing, radius, shadows } from '../styles/design-tokens'

// ── Colors ──────────────────────────────────────────────────────────────────
export const colors = {
  // Backgrounds
  bg: {
    primary: '#ffffff',         // Main content areas, cards, modals
    secondary: '#f9fafb',       // Page backgrounds, table headers, subtle sections
    tertiary: '#f3f4f6',        // Hover states, input backgrounds, muted areas
    canvas: '#e5e7eb',          // Canvas/preview area behind content
  },

  // Borders
  border: {
    default: '#e5e7eb',         // Cards, inputs, dividers
    subtle: '#f3f4f6',          // Table row separators, light dividers
    focus: '#E6007E',           // Focus rings on inputs
  },

  // Text
  text: {
    primary: '#111111',         // Headings, important text
    secondary: '#374151',       // Body text, descriptions
    tertiary: '#6b7280',        // Labels, captions, secondary info
    muted: '#9ca3af',           // Placeholders, disabled text, timestamps
    inverse: '#ffffff',         // Text on dark/colored backgrounds
  },

  // Brand
  brand: {
    pink: '#E6007E',            // Primary accent — buttons, active states, links
    pinkHover: '#cc006e',       // Hover state for pink
    pinkLight: '#E6007E15',     // Light pink tint for backgrounds
    teal: '#00C2CB',            // Secondary accent — badges, highlights
    tealLight: '#00C2CB15',     // Light teal tint
  },

  // Semantic
  success: {
    text: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  warning: {
    text: '#f59e0b',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  danger: {
    text: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
  },
  info: {
    text: '#2563eb',
    bg: '#eff6ff',
    border: '#93c5fd',
  },

  // Annotation status
  annotation: {
    open: '#E6007E',            // Unresolved annotations
    inProgress: '#f59e0b',      // In-progress
    resolved: '#16a34a',        // Completed/resolved
    measure: '#6366f1',         // Measurement tool
    approve: '#22c55e',         // Approval stamp
  },
} as const

// ── Typography ──────────────────────────────────────────────────────────────
export const fonts = {
  heading: "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif",
  body: "'Raleway','Helvetica Neue',sans-serif",
  mono: "'JetBrains Mono','SF Mono',monospace",
} as const

export const fontSize = {
  xs: 11,        // Badges, tiny labels
  sm: 12,        // Secondary labels, timestamps
  base: 14,      // Body text, inputs, buttons
  md: 15,        // Slightly larger body
  lg: 16,        // Large inputs, important body
  xl: 18,        // Section headers, card titles
  '2xl': 20,     // Page titles
  '3xl': 24,     // Large headings
  '4xl': 28,     // Hero numbers, stat values
} as const

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const

// ── Spacing ─────────────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
} as const

// ── Border Radius ───────────────────────────────────────────────────────────
export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 16,
  full: 9999,
} as const

// ── Shadows ─────────────────────────────────────────────────────────────────
export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,.04)',
  card: '0 1px 3px rgba(0,0,0,.06)',
  dropdown: '0 4px 12px rgba(0,0,0,.08)',
  modal: '0 20px 40px rgba(0,0,0,.12)',
  pin: '0 2px 6px rgba(0,0,0,.3)',
} as const

// ── Common Style Patterns ───────────────────────────────────────────────────
// Use these as base styles and spread/override as needed.

export const cardStyle = {
  background: colors.bg.primary,
  border: `1px solid ${colors.border.default}`,
  borderRadius: radius['2xl'],
  padding: `${spacing['2xl']}px`,
} as const

export const inputStyle = {
  width: '100%',
  padding: `${spacing.md}px ${spacing.lg}px`,
  borderRadius: radius.lg,
  border: `1px solid ${colors.border.default}`,
  fontSize: fontSize.base,
  color: colors.text.primary,
  outline: 'none',
  fontFamily: fonts.body,
} as const

export const labelStyle = {
  fontSize: fontSize.base,
  fontWeight: fontWeight.bold,
  color: colors.text.primary,
  display: 'block' as const,
  marginBottom: spacing.sm,
  fontFamily: fonts.heading,
} as const

export const buttonPrimary = {
  padding: `${spacing.md}px ${spacing.xl}px`,
  borderRadius: radius.lg,
  border: 'none',
  background: colors.brand.pink,
  color: colors.text.inverse,
  fontSize: fontSize.base,
  fontWeight: fontWeight.bold,
  fontFamily: fonts.heading,
  cursor: 'pointer',
} as const

export const buttonSecondary = {
  padding: `${spacing.md}px ${spacing.xl}px`,
  borderRadius: radius.lg,
  border: `1px solid ${colors.border.default}`,
  background: colors.bg.primary,
  color: colors.text.primary,
  fontSize: fontSize.base,
  fontWeight: fontWeight.semibold,
  fontFamily: fonts.heading,
  cursor: 'pointer',
} as const

export const sectionHeader = {
  fontSize: fontSize.xl,
  fontWeight: fontWeight.extrabold,
  color: colors.text.primary,
  fontFamily: fonts.heading,
  letterSpacing: '-.02em',
} as const

export const tableHeader = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.bold,
  color: colors.text.tertiary,
  textTransform: 'uppercase' as const,
  letterSpacing: '.05em',
  padding: `${spacing.md}px ${spacing.lg}px`,
  background: colors.bg.secondary,
} as const

export const badge = (color: string) => ({
  fontSize: fontSize.xs,
  fontWeight: fontWeight.bold,
  padding: `2px ${spacing.sm}px`,
  borderRadius: radius.full,
  background: color + '15',
  color,
  textTransform: 'uppercase' as const,
  letterSpacing: '.04em',
  whiteSpace: 'nowrap' as const,
  display: 'inline-block' as const,
}) as const
