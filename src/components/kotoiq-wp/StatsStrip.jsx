"use client"
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

/**
 * StatsStrip — 5-card fleet stats row at the top of FleetView.
 *
 * Cream cards with navy primary numbers and pink/amber accents. Mirrors the
 * stat strip from wp-plugin-kotoiq/includes/admin.php (the WP plugin's own
 * admin dashboard) so the agency dashboard + plugin admin feel like one
 * surface.
 */
const NAVY = BLK
const PINK = R
const CREAM = '#faf9f6'
const LINE = '#e9e6dd'

export default function StatsStrip({ stats }) {
  const s = stats || {}
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: 0,
      background: '#fff',
      borderRadius: 12,
      border: `1px solid ${LINE}`,
      overflow: 'hidden',
    }}>
      <Stat
        label="Sites"
        value={s.total || 0}
        sub={`${s.clients || 0} clients · ${s.orphans || 0} unassigned`}
        color={NAVY}
      />
      <Stat
        label="Koto plugin live"
        value={s.kotoLive || 0}
        sub={`${(s.total || 0) - (s.kotoLive || 0)} idle`}
        color={GRN}
      />
      <Stat
        label="WPSimpleCode paired"
        value={s.wpscPaired || 0}
        sub={`${(s.total || 0) - (s.wpscPaired || 0)} not paired`}
        color={PINK}
      />
      <Stat
        label="Fully managed"
        value={s.fullyManaged || 0}
        sub="both plugins live"
        color={T}
      />
      <Stat
        label="Active last 24h"
        value={s.recent || 0}
        sub={`${(s.total || 0) - (s.recent || 0)} dormant`}
        color={AMB}
        last
      />
    </div>
  )
}

function Stat({ label, value, sub, color = '#201b51', last }) {
  return (
    <div style={{
      padding: '18px 22px',
      background: CREAM,
      borderRight: last ? 'none' : `1px solid ${LINE}`,
    }}>
      <div style={{
        fontFamily: FB,
        fontSize: 26, fontWeight: 900, color,
        lineHeight: 1, letterSpacing: '-0.02em',
      }}>
        {Number(value).toLocaleString()}
      </div>
      <div style={{
        fontSize: 10, color: '#6b7280', fontFamily: FB,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginTop: 6, fontWeight: 700,
      }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB, marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
