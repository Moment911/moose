"use client"

// ─────────────────────────────────────────────────────────────────────────────
// TrainerTabs — Cal-AI aesthetic: clean underline tabs, #0a0a0a ink active.
// ─────────────────────────────────────────────────────────────────────────────

const INK   = '#0a0a0a'
const INK3  = '#6b6b70'
const INK4  = '#a1a1a6'
const BRD   = '#ececef'
const CARD  = '#f1f1f6'

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
        const dotColor = t.done ? '#16a34a' : t.pending ? '#f0b400' : null
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
              padding: '12px 18px',
              marginBottom: -1,
              fontSize: 15,
              fontWeight: active ? 600 : 500,
              color: active ? INK : INK3,
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${active ? INK : 'transparent'}`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              letterSpacing: '0px',
              flexShrink: 0,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
              transition: 'color .12s, border-color .12s',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = INK
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = INK3
            }}
          >
            {Icon && <Icon size={16} strokeWidth={active ? 2.25 : 2} />}
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
                  background: active ? INK : CARD,
                  color: active ? '#fff' : INK4,
                  fontSize: 10.5,
                  fontWeight: 600,
                  borderRadius: 999,
                  letterSpacing: '0px',
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
