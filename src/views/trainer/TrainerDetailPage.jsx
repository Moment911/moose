"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Archive,
  Undo2,
  Loader2,
  Sparkles,
  Dumbbell,
  Utensils,
  TrendingUp,
  Target,
  BookOpen,
  LineChart,
  LayoutGrid,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { FeatureDisabledPanel } from './TrainerListPage'
import { trainerFetch } from '../../lib/trainer/trainerFetch'
import { missingIntakeFields } from '../../lib/trainer/intakeCompleteness'
import { useAuth } from '../../hooks/useAuth'
import { cmToFeetInches, kgToLbs } from '../../lib/trainer/units'
import { supabase } from '../../lib/supabase'
import { R, T, BLK, GRY, GRN } from '../../lib/theme'

import PlanBaselineCard from '../../components/trainer/PlanBaselineCard'
import RoadmapCard from '../../components/trainer/RoadmapCard'
import WorkoutAccordion from '../../components/trainer/WorkoutAccordion'
import FoodPrefsWizard from '../../components/trainer/FoodPrefsWizard'
import MealPlanTable from '../../components/trainer/MealPlanTable'
import GroceryList from '../../components/trainer/GroceryList'
import PlaybookCard from '../../components/trainer/PlaybookCard'
import WorkoutLogGrid from '../../components/trainer/WorkoutLogGrid'
import TrainerTabs from '../../components/trainer/TrainerTabs'
import TrainerStatusStrip from '../../components/trainer/TrainerStatusStrip'
import TrainerToast from '../../components/trainer/TrainerToast'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — /trainer/:traineeId full plan view.
//
// Layout: sticky header strip (name, goal, archive, status dots), then top-level
// tabs — Overview / Plan / Nutrition / Playbook / Progress.  Every generate CTA
// lives inside the tab it belongs to, so the operator never scrolls past one to
// find the next.  Error toast is fixed bottom-right.
//
// Wiring, state, handlers, and generation endpoints are PRESERVED verbatim from
// the prior render — only the composition tree changed.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'
const GRY5 = '#6b7280'
const GRY7 = '#374151'

