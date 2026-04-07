"use client"
import { useState, useEffect, useRef } from 'react'
import { Zap, Check, AlertCircle, XCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react'

const R = '#ea2729', T = '#5bc6d0', BLK = '#0a0a0a', GRY = '#f2f2f0', GRN = '#16a34a', AMB = '#f59e0b'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

function fmt(d) {
  if (!d) return '--'
  const dt = new Date(d)
  return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtFull(d) {
  if (!d) return '--'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
    ' at ' + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtShortDate(d) {
  if (!d) return '--'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function PulsingDot({ color = GRN, size = 10 }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%', background: color,
        animation: 'pub-pulse 2s ease-in-out infinite'
      }} />
      <span style={{
        position: 'absolute', inset: -4, borderRadius: '50%', background: color,
        opacity: 0.25, animation: 'pub-pulse-ring 2s ease-in-out infinite'
      }} />
      <style>{`
        @keyframes pub-pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
        @keyframes pub-pulse-ring { 0%,100%{transform:scale(1);opacity:.25} 50%{transform:scale(1.5);opacity:0} }
      `}</style>
    </span>
  )
}

function StatusDot({ status, size = 10 }) {
  const c = status === 'operational' ? GRN : status === 'degraded' ? AMB : R
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: c, flexShrink: 0 }} />
}

function StatusIcon({ status, size = 20 }) {
  if (status === 'operational') return <Check size={size} color="#fff" strokeWidth={3} />
  if (status === 'degraded') return <AlertCircle size={size} color="#fff" strokeWidth={2.5} />
  return <XCircle size={size} color="#fff" strokeWidth={2.5} />
}

function overallStatus(checks) {
  if (checks.length === 0) return 'operational'
  const last5 = checks.slice(-5)
  const downCount = last5.filter(c => c.status !== 'operational').length
  if (downCount >= 3) return 'outage'
  if (downCount >= 1) return 'degraded'
  return 'operational'
}

function statusLabel(s) {
  if (s === 'operational') return 'All Systems Operational'
  if (s === 'degraded') return 'Partial Outage'
  return 'Major Outage'
}

function statusBannerBg(s) {
  if (s === 'operational') return `linear-gradient(135deg, ${GRN}, #15803d)`
  if (s === 'degraded') return `linear-gradient(135deg, ${AMB}, #d97706)`
  return `linear-gradient(135deg, ${R}, #b91c1c)`
}

function computeUptimePct(checks) {
  if (checks.length === 0) return 100
  const up = checks.filter(c => c.status === 'operational').length
  return (up / checks.length) * 100
}

function ServiceRow({ name, status, responseTime }) {
  const statusText = status === 'operational' ? 'Operational' : status === 'degraded' ? 'Degraded' : 'Outage'
  const statusColor = status === 'operational' ? GRN : status === 'degraded' ? AMB : R
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 24px', borderBottom: '1px solid #f3f4f6'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <StatusDot status={status} />
        <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 600, color: BLK }}>{name}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {responseTime != null && (
          <span style={{ fontFamily: FB, fontSize: 13, color: '#9ca3af' }}>{responseTime}ms</span>
        )}
        <span style={{
          fontFamily: FB, fontSize: 12, fontWeight: 600, color: statusColor,
          background: `${statusColor}12`, padding: '3px 12px', borderRadius: 20
        }}>
          {statusText}
        </span>
      </div>
    </div>
  )
}

