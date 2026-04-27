// Cal-AI-inspired design tokens for trainee-facing pages.
// Single source of truth for the aesthetic primitives in this folder
// (PageHeader, PrimaryCTA, SecondaryCTA, OptionListCard).
//
// Trainer-side / agency back-office pages keep their own theme.
// See _knowledge/design/reference-app-system.md for the full system.

export const T = {
  // colors
  ink:        '#0a0a0a',   // headlines, primary CTA fill, glyphs
  ink2:       '#1f1f22',   // body text on light bg
  ink3:       '#6b6b70',   // secondary / subtitle
  ink4:       '#a1a1a6',   // disabled / faded
  bg:         '#ffffff',
  card:       '#f1f1f6',   // workhorse inset surface — cool-gray, slight lavender
  cardElev:   '#ffffff',   // elevated tile on top of `card`
  iconChip:   '#ffffff',   // round white icon backing inside option rows
  border:     '#ececef',
  divider:    '#e5e5ea',

  // accents — used sparingly
  accent:     '#d89a6a',   // warm tan — InlineHighlight, "ready" pill
  accentRed:  '#e9695c',
  accentBlue: '#5aa0ff',
  star:       '#f0b400',
  disabled:   '#c8c8cc',

  // font + weights
  font:       "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
  weight: {
    display: 800,   // page headlines
    h1:      700,
    body:    500,   // medium, NOT regular — heaviness is half the look
    caption: 400,
    button:  600,
  },

  // type scale — size / line-height / tracking
  // Use these directly: `style={{ fontSize: T.size.display, lineHeight: T.lh.display, letterSpacing: T.track.display }}`
  size: {
    display:  34,
    h1:       28,
    h2:       20,
    body:     17,
    subtitle: 15,
    caption:  13,
    giant:    64,   // marketing-only big numbers
  },
  lh: {
    display:  1.10,
    h1:       1.15,
    h2:       1.20,
    body:     1.40,
    subtitle: 1.40,
    caption:  1.30,
    giant:    1.00,
  },
  track: {
    display:  '-0.6px',
    h1:       '-0.4px',
    h2:       '-0.2px',
    body:     '0px',
    subtitle: '0px',
    caption:  '0.1px',
    giant:    '-1.5px',
  },

  // radii
  rXs:   8,
  rSm:   12,
  rMd:   16,
  rLg:   22,
  rXl:   28,
  rPill: 999,

  // spacing (4px grid)
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s7: 32,
  s8: 48,

  // elevation
  shadowFloater: '0 6px 16px rgba(0,0,0,0.06)',
  shadowModal:   '0 20px 60px rgba(0,0,0,0.18)',
}
