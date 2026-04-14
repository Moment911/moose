"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Eye, Plus, Copy, RefreshCw, Loader2, Check, X, Phone, Target,
  Globe, Shield, AlertTriangle, Zap, BarChart2, Users, Clock,
  ExternalLink, ChevronRight, ChevronDown, Trash2, Settings,
  Monitor, Smartphone, Tablet, Cpu, MapPin, Tag, Sparkles, ArrowLeft,
  Fingerprint, Activity, Brain, Hash, Wifi, TrendingUp, Radio,
  MousePointer, FileText, DollarSign, ArrowUpRight, Layers
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'
const W = '#ffffff'

const API = '/api/pixel'
async function apiGet(action, params={}) {
  const url = new URL(API, window.location.origin)
  url.searchParams.set('action', action)
  for (const [k,v] of Object.entries(params)) if (v) url.searchParams.set(k, String(v))
  return (await fetch(url)).json()
}
async function apiPost(body) {
  return (await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })).json()
}

const PLATFORMS = [
  { id:'facebook', name:'Facebook Pixel', color:'#1877F2', desc:'Retargeting + Conversions API' },
  { id:'google', name:'Google Tag / GA4', color:'#4285F4', desc:'Conversions + Remarketing' },
  { id:'tiktok', name:'TikTok Pixel', color:'#000000', desc:'Ad conversions + retargeting' },
  { id:'linkedin', name:'LinkedIn Insight', color:'#0A66C2', desc:'Company identification + retargeting' },
  { id:'twitter', name:'Twitter/X Pixel', color:'#1DA1F2', desc:'Ad conversions' },
  { id:'snapchat', name:'Snapchat Pixel', color:'#FFFC00', desc:'Ad conversions', textColor:'#000' },
]

function scoreColor(s) { return s >= 80 ? R : s >= 60 ? AMB : s >= 40 ? T : '#9ca3af' }
function scoreLabel(s) { return s >= 90 ? 'CALL NOW' : s >= 70 ? 'HOT LEAD' : s >= 50 ? 'WARM' : s >= 30 ? 'WATCHING' : 'COLD' }
function scoreBg(s) { return s >= 70 ? R + '12' : s >= 50 ? AMB + '12' : s >= 30 ? T + '12' : '#f3f4f6' }

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function DeviceIcon({ type, size = 16, color = '#6b7280' }) {
  if (type === 'mobile') return <Smartphone size={size} color={color} />
  if (type === 'tablet') return <Tablet size={size} color={color} />
  return <Monitor size={size} color={color} />
}

/* ── Card style constant ─────────────────────────────────────────────── */
const card = { background: W, borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }
const cardInner = { ...card, padding: '20px 24px' }

