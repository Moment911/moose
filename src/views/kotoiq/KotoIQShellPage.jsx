"use client"
import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { profileFetch } from '../../lib/kotoiqProfileFetch'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import { Brain, Search, Send, SlidersHorizontal, Settings, Shield } from 'lucide-react'
import { R, T, BLK, GRY, FH, FB } from '../../lib/theme'
import KotoIQPage from '../KotoIQPage'
import BuilderTab from '../../components/kotoiq/BuilderTab'
import PublishQueueTab from '../../components/kotoiq/PublishQueueTab'
import CampaignComposerTab from '../../components/kotoiq/CampaignComposerTab'
import AttributionTab from '../../components/kotoiq/AttributionTab'
import ContentDecayTab from '../../components/kotoiq/ContentDecayTab'
import PipelineOrchestratorTab from '../../components/kotoiq/PipelineOrchestratorTab'
import ClarificationsTab from '../../components/kotoiq/launch/ClarificationsTab'

// ── Shell tabs ──────────────────────────────────────────────────────────────
const SHELL_TABS = [
  { key: 'intel',    label: 'Intel',    icon: Search },
  { key: 'publish',  label: 'Publish',  icon: Send },
  { key: 'tune',     label: 'Tune',     icon: SlidersHorizontal },
  { key: 'pipeline', label: 'Pipeline', icon: Brain },
  { key: 'settings', label: 'Settings', icon: Settings },
]

// ── Publish sub-tabs ────────────────────────────────────────────────────────
const PUBLISH_SUBS = [
  { key: 'builder',   label: 'Templates' },
  { key: 'composer',  label: 'Campaign Composer' },
  { key: 'queue',     label: 'Publish Queue' },
]

// ── Tune sub-tabs ───────────────────────────────────────────────────────────
const TUNE_SUBS = [
  { key: 'attribution', label: 'Attribution' },
  { key: 'decay',       label: 'Content Decay' },
]

// ── Pipeline sub-tabs (Plan 07-08 — UI-SPEC §5.8b "Needs Clarity") ─────────
const PIPELINE_SUBS = [
  { key: 'orchestrator', label: 'Orchestrator' },
  { key: 'clarity',      label: 'Needs Clarity' },
]

