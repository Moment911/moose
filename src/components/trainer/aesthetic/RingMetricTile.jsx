"use client"
import { T } from './tokens'

// Cal-AI ring tile (IMG_2816, IMG_2808): white-elevated card with a
// label, big value, and a partial-fill ring on the right. Used 1-up for
// Calories and 3-up for Protein/Carbs/Fat.
//
// Use:
//   <RingMetricTile label="Calories" value={1820} unit="kcal"
//                    pct={0.78} color={T.ink} />
//   <RingMetricTile label="Protein" value={142} unit="g"
//                    pct={0.65} color={T.accent} compact />

export default function RingMetricTile({
  label,
  value,
  unit,
  pct = 0,                   // 0–1
  color,                     // ring stroke color; defaults to T.ink for the cal tile
  compact = false,
  hint,                      // optional small caption under the value
}) {
  const ringColor = color || T.ink
  const safe = Math.max(0, Math.min(1, pct))
  const ringSize = compact ? 56 : 72
  const stroke = compact ? 5 : 6
  const r = (ringSize - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c * safe

  return (
    <div style={{
      background: T.cardElev,
      borderRadius: T.rLg,
      padding: compact ? `${T.s4}px ${T.s4}px` : `${T.s5}px ${T.s5}px`,
      display: 'flex',
      alignItems: 'center',
      gap: T.s4,
      boxShadow: T.shadowFloater,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: T.font,
          fontSize: T.size.caption,
          fontWeight: T.weight.body,
          color: T.ink3,
          textTransform: 'uppercase',
          letterSpacing: T.track.caption,
          marginBottom: T.s1,
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: T.font,
          fontSize: compact ? T.size.h2 : T.size.h1,
          lineHeight: compact ? T.lh.h2 : T.lh.h1,
          fontWeight: T.weight.display,
          color: T.ink,
          letterSpacing: compact ? T.track.h2 : T.track.h1,
        }}>
          {value}
          {unit ? (
            <span style={{
              fontSize: T.size.subtitle,
              fontWeight: T.weight.body,
              color: T.ink3,
              marginLeft: 4,
            }}>{unit}</span>
          ) : null}
        </div>
        {hint ? (
          <div style={{
            marginTop: T.s1,
            fontFamily: T.font,
            fontSize: T.size.caption,
            fontWeight: T.weight.caption,
            color: T.ink3,
          }}>
            {hint}
          </div>
        ) : null}
      </div>

      <svg
        width={ringSize}
        height={ringSize}
        style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}
        aria-hidden
      >
        <circle
          cx={ringSize / 2} cy={ringSize / 2} r={r}
          fill="none"
          stroke={T.divider}
          strokeWidth={stroke}
        />
        <circle
          cx={ringSize / 2} cy={ringSize / 2} r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray .5s ease' }}
        />
      </svg>
    </div>
  )
}
