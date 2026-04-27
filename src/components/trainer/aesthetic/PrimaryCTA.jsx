"use client"
import { Loader2 } from 'lucide-react'
import { T } from './tokens'

// Cal-AI signature CTA: full-width black pill, pinned to bottom safe area.
// 24px h-margin, 56-60px tall, white label in weight 600. Disabled state
// swaps fill to T.disabled — same shape, same position. The CTA never moves.
//
// Use `pinned` (default) for onboarding/quiz screens that have one decision.
// Use `inline` for in-flow buttons (less common in this design language).
//
// Usage:
//   <PrimaryCTA onClick={...}>Continue</PrimaryCTA>
//   <PrimaryCTA disabled>Continue</PrimaryCTA>
//   <PrimaryCTA loading>Saving…</PrimaryCTA>
//   <PrimaryCTA inline onClick={...}>Generate plan</PrimaryCTA>

export default function PrimaryCTA({
  children,
  onClick,
  disabled = false,
  loading = false,
  pinned = true,
  type = 'button',
}) {
  const isDisabled = disabled || loading
  const button = (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{
        width: '100%',
        minHeight: 58,
        padding: '0 24px',
        background: isDisabled ? T.disabled : T.ink,
        color: '#ffffff',
        border: 'none',
        borderRadius: T.rPill,
        fontFamily: T.font,
        fontSize: T.size.body,
        fontWeight: T.weight.button,
        letterSpacing: '0.1px',
        cursor: isDisabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: T.s2,
        transition: 'background .15s ease, transform .08s ease',
      }}
    >
      {loading && <Loader2 size={18} style={{ animation: 'caCtaSpin 1s linear infinite' }} />}
      <span>{children}</span>
      <style>{`@keyframes caCtaSpin { to { transform: rotate(360deg) } }`}</style>
    </button>
  )

  if (!pinned) return button

  // Pinned variant: sits at bottom of viewport with safe-area padding so iOS
  // gesture bar doesn't crash into it. Translucent white scrim on top edge so
  // scrolling content fades behind it cleanly.
  return (
    <div style={{
      position: 'sticky',
      bottom: 0,
      paddingTop: T.s4,
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
      background: 'linear-gradient(to top, #ffffff 70%, rgba(255,255,255,0))',
      pointerEvents: 'none',
    }}>
      <div style={{ pointerEvents: 'auto' }}>{button}</div>
    </div>
  )
}
