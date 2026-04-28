"use client"
import { useState } from 'react'
import { MessageSquare, Loader2 } from 'lucide-react'
// Cal-AI tokens
const R = '#e9695c'
const T = '#5aa0ff'
const BLK = '#0a0a0a'
const GRY = '#f1f1f6'
const GRN = '#16a34a'
import { adjustPlanNL } from '../../lib/trainer/myPlanFetch'

// ─────────────────────────────────────────────────────────────────────────────
// NaturalAdjustBox — the "What's going on?" free-text plan modifier.
//
// Trainee types ANYTHING — injury, travel, schedule, mood, equipment change
// — picks a scope, and submits.  Server rewrites the 2-week block via the
// adjustNL Sonnet prompt and returns the new plan + a one-sentence coach
// note explaining what changed.
//
// Always visible on /my-plan Overview when a workout_plan exists.  Disabled
// (with explanation) if the plan hasn't been generated yet.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#ececef'

export default function NaturalAdjustBox({ disabled, onAfterAdjust }) {
  const [message, setMessage] = useState('')
  const [scope, setScope] = useState('rest_of_block')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)

  async function handleSubmit(e) {
    e?.preventDefault?.()
    if (!message.trim() || sending) return
    setSending(true)
    setError(null)
    setNote(null)
    try {
      const res = await adjustPlanNL({ message: message.trim(), scope })
      setNote(res.adherence_note || 'Plan adjusted.')
      setMessage('')
      onAfterAdjust?.()
    } catch (err) {
      setError(err?.message || 'Adjust failed.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section
      style={{
        background: '#fff',
        border: `1px solid ${BRD}`,
        borderLeft: `4px solid ${T}`,
        borderRadius: 12,
        padding: '18px 22px',
        marginBottom: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <MessageSquare size={15} color={T} />
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T, letterSpacing: '.05em', textTransform: 'uppercase' }}>
          What's going on?
        </h2>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
        Injury, travel, time crunch, equipment change — tell us and the plan adjusts.
        No typing template — say it however you'd tell a coach.
      </p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={disabled || sending}
          placeholder={EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]}
          rows={3}
          maxLength={1500}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 13,
            border: `1px solid #d1d5db`,
            borderRadius: 8,
            background: disabled ? '#f9fafb' : '#fff',
            color: '#0a0a0a',
            fontFamily: 'inherit',
            lineHeight: 1.55,
            resize: 'vertical',
          }}
        />

        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <ScopePill active={scope === 'rest_of_block'} onClick={() => setScope('rest_of_block')} label="Whole block" />
            <ScopePill active={scope === 'this_session'} onClick={() => setScope('this_session')} label="Just next session" />
            <ScopePill active={scope === 'swap_exercise'} onClick={() => setScope('swap_exercise')} label="Swap one exercise" />
          </div>
          <button
            type="submit"
            disabled={disabled || sending || message.trim().length === 0}
            style={{
              padding: '8px 16px',
              background: disabled || sending || message.trim().length === 0 ? '#9ca3af' : R,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              cursor: disabled || sending || message.trim().length === 0 ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {sending ? (
              <span
                style={{
                  display: 'inline-block',
                  width: 12, height: 12,
                  border: '2px solid #fff8',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'kotoAdjustSpin 0.8s linear infinite',
                }}
              />
            ) : <Loader2 size={12} opacity={0} />}
            {sending ? 'Adjusting…' : 'Adjust my plan'}
            <style>{'@keyframes kotoAdjustSpin{to{transform:rotate(360deg)}}'}</style>
          </button>
        </div>

        {scope === 'swap_exercise' && (
          <div style={{ marginTop: 8, fontSize: 11, color: GRY, fontStyle: 'italic' }}>
            Mention the exercise in your message (e.g., "swap barbell squat for something
            that doesn't need a bar"). The coach will pick the substitute.
          </div>
        )}
        {scope === 'this_session' && (
          <div style={{ marginTop: 8, fontSize: 11, color: GRY, fontStyle: 'italic' }}>
            Tell us which session (day number) in the message — or the coach picks the next one.
          </div>
        )}

        {note && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#f0fdf4', border: `1px solid #bbf7d0`, borderRadius: 8, fontSize: 13, color: '#065f46' }}>
            <strong style={{ color: GRN }}>Coach:</strong> {note}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#fee2e2', border: `1px solid #fca5a5`, borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
            {error}
          </div>
        )}

        {disabled && (
          <div style={{ marginTop: 10, fontSize: 11, color: GRY, fontStyle: 'italic' }}>
            Plan adjustments unlock once your workout block is generated.
          </div>
        )}
      </form>
    </section>
  )
}

function ScopePill({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        border: `1px solid ${active ? T : '#d1d5db'}`,
        borderRadius: 999,
        background: active ? T + '10' : '#fff',
        color: active ? T : '#374151',
        fontSize: 11,
        fontWeight: active ? 800 : 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

const EXAMPLES = [
  "Tweaked my shoulder yesterday — can't press overhead this week.",
  "Traveling next week, hotel gym only — dumbbells and a treadmill.",
  "Feeling strong today, want to push the main lift harder.",
  "Only 30 minutes for the next session — trim it down.",
  "Elbow is cranky — swap anything that loads it directly.",
  "Add more core work — feeling weak through the midsection.",
]
