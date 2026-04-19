"use client"
import { useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { R, AMB, T, BLK, FH, FB } from '../../../lib/theme'

// UI-SPEC §4.10 severity copy + §5.8 pill colors.
const SEVERITY_PILL = {
  low:    { bg: '#f3f4f6',     color: '#6b7280', label: 'Nice to have' },
  medium: { bg: `${AMB}1a`,    color: AMB,       label: 'Would help'   },
  high:   { bg: `${R}1a`,      color: R,         label: 'Blocker'      },
}

function relativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Date.now() - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/**
 * UI-SPEC §5.8 shared ClarificationCard — one component, three variants.
 *
 *   variant='chat'      → in the floating ConversationalBot panel (§5.8a)
 *   variant='dashboard' → in the Pipeline > Needs Clarity tab (§5.8b)
 *   variant='hotspot'   → inline callout below the briefing paragraph (§5.8c)
 *                         Also re-used for the 12s HIGH-severity escalation
 *                         sheet (UI-SPEC §5.9 / D-20).
 *
 * Props:
 *   clarification: kotoiq_clarifications row
 *   variant: 'chat' | 'dashboard' | 'hotspot'
 *   onAnswer(id, answer): Promise<void>
 *   onForward(id, channel?): Promise<void>
 *   onSkip(id): Promise<void>
 *   onClose?(): void   // hotspot variant only — closes the inline callout
 */
export default function ClarificationCard({
  clarification,
  variant = 'dashboard',
  onAnswer,
  onForward,
  onSkip,
  onClose,
}) {
  const [answerDraft, setAnswerDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [kebabOpen, setKebabOpen] = useState(false)

  const c = clarification || {}
  const pill = SEVERITY_PILL[c.severity] || SEVERITY_PILL.low

  const handleAnswer = async () => {
    if (!answerDraft.trim()) return
    setPending(true)
    try {
      await onAnswer?.(c.id, answerDraft.trim())
      setAnswerDraft('')
      onClose?.()
    } finally {
      setPending(false)
    }
  }

  const handleForward = async (channel) => {
    setPending(true)
    try {
      await onForward?.(c.id, channel)
      onClose?.()
    } finally {
      setPending(false)
      setKebabOpen(false)
    }
  }

  const handleSkip = async () => {
    setPending(true)
    try {
      await onSkip?.(c.id)
      onClose?.()
    } finally {
      setPending(false)
    }
  }

  const padding = variant === 'hotspot' ? 14 : 20
  const width = variant === 'chat' ? '100%' : variant === 'hotspot' ? 420 : '100%'
  const borderWidth = variant === 'hotspot' ? 2 : 1
  const borderColor = variant === 'hotspot' ? pill.color : '#e5e7eb'

  return (
    <div
      role="region"
      aria-label={`Clarification question, ${pill.label.toLowerCase()}`}
      style={{
        width,
        background: '#fff',
        border: `${borderWidth}px solid ${borderColor}`,
        borderRadius: 14,
        padding,
        marginBottom: variant === 'dashboard' ? 14 : 0,
        fontFamily: FB,
        color: BLK,
        boxShadow: variant === 'hotspot' ? `0 12px 32px ${pill.color}22` : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            padding: '3px 10px',
            borderRadius: 12,
            background: pill.bg,
            color: pill.color,
            fontFamily: FH,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.04em',
          }}
        >
          {pill.label}
        </span>
        <span style={{ flex: 1, fontSize: 11, color: '#6b7280' }}>
          asked {relativeTime(c.created_at)}
        </span>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setKebabOpen((v) => !v)}
            aria-label="Channel override"
            aria-expanded={kebabOpen}
            style={{ all: 'unset', cursor: 'pointer', padding: 4, color: '#6b7280' }}
          >
            <MoreVertical size={16} />
          </button>
          {kebabOpen ? (
            <div
              role="menu"
              style={{
                position: 'absolute',
                right: 0,
                top: 28,
                zIndex: 5,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 6px 16px rgba(0,0,0,.08)',
                padding: 4,
                minWidth: 160,
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => handleForward('sms')}
                style={{ all: 'unset', display: 'block', padding: '8px 12px', width: '100%', cursor: 'pointer', fontSize: 13 }}
              >Ask via SMS</button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleForward('email')}
                style={{ all: 'unset', display: 'block', padding: '8px 12px', width: '100%', cursor: 'pointer', fontSize: 13 }}
              >Ask via Email</button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleForward('portal')}
                style={{ all: 'unset', display: 'block', padding: '8px 12px', width: '100%', cursor: 'pointer', fontSize: 13 }}
              >Portal queue</button>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, marginBottom: 8 }}>
        {c.question}
      </div>
      {c.impact_hint ? (
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
          {c.impact_hint}
        </div>
      ) : null}

      {(variant === 'chat' || variant === 'hotspot') && (
        <textarea
          value={answerDraft}
          onChange={(e) => setAnswerDraft(e.target.value)}
          placeholder="Answer, or type /ask to forward to client"
          aria-label="Your answer"
          rows={2}
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
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {(variant === 'chat' || variant === 'hotspot') ? (
          <button
            type="button"
            onClick={handleAnswer}
            disabled={pending || !answerDraft.trim()}
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 6,
              background: T,
              color: '#fff',
              border: 'none',
              fontFamily: FH,
              fontSize: 12,
              fontWeight: 700,
              cursor: pending || !answerDraft.trim() ? 'not-allowed' : 'pointer',
              opacity: pending || !answerDraft.trim() ? 0.5 : 1,
            }}
          >Answer now</button>
        ) : (
          <button
            type="button"
            onClick={() => onAnswer?.(c.id, '')}
            disabled={pending}
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 6,
              background: T,
              color: '#fff',
              border: 'none',
              fontFamily: FH,
              fontSize: 12,
              fontWeight: 700,
              cursor: pending ? 'wait' : 'pointer',
              opacity: pending ? 0.6 : 1,
            }}
          >Answer</button>
        )}
        <button
          type="button"
          onClick={() => handleForward()}
          disabled={pending}
          style={{
            height: 28,
            padding: '0 12px',
            borderRadius: 6,
            background: '#fff',
            color: BLK,
            border: '1px solid #e5e7eb',
            fontFamily: FH,
            fontSize: 12,
            fontWeight: 700,
            cursor: pending ? 'wait' : 'pointer',
          }}
        >Ask client</button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={pending}
          style={{ all: 'unset', cursor: pending ? 'wait' : 'pointer', color: '#6b7280', fontSize: 12, padding: '4px 8px' }}
        >
          {variant === 'dashboard' ? 'Skip' : 'Skip for now'}
        </button>
        {variant === 'hotspot' && onClose ? (
          <button
            type="button"
            onClick={onClose}
            style={{ all: 'unset', cursor: 'pointer', color: '#6b7280', fontSize: 12, padding: '4px 8px', marginLeft: 'auto' }}
          >Close</button>
        ) : null}
      </div>
    </div>
  )
}
