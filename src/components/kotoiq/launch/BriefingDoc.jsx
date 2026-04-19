"use client"
import { useMemo } from 'react'
import EditableSpan from './EditableSpan'
import CitationChip from './CitationChip'
import { BLK, FB, FH } from '../../../lib/theme'

/**
 * UI-SPEC §5.2 narrative prose briefing.
 *
 * Renders the ClientProfile as a 720px max-width prose document with
 * editable spans + inline citation chips + discrepancy flags.
 *
 * Props:
 *   - profile: ClientProfile (from /api/kotoiq/profile get_profile)
 *   - discrepancies: DiscrepancyReport[]
 *   - onFieldSave: (field_name, new_value) => Promise<void>
 *   - onFieldReject: (field_name) => void   // opens RejectFieldModal
 *   - onOpenDiscrepancy: (report) => void   // opens DiscrepancyCallout
 */
export default function BriefingDoc({
  profile,
  discrepancies = [],
  onFieldSave,
  onFieldReject,
  onOpenDiscrepancy,
}) {
  const discrepByField = useMemo(() => {
    const m = new Map()
    for (const d of discrepancies) m.set(d.field, d)
    return m
  }, [discrepancies])

  // ── Helpers ────────────────────────────────────────────────────────────────
  // span(): renders an EditableSpan for a profile field, sourcing the value +
  // confidence from the top ProvenanceRecord (descending-confidence ordering
  // is established by Plan 4 profileSeeder).
  const span = (field, { fallback = 'unknown', label } = {}) => {
    const recs = profile?.fields?.[field] || []
    const top = recs[0]
    const value = profile?.[field] ?? top?.value ?? null
    const confidence = top?.confidence ?? (value ? 0.85 : 0)
    const hasDisc = discrepByField.has(field)
    const displayValue = value == null
      ? ''
      : String(Array.isArray(value) ? value.join(', ') : value)
    return (
      <EditableSpan
        value={displayValue}
        confidence={confidence}
        discrepancy={hasDisc}
        sourceLabel={label ?? top?.source_type ?? ''}
        ariaLabel={field.replace(/_/g, ' ')}
        // Plan 07-08: thread the canonical field name down so
        // ClarificationsOverlay can anchor HotspotDots accurately.
        fieldPath={field}
        onSave={(nv) => onFieldSave?.(field, nv)}
        onReject={() => onFieldReject?.(field)}
      >
        {displayValue || fallback}
      </EditableSpan>
    )
  }

  // chip(): PROF-03 provenance quintet — threads source_type + source_url +
  // captured_at + confidence + source_snippet into the tooltip.
  const chip = (field) => {
    const top = profile?.fields?.[field]?.[0]
    if (!top) return null
    return (
      <CitationChip
        sourceType={top.source_type}
        sourceSnippet={top.source_snippet}
        sourceUrl={top.source_url || top.source_ref}
        capturedAt={top.captured_at}
        confidence={top.confidence}
      />
    )
  }

  const clientName = profile?.business_name || 'this client'
  const isEmpty = !profile || !profile.business_name

  return (
    <main
      aria-label="Client profile briefing"
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '40px 40px 200px',
        fontFamily: FB,
        color: BLK,
      }}
    >
      <h1
        style={{
          fontFamily: FH,
          fontSize: 28,
          fontWeight: 900,
          lineHeight: 1.15,
          margin: '0 0 24px',
        }}
      >
        {isEmpty ? `Let's get to know ${clientName}.` : clientName}
      </h1>

      {isEmpty ? (
        <p style={{ fontSize: 18, lineHeight: 1.6, color: '#6b7280' }}>
          Paste a Koto link, drop a file, or start typing. I&apos;ll pull what&apos;s already on file and tell you what&apos;s missing.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 18, lineHeight: 1.6, margin: '0 0 24px' }}>
            {span('business_name', { fallback: clientName })} is a {span('industry', { fallback: 'business' })} serving {span('target_customer', { fallback: 'customers' })} in {span('service_area', { fallback: 'an undefined area' })}.{' '}
            They&apos;ve been in business since {span('founding_year', { fallback: 'an unknown year' })}
            {discrepByField.has('founding_year') ? <em> (sources disagree — flagging)</em> : null}
            . Their primary service is {span('primary_service', { fallback: 'undetermined' })} {chip('primary_service')}.
          </p>

          <p style={{ fontSize: 18, lineHeight: 1.6, margin: '0 0 24px' }}>
            They differentiate on {span('unique_selling_prop', { fallback: '…' })} {chip('unique_selling_prop')}.{' '}
            Reach them at {span('phone', { fallback: '—' })} {chip('phone')}{' '}
            or {span('website', { fallback: 'no website on file' })} {chip('website')}.
          </p>

          {discrepancies.length > 0 && (
            <section aria-label="Flagged mismatches" style={{ marginTop: 32 }}>
              <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '16px 0 24px' }} />
              <h2
                style={{
                  fontFamily: FH,
                  fontSize: 22,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  margin: '0 0 12px',
                }}
              >
                Open questions
              </h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {discrepancies.map((d) => (
                  <li key={d.field} style={{ marginBottom: 12 }}>
                    <button
                      onClick={() => onOpenDiscrepancy?.(d)}
                      style={{
                        all: 'unset',
                        cursor: 'pointer',
                        color: BLK,
                        fontSize: 16,
                        fontWeight: 500,
                        textDecoration: 'underline',
                        textDecorationStyle: 'dotted',
                      }}
                    >
                      {d.field} disagrees across {d.records?.length ?? 0} sources
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}
