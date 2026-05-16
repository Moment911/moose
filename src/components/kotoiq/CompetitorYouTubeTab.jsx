"use client"
import { useState, useEffect, useMemo } from 'react'
import {
  Loader2, RefreshCw, Plus, ExternalLink, Eye,
  ThumbsUp, MessageCircle, Calendar, Users, Play, Zap,
} from 'lucide-react'
// lucide-react doesn't export Youtube in this version — use Play as the channel icon
const Youtube = Play
import toast from 'react-hot-toast'
import HowItWorks from './HowItWorks'

// ─── Koto Design tokens ─────────────────────────────────────
const DISPLAY = "'Instrument Serif', Georgia, 'Times New Roman', serif"
const BODY    = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
const INK = '#1A1A1A'
const DIM = '#4A4545'
const MID = '#8A8580'
const HAIR = '#E8E4E0'
const SUBHAIR = '#F0ECE8'
const SOFT = '#FAFAF8'
const PINK = '#E6007E'
const PINK_LIGHT = 'rgba(230, 0, 126, 0.07)'
const YT_RED = '#FF0000'
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)'

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
function formatN(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
function relative(ts) {
  if (!ts) return ''
  const ms = Date.now() - new Date(ts).getTime()
  const d = Math.floor(ms / 86400000)
  if (d < 1) return 'today'
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
function formatDuration(s) {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m >= 60) return `${Math.floor(m/60)}h ${m%60}m`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function CompetitorYouTubeTab({ clientId }) {
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [brandInput, setBrandInput] = useState('')
  const [channels, setChannels] = useState([])
  const [videos, setVideos] = useState([])
  const [filterChannel, setFilterChannel] = useState('all')

  const refresh = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const [c, v] = await Promise.all([
        api('list_youtube_channels', { client_id: clientId }),
        api('list_youtube_videos', { client_id: clientId, limit: 100 }),
      ])
      setChannels(c?.channels || [])
      setVideos(v?.videos || [])
    } catch (e) { console.warn('[yt] refresh', e) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [clientId])

  const syncBrand = async () => {
    if (!brandInput.trim()) return
    setSearching(true)
    try {
      const r = await api('youtube_sync', { client_id: clientId, brand: brandInput.trim() })
      if (r.error) throw new Error(r.error)
      toast.success(`Synced ${r.channel?.title || brandInput}: ${r.videos_synced} videos`)
      setBrandInput('')
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Sync failed')
    } finally {
      setSearching(false)
    }
  }

  const filteredVideos = useMemo(() => {
    if (filterChannel === 'all') return videos
    return videos.filter(v => v.channel_id === filterChannel)
  }, [videos, filterChannel])

  if (!loading && channels.length === 0) {
    return (
      <div>
        <HowItWorks tool="competitor_youtube" />
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: PINK_LIGHT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Youtube size={26} color={YT_RED} />
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 10 }}>
            Watch competitor YouTube channels
          </div>
          <div style={{ fontFamily: BODY, fontSize: 14, color: DIM, maxWidth: 540, margin: '0 auto 24px', lineHeight: 1.55 }}>
            Subscriber growth, recent uploads, view counts, and engagement — pulled from the free YouTube Data API and refreshed on demand.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 480, margin: '0 auto' }}>
            <input autoFocus value={brandInput} onChange={e => setBrandInput(e.target.value)} placeholder="Competitor brand or channel name" style={{ ...subtleInput, flex: 1, minWidth: 240 }} onKeyDown={e => { if (e.key === 'Enter') syncBrand() }} />
            <button onClick={syncBrand} disabled={searching || !brandInput.trim()} style={{ ...inkButton, opacity: searching ? 0.6 : 1 }}>
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {searching ? 'Syncing...' : 'Add channel'}
            </button>
          </div>
          <div style={{ fontFamily: BODY, fontSize: 12, color: MID, marginTop: 16 }}>Requires YOUTUBE_API_KEY env var.</div>
        </div>
      </div>
    )
  }

  const totalSubs = channels.reduce((s, c) => s + (c.subscriber_count || 0), 0)
  const totalViews = channels.reduce((s, c) => s + (c.view_count || 0), 0)
  const recent30 = videos.filter(v => Date.now() - new Date(v.published_at).getTime() < 30 * 86400000).length

  return (
    <div>
      <HowItWorks tool="competitor_youtube" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Competitor YouTube</div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: DIM, marginTop: 4 }}>
            {channels.length} channel{channels.length === 1 ? '' : 's'} · {videos.length} videos pulled from YouTube Data API.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={brandInput} onChange={e => setBrandInput(e.target.value)} placeholder="Add competitor brand" style={{ ...subtleInput, width: 220 }} onKeyDown={e => { if (e.key === 'Enter') syncBrand() }} />
          <button onClick={syncBrand} disabled={searching || !brandInput.trim()} style={{ ...inkButton, opacity: searching ? 0.6 : 1 }}>
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {searching ? 'Syncing...' : 'Add'}
          </button>
          <button onClick={refresh} style={ghostButton}><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Kpi label="Channels" value={channels.length} />
        <Kpi label="Total Subscribers" value={formatN(totalSubs)} sub="combined" />
        <Kpi label="Lifetime Views" value={formatN(totalViews)} sub="combined" />
        <Kpi label="Uploads (30d)" value={recent30} valueColor={recent30 > 0 ? PINK : INK} sub="across all channels" />
      </div>

      {/* Channel cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 14 }}>
        {channels.map(ch => (
          <a key={ch.channel_id} href={`https://www.youtube.com/channel/${ch.channel_id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ ...card, marginBottom: 0, cursor: 'pointer', transition: 'border-color 200ms ease-out' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                {ch.thumbnail_url ? (
                  <img src={ch.thumbnail_url} alt={ch.channel_title} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: SOFT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Youtube size={20} color={YT_RED} />
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.channel_title}</div>
                  {ch.custom_url && <div style={{ fontFamily: BODY, fontSize: 12, color: MID }}>{ch.custom_url}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14, fontFamily: BODY, fontSize: 12, color: DIM }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Users size={11} color={MID} /> {formatN(ch.subscriber_count)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Eye size={11} color={MID} /> {formatN(ch.view_count)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Play size={11} color={MID} /> {ch.video_count || 0}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Channel filter */}
      <div style={{ ...card, padding: '14px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ ...labelStyle, marginBottom: 0 }}>Channel</span>
          <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} style={{ ...subtleInput, width: 280, flex: '0 0 auto' }}>
            <option value="all">All channels ({videos.length} videos)</option>
            {channels.map(c => <option key={c.channel_id} value={c.channel_id}>{c.channel_title}</option>)}
          </select>
          <span style={{ marginLeft: 'auto', fontFamily: BODY, fontSize: 12, color: MID }}>
            Showing {filteredVideos.length} videos
          </span>
        </div>
      </div>

      {/* Video grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {filteredVideos.map(v => (
          <a key={v.video_id} href={`https://www.youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ ...card, marginBottom: 0, padding: 0, overflow: 'hidden', cursor: 'pointer' }}>
              {v.thumbnail_url && (
                <div style={{ position: 'relative', aspectRatio: '16/9', background: SOFT, overflow: 'hidden' }}>
                  <img src={v.thumbnail_url} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {v.duration_seconds > 0 && (
                    <span style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '2px 6px', fontSize: 11, fontWeight: 600, borderRadius: 4, fontFamily: BODY }}>
                      {formatDuration(v.duration_seconds)}{v.is_short && ' · Short'}
                    </span>
                  )}
                </div>
              )}
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.35, marginBottom: 8, maxHeight: 56, overflow: 'hidden' }}>{v.title}</div>
                <div style={{ display: 'flex', gap: 12, fontFamily: BODY, fontSize: 11, color: MID }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Eye size={10} /> {formatN(v.view_count)}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <ThumbsUp size={10} /> {formatN(v.like_count)}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <MessageCircle size={10} /> {formatN(v.comment_count)}
                  </span>
                  <span style={{ marginLeft: 'auto' }}>{relative(v.published_at)}</span>
                </div>
              </div>
            </div>
          </a>
        ))}
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
