"use client"
import { Check } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// TrainerStatusStrip — Cal-AI aesthetic: clean white strip, ink circles.
// Steps: Baseline → Roadmap → Playbook → Workout → Food → Meals.
// ─────────────────────────────────────────────────────────────────────────────

const INK   = '#0a0a0a'
const INK3  = '#6b6b70'
const INK4  = '#a1a1a6'
const BRD   = '#ececef'
const CARD  = '#f1f1f6'
const BLUE  = '#5aa0ff'

const STEPS = [
  { key: 'baseline', label: 'Baseline' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'playbook', label: 'Playbook' },
  { key: 'workout', label: 'Workout' },
  { key: 'food_prefs', label: 'Food' },
  { key: 'meals', label: 'Meals' },
]

export default function TrainerStatusStrip({ done = {}, pendingKey = null }) {
  const doneCount = STEPS.filter((s) => done[s.key]).length
  const total = STEPS.length
  const pct = Math.round((doneCount / total) * 100)

  return (
    <>
      <style>{`@keyframes kotoPulse{0%,100%{box-shadow:0 0 0 0 rgba(90,160,255,.35)}50%{box-shadow:0 0 0 6px rgba(90,160,255,0)}}`}</style>
      <div
        role="status"
        aria-label="Plan progress"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 16px',
          background: '#fff',
          border: `1px solid ${BRD}`,
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 520 }}>
          {STEPS.map((s, i) => {
            const isDone = !!done[s.key]
            const isPending = pendingKey === s.key
            const circleBg = isDone ? INK : isPending ? BLUE : '#fff'
            const circleBorder = isDone ? INK : isPending ? BLUE : BRD
            const circleColor = isDone || isPending ? '#fff' : INK3
            const labelColor = isDone ? INK : isPending ? BLUE : INK4
            return (
              <span key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i === STEPS.length - 1 ? '0 0 auto' : '1 1 0' }}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: circleBg,
                      border: `1.5px solid ${circleBorder}`,
                      color: circleColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      animation: isPending ? 'kotoPulse 1.6s ease-in-out infinite' : 'none',
                      transition: 'background .15s, border-color .15s',
                    }}
                  >
                    {isDone ? <Check size={13} strokeWidth={3} /> : i + 1}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: labelColor,
                    whiteSpace: 'nowrap',
                  }}>
                    {s.label}
                  </span>
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    style={{
                      flex: 1, height: 1.5, margin: '0 8px',
                      background: isDone ? INK : BRD,
                      transition: 'background .15s',
                      alignSelf: 'flex-start',
                      marginTop: 13,
                    }}
                  />
                )}
              </span>
            )
          })}
        </div>
        <span style={{
          flexShrink: 0,
          padding: '4px 10px',
          background: CARD,
          border: `1px solid ${BRD}`,
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          color: INK3,
        }}>
          {doneCount}/{total} · {pct}%
        </span>
      </div>
    </>
  )
}
