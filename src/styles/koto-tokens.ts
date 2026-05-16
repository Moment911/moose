// ── Koto Design Tokens (Unified Marketing brand) ───────────────────────────
// Per DESIGN.md 2026-05-16. Replaces the legacy Instrument Serif + warm linen
// palette over time. New code imports from here; legacy code still uses
// design-tokens.ts during migration.

export const t = {
  // Colors
  navy:        '#201b51',
  navyDeep:    '#15113a',
  pink:        '#cb1c6b',
  pinkDeep:    '#a8155a',
  pinkSoft:    'rgba(203, 28, 107, .08)',
  pinkFaint:   'rgba(203, 28, 107, .04)',
  warm:        '#faf9f6',
  off:         '#f5f3ee',
  white:       '#ffffff',
  hover:       '#f0ece8',
  text:        '#201b51',
  textStrong:  '#15113a',
  muted:       '#6b6789',
  faint:       '#9d9ab3',
  line:        'rgba(32, 27, 81, .12)',
  lineStrong:  'rgba(32, 27, 81, .22)',
  lineSubtle:  'rgba(32, 27, 81, .06)',
  success:     '#0d9e6e',
  successBg:   'rgba(13, 158, 110, .08)',
  successLine: 'rgba(13, 158, 110, .25)',
  warning:     '#d97706',
  warningBg:   'rgba(217, 119, 6, .08)',
  warningLine: 'rgba(217, 119, 6, .25)',
  danger:      '#dc2626',
  dangerBg:    'rgba(220, 38, 38, .08)',
  dangerLine:  'rgba(220, 38, 38, .25)',
  info:        '#2563eb',
  infoBg:      'rgba(37, 99, 235, .08)',
  infoLine:    'rgba(37, 99, 235, .25)',

  // Fonts
  fontDisplay: "'Bebas Neue', 'Arial Narrow', sans-serif",
  fontAccent:  "'DM Serif Display', Georgia, serif",
  fontBody:    "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  fontMono:    "'JetBrains Mono', 'SF Mono', Menlo, monospace",

  // Radii
  rInput:  8,
  rTile:   12,
  rCard:   16,
  rPanel:  20,
  rPill:   9999,

  // Shadows
  sHair:     '0 1px 2px rgba(32, 27, 81, .04)',
  sCard:     '0 4px 24px rgba(32, 27, 81, .05)',
  sCardLg:   '0 8px 40px rgba(32, 27, 81, .06)',
  sDropdown: '0 12px 32px rgba(32, 27, 81, .10)',
  sModal:    '0 24px 56px rgba(32, 27, 81, .14)',
  sCta:      '0 4px 20px rgba(203, 28, 107, .25)',
  sCtaHov:   '0 8px 28px rgba(203, 28, 107, .40)',
} as const

export type KotoToken = keyof typeof t
