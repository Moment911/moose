"use client"
import { T_INK, T_INK_DIM, T_SURFACE, T_SHADOW_SM } from '../../../lib/trainer/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Segmented — Apple-style segmented control.
//   <Segmented
//     value={tab}
//     onChange={setTab}
//     options={[{ value: 'overview', label: 'Overview' }, ...]}
//   />
// ─────────────────────────────────────────────────────────────────────────────

export default function Segmented({ value, onChange, options, size = 'md', full = false }) {
  const pad = size === 'sm' ? '6px 12px' : '8px 14px'
  const fs = size === 'sm' ? 12 : 13

  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        padding: 3,
        gap: 2,
        borderRadius: 10,
        background: 'rgba(17, 17, 17, 0.06)',
        width: full ? '100%' : undefined,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(opt.value)}
            className="t-press"
            style={{
              flex: full ? 1 : undefined,
              padding: pad,
              border: 'none',
              borderRadius: 8,
              background: active ? T_SURFACE : 'transparent',
              color: active ? T_INK : T_INK_DIM,
              fontSize: fs,
              fontWeight: active ? 600 : 500,
              letterSpacing: '-0.005em',
              cursor: 'pointer',
              boxShadow: active ? T_SHADOW_SM : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {opt.icon ? <opt.icon size={fs + 1} /> : null}
            {opt.label}
            {opt.badge != null ? (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                background: active ? 'rgba(17,17,17,0.08)' : 'rgba(17,17,17,0.12)',
                color: T_INK,
              }}>
                {opt.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
