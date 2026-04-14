"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, ChevronRight, Target, Star, TrendingUp,
  Inbox, Brain, ArrowUpRight, Zap, Users,
  Clock, AlertCircle, Loader2, BarChart2, FileSignature, X,
  Globe, Shield, Phone, Sparkles, Activity, HardDrive,
  DollarSign, Check, CheckCircle, RefreshCw, FileText, CheckSquare, Palette, Edit3, Send
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ViewAsModal from '../components/ViewAsModal'
import { supabase } from '../lib/supabase'
import { useAuth, getGreeting } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import {
  MobilePage, MobilePageHeader, MobileStatStrip, MobileTabs,
  MobileRow, MobileSectionHeader, MobileCard, MobileEmpty,
  MobileButton
} from '../components/mobile/MobilePage'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function firstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function todayISO() {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

function last24h() {
  return new Date(Date.now() - 86400000).toISOString()
}

const LOG_LEVEL_COLOR = { error: R, warn: AMB, info: T, debug: '#6b7280', success: GRN }

/* ── Skeleton bar for loading states ────────────────────────────────────────── */
function SkeletonBar({ w = '100%', h = 14, r = 6, mb = 0 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, marginBottom: mb,
      background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
    }} />
  )
}

function SkeletonCard({ children, style }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
      padding: '18px', ...style,
    }}>
      {children}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  )
}

/* ── Extracted sub-components (must be outside DashboardPage to avoid #310) ── */
function DashStatCard({ label, value, icon: Icon, accent = T, loading: isLoading }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, opacity: 0.7, borderRadius: '14px 14px 0 0' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLK, lineHeight: 1, letterSpacing: '-.03em' }}>
            {isLoading ? <SkeletonBar w={48} h={28} /> : value}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
        </div>
        {Icon && (<div style={{ width: 38, height: 38, borderRadius: 10, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={accent} /></div>)}
      </div>
    </div>
  )
}

function DashActionTile({ icon: Icon, label, to, bg, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '20px 12px', borderRadius: 14, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#fff', color: bg, fontFamily: FH, fontSize: 13, fontWeight: 700, transition: 'all .18s ease', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = bg; e.currentTarget.style.boxShadow = `0 4px 16px ${bg}15` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.04)' }}>
      <Icon size={22} />{label}
    </button>
  )
}

