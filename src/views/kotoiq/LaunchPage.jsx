"use client"
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Sidebar from '../../components/Sidebar'
import { Shield } from 'lucide-react'
import { W, BLK, FB, FH, R } from '../../lib/theme'

import IngestPanel from '../../components/kotoiq/launch/IngestPanel'
import StreamingNarration from '../../components/kotoiq/launch/StreamingNarration'
import BriefingDoc from '../../components/kotoiq/launch/BriefingDoc'
import LaunchGate from '../../components/kotoiq/launch/LaunchGate'
import LivePipelineRibbon from '../../components/kotoiq/launch/LivePipelineRibbon'
import AutoSaveIndicator from '../../components/kotoiq/launch/AutoSaveIndicator'
import DropZone from '../../components/kotoiq/launch/DropZone'
import DiscrepancyCallout from '../../components/kotoiq/launch/DiscrepancyCallout'
import MarginNote from '../../components/kotoiq/launch/MarginNote'
import RejectFieldModal from '../../components/kotoiq/launch/RejectFieldModal'
import ClarificationsOverlay from '../../components/kotoiq/launch/ClarificationsOverlay'
import ConversationalBot from '../../components/kotoiq/ConversationalBot'

// ── Global keyframes (UI-SPEC §8 motion contract) ──────────────────────────
// Inlined here so the components in src/components/kotoiq/launch/* can rely
// on them being present without each one re-declaring. The shell's existing
// `kotoiqBotFadeIn` keyframe (ConversationalBot.jsx) is defined globally —
// re-defining it here is idempotent (CSS @keyframes are cumulative-by-name).
const KEYFRAMES = `
@keyframes kotoPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
@keyframes kotoCursorBlink { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }
@keyframes kotoiqBotFadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
@keyframes spin { to { transform: rotate(360deg) } }
/* Plan 07-08 — pulses the HotspotDot for HIGH-severity clarifications (UI-SPEC §5.11). */
@keyframes kotoHotspotPulse { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.3); opacity: 0.6 } }
@media (prefers-reduced-motion: reduce) {
  .koto-no-motion, .koto-no-motion * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
}
`

// ── /api/kotoiq/profile JSON helper ─────────────────────────────────────────
async function postProfile(body) {
  const res = await fetch('/api/kotoiq/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  let json = null
  try { json = await res.json() } catch { /* non-JSON */ }
  if (!res.ok) {
    return { ok: false, error: json?.error || `HTTP ${res.status}`, status: res.status }
  }
  return json || { ok: true }
}

// ── /api/kotoiq/profile/stream_seed SSE-like reader ─────────────────────────
// The route returns text/plain newline-delimited narration (RESEARCH §5).
async function streamSeed({ client_id, pasted_text, force_rebuild, onLine }) {
  const res = await fetch('/api/kotoiq/profile/stream_seed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id, pasted_text, force_rebuild }),
  })
  if (!res.ok || !res.body) {
    onLine(`I hit a snag pulling — HTTP ${res.status}. I'll carry on without it.`)
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.trim()) onLine(line)
    }
  }
  if (buffer.trim()) onLine(buffer)
}

// Recognises Koto-internal URLs that carry a clientId in the second segment.
const URL_RE = /\/(onboard|onboarding-dashboard|clients)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9_-]+)/

