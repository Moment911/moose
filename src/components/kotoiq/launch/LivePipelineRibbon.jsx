"use client"
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
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
 * Props:
 *   - clientId: string — used for the realtime filter
 */
export default function LivePipelineRibbon({ clientId }) {
  const [run, setRun] = useState(null)     // latest pipeline_runs row
  const [tick, setTick] = useState(0)      // forces re-render every second so elapsed updates
  const debounce = useRef(null)

  // Re-render every second so the elapsed-seconds counter stays live
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  void tick

  useEffect(() => {
    if (!clientId) return
    let mounted = true
    let channel = null

    // Initial fetch — latest row
    ;(async () => {
      try {
        const { data } = await supabase
          .from('kotoiq_pipeline_runs')
          .select('*')
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
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Silent — table not in supabase_realtime publication yet
            // eslint-disable-next-line no-console
            if (err) console.debug('[LivePipelineRibbon] subscribe degraded:', err.message)
          }
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
  }, [clientId])

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
  const elapsedSec = startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
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
