"use client"
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Flame, Target, TrendingUp, Phone, PhoneIncoming, Globe, Upload, User,
  ChevronRight, Loader2, Building2, AlertCircle, ArrowUpRight, DollarSign,
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { useAuth } from '../../hooks/useAuth'
import { useMobile } from '../../hooks/useMobile'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

const STAGES = ['new', 'engaged', 'qualified', 'proposal', 'won', 'lost']
const STAGE_COLOR = {
  new: T, engaged: AMB, qualified: '#00C2CB', proposal: R,
  won: GRN, lost: '#9ca3af', archived: '#9ca3af',
}
const STAGE_LABEL = {
  new: 'New', engaged: 'Engaged', qualified: 'Qualified',
  proposal: 'Proposal', won: 'Won', lost: 'Lost',
}

const SOURCE = {
  web_visitor: { icon: Globe, label: 'Web', color: T },
  scout: { icon: Target, label: 'Scout', color: '#00C2CB' },
  voice_call: { icon: Phone, label: 'Outbound', color: R },
  inbound_call: { icon: PhoneIncoming, label: 'Inbound', color: GRN },
  import: { icon: Upload, label: 'Import', color: AMB },
  manual: { icon: User, label: 'Manual', color: '#6b7280' },
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

function StatCard({ label, value, sub, icon: Icon, accent = T }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
      padding: '16px 18px', position: 'relative', overflow: 'hidden', minWidth: 0,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, opacity: .75 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH }}>{label}</div>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={accent} />
        </div>
      </div>
      <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 800, color: BLK, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function OppRow({ opp }) {
  const src = SOURCE[opp.source] || SOURCE.manual
  const SrcIcon = src.icon
  return (
    <Link
      to={`/scout/opportunities/${opp.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 10,
        background: '#fff', border: '1px solid #eef0f2',
        textDecoration: 'none', transition: 'all .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#eef0f2'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: src.color + '15',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <SrcIcon size={16} color={src.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {opp.hot && <Flame size={12} color={R} />}
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {opp.company_name || opp.contact_name || 'Unnamed'}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>{STAGE_LABEL[opp.stage] || opp.stage}</span>
          {opp.contact_name && opp.company_name && <span>· {opp.contact_name}</span>}
          {opp.last_touch_at && <span>· {fmtRelative(opp.last_touch_at)}</span>}
          {opp.deal_value != null && <span>· {fmtMoney(opp.deal_value)}</span>}
        </div>
      </div>
      <ChevronRight size={16} color="#9ca3af" />
    </Link>
  )
}

export default function ScoutDashboardPage() {
  const { agencyId } = useAuth()
  const isMobile = useMobile()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [stats, setStats] = useState(null)
  const [hot, setHot] = useState([])
  const [recent, setRecent] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const [statsRes, hotRes, recentRes] = await Promise.all([
          fetch('/api/opportunities?action=stats', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/opportunities?action=list&hot=true&limit=10', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/opportunities?action=list&limit=20', { credentials: 'include' }).then(r => r.json()),
        ])
        if (cancelled) return
        setStats(statsRes)
        setHot(hotRes.opportunities || [])
        setRecent(recentRes.opportunities || [])
      } catch (e) {
        if (!cancelled) setErr(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [agencyId])

  const inProposal = stats?.by_stage?.proposal || 0
  const won = stats?.by_stage?.won || 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fafafa', fontFamily: FB }}>
      <Sidebar />
      <main style={{ flex: 1, padding: isMobile ? 16 : 28, maxWidth: 1280, margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Scout</div>
          <h1 style={{ fontFamily: FH, fontSize: 30, fontWeight: 800, color: BLK, margin: 0 }}>Dashboard</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: '4px 0 0' }}>
            Every call, email, and deal signal across the revenue funnel.
          </p>
        </div>

        {err && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 16 }}>
            <AlertCircle size={16} /> {err}
          </div>
        )}

        {loading && !stats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280' }}>
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        )}

        {/* Stats row */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: 12, marginBottom: 18,
          }}>
            <StatCard label="Total opps" value={stats.total ?? 0} icon={Target} accent={T} />
            <StatCard label="Hot" value={stats.hot ?? 0} sub="Flagged or score ≥ 70" icon={Flame} accent={R} />
            <StatCard label="New today" value={stats.today ?? 0} icon={TrendingUp} accent={GRN} />
            <StatCard label="In GHL" value={stats.in_ghl ?? 0} sub={`${won} won · ${inProposal} in proposal`} icon={ArrowUpRight} accent={AMB} />
          </div>
        )}

        {/* Pipeline by stage */}
        {stats?.by_stage && (
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
            padding: '18px 20px', marginBottom: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: 0 }}>Pipeline by stage</h2>
              <Link to="/opportunities" style={{ fontSize: 12, fontWeight: 700, color: T, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                View all →
              </Link>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
              gap: 10,
            }}>
              {STAGES.map(s => (
                <Link
                  key={s}
                  to={`/opportunities?stage=${s}`}
                  style={{
                    textAlign: 'center', padding: '14px 8px', borderRadius: 10,
                    background: STAGE_COLOR[s] + '0e', border: `1px solid ${STAGE_COLOR[s]}25`,
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: STAGE_COLOR[s], lineHeight: 1 }}>
                    {stats.by_stage[s] ?? 0}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4 }}>
                    {STAGE_LABEL[s]}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Two-column: hot + recent */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16,
        }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Flame size={15} color={R} />
              <h2 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: 0 }}>Hot opportunities</h2>
            </div>
            {hot.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', padding: '16px 0' }}>
                Nothing hot right now. Flag an opp or score ≥ 70 to light it up.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hot.map(o => <OppRow key={o.id} opp={o} />)}
              </div>
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <TrendingUp size={15} color={T} />
              <h2 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: 0 }}>Recent</h2>
            </div>
            {recent.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', padding: '16px 0' }}>
                No opportunities yet. Scout prospects or wait for inbound activity.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recent.slice(0, 10).map(o => <OppRow key={o.id} opp={o} />)}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
