"use client"
// ─────────────────────────────────────────────────────────────────────────
// KotoTabHeader — universal page-header treatment for every KotoIQ tab.
//
// Uses CSS variables defined in globals.css so the Style Editor tab can
// tweak fonts/colors/spacing in realtime and every header re-renders
// without a code change.
// ─────────────────────────────────────────────────────────────────────────

import { KOTOIQ_TAB_META } from './kotoiqTabMeta'

export default function KotoTabHeader({ tabKey, rightSlot = null }) {
  const meta = KOTOIQ_TAB_META[tabKey]
  if (!meta) return null
  if (meta.selfHeader) return null  // bespoke header tabs opt out

  const { eyebrow, title, accent, rationale, icon: Icon } = meta

  return (
    <header
      style={{
        padding: 'var(--tabhead-pad-y, 32px) var(--tabhead-pad-x, 32px) var(--tabhead-pad-bottom, 18px)',
        background: 'transparent',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div style={{
            fontSize: 'var(--tabhead-eyebrow-size, 12px)',
            fontWeight: 600,
            color: 'var(--koto-pink, #cb1c6b)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tabhead-eyebrow-track, .24em)',
            fontFamily: 'var(--font-body)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
          }}>
            {Icon ? <Icon size={13} color="var(--koto-pink, #cb1c6b)" strokeWidth={2.2} /> : <span style={{ fontSize: 10 }}>◆</span>}
            <span>{eyebrow}</span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--tabhead-title-size, 44px)',
            fontWeight: 400,
            color: 'var(--text-primary)',
            letterSpacing: 'var(--tabhead-title-track, .02em)',
            lineHeight: 1.02,
            margin: 0,
            display: 'inline',
          }}>
            {title}
            {accent && (
              <>
                {' '}
                <em style={{
                  fontFamily: 'var(--font-accent, "DM Serif Display", Georgia, serif)',
                  fontStyle: 'italic',
                  color: 'var(--koto-pink, #cb1c6b)',
                  fontWeight: 400,
                }}>
                  {accent}
                </em>
              </>
            )}
          </h1>

          {rationale && (
            <div style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--tabhead-rationale-size, 13.5px)',
              color: 'var(--text-muted)',
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

      <div style={{
        marginTop: 22,
        height: 1,
        background: 'var(--tabhead-rule, rgba(32, 27, 81, .08))',
      }} />
    </header>
  )
}
