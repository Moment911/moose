"use client"
import { useState } from 'react'
import { ackDisclaimer } from '../../lib/trainer/myPlanFetch'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 3 — TraineeDisclaimerAckModal
//
// Shown on first /my-plan load if invite.disclaimer_ack_at is null.
// Trainee must tick the box and click "Continue" before the plan renders.
// Writes `trainer_disclaimer_ack_at` into auth.users.user_metadata via
// supabase.auth.updateUser — we rely on that as the source of truth since
// Phase 3 does not yet ship a dedicated ack endpoint (the metadata is
// enough for the client to gate + re-check on every load).
// ─────────────────────────────────────────────────────────────────────────────

const INK = '#0a0a0a'
const BRD = '#ececef'
const RED = '#ea2729'
const GRY5 = '#6b7280'
const GRY7 = '#374151'

export default function TraineeDisclaimerAckModal({ onAcked }) {
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleContinue() {
    if (!checked || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await ackDisclaimer()
      onAcked?.()
    } catch (e) {
      setError(e?.message || 'Could not save your acknowledgement. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,10,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 9999,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        style={{
          background: '#fff',
          borderRadius: 18,
          border: `1px solid ${BRD}`,
          maxWidth: 520,
          width: '100%',
          padding: 28,
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        }}
      >
        <h2
          id="disclaimer-title"
          style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 900, color: INK, letterSpacing: '-.3px' }}
        >
          Before you start
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: 15, color: GRY7, lineHeight: 1.7 }}>
          Your training and nutrition plan is fitness coaching — <strong>not medical advice</strong>.
        </p>
        <p style={{ margin: '0 0 18px', fontSize: 15, color: GRY7, lineHeight: 1.7 }}>
          Please consult your physician before starting any new exercise or nutrition program,
          especially if you have a pre-existing condition, are pregnant or nursing, or are
          managing an injury. If anything in your plan causes pain or concern, stop and talk
          to your coach and your doctor.
        </p>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 14,
            border: `1px solid ${BRD}`,
            borderRadius: 12,
            cursor: 'pointer',
            background: checked ? '#f9fafb' : '#fff',
            marginBottom: 16,
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18, accentColor: RED }}
          />
          <span style={{ fontSize: 14, color: INK, lineHeight: 1.6 }}>
            I&apos;ve read and understood the disclaimer above. I accept that this plan is coaching guidance,
            not medical advice.
          </span>
        </label>

        {error ? (
          <div style={{ fontSize: 13, color: RED, marginBottom: 12 }}>{error}</div>
        ) : null}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!checked || submitting}
          style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: 12,
            border: 'none',
            background: checked && !submitting ? INK : '#c8c8cc',
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            cursor: checked && !submitting ? 'pointer' : 'not-allowed',
            letterSpacing: '-.01em',
          }}
        >
          {submitting ? 'Saving…' : 'Continue to my plan'}
        </button>

        <p style={{ margin: '14px 0 0', fontSize: 12, color: GRY5, textAlign: 'center' }}>
          You only need to acknowledge this once.
        </p>
      </div>
    </div>
  )
}
