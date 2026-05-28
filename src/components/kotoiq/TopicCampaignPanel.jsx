"use client"
import React, { useEffect, useState } from 'react'
import {
  Sparkles, Loader2, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, MapPin, RefreshCw, Upload,
  AlertTriangle, CheckCircle2, Wand2, FileText, File, ExternalLink, Eye, X,
  Edit3, History, Save, Code, Coins, TrendingUp, MousePointerClick, Users, Target,
  Download, Trash2, Star, ShieldCheck, Activity,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

// Auto-freshness threshold options — keys must match STALE_THRESHOLDS_MS in
// src/lib/dataIntegrity.ts. The nightly cron re-deploys an opted-in campaign
// when its last deploy is older than the chosen window.
const REFRESH_THRESHOLDS = [
  { key:'reviews',          label:'Reviews — 7d' },
  { key:'business-listing', label:'Listings — 30d' },
  { key:'gbp-categories',   label:'GBP — 90d' },
  { key:'geo-municipality', label:'Geo — 180d' },
]

/**
 * Build a short human note from a capture response's style_tokens so the
 * operator can SEE that we read their real brand (font + primary color) rather
 * than guessing. Returns null when nothing usable was captured, or a migration
 * hint when the style_tokens column isn't applied yet.
 */
function brandMatchNote(d) {
  const t = d?.style_tokens || {}
  const bits = []
  if (t.fontBody) bits.push(t.fontBody.split(',')[0].replace(/["']/g, '').trim())
  if (t.colorPrimary) bits.push(t.colorPrimary)
  if (bits.length) {
    const stored = d.style_tokens_stored ? '' : (d.style_tokens_migrated === false ? ' (not saved — apply style_tokens migration, then re-capture)' : '')
    return `Brand match: ${bits.join(' · ')}${stored}`
  }
  if (d.style_tokens_migrated === false) return 'style_tokens column not migrated yet — base styling will be generic until applied'
  return null
}

/**
 * TopicCampaignPanel — three-step wizard for bulk topic-based page deploys.
 *
 *   Step 1: Topic + phone + company + post type + notes + optional HTML wrapper
 *           → "Generate Master" → preview of variants
 *   Step 2: State + city picker (Census-backed) + "Preview First City"
 *   Step 3: Deploy → progress + per-city results table
 */
export default function TopicCampaignPanel({ site, client }) {
  const { agencyId } = useAuth()
  const [step, setStep] = useState(1)

  // Step 1 state
  const [topic, setTopic] = useState('')
  const [companyName, setCompanyName] = useState(client?.name || site?.site_name || '')

  function fmtPhone(raw) {
    if (!raw) return ''
    const d = raw.replace(/\D/g, '')
    const digits = d.length === 11 && d[0] === '1' ? d.slice(1) : d
    if (digits.length !== 10) return raw
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  const [phone, setPhone] = useState(fmtPhone(client?.phone || client?.onboarding_phone_display || ''))
  const [postType, setPostType] = useState('page')
  const [notes, setNotes] = useState('')
  const [customHtml, setCustomHtml] = useState('')
  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [heroVideoUrl, setHeroVideoUrl] = useState('')
  const [heroImageAlt, setHeroImageAlt] = useState('')
  const [variantsPerSection, setVariantsPerSection] = useState(4)
  const [faqCount, setFaqCount] = useState(6)
  const [generating, setGenerating] = useState(false)
  const [genLog, setGenLog] = useState([])
  const [optimizeReport, setOptimizeReport] = useState(null) // structured pipeline report
  const [reportExpanded, setReportExpanded] = useState({})   // which steps are expanded
  const [paused, setPaused] = useState(false)
  const pauseRef = React.useRef(false)
  function logGen(msg) { setGenLog(prev => [...prev, { time: new Date(), msg }]) }
  function requestPause() { pauseRef.current = true; setPaused(true); logGen('⏸ Paused — make your changes, then click Resume') }
  function requestResume() { pauseRef.current = false; setPaused(false) }
  /** Wait if paused. Returns true if resumed, so pipeline continues. */
  async function checkPause(stepName) {
    if (!pauseRef.current) return
    logGen(`⏸ Paused before ${stepName} — waiting for resume…`)
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (!pauseRef.current) { clearInterval(check); resolve() }
      }, 500)
    })
    logGen(`▶ Resumed — re-checking before ${stepName}…`)
  }
  const [competitorSampleCity, setCompetitorSampleCity] = useState('')
  const [competitorSampleState, setCompetitorSampleState] = useState('')

  // Post-generation audits — opened from master-ready toolbar
  const [eeatOpen, setEeatOpen] = useState(false)
  const [eeatBusy, setEeatBusy] = useState(false)
  const [eeatResult, setEeatResult] = useState(null)
  const [topicalOpen, setTopicalOpen] = useState(false)
  const [topicalBusy, setTopicalBusy] = useState(false)
  const [topicalResult, setTopicalResult] = useState(null)

  async function runEeatAudit() {
    if (!campaign?.id || eeatBusy) return
    setEeatBusy(true); setEeatOpen(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'eeat_score', agency_id: agencyId, campaign_id: campaign.id }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); setEeatResult(null) }
      else setEeatResult(d.audit)
    } catch (e) { toast.error(e.message); setEeatResult(null) }
    setEeatBusy(false)
  }

  async function runTopicalExpand() {
    if (!campaign?.id || topicalBusy) return
    setTopicalBusy(true); setTopicalOpen(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'topical_expand', agency_id: agencyId, campaign_id: campaign.id }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); setTopicalResult(null) }
      else { setTopicalResult(d.expansion); initClusterSelection(d.expansion) }
    } catch (e) { toast.error(e.message); setTopicalResult(null) }
    setTopicalBusy(false)
  }

  const [campaign, setCampaign] = useState(null) // { id, topic, master, ... }
  const [savedCampaigns, setSavedCampaigns] = useState([])
  const [deletingId, setDeletingId] = useState(null)
  const [fixingGaps, setFixingGaps] = useState(false)
  const [eeatInfoFields, setEeatInfoFields] = useState({})
  const [eeatEditorOpen, setEeatEditorOpen] = useState(false)
  const [savingEeat, setSavingEeat] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [validating, setValidating] = useState(false)
  const [qualityBusy, setQualityBusy] = useState(false)
  const [citationOpen, setCitationOpen] = useState(false)
  const [citationBusy, setCitationBusy] = useState(false)
  const [citationReport, setCitationReport] = useState(null)
  // Connect-Google-reviews picker (campaign editor)
  const [placeOpen, setPlaceOpen] = useState(false)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeBusy, setPlaceBusy] = useState(false)
  const [placeResults, setPlaceResults] = useState([])
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
  const [editedPostType, setEditedPostType] = useState('page')
  const [editedFocusKw, setEditedFocusKw] = useState('')
  const [editedTopic, setEditedTopic] = useState('')
  const [editedCompCity, setEditedCompCity] = useState('')
  const [editedCompState, setEditedCompState] = useState('')
  const [regenBusy, setRegenBusy] = useState(false)
  const [editedWrapper, setEditedWrapper] = useState('')

  // Regenerate the master for an existing draft — re-runs Claude with the
  // (possibly edited) topic + fresh competitor intel. Replaces master
  // content, keeps deploy history.
  async function regenerateMasterFromEditor() {
    if (!campaign?.id || regenBusy) return
    const t = editedTopic.trim()
    if (!t) { toast.error('Topic required'); return }
    if (!confirm('Regenerate the master from scratch? This replaces all current content (sections, FAQs, hero, etc.). Deploy history + custom wrapper are kept. Continue?')) return
    setRegenBusy(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate_master',
          agency_id: agencyId,
          campaign_id: campaign.id,
          topic: t,
          competitor_sample_city: editedCompCity.trim() || null,
          competitor_sample_state_abbr: editedCompState.trim() || null,
        }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); return }
      setCampaign(d.campaign)
      setEditedMaster(structuredClone(d.campaign.master))
      const c = d.competitor_meta
      toast.success(c ? `Regenerated using ${c.competitor_count} competitors from ${c.sample_location}` : 'Master regenerated')
    } catch (e) { toast.error(e.message) }
    setRegenBusy(false)
  }
  const [editedCaptureUrl, setEditedCaptureUrl] = useState('')
  const [editedCaptureBusy, setEditedCaptureBusy] = useState(false)
  const [editedCaptureInfo, setEditedCaptureInfo] = useState(null)

  // AI-assist on whatever's currently in the wrapper textarea — takes the
  // operator's pasted/uploaded HTML and inserts our placeholder tokens at
  // the right structural points via Claude.
  async function aiAssistWrapper(rawHtml) {
    const html = (rawHtml ?? editedWrapper).trim()
    if (!html) { toast.error('Paste HTML into the wrapper field or upload a file first'); return }
    setEditedCaptureBusy(true)
    const tid = toast.loading('Analyzing design with Claude (15-60s for large files)…')
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wrapper_assist', agency_id: agencyId, html, campaign_id: campaign?.id }),
      })
      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        throw new Error(`HTTP ${r.status}${txt ? ` — ${txt.slice(0, 120)}` : ''}`)
      }
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error), { id: tid }); return }
      setEditedWrapper(d.wrapper || '')
      setEditedCaptureInfo({
        used_selector: 'AI-assisted',
        notes: `Placeholders inserted: ${(d.placeholders_used || []).join(', ') || 'none — review output'}`,
        brand: brandMatchNote(d),
      })
      toast.success('Style extracted — Save changes + Re-deploy all to apply', { id: tid })
    } catch (e) {
      toast.error(`Style failed: ${e.message}`, { id: tid })
    }
    setEditedCaptureBusy(false)
  }

  // Read an uploaded HTML file into the textarea. Does NOT auto-run the slow
  // AI step — the raw HTML lands instantly so the operator sees it worked,
  // then they click "Style my pages with this" to process. Decoupling the
  // fast file-load from the slow Claude call avoids the "nothing happened"
  // confusion when a big file takes 30-60s to analyze.
  async function uploadWrapperFile(file) {
    if (!file) return
    if (file.size > 1_000_000) { toast.error('File too large (max 1MB)'); return }
    const text = await file.text().catch(() => '')
    if (!text) { toast.error('Could not read file'); return }
    setEditedWrapper(text)
    setEditedCaptureInfo({ used_selector: 'uploaded', notes: `Loaded ${(file.size/1024).toFixed(0)} KB from ${file.name}. Click "Style my pages with this" to extract the design.` })
    toast.success(`Loaded ${file.name} — now click "Style my pages with this"`)
  }

  // Capture from URL inside the editor modal — same /capture_styling action
  // as the campaign-creation wizard, but writes into editedWrapper so the
  // operator can re-style an existing campaign without recreating it.
  async function captureStylingInEditor() {
    const url = editedCaptureUrl.trim()
    if (!url) { toast.error('Paste a URL first'); return }
    setEditedCaptureBusy(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'capture_styling', agency_id: agencyId, url, campaign_id: campaign?.id }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); return }
      setEditedWrapper(d.wrapper || '')
      setEditedCaptureInfo({ used_selector: d.used_selector, notes: d.notes, brand: brandMatchNote(d) })
      toast.success(`Captured via "${d.used_selector}" — save changes + Re-deploy all to apply`)
    } catch (e) { toast.error(e.message) }
    setEditedCaptureBusy(false)
  }
  const [focusKwTemplate, setFocusKwTemplate] = useState('[topic] in [koto_city] [koto_state_abbr]')
  const [styleCaptureUrl, setStyleCaptureUrl] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [captureInfo, setCaptureInfo] = useState(null) // { used_selector, notes, brand }
  // Style tokens captured during the CREATE wizard (no campaign row exists yet,
  // so they can't persist server-side). Held here and sent with generate_master
  // so a new campaign is brand-matched from its first deploy.
  const [capturedStyleTokens, setCapturedStyleTokens] = useState(null)
  const [deployHistory, setDeployHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [inspectDeploy, setInspectDeploy] = useState(null)
  const [redeploying, setRedeploying] = useState(false)
  const [autoRefreshBusy, setAutoRefreshBusy] = useState(false)
  const [hubBusy, setHubBusy] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [verifying, setVerifying] = useState(false)

  // Re-sync SEO meta button state
  const [resyncing, setResyncing] = useState(false)

  // Performance (Search Console + GA4)
  const [perfOpen, setPerfOpen] = useState(false)
  const [perf, setPerf] = useState(null)
  const [perfLoading, setPerfLoading] = useState(false)
  const [perfWindow, setPerfWindow] = useState(28)
  const [expandedRows, setExpandedRows] = useState(new Set())

  // llms.txt site-level controls
  const [llmsBusy, setLlmsBusy] = useState(null) // 'preview' | 'publish' | null
  const [llmsPreview, setLlmsPreview] = useState(null) // { content, byte_count } | null
  const [llmsResult, setLlmsResult] = useState(null) // last publish outcome

  // Shim plugin update
  const [shimUpdating, setShimUpdating] = useState(false)
  const [shimUpdateResult, setShimUpdateResult] = useState(null)
  const [latestShimVersion, setLatestShimVersion] = useState(null)

  // Integration status
  const [integrationStatus, setIntegrationStatus] = useState(null)

  async function loadIntegrationStatus() {
    if (!site?.id) return
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'integration_status', agency_id: agencyId, site_id: site.id }),
      })
      const d = await r.json()
      if (d.ok) setIntegrationStatus(d.integrations)
    } catch {}
  }

  useEffect(() => {
    if (site?.id) loadIntegrationStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id])

  async function checkLatestShimVersion() {
    try {
      const r = await fetch('/api/kotoiq-shim-manifest', { cache: 'no-store' })
      const d = await r.json()
      if (d?.version) setLatestShimVersion(d.version)
    } catch {}
  }

  async function updateShim() {
    if (!site?.id || shimUpdating) return
    setShimUpdating(true); setShimUpdateResult(null)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'shim_update', agency_id: agencyId, site_id: site.id }),
      })
      const d = await r.json()
      setShimUpdateResult(d)
      // Refresh the latest-version cache after a successful update.
      if (d.ok) checkLatestShimVersion()
    } catch (e) {
      setShimUpdateResult({ ok: false, error: String(e?.message || e) })
    }
    setShimUpdating(false)
  }

  useEffect(() => {
    checkLatestShimVersion()
  }, [])

  async function previewLlmsTxt() {
    if (!site?.id || llmsBusy) return
    setLlmsBusy('preview'); setLlmsResult(null)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview_llms_txt', agency_id: agencyId, site_id: site.id }),
      })
      const d = await r.json()
      if (d.ok) setLlmsPreview({ content: d.content, byte_count: d.byte_count })
      else setLlmsResult({ ok: false, error: d.error || 'preview failed' })
    } catch (e) {
      setLlmsResult({ ok: false, error: String(e?.message || e) })
    }
    setLlmsBusy(null)
  }

  async function publishLlmsTxt() {
    if (!site?.id || llmsBusy) return
    setLlmsBusy('publish'); setLlmsResult(null)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish_llms_txt', agency_id: agencyId, site_id: site.id }),
      })
      const d = await r.json()
      setLlmsResult(d)
    } catch (e) {
      setLlmsResult({ ok: false, error: String(e?.message || e) })
    }
    setLlmsBusy(null)
  }

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
      if (d.error) { toast.error(errText(d.error)); return }
      setCampaign(d.campaign)
      setStep(2)
      toast.success(`Loaded "${d.campaign.topic}"`)
    } catch (e) { toast.error(e.message) }
  }

  async function deleteCampaign(c) {
    if (deletingId) return
    if (!confirm(`Delete campaign "${c.topic}"?\n\nThis removes the campaign + its deploy records from KotoIQ. It does NOT delete the published WordPress pages — remove those in WP if you want them gone.`)) return
    setDeletingId(c.id)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_campaign', agency_id: agencyId, campaign_id: c.id }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); return }
      setSavedCampaigns(prev => prev.filter(x => x.id !== c.id))
      toast.success('Campaign deleted')
    } catch (e) { toast.error(e.message) }
    setDeletingId(null)
  }

  // Connect Google reviews — search Places, then save the chosen place_id to
  // the campaign so reviews auto-pull on the next deploy.
  async function findReviewPlaces() {
    const q = placeQuery.trim()
    if (!q) { toast.error('Type a business name + city to search'); return }
    setPlaceBusy(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'find_places', agency_id: agencyId, query: q }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); setPlaceResults([]) }
      else setPlaceResults(d.places || [])
    } catch (e) { toast.error(e.message) }
    setPlaceBusy(false)
  }
  async function connectReviewPlace(place) {
    if (!campaign?.id) return
    setPlaceBusy(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_campaign_place', agency_id: agencyId, campaign_id: campaign.id, place_id: place ? place.place_id : null }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); return }
      setCampaign(c => ({ ...c, google_place_id: place ? place.place_id : null }))
      setPlaceOpen(false); setPlaceResults([]); setPlaceQuery('')
      toast.success(place ? `Reviews connected: ${place.name} (${place.review_count} reviews) — they'll appear on re-deploy` : 'Reviews disconnected')
    } catch (e) { toast.error(e.message) }
    setPlaceBusy(false)
  }

  // Auto-improvement loop: audit → fix → re-audit → repeat until score >= target.
  const [eeatLog, setEeatLog] = useState([])
  const EEAT_TARGET = 85
  const EEAT_MAX_ROUNDS = 3

  function logEeat(msg) { setEeatLog(prev => [...prev, { time: new Date(), msg }]) }

  async function regenerateFromAudit() {
    if (!campaign?.id || fixingGaps) return
    // Single-shot if already has audit result with gaps
    if (eeatResult?.gaps?.length) {
      await runAutoEeat(eeatResult)
    }
  }

  async function runAutoEeat(initialAudit) {
    if (!campaign?.id || fixingGaps) return
    setFixingGaps(true)
    setEeatLog([])
    let currentAudit = initialAudit
    let round = 0

    // If no initial audit, run one first
    if (!currentAudit) {
      logEeat('Round 1 — scoring the master against E-E-A-T signals…')
      try {
        const r = await fetch('/api/kotoiq/topic-campaign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'eeat_score', agency_id: agencyId, campaign_id: campaign.id }),
        })
        const d = await r.json()
        if (d.error) { logEeat(`Audit failed: ${errText(d.error)}`); setFixingGaps(false); return }
        currentAudit = d.audit
        setEeatResult(d.audit)
        logEeat(`Score: ${d.audit.overall_score}/100 (E:${d.audit.experience} X:${d.audit.expertise} A:${d.audit.authoritativeness} T:${d.audit.trustworthiness})`)
        if (d.audit.overall_score >= EEAT_TARGET) {
          logEeat(`Already at ${d.audit.overall_score} — target is ${EEAT_TARGET}. Done.`)
          setFixingGaps(false)
          return
        }
      } catch (e) { logEeat(`Error: ${e.message}`); setFixingGaps(false); return }
    } else {
      logEeat(`Starting score: ${currentAudit.overall_score}/100 — target is ${EEAT_TARGET}`)
    }

    while (round < EEAT_MAX_ROUNDS) {
      round++
      const gaps = currentAudit?.gaps || []
      if (!gaps.length) { logEeat('No gaps found — nothing to fix.'); break }
      if (currentAudit.overall_score >= EEAT_TARGET) {
        logEeat(`Score ${currentAudit.overall_score} >= ${EEAT_TARGET} target. Done.`)
        break
      }

      // Fix
      logEeat(`Round ${round} — fixing ${gaps.length} gaps: ${gaps.map(g => g.dimension).join(', ')}…`)
      try {
        const r = await fetch('/api/kotoiq/topic-campaign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'regenerate_master', agency_id: agencyId, campaign_id: campaign.id, eeat_gaps: gaps, eeat_info: Object.fromEntries(Object.entries(eeatInfoFields || {}).filter(([,v]) => v)) }),
        })
        const d = await r.json()
        if (d.error) { logEeat(`Regenerate failed: ${errText(d.error)}`); break }
        setCampaign(d.campaign)
        logEeat('Master rewritten — re-scoring…')
      } catch (e) { logEeat(`Error: ${e.message}`); break }

      // Re-audit
      try {
        const r = await fetch('/api/kotoiq/topic-campaign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'eeat_score', agency_id: agencyId, campaign_id: campaign.id }),
        })
        const d = await r.json()
        if (d.error) { logEeat(`Re-audit failed: ${errText(d.error)}`); break }
        currentAudit = d.audit
        setEeatResult(d.audit)
        logEeat(`Score: ${d.audit.overall_score}/100 (E:${d.audit.experience} X:${d.audit.expertise} A:${d.audit.authoritativeness} T:${d.audit.trustworthiness})`)
      } catch (e) { logEeat(`Error: ${e.message}`); break }
    }

    if (currentAudit?.overall_score >= EEAT_TARGET) {
      logEeat(`Target reached: ${currentAudit.overall_score}/100. Re-deploy to push the improved content.`)
      toast.success(`E-E-A-T score: ${currentAudit.overall_score} — target reached`)
    } else if (round >= EEAT_MAX_ROUNDS) {
      logEeat(`Reached ${EEAT_MAX_ROUNDS} rounds — score is ${currentAudit?.overall_score || '?'}. You can run again or edit manually.`)
      toast.success(`E-E-A-T score after ${EEAT_MAX_ROUNDS} rounds: ${currentAudit?.overall_score || '?'}`)
    }
    setFixingGaps(false)
  }

  // Topical cluster selection state
  const [clusterSelected, setClusterSelected] = useState({}) // { topic: true/false }
  const [customClusterTopics, setCustomClusterTopics] = useState('')

  // Initialize all topics as selected when results arrive
  function initClusterSelection(result) {
    const sel = {}
    ;(result?.siblings || []).forEach(s => { sel[s.topic] = true })
    ;(result?.supporting || []).forEach(s => { sel[s.topic] = true })
    setClusterSelected(sel)
    setCustomClusterTopics('')
  }

  function toggleClusterTopic(topic) {
    setClusterSelected(prev => ({ ...prev, [topic]: !prev[topic] }))
  }

  function getSelectedClusterTopics() {
    const checked = Object.entries(clusterSelected).filter(([, v]) => v).map(([k]) => k)
    const custom = customClusterTopics.split(',').map(s => s.trim()).filter(Boolean)
    return [...checked, ...custom]
  }

  // Feed the topical cluster (sibling subtopics) into a regenerate so the FAQs
  // + sections cover the theme.
  async function regenerateWithCluster(topics) {
    if (!campaign?.id || !topics?.length || topicalBusy) return
    setTopicalBusy(true)
    const tid = toast.loading(`Regenerating with ${topics.length} subtopics…`)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_master', agency_id: agencyId, campaign_id: campaign.id, topical_cluster: topics }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error), { id: tid }); setTopicalBusy(false); return }
      setCampaign(d.campaign)
      setTopicalOpen(false)
      toast.success('Master regenerated covering the cluster — re-deploy to push it', { id: tid })
    } catch (e) { toast.error(e.message, { id: tid }) }
    setTopicalBusy(false)
  }

  async function runQualityCheck() {
    if (!campaign?.id || qualityBusy) return
    setQualityBusy(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'quality_check', agency_id: agencyId, campaign_id: campaign.id }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); setQualityBusy(false); return }
      const rep = d.report || { score: 0, findings: [], wordCount: 0 }
      const head = `Quality score ${rep.score}/100 · ~${rep.wordCount} words/page`
      const lines = rep.findings.map(f => `${f.level === 'fail' ? '✗' : f.level === 'warn' ? '⚠' : 'ℹ'} ${f.msg}`).slice(0, 8).join('\n')
      if (rep.findings.some(f => f.level === 'fail')) toast.error(`${head}\n${lines}`, { duration: 10000 })
      else if (rep.findings.length) toast(`${head}\n${lines}`, { icon: '⚠️', duration: 9000 })
      else toast.success(`${head} — clean`)
    } catch (e) { toast.error(e.message) }
    setQualityBusy(false)
  }

  async function runCitationCheck() {
    if (!campaign?.id || citationBusy) return
    setCitationBusy(true); setCitationOpen(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_citations', agency_id: agencyId, campaign_id: campaign.id }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); setCitationReport(null) }
      else setCitationReport(d.report)
    } catch (e) { toast.error(e.message); setCitationReport(null) }
    setCitationBusy(false)
  }

  async function validateSchema() {
    if (!campaign?.id || validating) return
    setValidating(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate_schema', agency_id: agencyId, campaign_id: campaign.id }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); setValidating(false); return }
      const rep = d.report || { types: [], errors: [], warnings: [] }
      const head = `Schema (${d.sample_location}): ${rep.types.length} types${rep.errors.length ? ` · ${rep.errors.length} error(s)` : ''}${rep.warnings.length ? ` · ${rep.warnings.length} warning(s)` : ''}`
      if (rep.errors.length) toast.error(`${head}\n${rep.errors.join('\n')}`, { duration: 9000 })
      else if (rep.warnings.length) toast(`${head}\n${rep.warnings.slice(0, 5).join('\n')}`, { icon: '⚠️', duration: 8000 })
      else toast.success(`${head} — all valid`)
    } catch (e) { toast.error(e.message) }
    setValidating(false)
  }

  async function saveEeatInputs(inputs) {
    if (!campaign?.id) return
    setSavingEeat(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_eeat_inputs', agency_id: agencyId, campaign_id: campaign.id, eeat_inputs: inputs }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); setSavingEeat(false); return }
      setCampaign(c => ({ ...c, eeat_inputs: d.campaign?.eeat_inputs ?? null }))
      setEeatEditorOpen(false)
      toast.success('Trust signals saved — re-deploy to push them live')
    } catch (e) { toast.error(e.message) }
    setSavingEeat(false)
  }

  async function generateMaster() {
    if (!topic.trim()) { toast.error('Topic required'); return }
    setGenerating(true)
    setGenLog([])
    const hasCompetitor = competitorSampleCity.trim()
    const cities = competitorSampleCity.trim()
    const startTime = Date.now()

    logGen(`Topic: "${topic.trim()}"`)
    if (companyName.trim()) logGen(`Company: ${companyName.trim()}`)
    if (hasCompetitor) {
      logGen(`Scraping competitor pages for "${topic.trim()}" in ${cities}…`)
      logGen('Fetching top 3 Google results per city — analyzing H1, H2, word count…')
    } else {
      logGen('No sample cities — skipping competitor intel')
    }
    if (capturedStyleTokens) logGen('Brand tokens captured — pages will match site styling')
    logGen('Sending to Claude for master generation…')

    // Start a timer to show elapsed time
    const timer = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      if (elapsed > 10 && elapsed % 15 === 0) {
        setGenLog(prev => {
          const last = prev[prev.length - 1]?.msg || ''
          if (last.startsWith('Still working')) return [...prev.slice(0, -1), { time: new Date(), msg: `Still working… ${elapsed}s elapsed` }]
          return [...prev, { time: new Date(), msg: `Still working… ${elapsed}s elapsed` }]
        })
      }
    }, 5000)

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
          style_tokens: capturedStyleTokens || null,
          hero_image_url: heroImageUrl.trim() || null,
          hero_video_url: heroVideoUrl.trim() || null,
          hero_image_alt: heroImageAlt.trim() || null,
          focus_keyword_template: focusKwTemplate.trim() || null,
          variants_per_section: Number(variantsPerSection) || 4,
          faq_count: Number(faqCount) || 6,
          competitor_sample_city: competitorSampleCity.trim() || null,
          competitor_sample_state_abbr: competitorSampleState.trim() || null,
        }),
      })
      clearInterval(timer)
      const d = await r.json()
      if (d.error) {
        logGen(`Error: ${errText(d.error)}`)
        toast.error(errText(d.error))
        return
      }
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      const sections = d.campaign?.master?.sections?.length || '?'
      const faqs = d.campaign?.master?.faqs?.length || '?'
      logGen(`Master generated in ${elapsed}s — ${sections} sections, ${faqs} FAQs, ${d.tokens_used} tokens`)
      if (d.campaign?.competitor_meta?.domains_seen?.length) {
        logGen(`Competitor intel: analyzed ${d.campaign.competitor_meta.domains_seen.length} competing domains`)
      }
      logGen('Done. Pick cities next →')
      setCampaign(d.campaign)
      toast.success(`Master generated · ${d.tokens_used} tokens`)

      // Run auto-optimize pipeline
      await autoOptimize(d.campaign)

      setStep(2)
    } catch (e) {
      clearInterval(timer)
      logGen(`Error: ${e.message}`)
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function autoOptimize(camp) {
    if (!camp?.id) return
    const cid = camp.id
    const report = { steps: [], startedAt: new Date().toISOString() }
    const addStep = (name, status, data = {}) => {
      const existing = report.steps.find(s => s.name === name)
      if (existing) Object.assign(existing, { status, ...data })
      else report.steps.push({ name, status, ...data })
      setOptimizeReport({ ...report })
    }
    const api = (action, extra = {}) => fetch('/api/kotoiq/topic-campaign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, agency_id: agencyId, campaign_id: cid, ...extra }),
    }).then(r => r.json())

    // Pipeline order matters — each step builds on the previous:
    //   1. Quality check (baseline)
    //   2. Schema validation (baseline)
    //   3. Topical cluster → weave subtopics (expands content first)
    //   4. E-E-A-T audit + fix loop (on the woven master, passes cluster to preserve it)
    //   5. Final quality + schema re-check (verify nothing regressed)

    let clusterTopics = []  // saved so E-E-A-T fix rounds preserve cluster coverage

    // 1. Quality check (baseline)
    await checkPause('Quality check')
    logGen('─── Step 1: Quality check ───')
    addStep('Quality check', 'running')
    try {
      const qc = await api('quality_check')
      if (qc.report) {
        const fails = (qc.report.findings || []).filter(f => f.level === 'fail')
        const warns = (qc.report.findings || []).filter(f => f.level === 'warn')
        logGen(`Quality: ${qc.report.score}/100 · ~${qc.report.wordCount} words/page`)
        if (fails.length) fails.forEach(f => logGen(`  ✗ ${f.msg}`))
        if (warns.length) warns.forEach(f => logGen(`  ⚠ ${f.msg}`))
        if (!fails.length && !warns.length) logGen('  All checks passed')
        addStep('Quality check', fails.length ? 'issues' : 'pass', { score: qc.report.score, wordCount: qc.report.wordCount, findings: qc.report.findings })
      }
    } catch (e) { logGen(`Quality check error: ${e.message}`); addStep('Quality check', 'error', { error: e.message }) }

    // 2. Schema validation (baseline)
    await checkPause('Schema validation')
    logGen('─── Step 2: Schema validation ───')
    addStep('Schema validation', 'running')
    try {
      const sv = await api('validate_schema')
      if (sv.report) {
        logGen(`Schema types: ${(sv.report.types || []).join(', ') || 'none'}`)
        if (sv.report.errors?.length) sv.report.errors.forEach(e => logGen(`  ✗ ${e}`))
        else if (sv.report.warnings?.length) sv.report.warnings.forEach(w => logGen(`  ⚠ ${w}`))
        else logGen('  Schema valid')
        addStep('Schema validation', sv.report.errors?.length ? 'issues' : 'pass', { types: sv.report.types, errors: sv.report.errors, warnings: sv.report.warnings })
      }
    } catch (e) { logGen(`Schema error: ${e.message}`); addStep('Schema validation', 'error', { error: e.message }) }

    // 3. Topical cluster → weave
    await checkPause('Topical cluster')
    logGen('─── Step 3: Topical cluster ───')
    addStep('Topical cluster', 'running')
    try {
      const tc = await api('topical_expand')
      if (tc.expansion) {
        const siblings = tc.expansion.siblings || []
        const supporting = tc.expansion.supporting || []
        setTopicalResult(tc.expansion)
        initClusterSelection(tc.expansion)
        logGen(`Found ${siblings.length} sibling + ${supporting.length} supporting topics`)
        siblings.slice(0, 5).forEach(s => logGen(`  · ${s.topic}`))
        if (siblings.length > 5) logGen(`  … +${siblings.length - 5} more`)

        clusterTopics = [...siblings.map(s => s.topic), ...supporting.map(s => s.topic)]
        logGen(`Weaving ${clusterTopics.length} subtopics into the master…`)
        const weave = await api('regenerate_master', { topical_cluster: clusterTopics })
        if (weave.error) { logGen(`  Weave failed: ${errText(weave.error)}`); addStep('Topical cluster', 'issues', { siblings, supporting, error: weave.error }) }
        else { setCampaign(weave.campaign); camp = weave.campaign; logGen('  Master updated with topical coverage'); addStep('Topical cluster', 'pass', { siblings, supporting, woven: clusterTopics.length }) }
      }
    } catch (e) { logGen(`Topical cluster error: ${e.message}`); addStep('Topical cluster', 'error', { error: e.message }) }

    // 4. E-E-A-T audit + auto-fix (on the woven master)
    await checkPause('E-E-A-T optimizer')
    logGen('─── Step 4: E-E-A-T audit + auto-fix ───')
    addStep('E-E-A-T optimizer', 'running')
    let eeat = null
    const eeatHistory = [] // track score per round
    try {
      const ea = await api('eeat_score')
      eeat = ea.audit
      if (eeat) {
        setEeatResult(eeat)
        eeatHistory.push({ round: 0, score: eeat.overall_score, e: eeat.experience, x: eeat.expertise, a: eeat.authoritativeness, t: eeat.trustworthiness })
        logGen(`E-E-A-T: ${eeat.overall_score}/100 (E:${eeat.experience} X:${eeat.expertise} A:${eeat.authoritativeness} T:${eeat.trustworthiness})`)
        if (eeat.gaps?.length) eeat.gaps.forEach(g => logGen(`  Gap [${g.dimension}]: ${g.issue}`))

        let round = 0
        while (eeat.overall_score < EEAT_TARGET && round < EEAT_MAX_ROUNDS && eeat.gaps?.length) {
          round++
          logGen(`  Fix round ${round}/${EEAT_MAX_ROUNDS} — targeting ${eeat.gaps.length} gaps…`)
          const fix = await api('regenerate_master', {
            eeat_gaps: eeat.gaps,
            ...(clusterTopics.length ? { topical_cluster: clusterTopics } : {}),
          })
          if (fix.error) { logGen(`  Fix failed: ${errText(fix.error)}`); break }
          setCampaign(fix.campaign); camp = fix.campaign
          logGen('  Re-scoring…')
          const rescore = await api('eeat_score')
          if (rescore.audit) {
            const prev = eeat.overall_score
            eeat = rescore.audit
            setEeatResult(eeat)
            const delta = eeat.overall_score - prev
            eeatHistory.push({ round, score: eeat.overall_score, delta, e: eeat.experience, x: eeat.expertise, a: eeat.authoritativeness, t: eeat.trustworthiness, gapsFixed: eeat.gaps?.length || 0 })
            logGen(`  E-E-A-T: ${eeat.overall_score}/100 (${delta >= 0 ? '+' : ''}${delta}) — E:${eeat.experience} X:${eeat.expertise} A:${eeat.authoritativeness} T:${eeat.trustworthiness}`)
          } else break
        }
        if (eeat.overall_score >= EEAT_TARGET) logGen(`  Target ${EEAT_TARGET}+ reached`)
        else if (round >= EEAT_MAX_ROUNDS) logGen(`  ${EEAT_MAX_ROUNDS} rounds done — score: ${eeat.overall_score}`)
        addStep('E-E-A-T optimizer', eeat.overall_score >= EEAT_TARGET ? 'pass' : 'issues', { score: eeat.overall_score, rounds: eeatHistory, gaps: eeat.gaps, strengths: eeat.strengths })
      }
    } catch (e) { logGen(`E-E-A-T error: ${e.message}`); addStep('E-E-A-T optimizer', 'error', { error: e.message }) }

    // 5. Final quality + schema re-check
    await checkPause('Final verification')
    logGen('─── Step 5: Final verification ───')
    addStep('Final verification', 'running')
    try {
      const [fqc, fsv] = await Promise.all([api('quality_check'), api('validate_schema')])
      const finalData = {}
      if (fqc.report) {
        const fails = (fqc.report.findings || []).filter(f => f.level === 'fail')
        logGen(`Quality: ${fqc.report.score}/100 · ~${fqc.report.wordCount} words` + (fails.length ? ` · ${fails.length} issues` : ' · clean'))
        finalData.quality = fqc.report
      }
      if (fsv.report) {
        logGen(`Schema: ${(fsv.report.types || []).join(', ')}` + (fsv.report.errors?.length ? ` · ${fsv.report.errors.length} errors` : ' · valid'))
        finalData.schema = fsv.report
      }
      addStep('Final verification', 'pass', finalData)
    } catch (e) { logGen(`Final check error: ${e.message}`); addStep('Final verification', 'error', { error: e.message }) }

    // Summary — what still needs manual input
    logGen('─── Complete ───')
    const needsInput = []
    if (!camp?.eeat_inputs?.strategist?.name) needsInput.push('Author name + credentials → Trust signals')
    if (!camp?.eeat_inputs?.address?.street) needsInput.push('Business address → Trust signals')
    if (!camp?.google_place_id) needsInput.push('Google reviews → Connect Google reviews button')
    if (needsInput.length) {
      logGen('Add these for full E-E-A-T (scores will improve):')
      needsInput.forEach(n => logGen(`  → ${n}`))
    } else {
      logGen('All signals connected')
    }
    logGen('Pick cities next → then deploy.')
    report.completedAt = new Date().toISOString()
    report.needsInput = needsInput
    setOptimizeReport({ ...report })
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
      if (d.error) { toast.error(errText(d.error)); return }
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
      if (d.error) { toast.error(errText(d.error)); return }
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
      if (d.error) { toast.error(errText(d.error)); setDeploying(false); return }
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
          topic: editedTopic.trim() || campaign.topic,
          phone: editedPhone,
          company_name: editedCompanyName,
          hero_image_url: editedHeroImage,
          hero_video_url: editedHeroVideo,
          hero_image_alt: editedHeroAlt,
          post_type: editedPostType,
          focus_keyword_template: editedFocusKw,
          custom_html_wrapper: editedWrapper,
        }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); return }
      setCampaign(d.campaign)
      setEditedMaster(null)
      setEditorOpen(false)
      toast.success('Master saved · Re-deploy to push changes')
    } catch (e) { toast.error(e.message) }
  }

  async function loadPerf(days = perfWindow) {
    if (!campaign?.id) return
    setPerfLoading(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'get_performance', agency_id: agencyId, campaign_id: campaign.id, days }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); return }
      setPerf(d)
    } catch (e) { toast.error(e.message) }
    setPerfLoading(false)
  }

  async function captureStyling() {
    if (!styleCaptureUrl.trim()) { toast.error('Paste a URL first'); return }
    setCapturing(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'capture_styling', agency_id: agencyId, url: styleCaptureUrl.trim() }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); return }
      setCustomHtml(d.wrapper || '')
      setCapturedStyleTokens(d.style_tokens || null)
      setCaptureInfo({ used_selector: d.used_selector, notes: d.notes, brand: brandMatchNote(d) })
      toast.success(`Captured via "${d.used_selector}"`)
    } catch (e) { toast.error(e.message) }
    setCapturing(false)
  }

  async function resyncSeo() {
    if (!campaign?.id) return
    if (!confirm('Re-write SEO title + description + focus keyword to Yoast + RankMath + KotoIQ for every published city in this campaign?')) return
    setResyncing(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'resync_seo_meta', agency_id: agencyId, campaign_id: campaign.id }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); return }
      toast.success(`SEO meta: ${d.written} written, ${d.failed} failed`)
      await loadDeployHistory()
    } catch (e) { toast.error(e.message) }
    setResyncing(false)
  }

  async function retryFailed() {
    if (!campaign?.id) return
    setRetrying(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'retry_failed', agency_id: agencyId, campaign_id: campaign.id }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); return }
      toast.success(`Retried ${d.retried} · ${d.succeeded} succeeded · ${d.still_failed} still failed`)
      await loadDeployHistory()
    } catch (e) { toast.error(e.message) }
    setRetrying(false)
  }

  async function verifyLive() {
    if (!campaign?.id) return
    setVerifying(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'verify_live', agency_id: agencyId, campaign_id: campaign.id }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); return }
      const msg = d.corrected > 0
        ? `Verified ${d.checked} · ${d.corrected} were live but marked failed — corrected`
        : d.gone > 0
        ? `Verified ${d.checked} · ${d.gone} missing on WP (deleted there?)`
        : `Verified ${d.checked} · all match local status`
      toast.success(msg)
      await loadDeployHistory()
    } catch (e) { toast.error(e.message) }
    setVerifying(false)
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
      if (d.error) { toast.error(errText(d.error)); return }
      toast.success(`Re-deployed ${d.updated} · ${d.failed} failed`)
      await loadDeployHistory()
    } catch (e) { toast.error(e.message) }
    setRedeploying(false)
  }

  // Opt this campaign in/out of the nightly auto-freshness cron. Redeploy-only
  // (re-pulls Census + Google reviews, no AI tokens). Threshold = which
  // dataIntegrity.ts staleness window gates a re-deploy.
  async function saveAutoRefresh(enabled, key) {
    if (!campaign?.id) return
    setAutoRefreshBusy(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'set_auto_refresh', agency_id: agencyId, campaign_id: campaign.id, auto_refresh: enabled, refresh_threshold_key: key }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); setAutoRefreshBusy(false); return }
      setCampaign(c => ({ ...c, auto_refresh: d.auto_refresh, refresh_threshold_key: d.refresh_threshold_key }))
      const label = (REFRESH_THRESHOLDS.find(t => t.key === d.refresh_threshold_key) || {}).label || d.refresh_threshold_key
      toast.success(enabled ? `Auto-refresh on — re-deploys when data is past ${label}` : 'Auto-refresh off')
    } catch (e) { toast.error(e.message) }
    setAutoRefreshBusy(false)
  }

  // Build (or rebuild) the pillar/hub page — links all city pages + sibling
  // clusters with BreadcrumbList schema. Re-deploy after to wire the city-page
  // breadcrumbs up to the hub.
  async function buildHub() {
    if (!campaign?.id) return
    setHubBusy(true)
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'deploy_hub', agency_id: agencyId, campaign_id: campaign.id }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); setHubBusy(false); return }
      setCampaign(c => ({ ...c, hub_url: d.hub_url, hub_post_id: d.hub_post_id }))
      toast.success(`Hub built — ${d.cities_linked} cities linked${d.related_clusters ? ` + ${d.related_clusters} related` : ''}. Re-deploy to wire city breadcrumbs.`)
      if (d.note) toast(d.note, { duration: 9000 })
    } catch (e) { toast.error(e.message) }
    setHubBusy(false)
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

      {/* Integration status bar — shown on step 1 above all other site-level cards */}
      {step === 1 && !campaign && integrationStatus && (
        <div style={card({ background:'#fff' })}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:13, color:BLK }}>Integrations</div>
            <button onClick={loadIntegrationStatus} style={miniBtn()}><RefreshCw size={11}/></button>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {[
              { key:'gsc',        label:'Search Console', scope:'client' },
              { key:'ga4',        label:'Analytics (GA4)', scope:'client' },
              { key:'crux',       label:'Core Web Vitals', scope:'site'   },
              { key:'census',     label:'Census ACS',      scope:'site'   },
              { key:'dataforseo', label:'SERP intel',      scope:'site'   },
              { key:'anthropic',  label:'Claude',          scope:'site'   },
              { key:'shim',       label:'Shim plugin',     scope:'site'   },
            ].map(({ key, label, scope }) => {
              const s = integrationStatus[key]
              if (!s) return null
              const ok = s.connected
              const bg = ok ? '#ecfdf5' : '#fef2f2'
              const fg = ok ? '#047857' : '#991b1b'
              const dot = ok ? GRN : R
              const versionSuffix = key === 'shim' && s.version ? ` v${s.version}` : ''
              return (
                <span key={key} title={ok ? `Connected (${s.scope})` : s.requires}
                  style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:999, fontSize:11, fontFamily:FH, fontWeight:700, color:fg, background:bg, border:`1px solid ${ok ? '#a7f3d0' : '#fecaca'}` }}>
                  <span style={{ width:7, height:7, borderRadius:999, background:dot, display:'inline-block' }}/>
                  {label}{versionSuffix}
                </span>
              )
            })}
          </div>
          {integrationStatus.gsc && !integrationStatus.gsc.connected && (
            <div style={{ marginTop:8, fontSize:11, fontFamily:FB, color:'#9ca3af', lineHeight:1.5 }}>
              {integrationStatus.gsc.requires}. Without GSC/GA4 the Performance view will be empty &mdash; AI Pages still ship, the data layer just stays dark.
            </div>
          )}
        </div>
      )}

      {/* Plugin update — only when paired AND latest version differs from installed */}
      {step === 1 && !campaign && isV4 && site?.site_url && latestShimVersion && site?.plugin_version && latestShimVersion !== site.plugin_version && (
        <div style={card({ background:'#fffbeb', borderColor:'#fde68a' })}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <RefreshCw size={16} color="#b45309"/>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:FH, fontWeight:800, fontSize:14, color:'#92400e' }}>
                Plugin update available: v{site.plugin_version} → v{latestShimVersion}
              </div>
              <div style={{ fontFamily:FB, fontSize:12, color:'#78350f', marginTop:2 }}>
                One click installs the latest kotoiq-shim on this site. WP_Upgrader verifies the sha256 before activating. Live pages stay served throughout.
              </div>
            </div>
            <button onClick={updateShim} disabled={shimUpdating} style={miniBtn({ background:'#b45309', color:'#fff', borderColor:'#b45309' })}>
              {shimUpdating ? <Loader2 size={11} className="spin"/> : null} Update plugin
            </button>
          </div>
          {shimUpdateResult && (
            <div style={{ marginTop:10, padding:'8px 10px', borderRadius:6, fontSize:12, fontFamily:FB,
              background: shimUpdateResult.ok ? '#ecfdf5' : '#fef2f2',
              color: shimUpdateResult.ok ? '#065f46' : '#991b1b',
              border: `1px solid ${shimUpdateResult.ok ? '#a7f3d0' : '#fecaca'}` }}>
              {shimUpdateResult.ok
                ? shimUpdateResult.alreadyUpToDate
                  ? <>✓ Already on v{shimUpdateResult.to_version}</>
                  : <>✓ Updated v{shimUpdateResult.from_version} → v{shimUpdateResult.to_version}</>
                : <>✗ {shimUpdateResult.error || shimUpdateResult.code || 'update failed'}{(shimUpdateResult.error || '').toLowerCase().includes('checksum') ? <span style={{ display:'block', marginTop:4, fontSize:11 }}>sha256 mismatch — try again or contact support.</span> : null}</>}
            </div>
          )}
        </div>
      )}

      {/* Site-wide tools: llms.txt — visible on step 1, only when site is paired */}
      {step === 1 && !campaign && isV4 && site?.site_url && (
        <div style={card({ background:'#fff' })}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <Sparkles size={16} color={T}/>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:FH, fontWeight:800, fontSize:14, color:BLK }}>
                llms.txt — AI crawler citation map
              </div>
              <div style={{ fontFamily:FB, fontSize:12, color:'#6b7280', marginTop:2 }}>
                Serves a plaintext index at <code style={{ background:'#f1f5f9', padding:'1px 5px', borderRadius:3, fontSize:11 }}>{String(site.site_url).replace(/\/$/, '')}/llms.txt</code> listing every deployed page so AI crawlers (claudebot, GPTBot, Perplexity, Google-Extended) cite the right city pages. Requires plugin v4.2.0+.
              </div>
              <div style={{ fontFamily:FB, fontSize:12, color:'#6b7280', marginTop:6 }}>
                Markdown twins are auto-published on every deploy: each page also serves at <code style={{ background:'#f1f5f9', padding:'1px 5px', borderRadius:3, fontSize:11 }}>{'{slug}'}.md</code> and the full-content export lives at <a href={`${String(site.site_url).replace(/\/$/, '')}/llms-full.txt`} target="_blank" rel="noopener noreferrer" style={{ color:T, textDecoration:'underline' }}>/llms-full.txt</a> — AI crawlers prefer Markdown. Requires plugin v4.2.5+.
              </div>
            </div>
            <button onClick={previewLlmsTxt} disabled={!!llmsBusy} style={miniBtn()}>
              {llmsBusy === 'preview' ? <Loader2 size={11} className="spin"/> : null} Preview
            </button>
            <button onClick={publishLlmsTxt} disabled={!!llmsBusy} style={miniBtn({ background:T, color:'#fff', borderColor:T })}>
              {llmsBusy === 'publish' ? <Loader2 size={11} className="spin"/> : null} Publish
            </button>
          </div>

          {llmsResult && (
            <div style={{ marginTop:6, padding:'8px 10px', borderRadius:6, fontSize:12, fontFamily:FB,
              background: llmsResult.ok ? '#ecfdf5' : '#fef2f2',
              color: llmsResult.ok ? '#065f46' : '#991b1b',
              border: `1px solid ${llmsResult.ok ? '#a7f3d0' : '#fecaca'}` }}>
              {llmsResult.ok
                ? <>✓ Published {llmsResult.bytes_written} bytes. View live: <a href={llmsResult.llms_txt_url} target="_blank" rel="noopener" style={{ color:'#065f46', textDecoration:'underline' }}>{llmsResult.llms_txt_url}</a></>
                : <>✗ {llmsResult.error || 'publish failed'}{(llmsResult.error || '').toLowerCase().includes('plugin') || (llmsResult.error || '').toLowerCase().includes('404') ? <span style={{ display:'block', marginTop:4, fontSize:11 }}>Likely cause: shim plugin is below v4.2.0 on this site — update the plugin via cutover playbook, then retry.</span> : null}</>}
            </div>
          )}

          {llmsPreview && (
            <div style={{ marginTop:10, border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', padding:'8px 12px', background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                <div style={{ flex:1, fontSize:11, fontFamily:FH, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.05em' }}>
                  Preview — {llmsPreview.byte_count} bytes
                </div>
                <button onClick={() => setLlmsPreview(null)} style={miniBtn()}>Close</button>
              </div>
              <pre style={{ margin:0, padding:'12px 14px', fontSize:11, fontFamily:'ui-monospace,Menlo,monospace', color:'#1a2332', background:'#fff', overflow:'auto', maxHeight:340, lineHeight:1.55, whiteSpace:'pre-wrap' }}>
                {llmsPreview.content}
              </pre>
            </div>
          )}
        </div>
      )}

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
          <div style={{ display:'flex', flexDirection:'column', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden', background:'#fff' }}>
            {savedCampaigns.map((c, i) => (
              <div key={c.id}
                onClick={() => openCampaign(c.id)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', cursor:'pointer', borderTop: i ? '1px solid #f1f1f1' : 'none' }}>
                <Sparkles size={13} color={R} style={{ flex:'none' }}/>
                <div style={{ flex:1, minWidth:0, fontFamily:FH, fontWeight:700, fontSize:13, color:BLK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {c.topic}
                </div>
                <Pill color={c.post_type === 'post' ? T : '#6b7280'} bg={`${c.post_type === 'post' ? T : '#6b7280'}15`}>{c.post_type}</Pill>
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontFamily:FB, color:'#6b7280', flex:'none' }}>
                  <StatusDot status={c.status}/>{c.status}
                </span>
                {c.last_deploy_count > 0 && (
                  <span style={{ fontSize:11, fontFamily:FB, color:'#9ca3af', flex:'none' }}>{c.last_deploy_count} live</span>
                )}
                {c.last_deploy_at && (
                  <span style={{ fontSize:11, fontFamily:FB, color:'#9ca3af', flex:'none', whiteSpace:'nowrap' }}>{timeAgo(c.last_deploy_at)}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCampaign(c) }}
                  disabled={deletingId === c.id}
                  title="Delete campaign"
                  style={{ ...miniBtn({ color:'#dc2626', borderColor:'#fecaca' }), flex:'none', padding:'5px 7px' }}>
                  {deletingId === c.id ? <Loader2 size={11} className="spin"/> : <Trash2 size={11}/>}
                </button>
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

          {/* The simple path: just a topic. Everything else is optional + tucked
              into Advanced so the default flow is type-topic → Generate. */}
          <Field label="What should this page be about?" required hint="A service or topic. Claude writes one master, deployed across the cities you pick next.">
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Website Design, Roofing Services, Personal Injury Law"
              style={{ ...inp(), fontSize:16, padding:'12px 14px' }}
              onKeyDown={e => { if (e.key === 'Enter' && topic.trim() && !generating) { e.preventDefault(); generateMaster() } }}/>
          </Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Field label="Company name (optional)">
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Unified Marketing" style={inp()}/>
            </Field>
            <Field label="Phone number (optional)" hint="Used for [koto_phone] in CTAs + schema">
              <input value={phone} onChange={e => setPhone(e.target.value)} onBlur={() => setPhone(fmtPhone(phone))} placeholder="(512) 555-1234" style={inp()}/>
            </Field>
          </div>

          {/* Competitor-aware generation — visible by default (biggest ranking lift) */}
          <div style={{ marginTop:14, padding:14, background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <Sparkles size={14} color="#0369a1"/>
              <div style={{ fontFamily:FH, fontWeight:800, fontSize:13, color:'#0c4a6e' }}>
                Competitor-aware generation (recommended)
              </div>
            </div>
            <div style={{ fontFamily:FB, fontSize:12, color:'#075985', marginBottom:10, lineHeight:1.5 }}>
              Pick 1&ndash;5 sample cities &mdash; we&rsquo;ll fetch the top 3 Google results for &quot;{topic.trim() || '<topic>'} in &lt;city&gt;&quot; in each, scrape their H1/H2/word-count signal, and aggregate so domains that dominate across markets surface as the real targets. Skip if you want a vanilla generation.
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
              <Field label="Sample cities" hint="Up to 5, comma-separated (e.g. 'Austin, Dallas, Houston'). More cities = stronger signal, ~3-8s each.">
                <input value={competitorSampleCity} onChange={e => setCompetitorSampleCity(e.target.value)} placeholder="Austin, Dallas, Houston" style={inp()}/>
              </Field>
              <Field label="State abbr" hint="2-letter, optional">
                <input value={competitorSampleState} onChange={e => setCompetitorSampleState(e.target.value.toUpperCase().slice(0,2))} placeholder="TX" style={inp()} maxLength={2}/>
              </Field>
            </div>
          </div>

          <button onClick={() => setShowAdvanced(v => !v)}
            style={{ ...miniBtn(), marginTop:14, display:'inline-flex', alignItems:'center', gap:6 }}>
            {showAdvanced ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
            {showAdvanced ? 'Hide' : 'Show'} advanced options
            <span style={{ color:'#9ca3af', fontWeight:600 }}>styling · hero media · variants</span>
          </button>

          {showAdvanced && (
          <div style={{ marginTop:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
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

          <Field label="Custom HTML wrapper (optional)" hint="Use {{HERO_HEADLINE}}, {{HERO_SUB}}, {{HERO_MEDIA}}, {{SECTIONS}}, {{FAQS}}, {{CTA}}, {{SERVICE_AREAS}} placeholders. Add {{NO_STYLES}} to skip the default base CSS.">
            <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', flexWrap:'wrap' }}>
              <input
                value={styleCaptureUrl}
                onChange={e => setStyleCaptureUrl(e.target.value)}
                placeholder="https://unifiedmktg.com/about/ — paste an existing styled page URL"
                style={{ ...inp(), flex:'1 1 240px', minWidth:0 }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); captureStyling() } }}
              />
              <button onClick={captureStyling} disabled={capturing || !styleCaptureUrl.trim()} style={miniBtn({ color:T, borderColor:T })}>
                {capturing ? <Loader2 size={12} className="spin"/> : <Wand2 size={12}/>} Capture from URL
              </button>
              <label style={{ ...miniBtn({ color:T, borderColor:T }), cursor:'pointer', opacity:capturing?0.5:1 }}>
                <Upload size={12}/> Upload HTML file
                <input type="file" accept=".html,.htm,text/html" disabled={capturing}
                  onChange={async e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    if (f.size > 1_000_000) { toast.error('File too large (max 1MB)'); e.target.value = ''; return }
                    const text = await f.text().catch(() => '')
                    e.target.value = ''
                    if (!text) { toast.error('Could not read file'); return }
                    setCustomHtml(text)
                    setCapturing(true)
                    try {
                      const r = await fetch('/api/kotoiq/topic-campaign', {
                        method:'POST', headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ action:'wrapper_assist', agency_id: agencyId, html: text }),
                      })
                      const d = await r.json()
                      if (d.error) toast.error(errText(d.error))
                      else { setCustomHtml(d.wrapper || ''); setCapturedStyleTokens(d.style_tokens || null); setCaptureInfo({ used_selector:'AI-assisted', notes:`Placeholders inserted: ${(d.placeholders_used || []).join(', ') || 'none'}`, brand: brandMatchNote(d) }); toast.success('Style extracted from file') }
                    } catch (e) { toast.error(e.message) }
                    setCapturing(false)
                  }}
                  style={{ display:'none' }}/>
              </label>
              <button onClick={async () => {
                const html = customHtml.trim()
                if (!html) { toast.error('Paste HTML into the textarea below first'); return }
                setCapturing(true)
                try {
                  const r = await fetch('/api/kotoiq/topic-campaign', {
                    method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ action:'wrapper_assist', agency_id: agencyId, html }),
                  })
                  const d = await r.json()
                  if (d.error) toast.error(errText(d.error))
                  else { setCustomHtml(d.wrapper || ''); setCapturedStyleTokens(d.style_tokens || null); setCaptureInfo({ used_selector:'AI-assisted', notes:`Placeholders inserted: ${(d.placeholders_used || []).join(', ') || 'none'}`, brand: brandMatchNote(d) }); toast.success('Style extracted') }
                } catch (e) { toast.error(e.message) }
                setCapturing(false)
              }} disabled={capturing || !customHtml.trim()} style={miniBtn({ color:R, borderColor:R })}>
                {capturing ? <Loader2 size={12} className="spin"/> : <Sparkles size={12}/>} Style my pages with this
              </button>
              {customHtml && (
                <button onClick={() => { setCustomHtml(''); setCaptureInfo(null); setCapturedStyleTokens(null) }} style={miniBtn()}>
                  <X size={11}/> Clear
                </button>
              )}
            </div>
            <div style={{ fontSize:11, fontFamily:FB, color:'#9ca3af', marginBottom:8, lineHeight:1.5 }}>
              <strong>How it works:</strong> Paste a URL to capture, upload an HTML file, or paste HTML directly into the textarea and click <strong>Style my pages with this</strong>. We read the design language (colors, fonts, spacing) and build a clean wrapper inspired by it. Files are processed in your browser and never stored on our servers.
            </div>
            {captureInfo && (
              <div style={{ marginBottom:8, padding:8, background:'#ecfeff', border:'1px solid #67e8f9', borderRadius:6, fontSize:11, fontFamily:FB, color:'#0e7490' }}>
                <strong>Captured:</strong> {captureInfo.notes}
                {captureInfo.brand && (
                  <div style={{ marginTop:4, fontWeight:600 }}>{captureInfo.brand}</div>
                )}
              </div>
            )}
            <textarea value={customHtml} onChange={e => setCustomHtml(e.target.value)} rows={6}
              placeholder={'<div class="my-template">\n  {{HERO_MEDIA}}\n  <h1>{{HERO_HEADLINE}}</h1>\n  {{SECTIONS}}\n  {{FAQS}}\n  {{SERVICE_AREAS}}\n</div>'}
              style={{ ...inp(), resize:'vertical', minHeight:120, fontFamily:'ui-monospace,Menlo,monospace', fontSize:12 }}/>
          </Field>
          </div>
          )}

          <div style={{ marginTop:18, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
            <span style={{ fontSize:12, fontFamily:FB, color:'#9ca3af' }}>
              {topic.trim() ? 'Press Enter or click Generate. Pick cities next.' : 'Just enter a topic to start.'}
            </span>
            <button onClick={generateMaster} disabled={generating || !topic.trim()} style={primaryBtn()}>
              {generating ? <Loader2 size={14} className="spin"/> : <Wand2 size={14}/>}
              {generating ? 'Claude is writing…' : 'Generate Master'}
            </button>
            {generating && (
              <button onClick={paused ? requestResume : requestPause}
                style={miniBtn({ color: paused ? GRN : AMB, borderColor: paused ? GRN : AMB })}>
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
            )}
          </div>

          {/* Live generation log */}
          {genLog.length > 0 && (
            <div style={{ marginTop:14, padding:12, background:'#0f172a', borderRadius:10, maxHeight:180, overflowY:'auto', fontFamily:'ui-monospace,Menlo,monospace', fontSize:11, lineHeight:1.7 }}>
              {genLog.map((l, i) => (
                <div key={i} style={{ color: l.msg.startsWith('Error') ? '#f87171' : l.msg.startsWith('Done') ? '#fbbf24' : l.msg.includes('generated') ? '#4ade80' : l.msg.startsWith('Still') ? '#60a5fa' : '#94a3b8' }}>
                  {l.msg}
                </div>
              ))}
              {generating && <div style={{ color:'#60a5fa' }}><span className="spin" style={{ display:'inline-block' }}>⟳</span> Working…</div>}
            </div>
          )}
        </div>
      )}

      {/* Optimization report — persistent after pipeline runs */}
      {optimizeReport?.steps?.length > 0 && (
        <div style={card({ background:'#fafafa', border:'1px solid #e2e8f0' })}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <Activity size={16} color={T}/>
            <div style={{ fontFamily:FH, fontWeight:800, fontSize:14, color:BLK }}>Optimization report</div>
            {optimizeReport.completedAt && <span style={{ fontSize:10, fontFamily:FB, color:'#9ca3af' }}>completed {new Date(optimizeReport.completedAt).toLocaleTimeString()}</span>}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {optimizeReport.steps.map((s, i) => {
              const expanded = !!reportExpanded[s.name]
              const icon = s.status === 'pass' ? '✓' : s.status === 'issues' ? '⚠' : s.status === 'error' ? '✗' : s.status === 'running' ? '⟳' : '·'
              const iconColor = s.status === 'pass' ? GRN : s.status === 'issues' ? AMB : s.status === 'error' ? R : '#60a5fa'
              return (
                <div key={i} style={{ border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
                  <div
                    onClick={() => setReportExpanded(prev => ({ ...prev, [s.name]: !prev[s.name] }))}
                    style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', background: expanded ? '#f8fafc' : '#fff' }}>
                    <span style={{ fontSize:14, color:iconColor, fontWeight:900, width:18, textAlign:'center' }}>{icon}</span>
                    <span style={{ fontFamily:FH, fontWeight:700, fontSize:13, color:BLK, flex:1 }}>{s.name}</span>
                    {s.score != null && <span style={{ fontFamily:FH, fontWeight:800, fontSize:13, color: s.score >= 80 ? GRN : s.score >= 60 ? AMB : R }}>{s.score}/100</span>}
                    {s.woven && <span style={{ fontSize:11, fontFamily:FB, color:'#7c3aed' }}>{s.woven} topics woven</span>}
                    {s.rounds?.length > 1 && <span style={{ fontSize:11, fontFamily:FB, color:'#6b7280' }}>{s.rounds.length - 1} fix round{s.rounds.length > 2 ? 's' : ''}</span>}
                    <ChevronDown size={12} color="#9ca3af" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition:'transform .15s' }}/>
                  </div>
                  {expanded && (
                    <div style={{ padding:'10px 14px', borderTop:'1px solid #e5e7eb', fontSize:12, fontFamily:FB, color:'#475569', lineHeight:1.6 }}>
                      {/* Quality check details */}
                      {s.findings && (
                        <div>
                          <div style={{ marginBottom:4 }}><strong>~{s.wordCount} words/page</strong></div>
                          {s.findings.map((f, j) => (
                            <div key={j} style={{ color: f.level === 'fail' ? R : f.level === 'warn' ? AMB : '#6b7280' }}>
                              {f.level === 'fail' ? '✗' : f.level === 'warn' ? '⚠' : 'ℹ'} {f.msg}
                            </div>
                          ))}
                          {!s.findings.length && <div style={{ color:GRN }}>All checks passed</div>}
                        </div>
                      )}
                      {/* Schema details */}
                      {s.types && (
                        <div>
                          <div><strong>Types:</strong> {s.types.join(', ') || 'none'}</div>
                          {s.errors?.map((e, j) => <div key={j} style={{ color:R }}>✗ {e}</div>)}
                          {s.warnings?.map((w, j) => <div key={j} style={{ color:AMB }}>⚠ {w}</div>)}
                          {!s.errors?.length && !s.warnings?.length && <div style={{ color:GRN }}>Schema valid</div>}
                        </div>
                      )}
                      {/* Topical cluster details */}
                      {s.siblings && (
                        <div>
                          <div style={{ marginBottom:4 }}><strong>{s.siblings.length} siblings + {s.supporting?.length || 0} supporting</strong>{s.woven ? ` · ${s.woven} woven into master` : ''}</div>
                          {s.siblings.slice(0, 8).map((t, j) => <div key={j}>· {t.topic} <span style={{ color:'#9ca3af' }}>({t.intent})</span></div>)}
                          {s.siblings.length > 8 && <div style={{ color:'#9ca3af' }}>… +{s.siblings.length - 8} more</div>}
                        </div>
                      )}
                      {/* E-E-A-T details */}
                      {s.rounds && (
                        <div>
                          <div style={{ marginBottom:6 }}>
                            {s.rounds.map((r, j) => (
                              <div key={j} style={{ display:'flex', gap:12, alignItems:'center' }}>
                                <span style={{ fontFamily:FH, fontWeight:800, fontSize:14, color: r.score >= 80 ? GRN : r.score >= 60 ? AMB : R, width:40 }}>{r.score}</span>
                                <span style={{ fontSize:11, color:'#6b7280' }}>{r.round === 0 ? 'Initial' : `Round ${r.round}`}{r.delta != null ? ` (${r.delta >= 0 ? '+' : ''}${r.delta})` : ''}</span>
                                <span style={{ fontSize:10, color:'#9ca3af' }}>E:{r.e} X:{r.x} A:{r.a} T:{r.t}</span>
                              </div>
                            ))}
                          </div>
                          {s.gaps?.length > 0 && (
                            <div style={{ marginTop:6 }}>
                              <strong>Remaining gaps:</strong>
                              {s.gaps.map((g, j) => <div key={j} style={{ color:AMB }}>⚠ [{g.dimension}] {g.issue}</div>)}
                            </div>
                          )}
                          {s.strengths?.length > 0 && (
                            <div style={{ marginTop:6 }}>
                              <strong>Strengths:</strong>
                              {s.strengths.map((st, j) => <div key={j} style={{ color:GRN }}>✓ {st}</div>)}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Final verification details */}
                      {s.quality && (
                        <div>
                          <div><strong>Final quality:</strong> {s.quality.score}/100 · ~{s.quality.wordCount} words</div>
                          {(s.quality.findings || []).filter(f => f.level === 'fail').map((f, j) => <div key={j} style={{ color:R }}>✗ {f.msg}</div>)}
                        </div>
                      )}
                      {s.schema && (
                        <div style={{ marginTop:4 }}>
                          <div><strong>Final schema:</strong> {(s.schema.types || []).join(', ')}{s.schema.errors?.length ? ` · ${s.schema.errors.length} errors` : ' · valid'}</div>
                        </div>
                      )}
                      {s.error && <div style={{ color:R }}>Error: {s.error}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {optimizeReport.needsInput?.length > 0 && (
            <div style={{ marginTop:12, padding:10, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8 }}>
              <div style={{ fontSize:11, fontFamily:FH, fontWeight:800, color:'#92400e', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:4 }}>Manual input needed</div>
              {optimizeReport.needsInput.map((n, i) => <div key={i} style={{ fontSize:12, fontFamily:FB, color:'#92400e' }}>→ {n}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Show master summary after step 1 */}
      {campaign && step >= 2 && (
        <div style={card({ background:'#fafafa' })}>
          {/* Row 1: title + pills */}
          <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:10, marginBottom:12 }}>
            <CheckCircle2 size={18} color={GRN}/>
            <div style={{ fontFamily:FH, fontWeight:800, fontSize:15, color:BLK }}>Master ready</div>
            <span style={pill(GRN, `${GRN}15`)}>{campaign.master?.sections?.length || 0} sections · {campaign.master?.faqs?.length || 0} FAQs</span>
            {campaign.tokens_used > 0 && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontFamily:FB, color:'#9ca3af' }}>
                <Coins size={11}/> {campaign.tokens_used.toLocaleString()} tokens
              </span>
            )}
          </div>
          {/* Row 2: action buttons, wrapping freely */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
            <button onClick={() => {
              setEditedMaster(structuredClone(campaign.master))
              setEditedPhone(campaign.phone || '')
              setEditedCompanyName(campaign.company_name || '')
              setEditedHeroImage(campaign.hero_image_url || '')
              setEditedHeroVideo(campaign.hero_video_url || '')
              setEditedHeroAlt(campaign.hero_image_alt || '')
              setEditedPostType(campaign.post_type || 'page')
              setEditedFocusKw(campaign.focus_keyword_template || '[topic] in [koto_city] [koto_state_abbr]')
              setEditedTopic(campaign.topic || '')
              setEditedCompCity(campaign.competitor_meta?.sample_location?.split(',')[0]?.trim() || '')
              setEditedCompState('')
              setEditedWrapper(campaign.custom_html_wrapper || '')
              setEditedCaptureUrl('')
              setEditedCaptureInfo(null)
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
              <button onClick={() => { setPerfOpen(o => !o); if (!perf) loadPerf() }} style={miniBtn({ color:T, borderColor:T })}>
                <TrendingUp size={11}/> Performance
              </button>
            )}
            {deployHistory.some(d => d.status === 'failed') && (
              <button onClick={retryFailed} disabled={retrying} style={miniBtn({ color:AMB, borderColor:AMB })}>
                {retrying ? <Loader2 size={11} className="spin"/> : <RefreshCw size={11}/>} Retry failed ({deployHistory.filter(d => d.status === 'failed').length})
              </button>
            )}
            {deployHistory.length > 0 && (
              <button onClick={verifyLive} disabled={verifying} style={miniBtn({ color:T, borderColor:T })}>
                {verifying ? <Loader2 size={11} className="spin"/> : <CheckCircle2 size={11}/>} Verify live
              </button>
            )}
            {deployHistory.some(d => d.status === 'published') && (
              <button onClick={resyncSeo} disabled={resyncing} style={miniBtn({ color:T, borderColor:T })}>
                {resyncing ? <Loader2 size={11} className="spin"/> : <Wand2 size={11}/>} Re-sync SEO meta
              </button>
            )}
            {deployHistory.length > 0 && (
              <button onClick={redeployAll} disabled={redeploying} style={miniBtn({ color:R, borderColor:R, background:`${R}10` })}>
                {redeploying ? <Loader2 size={11} className="spin"/> : <RefreshCw size={11}/>} Re-deploy all
              </button>
            )}
            {deployHistory.length > 0 && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                <button
                  onClick={() => saveAutoRefresh(!campaign.auto_refresh, campaign.refresh_threshold_key || 'business-listing')}
                  disabled={autoRefreshBusy}
                  title="Nightly cron re-pulls live Census + Google reviews and re-deploys this campaign when its data is past the chosen freshness window. No AI tokens spent — competitor angles still need a manual Regenerate."
                  style={miniBtn(campaign.auto_refresh ? { color:GRN, borderColor:GRN, background:`${GRN}10` } : {})}>
                  {autoRefreshBusy ? <Loader2 size={11} className="spin"/> : <RefreshCw size={11}/>} Auto-refresh {campaign.auto_refresh ? 'on' : 'off'}
                </button>
                {campaign.auto_refresh && (
                  <select
                    value={campaign.refresh_threshold_key || 'business-listing'}
                    onChange={e => saveAutoRefresh(true, e.target.value)}
                    disabled={autoRefreshBusy}
                    title="Re-deploy when data is older than this"
                    style={{ ...inp(), width:'auto', padding:'4px 6px', fontSize:11 }}>
                    {REFRESH_THRESHOLDS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                )}
              </span>
            )}
            {deployHistory.length > 0 && (
              <button onClick={buildHub} disabled={hubBusy}
                title="Build a pillar/hub page that links every city page + sibling clusters, with BreadcrumbList schema. Re-deploy afterward so the city pages link up to the hub."
                style={miniBtn(campaign.hub_url ? { color:GRN, borderColor:GRN } : { color:'#7c3aed', borderColor:'#7c3aed' })}>
                {hubBusy ? <Loader2 size={11} className="spin"/> : <Sparkles size={11}/>} {campaign.hub_url ? 'Rebuild hub' : 'Build hub page'}
              </button>
            )}
            {campaign.hub_url && (
              <a href={campaign.hub_url} target="_blank" rel="noopener noreferrer"
                title="View the hub page" style={{ ...miniBtn({ color:GRN, borderColor:GRN }), textDecoration:'none' }}>
                <ExternalLink size={11}/> Hub
              </a>
            )}
            <button onClick={runEeatAudit} disabled={eeatBusy} style={miniBtn({ color:'#7c3aed', borderColor:'#7c3aed' })}>
              {eeatBusy ? <Loader2 size={11} className="spin"/> : <Sparkles size={11}/>} E-E-A-T audit
            </button>
            <button onClick={runTopicalExpand} disabled={topicalBusy} style={miniBtn({ color:'#7c3aed', borderColor:'#7c3aed' })}>
              {topicalBusy ? <Loader2 size={11} className="spin"/> : <Sparkles size={11}/>} Topical cluster
            </button>
            <button onClick={() => { setPlaceOpen(true); setPlaceResults([]); setPlaceQuery(campaign.company_name || campaign.topic || '') }}
              style={miniBtn({ color: campaign.google_place_id ? GRN : '#0369a1', borderColor: campaign.google_place_id ? GRN : '#0369a1' })}>
              <Star size={11}/> {campaign.google_place_id ? 'Reviews connected' : 'Connect Google reviews'}
            </button>
            <button onClick={() => setEeatEditorOpen(true)} style={miniBtn({ color:'#0369a1', borderColor:'#0369a1' })}>
              <Edit3 size={11}/> Trust signals
            </button>
            <button onClick={validateSchema} disabled={validating} style={miniBtn({ color:'#0369a1', borderColor:'#0369a1' })}>
              {validating ? <Loader2 size={11} className="spin"/> : <CheckCircle2 size={11}/>} Validate schema
            </button>
            <button onClick={runCitationCheck} disabled={citationBusy} style={miniBtn({ color:'#7c3aed', borderColor:'#7c3aed' })}>
              {citationBusy ? <Loader2 size={11} className="spin"/> : <TrendingUp size={11}/>} AI citations
            </button>
            <button onClick={runQualityCheck} disabled={qualityBusy} style={miniBtn({ color:'#0369a1', borderColor:'#0369a1' })}>
              {qualityBusy ? <Loader2 size={11} className="spin"/> : <CheckCircle2 size={11}/>} Quality check
            </button>
          </div>

          {/* Data-readiness panel — what the engine has for this campaign */}
          {(() => {
            const ei = campaign.eeat_inputs || {}
            const signals = [
              { label:'Competitor intel', ok: !!campaign.competitor_meta, hint:'set sample cities + regenerate' },
              { label:'Google reviews', ok: !!campaign.google_place_id, hint:'Connect Google reviews' },
              { label:'Strategist byline', ok: !!ei.strategist?.name, hint:'add in Trust signals' },
              { label:'Results', ok: Array.isArray(ei.results) && ei.results.length > 0, hint:'add in Trust signals' },
              { label:'Cited sources', ok: Array.isArray(ei.citations) && ei.citations.length > 0, hint:'add in Trust signals' },
              { label:'sameAs links', ok: Array.isArray(ei.sameAs) && ei.sameAs.length > 0, hint:'add in Trust signals' },
              { label:'Business address', ok: !!(ei.address?.street || ei.address?.city), hint:'add in Trust signals' },
              { label:'Testimonials', ok: !!(campaign.google_place_id || (Array.isArray(ei.testimonials) && ei.testimonials.length) || ei.rating), hint:'Connect Google or add in Trust signals' },
            ]
            return (
              <div style={{ marginTop:12, padding:'10px 12px', background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10 }}>
                <div style={{ fontSize:10, fontFamily:FH, fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
                  Content signals the engine has
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 14px' }}>
                  {signals.map(s => (
                    <span key={s.label} title={s.ok ? 'Ready' : `Missing — ${s.hint}`}
                      style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontFamily:FB, color: s.ok ? '#15803d' : '#9ca3af' }}>
                      {s.ok ? <CheckCircle2 size={13}/> : <AlertTriangle size={13}/>}{s.label}
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}
          <div style={{ fontFamily:FB, fontSize:13, color:'#6b7280' }}>
            <strong>Topic:</strong> {campaign.topic}
            {campaign.master?.hero?.headline_variants?.[0] && (
              <>
                <br/>
                <strong>Sample H1:</strong> <code style={{ fontSize:12 }}>{campaign.master.hero.headline_variants[0]}</code>
              </>
            )}
          </div>

          {perfOpen && (
            <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid #e5e7eb' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <TrendingUp size={14} color={T}/>
                <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:13, color:BLK }}>
                  Performance — last {perf?.window_days || perfWindow} days
                </div>
                <select value={perfWindow} onChange={e => { const d = Number(e.target.value); setPerfWindow(d); loadPerf(d) }} style={{ ...inp(), width:'auto', padding:'4px 8px', fontSize:12 }}>
                  <option value={7}>7d</option>
                  <option value={28}>28d</option>
                  <option value={90}>90d</option>
                </select>
                <button onClick={() => loadPerf()} disabled={perfLoading} style={miniBtn()}>
                  {perfLoading ? <Loader2 size={11} className="spin"/> : <RefreshCw size={11}/>} Refresh
                </button>
                <a
                  href={`/api/kotoiq/topic-campaign-csv?campaign_id=${campaign?.id}&agency_id=${agencyId}&days=${perfWindow}`}
                  onClick={async (e) => {
                    e.preventDefault()
                    try {
                      const r = await fetch('/api/kotoiq/topic-campaign', {
                        method:'POST', headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ action:'export_performance_csv', agency_id: agencyId, campaign_id: campaign.id, days: perfWindow }),
                      })
                      if (!r.ok) { toast.error('CSV export failed'); return }
                      const blob = await r.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      const cd = r.headers.get('content-disposition') || ''
                      const m = cd.match(/filename="?([^";]+)"?/)
                      a.download = m ? m[1] : `${campaign?.topic || 'campaign'}-performance.csv`
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      URL.revokeObjectURL(url)
                      toast.success('CSV downloaded')
                    } catch (err) { toast.error(err.message) }
                  }}
                  style={{ ...miniBtn({ color:T, borderColor:T }), textDecoration:'none' }}
                  title="Download per-city performance + scores as CSV"
                >
                  <Download size={11}/> Download CSV
                </a>
              </div>

              {perfLoading && (
                <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:FB, fontSize:13, color:'#6b7280' }}>
                  <Loader2 size={14} className="spin"/> Pulling Search Console + GA4…
                </div>
              )}

              {!perfLoading && perf?.error_hint && (
                <div style={{ display:'flex', alignItems:'center', gap:8, color:AMB, fontFamily:FB, fontSize:13 }}>
                  <AlertTriangle size={13}/> {perf.error_hint}
                </div>
              )}

              {!perfLoading && perf && !perf.error_hint && (
                <>
                  <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                    <Pill color={perf.gsc_connected ? GRN : '#9ca3af'} bg={`${perf.gsc_connected ? GRN : '#9ca3af'}15`}>
                      GSC {perf.gsc_connected ? 'connected' : 'not connected'}
                    </Pill>
                    <Pill color={perf.ga4_connected ? GRN : '#9ca3af'} bg={`${perf.ga4_connected ? GRN : '#9ca3af'}15`}>
                      GA4 {perf.ga4_connected ? 'connected' : 'not connected'}
                    </Pill>
                  </div>

                  {/* Totals */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10, marginBottom:14 }}>
                    <MetricCard icon={MousePointerClick} label="Clicks" value={perf.totals?.clicks} color={T}/>
                    <MetricCard icon={Eye} label="Impressions" value={perf.totals?.impressions} color={T}/>
                    <MetricCard icon={Users} label="Sessions" value={perf.totals?.sessions} color={GRN}/>
                    <MetricCard icon={Users} label="Users" value={perf.totals?.users} color={GRN}/>
                    <MetricCard icon={Target} label="Conversions" value={perf.totals?.conversions} color={R}/>
                  </div>
                  {perf.totals?.best_city && (
                    <div style={{ marginBottom:14, padding:10, background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, fontFamily:FB, color:'#6b7280' }}>
                      <strong style={{ color:BLK }}>Top performer:</strong> {perf.totals.best_city.city}, {perf.totals.best_city.state_abbr} — {perf.totals.best_city.clicks} clicks
                    </div>
                  )}

                  {/* Per-URL table */}
                  <div style={{ maxHeight:420, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:FB }}>
                      <thead style={{ position:'sticky', top:0, background:'#fafafa', zIndex:1 }}>
                        <tr>
                          <th style={th({ width:20 })}></th>
                          <th style={th()}>City</th>
                          <th style={th({ width:90 })}>Trend</th>
                          <th style={th({ width:55, textAlign:'right' })}>Clicks</th>
                          <th style={th({ width:65, textAlign:'right' })}>Impress.</th>
                          <th style={th({ width:50, textAlign:'right' })}>Pos</th>
                          <th style={th({ width:55, textAlign:'right' })}>Sess.</th>
                          <th style={th({ width:50, textAlign:'right' })}>Conv.</th>
                          <th style={th({ width:85 })}>CWV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(perf.per_url || {}).map(([url, p]) => {
                          const expanded = expandedRows.has(url)
                          return (
                            <React.Fragment key={url}>
                              <tr style={{ borderTop:'1px solid #f1f5f9', cursor:'pointer' }}
                                onClick={() => {
                                  setExpandedRows(prev => {
                                    const next = new Set(prev)
                                    if (next.has(url)) next.delete(url); else next.add(url)
                                    return next
                                  })
                                }}>
                                <td style={td({ width:20, color:'#9ca3af' })}>{expanded ? '▾' : '▸'}</td>
                                <td style={td()}>
                                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ color:BLK, textDecoration:'none' }} onClick={e => e.stopPropagation()}>
                                    {p.city}, {p.state_abbr}
                                  </a>
                                </td>
                                <td style={td()}><Sparkline data={p.daily || []}/></td>
                                <td style={td({ textAlign:'right', fontFamily:'ui-monospace,Menlo,monospace' })}>{p.clicks}</td>
                                <td style={td({ textAlign:'right', fontFamily:'ui-monospace,Menlo,monospace', color:'#6b7280' })}>{p.impressions}</td>
                                <td style={td({ textAlign:'right', fontFamily:'ui-monospace,Menlo,monospace', color:p.position > 0 && p.position <= 10 ? GRN : p.position > 0 && p.position <= 30 ? AMB : '#9ca3af' })}>
                                  {p.position > 0 ? p.position.toFixed(1) : '—'}
                                </td>
                                <td style={td({ textAlign:'right', fontFamily:'ui-monospace,Menlo,monospace' })}>{p.sessions}</td>
                                <td style={td({ textAlign:'right', fontFamily:'ui-monospace,Menlo,monospace' })}>{p.conversions}</td>
                                <td style={td()}><CWVBadges cwv={p.cwv}/></td>
                              </tr>
                              {expanded && (
                                <tr style={{ background:'#fafafa' }}>
                                  <td colSpan={9} style={{ padding:'10px 20px' }}>
                                    <ExpandedRowDetail p={p}/>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

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
                        {mdUrlForDeploy(d) && (
                          <a href={mdUrlForDeploy(d)} target="_blank" rel="noopener noreferrer" title="View this page's Markdown twin (.md)"
                            style={{ color:'#7c3aed', marginLeft:8, fontSize:11, fontFamily:'ui-monospace,Menlo,monospace', textDecoration:'none' }}>
                            .md
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
          postType={editedPostType} setPostType={setEditedPostType}
          focusKw={editedFocusKw} setFocusKw={setEditedFocusKw}
          topic={editedTopic} setTopic={setEditedTopic}
          compCity={editedCompCity} setCompCity={setEditedCompCity}
          compState={editedCompState} setCompState={setEditedCompState}
          onRegenerate={regenerateMasterFromEditor} regenBusy={regenBusy}
          wrapper={editedWrapper} setWrapper={setEditedWrapper}
          captureUrl={editedCaptureUrl} setCaptureUrl={setEditedCaptureUrl}
          captureBusy={editedCaptureBusy}
          captureInfo={editedCaptureInfo}
          onCapture={captureStylingInEditor}
          onAiAssist={aiAssistWrapper}
          onUploadFile={uploadWrapperFile}
          campaignTopic={campaign?.topic || ''}
          onSave={saveMasterEdits}
          onClose={() => { setEditorOpen(false); setEditedMaster(null) }}
        />
      )}

      {/* AI-citation report modal */}
      {citationOpen && (
        <div style={overlay()} onClick={() => setCitationOpen(false)}>
          <div style={{ ...modal(), maxWidth:720, maxHeight:'85vh', display:'flex', flexDirection:'column' }} onClick={e => e.stopPropagation()}>
            <div style={modalHeader()}>
              <TrendingUp size={18} color="#7c3aed"/>
              <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:16 }}>AI citation tracking</div>
              <button onClick={() => setCitationOpen(false)} style={miniBtn()}><X size={11}/></button>
            </div>
            <div style={{ padding:22, flex:1, minHeight:0, overflowY:'auto' }}>
              {citationBusy && !citationReport && (
                <div style={{ display:'flex', alignItems:'center', gap:10, color:'#6b7280', fontFamily:FB, fontSize:13 }}>
                  <Loader2 size={16} className="spin"/> Querying Google across your deployed cities (a few seconds each)…
                </div>
              )}
              {citationReport && (
                <div>
                  <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
                    {[['Cities checked', citationReport.citiesChecked, null], ['AI Overview shown', `${citationReport.aiOverviewCount}/${citationReport.citiesChecked}`, null], ['Cited in AI', `${citationReport.citedCount}/${citationReport.citiesChecked}`, GRN], ['Organic top 10', `${citationReport.organicTop10}/${citationReport.citiesChecked}`, null]].map(([label, value, accent]) => (
                      <div key={label} style={{ flex:'1 1 120px', background:'#faf9f6', border:'1px solid #e9e6dd', borderRadius:10, padding:12 }}>
                        <div style={{ fontSize:22, fontFamily:FH, fontWeight:900, color: accent || BLK }}>{value}</div>
                        <div style={{ fontSize:10, fontFamily:FH, color:'#64748b', textTransform:'uppercase', letterSpacing:'.04em', marginTop:2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {citationReport.checks.map((c, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:12, fontFamily:FB }}>
                        <span style={{ flex:1, fontWeight:700, color:BLK }}>{c.city}{c.state ? `, ${c.state}` : ''}</span>
                        <span style={{ color: c.aiOverviewPresent ? '#7c3aed' : '#cbd5e1' }} title="AI Overview shown for this query">AI {c.aiOverviewPresent ? '✓' : '—'}</span>
                        <span style={{ color: c.citedInAi ? GRN : '#cbd5e1', fontWeight:800 }} title="Your domain cited in the AI Overview">{c.citedInAi ? 'CITED' : 'not cited'}</span>
                        <span style={{ color:'#64748b', minWidth:64, textAlign:'right' }} title="Classic organic rank">{c.organicRank != null ? `organic #${c.organicRank}` : 'unranked'}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:12, fontSize:11, fontFamily:FB, color:'#9ca3af', lineHeight:1.5 }}>
                    "Cited" = your domain appears in Google's AI Overview sources for "{campaign?.topic} in &lt;city&gt;". Re-run after pages index (AI Overviews can take days/weeks to pick up new pages).
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trust signals (E-E-A-T inputs) editor */}
      {eeatEditorOpen && campaign && (
        <EeatEditor
          initial={campaign.eeat_inputs || {}}
          busy={savingEeat}
          onClose={() => setEeatEditorOpen(false)}
          onSave={saveEeatInputs}
        />
      )}

      {/* Connect Google reviews modal */}
      {placeOpen && (
        <div style={overlay()} onClick={() => setPlaceOpen(false)}>
          <div style={{ ...modal(), maxWidth:560, maxHeight:'85vh', display:'flex', flexDirection:'column' }} onClick={e => e.stopPropagation()}>
            <div style={modalHeader()}>
              <Star size={18} color="#0369a1"/>
              <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:16 }}>Connect Google reviews</div>
              <button onClick={() => setPlaceOpen(false)} style={miniBtn()}><X size={11}/></button>
            </div>
            <div style={{ padding:22, flex:1, minHeight:0, overflowY:'auto' }}>
              <div style={{ fontSize:12, fontFamily:FB, color:'#6b7280', marginBottom:12, lineHeight:1.5 }}>
                Search Google for the business whose reviews should appear on these pages. Real reviews + the live star rating are pulled from the Google Places API at deploy time — never stored, never faked.
              </div>
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                <input value={placeQuery} onChange={e => setPlaceQuery(e.target.value)} placeholder="Unified Marketing, West Palm Beach FL"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); findReviewPlaces() } }}
                  style={{ ...inp(), flex:1 }}/>
                <button onClick={findReviewPlaces} disabled={placeBusy || !placeQuery.trim()} style={primaryBtn()}>
                  {placeBusy ? <Loader2 size={13} className="spin"/> : <MapPin size={13}/>} Find
                </button>
              </div>
              {campaign.google_place_id && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, fontSize:12, fontFamily:FB, color:GRN }}>
                  <CheckCircle2 size={13}/> A place is connected.
                  <button onClick={() => connectReviewPlace(null)} disabled={placeBusy} style={miniBtn({ color:'#dc2626', borderColor:'#fecaca' })}>Disconnect</button>
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {placeResults.map(p => (
                  <div key={p.place_id} style={{ display:'flex', alignItems:'center', gap:10, border:'1px solid #e5e7eb', borderRadius:10, padding:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FH, fontWeight:800, fontSize:13, color:BLK }}>{p.name}</div>
                      <div style={{ fontSize:11, fontFamily:FB, color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.address}</div>
                      <div style={{ fontSize:11, fontFamily:FB, color:'#475569', marginTop:2 }}>
                        {p.rating != null ? <><span style={{ color:'#f59e0b' }}>★</span> {p.rating} · {p.review_count} reviews</> : 'No rating'}
                      </div>
                    </div>
                    <button onClick={() => connectReviewPlace(p)} disabled={placeBusy} style={miniBtn({ color:GRN, borderColor:GRN })}>Connect</button>
                  </div>
                ))}
                {!placeBusy && placeResults.length === 0 && placeQuery.trim() && (
                  <div style={{ fontSize:12, fontFamily:FB, color:'#9ca3af' }}>No results yet — click Find.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* E-E-A-T audit modal */}
      {eeatOpen && (
        <div style={overlay()} onClick={() => { if (!fixingGaps) setEeatOpen(false) }}>
          <div style={{ ...modal(), maxWidth:750, maxHeight:'90vh', display:'flex', flexDirection:'column' }} onClick={e => e.stopPropagation()}>
            <div style={modalHeader()}>
              <Sparkles size={18} color="#7c3aed"/>
              <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:16 }}>E-E-A-T Optimizer</div>
              <button onClick={() => { if (!fixingGaps) setEeatOpen(false) }} style={miniBtn()}><X size={11}/></button>
            </div>
            <div style={{ padding:22, flex:1, minHeight:0, overflowY:'auto' }}>
              {/* Info fields — shown when audit finds gaps needing real data */}
              {eeatResult && !fixingGaps && (() => {
                const needsInfo = (eeatResult.gaps || []).some(g =>
                  /address|location|credential|certif|license|author|byline|testimonial|review|phone|founded|year/i.test(g.issue + g.fix)
                )
                return needsInfo ? (
                  <div style={{ marginBottom:18, padding:14, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10 }}>
                    <div style={{ fontSize:11, fontFamily:FH, fontWeight:800, color:'#92400e', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
                      Help the optimizer — add real info so it doesn't have to invent it
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <input placeholder="Author name (e.g. Dr. Jane Smith, DC)" value={eeatInfoFields?.author || ''} onChange={e => setEeatInfoFields(p => ({...p, author: e.target.value}))} style={inp()}/>
                      <input placeholder="Credentials (e.g. DC, CCSP, 15 years exp)" value={eeatInfoFields?.credentials || ''} onChange={e => setEeatInfoFields(p => ({...p, credentials: e.target.value}))} style={inp()}/>
                      <input placeholder="Business address" value={eeatInfoFields?.address || ''} onChange={e => setEeatInfoFields(p => ({...p, address: e.target.value}))} style={inp()}/>
                      <input placeholder="Founded year / years in business" value={eeatInfoFields?.founded || ''} onChange={e => setEeatInfoFields(p => ({...p, founded: e.target.value}))} style={inp()}/>
                      <input placeholder="Certifications / affiliations" value={eeatInfoFields?.certifications || ''} onChange={e => setEeatInfoFields(p => ({...p, certifications: e.target.value}))} style={{...inp(), gridColumn:'1 / -1'}}/>
                    </div>
                    <div style={{ fontSize:10, color:'#92400e', fontFamily:FB, marginTop:6 }}>
                      Fill what you have — blank fields are skipped. This info feeds into the rewrite so the page has real E-E-A-T signals.
                    </div>
                  </div>
                ) : null
              })()}

              {eeatBusy && !eeatResult && !fixingGaps && (
                <div style={{ display:'flex', alignItems:'center', gap:10, color:'#6b7280' }}>
                  <Loader2 size={16} className="spin"/> Scoring against Google Search Quality Rater signals…
                </div>
              )}

              {/* Live log — shown during auto-loop */}
              {eeatLog.length > 0 && (
                <div style={{ marginBottom:16, padding:12, background:'#0f172a', borderRadius:10, maxHeight:200, overflowY:'auto', fontFamily:'ui-monospace,Menlo,monospace', fontSize:11, lineHeight:1.7 }}>
                  {eeatLog.map((l, i) => (
                    <div key={i} style={{ color: l.msg.startsWith('Score:') ? '#4ade80' : l.msg.includes('failed') || l.msg.includes('Error') ? '#f87171' : l.msg.includes('Done') || l.msg.includes('Target') ? '#fbbf24' : '#94a3b8' }}>
                      {l.msg}
                    </div>
                  ))}
                  {fixingGaps && <div style={{ color:'#60a5fa' }}><span className="spin" style={{ display:'inline-block' }}>⟳</span> Working…</div>}
                </div>
              )}

              {eeatResult && (
                <div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:14, marginBottom:14, paddingBottom:14, borderBottom:'1px solid #e5e7eb' }}>
                    <div style={{ fontSize:48, fontFamily:FH, fontWeight:900, color: eeatResult.overall_score >= 80 ? GRN : eeatResult.overall_score >= 60 ? AMB : R }}>{eeatResult.overall_score}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, color:'#6b7280', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.04em' }}>Overall E-E-A-T</div>
                      <div style={{ display:'flex', gap:14, marginTop:6, flexWrap:'wrap', fontSize:11, fontFamily:FB, color:'#475569' }}>
                        <span>Experience <strong>{eeatResult.experience}/25</strong></span>
                        <span>Expertise <strong>{eeatResult.expertise}/25</strong></span>
                        <span>Authority <strong>{eeatResult.authoritativeness}/25</strong></span>
                        <span>Trust <strong>{eeatResult.trustworthiness}/25</strong></span>
                      </div>
                    </div>
                  </div>
                  {Array.isArray(eeatResult.strengths) && eeatResult.strengths.length > 0 && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:11, fontFamily:FH, fontWeight:800, color:GRN, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Strengths</div>
                      <ul style={{ margin:0, paddingLeft:18, fontSize:13, fontFamily:FB, color:'#1a2332', lineHeight:1.6 }}>
                        {eeatResult.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(eeatResult.gaps) && eeatResult.gaps.length > 0 && (
                    <div>
                      <div style={{ fontSize:11, fontFamily:FH, fontWeight:800, color:R, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Gaps + fixes</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {eeatResult.gaps.map((g, i) => (
                          <div key={i} style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:10 }}>
                            <div style={{ fontSize:10, color:'#991b1b', fontFamily:FH, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:2 }}>{g.dimension}</div>
                            <div style={{ fontSize:13, fontFamily:FB, color:'#1a2332', marginBottom:4 }}>{g.issue}</div>
                            <div style={{ fontSize:12, fontFamily:FB, color:'#475569' }}><strong style={{ color:GRN }}>Fix:</strong> {g.fix}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                        <button onClick={() => runAutoEeat(eeatResult)} disabled={fixingGaps || eeatBusy} style={primaryBtn()}>
                          {fixingGaps ? <Loader2 size={14} className="spin"/> : <Sparkles size={14}/>}
                          {fixingGaps ? 'Optimizing…' : `Auto-fix until ${EEAT_TARGET}+ (up to ${EEAT_MAX_ROUNDS} rounds)`}
                        </button>
                        <button onClick={regenerateFromAudit} disabled={fixingGaps || eeatBusy} style={miniBtn({ color:'#7c3aed', borderColor:'#7c3aed' })}>
                          Fix once
                        </button>
                      </div>
                    </div>
                  )}
                  {eeatResult.overall_score >= EEAT_TARGET && (
                    <div style={{ marginTop:14, padding:12, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, fontSize:13, fontFamily:FB, color:'#166534', display:'flex', alignItems:'center', gap:8 }}>
                      <ShieldCheck size={16}/> Score is {eeatResult.overall_score} — above the {EEAT_TARGET} target. Re-deploy to push.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Topical cluster modal */}
      {topicalOpen && (
        <div style={overlay()} onClick={() => setTopicalOpen(false)}>
          <div style={{ ...modal(), maxWidth:760 }} onClick={e => e.stopPropagation()}>
            <div style={modalHeader()}>
              <Sparkles size={18} color="#7c3aed"/>
              <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:16 }}>Topical cluster — expand your authority</div>
              <button onClick={() => setTopicalOpen(false)} style={miniBtn()}><X size={11}/></button>
            </div>
            <div style={{ padding:22, maxHeight:'70vh', overflow:'auto' }}>
              {topicalBusy && !topicalResult && (
                <div style={{ display:'flex', alignItems:'center', gap:10, color:'#6b7280' }}>
                  <Loader2 size={16} className="spin"/> Mapping sibling + supporting topics…
                </div>
              )}
              {topicalResult && (
                <>
                  <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, marginBottom:14, lineHeight:1.55 }}>
                    Primary topic: <strong style={{ color:BLK }}>{topicalResult.primary}</strong>. Check the subtopics to weave into THIS page, or click <strong>Use this</strong> to spin up a separate campaign.
                  </div>

                  {/* Regenerate bar */}
                  {(() => {
                    const sel = getSelectedClusterTopics()
                    return (
                      <div style={{ marginBottom:16, padding:12, background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:10 }}>
                          <button
                            onClick={() => regenerateWithCluster(sel)}
                            disabled={topicalBusy || !sel.length}
                            style={primaryBtn()}>
                            {topicalBusy ? <Loader2 size={14} className="spin"/> : <Sparkles size={14}/>}
                            {topicalBusy ? 'Regenerating…' : `Regenerate with ${sel.length} selected`}
                          </button>
                          <button onClick={() => {
                            const all = {}
                            ;(topicalResult.siblings || []).forEach(s => { all[s.topic] = true })
                            ;(topicalResult.supporting || []).forEach(s => { all[s.topic] = true })
                            setClusterSelected(all)
                          }} style={miniBtn()}>Select all</button>
                          <button onClick={() => setClusterSelected({})} style={miniBtn()}>Deselect all</button>
                          <span style={{ fontSize:11, fontFamily:FB, color:'#7c3aed' }}>
                            {sel.length} subtopic{sel.length !== 1 ? 's' : ''} selected
                          </span>
                        </div>
                        <input
                          placeholder="Add your own subtopics (comma-separated)"
                          value={customClusterTopics}
                          onChange={e => setCustomClusterTopics(e.target.value)}
                          style={inp({ fontSize:12 })}/>
                      </div>
                    )
                  })()}

                  {Array.isArray(topicalResult.siblings) && topicalResult.siblings.length > 0 && (
                    <div style={{ marginBottom:18 }}>
                      <div style={{ fontSize:11, fontFamily:FH, fontWeight:800, color:T, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Sibling campaigns ({topicalResult.siblings.length})</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {topicalResult.siblings.map((s, i) => (
                          <div key={i} style={{ background: clusterSelected[s.topic] ? '#f0fdfa' : '#f8fafc', border:`1px solid ${clusterSelected[s.topic] ? '#99f6e4' : '#e2e8f0'}`, borderRadius:8, padding:10, display:'flex', alignItems:'center', gap:10, opacity: clusterSelected[s.topic] ? 1 : 0.6, transition:'all .15s' }}>
                            <input type="checkbox" checked={!!clusterSelected[s.topic]} onChange={() => toggleClusterTopic(s.topic)} style={{ width:16, height:16, accentColor:'#0f766e', cursor:'pointer' }}/>
                            <div style={{ flex:1 }}>
                              <div style={{ fontFamily:FH, fontWeight:800, fontSize:13, color:'#0f766e' }}>{s.topic} <span style={{ ...pill('#0f766e', '#0f766e15'), marginLeft:6, fontSize:10 }}>{s.intent}</span></div>
                              <div style={{ fontSize:12, fontFamily:FB, color:'#475569', marginTop:2 }}>{s.rationale}</div>
                            </div>
                            <button onClick={() => { setTopic(s.topic); setTopicalOpen(false); setCampaign(null); setStep(1); toast.success(`Topic pre-filled: ${s.topic}`) }} style={miniBtn({ color:T, borderColor:T })}>Use this</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(topicalResult.supporting) && topicalResult.supporting.length > 0 && (
                    <div>
                      <div style={{ fontSize:11, fontFamily:FH, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Supporting content ({topicalResult.supporting.length})</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginBottom:6, fontFamily:FB }}>Blog / educational topics that funnel into the primary. Check to weave into this page's FAQs + sections.</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {topicalResult.supporting.map((s, i) => (
                          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'6px 0', opacity: clusterSelected[s.topic] ? 1 : 0.6 }}>
                            <input type="checkbox" checked={!!clusterSelected[s.topic]} onChange={() => toggleClusterTopic(s.topic)} style={{ width:15, height:15, marginTop:2, accentColor:'#7c3aed', cursor:'pointer' }}/>
                            <div style={{ fontSize:13, fontFamily:FB, color:'#1a2332', lineHeight:1.5 }}>
                              <strong>{s.topic}</strong> <span style={{ color:'#6b7280' }}>— {s.rationale}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
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

function EeatEditor({ initial, busy, onClose, onSave }) {
  const s0 = initial.strategist || {}
  const [name, setName] = useState(s0.name || '')
  const [title, setTitle] = useState(s0.title || '')
  const [years, setYears] = useState(s0.yearsExperience || '')
  const [photoUrl, setPhotoUrl] = useState(s0.photoUrl || '')
  const [results, setResults] = useState(Array.isArray(initial.results) && initial.results.length ? initial.results.map(r => ({ metric:r.metric||'', context:r.context||'' })) : [{ metric:'', context:'' }])
  const [citations, setCitations] = useState(Array.isArray(initial.citations) && initial.citations.length ? initial.citations.map(c => ({ claim:c.claim||'', sourceName:c.sourceName||'', sourceUrl:c.sourceUrl||'' })) : [{ claim:'', sourceName:'', sourceUrl:'' }])
  const [sameAs, setSameAs] = useState(Array.isArray(initial.sameAs) && initial.sameAs.length ? [...initial.sameAs] : [''])
  const r0 = initial.rating || {}
  const [ratingValue, setRatingValue] = useState(r0.ratingValue ?? '')
  const [reviewCount, setReviewCount] = useState(r0.reviewCount ?? '')
  const a0 = initial.address || {}
  const [addrStreet, setAddrStreet] = useState(a0.street || '')
  const [addrCity, setAddrCity] = useState(a0.city || '')
  const [addrState, setAddrState] = useState(a0.state || '')
  const [addrZip, setAddrZip] = useState(a0.zip || '')
  const [testimonials, setTestimonials] = useState(Array.isArray(initial.testimonials) && initial.testimonials.length ? initial.testimonials.map(t => ({ text: t.text || '', author: t.author || '', rating: t.rating || '', sourceLabel: t.sourceLabel || '' })) : [{ text: '', author: '', rating: '', sourceLabel: '' }])

  const upd = (setter) => (i, key, val) => setter(arr => arr.map((row, j) => j === i ? { ...row, [key]: val } : row))
  const rm  = (setter) => (i) => setter(arr => arr.filter((_, j) => j !== i))

  function save() {
    onSave({
      strategist: name.trim() ? { name: name.trim(), title: title.trim() || undefined, yearsExperience: Number(years) || undefined, photoUrl: photoUrl.trim() || undefined } : undefined,
      results: results.filter(r => r.metric.trim()).map(r => ({ metric: r.metric.trim(), context: (r.context||'').trim() || undefined })),
      citations: citations.filter(c => c.sourceName.trim() && c.sourceUrl.trim()).map(c => ({ claim: (c.claim||'').trim() || undefined, sourceName: c.sourceName.trim(), sourceUrl: c.sourceUrl.trim() })),
      sameAs: sameAs.map(u => (u||'').trim()).filter(Boolean),
      rating: (Number(ratingValue) > 0 && Number(reviewCount) > 0)
        ? { ratingValue: Number(ratingValue), reviewCount: Number(reviewCount) }
        : undefined,
      address: (addrStreet.trim() || addrCity.trim())
        ? { street: addrStreet.trim() || undefined, city: addrCity.trim() || undefined, state: addrState.trim() || undefined, zip: addrZip.trim() || undefined }
        : undefined,
      testimonials: testimonials.filter(t => t.text.trim() && t.author.trim()).map(t => ({ text: t.text.trim(), author: t.author.trim(), rating: Number(t.rating) > 0 ? Number(t.rating) : undefined, sourceLabel: (t.sourceLabel || '').trim() || undefined })),
    })
  }

  const sectionLabel = (t) => <div style={{ fontSize:11, fontFamily:FH, fontWeight:800, color:BLK, textTransform:'uppercase', letterSpacing:'.05em', margin:'18px 0 8px' }}>{t}</div>
  const addBtn = (fn, t) => <button onClick={fn} style={{ ...miniBtn({ color:T, borderColor:T }), marginTop:8 }}>+ {t}</button>
  const rmBtn = (fn) => <button onClick={fn} title="Remove" style={miniBtn({ color:'#dc2626', borderColor:'#fecaca' })}><Trash2 size={11}/></button>

  return (
    <div style={overlay()} onClick={onClose}>
      <div style={{ ...modal(), maxWidth:640, maxHeight:'88vh', display:'flex', flexDirection:'column' }} onClick={e => e.stopPropagation()}>
        <div style={modalHeader()}>
          <Star size={18} color="#0369a1"/>
          <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:16 }}>Trust signals (E-E-A-T)</div>
          <button onClick={onClose} style={miniBtn()}><X size={11}/></button>
        </div>
        <div style={{ padding:22, flex:1, minHeight:0, overflowY:'auto' }}>
          <div style={{ fontSize:12, fontFamily:FB, color:'#6b7280', lineHeight:1.5 }}>
            Real data only — these render as the byline / results / sources / sameAs blocks + schema, and feed the E-E-A-T audit. Reviews + star rating come from Google automatically (use <strong>Connect Google reviews</strong>). Leave anything blank to omit it.
          </div>

          {sectionLabel('Strategist byline (Experience)')}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" style={inp()}/></Field>
            <Field label="Title"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Lead Strategist" style={inp()}/></Field>
            <Field label="Years experience"><input value={years} onChange={e => setYears(e.target.value.replace(/\D/g,''))} placeholder="8" style={inp()}/></Field>
            <Field label="Photo URL"><input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://…/headshot.jpg" style={inp()}/></Field>
          </div>

          {sectionLabel('Business address (one fixed location)')}
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
            <Field label="Street address"><input value={addrStreet} onChange={e => setAddrStreet(e.target.value)} placeholder="123 Clematis St, Suite 200" style={inp()}/></Field>
            <Field label="City"><input value={addrCity} onChange={e => setAddrCity(e.target.value)} placeholder="West Palm Beach" style={inp()}/></Field>
            <Field label="State"><input value={addrState} onChange={e => setAddrState(e.target.value.toUpperCase().slice(0,2))} placeholder="FL" maxLength={2} style={inp()}/></Field>
            <Field label="ZIP"><input value={addrZip} onChange={e => setAddrZip(e.target.value)} placeholder="33401" style={inp()}/></Field>
          </div>
          <div style={{ fontSize:11, fontFamily:FB, color:'#9ca3af' }}>
            Your real, single business address — rendered in a contact line + LocalBusiness PostalAddress schema. NOT per-city (that's the service area).
          </div>

          {sectionLabel('Testimonials')}
          {testimonials.map((t, i) => (
            <div key={i} style={{ display:'flex', flexDirection:'column', gap:6, border:'1px solid #e5e7eb', borderRadius:8, padding:10, marginBottom:8 }}>
              <textarea value={t.text} onChange={e => upd(setTestimonials)(i,'text',e.target.value)} rows={2} placeholder="Quoted review text" style={{ ...inp(), resize:'vertical' }}/>
              <div style={{ display:'flex', gap:8 }}>
                <input value={t.author} onChange={e => upd(setTestimonials)(i,'author',e.target.value)} placeholder="Reviewer name" style={{ ...inp(), flex:1 }}/>
                <input value={t.rating} onChange={e => upd(setTestimonials)(i,'rating',e.target.value.replace(/[^0-9.]/g,''))} placeholder="5" style={{ ...inp(), flex:'0 0 60px' }}/>
                <input value={t.sourceLabel} onChange={e => upd(setTestimonials)(i,'sourceLabel',e.target.value)} placeholder="Google" style={{ ...inp(), flex:'0 0 110px' }}/>
                {rmBtn(() => rm(setTestimonials)(i))}
              </div>
            </div>
          ))}
          {addBtn(() => setTestimonials(a => [...a, { text:'', author:'', rating:'', sourceLabel:'' }]), 'testimonial')}
          <div style={{ fontSize:11, fontFamily:FB, color:'#9ca3af' }}>
            Connected Google reviews override these when present. → Review schema.
          </div>

          {sectionLabel('Rating (stars + review count)')}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Field label="Star rating (0–5)" hint="e.g. 4.9">
              <input value={ratingValue} onChange={e => setRatingValue(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="4.9" style={inp()}/>
            </Field>
            <Field label="Number of reviews" hint="e.g. 87">
              <input value={reviewCount} onChange={e => setReviewCount(e.target.value.replace(/\D/g, ''))} placeholder="87" style={inp()}/>
            </Field>
          </div>
          <div style={{ fontSize:11, fontFamily:FB, color:'#9ca3af' }}>
            Renders a star badge on the page + AggregateRating schema. Connected Google reviews override this when present.
          </div>

          {sectionLabel('Results (real metrics only)')}
          {results.map((r, i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:8 }}>
              <input value={r.metric} onChange={e => upd(setResults)(i,'metric',e.target.value)} placeholder="+42% leads" style={{ ...inp(), flex:'0 0 140px' }}/>
              <input value={r.context} onChange={e => upd(setResults)(i,'context',e.target.value)} placeholder="in 90 days for a [koto_city] client" style={{ ...inp(), flex:1 }}/>
              {rmBtn(() => rm(setResults)(i))}
            </div>
          ))}
          {addBtn(() => setResults(a => [...a, { metric:'', context:'' }]), 'result')}

          {sectionLabel('Cited sources (Authoritativeness)')}
          {citations.map((c, i) => (
            <div key={i} style={{ display:'flex', flexDirection:'column', gap:6, border:'1px solid #e5e7eb', borderRadius:8, padding:10, marginBottom:8 }}>
              <input value={c.claim} onChange={e => upd(setCitations)(i,'claim',e.target.value)} placeholder="Claim this supports (optional)" style={inp()}/>
              <div style={{ display:'flex', gap:8 }}>
                <input value={c.sourceName} onChange={e => upd(setCitations)(i,'sourceName',e.target.value)} placeholder="Search Engine Journal" style={{ ...inp(), flex:'0 0 200px' }}/>
                <input value={c.sourceUrl} onChange={e => upd(setCitations)(i,'sourceUrl',e.target.value)} placeholder="https://…" style={{ ...inp(), flex:1 }}/>
                {rmBtn(() => rm(setCitations)(i))}
              </div>
            </div>
          ))}
          {addBtn(() => setCitations(a => [...a, { claim:'', sourceName:'', sourceUrl:'' }]), 'source')}

          {sectionLabel('sameAs — entity links (GBP / LinkedIn / directories)')}
          {sameAs.map((u, i) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:8 }}>
              <input value={u} onChange={e => setSameAs(a => a.map((x,j) => j===i ? e.target.value : x))} placeholder="https://www.google.com/maps/place/…" style={{ ...inp(), flex:1 }}/>
              {rmBtn(() => setSameAs(a => a.filter((_,j) => j!==i)))}
            </div>
          ))}
          {addBtn(() => setSameAs(a => [...a, '']), 'link')}
        </div>
        <div style={{ padding:'14px 20px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={miniBtn()}>Cancel</button>
          <button onClick={save} disabled={busy} style={primaryBtn()}>
            {busy ? <Loader2 size={14} className="spin"/> : <Save size={14}/>} Save trust signals
          </button>
        </div>
      </div>
    </div>
  )
}

function MasterEditor({ master, setMaster, phone, setPhone, companyName, setCompanyName, heroImage, setHeroImage, heroVideo, setHeroVideo, heroAlt, setHeroAlt, postType, setPostType, focusKw, setFocusKw, topic, setTopic, compCity, setCompCity, compState, setCompState, onRegenerate, regenBusy, wrapper, setWrapper, captureUrl, setCaptureUrl, captureBusy, captureInfo, onCapture, onAiAssist, onUploadFile, campaignTopic, onSave, onClose }) {
  // Preview the focus keyword resolved for a sample city
  const sampleResolved = (focusKw || '')
    .replace(/\[topic\]/gi, campaignTopic)
    .replace(/\[koto_city\]/g, 'Austin')
    .replace(/\[koto_state_abbr\]/g, 'TX')
    .replace(/\[koto_state\]/g, 'Texas')
    .trim()
    .toLowerCase()
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

          {/* Topic + competitor intel — edit the topic, set a sample city,
              regenerate the whole master from scratch. */}
          <EditorBlock label="Topic & regeneration">
            <Field label="Topic" hint="The service this campaign is about. Editing here + Regenerate rebuilds the master around the new topic.">
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Website Design" style={inp()}/>
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12, marginTop:10 }}>
              <Field label="Competitor sample cities (optional)" hint="Up to 5, comma-separated. We sample each city's top-3 Google results and aggregate before regenerating.">
                <input value={compCity} onChange={e => setCompCity(e.target.value)} placeholder="Austin, Dallas, Houston" style={inp()}/>
              </Field>
              <Field label="State" hint="2-letter">
                <input value={compState} onChange={e => setCompState(e.target.value.toUpperCase().slice(0,2))} placeholder="TX" maxLength={2} style={inp()}/>
              </Field>
            </div>
            <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:10 }}>
              <button onClick={onRegenerate} disabled={regenBusy || !topic.trim()} style={primaryBtn()}>
                {regenBusy ? <Loader2 size={14} className="spin"/> : <Sparkles size={14}/>}
                {regenBusy ? 'Regenerating…' : 'Regenerate master'}
              </button>
              <span style={{ fontSize:11, fontFamily:FB, color:'#9ca3af', lineHeight:1.4 }}>
                Replaces all content (sections, FAQs, hero). Deploy history + wrapper kept. Re-deploy after to push live.
              </span>
            </div>
          </EditorBlock>

          {/* Custom HTML wrapper — theme styling. */}
          <EditorBlock label="Custom HTML wrapper (theme styling)">
            <div style={{ fontSize:12, fontFamily:FB, color:'#6b7280', marginBottom:8, lineHeight:1.5 }}>
              Paste your theme&rsquo;s page HTML or capture from an existing styled URL. Placeholders:
              {' '}<code style={{ background:'#f1f5f9', padding:'1px 4px', borderRadius:3 }}>{'{{HERO_HEADLINE}}'}</code>{' '}
              <code style={{ background:'#f1f5f9', padding:'1px 4px', borderRadius:3 }}>{'{{HERO_SUB}}'}</code>{' '}
              <code style={{ background:'#f1f5f9', padding:'1px 4px', borderRadius:3 }}>{'{{HERO_MEDIA}}'}</code>{' '}
              <code style={{ background:'#f1f5f9', padding:'1px 4px', borderRadius:3 }}>{'{{SECTIONS}}'}</code>{' '}
              <code style={{ background:'#f1f5f9', padding:'1px 4px', borderRadius:3 }}>{'{{FAQS}}'}</code>{' '}
              <code style={{ background:'#f1f5f9', padding:'1px 4px', borderRadius:3 }}>{'{{CTA}}'}</code>{' '}
              <code style={{ background:'#f1f5f9', padding:'1px 4px', borderRadius:3 }}>{'{{SERVICE_AREAS}}'}</code>{' '}
              <code style={{ background:'#f1f5f9', padding:'1px 4px', borderRadius:3 }}>{'{{RELATED_SERVICES}}'}</code>{' '}
              <code style={{ background:'#f1f5f9', padding:'1px 4px', borderRadius:3 }}>{'{{HOWTO}}'}</code>{' '}
              <code style={{ background:'#f1f5f9', padding:'1px 4px', borderRadius:3 }}>{'{{COMPARISON}}'}</code>{' '}
              <code style={{ background:'#f1f5f9', padding:'1px 4px', borderRadius:3 }}>{'{{LOCAL_DATA}}'}</code>{' '}
              <code style={{ background:'#f1f5f9', padding:'1px 4px', borderRadius:3 }}>{'{{DIRECT_ANSWER}}'}</code>.
              After saving, click <strong>Re-deploy all</strong> to apply.
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', flexWrap:'wrap' }}>
              <input
                value={captureUrl}
                onChange={e => setCaptureUrl(e.target.value)}
                placeholder="https://unifiedmktg.com/about/ — paste an existing styled page URL"
                style={{ ...inp(), flex:'1 1 240px', minWidth:0 }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onCapture() } }}
              />
              <button onClick={onCapture} disabled={captureBusy || !captureUrl.trim()} style={miniBtn({ color:T, borderColor:T })}>
                {captureBusy ? <Loader2 size={12} className="spin"/> : <Wand2 size={12}/>} Capture from URL
              </button>
              <label style={{ ...miniBtn({ color:T, borderColor:T }), cursor:'pointer', opacity:captureBusy?0.5:1 }}>
                <Upload size={12}/> Upload HTML file
                <input type="file" accept=".html,.htm,text/html" disabled={captureBusy}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { onUploadFile(f); e.target.value = '' } }}
                  style={{ display:'none' }}/>
              </label>
              <button onClick={() => onAiAssist()} disabled={captureBusy || !wrapper.trim()} style={miniBtn({ color:R, borderColor:R })}>
                {captureBusy ? <Loader2 size={12} className="spin"/> : <Sparkles size={12}/>} Style my pages with this
              </button>
              {wrapper && (
                <button onClick={() => setWrapper('')} style={miniBtn()}>
                  <X size={11}/> Clear
                </button>
              )}
            </div>
            <div style={{ fontSize:11, fontFamily:FB, color:'#9ca3af', marginBottom:8, lineHeight:1.5 }}>
              <strong>How it works:</strong> Paste / upload / capture any HTML+CSS reference (a styled page, a design system, a brand guide). Claude reads the colors, fonts, spacing, button styles, layout patterns &mdash; then builds a clean, minimal wrapper INSPIRED by those design tokens, with our placeholders inserted. It does NOT copy the source HTML verbatim. The reference file is processed once and discarded &mdash; never stored on our servers.
            </div>
            {captureInfo && (
              <div style={{ marginBottom:8, padding:8, background:'#ecfeff', border:'1px solid #67e8f9', borderRadius:6, fontSize:11, fontFamily:FB, color:'#0e7490' }}>
                <strong>Captured:</strong> {captureInfo.notes}
                {captureInfo.brand && (
                  <div style={{ marginTop:4, fontWeight:600 }}>{captureInfo.brand}</div>
                )}
              </div>
            )}
            <textarea value={wrapper} onChange={e => setWrapper(e.target.value)} rows={10}
              placeholder={'<div class="my-template">\n  {{HERO_MEDIA}}\n  <h1>{{HERO_HEADLINE}}</h1>\n  {{SECTIONS}}\n  {{FAQS}}\n  {{SERVICE_AREAS}}\n</div>'}
              style={{ ...inp(), resize:'vertical', minHeight:160, fontFamily:'ui-monospace,Menlo,monospace', fontSize:12 }}/>
          </EditorBlock>

          {/* Focus keyword template (resolved per-city for SEO) */}
          <EditorBlock label="Focus keyword (per-city)">
            <Field label="Template" hint="Use [koto_city], [koto_state], [koto_state_abbr]. Write it like you'd type it into RankMath's focus keyword field. Resolved + written to Yoast + RankMath + KotoIQ on every deploy.">
              <input value={focusKw} onChange={e => setFocusKw(e.target.value)} placeholder="[topic] in [koto_city] [koto_state_abbr]" style={inp()}/>
            </Field>
            <div style={{ marginTop:6, fontSize:12, fontFamily:FB, color:'#6b7280' }}>
              <strong>Sample for Austin, TX:</strong> <code style={{ background:'#f1f5f9', padding:'2px 8px', borderRadius:4 }}>{sampleResolved || '—'}</code>
            </div>
          </EditorBlock>

          {/* Campaign-level tokens (resolved everywhere) */}
          <EditorBlock label="Campaign settings">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <Field label="Company name" hint="[koto_company_name]">
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Unified Marketing" style={inp()}/>
              </Field>
              <Field label="Phone number" hint="[koto_phone] (tel link)">
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(512) 555-1234" style={inp()}/>
              </Field>
              <Field label="Publish as" hint="Page or Post in WordPress">
                <select value={postType} onChange={e => setPostType(e.target.value)} style={inp()}>
                  <option value="page">Page</option>
                  <option value="post">Post</option>
                </select>
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

// Build the Markdown-twin URL for a deploy row: {origin}/{slug}.md. Mirrors the
// safeMdSlug sanitation the server uses for the pushed file path.
function mdUrlForDeploy(d) {
  if (!d?.wp_post_url || !d?.resolved_slug) return null
  try {
    const origin = new URL(d.wp_post_url).origin
    const slug = String(d.resolved_slug).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
    return slug ? `${origin}/${slug}.md` : null
  } catch { return null }
}

function Sparkline({ data, width = 80, height = 22, strokeWidth = 1.5 }) {
  if (!data || data.length === 0) return <span style={{ color:'#d1d5db', fontSize:11 }}>—</span>
  const w = width, h = height
  const values = data.map(d => d.clicks)
  const max = Math.max(...values, 1)
  const stepX = data.length > 1 ? w / (data.length - 1) : 0
  const points = values.map((v, i) => `${i * stepX},${h - (v / max) * (h - 2) - 1}`).join(' ')
  const totalClicks = values.reduce((s, v) => s + v, 0)
  const half = Math.floor(values.length / 2)
  const firstHalf = values.slice(0, half).reduce((s, v) => s + v, 0)
  const secondHalf = values.slice(half).reduce((s, v) => s + v, 0)
  const trend = secondHalf > firstHalf * 1.1 ? GRN : secondHalf < firstHalf * 0.9 ? R : '#9ca3af'
  return (
    <svg width={w} height={h} style={{ display:'block' }}>
      <polyline points={points} fill="none" stroke={trend} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      {totalClicks === 0 && (
        <line x1="0" y1={h/2} x2={w} y2={h/2} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2 2"/>
      )}
    </svg>
  )
}

// Organic-rank trend from the check_citations history. Rank is "lower is
// better", so the sparkline is inverted (rank #1 sits at the top) and an
// improvement (rank number going DOWN) renders green.
function RankTrend({ history, width = 120, height = 26 }) {
  const ranked = (history || []).filter(h => h.organic_rank != null)
  if (ranked.length === 0) {
    return <span style={{ color:'#9ca3af', fontSize:12, fontFamily:FB, fontStyle:'italic' }}>No organic rank recorded yet — run a citation check to start trending.</span>
  }
  const ranks = ranked.map(h => h.organic_rank)
  const first = ranks[0]
  const last = ranks[ranks.length - 1]
  const delta = first - last // positive = improved (moved up the page)
  const worst = Math.max(...ranks, 10)
  const stepX = ranked.length > 1 ? width / (ranked.length - 1) : 0
  // Invert: rank 1 → top (y small), worst → bottom (y large)
  const points = ranks.map((r, i) => `${i * stepX},${((r - 1) / Math.max(worst - 1, 1)) * (height - 3) + 1}`).join(' ')
  const trendColor = delta > 0 ? GRN : delta < 0 ? R : '#9ca3af'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <svg width={width} height={height} style={{ display:'block', flexShrink:0 }}>
        <polyline points={points} fill="none" stroke={trendColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
        {ranks.map((r, i) => <circle key={i} cx={i * stepX} cy={((r - 1) / Math.max(worst - 1, 1)) * (height - 3) + 1} r={1.6} fill={trendColor}/>)}
      </svg>
      <div style={{ fontFamily:FB, fontSize:12, lineHeight:1.3 }}>
        <span style={{ fontWeight:800, color:BLK }}>#{last}</span>
        {ranked.length > 1 && (
          <span style={{ color:trendColor, marginLeft:6, fontWeight:700 }}>
            {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '—'}
          </span>
        )}
        <span style={{ color:'#9ca3af', marginLeft:6 }}>over {ranked.length} check{ranked.length === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}

function CWVBadges({ cwv }) {
  if (!cwv) return <span style={{ color:'#d1d5db', fontSize:11 }}>—</span>
  const lcpOk = cwv.lcp_p75_ms != null && cwv.lcp_p75_ms <= 2500
  const lcpPoor = cwv.lcp_p75_ms != null && cwv.lcp_p75_ms > 4000
  const lcpColor = lcpOk ? GRN : lcpPoor ? R : AMB
  const clsOk = cwv.cls_p75 != null && cwv.cls_p75 <= 0.1
  const clsPoor = cwv.cls_p75 != null && cwv.cls_p75 > 0.25
  const clsColor = clsOk ? GRN : clsPoor ? R : AMB
  const inpOk = cwv.inp_p75_ms != null && cwv.inp_p75_ms <= 200
  const inpPoor = cwv.inp_p75_ms != null && cwv.inp_p75_ms > 500
  const inpColor = inpOk ? GRN : inpPoor ? R : AMB
  return (
    <div style={{ display:'flex', gap:3, fontSize:10, fontFamily:'ui-monospace,Menlo,monospace' }} title={cwv.source === 'crux_origin' ? 'Origin-level fallback (low traffic)' : 'URL-level'}>
      <span style={cwvBadge(lcpColor)} title={`LCP p75 ${cwv.lcp_p75_ms ?? '—'}ms — good ≤2500`}>L</span>
      <span style={cwvBadge(clsColor)} title={`CLS p75 ${cwv.cls_p75 ?? '—'} — good ≤0.10`}>C</span>
      <span style={cwvBadge(inpColor)} title={`INP p75 ${cwv.inp_p75_ms ?? '—'}ms — good ≤200`}>I</span>
    </div>
  )
}
const cwvBadge = (c) => ({ display:'inline-flex', alignItems:'center', justifyContent:'center', width:18, height:18, borderRadius:4, color:'#fff', background:c, fontWeight:700 })

function ExpandedRowDetail({ p }) {
  const hasQueries = (p.top_queries || []).length > 0
  const hasRankHistory = (p.rank_history || []).length > 0
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
    <div style={{ display:'grid', gridTemplateColumns:hasQueries ? '1fr 1fr' : '1fr', gap:14 }}>
      {hasQueries && (
        <div>
          <div style={{ fontSize:11, fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>
            Top queries
          </div>
          <table style={{ width:'100%', fontSize:12, fontFamily:FB }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left', padding:'4px 8px', fontSize:10, color:'#9ca3af' }}>Query</th>
                <th style={{ textAlign:'center', padding:'4px 8px', fontSize:10, color:'#9ca3af', width:60 }}>Trend</th>
                <th style={{ textAlign:'right', padding:'4px 8px', fontSize:10, color:'#9ca3af', width:50 }}>Clicks</th>
                <th style={{ textAlign:'right', padding:'4px 8px', fontSize:10, color:'#9ca3af', width:60 }}>Impr.</th>
              </tr>
            </thead>
            <tbody>
              {p.top_queries.map((q, i) => (
                <tr key={i} style={{ borderTop:'1px solid #f1f5f9' }}>
                  <td style={{ padding:'5px 8px' }}>{q.query}</td>
                  <td style={{ padding:'5px 8px', textAlign:'center' }}>
                    <div style={{ display:'inline-block', verticalAlign:'middle' }}>
                      <Sparkline data={q.daily || []} width={56} height={16} strokeWidth={1.25}/>
                    </div>
                  </td>
                  <td style={{ padding:'5px 8px', textAlign:'right', fontFamily:'ui-monospace,Menlo,monospace' }}>{q.clicks}</td>
                  <td style={{ padding:'5px 8px', textAlign:'right', fontFamily:'ui-monospace,Menlo,monospace', color:'#6b7280' }}>{q.impressions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div>
        <div style={{ fontSize:11, fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>
          Core Web Vitals (p75)
        </div>
        {p.cwv ? (
          <table style={{ width:'100%', fontSize:12, fontFamily:FB }}>
            <tbody>
              <tr><td style={{ padding:'4px 8px', color:'#6b7280' }}>LCP</td><td style={{ padding:'4px 8px', fontFamily:'ui-monospace,Menlo,monospace' }}>{p.cwv.lcp_p75_ms ? `${(p.cwv.lcp_p75_ms / 1000).toFixed(2)}s` : '—'}</td><td style={{ padding:'4px 8px', fontSize:10, color:'#9ca3af' }}>good ≤ 2.5s</td></tr>
              <tr><td style={{ padding:'4px 8px', color:'#6b7280' }}>CLS</td><td style={{ padding:'4px 8px', fontFamily:'ui-monospace,Menlo,monospace' }}>{p.cwv.cls_p75 != null ? p.cwv.cls_p75.toFixed(3) : '—'}</td><td style={{ padding:'4px 8px', fontSize:10, color:'#9ca3af' }}>good ≤ 0.10</td></tr>
              <tr><td style={{ padding:'4px 8px', color:'#6b7280' }}>INP</td><td style={{ padding:'4px 8px', fontFamily:'ui-monospace,Menlo,monospace' }}>{p.cwv.inp_p75_ms ? `${p.cwv.inp_p75_ms}ms` : '—'}</td><td style={{ padding:'4px 8px', fontSize:10, color:'#9ca3af' }}>good ≤ 200ms</td></tr>
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize:12, fontFamily:FB, color:'#9ca3af', fontStyle:'italic' }}>
            No CrUX data yet — usually needs 28+ days of traffic to populate.
          </div>
        )}
      </div>
    </div>
    {hasRankHistory && (
      <div>
        <div style={{ fontSize:11, fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>
          Organic rank trend — {p.city} (from citation checks)
        </div>
        <RankTrend history={p.rank_history}/>
      </div>
    )}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 12px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, fontSize:11, fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em' }}>
        <Icon size={11} color={color}/> {label}
      </div>
      <div style={{ fontSize:20, fontFamily:FH, fontWeight:800, color:BLK }}>{(value ?? 0).toLocaleString()}</div>
    </div>
  )
}

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
const miniBtn = (x={}) => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 13px', borderRadius:8, border:`1px solid ${x.borderColor||'#e5e7eb'}`, background:x.background||'#fff', color:x.color||'#6b7280', fontFamily:FH, fontSize:13, fontWeight:700, cursor:'pointer' })

// Coerce any error value (string, Error, or backend {code,message} object)
// into a plain string. Passing an object to toast.error() makes sonner try
// to render it as a React node → React error #31 ("objects are not valid as
// a React child"). Always stringify first.
function errText(e) {
  if (e == null) return 'Request failed'
  if (typeof e === 'string') return e
  if (typeof e === 'object') return e.message || e.error || e.code || JSON.stringify(e)
  return String(e)
}
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
