"use client"
import { useState } from 'react'
import { X, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { R, T, BLK } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — FoodPrefsWizard.
//
// Modal that renders Sonnet-generated food preference questions one at a time
// with a progress bar.  Collects answers and submits a FoodPrefsAnswer[] via
// onSubmit.  Four question types: single_select, multi_select, free_text,
// scale.  Back / Next nav; Submit on the last question.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#ececef'
const GRY5 = '#6b7280'
const GRY7 = '#374151'

export default function FoodPrefsWizard({ questions, onSubmit, onClose, submitting = false }) {
  const qs = Array.isArray(questions) ? questions : []
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})

  if (qs.length === 0) {
    return (
      <Modal onClose={onClose}>
        <div style={{ padding: 24, fontSize: 13, color: GRY7 }}>
          No questions returned. Close and retry.
        </div>
      </Modal>
    )
  }

  const q = qs[idx]
  const isLast = idx === qs.length - 1
  const value = answers[q.question_id]

  function setAnswer(v) {
    setAnswers((prev) => ({ ...prev, [q.question_id]: v }))
  }

  function isAnswered() {
    if (q.question_type === 'multi_select') return Array.isArray(value) && value.length > 0
    if (q.question_type === 'free_text') return typeof value === 'string' && value.trim().length > 0
    if (q.question_type === 'scale') return typeof value === 'number' && Number.isFinite(value)
    return value !== undefined && value !== null && value !== ''
  }

  function submit() {
    const payload = qs.map((qq) => ({
      question_id: qq.question_id,
      question_text: qq.question_text,
      question_type: qq.question_type,
      answer: answers[qq.question_id] ?? null,
    }))
    onSubmit?.(payload)
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: '18px 22px', borderBottom: `1px solid ${BRD}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Food preferences
          </div>
          <div style={{ fontSize: 13, color: GRY5, marginTop: 2 }}>
            Question {idx + 1} of {qs.length}
          </div>
        </div>
        <button
          onClick={onClose}
          type="button"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: GRY5, padding: 4 }}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ height: 4, background: BRD }}>
        <div
          style={{
            height: '100%',
            width: `${((idx + 1) / qs.length) * 100}%`,
            background: R,
            transition: 'width .2s',
          }}
        />
      </div>

      <div style={{ padding: 24 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, color: BLK, fontWeight: 800 }}>
          {q.question_text}
        </h3>
        {q.why_asked && (
          <p style={{ margin: '0 0 18px', color: GRY5, fontSize: 13, fontStyle: 'italic', lineHeight: 1.5 }}>
            {q.why_asked}
          </p>
        )}

        <QuestionInput q={q} value={value} onChange={setAnswer} />
      </div>

      <div style={{ padding: '14px 22px', borderTop: `1px solid ${BRD}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          style={btnSecondary(idx === 0)}
        >
          <ArrowLeft size={14} /> Back
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={submit}
            disabled={!isAnswered() || submitting}
            style={btnPrimary(!isAnswered() || submitting)}
          >
            {submitting ? <Loader2 size={14} /> : null}
            {submitting ? 'Submitting…' : 'Submit answers'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(qs.length - 1, i + 1))}
            disabled={!isAnswered()}
            style={btnPrimary(!isAnswered())}
          >
            Next <ArrowRight size={14} />
          </button>
        )}
      </div>
    </Modal>
  )
}

function QuestionInput({ q, value, onChange }) {
  if (q.question_type === 'single_select') {
    const opts = Array.isArray(q.options) ? q.options : []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {opts.map((opt) => {
          const active = String(value) === String(opt)
          return (
            <label
              key={opt}
              style={{
                padding: '10px 14px',
                border: `1px solid ${active ? R : BRD}`,
                borderRadius: 8,
                background: active ? R + '10' : '#fff',
                color: active ? R : GRY7,
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name={q.question_id}
                value={opt}
                checked={active}
                onChange={() => onChange(opt)}
                style={{ display: 'none' }}
              />
              {opt}
            </label>
          )
        })}
      </div>
    )
  }

  if (q.question_type === 'multi_select') {
    const opts = Array.isArray(q.options) ? q.options : []
    const selected = Array.isArray(value) ? value : []
    function toggle(opt) {
      const has = selected.includes(opt)
      onChange(has ? selected.filter((x) => x !== opt) : [...selected, opt])
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {opts.map((opt) => {
          const active = selected.includes(opt)
          return (
            <label
              key={opt}
              style={{
                padding: '10px 14px',
                border: `1px solid ${active ? R : BRD}`,
                borderRadius: 8,
                background: active ? R + '10' : '#fff',
                color: active ? R : GRY7,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggle(opt)}
                style={{ display: 'none' }}
              />
              {opt}
            </label>
          )
        })}
      </div>
    )
  }

  if (q.question_type === 'free_text') {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          minHeight: 100,
          padding: '10px 12px',
          fontSize: 14,
          border: `1px solid ${BRD}`,
          borderRadius: 8,
          background: '#fff',
          color: BLK,
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
        placeholder="Type your answer…"
      />
    )
  }

  if (q.question_type === 'scale') {
    const min = Number.isFinite(q.scale_min) ? q.scale_min : 1
    const max = Number.isFinite(q.scale_max) ? q.scale_max : 10
    const vals = []
    for (let n = min; n <= max; n++) vals.push(n)
    return (
      <div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {vals.map((n) => {
            const active = value === n
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                style={{
                  minWidth: 40,
                  padding: '10px 12px',
                  border: `1px solid ${active ? R : BRD}`,
                  borderRadius: 8,
                  background: active ? R : '#fff',
                  color: active ? '#fff' : GRY7,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: GRY5 }}>
          <span>{q.scale_min_label || min}</span>
          <span>{q.scale_max_label || max}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ color: GRY5, fontSize: 13 }}>
      Unsupported question type: {String(q.question_type)}
    </div>
  )
}

function Modal({ onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17, 17, 17, 0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: '#fff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 48px rgba(0,0,0,.22)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function btnPrimary(disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 16px',
    background: disabled ? '#d1d5db' : R,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function btnSecondary(disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 14px',
    background: '#fff',
    color: disabled ? '#9ca3af' : GRY7,
    border: `1px solid ${BRD}`,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
