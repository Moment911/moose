"use client"

// ─────────────────────────────────────────────────────────────────────────────
// NoneOrText — "None" checkbox or a textarea for the real answer.
//
// Used on the three intake fields where "None" is a common, legitimate answer
// (medical_flags, injuries, allergies).  Typing "None" in a textarea is
// friction and a common cause of the completeness gate firing.  With this
// widget, the trainee ticks the box and the field is stored as "None"
// (non-empty string → passes the required-field gate).  Unchecking the box
// reveals the textarea for a real answer.
//
// Callers pass { value, onChange, placeholder, rows? }.  onChange receives
// the canonical string — "None" when the box is ticked, free text otherwise.
// ─────────────────────────────────────────────────────────────────────────────

export default function NoneOrText({ value, onChange, placeholder, rows = 2, disabled = false }) {
  const raw = String(value ?? '').trim()
  const isNone = raw.toLowerCase() === 'none'

  return (
    <div>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: '#374151',
          cursor: disabled ? 'default' : 'pointer',
          marginBottom: 6,
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={isNone}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? 'None' : '')}
        />
        <strong>None</strong> <span style={{ color: '#6b7280' }}>— nothing to flag here</span>
      </label>
      {!isNone && (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 13,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: disabled ? '#f9fafb' : '#fff',
            color: '#0a0a0a',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            resize: 'vertical',
          }}
        />
      )}
    </div>
  )
}
