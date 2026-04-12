// ── DataSourceBadge ─────────────────────────────────────────────────────────
//
// Reusable pill that shows where a displayed value came from, how fresh it
// is, and whether it was AI-generated. Drop this next to any number or list
// that surfaces real-world data.
//
// Props:
//   sourceName       — human name of the source ("US Census Bureau")
//   sourceUrl        — optional external link to the source URL
//   fetchedAt        — ISO 8601 timestamp of when the data was fetched
//   category         — key from STALE_THRESHOLDS_MS in dataIntegrity.ts
//                      (the component uses this to grade the freshness)
//   aiGenerated      — true for Claude-synthesized values; shows a warning
//   crossReferenced  — true if verified against 2+ independent sources
//   compact          — icon-only for tight layouts, full pill otherwise
//   style            — optional style overrides merged onto the wrapper
//
// This is a duplicate-in-pattern of the small SourceBadge used on
// /cog-report. Kept separate because this one carries a real freshness
// grade and is generic across the whole platform, while the cog-report one
// is a four-value enum specific to that page.

// Inline staleness grading so the component doesn't import from
// src/lib/dataIntegrity.ts (which is server-only and would break if this
// file ever ends up in a client bundle). The thresholds below MUST stay
// in sync with STALE_THRESHOLDS_MS on the server. If you change one,
// change the other.
const CLIENT_STALE_THRESHOLDS_MS = {
  'geo-state':        365 * 24 * 60 * 60 * 1000,
  'geo-county':       365 * 24 * 60 * 60 * 1000,
  'geo-municipality': 180 * 24 * 60 * 60 * 1000,
  'geo-zip':          180 * 24 * 60 * 60 * 1000,
  'industry-naics':   365 * 24 * 60 * 60 * 1000,
  'industry-sic':     365 * 24 * 60 * 60 * 1000,
  'gbp-categories':    90 * 24 * 60 * 60 * 1000,
  'business-listing':  30 * 24 * 60 * 60 * 1000,
  'business-contact':  30 * 24 * 60 * 60 * 1000,
  'citation-sources':  90 * 24 * 60 * 60 * 1000,
  'reviews':            7 * 24 * 60 * 60 * 1000,
  'rankings':               24 * 60 * 60 * 1000,
  'gbp-live':               24 * 60 * 60 * 1000,
}

function getStalenessLevel(fetchedAt, category) {
  const threshold = CLIENT_STALE_THRESHOLDS_MS[category] || CLIENT_STALE_THRESHOLDS_MS['business-listing']
  const age = Date.now() - new Date(fetchedAt).getTime()
  if (age < threshold * 0.7) return 'fresh'
  if (age < threshold) return 'aging'
  return 'stale'
}

const LEVEL_STYLES = {
  fresh:  { bg: '#f0fdf4', fg: '#16a34a', border: '#16a34a30', label: 'Fresh'  },
  aging:  { bg: '#fffbeb', fg: '#b45309', border: '#b4530930', label: 'Aging'  },
  stale:  { bg: '#fef2f2', fg: '#dc2626', border: '#dc262630', label: 'Stale'  },
}

export function DataSourceBadge({
  sourceName,
  sourceUrl,
  fetchedAt,
  category,
  aiGenerated = false,
  crossReferenced = false,
  compact = false,
  style = {},
}) {
  if (!fetchedAt || !sourceName) return null

  const level = getStalenessLevel(fetchedAt, category)
  const s = LEVEL_STYLES[level]
  const date = new Date(fetchedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const titleText =
    `Source: ${sourceName}${sourceUrl ? ` (${sourceUrl})` : ''}` +
    ` · Fetched ${date}` +
    (aiGenerated ? ' · AI-generated — verify before use' : '') +
    (crossReferenced ? ' · cross-referenced ✓' : '')

  if (compact) {
    return (
      <span
        title={titleText}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: s.bg,
          color: s.fg,
          border: `1px solid ${s.border}`,
          fontSize: 10,
          fontWeight: 800,
          cursor: 'help',
          ...style,
        }}
      >
        i
      </span>
    )
  }

  return (
    <div
      title={titleText}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        borderRadius: 20,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        fontSize: 10,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        lineHeight: 1.2,
        ...style,
      }}
    >
      {aiGenerated && (
        <span
          style={{
            padding: '1px 6px',
            borderRadius: 10,
            background: '#faf5ff',
            color: '#7c3aed',
            border: '1px solid #7c3aed30',
            fontSize: 9,
          }}
        >
          AI
        </span>
      )}
      <span>{s.label}</span>
      <span style={{ opacity: 0.6, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>·</span>
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            color: s.fg,
            textDecoration: 'underline',
            fontWeight: 700,
            textTransform: 'none',
            letterSpacing: 0,
          }}
        >
          {sourceName}
        </a>
      ) : (
        <span style={{ fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>{sourceName}</span>
      )}
      <span style={{ opacity: 0.6, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>· {date}</span>
      {crossReferenced && (
        <span
          style={{
            padding: '1px 6px',
            borderRadius: 10,
            background: '#eff6ff',
            color: '#2563eb',
            border: '1px solid #2563eb30',
            fontSize: 9,
          }}
          title="Cross-referenced against a secondary source"
        >
          ✓
        </span>
      )}
    </div>
  )
}

export default DataSourceBadge
