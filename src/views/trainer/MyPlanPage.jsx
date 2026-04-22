"use client"
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchMyPlan, logSet as apiLogSet } from '../../lib/trainer/myPlanFetch'
import MyPlanShell from '../../components/trainer/MyPlanShell'
import TrainerWelcomeCard from '../../components/trainer/TrainerWelcomeCard'
import TraineeDisclaimerAckModal from './TraineeDisclaimerAckModal'
import PlanBaselineCard from '../../components/trainer/PlanBaselineCard'
import RoadmapCard from '../../components/trainer/RoadmapCard'
import WorkoutAccordion from '../../components/trainer/WorkoutAccordion'
import MealPlanTable from '../../components/trainer/MealPlanTable'
import GroceryList from '../../components/trainer/GroceryList'
import PlaybookCard from '../../components/trainer/PlaybookCard'
import TrainerTabs from '../../components/trainer/TrainerTabs'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 3 — trainee-facing /my-plan page.
//
// Auth model:
//   - Trainees sign in via Supabase magic link (no agency_members row).
//   - This page checks supabase.auth.getSession() directly, NOT useAuth().
//     useAuth's loadAgencyData() doesn't know about koto_fitness_trainee_users
//     and would flip the user into the generic "client" fallback, which
//     would hydrate the Koto sidebar — we don't want that.
//
// Territory:
//   - Reads the current plan (highest block_number) via /api/trainer/my-plan.
//   - Reuses prop-driven components from src/components/trainer/* for
//     baseline, roadmap, workout, meals, grocery, playbook.
//   - All "regenerate" / "edit" callbacks are wired to no-ops — trainees
//     are read-only except the workout log grid.
//
// Disclaimer gate: first sign-in shows TraineeDisclaimerAckModal. It
// writes trainer_disclaimer_ack_at to user_metadata; we refresh the
// session locally so the gate lifts without a page reload.
// ─────────────────────────────────────────────────────────────────────────────

const BG = '#f9fafb'
const INK = '#0a0a0a'
const GRY5 = '#6b7280'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'workouts', label: 'Workouts' },
  { key: 'meals', label: 'Meals' },
  { key: 'grocery', label: 'Grocery list' },
  { key: 'playbook', label: 'Playbook' },
]

