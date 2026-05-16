"use client"
import { useState, useEffect, useMemo } from 'react'
import {
  Megaphone, Loader2, RefreshCw, Search, Filter, ExternalLink,
  Image as ImageIcon, Calendar, DollarSign,
  MessageCircle, Globe, Plus, Camera, Users as Network,
} from 'lucide-react'
import toast from 'react-hot-toast'
import HowItWorks from './HowItWorks'

// ─── Koto Design tokens ─────────────────────────────────────
const DISPLAY = "'Instrument Serif', Georgia, 'Times New Roman', serif"
const BODY    = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
const INK = '#201b51'
const DIM = '#4a4674'
const MID = '#6b6789'
const HAIR = '#e8e6ef'
const SUBHAIR = '#F0ECE8'
const SOFT = '#f5f3ee'
const PINK = '#cb1c6b'
const PINK_LIGHT = 'rgba(203, 28, 107, 0.07)'
const TEAL = '#00C2CB'
const SUCCESS = '#16A34A'
const INFO = '#2563EB'
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)'

const PLATFORM_META = {
  facebook:           { label: 'Facebook',    color: '#1877F2', Icon: Globe },
  instagram:          { label: 'Instagram',   color: '#E1306C', Icon: Camera },
  messenger:          { label: 'Messenger',   color: '#00B2FF', Icon: MessageCircle },
  audience_network:   { label: 'Audience Net', color: '#7B8A9C', Icon: Network },
  threads:            { label: 'Threads',     color: INK,        Icon: Globe },
}

const card = { background: '#fff', borderRadius: 12, border: `1px solid ${HAIR}`, padding: '20px 22px', marginBottom: 14, fontFamily: BODY, boxShadow: CARD_SHADOW }
const labelStyle = { fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: BODY, marginBottom: 6 }
const sectionTitle = { fontFamily: BODY, fontSize: 16, fontWeight: 600, color: INK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }
const inkButton = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: PINK, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: BODY, cursor: 'pointer' }
const ghostButton = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', color: INK, border: `1px solid ${HAIR}`, borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: BODY, cursor: 'pointer' }
const subtleInput = { width: '100%', padding: '10px 12px', border: `1px solid ${HAIR}`, borderRadius: 8, fontSize: 14, fontFamily: BODY, color: INK, outline: 'none', boxSizing: 'border-box' }

