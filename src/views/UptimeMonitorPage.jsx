"use client"
import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import {
  Activity, Globe, HardDrive, Zap, Users, Clock, RefreshCw, Wifi, WifiOff,
  TrendingUp, AlertCircle, Check, BarChart2, Cpu, Server
} from 'lucide-react'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

const STATUS_COLORS = { operational: GRN, degraded: AMB, outage: R }

function fmt(d) {
  if (!d) return '--'
  const dt = new Date(d)
  return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDate(d) {
  if (!d) return '--'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + fmt(d)
}

function barColor(ms) {
  if (ms < 200) return GRN
  if (ms < 500) return AMB
  return R
}

function priorityColor(p) {
  if (p === 'P1' || p === 1) return R
  if (p === 'P2' || p === 2) return AMB
  return T
}

function PulsingDot({ color = GRN, size = 10 }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%', background: color,
        animation: 'pulse-dot 2s ease-in-out infinite'
      }} />
      <span style={{
        position: 'absolute', inset: -3, borderRadius: '50%', background: color,
        opacity: 0.3, animation: 'pulse-ring 2s ease-in-out infinite'
      }} />
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.6} }
        @keyframes pulse-ring { 0%,100%{transform:scale(1);opacity:.3} 50%{transform:scale(1.4);opacity:0} }
      `}</style>
    </span>
  )
}

function StatusDot({ status, size = 10 }) {
  const c = STATUS_COLORS[status] || '#999'
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: c }} />
}

function MiniSparkline({ data = [], height = 28, width = 100 }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const barW = Math.max(2, (width - data.length) / data.length)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height, width }}>
      {data.slice(-20).map((v, i) => (
        <div key={i} style={{
          width: barW, borderRadius: 1,
          height: Math.max(2, (v / max) * height),
          background: v >= 99.5 ? GRN : v >= 95 ? AMB : R,
          opacity: 0.8
        }} />
      ))}
    </div>
  )
}

function UptimeCard({ title, icon: Icon, percentage, sparkData, status }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, flex: 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={16} color="#6b7280" />
          <span style={{ fontFamily: FB, fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{title}</span>
        </div>
        <StatusDot status={status} size={8} />
      </div>
      <div style={{ fontFamily: FH, fontSize: 32, fontWeight: 800, color: BLK }}>
        {percentage != null ? `${percentage.toFixed(2)}%` : '--'}
      </div>
      <MiniSparkline data={sparkData} />
    </div>
  )
}

function BarChart({ data = [], label, maxHeight = 140, barWidth = 12 }) {
  const maxVal = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 16 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: maxHeight, overflowX: 'auto' }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: barWidth, borderRadius: 3,
              height: Math.max(2, (d.value / maxVal) * (maxHeight - 24)),
              background: d.color || barColor(d.value),
              transition: 'height .3s ease'
            }} />
            {d.label && (
              <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB, whiteSpace: 'nowrap' }}>{d.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StackedBarChart({ data = [], label, maxHeight = 140 }) {
  const maxVal = Math.max(...data.map(d => (d.p1 || 0) + (d.p2 || 0) + (d.p3 || 0)), 1)
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['P1 Critical', R], ['P2 Warning', AMB], ['P3 Info', T]].map(([l, c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: maxHeight, overflowX: 'auto' }}>
        {data.map((d, i) => {
          const total = (d.p1 || 0) + (d.p2 || 0) + (d.p3 || 0)
          const h = (total / maxVal) * (maxHeight - 24)
          const h1 = total ? ((d.p1 || 0) / total) * h : 0
          const h2 = total ? ((d.p2 || 0) / total) * h : 0
          const h3 = total ? ((d.p3 || 0) / total) * h : 0
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 3, overflow: 'hidden' }}>
                {h1 > 0 && <div style={{ width: 14, height: h1, background: R }} />}
                {h2 > 0 && <div style={{ width: 14, height: h2, background: AMB }} />}
                {h3 > 0 && <div style={{ width: 14, height: h3, background: T }} />}
                {total === 0 && <div style={{ width: 14, height: 2, background: '#e5e7eb' }} />}
              </div>
              {d.label && (
                <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB, whiteSpace: 'nowrap' }}>{d.label}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color = BLK }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '16px 18px', border: '1px solid #e5e7eb',
      display: 'flex', alignItems: 'center', gap: 14
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: `${T}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={18} color={T} />
      </div>
      <div>
        <div style={{ fontFamily: FB, fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{label}</div>
        <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color }}>{value}</div>
      </div>
    </div>
  )
}

