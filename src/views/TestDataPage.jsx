"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FlaskConical, Database, Trash2, AlertTriangle, RefreshCw, Loader2, Check, X, Zap,
  Brain, ExternalLink, ArrowRight, Mic, Phone, Eye,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'

const C = {
  bg: '#F7F7F6',
  white: '#ffffff',
  text: '#111',
  muted: '#6b7280',
  mutedDark: '#374151',
  border: '#e5e7eb',
  borderMd: '#d1d5db',
  teal: '#00C2CB',
  tealSoft: '#E6FCFD',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
  amberBorder: '#FCD34D',
  red: '#E6007E',
  redSoft: '#FEE2E2',
  redBorder: '#FCA5A5',
}

const MODULES = [
  { id: 'discovery', label: 'Discovery', desc: 'Engagements + domains seeded with placeholder structure' },
  { id: 'voice', label: 'Voice', desc: 'Test voice leads + sample call records' },
  { id: 'scout', label: 'Scout', desc: 'Scout leads with industry + score' },
  { id: 'opportunities', label: 'Opportunities', desc: 'Opportunities across all source types' },
  { id: 'clients', label: 'Clients', desc: 'Test client records' },
]

export default function TestDataPage() {
  const { agencyId, isSuperAdmin } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'
  const navigate = useNavigate()

  const [selected, setSelected] = useState(() => Object.fromEntries(MODULES.map(m => [m.id, true])))
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({})
  const [confirmText, setConfirmText] = useState('')
  const [confirmingFactory, setConfirmingFactory] = useState(false)
  const [factoryText, setFactoryText] = useState('')

  // ── Discovery Simulator state ──────────────────────────────────────
  const [discoProfiles, setDiscoProfiles] = useState([])
  const [discoRunning, setDiscoRunning] = useState(false)
  const [discoRunningProfile, setDiscoRunningProfile] = useState(null)
  const [discoResult, setDiscoResult] = useState(null)
  const [discoDeleting, setDiscoDeleting] = useState(false)

  // ── Bulk Voice Onboarding Setup state ──────────────────────────────
  const [bulkDryRun, setBulkDryRun] = useState(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResults, setBulkResults] = useState(null)
  const [bulkLog, setBulkLog] = useState([])
  const [fixingTokens, setFixingTokens] = useState(false)

  async function fixMissingTokens() {
    setFixingTokens(true)
    try {
      const res = await fetch('/api/onboarding/telnyx-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fix_missing_tokens', agency_id: aid }),
      })
      const data = await res.json()
      if (data?.error) {
        toast.error(data.error)
        setBulkLog((prev) => [`✗ fix_missing_tokens: ${data.error}`, ...prev])
      } else {
        toast.success(`Created ${data.created} onboarding tokens (${data.skipped} already existed)`)
        setBulkLog((prev) => [
          `✓ Created ${data.created} onboarding tokens · ${data.skipped} already existed · ${data.total_checked} clients checked`,
          ...prev,
        ])
      }
    } catch (e) {
      toast.error(e?.message || 'Fix tokens failed')
    } finally {
      setFixingTokens(false)
    }
  }

  async function bulkDryRunCheck() {
    try {
      const res = await fetch('/api/onboarding/telnyx-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_provision', agency_id: aid, dry_run: true }),
      })
      const data = await res.json()
      if (data?.error) {
        toast.error(data.error)
        return
      }
      setBulkDryRun(data)
    } catch (e) {
      toast.error(e?.message || 'Dry run failed')
    }
  }

  async function bulkProvisionRun() {
    if (!bulkDryRun || bulkDryRun.total === 0) return
    setBulkRunning(true)
    setBulkResults(null)
    setBulkLog([`Starting bulk provision for ${bulkDryRun.would_process || bulkDryRun.total} clients…`])
    try {
      const res = await fetch('/api/onboarding/telnyx-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_provision', agency_id: aid, dry_run: false }),
      })
      const data = await res.json()
      setBulkResults(data)
      if (data?.error) {
        setBulkLog((prev) => [`✗ ${data.error}`, ...prev])
      } else {
        // Prepend each result line to the log in order
        const lines = (data.results || []).map((r) =>
          r.status === 'provisioned'
            ? `✓ ${r.client_name} — ${r.phone_number} · PIN ${r.pin}`
            : `✗ ${r.client_name} — ${r.error || 'failed'}`
        )
        const summary = `Done · ${data.provisioned} provisioned · ${data.failed} failed · ~$${(data.estimated_monthly_cost || 0).toFixed(2)}/mo`
        const moreNote = data.has_more ? `⚠️  ${data.remaining} more clients remain — click again to continue` : ''
        setBulkLog((prev) => [summary, ...(moreNote ? [moreNote] : []), ...lines.reverse(), ...prev])
        if (data.has_more) {
          // Refresh dry-run counter so the UI reflects what's left
          bulkDryRunCheck()
        } else {
          setBulkDryRun(null)
        }
      }
    } catch (e) {
      setBulkLog((prev) => [`✗ ${e?.message || 'bulk provision failed'}`, ...prev])
    } finally {
      setBulkRunning(false)
    }
  }

  // ── Voice Onboarding Test state ────────────────────────────────────
  const [voiceTestLog, setVoiceTestLog] = useState([])
  const [voiceTestLoading, setVoiceTestLoading] = useState(false)
  const [voiceTestCallId, setVoiceTestCallId] = useState(null)
  const [voiceTestClientId, setVoiceTestClientId] = useState('')
  const [voiceTestField, setVoiceTestField] = useState('welcome_statement')
  const [voiceTestAnswer, setVoiceTestAnswer] = useState('')
  const [voiceTestPin, setVoiceTestPin] = useState('')
  const [voiceTestSpeed, setVoiceTestSpeed] = useState('normal')
  const [voiceTestResult, setVoiceTestResult] = useState(null)
  const [voiceTestProvisioning, setVoiceTestProvisioning] = useState(false)
  const [voiceTestProvision, setVoiceTestProvision] = useState(null)
  const voiceLogRef = useRef(null)

  function vlog(msg, type = 'info') {
    const icons = { info: '●', success: '✓', error: '✗', data: '→' }
    const line = `${icons[type] || '●'} [${new Date().toLocaleTimeString()}] ${msg}`
    setVoiceTestLog((prev) => [line, ...prev].slice(0, 100))
    setTimeout(() => voiceLogRef.current?.scrollTo(0, 0), 50)
  }

  async function fireVoiceTest(action, extra = {}) {
    setVoiceTestLoading(true)
    try {
      const res = await fetch('/api/onboarding/voice/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          client_id: voiceTestClientId,
          agency_id: aid,
          call_id: voiceTestCallId,
          ...extra,
        }),
      })
      const data = await res.json()
      setVoiceTestResult(data)

      if (data?.error) {
        vlog(`ERROR: ${data.error}`, 'error')
      } else {
        vlog(`${action} → ${data?.message || JSON.stringify(data).slice(0, 100)}`, 'success')
        if (data?.call_id) setVoiceTestCallId(data.call_id)
        if (data?.completion_pct !== undefined) vlog(`Completion: ${data.completion_pct}%`, 'data')
        if (data?.missing_fields?.length) vlog(`Missing: ${data.missing_fields.join(', ')}`, 'data')
        if (data?.stored_pin) vlog(`Stored PIN: ${data.stored_pin} | Entered: ${data.entered_pin}`, 'data')
      }
      return data
    } catch (e) {
      vlog(`FETCH ERROR: ${e.message}`, 'error')
    } finally {
      setVoiceTestLoading(false)
    }
  }

  async function importExistingToRetell() {
    const phone = voiceTestProvision?.phone_number
    if (!phone) { toast.error('Provision a number first (or load one onto voiceTestProvision)'); return }
    if (!voiceTestClientId) { toast.error('Paste a client ID first'); return }
    setVoiceTestLoading(true)
    vlog(`Importing ${phone} into Retell…`, 'info')
    try {
      const res = await fetch('/api/onboarding/telnyx-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import_existing',
          phone_number: phone,
          agency_id: aid,
          client_id: voiceTestClientId,
        }),
      })
      const data = await res.json()
      if (data?.error && !data?.retell_imported) {
        vlog(`Retell import failed: ${data.error}`, 'error')
      } else {
        vlog(`✓ Imported to Retell${data.agent_assigned ? ' + agent assigned' : ''}`, 'success')
        if (!data.agent_assigned && data.error) vlog(`Agent assignment warning: ${data.error}`, 'error')
      }
      setVoiceTestResult(data)
    } catch (e) {
      vlog(`Import failed: ${e.message}`, 'error')
    } finally {
      setVoiceTestLoading(false)
    }
  }

  async function quickSetupVoiceTest() {
    if (!voiceTestClientId) { toast.error('Paste a client ID first'); return }
    setVoiceTestProvisioning(true)
    vlog('Provisioning Telnyx number + PIN…', 'info')
    try {
      const res = await fetch('/api/onboarding/telnyx-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'provision', client_id: voiceTestClientId, agency_id: aid }),
      })
      const data = await res.json()
      if (data?.error) {
        // If Telnyx isn't configured, fall back to a mock so the
        // agency can still test the PIN-verify flow end to end.
        vlog(`Telnyx unavailable: ${data.error}`, 'error')
        if (data.error.includes('TELNYX_API_KEY')) {
          vlog('Falling back to mock PIN 1357 — set it directly on the client row via SQL for full testing', 'info')
          setVoiceTestProvision({ phone_number: 'mock', display_number: 'MOCK (Telnyx not configured)', pin: '1357' })
        }
      } else {
        vlog(`✓ Provisioned ${data.display_number} · PIN ${data.pin}`, 'success')
        setVoiceTestProvision(data)
        setVoiceTestPin(data.pin || '')
      }
    } catch (e) {
      vlog(`Provision failed: ${e.message}`, 'error')
    } finally {
      setVoiceTestProvisioning(false)
    }
  }

  useEffect(() => {
    // Load profiles once on mount
    fetch('/api/discovery/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'profiles', agency_id: aid }),
    })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.profiles)) setDiscoProfiles(d.profiles) })
      .catch(() => { /* non-fatal */ })
  }, [aid])

  async function runDiscoverySimulation(profileId) {
    setDiscoRunning(true)
    setDiscoRunningProfile(profileId)
    setDiscoResult(null)
    try {
      const res = await fetch('/api/discovery/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', agency_id: aid, profile_id: profileId }),
      }).then((r) => r.json())
      if (res?.ok) {
        setDiscoResult(res)
        toast.success(`${res.client_name}: ${res.field_count} fields populated`)
      } else {
        toast.error(res?.error || 'Simulation failed')
      }
    } catch (e) {
      toast.error(e?.message || 'Simulation failed')
    } finally {
      setDiscoRunning(false)
      setDiscoRunningProfile(null)
    }
  }

  async function deleteDiscoverySimulation() {
    if (!discoResult) return
    if (!confirm('Delete this test engagement and its test client?')) return
    setDiscoDeleting(true)
    try {
      await fetch('/api/discovery/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          agency_id: aid,
          engagement_id: discoResult.engagement_id,
          client_id: discoResult.client_id,
        }),
      })
      toast.success('Test engagement deleted')
      setDiscoResult(null)
    } catch (e) {
      toast.error(e?.message || 'Delete failed')
    } finally {
      setDiscoDeleting(false)
    }
  }

  const loadCounts = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/test-data?action=counts&agency_id=${aid}`).then(r => r.json()).catch(() => ({ data: {} }))
    setCounts(res?.data || {})
    setLoading(false)
  }, [aid])

  useEffect(() => { loadCounts() }, [loadCounts])

  async function generateSelected() {
    const moduleIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
    if (moduleIds.length === 0) return toast.error('Pick at least one module')
    setGenerating(true)
    setProgress({})

    for (const mod of moduleIds) {
      setProgress(p => ({ ...p, [mod]: 'running' }))
      try {
        const res = await fetch('/api/test-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: `generate_${mod}`, agency_id: aid }),
        }).then(r => r.json())
        if (res?.data) {
          setProgress(p => ({ ...p, [mod]: 'done' }))
        } else {
          setProgress(p => ({ ...p, [mod]: 'error' }))
        }
      } catch {
        setProgress(p => ({ ...p, [mod]: 'error' }))
      }
    }

    setGenerating(false)
    toast.success('Generation complete')
    loadCounts()
  }

  async function clearModule(module) {
    if (!confirm(`Clear all test data from ${module}?`)) return
    const res = await fetch('/api/test-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_module', module, agency_id: aid }),
    }).then(r => r.json())
    if (res?.data) {
      const total = Object.values(res.data).reduce((a, b) => a + b, 0)
      toast.success(`Cleared ${total} ${module} test rows`)
      loadCounts()
    } else {
      toast.error(res?.error || 'Clear failed')
    }
  }

  async function clearAllTestData() {
    if (confirmText !== 'CLEAR ALL TEST DATA') {
      toast.error('Confirmation text does not match')
      return
    }
    const res = await fetch('/api/test-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_test_data', agency_id: aid }),
    }).then(r => r.json())
    if (res?.data) {
      const total = Object.values(res.data).reduce((a, b) => a + b, 0)
      toast.success(`Cleared ${total} test rows across all modules`)
      setConfirmText('')
      loadCounts()
    } else {
      toast.error(res?.error || 'Clear failed')
    }
  }

  async function factoryReset() {
    if (factoryText !== 'FACTORY RESET') {
      toast.error('Confirmation text does not match')
      return
    }
    const res = await fetch('/api/test-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-koto-admin': 'true',
      },
      body: JSON.stringify({ action: 'factory_reset', agency_id: aid }),
    }).then(r => r.json())
    if (res?.data) {
      const total = Object.values(res.data).reduce((a, b) => a + b, 0)
      toast.success(`Wiped ${total} rows across the entire agency`)
      setFactoryText('')
      setConfirmingFactory(false)
      loadCounts()
    } else {
      toast.error(res?.error || 'Factory reset failed')
    }
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '20px 24px', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <FlaskConical size={22} color={C.amber} />
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)' }}>
            Test Data Generator
          </h1>
          <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 10, background: C.amberSoft, color: C.amber, letterSpacing: '.06em' }}>
            DEV
          </span>
        </div>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>
          Seeds the platform with test fixtures tagged <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>source_meta.is_test = true</code> so you can clear them safely.
        </div>

        {/* ── Generate ── */}
        <div style={card}>
          <div style={cardHeader}>
            <Zap size={16} color={C.teal} />
            <span>Generate</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {MODULES.map(m => {
              const status = progress[m.id]
              return (
                <label
                  key={m.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderRadius: 10, border: `1px solid ${C.border}`, cursor: 'pointer',
                    background: selected[m.id] ? C.tealSoft : C.white,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!selected[m.id]}
                    onChange={e => setSelected(s => ({ ...s, [m.id]: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: C.teal }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{m.desc}</div>
                  </div>
                  {status === 'running' && <Loader2 size={14} className="anim-spin" color={C.teal} />}
                  {status === 'done' && <Check size={14} color="#16a34a" />}
                  {status === 'error' && <X size={14} color="#dc2626" />}
                </label>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={generateSelected}
              disabled={generating}
              style={primaryBtn(generating)}
            >
              {generating ? <Loader2 size={14} className="anim-spin" /> : <Zap size={14} />}
              {generating ? 'Generating…' : 'Generate Selected'}
            </button>
            <button
              onClick={async () => {
                try {
                  const r = await fetch('/api/help/seed', { method: 'POST' }).then((r) => r.json())
                  if (r?.ok) toast.success(`Seeded ${r.upserted} help articles`)
                  else toast.error(r?.error || 'Seed failed')
                } catch (e) {
                  toast.error(e?.message || 'Seed failed')
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 10,
                background: '#fff', border: `1px solid ${C.border}`,
                fontFamily: "'Proxima Nova',sans-serif", fontWeight: 700, fontSize: 14,
                color: C.mutedDark, cursor: 'pointer',
              }}
            >
              📚 Seed Help Content
            </button>
          </div>
        </div>

        {/* ── Discovery Simulator ── */}
        <div style={card}>
          <div style={cardHeader}>
            <Brain size={16} color={C.teal} />
            <span>Discovery Simulator</span>
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, padding: '2px 7px', borderRadius: 8, background: C.tealSoft, color: C.teal, letterSpacing: '.06em' }}>
              AI
            </span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
            Pick a profile — we'll create a test client, spin up a discovery engagement, and generate realistic answers for all 12 sections via Claude. Lets you test the discovery document end-to-end without manual data entry.
          </div>

          {!discoResult && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 10,
              marginBottom: 12,
            }}>
              {discoProfiles.map((p) => {
                const isRunning = discoRunning && discoRunningProfile === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => runDiscoverySimulation(p.id)}
                    disabled={discoRunning}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: `1px solid ${isRunning ? C.teal : C.border}`,
                      background: isRunning ? C.tealSoft : '#fafafa',
                      cursor: discoRunning ? 'default' : 'pointer',
                      opacity: discoRunning && !isRunning ? 0.4 : 1,
                      transition: 'all .15s',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 20 }}>{p.emoji}</span>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.text, flex: 1 }}>{p.label}</div>
                      {isRunning && <Loader2 size={14} className="anim-spin" color={C.teal} />}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, lineHeight: 1.4 }}>
                      {p.description}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 10, background: '#eef2ff', color: '#4338ca', fontWeight: 700 }}>
                        {String(p.business_model || '').toUpperCase()}
                      </span>
                      <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 10, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                        {p.geographic_scope}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {discoRunning && (
            <div style={{ padding: '14px 16px', background: C.tealSoft, border: `1px solid ${C.teal}40`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader2 size={16} className="anim-spin" color={C.teal} />
              <div style={{ fontSize: 13, color: C.text }}>
                Generating discovery answers via Claude Sonnet… this can take 30-60 seconds.
              </div>
            </div>
          )}

          {discoResult && (
            <div style={{
              background: '#fff',
              border: `2px solid ${C.teal}40`,
              borderRadius: 12,
              padding: 20,
            }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 4 }}>
                {discoResult.client_name}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
                Profile: {discoResult.profile_label} · Client ID: {discoResult.client_id}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 10,
                marginBottom: 18,
                paddingBottom: 16,
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.teal }}>{discoResult.field_count}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>Fields Populated</div>
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{discoResult.sections_populated}/12</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>Sections</div>
                </div>
                {discoResult.readiness_score != null && (
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: discoResult.readiness_score >= 60 ? '#16a34a' : C.amber }}>
                      {discoResult.readiness_score}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Readiness {discoResult.readiness_label ? `· ${discoResult.readiness_label}` : ''}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate(`/discovery?id=${discoResult.engagement_id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 20px', borderRadius: 10, border: 'none',
                    background: C.text, color: '#fff',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  Open Discovery Document <ArrowRight size={14} />
                </button>
                <button
                  onClick={() => window.open(`/discovery/audit/${discoResult.engagement_id}`, '_blank', 'noopener')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 20px', borderRadius: 10, border: `2px solid ${C.teal}`,
                    background: '#fff', color: C.teal,
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  <ExternalLink size={14} /> Generate Audit
                </button>
                <button
                  onClick={() => setDiscoResult(null)}
                  style={{
                    padding: '12px 18px', borderRadius: 10, border: `1px solid ${C.border}`,
                    background: '#fff', color: C.mutedDark,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Run Another
                </button>
                <button
                  onClick={deleteDiscoverySimulation}
                  disabled={discoDeleting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '12px 18px', borderRadius: 10, border: `1px solid ${C.red}40`,
                    background: '#fff', color: C.red,
                    fontSize: 13, fontWeight: 700,
                    cursor: discoDeleting ? 'not-allowed' : 'pointer', opacity: discoDeleting ? 0.6 : 1,
                  }}
                >
                  <Trash2 size={13} /> Delete Test Engagement
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Bulk Voice Onboarding Setup ── */}
        <div style={card}>
          <div style={cardHeader}>
            <Phone size={16} color="#dc2626" />
            <span>Bulk Voice Onboarding Setup</span>
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, padding: '2px 7px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', letterSpacing: '.06em' }}>
              SPENDS MONEY
            </span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
            Provision Telnyx numbers and 4-digit PINs for every client that doesn't have one yet. Runs in three steps.
          </div>

          {/* Step 1 — Fix tokens */}
          <div style={{ background: '#f9f9f9', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>
              Step 1 — Fix onboarding URLs
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
              Creates <code style={{ background: '#eef', padding: '1px 5px', borderRadius: 4 }}>/onboard/[client-id]</code> links for any clients missing an onboarding_tokens row. Free — no Telnyx calls.
            </div>
            <button
              onClick={fixMissingTokens}
              disabled={fixingTokens}
              style={{
                padding: '8px 16px',
                background: C.teal,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: fixingTokens ? 'default' : 'pointer',
                opacity: fixingTokens ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            >
              {fixingTokens ? 'Fixing…' : 'Fix Missing Tokens'}
            </button>
          </div>

          {/* Step 2 — Dry run */}
          <div style={{ background: '#f9f9f9', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>
              Step 2 — Preview how many clients need numbers
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
              Counts clients without <code>onboarding_phone</code> (excluding test/simulation clients) and estimates monthly cost. No provisioning happens.
            </div>
            <button
              onClick={bulkDryRunCheck}
              style={{
                padding: '8px 16px',
                background: C.mutedDark,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Check How Many Need Numbers
            </button>
            {bulkDryRun && (
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                background: '#fff',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                fontSize: 13,
                color: C.text,
              }}>
                <strong>{bulkDryRun.total}</strong> clients need numbers
                {bulkDryRun.total > 0 && (
                  <>
                    {' · Estimated cost: '}
                    <strong>${(bulkDryRun.estimated_monthly_cost || 0).toFixed(2)}/month</strong>
                  </>
                )}
                {bulkDryRun.total > (bulkDryRun.capped_per_call || 25) && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                    This run will process <strong>{bulkDryRun.would_process}</strong> at a time — you'll need to click provision multiple times to complete all {bulkDryRun.total}.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 3 — Provision */}
          {bulkDryRun && bulkDryRun.total > 0 && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #f59e0b40',
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>
                Step 3 — Provision
              </div>
              <div style={{ fontSize: 12, color: '#92400e', marginBottom: 10, lineHeight: 1.55 }}>
                ⚠️ This orders real Telnyx numbers at ~$1/month each. Total exposure:{' '}
                <strong>${(bulkDryRun.estimated_monthly_cost || 0).toFixed(2)}/month</strong>. Each number is released automatically when onboarding completes.
              </div>
              <button
                onClick={bulkProvisionRun}
                disabled={bulkRunning}
                style={{
                  padding: '10px 22px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: bulkRunning ? 'default' : 'pointer',
                  opacity: bulkRunning ? 0.7 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {bulkRunning
                  ? '⏳ Provisioning…'
                  : `📞 Provision ${bulkDryRun.would_process || bulkDryRun.total} Numbers`}
              </button>
            </div>
          )}

          {/* Summary + log */}
          {bulkResults && !bulkResults.error && (
            <div style={{
              marginBottom: 12,
              padding: '10px 14px',
              background: bulkResults.failed > 0 ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${bulkResults.failed > 0 ? '#fde68a' : '#bbf7d0'}`,
              borderRadius: 8,
              fontSize: 12,
              color: bulkResults.failed > 0 ? '#92400e' : '#166534',
            }}>
              <strong>
                {bulkResults.provisioned} provisioned · {bulkResults.failed} failed
              </strong>
              {' · '}${(bulkResults.estimated_monthly_cost || 0).toFixed(2)}/mo added
              {bulkResults.has_more && (
                <> · <strong>{bulkResults.remaining}</strong> remaining — run again to continue</>
              )}
            </div>
          )}

          {bulkLog.length > 0 && (
            <div style={{
              background: '#0d1117',
              borderRadius: 10,
              padding: '10px 14px',
              fontFamily: 'ui-monospace,monospace',
              fontSize: 11,
              color: '#c9d1d9',
              maxHeight: 240,
              overflowY: 'auto',
              lineHeight: 1.6,
            }}>
              {bulkLog.map((line, i) => (
                <div
                  key={i}
                  style={{
                    color: line.startsWith('✓') ? '#00ff88'
                      : line.startsWith('✗') ? '#ff4444'
                      : line.startsWith('⚠️') ? '#fbbf24'
                      : '#c9d1d9',
                    marginBottom: 2,
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Voice Onboarding Test Simulator ── */}
        <div style={card}>
          <div style={cardHeader}>
            <Mic size={16} color="#7c3aed" />
            <span>Voice Onboarding Test Simulator</span>
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, padding: '2px 7px', borderRadius: 8, background: '#ede9fe', color: '#6d28d9', letterSpacing: '.06em' }}>
              DEV
            </span>
            <a
              href={voiceTestClientId ? `/clients/${voiceTestClientId}` : '#'}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => { if (!voiceTestClientId) e.preventDefault() }}
              style={{
                marginLeft: 'auto', padding: '6px 14px',
                background: voiceTestClientId ? '#f0fffe' : '#f9f9f9',
                color: voiceTestClientId ? C.teal : '#9ca3af',
                border: `1px solid ${voiceTestClientId ? C.teal + '40' : C.border}`,
                borderRadius: 8, fontSize: 12, fontWeight: 700,
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Eye size={12} /> Watch Client Page Live →
            </a>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
            Fires fake webhook events through the real voice onboarding pipeline — autosave + recipients + notifications all run. Open the client detail page in another tab to watch fields populate live.
          </div>

          {/* Client ID input */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.mutedDark, display: 'block', marginBottom: 4 }}>Client ID to test</label>
            <input
              value={voiceTestClientId}
              onChange={(e) => setVoiceTestClientId(e.target.value)}
              placeholder="Paste a client UUID e.g. 3a93a9dc-e138-4f8c-b2cd-c2fff219e9b6"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              Active call ID:{' '}
              <code style={{ background: '#f9f9f9', padding: '1px 6px', borderRadius: 4 }}>{voiceTestCallId || 'none'}</code>
            </div>
          </div>

          {/* Quick setup */}
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>⚡ Quick Setup for Testing</div>
              <button
                onClick={quickSetupVoiceTest}
                disabled={voiceTestProvisioning || !voiceTestClientId}
                style={{
                  marginLeft: 'auto', padding: '6px 14px',
                  background: '#7c3aed', color: '#fff', border: 'none',
                  borderRadius: 6, fontSize: 12, fontWeight: 700,
                  cursor: (voiceTestProvisioning || !voiceTestClientId) ? 'not-allowed' : 'pointer',
                  opacity: (voiceTestProvisioning || !voiceTestClientId) ? 0.5 : 1,
                }}
              >
                {voiceTestProvisioning ? 'Provisioning…' : 'Provision Number + PIN'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
              Calls /api/onboarding/telnyx-provision to assign a real Telnyx number + 4-digit PIN to the selected client. Falls back to mock values if TELNYX_API_KEY is not set.
            </div>
            {voiceTestProvision && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>Phone</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{voiceTestProvision.display_number || voiceTestProvision.phone_number}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>PIN</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#7c3aed', letterSpacing: '.2em' }}>{voiceTestProvision.pin}</div>
                </div>
                <button
                  onClick={importExistingToRetell}
                  disabled={voiceTestLoading || !voiceTestProvision?.phone_number}
                  style={{
                    marginLeft: 'auto', padding: '8px 14px',
                    background: '#111', color: '#fff', border: 'none',
                    borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: (voiceTestLoading || !voiceTestProvision?.phone_number) ? 'not-allowed' : 'pointer',
                    opacity: (voiceTestLoading || !voiceTestProvision?.phone_number) ? 0.5 : 1,
                    whiteSpace: 'nowrap',
                  }}
                  title="Registers this number with Retell via create-phone-number-from-carrier-number + binds the onboarding agent. Use when the number was provisioned before the Retell import path was added."
                >
                  🔁 Import Existing Number to Retell
                </button>
              </div>
            )}

            {!voiceTestProvision && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#fff', borderRadius: 8, border: `1px dashed ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <input
                  placeholder="Or paste an existing +1... number to import"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      setVoiceTestProvision({ phone_number: e.target.value.trim(), display_number: e.target.value.trim(), pin: null })
                    }
                  }}
                  style={{ flex: 1, minWidth: 220, padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: 12, color: C.muted }}>Press Enter to load, then use the Import button</div>
              </div>
            )}
          </div>

          {/* Step-by-step controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
            {/* Step 1 */}
            <div style={{ background: '#f9f9f9', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.mutedDark, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '.05em' }}>
                Step 1 — Start Call
              </div>
              <button
                onClick={() => fireVoiceTest('simulate_call_started', { caller_name: 'Test Caller' })}
                disabled={voiceTestLoading || !voiceTestClientId}
                style={{
                  width: '100%', padding: '8px',
                  background: '#374151', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: (!voiceTestClientId || voiceTestLoading) ? 0.5 : 1,
                }}
              >
                📞 Simulate Call Started
              </button>
            </div>

            {/* Step 2 */}
            <div style={{ background: '#f9f9f9', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.mutedDark, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '.05em' }}>
                Step 2 — Send Answer
              </div>
              <select
                value={voiceTestField}
                onChange={(e) => setVoiceTestField(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, marginBottom: 6, background: '#fff' }}
              >
                {[
                  'welcome_statement', 'owner_name', 'primary_service', 'target_customer',
                  'marketing_budget', 'crm_used', 'competitor_1', 'unique_selling_prop',
                  'notes', 'city', 'num_employees', 'year_founded',
                ].map((f) => (<option key={f} value={f}>{f}</option>))}
              </select>
              <input
                value={voiceTestAnswer}
                onChange={(e) => setVoiceTestAnswer(e.target.value)}
                placeholder="Leave blank for auto-generated"
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, marginBottom: 6, boxSizing: 'border-box' }}
              />
              <button
                onClick={() => fireVoiceTest('simulate_answer', { field: voiceTestField, answer: voiceTestAnswer || undefined })}
                disabled={voiceTestLoading || !voiceTestClientId || !voiceTestCallId}
                style={{
                  width: '100%', padding: '8px',
                  background: C.teal, color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: (!voiceTestClientId || !voiceTestCallId || voiceTestLoading) ? 0.5 : 1,
                }}
              >
                💾 Save This Answer
              </button>
            </div>

            {/* PIN Test */}
            <div style={{ background: '#f9f9f9', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.mutedDark, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '.05em' }}>
                PIN Verify Test
              </div>
              <input
                value={voiceTestPin}
                onChange={(e) => setVoiceTestPin(e.target.value)}
                placeholder="4-digit"
                maxLength={4}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 18, fontWeight: 900, letterSpacing: '.2em', marginBottom: 6, boxSizing: 'border-box', textAlign: 'center' }}
              />
              <button
                onClick={() => fireVoiceTest('simulate_pin_verify', { pin: voiceTestPin })}
                disabled={voiceTestLoading || !voiceTestClientId || voiceTestPin.length !== 4}
                style={{
                  width: '100%', padding: '8px',
                  background: '#7c3aed', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: (voiceTestPin.length !== 4 || !voiceTestClientId || voiceTestLoading) ? 0.5 : 1,
                }}
              >
                🔐 Test PIN Verify
              </button>
            </div>

            {/* Step 3 */}
            <div style={{ background: '#f9f9f9', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.mutedDark, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '.05em' }}>
                Step 3 — End Call
              </div>
              <button
                onClick={() => fireVoiceTest('simulate_call_ended', { fields_captured: 7 })}
                disabled={voiceTestLoading || !voiceTestClientId || !voiceTestCallId}
                style={{
                  width: '100%', padding: '8px',
                  background: '#dc2626', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: (!voiceTestClientId || !voiceTestCallId || voiceTestLoading) ? 0.5 : 1,
                }}
              >
                📴 Simulate Call Ended
              </button>
            </div>
          </div>

          {/* Full auto session */}
          <div style={{ background: '#f0fffe', border: `1px solid ${C.teal}30`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 8 }}>
              🤖 Run Full Auto Session
            </div>
            <div style={{ fontSize: 12, color: C.mutedDark, marginBottom: 10 }}>
              Fires: call_started → 7 field answers → call_ended. Watch the client page in another tab to see fields populate live.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={voiceTestSpeed}
                onChange={(e) => setVoiceTestSpeed(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, background: '#fff' }}
              >
                <option value="fast">Fast (200ms between steps)</option>
                <option value="normal">Normal (600ms between steps)</option>
                <option value="slow">Slow (1.5s between steps)</option>
              </select>
              <button
                onClick={async () => {
                  vlog('Starting full auto session…', 'info')
                  const result = await fireVoiceTest('simulate_full_session', { speed: voiceTestSpeed })
                  if (result?.events) {
                    result.events.forEach((e) => vlog(`${e.label}: ${JSON.stringify(e.result || {}).slice(0, 80)}`, e.result?.error ? 'error' : 'success'))
                  }
                }}
                disabled={voiceTestLoading || !voiceTestClientId}
                style={{
                  padding: '8px 20px',
                  background: '#111', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: (!voiceTestClientId || voiceTestLoading) ? 0.5 : 1, whiteSpace: 'nowrap',
                }}
              >
                {voiceTestLoading ? '⏳ Running…' : '▶ Run Full Session'}
              </button>
            </div>
          </div>

          {/* Event log */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.mutedDark }}>Event Log</div>
              <button
                onClick={() => setVoiceTestLog([])}
                style={{ fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Clear
              </button>
            </div>
            <div
              ref={voiceLogRef}
              style={{
                background: '#0d1117', borderRadius: 10,
                padding: '12px 16px',
                fontFamily: 'ui-monospace,monospace', fontSize: 12,
                color: '#c9d1d9', maxHeight: 280, overflowY: 'auto', lineHeight: 1.6,
              }}
            >
              {voiceTestLog.length === 0 ? (
                <span style={{ color: '#484f58' }}>// Events will appear here as you run tests…</span>
              ) : (
                voiceTestLog.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      color: line.startsWith('✓') ? '#00ff88'
                        : line.startsWith('✗') ? '#ff4444'
                        : line.startsWith('→') ? C.teal
                        : '#c9d1d9',
                      marginBottom: 2,
                    }}
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>

          {voiceTestResult && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedDark, marginBottom: 4 }}>Last Response</div>
              <pre style={{
                background: '#f9f9f9', borderRadius: 8,
                padding: '10px 14px', fontSize: 11, color: C.mutedDark,
                overflow: 'auto', maxHeight: 200, margin: 0,
              }}>
                {JSON.stringify(voiceTestResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* ── Current Test Data ── */}
        <div style={card}>
          <div style={cardHeader}>
            <Database size={16} color={C.teal} />
            <span>Current Test Data</span>
            <button
              onClick={loadCounts}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                color: C.muted, padding: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
              }}
              title="Refresh counts"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 30 }}>
              <Loader2 size={18} className="anim-spin" color={C.teal} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {[
                { key: 'discovery', label: 'Discovery' },
                { key: 'voice_leads', label: 'Voice Leads' },
                { key: 'voice_calls', label: 'Voice Calls' },
                { key: 'scout', label: 'Scout' },
                { key: 'opportunities', label: 'Opportunities' },
                { key: 'clients', label: 'Clients' },
                { key: 'vault', label: 'Vault Entries' },
              ].map(c => (
                <div key={c.key} style={{
                  padding: '14px 16px', background: '#fafafa',
                  borderRadius: 10, border: `1px solid ${C.border}`,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)' }}>
                    {counts?.[c.key] ?? 0}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>
                    {c.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Delete ── */}
        <div style={card}>
          <div style={cardHeader}>
            <Trash2 size={16} color={C.amber} />
            <span>Delete</span>
          </div>

          {/* Per-module clear (amber) */}
          <div style={{
            background: C.amberSoft, border: `1px solid ${C.amberBorder}`,
            borderRadius: 10, padding: 14, marginBottom: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>
              Clear test data per module
            </div>
            <div style={{ fontSize: 12, color: '#92400E', marginBottom: 10 }}>
              Removes only rows tagged <code>is_test = true</code> from the selected module.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MODULES.map(m => (
                <button
                  key={m.id}
                  onClick={() => clearModule(m.id)}
                  style={{
                    background: C.white, border: `1px solid ${C.amberBorder}`, borderRadius: 8,
                    padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#92400E', cursor: 'pointer',
                  }}
                >
                  Clear {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear all test data (red) */}
          <div style={{
            background: C.redSoft, border: `1px solid ${C.redBorder}`,
            borderRadius: 10, padding: 14, marginBottom: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={13} /> Clear ALL test data
            </div>
            <div style={{ fontSize: 12, color: '#991b1b', marginBottom: 10 }}>
              Wipes every <code>is_test = true</code> row across every module. Real data is preserved.
              Type <strong>CLEAR ALL TEST DATA</strong> to confirm.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="CLEAR ALL TEST DATA"
                style={{
                  flex: 1, padding: '8px 12px', border: `1px solid ${C.redBorder}`,
                  borderRadius: 8, fontSize: 13, outline: 'none', background: C.white,
                }}
              />
              <button
                onClick={clearAllTestData}
                disabled={confirmText !== 'CLEAR ALL TEST DATA'}
                style={{
                  background: confirmText === 'CLEAR ALL TEST DATA' ? '#dc2626' : '#f3f4f6',
                  color: confirmText === 'CLEAR ALL TEST DATA' ? '#fff' : C.muted,
                  border: 'none', borderRadius: 8, padding: '8px 16px',
                  fontSize: 13, fontWeight: 700,
                  cursor: confirmText === 'CLEAR ALL TEST DATA' ? 'pointer' : 'not-allowed',
                }}
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Factory reset (super admin only) */}
          {isSuperAdmin && (
            <div style={{
              background: '#1f2937', border: '1px solid #111827',
              borderRadius: 10, padding: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={13} /> Factory reset (super admin only)
              </div>
              <div style={{ fontSize: 12, color: '#d1d5db', marginBottom: 10 }}>
                Wipes every discovery, voice, scout, opportunity, vault, and snapshot row for this agency
                — including real data. Type <strong>FACTORY RESET</strong> to confirm.
              </div>
              {!confirmingFactory ? (
                <button
                  onClick={() => setConfirmingFactory(true)}
                  style={{
                    background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  I understand, show factory reset
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={factoryText}
                    onChange={e => setFactoryText(e.target.value)}
                    placeholder="FACTORY RESET"
                    style={{
                      flex: 1, padding: '8px 12px', border: '1px solid #4b5563',
                      borderRadius: 8, fontSize: 13, outline: 'none',
                      background: '#374151', color: '#fff',
                    }}
                  />
                  <button
                    onClick={factoryReset}
                    disabled={factoryText !== 'FACTORY RESET'}
                    style={{
                      background: factoryText === 'FACTORY RESET' ? '#dc2626' : '#374151',
                      color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px',
                      fontSize: 13, fontWeight: 700,
                      cursor: factoryText === 'FACTORY RESET' ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Wipe everything
                  </button>
                  <button
                    onClick={() => { setConfirmingFactory(false); setFactoryText('') }}
                    style={{
                      background: 'none', color: '#9ca3af', border: '1px solid #4b5563',
                      borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const card = {
  background: C.white,
  borderRadius: 14,
  border: `1px solid ${C.border}`,
  padding: 22,
  marginBottom: 16,
}

const cardHeader = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: 13, fontWeight: 800, color: C.text,
  textTransform: 'uppercase', letterSpacing: '.05em',
  marginBottom: 14,
}

function primaryBtn(disabled) {
  return {
    background: disabled ? C.borderMd : C.teal,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'wait' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }
}
