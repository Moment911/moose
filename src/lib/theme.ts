// ── Koto Design System — Single source of truth for all visual tokens ────────
// Import this instead of redeclaring R, T, BLK, etc. in every file.
//
// ═══════════════════════════════════════════════════════════════════════════════
// MASTER DESIGN CONTROLS — Change these to adjust the entire KotoIQ look & feel
// ═══════════════════════════════════════════════════════════════════════════════

export const DESIGN = {
  // ── Colors ──────────────────────────────────────────────────────────────────
  colors: {
    // Primary palette (Unified Marketing aesthetic)
    navy:        '#201B51',   // Primary dark — headings, navs, dark sections
    pink:        '#CB1C6B',   // Accent — CTAs, highlights, active states
    cream:       '#FAF9F6',   // Warm background — replaces cold gray
    warmGray:    '#F5F3EE',   // Card/section backgrounds
    mutedText:   '#4A4566',   // Body text — readable purple-gray

    // Semantic
    success:     '#16a34a',
    warning:     '#f59e0b',
    error:       '#DC2626',
    info:        '#5B8DEF',

    // Neutrals
    white:       '#ffffff',
    border:      '#E8E5DF',   // Warm border (not cold gray)
    borderLight: '#F0EDE8',
    textPrimary: '#201B51',   // Same as navy
    textSecondary: '#4A4566', // Darkened for readability (was #6B6789)
    textMuted:   '#7B778F',   // Labels/captions — darkened (was #9B97B2)
    iconBg:      '#F0EDE8',   // Icon container background
    hoverBg:     '#F5F3EE',   // Row/button hover
  },

  // ── Typography ──────────────────────────────────────────────────────────────
  fonts: {
    heading: "'Bebas Neue', sans-serif",           // Display headings
    body:    "'DM Sans', sans-serif",               // Body text, UI elements
    accent:  "'DM Serif Display', serif",           // Italic accents, callouts
    mono:    "'JetBrains Mono', monospace",          // Code, data
  },

  // Font sizes (px) — adjust to scale all type up or down
  fontSize: {
    xs:     12,
    sm:     14,
    base:   15,
    md:     16,
    lg:     18,
    xl:     20,
    '2xl':  24,
    '3xl':  30,
    '4xl':  38,
    '5xl':  48,
    hero:   64,
  },

  // Font weights
  fontWeight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
    black:    900,
  },

  // ── Spacing ─────────────────────────────────────────────────────────────────
  spacing: {
    xs:  4,
    sm:  8,
    md:  12,
    lg:  16,
    xl:  20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    '6xl': 64,
  },

  // ── Border Radius ───────────────────────────────────────────────────────────
  radius: {
    sm:    8,
    md:    12,
    lg:    16,
    xl:    20,
    pill:  50,    // Unified's pill buttons
    full:  9999,
  },

  // ── Shadows ─────────────────────────────────────────────────────────────────
  shadow: {
    sm:   '0 1px 3px rgba(32, 27, 81, 0.04)',
    md:   '0 4px 12px rgba(32, 27, 81, 0.06)',
    lg:   '0 8px 24px rgba(32, 27, 81, 0.08)',
    xl:   '0 12px 40px rgba(32, 27, 81, 0.12)',
  },

  // ── Transitions ─────────────────────────────────────────────────────────────
  transition: {
    fast:    '120ms ease',
    normal:  '200ms ease',
    smooth:  '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE EXPORTS — used by 180+ files across the app
// ═══════════════════════════════════════════════════════════════════════════════

// Brand colors (legacy aliases — KotoIQ pages should prefer DESIGN.colors.*)
export const R   = DESIGN.colors.pink    // Was '#E6007E' — now Unified pink
export const T   = '#00C2CB'             // Koto Teal — still used outside KotoIQ
export const BLK = DESIGN.colors.navy    // Was '#111111' — now Unified navy
export const GRY = DESIGN.colors.cream   // Was '#f9fafb' — now warm cream
export const GRN = DESIGN.colors.success
export const AMB = DESIGN.colors.warning
export const W   = DESIGN.colors.white

// Font stacks (legacy aliases)
// FH is used by 112+ files for buttons, labels, card titles — must stay readable
export const FH = DESIGN.fonts.body    // Was Proxima Nova — now DM Sans (readable at all sizes)
export const FB = DESIGN.fonts.body    // Body text
export const FD = DESIGN.fonts.heading // Display-only: Bebas Neue (use ONLY for large headings)

// ═══════════════════════════════════════════════════════════════════════════════
// KOTOIQ COMPONENT STYLES — Pre-built style objects for consistent UI
// ═══════════════════════════════════════════════════════════════════════════════

const D = DESIGN

// ── Cards ─────────────────────────────────────────────────────────────────────
export const cardStyle = {
  background: D.colors.white,
  borderRadius: D.radius.lg,
  border: `1px solid ${D.colors.border}`,
  padding: '20px 24px',
  marginBottom: D.spacing.lg,
} as const

// ── Labels ────────────────────────────────────────────────────────────────────
export const labelStyle = {
  fontSize: D.fontSize.xs,
  fontWeight: D.fontWeight.semibold,
  fontFamily: D.fonts.body,
  color: D.colors.textMuted,
  textTransform: 'uppercase' as const,
  letterSpacing: '.08em',
  marginBottom: 6,
  display: 'block',
} as const

// ── Inputs ────────────────────────────────────────────────────────────────────
export const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: D.radius.md,
  border: `1px solid ${D.colors.border}`,
  fontSize: D.fontSize.base,
  fontFamily: D.fonts.body,
  color: D.colors.textPrimary,
  background: D.colors.white,
  outline: 'none',
  transition: `border-color ${D.transition.fast}`,
} as const

