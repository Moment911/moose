"use client"
import { GRN, AMB, R, BLK, FH, FB } from '../../../lib/theme'

/**
 * UI-SPEC §5.7 + §4.8 soft launch gate (D-13 + D-14).
 *
 * Sticky-bottom 120px-tall bar. Button is ALWAYS enabled — the gate is
 * SOFT (D-13). Tint changes by completeness:
 *   ≥ 90%: GRN (Launch)
 *   70-89%: AMB (Launch anyway)
 *   < 70%: R   (Launch anyway)
 *
 * Props:
 *   - score: 0..1 | null — completeness from Plan 4 computeCompleteness
 *   - reasoning: string — Sonnet's explanation (unused in v1 visual but
 *     documented in props for future tooltips)
 *   - softGaps: [{ field, reason }] — gaps Claude wants answered
 *   - onLaunch(): Promise<void>
 *   - launching: boolean — disables ONLY when in-flight (not based on score)
 */
// eslint-disable-next-line no-unused-vars
export default function LaunchGate({ score, reasoning, softGaps = [], onLaunch, launching = false }) {
  const pct = score == null ? 0 : Math.round(score * 100)
  const tint = score == null
    ? '#9ca3af'
    : pct >= 90 ? GRN : pct >= 70 ? AMB : R
  const label = score == null
    ? 'Launch'
    : pct >= 90 ? 'Launch' : 'Launch anyway'

  return (
    <div
      role="region"
      aria-label="Launch gate"
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: '#fff',
        borderTop: '1px solid #e5e7eb',
        borderLeft: `4px solid ${tint}`,
        boxShadow: '0 -8px 24px rgba(0,0,0,0.06)',
        minHeight: 120,
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        fontFamily: FB,
      }}
    >
      <div
        style={{
          fontFamily: FH,
          fontSize: 48,
          fontWeight: 900,
          lineHeight: 1,
          color: tint,
          minWidth: 120,
        }}
      >
        {score == null ? '—' : `${pct}%`}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
          of what I need to start
        </div>
        {softGaps.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Nothing else to ask — I&apos;m ready.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              {softGaps.length} soft gap{softGaps.length === 1 ? '' : 's'} remain
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {softGaps.slice(0, 5).map((g, i) => (
                <li key={i} style={{ fontSize: 13, fontWeight: 400, color: BLK, marginBottom: 2 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      background: AMB,
                      marginRight: 8,
                      marginBottom: 2,
                    }}
                  />
                  {(g.field || g.reason || '').replace(/_/g, ' ')}
                </li>
              ))}
              {softGaps.length > 5 && (
                <li style={{ fontSize: 12, color: '#6b7280' }}>+ {softGaps.length - 5} more</li>
              )}
            </ul>
          </>
        )}
      </div>
      <button
        onClick={onLaunch}
        disabled={launching}
        style={{
          height: 48,
          padding: '0 28px',
          borderRadius: 10,
          background: tint,
          color: pct >= 70 && pct < 90 ? BLK : '#fff',
          border: 'none',
          fontFamily: FH,
          fontSize: 16,
          fontWeight: 700,
          cursor: launching ? 'wait' : 'pointer',
          opacity: launching ? 0.7 : 1,
        }}
      >
        {launching ? 'Kicking off…' : label}
      </button>
    </div>
  )
}
