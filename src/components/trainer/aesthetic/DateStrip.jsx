"use client"
import { T } from './tokens'

// Cal-AI date strip (IMG_2816): horizontal row of 7 day-pills under the
// page header. Selected day gets a circular dark ring; others read in T.ink4.
//
// Use:
//   const today = new Date()
//   const days = lastNDays(7, today)   // helper below
//   <DateStrip days={days} selected={today} onSelect={setSelected} />
//
// `days` is an array of Date objects. `selected` is a Date. Equality is
// computed by ISO date (YYYY-MM-DD), so timezone-equivalent dates match.

export default function DateStrip({ days, selected, onSelect }) {
  const selectedKey = selected ? toKey(selected) : null
  return (
    <div role="radiogroup" aria-label="Date" style={{
      display: 'flex',
      gap: T.s2,
      justifyContent: 'space-between',
      padding: `${T.s2}px 0`,
    }}>
      {days.map((d) => {
        const key = toKey(d)
        const isSelected = key === selectedKey
        const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)
        const dayNum = d.getDate()
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect?.(d)}
            style={{
              flex: 1,
              minWidth: 0,
              padding: `${T.s3}px ${T.s2}px`,
              background: 'transparent',
              border: 'none',
              borderRadius: T.rMd,
              cursor: 'pointer',
              fontFamily: T.font,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: T.s1,
            }}
          >
            <span style={{
              fontSize: T.size.caption,
              fontWeight: T.weight.body,
              color: isSelected ? T.ink : T.ink4,
              letterSpacing: T.track.caption,
              textTransform: 'uppercase',
            }}>
              {dayLabel}
            </span>
            <span style={{
              width: 32, height: 32, borderRadius: T.rPill,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: isSelected ? `1.5px solid ${T.ink}` : '1.5px solid transparent',
              fontSize: T.size.body,
              fontWeight: isSelected ? T.weight.h1 : T.weight.body,
              color: isSelected ? T.ink : T.ink3,
            }}>
              {dayNum}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function toKey(d) {
  return new Date(d).toISOString().slice(0, 10)
}

// Convenience: build the last N days ending at `endDate` (defaults to today).
// Returned in chronological order (oldest first).
export function lastNDays(n, endDate = new Date()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(endDate)
    d.setDate(d.getDate() - i)
    out.push(d)
  }
  return out
}
