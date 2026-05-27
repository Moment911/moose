"use client"
import { useEffect, useState } from 'react'
import {
  Sparkles, Loader2, ChevronRight, ChevronLeft, MapPin, RefreshCw, Upload,
  AlertTriangle, CheckCircle2, Wand2, FileText, File, ExternalLink, Eye, X,
  Edit3, History, Save, Code, Coins,
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
  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [heroVideoUrl, setHeroVideoUrl] = useState('')
  const [heroImageAlt, setHeroImageAlt] = useState('')
  const [variantsPerSection, setVariantsPerSection] = useState(4)
  const [faqCount, setFaqCount] = useState(6)
  const [generating, setGenerating] = useState(false)
  const [campaign, setCampaign] = useState(null) // { id, topic, master, ... }
  const [savedCampaigns, setSavedCampaigns] = useState([])
  const [loadingSaved, setLoadingSaved] = useState(false)

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

  // Master editor + deploy history
  const [editorOpen, setEditorOpen] = useState(false)
  const [editedMaster, setEditedMaster] = useState(null)
  const [editedPhone, setEditedPhone] = useState('')
  const [editedCompanyName, setEditedCompanyName] = useState('')
  const [editedHeroImage, setEditedHeroImage] = useState('')
  const [editedHeroVideo, setEditedHeroVideo] = useState('')
  const [editedHeroAlt, setEditedHeroAlt] = useState('')
  const [deployHistory, setDeployHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [inspectDeploy, setInspectDeploy] = useState(null)
  const [redeploying, setRedeploying] = useState(false)

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

  // Load saved campaigns when on step 1 with no campaign loaded
  async function loadSavedCampaigns() {
    if (!site?.id) return
    setLoadingSaved(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_campaigns', agency_id: agencyId, site_id: site.id }),
      })
      const d = await r.json()
      if (d.ok) setSavedCampaigns(d.campaigns || [])
    } catch {}
    setLoadingSaved(false)
  }

  useEffect(() => {
    if (step === 1 && !campaign && site?.id) loadSavedCampaigns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, campaign, site?.id])

  async function openCampaign(campaignId) {
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_campaign', agency_id: agencyId, campaign_id: campaignId }),
      })
      const d = await r.json()
      if (d.error) { toast.error(d.error); return }
      setCampaign(d.campaign)
      setStep(2)
      toast.success(`Loaded "${d.campaign.topic}"`)
    } catch (e) { toast.error(e.message) }
  }

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
          hero_image_url: heroImageUrl.trim() || null,
          hero_video_url: heroVideoUrl.trim() || null,
          hero_image_alt: heroImageAlt.trim() || null,
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
    setEditorOpen(false)
    setEditedMaster(null)
    setDeployHistory([])
    setHistoryOpen(false)
  }

  async function loadDeployHistory() {
    if (!campaign?.id) return
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'list_deploys', agency_id: agencyId, campaign_id: campaign.id }),
      })
      const d = await r.json()
      if (d.ok) setDeployHistory(d.deploys || [])
    } catch {}
  }

  async function saveMasterEdits() {
    if (!editedMaster) return
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'update_master',
          agency_id: agencyId,
          campaign_id: campaign.id,
          master: editedMaster,
          phone: editedPhone,
          company_name: editedCompanyName,
          hero_image_url: editedHeroImage,
          hero_video_url: editedHeroVideo,
          hero_image_alt: editedHeroAlt,
        }),
      })
      const d = await r.json()
      if (d.error) { toast.error(d.error); return }
      setCampaign(d.campaign)
      setEditedMaster(null)
      setEditorOpen(false)
      toast.success('Master saved · Re-deploy to push changes')
    } catch (e) { toast.error(e.message) }
  }

  async function redeployAll() {
    if (!campaign?.id) return
    if (!confirm(`Re-deploy this campaign to all previously-published cities? The existing WP posts will be updated in place (no new URLs).`)) return
    setRedeploying(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'redeploy', agency_id: agencyId, campaign_id: campaign.id }),
      })
      const d = await r.json()
      if (d.error) { toast.error(d.error); return }
      toast.success(`Re-deployed ${d.updated} · ${d.failed} failed`)
      await loadDeployHistory()
    } catch (e) { toast.error(e.message) }
    setRedeploying(false)
  }

  // Auto-load deploy history when a campaign is loaded
  useEffect(() => {
    if (campaign?.id) loadDeployHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id])

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

      {/* Saved campaigns (only on step 1 with no active campaign) */}
      {step === 1 && !campaign && savedCampaigns.length > 0 && (
        <div style={card({ background:'#fafafa' })}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <History size={18} color={T}/>
            <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:15, color:BLK }}>
              Saved campaigns ({savedCampaigns.length})
            </div>
            <button onClick={loadSavedCampaigns} disabled={loadingSaved} style={miniBtn()}>
              {loadingSaved ? <Loader2 size={11} className="spin"/> : <RefreshCw size={11}/>} Refresh
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:10 }}>
            {savedCampaigns.map(c => (
              <div key={c.id} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:14, cursor:'pointer' }}
                onClick={() => openCampaign(c.id)}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <Sparkles size={14} color={R}/>
                  <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:14, color:BLK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {c.topic}
                  </div>
                  <Pill color={c.post_type === 'post' ? T : '#6b7280'} bg={`${c.post_type === 'post' ? T : '#6b7280'}15`}>{c.post_type}</Pill>
                </div>
                <div style={{ fontSize:11, fontFamily:FB, color:'#6b7280', display:'flex', alignItems:'center', gap:10 }}>
                  <StatusDot status={c.status}/>
                  <span>{c.status}</span>
                  {c.last_deploy_count > 0 && (
                    <span style={{ marginLeft:'auto' }}>{c.last_deploy_count} deployed</span>
                  )}
                </div>
                {c.last_deploy_at && (
                  <div style={{ marginTop:4, fontSize:11, fontFamily:FB, color:'#9ca3af' }}>
                    Last deploy {timeAgo(c.last_deploy_at)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────────── STEP 1 ───────────── */}
      {step === 1 && (
        <div style={card()}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <Sparkles size={20} color={R}/>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:FH, fontWeight:800, fontSize:20, color:BLK }}>
                {savedCampaigns.length > 0 ? 'Start a new campaign' : 'Tell Claude what to write'}
              </div>
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

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Field label="Hero image URL (optional)" hint="Paste any public image URL. Becomes the hero image on every deployed page.">
              <input value={heroImageUrl} onChange={e => setHeroImageUrl(e.target.value)} placeholder="https://cdn.example.com/hero.jpg" style={inp()}/>
            </Field>
            <Field label="Hero video URL (optional)" hint="Paste mp4/webm URL. Takes precedence over image if both are set.">
              <input value={heroVideoUrl} onChange={e => setHeroVideoUrl(e.target.value)} placeholder="https://cdn.example.com/hero.mp4" style={inp()}/>
            </Field>
          </div>
          {heroImageUrl && (
            <Field label="Image alt text (optional)" hint="For accessibility + SEO. Defaults to the page title.">
              <input value={heroImageAlt} onChange={e => setHeroImageAlt(e.target.value)} placeholder="Website design team at work" style={inp()}/>
            </Field>
          )}

          <Field label="Custom HTML wrapper (optional)" hint="Use {{HERO_HEADLINE}}, {{HERO_SUB}}, {{HERO_MEDIA}}, {{SECTIONS}}, {{FAQS}}, {{CTA}}, {{SERVICE_AREAS}} placeholders. Leave blank for clean semantic HTML.">
            <textarea value={customHtml} onChange={e => setCustomHtml(e.target.value)} rows={4}
              placeholder={'<div class="my-template">\n  {{HERO_MEDIA}}\n  <h1>{{HERO_HEADLINE}}</h1>\n  {{SECTIONS}}\n  {{FAQS}}\n  {{SERVICE_AREAS}}\n</div>'}
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

      {/* Show master summary after step 1 */}
      {campaign && step >= 2 && (
        <div style={card({ background:'#fafafa' })}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <CheckCircle2 size={18} color={GRN}/>
            <div style={{ fontFamily:FH, fontWeight:800, fontSize:15, color:BLK }}>Master ready</div>
            <span style={pill(GRN, `${GRN}15`)}>{campaign.master?.sections?.length || 0} sections · {campaign.master?.faqs?.length || 0} FAQs</span>
            {campaign.tokens_used > 0 && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontFamily:FB, color:'#9ca3af' }}>
                <Coins size={11}/> {campaign.tokens_used.toLocaleString()} tokens
              </span>
            )}
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button onClick={() => {
                setEditedMaster(structuredClone(campaign.master))
                setEditedPhone(campaign.phone || '')
                setEditedCompanyName(campaign.company_name || '')
                setEditedHeroImage(campaign.hero_image_url || '')
                setEditedHeroVideo(campaign.hero_video_url || '')
                setEditedHeroAlt(campaign.hero_image_alt || '')
                setEditorOpen(true)
              }} style={miniBtn()}>
                <Edit3 size={11}/> Edit master
              </button>
              {deployHistory.length > 0 && (
                <button onClick={() => setHistoryOpen(o => !o)} style={miniBtn()}>
                  <History size={11}/> History ({deployHistory.length})
                </button>
              )}
              {deployHistory.length > 0 && (
                <button onClick={redeployAll} disabled={redeploying} style={miniBtn({ color:R, borderColor:R })}>
                  {redeploying ? <Loader2 size={11} className="spin"/> : <RefreshCw size={11}/>} Re-deploy all
                </button>
              )}
            </div>
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

          {historyOpen && deployHistory.length > 0 && (
            <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid #e5e7eb' }}>
              <div style={{ fontSize:11, fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
                Deploy history
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FB }}>
                <thead>
                  <tr>
                    <th style={th()}>City</th>
                    <th style={th()}>Meta title</th>
                    <th style={th({ width:90 })}>RankMath</th>
                    <th style={th({ width:90 })}>Schema</th>
                    <th style={th({ width:90 })}>Status</th>
                    <th style={th({ width:90 })}></th>
                  </tr>
                </thead>
                <tbody>
                  {deployHistory.slice(0, 40).map(d => (
                    <tr key={d.id} style={{ borderTop:'1px solid #f1f5f9' }}>
                      <td style={td()}>{d.city}, {d.state_abbr}</td>
                      <td style={td({ color:'#6b7280', fontSize:12, maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' })}>{d.resolved_meta_title || '—'}</td>
                      <td style={td()}>{d.rank_math_score ? <Pill color={d.rank_math_score >= 80 ? GRN : d.rank_math_score >= 60 ? AMB : R} bg={`${d.rank_math_score >= 80 ? GRN : d.rank_math_score >= 60 ? AMB : R}15`}>{d.rank_math_score}/100</Pill> : <span style={{ color:'#d1d5db' }}>—</span>}</td>
                      <td style={td()}>{d.resolved_jsonld ? <Pill color={T} bg={`${T}15`}>JSON-LD</Pill> : <span style={{ color:'#d1d5db' }}>—</span>}</td>
                      <td style={td()}>
                        {d.status === 'published'
                          ? <Pill color={GRN} bg={`${GRN}15`}>Published</Pill>
                          : <Pill color={R} bg={`${R}15`}>Failed</Pill>}
                      </td>
                      <td style={td()}>
                        <button onClick={() => setInspectDeploy(d)} style={{ background:'transparent', border:'none', color:T, cursor:'pointer', padding:0, marginRight:8 }} title="Inspect resolved SEO + schema">
                          <Eye size={13}/>
                        </button>
                        {d.wp_post_url && (
                          <a href={d.wp_post_url} target="_blank" rel="noopener noreferrer" style={{ color:'#6b7280', display:'inline-flex' }}>
                            <ExternalLink size={13}/>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

      {/* Master Editor overlay */}
      {editorOpen && editedMaster && (
        <MasterEditor
          master={editedMaster} setMaster={setEditedMaster}
          phone={editedPhone} setPhone={setEditedPhone}
          companyName={editedCompanyName} setCompanyName={setEditedCompanyName}
          heroImage={editedHeroImage} setHeroImage={setEditedHeroImage}
          heroVideo={editedHeroVideo} setHeroVideo={setEditedHeroVideo}
          heroAlt={editedHeroAlt} setHeroAlt={setEditedHeroAlt}
          onSave={saveMasterEdits}
          onClose={() => { setEditorOpen(false); setEditedMaster(null) }}
        />
      )}

      {/* Inspect deploy overlay */}
      {inspectDeploy && (
        <DeployInspector deploy={inspectDeploy} onClose={() => setInspectDeploy(null)}/>
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

function MasterEditor({ master, setMaster, phone, setPhone, companyName, setCompanyName, heroImage, setHeroImage, heroVideo, setHeroVideo, heroAlt, setHeroAlt, onSave, onClose }) {
  function patch(path, value) {
    setMaster(prev => {
      const next = structuredClone(prev)
      let cur = next
      const keys = path.split('.')
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i]
        const idx = /^\d+$/.test(k) ? Number(k) : k
        cur = cur[idx]
      }
      const last = keys[keys.length - 1]
      cur[/^\d+$/.test(last) ? Number(last) : last] = value
      return next
    })
  }

  return (
    <div style={overlay()} onClick={onClose}>
      <div style={{ ...modal(), maxWidth:1000, height:'92vh', display:'flex', flexDirection:'column' }} onClick={e => e.stopPropagation()}>
        <div style={modalHeader()}>
          <Edit3 size={18} color={R}/>
          <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:16 }}>Edit master</div>
          <button onClick={onSave} style={primaryBtn()}><Save size={13}/> Save changes</button>
          <button onClick={onClose} style={miniBtn()}><X size={11}/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:22, display:'flex', flexDirection:'column', gap:18 }}>

          {/* Campaign-level tokens (resolved everywhere) */}
          <EditorBlock label="Campaign-wide token values">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label="Company name" hint="Resolves to [koto_company_name] on every page">
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Unified Marketing" style={inp()}/>
              </Field>
              <Field label="Phone number" hint="Resolves to [koto_phone] / [koto_phone_link]">
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(512) 555-1234" style={inp()}/>
              </Field>
            </div>
          </EditorBlock>

          <EditorBlock label="Hero media">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label="Hero image URL" hint="Public URL — applied to every city's hero">
                <input value={heroImage} onChange={e => setHeroImage(e.target.value)} placeholder="https://cdn.example.com/hero.jpg" style={inp()}/>
              </Field>
              <Field label="Hero video URL" hint="mp4/webm — takes precedence over image if both set">
                <input value={heroVideo} onChange={e => setHeroVideo(e.target.value)} placeholder="https://cdn.example.com/hero.mp4" style={inp()}/>
              </Field>
            </div>
            {heroImage && (
              <Field label="Image alt text" hint="Defaults to the page title">
                <input value={heroAlt} onChange={e => setHeroAlt(e.target.value)} style={inp()}/>
              </Field>
            )}
            {(heroImage || heroVideo) && (
              <div style={{ marginTop:10, padding:10, background:'#fff', borderRadius:8, border:'1px solid #e5e7eb' }}>
                <div style={{ fontSize:11, fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Preview</div>
                {heroVideo ? (
                  <video controls preload="metadata" style={{ maxWidth:'100%', maxHeight:220, borderRadius:6 }} src={heroVideo}/>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroImage} alt={heroAlt || 'hero preview'} style={{ maxWidth:'100%', maxHeight:220, borderRadius:6 }} onError={(e) => { e.currentTarget.style.display = 'none' }}/>
                )}
              </div>
            )}
          </EditorBlock>

          {/* Hero */}
          <EditorBlock label="Hero — H1 variants">
            {master.hero.headline_variants.map((v, i) => (
              <textarea key={i} value={v} onChange={e => patch(`hero.headline_variants.${i}`, e.target.value)} rows={2} style={inp({ resize:'vertical', fontFamily:FB, fontSize:14 })}/>
            ))}
          </EditorBlock>
          <EditorBlock label="Hero — subheadline variants">
            {master.hero.subheadline_variants.map((v, i) => (
              <textarea key={i} value={v} onChange={e => patch(`hero.subheadline_variants.${i}`, e.target.value)} rows={3} style={inp({ resize:'vertical', fontFamily:FB, fontSize:13 })}/>
            ))}
          </EditorBlock>

          {/* Sections */}
          {master.sections.map((s, si) => (
            <EditorBlock key={si} label={`Section ${si + 1}`}>
              <Field label="Heading template">
                <input value={s.heading_template} onChange={e => patch(`sections.${si}.heading_template`, e.target.value)} style={inp()}/>
              </Field>
              <div style={{ fontSize:11, fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginTop:8, marginBottom:6 }}>Body variants</div>
              {s.body_variants.map((v, vi) => (
                <textarea key={vi} value={v} onChange={e => patch(`sections.${si}.body_variants.${vi}`, e.target.value)} rows={5} style={inp({ resize:'vertical', fontFamily:FB, fontSize:13 })}/>
              ))}
            </EditorBlock>
          ))}

          {/* FAQs */}
          {master.faqs.map((f, fi) => (
            <EditorBlock key={fi} label={`FAQ ${fi + 1}`}>
              <Field label="Question template">
                <input value={f.question_template} onChange={e => patch(`faqs.${fi}.question_template`, e.target.value)} style={inp()}/>
              </Field>
              <div style={{ fontSize:11, fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginTop:8, marginBottom:6 }}>Answer variants</div>
              {f.answer_variants.map((v, vi) => (
                <textarea key={vi} value={v} onChange={e => patch(`faqs.${fi}.answer_variants.${vi}`, e.target.value)} rows={3} style={inp({ resize:'vertical', fontFamily:FB, fontSize:13 })}/>
              ))}
            </EditorBlock>
          ))}

          {/* CTA + Meta + Schema */}
          <EditorBlock label="CTA">
            <Field label="Headline"><input value={master.cta.headline} onChange={e => patch('cta.headline', e.target.value)} style={inp()}/></Field>
            <Field label="Body"><textarea value={master.cta.body} onChange={e => patch('cta.body', e.target.value)} rows={3} style={inp({ resize:'vertical' })}/></Field>
          </EditorBlock>
          <EditorBlock label="SEO Meta">
            <Field label="Meta title template" hint="50-60 chars, includes [koto_city]">
              <input value={master.meta.title_template} onChange={e => patch('meta.title_template', e.target.value)} style={inp()}/>
            </Field>
            <Field label="Meta description template" hint="140-160 chars">
              <textarea value={master.meta.description_template} onChange={e => patch('meta.description_template', e.target.value)} rows={2} style={inp({ resize:'vertical' })}/>
            </Field>
          </EditorBlock>
          <EditorBlock label="JSON-LD Schema template">
            <textarea value={master.schema_jsonld_template || ''} onChange={e => patch('schema_jsonld_template', e.target.value)} rows={8}
              style={inp({ resize:'vertical', fontFamily:'ui-monospace,Menlo,monospace', fontSize:11 })}/>
          </EditorBlock>
        </div>
      </div>
    </div>
  )
}

function EditorBlock({ label, children }) {
  return (
    <div style={{ background:'#fafafa', border:'1px solid #e5e7eb', borderRadius:10, padding:16 }}>
      <div style={{ fontFamily:FH, fontWeight:800, fontSize:13, color:BLK, marginBottom:10 }}>{label}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {children}
      </div>
    </div>
  )
}

function DeployInspector({ deploy, onClose }) {
  let prettyJsonld = ''
  if (deploy.resolved_jsonld) {
    try { prettyJsonld = JSON.stringify(JSON.parse(deploy.resolved_jsonld), null, 2) }
    catch { prettyJsonld = deploy.resolved_jsonld }
  }
  return (
    <div style={overlay()} onClick={onClose}>
      <div style={{ ...modal(), maxWidth:880, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }} onClick={e => e.stopPropagation()}>
        <div style={modalHeader()}>
          <MapPin size={16} color={T}/>
          <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:15 }}>{deploy.city}, {deploy.state_abbr}</div>
          {deploy.wp_post_url && (
            <a href={deploy.wp_post_url} target="_blank" rel="noopener noreferrer" style={miniBtn({ color:T, borderColor:T, textDecoration:'none' })}>
              <ExternalLink size={11}/> Open
            </a>
          )}
          <button onClick={onClose} style={miniBtn()}><X size={11}/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:22, display:'flex', flexDirection:'column', gap:16 }}>
          <InspectRow label="Status" value={deploy.status}/>
          <InspectRow label="WP post type" value={deploy.wp_post_type}/>
          <InspectRow label="WP post ID" value={deploy.wp_post_id ? String(deploy.wp_post_id) : '—'}/>
          <InspectRow label="Slug" value={deploy.resolved_slug || '—'} mono/>
          <InspectRow label="Title" value={deploy.resolved_title || '—'}/>
          <InspectRow label="Meta title" value={deploy.resolved_meta_title || '—'} mono/>
          <InspectRow label="Meta description" value={deploy.resolved_meta_description || '—'}/>
          {deploy.error && <InspectRow label="Error" value={deploy.error} mono error/>}
          {prettyJsonld && (
            <div>
              <div style={{ fontSize:11, fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                <Code size={11}/> JSON-LD Schema
              </div>
              <pre style={{ background:'#0b1220', color:'#e2e8f0', padding:14, borderRadius:8, fontSize:11, fontFamily:'ui-monospace,Menlo,monospace', whiteSpace:'pre-wrap', maxHeight:360, overflow:'auto' }}>{prettyJsonld}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InspectRow({ label, value, mono, error }) {
  return (
    <div>
      <div style={{ fontSize:11, fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:14, fontFamily: mono ? 'ui-monospace,Menlo,monospace' : FB, color: error ? R : BLK, wordBreak:'break-word' }}>{value}</div>
    </div>
  )
}

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

function timeAgo(s) {
  if (!s) return ''
  try {
    const diff = (Date.now() - new Date(s).getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff/86400)}d ago`
    return new Date(s).toLocaleDateString(undefined, { month:'short', day:'numeric' })
  } catch { return s }
}

function StatusDot({ status }) {
  const c = status === 'deployed' ? GRN : status === 'ready' ? T : status === 'deploying' ? AMB : '#9ca3af'
  return <span style={{ width:7, height:7, borderRadius:'50%', background:c, display:'inline-block' }}/>
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card = (x={}) => ({ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:22, ...x })
const inp = (x={}) => ({ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:14, fontFamily:FB, outline:'none', background:'#fff', ...x })
const overlay = () => ({ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 })
const modal = () => ({ background:'#fff', borderRadius:14, width:'100%' })
const modalHeader = () => ({ padding:'14px 20px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:10 })
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
