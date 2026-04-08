"use client"

const STYLES = {
  primary:  { background: '#111111', color: '#FFFFFF', border: 'none' },
  ghost:    { background: 'transparent', color: '#555555', border: '1px solid rgba(0,0,0,0.14)' },
  red:      { background: '#E6007E', color: '#FFFFFF', border: 'none' },
  cyan:     { background: '#00C2CB', color: '#FFFFFF', border: 'none' },
  danger:   { background: '#FFF0F7', color: '#B5005B', border: '1px solid rgba(230,0,126,0.15)' },
}

export default function Button({ children, variant = 'primary', small, disabled, onClick, style: sx }) {
  const s = STYLES[variant] || STYLES.primary
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: small ? '5px 12px' : '8px 16px',
      borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: small ? 12 : 13, fontWeight: 500,
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      opacity: disabled ? 0.5 : 1,
      transition: 'opacity 0.15s',
      ...s, ...sx,
    }}>
      {children}
    </button>
  )
}
