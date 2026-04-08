"use client";
// MobilePage — standard mobile page wrapper used by all pages on mobile.
// Usage: wrap the mobile JSX in <MobilePage title="Reviews"> ... </MobilePage>
// It provides: scroll container, safe padding, consistent background.
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const BG  = '#F9F9F9'
const FH  = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB  = "'Raleway','Helvetica Neue',sans-serif"
const R   = '#E6007E'

export { MobilePage }
export default function MobilePage({ children, background = BG, padded = true }) {
  return (
    <div style={{
      background,
      minHeight: '100%',
      fontFamily: FB,
      paddingBottom: 16,
    }}>
      {padded
        ? <div style={{ padding: '0 16px' }}>{children}</div>
        : children
      }
    </div>
  )
}

// Reusable mobile section header (dark, matches app chrome)
export function MobilePageHeader({ title, subtitle, action }) {
  return (
    <div style={{
      background: '#ffffff',
      padding: '16px 16px 14px',
      marginBottom: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <h1 style={{
            fontFamily: FH, fontSize: 22, fontWeight: 800,
            color: '#111111', margin: 0, letterSpacing: '-.03em',
          }}>{title}</h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', margin: '3px 0 0', fontFamily: FB }}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
    </div>
  )
}

// Stat strip for mobile headers (2 or 4 stats in a row)
export function MobileStatStrip({ stats }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`,
      background: '#fff',
      borderBottom: '1px solid #ececea',
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          padding: '12px 14px',
          borderRight: i < stats.length - 1 ? '1px solid #ececea' : 'none',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: FH, fontSize: 20, fontWeight: 800,
            color: s.color || '#0a0a0a', letterSpacing: '-.03em', lineHeight: 1,
          }}>{s.value}</div>
          <div style={{ fontSize: 11, color: '#9a9a96', fontFamily: FH, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}

// Scrollable horizontal tab bar
export function MobileTabs({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', overflowX: 'auto', background: '#fff',
      borderBottom: '1px solid #ececea',
      scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      {tabs.map(t => {
        const isActive = active === t.key
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            style={{
              flexShrink: 0, padding: '0 18px', height: 44,
              border: 'none', borderBottom: `2.5px solid ${isActive ? R : 'transparent'}`,
              background: 'transparent',
              color: isActive ? R : '#9a9a96',
              fontSize: 14, fontWeight: isActive ? 700 : 500,
              cursor: 'pointer', fontFamily: FH,
              display: 'flex', alignItems: 'center', gap: 6,
              whiteSpace: 'nowrap',
            }}>
            {t.label}
            {t.count != null && (
              <span style={{
                fontSize: 11, fontWeight: 800,
                background: isActive ? R + '20' : '#F9F9F9',
                color: isActive ? R : '#9a9a96',
                padding: '1px 6px', borderRadius: 20,
                fontFamily: FH,
              }}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Card row for list items
export function MobileRow({ left, title, subtitle, right, badge, onClick, borderBottom = true }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 16px', background: '#fff',
      borderBottom: borderBottom ? '1px solid #f2f2f0' : 'none',
      cursor: onClick ? 'pointer' : 'default',
      WebkitTapHighlightColor: 'transparent',
      transition: 'background .1s',
    }}
      onMouseDown={e => onClick && (e.currentTarget.style.background = '#f8f8f6')}
      onMouseUp={e => e.currentTarget.style.background = '#fff'}
      onTouchStart={e => onClick && (e.currentTarget.style.background = '#f8f8f6')}
      onTouchEnd={e => e.currentTarget.style.background = '#fff'}>
      {left}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, color: '#0a0a0a',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 13, color: '#9a9a96', fontFamily: 'inherit',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            {subtitle}
          </div>
        )}
      </div>
      {badge}
      {onClick && <ChevronRight size={16} color="#d0d0cc" style={{ flexShrink: 0 }}/>}
    </div>
  )
}

// Section header inside content
export function MobileSectionHeader({ title, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 16px 8px',
    }}>
      <span style={{ fontFamily: FH, fontSize: 13, fontWeight: 700,
        color: '#9a9a96', textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {title}
      </span>
      {action}
    </div>
  )
}

// Card wrapper
export function MobileCard({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid #ececea', overflow: 'hidden',
      marginBottom: 12, ...style,
    }}>
      {children}
    </div>
  )
}

// Empty state
export function MobileEmpty({ icon: Icon, title, body, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
    }}>
      {Icon && (
        <div style={{ width: 56, height: 56, borderRadius: 16,
          background: '#F9F9F9', border: '1px solid #ececea',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16 }}>
          <Icon size={24} color="#d0d0cc"/>
        </div>
      )}
      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800,
        color: '#0a0a0a', marginBottom: 6, letterSpacing: '-.02em' }}>{title}</div>
      <div style={{ fontSize: 14, color: '#9a9a96', lineHeight: 1.6,
        maxWidth: 280, marginBottom: action ? 20 : 0 }}>{body}</div>
      {action}
    </div>
  )
}

// Search bar
export function MobileSearch({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: '#fff', border: '1px solid #ececea', borderRadius: 12,
      padding: '0 14px', margin: '12px 16px',
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="#9a9a96" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16,
          color: '#0a0a0a', background: 'transparent', padding: '11px 0',
          fontFamily: "'Raleway','Helvetica Neue',sans-serif" }}/>
      {value && (
        <button onClick={() => onChange('')}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: '#9a9a96', padding: 0, lineHeight: 1 }}>✕</button>
      )}
    </div>
  )
}

// Bottom action bar (fixed above tab bar)
export function MobileActionBar({ children }) {
  return (
    <div style={{
      position: 'sticky', bottom: 0,
      background: '#fff', borderTop: '1px solid #ececea',
      padding: '12px 16px',
      display: 'flex', gap: 10,
    }}>
      {children}
    </div>
  )
}

// Primary mobile button
export function MobileButton({ label, icon: Icon, onPress, secondary, disabled }) {
  const R   = '#E6007E'
  return (
    <button onClick={onPress} disabled={disabled}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 7, padding: '13px', borderRadius: 12, border: 'none',
        background: secondary ? '#F9F9F9' : R,
        color: secondary ? '#0a0a0a' : '#fff',
        fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif",
        opacity: disabled ? 0.6 : 1,
        WebkitTapHighlightColor: 'transparent',
      }}>
      {Icon && <Icon size={16}/>}
      {label}
    </button>
  )
}
