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
  return <span style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color, animation: 'mc-count .3s ease' }}>{display}</span>
}

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

  return (
    <div style={{ marginBottom: 24 }}>
      {/* ── Hero ── */}
      <div style={{ background: `linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)`, borderRadius: 20, padding: '28px 32px', marginBottom: 20, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        {/* Animated scan line when running */}
        {runningAll && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${R}, transparent)`, animation: 'mc-scan 2s linear infinite' }} />}

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: R + '25', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: runningAll ? 'mc-glow 2s ease infinite' : 'none' }}>
            <Sparkles size={28} color={R} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em' }}>Koto Mission Control</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              {runningAll
                ? <span style={{ color: R, animation: 'mc-pulse 1.5s infinite' }}>Deploying {WAVE_ACTIONS.flat().length} AI agents across 3 waves...</span>
                : `Full-spectrum SEO intelligence — ${doneCount} of ${checkableCount} systems online`}
            </div>
          </div>

          {/* Live progress ring */}
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <svg width={64} height={64}>
              <circle cx={32} cy={32} r={27} fill="none" stroke="#1e293b" strokeWidth={5} />
              <circle cx={32} cy={32} r={27} fill="none" stroke={doneCount === checkableCount ? GRN : R} strokeWidth={5}
                strokeDasharray={2 * Math.PI * 27} strokeDashoffset={2 * Math.PI * 27 * (1 - doneCount / Math.max(checkableCount, 1))}
                strokeLinecap="round" transform="rotate(-90 32 32)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AnimatedScore value={Math.round(doneCount / Math.max(checkableCount, 1) * 100)} color={doneCount === checkableCount ? GRN : '#fff'} />
            </div>
          </div>

          <button onClick={runAll} disabled={runningAll || !hasWebsite}
            style={{ padding: '14px 32px', borderRadius: 12, border: 'none', background: hasWebsite ? `linear-gradient(135deg, ${R}, #be185d)` : '#374151', color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: FH, cursor: runningAll ? 'wait' : hasWebsite ? 'pointer' : 'not-allowed', opacity: runningAll ? 0.8 : 1, display: 'flex', alignItems: 'center', gap: 8, transition: 'transform .1s', boxShadow: hasWebsite ? `0 4px 20px ${R}40` : 'none' }}
            onMouseDown={e => { if (hasWebsite && !runningAll) e.currentTarget.style.transform = 'scale(0.97)' }}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
            {runningAll ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={18} />}
            {runningAll ? `Wave ${currentWave}/3` : doneCount > 0 ? 'Re-deploy All' : 'Launch All Systems'}
          </button>
        </div>

        {/* Requirements */}
        {!hasWebsite && (
          <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: '#7f1d1d40', fontSize: 12, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} /> Website URL required — edit your client to add one
          </div>
        )}

        {/* Wave progress indicator */}
        {runningAll && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[1, 2, 3].map(w => (
                <div key={w} style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: currentWave >= w ? '#94a3b8' : '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    {['Scan & Discover', 'Map & Score', 'Strategize'][w - 1]}
                  </div>
                  <div style={{ height: 6, borderRadius: 6, background: '#1e293b', overflow: 'hidden' }}>
                    <div style={{ width: currentWave > w ? '100%' : currentWave === w ? '60%' : '0%', height: '100%', background: currentWave > w ? GRN : `linear-gradient(90deg, ${R}, #be185d)`, borderRadius: 6, transition: 'width 1s ease', position: 'relative', overflow: 'hidden' }}>
                      {currentWave === w && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent, rgba(255,255,255,.3), transparent)`, animation: 'mc-scan 1.5s linear infinite' }} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Live agent ticker */}
            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={10} style={{ animation: 'spin 1s linear infinite', color: R }} />
              {currentWave === 1 && 'Extracting keywords, scanning website, checking backlinks, auditing E-E-A-T...'}
              {currentWave === 2 && 'Building topical map, scoring competitors, crawling internal links...'}
              {currentWave === 3 && 'Generating strategic plan, computing authority score, analyzing query paths...'}
            </div>
          </div>
        )}
      </div>

      {/* ── Client Setup + Scan Types ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Client info panel */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '22px 26px' }}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={15} color={T} /> Client Setup
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Client Name', value: client?.name, ok: !!client?.name, required: true },
              { label: 'Website URL', value: client?.website, ok: hasWebsite, required: true },
              { label: 'Primary Service', value: client?.primary_service, ok: hasIndustry, required: false },
              { label: 'Industry', value: client?.industry, ok: !!client?.industry, required: false },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {f.ok ? <CheckCircle size={14} color={GRN} /> : f.required ? <XCircle size={14} color={R} /> : <Clock size={14} color="#d1d5db" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>{f.label} {f.required && !f.ok && <span style={{ color: R }}>*required</span>}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: f.ok ? BLK : '#9ca3af' }}>{f.value || 'Not set'}</div>
                </div>
              </div>
            ))}
          </div>
          {onEditClient && (
            <button onClick={() => onEditClient(client)}
              style={{ marginTop: 14, width: '100%', padding: '10px', borderRadius: 8, border: `1px solid ${T}40`, background: '#fff', fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer', color: T, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Settings size={12} /> Edit Client Info
            </button>
          )}
        </div>

        {/* Scan types */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Quick Scan card */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: R + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={20} color={R} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>Quick Scan</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Keywords + competitors + Moz DA — needs <b style={{ color: hasWebsite ? GRN : R }}>website</b></div>
            </div>
            <button onClick={() => { if (!hasWebsite) { toast.error('Add website first'); return }; onRunQuickScan?.() }} disabled={syncing || !hasWebsite}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: R, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer', opacity: syncing || !hasWebsite ? 0.5 : 1, whiteSpace: 'nowrap' }}>
              {syncing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Run'}
            </button>
          </div>
          {/* Deep Audit card */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: AMB + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={20} color={AMB} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>Deep Audit</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>11-point technical SEO — needs <b style={{ color: hasWebsite ? GRN : R }}>website</b></div>
            </div>
            <button onClick={() => onRunDeepEnrich?.()} disabled={enriching || !hasWebsite}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: AMB, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer', opacity: enriching || !hasWebsite ? 0.5 : 1, whiteSpace: 'nowrap' }}>
              {enriching ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Run'}
            </button>
          </div>
          {/* Full Sync card */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: T + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <RefreshCw size={20} color={T} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>Full Sync</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Real Google data — needs <b style={{ color: hasWebsite ? GRN : R }}>website</b> + <b style={{ color: false ? GRN : AMB }}>Google OAuth</b></div>
            </div>
            <button onClick={() => onRunSync?.()} disabled={syncing || !hasWebsite}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: T, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: FH, cursor: 'pointer', opacity: syncing || !hasWebsite ? 0.5 : 1, whiteSpace: 'nowrap' }}>
              {syncing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Run'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tool grid ── */}
      {SECTIONS.map(section => {
        const SIcon = section.icon
        const isCollapsed = collapsed[section.title]
        const sectionDone = section.tools.filter(t => statuses[t.id] === 'done' || statuses[t.check] === 'done').length
        const sectionCheckable = section.tools.filter(t => t.check).length

        return (
          <div key={section.title} style={{ marginBottom: 6, animation: 'mc-fade-in .3s ease' }}>
            <button onClick={() => toggleSection(section.title)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: isCollapsed ? 12 : '12px 12px 0 0', cursor: 'pointer', textAlign: 'left' }}>
              <SIcon size={15} color={sectionDone === sectionCheckable && sectionCheckable > 0 ? GRN : T} />
              {isCollapsed ? <ChevronRight size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
              <span style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK, flex: 1 }}>{section.title}</span>
              {sectionCheckable > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 60, height: 4, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
                    <div style={{ width: `${(sectionDone / Math.max(sectionCheckable, 1)) * 100}%`, height: '100%', background: sectionDone === sectionCheckable ? GRN : T, borderRadius: 4, transition: 'width .5s ease' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sectionDone === sectionCheckable ? GRN : '#6b7280', minWidth: 28 }}>{sectionDone}/{sectionCheckable}</span>
                </div>
              )}
            </button>

            {!isCollapsed && (
              <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                {section.tools.map((tool, i) => {
                  const Icon = tool.icon
                  const isDone = statuses[tool.id] === 'done' || statuses[tool.check] === 'done'
                  const isRunning = runningTools.has(tool.id)
                  const snippet = snippets[tool.check] || snippets[tool.id]

                  return (
                    <div key={tool.id}
                      onClick={() => onSwitchTab(tool.tab)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', background: i % 2 === 0 ? '#fff' : '#fafbfc', cursor: 'pointer', borderBottom: i < section.tools.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'all .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = T + '08'; e.currentTarget.style.paddingLeft = '22px' }}
                      onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafbfc'; e.currentTarget.style.paddingLeft = '18px' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: isDone ? GRN + '12' : isRunning ? T + '12' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .3s' }}>
                        <Icon size={14} color={isDone ? GRN : isRunning ? T : '#9ca3af'} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{tool.label}</div>
                        {snippet && isDone && <LiveSnippet text={snippet} delay={i * 50} />}
                        {isRunning && <div style={{ fontSize: 11, color: T, animation: 'mc-pulse 1.5s infinite' }}>Analyzing...</div>}
                      </div>
                      {isDone && <CheckCircle size={15} color={GRN} style={{ animation: 'mc-count .3s ease' }} />}
                      {isRunning && <Loader2 size={15} color={T} style={{ animation: 'spin 1s linear infinite' }} />}
                      {!isDone && !isRunning && tool.check && <Clock size={13} color="#d1d5db" />}
                      <ChevronRight size={12} color="#d1d5db" />
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
