"use client"
import { useState } from 'react'
import { FileText, Phone, BookOpen, Edit3, Sparkles, Paperclip } from 'lucide-react'
import { T, AMB, BLK, FH } from '../../../lib/theme'

const ICON_MAP = {
  onboarding_form: FileText,
  voice_call: Phone,
  discovery_doc: BookOpen,
  operator_edit: Edit3,
  claude_inference: Sparkles,
  uploaded_doc: Paperclip,
  deferred_v2: Paperclip,
}

const LABEL_MAP = {
  onboarding_form: 'onboarding',
  voice_call: 'voice call',
  discovery_doc: 'discovery',
  operator_edit: 'you',
  claude_inference: 'inferred',
  uploaded_doc: 'uploaded',
  deferred_v2: 'attached',
}

const COLOR_MAP = {
  onboarding_form: T,
  voice_call: T,
  discovery_doc: T,
  operator_edit: BLK,
  claude_inference: AMB,
  uploaded_doc: T,
  deferred_v2: T,
}

/**
 * UI-SPEC §5.2 citation pill.
 *
 * Implements PROF-03 provenance quintet — exposes source_type + source_url +
 * captured_at + confidence + source_snippet via the tooltip so operators can
 * audit every populated span.
 *
 * Props:
 *   - sourceType: SourceType (onboarding_form | voice_call | discovery_doc | ...)
 *   - sourceSnippet: string (≤240 chars — the raw quote)
 *   - sourceUrl?: string (clickable link to the underlying record)
 *   - capturedAt?: string (ISO date the data was captured)
 *   - confidence?: number 0..1
 *   - sourceLabelExtra?: string (e.g. "March 14" — appended to label)
 *
 * ProvenanceRecord shape consumed (PROF-03):
 *   { source_type, source_url, source_ref?, source_snippet, captured_at, confidence }
 */
export default function CitationChip({
  sourceType,
  sourceSnippet,
  sourceUrl,
  capturedAt,
  confidence,
  sourceLabelExtra,
}) {
  const [open, setOpen] = useState(false)
  const Icon = ICON_MAP[sourceType] || Sparkles
  const label = LABEL_MAP[sourceType] || sourceType
  const color = COLOR_MAP[sourceType] || T
  const formattedCaptured = capturedAt ? formatDate(capturedAt) : null
  const pctConfidence = typeof confidence === 'number'
    ? Math.round(Math.max(0, Math.min(1, confidence)) * 100)
    : null

  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-label={`Sourced from ${label}${sourceLabelExtra ? ` ${sourceLabelExtra}` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 20,
        margin: '0 4px',
        background: color + '15',
        color,
        fontFamily: FH,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        position: 'relative',
        cursor: 'help',
      }}
    >
      <Icon size={10} />
      <span>{label}{sourceLabelExtra ? ` · ${sourceLabelExtra}` : ''}</span>
      {open && (sourceSnippet || sourceUrl || formattedCaptured || pctConfidence !== null) && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            zIndex: 10,
            padding: '8px 12px',
            borderRadius: 6,
            background: '#fff',
            border: '1px solid #e5e7eb',
            boxShadow: '0 6px 16px rgba(0,0,0,.08)',
            fontSize: 12,
            fontWeight: 400,
            color: BLK,
            letterSpacing: 0,
            textTransform: 'none',
            maxWidth: 360,
            lineHeight: 1.5,
            whiteSpace: 'normal',
          }}
        >
          {sourceSnippet && <span style={{ display: 'block', marginBottom: 6 }}>{sourceSnippet}</span>}
          {(sourceUrl || formattedCaptured || pctConfidence !== null) && (
            <span
              style={{
                display: 'block',
                fontSize: 11,
                color: '#6b7280',
                lineHeight: 1.4,
                borderTop: sourceSnippet ? '1px solid #f3f4f6' : 'none',
                paddingTop: sourceSnippet ? 6 : 0,
              }}
            >
              {sourceUrl && (
                <span style={{ display: 'block' }}>
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color, textDecoration: 'none' }}
                  >
                    {sourceUrl}
                  </a>
                </span>
              )}
              {formattedCaptured && <span style={{ display: 'block' }}>Captured {formattedCaptured}</span>}
              {pctConfidence !== null && <span style={{ display: 'block' }}>{pctConfidence}% confidence</span>}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

function formatDate(iso) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString()
  } catch {
    return iso
  }
}
