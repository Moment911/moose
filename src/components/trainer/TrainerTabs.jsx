"use client"
import { R, BLK } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — TrainerTabs.
//
// Page-level tab bar shared by TrainerDetailPage.  Mirrors the visual language
// of PlaybookCard's internal tabs so nested tabs (Playbook's 8 tabs inside the
// Playbook top-level tab) don't clash.  Horizontal scroll on mobile.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'
const GRY5 = '#6b7280'
const GRY7 = '#374151'

export default function TrainerTabs({ tabs, activeKey, onChange }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 2,
        padding: '0 4px',
        borderBottom: `1px solid ${BRD}`,
        marginBottom: 22,
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
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: active ? 800 : 600,
              color: active ? R : GRY7,
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${active ? R : 'transparent'}`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              letterSpacing: active ? '.01em' : 0,
              flexShrink: 0,
              transition: 'color .12s, border-color .12s',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = BLK
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = GRY7
            }}
          >
            {Icon && <Icon size={14} />}
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
                  padding: '1px 7px',
                  background: active ? R : '#e5e7eb',
                  color: active ? '#fff' : GRY5,
                  fontSize: 10,
                  fontWeight: 800,
                  borderRadius: 20,
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
