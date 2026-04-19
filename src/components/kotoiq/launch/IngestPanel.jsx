"use client"
import { useState } from 'react'
import { T, BLK, FH, FB } from '../../../lib/theme'

/**
 * UI-SPEC §4.1 ingest panel.
 *
 * Two modes:
 *   - URL — paste a Koto link (/onboard/:id, /onboarding-dashboard/:id, /clients/:id)
 *   - Text — paste a voice transcript / email / meeting notes for extraction
 *
 * Props:
 *   - onSubmit({ url? } | { pasted_text? })
 *   - disabled: boolean — disables the CTA while ingest is in flight
 */
export default function IngestPanel({ onSubmit, disabled }) {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [mode, setMode] = useState('url')   // 'url' | 'text'

  const canSubmit =
    (mode === 'url' ? url.trim().length > 0 : text.trim().length > 0) && !disabled

  const submit = () => {
    if (!canSubmit) return
    if (mode === 'url') onSubmit?.({ url })
    else onSubmit?.({ pasted_text: text })
  }

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '40px auto',
        padding: '0 40px',
        fontFamily: FB,
        color: BLK,
      }}
    >
      <div
        role="tablist"
        aria-label="Ingest source"
        style={{ display: 'flex', gap: 8, marginBottom: 12 }}
      >
        {['url', 'text'].map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: 6,
              fontFamily: FH,
              fontSize: 12,
              fontWeight: 700,
              background: mode === m ? T : '#fff',
              color: mode === m ? '#fff' : BLK,
              border: `1px solid ${mode === m ? T : '#e5e7eb'}`,
            }}
          >
            {m === 'url' ? 'Koto link' : 'Paste text'}
          </button>
        ))}
      </div>

      {mode === 'url' ? (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="/onboard/:clientId, /onboarding-dashboard/:clientId, or /clients/:clientId"
          aria-label="Koto URL"
          style={{
            width: '100%',
            height: 44,
            padding: '0 14px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            fontSize: 15,
            fontFamily: FB,
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a voice transcript, email, meeting notes, or any raw text. I'll extract what matters and cite where each field came from."
          aria-label="Raw text to ingest"
          rows={8}
          maxLength={50000}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            fontSize: 14,
            fontFamily: FB,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      )}

      <button
        disabled={!canSubmit}
        onClick={submit}
        style={{
          marginTop: 12,
          height: 44,
          padding: '0 24px',
          borderRadius: 10,
          background: T,
          color: '#fff',
          border: 'none',
          fontFamily: FH,
          fontSize: 14,
          fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          opacity: canSubmit ? 1 : 0.6,
        }}
      >
        Pull it in
      </button>
    </div>
  )
}