export default function LaunchPage() {
  const { clientId: routeClientId } = useParams()
  const { agencyId } = useAuth()

  const [clientId, setClientId] = useState(routeClientId || '')
  const [profile, setProfile] = useState(null)
  const [discrepancies, setDiscrepancies] = useState([])
  const [narration, setNarration] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [saveState, setSaveState] = useState('idle')
  const [activeCallout, setActiveCallout] = useState(null)
  const [rejectField, setRejectField] = useState(null)
  const [launching, setLaunching] = useState(false)
  const [launched, setLaunched] = useState(false)
  const [softGaps, setSoftGaps] = useState([])
  const [completenessScore, setCompletenessScore] = useState(null)
  // Plan 07-08 — chat orb badge + pulse derived from open clarifications
  const [pendingCount, setPendingCount] = useState(0)
  const [highPending, setHighPending] = useState(false)

  const refresh = useCallback(async (cid) => {
    const id = cid || clientId
    if (!id) return
    const out = await postProfile({ action: 'get_profile', client_id: id })
    if (out?.profile) {
      setProfile(out.profile)
      setDiscrepancies(out.discrepancies || [])
      setSoftGaps(out.profile.soft_gaps || [])
      setCompletenessScore(out.profile.completeness_score)
      if (out.profile.launched_at) setLaunched(true)
    }
  }, [clientId])

  useEffect(() => {
    if (routeClientId) {
      setClientId(routeClientId)
      refresh(routeClientId)
    }
  }, [routeClientId, refresh])

  // Plan 07-08 — fallback poll for clarifications count to drive the orb
  // badge + pulse. ClarificationsOverlay already runs realtime for hotspots;
  // this is a coarse 20s catch-up so the badge updates even if realtime is
  // momentarily disconnected.
  useEffect(() => {
    if (!clientId) return undefined
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/kotoiq/profile', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'list_clarifications', client_id: clientId, status: 'open' }),
        })
        const j = await res.json()
        if (cancelled) return
        const list = Array.isArray(j.clarifications) ? j.clarifications : []
        setPendingCount(list.length)
        setHighPending(list.some((c) => c.severity === 'high'))
      } catch {
        // Non-blocking — keep last known badge state.
      }
    }
    load()
    const t = setInterval(load, 20000)
    return () => { cancelled = true; clearInterval(t) }
  }, [clientId])

  const runIngest = async ({ url, pasted_text, force_rebuild } = {}) => {
    let id = clientId
    if (url) {
      const m = url.match(URL_RE)
      if (!m) {
        setNarration(["That URL doesn't match a Koto client link."])
        return
      }
      id = m[2]
      setClientId(id)
    }
    if (!id) return
    setNarration([])
    setStreaming(true)
    try {
      await streamSeed({
        client_id: id,
        pasted_text,
        force_rebuild,
        onLine: (line) => setNarration((prev) => [...prev, line]),
      })
    } finally {
      setStreaming(false)
      await refresh(id)
    }
  }

  const handleFieldSave = async (field_name, value) => {
    setSaveState('saving')
    const out = await postProfile({
      action: 'update_field',
      client_id: clientId,
      field_name,
      value,
    })
    if (out?.ok) {
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
      refresh()
    } else {
      setSaveState('error')
    }
  }

  const handleFieldReject = (field_name) => setRejectField(field_name)

  const confirmReject = async (field_name) => {
    await postProfile({ action: 'reject_field', client_id: clientId, field_name })
    setRejectField(null)
    refresh()
  }

  const handleDeferredSource = async (payload) => {
    if (!clientId) return
    await postProfile({
      action: 'add_source',
      client_id: clientId,
      source_type: 'deferred_v2',
      source_url: payload.external_url || undefined,
      metadata: payload,
    })
    refresh()
  }

  const handleLaunch = async () => {
    setLaunching(true)
    try {
      const out = await postProfile({
        action: 'launch',
        client_id: clientId,
        target_keywords: [],
      })
      if (out?.run_id) setLaunched(true)
    } finally {
      setLaunching(false)
    }
  }

  // ── Auth guard (matches KotoIQShellPage pattern) ─────────────────────────
  if (!agencyId) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: W, fontFamily: FB }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <Shield size={48} color={R} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
            <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: BLK, marginBottom: 8 }}>
              Login Required
            </div>
            <div style={{ fontSize: 14, color: '#374151' }}>
              You need to be logged into an agency to use KotoIQ.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const pendingMarginNotes = (profile?.margin_notes || []).filter((n) => n.status === 'pending')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: W, fontFamily: FB, color: BLK }}>
      <style>{KEYFRAMES}</style>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {launched && <LivePipelineRibbon clientId={clientId} />}

        <div style={{ position: 'relative', flex: 1 }}>
          {/* Top-right AutoSaveIndicator */}
          <div style={{ position: 'absolute', top: 12, right: 24, zIndex: 10 }}>
            <AutoSaveIndicator state={saveState} />
          </div>

          {!clientId || !profile ? (
            <>
              <IngestPanel onSubmit={runIngest} disabled={streaming} />
              {(narration.length > 0 || streaming) && (
                <StreamingNarration lines={narration} streaming={streaming} />
              )}
            </>
          ) : (
            <>
              {(narration.length > 0 || streaming) && (
                <StreamingNarration lines={narration} streaming={streaming} />
              )}
              <BriefingDoc
                profile={profile}
                discrepancies={discrepancies}
                onFieldSave={handleFieldSave}
                onFieldReject={handleFieldReject}
                onOpenDiscrepancy={setActiveCallout}
              />

              {/* D-10 margin notes — Plan 04 profileSeeder derives up to 4. */}
              {pendingMarginNotes.length > 0 && (
                <aside
                  aria-label="Claude's observations"
                  style={{ maxWidth: 720, margin: '0 auto', padding: '0 40px 24px' }}
                >
                  {pendingMarginNotes.map((n) => (
                    <MarginNote
                      key={n.id}
                      note={n}
                      onAccept={async (note) => {
                        if (note.field_path && note.suggested_value) {
                          await postProfile({
                            action: 'update_field',
                            client_id: clientId,
                            field_name: note.field_path,
                            value: note.suggested_value,
                          })
                        }
                        refresh()
                      }}
                      onReject={async () => {
                        // v1: transient dismissal via component state.
                        // Persistence will land alongside Plan 8's
                        // dashboard tab (margin-note status update API).
                      }}
                      onEdit={async (note) => {
                        if (note.field_path && typeof document !== 'undefined') {
                          const el = document.querySelector(`[data-field-path="${note.field_path}"]`)
                          if (el && typeof el.scrollIntoView === 'function') {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }
                        }
                      }}
                    />
                  ))}
                </aside>
              )}

              {/* Discrepancy callout — inline below briefing when one is open. */}
              {activeCallout && (
                <DiscrepancyCallout
                  report={activeCallout}
                  onChoose={async (r) => {
                    await handleFieldSave(activeCallout.field, String(r.value))
                    setActiveCallout(null)
                  }}
                  onEdit={() => setActiveCallout(null)}
                  onIgnore={() => setActiveCallout(null)}
                  onClose={() => setActiveCallout(null)}
                />
              )}

              {/* Launch gate — sticky-bottom, hidden post-launch in favor of ribbon. */}
              {!launched && (
                <LaunchGate
                  score={completenessScore}
                  softGaps={softGaps}
                  onLaunch={handleLaunch}
                  launching={launching}
                />
              )}
            </>
          )}
        </div>

        <DropZone
          onKotoUrl={(u) => runIngest({ url: u })}
          onDeferredSource={handleDeferredSource}
        />

        <RejectFieldModal
          open={!!rejectField}
          fieldName={rejectField}
          onCancel={() => setRejectField(null)}
          onConfirm={confirmReject}
        />

        {/* Plan 07-08: in-context hotspots + HIGH-severity escalation sheet.
            Realtime-subscribed to kotoiq_clarifications for this client. */}
        {clientId && profile && (
          <ClarificationsOverlay
            clientId={clientId}
            agencyId={agencyId}
            onAnswer={async (id, text) => {
              await postProfile({
                action: 'answer_clarification',
                clarification_id: id,
                answer_text: text,
              })
              refresh()
            }}
            onForward={async (id, channel) => {
              await postProfile({
                action: 'forward_to_client',
                clarification_id: id,
                channel,
              })
            }}
            onSkip={async (id) => {
              // v1: model "skip" as an empty answer with update_field=false so the
              // row goes to status='answered' without polluting the profile field.
              await postProfile({
                action: 'answer_clarification',
                clarification_id: id,
                answer_text: '[skipped]',
                update_field: false,
              })
            }}
          />
        )}

        {/* Plan 07-08: floating chat orb in clarifications mode (D-16 / §5.9).
            Same orb the rest of KotoIQ uses, just driven into a different mode. */}
        {clientId && profile && (
          <ConversationalBot
            clientId={clientId}
            clientName={profile.business_name || 'this client'}
            agencyId={agencyId}
            mode="clarifications"
            pendingClarifications={pendingCount}
            highSeverityPending={highPending}
            onAnswerClarification={async (id, text) => {
              await postProfile({
                action: 'answer_clarification',
                clarification_id: id,
                answer_text: text,
              })
              refresh()
            }}
            onForwardClarification={async (id, channel) => {
              await postProfile({
                action: 'forward_to_client',
                clarification_id: id,
                channel,
              })
            }}
            onSkipClarification={async (id) => {
              await postProfile({
                action: 'answer_clarification',
                clarification_id: id,
                answer_text: '[skipped]',
                update_field: false,
              })
            }}
          />
        )}
      </div>
    </div>
  )
}
