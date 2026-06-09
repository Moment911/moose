"use client"
import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useClient } from '../../context/ClientContext'
import { profileFetch } from '../../lib/kotoiqProfileFetch'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import { Brain, Search, Send, SlidersHorizontal, Settings, Shield, Compass } from 'lucide-react'
import { R, T, BLK, GRY, FH, FB, DESIGN, buttonPill } from '../../lib/theme'
import KotoIQPage from '../KotoIQPage'
import GuidedSpine from '../../components/kotoiq-wp/GuidedSpine'
import BuilderTab from '../../components/kotoiq/BuilderTab'
import PublishQueueTab from '../../components/kotoiq/PublishQueueTab'
import CampaignComposerTab from '../../components/kotoiq/CampaignComposerTab'
import AttributionTab from '../../components/kotoiq/AttributionTab'
import ContentDecayTab from '../../components/kotoiq/ContentDecayTab'
import PipelineOrchestratorTab from '../../components/kotoiq/PipelineOrchestratorTab'
import ClarificationsTab from '../../components/kotoiq/launch/ClarificationsTab'
import PageSuggestionsTab from '../../components/kotoiq/PageSuggestionsTab'
import WordPressConnectionManager from '../../components/kotoiq/WordPressConnectionManager'

// ── Shell tabs ──────────────────────────────────────────────────────────────
// `guided` is the linear 6-step onboarding spine (WS7). It is ADDITIVE — the
// existing power-user tabs (Intel/Publish/Tune/Pipeline/Settings) and FleetView
// stay fully reachable. `guided` simply sits first as the self-explanatory path
// for first-run / client view; nothing it does removes or breaks the others.
const SHELL_TABS = [
  { key: 'guided',   label: 'Guided',   icon: Compass },
  { key: 'intel',    label: 'Intel',    icon: Search },
  { key: 'publish',  label: 'Publish',  icon: Send },
  { key: 'tune',     label: 'Tune',     icon: SlidersHorizontal },
  { key: 'pipeline', label: 'Pipeline', icon: Brain },
  { key: 'settings', label: 'Settings', icon: Settings },
]

