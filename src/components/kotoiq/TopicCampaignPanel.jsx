"use client"
import { useEffect, useState } from 'react'
import {
  Sparkles, Loader2, ChevronRight, ChevronLeft, MapPin, RefreshCw, Upload,
  AlertTriangle, CheckCircle2, Wand2, FileText, File, ExternalLink, Eye, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

/**
 * TopicCampaignPanel — three-step wizard for bulk topic-based page deploys.
 *
 *   Step 1: Topic + phone + company + post type + notes + optional HTML wrapper
 *           → "Generate Master" → preview of variants
 *   Step 2: State + city picker (Census-backed) + "Preview First City"
 *   Step 3: Deploy → progress + per-city results table
 */
export default function TopicCampaignPanel({ site }) {
  const { agencyId } = useAuth()
  const [step, setStep] = useState(1)

  // Step 1 state
  const [topic, setTopic] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [postType, setPostType] = useState('page')
  const [notes, setNotes] = useState('')
  const [customHtml, setCustomHtml] = useState('')
  const [variantsPerSection, setVariantsPerSection] = useState(4)
  const [faqCount, setFaqCount] = useState(6)
  const [generating, setGenerating] = useState(false)
  const [campaign, setCampaign] = useState(null) // { id, topic, master, ... }

  // Step 2 state
  const [states, setStates] = useState([])
  const [selectedState, setSelectedState] = useState('')
  const [cities, setCities] = useState([])
  const [loadingCities, setLoadingCities] = useState(false)
  const [selectedCities, setSelectedCities] = useState(new Set())
  const [citySearch, setCitySearch] = useState('')
  const [preview, setPreview] = useState(null) // { open, html, meta }

  // Step 3 state
  const [deploying, setDeploying] = useState(false)
  const [deployResults, setDeployResults] = useState(null)

  const isV4 = site?.shim_version === 'v4'

  // Load states once
  useEffect(() => {
    if (states.length) return
    fetch('/api/kotoiq/topic-campaign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_states', agency_id: agencyId }),
    }).then(r => r.json()).then(d => {
      if (d.ok) setStates(d.states)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generateMaster() {
    if (!topic.trim()) { toast.error('Topic required'); return }
    setGenerating(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_master',
          agency_id: agencyId,
          site_id: site?.id || null,
          client_id: site?.client_id || null,
          topic: topic.trim(),
          phone: phone.trim() || null,
          company_name: companyName.trim() || null,
          notes: notes.trim() || null,
          post_type: postType,
          custom_html_wrapper: customHtml.trim() || null,
          variants_per_section: Number(variantsPerSection) || 4,
          faq_count: Number(faqCount) || 6,
        }),
      })
      const d = await r.json()
      if (d.error) { toast.error(d.error); return }
      setCampaign(d.campaign)
      toast.success(`Master generated · ${d.tokens_used} tokens`)
      setStep(2)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function loadCities() {
    if (!selectedState) return
    setLoadingCities(true)
    setSelectedCities(new Set())
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_cities', agency_id: agencyId, state_abbr: selectedState }),
      })
      const d = await r.json()
      if (d.error) { toast.error(d.error); return }
      setCities(d.cities || [])
    } catch (e) { toast.error(e.message) }
    setLoadingCities(false)
  }

  useEffect(() => { if (selectedState) loadCities() }, [selectedState])  // eslint-disable-line

  function toggleCity(name) {
    setSelectedCities(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  function selectAllFiltered() {
    const filtered = filteredCities()
    setSelectedCities(new Set(filtered.map(c => c.name)))
  }
  function clearAll() { setSelectedCities(new Set()) }

  function filteredCities() {
    if (!citySearch.trim()) return cities
    const q = citySearch.toLowerCase()
    return cities.filter(c => c.name.toLowerCase().includes(q))
  }

  async function previewOne() {
    if (selectedCities.size === 0) { toast.error('Pick at least one city'); return }
    const firstCity = Array.from(selectedCities)[0]
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview_resolved',
          agency_id: agencyId,
          campaign_id: campaign.id,
          location: { city: firstCity, state: stateName(selectedState), stateAbbr: selectedState },
        }),
      })
      const d = await r.json()
      if (d.error) { toast.error(d.error); return }
      setPreview({ open: true, ...d.resolved })
    } catch (e) { toast.error(e.message) }
  }

  async function deploy() {
    if (!isV4) { toast.error('Deploy requires a v4-paired site'); return }
    if (selectedCities.size === 0) { toast.error('Pick at least one city'); return }
    if (!confirm(`Deploy ${selectedCities.size} ${campaign.post_type === 'post' ? 'posts' : 'pages'} to ${site.site_url}?\n\nEach city will get its own URL with the city baked into the HTML.`)) return

    setDeploying(true)
    setStep(3)
    try {
      const locations = Array.from(selectedCities).map(city => ({
        city,
        state: stateName(selectedState),
        stateAbbr: selectedState,
      }))
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deploy',
          agency_id: agencyId,
          campaign_id: campaign.id,
          site_id: site.id,
          locations,
        }),
      })
      const d = await r.json()
      if (d.error) { toast.error(d.error); setDeploying(false); return }
      setDeployResults(d)
      toast.success(`Deployed ${d.deployed} / ${d.deployed + d.failed}`)
    } catch (e) { toast.error(e.message) }
    setDeploying(false)
  }

  function reset() {
    setStep(1)
    setCampaign(null)
    setSelectedState('')
    setCities([])
    setSelectedCities(new Set())
    setDeployResults(null)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* Step indicator */}
      <div style={card({ padding:'14px 18px' })}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <Step n={1} label="Write content" active={step === 1} done={step > 1}/>
          <ChevronRight size={14} color="#d1d5db"/>
          <Step n={2} label="Pick cities" active={step === 2} done={step > 2} disabled={!campaign}/>
          <ChevronRight size={14} color="#d1d5db"/>
          <Step n={3} label="Deploy" active={step === 3} done={false} disabled={!campaign || selectedCities.size === 0}/>
          <div style={{ marginLeft:'auto' }}>
            {campaign && step !== 1 && (
              <button onClick={reset} style={miniBtn()}><X size={11}/> Start over</button>
            )}
          </div>
        </div>
      </div>

      {/* ───────────── STEP 1 ───────────── */}
      {step === 1 && (
        <div style={card()}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <Sparkles size={20} color={R}/>
            <div>
              <div style={{ fontFamily:FH, fontWeight:800, fontSize:20, color:BLK }}>Tell Claude what to write</div>
              <div style={{ fontFamily:FB, fontSize:13, color:'#6b7280', marginTop:2 }}>
                AI writes one master with rotation variants + location tokens. You deploy it across N cities, each gets a unique page.
              </div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Field label="Topic" required>
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Website Design, Roofing Services, Personal Injury Law"
                style={inp()}/>
            </Field>
            <Field label="Company name (optional)">
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Unified Marketing"
                style={inp()}/>
            </Field>
            <Field label="Phone number" hint="Used for [koto_phone] in CTAs and schema">
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(512) 555-1234"
                style={inp()}/>
            </Field>
            <Field label="Post type">
              <select value={postType} onChange={e => setPostType(e.target.value)} style={inp()}>
                <option value="page">Page</option>
                <option value="post">Post</option>
              </select>
            </Field>
            <Field label="Variants per section">
              <select value={variantsPerSection} onChange={e => setVariantsPerSection(e.target.value)} style={inp()}>
                {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="FAQ count">
              <select value={faqCount} onChange={e => setFaqCount(e.target.value)} style={inp()}>
                {[3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Notes for Claude (optional)" hint="Tone, emphasis, specific points to hit">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="e.g. emphasize affordable pricing for small businesses, B2B tone, mention 24/7 support"
              style={{ ...inp(), resize:'vertical', minHeight:60 }}/>
          </Field>

          <Field label="Custom HTML wrapper (optional)" hint="Use {{HERO_HEADLINE}}, {{HERO_SUB}}, {{SECTIONS}}, {{FAQS}}, {{CTA}} placeholders. Leave blank for clean semantic HTML.">
            <textarea value={customHtml} onChange={e => setCustomHtml(e.target.value)} rows={4}
              placeholder={'<div class="my-template">\n  <h1>{{HERO_HEADLINE}}</h1>\n  {{SECTIONS}}\n  {{FAQS}}\n</div>'}
              style={{ ...inp(), resize:'vertical', minHeight:80, fontFamily:'ui-monospace,Menlo,monospace', fontSize:12 }}/>
          </Field>

          <div style={{ marginTop:18, display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={generateMaster} disabled={generating || !topic.trim()} style={primaryBtn()}>
              {generating ? <Loader2 size={14} className="spin"/> : <Wand2 size={14}/>}
              {generating ? 'Claude is writing…' : 'Generate Master'}
            </button>
          </div>
        </div>
      )}

      {/* Show master preview after step 1 */}
      {campaign && step >= 2 && (
        <div style={card({ background:'#fafafa' })}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <CheckCircle2 size={16} color={GRN}/>
            <div style={{ fontFamily:FH, fontWeight:800, fontSize:14, color:BLK }}>Master ready</div>
            <span style={pill(GRN, `${GRN}15`)}>{campaign.master?.sections?.length || 0} sections · {campaign.master?.faqs?.length || 0} FAQs</span>
          </div>
          <div style={{ fontFamily:FB, fontSize:13, color:'#6b7280' }}>
            <strong>Topic:</strong> {campaign.topic}
            {campaign.master?.hero?.headline_variants?.[0] && (
              <>
                <br/>
                <strong>Sample H1:</strong> <code style={{ fontSize:12 }}>{campaign.master.hero.headline_variants[0]}</code>
              </>
            )}
          </div>
        </div>
      )}

      {/* ───────────── STEP 2 ───────────── */}
      {step === 2 && campaign && (
        <div style={card()}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
            <MapPin size={20} color={R}/>
            <div>
              <div style={{ fontFamily:FH, fontWeight:800, fontSize:20, color:BLK }}>Pick cities</div>
              <div style={{ fontFamily:FB, fontSize:13, color:'#6b7280', marginTop:2 }}>
                Each city you select gets its own published page with the city baked into the HTML.
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:14, marginBottom:14 }}>
            <Field label="State">
              <select value={selectedState} onChange={e => setSelectedState(e.target.value)} style={inp()}>
                <option value="">— pick state —</option>
                {states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Filter cities">
              <input value={citySearch} onChange={e => setCitySearch(e.target.value)} placeholder="Type to filter…"
                style={inp()} disabled={!cities.length}/>
            </Field>
          </div>

          {loadingCities && (
            <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:FB, fontSize:13, color:'#6b7280' }}>
              <Loader2 size={14} className="spin"/> Loading cities from Census…
            </div>
          )}

          {!loadingCities && cities.length > 0 && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:12, color:'#6b7280', fontFamily:FB }}>
                <span><strong>{selectedCities.size}</strong> of {filteredCities().length} selected</span>
                <button onClick={selectAllFiltered} style={miniBtn()}>Select all filtered</button>
                <button onClick={clearAll} style={miniBtn()}>Clear</button>
                <span style={{ marginLeft:'auto', fontFamily:FB, fontSize:11 }}>
                  Cap: 100 per deploy
                </span>
              </div>
              <div style={{ maxHeight:340, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:8, padding:8, background:'#fff' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:6 }}>
                  {filteredCities().slice(0, 500).map(c => (
                    <label key={c.fips} style={cityChip(selectedCities.has(c.name))}>
                      <input type="checkbox" checked={selectedCities.has(c.name)} onChange={() => toggleCity(c.name)}
                        style={{ marginRight:6 }}/>
                      <span style={{ flex:1, fontSize:13 }}>{c.name}</span>
                      <span style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase' }}>{c.kind}</span>
                    </label>
                  ))}
                </div>
                {filteredCities().length > 500 && (
                  <div style={{ marginTop:10, fontSize:11, color:'#9ca3af', fontFamily:FB, textAlign:'center' }}>
                    Showing first 500 — narrow the filter to see more
                  </div>
                )}
              </div>
            </>
          )}

          <div style={{ marginTop:18, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
            <button onClick={() => setStep(1)} style={miniBtn()}><ChevronLeft size={12}/> Back</button>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={previewOne} disabled={selectedCities.size === 0} style={miniBtn({ color:T, borderColor:T })}>
                <Eye size={12}/> Preview first city
              </button>
              <button onClick={deploy} disabled={!isV4 || selectedCities.size === 0 || deploying} style={primaryBtn()}>
                <Upload size={14}/> Deploy {selectedCities.size} {campaign.post_type === 'post' ? 'posts' : 'pages'}
              </button>
            </div>
          </div>
          {!isV4 && (
            <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8, fontSize:12, color:R, fontFamily:FB }}>
              <AlertTriangle size={12}/> Deploy requires a v4-paired site. This site is not v4.
            </div>
          )}
        </div>
      )}

      {/* ───────────── STEP 3 ───────────── */}
      {step === 3 && (
        <div style={card()}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
            {deploying ? <Loader2 size={20} className="spin" color={R}/> : <CheckCircle2 size={20} color={GRN}/>}
            <div>
              <div style={{ fontFamily:FH, fontWeight:800, fontSize:20, color:BLK }}>
                {deploying ? 'Deploying…' : 'Deploy complete'}
              </div>
              {deployResults && (
                <div style={{ fontFamily:FB, fontSize:13, color:'#6b7280', marginTop:2 }}>
                  <strong style={{ color:GRN }}>{deployResults.deployed} published</strong>
                  {deployResults.failed > 0 && <> · <strong style={{ color:R }}>{deployResults.failed} failed</strong></>}
                </div>
              )}
            </div>
          </div>

          {deployResults && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FB }}>
              <thead>
                <tr>
                  <th style={th()}>City</th>
                  <th style={th()}>Slug</th>
                  <th style={th({ width:90 })}>Status</th>
                  <th style={th({ width:40 })}></th>
                </tr>
              </thead>
              <tbody>
                {deployResults.results.map(r => (
                  <tr key={r?.id || `${r?.city}-${Math.random()}`} style={{ borderTop:'1px solid #f1f5f9' }}>
                    <td style={td()}>{r?.city}</td>
                    <td style={td({ color:'#6b7280' })}>{r?.resolved_slug || '—'}</td>
                    <td style={td()}>
                      {r?.status === 'published'
                        ? <Pill color={GRN} bg={`${GRN}15`}>Published</Pill>
                        : <Pill color={R} bg={`${R}15`}>Failed</Pill>}
                    </td>
                    <td style={td()}>
                      {r?.wp_post_url && (
                        <a href={r.wp_post_url} target="_blank" rel="noopener noreferrer" style={{ color:'#6b7280', display:'inline-flex' }}>
                          <ExternalLink size={13}/>
                        </a>
                      )}
                      {r?.error && (
                        <span title={r.error} style={{ color:R, cursor:'help' }}><AlertTriangle size={13}/></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!deploying && deployResults && (
            <div style={{ marginTop:16, display:'flex', justifyContent:'flex-end' }}>
              <button onClick={reset} style={primaryBtn()}>Start a new campaign</button>
            </div>
          )}
        </div>
      )}

      {/* Preview overlay */}
      {preview?.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
          onClick={() => setPreview(null)}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:900, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:10 }}>
              <Eye size={16} color={T}/>
              <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:15 }}>{preview.title}</div>
              <button onClick={() => setPreview(null)} style={miniBtn()}><X size={11}/></button>
            </div>
            <div style={{ padding:14, background:'#fafafa', borderBottom:'1px solid #e5e7eb', fontSize:12, fontFamily:FB, color:'#6b7280' }}>
              <div><strong>Meta title:</strong> {preview.metaTitle}</div>
              <div><strong>Meta description:</strong> {preview.metaDescription}</div>
              <div><strong>Slug:</strong> <code style={{ fontSize:11 }}>{preview.slug}</code></div>
            </div>
            <div style={{ flex:1, overflow:'auto', padding:18, fontFamily:FB, fontSize:14, color:BLK, lineHeight:1.6 }}
              dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}/>
            {preview.jsonLd && (
              <details style={{ borderTop:'1px solid #e5e7eb', padding:14, background:'#fafafa' }}>
                <summary style={{ fontFamily:FH, fontWeight:700, fontSize:12, color:'#6b7280', cursor:'pointer' }}>
                  JSON-LD Schema
                </summary>
                <pre style={{ marginTop:8, fontFamily:'ui-monospace,Menlo,monospace', fontSize:11, color:BLK, whiteSpace:'pre-wrap', maxHeight:200, overflow:'auto' }}>
                  {JSON.stringify(JSON.parse(preview.jsonLd), null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Step({ n, label, active, done, disabled }) {
  const color = done ? GRN : active ? R : disabled ? '#d1d5db' : '#9ca3af'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:26, height:26, borderRadius:'50%', background: active ? R : done ? GRN : '#f3f4f6', color: active || done ? '#fff' : '#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FH, fontWeight:800, fontSize:13 }}>
        {done ? '✓' : n}
      </div>
      <div style={{ fontFamily:FH, fontWeight:700, fontSize:13, color }}>{label}</div>
    </div>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ fontSize:12, fontFamily:FH, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>
        {label} {required && <span style={{ color:R }}>*</span>}
      </div>
      {children}
      {hint && <div style={{ marginTop:4, fontSize:11, color:'#9ca3af', fontFamily:FB }}>{hint}</div>}
    </div>
  )
}

const stateNames = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado', CT:'Connecticut',
  DE:'Delaware', FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa',
  KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan',
  MN:'Minnesota', MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire',
  NJ:'New Jersey', NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio',
  OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota',
  TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia', WA:'Washington', WV:'West Virginia',
  WI:'Wisconsin', WY:'Wyoming', DC:'District of Columbia', PR:'Puerto Rico',
}
function stateName(abbr) { return stateNames[abbr] || abbr }

// ── Styles ────────────────────────────────────────────────────────────────────

const card = (x={}) => ({ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:22, ...x })
const inp = () => ({ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:14, fontFamily:FB, outline:'none', background:'#fff' })
const miniBtn = (x={}) => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 13px', borderRadius:8, border:`1px solid ${x.borderColor||'#e5e7eb'}`, background:'#fff', color:x.color||'#6b7280', fontFamily:FH, fontSize:13, fontWeight:700, cursor:'pointer' })
const primaryBtn = () => ({ display:'inline-flex', alignItems:'center', gap:7, padding:'10px 18px', borderRadius:9, border:'none', background:R, color:'#fff', fontFamily:FH, fontSize:14, fontWeight:700, cursor:'pointer' })
const pill = (color, bg) => ({ display:'inline-flex', alignItems:'center', padding:'4px 10px', borderRadius:6, fontSize:11, fontFamily:FH, fontWeight:700, color, background:bg, textTransform:'uppercase', letterSpacing:'.04em' })
const Pill = ({ children, color, bg }) => <span style={pill(color, bg)}>{children}</span>
const th = (x={}) => ({ textAlign:'left', padding:'10px 12px', fontFamily:FH, fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', ...x })
const td = (x={}) => ({ padding:'10px 12px', ...x })
const cityChip = (selected) => ({
  display:'flex', alignItems:'center', padding:'6px 10px', borderRadius:7,
  border:`1px solid ${selected ? R : '#e5e7eb'}`,
  background: selected ? `${R}10` : '#fff',
  cursor:'pointer', fontFamily:FB,
})
