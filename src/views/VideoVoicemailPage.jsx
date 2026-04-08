"use client"
import { useState, useEffect } from 'react'
import {
  Video, Plus, RefreshCw, Loader2, Check, X, Send, Eye, Play,
  Mail, Clock, BarChart2, User
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R='#E6007E',T='#00C2CB',BLK='#111111',GRY='#F9F9F9',GRN='#16a34a',AMB='#d97706'
const W='#ffffff',FH="'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif",FB="'Raleway','Helvetica Neue',sans-serif"

const API = '/api/video-voicemails'

export default function VideoVoicemailPage() {
  const { agencyId } = useAuth()
  const [videos, setVideos] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newVm, setNewVm] = useState({ lead_id:'', email_to:'', custom_script:'' })

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

  async function createVideo() {
    if (!newVm.email_to) { toast.error('Email required'); return }
    setCreating(true)
    const res = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', agency_id: agencyId, lead_id: newVm.lead_id || undefined, lead: { prospect_email: newVm.email_to, business_name: 'Prospect' }, email_to: newVm.email_to, custom_script: newVm.custom_script || undefined }),
    }).then(r => r.json())
    if (res.success) { toast.success('Video generating...'); setShowCreate(false); loadAll() }
    else toast.error(res.error || 'Failed')
    setCreating(false)
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

  const statusColor = s => s === 'sent' ? GRN : s === 'ready' ? T : s === 'processing' || s === 'generating' ? AMB : s === 'failed' ? '#dc2626' : '#999'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ background: W, padding: '18px 24px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 500, color: BLK, margin: 0 }}>Video Voicemails</h1>
            <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0' }}>AI-generated personalized video messages via HeyGen</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={loadAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', background: W, fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#555' }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, border: 'none', background: R, color: W, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={14} /> Create Video
            </button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Videos', value: stats.total || 0, icon: Video, accent: T },
              { label: 'Emails Sent', value: stats.sent || 0, icon: Send, accent: R },
              { label: 'Emails Opened', value: stats.opened || 0, icon: Eye, accent: AMB },
              { label: 'Videos Played', value: stats.played || 0, icon: Play, accent: GRN },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, padding: '16px 18px', background: W, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <s.icon size={14} color={s.accent} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 600, color: BLK }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Video list */}
          {loading && <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} color={R} className="ds-spin" /></div>}

          {!loading && videos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Video size={48} color="#d1d5db" style={{ marginBottom: 16 }} />
              <h3 style={{ fontSize: 18, fontWeight: 500, color: BLK, margin: '0 0 8px' }}>No Video Voicemails Yet</h3>
              <p style={{ fontSize: 13, color: '#999' }}>Create your first AI video voicemail or they will generate automatically when calls go to voicemail.</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {videos.map(vm => (
              <div key={vm.id} style={{ padding: '16px 20px', borderRadius: 8, background: W, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Thumbnail */}
                <div style={{ width: 80, height: 80, borderRadius: 8, background: '#F5F5F5', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {vm.heygen_thumbnail_url ? (
                    <img src={vm.heygen_thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Video size={24} color="#ccc" />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: BLK }}>{vm.prospect_name || vm.business_name || 'Unknown'}</div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{vm.business_name} {vm.city ? `-- ${vm.city}, ${vm.state}` : ''}</div>
                  <div style={{ fontSize: 11, color: '#AAA', marginTop: 4 }}>
                    To: {vm.email_to || 'No email'} | Avatar: {vm.avatar_name || 'Default'}
                  </div>
                </div>

                {/* Status + engagement */}
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: statusColor(vm.status) + '15', color: statusColor(vm.status) }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor(vm.status) }} />
                    {vm.status}
                  </span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, justifyContent: 'flex-end' }}>
                    {vm.email_opened && <span style={{ fontSize: 10, color: AMB }}>Opened</span>}
                    {vm.video_played && <span style={{ fontSize: 10, color: GRN }}>Played {vm.video_play_count}x</span>}
                    {vm.cta_clicked && <span style={{ fontSize: 10, color: R }}>CTA clicked</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {(vm.status === 'processing' || vm.status === 'generating') && (
                    <button onClick={() => checkAndSend(vm.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', background: W, fontSize: 11, fontWeight: 500, cursor: 'pointer', color: '#555' }}>
                      Check Status
                    </button>
                  )}
                  {vm.status === 'ready' && (
                    <button onClick={() => checkAndSend(vm.id)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: R, color: W, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                      Send Email
                    </button>
                  )}
                  {vm.heygen_video_url && (
                    <a href={vm.heygen_video_url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', background: W, fontSize: 11, fontWeight: 500, color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Play size={10} /> Watch
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: W, borderRadius: 12, padding: 28, width: 480, maxWidth: '95vw' }}>
              <h3 style={{ fontSize: 18, fontWeight: 500, color: BLK, margin: '0 0 16px' }}>Create Video Voicemail</h3>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Recipient Email</label>
                <input value={newVm.email_to} onChange={e => setNewVm(v => ({ ...v, email_to: e.target.value }))} placeholder="prospect@business.com" style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Custom Script (optional -- AI generates if blank)</label>
                <textarea value={newVm.custom_script} onChange={e => setNewVm(v => ({ ...v, custom_script: e.target.value }))} placeholder="Leave blank for AI-generated script..." rows={4} style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreate(false)} style={{ padding: '10px 20px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.14)', background: W, fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#555' }}>Cancel</button>
                <button onClick={createVideo} disabled={creating} style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: R, color: W, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: creating ? 0.5 : 1 }}>
                  {creating ? 'Generating...' : 'Generate Video'}
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}} .ds-spin{animation:ds-spin 1s linear infinite}`}</style>
      </div>
    </div>
  )
}
