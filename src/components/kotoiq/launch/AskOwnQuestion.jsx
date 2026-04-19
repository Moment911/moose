"use client"
import { useState } from 'react'
import { T, BLK, FH, FB } from '../../../lib/theme'

/**
 * UI-SPEC §4.1 tertiary CTA — D-12 operator-authored question.
 *
 * Renders a ghost button that expands into a compact composer for adding a
 * clarification to the queue. The composer ships question + optional target
 * field path + severity. The new row appears in:
 *   - the briefing-canvas hotspot (if target_field_path is set)
 *   - the chat orb badge / panel
 *   - the Pipeline > Needs Clarity dashboard
 * via the realtime + 20s poll wired by ClarificationsOverlay + LaunchPage.
 *
 * Props:
 *   onAdd({ question, target_field_path?, severity })
 */
export default function AskOwnQuestion({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [targetField, setTargetField] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async () => {
    if (!question.trim()) return
    setPending(true)
    try {
      await onAdd?.({
        question: question.trim(),
        target_field_path: targetField.trim() || null,
        severity,
      })
      setQuestion('')
      setTargetField('')
      setSeverity('medium')
      setOpen(false)
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          fontFamily: FH,
          fontSize: 13,
          fontWeight: 700,
          color: T,
          padding: '8px 0',
        }}
      >
        + Ask your own question
      </button>
    )
  }

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        border: '1px solid #e5e7eb',
        maxWidth: 480,
        margin: '12px 0',
        fontFamily: FB,
        color: BLK,
        background: '#fff',
      }}
    >
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Your question — e.g. 'What's the winter discount structure?'"
        rows={2}
        maxLength={2000}
        aria-label="Clarification question"
        style={{
          width: '100%',
          padding: 10,
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          fontSize: 13,
          fontFamily: FB,
          resize: 'vertical',
          marginBottom: 8,
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          value={targetField}
          onChange={(e) => setTargetField(e.target.value)}
          placeholder="Target field (optional)"
          aria-label="Target field name"
          style={{
            flex: 1,
            height: 32,
            padding: '0 10px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            fontSize: 12,
            fontFamily: FB,
            boxSizing: 'border-box',
          }}
        />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          aria-label="Severity"
          style={{
            height: 32,
            padding: '0 10px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            fontSize: 12,
            fontFamily: FB,
            background: '#fff',
          }}
        >
          <option value="low">Nice to have</option>
          <option value="medium">Would help</option>
          <option value="high">Blocker</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => { setOpen(false); setQuestion('') }}
          disabled={pending}
          style={{ all: 'unset', cursor: pending ? 'wait' : 'pointer', color: '#6b7280', fontSize: 12, padding: '6px 10px' }}
        >Cancel</button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !question.trim()}
          style={{
            height: 30,
            padding: '0 14px',
            borderRadius: 6,
            background: T,
            color: '#fff',
            border: 'none',
            fontFamily: FH,
            fontSize: 12,
            fontWeight: 700,
            cursor: pending || !question.trim() ? 'not-allowed' : 'pointer',
            opacity: pending || !question.trim() ? 0.6 : 1,
          }}
        >Add question</button>
      </div>
    </div>
  )
}