export default function PixelTrackingPage() {
  const { agencyId } = useAuth()
  const [tab, setTab] = useState('live')
  const [pixels, setPixels] = useState([])
  const [sessions, setSessions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState({})
  const [integrations, setIntegrations] = useState([])
  const [profiles, setProfiles] = useState([])
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [profileDetail, setProfileDetail] = useState(null)
  const [generatingPersona, setGeneratingPersona] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showIntegrate, setShowIntegrate] = useState(null)
  const [newPixel, setNewPixel] = useState({ pixel_name:'', domain:'', auto_create_lead:true })
  const [createdPixel, setCreatedPixel] = useState(null)
  const [newIntegration, setNewIntegration] = useState({ platform_pixel_id:'', config:{} })

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    if (tab !== 'live') return
    const interval = setInterval(() => {
      apiGet('get_live', { agency_id: agencyId }).then(r => setSessions(r.data || []))
      apiGet('get_alerts', { agency_id: agencyId }).then(r => setAlerts(r.data || []))
    }, 5000)
    return () => clearInterval(interval)
  }, [tab, agencyId])

  async function loadAll() {
    setLoading(true)
    const [pixRes, sessRes, alertRes, statRes, intRes, profRes] = await Promise.all([
      apiGet('get_pixels', { agency_id: agencyId }),
      apiGet('get_live', { agency_id: agencyId }),
      apiGet('get_alerts', { agency_id: agencyId }),
      apiGet('get_stats', { agency_id: agencyId }),
      apiGet('get_integrations', { agency_id: agencyId }),
      apiGet('get_profiles', { agency_id: agencyId }),
    ])
    setPixels(pixRes.data || [])
    setSessions(sessRes.data || [])
    setAlerts(alertRes.data || [])
    setStats(statRes)
    setIntegrations(intRes.data || [])
    setProfiles(profRes.data || [])
    setLoading(false)
  }

  async function openProfile(profileId) {
    setSelectedProfile(profileId)
    setProfileDetail(null)
    const res = await apiGet('get_profile', { agency_id: agencyId, profile_id: profileId })
    setProfileDetail(res)
  }

  async function generatePersona(profileId) {
    setGeneratingPersona(true)
    const res = await apiPost({ action: 'generate_persona', profile_id: profileId })
    if (res.success) {
      toast.success('Persona generated')
      const updated = await apiGet('get_profile', { agency_id: agencyId, profile_id: profileId })
      setProfileDetail(updated)
      const profRes = await apiGet('get_profiles', { agency_id: agencyId })
      setProfiles(profRes.data || [])
    } else {
      toast.error(res.error || 'Failed to generate persona')
    }
    setGeneratingPersona(false)
  }

  async function createPixel() {
    if (!newPixel.pixel_name || !newPixel.domain) { toast.error('Name and domain required'); return }
    const res = await apiPost({ action:'create_pixel', agency_id:agencyId, ...newPixel })
    if (res.success) { setCreatedPixel(res.pixel); toast.success('Pixel created'); loadAll() }
    else toast.error(res.error || 'Failed')
  }

  async function addIntegration(platform) {
    if (!newIntegration.platform_pixel_id) { toast.error('Pixel/Tag ID required'); return }
    const res = await apiPost({ action:'add_integration', agency_id:agencyId, platform, ...newIntegration })
    if (res.success) { toast.success(`${platform} connected`); setShowIntegrate(null); loadAll() }
    else toast.error(res.error || 'Failed')
  }

  async function dismissAlert(id) {
    await apiPost({ action:'dismiss_alert', alert_id:id })
    setAlerts(a => a.filter(x => x.id !== id))
  }

  function copyCode(text) {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const TABS = [
    { key:'live', label:'Live', icon:Radio },
    { key:'visitors', label:`Visitors${profiles.length ? ` (${profiles.length})` : ''}`, icon:Users },
    { key:'pixels', label:'Pixels', icon:Layers },
    { key:'integrations', label:'Integrations', icon:Settings },
  ]

  const hotCount = sessions.filter(s => s.intent_score >= 70).length
  const connectedPlatforms = integrations.filter(i => i.status === 'active').length

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background: W, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ background: W, borderBottom: '1px solid #e5e7eb', padding: '28px 40px 0', flexShrink: 0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 24 }}>
            <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: BLK, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Eye size={22} color={W} />
              </div>
              <div>
                <h1 style={{ fontFamily: FH, fontSize: 26, fontWeight: 800, color: BLK, margin: 0, letterSpacing: '-.03em' }}>
                  Visitor Intelligence
                </h1>
                <div style={{ display:'flex', alignItems:'center', gap: 12, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: '#6b7280', fontFamily: FB }}>
                    Real-time visitor tracking & behavioral analysis
                  </span>
                  {sessions.length > 0 && (
                    <span style={{ display:'flex', alignItems:'center', gap: 6, fontSize: 12, fontWeight: 700, color: GRN, fontFamily: FH }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: GRN, animation: 'pulse 1.5s infinite', boxShadow: `0 0 8px ${GRN}60` }} />
                      {sessions.length} live
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
              <button onClick={loadAll} style={{ padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb', background: W, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                title="Refresh">
                <RefreshCw size={16} color="#6b7280" />
              </button>
              <button onClick={() => setShowCreate(true)} style={{
                display:'flex', alignItems:'center', gap: 8, padding:'10px 22px', borderRadius: 10, border:'none',
                background: BLK, color: W, fontSize: 14, fontWeight: 700, fontFamily: FH, cursor:'pointer',
                transition: 'opacity .15s',
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                <Plus size={15} /> Add Pixel
              </button>
            </div>
          </div>

          {/* ── Stats Strip ──────────────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Live Now', value: sessions.length, accent: GRN, icon: Radio },
              { label: 'Visits Today', value: stats.visits_today || 0, accent: T, icon: Eye },
              { label: 'Identified', value: stats.identified || 0, accent: AMB, icon: Fingerprint },
              { label: 'Hot Visitors', value: hotCount || stats.hot_visitors || 0, accent: R, icon: Zap },
              { label: 'Leads Created', value: stats.leads_created || 0, accent: GRN, icon: Target },
            ].map(s => (
              <div key={s.label} style={{
                padding: '14px 18px', background: W, borderRadius: 12, border: '1px solid #e5e7eb',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position:'absolute', top: 0, left: 0, right: 0, height: 3, background: s.accent, opacity: 0.6, borderRadius: '12px 12px 0 0' }} />
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 800, color: BLK, lineHeight: 1, letterSpacing: '-.03em' }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: s.accent + '12', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <s.icon size={16} color={s.accent} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <div style={{ display:'flex', gap: 0 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); if (t.key !== 'visitors') { setSelectedProfile(null); setProfileDetail(null) } }} style={{
                display:'flex', alignItems:'center', gap: 7, padding:'12px 24px', fontSize: 14, fontWeight: tab===t.key ? 700 : 500, fontFamily: FH,
                border:'none', borderBottom: tab===t.key ? `2px solid ${BLK}` : '2px solid transparent',
                background:'none', cursor:'pointer', color: tab===t.key ? BLK : '#9ca3af',
                transition: 'color .12s',
              }}>
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY:'auto', padding:'32px 40px 48px' }}>

          {/* ── Alerts Banner ────────────────────────────────────────────── */}
          {alerts.length > 0 && tab === 'live' && (
            <div style={{ marginBottom: 24 }}>
              {alerts.slice(0,3).map(alert => (
                <div key={alert.id} style={{
                  display:'flex', alignItems:'center', gap: 14, padding:'14px 20px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)', border: `1px solid ${R}20`, marginBottom: 8,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: R + '15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}>
                    <Zap size={18} color={R} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, color: BLK }}>{alert.company_name || 'Hot Visitor'}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', fontFamily: FB }}>{alert.alert_message}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: R }}>{alert.intent_score || 0}</div>
                  <button onClick={() => dismissAlert(alert.id)} style={{ background:'none', border:'none', cursor:'pointer', padding: 4 }}>
                    <X size={16} color="#9ca3af" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
             LIVE VISITORS TAB
             ══════════════════════════════════════════════════════════════ */}
          {tab === 'live' && (
            <div>
              {loading && (
                <div style={{ textAlign:'center', padding: 60 }}>
                  <Loader2 size={28} color={BLK} style={{ animation:'spin 1s linear infinite' }} />
                </div>
              )}
              {!loading && sessions.length === 0 && (
                <div style={{ textAlign:'center', padding:'80px 20px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                    <Eye size={28} color="#d1d5db" />
                  </div>
                  <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin:'0 0 8px' }}>No Live Visitors</h3>
                  <p style={{ fontSize: 14, color:'#6b7280', fontFamily: FB, maxWidth: 400, margin:'0 auto' }}>
                    Visitors will appear here in real time once your pixel is installed on a website.
                  </p>
                </div>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
                {sessions.map(s => {
                  const isHot = s.intent_score >= 70
                  return (
                    <div key={s.id} onClick={() => { if (s.visitor_profile_id) { setTab('visitors'); openProfile(s.visitor_profile_id) } }}
                      style={{
                        ...cardInner,
                        borderLeft: `4px solid ${scoreColor(s.intent_score)}`,
                        cursor: s.visitor_profile_id ? 'pointer' : 'default',
                        transition: 'box-shadow .15s, transform .15s',
                        ...(isHot ? { background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)' } : {}),
                      }}
                      onMouseEnter={e => { if (s.visitor_profile_id) { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.06)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}>

                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom: 12 }}>
                        <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: scoreColor(s.intent_score) + '12',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>
                            <DeviceIcon type={s.device_type} size={20} color={scoreColor(s.intent_score)} />
                          </div>
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>{s.identified_company || 'Unknown Visitor'}</span>
                              {isHot && (
                                <span style={{ padding:'2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: R + '15', color: R }}>
                                  {scoreLabel(s.intent_score)}
                                </span>
                              )}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap: 10, marginTop: 3 }}>
                              {s.identified_city && (
                                <span style={{ display:'flex', alignItems:'center', gap: 3, fontSize: 13, color:'#6b7280', fontFamily: FB }}>
                                  <MapPin size={12} /> {s.identified_city}, {s.identified_state}
                                </span>
                              )}
                              {s.identified_domain && <span style={{ fontSize: 13, color: T, fontFamily: FB }}>{s.identified_domain}</span>}
                              {s.browser && <span style={{ fontSize: 12, color:'#9ca3af', fontFamily: FB }}>{s.browser}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Intent Score */}
                        <div style={{ textAlign:'center', minWidth: 56 }}>
                          <div style={{
                            fontSize: 28, fontWeight: 800, fontFamily: FH, color: scoreColor(s.intent_score),
                            lineHeight: 1,
                          }}>{s.intent_score || 0}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color:'#9ca3af', fontFamily: FH, textTransform:'uppercase', letterSpacing:'.06em', marginTop: 2 }}>intent</div>
                        </div>
                      </div>

                      {/* Data Row */}
                      <div style={{ display:'flex', gap: 16, fontSize: 13, color:'#6b7280', fontFamily: FB, flexWrap:'wrap', alignItems:'center' }}>
                        {s.pages_viewed?.length > 0 && (
                          <span style={{ display:'flex', alignItems:'center', gap: 4 }}>
                            <FileText size={12} /> {s.pages_viewed.length} page{s.pages_viewed.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {s.time_on_site_seconds > 0 && (
                          <span style={{ display:'flex', alignItems:'center', gap: 4 }}>
                            <Clock size={12} /> {Math.floor(s.time_on_site_seconds/60)}m {s.time_on_site_seconds%60}s
                          </span>
                        )}
                        {s.scroll_depth_percent > 0 && (
                          <span style={{ display:'flex', alignItems:'center', gap: 4 }}>
                            <ArrowUpRight size={12} /> {s.scroll_depth_percent}% scrolled
                          </span>
                        )}
                        {s.submitted_form && <span style={{ color: GRN, fontWeight: 700 }}>Form submitted</span>}
                        {s.clicked_cta && <span style={{ color: AMB, fontWeight: 700 }}>CTA clicked</span>}
                        {s.viewed_pricing && <span style={{ color: R, fontWeight: 700 }}>Viewed pricing</span>}
                        {s.utm_source && (
                          <span style={{ padding:'2px 8px', borderRadius: 20, background:'#f3f4f6', fontSize: 11 }}>
                            {s.utm_source}{s.utm_medium ? `/${s.utm_medium}` : ''}
                          </span>
                        )}
                      </div>

                      {/* Signals */}
                      {s.intent_signals?.length > 0 && (
                        <div style={{ display:'flex', gap: 6, flexWrap:'wrap', marginTop: 10 }}>
                          {s.intent_signals.slice(0,5).map((sig,i) => (
                            <span key={i} style={{
                              padding:'3px 10px', borderRadius: 20, fontSize: 11, fontFamily: FB, fontWeight: 600,
                              background: i === 0 ? scoreColor(s.intent_score) + '10' : '#f3f4f6',
                              color: i === 0 ? scoreColor(s.intent_score) : '#6b7280',
                            }}>{sig.split('--')[0].trim()}</span>
                          ))}
                        </div>
                      )}

                      {/* Landing page */}
                      {s.landing_page && (
                        <div style={{ fontSize: 12, color:'#9ca3af', fontFamily: FB, marginTop: 8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {s.landing_page.replace(/https?:\/\/[^/]+/, '')}
                          {s.referrer && <span> via {s.referrer.replace(/https?:\/\/([^/]+).*/, '$1')}</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
             VISITORS TAB — Profile List
             ══════════════════════════════════════════════════════════════ */}
          {tab === 'visitors' && !selectedProfile && (
            <div>
              {profiles.length === 0 && !loading && (
                <div style={{ textAlign:'center', padding:'80px 20px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                    <Users size={28} color="#d1d5db" />
                  </div>
                  <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin:'0 0 8px' }}>No Visitor Profiles Yet</h3>
                  <p style={{ fontSize: 14, color:'#6b7280', fontFamily: FB, maxWidth: 440, margin:'0 auto' }}>
                    Visitor profiles are created automatically when someone visits a site with your pixel installed.
                  </p>
                </div>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
                {profiles.map(p => {
                  const sc = p.max_intent_score || 0
                  return (
                    <div key={p.id} onClick={() => openProfile(p.id)} style={{
                      ...cardInner,
                      borderLeft: `4px solid ${scoreColor(sc)}`,
                      cursor:'pointer', transition:'box-shadow .15s, transform .15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.06)'; e.currentTarget.style.transform='translateY(-1px)' }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none' }}>

                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 12, background: scoreColor(sc) + '12',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>
                            <DeviceIcon type={p.device_type} size={20} color={scoreColor(sc)} />
                          </div>
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>
                                {p.label || p.identified_company || `Visitor ${p.fingerprint?.slice(0,8)}`}
                              </span>
                              {sc >= 70 && (
                                <span style={{ padding:'2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: scoreBg(sc), color: scoreColor(sc) }}>
                                  {scoreLabel(sc)}
                                </span>
                              )}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap: 10, marginTop: 3, fontSize: 13, color:'#6b7280', fontFamily: FB }}>
                              {p.city && <span style={{ display:'flex', alignItems:'center', gap: 3 }}><MapPin size={11} /> {p.city}, {p.state}</span>}
                              <span>{p.browser} / {p.os}</span>
                              {p.identified_domain && <span style={{ color: T }}>{p.identified_domain}</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign:'center', minWidth: 56 }}>
                          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FH, color: scoreColor(sc), lineHeight: 1 }}>{sc}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color:'#9ca3af', fontFamily: FH, textTransform:'uppercase', letterSpacing:'.06em', marginTop: 2 }}>max intent</div>
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div style={{ display:'flex', gap: 20, fontSize: 13, color:'#6b7280', fontFamily: FB, marginBottom: 8 }}>
                        <span style={{ display:'flex', alignItems:'center', gap: 4 }}><Activity size={12} /> {p.total_sessions || 0} sessions</span>
                        <span style={{ display:'flex', alignItems:'center', gap: 4 }}><FileText size={12} /> {p.total_pageviews || 0} pages</span>
                        <span style={{ display:'flex', alignItems:'center', gap: 4 }}><Clock size={12} /> {Math.round((p.total_time_seconds || 0) / 60)}m total</span>
                        {p.total_form_submits > 0 && <span style={{ color: GRN, fontWeight: 700 }}>{p.total_form_submits} forms</span>}
                        {p.total_cta_clicks > 0 && <span style={{ color: AMB, fontWeight: 700 }}>{p.total_cta_clicks} CTAs</span>}
                      </div>

                      {/* Timeline + Segments */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ fontSize: 12, color:'#9ca3af', fontFamily: FB }}>
                          First: {new Date(p.first_seen_at).toLocaleDateString()} &middot; Last: {timeAgo(p.last_seen_at)}
                        </div>
                        {p.ai_persona?.segments && (
                          <div style={{ display:'flex', gap: 4, flexWrap:'wrap' }}>
                            {p.ai_persona.segments.slice(0,3).map((seg,i) => (
                              <span key={i} style={{ padding:'2px 10px', borderRadius: 20, background:'#f0f9ff', fontSize: 11, fontWeight: 600, color:'#0369a1', fontFamily: FB }}>{seg}</span>
                            ))}
                            {p.ai_persona.buying_stage && (
                              <span style={{
                                padding:'2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FB,
                                background: p.ai_persona.buying_stage === 'decision' ? R + '12' : AMB + '12',
                                color: p.ai_persona.buying_stage === 'decision' ? R : AMB,
                              }}>{p.ai_persona.buying_stage}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Visitor Detail Panel ─────────────────────────────────────── */}
          {tab === 'visitors' && selectedProfile && (
            <VisitorDetailPanel
              profileDetail={profileDetail}
              onBack={() => { setSelectedProfile(null); setProfileDetail(null) }}
              onGeneratePersona={() => generatePersona(selectedProfile)}
              generatingPersona={generatingPersona}
            />
          )}

          {/* ══════════════════════════════════════════════════════════════
             PIXEL MANAGER TAB
             ══════════════════════════════════════════════════════════════ */}
          {tab === 'pixels' && (
            <div>
              {pixels.length === 0 && (
                <div style={{ textAlign:'center', padding:'80px 20px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                    <Layers size={28} color="#d1d5db" />
                  </div>
                  <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin:'0 0 8px' }}>No Pixels Yet</h3>
                  <p style={{ fontSize: 14, color:'#6b7280', fontFamily: FB, maxWidth: 400, margin:'0 auto', marginBottom: 20 }}>
                    Create your first tracking pixel to start identifying website visitors.
                  </p>
                  <button onClick={() => setShowCreate(true)} style={{
                    padding:'12px 28px', borderRadius: 10, border:'none', background: BLK, color: W,
                    fontSize: 14, fontWeight: 700, fontFamily: FH, cursor:'pointer',
                  }}>
                    <Plus size={15} style={{ verticalAlign:'middle', marginRight: 8 }} /> Create Pixel
                  </button>
                </div>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
                {pixels.map(p => (
                  <div key={p.id} style={{ ...cardInner, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap: 16 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, background: p.is_active ? T + '12' : '#f3f4f6',
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        <Globe size={20} color={p.is_active ? T : '#9ca3af'} />
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FH, color: BLK }}>{p.pixel_name}</div>
                        <div style={{ fontSize: 13, color: T, fontFamily: FB, marginTop: 2 }}>{p.domain}</div>
                        <div style={{ display:'flex', gap: 16, fontSize: 12, color:'#9ca3af', fontFamily: FB, marginTop: 4 }}>
                          <span>ID: <code style={{ fontFamily:'monospace', fontSize: 11, background:'#f3f4f6', padding:'1px 6px', borderRadius: 4 }}>{p.pixel_id}</code></span>
                          <span>{p.total_visits || 0} visits</span>
                          <span>{p.total_leads_created || 0} leads</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                      <span style={{
                        padding:'4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: FH,
                        background: p.is_active ? GRN + '12' : '#f3f4f6', color: p.is_active ? GRN : '#9ca3af',
                      }}>{p.is_active ? 'Active' : 'Inactive'}</span>
                      <button onClick={() => copyCode(`<script src="https://hellokoto.com/api/pixel?id=${p.pixel_id}" async></script>`)} style={{
                        display:'flex', alignItems:'center', gap: 6, padding:'8px 16px', borderRadius: 8,
                        border:'1px solid #e5e7eb', background: W, fontSize: 13, fontWeight: 600, fontFamily: FB,
                        cursor:'pointer', color: BLK, transition:'background .12s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = W}>
                        <Copy size={13} /> Copy Code
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
             INTEGRATIONS TAB
             ══════════════════════════════════════════════════════════════ */}
          {tab === 'integrations' && (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: T + '10', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Settings size={18} color={T} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>Connected Platforms</div>
                  <div style={{ fontSize: 13, color:'#6b7280', marginTop: 1 }}>{connectedPlatforms} of {PLATFORMS.length} platforms connected</div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 16 }}>
                {PLATFORMS.map(plat => {
                  const connected = integrations.find(i => i.platform === plat.id && i.status === 'active')
                  return (
                    <div key={plat.id} onClick={() => { setShowIntegrate(plat.id); setNewIntegration({ platform_pixel_id:'', config:{} }) }} style={{
                      ...cardInner, cursor:'pointer', transition:'all .15s',
                      border: connected ? `1.5px solid ${GRN}40` : '1px solid #e5e7eb',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.06)'; e.currentTarget.style.transform='translateY(-1px)' }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10, background: plat.color + '12',
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                          <Globe size={18} color={plat.color} />
                        </div>
                        <span style={{
                          padding:'4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH,
                          background: connected ? GRN + '12' : '#f3f4f6', color: connected ? GRN : '#9ca3af',
                        }}>
                          {connected ? 'Connected' : 'Setup'}
                        </span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FH, color: plat.textColor || BLK, marginBottom: 4 }}>{plat.name}</div>
                      <div style={{ fontSize: 13, color:'#6b7280', fontFamily: FB }}>{plat.desc}</div>
                      {connected && (
                        <div style={{ display:'flex', gap: 12, marginTop: 12, fontSize: 12, color:'#6b7280', fontFamily: FB }}>
                          <span>{connected.events_sent_today || 0} events today</span>
                          <span>{connected.events_sent_total || 0} total</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── CREATE PIXEL MODAL ─────────────────────────────────────────── */}
        {showCreate && (
          <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
            <div style={{ background: W, borderRadius: 16, padding: 32, width: 520, maxWidth:'95vw', maxHeight:'85vh', overflow:'auto' }}>
              {!createdPixel ? (
                <>
                  <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin:'0 0 20px' }}>Create Tracking Pixel</h3>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display:'block', fontSize: 11, fontWeight: 700, color:'#9ca3af', fontFamily: FH, textTransform:'uppercase', letterSpacing:'.06em', marginBottom: 6 }}>Pixel Name</label>
                    <input value={newPixel.pixel_name} onChange={e => setNewPixel(p => ({...p, pixel_name:e.target.value}))}
                      placeholder="e.g. Main Website"
                      style={{ width:'100%', padding:'12px 16px', borderRadius: 10, border:'1px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing:'border-box', outline:'none' }}
                      onFocus={e => e.target.style.borderColor = BLK} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display:'block', fontSize: 11, fontWeight: 700, color:'#9ca3af', fontFamily: FH, textTransform:'uppercase', letterSpacing:'.06em', marginBottom: 6 }}>Domain</label>
                    <input value={newPixel.domain} onChange={e => setNewPixel(p => ({...p, domain:e.target.value}))}
                      placeholder="e.g. example.com"
                      style={{ width:'100%', padding:'12px 16px', borderRadius: 10, border:'1px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing:'border-box', outline:'none' }}
                      onFocus={e => e.target.style.borderColor = BLK} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                  <label style={{ display:'flex', alignItems:'center', gap: 8, fontSize: 13, fontFamily: FB, color: BLK, cursor:'pointer', marginBottom: 24 }}>
                    <input type="checkbox" checked={newPixel.auto_create_lead} onChange={e => setNewPixel(p => ({...p, auto_create_lead:e.target.checked}))} style={{ accentColor: BLK, width: 16, height: 16 }} />
                    Auto-create leads from high-intent visitors
                  </label>
                  <div style={{ display:'flex', gap: 10, justifyContent:'flex-end' }}>
                    <button onClick={() => { setShowCreate(false); setCreatedPixel(null) }} style={{
                      padding:'10px 22px', borderRadius: 10, border:'1px solid #e5e7eb', background: W,
                      fontSize: 14, fontWeight: 600, fontFamily: FB, cursor:'pointer', color:'#6b7280',
                    }}>Cancel</button>
                    <button onClick={createPixel} style={{
                      padding:'10px 22px', borderRadius: 10, border:'none', background: BLK, color: W,
                      fontSize: 14, fontWeight: 700, fontFamily: FH, cursor:'pointer',
                    }}>Create Pixel</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ textAlign:'center', marginBottom: 20 }}>
                    <div style={{ width: 52, height: 52, borderRadius:'50%', background: GRN + '12', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                      <Check size={26} color={GRN} />
                    </div>
                    <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin:'0 0 6px' }}>Pixel Created</h3>
                    <p style={{ fontSize: 13, color:'#6b7280', fontFamily: FB }}>Add this code before the closing &lt;/body&gt; tag:</p>
                  </div>
                  <div style={{ background:'#111', borderRadius: 12, padding:'16px 20px', marginBottom: 20, position:'relative' }}>
                    <code style={{ fontSize: 13, color:'#a3e635', fontFamily:'monospace', wordBreak:'break-all', lineHeight: 1.6 }}>
                      {`<script src="https://hellokoto.com/api/pixel?id=${createdPixel.pixel_id}" async></script>`}
                    </code>
                    <button onClick={() => copyCode(`<script src="https://hellokoto.com/api/pixel?id=${createdPixel.pixel_id}" async></script>`)} style={{
                      position:'absolute', top: 10, right: 10, padding:'5px 10px', borderRadius: 6,
                      border:'none', background:'rgba(255,255,255,.15)', color: W, fontSize: 12, fontFamily: FB, cursor:'pointer',
                      display:'flex', alignItems:'center', gap: 4,
                    }}>
                      <Copy size={11} /> Copy
                    </button>
                  </div>
                  <button onClick={() => { setShowCreate(false); setCreatedPixel(null); setNewPixel({ pixel_name:'', domain:'', auto_create_lead:true }) }} style={{
                    width:'100%', padding:'12px', borderRadius: 10, border:'none', background: BLK, color: W,
                    fontSize: 14, fontWeight: 700, fontFamily: FH, cursor:'pointer',
                  }}>Done</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── INTEGRATION MODAL ──────────────────────────────────────────── */}
        {showIntegrate && <IntegrationModal platform={showIntegrate} onClose={() => setShowIntegrate(null)} newIntegration={newIntegration} setNewIntegration={setNewIntegration} onConnect={() => addIntegration(showIntegrate)} />}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   VISITOR DETAIL PANEL
   ══════════════════════════════════════════════════════════════════════════ */

function VisitorDetailPanel({ profileDetail, onBack, onGeneratePersona, generatingPersona }) {
  if (!profileDetail?.profile) {
    return (
      <div style={{ textAlign:'center', padding: 80 }}>
        <Loader2 size={28} color={BLK} style={{ animation:'spin 1s linear infinite' }} />
      </div>
    )
  }

  const p = profileDetail.profile
  const sessions = profileDetail.sessions || []
  const persona = p.ai_persona
  const sc = p.max_intent_score || 0

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} style={{
        display:'flex', alignItems:'center', gap: 6, background:'none', border:'none', cursor:'pointer',
        color:'#6b7280', fontSize: 13, fontFamily: FH, fontWeight: 700, marginBottom: 20, padding: 0,
      }}>
        <ArrowLeft size={15} /> All Visitors
      </button>

      {/* Header */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 28,
        padding:'24px 28px', background: W, borderRadius: 14, border:'1px solid #e5e7eb',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: scoreColor(sc) + '12',
            display:'flex', alignItems:'center', justifyContent:'center',
            border: `2px solid ${scoreColor(sc)}30`,
          }}>
            <DeviceIcon type={p.device_type} size={24} color={scoreColor(sc)} />
          </div>
          <div>
            <h2 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, margin: 0, letterSpacing:'-.02em' }}>
              {p.label || p.identified_company || `Visitor ${p.fingerprint?.slice(0,8)}`}
            </h2>
            <div style={{ display:'flex', alignItems:'center', gap: 12, marginTop: 4, fontSize: 13, color:'#6b7280', fontFamily: FB }}>
              {p.city && <span style={{ display:'flex', alignItems:'center', gap: 3 }}><MapPin size={12} /> {p.city}, {p.state}</span>}
              {p.identified_domain && <span style={{ color: T }}>{p.identified_domain}</span>}
              <span>First seen {new Date(p.first_seen_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize: 36, fontWeight: 800, fontFamily: FH, color: scoreColor(sc), lineHeight: 1 }}>{sc}</div>
          <div style={{
            fontSize: 11, fontWeight: 700, fontFamily: FH, color: scoreColor(sc), textTransform:'uppercase',
            letterSpacing:'.06em', marginTop: 4,
          }}>{scoreLabel(sc)}</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 20 }}>
        {/* ── Left Column ─────────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap: 20 }}>

          {/* Behavioral Stats */}
          <div style={{ background: W, borderRadius: 14, border:'1px solid #e5e7eb', padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 18 }}>
              <Activity size={16} color={T} />
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Behavioral Data</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label:'Sessions', value: p.total_sessions || 0, accent: T },
                { label:'Pageviews', value: p.total_pageviews || 0, accent: T },
                { label:'Total Time', value: `${Math.round((p.total_time_seconds||0)/60)}m`, accent: AMB },
                { label:'Forms', value: p.total_form_submits || 0, accent: GRN },
                { label:'CTA Clicks', value: p.total_cta_clicks || 0, accent: AMB },
                { label:'Latest Intent', value: p.latest_intent_score || 0, accent: scoreColor(p.latest_intent_score) },
              ].map(s => (
                <div key={s.label} style={{
                  padding:'12px 14px', background: '#fafafa', borderRadius: 10,
                  position:'relative', overflow:'hidden',
                }}>
                  <div style={{ position:'absolute', top: 0, left: 0, width: 3, height:'100%', background: s.accent, borderRadius: '10px 0 0 10px' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color:'#9ca3af', fontFamily: FH, textTransform:'uppercase', letterSpacing:'.06em' }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, color: BLK, marginTop: 4 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Device & Technology */}
          <div style={{ background: W, borderRadius: 14, border:'1px solid #e5e7eb', padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 18 }}>
              <Cpu size={16} color={R} />
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Device & Technology</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 0 }}>
              {[
                ['Browser', `${p.browser || '?'} ${p.browser_version || ''}`],
                ['OS', `${p.os || '?'} ${p.os_version || ''}`],
                ['Device', p.device_type],
                ['Screen', p.screen_resolution],
                ['Colors', p.color_depth ? `${p.color_depth}-bit` : null],
                ['CPU', p.hardware_concurrency ? `${p.hardware_concurrency} cores` : null],
                ['GPU', p.gpu_renderer?.slice(0, 40)],
                ['Touch', p.touch_support ? 'Yes' : 'No'],
                ['Connection', p.connection_type],
                ['Timezone', p.timezone],
                ['Language', p.language],
                ['Platform', p.platform],
              ].filter(([,v]) => v).map(([label, value]) => (
                <div key={label} style={{ display:'flex', padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                  <div style={{ width: 90, fontSize: 12, fontWeight: 700, color:'#9ca3af', fontFamily: FH }}>{label}</div>
                  <div style={{ flex: 1, fontSize: 13, color: BLK, fontFamily: FB }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Identity */}
          <div style={{ background: W, borderRadius: 14, border:'1px solid #e5e7eb', padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 18 }}>
              <Fingerprint size={16} color={AMB} />
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Identity</div>
            </div>
            {[
              ['Fingerprint', p.fingerprint],
              ['Company', p.identified_company],
              ['Domain', p.identified_domain],
              ['Email', p.identified_email],
              ['Phone', p.identified_phone],
            ].filter(([,v]) => v).map(([label, value]) => (
              <div key={label} style={{ display:'flex', padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                <div style={{ width: 90, fontSize: 12, fontWeight: 700, color:'#9ca3af', fontFamily: FH }}>{label}</div>
                <div style={{ flex: 1, fontSize: 13, color: BLK, fontFamily: FB, overflow:'hidden', textOverflow:'ellipsis' }}>{value}</div>
              </div>
            ))}
            {p.tags?.length > 0 && (
              <div style={{ display:'flex', gap: 6, flexWrap:'wrap', marginTop: 12 }}>
                {p.tags.map((t, i) => (
                  <span key={i} style={{ padding:'3px 10px', borderRadius: 20, background:'#f3f4f6', fontSize: 12, fontWeight: 600, color: BLK, fontFamily: FB }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column ────────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap: 20 }}>

          {/* AI Persona */}
          <div style={{
            background: W, borderRadius: 14, padding:'20px 24px',
            border: persona ? `1.5px solid ${T}30` : '1px solid #e5e7eb',
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 18 }}>
              <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                <Brain size={16} color={T} />
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>AI Persona</div>
              </div>
              <button onClick={onGeneratePersona} disabled={generatingPersona} style={{
                display:'flex', alignItems:'center', gap: 6, padding:'7px 16px', borderRadius: 8,
                border:'1px solid #e5e7eb', background: W, fontSize: 12, fontWeight: 700, fontFamily: FH,
                cursor:'pointer', color: T, opacity: generatingPersona ? 0.5 : 1, transition:'all .12s',
              }}
                onMouseEnter={e => { if (!generatingPersona) e.currentTarget.style.background = '#f9fafb' }}
                onMouseLeave={e => e.currentTarget.style.background = W}>
                {generatingPersona ? <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                {persona ? 'Regenerate' : 'Generate'}
              </button>
            </div>

            {persona ? (
              <div>
                <p style={{ fontSize: 14, color: BLK, fontFamily: FB, lineHeight: 1.7, margin:'0 0 16px' }}>{persona.summary}</p>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label:'Role', value: persona.likely_role },
                    { label:'Buying Stage', value: persona.buying_stage },
                    { label:'Engagement', value: persona.engagement_level },
                    { label:'Device Persona', value: persona.device_persona },
                    { label:'Traffic Quality', value: persona.traffic_quality },
                    { label:'Predicted Value', value: persona.predicted_value },
                  ].filter(x => x.value).map(x => (
                    <div key={x.label} style={{ padding:'10px 12px', background:'#f0f9ff', borderRadius: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color:'#6b7280', fontFamily: FH, textTransform:'uppercase', letterSpacing:'.04em' }}>{x.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color:'#0369a1', fontFamily: FB, textTransform:'capitalize', marginTop: 3 }}>{x.value}</div>
                    </div>
                  ))}
                </div>

                {persona.segments?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color:'#9ca3af', fontFamily: FH, textTransform:'uppercase', letterSpacing:'.06em', marginBottom: 6 }}>Segments</div>
                    <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
                      {persona.segments.map((s,i) => <span key={i} style={{ padding:'3px 12px', borderRadius: 20, background:'#f0f9ff', fontSize: 12, fontWeight: 600, color:'#0369a1', fontFamily: FB }}>{s}</span>)}
                    </div>
                  </div>
                )}

                {persona.interests?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color:'#9ca3af', fontFamily: FH, textTransform:'uppercase', letterSpacing:'.06em', marginBottom: 6 }}>Interests</div>
                    <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
                      {persona.interests.map((s,i) => <span key={i} style={{ padding:'3px 12px', borderRadius: 20, background:'#fef3c7', fontSize: 12, fontWeight: 600, color:'#92400e', fontFamily: FB }}>{s}</span>)}
                    </div>
                  </div>
                )}

                {persona.recommended_action && (
                  <div style={{ padding:'14px 18px', background: GRN + '08', borderRadius: 12, border: `1px solid ${GRN}20`, marginTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRN, fontFamily: FH, textTransform:'uppercase', letterSpacing:'.06em', marginBottom: 4 }}>Recommended Action</div>
                    <div style={{ fontSize: 14, color: BLK, fontFamily: FB, fontWeight: 600 }}>{persona.recommended_action}</div>
                  </div>
                )}

                {persona.best_time_to_reach && (
                  <div style={{ fontSize: 13, color:'#6b7280', fontFamily: FB, marginTop: 12 }}>
                    <Clock size={12} style={{ verticalAlign:'middle', marginRight: 4 }} />
                    Best time to reach: <strong style={{ color: BLK }}>{persona.best_time_to_reach}</strong>
                  </div>
                )}

                {p.ai_persona_generated_at && (
                  <div style={{ fontSize: 12, color:'#9ca3af', fontFamily: FB, marginTop: 10 }}>Generated {timeAgo(p.ai_persona_generated_at)}</div>
                )}
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'32px 0' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                  <Brain size={24} color="#d1d5db" />
                </div>
                <p style={{ fontSize: 14, color:'#6b7280', fontFamily: FB, maxWidth: 280, margin:'0 auto' }}>
                  Generate an AI behavioral profile for this visitor.
                </p>
              </div>
            )}
          </div>

          {/* Top Pages */}
          {p.top_pages?.length > 0 && (
            <div style={{ background: W, borderRadius: 14, border:'1px solid #e5e7eb', padding:'20px 24px' }}>
              <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 16 }}>
                <FileText size={16} color={T} />
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Top Pages</div>
              </div>
              {p.top_pages.slice(0,10).map((pg,i) => (
                <div key={i} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'10px 0', borderBottom: i < Math.min(p.top_pages.length, 10) - 1 ? '1px solid #f3f4f6' : 'none',
                }}>
                  <div style={{ fontSize: 13, color: BLK, fontFamily: FB, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex: 1, marginRight: 12 }}>
                    {pg.title || pg.url}
                  </div>
                  <span style={{
                    padding:'2px 10px', borderRadius: 20, background:'#f3f4f6', fontSize: 12, fontWeight: 700,
                    color:'#6b7280', fontFamily: FH, flexShrink: 0,
                  }}>{pg.views}x</span>
                </div>
              ))}
            </div>
          )}

          {/* Session History */}
          <div style={{ background: W, borderRadius: 14, border:'1px solid #e5e7eb', padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 16 }}>
              <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                <Clock size={16} color={AMB} />
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Session History</div>
              </div>
              <span style={{ fontSize: 12, color:'#9ca3af', fontFamily: FB }}>{sessions.length} sessions</span>
            </div>
            {sessions.slice(0, 15).map((sess, i) => (
              <div key={i} style={{ padding:'12px 0', borderBottom: i < Math.min(sessions.length, 15) - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FH, color: BLK }}>{new Date(sess.started_at).toLocaleString()}</span>
                  <span style={{
                    fontSize: 13, fontWeight: 800, fontFamily: FH, color: scoreColor(sess.intent_score),
                    padding:'2px 10px', borderRadius: 20, background: scoreBg(sess.intent_score),
                  }}>{sess.intent_score || 0}</span>
                </div>
                <div style={{ display:'flex', gap: 10, fontSize: 12, color:'#9ca3af', fontFamily: FB, flexWrap:'wrap' }}>
                  <span>{sess.landing_page?.replace(/https?:\/\/[^/]+/, '') || '/'}</span>
                  {sess.referrer && <span>via {sess.referrer.replace(/https?:\/\/([^/]+).*/, '$1')}</span>}
                  {sess.time_on_site_seconds > 0 && <span>{Math.floor(sess.time_on_site_seconds/60)}m {sess.time_on_site_seconds%60}s</span>}
                  {sess.submitted_form && <span style={{ color: GRN, fontWeight: 700 }}>Form</span>}
                  {sess.clicked_cta && <span style={{ color: AMB, fontWeight: 700 }}>CTA</span>}
                  {sess.viewed_pricing && <span style={{ color: R, fontWeight: 700 }}>Pricing</span>}
                  {sess.utm_source && <span style={{ padding:'1px 8px', borderRadius: 20, background:'#f3f4f6' }}>{sess.utm_source}/{sess.utm_medium}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   INTEGRATION MODAL
   ══════════════════════════════════════════════════════════════════════════ */

const PLATFORM_INSTRUCTIONS = {
  facebook: {
    title: 'Facebook / Meta Pixel',
    idLabel: 'Pixel ID (15-16 digits)',
    placeholder: '1234567890123456',
    steps: [
      { title: 'Go to Meta Business Manager', detail: 'Visit business.facebook.com and log in. If you don\'t have an account, create one at business.facebook.com/overview.' },
      { title: 'Open Events Manager', detail: 'In the left menu click "Events Manager" or go directly to business.facebook.com/events_manager.' },
      { title: 'Create or Find Your Pixel', detail: 'Click the green "+ Connect Data Sources" button. Select "Web" then "Connect". Select "Facebook Pixel" and click "Connect". Name your pixel and enter your website URL.' },
      { title: 'Copy Your Pixel ID', detail: 'Your pixel is now created. You\'ll see a 15-16 digit number (e.g. 1234567890123456). This is your Pixel ID -- copy it.' },
      { title: 'Done!', detail: 'Paste the Pixel ID in the Connect tab. Koto fires Facebook events automatically -- no code needed on your site if using the Koto pixel.' },
    ],
    events: ['PageView -- every page visit', 'ViewContent -- key page views', 'Lead -- form submitted or hot visitor', 'Contact -- CTA button clicked', 'Schedule -- appointment booked', 'Purchase -- deal closed in Koto'],
    tip: 'Install "Meta Pixel Helper" Chrome extension to verify it\'s working.',
  },
  google: {
    title: 'Google Tag Manager / GA4',
    idLabel: 'GTM Container ID (GTM-XXXXXXX)',
    placeholder: 'GTM-XXXXXXX',
    steps: [
      { title: 'Create a GTM Account', detail: 'Go to tagmanager.google.com. Click "Create Account". Enter your company name and website URL. Target platform: Web. Click "Create" and accept Terms.' },
      { title: 'Get Your Container ID', detail: 'After creating, you\'ll see a code snippet. At the top: GTM-XXXXXXX. This is your Container ID -- copy it.' },
      { title: 'Install GTM on Your Website', detail: 'Copy the two code snippets shown. Add the first inside <head> and the second after opening <body>. Or use a WordPress plugin like "GTM4WP".' },
      { title: 'Connect Google Ads (optional)', detail: 'Go to ads.google.com > Tools > Conversions. Click "+ New Conversion Action" > Website. Copy your Conversion ID and Label.' },
      { title: 'Connect GA4 (optional)', detail: 'Go to analytics.google.com > Admin > Data Streams > Web. Copy the Measurement ID (G-XXXXXXXXXX).' },
    ],
    events: ['Page views to GA4', 'Form submissions as Google Ads conversions', 'Appointments as conversions ($0 value)', 'Deals closed as conversions (deal value)', 'Phone call clicks as call conversions'],
    tip: 'Use Google Tag Assistant (tagassistant.google.com) to debug your GTM setup.',
    extraFields: [
      { key: 'google_ads_id', label: 'Google Ads Conversion ID (optional)', placeholder: 'AW-XXXXXXXXX' },
      { key: 'ga4_id', label: 'GA4 Measurement ID (optional)', placeholder: 'G-XXXXXXXXXX' },
    ],
  },
  tiktok: {
    title: 'TikTok Pixel',
    idLabel: 'Pixel ID',
    placeholder: 'C5R7XXXXXXXXXXXXXXXX',
    steps: [
      { title: 'Access TikTok Ads Manager', detail: 'Go to ads.tiktok.com and log in or create a TikTok Ads account with a business email.' },
      { title: 'Navigate to Events', detail: 'In the top menu click "Assets" then "Events". Click "Web Events".' },
      { title: 'Create Your Pixel', detail: 'Click "Set Up Web Events". Select "TikTok Pixel" and click "Next". Name your pixel and click "Create".' },
      { title: 'Copy Your Pixel ID', detail: 'After creation you\'ll see your Pixel ID (e.g. C5R7XXXXXXXXXXXXXXXX). Copy it.' },
    ],
    events: ['PageView', 'ViewContent', 'SubmitForm', 'Contact', 'PlaceOrder'],
    tip: 'Best for restaurants, salons, gyms, retail -- any business targeting 18-35 year olds.',
  },
  linkedin: {
    title: 'LinkedIn Insight Tag',
    idLabel: 'Partner ID (7 digits)',
    placeholder: '1234567',
    steps: [
      { title: 'Access Campaign Manager', detail: 'Go to linkedin.com/campaignmanager. Log in and select or create your ad account.' },
      { title: 'Find Insight Tag', detail: 'In the left menu click "Analyze" then "Insight Tag". Click "Install my Insight Tag".' },
      { title: 'Get Your Partner ID', detail: 'You\'ll see your unique Partner ID (7-digit number). Copy this number.' },
      { title: 'Install the Tag', detail: 'Option A: Copy code and add to website. Option B: Install via GTM. Option C: Let Koto handle it automatically.' },
    ],
    events: ['Page views for retargeting', 'Lead generation events', 'Conversion tracking'],
    tip: 'SPECIAL: LinkedIn can identify which COMPANIES visit your site -- extremely valuable for B2B. Check "Website Demographics" in Campaign Manager after connecting.',
  },
  twitter: {
    title: 'Twitter / X Pixel',
    idLabel: 'Pixel ID',
    placeholder: 'XXXXXX',
    steps: [
      { title: 'Access Twitter Ads', detail: 'Go to ads.twitter.com and log in with your Twitter/X account.' },
      { title: 'Go to Conversion Tracking', detail: 'In the top menu click "Tools" then "Conversion Tracking". Click "Generate website tag".' },
      { title: 'Create Your Tag', detail: 'Click "Create new". Select "Universal website tag". Name it and click "Save".' },
      { title: 'Get Your Pixel ID', detail: 'Find the line with twq(\'init\', \'XXXXXX\') in the code. The XXXXXX part is your Pixel ID.' },
    ],
    events: ['Page views', 'Conversions', 'Custom events'],
    tip: 'Best for B2B, media companies, and brands targeting professional audiences.',
  },
  snapchat: {
    title: 'Snapchat Pixel',
    idLabel: 'Pixel ID',
    placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    steps: [
      { title: 'Access Snapchat Ads Manager', detail: 'Go to ads.snapchat.com. Log in or create a Snapchat Business account.' },
      { title: 'Create Your Pixel', detail: 'Click "Assets" in the top menu then "Snap Pixel". Click "Create Pixel", name it, and click "Create".' },
      { title: 'Get Your Pixel ID', detail: 'After creation you\'ll see your Pixel ID (UUID format). Copy it.' },
    ],
    events: ['PageView', 'ViewContent', 'AddToCart', 'Purchase'],
    tip: 'Best for reaching 13-34 year olds and local businesses with visual products.',
  },
}

function IntegrationModal({ platform, onClose, newIntegration, setNewIntegration, onConnect }) {
  const [modalTab, setModalTab] = useState('instructions')
  const info = PLATFORM_INSTRUCTIONS[platform]
  if (!info) return null

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <div style={{ background: W, borderRadius: 16, padding: 0, width: 620, maxWidth:'95vw', maxHeight:'85vh', overflow:'auto' }}>
        {/* Header */}
        <div style={{ padding:'24px 28px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin: 0 }}>{info.title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding: 4 }}><X size={20} color="#9ca3af" /></button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb' }}>
          {['instructions', 'connect'].map(t => (
            <button key={t} onClick={() => setModalTab(t)} style={{
              flex: 1, padding:'14px', fontSize: 14, fontWeight: modalTab===t ? 700 : 500, fontFamily: FH,
              border:'none', borderBottom: modalTab===t ? `2px solid ${BLK}` : '2px solid transparent',
              background:'none', cursor:'pointer', color: modalTab===t ? BLK : '#9ca3af',
            }}>{t === 'instructions' ? 'How to Get Your ID' : 'Connect'}</button>
          ))}
        </div>

        <div style={{ padding:'28px 28px' }}>
          {modalTab === 'instructions' && (
            <div>
              <h4 style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, margin:'0 0 20px' }}>Setup Guide</h4>
              {info.steps.map((step, i) => (
                <div key={i} style={{ display:'flex', gap: 14, marginBottom: 18 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 10, background: BLK, color: W,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0,
                    fontSize: 13, fontWeight: 800, fontFamily: FH,
                  }}>{i+1}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, color: BLK, marginBottom: 3 }}>{step.title}</div>
                    <div style={{ fontSize: 13, fontFamily: FB, color:'#6b7280', lineHeight: 1.6 }}>{step.detail}</div>
                  </div>
                </div>
              ))}

              <div style={{ padding:'16px 20px', background:'#f0fdfa', borderRadius: 12, borderLeft:`3px solid ${T}`, marginTop: 20, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: FH, color:'#0f766e', marginBottom: 8, textTransform:'uppercase', letterSpacing:'.06em' }}>Events Koto fires automatically</div>
                {info.events.map((ev, i) => (
                  <div key={i} style={{ fontSize: 13, fontFamily: FB, color:'#374151', lineHeight: 1.8 }}>
                    <Check size={12} color={GRN} style={{ verticalAlign:'middle', marginRight: 6 }} />{ev}
                  </div>
                ))}
              </div>

              {info.tip && (
                <div style={{ padding:'14px 18px', background:'#fef3c7', borderRadius: 12, fontSize: 13, fontFamily: FB, color:'#92400e' }}>
                  <strong>Pro tip:</strong> {info.tip}
                </div>
              )}

              <div style={{ display:'flex', justifyContent:'flex-end', marginTop: 20 }}>
                <button onClick={() => setModalTab('connect')} style={{
                  display:'flex', alignItems:'center', gap: 6, padding:'10px 22px', borderRadius: 10,
                  border:'none', background: BLK, color: W, fontSize: 14, fontWeight: 700, fontFamily: FH, cursor:'pointer',
                }}>
                  Next: Connect <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {modalTab === 'connect' && (
            <div>
              <h4 style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, margin:'0 0 20px' }}>Connect {info.title}</h4>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display:'block', fontSize: 11, fontWeight: 700, color:'#9ca3af', fontFamily: FH, textTransform:'uppercase', letterSpacing:'.06em', marginBottom: 6 }}>{info.idLabel}</label>
                <input value={newIntegration.platform_pixel_id} onChange={e => setNewIntegration(p => ({...p, platform_pixel_id:e.target.value}))}
                  placeholder={info.placeholder}
                  style={{ width:'100%', padding:'12px 16px', borderRadius: 10, border:'1px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing:'border-box', outline:'none' }}
                  onFocus={e => e.target.style.borderColor = BLK} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              {info.extraFields?.map(f => (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <label style={{ display:'block', fontSize: 11, fontWeight: 700, color:'#9ca3af', fontFamily: FH, textTransform:'uppercase', letterSpacing:'.06em', marginBottom: 6 }}>{f.label}</label>
                  <input value={newIntegration.config?.[f.key] || ''} onChange={e => setNewIntegration(p => ({...p, config:{...(p.config||{}), [f.key]:e.target.value}}))}
                    placeholder={f.placeholder}
                    style={{ width:'100%', padding:'12px 16px', borderRadius: 10, border:'1px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing:'border-box', outline:'none' }}
                    onFocus={e => e.target.style.borderColor = BLK} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                </div>
              ))}
              <div style={{ display:'flex', gap: 10, justifyContent:'flex-end', marginTop: 20 }}>
                <button onClick={onClose} style={{
                  padding:'10px 22px', borderRadius: 10, border:'1px solid #e5e7eb', background: W,
                  fontSize: 14, fontWeight: 600, fontFamily: FB, cursor:'pointer', color:'#6b7280',
                }}>Cancel</button>
                <button onClick={onConnect} style={{
                  padding:'10px 22px', borderRadius: 10, border:'none', background: BLK, color: W,
                  fontSize: 14, fontWeight: 700, fontFamily: FH, cursor:'pointer',
                }}>Connect</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
