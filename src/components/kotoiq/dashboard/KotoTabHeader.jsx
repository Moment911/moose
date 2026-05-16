"use client"
// ─────────────────────────────────────────────────────────────────────────
// KotoTabHeader — universal page-header treatment for every KotoIQ tab.
//
// Centrally applied: KotoIQShell.jsx renders this once at the top of every
// tab's <main> content area. Metadata for each tab lives in kotoiqTabMeta.ts.
//
// Treatment (matches the Unified Marketing 2026 style guide + DESIGN.md):
//   - Pink uppercase Eyebrow (DM Sans 12px · .24em tracking · ◆ glyph)
//   - Bebas Neue page title (Bebas Neue 40px · navy · .02em)
//   - DM Serif Display italic accent word inside the title (pink)
//   - Optional one-line rationale (DM Sans 13px · muted)
//   - Optional right-aligned actions slot (passed by parent)
//
// Tabs not in KOTOIQ_TAB_META render nothing — those tabs own their own
// bespoke headers (AEO Visibility, Today, Feature Directory, etc.).
// ─────────────────────────────────────────────────────────────────────────

import { KOTOIQ_TAB_META } from './kotoiqTabMeta'

const DISPLAY = "'Bebas Neue', 'Arial Narrow', sans-serif"
const ACCENT  = "'DM Serif Display', Georgia, serif"
const BODY    = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

const INK   = '#201b51'
const MID   = '#6b6789'
const PINK  = '#cb1c6b'

export default function KotoTabHeader({ tabKey, rightSlot = null }) {
  const meta = KOTOIQ_TAB_META[tabKey]
  if (!meta) return null

  const { eyebrow, title, accent, rationale, icon: Icon } = meta

  return (
    <header
      style={{
        padding: '32px 32px 18px',
        background: 'transparent',
        fontFamily: BODY,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: PINK,
            textTransform: 'uppercase',
            letterSpacing: '.24em',
            fontFamily: BODY,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
          }}>
            {Icon ? <Icon size={13} color={PINK} strokeWidth={2.2} /> : <span style={{ fontSize: 10 }}>◆</span>}
            <span>{eyebrow}</span>
          </div>

          <h1 style={{
            fontFamily: DISPLAY,
            fontSize: 44,
            fontWeight: 400,
            color: INK,
            letterSpacing: '.02em',
            lineHeight: 1.02,
            margin: 0,
            display: 'inline',
          }}>
            {title}
            {accent && (
              <>
                {' '}
                <em style={{
                  fontFamily: ACCENT,
                  fontStyle: 'italic',
                  color: PINK,
                  fontWeight: 400,
                }}>
                  {accent}
                </em>
              </>
            )}
          </h1>

          {rationale && (
            <div style={{
              fontFamily: BODY,
              fontSize: 13.5,
              color: MID,
              maxWidth: 720,
              lineHeight: 1.55,
              marginTop: 14,
            }}>
              {rationale}
            </div>
          )}
        </div>

        {rightSlot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {rightSlot}
          </div>
        )}
      </div>

      {/* Hairline separator — establishes a clean handoff to the tab body */}
      <div style={{
        marginTop: 22,
        height: 1,
        background: 'rgba(32, 27, 81, .08)',
      }} />
    </header>
  )
}
