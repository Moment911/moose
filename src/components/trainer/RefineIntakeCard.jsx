"use client"
import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { T, BLK, GRY, GRN, R } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// RefineIntakeCard — AI-driven intake deepening.
//
// Flow:
//   1. Trainer clicks "Generate follow-up questions" → POST refine_elicit.
//   2. Sonnet returns 4-6 questions tailored to THIS trainee (sport, goal,
//      constraints).  UI renders each with the right input widget:
//        - short_text → <input type="text">
//        - number     → <input type="number"> with placeholder unit
//        - select     → <select> with provided options
//   3. Trainer fills in answers → Save → POST refine_submit.
//   4. Server appends "— Additional context (refined with AI) —" block to
//      about_you.  Every downstream Sonnet prompt reads about_you, so the
//      new context feeds baseline, roadmap, workout, meals, etc. for free.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'

export default function RefineIntakeCard({
  traineeId,
  traineeAboutYou,
  onElicit,
  onSubmit,
  onAfterSubmit,
}) {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [phase, setPhase] = useState('idle') // 'idle' | 'eliciting' | 'answering' | 'submitting'
  const [error, setError] = useState(null)
  const [lastSavedCount, setLastSavedCount] = useState(0)

  const hasPreviousRefine = traineeAboutYou?.includes('— Additional context (refined with AI) —')

  async function handleElicit() {
    setError(null)
    setPhase('eliciting')
    try {
      const res = await onElicit?.()
      if (!res?.questions || res.questions.length === 0) {
        setError('No follow-up questions returned. If this keeps happening, check the server logs — the Sonnet call may have failed.')
        setPhase('idle')
        return
      }
      setQuestions(res.questions)
      setAnswers({})
      setPhase('answering')
    } catch (e) {
      // Surface the exact server error — usually a Sonnet HTTP code or
      // anthropic_http_XXX message from sonnetRunner.  Makes prod failures
      // diagnosable from the UI instead of a generic spinner-forever state.
      const msg = e?.message || String(e) || 'Network error'
      // eslint-disable-next-line no-console
      console.error('[trainer] refine elicit failed:', e)
      setError(`Refine failed: ${msg}`)
      setPhase('idle')
    }
  }

  async function handleSubmit() {
    setError(null)
    const filled = questions
      .map((q) => ({
        question_id: q.question_id,
        question_text: q.question_text,
        answer: (answers[q.question_id] || '').toString().trim(),
      }))
      .filter((a) => a.answer.length > 0)

    if (filled.length === 0) {
      setError('Answer at least one question before saving.')
      return
    }

    setPhase('submitting')
    try {
      const ok = await onSubmit?.(filled)
      if (!ok) {
        setError('Save failed. Retry or check the toast.')
        setPhase('answering')
        return
      }
      setLastSavedCount(filled.length)
      setQuestions([])
      setAnswers({})
      setPhase('idle')
      onAfterSubmit?.()
    } catch (e) {
      setError(e?.message || 'Save failed.')
      setPhase('answering')
    }
  }

  function setAnswer(qid, value) {
    setAnswers((prev) => ({ ...prev, [qid]: value }))
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
        <Sparkles size={16} color={T} />
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T, letterSpacing: '.05em', textTransform: 'uppercase' }}>
          Refine this plan with AI
        </h2>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
        Sonnet reads the intake and asks 4–6 follow-up questions specific to this
        athlete — sport, goal, constraints. Answers merge into "About this athlete"
        and feed every downstream step.
      </p>

      {lastSavedCount > 0 && phase === 'idle' && (
        <div style={{ marginBottom: 12, fontSize: 12, color: GRN, fontWeight: 700 }}>
          ✓ Saved {lastSavedCount} new answer{lastSavedCount === 1 ? '' : 's'} into the intake.
        </div>
      )}

      {phase === 'idle' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleElicit}
            disabled={!traineeId}
            style={btnPrimary(false)}
          >
            <Sparkles size={13} />
            {hasPreviousRefine ? 'Run refine again' : 'Generate follow-up questions'}
          </button>
          {hasPreviousRefine && (
            <span style={{ fontSize: 11, color: GRY }}>
              Already refined. Running again will append another set of answers.
            </span>
          )}
        </div>
      )}

      {phase === 'eliciting' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: GRY, fontSize: 13 }}>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: `2px solid ${BRD}`,
              borderTopColor: T,
              borderRadius: '50%',
              animation: 'kotoRefineSpin 0.8s linear infinite',
            }}
          />
          <span>Sonnet is reading the intake and drafting follow-up questions (15–30s)…</span>
          <style>{'@keyframes kotoRefineSpin{to{transform:rotate(360deg)}}'}</style>
        </div>
      )}

      {phase === 'answering' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {questions.map((q, i) => (
            <RefineQuestionField
              key={q.question_id || i}
              q={q}
              value={answers[q.question_id] || ''}
              onChange={(v) => setAnswer(q.question_id, v)}
            />
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#991b1b' }}>{error}</div>
      )}

      {(phase === 'answering' || phase === 'submitting') && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={() => { setQuestions([]); setAnswers({}); setPhase('idle') }}
            disabled={phase === 'submitting'}
            style={btnSecondary(phase === 'submitting')}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={phase === 'submitting'}
            style={btnPrimary(phase === 'submitting')}
          >
            {phase === 'submitting' ? <Loader2 size={13} /> : null}
            {phase === 'submitting' ? 'Saving…' : 'Save refinements'}
          </button>
        </div>
      )}
    </section>
  )
}

function RefineQuestionField({ q, value, onChange }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 4 }}>
        {q.question_text}
      </label>
      {q.why_asked && (
        <div style={{ fontSize: 11, color: GRY, marginBottom: 6, fontStyle: 'italic' }}>
          {q.why_asked}
        </div>
      )}
      {q.question_type === 'select' && Array.isArray(q.options) ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {q.options.map((opt) => {
            const active = String(value) === String(opt)
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                style={{
                  padding: '6px 12px',
                  border: `1px solid ${active ? R : '#d1d5db'}`,
                  borderRadius: 999,
                  background: active ? R + '10' : '#fff',
                  color: active ? R : '#374151',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {opt}
              </button>
            )
          })}
        </div>
      ) : q.question_type === 'number' ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder || ''}
          style={inputStyle}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder || ''}
          style={inputStyle}
        />
      )}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 13,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  color: '#0a0a0a',
  fontFamily: 'inherit',
}

function btnPrimary(disabled) {
  return {
    padding: '8px 14px',
    background: disabled ? '#9ca3af' : T,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: disabled ? 'default' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  }
}

function btnSecondary(disabled) {
  return {
    padding: '8px 14px',
    background: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
  }
}