// Siblings of trainerFetch — same auth pattern, different URLs.
async function authHeader() {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    return token ? { authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

async function trainerGenerateFetch(body, { agencyId } = {}) {
  const auth = await authHeader()
  const headers = { 'content-type': 'application/json', ...auth }
  if (agencyId) headers['x-koto-agency-id'] = agencyId
  return fetch('/api/trainer/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function trainerLogsFetch(body, { agencyId } = {}) {
  const auth = await authHeader()
  const headers = { 'content-type': 'application/json', ...auth }
  if (agencyId) headers['x-koto-agency-id'] = agencyId
  return fetch('/api/trainer/workout-logs', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function trainerInviteFetch(body, { agencyId } = {}) {
  const auth = await authHeader()
  const headers = { 'content-type': 'application/json', ...auth }
  if (agencyId) headers['x-koto-agency-id'] = agencyId
  return fetch('/api/trainer/invite', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

export default function TrainerDetailPage() {
  const { traineeId } = useParams()
  const navigate = useNavigate()
  const { agencyId } = useAuth()

  // ── Trainee ────────────────────────────────────────────────────────────────
  const [trainee, setTrainee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionPending, setActionPending] = useState(false)
  const [featureDisabled, setFeatureDisabled] = useState(false)

  // ── Plan ───────────────────────────────────────────────────────────────────
  const [plan, setPlan] = useState(null) // { id, baseline, roadmap, workout_plan, food_preferences, meal_plan, grocery_list, generated_at, ... }
  const [currentPhase, setCurrentPhase] = useState(1)

  // ── Per-step pending + error flags ─────────────────────────────────────────
  const [pending, setPending] = useState({
    baseline: false,
    roadmap: false,
    workout: false,
    food_prefs: false,
    submit_prefs: false,
    meals: false,
    playbook: false,
    adjust: false,
  })
  const [stepError, setStepError] = useState(null)

  // ── Workout logs ───────────────────────────────────────────────────────────
  const [logs, setLogs] = useState([])
  const [adherence, setAdherence] = useState(null)
  const [expandSessionDay, setExpandSessionDay] = useState(null)

  // ── Food-prefs wizard ──────────────────────────────────────────────────────
  const [wizardQuestions, setWizardQuestions] = useState(null) // null = closed

  // ── Active top-level tab ───────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview')

  // Stable toast message ref so transient errors can auto-clear.
  const toastTimer = useRef(null)
  function flashError(msg) {
    setStepError(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setStepError(null), 8000)
  }
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const setPendingStep = useCallback((key, val) => {
    setPending((prev) => ({ ...prev, [key]: val }))
  }, [])

  // ── Load trainee ───────────────────────────────────────────────────────────
  const loadTrainee = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await trainerFetch({ action: 'get', trainee_id: traineeId }, { agencyId })
      if (res.status === 404) {
        setFeatureDisabled(true)
        return
      }
      if (res.status === 401) {
        navigate('/login')
        return
      }
      if (!res.ok) {
        setError(`Failed to load trainee (${res.status})`)
        return
      }
      const data = await res.json()
      setTrainee(data.trainee)
    } catch (e) {
      setError(e.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }, [traineeId, agencyId, navigate])

  useEffect(() => {
    loadTrainee()
  }, [loadTrainee])

  // ── Try to load current plan on mount (optional endpoint) ──────────────────
  useEffect(() => {
    let cancelled = false
    async function tryLoadPlan() {
      try {
        const res = await trainerGenerateFetch(
          { action: 'get_current_plan', trainee_id: traineeId },
          { agencyId },
        )
        if (cancelled) return
        if (!res.ok) return // Endpoint may not exist yet — state-only fallback.
        const data = await res.json()
        if (data?.plan) {
          setPlan(data.plan)
          if (data.plan?.phase_ref?.startsWith?.('phase_')) {
            const n = Number(data.plan.phase_ref.replace('phase_', ''))
            if (Number.isFinite(n)) setCurrentPhase(n)
          }
        }
      } catch {
        // Silent — fallback is state-only.
      }
    }
    if (traineeId && agencyId) tryLoadPlan()
    return () => { cancelled = true }
  }, [traineeId, agencyId])

  // ── Fetch workout logs when plan has a workout ─────────────────────────────
  const refreshLogs = useCallback(async () => {
    if (!plan?.id && !plan?.workout_plan) return
    try {
      const res = await trainerLogsFetch(
        { action: 'list_for_plan', plan_id: plan.id, trainee_id: traineeId },
        { agencyId },
      )
      if (!res.ok) return
      const data = await res.json()
      setLogs(data.logs || [])
    } catch {
      /* ignore */
    }
    try {
      const res = await trainerLogsFetch(
        { action: 'compute_adherence', plan_id: plan.id },
        { agencyId },
      )
      if (res.ok) {
        const data = await res.json()
        setAdherence(data)
      }
    } catch {
      /* ignore */
    }
  }, [plan?.id, plan?.workout_plan, traineeId, agencyId])

  useEffect(() => {
    if (plan?.workout_plan) refreshLogs()
  }, [plan?.workout_plan, refreshLogs])

  // ── Archive / unarchive (Phase 1 parity) ───────────────────────────────────
  async function callTraineeAction(action) {
    setActionPending(true)
    try {
      const res = await trainerFetch({ action, trainee_id: traineeId }, { agencyId })
      if (res.status === 404 && (await res.clone().json().catch(() => ({}))).error === 'Not found') {
        navigate('/trainer')
        return
      }
      if (!res.ok) {
        setError(`${action} failed (${res.status})`)
        return
      }
      await loadTrainee()
    } finally {
      setActionPending(false)
    }
  }

  async function handleUpdateAboutYou(newText) {
    const res = await trainerFetch(
      { action: 'update', trainee_id: traineeId, patch: { about_you: newText || null } },
      { agencyId },
    )
    if (!res.ok) {
      flashError(`Save failed (${res.status})`)
      return false
    }
    await loadTrainee()
    return true
  }

  // Generic intake patch — used by MissingIntakeFieldsCard to finish the
  // intake inline without navigating away.  Accepts any partial patch of
  // IntakeInput fields; server validates via validateIntakePartial.
  async function handleUpdateTraineeFields(patch) {
    const res = await trainerFetch(
      { action: 'update', trainee_id: traineeId, patch },
      { agencyId },
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      flashError(body.error || `Save failed (${res.status})`)
      return false
    }
    await loadTrainee()
    return true
  }

  const [inviteStatus, setInviteStatus] = useState(null) // { status, invite_sent_at, ... } | null
  const [invitePending, setInvitePending] = useState(false)

  const refreshInviteStatus = useCallback(async () => {
    if (!traineeId || !agencyId) return
    try {
      const res = await trainerInviteFetch(
        { action: 'get_invite_status', trainee_id: traineeId },
        { agencyId },
      )
      if (!res.ok) return
      const data = await res.json()
      setInviteStatus(data || null)
    } catch { /* ignore */ }
  }, [traineeId, agencyId])

  useEffect(() => { refreshInviteStatus() }, [refreshInviteStatus])

  async function handleSendInvite() {
    if (!trainee?.email) {
      flashError('Trainee has no email — add one via the intake form first.')
      return
    }
    setInvitePending(true)
    try {
      const alreadyInvited = inviteStatus?.status === 'invited' || inviteStatus?.status === 'active'
      const action = alreadyInvited ? 'resend_invite' : 'send_invite'
      const res = await trainerInviteFetch(
        { action, trainee_id: traineeId },
        { agencyId },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        flashError(body.error || `Invite failed (${res.status})`)
        return
      }
      await refreshInviteStatus()
    } finally {
      setInvitePending(false)
    }
  }

  // ── Generate dispatcher ────────────────────────────────────────────────────
  async function generate(step, body, onSuccess) {
    setPendingStep(step, true)
    setStepError(null)
    try {
      const res = await trainerGenerateFetch(body, { agencyId })
      if (res.status === 401) {
        navigate('/login')
        return
      }
      if (res.status === 404) {
        setFeatureDisabled(true)
        return
      }
      if (res.status === 502) {
        flashError('Plan generation failed (Sonnet). Retry in a moment or contact support.')
        return
      }
      if (!res.ok) {
        // Special-case the intake-completeness gate so the trainer sees
        // exactly which fields to finish instead of a raw JSON blob.
        const body = await res.json().catch(() => null)
        if (body?.error === 'intake_incomplete' && Array.isArray(body.missing_fields)) {
          flashError(
            `Finish the intake before generating: ${body.missing_fields.join(', ')}`,
          )
          return
        }
        const detail = body ? JSON.stringify(body).slice(0, 160) : ''
        flashError(`Generation failed (${res.status})${detail ? `: ${detail}` : ''}`)
        return
      }
      const data = await res.json()
      if (onSuccess) onSuccess(data)
    } catch (e) {
      flashError(e.message || 'Network error while generating')
    } finally {
      setPendingStep(step, false)
    }
  }

  function handleGenerateBaseline() {
    generate(
      'baseline',
      { action: 'generate_baseline', trainee_id: traineeId },
      (data) => {
        setPlan((prev) => ({
          ...(prev || {}),
          id: data.plan_id || prev?.id,
          baseline: data.baseline,
        }))
      },
    )
  }

  function handleGenerateRoadmap() {
    if (!plan?.id) return
    generate(
      'roadmap',
      { action: 'generate_roadmap', trainee_id: traineeId, plan_id: plan.id },
      (data) => {
        setPlan((prev) => ({ ...(prev || {}), roadmap: data.roadmap }))
      },
    )
  }

  function handleGeneratePlaybook() {
    if (!plan?.id) return
    generate(
      'playbook',
      { action: 'generate_playbook', trainee_id: traineeId, plan_id: plan.id },
      (data) => {
        setPlan((prev) => ({ ...(prev || {}), playbook: data.playbook }))
      },
    )
  }

  function handleGenerateWorkout(phase = currentPhase) {
    if (!plan?.id) return
    setCurrentPhase(phase)
    generate(
      'workout',
      { action: 'generate_workout', trainee_id: traineeId, plan_id: plan.id, phase },
      (data) => {
        setPlan((prev) => ({
          ...(prev || {}),
          workout_plan: data.workout_plan,
          generated_at: new Date().toISOString(),
        }))
        setLogs([])
        setAdherence(null)
      },
    )
  }

  function handleElicitFoodPrefs() {
    if (!plan?.id) return
    generate(
      'food_prefs',
      { action: 'elicit_food_prefs', trainee_id: traineeId, plan_id: plan.id },
      (data) => {
        setWizardQuestions(data.questions || [])
      },
    )
  }

  async function handleSubmitFoodPrefs(answers) {
    if (!plan?.id) return
    setPendingStep('submit_prefs', true)
    setStepError(null)
    try {
      const res = await trainerGenerateFetch(
        { action: 'submit_food_prefs', trainee_id: traineeId, plan_id: plan.id, answers },
        { agencyId },
      )
      if (!res.ok) {
        flashError(`Failed to save food preferences (${res.status})`)
        return
      }
      setPlan((prev) => ({ ...(prev || {}), food_preferences: answers }))
      setWizardQuestions(null)
    } catch (e) {
      flashError(e.message || 'Network error')
    } finally {
      setPendingStep('submit_prefs', false)
    }
  }

  function handleGenerateMeals() {
    if (!plan?.id) return
    generate(
      'meals',
      { action: 'generate_meals', trainee_id: traineeId, plan_id: plan.id },
      (data) => {
        setPlan((prev) => ({
          ...(prev || {}),
          meal_plan: data.meal_plan,
          grocery_list: data.grocery_list,
        }))
      },
    )
  }

  function handleGenerateNextBlock() {
    if (!plan?.id) return
    const next = Math.min(3, currentPhase + 1)
    generate(
      'adjust',
      {
        action: 'adjust_block',
        trainee_id: traineeId,
        prior_plan_id: plan.id,
        next_phase: next,
      },
      (data) => {
        setPlan((prev) => ({
          ...(prev || {}),
          id: data.new_plan_id || prev?.id,
          workout_plan: {
            ...(data.workout_plan || {}),
            adjustments_made: data.adjustments_made,
          },
          generated_at: new Date().toISOString(),
        }))
        setCurrentPhase(next)
        setLogs([])
        setAdherence(null)
      },
    )
  }

  // ── Log a set ──────────────────────────────────────────────────────────────
  const handleLogSet = useCallback(
    async (entry) => {
      if (!plan?.id) return
      try {
        const body = {
          action: entry.existing_log_id ? 'update_log' : 'log_set',
          plan_id: plan.id,
          trainee_id: traineeId,
          session_day_number: entry.session_day_number,
          exercise_id: entry.exercise_id,
          exercise_name: entry.exercise_name,
          set_number: entry.set_number,
          actual_weight_kg: entry.actual_weight_kg,
          actual_reps: entry.actual_reps,
          rpe: entry.rpe,
          notes: entry.notes,
        }
        if (entry.existing_log_id) {
          body.log_id = entry.existing_log_id
          body.patch = {
            actual_weight_kg: entry.actual_weight_kg,
            actual_reps: entry.actual_reps,
            rpe: entry.rpe,
            notes: entry.notes,
          }
        }
        const res = await trainerLogsFetch(body, { agencyId })
        if (!res.ok) {
          flashError(`Could not save set (${res.status})`)
          return
        }
        await refreshLogs()
      } catch (e) {
        flashError(e.message || 'Network error saving set')
      }
    },
    [plan?.id, traineeId, agencyId, refreshLogs],
  )

  // ── Status flags ───────────────────────────────────────────────────────────
  const okToTrain = plan?.baseline?.training_readiness?.ok_to_train !== false
  const hasBaseline = !!plan?.baseline
  const hasRoadmap = !!plan?.roadmap
  const hasPlaybook = !!plan?.playbook
  const hasWorkout = !!plan?.workout_plan
  const hasPrefs = !!plan?.food_preferences
  const hasMeals = !!plan?.meal_plan
  const hasGrocery = !!plan?.grocery_list

  const doneMap = useMemo(
    () => ({
      baseline: hasBaseline,
      roadmap: hasRoadmap,
      playbook: hasPlaybook,
      workout: hasWorkout,
      food_prefs: hasPrefs,
      meals: hasMeals,
    }),
    [hasBaseline, hasRoadmap, hasPlaybook, hasWorkout, hasPrefs, hasMeals],
  )
  const pendingKey = useMemo(() => {
    if (pending.baseline) return 'baseline'
    if (pending.roadmap) return 'roadmap'
    if (pending.playbook) return 'playbook'
    if (pending.workout || pending.adjust) return 'workout'
    if (pending.food_prefs || pending.submit_prefs) return 'food_prefs'
    if (pending.meals) return 'meals'
    return null
  }, [pending])

  // Next-block gating: ≥ 40% adherence AND ≥ 11 days since workout generated.
  // `now` is captured once at mount so Date.now() isn't called during render
  // (satisfies react-hooks/purity — see eslint rule docs).
  const [now] = useState(() => Date.now())
  const daysOld = useMemo(() => {
    if (!plan?.generated_at) return 0
    return Math.floor((now - new Date(plan.generated_at).getTime()) / (1000 * 60 * 60 * 24))
  }, [plan?.generated_at, now])
  const canAdjust = useMemo(() => {
    if (!plan?.workout_plan || !plan?.generated_at) return false
    const pct = Number(adherence?.adherence_pct ?? 0)
    return daysOld >= 11 && pct >= 40 && currentPhase < 3
  }, [plan?.workout_plan, plan?.generated_at, adherence?.adherence_pct, currentPhase, daysOld])

  // ── Next-step CTA ──────────────────────────────────────────────────────────
  const nextStep = useMemo(() => {
    if (!hasBaseline) {
      return {
        title: 'Generate baseline',
        desc: 'Start the chain with calories, macros, training readiness, and the three focus areas.',
        action: handleGenerateBaseline,
        busy: pending.baseline,
        goto: 'overview',
        icon: Sparkles,
      }
    }
    if (hasBaseline && !okToTrain) {
      return {
        title: 'Route to physician',
        desc: 'Plan is paused until training_readiness.ok_to_train = true.',
        action: null,
        busy: false,
        goto: 'overview',
        icon: AlertTriangle,
      }
    }
    if (!hasRoadmap) {
      return {
        title: 'Generate 90-day roadmap',
        desc: 'Break the goal into three 30-day phases the trainee can feel.',
        action: handleGenerateRoadmap,
        busy: pending.roadmap,
        goto: 'plan',
        icon: TrendingUp,
      }
    }
    if (!hasWorkout) {
      return {
        title: `Generate workout — phase ${currentPhase}`,
        desc: 'Loadable set/rep targets, progression rule, and cues per exercise.',
        action: () => handleGenerateWorkout(currentPhase),
        busy: pending.workout,
        goto: 'plan',
        icon: Dumbbell,
      }
    }
    if (!hasPrefs) {
      return {
        title: 'Collect food preferences',
        desc: 'Adherence lives and dies here — people eat food they chose.',
        action: handleElicitFoodPrefs,
        busy: pending.food_prefs,
        goto: 'nutrition',
        icon: Utensils,
      }
    }
    if (!hasMeals) {
      return {
        title: 'Generate meals + grocery',
        desc: '2-week meal plan hitting calorie + macro targets, organized by aisle.',
        action: handleGenerateMeals,
        busy: pending.meals,
        goto: 'nutrition',
        icon: Utensils,
      }
    }
    if (!hasPlaybook) {
      return {
        title: 'Generate coaching playbook',
        desc: 'Nutrition, travel, supplements, recovery, and an 8-scenario troubleshooting guide.',
        action: handleGeneratePlaybook,
        busy: pending.playbook,
        goto: 'playbook',
        icon: BookOpen,
      }
    }
    return {
      title: 'Log workouts & watch adherence',
      desc: 'All generation steps complete. Drive adherence, then generate the next block.',
      action: null,
      busy: false,
      goto: 'progress',
      icon: LineChart,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasBaseline,
    okToTrain,
    hasRoadmap,
    hasWorkout,
    hasPrefs,
    hasMeals,
    hasPlaybook,
    currentPhase,
    pending.baseline,
    pending.roadmap,
    pending.workout,
    pending.food_prefs,
    pending.meals,
    pending.playbook,
  ])

  // Tab definitions.  `done` drives the status dot on each tab.
  const tabs = useMemo(
    () => [
      { key: 'overview', label: 'Overview', icon: LayoutGrid, done: hasBaseline },
      { key: 'plan', label: 'Plan', icon: TrendingUp, done: hasRoadmap && hasWorkout, pending: pending.roadmap || pending.workout || pending.adjust },
      { key: 'nutrition', label: 'Nutrition', icon: Utensils, done: hasPrefs && hasMeals, pending: pending.food_prefs || pending.submit_prefs || pending.meals },
      { key: 'playbook', label: 'Playbook', icon: BookOpen, done: hasPlaybook, pending: pending.playbook },
      { key: 'progress', label: 'Progress', icon: LineChart, done: logs.length > 0 },
    ],
    [hasBaseline, hasRoadmap, hasWorkout, hasPrefs, hasMeals, hasPlaybook, logs.length, pending],
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 40px 40px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <Link
          to="/trainer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T, textDecoration: 'none', fontSize: 13, fontWeight: 600, marginBottom: 12 }}
        >
          <ArrowLeft size={14} /> Back to trainees
        </Link>

        {featureDisabled && <FeatureDisabledPanel />}

        {!featureDisabled && loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: GRY5, padding: 40 }}>
            <Loader2 size={16} /> Loading trainee…
          </div>
        )}

        {!featureDisabled && !loading && error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 14, borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        {!featureDisabled && !loading && trainee && (
          <>
            <StickyHeader
              trainee={trainee}
              actionPending={actionPending}
              onArchive={() => callTraineeAction('archive')}
              onUnarchive={() => callTraineeAction('unarchive')}
              inviteStatus={inviteStatus}
              invitePending={invitePending}
              onSendInvite={handleSendInvite}
              doneMap={doneMap}
              pendingKey={pendingKey}
            />

            {/* ── Top-level tabs ───────────────────────────────────────────── */}
            <TrainerTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

            {activeTab === 'overview' && (
              <OverviewTab
                trainee={trainee}
                plan={plan}
                okToTrain={okToTrain}
                hasBaseline={hasBaseline}
                pending={pending}
                nextStep={nextStep}
                onGenerateBaseline={handleGenerateBaseline}
                onUpdateAboutYou={handleUpdateAboutYou}
                onUpdateFields={handleUpdateTraineeFields}
                onGotoTab={setActiveTab}
              />
            )}

            {activeTab === 'plan' && (
              <PlanTab
                plan={plan}
                hasBaseline={hasBaseline}
                okToTrain={okToTrain}
                hasRoadmap={hasRoadmap}
                hasWorkout={hasWorkout}
                currentPhase={currentPhase}
                pending={pending}
                logs={logs}
                expandSessionDay={expandSessionDay}
                onGenerateRoadmap={handleGenerateRoadmap}
                onGenerateWorkout={handleGenerateWorkout}
                onLogSet={handleLogSet}
                onGotoTab={setActiveTab}
              />
            )}

            {activeTab === 'nutrition' && (
              <NutritionTab
                plan={plan}
                hasWorkout={hasWorkout}
                hasPrefs={hasPrefs}
                hasMeals={hasMeals}
                hasGrocery={hasGrocery}
                pending={pending}
                onElicitFoodPrefs={handleElicitFoodPrefs}
                onGenerateMeals={handleGenerateMeals}
                onGotoTab={setActiveTab}
              />
            )}

            {activeTab === 'playbook' && (
              <PlaybookTab
                plan={plan}
                hasRoadmap={hasRoadmap}
                pending={pending}
                onGeneratePlaybook={handleGeneratePlaybook}
                onGotoTab={setActiveTab}
              />
            )}

            {activeTab === 'progress' && (
              <ProgressTab
                plan={plan}
                logs={logs}
                adherence={adherence}
                hasWorkout={hasWorkout}
                currentPhase={currentPhase}
                pending={pending}
                canAdjust={canAdjust}
                daysOld={daysOld}
                onOpenSession={(day) => {
                  setExpandSessionDay(day)
                  setActiveTab('plan')
                  setTimeout(() => setExpandSessionDay(null), 400)
                }}
                onGenerateNextBlock={handleGenerateNextBlock}
                onGotoTab={setActiveTab}
              />
            )}
          </>
        )}
      </main>

      {wizardQuestions && (
        <FoodPrefsWizard
          questions={wizardQuestions}
          onSubmit={handleSubmitFoodPrefs}
          onClose={() => !pending.submit_prefs && setWizardQuestions(null)}
          submitting={pending.submit_prefs}
        />
      )}

      <TrainerToast message={stepError} onClose={() => setStepError(null)} />
    </div>
  )
}

// ── Sticky header ────────────────────────────────────────────────────────────

function StickyHeader({ trainee, actionPending, onArchive, onUnarchive, inviteStatus, invitePending, onSendInvite, doneMap, pendingKey }) {
  const status = inviteStatus?.status || 'pending'
  const canInvite = !!trainee.email && !trainee.archived_at
  const inviteLabel = ({
    pending: 'Send invite',
    invited: 'Resend invite',
    active: 'Trainee active',
    bounced: 'Resend (bounced)',
    revoked: 'Send invite',
  })[status] || 'Send invite'
  const inviteBadgeColor = status === 'active' ? '#059669' : status === 'bounced' ? '#dc2626' : status === 'invited' ? '#0891b2' : '#6b7280'
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: GRY,
        padding: '14px 0 16px',
        marginBottom: 10,
        borderBottom: `1px solid ${BRD}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 280px' }}>
          <h1 style={{ margin: 0, fontSize: 26, color: BLK, fontWeight: 800, letterSpacing: '-.01em' }}>
            {trainee.full_name}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'center' }}>
            {trainee.primary_goal && (
              <span style={chipAccent}>
                <Target size={12} /> {trainee.primary_goal}
              </span>
            )}
            {trainee.age != null && <span style={chip}>Age {trainee.age}</span>}
            {trainee.sex && <span style={chip}>{trainee.sex}</span>}
            {trainee.training_days_per_week != null && (
              <span style={chip}>{trainee.training_days_per_week}×/wk</span>
            )}
            <span style={{ color: GRY5, fontSize: 12 }}>
              · created {trainee.created_at ? new Date(trainee.created_at).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canInvite && (
            <button
              type="button"
              onClick={onSendInvite}
              disabled={invitePending || status === 'active'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 13px', fontSize: 13, fontWeight: 600, cursor: invitePending || status === 'active' ? 'not-allowed' : 'pointer',
                background: status === 'active' ? '#ecfdf5' : '#fff',
                color: inviteBadgeColor,
                border: `1px solid ${inviteBadgeColor}`,
                borderRadius: 8,
              }}
              title={inviteStatus?.invite_sent_at ? `Last sent ${new Date(inviteStatus.invite_sent_at).toLocaleString()}` : 'Magic-link to /my-plan'}
            >
              {invitePending ? <Loader2 size={13} /> : null}
              {inviteLabel}
            </button>
          )}
          {trainee.archived_at ? (
            <button onClick={onUnarchive} disabled={actionPending} style={btnSecondary(actionPending)}>
              <Undo2 size={14} /> Unarchive
            </button>
          ) : (
            <button onClick={onArchive} disabled={actionPending} style={btnSecondary(actionPending)}>
              <Archive size={14} /> Archive
            </button>
          )}
        </div>
      </div>

      <TrainerStatusStrip done={doneMap} pendingKey={pendingKey} />
    </header>
  )
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  trainee,
  plan,
  okToTrain,
  hasBaseline,
  pending,
  nextStep,
  onGenerateBaseline,
  onUpdateAboutYou,
  onUpdateFields,
  onGotoTab,
}) {
  const Icon = nextStep.icon || Sparkles
  const hasAboutYou = !!(trainee.about_you && trainee.about_you.trim().length > 0)
  // Intake completeness — mirrors the /api/trainer/generate gate exactly,
  // so the trainer sees the same list the server checks.  about_you is in
  // the list too but the AboutYouCard below owns that one; filter it out
  // so this card handles only the "other" missing fields.
  const missingAllFields = missingIntakeFields(trainee)
  const missingOtherFields = missingAllFields.filter((f) => f !== 'about_you')
  return (
    <div>
      {/* Finish-intake card — only renders when the trainee has required
          fields beyond about_you still unanswered.  Inline editors for
          exactly those fields so the trainer doesn't have to navigate. */}
      {missingOtherFields.length > 0 && (
        <MissingIntakeFieldsCard
          trainee={trainee}
          missing={missingOtherFields}
          onSave={onUpdateFields}
        />
      )}

      {/* About-you card — always first so trainers craft context BEFORE any
          plan-generation CTA.  Empty state locks downstream generation. */}
      <AboutYouCard trainee={trainee} onUpdateAboutYou={onUpdateAboutYou} />

      {/* Next-step CTA — hidden until about_you is filled in, since every
          Sonnet prompt reads it as primary steering input. */}
      {hasAboutYou && (
        <section
          style={{
            background: '#fff',
            border: `1px solid ${BRD}`,
            borderLeft: `4px solid ${R}`,
            borderRadius: 12,
            padding: '18px 22px',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 340px' }}>
            <div style={{ color: R, fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon size={12} /> Next step
            </div>
            <div style={{ color: BLK, fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{nextStep.title}</div>
            <div style={{ color: GRY7, fontSize: 13, lineHeight: 1.5 }}>{nextStep.desc}</div>
          </div>
          {nextStep.action && (
            <button
              type="button"
              onClick={nextStep.action}
              disabled={nextStep.busy}
              style={btnPrimary(nextStep.busy)}
            >
              {nextStep.busy ? <Loader2 size={14} /> : <Icon size={14} />}
              {nextStep.busy ? 'Generating…' : nextStep.title}
            </button>
          )}
          {!nextStep.action && nextStep.goto && (
            <button
              type="button"
              onClick={() => onGotoTab(nextStep.goto)}
              style={btnSecondary(false)}
            >
              Open {nextStep.goto} tab <ArrowRight size={13} />
            </button>
          )}
        </section>
      )}

      {/* Two-column on desktop: intake basics + baseline card / prompt. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <IntakeSummary trainee={trainee} />
        {hasBaseline ? (
          <PlanBaselineCard
            baseline={plan.baseline}
            onRegenerate={onGenerateBaseline}
            regenerating={pending.baseline}
          />
        ) : (
          <section style={panelStyle}>
            <h2 style={panelTitle}>Baseline</h2>
            <p style={paraStyle}>
              Generate the baseline assessment — calories, macros, training readiness, and the three
              focus areas that will move the needle most for this trainee. This is the input every
              downstream step reads from.
            </p>
            <button
              type="button"
              onClick={onGenerateBaseline}
              disabled={pending.baseline || !hasAboutYou}
              style={btnPrimary(pending.baseline || !hasAboutYou)}
              title={!hasAboutYou ? 'Add "About this trainee" context first' : undefined}
            >
              {pending.baseline ? <Loader2 size={14} /> : <Sparkles size={14} />}
              {pending.baseline
                ? 'Generating baseline…'
                : !hasAboutYou
                  ? 'Add About you first'
                  : 'Generate baseline'}
            </button>
          </section>
        )}
      </div>

      {hasBaseline && !okToTrain && (
        <section
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: 20,
            marginTop: 16,
            color: '#991b1b',
          }}
        >
          <strong>Plan is paused.</strong> This trainee needs physician clearance before Koto
          Trainer generates a workout or meal plan. Update medical_flags / injuries in the intake
          once clearance is documented, then regenerate.
        </section>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MissingIntakeFieldsCard — renders above AboutYouCard when a trainee (usually
// a pre-existing one created before today's required-field rollout) has any
// REQUIRED_INTAKE_FIELDS still blank except about_you.  Inline editors for
// exactly the missing set, batched save via action=update.  The card hides
// itself the moment everything is filled.
// ─────────────────────────────────────────────────────────────────────────────

const MISSING_FIELD_LABELS = {
  age: 'Age',
  sex: 'Sex (M / F / other)',
  height_cm: 'Height (cm)',
  current_weight_kg: 'Current weight (kg)',
  primary_goal: 'Primary goal (lose_fat / gain_muscle / maintain / performance / recomp)',
  training_experience_years: 'Training experience (years)',
  training_days_per_week: 'Training days per week',
  equipment_access: 'Equipment access (none / bands / home_gym / full_gym)',
  medical_flags: 'Medical flags — type "None" if nothing to flag',
  injuries: 'Injuries — type "None" if none',
  dietary_preference: 'Dietary preference (none / vegetarian / vegan / pescatarian / keto / paleo / custom)',
  allergies: 'Allergies / intolerances — type "None" if none',
  sleep_hours_avg: 'Average sleep (hours/night)',
  stress_level: 'Stress level (1–10)',
  occupation_activity: 'Occupation activity (sedentary / light / moderate / heavy)',
  meals_per_day: 'Meals per day (3–6)',
}

// Fields that are numeric on the DB side — drafts typed into the text input
// need coercion before we PATCH.
const NUMERIC_FIELDS = new Set([
  'age',
  'height_cm',
  'current_weight_kg',
  'training_experience_years',
  'training_days_per_week',
  'sleep_hours_avg',
  'stress_level',
  'meals_per_day',
])

function MissingIntakeFieldsCard({ trainee, missing, onSave }) {
  const [drafts, setDrafts] = useState(() => {
    const init = {}
    for (const f of missing) init[f] = ''
    return init
  })
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)

  function setDraft(field, value) {
    setDrafts((prev) => ({ ...prev, [field]: value }))
  }

  function buildPatch() {
    const patch = {}
    for (const f of missing) {
      const raw = (drafts[f] || '').trim()
      if (!raw) continue
      if (NUMERIC_FIELDS.has(f)) {
        const n = Number(raw)
        if (!Number.isFinite(n)) {
          setLocalError(`${MISSING_FIELD_LABELS[f] || f}: must be a number`)
          return null
        }
        patch[f] = n
      } else {
        patch[f] = raw
      }
    }
    return patch
  }

  async function handleSave() {
    setLocalError(null)
    const patch = buildPatch()
    if (!patch) return
    const allFilled = missing.every((f) => (drafts[f] || '').trim().length > 0)
    if (!allFilled) {
      setLocalError('Answer every field before saving — the plan generator needs all of these.')
      return
    }
    setSaving(true)
    const ok = await onSave?.(patch)
    setSaving(false)
    if (!ok) setLocalError('Save failed — see the toast for details.')
  }

  return (
    <section
      style={{
        ...panelStyle,
        background: '#fff7ed',
        borderLeft: `4px solid #ea580c`,
        marginBottom: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <AlertTriangle size={16} color="#ea580c" />
        <h2 style={{ ...panelTitle, color: '#9a3412' }}>Finish the intake</h2>
      </div>
      <p style={{ ...paraStyle, color: '#9a3412', marginBottom: 14 }}>
        {trainee?.full_name || 'This trainee'} was created before a few new required
        fields landed. Fill these in and the plan generator will unlock.
      </p>

      <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
        {missing.map((f) => (
          <div key={f}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#7c2d12', display: 'block', marginBottom: 4 }}>
              {MISSING_FIELD_LABELS[f] || f}
            </label>
            <input
              type="text"
              value={drafts[f] || ''}
              onChange={(e) => setDraft(f, e.target.value)}
              disabled={saving}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 13,
                border: `1px solid #fed7aa`,
                borderRadius: 6,
                background: '#fff',
                color: '#0a0a0a',
                fontFamily: 'inherit',
              }}
            />
          </div>
        ))}
      </div>

      {localError && (
        <div style={{ fontSize: 12, color: '#991b1b', marginBottom: 10 }}>{localError}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={btnPrimary(saving)}
        >
          {saving ? <Loader2 size={13} /> : null}
          {saving ? 'Saving…' : 'Save intake'}
        </button>
      </div>
    </section>
  )
}

// Free-text context feeding every Sonnet prompt.  Rendered full-width at the
// top of the Overview tab so trainers see it FIRST — before any plan-generation
// CTA — since about_you drives the quality of every downstream step.
function AboutYouCard({ trainee, onUpdateAboutYou }) {
  const hasContext = !!(trainee.about_you && trainee.about_you.trim().length > 0)
  const [editing, setEditing] = useState(!hasContext)
  const [draft, setDraft] = useState(trainee.about_you || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const ok = await onUpdateAboutYou?.(draft)
    setSaving(false)
    if (ok) setEditing(false)
  }

  return (
    <section
      style={{
        ...panelStyle,
        marginBottom: 18,
        borderLeft: hasContext ? undefined : `4px solid ${R}`,
        background: hasContext ? '#fff' : '#fffbea',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={panelTitle}>
            {hasContext ? 'About this trainee' : 'Start here — About this trainee'}
          </h2>
          <div style={{ fontSize: 12, color: GRY, marginTop: 4, lineHeight: 1.5 }}>
            {hasContext
              ? 'Fed into every AI-generated step — baseline, roadmap, workouts, meals, playbook.'
              : 'Required before Koto Trainer can craft a custom plan. Sport, lifestyle, goals, constraints — in their own words.'}
          </div>
        </div>
        {!editing && onUpdateAboutYou && (
          <button
            type="button"
            onClick={() => { setDraft(trainee.about_you || ''); setEditing(true) }}
            style={{ background: 'none', border: 'none', color: T, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Example: 16-year-old HS baseball pitcher, junior year, starter. Throwing 82 mph, want to add velocity without blowing out the shoulder. Coach wants me stronger in the offseason. 3 days/week in the school weight room. Played through a minor elbow flare last spring — want to protect the arm."
            style={{
              width: '100%', minHeight: 160, padding: '10px 12px', fontSize: 13,
              border: `1px solid ${BRD}`, borderRadius: 8, fontFamily: 'inherit',
              lineHeight: 1.5, color: '#0a0a0a', background: '#fff',
            }}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {hasContext && (
              <button type="button" onClick={() => setEditing(false)} disabled={saving} style={btnSecondary(saving)}>
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || draft.trim().length === 0}
              style={btnPrimary(saving || draft.trim().length === 0)}
            >
              {saving ? <Loader2 size={13} /> : null} Save
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: GRY, lineHeight: 1.5 }}>
            The more you write, the more tailored every workout, meal plan, and coaching note gets.
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: '#0a0a0a', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          {trainee.about_you}
        </div>
      )}
    </section>
  )
}

function IntakeSummary({ trainee }) {
  return (
    <section style={panelStyle}>
      <h2 style={panelTitle}>Intake basics</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Row k="Goal" v={trainee.primary_goal} />
        <Row k="Training days/wk" v={trainee.training_days_per_week} />
        <Row k="Age" v={trainee.age} />
        <Row k="Sex" v={trainee.sex} />
        <Row k="Height" v={trainee.height_cm ? cmToFeetInches(trainee.height_cm) : null} />
        <Row k="Weight" v={trainee.current_weight_kg ? `${kgToLbs(trainee.current_weight_kg)} lbs` : null} />
        <Row k="Target" v={trainee.target_weight_kg ? `${kgToLbs(trainee.target_weight_kg)} lbs` : null} />
        <Row k="Equipment" v={trainee.equipment_access} />
        <Row k="Dietary" v={trainee.dietary_preference} />
        <Row k="Allergies" v={trainee.allergies} />
        <Row k="Medical" v={trainee.medical_flags} />
        <Row k="Injuries" v={trainee.injuries} />
      </div>
    </section>
  )
}

// ── Plan tab ─────────────────────────────────────────────────────────────────

function PlanTab({
  plan,
  hasBaseline,
  okToTrain,
  hasRoadmap,
  hasWorkout,
  currentPhase,
  pending,
  logs,
  expandSessionDay,
  onGenerateRoadmap,
  onGenerateWorkout,
  onLogSet,
  onGotoTab,
}) {
  if (!hasBaseline) {
    return (
      <EmptyHint
        title="Baseline required"
        desc="Generate the baseline assessment in Overview first — every plan step reads from it."
        onGoto={() => onGotoTab('overview')}
        ctaLabel="Back to overview"
      />
    )
  }
  if (!okToTrain) {
    return (
      <section
        style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 10,
          padding: 20,
          color: '#991b1b',
        }}
      >
        <strong>Plan is paused.</strong> Trainee needs physician clearance before the plan tab is
        active.
      </section>
    )
  }
  return (
    <div>
      {!hasRoadmap && (
        <section style={panelStyle}>
          <h2 style={panelTitle}>90-day roadmap</h2>
          <p style={paraStyle}>
            Break the target into three 30-day phases. Each phase has its own training and
            nutrition theme plus milestones the trainee can feel.
          </p>
          <button
            type="button"
            onClick={onGenerateRoadmap}
            disabled={pending.roadmap}
            style={btnPrimary(pending.roadmap)}
          >
            {pending.roadmap ? <Loader2 size={14} /> : <TrendingUp size={14} />}
            {pending.roadmap ? 'Generating…' : 'Generate 90-day roadmap'}
          </button>
        </section>
      )}

      {hasRoadmap && (
        <RoadmapCard
          roadmap={plan.roadmap}
          currentPhase={currentPhase}
          onSelectPhase={(n) => onGenerateWorkout(n)}
        />
      )}

      {hasRoadmap && !hasWorkout && (
        <section style={panelStyle}>
          <h2 style={panelTitle}>Training block — phase {currentPhase}</h2>
          <p style={paraStyle}>
            Generate a 2-week workout block. Every exercise includes loadable set/rep targets, a
            progression rule, coaching cues, and a how-to toggle so the trainee never has to guess
            form.
          </p>
          <button
            type="button"
            onClick={() => onGenerateWorkout(currentPhase)}
            disabled={pending.workout}
            style={btnPrimary(pending.workout)}
          >
            {pending.workout ? <Loader2 size={14} /> : <Dumbbell size={14} />}
            {pending.workout ? 'Generating…' : `Generate workout for phase ${currentPhase}`}
          </button>
        </section>
      )}

      {hasWorkout && (
        <WorkoutAccordion
          workoutPlan={plan.workout_plan}
          logs={logs}
          onLogSet={onLogSet}
          expandSessionDay={expandSessionDay}
          onRegenerate={() => onGenerateWorkout(currentPhase)}
          regenerating={pending.workout}
        />
      )}
    </div>
  )
}

// ── Nutrition tab ────────────────────────────────────────────────────────────

function NutritionTab({
  plan,
  hasWorkout,
  hasPrefs,
  hasMeals,
  hasGrocery,
  pending,
  onElicitFoodPrefs,
  onGenerateMeals,
  onGotoTab,
}) {
  if (!hasWorkout) {
    return (
      <EmptyHint
        title="Workout required first"
        desc="Generate the workout block in Plan before collecting food preferences — meal targets read from the workout plan."
        onGoto={() => onGotoTab('plan')}
        ctaLabel="Open Plan tab"
      />
    )
  }
  return (
    <div>
      {!hasPrefs && (
        <section style={panelStyle}>
          <h2 style={panelTitle}>Food preferences</h2>
          <p style={paraStyle}>
            Collect the trainee&apos;s food preferences before generating meals. Adherence lives and
            dies here — people eat food they chose, not food they were assigned.
          </p>
          <button
            type="button"
            onClick={onElicitFoodPrefs}
            disabled={pending.food_prefs}
            style={btnPrimary(pending.food_prefs)}
          >
            {pending.food_prefs ? <Loader2 size={14} /> : <Utensils size={14} />}
            {pending.food_prefs ? 'Preparing questions…' : 'Collect food preferences'}
          </button>
        </section>
      )}

      {hasPrefs && !hasMeals && (
        <section style={panelStyle}>
          <h2 style={panelTitle}>2-week meals + grocery</h2>
          <p style={paraStyle}>
            Generate a full 2-week meal plan hitting the baseline calorie + macro targets,
            organized against the trainee&apos;s preferences, plus a single grocery run by aisle so
            Sunday shopping is one trip.
          </p>
          <button
            type="button"
            onClick={onGenerateMeals}
            disabled={pending.meals}
            style={btnPrimary(pending.meals)}
          >
            {pending.meals ? <Loader2 size={14} /> : <Utensils size={14} />}
            {pending.meals ? 'Generating meal plan…' : 'Generate 2-week meals + grocery'}
          </button>
        </section>
      )}

      {hasMeals && <MealPlanTable mealPlan={plan.meal_plan} />}
      {hasGrocery && <GroceryList groceryList={plan.grocery_list} />}
    </div>
  )
}

// ── Playbook tab ─────────────────────────────────────────────────────────────

function PlaybookTab({ plan, hasRoadmap, pending, onGeneratePlaybook, onGotoTab }) {
  if (!hasRoadmap) {
    return (
      <EmptyHint
        title="Roadmap required first"
        desc="The coaching playbook reads from the roadmap. Generate it in Plan first."
        onGoto={() => onGotoTab('plan')}
        ctaLabel="Open Plan tab"
      />
    )
  }
  if (!plan?.playbook) {
    return (
      <section style={panelStyle}>
        <h2 style={panelTitle}>Coaching playbook</h2>
        <p style={paraStyle}>
          Generate the trainee&apos;s reference guide — nutrition, supplements, on-the-road eating,
          weekly meal prep, recovery + sleep, and an 8-scenario troubleshooting guide. One-time
          output; re-generate anytime to refresh.
        </p>
        <button
          type="button"
          onClick={onGeneratePlaybook}
          disabled={pending.playbook}
          style={btnPrimary(pending.playbook)}
        >
          {pending.playbook ? <Loader2 size={14} /> : <BookOpen size={14} />}
          {pending.playbook ? 'Generating playbook…' : 'Generate coaching playbook'}
        </button>
      </section>
    )
  }
  return (
    <PlaybookCard
      playbook={plan.playbook}
      onRegenerate={onGeneratePlaybook}
      regenerating={pending.playbook}
    />
  )
}

// ── Progress tab ─────────────────────────────────────────────────────────────

function ProgressTab({
  plan,
  logs,
  adherence,
  hasWorkout,
  currentPhase,
  pending,
  canAdjust,
  daysOld,
  onOpenSession,
  onGenerateNextBlock,
  onGotoTab,
}) {
  if (!hasWorkout) {
    return (
      <EmptyHint
        title="No workout to log yet"
        desc="Generate a training block in the Plan tab before tracking adherence."
        onGoto={() => onGotoTab('plan')}
        ctaLabel="Open Plan tab"
      />
    )
  }
  const pct = Math.round(Number(adherence?.adherence_pct ?? 0))
  return (
    <div>
      <WorkoutLogGrid
        workoutPlan={plan.workout_plan}
        logs={logs}
        adherence={adherence}
        onOpenSession={onOpenSession}
      />

      <section style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <h2 style={panelTitle}>Next block</h2>
            <p style={{ ...paraStyle, marginBottom: 0 }}>
              Generate the next 2-week block based on adherence and recent performance. Gated to
              ≥ 40% adherence AND ≥ 11 days since this block was generated AND phase &lt; 3.
            </p>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: GRY7 }}>
              <span><strong style={{ color: BLK }}>Adherence:</strong>{' '}<span style={{ color: pct >= 40 ? GRN : '#b45309', fontWeight: 700 }}>{pct}%</span></span>
              <span><strong style={{ color: BLK }}>Block age:</strong> {daysOld} day{daysOld === 1 ? '' : 's'}</span>
              <span><strong style={{ color: BLK }}>Phase:</strong> {currentPhase} / 3</span>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <button
              type="button"
              onClick={onGenerateNextBlock}
              disabled={!canAdjust || pending.adjust}
              style={btnPrimary(!canAdjust || pending.adjust)}
            >
              {pending.adjust ? <Loader2 size={14} /> : <ArrowRight size={14} />}
              {pending.adjust ? 'Adjusting…' : 'Generate next block'}
            </button>
            {!canAdjust && (
              <div style={{ marginTop: 6, color: GRY5, fontSize: 11, textAlign: 'right' }}>
                {currentPhase >= 3 ? 'Final phase reached.' : 'Gate not yet satisfied.'}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

// ── Shared primitives ────────────────────────────────────────────────────────

function Row({ k, v }) {
  if (v === null || v === undefined || v === '') return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', padding: '4px 0', fontSize: 13 }}>
      <span style={{ color: GRY5, fontWeight: 600 }}>{k}</span>
      <span style={{ color: BLK }}>{String(v)}</span>
    </div>
  )
}

function EmptyHint({ title, desc, onGoto, ctaLabel }) {
  return (
    <section
      style={{
        ...panelStyle,
        textAlign: 'center',
        padding: '34px 22px',
      }}
    >
      <div style={{ color: BLK, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <p style={{ color: GRY7, fontSize: 13, lineHeight: 1.5, margin: '0 auto 14px', maxWidth: 440 }}>{desc}</p>
      {onGoto && (
        <button type="button" onClick={onGoto} style={btnSecondary(false)}>
          {ctaLabel || 'Open'} <ArrowRight size={13} />
        </button>
      )}
    </section>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const panelStyle = {
  background: '#fff',
  border: `1px solid ${BRD}`,
  borderRadius: 12,
  padding: 22,
  marginBottom: 16,
}

const panelTitle = { margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: T, letterSpacing: '.05em', textTransform: 'uppercase' }

const paraStyle = { color: GRY7, fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }

const chip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 10px',
  background: '#fff',
  border: `1px solid ${BRD}`,
  color: GRY7,
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 700,
}

const chipAccent = {
  ...chip,
  background: R + '10',
  border: `1px solid ${R}30`,
  color: R,
}

function btnPrimary(disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 18px',
    background: disabled ? '#d1d5db' : R,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
  }
}

function btnSecondary(disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    background: '#fff',
    color: disabled ? '#9ca3af' : GRY7,
    border: `1px solid ${BRD}`,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
