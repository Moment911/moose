"use client"
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Brain, Check, X, AlertTriangle, ChevronDown, ChevronRight, Edit2,
  Loader2, Search, Star, Globe, Shield, Zap, RefreshCw, Plus, Trash2,
  User, Building, Target, Award, MessageSquare, Phone, Calendar
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R   = '#E6007E',T='#00C2CB',BLK='#111111',GRY='#F9F9F9',GRN='#16a34a',AMB='#f59e0b'
const W='#ffffff',FH="'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif",FB="'Raleway','Helvetica Neue',sans-serif"

const API = '/api/client-intelligence'
async function apiGet(action, params={}) {
  const url = new URL(API, window.location.origin)
  url.searchParams.set('action', action)
  for (const [k,v] of Object.entries(params)) if (v) url.searchParams.set(k, String(v))
  return (await fetch(url)).json()
}
async function apiPost(body) {
  return (await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })).json()
}

const SECTIONS = [
  { key:'identity', label:'Business Identity', icon:Building },
  { key:'services', label:'Services & Value', icon:Target },
  { key:'customer', label:'Ideal Customer', icon:User },
  { key:'proof', label:'Proof Points', icon:Award },
  { key:'competition', label:'Competition', icon:Shield },
  { key:'restrictions', label:'What NOT to Say', icon:AlertTriangle },
  { key:'closer', label:'The Closer', icon:Phone },
  { key:'agent', label:'AI Agent Instructions', icon:Brain },
  { key:'research', label:'Auto-Research Results', icon:Globe },
]

function Field({ label, value, onChange, textarea, placeholder, disabled }) {
  const Tag = textarea ? 'textarea' : 'input'
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FB, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>{label}</label>
      <Tag value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        rows={textarea?3:undefined}
        style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, resize:textarea?'vertical':'none', boxSizing:'border-box', background:disabled?'#f9fafb':W }} />
    </div>
  )
}

function ListEditor({ label, items, onChange, placeholder }) {
  const add = () => onChange([...(items||[]), ''])
  const update = (i, v) => { const n = [...(items||[])]; n[i] = v; onChange(n) }
  const remove = (i) => onChange((items||[]).filter((_,idx) => idx !== i))
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FB, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>{label}</label>
      {(items||[]).map((item, i) => (
        <div key={i} style={{ display:'flex', gap:6, marginBottom:4 }}>
          <input value={typeof item === 'string' ? item : JSON.stringify(item)} onChange={e=>update(i, e.target.value)} placeholder={placeholder}
            style={{ flex:1, padding:'8px 12px', borderRadius:6, border:'1px solid #e5e7eb', fontSize:12, fontFamily:FB, boxSizing:'border-box' }} />
          <button onClick={()=>remove(i)} style={{ width:28, height:28, borderRadius:6, border:'1px solid #e5e7eb', background:W, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
            <Trash2 size={12} color="#9ca3af" />
          </button>
        </div>
      ))}
      <button onClick={add} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:6, border:'1px dashed #d1d5db', background:'none', fontSize:11, fontFamily:FB, color:'#9ca3af', cursor:'pointer', marginTop:4 }}>
        <Plus size={12} /> Add
      </button>
    </div>
  )
}

