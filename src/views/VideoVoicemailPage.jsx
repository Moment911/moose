"use client"
import { useState, useEffect } from 'react'
import {
  Video, Plus, RefreshCw, Loader2, Check, X, Send, Eye, Play,
  Mail, Clock, BarChart2, User, Search, Filter, ChevronDown, ChevronRight,
  Copy, ExternalLink, Trash2
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const R='#E6007E',T='#00C2CB',BLK='#111111',GRY='#F9F9F9',GRN='#16a34a',AMB='#d97706'
const W='#ffffff'

const API = '/api/video-voicemails'

export default function VideoVoicemailPage() {
  const { agencyId } = useAuth()
  const navigate = useNavigate()
  const [videos, setVideos] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [playingId, setPlayingId] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [listRes, statRes] = await Promise.all([
      fetch(`${API}?action=list&agency_id=${agencyId}`).then(r => r.json()),
      fetch(`${API}?action=get_stats&agency_id=${agencyId}`).then(r => r.json()),
    ])
    setVideos(listRes.data || [])
    setStats(statRes)
    setLoading(false)
  }

  async function checkAndSend(vmId) {
    const res = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_and_send', vm_id: vmId }),
    }).then(r => r.json())
    if (res.video_ready && res.email_sent) toast.success('Video sent!')
    else if (res.video_ready) toast.success('Video ready')
    else toast.success(`Still processing: ${res.status}`)
    loadAll()
  }

  // Filters
  const filtered = videos.filter(v => {
    if (search) {
      const q = search.toLowerCase()
      if (!(v.prospect_name||'').toLowerCase().includes(q) && !(v.business_name||'').toLowerCase().includes(q) && !(v.video_script||'').toLowerCase().includes(q)) return false
    }
    if (statusFilter && v.status !== statusFilter) return false
    if (industryFilter && v.industry_name !== industryFilter) return false
    return true
  })

  // Group by industry
  const industries = [...new Set(videos.map(v => v.industry_name).filter(Boolean))]
  const groupedByIndustry = {}
  for (const v of filtered) {
    const ind = v.industry_name || 'General'
    if (!groupedByIndustry[ind]) groupedByIndustry[ind] = []
    groupedByIndustry[ind].push(v)
  }

  const statusColor = s => s === 'sent' ? GRN : s === 'ready' ? T : s === 'processing' || s === 'generating' ? AMB : s === 'failed' ? '#dc2626' : '#999'

  const STATUS_FILTERS = [
    { key: '', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'ready', label: 'Ready' },
    { key: 'processing', label: 'Processing' },
    { key: 'failed', label: 'Failed' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ background: W, padding: '18px 24px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 500, color: BLK, margin: 0 }}>Video Library</h1>
            <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0' }}>{videos.length} videos created -- organized by industry and topic</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={loadAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', background: W, fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#555' }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => navigate('/avatars')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, border: 'none', background: R, color: W, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={14} /> Create Video
            </button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Videos', value: stats.total || 0, accent: T },
              { label: 'Emails Sent', value: stats.sent || 0, accent: R },
              { label: 'Emails Opened', value: stats.opened || 0, accent: AMB },
              { label: 'Videos Played', value: stats.played || 0, accent: GRN },
              { label: 'Open Rate', value: stats.sent > 0 ? `${Math.round((stats.opened || 0) / stats.sent * 100)}%` : '--', accent: '#6366f1' },
              { label: 'Play Rate', value: stats.sent > 0 ? `${Math.round((stats.played || 0) / stats.sent * 100)}%` : '--', accent: '#0ea5e9' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, padding: '14px 16px', background: W, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: BLK }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Search + Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} color="#999" style={{ position: 'absolute', left: 12, top: 11 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, business, or script content..."
                style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {STATUS_FILTERS.map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
                  padding: '7px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer',
                  background: statusFilter === f.key ? BLK : '#F5F5F5', color: statusFilter === f.key ? W : '#555',
                }}>{f.label}</button>
              ))}
            </div>
            {industries.length > 0 && (
              <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)} style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', fontSize: 12, cursor: 'pointer', color: '#555' }}>
                <option value="">All Industries</option>
                {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            )}
          </div>

          {/* Loading */}
          {loading && <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} color={R} className="ds-spin" /></div>}

          {/* Empty */}
          {!loading && videos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Video size={48} color="#d1d5db" style={{ marginBottom: 16 }} />
              <h3 style={{ fontSize: 18, fontWeight: 500, color: BLK, margin: '0 0 8px' }}>No Videos Yet</h3>
              <p style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>Create your first AI video voicemail from the avatar browser.</p>
              <button onClick={() => navigate('/avatars')} style={{ padding: '10px 24px', borderRadius: 6, border: 'none', background: R, color: W, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Create Video
              </button>
            </div>
          )}

          {/* Videos grouped by industry */}
          {!loading && Object.entries(groupedByIndustry).sort((a, b) => b[1].length - a[1].length).map(([industry, vids]) => (
            <div key={industry} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: BLK }}>{industry}</span>
                <span style={{ fontSize: 11, color: '#999' }}>{vids.length} video{vids.length !== 1 ? 's' : ''}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {vids.map(vm => {
                  const isExpanded = expandedId === vm.id
                  const isPlaying = playingId === vm.id
                  return (
                    <div key={vm.id} style={{ background: W, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                      {/* Main row */}
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : vm.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer' }}
                      >
                        {/* Thumbnail */}
                        <div style={{ width: 56, height: 56, borderRadius: 8, background: '#F5F5F5', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                          {vm.heygen_thumbnail_url ? (
                            <img src={vm.heygen_thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Video size={20} color="#ccc" />
                          )}
                          {vm.heygen_video_url && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                              <Play size={16} color={W} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {vm.prospect_name || vm.business_name || 'Video Message'}
                          </div>
                          <div style={{ fontSize: 12, color: '#999', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {vm.video_script ? vm.video_script.substring(0, 80) + (vm.video_script.length > 80 ? '...' : '') : 'No script'}
                          </div>
                        </div>

                        {/* Avatar */}
                        <div style={{ fontSize: 11, color: '#999', textAlign: 'right', flexShrink: 0 }}>
                          <div>{vm.avatar_name || '--'}</div>
                          <div style={{ fontSize: 10, color: '#ccc' }}>{vm.created_at ? new Date(vm.created_at).toLocaleDateString() : ''}</div>
                        </div>

                        {/* Engagement */}
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {vm.email_sent && <span style={{ width: 20, height: 20, borderRadius: '50%', background: vm.email_opened ? `${AMB}20` : '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={vm.email_opened ? 'Email opened' : 'Email sent'}><Mail size={10} color={vm.email_opened ? AMB : '#ccc'} /></span>}
                          {vm.video_played && <span style={{ width: 20, height: 20, borderRadius: '50%', background: `${GRN}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={`Played ${vm.video_play_count}x`}><Play size={10} color={GRN} /></span>}
                          {vm.cta_clicked && <span style={{ width: 20, height: 20, borderRadius: '50%', background: `${R}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="CTA clicked"><Check size={10} color={R} /></span>}
                        </div>

                        {/* Status */}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: statusColor(vm.status) + '15', color: statusColor(vm.status), flexShrink: 0 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor(vm.status) }} />
                          {vm.status}
                        </span>

                        {isExpanded ? <ChevronDown size={14} color="#999" /> : <ChevronRight size={14} color="#999" />}
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: vm.heygen_video_url ? '1fr 1fr' : '1fr', gap: 16, paddingTop: 14 }}>
                            {/* Script */}
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 500, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Script</div>
                              <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7, padding: '12px 14px', background: '#F9F9F9', borderRadius: 6, whiteSpace: 'pre-wrap' }}>
                                {vm.video_script || 'No script available'}
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                {vm.video_script && (
                                  <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(vm.video_script); toast.success('Script copied') }} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(0,0,0,0.14)', background: W, fontSize: 11, cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Copy size={10} /> Copy Script
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Video player */}
                            {vm.heygen_video_url && (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 500, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Video</div>
                                <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000', aspectRatio: '1' }}>
                                  <video
                                    src={vm.heygen_video_url}
                                    controls
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    poster={vm.heygen_thumbnail_url || undefined}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Details row */}
                          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#999', flexWrap: 'wrap' }}>
                            {vm.email_to && <span>To: {vm.email_to}</span>}
                            {vm.avatar_name && <span>Avatar: {vm.avatar_name}</span>}
                            {vm.video_duration_seconds && <span>Duration: {vm.video_duration_seconds}s</span>}
                            {vm.city && <span>Location: {vm.city}, {vm.state}</span>}
                            {vm.email_sent_at && <span>Sent: {new Date(vm.email_sent_at).toLocaleString()}</span>}
                            {vm.email_opened_at && <span style={{ color: AMB }}>Opened: {new Date(vm.email_opened_at).toLocaleString()}</span>}
                            {vm.video_played_at && <span style={{ color: GRN }}>Played: {new Date(vm.video_played_at).toLocaleString()} ({vm.video_play_count}x)</span>}
                            {vm.cta_clicked_at && <span style={{ color: R }}>CTA: {new Date(vm.cta_clicked_at).toLocaleString()}</span>}
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                            {(vm.status === 'processing' || vm.status === 'generating') && (
                              <button onClick={e => { e.stopPropagation(); checkAndSend(vm.id) }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', background: W, fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <RefreshCw size={12} /> Check Status
                              </button>
                            )}
                            {vm.status === 'ready' && !vm.email_sent && (
                              <button onClick={e => { e.stopPropagation(); checkAndSend(vm.id) }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: R, color: W, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Send size={12} /> Send Email
                              </button>
                            )}
                            {vm.heygen_video_url && (
                              <a href={vm.heygen_video_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', background: W, fontSize: 12, fontWeight: 500, color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ExternalLink size={12} /> Open Video
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}} .ds-spin{animation:ds-spin 1s linear infinite}`}</style>
      </div>
    </div>
  )
}
