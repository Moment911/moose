"use client"
import { AlertTriangle, X } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — TrainerToast.
//
// Fixed bottom-right error toast.  Parent controls lifetime + auto-dismiss
// timing (owned by TrainerDetailPage.flashError).
// ─────────────────────────────────────────────────────────────────────────────

export default function TrainerToast({ message, onClose }) {
  if (!message) return null
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 60,
        maxWidth: 420,
        background: '#991b1b',
        color: '#fff',
        border: '1px solid #7f1d1d',
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: '0 10px 24px rgba(0,0,0,.18)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{message}</span>
      {onClose && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fecaca',
            cursor: 'pointer',
            padding: 2,
            display: 'inline-flex',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