export default function ClientIntelligencePage() {
  const { id: clientId } = useParams()
  const { agencyId } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completeness, setCompleteness] = useState(null)
  const [openSection, setOpenSection] = useState('identity')
  const [briefPreview, setBriefPreview] = useState(null)
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    if (!clientId) return
    loadProfile()
  }, [clientId])

  async function loadProfile() {
    setLoading(true)
    const [profRes, compRes] = await Promise.all([
      apiGet('get_profile', { client_id: clientId, agency_id: agencyId }),
      apiGet('get_completeness', { client_id: clientId }),
    ])
    setProfile(profRes.data || {})
    setCompleteness(compRes)
    setClientName(profRes.data?.dba_name || profRes.data?.business_legal_name || 'Client')
    setLoading(false)
  }

  function setField(key, value) {
    setProfile(p => ({ ...p, [key]: value }))
  }

  async function saveProfile() {
    setSaving(true)
    const res = await apiPost({ action:'update_profile', client_id:clientId, agency_id:agencyId, ...profile })
    if (res.success) { toast.success(`Saved (${res.completeness}% complete)`); loadProfile() }
    else toast.error(res.error || 'Save failed')
    setSaving(false)
  }

  async function runResearch() {
    toast.success('Running auto-research...')
    const res = await apiPost({ action:'auto_research', client_id:clientId })
    if (res.success) { toast.success('Research complete'); loadProfile() }
    else toast.error(res.error || 'Research failed')
  }

  async function generateBrief() {
    toast.success('Generating AI call brief...')
    const res = await apiPost({ action:'generate_brief', client_id:clientId })
    if (res.brief) setBriefPreview(res.brief)
    else toast.error('Failed to generate brief')
  }

  const p = profile || {}
  const score = completeness?.score || 0
  const aiReady = completeness?.ai_ready || false

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:GRY }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Loader2 size={32} color={R} style={{ animation:'spin 1s linear infinite' }} />
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:GRY }}>
      <Sidebar />
      <div style={{ flex:1, overflow:'auto' }}>
        {/* Header */}
        <div style={{ background: W, padding: '28px 36px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:42, height:42, borderRadius:12, background: '#E6007E', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Brain size={22} color={W} />
              </div>
              <div>
                <h1 style={{ fontFamily:FH, fontSize:22, fontWeight: 500, color: BLK, margin:0 }}>AI Calling Intelligence</h1>
                <p style={{ fontFamily:FB, fontSize:13, color: '#999999', margin:0 }}>{clientName}</p>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              {/* Completeness */}
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:11, color: '#999999', fontFamily:FB }}>Profile Complete</div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:100, height:6, borderRadius:99, background:'#e5e7eb', overflow:'hidden' }}>
                    <div style={{ width:`${score}%`, height:'100%', borderRadius:99, background:score>=60?GRN:score>=30?AMB:R, transition:'width .3s' }} />
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, fontFamily:FH, color:score>=60?GRN:score>=30?AMB:R }}>{score}%</span>
                </div>
              </div>
              <span style={{ padding:'4px 12px', borderRadius:99, fontSize:11, fontWeight:700, fontFamily:FB, background:aiReady?GRN+'20':AMB+'20', color:aiReady?GRN:AMB }}>
                {aiReady ? 'AI Ready' : 'Needs Info'}
              </span>
              <button onClick={runResearch} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border: '1px solid rgba(0,0,0,0.14)', background:'transparent', color:'#555555', fontSize:12, fontWeight:600, fontFamily:FB, cursor:'pointer' }}>
                <Globe size={14} /> Auto-Research
              </button>
              <button onClick={generateBrief} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'none', background:T, color:W, fontSize:12, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>
                <Zap size={14} /> Generate Brief
              </button>
            </div>
          </div>

          {/* Missing fields */}
          {completeness?.missing?.length > 0 && (
            <div style={{ display:'flex', gap:6, marginTop:14, flexWrap:'wrap' }}>
              {completeness.missing.map(m => (
                <span key={m} style={{ padding:'2px 10px', borderRadius:99, fontSize:10, fontWeight:600, fontFamily:FB, background:'rgba(255,255,255,.08)', color:'#999999' }}>
                  Missing: {m}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ maxWidth:900, margin:'0 auto', padding:'24px 32px' }}>
          {/* Accordion sections */}
          {SECTIONS.map(sec => {
            const isOpen = openSection === sec.key
            const Icon = sec.icon
            return (
              <div key={sec.key} style={{ marginBottom:8 }}>
                <button onClick={() => setOpenSection(isOpen ? '' : sec.key)} style={{
                  width:'100%', display:'flex', alignItems:'center', gap:10, padding:'14px 18px',
                  borderRadius:isOpen?'12px 12px 0 0':'12px', border:'1px solid #e5e7eb',
                  borderBottom:isOpen?'none':'1px solid #e5e7eb',
                  background:W, cursor:'pointer', textAlign:'left',
                }}>
                  <Icon size={16} color={isOpen?R:'#9ca3af'} />
                  <span style={{ flex:1, fontSize:14, fontWeight:700, fontFamily:FH, color:BLK }}>{sec.label}</span>
                  {isOpen ? <ChevronDown size={16} color="#9ca3af" /> : <ChevronRight size={16} color="#9ca3af" />}
                </button>
                {isOpen && (
                  <div style={{ padding:'20px 24px', background:W, border:'1px solid #e5e7eb', borderTop:'none', borderRadius:'0 0 12px 12px' }}>
                    {sec.key === 'identity' && <>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <Field label="Legal Business Name" value={p.business_legal_name} onChange={v=>setField('business_legal_name',v)} placeholder="Full legal name" />
                        <Field label="DBA / Brand Name" value={p.dba_name} onChange={v=>setField('dba_name',v)} placeholder="Name customers know" />
                      </div>
                      <Field label="Elevator Pitch (what the AI says about this company)" value={p.elevator_pitch} onChange={v=>setField('elevator_pitch',v)} textarea placeholder="2-3 sentences about what makes this business special..." />
                      <Field label="Tagline" value={p.tagline} onChange={v=>setField('tagline',v)} placeholder="Short memorable phrase" />
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                        <Field label="Brand Voice" value={p.brand_voice} onChange={v=>setField('brand_voice',v)} placeholder="professional, casual, etc." />
                        <Field label="Years in Business" value={p.years_in_business} onChange={v=>setField('years_in_business',parseInt(v)||'')} placeholder="e.g. 15" />
                        <Field label="Team Size" value={p.team_size} onChange={v=>setField('team_size',parseInt(v)||'')} placeholder="e.g. 12" />
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <Field label="Geographic Coverage" value={p.geographic_coverage} onChange={v=>setField('geographic_coverage',v)} placeholder="local, regional, national" />
                        <Field label="Service Radius (miles)" value={p.service_radius_miles} onChange={v=>setField('service_radius_miles',parseInt(v)||'')} placeholder="e.g. 30" />
                      </div>
                      <Field label="Founder Story (optional but powerful)" value={p.founder_story} onChange={v=>setField('founder_story',v)} textarea placeholder="How the business started, personal motivation..." />
                    </>}

                    {sec.key === 'services' && <>
                      <Field label="Primary Service" value={p.primary_service} onChange={v=>setField('primary_service',v)} placeholder="What are they mainly known for?" />
                      <Field label="Services Description" value={p.services_description} onChange={v=>setField('services_description',v)} textarea placeholder="Detailed description of all services..." />
                      <Field label="Unique Value Proposition" value={p.unique_value_proposition} onChange={v=>setField('unique_value_proposition',v)} textarea placeholder="What makes them different from every competitor?" />
                      <ListEditor label="Key Differentiators" items={p.key_differentiators} onChange={v=>setField('key_differentiators',v)} placeholder="e.g. Only company in area with..." />
                      <ListEditor label="Things They DON'T Do" items={p.things_we_dont_do} onChange={v=>setField('things_we_dont_do',v)} placeholder="e.g. We don't do commercial work" />
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <Field label="Pricing Model" value={p.pricing_model} onChange={v=>setField('pricing_model',v)} placeholder="hourly, project, retainer..." />
                        <Field label="Pricing Notes" value={p.pricing_notes} onChange={v=>setField('pricing_notes',v)} placeholder="e.g. never discuss on first call" />
                      </div>
                      <div style={{ display:'flex', gap:16, marginTop:8 }}>
                        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontFamily:FB, color:'#6b7280', cursor:'pointer' }}>
                          <input type="checkbox" checked={p.free_consultation||false} onChange={e=>setField('free_consultation',e.target.checked)} style={{ accentColor:R }} /> Free Consultation
                        </label>
                        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontFamily:FB, color:'#6b7280', cursor:'pointer' }}>
                          <input type="checkbox" checked={p.guarantee_offered||false} onChange={e=>setField('guarantee_offered',e.target.checked)} style={{ accentColor:R }} /> Guarantee Offered
                        </label>
                      </div>
                    </>}

                    {sec.key === 'customer' && <>
                      <Field label="Ideal Customer Profile" value={p.ideal_customer_profile} onChange={v=>setField('ideal_customer_profile',v)} textarea placeholder="Describe the perfect customer..." />
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <Field label="Demographics" value={p.customer_demographics} onChange={v=>setField('customer_demographics',v)} placeholder="Age, income, homeowner..." />
                        <Field label="B2B / B2C" value={p.b2b_b2c} onChange={v=>setField('b2b_b2c',v)} placeholder="b2b, b2c, or both" />
                      </div>
                      <ListEditor label="Customer Pain Points" items={p.customer_pain_points} onChange={v=>setField('customer_pain_points',v)} placeholder="What keeps them up at night?" />
                      <ListEditor label="Customer Goals" items={p.customer_goals} onChange={v=>setField('customer_goals',v)} placeholder="What are they trying to achieve?" />
                    </>}

                    {sec.key === 'proof' && <>
                      <ListEditor label="Proof Points (stats, results, achievements)" items={p.proof_points} onChange={v=>setField('proof_points',v)} placeholder="e.g. Helped 200+ clients, 340% lead increase" />
                      <ListEditor label="Awards & Recognition" items={p.awards_recognition} onChange={v=>setField('awards_recognition',v)} placeholder="e.g. Best of Houzz 2024" />
                      <ListEditor label="Certifications & Licenses" items={p.certifications_licenses} onChange={v=>setField('certifications_licenses',v)} placeholder="e.g. Licensed & Insured, EPA Certified" />
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <Field label="Average Review Rating" value={p.avg_review_rating} onChange={v=>setField('avg_review_rating',parseFloat(v)||'')} placeholder="e.g. 4.8" />
                        <Field label="Total Reviews" value={p.total_reviews} onChange={v=>setField('total_reviews',parseInt(v)||'')} placeholder="e.g. 120" />
                      </div>
                    </>}

                    {sec.key === 'competition' && <>
                      <Field label="Competitive Positioning" value={p.competitive_positioning} onChange={v=>setField('competitive_positioning',v)} placeholder="premium, value, niche specialist" />
                      <Field label="Why We Beat Competitors" value={p.why_beat_competitors} onChange={v=>setField('why_beat_competitors',v)} textarea placeholder="Overall competitive advantage..." />
                      <ListEditor label="Main Competitors" items={(p.main_competitors||[]).map(c=>typeof c==='string'?c:c.name||JSON.stringify(c))} onChange={v=>setField('main_competitors',v.map(name=>({name})))} placeholder="Competitor name" />
                    </>}

                    {sec.key === 'restrictions' && <>
                      <ListEditor label="Sensitive Topics to Avoid" items={p.sensitive_topics} onChange={v=>setField('sensitive_topics',v)} placeholder="Topics the AI should never bring up" />
                      <Field label="Pricing Restrictions" value={p.pricing_restrictions} onChange={v=>setField('pricing_restrictions',v)} placeholder="e.g. Never quote price on cold call" />
                      <ListEditor label="Things to Never Say" items={p.things_to_never_say} onChange={v=>setField('things_to_never_say',v)} placeholder="Exact phrases to avoid" />
                      <Field label="Compliance Notes" value={p.compliance_notes} onChange={v=>setField('compliance_notes',v)} textarea placeholder="Any regulatory or legal requirements..." />
                    </>}

                    {sec.key === 'closer' && <>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <Field label="Closer Name" value={p.closer_name} onChange={v=>setField('closer_name',v)} placeholder="Who the prospect meets" />
                        <Field label="Title" value={p.closer_title} onChange={v=>setField('closer_title',v)} placeholder="e.g. Senior Strategist" />
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <Field label="Phone (live transfer)" value={p.closer_phone} onChange={v=>setField('closer_phone',v)} placeholder="+1 555-000-0000" />
                        <Field label="Calendar Link" value={p.closer_calendar_url} onChange={v=>setField('closer_calendar_url',v)} placeholder="https://calendly.com/..." />
                      </div>
                      <Field label="Bio (what the AI says about the closer)" value={p.closer_bio} onChange={v=>setField('closer_bio',v)} textarea placeholder="2-3 sentences building credibility..." />
                      <Field label="Results to Reference" value={p.closer_results} onChange={v=>setField('closer_results',v)} textarea placeholder="Specific wins and achievements..." />
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                        <Field label="Meeting Duration (min)" value={p.meeting_duration_minutes} onChange={v=>setField('meeting_duration_minutes',parseInt(v)||30)} placeholder="30" />
                        <Field label="Meeting Format" value={p.meeting_format} onChange={v=>setField('meeting_format',v)} placeholder="phone, video, in-person" />
                        <Field label="Platform" value={p.meeting_platform} onChange={v=>setField('meeting_platform',v)} placeholder="Zoom, Teams, phone" />
                      </div>
                    </>}

                    {sec.key === 'agent' && <>
                      <Field label="Agent Name (what the AI calls itself)" value={p.agent_name} onChange={v=>setField('agent_name',v)} placeholder="e.g. Alex, Sarah" />
                      <Field label="Agent Persona" value={p.agent_persona} onChange={v=>setField('agent_persona',v)} textarea placeholder="Full personality description..." />
                      <Field label="Opening Line" value={p.opening_line} onChange={v=>setField('opening_line',v)} textarea placeholder="First thing the AI says on every call..." />
                      <ListEditor label="Custom Discovery Questions" items={p.custom_discovery_questions} onChange={v=>setField('custom_discovery_questions',v)} placeholder="Question the AI should ask" />
                      <ListEditor label="Custom Objection Responses" items={(p.custom_objection_responses||[]).map(o=>typeof o==='string'?o:`${o.objection}: ${o.response}`)} onChange={v=>setField('custom_objection_responses',v)} placeholder="Objection: Response" />
                      <Field label="Special Instructions" value={p.special_instructions} onChange={v=>setField('special_instructions',v)} textarea placeholder="Any other instructions for the AI..." />
                      <ListEditor label="Things to Always Say" items={p.things_to_always_say} onChange={v=>setField('things_to_always_say',v)} placeholder="Phrases the AI should work in" />
                    </>}

                    {sec.key === 'research' && <>
                      {p.google_business_data && Object.keys(p.google_business_data).length > 0 ? (
                        <div style={{ padding:'14px 18px', background:'#f9fafb', borderRadius:10 }}>
                          <div style={{ fontSize:12, fontWeight:700, fontFamily:FH, color:BLK, marginBottom:8 }}>Google Business Profile</div>
                          {p.google_business_data.rating && <div style={{ fontSize:13, fontFamily:FB, color:'#374151' }}>Rating: <strong>{p.google_business_data.rating}</strong>/5 ({p.google_business_data.review_count || 0} reviews)</div>}
                          {p.google_business_data.address && <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, marginTop:4 }}>{p.google_business_data.address}</div>}
                          {p.google_business_data.website && <div style={{ fontSize:12, color:T, fontFamily:FB, marginTop:4 }}>{p.google_business_data.website}</div>}
                        </div>
                      ) : (
                        <div style={{ textAlign:'center', padding:'30px 20px', color:'#9ca3af', fontSize:13, fontFamily:FB }}>
                          No research data yet. Click "Auto-Research" in the header to fetch.
                        </div>
                      )}
                    </>}
                  </div>
                )}
              </div>
            )
          })}

          {/* Save button */}
          <div style={{ position:'sticky', bottom:0, padding:'16px 0', background:GRY, display:'flex', gap:12, justifyContent:'flex-end' }}>
            <button onClick={saveProfile} disabled={saving} style={{
              padding:'12px 32px', borderRadius:10, border:'none', background:R, color:W,
              fontSize:14, fontWeight:700, fontFamily:FH, cursor:saving?'wait':'pointer',
              display:'flex', alignItems:'center', gap:8, opacity:saving?.7:1,
            }}>
              {saving ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} /> : <Check size={16} />}
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>

          {/* Brief preview modal */}
          {briefPreview && (
            <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ background:W, borderRadius:16, padding:0, width:700, maxWidth:'95vw', maxHeight:'85vh', overflow:'auto' }}>
                <div style={{ padding:'20px 28px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <h3 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:0 }}>AI Call Brief Preview</h3>
                  <button onClick={()=>setBriefPreview(null)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} color="#9ca3af" /></button>
                </div>
                <pre style={{ padding:'24px 28px', fontSize:12, fontFamily:'monospace', color:'#374151', lineHeight:1.7, whiteSpace:'pre-wrap', margin:0 }}>
                  {briefPreview}
                </pre>
              </div>
            </div>
          )}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}
