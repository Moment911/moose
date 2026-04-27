"use client"
import { T } from './tokens'

// Outline-pill variant of PrimaryCTA. Same shape and footprint, white fill,
// 1px border, ink label. Brand-marked variants (Apple/Google/email auth in
// reference IMG_2809) get a 20px glyph centered-left via the `icon` prop.
//
// Usage:
//   <SecondaryCTA onClick={...}>Skip</SecondaryCTA>
//   <SecondaryCTA icon={<AppleIcon size={20} />} onClick={...}>Continue with Apple</SecondaryCTA>

export default function SecondaryCTA({
  children,
  onClick,
  icon,
  disabled = false,
  type = 'button',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        minHeight: 58,
        padding: '0 24px',
        background: T.bg,
        color: disabled ? T.ink4 : T.ink,
        border: `1px solid ${disabled ? T.divider : T.border}`,
        borderRadius: T.rPill,
        fontFamily: T.font,
        fontSize: T.size.body,
        fontWeight: T.weight.button,
        letterSpacing: '0.1px',
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: T.s3,
      }}
    >
      {icon ? <span style={{ display: 'inline-flex' }}>{icon}</span> : null}
      <span>{children}</span>
    </button>
  )
}
