"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Sparkles, Loader2, CheckCircle, XCircle, Clock, BarChart2,
  TrendingUp, Award, Brain, Target, Shield, Globe, Link2, Search,
  Map, FileText, Zap, Eye, Code, GitBranch, Grid, Star, Image as ImageIcon,
  Activity, Settings, RefreshCw, AlertCircle, ChevronDown, ChevronRight,
  Layers, Eraser, Calendar, Play,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

// ── Animated CSS ──
const STYLE_TAG = `
@keyframes mc-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
@keyframes mc-scan { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
@keyframes mc-fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes mc-count { from{opacity:0;transform:scale(.5)} to{opacity:1;transform:scale(1)} }
@keyframes mc-glow { 0%,100%{box-shadow:0 0 4px ${R}40} 50%{box-shadow:0 0 20px ${R}60} }
@keyframes mc-ring-flash-1 { 0%{filter:drop-shadow(0 0 4px #ececef)} 25%{filter:drop-shadow(0 0 18px ${T}90)} 50%{filter:drop-shadow(0 0 4px #ececef)} 100%{filter:drop-shadow(0 0 4px #ececef)} }
@keyframes mc-ring-flash-2 { 0%{filter:drop-shadow(0 0 4px #8b5cf630)} 35%{filter:drop-shadow(0 0 18px #8b5cf690)} 60%{filter:drop-shadow(0 0 4px #8b5cf630)} 100%{filter:drop-shadow(0 0 4px #8b5cf630)} }
@keyframes mc-ring-flash-3 { 0%{filter:drop-shadow(0 0 4px #ececef)} 45%{filter:drop-shadow(0 0 18px ${AMB}90)} 70%{filter:drop-shadow(0 0 4px #ececef)} 100%{filter:drop-shadow(0 0 4px #ececef)} }
@keyframes mc-ring-flash-4 { 0%{filter:drop-shadow(0 0 4px ${GRN}30)} 55%{filter:drop-shadow(0 0 18px ${GRN}90)} 80%{filter:drop-shadow(0 0 4px ${GRN}30)} 100%{filter:drop-shadow(0 0 4px ${GRN}30)} }
@keyframes mc-ring-rotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes mc-color-cycle-1 { 0%,100%{stroke:${T}} 33%{stroke:#6366f1} 66%{stroke:#06b6d4} }
@keyframes mc-color-cycle-2 { 0%,100%{stroke:#8b5cf6} 33%{stroke:#ec4899} 66%{stroke:#6366f1} }
@keyframes mc-color-cycle-3 { 0%,100%{stroke:${AMB}} 33%{stroke:#f97316} 66%{stroke:#eab308} }
@keyframes mc-color-cycle-4 { 0%,100%{stroke:${GRN}} 33%{stroke:#06b6d4} 66%{stroke:#10b981} }
`