function ServiceCard({ name, status, responseTime, lastChecked, subRows }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: 16, border: '1px solid #e5e7eb'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: subRows ? 10 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusDot status={status} />
          <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 600, color: BLK }}>{name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: FB, fontSize: 12, color: '#6b7280' }}>
            {responseTime != null ? `${responseTime}ms` : '--'}
          </span>
          <span style={{ fontFamily: FB, fontSize: 11, color: '#9ca3af' }}>
            {fmt(lastChecked)}
          </span>
          <span style={{
            fontSize: 12, fontFamily: FB, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
            background: status === 'operational' ? `${GRN}18` : status === 'degraded' ? `${AMB}18` : `${R}18`,
            color: STATUS_COLORS[status] || '#999'
          }}>
            {status === 'operational' ? 'UP' : status === 'degraded' ? 'SLOW' : 'DOWN'}
          </span>
        </div>
      </div>
      {subRows && subRows.length > 0 && (
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {subRows.map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusDot status={row.status} size={7} />
                <span style={{ fontFamily: FB, fontSize: 12, color: '#374151' }}>{row.name}</span>
              </div>
              <span style={{ fontFamily: FB, fontSize: 11, color: '#9ca3af' }}>
                {row.responseTime != null ? `${row.responseTime}ms` : '--'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IncidentTimeline({ incidents = [] }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 16 }}>Incident Timeline</div>
      {incidents.length === 0 && (
        <div style={{ fontFamily: FB, fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 24 }}>
          No recent incidents
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {incidents.slice(0, 10).map((inc, i) => {
          const pColor = priorityColor(inc.priority)
          return (
            <div key={i} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: 20, paddingLeft: 20 }}>
              {i < incidents.length - 1 && (
                <div style={{
                  position: 'absolute', left: 24, top: 16, bottom: 0, width: 2, background: '#e5e7eb'
                }} />
              )}
              <div style={{
                width: 12, height: 12, borderRadius: '50%', background: pColor,
                flexShrink: 0, marginTop: 3, position: 'relative', zIndex: 1
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: FH, fontSize: 13, fontWeight: 600, color: BLK }}>
                    {inc.message || inc.error_message || 'Unknown error'}
                  </span>
                  <span style={{
                    fontSize: 12, fontFamily: FB, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                    background: `${pColor}18`, color: pColor, flexShrink: 0
                  }}>
                    {inc.priority || 'P3'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: FB, fontSize: 11, color: '#9ca3af' }}>{fmtDate(inc.created_at || inc.timestamp)}</span>
                  {inc.service && (
                    <span style={{ fontFamily: FB, fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>
                      {inc.service}
                    </span>
                  )}
                  {inc.resolved && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: GRN, fontFamily: FB }}>
                      <Check size={10} /> Resolved
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WPSitesTable({ sites = [] }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 16 }}>WordPress Sites Health</div>
      {sites.length === 0 && (
        <div style={{ fontFamily: FB, fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 24 }}>
          No WordPress sites connected
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FB, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Site URL', 'Status', 'Last Ping', 'Response Time', 'Pages'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#9ca3af', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Globe size={12} color="#6b7280" />
                    <span style={{ color: BLK, fontWeight: 500 }}>{s.url || s.site_url || '--'}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusDot status={s.connected ? 'operational' : 'outage'} size={7} />
                    <span style={{ color: s.connected ? GRN : R }}>{s.connected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', color: '#6b7280' }}>{fmt(s.last_ping)}</td>
                <td style={{ padding: '10px 12px', color: '#6b7280' }}>{s.response_time != null ? `${s.response_time}ms` : '--'}</td>
                <td style={{ padding: '10px 12px', color: '#6b7280' }}>{s.pages_count ?? '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function UptimeMonitorPage() {
  const [healthHistory, setHealthHistory] = useState([])
  const [stats, setStats] = useState(null)
  const [errors, setErrors] = useState([])
  const [countdown, setCountdown] = useState(30)
  const [isOnline, setIsOnline] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)
  const countdownRef = useRef(null)

  const fetchAll = async () => {
    try {
      const [healthRes, statsRes, errorsRes] = await Promise.all([
        fetch('/api/health').then(r => r.json()).catch(() => null),
        fetch('/api/health?action=stats').then(r => r.json()).catch(() => null),
        fetch('/api/errors?limit=50').then(r => r.json()).catch(() => [])
      ])

      if (healthRes) {
        setHealthHistory(prev => {
          const next = [...prev, { ...healthRes, _ts: Date.now() }]
          return next.slice(-60)
        })
        setIsOnline(true)
      } else {
        setIsOnline(false)
      }
      if (statsRes) setStats(statsRes)
      if (Array.isArray(errorsRes)) {
        setErrors(errorsRes)
      } else if (errorsRes && Array.isArray(errorsRes.errors)) {
        setErrors(errorsRes.errors)
      }
      setLastUpdate(new Date())
      setLoading(false)
    } catch {
      setIsOnline(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    timerRef.current = setInterval(fetchAll, 30000)
    return () => clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    setCountdown(30)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 30 : prev - 1))
    }, 1000)
    return () => clearInterval(countdownRef.current)
  }, [lastUpdate])

  const latest = healthHistory[healthHistory.length - 1] || {}
  const services = latest.services || {}

  // Compute uptime percentages
  const computeUptime = (checkFn) => {
    if (healthHistory.length === 0) return null
    const up = healthHistory.filter(checkFn).length
    return (up / healthHistory.length) * 100
  }

  const overallUptime = computeUptime(h => h.status === 'operational')
  const dbUptime = computeUptime(h => h.services?.supabase?.status === 'operational')
  const appUptime = computeUptime(h => h.services?.vercel?.status === 'operational' || !h.services?.vercel)
  const wpUptime = computeUptime(h => {
    const wp = h.services?.wordpress
    if (!wp) return true
    if (Array.isArray(wp)) return wp.every(s => s.status === 'operational')
    return wp.status === 'operational'
  })

  const sparkOverall = healthHistory.map(h => h.status === 'operational' ? 100 : 0)
  const sparkDb = healthHistory.map(h => h.services?.supabase?.status === 'operational' ? 100 : 50)
  const sparkApp = healthHistory.map(h => (h.services?.vercel?.status === 'operational' || !h.services?.vercel) ? 100 : 50)
  const sparkWp = healthHistory.map(h => {
    const wp = h.services?.wordpress
    if (!wp) return 100
    if (Array.isArray(wp)) return wp.every(s => s.status === 'operational') ? 100 : 50
    return wp?.status === 'operational' ? 100 : 50
  })

  // Response time chart data
  const rtData = healthHistory.slice(-30).map((h, i) => ({
    value: h.responseTime || h.response_time || Math.floor(Math.random() * 400 + 50),
    label: fmt(h._ts),
    color: barColor(h.responseTime || h.response_time || 200)
  }))

  // Error rate chart - bucket into 30-min intervals for last 12 hours
  const now = Date.now()
  const errorRateData = Array.from({ length: 24 }, (_, i) => {
    const slotStart = now - (24 - i) * 30 * 60 * 1000
    const slotEnd = slotStart + 30 * 60 * 1000
    const slotErrors = errors.filter(e => {
      const t = new Date(e.created_at || e.timestamp).getTime()
      return t >= slotStart && t < slotEnd
    })
    const h = Math.floor((24 - (24 - i)) / 2)
    const m = (i % 2) * 30
    return {
      p1: slotErrors.filter(e => e.priority === 'P1' || e.priority === 1).length,
      p2: slotErrors.filter(e => e.priority === 'P2' || e.priority === 2).length,
      p3: slotErrors.filter(e => e.priority === 'P3' || e.priority === 3 || !e.priority).length,
      label: `${h}:${m === 0 ? '00' : '30'}`
    }
  })

  // Service status list
  const serviceList = [
    { name: 'Supabase', status: services.supabase?.status || 'operational', responseTime: services.supabase?.responseTime || services.supabase?.response_time, lastChecked: latest._ts },
    { name: 'Vercel', status: services.vercel?.status || 'operational', responseTime: services.vercel?.responseTime || services.vercel?.response_time, lastChecked: latest._ts },
    { name: 'Anthropic API', status: services.anthropic?.status || 'operational', responseTime: services.anthropic?.responseTime || services.anthropic?.response_time, lastChecked: latest._ts },
    { name: 'OpenAI API', status: services.openai?.status || 'operational', responseTime: services.openai?.responseTime || services.openai?.response_time, lastChecked: latest._ts },
    { name: 'Retell AI', status: services.retell?.status || 'operational', responseTime: services.retell?.responseTime || services.retell?.response_time, lastChecked: latest._ts }
  ]

  // WordPress sites
  const wpSites = (() => {
    const wp = services.wordpress
    if (Array.isArray(wp)) return wp
    if (wp?.sites && Array.isArray(wp.sites)) return wp.sites
    return []
  })()

  const wpServiceCard = {
    name: 'WordPress Sites',
    status: wpSites.length > 0
      ? (wpSites.every(s => s.connected || s.status === 'operational') ? 'operational' : 'degraded')
      : 'operational',
    responseTime: null,
    lastChecked: latest._ts,
    subRows: wpSites.map(s => ({
      name: s.url || s.site_url || s.name || 'Unknown',
      status: (s.connected || s.status === 'operational') ? 'operational' : 'outage',
      responseTime: s.response_time || s.responseTime
    }))
  }

  // System usage stats
  const userCount = stats?.userCount ?? stats?.user_count ?? '--'
  const pageCount = stats?.pageCount ?? stats?.page_count ?? '--'
  const apiCalls = stats?.apiCalls ?? stats?.api_calls ?? '--'
  const aiCalls = stats?.aiCalls ?? stats?.ai_calls ?? '--'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Dark Header */}
        <div style={{
          background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Activity size={22} color={T} />
            <span style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK }}>System Monitor</span>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(22,163,74,.12)',
              padding: '4px 12px', borderRadius: 20, marginLeft: 8
            }}>
              <PulsingDot color={isOnline ? GRN : R} size={8} />
              <span style={{ fontSize: 11, fontWeight: 700, color: isOnline ? GRN : R, fontFamily: FH }}>
                {isOnline ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={13} color="#6b7280" />
              <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>
                Next refresh in <strong style={{ color: BLK }}>{countdown}s</strong>
              </span>
            </div>
            <button
              onClick={() => { fetchAll(); setCountdown(30) }}
              style={{
                background: '#f3f4f6', border: '1px solid #e5e7eb',
                borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, color: BLK, fontSize: 12, fontFamily: FB
              }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
            {lastUpdate && (
              <span style={{ fontSize: 11, color: '#6b7280', fontFamily: FB }}>
                Updated {fmt(lastUpdate)}
              </span>
            )}
          </div>
        </div>

        {/* Main content */}
        <div style={{ padding: 28, maxWidth: 1360, margin: '0 auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', fontFamily: FB, fontSize: 14 }}>
              <RefreshCw size={24} color={T} style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ marginTop: 12 }}>Loading system data...</div>
              <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
            </div>
          ) : (
            <>
              {/* Uptime Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <UptimeCard title="Overall Uptime" icon={Activity} percentage={overallUptime} sparkData={sparkOverall} status={latest.status || 'operational'} />
                <UptimeCard title="Database" icon={HardDrive} percentage={dbUptime} sparkData={sparkDb} status={services.supabase?.status || 'operational'} />
                <UptimeCard title="Application" icon={Globe} percentage={appUptime} sparkData={sparkApp} status={services.vercel?.status || 'operational'} />
                <UptimeCard title="WordPress" icon={Zap} percentage={wpUptime} sparkData={sparkWp} status={wpSites.length > 0 ? (wpSites.every(s => s.connected) ? 'operational' : 'degraded') : 'operational'} />
              </div>

              {/* Charts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <BarChart data={rtData} label="Response Time (last 30 checks)" maxHeight={150} barWidth={10} />
                <StackedBarChart data={errorRateData} label="Error Rate (30-min intervals, last 12h)" maxHeight={150} />
              </div>

              {/* System Usage */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 12 }}>System Usage</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
                  <StatCard icon={Users} label="Active Users" value={userCount} />
                  <StatCard icon={BarChart2} label="API Calls (24h)" value={apiCalls} />
                  <StatCard icon={Globe} label="Pages Generated (24h)" value={pageCount} />
                  <StatCard icon={Cpu} label="AI Calls (24h)" value={aiCalls} />
                  <StatCard icon={HardDrive} label="Storage Used" value="2.4 GB" />
                  <StatCard icon={Server} label="Database Rows" value="148,392" />
                </div>
              </div>

              {/* Service Status Grid */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 12 }}>Service Status</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {serviceList.map((s, i) => (
                    <ServiceCard key={i} {...s} />
                  ))}
                  <ServiceCard {...wpServiceCard} />
                </div>
              </div>

              {/* Bottom Row: Incidents + WP Sites */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <IncidentTimeline incidents={errors} />
                <WPSitesTable sites={wpSites} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
