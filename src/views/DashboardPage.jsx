"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, ChevronRight, Target, Star, TrendingUp,
  Inbox, Brain, ArrowUpRight, Zap, Users,
  Clock, AlertCircle, Loader2, BarChart2, FileSignature, X,
  Globe, Shield, Phone, Sparkles, Activity, HardDrive,
  DollarSign, Check, CheckCircle, RefreshCw, FileText
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

/* ── Design tokens ──────────────────────────────────────────────────────────── */
const R   = '#ea2729'
const T   = '#5bc6d0'
const BLK = '#0a0a0a'
const GRY = '#f2f2f0'
const GRN = '#16a34a'
const AMB = '#f59e0b'
const FH  = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB  = "'Raleway','Helvetica Neue',sans-serif"

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
      background: 'linear-gradient(90deg, #e8e8e6 25%, #f0f0ee 50%, #e8e8e6 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
    }} />
  )
}

function SkeletonCard({ children, style }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #ececea',
      padding: '18px', ...style,
    }}>
      {children}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, firstName, agencyId, role, isOwner, agency, isSuperAdmin, isAgencyAdmin: isAgAdmin } = useAuth()
  const isMobile = useMobile()

  const isAgencyAdmin = !isSuperAdmin
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
      if (isSuperAdmin) {
        await loadSuperAdminData()
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
        .eq('due_date', today),
      // 7) Open Proposals
      supabase.from('proposals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent'),
      // 8) Desk Tickets open
      supabase.from('desk_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', aid).in('status', ['new', 'open']),
      // 9) Avg Rating
      supabase.from('moose_review_queue')
        .select('star_rating')
        .eq('agency_id', aid).not('star_rating', 'is', null),
      // 10) Recent Activity (logs)
      supabase.from('koto_system_logs')
        .select('id, level, message, created_at')
        .eq('agency_id', aid)
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
      fetch('/api/admin?action=list_agencies').then(r => r.json()).catch(() => []),
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
    if (agencies) setAgencyList(agencies)
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SHARED SUB-COMPONENTS
     ══════════════════════════════════════════════════════════════════════════ */

  /* ── Stat Card ────────────────────────────────────────────────────────────── */
  function StatCard({ label, value, icon: Icon, color = '#fff', accent = T }) {
    return (
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #ececea',
        padding: '18px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: accent, opacity: 0.7, borderRadius: '14px 14px 0 0',
        }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLK,
              lineHeight: 1, letterSpacing: '-.03em',
            }}>
              {loading ? <SkeletonBar w={48} h={28} /> : value}
            </div>
            <div style={{
              fontSize: 11, color: '#9a9a96', marginTop: 6, fontFamily: FH,
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em',
            }}>
              {label}
            </div>
          </div>
          {Icon && (
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: accent + '15', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={18} color={accent} />
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ── Quick Action Tile ────────────────────────────────────────────────────── */
  function ActionTile({ icon: Icon, label, to, bg }) {
    return (
      <button
        onClick={() => navigate(to)}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 10, padding: '20px 12px',
          borderRadius: 14, border: 'none', cursor: 'pointer',
          background: bg, color: '#fff', fontFamily: FH, fontSize: 13,
          fontWeight: 700, transition: 'all .18s ease',
          boxShadow: `0 4px 14px ${bg}30`,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${bg}40` }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 14px ${bg}30` }}
      >
        <Icon size={22} />
        {label}
      </button>
    )
  }

  /* ── Log/Activity Row ─────────────────────────────────────────────────────── */
  function LogRow({ log, showLevel = false }) {
    const dotColor = LOG_LEVEL_COLOR[log.level] || '#6b7280'
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '10px 0', borderBottom: '1px solid #f2f2f0',
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: dotColor, marginTop: 5,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {showLevel && (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
              background: dotColor + '15', color: dotColor,
              textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 8,
            }}>
              {log.level}
            </span>
          )}
          <span style={{
            fontSize: 13, color: BLK, fontFamily: FB,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'inline-block', maxWidth: '100%',
          }}>
            {log.message}
          </span>
          <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 2 }}>
            {timeAgo(log.created_at)}
          </div>
        </div>
      </div>
    )
  }

  /* ── Status Dot ───────────────────────────────────────────────────────────── */
  function StatusDot({ label, status }) {
    const color = status === 'green' ? GRN : status === 'amber' ? AMB : R
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: color,
          boxShadow: `0 0 6px ${color}60`,
        }} />
        <span style={{ fontSize: 13, fontFamily: FH, fontWeight: 600, color: BLK }}>{label}</span>
      </div>
    )
  }

  /* ── Refresh indicator ────────────────────────────────────────────────────── */
  function RefreshBadge() {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
        color: 'rgba(255,255,255,.35)', fontFamily: FB,
      }}>
        <RefreshCw size={11} />
        Auto-refresh {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     AGENCY ADMIN — QUICK ACTIONS
     ══════════════════════════════════════════════════════════════════════════ */
  const AGENCY_ACTIONS = [
    { icon: Sparkles,      label: 'Build Pages',     to: '/page-builder',  bg: R },
    { icon: Target,        label: 'Find Leads',      to: '/scout',         bg: T },
    { icon: Star,          label: 'Get Reviews',     to: '/reviews',       bg: GRN },
    { icon: Phone,         label: 'Voice Agent',     to: '/voice',         bg: AMB },
    { icon: FileSignature, label: 'Send Proposal',   to: '/proposals',     bg: '#7c3aed' },
    { icon: Zap,           label: 'Run Automation',  to: '/automations',   bg: R },
    { icon: BarChart2,     label: 'View Reports',    to: '/seo',           bg: T },
    { icon: Brain,         label: 'Ask CMO AI',      to: '/agent',         bg: BLK },
  ]

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
        <div style={{ background: BLK, padding: '16px 16px 0' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.3)',
            textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4, fontFamily: FH,
          }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <h1 style={{
            fontFamily: FH, fontSize: 22, fontWeight: 800, color: '#fff',
            margin: '0 0 2px', letterSpacing: '-.03em',
          }}>
            {greeting}
          </h1>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            margin: '0 0 16px',
          }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', margin: 0, fontFamily: FB }}>
              {agencyStats.activeClients} clients &middot; {agencyStats.wpSites} WP sites
            </p>
            <RefreshBadge />
          </div>
        </div>

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <MobileStatStrip stats={[
          { label: 'Clients',  value: loading ? '—' : agencyStats.activeClients,    color: '#fff' },
          { label: 'Pages',    value: loading ? '—' : agencyStats.pagesGenerated,   color: T },
          { label: 'Reviews',  value: loading ? '—' : agencyStats.reviewsCollected, color: GRN },
          { label: 'Tickets',  value: loading ? '—' : agencyStats.deskTickets,      color: agencyStats.deskTickets > 0 ? R : '#fff' },
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

        {/* ── System Status ───────────────────────────────────────────────── */}
        <MobileSectionHeader title="System Status" />
        <MobileCard style={{ margin: '0 16px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
            <StatusDot label="Database"  status={systemHealth.database} />
            <StatusDot label="App"       status={systemHealth.app} />
            <StatusDot label="WordPress" status={systemHealth.wordpress} />
          </div>
        </MobileCard>
      </MobilePage>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     MOBILE — SUPER ADMIN
     ══════════════════════════════════════════════════════════════════════════ */
  if (isMobile && isSuperAdmin) {
    return (
      <MobilePage padded={false}>
        <div style={{ background: BLK, padding: '16px 16px 0' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.3)',
            textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4, fontFamily: FH,
          }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <h1 style={{
            fontFamily: FH, fontSize: 22, fontWeight: 800, color: '#fff',
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
            <RefreshBadge />
          </div>
        </div>

        <MobileStatStrip stats={[
          { label: 'Agencies', value: loading ? '—' : superStats.totalAgencies,  color: T },
          { label: 'Clients',  value: loading ? '—' : superStats.totalClients,   color: '#fff' },
          { label: 'Pages',    value: loading ? '—' : superStats.totalPages,     color: GRN },
          { label: 'Errors',   value: loading ? '—' : superStats.totalErrors24h, color: superStats.totalErrors24h > 0 ? R : '#fff' },
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
     DESKTOP — SUPER ADMIN
     ══════════════════════════════════════════════════════════════════════════ */
  if (isSuperAdmin) {
    return (
      <div className="page-shell" style={{
        display: 'flex', height: '100vh', overflow: 'hidden',
        background: GRY, fontFamily: FB,
      }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* ── Dark Header ───────────────────────────────────────────────── */}
          <div style={{ background: BLK, padding: '20px 32px 18px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.3)',
                  textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6, fontFamily: FH,
                }}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
                <h1 style={{
                  fontFamily: FH, fontSize: 26, fontWeight: 800, color: '#fff',
                  margin: 0, letterSpacing: '-.03em', lineHeight: 1,
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
                <RefreshBadge />
              </div>
            </div>
          </div>

          {/* ── Main content ──────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

            {/* ── Platform Health Bar ────────────────────────────────────── */}
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #ececea',
              padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20,
            }}>
              <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK, whiteSpace: 'nowrap' }}>Platform Health</div>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#ececea', overflow: 'hidden' }}>
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
              <StatCard label="Agency Clients"   value={superStats.totalAgencies}  icon={Globe}       accent={T} />
              <StatCard label="End Clients"     value={superStats.totalClients}   icon={Users}       accent={R} />
              <StatCard label="Total Pages"       value={superStats.totalPages}     icon={FileText}    accent={GRN} />
              <StatCard label="WP Sites"          value={superStats.activeWpSites}  icon={HardDrive}   accent={AMB} />
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24,
            }}>
              <StatCard label="Voice Agents"     value={superStats.voiceAgents}    icon={Phone}       accent={'#7c3aed'} />
              <StatCard label="Total Calls"      value={superStats.totalCalls}     icon={Phone}       accent={T} />
              <StatCard label="Errors (24h)"     value={superStats.totalErrors24h} icon={AlertCircle} accent={superStats.totalErrors24h > 0 ? R : '#6b7280'} />
              <StatCard label="System Uptime"    value={superStats.uptime}         icon={Activity}    accent={GRN} />
            </div>

            {/* Quick Actions */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 24,
            }}>
              {SUPER_ACTIONS.map(a => (
                <ActionTile key={a.label} icon={a.icon} label={a.label} to={a.to || '#'} bg={a.bg} />
              ))}
            </div>

            {/* 3-column grid: Agency Management + System Monitoring + Comms/QA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 340px', gap: 20 }}>

              {/* Column 1: Agency Management */}
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #ececea',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '14px 18px', borderBottom: '1px solid #f2f2f0',
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
                    <div style={{ textAlign: 'center', padding: '30px 0', fontSize: 13, color: '#9a9a96', fontFamily: FB }}>
                      No agencies
                    </div>
                  ) : agencyList.slice(0, 8).map(a => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px',
                      borderBottom: '1px solid #f8f8f6',
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8, background: T + '12',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: FH, fontSize: 13, fontWeight: 800, color: T,
                      }}>
                        {(a.brand_name || a.name || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {a.brand_name || a.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#9a9a96' }}>
                          {a.owner_email || a.slug} &middot; {a.plan || 'starter'} &middot; {a.client_count || 0} clients
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
                        background: a.status === 'active' ? GRN + '15' : '#f2f2f0',
                        color: a.status === 'active' ? GRN : '#6b7280',
                        textTransform: 'uppercase',
                      }}>
                        {a.status || 'active'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: System Monitoring — Errors + Activity */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Recent Errors */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden' }}>
                  <div style={{
                    padding: '14px 18px', borderBottom: '1px solid #f2f2f0',
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
                      <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#9a9a96', fontFamily: FB }}>
                        <Check size={20} color={GRN} style={{ marginBottom: 8 }} /><br />No recent errors
                      </div>
                    ) : recentErrors.slice(0, 5).map(log => <LogRow key={log.id} log={log} showLevel />)}
                  </div>
                </div>

                {/* Activity Feed */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', overflow: 'hidden', flex: 1 }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f2f2f0' }}>
                    <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>Activity Feed</div>
                  </div>
                  <div style={{ padding: '4px 18px 10px', maxHeight: 220, overflowY: 'auto' }}>
                    {loading ? (
                      <div style={{ padding: '20px 0' }}>{[1,2,3].map(i => <SkeletonBar key={i} mb={12} />)}</div>
                    ) : activityFeed.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#9a9a96', fontFamily: FB }}>No activity yet</div>
                    ) : activityFeed.slice(0, 8).map(log => <LogRow key={log.id} log={log} showLevel />)}
                  </div>
                </div>
              </div>

              {/* Column 3: Communications + QA Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Communications Status */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 18 }}>
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
                        <div style={{ fontSize: 10, color: '#9a9a96', marginTop: 4, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* QA Summary */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 18 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
                  }}>
                    <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>QA Health</div>
                    <button onClick={() => navigate('/qa')} style={{
                      fontSize: 11, fontWeight: 700, color: T, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FH,
                    }}>Open Console</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#ececea', overflow: 'hidden' }}>
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
                      <div style={{ fontSize: 10, color: '#9a9a96', fontFamily: FH, fontWeight: 600, textTransform: 'uppercase' }}>Pass Rate</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: qaHealth.open_errors > 0 ? R : GRN }}>{qaHealth.open_errors || 0}</div>
                      <div style={{ fontSize: 10, color: '#9a9a96', fontFamily: FH, fontWeight: 600, textTransform: 'uppercase' }}>Open Errors</div>
                    </div>
                  </div>
                </div>

                {/* Quick Management Actions */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececea', padding: 18 }}>
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
        <div style={{ background: BLK, padding: '20px 32px 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.3)',
                textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6, fontFamily: FH,
              }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <h1 style={{
                fontFamily: FH, fontSize: 26, fontWeight: 800, color: '#fff',
                margin: 0, letterSpacing: '-.03em', lineHeight: 1,
              }}>
                {greeting}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <RefreshBadge />
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

          {/* ── Stats Row 1: 5 cards ──────────────────────────────────────── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 16,
          }}>
            <StatCard label="Active Clients"     value={agencyStats.activeClients}    icon={Users}      accent={R} />
            <StatCard label="Pages Generated"     value={agencyStats.pagesGenerated}   icon={FileText}   accent={T} />
            <StatCard label="Reviews Collected"   value={agencyStats.reviewsCollected} icon={Star}       accent={GRN} />
            <StatCard label="Scout Leads"         value={agencyStats.scoutLeads}       icon={Target}     accent={T} />
            <StatCard label="WP Sites"            value={agencyStats.wpSites}          icon={HardDrive}  accent={AMB} />
          </div>

          {/* ── Stats Row 2: 4 cards ──────────────────────────────────────── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24,
          }}>
            <StatCard label="Tasks Due Today"  value={agencyStats.tasksDue}       icon={Clock}         accent={AMB} />
            <StatCard label="Open Proposals"   value={agencyStats.openProposals}  icon={FileSignature} accent={'#7c3aed'} />
            <StatCard label="Desk Tickets"     value={agencyStats.deskTickets}    icon={Inbox}         accent={agencyStats.deskTickets > 0 ? R : '#6b7280'} />
            <StatCard label="Avg Rating"       value={agencyStats.avgRating ? `${agencyStats.avgRating} ★` : '—'} icon={Star} accent={GRN} />
          </div>

          {/* ── Quick Actions: 4x2 grid ───────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK,
              marginBottom: 14, letterSpacing: '-.02em',
            }}>
              Quick Actions
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
            }}>
              {AGENCY_ACTIONS.map(a => (
                <ActionTile key={a.to} icon={a.icon} label={a.label} to={a.to} bg={a.bg} />
              ))}
            </div>
          </div>

          {/* ── Two-column: Activity + Right sidebar ──────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
            {/* Recent Activity */}
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #ececea',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 18px', borderBottom: '1px solid #f2f2f0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>
                  Recent Activity
                </div>
                <span style={{ fontSize: 11, color: '#9a9a96', fontFamily: FB }}>
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
                    color: '#9a9a96', fontFamily: FB,
                  }}>
                    <Activity size={24} color="#d0d0cc" style={{ marginBottom: 8 }} />
                    <br />No recent activity
                  </div>
                ) : (
                  recentActivity.map(log => (
                    <LogRow key={log.id} log={log} showLevel />
                  ))
                )}
              </div>
            </div>

            {/* Right sidebar: Spotlight + System Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Client Spotlight */}
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #ececea',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '14px 18px', borderBottom: '1px solid #f2f2f0',
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
                      color: '#9a9a96', fontFamily: FB,
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
                          onMouseEnter={e => e.currentTarget.style.background = '#f8f8f6'}
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
                            <div style={{ fontSize: 12, color: '#9a9a96', fontFamily: FB }}>
                              {cl.industry || 'General'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
                              background: statusColor + '15', color: statusColor,
                              textTransform: 'uppercase', letterSpacing: '.05em',
                            }}>
                              {cl.status}
                            </span>
                            <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 4 }}>
                              {cl.pagesCount}p · {cl.reviewsCount}r
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* System Status */}
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #ececea',
                padding: '18px',
              }}>
                <div style={{
                  fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 16,
                }}>
                  System Status
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <StatusDot label="Database"  status={systemHealth.database} />
                  <StatusDot label="App"       status={systemHealth.app} />
                  <StatusDot label="WordPress" status={systemHealth.wordpress} />
                </div>
                <div style={{
                  fontSize: 11, color: '#9a9a96', marginTop: 14, fontFamily: FB,
                  borderTop: '1px solid #f2f2f0', paddingTop: 12,
                }}>
                  Last checked {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showViewAs && <ViewAsModal open={showViewAs} onClose={() => setShowViewAs(false)} />}
    </div>
  )
}