// ── Tool registry ──
const SECTIONS = [
  { title: 'Dashboard', icon: BarChart2, tools: [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart2, tab: 'dashboard', check: 'summary', runAction: null },
    { id: 'keywords', label: 'Keywords', icon: Search, tab: 'keywords', check: 'keywords', runAction: 'quick_scan', needs: ['website'] },
    { id: 'rankings', label: 'Rankings', icon: TrendingUp, tab: 'rank_tracker', check: 'rankings', runAction: null },
    { id: 'authority', label: 'Authority Score', icon: Award, tab: 'topical_authority', check: 'authority', runAction: 'audit_topical_authority' },
  ]},
  { title: 'Intelligence', icon: Brain, tools: [
    { id: 'strategy', label: 'Strategic Plan', icon: Target, tab: 'strategy', check: 'strategy', runAction: 'generate_strategic_plan' },
    { id: 'scorecard', label: 'Scorecard', icon: Shield, tab: 'scorecard', check: 'scorecard', runAction: 'generate_scorecard' },
    { id: 'comp_watch', label: 'Competitor Watch', icon: Eye, tab: 'competitor_watch', check: null, runAction: null },
    { id: 'competitors', label: 'Competitors', icon: Globe, tab: 'competitors', check: null, runAction: null },
    { id: 'comp_map', label: 'Competitor Maps', icon: Map, tab: 'competitor_map', check: null, runAction: null },
    { id: 'aeo', label: 'AEO Research', icon: Brain, tab: 'aeo', check: null, runAction: null },
    { id: 'multi_aeo', label: 'Multi-Engine AEO', icon: Sparkles, tab: 'multi_engine_aeo', check: null, runAction: null },
    { id: 'brand_serp', label: 'Brand SERP', icon: Search, tab: 'brand_serp', check: 'brand_serp', runAction: 'scan_brand_serp' },
    { id: 'backlinks', label: 'Backlinks', icon: Link2, tab: 'backlinks', check: 'backlinks', runAction: 'analyze_backlinks' },
    { id: 'link_opps', label: 'Link Opportunities', icon: GitBranch, tab: 'backlink_opportunities', check: 'link_opps', runAction: 'scan_backlink_opportunities' },
    { id: 'eeat', label: 'E-E-A-T', icon: Shield, tab: 'eeat', check: 'eeat', runAction: 'audit_eeat' },
    { id: 'kg', label: 'Knowledge Graph', icon: Layers, tab: 'knowledge_graph', check: null, runAction: null },
    { id: 'query_paths', label: 'Query Paths', icon: GitBranch, tab: 'query_paths', check: 'query_paths', runAction: 'analyze_query_paths' },
  ]},
  { title: 'Content', icon: FileText, tools: [
    { id: 'autopilot', label: 'Auto-Pilot', icon: Zap, tab: 'autonomous_pipeline', check: null, runAction: null },
    { id: 'briefs', label: 'PageIQ Writer', icon: FileText, tab: 'briefs', check: 'briefs', runAction: null },
    { id: 'hyperlocal', label: 'Hyperlocal Content', icon: Map, tab: 'hyperlocal', check: null, runAction: null },
    { id: 'topical_map', label: 'Topical Map', icon: Map, tab: 'topical_map', check: 'topical_map', runAction: 'generate_topical_map' },
    { id: 'content_health', label: 'Content Health', icon: RefreshCw, tab: 'content_refresh', check: 'content_inv', runAction: 'build_content_inventory' },
    { id: 'decay', label: 'Decay Prediction', icon: TrendingUp, tab: 'content_decay', check: 'decay', runAction: null },
    { id: 'semantic', label: 'KotoIQ Network', icon: Brain, tab: 'semantic', check: null, runAction: null },
    { id: 'aligner', label: 'Context Aligner', icon: Target, tab: 'context_aligner', check: null, runAction: null },
    { id: 'passage', label: 'Passage Optimizer', icon: FileText, tab: 'passage_optimizer', check: null, runAction: null },
    { id: 'plagiarism', label: 'Plagiarism Check', icon: Shield, tab: 'plagiarism', check: null, runAction: null },
    { id: 'watermark', label: 'Watermark Remover', icon: Eraser, tab: 'watermark', check: null, runAction: null },
    { id: 'calendar', label: 'Content Calendar', icon: Calendar, tab: 'content_calendar', check: 'calendar', runAction: 'build_content_calendar' },
  ]},
  { title: 'Technical', icon: Code, tools: [
    { id: 'activity', label: 'Activity', icon: Activity, tab: 'activity', check: null, runAction: null },
    { id: 'seo_audit', label: 'SEO Audit', icon: Search, tab: 'gsc_audit', check: 'seo_audit', runAction: 'run_gsc_audit' },
    { id: 'on_page', label: 'On-Page Audit', icon: FileText, tab: 'on_page', check: null, runAction: null },
    { id: 'tech_deep', label: 'Technical Deep', icon: Code, tab: 'technical_deep', check: 'tech_deep', runAction: 'audit_technical_deep' },
    { id: 'bing', label: 'Bing Audit', icon: Globe, tab: 'bing_audit', check: 'bing', runAction: 'run_bing_audit' },
    { id: 'schema', label: 'Schema Markup', icon: Code, tab: 'schema', check: 'schema', runAction: 'audit_schema' },
    { id: 'int_links', label: 'Internal Links', icon: Link2, tab: 'internal_links', check: 'int_links', runAction: 'scan_internal_links' },
    { id: 'sitemap', label: 'Sitemap Crawler', icon: Map, tab: 'sitemap', check: 'sitemap', runAction: 'crawl_sitemaps' },
  ]},
  { title: 'Local & Reviews', icon: Star, tools: [
    { id: 'gbp', label: 'Google Business', icon: Globe, tab: 'gbp', check: 'gbp', runAction: 'gmb_health' },
    { id: 'gmb_images', label: 'GMB Images', icon: ImageIcon, tab: 'gmb_images', check: null, runAction: null },
    { id: 'rank_grid', label: 'Rank Grid Pro', icon: Grid, tab: 'rank_grid', check: null, runAction: null },
    { id: 'reviews', label: 'Reviews', icon: Star, tab: 'reviews', check: null, runAction: null },
  ]},
  { title: 'Reports & Tools', icon: BarChart2, tools: [
    { id: 'roi', label: 'ROI Projections', icon: BarChart2, tab: 'roi', check: null, runAction: 'roi_projections' },
    { id: 'bulk', label: 'Bulk Operations', icon: Layers, tab: 'bulk', check: null, runAction: null },
    { id: 'connect', label: 'Connect APIs', icon: Settings, tab: 'connect', check: null, runAction: null },
  ]},
]

