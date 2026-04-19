"use client"
import { useEffect, useRef } from 'react'
import { DST, BLK, FH, FB } from '../../../lib/theme'

/**
 * UI-SPEC §4.14 destructive confirmation.
 *
 * Field rejection drops the value from the profile but preserves the
 * source ProvenanceRecord (PROF-05 audit trail) — the route handler
 * (Plan 6 reject_field) writes rejected:true onto the records, not delete.
 *
 * Props:
 *   - fieldName: string — passed back to onConfirm
 *   - open: boolean
 *   - onCancel(): close without action
 *   - onConfirm(fieldName): destructive — drops the value
 */
export default function RejectFieldModal({ fieldName, open, onCancel, onConfirm }) {
  const cancelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    // Auto-focus the safe (cancel) button — never the destructive button.
    setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reject-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 24,
          maxWidth: 420,
          width: '92%',
          fontFamily: FB,
        }}
      >
        <h2
          id="reject-title"
          style={{
            fontFamily: FH,
            fontSize: 20,
            fontWeight: 700,
            color: BLK,
            margin: '0 0 8px',
          }}
        >
          Reject this value?
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: BLK, margin: '0 0 20px' }}>
          I&apos;ll drop it from the profile. The source citation stays — you can restore it from the field menu.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              background: '#fff',
              color: BLK,
              border: '1px solid #e5e7eb',
              fontFamily: FH,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Keep it
          </button>
          <button
            onClick={() => onConfirm?.(fieldName)}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              background: DST,
              color: '#fff',
              border: 'none',
              fontFamily: FH,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reject this value
          </button>
        </div>
      </div>
    </div>
  )
}