export default function MyPlanPage() {
  const [sessionState, setSessionState] = useState({ loading: true, user: null })
  const [planState, setPlanState] = useState({ loading: true, error: null, data: null })
  const [tab, setTab] = useState('overview')
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  // ── Load the current supabase session ─────────────────────────────────
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSessionState({ loading: false, user: data?.session?.user ?? null })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (cancelled) return
      setSessionState({ loading: false, user: session?.user ?? null })
    })
    return () => {
      cancelled = true
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  // ── Load the plan once we have a user ─────────────────────────────────
  const loadPlan = useCallback(async () => {
    setPlanState({ loading: true, error: null, data: null })
    try {
      const data = await fetchMyPlan()
      setPlanState({ loading: false, error: null, data })
    } catch (e) {
      setPlanState({
        loading: false,
        error: { status: e?.status ?? 500, message: e?.message || 'Could not load your plan.' },
        data: null,
      })
    }
  }, [])

  useEffect(() => {
    if (sessionState.loading) return
    if (!sessionState.user) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPlan()
  }, [sessionState.loading, sessionState.user, loadPlan])

  // ── Disclaimer gate ───────────────────────────────────────────────────
  //
  // Acked via EITHER the DB mapping row OR the user_metadata flag — the
  // modal writes metadata, so we check both so we don't re-prompt on
  // every refresh while waiting for the mapping row to catch up.
  const shouldShowDisclaimer = useMemo(() => {
    if (!planState.data || !sessionState.user) return null
    const dbAck = planState.data?.invite?.disclaimer_ack_at
    const metaAck = sessionState.user?.user_metadata?.trainer_disclaimer_ack_at
    return !(dbAck || metaAck)
  }, [planState.data, sessionState.user])
  useEffect(() => {
    if (shouldShowDisclaimer === null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowDisclaimer(shouldShowDisclaimer)
  }, [shouldShowDisclaimer])

  async function handleDisclaimerAcked() {
    // Re-read session — user_metadata refresh will carry the new flag.
    const { data } = await supabase.auth.getSession()
    setSessionState({ loading: false, user: data?.session?.user ?? null })
    setShowDisclaimer(false)
  }

  // ── Log-set callback passed to WorkoutAccordion ───────────────────────
  const handleLogSet = useCallback(
    async (payload) => {
      if (!planState.data?.plan?.id) return
      try {
        await apiLogSet({
          plan_id: planState.data.plan.id,
          ...payload,
        })
        // Simplest refresh strategy: refetch the plan + logs.
        await loadPlan()
      } catch (e) {
        console.error('[MyPlan] log_set failed:', e?.message)
      }
    },
    [planState.data, loadPlan],
  )

  // ── Render paths ──────────────────────────────────────────────────────
  if (sessionState.loading) {
    return (
      <FullScreenState>
        <Loader2 size={28} className="spin" style={{ color: INK }} />
        <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </FullScreenState>
    )
  }

  if (!sessionState.user) {
    // No session at all — send to login. Supabase magic-link callback
    // handles setting the session on the /my-plan URL after click-through.
    return <Navigate to="/login" replace state={{ from: '/my-plan' }} />
  }

  if (planState.loading) {
    return (
      <FullScreenState>
        <Loader2 size={28} className="spin" style={{ color: INK }} />
      </FullScreenState>
    )
  }

  if (planState.error) {
    return (
      <MyPlanShell agency={null}>
        <NotInvitedOrError error={planState.error} />
      </MyPlanShell>
    )
  }

  const { plan, logs, trainee, agency } = planState.data || {}

  if (!plan) {
    return (
      <MyPlanShell agency={agency}>
        <EmptyState traineeName={trainee?.full_name} />
      </MyPlanShell>
    )
  }

  return (
    <MyPlanShell agency={agency}>
      {showDisclaimer ? (
        <TraineeDisclaimerAckModal onAcked={handleDisclaimerAcked} />
      ) : null}

      <header style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: GRY5, fontWeight: 600, letterSpacing: '.02em', textTransform: 'uppercase' }}>
          Welcome back
        </div>
        <h1 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 900, color: INK, letterSpacing: '-.5px' }}>
          {trainee?.full_name || 'Your plan'}
        </h1>
      </header>

      <TrainerTabs tabs={TABS} activeKey={tab} onChange={setTab} />

      <div style={{ marginTop: 20 }}>
        {tab === 'overview' ? (
          <div style={{ display: 'grid', gap: 18 }}>
            <TrainerWelcomeCard compact />
            {plan.baseline ? (
              <PlanBaselineCard baseline={plan.baseline} />
            ) : null}
            {plan.roadmap ? (
              <RoadmapCard roadmap={plan.roadmap} currentPhase={plan.phase_ref || 1} />
            ) : null}
          </div>
        ) : null}

        {tab === 'workouts' ? (
          plan.workout_plan ? (
            <WorkoutAccordion
              workoutPlan={plan.workout_plan}
              logs={logs || []}
              onLogSet={handleLogSet}
            />
          ) : (
            <EmptySection label="Your workout plan is being prepared." />
          )
        ) : null}

        {tab === 'meals' ? (
          plan.meal_plan ? (
            <MealPlanTable mealPlan={plan.meal_plan} />
          ) : (
            <EmptySection label="Your meal plan is being prepared." />
          )
        ) : null}

        {tab === 'grocery' ? (
          plan.grocery_list ? (
            <GroceryList groceryList={plan.grocery_list} />
          ) : (
            <EmptySection label="Your grocery list is being prepared." />
          )
        ) : null}

        {tab === 'playbook' ? (
          plan.playbook ? (
            <PlaybookCard playbook={plan.playbook} />
          ) : (
            <EmptySection label="Your coaching playbook is being prepared." />
          )
        ) : null}
      </div>
    </MyPlanShell>
  )
}

// ── Small helpers ───────────────────────────────────────────────────────────

function FullScreenState({ children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  )
}

function EmptyState({ traineeName }) {
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: INK }}>
        {traineeName ? `Hi ${traineeName.split(' ')[0]},` : 'Hi there,'}
      </h2>
      <p style={{ margin: '0 0 4px', color: GRY5, fontSize: 14, lineHeight: 1.6 }}>
        Your coach hasn&apos;t finalized your plan yet. We&apos;ll email you as soon as it&apos;s ready.
      </p>
    </div>
  )
}

function EmptySection({ label }) {
  return (
    <div
      style={{
        padding: 28,
        textAlign: 'center',
        border: '1px dashed #e5e7eb',
        borderRadius: 12,
        color: GRY5,
        fontSize: 14,
      }}
    >
      {label}
    </div>
  )
}

function NotInvitedOrError({ error }) {
  const isNotFound = error?.status === 404 || error?.status === 401
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: INK }}>
        {isNotFound ? 'No plan on file' : 'Something went wrong'}
      </h2>
      <p style={{ margin: 0, color: GRY5, fontSize: 14, lineHeight: 1.6 }}>
        {isNotFound
          ? 'Your coach hasn\'t invited you yet, or the invitation has been revoked. Reach out to them to get started.'
          : error?.message || 'Please try again in a moment.'}
      </p>
    </div>
  )
}