// ── Publish sub-tabs ────────────────────────────────────────────────────────
const PUBLISH_SUBS = [
  { key: 'factory',   label: 'Page Factory' },
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
  const { clientId } = useClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Top-level shell tab from URL
  const shell = searchParams.get('shell') || 'intel'
  const setShell = (v) => {
    const next = new URLSearchParams(searchParams)
    next.set('shell', v)
    // Clear sub when switching top-level
    next.delete('sub')
    setSearchParams(next)
  }

  // Sub-tab for publish / tune / pipeline
  const sub =
    searchParams.get('sub') ||
    (shell === 'publish' ? 'factory'
      : shell === 'tune' ? 'attribution'
      : shell === 'pipeline' ? 'orchestrator'
      : '')
  const setSub = (v) => {
    const next = new URLSearchParams(searchParams)
    next.set('sub', v)
    setSearchParams(next)
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

  // Reusable sub-tab renderer
  const SubTabBar = ({ items, current, onSelect }) => (
    <div style={{ padding: '14px 40px 0', borderBottom: `1px solid ${DESIGN.colors.border}`, display: 'flex', gap: 6 }}>
      {items.map(s => {
        const active = current === s.key
        const label = s.badge ? `${s.label} (${s.badge})` : s.label
        return (
          <button key={s.key} onClick={() => onSelect(s.key)} style={{
            padding: '10px 22px', fontSize: DESIGN.fontSize.sm, fontWeight: active ? DESIGN.fontWeight.bold : DESIGN.fontWeight.medium,
            fontFamily: DESIGN.fonts.body, color: active ? DESIGN.colors.pink : DESIGN.colors.textMuted,
            background: 'none', border: 'none',
            borderBottom: active ? `2px solid ${DESIGN.colors.pink}` : '2px solid transparent',
            cursor: 'pointer', transition: `all ${DESIGN.transition.fast}`,
          }}>
            {label}
          </button>
        )
      })}
    </div>
  )

  // Auth guard
  if (!agencyId) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: DESIGN.colors.cream, fontFamily: DESIGN.fonts.body }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: DESIGN.radius.lg, background: DESIGN.colors.warmGray, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Shield size={30} color={DESIGN.colors.navy} style={{ opacity: .5 }} />
            </div>
            <div style={{ fontFamily: DESIGN.fonts.heading, fontSize: 28, fontWeight: DESIGN.fontWeight.bold, color: DESIGN.colors.navy, marginBottom: 8, letterSpacing: '0.02em' }}>LOGIN REQUIRED</div>
            <div style={{ fontSize: DESIGN.fontSize.base, color: DESIGN.colors.textSecondary }}>You need to be logged into an agency to use KotoIQ.</div>
          </div>
        </div>
      </div>
    )
  }

  // Intel tab renders the full KotoIQPage
  if (shell === 'intel') {
    return <KotoIQPage key={clientId} />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: DESIGN.colors.cream, fontFamily: DESIGN.fonts.body }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Top navigation bar ──────────────────────────────────── */}
        <div style={{
          background: DESIGN.colors.white,
          borderBottom: `1px solid ${DESIGN.colors.border}`,
          flexShrink: 0,
          paddingTop: topOffset,
        }}>
          {/* Title row */}
          <div style={{ padding: '18px 40px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: DESIGN.radius.md, background: DESIGN.colors.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={18} color={DESIGN.colors.cream} />
            </div>
            <div style={{ fontFamily: DESIGN.fonts.heading, fontSize: 26, fontWeight: DESIGN.fontWeight.bold, color: DESIGN.colors.navy, letterSpacing: '0.02em' }}>KOTOIQ</div>
          </div>

          {/* Shell tabs */}
          <div style={{ display: 'flex', gap: 4, padding: '0 40px', marginTop: 18 }}>
            {SHELL_TABS.map(t => {
              const active = shell === t.key
              const Icon = t.icon
              return (
                <button key={t.key} onClick={() => setShell(t.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '10px 22px',
                  fontSize: DESIGN.fontSize.sm, fontWeight: active ? DESIGN.fontWeight.bold : DESIGN.fontWeight.medium,
                  fontFamily: DESIGN.fonts.body,
                  color: active ? DESIGN.colors.pink : DESIGN.colors.textMuted,
                  background: 'none', border: 'none',
                  borderBottom: active ? `2px solid ${DESIGN.colors.pink}` : '2px solid transparent',
                  cursor: 'pointer',
                  transition: `all ${DESIGN.transition.fast}`,
                }}>
                  <Icon size={16} color={active ? DESIGN.colors.pink : DESIGN.colors.textMuted} /> {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Content area ────────────────────────────────────────── */}
        <div className="kiq-scroll" style={{ flex: 1, overflow: 'auto', background: DESIGN.colors.cream }}>

          {/* ── Guided (WS7 — linear 6-step onboarding spine) ────── */}
          {/* Additive: the tab bar above stays, so Intel/Publish/Tune/    */}
          {/* Pipeline/Settings + FleetView remain reachable at all times. */}
          {shell === 'guided' && (
            <GuidedSpine key={clientId} clientId={clientId} agencyId={agencyId} />
          )}

          {/* ── Publish ──────────────────────────────────────────── */}
          {shell === 'publish' && (
            <div>
              <SubTabBar items={PUBLISH_SUBS} current={sub} onSelect={setSub} />
              <div style={{ padding: '28px 40px' }}>
                {sub === 'factory' && <PageSuggestionsTab key={clientId} clientId={clientId} agencyId={agencyId} />}
                {sub === 'builder' && <BuilderTab key={clientId} agencyId={agencyId} />}
                {sub === 'composer' && <CampaignComposerTab key={clientId} agencyId={agencyId} />}
                {sub === 'queue' && <PublishQueueTab key={clientId} agencyId={agencyId} />}
              </div>
            </div>
          )}

          {/* ── Tune ─────────────────────────────────────────────── */}
          {shell === 'tune' && (
            <div>
              <SubTabBar items={TUNE_SUBS} current={sub} onSelect={setSub} />
              <div style={{ padding: '28px 40px' }}>
                {sub === 'attribution' && <AttributionTab key={clientId} agencyId={agencyId} />}
                {sub === 'decay' && <ContentDecayTab key={clientId} agencyId={agencyId} />}
              </div>
            </div>
          )}

          {/* ── Pipeline ─────────────────────────────────────────── */}
          {shell === 'pipeline' && (
            <div>
              <SubTabBar
                items={PIPELINE_SUBS.map(s => s.key === 'clarity' && clarityCount > 0 ? { ...s, badge: clarityCount } : s)}
                current={sub}
                onSelect={setSub}
              />
              {sub === 'orchestrator' && (
                <div style={{ padding: '40px' }}>
                  <PipelineOrchestratorTab clientId={clientId} agencyId={agencyId} />
                </div>
              )}
              {sub === 'clarity' && (
                <ClarificationsTab agencyId={agencyId} clientId={clientId} />
              )}
            </div>
          )}

          {/* ── Settings ─────────────────────────────────────────── */}
          {shell === 'settings' && (
            <div style={{ padding: '40px' }}>
              <div style={{ fontFamily: DESIGN.fonts.body, fontSize: DESIGN.fontSize.xl, fontWeight: DESIGN.fontWeight.bold, color: DESIGN.colors.navy, marginBottom: 8 }}>Settings & Connections</div>
              <div style={{ fontSize: DESIGN.fontSize.base, color: DESIGN.colors.textSecondary, marginBottom: 28, lineHeight: 1.5 }}>Manage WordPress connections, API keys, and publishing defaults.</div>

              <div style={{ marginBottom: 36 }}>
                <WordPressConnectionManager agencyId={agencyId} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
                <div style={{ background: DESIGN.colors.white, borderRadius: DESIGN.radius.lg, border: `1px solid ${DESIGN.colors.border}`, padding: '26px', boxShadow: DESIGN.shadow.sm }}>
                  <div style={{ fontFamily: DESIGN.fonts.body, fontSize: DESIGN.fontSize.md, fontWeight: DESIGN.fontWeight.bold, color: DESIGN.colors.navy, marginBottom: 8 }}>API Keys</div>
                  <div style={{ fontSize: DESIGN.fontSize.sm, color: DESIGN.colors.textSecondary, lineHeight: 1.6 }}>
                    Google Search Console, Analytics, and PageSpeed API keys. Coming soon.
                  </div>
                  <div style={{
                    marginTop: 18, padding: '8px 18px', borderRadius: DESIGN.radius.pill,
                    background: DESIGN.colors.warmGray, fontSize: DESIGN.fontSize.sm, fontWeight: DESIGN.fontWeight.semibold, color: DESIGN.colors.textMuted,
                    display: 'inline-block',
                  }}>
                    Coming Soon
                  </div>
                </div>

                <div style={{ background: DESIGN.colors.white, borderRadius: DESIGN.radius.lg, border: `1px solid ${DESIGN.colors.border}`, padding: '26px', boxShadow: DESIGN.shadow.sm }}>
                  <div style={{ fontFamily: DESIGN.fonts.body, fontSize: DESIGN.fontSize.md, fontWeight: DESIGN.fontWeight.bold, color: DESIGN.colors.navy, marginBottom: 8 }}>Cadence Defaults</div>
                  <div style={{ fontSize: DESIGN.fontSize.sm, color: DESIGN.colors.textSecondary, lineHeight: 1.6 }}>
                    Default publish cadence for new campaigns (burst, drip, weekly). Coming soon.
                  </div>
                  <div style={{
                    marginTop: 18, padding: '8px 18px', borderRadius: DESIGN.radius.pill,
                    background: DESIGN.colors.warmGray, fontSize: DESIGN.fontSize.sm, fontWeight: DESIGN.fontWeight.semibold, color: DESIGN.colors.textMuted,
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
