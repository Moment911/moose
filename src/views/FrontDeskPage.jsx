"use client"
import { useState, useEffect } from 'react'
import {
  Phone, PhoneIncoming, Play, Pause, Eye, Edit2, Loader2, RefreshCw,
  Calendar, Users, ArrowRightLeft, Settings, X, Clock, Briefcase
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import toast from 'react-hot-toast'

const R   = '#E6007E', T = '#00C2CB', BLK = '#111111', GRY = '#F9F9F9', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

function StatCard({ label, value, icon: Icon, accent = T, sub, loading }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 18, position: 'relative', overflow: 'hidden', flex: 1, minWidth: 140 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, opacity: .7 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLK, lineHeight: 1 }}>{loading ? '—' : value}</div>
          <div style={{ fontSize: 13, color: '#9a9a96', marginTop: 6, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
          {sub && <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={accent} />
        </div>
      </div>
    </div>
  )
}

const STATUS_COLORS = { active: GRN, paused: AMB, draft: '#9ca3af' }
const STATUS_LABELS = { active: 'Active', paused: 'Paused', draft: 'Draft' }

export default function FrontDeskPage() {
  const { agencyId } = useAuth()
  const isMobile = useMobile()
  const [loading, setLoading] = useState(true)
  const [configs, setConfigs] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, paused: 0, total_calls: 0, total_appointments: 0, total_transfers: 0 })
  const [toggling, setToggling] = useState(null)
  const [promptModal, setPromptModal] = useState(null)
  const [promptLoading, setPromptLoading] = useState(false)
  const [promptText, setPromptText] = useState('')

  useEffect(() => { fetchConfigs() }, [agencyId])

  async function fetchConfigs() {
    setLoading(true)
    try {
      const res = await fetch(`/api/front-desk?action=list&agency_id=${agencyId || ''}`)
      if (res.ok) {
        const data = await res.json()
        setConfigs(data.configs || [])
        setStats({
          total: data.stats?.total || (data.configs || []).length,
          active: data.stats?.active || (data.configs || []).filter(c => c.status === 'active').length,
          paused: data.stats?.paused || (data.configs || []).filter(c => c.status === 'paused').length,
          total_calls: data.stats?.total_calls || 0,
          total_appointments: data.stats?.total_appointments || 0,
          total_transfers: data.stats?.total_transfers || 0,
        })
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function toggleStatus(config) {
    const newAction = config.status === 'active' ? 'pause' : 'activate'
    setToggling(config.client_id)
    try {
      const res = await fetch('/api/front-desk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: newAction, client_id: config.client_id, agency_id: agencyId }),
      })
      if (res.ok) {
        toast.success(newAction === 'activate' ? 'Front desk activated' : 'Front desk paused')
        fetchConfigs()
      } else {
        toast.error('Failed to update status')
      }
    } catch {
      toast.error('Failed to update status')
    }
    setToggling(null)
  }

  async function previewPrompt(config) {
    setPromptModal(config)
    setPromptLoading(true)
    setPromptText('')
    try {
      const res = await fetch(`/api/front-desk?action=preview_prompt&client_id=${config.client_id}`)
      if (res.ok) {
        const data = await res.json()
        setPromptText(data.prompt || data.text || 'No prompt generated.')
      } else {
        setPromptText('Failed to load prompt.')
      }
    } catch {
      setPromptText('Failed to load prompt.')
    }
    setPromptLoading(false)
  }

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY, fontFamily: FB }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '20px 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: BLK, margin: 0, letterSpacing: '-.03em' }}>Virtual Front Desk</h1>
              <p style={{ fontSize: 14, color: '#9ca3af', margin: '4px 0 0', fontFamily: FB }}>AI receptionist for every client</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>{configs.length} config{configs.length !== 1 ? 's' : ''}</span>
              <button onClick={fetchConfigs} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#F5F5F5', color: BLK, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FH }}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
          {/* Stats Row */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard label="Total Configs" value={stats.total} icon={Settings} accent={T} loading={loading} />
            <StatCard label="Active" value={stats.active} icon={Play} accent={GRN} loading={loading} />
            <StatCard label="Paused" value={stats.paused} icon={Pause} accent={AMB} loading={loading} />
            <StatCard label="Total Calls" value={stats.total_calls} icon={Phone} accent={R} loading={loading} />
            <StatCard label="Total Appointments" value={stats.total_appointments} icon={Calendar} accent={T} loading={loading} />
            <StatCard label="Total Transfers" value={stats.total_transfers} icon={ArrowRightLeft} accent={'#7c3aed'} loading={loading} />
          </div>

          {/* Client List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Loader2 size={28} className="spin" color={R} />
            </div>
          ) : configs.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: '48px 32px', textAlign: 'center' }}>
              <PhoneIncoming size={40} color="#d1d5db" style={{ marginBottom: 16 }} />
              <p style={{ fontFamily: FH, fontSize: 16, fontWeight: 600, color: BLK, margin: '0 0 8px' }}>No front desk agents configured yet.</p>
              <p style={{ fontSize: 14, color: '#9ca3af', margin: 0, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                Set up a virtual receptionist from any client's detail page.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {configs.map(cfg => (
                <div key={cfg.client_id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 20, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: STATUS_COLORS[cfg.status] || '#d1d5db', opacity: .7 }} />

                  {/* Top: name + badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, color: BLK }}>{cfg.company_name || cfg.business_name || 'Unnamed'}</div>
                      {cfg.industry && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={11} /> {cfg.industry}</div>}
                    </div>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH,
                      background: (STATUS_COLORS[cfg.status] || '#9ca3af') + '18',
                      color: STATUS_COLORS[cfg.status] || '#9ca3af',
                    }}>
                      {STATUS_LABELS[cfg.status] || cfg.status}
                    </span>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
                    {cfg.phone_number && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} /> {cfg.phone_number}</span>
                    )}
                    {cfg.timezone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {cfg.timezone}</span>
                    )}
                    {typeof cfg.service_count !== 'undefined' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={12} /> {cfg.service_count} service{cfg.service_count !== 1 ? 's' : ''}</span>
                    )}
                    {typeof cfg.staff_count !== 'undefined' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {cfg.staff_count} staff</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => toggleStatus(cfg)}
                      disabled={toggling === cfg.client_id}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: FH, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: cfg.status === 'active' ? AMB + '18' : GRN + '18',
                        color: cfg.status === 'active' ? AMB : GRN,
                      }}
                    >
                      {toggling === cfg.client_id ? <Loader2 size={13} className="spin" /> : cfg.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                      {cfg.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => previewPrompt(cfg)}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, fontFamily: FH, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 5, color: '#374151',
                      }}
                    >
                      <Eye size={13} /> Preview Prompt
                    </button>
                    <button
                      onClick={() => { window.location.href = `/client/${cfg.client_id}#front-desk` }}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, fontFamily: FH, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 5, color: '#374151',
                      }}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Prompt Preview Modal */}
      {promptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setPromptModal(null)}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 640, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK }}>Prompt Preview</div>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>{promptModal.company_name || promptModal.business_name || 'Client'}</div>
              </div>
              <button onClick={() => setPromptModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} color="#9ca3af" />
              </button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {promptLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <Loader2 size={24} className="spin" color={R} />
                  <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>Generating prompt...</p>
                </div>
              ) : (
                <pre style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, margin: 0 }}>
                  {promptText}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
