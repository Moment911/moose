"use client"
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Phone, Mail, Globe, MapPin, Building2, User,
  TrendingUp, Flame, Tag, Sparkles, Shield, ShieldAlert,
  Calendar, DollarSign, Target, Loader2, AlertCircle,
  ExternalLink, ChevronRight, Radio, X, Send,
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import OpportunityTimeline from '../../components/scout/OpportunityTimeline'
import { useAuth } from '../../hooks/useAuth'
import { useMobile } from '../../hooks/useMobile'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import toast from 'react-hot-toast'
import { metaFromPhone } from '../../lib/scout/areaCodeMeta'
import { recommendVoiceForRegion } from '../../lib/scout/voiceRoster'

const STAGES = ['new', 'engaged', 'qualified', 'proposal', 'won', 'lost']

const STAGE_COLOR = {
  new: T, engaged: AMB, qualified: '#00C2CB', proposal: R,
  won: GRN, lost: '#6b7280', archived: '#6b7280',
}

const SOURCE_LABEL = {
  web_visitor: 'Web Visitor', scout: 'Scout', voice_call: 'Voice Call',
  inbound_call: 'Inbound Call', import: 'Import', manual: 'Manual',
}

function fmtRelative(iso) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

function fmtMoney(n) {
  if (n === null || n === undefined) return null
  const num = Number(n)
  if (Number.isNaN(num)) return null
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num)
}

function ScoreRing({ score, size = 56, strokeWidth = 5, label }) {
  const radius = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * radius
  const val = Math.max(0, Math.min(100, Number(score || 0)))
  const offset = circ - (val / 100) * circ
  const color = val >= 70 ? GRN : val >= 40 ? AMB : '#9ca3af'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f0f0f0" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .6s ease' }} />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontFamily: FH, fontSize: size * 0.3, fontWeight: 800, fill: color }}>
          {val}
        </text>
      </svg>
      {label && <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>}
    </div>
  )
}

function StatChip({ icon: Icon, label, value, color = BLK }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', background: '#f9fafb', borderRadius: 10, border: '1px solid #eef0f2',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: color + '15',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: BLK, fontFamily: FH }}>{value || '—'}</div>
      </div>
    </div>
  )
}

