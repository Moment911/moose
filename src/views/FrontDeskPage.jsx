"use client"
import { useState, useEffect } from 'react'
import {
  Phone, PhoneIncoming, Play, Pause, Eye, Edit2, Loader2, RefreshCw,
  Calendar, Users, ArrowRightLeft, Settings, X, Clock, Briefcase, Zap
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import toast from 'react-hot-toast'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

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
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [clients, setClients] = useState([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [creating, setCreating] = useState(null)
  const [scanning, setScanning] = useState(null)

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
      const res = await fetch(`/api/front-desk?action=preview_prompt&client_id=${config.client_id}&agency_id=${agencyId}`)
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

  async function openClientPicker() {
    setShowClientPicker(true)
    if (clients.length > 0) return
    setClientsLoading(true)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
      const { data } = await sb.from('clients').select('id, name, phone, website, industry').eq('agency_id', agencyId).order('name')
      setClients(data || [])
    } catch { toast.error('Failed to load clients') }
    setClientsLoading(false)
  }

  async function createConfigForClient(cl) {
    setCreating(cl.id)
    try {
      const res = await fetch('/api/front-desk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save', client_id: cl.id, agency_id: agencyId,
          company_name: cl.name || '', phone: cl.phone || '', website: cl.website || '',
          industry: cl.industry || '', timezone: 'America/New_York',
          business_hours: {}, services: [], insurance_accepted: [], staff_directory: [],
          hipaa_mode: false, transfer_enabled: true, sms_enabled: true, status: 'draft',
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success(`Front desk created for ${cl.name}`)
      setShowClientPicker(false)
      fetchConfigs()
    } catch (e) { toast.error(e.message) }
    setCreating(null)
  }

  async function aiScan(cfg) {
    setScanning(cfg.client_id)
    try {
      const res = await fetch('/api/front-desk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_scan', client_id: cfg.client_id, agency_id: agencyId, website: cfg.website, business_name: cfg.company_name }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const sources = [data.sources?.website && 'website', data.sources?.gmb && 'GMB'].filter(Boolean).join(' + ')
      toast.success(`Scanned ${sources} — found ${data.fields_found.length} fields`)
      fetchConfigs()
    } catch (e) { toast.error(e.message) }
    setScanning(null)
  }

  const configuredClientIds = new Set(configs.map(c => c.client_id))

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
              <button onClick={openClientPicker} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none', background: R, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FH }}>
                <PhoneIncoming size={12} /> Configure Client
              </button>
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
              <p style={{ fontSize: 14, color: '#9ca3af', margin: '0 0 16px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                Pick a client to set up their virtual AI receptionist.
              </p>
              <button onClick={openClientPicker} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: R, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <PhoneIncoming size={14} /> Configure a Client
              </button>
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
                      onClick={() => aiScan(cfg)}
                      disabled={scanning === cfg.client_id}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, fontFamily: FH, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 5, color: T, opacity: scanning === cfg.client_id ? 0.5 : 1,
                      }}
                    >
                      {scanning === cfg.client_id ? <Loader2 size={13} className="spin" /> : <Zap size={13} />} AI Scan
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
                      onClick={() => { window.location.href = `/client/${cfg.client_id}?tab=front-desk` }}
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

      {/* Client Picker Modal */}
      {showClientPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowClientPicker(false)}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 500, width: '100%', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK }}>Select a Client</div>
              <button onClick={() => setShowClientPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} color="#9ca3af" />
              </button>
            </div>
            <div style={{ padding: '12px 20px', overflowY: 'auto', flex: 1 }}>
              {clientsLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <Loader2 size={20} className="spin" color={R} />
                  <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>Loading clients...</p>
                </div>
              ) : clients.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 24 }}>No clients found. Add clients first.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {clients.map(cl => {
                    const alreadyConfigured = configuredClientIds.has(cl.id)
                    return (
                      <div key={cl.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 10, border: '1px solid #ececea',
                        background: alreadyConfigured ? '#f9fafb' : '#fff',
                        opacity: alreadyConfigured ? 0.6 : 1,
                      }}>
                        <div>
                          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK }}>{cl.name || 'Unnamed'}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>
                            {[cl.industry, cl.phone, cl.website].filter(Boolean).join(' · ') || 'No details'}
                          </div>
                        </div>
                        {alreadyConfigured ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: GRN, fontFamily: FH }}>Configured</span>
                        ) : (
                          <button onClick={() => createConfigForClient(cl)} disabled={creating === cl.id} style={{
                            padding: '5px 12px', borderRadius: 6, border: 'none', background: R, color: '#fff',
                            fontSize: 11, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4,
                            opacity: creating === cl.id ? 0.5 : 1,
                          }}>
                            {creating === cl.id ? <Loader2 size={11} className="spin" /> : <PhoneIncoming size={11} />} Set Up
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
