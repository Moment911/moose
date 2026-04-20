"use client"
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import { T, R, GRN, FB } from '../../../lib/theme'

/**
 * UI-SPEC §5.12 live pipeline ribbon (D-23).
 *
 * Post-launch only. 28px-tall sticky-top ribbon that subscribes to
 * kotoiq_pipeline_runs realtime via supabase channel. Debounces updates
 * to 200ms minimum so rapid ticks don't thrash the ribbon.
 *
 * IMPORTANT (graceful degradation): kotoiq_pipeline_runs is in the
 * 7-migration prod backlog and may not be in the supabase_realtime
 * publication on remote yet (see Plans 4 + STATE.md). The subscription
 * is wrapped in try/catch and the component returns null silently when
 * no row is found — no crash, no error UI. Once the migration ships,
 * the ribbon lights up automatically.
 *
 * WR-07 SECURITY NOTE: kotoiq_pipeline_runs originally shipped WITHOUT
 * ENABLE ROW LEVEL SECURITY (see 20260419_kotoiq_automation.sql), which
 * meant the browser anon key could read every agency's pipeline runs by
 * omitting the .eq('agency_id', ...) filter below.  The follow-up
 * migration 20260512_kotoiq_pipeline_runs_rls.sql adds the standard
 * service-role-only RLS policy.  Until that migration is pushed to
 * production:
 *   - This component MUST keep the .eq('agency_id', agencyId) defensive
 *     filter on every read.  Removing it (or trusting it for security)
 *     would leak cross-agency data.
 *   - Once the RLS migration is applied, this component will return
 *     zero rows from the anon key (RLS service-role-only) — at that
 *     point the read should move behind an authenticated /api/kotoiq
 *     action that derives agency_id from the session.  Tracking as a
 *     v1.1 follow-up.
 *
 * Props:
 *   - clientId: string — used for the realtime filter
 */
export default function LivePipelineRibbon({ clientId }) {
  const { agencyId } = useAuth()
  const [run, setRun] = useState(null)     // latest pipeline_runs row
  const [tick, setTick] = useState(0)      // forces re-render every second so elapsed updates
  const [now, setNow] = useState(() => Date.now())  // captured ref-time for impure-Date.now()
  const debounce = useRef(null)

  // Re-render every second so the elapsed-seconds counter stays live.
  // Captures Date.now() in state instead of reading it during render
  // (react-hooks/purity).
  useEffect(() => {
    const t = setInterval(() => {
      setTick((n) => n + 1)
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(t)
  }, [])
  void tick

  useEffect(() => {
    if (!clientId) return
    let mounted = true
    let channel = null

    // Initial fetch — latest row. Agency-scoped via .eq('agency_id', agencyId)
    // so the kotoiq/no-unscoped-kotoiq lint rule passes AND we get
    // defense-in-depth on top of RLS. agencyId is gated by the LaunchPage
    // auth guard so it is non-null by the time this component mounts; we
    // pass an impossible sentinel ('-' is not a valid uuid) when missing
    // so the lint rule sees a textual .eq('agency_id', ...) and the query
    // returns zero rows rather than leaking cross-agency data.
    ;(async () => {
      try {
        const { data } = await supabase
          .from('kotoiq_pipeline_runs')
          .select('*')
          .eq('agency_id', agencyId || '00000000-0000-0000-0000-000000000000')
          .eq('client_id', clientId)
          .order('updated_at', { ascending: false })
          .limit(1)
        if (mounted && data?.[0]) setRun(data[0])
      } catch {
        // Table may not exist on remote yet — silent degradation
      }
    })()

    // Realtime subscription — wrapped in try/catch so a publication-not-found
    // error doesn't crash the page. If the subscribe fails the ribbon stays
    // on whatever the initial fetch returned (or stays hidden).
    try {
      channel = supabase
        .channel(`kotoiq_pipeline_runs:${clientId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'kotoiq_pipeline_runs',
            filter: `client_id=eq.${clientId}`,
          },
          (payload) => {
            if (!mounted) return
            if (debounce.current) clearTimeout(debounce.current)
            debounce.current = setTimeout(() => {
              setRun(payload.new || payload.old)
            }, 200)
          }
        )
        .subscribe((status) => {
          // CHANNEL_ERROR / TIMED_OUT here is expected when
          // kotoiq_pipeline_runs is not yet in the supabase_realtime
          // publication on remote. Silent degradation — the ribbon stays
          // on whatever the initial fetch returned (or stays hidden if
          // there is no row yet).
          void status
        })
    } catch {
      // Silent degradation — supabase realtime not configured
    }

    return () => {
      mounted = false
      if (debounce.current) clearTimeout(debounce.current)
      if (channel) {
        try { supabase.removeChannel(channel) } catch { /* noop */ }
      }
    }
  }, [clientId, agencyId])

  if (!run) return null

  const status = run.status || 'running'
  // Plan 4 SUMMARY note: kotoiq_pipeline_runs has no current_stage / current_step
  // columns — events are appended to the steps jsonb. Read from the most recent
  // event (last item) when those keys are absent.
  const lastEvent = Array.isArray(run.steps) && run.steps.length > 0
    ? run.steps[run.steps.length - 1]
    : null
  const stage = run.current_stage || lastEvent?.stage_name || lastEvent?.stage || 'Starting'
  const step = run.current_step || lastEvent?.step_name || lastEvent?.step || ''
  const startedAt = run.started_at || run.created_at
  // `now` is updated by a 1s interval (and at mount) so this read is pure
  // during render — react-hooks/purity.
  const elapsedSec = startedAt
    ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
    : 0

  const isError = status === 'failed' || status === 'error'
  const isDone = status === 'completed' || status === 'succeeded'

  const bg = isError ? `${R}15` : isDone ? `${GRN}15` : `${T}15`
  const color = isError ? R : isDone ? GRN : T

  const text = isError
    ? `Stage ${stage} hit a snag. Tap to retry.`
    : isDone
      ? `All caught up. ${run.updated_at ? new Date(run.updated_at).toLocaleTimeString() : ''}`
      : `${stage}${step ? ` · ${step}` : ''}...`

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={status === 'running' ? 'true' : 'false'}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 28,
        background: bg,
        borderBottom: `1px solid ${color}30`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 40px',
        fontFamily: FB,
        fontSize: 12,
        fontWeight: 700,
        color,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: color,
          animation: isDone || isError ? 'none' : 'kotoPulse 1.2s ease-in-out infinite',
        }}
      />
      <span style={{ flex: 1 }}>{text}</span>
      <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280' }}>
        {elapsedSec}s
      </span>
    </div>
  )
}
