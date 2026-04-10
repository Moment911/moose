"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  FlaskConical, Database, Trash2, AlertTriangle, RefreshCw, Loader2, Check, X, Zap,
} from 'lucide-react'
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

  const [selected, setSelected] = useState(() => Object.fromEntries(MODULES.map(m => [m.id, true])))
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({})
  const [confirmText, setConfirmText] = useState('')
  const [confirmingFactory, setConfirmingFactory] = useState(false)
  const [factoryText, setFactoryText] = useState('')

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
          <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 10, background: C.amberSoft, color: C.amber, letterSpacing: '.06em' }}>
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
