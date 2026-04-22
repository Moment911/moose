"use client"
import { useState } from 'react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { R, T, BLK } from '../../lib/theme'
import { BENCHMARKS } from '../../lib/trainer/positionBenchmarks'

// ─────────────────────────────────────────────────────────────────────────────
// /trainer/benchmarks — Position-by-position recruiting benchmarks table.
//
// Shows D1 / D2 / D3 / JUCO ranges for every metric at each position.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'

const DIV_COLORS = {
  D1:   R,           // #E6007E pink
  D2:   T,           // #00C2CB teal
  D3:   '#6b7280',   // gray
  JUCO: '#f59e0b',   // amber
}

const DIVISIONS = ['D1', 'D2', 'D3', 'JUCO']

export default function BenchmarksPage() {
  const [selected, setSelected] = useState(BENCHMARKS[0].position)
  const pos = BENCHMARKS.find((b) => b.position === selected) || BENCHMARKS[0]

  return (
    <TrainerPortalShell>
      <div style={{ padding: '32px 40px', maxWidth: 960 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: BLK }}>Recruiting Benchmarks</h1>
        <p style={{ margin: '4px 0 24px', color: '#6b7280', fontSize: 14 }}>
          Realistic ranges for recruitable players — rising senior (post-junior-year summer).
        </p>

        {/* Position pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
          {BENCHMARKS.map((b) => {
            const active = b.position === selected
            return (
              <button
                key={b.position}
                onClick={() => setSelected(b.position)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  border: `1px solid ${active ? R : BRD}`,
                  background: active ? R : '#fff',
                  color: active ? '#fff' : BLK,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all .12s ease',
                }}
              >
                {b.position} — {b.label}
              </button>
            )
          })}
        </div>

        {/* Metrics table */}
        <div style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            padding: '10px 16px',
            borderBottom: `1px solid ${BRD}`,
            background: '#fafafa',
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '.06em',
          }}>
            <span style={{ color: '#6b7280' }}>Metric</span>
            {DIVISIONS.map((d) => (
              <span key={d} style={{ color: DIV_COLORS[d], textAlign: 'center' }}>{d} Range</span>
            ))}
          </div>

          {/* Rows */}
          {pos.metrics.map((m, i) => (
            <div
              key={m.metric}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                padding: '12px 16px',
                borderBottom: i < pos.metrics.length - 1 ? `1px solid #f3f4f6` : 'none',
                alignItems: 'center',
                fontSize: 13,
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: BLK }}>{m.label}</span>
                <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 6 }}>({m.units})</span>
                {m.lowerIsBetter && (
                  <span style={{
                    marginLeft: 8,
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#0369a1',
                    background: '#e0f2fe',
                    padding: '2px 6px',
                    borderRadius: 10,
                  }}>
                    lower = better
                  </span>
                )}
              </div>
              {DIVISIONS.map((d) => {
                const [lo, hi] = m.ranges[d]
                const color = DIV_COLORS[d]
                return (
                  <div key={d} style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: color + '12',
                      color,
                      fontWeight: 700,
                      fontSize: 13,
                    }}>
                      {lo} – {hi}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Notes */}
        {pos.notes.length > 0 && (
          <div style={{
            marginTop: 16,
            padding: '14px 18px',
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              {pos.label} Notes
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: '#78350f' }}>
              {pos.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}
      </div>
    </TrainerPortalShell>
  )
}
