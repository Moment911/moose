"use client"
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import { Shield, CheckCircle, AlertCircle, XCircle, RefreshCw, Loader2, Wrench, Zap, Clock, Database, Globe, Plug, BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

const STATUS_CONFIG = {
  pass:       { label: 'Pass', color: GRN, icon: CheckCircle, bg: GRN + '12' },
  warn:       { label: 'Warning', color: AMB, icon: AlertCircle, bg: AMB + '12' },
  fail:       { label: 'Failed', color: R, icon: XCircle, bg: R + '12' },
  auto_fixed: { label: 'Auto-Fixed', color: T, icon: Wrench, bg: T + '12' },
}

const CAT_ICONS = {
  database: Database, api: Globe, env: Shield, integration: Plug, data: BarChart2, performance: Zap,
}

export default function SystemHealthPage() {
  const { agencyId, user } = useAuth()
  const [scan, setScan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const adminId = '00000000-0000-0000-0000-000000000099'
    setIsAdmin(agencyId === adminId || user?.email === 'adam@momentamktg.com' || user?.email === 'adam@unifiedmktg.com')
  }, [agencyId, user])

  // Load latest scan
  useEffect(() => {
    fetch('/api/system-health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'latest' }) })
      .then(r => r.json()).then(res => { if (res.scan) setScan(res.scan); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const runScan = async () => {
    setScanning(true)
    toast.loading('Running full system health scan...', { id: 'health' })
    try {
      const res = await fetch('/api/system-health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'full_scan' }) })
      const data = await res.json()
      toast.success(`Scan complete — ${data.summary.pass} pass, ${data.summary.fail} fail, ${data.summary.auto_fixed} auto-fixed`, { id: 'health' })
      setScan(data)
    } catch { toast.error('Scan failed', { id: 'health' }) }
    setScanning(false)
  }

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: GRY, fontFamily: FB }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <Shield size={48} color={R} style={{ margin: '0 auto 16px', opacity: .4 }} />
            <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: BLK, marginBottom: 8 }}>Koto Admin Only</div>
            <div style={{ fontSize: 14, color: '#6b7280' }}>System health is only visible to Koto administrators.</div>
          </div>
        </div>
      </div>
    )
  }

  const s = scan?.summary || null
  const checks = scan?.checks || []
  const overallColor = s?.overall === 'healthy' ? GRN : s?.overall === 'degraded' ? AMB : R

  // Group checks by category
  const grouped = {}
  checks.forEach(c => { if (!grouped[c.category]) grouped[c.category] = []; grouped[c.category].push(c) })
  const catLabels = { database: 'Database', api: 'API Routes', env: 'Environment Variables', integration: 'External Integrations', data: 'Data Integrity', performance: 'Performance' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: BLK, letterSpacing: '-.03em' }}>System Health</div>
            <div style={{ fontSize: 14, color: '#6b7280' }}>Self-diagnosing, self-healing platform monitor</div>
          </div>
          <button onClick={runScan} disabled={scanning}
            style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: scanning ? '#e5e7eb' : T, color: '#fff', fontSize: 14, fontWeight: 700, cursor: scanning ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {scanning ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />}
            {scanning ? 'Scanning...' : 'Run Full Scan'}
          </button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={32} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div>}

        {!loading && !scan && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '60px 24px', textAlign: 'center' }}>
            <Shield size={48} color={T} style={{ margin: '0 auto 16px', opacity: .3 }} />
            <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>No scan data yet</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>Run a full system scan to check every component.</div>
            <button onClick={runScan} style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: T, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              <RefreshCw size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Run First Scan
            </button>
          </div>
        )}

        {!loading && s && (
          <>
            {/* Overall status */}
            <div style={{ background: '#fff', borderRadius: 14, border: `2px solid ${overallColor}30`, padding: '24px 32px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: overallColor + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.overall === 'healthy' ? <CheckCircle size={32} color={overallColor} /> : s.overall === 'degraded' ? <AlertCircle size={32} color={overallColor} /> : <XCircle size={32} color={overallColor} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: overallColor, textTransform: 'uppercase' }}>{s.overall}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Last scan: {s.scanned_at ? new Date(s.scanned_at).toLocaleString() : '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  [s.pass, 'Pass', GRN],
                  [s.warn, 'Warn', AMB],
                  [s.fail, 'Fail', R],
                  [s.auto_fixed, 'Auto-Fixed', T],
                ].map(([val, label, color]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color }}>{val}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Checks by category */}
            {Object.entries(grouped).map(([cat, catChecks]) => {
              const CatIcon = CAT_ICONS[cat] || Shield
              const failCount = catChecks.filter(c => c.status === 'fail').length
              const warnCount = catChecks.filter(c => c.status === 'warn').length
              const catColor = failCount > 0 ? R : warnCount > 0 ? AMB : GRN

              return (
                <div key={cat} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: catColor + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CatIcon size={14} color={catColor} />
                    </div>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, flex: 1 }}>{catLabels[cat] || cat}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {catChecks.filter(c => c.status === 'pass').length > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: GRN + '12', color: GRN }}>{catChecks.filter(c => c.status === 'pass').length} pass</span>}
                      {warnCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: AMB + '12', color: AMB }}>{warnCount} warn</span>}
                      {failCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: R + '12', color: R }}>{failCount} fail</span>}
                    </div>
                  </div>

                  {catChecks.map((check, i) => {
                    const cfg = STATUS_CONFIG[check.status] || STATUS_CONFIG.pass
                    const Icon = cfg.icon
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < catChecks.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          <Icon size={12} color={cfg.color} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{check.name}</div>
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{check.detail}</div>
                          {check.fix && <div style={{ fontSize: 12, color: R, fontWeight: 600, marginTop: 4 }}>Fix: {check.fix}</div>}
                          {check.auto_fixed_detail && <div style={{ fontSize: 12, color: T, fontWeight: 600, marginTop: 4 }}>Auto-fixed: {check.auto_fixed_detail}</div>}
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: cfg.bg, color: cfg.color, textTransform: 'uppercase', flexShrink: 0 }}>{cfg.label}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
