"use client"
import { useState } from 'react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { T_RED, T_BLUE, T_BG, T_FONT } from '../../lib/trainer/ui'
import { BENCHMARKS } from '../../lib/trainer/positionBenchmarks'

// ─────────────────────────────────────────────────────────────────────────────
// /trainer/benchmarks — Position-by-position recruiting benchmarks table.
//
// Shows D1 / D2 / D3 / JUCO ranges for every metric at each position.
// Dark premium theme.
// ─────────────────────────────────────────────────────────────────────────────

const DIV_COLORS = {
  D1:   T_RED,        // #dc2626
  D2:   T_BLUE,       // #2563eb
  D3:   '#6b7280',    // gray
  JUCO: '#f59e0b',    // amber
}

const DIVISIONS = ['D1', 'D2', 'D3', 'JUCO']

export default function BenchmarksPage() {
  const [selected, setSelected] = useState(BENCHMARKS[0].position)
  const pos = BENCHMARKS.find((b) => b.position === selected) || BENCHMARKS[0]

  return (
    <TrainerPortalShell>
      <div style={{ fontFamily: T_FONT, minHeight: '100vh', background: '#111' }}>

        {/* ── Dark gradient header ──────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
          padding: '48px 40px 32px',
          borderBottom: '1px solid #2a2a2a',
        }}>
          <h1 style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}>
            Benchmarks
          </h1>
          <p style={{
            margin: '6px 0 0',
            fontSize: 14,
            color: '#9ca3af',
            lineHeight: 1.5,
          }}>
            Realistic ranges for recruitable players — rising senior (post-junior-year summer).
          </p>
        </div>

        <div style={{ padding: '28px 40px 48px', maxWidth: 1000 }}>

          {/* ── Position pills ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
            {BENCHMARKS.map((b) => {
              const active = b.position === selected
              return (
                <button
                  key={b.position}
                  onClick={() => setSelected(b.position)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 20,
                    border: active ? `1.5px solid ${T_RED}` : '1.5px solid #333',
                    background: active ? T_RED : 'transparent',
                    color: active ? '#fff' : '#9ca3af',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: T_FONT,
                    cursor: 'pointer',
                    transition: 'all .15s ease',
                  }}
                >
                  {b.position} — {b.label}
                </button>
              )
            })}
          </div>

          {/* ── Metrics table ───────────────────────────────────────────── */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
          }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
              padding: '12px 20px',
              background: '#0f0f0f',
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
            }}>
              <span style={{ color: '#9ca3af' }}>Metric</span>
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
                  padding: '14px 20px',
                  borderBottom: i < pos.metrics.length - 1 ? '1px solid #f0f0f0' : 'none',
                  alignItems: 'center',
                  fontSize: 13,
                  background: i % 2 === 0 ? '#fff' : '#fafafa',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: '#111' }}>{m.label}</span>
                  <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 6 }}>({m.units})</span>
                  {m.lowerIsBetter && (
                    <span style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      color: T_BLUE,
                      background: '#eff6ff',
                      padding: '2px 8px',
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
                        padding: '5px 12px',
                        borderRadius: 8,
                        background: color + '14',
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

          {/* ── Position notes callout ──────────────────────────────────── */}
          {pos.notes.length > 0 && (
            <div style={{
              marginTop: 20,
              padding: '18px 22px',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 12,
              borderLeft: `3px solid ${T_RED}`,
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 800,
                color: T_RED,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 10,
              }}>
                {pos.label} Notes
              </div>
              <ul style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 13,
                lineHeight: 1.8,
                color: '#d1d5db',
              }}>
                {pos.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}

          {/* ── Age-group context ──────────────────────────────────────── */}
          <div style={{
            marginTop: 20,
            padding: '16px 22px',
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            <span style={{
              fontSize: 18,
              lineHeight: 1,
              flexShrink: 0,
              marginTop: 1,
            }}>
              &#9432;
            </span>
            <p style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.7,
              color: '#d1d5db',
            }}>
              These benchmarks are for rising seniors. Younger athletes should project down.
            </p>
          </div>

          {/* ── Disclaimer ─────────────────────────────────────────────── */}
          <div style={{
            marginTop: 16,
            padding: '14px 22px',
            background: 'transparent',
            border: '1px solid #2a2a2a',
            borderRadius: 12,
          }}>
            <p style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.7,
              color: '#6b7280',
            }}>
              Ranges are directional from industry consensus (PBR, Perfect Game, D1Baseball).
              Power 5 programs recruit above these D1 ranges.
            </p>
          </div>

        </div>
      </div>
    </TrainerPortalShell>
  )
}