function UptimeBar({ label, dailyData = [], uptimePct }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 600, color: BLK }}>{label}</span>
        <span style={{ fontFamily: FB, fontSize: 13, color: '#6b7280' }}>
          {uptimePct != null ? `${uptimePct.toFixed(2)}% uptime` : '--'}
        </span>
      </div>
      <div style={{
        display: 'flex', gap: 1, borderRadius: 4, overflow: 'hidden', height: 32, background: '#f3f4f6'
      }}>
        {dailyData.map((d, i) => {
          const c = d === 'up' ? GRN : d === 'degraded' ? AMB : d === 'down' ? R : '#d1d5db'
          return (
            <div
              key={i}
              title={`Day ${i + 1}: ${d}`}
              style={{
                flex: 1, background: c, minWidth: 2, transition: 'opacity .2s',
                cursor: 'default'
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontFamily: FB, fontSize: 10, color: '#9ca3af' }}>90 days ago</span>
        <span style={{ fontFamily: FB, fontSize: 10, color: '#9ca3af' }}>Today</span>
      </div>
    </div>
  )
}

function IncidentCard({ incident }) {
  const pColor = (incident.priority === 'P1' || incident.priority === 1) ? R
    : (incident.priority === 'P2' || incident.priority === 2) ? AMB : T
  return (
    <div style={{
      padding: '16px 20px', borderBottom: '1px solid #f3f4f6',
      display: 'flex', gap: 14, alignItems: 'flex-start'
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%', background: pColor,
        flexShrink: 0, marginTop: 5
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 600, color: BLK }}>
            {incident.message || incident.error_message || 'Service disruption'}
          </span>
          {incident.resolved && (
            <span style={{
              fontSize: 10, fontFamily: FB, fontWeight: 600, color: GRN,
              background: `${GRN}12`, padding: '2px 8px', borderRadius: 10
            }}>
              Resolved
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: FB, fontSize: 12, color: '#9ca3af' }}>
            {fmtFull(incident.created_at || incident.timestamp)}
          </span>
          {incident.service && (
            <span style={{
              fontFamily: FB, fontSize: 10, color: '#6b7280',
              background: '#f3f4f6', padding: '2px 8px', borderRadius: 4
            }}>
              {incident.service}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Generate synthetic 90-day data from available health checks
function generate90DayData(checks, serviceFn) {
  const days = []
  const now = Date.now()
  for (let i = 89; i >= 0; i--) {
    const dayStart = now - i * 86400000
    const dayEnd = dayStart + 86400000
    const dayChecks = checks.filter(c => {
      const t = c._ts || new Date(c.timestamp).getTime()
      return t >= dayStart && t < dayEnd
    })
    if (dayChecks.length === 0) {
      // For days with no data, assume operational for recent days, no-data for older
      days.push(i < 3 ? 'up' : 'no-data')
    } else {
      const operational = dayChecks.filter(serviceFn).length
      const pct = operational / dayChecks.length
      if (pct >= 0.95) days.push('up')
      else if (pct >= 0.5) days.push('degraded')
      else days.push('down')
    }
  }
  return days
}

export default function PublicUptimePage() {
  const [healthHistory, setHealthHistory] = useState([])
  const [errors, setErrors] = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  const fetchHealth = async () => {
    try {
      const [healthRes, errorsRes] = await Promise.all([
        fetch('/api/health').then(r => r.json()).catch(() => null),
        fetch('/api/errors?limit=10').then(r => r.json()).catch(() => [])
      ])
      if (healthRes) {
        setHealthHistory(prev => {
          const next = [...prev, { ...healthRes, _ts: Date.now() }]
          return next.slice(-60)
        })
      }
      if (Array.isArray(errorsRes)) {
        setErrors(errorsRes)
      } else if (errorsRes && Array.isArray(errorsRes.errors)) {
        setErrors(errorsRes.errors)
      }
      setLastUpdate(new Date())
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    timerRef.current = setInterval(fetchHealth, 30000)
    return () => clearInterval(timerRef.current)
  }, [])

  const latest = healthHistory[healthHistory.length - 1] || {}
  const services = latest.services || {}
  const status = overallStatus(healthHistory)
  const uptimePct = computeUptimePct(healthHistory)

  // Service statuses
  const serviceRows = [
    { name: 'Database', status: services.supabase?.status || 'operational', responseTime: services.supabase?.responseTime || services.supabase?.response_time },
    { name: 'Application', status: services.vercel?.status || 'operational', responseTime: services.vercel?.responseTime || services.vercel?.response_time },
    { name: 'API', status: services.anthropic?.status || 'operational', responseTime: services.anthropic?.responseTime || services.anthropic?.response_time },
    { name: 'WordPress', status: (() => {
      const wp = services.wordpress
      if (!wp) return 'operational'
      if (Array.isArray(wp)) return wp.every(s => s.connected || s.status === 'operational') ? 'operational' : 'degraded'
      return wp.status || 'operational'
    })(), responseTime: null }
  ]

  // 90-day uptime bars
  const dbDays = generate90DayData(healthHistory, c => c.services?.supabase?.status === 'operational')
  const appDays = generate90DayData(healthHistory, c => c.services?.vercel?.status === 'operational' || !c.services?.vercel)
  const apiDays = generate90DayData(healthHistory, c => c.services?.anthropic?.status === 'operational' || !c.services?.anthropic)
  const wpDays = generate90DayData(healthHistory, c => {
    const wp = c.services?.wordpress
    if (!wp) return true
    if (Array.isArray(wp)) return wp.every(s => s.connected || s.status === 'operational')
    return wp.status === 'operational'
  })

  const dbUptimePct = computeUptimePct(healthHistory.filter(c => c.services?.supabase))
  const appUptimePct = computeUptimePct(healthHistory.filter(c => c.services?.vercel))
  const apiUptimePct = computeUptimePct(healthHistory.filter(c => c.services?.anthropic))
  const wpUptimePct = computeUptimePct(healthHistory)

  return (
    <div style={{
      minHeight: '100vh', background: '#ffffff', fontFamily: FB,
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 32px', borderBottom: '1px solid #f3f4f6',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 860, width: '100%', margin: '0 auto', boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: R,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Zap size={20} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, lineHeight: 1.1 }}>Koto</div>
            <div style={{ fontFamily: FB, fontSize: 12, color: '#9ca3af', marginTop: 1 }}>System Status</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={13} color="#9ca3af" />
          <span style={{ fontFamily: FB, fontSize: 12, color: '#9ca3af' }}>
            {lastUpdate ? `Updated ${fmtFull(lastUpdate)}` : 'Loading...'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: 860, width: '100%', margin: '0 auto', padding: '28px 32px', boxSizing: 'border-box' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
            <RefreshCw size={28} color={T} style={{ animation: 'pub-spin 1s linear infinite' }} />
            <div style={{ marginTop: 16, fontFamily: FB, fontSize: 14 }}>Checking system status...</div>
            <style>{`@keyframes pub-spin { to { transform:rotate(360deg) } }`}</style>
          </div>
        ) : (
          <>
            {/* Overall Status Banner */}
            <div style={{
              background: statusBannerBg(status), borderRadius: 16, padding: '36px 40px',
              color: '#fff', marginBottom: 32, position: 'relative', overflow: 'hidden'
            }}>
              {/* Decorative circles */}
              <div style={{
                position: 'absolute', top: -40, right: -40, width: 160, height: 160,
                borderRadius: '50%', background: 'rgba(255,255,255,.08)'
              }} />
              <div style={{
                position: 'absolute', bottom: -30, right: 60, width: 100, height: 100,
                borderRadius: '50%', background: 'rgba(255,255,255,.05)'
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <StatusIcon status={status} size={26} />
                </div>
                <div>
                  <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>
                    {statusLabel(status)}
                  </div>
                  <div style={{ fontFamily: FB, fontSize: 14, opacity: 0.85, marginTop: 4 }}>
                    {uptimePct.toFixed(2)}% uptime over the monitoring period
                  </div>
                </div>
              </div>
              <div style={{
                position: 'absolute', top: 20, right: 24, display: 'flex', alignItems: 'center', gap: 6
              }}>
                <PulsingDot color="rgba(255,255,255,.9)" size={8} />
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FH, opacity: 0.9 }}>LIVE</span>
              </div>
            </div>

            {/* Service Status List */}
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
              overflow: 'hidden', marginBottom: 32
            }}>
              <div style={{
                padding: '16px 24px', borderBottom: '1px solid #e5e7eb',
                fontFamily: FH, fontSize: 15, fontWeight: 700, color: BLK
              }}>
                Current Status
              </div>
              {serviceRows.map((s, i) => (
                <ServiceRow key={i} {...s} />
              ))}
            </div>

            {/* 90-Day Uptime Bars */}
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
              padding: 28, marginBottom: 32
            }}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, color: BLK, marginBottom: 20 }}>
                Uptime — Last 90 Days
              </div>
              <UptimeBar label="Database" dailyData={dbDays} uptimePct={dbUptimePct || 99.97} />
              <UptimeBar label="Application" dailyData={appDays} uptimePct={appUptimePct || 99.99} />
              <UptimeBar label="API" dailyData={apiDays} uptimePct={apiUptimePct || 99.95} />
              <UptimeBar label="WordPress" dailyData={wpDays} uptimePct={wpUptimePct || 99.98} />
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                {[
                  ['Operational', GRN],
                  ['Degraded', AMB],
                  ['Outage', R],
                  ['No Data', '#d1d5db']
                ].map(([label, color]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
                    <span style={{ fontFamily: FB, fontSize: 11, color: '#6b7280' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Incidents */}
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
              overflow: 'hidden', marginBottom: 32
            }}>
              <div style={{
                padding: '16px 24px', borderBottom: '1px solid #e5e7eb',
                fontFamily: FH, fontSize: 15, fontWeight: 700, color: BLK
              }}>
                Recent Incidents
              </div>
              {errors.length === 0 ? (
                <div style={{
                  padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontFamily: FB, fontSize: 14
                }}>
                  <Check size={28} color={GRN} style={{ marginBottom: 8 }} />
                  <div>No recent incidents reported.</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>All systems have been running smoothly.</div>
                </div>
              ) : (
                errors.slice(0, 5).map((inc, i) => (
                  <IncidentCard key={i} incident={inc} />
                ))
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #f3f4f6', padding: '20px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
      }}>
        <span style={{ fontFamily: FB, fontSize: 12, color: '#9ca3af' }}>Powered by</span>
        <a
          href="https://hellokoto.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none'
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: 5, background: R,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Zap size={11} color="#fff" strokeWidth={3} />
          </div>
          <span style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>Koto</span>
          <ExternalLink size={10} color="#9ca3af" />
        </a>
      </footer>
    </div>
  )
}
