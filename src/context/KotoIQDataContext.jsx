"use client"
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

/**
 * KotoIQDataContext — shared client snapshot + cross-tab invalidation.
 *
 * Why this exists:
 *   - Every KotoIQ tab independently fetches its slice of data from
 *     /api/kotoiq. That's fine until the user clicks "Launch All" and the
 *     17 wave actions overwrite the underlying kotoiq_* tables. Tabs that
 *     are already mounted don't know to refetch and show stale numbers.
 *   - Several tabs duplicate the exact same query (e.g. PageFactoryTab
 *     and StrategyTab both call get_page_factory_gap_coverage).
 *
 * What this provides:
 *   - `refreshKey` — increments on Launch All completion. Tabs include it
 *     in their useEffect deps to auto-refetch.
 *   - `bumpRefresh()` — call from MissionControl when run_all_audits
 *     completes (or after a single tool rerun).
 *   - Cached cross-tab data slices fetched on mount + on refresh:
 *       pfStats, pfGapCoverage, strategicPlan
 *     Subscribers read these instead of re-querying.
 *   - `clientId` / `agencyId` available everywhere — no more prop drilling.
 *
 * Keep it lean. Don't try to centralize every fetch — only data that
 * 2+ tabs share or that's expensive enough to dedupe.
 */

const Ctx = createContext({
  clientId: null,
  agencyId: null,
  refreshKey: 0,
  bumpRefresh: () => {},
  // Shared slices
  pfStats: null,
  pfGapCoverage: [],
  strategicPlan: null,
  freshness: {}, // { source_name: { age_days, grade, last_run_at, ... } }
  loading: false,
})

async function kapi(action, body = {}) {
  try {
    const res = await fetch('/api/kotoiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export function KotoIQDataProvider({ clientId, agencyId, children }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [pfStats, setPfStats] = useState(null)
  const [pfGapCoverage, setPfGapCoverage] = useState([])
  const [strategicPlan, setStrategicPlan] = useState(null)
  const [freshness, setFreshness] = useState({})
  const [loading, setLoading] = useState(false)
  const inFlight = useRef(false)

  const bumpRefresh = useCallback(() => setRefreshKey(k => k + 1), [])

  // Fetch shared slices on mount + whenever refreshKey changes or clientId switches
  useEffect(() => {
    if (!clientId) {
      setPfStats(null)
      setPfGapCoverage([])
      setStrategicPlan(null)
      return
    }
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    let cancelled = false
    Promise.allSettled([
      kapi('get_page_factory_stats', { client_id: clientId }),
      kapi('get_page_factory_gap_coverage', { client_id: clientId }),
      kapi('get_latest_strategic_plan', { client_id: clientId }),
      kapi('get_data_freshness', { client_id: clientId }),
    ]).then(([stats, coverage, plan, fresh]) => {
      if (cancelled) return
      if (stats.status === 'fulfilled' && stats.value) setPfStats(stats.value)
      if (coverage.status === 'fulfilled' && coverage.value?.services) setPfGapCoverage(coverage.value.services)
      if (plan.status === 'fulfilled' && plan.value?.plan) setStrategicPlan(plan.value.plan)
      if (fresh.status === 'fulfilled' && fresh.value?.by_source) setFreshness(fresh.value.by_source)
      setLoading(false)
      inFlight.current = false
    })
    return () => { cancelled = true; inFlight.current = false }
  }, [clientId, refreshKey])

  return (
    <Ctx.Provider value={{ clientId, agencyId, refreshKey, bumpRefresh, pfStats, pfGapCoverage, strategicPlan, freshness, loading }}>
      {children}
    </Ctx.Provider>
  )
}

/** Hook for any tab that wants shared KotoIQ state. */
export function useKotoIQData() {
  return useContext(Ctx)
}

/**
 * Helper hook for tabs that fetch their own slice but want to auto-refetch
 * when Launch All completes. Returns the current refreshKey to drop into
 * a useEffect dependency array.
 */
export function useKotoIQRefreshKey() {
  return useContext(Ctx).refreshKey
}

/**
 * Hook for the freshness map. Tabs can call useFreshness('quick_scan') to
 * get { age_days, grade, last_run_at } for a specific source.
 */
export function useFreshness(source) {
  const { freshness } = useContext(Ctx)
  return freshness?.[source] || null
}
