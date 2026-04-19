"use client"
import { useState, useRef, useEffect } from 'react'
import { T, R, AMB, BLK, FB } from '../../../lib/theme'

// Mirror of HALO_THRESHOLDS from server config — duplicated here because
// profileConfig.ts is server-only ('server-only' import would crash the
// client bundle). Keep in sync with src/lib/kotoiq/profileConfig.ts.
const HALO_CONFIDENT = 0.85
const HALO_GUESSED = 0.5

function haloStyle(confidence, discrepancy, editing) {
  if (discrepancy) {
    return {
      border: `1px solid ${R}`,
      borderRadius: 4,
      position: 'relative',
    }
  }
  const ringSize = editing ? 3 : 2
  if (confidence >= HALO_CONFIDENT) {
    return { boxShadow: `0 0 0 ${ringSize}px ${T}33`, borderRadius: 4, position: 'relative' }
  }
  if (confidence >= HALO_GUESSED) {
    return { boxShadow: `0 0 0 ${ringSize}px ${AMB}33`, borderRadius: 4, position: 'relative' }
  }
  // Low confidence — dashed outline + faint amber tint per UI-SPEC §3
  return {
    outline: `1px dashed #d1d5db`,
    outlineOffset: 2,
    background: `${AMB}0d`,
    borderRadius: 4,
    position: 'relative',
  }
}

/**
 * UI-SPEC §5.2 + §5.3 editable span primitive.
 *
 * Props:
 *   - value: string (current displayed value)
 *   - confidence: number 0..1
 *   - discrepancy: boolean
 *   - onSave: async (newValue: string) => void
 *   - onReject: () => void  // opens RejectFieldModal
 *   - sourceLabel: string  // optional — shown in aria-describedby
 *   - ariaLabel: string    // required for screen readers
 *   - children: the actual text (in case parent wants to highlight sub-portions)
 */
export default function EditableSpan({
  value,
  confidence = 0.9,
  discrepancy = false,
  onSave,
  onReject,
  sourceLabel,
  ariaLabel,
  fieldPath,
  children,
}) {
  // "Adjusting state on prop change" — React's recommended approach (no
  // useEffect setState cascade and no ref-during-render). When `value`
  // differs from the snapshot we hold in `prevValue`, update both
  // `prevValue` and `draft` in the same render pass. React optimises
  // these same-render setState calls into a single re-render.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [editing, setEditing] = useState(false)
  const [prevValue, setPrevValue] = useState(value)
  const [draft, setDraft] = useState(value ?? '')
  const [saveState, setSaveState] = useState('idle')   // idle | saving | saved | error
  const inputRef = useRef(null)

  if (prevValue !== value) {
    setPrevValue(value)
    setDraft(value ?? '')
  }

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = async () => {
    if (draft === value) { setEditing(false); return }
    setSaveState('saving')
    try {
      await onSave?.(draft)
      setSaveState('saved')
      setEditing(false)
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  const cancel = () => {
    setDraft(value ?? '')
    setEditing(false)
    setSaveState('idle')
  }

  const spanStyle = {
    padding: '2px 4px',
    fontFamily: FB,
    fontSize: 18,
    fontWeight: 500,
    lineHeight: 1.6,
    color: BLK,
    cursor: 'text',
    transition: 'background 120ms ease-out',
    display: 'inline-block',
    ...haloStyle(confidence, discrepancy, editing),
  }

  const describedById = ariaLabel ? `src-${String(ariaLabel).replace(/\s+/g, '-')}` : undefined

  if (editing) {
    return (
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
          aria-label={ariaLabel}
          style={{ ...spanStyle, minWidth: 60, background: '#fff' }}
        />
        {saveState === 'error' && (
          <span style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, fontSize: 11, color: '#dc2626' }}>
            save failed — keep editing
          </span>
        )}
      </span>
    )
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true) }
      }}
      onContextMenu={(e) => {
        if (onReject) { e.preventDefault(); onReject() }
      }}
      aria-label={ariaLabel}
      aria-describedby={sourceLabel ? describedById : undefined}
      // Plan 07-08: ClarificationsOverlay queries `[data-field-path]` to anchor
      // HotspotDots over the matching EditableSpan. Falls back to ariaLabel if
      // the parent didn't thread an explicit fieldPath through.
      data-field-path={fieldPath || ariaLabel}
      style={spanStyle}
    >
      {children ?? value ?? <em style={{ color: '#9ca3af' }}>missing</em>}
      {discrepancy && (
        <span
          aria-label="Conflict between multiple sources. Open to resolve."
          style={{
            position: 'absolute',
            top: -3,
            right: -3,
            width: 6,
            height: 6,
            borderRadius: 3,
            background: R,
          }}
        />
      )}
      {sourceLabel && describedById && (
        <span
          id={describedById}
          style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}
        >
          Confidence: {Math.round(confidence * 100)} percent. Sourced from {sourceLabel}.
        </span>
      )}
    </span>
  )
}
