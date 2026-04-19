"use client"
import { R, AMB } from '../../../lib/theme'

/**
 * UI-SPEC §5.11 hotspot dot.
 *
 * A 6px (default) colored dot anchored next to a confidence-haloed editable
 * span on the briefing canvas. Indicates that one or more open clarifications
 * (kotoiq_clarifications rows with target_field_path === this field) need
 * operator attention.
 *
 * Severity → color (UI-SPEC §3 + §5.11):
 *   high   → R (Koto Pink)        + pulse animation
 *   medium → AMB (warning amber)  + static
 *   low    → #9ca3af (muted gray) + static
 *
 * Pulse respects prefers-reduced-motion (UI-SPEC §8). When count > 1, a small
 * superscript badge shows the number.
 *
 * Props:
 *   severity: 'low' | 'medium' | 'high'
 *   count?: number       // badge when > 1
 *   onClick(): void
 *   size?: number        // default 6px
 *   pulse?: boolean      // override default; default true for high severity
 */
export default function HotspotDot({ severity = 'low', count, onClick, size = 6, pulse }) {
  const color = severity === 'high' ? R : severity === 'medium' ? AMB : '#9ca3af'
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const shouldPulse = (pulse ?? (severity === 'high')) && !prefersReducedMotion

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${count || 1} open question${count && count > 1 ? 's' : ''} about this field.`}
      style={{
        all: 'unset',
        cursor: 'pointer',
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        background: color,
        animation: shouldPulse ? 'kotoHotspotPulse 1.5s ease-in-out infinite' : undefined,
      }}
    >
      {count && count > 1 ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -6,
            right: -10,
            fontSize: 9,
            fontWeight: 700,
            color,
            background: '#fff',
            borderRadius: 6,
            padding: '0 3px',
            border: `1px solid ${color}`,
            lineHeight: 1.2,
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}
