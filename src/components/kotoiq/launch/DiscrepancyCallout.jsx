"use client"
import { AlertTriangle, X } from 'lucide-react'
import { R, BLK, GRY, FH, FB } from '../../../lib/theme'

/**
 * UI-SPEC §5.6 discrepancy callout (D-11).
 *
 * Renders inline as a block element below the paragraph containing the
 * conflicting field — NOT as a floating tooltip. The single strongest
 * "wow" moment of the Launch Page.
 *
 * Props:
 *   - report: { field, kind, records: [{ value, source_type, source_snippet, confidence }, ...] }
 *   - onChoose(record): operator picks a source — parent should writeField
 *   - onEdit(): operator clicks "Edit manually"
 *   - onIgnore(): operator clicks "Ignore — leave as-is"
 *   - onClose(): close the callout
 */
export default function DiscrepancyCallout({ report, onChoose, onEdit, onIgnore, onClose }) {
  if (!report) return null
  const records = report.records || []

  return (
    <div
      role="region"
      aria-label={`${records.length} sources disagree about ${report.field}`}
      style={{
        width: 360,
        background: '#fff',
        border: `2px solid ${R}`,
        borderRadius: 14,
        boxShadow: '0 12px 32px rgba(230,0,126,0.18)',
        padding: 16,
        margin: '12px auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <AlertTriangle size={14} color={R} />
        <span
          style={{
            fontFamily: FH,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: R,
            flex: 1,
          }}
        >
          MISMATCH
        </span>
        <button
          onClick={onClose}
          aria-label="Close mismatch"
          style={{ all: 'unset', cursor: 'pointer', padding: 4 }}
        >
          <X size={14} color={BLK} />
        </button>
      </div>

      <div
        style={{
          fontFamily: FB,
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.5,
          color: BLK,
          marginBottom: 12,
        }}
      >
        {report.field} disagrees.{' '}
        {records.map((r, i) => (
          <span key={i}>
            {i > 0 ? ' ' : ''}
            <code
              style={{
                fontFamily: 'monospace',
                fontSize: 13,
                background: GRY,
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              {String(r.value)}
            </code>
            {r.source_type ? (
              <span style={{ color: '#6b7280', fontSize: 12 }}>
                {' '}({String(r.source_type).replace(/_/g, ' ')})
              </span>
            ) : null}
            {i < records.length - 1 ? ';' : '.'}
          </span>
        ))}
        {' '}Which is right?
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {records.map((r, i) => (
          <button
            key={i}
            onClick={() => onChoose?.(r)}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 8,
              background: R,
              color: '#fff',
              border: 'none',
              fontFamily: FH,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Use {String(r.value)}
          </button>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button
            onClick={onEdit}
            style={{
              flex: 1,
              height: 30,
              padding: '0 12px',
              borderRadius: 8,
              background: '#fff',
              color: BLK,
              border: '1px solid #e5e7eb',
              fontFamily: FH,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Edit manually
          </button>
          <button
            onClick={onIgnore}
            style={{
              all: 'unset',
              cursor: 'pointer',
              color: '#6b7280',
              fontSize: 12,
              padding: '0 4px',
            }}
          >
            Ignore — leave as-is
          </button>
        </div>
      </div>
    </div>
  )
}
