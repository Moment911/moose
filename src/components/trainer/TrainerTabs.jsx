"use client"

// ─────────────────────────────────────────────────────────────────────────────
// TrainerTabs — page-level tab bar.
//
// Slate-based active state (no more accent pink), thicker underline
// indicator, gentle hover state. Matches Linear / Vercel navigation.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'
const SLATE400 = '#94a3b8'
const SLATE600 = '#475569'
const SLATE900 = '#0f172a'

export default function TrainerTabs({ tabs, activeKey, onChange }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 2,
        padding: '0 2px',
        borderBottom: `1px solid ${BRD}`,
        marginBottom: 20,
        overflowX: 'auto',
        scrollbarWidth: 'thin',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {tabs.map((t) => {
        const Icon = t.icon
        const active = activeKey === t.key
        const dotColor = t.done ? '#16a34a' : t.pending ? '#f59e0b' : null
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(t.key)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              marginBottom: -1,
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              color: active ? SLATE900 : SLATE600,
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${active ? SLATE900 : 'transparent'}`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              letterSpacing: '-.005em',
              flexShrink: 0,
              transition: 'color .12s, border-color .12s',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = SLATE900
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = SLATE600
            }}
          >
            {Icon && <Icon size={14} strokeWidth={active ? 2.25 : 2} />}
            {t.label}
            {dotColor && (
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: dotColor,
                  marginLeft: 2,
                }}
              />
            )}
            {typeof t.count === 'number' && t.count > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  padding: '1px 6px',
                  background: active ? SLATE900 : '#f1f5f9',
                  color: active ? '#fff' : SLATE400,
                  fontSize: 10.5,
                  fontWeight: 700,
                  borderRadius: 999,
                  letterSpacing: '-.01em',
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