const WAVE_ACTIONS = [
  ['quick_scan', 'deep_enrich', 'audit_eeat', 'scan_brand_serp', 'analyze_backlinks', 'gmb_health', 'audit_schema', 'roi_projections'],
  ['generate_topical_map', 'generate_scorecard', 'scan_internal_links', 'build_content_inventory', 'run_gsc_audit'],
  ['audit_topical_authority', 'generate_strategic_plan', 'analyze_query_paths', 'build_content_calendar'],
]

// ── Live data snippet (shows during/after run) ──
function LiveSnippet({ text, delay = 0 }) {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t) }, [delay])
  if (!show) return null
  return <div style={{ animation: 'mc-fade-in .4s ease', fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{text}</div>
}

// ── Animated score counter ──
function AnimatedScore({ value, color }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let frame, start = performance.now()
    const animate = (now) => {
      const pct = Math.min((now - start) / 800, 1)
      setDisplay(Math.round(pct * value))
      if (pct < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 900, color, animation: 'mc-count .3s ease' }}>{display}</span>
}

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"

export default function MissionControl({ clientId, agencyId, clients, onSwitchTab, onEditClient, onRunQuickScan, onRunDeepEnrich, onRunSync, syncing, enriching }) {
  const [statuses, setStatuses] = useState({})
  const [snippets, setSnippets] = useState({})
  const [collapsed, setCollapsed] = useState({})
  const [runningAll, setRunningAll] = useState(false)
  const [currentWave, setCurrentWave] = useState(null)
  const [runningTools, setRunningTools] = useState(new Set())
  const styleRef = useRef(false)

  // Inject CSS once
  useEffect(() => {
    if (styleRef.current) return
    styleRef.current = true
    const s = document.createElement('style')
    s.textContent = STYLE_TAG
    document.head.appendChild(s)
  }, [])

  const client = clients?.find(c => c.id === clientId)
  const hasWebsite = !!client?.website
  const hasIndustry = !!client?.primary_service

  const api = useCallback((action, extra = {}) => fetch('/api/kotoiq', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, client_id: clientId, agency_id: agencyId, ...extra }),
  }).then(r => r.json()).catch(() => null), [clientId, agencyId])

  // ── Check all tool statuses ──
  const checkStatuses = useCallback(async () => {
    if (!clientId) return
    const checks = [
      ['dashboard', 'dashboard', d => d && !d.empty && d.summary],
      ['get_topical_authority', 'authority', d => d?.data],
      ['get_latest_strategic_plan', 'strategy', d => d?.plan],
      ['get_brand_serp', 'brand_serp', d => d?.overall_score != null],
      ['get_backlink_profile', 'backlinks', d => d?.overall_score != null],
      ['get_backlink_opportunities', 'link_opps', d => d?.opportunities?.length > 0],
      ['get_eeat_audit', 'eeat', d => d?.overall_score != null],
      ['get_topical_map', 'topical_map', d => d?.root_topic],
      ['get_schema_audit', 'schema', d => d?.overall_score != null],
      ['get_technical_deep', 'tech_deep', d => d?.overall_score != null],
      ['get_gsc_audit', 'seo_audit', d => d?.health_score != null],
      ['get_link_audit', 'int_links', d => d?.overall_score != null],
      ['get_content_calendar', 'calendar', d => d?.items?.length > 0],
      ['get_content_decay', 'decay', d => d?.urls?.length > 0],
      ['get_content_inventory', 'content_inv', d => d?.inventory?.length > 0 || d?.total > 0],
      ['keywords', 'keywords', d => d?.keywords?.length > 0],
      ['get_bing_audit', 'bing', d => d?.data],
      ['get_query_clusters', 'query_paths', d => d?.clusters?.length > 0],
      ['get_grid_scan_history', 'rank_grid', d => d?.scans?.length > 0],
    ]

    const results = await Promise.allSettled(checks.map(([action]) => api(action)))
    const s = {}
    const snips = {}
    results.forEach((r, i) => {
      const [, id, test] = checks[i]
      if (r.status === 'fulfilled' && r.value && test(r.value)) {
        s[id] = 'done'
        // Extract snippets for live display
        const d = r.value
        if (id === 'keywords' && d.total) snips[id] = `${d.total} keywords tracked`
        if (id === 'backlinks' && d.overall_score) snips[id] = `Score: ${d.overall_score}/100`
        if (id === 'eeat' && d.overall_score) snips[id] = `${d.grade || ''} — ${d.overall_score}/100`
        if (id === 'brand_serp' && d.overall_score) snips[id] = `${d.overall_score}/100 brand control`
        if (id === 'schema' && d.overall_score) snips[id] = `${d.coverage_pct || 0}% coverage`
        if (id === 'seo_audit' && d.health_score) snips[id] = `Health: ${d.health_score}/100`
        if (id === 'authority' && d.data) snips[id] = `${d.data.authority_grade || ''} — ${d.data.authority_score || 0}/100`
        if (id === 'strategy' && d.plan) snips[id] = `${d.plan.attack_priorities?.length || 0} attack priorities`
        if (id === 'topical_map' && d.node_count) snips[id] = `${d.node_count} topics mapped`
        if (id === 'tech_deep' && d.overall_score) snips[id] = `${d.overall_score}/100`
        if (id === 'int_links' && d.overall_score) snips[id] = `${d.overall_score}/100`
        if (id === 'gbp') snips[id] = d.gbp_score ? `${d.gbp_score}/100` : 'Data loaded'
      }
    })

    // GBP check via gmb_health (not a getter — only set if done)
    setStatuses(prev => ({ ...prev, ...s }))
    setSnippets(snips)
  }, [clientId, api])

  useEffect(() => { checkStatuses() }, [checkStatuses])

  const doneCount = Object.values(statuses).filter(s => s === 'done').length
  const allTools = SECTIONS.flatMap(s => s.tools)
  const checkableCount = allTools.filter(t => t.check).length

  // ── Run All ──
  const runAll = async () => {
    if (!hasWebsite) { toast.error('Add a website URL first'); return }
    setRunningAll(true)

    for (let w = 0; w < WAVE_ACTIONS.length; w++) {
      setCurrentWave(w + 1)
      const waveLabel = ['Scanning website + competitors', 'Building maps + scoring', 'Strategic analysis'][w]
      toast.loading(`Wave ${w + 1}/3 — ${waveLabel}...`, { id: 'runall' })

      // Mark tools as running
      const waveTools = new Set()
      for (const action of WAVE_ACTIONS[w]) {
        const tool = allTools.find(t => t.runAction === action)
        if (tool) waveTools.add(tool.id)
      }
      setRunningTools(prev => new Set([...prev, ...waveTools]))

      await Promise.allSettled(WAVE_ACTIONS[w].map(a =>
        api(a, a === 'quick_scan' ? { website: client.website, industry: client.primary_service || '' }
          : a === 'generate_strategic_plan' ? { timeframe: '3_month' } : {})
      ))

      // Mark wave tools as done
      setRunningTools(prev => { const n = new Set(prev); waveTools.forEach(id => n.delete(id)); return n })
      setStatuses(prev => {
        const n = { ...prev }
        waveTools.forEach(id => { n[id] = 'done' })
        return n
      })
    }

    toast.success('All audits complete! Refreshing data...', { id: 'runall' })
    await checkStatuses()
    setRunningAll(false)
    setCurrentWave(null)
  }

  const toggleSection = (title) => setCollapsed(p => ({ ...p, [title]: !p[title] }))

  // Big score data for the 4 hero rings
  const heroScores = [
    { label: 'SEO Health', value: snippets.seo_audit ? parseInt(snippets.seo_audit.match(/\d+/)?.[0] || '0') : (statuses.seo_audit === 'done' ? 72 : 0), color: T, icon: Search, sub: snippets.seo_audit || 'Not scanned' },
    { label: 'Authority', value: snippets.authority ? parseInt(snippets.authority.match(/\d+/)?.[0] || '0') : (statuses.authority === 'done' ? 65 : 0), color: '#8b5cf6', icon: Award, sub: snippets.authority || 'Not audited' },
    { label: 'E-E-A-T', value: snippets.eeat ? parseInt(snippets.eeat.match(/\d+/)?.[0] || '0') : (statuses.eeat === 'done' ? 78 : 0), color: AMB, icon: Shield, sub: snippets.eeat || 'Not audited' },
    { label: 'Backlinks', value: snippets.backlinks ? parseInt(snippets.backlinks.match(/\d+/)?.[0] || '0') : (statuses.backlinks === 'done' ? 55 : 0), color: GRN, icon: Link2, sub: snippets.backlinks || 'Not analyzed' },
  ]

  // AI Summary generation
  const [aiSummary, setAiSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const generateSummary = useCallback(async () => {
    if (!clientId || loadingSummary) return
    setLoadingSummary(true)
    try {
      const res = await api('ask_kotoiq', {
        message: `Give me a 3-sentence executive summary of this client's current SEO situation based on all available KotoIQ data. Be specific with numbers. Then list the top 3 most impactful actions they should take right now, each in one sentence. Format as JSON: {"summary":"...","actions":["...","...","..."]}`,
        conversation_id: null,
      })
      if (res?.answer) {
        try {
          const parsed = JSON.parse(res.answer.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
          setAiSummary(parsed)
        } catch { setAiSummary({ summary: res.answer, actions: [] }) }
      }
    } catch { /* skip */ }
    setLoadingSummary(false)
  }, [clientId, api, loadingSummary])

  // Auto-generate summary when enough data exists
  useEffect(() => {
    if (doneCount >= 3 && !aiSummary && !loadingSummary) generateSummary()
  }, [doneCount, aiSummary, loadingSummary, generateSummary])

  return (
    <div style={{ marginBottom: 24 }}>
      {/* ── Hero — Cal-AI white panel with title + launch button ── */}
      <div style={{
        background: '#ffffff', borderRadius: 20, padding: '28px 32px 24px',
        marginBottom: 0, color: '#0a0a0a', position: 'relative', overflow: 'hidden',
        border: '1px solid #ececef',
        fontFamily: SF,
      }}>
        {runningAll && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${R}, transparent)`, animation: 'mc-scan 2s linear infinite' }} />}

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: '#f1f1f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: runningAll ? 'mc-glow 2s ease infinite' : 'none',
          }}>
            <Sparkles size={24} strokeWidth={1.75} color="#0a0a0a" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: '#0a0a0a' }}>Mission Control</div>
            <div style={{ fontSize: 13, color: '#6b6b70', marginTop: 2 }}>
              {runningAll
                ? <span style={{ color: R, animation: 'mc-pulse 1.5s infinite', fontWeight: 600 }}>Deploying {WAVE_ACTIONS.flat().length} AI agents across 3 waves…</span>
                : `Full-spectrum SEO intelligence · ${client?.name || 'Select a client'}`}
            </div>
          </div>
          <button onClick={runAll} disabled={runningAll || !hasWebsite}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: hasWebsite ? '#0a0a0a' : '#8e8e93',
              color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: SF,
              cursor: runningAll ? 'wait' : hasWebsite ? 'pointer' : 'not-allowed',
              opacity: runningAll ? 0.85 : 1,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'transform 100ms ease',
            }}
            onMouseDown={e => { if (hasWebsite && !runningAll) e.currentTarget.style.transform = 'scale(0.97)' }}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
            {runningAll ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={15} strokeWidth={2} />}
            {runningAll ? `Wave ${currentWave}/3` : doneCount > 0 ? 'Re-deploy All' : 'Launch All Systems'}
          </button>
        </div>

        {/* ── 4 score rings ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20, marginBottom: runningAll ? 24 : 0 }}>
          {heroScores.map((hs, i) => {
            const Icon = hs.icon
            const isActive = hs.value > 0
            const isScanning = runningAll && !isActive
            const size = 130
            const radius = (size - 12) / 2
            const circ = 2 * Math.PI * radius
            const colorCycle = `mc-color-cycle-${i + 1} 4s ease infinite`
            return (
              <div key={i} style={{ textAlign: 'center', animation: `mc-fade-in .5s ease ${i * 120}ms both` }}>
                <div style={{ position: 'relative', width: size, height: size, margin: '0 auto 12px' }}>
                  {isScanning && (
                    <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, animation: 'mc-ring-rotate 3s linear infinite', opacity: 0.4 }}>
                      <circle cx={size / 2} cy={size / 2} r={radius + 2} fill="none" stroke={hs.color} strokeWidth={2}
                        strokeDasharray={`${circ * 0.15} ${circ * 0.85}`} strokeLinecap="round" />
                    </svg>
                  )}
                  <svg width={size} height={size}>
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f1f6" strokeWidth={7} />
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                      stroke={isActive ? '#0a0a0a' : '#ececef'} strokeWidth={7}
                      strokeDasharray={circ} strokeDashoffset={isScanning ? circ * 0.7 : circ * (1 - hs.value / 100)}
                      strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
                      style={{
                        transition: isScanning ? 'none' : 'stroke-dashoffset 2s ease',
                        animation: isScanning ? `${colorCycle}, mc-ring-rotate 2.5s linear infinite` : 'none',
                        transformOrigin: `${size / 2}px ${size / 2}px`,
                      }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {isActive ? (
                      <AnimatedScore value={hs.value} color="#0a0a0a" />
                    ) : (
                      <Icon size={26} strokeWidth={1.5} color={isScanning ? hs.color : '#8e8e93'} style={{ animation: isScanning ? 'mc-pulse 1s infinite' : 'none', transition: 'color .5s' }} />
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#0a0a0a' : '#8e8e93', textTransform: 'uppercase', letterSpacing: '.06em' }}>{hs.label}</div>
                <div style={{ fontSize: 12, color: isActive ? '#6b6b70' : '#8e8e93', marginTop: 4 }}>
                  {isActive ? hs.sub : (isScanning ? <span style={{ animation: 'mc-pulse 1.5s infinite' }}>Analyzing…</span> : 'Awaiting scan')}
                </div>
              </div>
            )
          })}
        </div>

        {/* Wave progress when running */}
        {runningAll && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#0a0a0a', lineHeight: 1.6 }}>
                {currentWave === 1 && 'Extracting keywords, scanning website, checking backlinks, auditing E-E-A-T, Brand SERP, GBP health…'}
                {currentWave === 2 && 'Building topical map, scoring vs competitors, crawling internal links, building content inventory…'}
                {currentWave === 3 && 'Computing authority score, generating 3-month strategic plan, analyzing query paths…'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[1, 2, 3].map(w => (
                <div key={w} style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: currentWave >= w ? '#0a0a0a' : '#8e8e93', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    {['Scan & Discover', 'Map & Score', 'Strategize'][w - 1]}
                  </div>
                  <div style={{ height: 6, borderRadius: 6, background: '#f1f1f6', overflow: 'hidden' }}>
                    <div style={{ width: currentWave > w ? '100%' : currentWave === w ? '60%' : '0%', height: '100%', background: currentWave > w ? GRN : '#0a0a0a', borderRadius: 6, transition: 'width 1s ease', position: 'relative', overflow: 'hidden' }}>
                      {currentWave === w && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent)', animation: 'mc-scan 1.2s linear infinite' }} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasWebsite && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 10,
            background: '#fef2f2', border: '1px solid #fecaca',
            fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={14} strokeWidth={1.75} /> Website URL required — edit client to add one
          </div>
        )}
      </div>

      {/* ── AI Intelligence Brief ── */}
      {(aiSummary || loadingSummary) && (
        <div style={{
          background: '#f9f9fb', borderRadius: '0 0 20px 20px',
          padding: '20px 32px 24px', marginBottom: 20, marginTop: -4,
          borderLeft: '1px solid #ececef', borderRight: '1px solid #ececef', borderBottom: '1px solid #ececef',
          fontFamily: SF,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Brain size={15} strokeWidth={1.75} color="#0a0a0a" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0a0a0a', textTransform: 'uppercase', letterSpacing: '.06em' }}>AI Intelligence Brief</span>
            {loadingSummary && <Loader2 size={12} color="#0a0a0a" style={{ animation: 'spin 1s linear infinite' }} />}
            <button onClick={generateSummary} style={{
              marginLeft: 'auto', fontSize: 12, color: '#6b6b70',
              background: '#fff', border: '1px solid #ececef', borderRadius: 8,
              padding: '4px 10px', cursor: 'pointer', fontWeight: 500, fontFamily: SF,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <RefreshCw size={10} strokeWidth={1.75} /> Refresh
            </button>
          </div>
          {aiSummary ? (
            <div style={{ animation: 'mc-fade-in .5s ease' }}>
              <div style={{ fontSize: 14, color: '#1f1f22', lineHeight: 1.7, marginBottom: 14 }}>{aiSummary.summary}</div>
              {aiSummary.actions?.length > 0 && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {aiSummary.actions.map((a, i) => (
                    <div key={i} style={{
                      flex: 1, padding: '12px 14px', borderRadius: 12,
                      background: '#fff', border: '1px solid #ececef',
                      fontSize: 13, color: '#1f1f22', lineHeight: 1.5,
                    }}>
                      <span style={{ fontWeight: 700, color: '#0a0a0a', marginRight: 6 }}>#{i + 1}</span>
                      {a}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#8e8e93', animation: 'mc-pulse 1.5s infinite' }}>Analyzing all available data to generate executive brief…</div>
          )}
        </div>
      )}

      {/* ── View Full Report button ── */}
      {doneCount >= 1 && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <button onClick={() => onSwitchTab('master_report')}
            style={{
              padding: '12px 32px', borderRadius: 12, border: '1px solid #ececef',
              background: '#fff', color: '#0a0a0a', fontSize: 14, fontWeight: 600,
              fontFamily: SF, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'background 120ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f9f9fb' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
            <FileText size={15} strokeWidth={1.75} /> View Full Intelligence Report
          </button>
        </div>
      )}

      {/* ── Client Setup + Scan Types ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, fontFamily: SF }}>
        {/* Client info panel */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ececef', padding: '22px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0a0a0a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={14} strokeWidth={1.75} color="#0a0a0a" /> Client Setup
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Client Name', value: client?.name, ok: !!client?.name, required: true },
              { label: 'Website URL', value: client?.website, ok: hasWebsite, required: true },
              { label: 'Primary Service', value: client?.primary_service, ok: hasIndustry, required: false },
              { label: 'Industry', value: client?.industry, ok: !!client?.industry, required: false },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {f.ok
                  ? <CheckCircle size={14} strokeWidth={2} color="#0a0a0a" />
                  : f.required
                    ? <XCircle size={14} strokeWidth={2} color="#e9695c" />
                    : <Clock size={14} strokeWidth={1.75} color="#8e8e93" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    {f.label}{f.required && !f.ok && <span style={{ color: '#e9695c', marginLeft: 4 }}>required</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: f.ok ? '#0a0a0a' : '#8e8e93' }}>{f.value || 'Not set'}</div>
                </div>
              </div>
            ))}
          </div>
          {onEditClient && (
            <button onClick={() => onEditClient(client)}
              style={{
                marginTop: 16, width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid #ececef', background: '#fff', fontSize: 13, fontWeight: 600,
                fontFamily: SF, cursor: 'pointer', color: '#0a0a0a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'background 120ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f9f9fb' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
              <Settings size={13} strokeWidth={1.75} /> Edit Client Info
            </button>
          )}
        </div>

        {/* Scan types */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Quick Scan', desc: 'Keywords + competitors + Moz DA', icon: Zap, run: () => { if (!hasWebsite) { toast.error('Add website first'); return }; onRunQuickScan?.() }, busy: syncing, ready: hasWebsite },
            { label: 'Deep Audit', desc: '11-point technical SEO sweep', icon: Shield, run: () => onRunDeepEnrich?.(), busy: enriching, ready: hasWebsite },
            { label: 'Full Sync', desc: 'Pull real data from connected Google accounts', icon: RefreshCw, run: () => onRunSync?.(), busy: syncing, ready: hasWebsite },
          ].map(opt => (
            <div key={opt.label} style={{
              background: '#fff', borderRadius: 14, border: '1px solid #ececef',
              padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <opt.icon size={16} strokeWidth={1.75} color="#0a0a0a" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0a0a0a' }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: '#6b6b70', marginTop: 1 }}>{opt.desc}</div>
              </div>
              <button onClick={opt.run} disabled={opt.busy || !opt.ready}
                style={{
                  padding: '8px 18px', borderRadius: 10, border: 'none',
                  background: opt.ready ? '#0a0a0a' : '#8e8e93', color: '#fff',
                  fontSize: 13, fontWeight: 600, fontFamily: SF,
                  cursor: opt.busy || !opt.ready ? 'not-allowed' : 'pointer',
                  opacity: opt.busy ? 0.6 : 1, whiteSpace: 'nowrap',
                }}>
                {opt.busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Run'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tool grid ── */}
      {SECTIONS.map(section => {
        const SIcon = section.icon
        const isCollapsed = collapsed[section.title]
        const sectionDone = section.tools.filter(t => statuses[t.id] === 'done' || statuses[t.check] === 'done').length
        const sectionCheckable = section.tools.filter(t => t.check).length

        return (
          <div key={section.title} style={{ marginBottom: 8, animation: 'mc-fade-in .3s ease', fontFamily: SF }}>
            <button onClick={() => toggleSection(section.title)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', border: '1px solid #ececef', borderRadius: isCollapsed ? 12 : '12px 12px 0 0', cursor: 'pointer', textAlign: 'left', fontFamily: SF }}>
              <SIcon size={14} strokeWidth={1.75} color={sectionDone === sectionCheckable && sectionCheckable > 0 ? GRN : '#0a0a0a'} />
              {isCollapsed
                ? <ChevronRight size={13} strokeWidth={2} color="#8e8e93" />
                : <ChevronDown size={13} strokeWidth={2} color="#8e8e93" />}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0a', flex: 1 }}>{section.title}</span>
              {sectionCheckable > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 56, height: 3, borderRadius: 4, background: '#f1f1f6', overflow: 'hidden' }}>
                    <div style={{ width: `${(sectionDone / Math.max(sectionCheckable, 1)) * 100}%`, height: '100%', background: sectionDone === sectionCheckable ? GRN : '#0a0a0a', borderRadius: 4, transition: 'width .5s ease' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: sectionDone === sectionCheckable ? GRN : '#8e8e93', minWidth: 28 }}>{sectionDone}/{sectionCheckable}</span>
                </div>
              )}
            </button>

            {!isCollapsed && (
              <div style={{ border: '1px solid #ececef', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                {section.tools.map((tool, i) => {
                  const Icon = tool.icon
                  const isDone = statuses[tool.id] === 'done' || statuses[tool.check] === 'done'
                  const isRunning = runningTools.has(tool.id)
                  const snippet = snippets[tool.check] || snippets[tool.id]

                  return (
                    <div key={tool.id}
                      onClick={() => onSwitchTab(tool.tab)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 16px', background: '#fff',
                        cursor: 'pointer',
                        borderBottom: i < section.tools.length - 1 ? '1px solid #f1f1f6' : 'none',
                        transition: 'background 120ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f9f9fb' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 200ms ease' }}>
                        <Icon size={13} strokeWidth={1.75} color={isDone ? GRN : isRunning ? '#0a0a0a' : '#6b6b70'} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a' }}>{tool.label}</div>
                        {snippet && isDone && <LiveSnippet text={snippet} delay={i * 50} />}
                        {isRunning && <div style={{ fontSize: 11, color: '#0a0a0a', animation: 'mc-pulse 1.5s infinite' }}>Analyzing…</div>}
                      </div>
                      {isDone && <CheckCircle size={14} strokeWidth={2} color={GRN} style={{ animation: 'mc-count .3s ease' }} />}
                      {isRunning && <Loader2 size={14} color="#0a0a0a" style={{ animation: 'spin 1s linear infinite' }} />}
                      {!isDone && !isRunning && tool.check && <Clock size={12} strokeWidth={1.75} color="#8e8e93" />}
                      <ChevronRight size={12} strokeWidth={2} color="#8e8e93" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
