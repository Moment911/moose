"use client"
import { Check } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// TrainerStatusStrip — horizontal stepper showing plan-chain progress.
//
// Steps: Baseline → Roadmap → Playbook → Workout → Food → Meals.
// Visual language: numbered circles, connecting progress line, step label
// below. Done = slate filled + check, in-progress = blue filled + pulse,
// pending = outlined neutral. Linear / Stripe / Vercel flavor.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'
const SLATE900 = '#0f172a'
const SLATE500 = '#64748b'
const SLATE400 = '#94a3b8'
const BLUE = '#2563eb'

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
      <style>{`@keyframes kotoPulse{0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.35)}50%{box-shadow:0 0 0 6px rgba(37,99,235,0)}}`}</style>
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
          borderRadius: 10,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 520 }}>
          {STEPS.map((s, i) => {
            const isDone = !!done[s.key]
            const isPending = pendingKey === s.key
            const prevDone = i > 0 && !!done[STEPS[i - 1].key]
            const circleBg = isDone ? SLATE900 : isPending ? BLUE : '#fff'
            const circleBorder = isDone ? SLATE900 : isPending ? BLUE : BRD
            const circleColor = isDone || isPending ? '#fff' : SLATE500
            const labelColor = isDone ? SLATE900 : isPending ? BLUE : SLATE400
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
                      fontSize: 11, fontWeight: 700, letterSpacing: '-.02em',
                      animation: isPending ? 'kotoPulse 1.6s ease-in-out infinite' : 'none',
                      transition: 'background .15s, border-color .15s',
                    }}
                  >
                    {isDone ? <Check size={13} strokeWidth={3} /> : i + 1}
                  </span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 600, color: labelColor,
                    letterSpacing: '.01em', whiteSpace: 'nowrap',
                  }}>
                    {s.label}
                  </span>
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    style={{
                      flex: 1, height: 1.5, margin: '0 8px',
                      background: isDone && prevDone ? SLATE900 : isDone ? SLATE900 : BRD,
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
          background: '#f8fafc',
          border: `1px solid ${BRD}`,
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          color: SLATE500,
          letterSpacing: '-.01em',
        }}>
          {doneCount}/{total} · {pct}%
        </span>
      </div>
    </>
  )
}