// ── Card Titles ───────────────────────────────────────────────────────────────
export const cardTitleStyle = {
  fontSize: D.fontSize.lg,
  fontWeight: D.fontWeight.bold,
  fontFamily: D.fonts.body,
  color: D.colors.navy,
  marginBottom: D.spacing.lg,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
} as const

// ── Badges ────────────────────────────────────────────────────────────────────
export const badgeStyle = (color: string) => ({
  fontSize: D.fontSize.xs,
  fontWeight: D.fontWeight.semibold,
  padding: '3px 10px',
  borderRadius: D.radius.full,
  background: color + '12',
  color,
  textTransform: 'uppercase' as const,
  letterSpacing: '.06em',
  fontFamily: FB,
}) as const

// ── Buttons ───────────────────────────────────────────────────────────────────
export const buttonPrimary = {
  padding: '12px 28px',
  borderRadius: D.radius.pill,
  border: 'none',
  background: D.colors.pink,
  color: D.colors.cream,
  fontSize: D.fontSize.base,
  fontWeight: D.fontWeight.semibold,
  fontFamily: D.fonts.body,
  cursor: 'pointer',
  transition: `all ${D.transition.fast}`,
  letterSpacing: '0.01em',
} as const

export const buttonSecondary = {
  padding: '12px 28px',
  borderRadius: D.radius.pill,
  border: `2px solid ${D.colors.navy}`,
  background: 'transparent',
  color: D.colors.navy,
  fontSize: D.fontSize.base,
  fontWeight: D.fontWeight.semibold,
  fontFamily: D.fonts.body,
  cursor: 'pointer',
  transition: `all ${D.transition.fast}`,
} as const

// ── Pill Buttons (smaller, inline actions) ────────────────────────────────────
export const buttonPill = {
  padding: '8px 18px',
  borderRadius: D.radius.pill,
  border: `1px solid ${D.colors.border}`,
  background: D.colors.white,
  color: D.colors.navy,
  fontSize: D.fontSize.sm,
  fontWeight: D.fontWeight.semibold,
  fontFamily: D.fonts.body,
  cursor: 'pointer',
  transition: `all ${D.transition.fast}`,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
} as const

export const buttonDark = {
  padding: '12px 28px',
  borderRadius: D.radius.pill,
  border: 'none',
  background: D.colors.navy,
  color: D.colors.cream,
  fontSize: D.fontSize.base,
  fontWeight: D.fontWeight.semibold,
  fontFamily: D.fonts.body,
  cursor: 'pointer',
  transition: `all ${D.transition.fast}`,
} as const

// ── Destructive action token ──────────────────────────────────────────────────
export const DST = D.colors.error

// ── KotoIQ-specific style helpers ─────────────────────────────────────────────

/** Section header style for KotoIQ tab sections */
export const sectionHeaderStyle = {
  fontSize: D.fontSize.xl,
  fontWeight: D.fontWeight.bold,
  fontFamily: D.fonts.body,
  color: D.colors.navy,
  letterSpacing: '-0.3px',
  lineHeight: 1.2,
} as const

/** Sub-heading for card sections */
export const sectionSubStyle = {
  fontSize: D.fontSize.sm,
  fontWeight: D.fontWeight.medium,
  color: D.colors.textSecondary,
  marginTop: 4,
  lineHeight: 1.5,
} as const

/** Stat card background for KotoIQ dashboard metrics */
export const statBgStyle = {
  padding: '14px 18px',
  borderRadius: D.radius.md,
  background: D.colors.warmGray,
} as const

/** Tooltip container style */
export const tooltipStyle = {
  fontSize: D.fontSize.sm,
  fontWeight: D.fontWeight.medium,
  fontFamily: D.fonts.body,
  color: D.colors.white,
  background: D.colors.navy,
  padding: '8px 14px',
  borderRadius: D.radius.sm,
  maxWidth: 280,
  lineHeight: 1.45,
  boxShadow: D.shadow.lg,
} as const

/** Navigation item style (sidebar) */
export const navItemStyle = (active: boolean) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  borderRadius: D.radius.md,
  fontSize: D.fontSize.sm,
  fontWeight: active ? D.fontWeight.semibold : D.fontWeight.medium,
  fontFamily: D.fonts.body,
  color: active ? D.colors.pink : D.colors.textSecondary,
  background: active ? D.colors.pink + '10' : 'transparent',
  cursor: 'pointer',
  transition: `all ${D.transition.fast}`,
  border: 'none',
  width: '100%',
  textAlign: 'left' as const,
}) as const

/** Tab pill style (top navigation) */
export const tabPillStyle = (active: boolean) => ({
  padding: '8px 20px',
  borderRadius: D.radius.pill,
  fontSize: D.fontSize.sm,
  fontWeight: D.fontWeight.semibold,
  fontFamily: D.fonts.body,
  border: active ? `2px solid ${D.colors.pink}` : `1px solid ${D.colors.border}`,
  background: active ? D.colors.pink + '10' : D.colors.white,
  color: active ? D.colors.pink : D.colors.textSecondary,
  cursor: 'pointer',
  transition: `all ${D.transition.fast}`,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}) as const

// ── Chart palette ─────────────────────────────────────────────────────────────
export const KIQ_CHART = {
  green:   '#16a34a',
  blue:    '#5B8DEF',
  amber:   '#f59e0b',
  orange:  '#f97316',
  red:     '#e9695c',
  track:   D.colors.warmGray,
  empty:   D.colors.border,
  ink:     D.colors.navy,
  neutral: D.colors.textMuted,
} as const
