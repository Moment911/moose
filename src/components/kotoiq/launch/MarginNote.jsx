"use client"
import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { T, GRY, BLK, FH, FB } from '../../../lib/theme'

/**
 * UI-SPEC §5.5 margin note (D-10).
 *
 * Data model comes from Plan 04 profileSeeder.ts which persists up to 4
 * margin notes per profile to kotoiq_client_profile.margin_notes.
 *
 * Note shape (from Plan 1 profileTypes.ts):
 *   { id, field_path, question, suggested_value?, source_ref, created_at,
 *     status: 'pending' | 'accepted' | 'rejected' | 'edited' }
 *
 * Props:
 *   - note: the row above
 *   - onAccept(note): operator clicks "Add it" — parent should write the
 *     suggested_value to field_path
 *   - onReject(noteId): operator clicks "Skip" — local 2s ghost line then
 *     removes; persistence is the parent's job
 *   - onEdit(note): operator clicks "Edit first" — parent should focus the
 *     target span
 */
export default function MarginNote({ note, onAccept, onReject, onEdit }) {
  const [state, setState] = useState('open')   // open | dismissed | ghost
  const [ghostText, setGhostText] = useState('')

  const handleReject = () => {
    setState('ghost')
    setGhostText(`Skipped: "${(note.question || '').slice(0, 60)}"`)
    setTimeout(() => setState('dismissed'), 2000)
    onReject?.(note.id)
  }

  if (state === 'dismissed') return null
  if (state === 'ghost') {
    return (
      <div style={{ fontFamily: FB, fontSize: 12, color: '#6b7280', padding: '8px 14px' }}>
        {ghostText}
      </div>
    )
  }

  return (
    <aside
      style={{
        width: 220,
        minHeight: 64,
        background: GRY,
        borderLeft: `4px solid ${T}`,
        padding: '12px 14px',
        borderRadius: 10,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: FH,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: T,
          marginBottom: 6,
        }}
      >
        <Lightbulb size={12} />
        <span>NOTICED</span>
      </div>
      <div
        style={{
          fontFamily: FB,
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.45,
          color: BLK,
          marginBottom: 10,
        }}
      >
        {note.question}
        {note.suggested_value && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
            Suggested: {note.suggested_value}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onAccept?.(note)}
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
            cursor: 'pointer',
          }}
        >
          Add it
        </button>
        <button
          onClick={handleReject}
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
            cursor: 'pointer',
          }}
        >
          Skip
        </button>
        <button
          onClick={() => onEdit?.(note)}
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
            cursor: 'pointer',
          }}
        >
          Edit first
        </button>
      </div>
    </aside>
  )
}