export default function KotoIQShellPage() {
  const { agencyId, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Top-level shell tab from URL
  const shell = searchParams.get('shell') || 'intel'
  const setShell = (v) => {
    const next = new URLSearchParams(searchParams)
    next.set('shell', v)
    // Clear sub when switching top-level
    next.delete('sub')
    setSearchParams(next, { replace: true })
  }

  // Sub-tab for publish / tune / pipeline
  const sub =
    searchParams.get('sub') ||
    (shell === 'publish' ? 'builder'
      : shell === 'tune' ? 'attribution'
      : shell === 'pipeline' ? 'orchestrator'
      : '')
  const setSub = (v) => {
    const next = new URLSearchParams(searchParams)
    next.set('sub', v)
    setSearchParams(next, { replace: true })
  }

  // Plan 07-08 — badge count for the "Needs Clarity" sub-tab.
  const [clarityCount, setClarityCount] = useState(0)
  useEffect(() => {
    if (shell !== 'pipeline' || !agencyId) return undefined
    let cancelled = false
    const load = async () => {
      try {
        const j = await profileFetch({ action: 'list_clarifications', status: 'open' })
        if (!cancelled) setClarityCount(Array.isArray(j.clarifications) ? j.clarifications.length : 0)
      } catch {
        // Non-blocking — badge stays at last-known value.
      }
    }
    load()
    const t = setInterval(load, 30000) // refresh every 30s while Pipeline shell is open
    return () => { cancelled = true; clearInterval(t) }
  }, [shell, agencyId])

  // Impersonation bar offset
  const [impersonating, setImpersonating] = useState(false)
  useEffect(() => {
    const bar = document.querySelector('[data-impersonation-bar]')
    setImpersonating(!!bar)
  }, [])
  const topOffset = impersonating ? 36 : 0

  // Auth guard
  if (!agencyId) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#fff', fontFamily: FB }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <Shield size={48} color={R} style={{ margin: '0 auto 16px', opacity: .4 }} />
            <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: BLK, marginBottom: 8 }}>Login Required</div>
            <div style={{ fontSize: 14, color: '#374151' }}>You need to be logged into an agency to use KotoIQ.</div>
          </div>
        </div>
      </div>
    )
  }

  // Intel tab renders the full KotoIQPage as-is
  if (shell === 'intel') {
    return <KotoIQPage />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#ffffff', fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Top navigation bar ──────────────────────────────────── */}
        <div style={{
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
          paddingTop: topOffset,
        }}>
          {/* Title row */}
          <div style={{ padding: '16px 40px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: BLK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={18} color="#fff" />
            </div>
            <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: BLK, letterSpacing: '-.02em' }}>KotoIQ</div>
          </div>

          {/* Shell tabs */}
          <div style={{ display: 'flex', gap: 0, padding: '0 40px', marginTop: 16 }}>
            {SHELL_TABS.map(t => {
              const active = shell === t.key
              const Icon = t.icon
              return (
                <button key={t.key} onClick={() => setShell(t.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 20px',
                  fontSize: 14, fontWeight: active ? 800 : 600,
                  fontFamily: FH,
                  color: active ? BLK : '#6b7280',
                  background: 'none', border: 'none',
                  borderBottom: active ? `2px solid ${BLK}` : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}>
                  <Icon size={16} /> {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Content area ────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>

          {/* ── Publish ──────────────────────────────────────────── */}
          {shell === 'publish' && (
            <div>
              {/* Sub-tabs */}
              <div style={{ padding: '12px 40px 0', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 0 }}>
                {PUBLISH_SUBS.map(s => {
                  const active = sub === s.key
                  return (
                    <button key={s.key} onClick={() => setSub(s.key)} style={{
                      padding: '8px 18px', fontSize: 13, fontWeight: active ? 700 : 500,
                      fontFamily: FH, color: active ? BLK : '#9ca3af',
                      background: 'none', border: 'none',
                      borderBottom: active ? `2px solid ${BLK}` : '2px solid transparent',
                      cursor: 'pointer', transition: 'all .15s',
                    }}>
                      {s.label}
                    </button>
                  )
                })}
              </div>

              {/* Sub content */}
              <div style={{ padding: '24px 40px' }}>
                {sub === 'builder' && <BuilderTab agencyId={agencyId} />}
                {sub === 'composer' && <CampaignComposerTab agencyId={agencyId} />}
                {sub === 'queue' && <PublishQueueTab agencyId={agencyId} />}
              </div>
            </div>
          )}

          {/* ── Tune ─────────────────────────────────────────────── */}
          {shell === 'tune' && (
            <div>
              {/* Sub-tabs */}
              <div style={{ padding: '12px 40px 0', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 0 }}>
                {TUNE_SUBS.map(s => {
                  const active = sub === s.key
                  return (
                    <button key={s.key} onClick={() => setSub(s.key)} style={{
                      padding: '8px 18px', fontSize: 13, fontWeight: active ? 700 : 500,
                      fontFamily: FH, color: active ? BLK : '#9ca3af',
                      background: 'none', border: 'none',
                      borderBottom: active ? `2px solid ${BLK}` : '2px solid transparent',
                      cursor: 'pointer', transition: 'all .15s',
                    }}>
                      {s.label}
                    </button>
                  )
                })}
              </div>

              <div style={{ padding: '24px 40px' }}>
                {sub === 'attribution' && <AttributionTab agencyId={agencyId} />}
                {sub === 'decay' && <ContentDecayTab agencyId={agencyId} />}
              </div>
            </div>
          )}

          {/* ── Pipeline (Orchestrator + Needs Clarity) ──────────── */}
          {shell === 'pipeline' && (
            <div>
              {/* Sub-tabs */}
              <div style={{ padding: '12px 40px 0', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 0 }}>
                {PIPELINE_SUBS.map(s => {
                  const active = sub === s.key
                  const labelWithBadge = s.key === 'clarity' && clarityCount > 0
                    ? `${s.label} (${clarityCount})`
                    : s.label
                  return (
                    <button key={s.key} onClick={() => setSub(s.key)} style={{
                      padding: '8px 18px', fontSize: 13, fontWeight: active ? 700 : 500,
                      fontFamily: FH, color: active ? BLK : '#9ca3af',
                      background: 'none', border: 'none',
                      borderBottom: active ? `2px solid ${BLK}` : '2px solid transparent',
                      cursor: 'pointer', transition: 'all .15s',
                    }}>
                      {labelWithBadge}
                    </button>
                  )
                })}
              </div>

              {/* Sub content */}
              {sub === 'orchestrator' && (
                <div style={{ padding: '40px' }}>
                  <PipelineOrchestratorTab clientId={searchParams.get('client')} agencyId={agencyId} />
                </div>
              )}
              {sub === 'clarity' && (
                <ClarificationsTab agencyId={agencyId} clientId={searchParams.get('client')} />
              )}
            </div>
          )}

          {/* ── Settings ─────────────────────────────────────────── */}
          {shell === 'settings' && (
            <div style={{ padding: '40px' }}>
              <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>Settings</div>
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>Manage site connections, API keys, and cadence defaults.</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {/* Site Connections */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px' }}>
                  <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 6 }}>Site Connections</div>
                  <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                    Connect WordPress sites for template ingest and publishing. Managed via the Publish &gt; Templates tab.
                  </div>
                  <button onClick={() => { setShell('publish'); setSub('builder') }} style={{
                    marginTop: 16, padding: '8px 16px', borderRadius: 8,
                    border: '1px solid #e5e7eb', background: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', color: BLK,
                  }}>
                    Go to Templates
                  </button>
                </div>

                {/* API Keys */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px' }}>
                  <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 6 }}>API Keys</div>
                  <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                    Google Search Console, Analytics, and PageSpeed API keys. Coming soon.
                  </div>
                  <div style={{
                    marginTop: 16, padding: '8px 16px', borderRadius: 8,
                    background: '#f9fafb', fontSize: 12, fontWeight: 600, color: '#9ca3af',
                    display: 'inline-block',
                  }}>
                    Coming Soon
                  </div>
                </div>

                {/* Cadence Defaults */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px' }}>
                  <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 6 }}>Cadence Defaults</div>
                  <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                    Default publish cadence for new campaigns (burst, drip, weekly). Coming soon.
                  </div>
                  <div style={{
                    marginTop: 16, padding: '8px 16px', borderRadius: 8,
                    background: '#f9fafb', fontSize: 12, fontWeight: 600, color: '#9ca3af',
                    display: 'inline-block',
                  }}>
                    Coming Soon
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