async function api(action, body) {
  const r = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
  return r.json()
}
function relative(ts) {
  if (!ts) return ''
  const ms = Date.now() - new Date(ts).getTime()
  const d = Math.floor(ms / 86400000)
  if (d < 1) return 'today'
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
function pillStyle(color) {
  return { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: color + '14', color, fontSize: 11, fontWeight: 600, borderRadius: 999, fontFamily: BODY }
}

export default function CompetitorAdsTab({ clientId }) {
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [overview, setOverview] = useState(null)
  const [ads, setAds] = useState([])
  const [filterBrand, setFilterBrand] = useState('all')
  const [filterActive, setFilterActive] = useState('all')

  const refresh = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const [o, a] = await Promise.all([
        api('ads_overview', { client_id: clientId }),
        api('list_competitor_ads', { client_id: clientId, limit: 200 }),
      ])
      setOverview(o)
      setAds(a?.ads || [])
    } catch (e) { console.warn('[ads] refresh', e) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [clientId])

  const searchAndSync = async () => {
    if (!searchTerm.trim()) return
    setSearching(true)
    try {
      const r = await api('meta_ads_sync', { client_id: clientId, brand: searchTerm.trim(), active: 'ALL', limit: 50 })
      if (r.error) throw new Error(r.error)
      toast.success(`${r.total || 0} ads pulled (${r.inserted || 0} new, ${r.updated || 0} updated)`)
      setSearchTerm('')
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const brands = useMemo(() => Array.from(new Set(ads.map(a => a.brand_name))).sort(), [ads])
  const filtered = useMemo(() => {
    return ads.filter(a => {
      if (filterBrand !== 'all' && a.brand_name !== filterBrand) return false
      if (filterActive === 'active' && !a.is_active) return false
      if (filterActive === 'inactive' && a.is_active) return false
      return true
    })
  }, [ads, filterBrand, filterActive])

  // Empty state
  if (!loading && ads.length === 0) {
    return (
      <div>
        <HowItWorks tool="competitor_ads" />
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: PINK_LIGHT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Megaphone size={26} color={PINK} />
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 10 }}>
            See every ad your competitors run
          </div>
          <div style={{ fontFamily: BODY, fontSize: 14, color: DIM, maxWidth: 540, margin: '0 auto 24px', lineHeight: 1.55 }}>
            Search the free Meta Ads Library for active and historical ad creatives across Facebook, Instagram, Messenger, and Audience Network — copy, snapshots, run dates, spend ranges.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 480, margin: '0 auto' }}>
            <input
              autoFocus
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Competitor brand name"
              style={{ ...subtleInput, flex: 1, minWidth: 220 }}
              onKeyDown={e => { if (e.key === 'Enter') searchAndSync() }}
            />
            <button onClick={searchAndSync} disabled={searching || !searchTerm.trim()} style={{ ...inkButton, opacity: searching ? 0.6 : 1 }}>
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              {searching ? 'Searching...' : 'Search Meta Ads'}
            </button>
          </div>
          <div style={{ fontFamily: BODY, fontSize: 12, color: MID, marginTop: 16 }}>
            Requires META_ACCESS_TOKEN env var. Free Meta dev token works.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <HowItWorks tool="competitor_ads" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Competitor Ads</div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: DIM, marginTop: 4 }}>
            Every ad your competitors run — from the free Meta Ads Library, across Facebook, Instagram, Messenger.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search a brand..."
            style={{ ...subtleInput, width: 220 }}
            onKeyDown={e => { if (e.key === 'Enter') searchAndSync() }}
          />
          <button onClick={searchAndSync} disabled={searching || !searchTerm.trim()} style={{ ...inkButton, opacity: searching ? 0.6 : 1 }}>
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {searching ? 'Pulling...' : 'Add brand'}
          </button>
          <button onClick={refresh} style={ghostButton}><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Kpi label="Ads Tracked" value={overview?.total_ads ?? 0} sub={`${overview?.brands_with_ads ?? 0} brands`} />
        <Kpi label="Currently Active" value={overview?.active_ads ?? 0} valueColor={overview?.active_ads > 0 ? PINK : INK} />
        <Kpi label="Platforms" value={Object.keys(overview?.platforms || {}).length} sub={topPlatforms(overview?.platforms)} />
        <Kpi label="Last Found" value={overview?.newest_ad_at ? relative(overview.newest_ad_at) : '—'} />
      </div>

      {/* Filters */}
      <div style={{ ...card, padding: '14px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Filter size={14} color={MID} />
          <span style={{ ...labelStyle, marginBottom: 0 }}>Brand</span>
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={{ ...subtleInput, width: 200, flex: '0 0 auto' }}>
            <option value="all">All ({brands.length})</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <span style={{ ...labelStyle, marginBottom: 0, marginLeft: 12 }}>Status</span>
          <select value={filterActive} onChange={e => setFilterActive(e.target.value)} style={{ ...subtleInput, width: 160, flex: '0 0 auto' }}>
            <option value="all">All</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <span style={{ marginLeft: 'auto', fontFamily: BODY, fontSize: 12, color: MID }}>
            Showing {filtered.length} of {ads.length}
          </span>
        </div>
      </div>

      {/* Creative gallery */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {filtered.map(ad => (
          <AdCard key={ad.id} ad={ad} />
        ))}
      </div>
    </div>
  )
}

function AdCard({ ad }) {
  return (
    <div style={{ ...card, marginBottom: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${HAIR}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.brand_name}</span>
          {ad.is_active ? (
            <span style={pillStyle(SUCCESS)}>Active</span>
          ) : (
            <span style={pillStyle(MID)}>Ended</span>
          )}
        </div>
      </div>

      {/* Snapshot link */}
      {ad.creative_snapshot_url ? (
        <a href={ad.creative_snapshot_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: 14, background: SOFT, textAlign: 'center', textDecoration: 'none', borderBottom: `1px solid ${SUBHAIR}` }}>
          <ImageIcon size={20} color={MID} />
          <div style={{ fontFamily: BODY, fontSize: 12, color: PINK, marginTop: 4, fontWeight: 600 }}>View ad snapshot →</div>
        </a>
      ) : (
        <div style={{ padding: 14, background: SOFT, textAlign: 'center', color: MID, fontSize: 12, fontFamily: BODY }}>No snapshot</div>
      )}

      {/* Body */}
      <div style={{ padding: '12px 14px', flex: 1 }}>
        {ad.headline && (
          <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: INK, marginBottom: 4, lineHeight: 1.3 }}>{ad.headline}</div>
        )}
        {ad.body_text && (
          <div style={{ fontFamily: BODY, fontSize: 12, color: DIM, lineHeight: 1.45, marginBottom: 8, maxHeight: 80, overflow: 'hidden' }}>
            {ad.body_text.slice(0, 200)}{ad.body_text.length > 200 ? '…' : ''}
          </div>
        )}

        {/* Platform pills */}
        {ad.platforms?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {ad.platforms.map(p => {
              const meta = PLATFORM_META[p] || { label: p, color: MID, Icon: Globe }
              const Icon = meta.Icon
              return <span key={p} style={pillStyle(meta.color)}><Icon size={10} /> {meta.label}</span>
            })}
          </div>
        )}

        {/* Spend + run dates */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontFamily: BODY, fontSize: 11, color: MID }}>
          {ad.spend_range && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <DollarSign size={10} /> {ad.spend_range} {ad.currency || ''}
            </span>
          )}
          {ad.delivery_start && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Calendar size={10} /> {new Date(ad.delivery_start).toLocaleDateString()}{ad.delivery_stop ? ` → ${new Date(ad.delivery_stop).toLocaleDateString()}` : ' →'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, valueColor = INK }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 170, marginBottom: 0 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: valueColor, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ fontFamily: BODY, fontSize: 12, color: MID, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function topPlatforms(plat) {
  if (!plat) return ''
  return Object.entries(plat).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k).join(', ')
}
