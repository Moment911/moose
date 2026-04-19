"use client"
import { Check, Loader, CloudOff } from 'lucide-react'
import { T, GRN, AMB, FB } from '../../../lib/theme'

/**
 * UI-SPEC §5.13 auto-save indicator.
 *
 * Subtle, ambient. Never a button.
 *
 * Props:
 *   - state: 'idle' | 'saving' | 'saved' | 'error'
 */
export default function AutoSaveIndicator({ state = 'idle' }) {
  if (state === 'idle') return null

  const copy = {
    saving: 'Saving...',
    saved: 'Saved',
    error: "Couldn't save — retrying",
  }[state]

  const color = {
    saving: T,
    saved: GRN,
    error: AMB,
  }[state]

  const Icon = {
    saving: Loader,
    saved: Check,
    error: CloudOff,
  }[state]

  const spin = state === 'saving'

  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: FB,
        fontSize: 11,
        fontWeight: 500,
        color,
        opacity: state === 'saved' ? undefined : 1,
        transition: 'opacity 400ms ease-in',
      }}
    >
      <Icon
        size={12}
        style={spin ? { animation: 'spin 1s linear infinite' } : undefined}
      />
      {copy}
    </span>
  )
}