function DashLogRow({ log, showLevel = false }) {
  const dotColor = LOG_LEVEL_COLOR[log.level] || '#6b7280'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor, marginTop: 5 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {showLevel && (<span style={{ fontSize: 12, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: dotColor + '15', color: dotColor, textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 8 }}>{log.level}</span>)}
        <span style={{ fontSize: 13, color: BLK, fontFamily: FB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100%' }}>{log.message}</span>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{timeAgo(log.created_at)}</div>
      </div>
    </div>
  )
}

function DashStatusDot({ label, status }) {
  const color = status === 'green' ? GRN : status === 'amber' ? AMB : R
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}60` }} />
      <span style={{ fontSize: 13, fontFamily: FH, fontWeight: 600, color: BLK }}>{label}</span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, firstName, agencyId, agencyName, role, isOwner, agency, isSuperAdmin, isAgencyAdmin: isAgAdmin, can, isImpersonating, isClient, isPreviewingClient, clientId, clientInfo, impersonateAgency } = useAuth()
  const isMobile = useMobile()

  const showClientDashboard = isClient || isPreviewingClient
  // When impersonating an agency, show the agency dashboard — not super admin
  const showSuperDashboard = isSuperAdmin && !isImpersonating && !showClientDashboard
  const isAgencyAdmin = !showSuperDashboard && !showClientDashboard
  const [showViewAs, setShowViewAs] = useState(false)

  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [loading,        setLoading]        = useState(true)
  const [lastRefresh,    setLastRefresh]    = useState(new Date())

  /* ── Agency Admin state ───────────────────────────────────────────────────── */
  const [agencyStats,    setAgencyStats]    = useState({
    activeClients: 0, pagesGenerated: 0, reviewsCollected: 0,
    scoutLeads: 0, wpSites: 0, tasksDue: 0, openProposals: 0,
    deskTickets: 0, avgRating: 0,
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [spotlightClients, setSpotlightClients] = useState([])
  const [systemHealth,   setSystemHealth]   = useState({
    database: 'green', app: 'green', wordpress: 'green',
  })

  /* ── Super Admin state ────────────────────────────────────────────────────── */
  const [superStats,     setSuperStats]     = useState({
    totalAgencies: 0, totalUsers: 0, totalPages: 0, totalClients: 0,
    activeWpSites: 0, totalErrors24h: 0, uptime: '99.97%',
    voiceAgents: 0, totalCalls: 0,
  })
  const [recentErrors,   setRecentErrors]   = useState([])
  const [activityFeed,   setActivityFeed]   = useState([])
  const [agencyList,     setAgencyList]     = useState([])
  const [commsStats,     setCommsStats]     = useState({ emails24h: 0, sms24h: 0, failed24h: 0, total24h: 0 })
  const [qaHealth,       setQaHealth]       = useState({ health_score: 0, pass_rate: 0, open_errors: 0 })

  const greeting = getGreeting(firstName)

  /* ── Data loaders ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    loadData()
    const interval = setInterval(() => { loadData() }, 60000)
    return () => clearInterval(interval)
  }, [aid, isSuperAdmin])

  async function loadData() {
    setLoading(true)
    try {
      if (showSuperDashboard) {
        await loadSuperAdminData()
      } else if (showClientDashboard) {
        // Client dashboard data loaded elsewhere
      } else {
        await loadAgencyData()
      }
    } catch (e) {
      console.warn('Dashboard load error:', e)
    }
    setLastRefresh(new Date())
    setLoading(false)
  }

  /* ── Agency Admin loader ──────────────────────────────────────────────────── */
  async function loadAgencyData() {
    const monthStart = firstOfMonth()
    const today      = todayISO()

    const [
      { count: activeClients },
      { count: pagesGenerated },
      { count: reviewsCollected },
      scoutRes,
      { count: wpSites },
      { count: tasksDue },
      { count: openProposals },
      { count: deskTickets },
      ratingRes,
      { data: logs },
      { data: clients },
    ] = await Promise.all([
      // 1) Active Clients
      supabase.from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', aid).eq('status', 'active'),
      // 2) Pages Generated this month
      supabase.from('koto_wp_pages')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', aid).gte('created_at', monthStart),
      // 3) Reviews Collected this month
      supabase.from('moose_review_queue')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', aid).gte('created_at', monthStart),
      // 4) Scout Leads this month (sum result_count)
      supabase.from('scout_searches')
        .select('result_count')
        .eq('agency_id', aid).gte('created_at', monthStart),
      // 5) WP Sites connected
      supabase.from('koto_wp_sites')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', aid).eq('connected', true),
      // 6) Tasks Due Today
      supabase.from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', aid).eq('due_date', today),
      // 7) Open Proposals
      supabase.from('proposals')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', aid).eq('status', 'sent'),
      // 8) Desk Tickets open
      supabase.from('desk_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', aid).in('status', ['new', 'open']),
      // 9) Avg Rating
      supabase.from('moose_review_queue')
        .select('star_rating')
        .eq('agency_id', aid).not('star_rating', 'is', null),
      // 10) Recent Activity (activity_log scoped to agency's projects)
      supabase.from('activity_log')
        .select('id, action, detail, created_at')
        .order('created_at', { ascending: false }).limit(10),
      // 11) Spotlight Clients
      supabase.from('clients')
        .select('id, name, industry, status')
        .eq('agency_id', aid).eq('status', 'active')
        .order('updated_at', { ascending: false }).limit(3),
    ])

    // Sum scout leads
    const scoutLeads = (scoutRes.data || []).reduce((sum, r) => sum + (r.result_count || 0), 0)

    // Calculate average rating
    const ratings = (ratingRes.data || []).map(r => r.star_rating).filter(Boolean)
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : 0

    setAgencyStats({
      activeClients:    activeClients    || 0,
      pagesGenerated:   pagesGenerated   || 0,
      reviewsCollected: reviewsCollected || 0,
      scoutLeads,
      wpSites:          wpSites          || 0,
      tasksDue:         tasksDue         || 0,
      openProposals:    openProposals    || 0,
      deskTickets:      deskTickets      || 0,
      avgRating,
    })

    setRecentActivity(logs || [])

    // Enrich spotlight clients with page/review counts
    const enriched = await Promise.all((clients || []).map(async (cl) => {
      const [{ count: pgCount }, { count: rvCount }] = await Promise.all([
        supabase.from('koto_wp_pages')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', cl.id),
        supabase.from('moose_review_queue')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', cl.id),
      ])
      return { ...cl, pagesCount: pgCount || 0, reviewsCount: rvCount || 0 }
    }))
    setSpotlightClients(enriched)

    // System health — simple check: if last error is within 5 min, mark amber
    const { data: recentErr } = await supabase.from('koto_system_logs')
      .select('level, created_at')
      .eq('agency_id', aid).eq('level', 'error')
      .order('created_at', { ascending: false }).limit(1)

    const lastErr = recentErr?.[0]
    const errRecent = lastErr && (Date.now() - new Date(lastErr.created_at).getTime()) < 300000
    setSystemHealth({
      database:  errRecent ? 'amber' : 'green',
      app:       'green',
      wordpress: (wpSites || 0) > 0 ? 'green' : 'amber',
    })
  }

  /* ── Super Admin loader ───────────────────────────────────────────────────── */
  async function loadSuperAdminData() {
    const [
      adminStats,
      { data: errors },
      { data: feed },
      { data: agencies },
      commsStatsRes,
      qaHealthRes,
    ] = await Promise.all([
      fetch('/api/admin?action=dashboard_stats').then(r => r.json()).catch(() => ({})),
      supabase.from('koto_system_logs')
        .select('id, level, message, created_at')
        .eq('level', 'error')
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('koto_system_logs')
        .select('id, level, message, created_at')
        .order('created_at', { ascending: false }).limit(15),
      fetch('/api/admin?action=list_agencies').then(r => r.json()).catch(() => null),
      fetch('/api/qa?action=comms_stats').then(r => r.json()).catch(() => ({ emails24h: 0, sms24h: 0, failed24h: 0, total24h: 0 })),
      fetch('/api/qa?action=health_score').then(r => r.json()).catch(() => ({ health_score: 0, pass_rate: 0, open_errors: 0 })),
    ])

    setSuperStats({
      totalAgencies:  adminStats.agency_count  || 0,
      totalUsers:     0,
      totalPages:     adminStats.page_count    || 0,
      totalClients:   adminStats.client_count  || 0,
      activeWpSites:  adminStats.wp_site_count || 0,
      totalErrors24h: 0,
      uptime:         '99.97%',
      voiceAgents:    0,
      totalCalls:     adminStats.call_count    || 0,
    })
    setRecentErrors(errors || [])
    setActivityFeed(feed || [])
    setCommsStats(commsStatsRes || { emails24h: 0, sms24h: 0, failed24h: 0, total24h: 0 })
    setQaHealth(qaHealthRes || { health_score: 0, pass_rate: 0, open_errors: 0 })
    if (agencies && Array.isArray(agencies) && agencies.length > 0) {
      setAgencyList(agencies)
    } else {
      // Fallback: load directly from Supabase
      const { data: fallbackAgencies } = await supabase.from('agencies').select('id, name, brand_name, logo_url, status, slug, plan').order('name')
      if (fallbackAgencies) setAgencyList(fallbackAgencies)
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SHARED SUB-COMPONENTS
     ══════════════════════════════════════════════════════════════════════════ */

  /* ── Stat Card ────────────────────────────────────────────────────────────── */
  /* ── Refresh indicator (inline JSX, not a component) ── */
  const refreshBadge = (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
        color: '#9ca3af', fontFamily: FB,
      }}>
        <RefreshCw size={11} />
        Auto-refresh {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    )

  /* ══════════════════════════════════════════════════════════════════════════
     AGENCY ADMIN — QUICK ACTIONS
     ══════════════════════════════════════════════════════════════════════════ */
  // feat() check — same logic as sidebar: respect agency features when impersonating
  const feat = (key) => !key || (isSuperAdmin && !isImpersonating) || can?.(key) !== false

  const AGENCY_ACTIONS = [
    { icon: Sparkles,      label: 'Build Pages',     to: '/page-builder',  bg: R,         feat: 'page_builder' },
    { icon: Target,        label: 'Find Leads',      to: '/scout',         bg: T,         feat: 'scout' },
    { icon: Star,          label: 'Get Reviews',     to: '/reviews',       bg: GRN,       feat: 'reviews' },
    { icon: Phone,         label: 'Voice Agent',     to: '/voice',         bg: AMB,       feat: 'voice_agent' },
    { icon: FileSignature, label: 'Send Proposal',   to: '/proposals',     bg: '#7c3aed', feat: 'proposals' },
    { icon: Zap,           label: 'Run Automation',  to: '/automations',   bg: R,         feat: 'automations' },
    { icon: BarChart2,     label: 'View Reports',    to: '/seo',           bg: T,         feat: 'seo_hub' },
    { icon: Brain,         label: 'Ask CMO AI',      to: '/agent',         bg: BLK,       feat: 'cmo_agent' },
    { icon: Inbox,         label: 'KotoDesk',        to: '/desk',          bg: T,         feat: 'koto_desk' },
    { icon: FileSignature, label: 'KotoProof',       to: '/proof',         bg: '#7c3aed', feat: 'koto_proof' },
    { icon: Brain,         label: 'Discovery',       to: '/discovery',     bg: T,         feat: 'discovery' },
    { icon: Users,         label: 'View Clients',    to: '/clients',       bg: BLK,       feat: 'clients' },
  ].filter(a => feat(a.feat))

  const SUPER_ACTIONS = [
    { icon: Globe,  label: 'View Agencies',  to: '/platform-admin', bg: T },
    { icon: Users,  label: 'View As...',     action: ()=>setShowViewAs(true), bg: '#7f1d1d' },
    { icon: Shield, label: 'Debug Console',  to: '/debug',          bg: AMB },
    { icon: Activity, label: 'System Status', to: '/status',        bg: GRN },
    { icon: Users,  label: 'Manage Users',   to: '/master-admin',   bg: R },
    { icon: CheckCircle, label: 'QA Console', to: '/qa',            bg: '#7c3aed' },
  ]

  /* ══════════════════════════════════════════════════════════════════════════
     MOBILE — AGENCY ADMIN
     ══════════════════════════════════════════════════════════════════════════ */
  if (isMobile && isAgencyAdmin) {
    return (
      <MobilePage padded={false}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '16px 16px 0' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4, fontFamily: FH,
          }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <h1 style={{
            fontFamily: FH, fontSize: 22, fontWeight: 800, color: '#111',
            margin: '0 0 2px', letterSpacing: '-.03em',
          }}>
            {greeting}
          </h1>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            margin: '0 0 16px',
          }}>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, fontFamily: FB }}>
              {agencyStats.activeClients} clients &middot; {agencyStats.wpSites} WP sites
            </p>
            {refreshBadge}
          </div>
        </div>

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <MobileStatStrip stats={[
          { label: 'Clients',  value: loading ? '—' : agencyStats.activeClients,    color: '#111' },
          { label: 'Pages',    value: loading ? '—' : agencyStats.pagesGenerated,   color: T },
          { label: 'Reviews',  value: loading ? '—' : agencyStats.reviewsCollected, color: GRN },
          { label: 'Tickets',  value: loading ? '—' : agencyStats.deskTickets,      color: agencyStats.deskTickets > 0 ? R : '#111' },
        ]} />

        {/* ── Quick Actions 2-column ──────────────────────────────────────── */}
        <MobileSectionHeader title="Quick Actions" />
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          padding: '0 16px', marginBottom: 16,
        }}>
          {AGENCY_ACTIONS.map(a => (
            <button key={a.label} onClick={() => a.action ? a.action() : navigate(a.to)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px', borderRadius: 14, border: 'none',
              cursor: 'pointer', background: '#fff', textAlign: 'left',
              WebkitTapHighlightColor: 'transparent',
              borderLeft: `3px solid ${a.bg}`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: a.bg + '15',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <a.icon size={17} color={a.bg} />
              </div>
              <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>
                {a.label}
              </div>
            </button>
          ))}
        </div>

        {/* ── Stats Row 2 ─────────────────────────────────────────────────── */}
        <MobileStatStrip stats={[
          { label: 'Tasks Due',  value: loading ? '—' : agencyStats.tasksDue,       color: AMB },
          { label: 'Proposals',  value: loading ? '—' : agencyStats.openProposals,  color: '#7c3aed' },
          { label: 'Scout',      value: loading ? '—' : agencyStats.scoutLeads,     color: T },
          { label: 'Avg Rating', value: loading ? '—' : (agencyStats.avgRating || '—'), color: GRN },
        ]} />

        {/* ── Recent Activity ─────────────────────────────────────────────── */}
        {recentActivity.length > 0 && (
          <>
            <MobileSectionHeader title="Recent Activity" />
            <MobileCard style={{ margin: '0 16px 16px' }}>
              {recentActivity.map((log, i) => (
                <MobileRow
                  key={log.id}
                  borderBottom={i < recentActivity.length - 1}
                  left={
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: LOG_LEVEL_COLOR[log.level] || '#6b7280',
                    }} />
                  }
                  title={log.message}
                  subtitle={timeAgo(log.created_at)}
                />
              ))}
            </MobileCard>
          </>
        )}

        {/* ── Client Spotlight ────────────────────────────────────────────── */}
        {spotlightClients.length > 0 && (
          <>
            <MobileSectionHeader title="Client Spotlight"
              action={<button onClick={() => navigate('/clients')} style={{
                fontSize: 13, color: R, fontWeight: 700, background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: FH,
              }}>View all</button>}
            />
            <MobileCard style={{ margin: '0 16px 16px' }}>
              {spotlightClients.map((cl, i) => (
                <MobileRow
                  key={cl.id}
                  onClick={() => navigate(`/client/${cl.id}`)}
                  borderBottom={i < spotlightClients.length - 1}
                  title={cl.name}
                  subtitle={`${cl.industry || 'General'} · ${cl.pagesCount} pages · ${cl.reviewsCount} reviews`}
                />
              ))}
            </MobileCard>
          </>
        )}

        {/* ── System Status (agency admins only) ────────────────────────── */}
        {!isClient && (
          <>
            <MobileSectionHeader title="System Status" />
            <MobileCard style={{ margin: '0 16px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
                <DashStatusDot label="Database"  status={systemHealth.database} />
                <DashStatusDot label="App"       status={systemHealth.app} />
                <DashStatusDot label="WordPress" status={systemHealth.wordpress} />
              </div>
            </MobileCard>
          </>
        )}
      </MobilePage>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     MOBILE — SUPER ADMIN
     ══════════════════════════════════════════════════════════════════════════ */
  if (isMobile && showSuperDashboard) {
    return (
      <MobilePage padded={false}>
        <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '16px 16px 0' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4, fontFamily: FH,
          }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <h1 style={{
            fontFamily: FH, fontSize: 22, fontWeight: 800, color: '#111',
            margin: '0 0 2px', letterSpacing: '-.03em',
          }}>
            Platform Overview
          </h1>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            margin: '0 0 16px',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
              background: GRN + '20', color: GRN, fontFamily: FH,
            }}>
              Uptime {superStats.uptime}
            </span>
            {refreshBadge}
          </div>
        </div>

        <MobileStatStrip stats={[
          { label: 'Agencies', value: loading ? '—' : superStats.totalAgencies,  color: T },
          { label: 'Clients',  value: loading ? '—' : superStats.totalClients,   color: '#111' },
          { label: 'Pages',    value: loading ? '—' : superStats.totalPages,     color: GRN },
          { label: 'Errors',   value: loading ? '—' : superStats.totalErrors24h, color: superStats.totalErrors24h > 0 ? R : '#111' },
        ]} />

        {/* Quick Actions */}
        <MobileSectionHeader title="Quick Actions" />
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          padding: '0 16px', marginBottom: 16,
        }}>
          {SUPER_ACTIONS.map(a => (
            <button key={a.label} onClick={() => a.action ? a.action() : navigate(a.to)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px', borderRadius: 14, border: 'none',
              cursor: 'pointer', background: '#fff', textAlign: 'left',
              borderLeft: `3px solid ${a.bg}`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: a.bg + '15',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <a.icon size={17} color={a.bg} />
              </div>
              <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>
                {a.label}
              </div>
            </button>
          ))}
        </div>

        {/* Recent Errors */}
        {recentErrors.length > 0 && (
          <>
            <MobileSectionHeader title="Recent Errors" />
            <MobileCard style={{ margin: '0 16px 16px' }}>
              {recentErrors.map((log, i) => (
                <MobileRow
                  key={log.id}
                  borderBottom={i < recentErrors.length - 1}
                  left={
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: R,
                    }} />
                  }
                  title={log.message}
                  subtitle={timeAgo(log.created_at)}
                />
              ))}
            </MobileCard>
          </>
        )}

        {/* Activity Feed */}
        {activityFeed.length > 0 && (
          <>
            <MobileSectionHeader title="Activity Feed" />
            <MobileCard style={{ margin: '0 16px 24px' }}>
              {activityFeed.map((log, i) => (
                <MobileRow
                  key={log.id}
                  borderBottom={i < activityFeed.length - 1}
                  left={
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: LOG_LEVEL_COLOR[log.level] || '#6b7280',
                    }} />
                  }
                  title={log.message}
                  subtitle={`${log.level} · ${timeAgo(log.created_at)}`}
                />
              ))}
            </MobileCard>
          </>
        )}
      </MobilePage>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     DESKTOP — SUPER ADMIN (only when NOT impersonating)
     ══════════════════════════════════════════════════════════════════════════ */
  if (showSuperDashboard) {
    return (
      <div className="page-shell" style={{
        display: 'flex', height: '100vh', overflow: 'hidden',
        background: GRY, fontFamily: FB,
      }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* ── Dark Header ───────────────────────────────────────────────── */}
          <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '20px 32px 18px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#9ca3af',
                  textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6, fontFamily: FH,
                }}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
                <h1 style={{
                  fontFamily: FH, fontSize: 26, fontWeight: 800, color: '#111111', margin: 0, letterSpacing: '-.03em', lineHeight: 1,
                }}>
                  Platform Overview
                </h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20,
                  background: GRN + '20', color: GRN, fontFamily: FH,
                }}>
                  Uptime {superStats.uptime}
                </span>
                {refreshBadge}
              </div>
            </div>
          </div>

          {/* ── Main content ──────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

            {/* ── Platform Health Bar ────────────────────────────────────── */}
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
              padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20,
            }}>
              <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK, whiteSpace: 'nowrap' }}>Platform Health</div>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
                <div style={{
                  width: `${qaHealth.health_score || 0}%`, height: '100%', borderRadius: 4,
                  background: (qaHealth.health_score || 0) >= 80 ? GRN : (qaHealth.health_score || 0) >= 50 ? AMB : R,
                  transition: 'width .5s ease',
                }} />
              </div>
              <span style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: (qaHealth.health_score || 0) >= 80 ? GRN : (qaHealth.health_score || 0) >= 50 ? AMB : R }}>
                {qaHealth.health_score || 0}%
              </span>
              <button onClick={() => navigate('/qa')} style={{
                fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 6,
                border: 'none', background: T + '15', color: T, cursor: 'pointer', fontFamily: FH,
              }}>
                QA Console
              </button>
            </div>

            {/* Stats Row — 8 cards */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14,
            }}>
              <DashStatCard loading={loading} label="Agencies"          value={superStats.totalAgencies}  icon={Globe}       accent={T} />
              <DashStatCard loading={loading} label="Total Clients"   value={superStats.totalClients}   icon={Users}       accent={R} />
              <DashStatCard loading={loading} label="Total Pages"       value={superStats.totalPages}     icon={FileText}    accent={GRN} />
              <DashStatCard loading={loading} label="WP Sites"          value={superStats.activeWpSites}  icon={HardDrive}   accent={AMB} />
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24,
            }}>
              <DashStatCard loading={loading} label="Voice Agents"     value={superStats.voiceAgents}    icon={Phone}       accent={'#7c3aed'} />
              <DashStatCard loading={loading} label="Total Calls"      value={superStats.totalCalls}     icon={Phone}       accent={T} />
              <DashStatCard loading={loading} label="Errors (24h)"     value={superStats.totalErrors24h} icon={AlertCircle} accent={superStats.totalErrors24h > 0 ? R : '#6b7280'} />
              <DashStatCard loading={loading} label="System Uptime"    value={superStats.uptime}         icon={Activity}    accent={GRN} />
            </div>

            {/* Quick Actions */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 24,
            }}>
              {SUPER_ACTIONS.map(a => (
                <DashActionTile key={a.label} icon={a.icon} label={a.label} bg={a.bg} onClick={() => a.action ? a.action() : navigate(a.to || '/')} />
              ))}
            </div>

            {/* 3-column grid: Agency Management + System Monitoring + Comms/QA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 340px', gap: 20 }}>

              {/* Column 1: Agency Management */}
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '14px 18px', borderBottom: '1px solid #f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>
                    Agencies
                  </div>
                  <button onClick={() => navigate('/platform-admin')} style={{
                    fontSize: 11, fontWeight: 700, color: T, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FH,
                  }}>
                    View All
                  </button>
                </div>
                <div style={{ padding: '4px 12px', maxHeight: 420, overflowY: 'auto' }}>
                  {loading ? (
                    <div style={{ padding: '20px 0' }}>
                      {[1,2,3].map(i => <SkeletonBar key={i} mb={12} />)}
                    </div>
                  ) : agencyList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', fontSize: 13, color: '#9ca3af', fontFamily: FB }}>
                      No agencies
                    </div>
                  ) : agencyList.slice(0, 8).map(a => (
                    <button key={a.id} onClick={() => { impersonateAgency(a); navigate('/clients') }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px',
                        borderBottom: '1px solid #f3f4f6', border: 'none', background: '#fff',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, background: R + '12',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: FH, fontSize: 14, fontWeight: 800, color: R, flexShrink: 0,
                      }}>
                        {(a.brand_name || a.name || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {a.brand_name || a.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          {a.client_count || 0} clients &middot; {a.plan || 'starter'}
                        </div>
                      </div>
                      <ChevronRight size={16} color="#d1d5db" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Column 2: System Monitoring — Errors + Activity */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Recent Errors */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{
                    padding: '14px 18px', borderBottom: '1px solid #f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>Recent Errors</div>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: R + '15', color: R }}>
                      {superStats.totalErrors24h} in 24h
                    </span>
                  </div>
                  <div style={{ padding: '4px 18px 10px', maxHeight: 200, overflowY: 'auto' }}>
                    {loading ? (
                      <div style={{ padding: '20px 0' }}>{[1,2,3].map(i => <SkeletonBar key={i} mb={12} />)}</div>
                    ) : recentErrors.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#9ca3af', fontFamily: FB }}>
                        <Check size={20} color={GRN} style={{ marginBottom: 8 }} /><br />No recent errors
                      </div>
                    ) : recentErrors.slice(0, 5).map(log => <DashLogRow key={log.id} log={log} showLevel />)}
                  </div>
                </div>

                {/* Activity Feed */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden', flex: 1 }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>Activity Feed</div>
                  </div>
                  <div style={{ padding: '4px 18px 10px', maxHeight: 220, overflowY: 'auto' }}>
                    {loading ? (
                      <div style={{ padding: '20px 0' }}>{[1,2,3].map(i => <SkeletonBar key={i} mb={12} />)}</div>
                    ) : activityFeed.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#9ca3af', fontFamily: FB }}>No activity yet</div>
                    ) : activityFeed.slice(0, 8).map(log => <DashLogRow key={log.id} log={log} showLevel />)}
                  </div>
                </div>
              </div>

              {/* Column 3: Communications + QA Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Communications Status */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 18 }}>
                  <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 14 }}>
                    Communications (24h)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'Emails', value: commsStats.emails24h, color: T },
                      { label: 'SMS', value: commsStats.sms24h, color: GRN },
                      { label: 'Failed', value: commsStats.failed24h, color: R },
                      { label: 'Total', value: commsStats.total24h, color: BLK },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                          {loading ? '—' : s.value}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* QA Summary */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 18 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
                  }}>
                    <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>QA Health</div>
                    <button onClick={() => navigate('/qa')} style={{
                      fontSize: 11, fontWeight: 700, color: T, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FH,
                    }}>Open Console</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{
                        width: `${qaHealth.health_score || 0}%`, height: '100%', borderRadius: 4,
                        background: (qaHealth.health_score || 0) >= 80 ? GRN : (qaHealth.health_score || 0) >= 50 ? AMB : R,
                        transition: 'width .5s ease',
                      }} />
                    </div>
                    <span style={{
                      fontFamily: FH, fontSize: 16, fontWeight: 800,
                      color: (qaHealth.health_score || 0) >= 80 ? GRN : (qaHealth.health_score || 0) >= 50 ? AMB : R,
                    }}>{qaHealth.health_score || 0}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>{qaHealth.pass_rate || 0}%</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FH, fontWeight: 600, textTransform: 'uppercase' }}>Pass Rate</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: qaHealth.open_errors > 0 ? R : GRN }}>{qaHealth.open_errors || 0}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FH, fontWeight: 600, textTransform: 'uppercase' }}>Open Errors</div>
                    </div>
                  </div>
                </div>

                {/* Quick Management Actions */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 18 }}>
                  <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 14 }}>
                    Quick Actions
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: 'Run QA Tests', to: '/qa', color: '#7c3aed' },
                      { label: 'View Voice Calls', to: '/voice/live', color: T },
                      { label: 'Manage Agencies', to: '/platform-admin', color: R },
                    ].map(a => (
                      <button key={a.label} onClick={() => navigate(a.to)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: a.color + '08', fontSize: 13, fontFamily: FH, fontWeight: 700,
                        color: a.color, transition: 'background .12s',
                      }}>
                        {a.label}
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CLIENT VIEW — minimal dashboard, just welcome + links to permitted tools
     ══════════════════════════════════════════════════════════════════════════ */
  if (showClientDashboard) {
    return <ClientDashboard firstName={firstName} greeting={greeting} agency={agency} agencyName={agencyName} can={can} navigate={navigate} aid={aid} clientId={clientId} clientInfo={clientInfo} />
  }

  /* ══════════════════════════════════════════════════════════════════════════
     DESKTOP — AGENCY ADMIN (default)
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="page-shell" style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: GRY, fontFamily: FB,
    }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* ── Dark Header ─────────────────────────────────────────────────── */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '20px 32px 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6, fontFamily: FH,
              }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <h1 style={{
                fontFamily: FH, fontSize: 26, fontWeight: 800, color: '#111111', margin: 0, letterSpacing: '-.03em', lineHeight: 1,
              }}>
                {greeting}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {refreshBadge}
              <button onClick={() => navigate('/clients')} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 10, border: 'none',
                background: R, color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', boxShadow: `0 4px 14px ${R}40`, fontFamily: FH,
              }}>
                <Plus size={15} /> New Client
              </button>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

          {/* ── Stats — only shows cards for enabled features ─────────────── */}
          {(() => {
            const stats = [
              { label: 'Active Clients',     value: agencyStats.activeClients,    icon: Users,          accent: R,         feat: 'clients' },
              { label: 'Pages Generated',    value: agencyStats.pagesGenerated,   icon: FileText,       accent: T,         feat: 'page_builder' },
              { label: 'Reviews Collected',  value: agencyStats.reviewsCollected, icon: Star,           accent: GRN,       feat: 'reviews' },
              { label: 'Scout Leads',        value: agencyStats.scoutLeads,       icon: Target,         accent: T,         feat: 'scout' },
              { label: 'WP Sites',           value: agencyStats.wpSites,          icon: HardDrive,      accent: AMB,       feat: 'wordpress_plugin' },
              { label: 'Tasks Due Today',    value: agencyStats.tasksDue,         icon: Clock,          accent: AMB,       feat: 'tasks' },
              { label: 'Open Proposals',     value: agencyStats.openProposals,    icon: FileSignature,  accent: '#7c3aed', feat: 'proposals' },
              { label: 'Desk Tickets',       value: agencyStats.deskTickets,      icon: Inbox,          accent: agencyStats.deskTickets > 0 ? R : '#6b7280', feat: 'koto_desk' },
              { label: 'Avg Rating',         value: agencyStats.avgRating ? `${agencyStats.avgRating} ★` : '—', icon: Star, accent: GRN, feat: 'reviews' },
            ].filter(s => feat(s.feat))
            if (stats.length === 0) return null
            return (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats.length, 5)}, 1fr)`, gap: 14, marginBottom: 24 }}>
                {stats.map(s => <DashStatCard key={s.label} loading={loading} label={s.label} value={s.value} icon={s.icon} accent={s.accent} />)}
              </div>
            )
          })()}

          {/* ── Quick Actions — only shows enabled features ────────────────── */}
          {AGENCY_ACTIONS.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK,
              marginBottom: 14, letterSpacing: '-.02em',
            }}>
              Quick Actions
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: `repeat(${Math.min(AGENCY_ACTIONS.length, 4)}, 1fr)`, gap: 14,
            }}>
              {AGENCY_ACTIONS.map(a => (
                <DashActionTile key={a.to || a.label} icon={a.icon} label={a.label} bg={a.bg} onClick={() => a.action ? a.action() : navigate(a.to)} />
              ))}
            </div>
          </div>
          )}

          {/* ── Two-column: Activity + Right sidebar ──────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
            {/* Recent Activity */}
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 18px', borderBottom: '1px solid #f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>
                  Recent Activity
                </div>
                <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB }}>
                  Last 10 events
                </span>
              </div>
              <div style={{ padding: '4px 18px 10px' }}>
                {loading ? (
                  <div style={{ padding: '20px 0' }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} style={{ marginBottom: 16 }}>
                        <SkeletonBar w="70%" mb={6} />
                        <SkeletonBar w="40%" h={10} />
                      </div>
                    ))}
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '40px 0', fontSize: 13,
                    color: '#9ca3af', fontFamily: FB,
                  }}>
                    <Activity size={24} color="#d1d5db" style={{ marginBottom: 8 }} />
                    <br />No recent activity
                  </div>
                ) : (
                  recentActivity.map(log => (
                    <DashLogRow key={log.id} log={log} showLevel />
                  ))
                )}
              </div>
            </div>

            {/* Right sidebar: Spotlight + System Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Client Spotlight */}
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '14px 18px', borderBottom: '1px solid #f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>
                    Client Spotlight
                  </div>
                  <button onClick={() => navigate('/clients')} style={{
                    fontSize: 12, fontWeight: 700, color: R, background: 'none',
                    border: 'none', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: 3, fontFamily: FH,
                  }}>
                    View all <ChevronRight size={12} />
                  </button>
                </div>
                <div style={{ padding: '8px 10px' }}>
                  {loading ? (
                    <div style={{ padding: '10px 8px' }}>
                      {[1,2,3].map(i => (
                        <div key={i} style={{ marginBottom: 14 }}>
                          <SkeletonBar w="60%" mb={6} />
                          <SkeletonBar w="80%" h={10} />
                        </div>
                      ))}
                    </div>
                  ) : spotlightClients.length === 0 ? (
                    <div style={{
                      textAlign: 'center', padding: '24px 0', fontSize: 13,
                      color: '#9ca3af', fontFamily: FB,
                    }}>
                      No active clients
                    </div>
                  ) : (
                    spotlightClients.map(cl => {
                      const statusColor = cl.status === 'active' ? GRN : cl.status === 'prospect' ? T : '#6b7280'
                      return (
                        <div
                          key={cl.id}
                          onClick={() => navigate(`/client/${cl.id}`)}
                          style={{
                            padding: '11px 10px', borderRadius: 10, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 12,
                            transition: 'background .12s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: statusColor + '12', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontFamily: FH, fontSize: 14, fontWeight: 800, color: statusColor,
                          }}>
                            {cl.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {cl.name}
                            </div>
                            <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>
                              {cl.industry || 'General'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
                              background: statusColor + '15', color: statusColor,
                              textTransform: 'uppercase', letterSpacing: '.05em',
                            }}>
                              {cl.status}
                            </span>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                              {cl.pagesCount}p · {cl.reviewsCount}r
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* System Status (agency admins only) */}
              {!isClient && (
                <div style={{
                  background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
                  padding: '18px',
                }}>
                  <div style={{
                    fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 16,
                  }}>
                    System Status
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <DashStatusDot label="Database"  status={systemHealth.database} />
                    <DashStatusDot label="App"       status={systemHealth.app} />
                    <DashStatusDot label="WordPress" status={systemHealth.wordpress} />
                  </div>
                  <div style={{
                    fontSize: 11, color: '#9ca3af', marginTop: 14, fontFamily: FB,
                    borderTop: '1px solid #f3f4f6', paddingTop: 12,
                  }}>
                    Last checked {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {showViewAs && <ViewAsModal open={showViewAs} onClose={() => setShowViewAs(false)} />}
    </div>
  )
}

// ── Client Dashboard — personalized greeting + pending items ─────────────
function ClientDashboard({ firstName, greeting, agency, agencyName, can, navigate, aid, clientId, clientInfo }) {
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState([])
  const [recentProjects, setRecentProjects] = useState([])

  useEffect(() => {
    loadStats()
  }, [aid])

  async function loadStats() {
    setLoading(true)
    const s = {}
    try {
      if (can?.('view_pages')) {
        const { data: projs } = await supabase.from('projects').select('id, clients!inner(agency_id)').eq('clients.agency_id', aid).limit(50)
        s.projects = projs?.length || 0
        if (projs?.length) {
          const projIds = projs.map(p => p.id)
          const { data: anns } = await supabase.from('annotations').select('id, status, files!inner(project_id)').in('files.project_id', projIds).limit(200)
          s.annotations = anns?.length || 0
          s.openAnnotations = (anns || []).filter(a => a.status !== 'completed').length
        }
      }
      if (can?.('view_tasks')) {
        const { count } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('agency_id', aid).eq('status', 'open')
        s.openTasks = count || 0
      }
      if (can?.('view_reviews')) {
        const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('agency_id', aid)
        s.reviews = count || 0
      }
      if (can?.('view_proposals')) {
        const { count } = await supabase.from('koto_proposals').select('*', { count: 'exact', head: true }).eq('agency_id', aid)
        s.proposals = count || 0
      }
      if (can?.('view_reports')) {
        const { count } = await supabase.from('desk_tickets').select('*', { count: 'exact', head: true }).eq('agency_id', aid).not('status', 'in', '("resolved","closed")')
        s.openTickets = count || 0
      }
    } catch (e) { console.warn('[ClientDashboard] stats:', e) }
    setStats(s)

    // Load activity timeline
    try {
      const { data } = await supabase
        .from('activity_log')
        .select('*')
        .eq('agency_id', aid)
        .order('created_at', { ascending: false })
        .limit(15)
      setActivities(data || [])
    } catch (e) { console.warn('[ClientDashboard] activities:', e); setActivities([]) }

    // Load recent projects for status cards
    try {
      const { data } = await supabase
        .from('projects')
        .select('id, name, status, created_at, clients!inner(agency_id)')
        .eq('clients.agency_id', aid)
        .limit(6)
      setRecentProjects(data || [])
    } catch (e) { console.warn('[ClientDashboard] projects:', e); setRecentProjects([]) }

    setLoading(false)
  }


  const tools = [
    can?.('view_pages') && {
      Icon: FileSignature, title: 'KotoProof', desc: 'Review & approve designs',
      detail: stats.projects != null ? `${stats.projects || 0} project${(stats.projects||0) !== 1 ? 's' : ''}${stats.openAnnotations ? ` · ${stats.openAnnotations} open comment${stats.openAnnotations !== 1 ? 's' : ''}` : ''}` : null,
      to: '/proof', color: T,
    },
    can?.('view_tasks') && {
      Icon: CheckSquare, title: 'Tasks', desc: 'Track project tasks & to-dos',
      detail: stats.openTasks != null ? `${stats.openTasks} open task${stats.openTasks !== 1 ? 's' : ''}` : null,
      to: '/tasks', color: '#f59e0b',
    },
    can?.('view_reviews') && {
      Icon: Star, title: 'Reviews', desc: 'Monitor your online reviews',
      detail: stats.reviews != null ? `${stats.reviews} review${stats.reviews !== 1 ? 's' : ''}` : null,
      to: '/reviews', color: '#7c3aed',
    },
    can?.('view_proposals') && {
      Icon: FileText, title: 'Proposals', desc: 'View proposals & estimates',
      detail: stats.proposals != null ? `${stats.proposals} proposal${stats.proposals !== 1 ? 's' : ''}` : null,
      to: '/proposals', color: '#3b82f6',
    },
    can?.('view_reports') && {
      Icon: BarChart2, title: 'Reports', desc: 'Performance & analytics',
      detail: stats.openTickets ? `${stats.openTickets} open ticket${stats.openTickets !== 1 ? 's' : ''}` : 'All caught up',
      to: '/perf', color: R,
    },
  ].filter(Boolean)

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Client logo centered at top */}
        {clientInfo?.logo_url && (
          <div style={{ background: '#fff', padding: '20px 32px 0', display: 'flex', justifyContent: 'center' }}>
            <img src={clientInfo.logo_url} alt={clientInfo.name || 'Client'} style={{ height: 56, maxWidth: 200, objectFit: 'contain' }} />
          </div>
        )}

        {/* Welcome header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '24px 32px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLK, margin: 0, letterSpacing: '-.03em' }}>
            {greeting}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 8, fontFamily: FB, lineHeight: 1.6 }}>
            Welcome to your client portal. Here you can review designs, track progress, and stay connected with your team.
          </p>
          {agencyName && (
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, fontFamily: FB }}>
              Powered by {agencyName}
            </p>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>

            {/* ── Welcome Checklist ──────────────────────────────────────────── */}
            {!loading && (() => {
              const checks = [
                { label: 'Portal login set up', done: true },
                { label: 'Brand kit scanned', done: clientInfo?.brand_kit?.scan_status === 'complete' },
                { label: 'First project created', done: (stats.projects || 0) > 0 },
              ]
              const completed = checks.filter(c => c.done).length
              const pct = Math.round((completed / checks.length) * 100)
              return (
                <div style={{
                  background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
                  padding: '20px 24px', marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>
                      Getting Started
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? GRN : T, fontFamily: FH }}>
                      {completed}/{checks.length} complete
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 6, borderRadius: 3, background: '#f3f4f6', marginBottom: 16, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, width: `${pct}%`,
                      background: pct === 100 ? GRN : T,
                      transition: 'width .4s ease',
                    }} />
                  </div>
                  {/* Checklist items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {checks.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: c.done ? GRN : '#e5e7eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {c.done
                            ? <Check size={13} color="#fff" strokeWidth={3} />
                            : <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#9ca3af' }} />
                          }
                        </div>
                        <span style={{
                          fontSize: 13, fontFamily: FB, fontWeight: 600,
                          color: c.done ? '#6b7280' : BLK,
                          textDecoration: c.done ? 'line-through' : 'none',
                        }}>
                          {c.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* ── Tool cards ─────────────────────────────────────────────────── */}
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading your workspace…</div>
            ) : tools.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>No tools enabled yet — your agency will set these up for you.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
                {tools.map((tool, i) => (
                  <div key={i} onClick={() => navigate(tool.to)}
                    style={{
                      background: '#fff', borderRadius: 14, padding: '24px 20px',
                      border: `1.5px solid ${tool.color}20`, cursor: 'pointer',
                      transition: 'all .2s', position: 'relative', overflow: 'hidden',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = tool.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${tool.color}15` }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = tool.color + '20'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: tool.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <tool.Icon size={22} color={tool.color} />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: BLK, fontFamily: FH, marginBottom: 4 }}>{tool.title}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, marginBottom: 12 }}>{tool.desc}</div>
                    {tool.detail && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: tool.color, fontFamily: FH, padding: '4px 10px', background: tool.color + '10', borderRadius: 20, display: 'inline-block' }}>
                        {tool.detail}
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 12, fontWeight: 700, color: tool.color, fontFamily: FH }}>→</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Brand Kit ───────────────────────────────────────────────── */}
            {!loading && (() => {
              const bk = clientInfo?.brand_kit || {}
              const vis = bk.portal_visibility || {}
              const edits = bk.client_edits || {}
              const hasAnyVisible = ['logo_url','colors','description','services','industry','tagline'].some(f => vis[f])
              if (!hasAnyVisible) return null

              // Editable field state management
              const BrandField = ({ field, label, value, editable }) => {
                const [editing, setEditing] = useState(false)
                const [draft, setDraft] = useState(value || '')
                const [submitted, setSubmitted] = useState(edits[field]?.status === 'pending')

                const handleSubmit = async () => {
                  try {
                    const res = await fetch('/api/admin', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'submit_brand_kit_edit', client_id: clientId, field, value: draft }),
                    })
                    if (res.ok) {
                      setSubmitted(true)
                      setEditing(false)
                    }
                  } catch (e) { console.warn('[BrandKit] submit error:', e) }
                }

                return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                      letterSpacing: '.06em', fontFamily: FH, marginBottom: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span>{label}</span>
                      {editable && !editing && !submitted && (
                        <button onClick={() => setEditing(true)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                          color: T, fontSize: 11, fontWeight: 700, fontFamily: FH,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <Edit3 size={11} /> Edit
                        </button>
                      )}
                      {submitted && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: AMB, fontFamily: FH,
                          background: AMB + '15', padding: '2px 8px', borderRadius: 10,
                        }}>
                          Pending Review
                        </span>
                      )}
                    </div>
                    {editing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <textarea
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          rows={field === 'description' ? 4 : 2}
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: 8,
                            border: `1.5px solid ${T}`, fontFamily: FB, fontSize: 13,
                            resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                            lineHeight: 1.5,
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={handleSubmit} style={{
                            padding: '6px 14px', borderRadius: 8, border: 'none',
                            background: T, color: '#fff', fontSize: 12, fontWeight: 700,
                            fontFamily: FH, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                          }}>
                            <Send size={12} /> Submit for Review
                          </button>
                          <button onClick={() => { setEditing(false); setDraft(value || '') }} style={{
                            padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
                            background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 600,
                            fontFamily: FB, cursor: 'pointer',
                          }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, color: BLK, fontFamily: FB, lineHeight: 1.6 }}>
                        {value || <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>Not set</span>}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div style={{
                  background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
                  padding: '20px 24px', marginBottom: 20,
                }}>
                  <div style={{
                    fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 18,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Palette size={16} color={R} />
                    Your Brand
                  </div>

                  {/* Logo */}
                  {vis.logo_url && bk.logo_url && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                        letterSpacing: '.06em', fontFamily: FH, marginBottom: 8,
                      }}>
                        Logo
                      </div>
                      <div style={{
                        padding: 16, background: '#f9fafb', borderRadius: 10,
                        display: 'inline-block', border: '1px solid #f3f4f6',
                      }}>
                        <img src={bk.logo_url} alt="Brand logo" style={{
                          maxHeight: 64, maxWidth: 200, objectFit: 'contain', display: 'block',
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Colors */}
                  {vis.colors && bk.colors && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                        letterSpacing: '.06em', fontFamily: FH, marginBottom: 8,
                      }}>
                        Brand Colors
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Primary', color: bk.colors?.primary },
                          { label: 'Secondary', color: bk.colors?.secondary },
                          { label: 'Accent', color: bk.colors?.accent },
                        ].filter(c => c.color).map((c, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8, background: c.color,
                              border: '1px solid #e5e7eb', flexShrink: 0,
                            }} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: BLK, fontFamily: FH }}>{c.label}</div>
                              <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB, textTransform: 'uppercase' }}>{c.color}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description — editable */}
                  {vis.description && <BrandField field="description" label="Description" value={bk.description} editable />}

                  {/* Services — tag list */}
                  {vis.services && bk.services && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                        letterSpacing: '.06em', fontFamily: FH, marginBottom: 8,
                      }}>
                        Services
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(Array.isArray(bk.services) ? bk.services : [bk.services]).map((svc, i) => (
                          <span key={i} style={{
                            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            fontFamily: FB, background: T + '12', color: T, border: `1px solid ${T}25`,
                          }}>
                            {svc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Industry */}
                  {vis.industry && <BrandField field="industry" label="Industry" value={bk.industry} editable={false} />}

                  {/* Tagline — editable */}
                  {vis.tagline && <BrandField field="tagline" label="Tagline" value={bk.tagline} editable />}
                </div>
              )
            })()}

            {/* ── Project Status Cards ───────────────────────────────────────── */}
            {!loading && recentProjects.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14 }}>
                  Projects
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                  {recentProjects.map(proj => {
                    const statusMap = {
                      active: { bg: GRN + '15', color: GRN, label: 'Active' },
                      draft: { bg: '#6b728015', color: '#6b7280', label: 'Draft' },
                      review: { bg: AMB + '15', color: AMB, label: 'In Review' },
                      approved: { bg: T + '15', color: T, label: 'Approved' },
                      completed: { bg: GRN + '15', color: GRN, label: 'Completed' },
                    }
                    const st = statusMap[proj.status] || { bg: '#6b728015', color: '#6b7280', label: proj.status || 'Unknown' }
                    return (
                      <div key={proj.id} style={{
                        background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
                        padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
                      }}>
                        <div style={{
                          fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {proj.name || 'Untitled Project'}
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                          background: st.bg, color: st.color, textTransform: 'uppercase',
                          letterSpacing: '.04em', alignSelf: 'flex-start', fontFamily: FH,
                        }}>
                          {st.label}
                        </span>
                        <button
                          onClick={() => navigate(`/project/${proj.id}`)}
                          style={{
                            marginTop: 'auto', padding: '7px 0', borderRadius: 8,
                            border: `1.5px solid ${T}`, background: 'transparent',
                            color: T, fontSize: 12, fontWeight: 700, fontFamily: FH,
                            cursor: 'pointer', transition: 'all .15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = T; e.currentTarget.style.color = '#fff' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T }}
                        >
                          View
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Activity Timeline ──────────────────────────────────────────── */}
            {!loading && (
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
                padding: '20px 24px',
              }}>
                <div style={{
                  fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Activity size={16} color={T} />
                  Recent Activity
                </div>
                {activities.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '28px 0', fontSize: 13,
                    color: '#9ca3af', fontFamily: FB,
                  }}>
                    <Clock size={22} color="#d1d5db" style={{ marginBottom: 6 }} />
                    <br />No recent activity
                  </div>
                ) : (
                  <div style={{ position: 'relative', paddingLeft: 20 }}>
                    {/* Vertical line */}
                    <div style={{
                      position: 'absolute', left: 5, top: 4, bottom: 4,
                      width: 2, background: '#f3f4f6', borderRadius: 1,
                    }} />
                    {activities.map((act, i) => {
                      const typeColors = {
                        upload: T, comment: '#3b82f6', approval: GRN,
                        annotation: AMB, status_change: '#7c3aed', revision: R,
                      }
                      const dotColor = typeColors[act.action_type || act.type] || '#9ca3af'
                      return (
                        <div key={act.id || i} style={{
                          position: 'relative', paddingBottom: i < activities.length - 1 ? 18 : 0,
                        }}>
                          {/* Dot */}
                          <div style={{
                            position: 'absolute', left: -18, top: 3,
                            width: 10, height: 10, borderRadius: '50%',
                            background: dotColor, border: '2px solid #fff',
                            boxShadow: `0 0 0 2px ${dotColor}30`,
                          }} />
                          <div style={{ fontSize: 13, color: BLK, fontFamily: FB, lineHeight: 1.5 }}>
                            {act.message || act.description || `${act.action_type || act.type || 'Event'}`}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB, marginTop: 2 }}>
                            {act.created_at ? timeAgo(act.created_at) : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