export default function ScoutOpportunityDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { agencyId } = useAuth()
  const isMobile = useMobile()

  const [loading, setLoading] = useState(true)
  const [opp, setOpp] = useState(null)
  const [err, setErr] = useState(null)
  const [savingStage, setSavingStage] = useState(false)

  // Queue-for-AI-call modal state
  const [queueOpen, setQueueOpen] = useState(false)
  const [qPitch, setQPitch] = useState('')
  const [qGap, setQGap] = useState('')
  const [qPriority, setQPriority] = useState(3)
  const [qBusy, setQBusy] = useState(false)

  function openQueueModal() {
    if (!opp) return
    setQPitch(opp.persona_json?.next_best_action || opp.persona_json?.summary || '')
    setQGap(opp.intel?.biggest_gap || opp.pain_point || '')
    setQPriority(opp.hot ? 1 : 3)
    setQueueOpen(true)
  }

  async function submitQueue() {
    if (!opp) return
    if (!opp.contact_phone) { toast.error('Opportunity has no phone number'); return }
    setQBusy(true)
    try {
      const res = await fetch('/api/scout/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'queue_call',
          agency_id: agencyId,
          opportunity_id: opp.id,
          company_name: opp.company_name || 'Unknown',
          contact_name: opp.contact_name || null,
          contact_phone: opp.contact_phone,
          industry: opp.industry || null,
          sic_code: opp.sic_code || null,
          pitch_angle: qPitch.trim() || null,
          biggest_gap: qGap.trim() || null,
          priority: qPriority,
          trigger_mode: 'manual',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Queue failed')
      toast.success('Added to Scout voice queue')
      setQueueOpen(false)
      setTimeout(() => navigate('/scout/voice'), 400)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setQBusy(false)
    }
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setErr(null)
    fetch(`/api/opportunities?action=get&id=${encodeURIComponent(id)}`, { credentials: 'include' })
      .then(r => r.json().then(body => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return
        if (!ok) { setErr(body?.error || 'Failed to load'); setOpp(null) }
        else setOpp(body.opportunity || null)
      })
      .catch(e => { if (!cancelled) setErr(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  async function updateStage(newStage) {
    if (!opp || savingStage) return
    setSavingStage(true)
    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'update_stage', id: opp.id, stage: newStage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Update failed')
      setOpp(prev => ({ ...prev, stage: newStage }))
      toast.success(`Stage → ${newStage}`)
    } catch (e) { toast.error(e.message) }
    finally { setSavingStage(false) }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fafafa', fontFamily: FB }}>
      <Sidebar />
      <main style={{ flex: 1, padding: isMobile ? 16 : 28, maxWidth: 1280, margin: '0 auto', width: '100%' }}>

        {/* Back link */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: '#6b7280',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 14, padding: 0,
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280' }}>
            <Loader2 size={16} className="animate-spin" /> Loading opportunity…
          </div>
        )}

        {err && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
            <AlertCircle size={16} /> {err}
          </div>
        )}

        {!loading && !err && opp && (
          <>
            {/* Header card */}
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
              padding: '22px 24px', marginBottom: 18,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    {opp.hot && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: R, color: '#fff', fontSize: 11, fontWeight: 700,
                        padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '.06em',
                      }}>
                        <Flame size={11} /> Hot
                      </span>
                    )}
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '.06em',
                    }}>
                      {SOURCE_LABEL[opp.source] || opp.source}
                    </span>
                  </div>
                  <h1 style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLK, margin: 0 }}>
                    {opp.company_name || opp.contact_name || 'Unnamed opportunity'}
                  </h1>
                  {opp.contact_name && opp.company_name && (
                    <div style={{ fontSize: 14, color: '#4b5563', marginTop: 2 }}>{opp.contact_name}</div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={openQueueModal}
                    disabled={!opp.contact_phone}
                    title={!opp.contact_phone ? 'Add a phone number first' : 'Queue this prospect for the Scout AI voice agent'}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '10px 16px', borderRadius: 10,
                      background: opp.contact_phone ? R : '#e5e7eb',
                      color: opp.contact_phone ? '#fff' : '#9ca3af',
                      border: 'none', cursor: opp.contact_phone ? 'pointer' : 'not-allowed',
                      fontSize: 13, fontWeight: 700, fontFamily: FH,
                    }}
                  >
                    <Radio size={14} /> Queue for AI call
                  </button>
                  <ScoreRing score={opp.score} label="Score" />
                  <ScoreRing score={opp.health_score} label="Health" />
                </div>
              </div>

              {/* Stage picker */}
              <div style={{ display: 'flex', gap: 6, marginTop: 18, flexWrap: 'wrap' }}>
                {STAGES.map(s => {
                  const active = opp.stage === s
                  return (
                    <button
                      key={s}
                      onClick={() => !active && updateStage(s)}
                      disabled={savingStage}
                      style={{
                        padding: '7px 14px', borderRadius: 99,
                        fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
                        border: active ? 'none' : '1px solid #e5e7eb',
                        background: active ? STAGE_COLOR[s] : '#fff',
                        color: active ? '#fff' : '#4b5563',
                        cursor: savingStage ? 'wait' : (active ? 'default' : 'pointer'),
                        fontFamily: FH,
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>

              {/* Contact + economics stat grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                gap: 10, marginTop: 18,
              }}>
                <StatChip icon={Phone} label="Phone" value={opp.contact_phone} color={T} />
                <StatChip icon={Mail} label="Email" value={opp.contact_email} color={T} />
                <StatChip icon={Globe} label="Website" value={opp.website} color={T} />
                <StatChip icon={Building2} label="Industry" value={opp.industry || opp.sic_code} color={T} />
                <StatChip icon={DollarSign} label="Deal value" value={fmtMoney(opp.deal_value) || '—'} color={GRN} />
                <StatChip icon={Target} label="Close probability" value={opp.close_probability != null ? `${opp.close_probability}%` : '—'} color={GRN} />
                <StatChip icon={Calendar} label="Expected close" value={opp.expected_close_date || '—'} color={AMB} />
                <StatChip icon={TrendingUp} label="Last touch" value={fmtRelative(opp.last_touch_at)} color={AMB} />
              </div>

              {/* Compliance row */}
              <div style={{
                display: 'flex', gap: 10, marginTop: 14, fontSize: 12, color: '#6b7280',
                flexWrap: 'wrap',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {opp.dnc_status === 'clear' ? <Shield size={12} color={GRN} /> : <ShieldAlert size={12} color="#9ca3af" />}
                  DNC: {opp.dnc_status || 'unchecked'}
                </span>
                <span>TCPA consent: {opp.tcpa_consent_at ? fmtRelative(opp.tcpa_consent_at) : 'none'}</span>
                {opp.assigned_user_id && <span>Assigned</span>}
                {opp.tags && opp.tags.length > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Tag size={12} /> {opp.tags.join(', ')}
                  </span>
                )}
              </div>
            </div>

            {/* Two-column layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 360px',
              gap: 18,
            }}>
              {/* Main: Timeline */}
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
                padding: '22px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <TrendingUp size={16} color={T} />
                  <h2 style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, margin: 0 }}>
                    Timeline
                  </h2>
                </div>
                <OpportunityTimeline opportunityId={opp.id} />
              </div>

              {/* Side: Persona + intel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Persona */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Sparkles size={15} color={R} />
                    <h3 style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, margin: 0 }}>Persona</h3>
                  </div>
                  {opp.persona_json && Object.keys(opp.persona_json).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#374151' }}>
                      {Object.entries(opp.persona_json).map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{k}</div>
                          <div style={{ lineHeight: 1.45 }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
                      Nightly AI will build this from activity history.
                    </div>
                  )}
                </div>

                {/* Pain point + objection */}
                {(opp.pain_point || opp.objection) && (
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                    <h3 style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, margin: '0 0 12px' }}>From the call</h3>
                    {opp.pain_point && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Pain point</div>
                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.45 }}>{opp.pain_point}</div>
                      </div>
                    )}
                    {opp.objection && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Objection</div>
                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.45 }}>{opp.objection}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Intel JSON (raw, for now) */}
                {opp.intel && Object.keys(opp.intel).length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                    <h3 style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, margin: '0 0 10px' }}>Intel</h3>
                    <pre style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'ui-monospace, monospace' }}>
                      {JSON.stringify(opp.intel, null, 2).slice(0, 1200)}
                    </pre>
                  </div>
                )}

                {/* Notes */}
                {opp.notes && (
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                    <h3 style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, margin: '0 0 8px' }}>Notes</h3>
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{opp.notes}</div>
                  </div>
                )}

                {/* Quick links */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                  <h3 style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, margin: '0 0 10px' }}>Quick links</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {opp.client_id && (
                      <Link to={`/clients/${opp.client_id}`} style={linkRowStyle}>
                        <User size={13} /> View client record <ChevronRight size={13} style={{ marginLeft: 'auto' }} />
                      </Link>
                    )}
                    {opp.ghl_contact_id && (
                      <a
                        href={`https://app.gohighlevel.com/v2/location/_/contacts/${opp.ghl_contact_id}`}
                        target="_blank" rel="noopener noreferrer"
                        style={linkRowStyle}
                      >
                        <ExternalLink size={13} /> Open in GHL <ChevronRight size={13} style={{ marginLeft: 'auto' }} />
                      </a>
                    )}
                    {opp.contact_phone && (
                      <a href={`tel:${opp.contact_phone}`} style={linkRowStyle}>
                        <Phone size={13} /> Call {opp.contact_phone} <ChevronRight size={13} style={{ marginLeft: 'auto' }} />
                      </a>
                    )}
                    {opp.contact_email && (
                      <a href={`mailto:${opp.contact_email}`} style={linkRowStyle}>
                        <Mail size={13} /> Email {opp.contact_email} <ChevronRight size={13} style={{ marginLeft: 'auto' }} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {queueOpen && opp && (
          <div
            onClick={() => !qBusy && setQueueOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 200, padding: 20,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 14, maxWidth: 560, width: '100%',
                padding: '22px 24px', fontFamily: FB,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Scout voice · Queue a call</div>
                  <h2 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin: 0 }}>{opp.company_name}</h2>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {opp.contact_name || 'Unknown contact'} · {opp.contact_phone}
                  </div>
                </div>
                <button onClick={() => !qBusy && setQueueOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={16} color="#6b7280" />
                </button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Pitch angle</div>
                <textarea
                  value={qPitch}
                  onChange={e => setQPitch(e.target.value)}
                  placeholder="What's the single most compelling reason they should talk to you? The agent leads with this."
                  rows={2}
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: 13,
                    borderRadius: 8, border: '1px solid #e5e7eb', fontFamily: FB, resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Biggest gap (optional)</div>
                <textarea
                  value={qGap}
                  onChange={e => setQGap(e.target.value)}
                  placeholder="The specific thing Scout detected (no GA4, slow site, poor reviews). The agent uses this as the hook."
                  rows={2}
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: 13,
                    borderRadius: 8, border: '1px solid #e5e7eb', fontFamily: FB, resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Priority</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(p => {
                    const active = qPriority === p
                    const label = p === 1 ? 'Urgent' : p === 2 ? 'High' : p === 3 ? 'Normal' : p === 4 ? 'Low' : 'Backfill'
                    return (
                      <button
                        key={p}
                        onClick={() => setQPriority(p)}
                        style={{
                          padding: '7px 12px', borderRadius: 8,
                          background: active ? BLK : '#fff',
                          color: active ? '#fff' : '#4b5563',
                          border: active ? 'none' : '1px solid #e5e7eb',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH,
                        }}
                      >
                        {p} · {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {(() => {
                const geo = metaFromPhone(opp.contact_phone)
                if (!geo) return null
                const rec = recommendVoiceForRegion(geo.region)
                return (
                  <div style={{ fontSize: 12, color: '#374151', marginBottom: 12, padding: 10, background: '#f0fdfa', borderRadius: 8, border: '1px solid #99f6e4' }}>
                    <div style={{ fontWeight: 800, color: T, marginBottom: 2, textTransform: 'uppercase', fontSize: 10, letterSpacing: '.06em' }}>
                      Detected: {geo.state}{geo.major_city ? ` · ${geo.major_city}` : ''} · {geo.region}
                    </div>
                    {geo.style_notes && <div style={{ marginBottom: 4 }}>{geo.style_notes}</div>}
                    <div style={{ color: '#6b7280' }}>
                      Recommended voice for this region: <b>{rec.name}</b> — {rec.style.toLowerCase()}, {rec.accent}.
                    </div>
                  </div>
                )
              })()}

              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, padding: 10, background: '#f9fafb', borderRadius: 8, border: '1px solid #eef0f2' }}>
                <b>What happens next:</b> this prospect goes into the Scout voice queue. The AI agent composes a
                system prompt from the voice brain (industry knowledge + global patterns + this pitch angle + the
                prospect's state via area code) and dials as soon as you hit Start from the Queue tab.
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setQueueOpen(false)}
                  disabled={qBusy}
                  style={{
                    padding: '10px 14px', borderRadius: 8, background: '#fff',
                    border: '1px solid #e5e7eb', color: '#4b5563',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FH,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitQueue}
                  disabled={qBusy}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '10px 18px', borderRadius: 8, background: BLK, color: '#fff',
                    border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH,
                  }}
                >
                  {qBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Add to queue
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const linkRowStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 10px', borderRadius: 8,
  fontSize: 13, fontWeight: 600, color: '#374151',
  background: '#f9fafb', border: '1px solid #eef0f2',
  textDecoration: 'none', cursor: 'pointer',
}
