"use client"
import { useFreshness } from '../../context/KotoIQDataContext'
import { GRN, AMB, DESIGN, } from '../../lib/theme'

const SF = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
const STALE_RED = '#dc2626'

/**
 * Tiny inline badge showing when a kotoiq sync source was last refreshed.
 * Pulls from KotoIQDataContext's freshness map (populated by the
 * get_data_freshness API on mount + every refreshKey bump).
 *
 * Usage: <FreshnessBadge source="quick_scan" />
 *        <FreshnessBadge source="generate_topical_map" prefix="Topical map" />
 *
 * Renders nothing if no sync log exists for the source — keeps fresh
 * dashboards uncluttered.
 */
export default function FreshnessBadge({ source, prefix }) {
  const f = useFreshness(source)
  if (!f || f.age_days == null) return null

  const color =
    f.grade === 'fresh' ? GRN :
    f.grade === 'aging' ? AMB :
    f.grade === 'stale' ? STALE_RED : '#94a3b8'

  const ageLabel = formatAge(f.age_days)

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 6,
      background: color + '14', color,
      fontFamily: SF, fontSize: 10, fontWeight: 700,
      letterSpacing: 0.2,
    }}
    title={`${prefix || source} · last run ${ageLabel} (${f.grade})`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {prefix ? `${prefix} · ` : ''}{ageLabel}
    </span>
  )
}

function formatAge(days) {
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 14) return `${Math.round(days)}d ago`
  if (days < 60) return `${Math.round(days / 7)}w ago`
  return `${Math.round(days / 30)}mo ago`
}
