"use client"
import { R, BLK, FH, FB } from '../../lib/theme'

/**
 * ViewToggle — pill-style segmented control between Fleet and Client views.
 * Used at the page-header level of /kotoiq-wp. Active = navy pill with white
 * text; inactive = transparent with muted gray, hovers to pink.
 */
const NAVY = BLK  // theme BLK is the brand navy #201b51
const PINK = R    // theme R is the brand pink #cb1c6b

export default function ViewToggle({ value, onChange }) {
  return (
    <div role="tablist" style={{
      display: 'inline-flex', alignItems: 'center', gap: 0,
      background: '#ffffff', borderRadius: 999, padding: 3,
      border: '1px solid #e9e6dd',
    }}>
      {[
        { key: 'fleet',  label: 'Fleet'  },
        { key: 'client', label: 'Client' },
      ].map(opt => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = PINK }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#6b7280' }}
            style={{
              padding: '7px 18px',
              borderRadius: 999,
              border: 'none',
              background: active ? NAVY : 'transparent',
              color: active ? '#fff' : '#6b7280',
              fontFamily: FB,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              transition: 'background 0.12s ease, color 0.12s ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
