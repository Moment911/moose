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
  Copy,
  Link2,
  UserCheck,
  ExternalLink,
  Activity,
  Trash2,
} from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { FeatureDisabledPanel } from './TrainerListPage'
import { trainerFetch } from '../../lib/trainer/trainerFetch'
import { missingIntakeFields, REQUIRED_INTAKE_FIELDS } from '../../lib/trainer/intakeCompleteness'
import {
  PRIMARY_GOALS,
  EQUIPMENT_ACCESS,
  DIETARY_PREFERENCES,
  OCCUPATION_ACTIVITIES,
} from '../../lib/trainer/intakeSchema'
import { feetInchesToCm, lbsToKg } from '../../lib/trainer/units'
import { useAuth } from '../../hooks/useAuth'
import { cmToFeetInches, kgToLbs } from '../../lib/trainer/units'
import { supabase } from '../../lib/supabase'
import { R, T, BLK, GRY, GRN } from '../../lib/theme'

import PlanBaselineCard from '../../components/trainer/PlanBaselineCard'
import RoadmapCard from '../../components/trainer/RoadmapCard'
import WorkoutAccordion from '../../components/trainer/WorkoutAccordion'
import RefineIntakeCard from '../../components/trainer/RefineIntakeCard'
import NoneOrText from '../../components/trainer/NoneOrText'
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
const RED = '#dc2626'
const BLUE = '#2563eb'

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
        setError(`Failed to load athlete (${res.status})`)
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

  async function handleDeleteTrainee() {
    const label = trainee?.full_name || 'this athlete'
    if (!window.confirm(`Delete ${label} permanently? This wipes their plan, workout logs, and intake data and can't be undone.`)) return
    setActionPending(true)
    try {
      const res = await trainerFetch({ action: 'delete', trainee_id: traineeId }, { agencyId })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        flashError(body?.error || `Delete failed (${res.status})`)
        return
      }
      navigate('/trainer')
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

  // Generic intake patch — used by IntakeBasicsEditor to finish the intake
  // inline without navigating away.  Accepts any partial patch of
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

  // AI refinement — elicit follow-up questions + merge answers into about_you.
  // Posts to /api/trainer/generate { action: refine_elicit | refine_submit }.
  async function handleRefineElicit() {
    const res = await trainerGenerateFetch(
      { action: 'refine_elicit', trainee_id: traineeId },
      { agencyId },
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.detail || body?.error || `Refine failed (${res.status})`)
    }
    return await res.json()
  }

  async function handleRefineSubmit(answers) {
    const res = await trainerGenerateFetch(
      { action: 'refine_submit', trainee_id: traineeId, answers },
      { agencyId },
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      flashError(body?.error || `Save failed (${res.status})`)
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
      flashError('Athlete has no email — add one via the intake form first.')
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
  // Auto-retries transient Anthropic failures (502 sonnet_error, 429 rate
  // limit, 529 overloaded) once after a short backoff so a single blip
  // doesn't land on the trainer. Any non-retryable error still surfaces.
  async function generate(step, body, onSuccess) {
    setPendingStep(step, true)
    setStepError(null)
    const RETRY_STATUSES = new Set([502, 429, 529])
    try {
      let res = await trainerGenerateFetch(body, { agencyId })
      if (RETRY_STATUSES.has(res.status)) {
        await new Promise((r) => setTimeout(r, 1500))
        res = await trainerGenerateFetch(body, { agencyId })
      }
      if (res.status === 401) {
        navigate('/login')
        return
      }
      if (res.status === 404) {
        setFeatureDisabled(true)
        return
      }
      if (res.status === 502) {
        // Still 502 after retry. Surface the detail so support can diagnose
        // quickly (rate limit vs schema error vs overloaded vs timeout).
        const body502 = await res.json().catch(() => null)
        const detail = body502?.detail || body502?.error || ''
        flashError(`Plan generation failed after retry (Sonnet)${detail ? `: ${String(detail).slice(0, 180)}` : ''}. Try again in a minute.`)
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
        desc: 'Break the goal into three 30-day phases the athlete can feel.',
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
      { key: 'recruiting', label: 'Recruiting', icon: UserCheck, done: !!trainee?.recruiting_profile || !!trainee?.grad_year },
    ],
    [hasBaseline, hasRoadmap, hasWorkout, hasPrefs, hasMeals, hasPlaybook, logs.length, pending, trainee],
  )

  return (
    <TrainerPortalShell>
      <div style={{ padding: '24px 40px 40px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <Link
          to="/trainer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T, textDecoration: 'none', fontSize: 13, fontWeight: 600, marginBottom: 12 }}
        >
          <ArrowLeft size={14} /> Back to athletes
        </Link>

        {featureDisabled && <FeatureDisabledPanel />}

        {!featureDisabled && loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: GRY5, padding: 40 }}>
            <Loader2 size={16} /> Loading athlete…
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
              onDelete={handleDeleteTrainee}
              inviteStatus={inviteStatus}
              invitePending={invitePending}
              onSendInvite={handleSendInvite}
              doneMap={doneMap}
              pendingKey={pendingKey}
            />

            {/* Global jobs banner — sits above the tabs and stays visible
                no matter which tab the trainer navigates to. Reads off
                the page-level `pending` map, so any generate that fires
                persists in UI across tab changes until it resolves. */}
            <GlobalJobsBanner pending={pending} />

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
                onRefineElicit={handleRefineElicit}
                onRefineSubmit={handleRefineSubmit}
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

            {activeTab === 'recruiting' && (
              <RecruitingTab trainee={trainee} />
            )}
          </>
        )}
      </div>

      {wizardQuestions && (
        <FoodPrefsWizard
          questions={wizardQuestions}
          onSubmit={handleSubmitFoodPrefs}
          onClose={() => !pending.submit_prefs && setWizardQuestions(null)}
          submitting={pending.submit_prefs}
        />
      )}

      <TrainerToast message={stepError} onClose={() => setStepError(null)} />
    </TrainerPortalShell>
  )
}

// ── Global jobs banner ──────────────────────────────────────────────────────
// A single, visible-on-every-tab indicator that one or more generators are
// running in the background. The fetches themselves are already async — this
// just promises the trainer visually that navigating away doesn't cancel
// anything, and surfaces what's live across the whole page.

const JOB_LABELS = {
  baseline: 'Generating baseline',
  roadmap: 'Generating 90-day roadmap',
  workout: 'Generating workout block',
  food_prefs: 'Building food preferences',
  submit_prefs: 'Saving food preferences',
  meals: 'Generating 2-week meal plan',
  playbook: 'Generating coaching playbook',
  adjust: 'Adjusting workout block',
}

function GlobalJobsBanner({ pending }) {
  const active = Object.entries(pending).filter(([, v]) => v).map(([k]) => k)
  if (active.length === 0) return null
  const primary = JOB_LABELS[active[0]] || 'Generating'
  const extras = active.length - 1

  return (
    <>
      <style>{`@keyframes kotoJobPulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          marginBottom: 14,
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 10,
          boxShadow: '0 1px 2px rgba(37, 99, 235, 0.05)',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 14, height: 14, flexShrink: 0,
            border: '2px solid #bfdbfe',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            animation: 'kotoSpin 0.8s linear infinite',
          }}
        />
        <style>{'@keyframes kotoSpin{to{transform:rotate(360deg)}}'}</style>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1e40af', letterSpacing: '-.01em' }}>
          {primary}
          {extras > 0 && <span style={{ color: '#3b82f6', fontWeight: 500, marginLeft: 6 }}>+{extras} more running</span>}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#475569', fontWeight: 500, animation: 'kotoJobPulse 2s ease-in-out infinite' }}>
          You can keep working — this runs in the background.
        </span>
      </div>
    </>
  )
}

// ── Sticky header ────────────────────────────────────────────────────────────

function StickyHeader({ trainee, actionPending, onArchive, onUnarchive, onDelete, inviteStatus, invitePending, onSendInvite, doneMap, pendingKey }) {
  const status = inviteStatus?.status || 'pending'
  const canInvite = !!trainee.email && !trainee.archived_at
  const inviteLabel = ({
    pending: 'Send invite',
    invited: 'Resend invite',
    active: 'Athlete active',
    bounced: 'Resend (bounced)',
    revoked: 'Send invite',
  })[status] || 'Send invite'
  const inviteBadgeColor = status === 'active' ? '#059669' : status === 'bounced' ? '#dc2626' : status === 'invited' ? '#0891b2' : '#6b7280'
  // Initials for the avatar.
  const initials = (trainee.full_name || 'A')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'A'
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: '#f8fafc',
        padding: '16px 0 14px',
        marginBottom: 14,
        borderBottom: `1px solid ${BRD}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 300px', display: 'flex', gap: 14, alignItems: 'center' }}>
          <div
            aria-hidden
            style={{
              width: 48, height: 48, flexShrink: 0,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, letterSpacing: '-.02em',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.1), inset 0 0 0 1px rgba(255,255,255,.06)',
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 22, color: '#0f172a', fontWeight: 700, letterSpacing: '-.015em', lineHeight: 1.15 }}>
              {trainee.full_name}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
              {trainee.primary_goal && (
                <span style={chipAccent}>
                  <Target size={11} /> {trainee.primary_goal}
                </span>
              )}
              {trainee.age != null && <span style={chip}>Age {trainee.age}</span>}
              {trainee.sex && <span style={chip}>{trainee.sex}</span>}
              {trainee.training_days_per_week != null && (
                <span style={chip}>{trainee.training_days_per_week}×/wk</span>
              )}
              <span style={{ color: '#94a3b8', fontSize: 11.5, fontWeight: 500, marginLeft: 2 }}>
                Created {trainee.created_at ? new Date(trainee.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
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
          <IntakeLinkButton traineeId={trainee.id} />
          {trainee.archived_at ? (
            <button onClick={onUnarchive} disabled={actionPending} style={btnSecondary(actionPending)}>
              <Undo2 size={14} /> Unarchive
            </button>
          ) : (
            <button onClick={onArchive} disabled={actionPending} style={btnSecondary(actionPending)}>
              <Archive size={14} /> Archive
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={actionPending}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', fontSize: 13, fontWeight: 600,
              cursor: actionPending ? 'not-allowed' : 'pointer',
              background: '#fff', color: '#dc2626',
              border: '1px solid #fecaca', borderRadius: 8,
            }}
            title="Permanently delete this athlete + their plan + workout logs"
          >
            <Trash2 size={14} /> Delete
          </button>
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
  onRefineElicit,
  onRefineSubmit,
  onGotoTab,
}) {
  const Icon = nextStep.icon || Sparkles
  const hasAboutYou = !!(trainee.about_you && trainee.about_you.trim().length > 0)
  return (
    <div>
      {/* About-you editor — ONLY renders when context is missing.  Once on
          file, editing moves to the basics editor below so we don't re-ask
          the same question on the detail page. */}
      {!hasAboutYou && (
        <AboutYouCard trainee={trainee} onUpdateAboutYou={onUpdateAboutYou} />
      )}

      {/* AI refinement — Sonnet asks 4-6 follow-up questions tailored to this
          trainee.  Answers merge into about_you so they feed every downstream
          prompt.  Only surfaces once about_you exists (otherwise there's
          nothing to refine from). */}
      {hasAboutYou && (
        <RefineIntakeCard
          traineeId={trainee.id}
          traineeAboutYou={trainee.about_you}
          onElicit={onRefineElicit}
          onSubmit={onRefineSubmit}
        />
      )}

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

      {/* Always-editable intake basics — handles both "brand new trainee with
          gaps" and "existing trainee needs a value fixed."  Renders in the
          left column of a 2-col grid next to the baseline card. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <IntakeBasicsEditor trainee={trainee} onSave={onUpdateFields} />
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
              title={!hasAboutYou ? 'Add "About this athlete" context first' : undefined}
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

      {/* ── Workload section ──────────────────────────────────────────── */}
      <FullIntakeProfile trainee={trainee} />

      <WorkloadSection trainee={trainee} />

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
          <strong>Plan is paused.</strong> This athlete needs physician clearance before Koto
          Trainer generates a workout or meal plan. Update medical_flags / injuries in the intake
          once clearance is documented, then regenerate.
        </section>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FullIntakeProfile — single-pane surface of EVERY intake column on the
// trainee row, grouped by section. Collapsible so it doesn't dominate the
// Overview tab but is always one click away. Works as the "nothing is
// lost" receipt for trainers — if an athlete answered it in chat, it
// shows here, including optional measurables / recruiting fields even
// when recruiting wasn't a selected service.
// ─────────────────────────────────────────────────────────────────────────────

const GOAL_LABEL = { lose_fat: 'Lose fat', gain_muscle: 'Gain muscle', maintain: 'Maintain', performance: 'Performance', recomp: 'Recomp' }
const EQUIP_LABEL = { none: 'None', bands: 'Bands', home_gym: 'Home gym', full_gym: 'Full gym' }
const DIET_LABEL = { none: 'No preference', vegetarian: 'Vegetarian', vegan: 'Vegan', pescatarian: 'Pescatarian', keto: 'Keto', paleo: 'Paleo', custom: 'Custom' }
const OCC_LABEL = { sedentary: 'Sedentary', light: 'Light', moderate: 'Moderate', heavy: 'Heavy' }
const HAND_LABEL = { R: 'Right', L: 'Left', S: 'Switch' }

function cmToFtIn(cm) {
  if (cm == null) return null
  const totalIn = Math.round(cm / 2.54)
  const ft = Math.floor(totalIn / 12)
  const inches = totalIn - ft * 12
  return `${ft}′${inches}″`
}
function kgToLbs(kg) {
  return kg == null ? null : `${Math.round(kg * 2.20462)} lbs`
}
function fmt(v, map) {
  if (v == null || v === '') return null
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : null
  if (map && map[v]) return map[v]
  return String(v)
}

function FullIntakeProfile({ trainee }) {
  const [open, setOpen] = useState(true)
  if (!trainee) return null

  const sections = [
    {
      label: 'Basics',
      rows: [
        ['Name', trainee.full_name],
        ['Age', trainee.age != null ? `${trainee.age}` : null],
        ['Sex', fmt(trainee.sex, { M: 'Male', F: 'Female', Other: 'Other' })],
        ['Height', cmToFtIn(trainee.height_cm)],
        ['Weight', kgToLbs(trainee.current_weight_kg)],
        ['Target weight', kgToLbs(trainee.target_weight_kg)],
        ['Goal', fmt(trainee.primary_goal, GOAL_LABEL)],
      ],
    },
    {
      label: 'Training',
      rows: [
        ['Experience', trainee.training_experience_years != null ? `${trainee.training_experience_years} yrs` : null],
        ['Days / week', trainee.training_days_per_week != null ? `${trainee.training_days_per_week}` : null],
        ['Equipment', fmt(trainee.equipment_access, EQUIP_LABEL)],
      ],
    },
    {
      label: 'Health',
      rows: [
        ['Medical flags', trainee.medical_flags],
        ['Injuries', trainee.injuries],
        ['Allergies', trainee.allergies],
      ],
    },
    {
      label: 'Nutrition',
      rows: [
        ['Diet preference', fmt(trainee.dietary_preference, DIET_LABEL)],
        ['Meals / day', trainee.meals_per_day != null ? `${trainee.meals_per_day}` : null],
      ],
    },
    {
      label: 'Lifestyle',
      rows: [
        ['Sleep', trainee.sleep_hours_avg != null ? `${trainee.sleep_hours_avg} hrs` : null],
        ['Stress', trainee.stress_level != null ? `${trainee.stress_level}/10` : null],
        ['Daytime activity', fmt(trainee.occupation_activity, OCC_LABEL)],
      ],
    },
    {
      label: 'Workload (baseball)',
      rows: [
        ['Club / travel team', trainee.club_team || trainee.travel_team],
        ['Practices / week', trainee.practices_per_week != null ? `${trainee.practices_per_week}×` : null],
        ['Bullpens / week', trainee.bullpen_sessions_per_week != null ? `${trainee.bullpen_sessions_per_week}×` : null],
        ['Games / week', trainee.games_per_week != null ? `${trainee.games_per_week}×` : null],
        ['Game appearances / week', trainee.game_appearances_per_week != null ? `${trainee.game_appearances_per_week}×` : null],
        ['Avg pitch count', trainee.avg_pitch_count != null ? `${trainee.avg_pitch_count}` : null],
        ['Pitch arsenal', trainee.pitch_arsenal],
        ['Long toss routine', trainee.long_toss_routine],
        ['Arm soreness', trainee.arm_soreness],
        ['Off-season', trainee.offseason_training],
        ['Other sports', trainee.other_sports],
      ],
    },
    {
      label: 'Recruiting',
      rows: [
        ['Grad year', trainee.grad_year != null ? `${trainee.grad_year}` : null],
        ['Position', [trainee.position_primary, trainee.position_secondary].filter(Boolean).join(' / ') || null],
        ['Throws', fmt(trainee.throwing_hand, HAND_LABEL)],
        ['Bats', fmt(trainee.batting_hand, HAND_LABEL)],
        ['High school', trainee.high_school],
        ['HS state', trainee.high_school_state],
        ['Preferred divisions', Array.isArray(trainee.preferred_divisions) ? trainee.preferred_divisions.join(', ') : trainee.preferred_divisions],
        ['Preferred states', Array.isArray(trainee.preferred_states) ? trainee.preferred_states.join(', ') : trainee.preferred_states],
        ['Intended major', trainee.intended_major],
        ['Video link', trainee.video_link],
      ],
    },
    {
      label: 'Academics',
      rows: [
        ['GPA', trainee.gpa != null ? `${trainee.gpa}` : null],
        ['Test', trainee.test_score ? `${trainee.test_type || ''} ${trainee.test_score}`.trim() : null],
      ],
    },
    {
      label: 'Measurables',
      rows: [
        ['FB velo peak', trainee.fastball_velo_peak != null ? `${trainee.fastball_velo_peak} mph` : null],
        ['FB velo sit', trainee.fastball_velo_sit != null ? `${trainee.fastball_velo_sit} mph` : null],
        ['Exit velo', trainee.exit_velo != null ? `${trainee.exit_velo} mph` : null],
        ['60-yard dash', trainee.sixty_time != null ? `${trainee.sixty_time} s` : null],
        ['Pop time', trainee.pop_time != null ? `${trainee.pop_time} s` : null],
      ],
    },
  ]

  // Count for the header badge.
  const total = sections.reduce((acc, s) => acc + s.rows.length, 0)
  const filled = sections.reduce((acc, s) => acc + s.rows.filter(([, v]) => v != null && v !== '').length, 0)

  return (
    <section style={panelStyle}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div>
          <h2 style={panelTitle}>Full intake profile</h2>
          <p style={{ ...paraStyle, margin: '0' }}>
            Every field the athlete shared — across chat intake, welcome paragraph, and manual edits.
          </p>
        </div>
        <span style={{
          flexShrink: 0,
          padding: '4px 10px', background: '#f8fafc', border: `1px solid ${BRD}`,
          borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#475569',
        }}>
          {filled} / {total} · {open ? 'Hide' : 'Show'}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          {sections.map((sec) => {
            const secFilled = sec.rows.filter(([, v]) => v != null && v !== '').length
            return (
              <div key={sec.label}>
                <div style={{
                  fontSize: 11.5, fontWeight: 700, color: '#0f172a', letterSpacing: '-.005em',
                  textTransform: 'uppercase', marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>{sec.label}</span>
                  <span style={{ color: '#94a3b8', fontWeight: 600, letterSpacing: 'normal', textTransform: 'none' }}>
                    {secFilled}/{sec.rows.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sec.rows.map(([label, value]) => {
                    const isEmpty = value == null || value === ''
                    const isLink = label === 'Video link' && typeof value === 'string' && /^https?:\/\//.test(value)
                    return (
                      <div key={label} style={{
                        display: 'grid', gridTemplateColumns: '1fr auto',
                        alignItems: 'baseline', gap: 10,
                        padding: '6px 0',
                        borderBottom: '1px solid #f1f5f9',
                      }}>
                        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{label}</span>
                        <span style={{
                          fontSize: 14,
                          fontWeight: isEmpty ? 500 : 600,
                          color: isEmpty ? '#cbd5e1' : '#0f172a',
                          textAlign: 'right',
                          maxWidth: 180,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {isEmpty ? '—' : isLink ? (
                            <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: BLUE, textDecoration: 'none' }}>
                              View <ExternalLink size={11} style={{ display: 'inline', verticalAlign: -1 }} />
                            </a>
                          ) : String(value)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkloadSection — baseball-specific workload data from chat intake.
// Renders on the Overview tab so the trainer sees volume/load context
// alongside the intake basics and baseline.
// ─────────────────────────────────────────────────────────────────────────────

function WorkloadSection({ trainee }) {
  const ext = trainee.extracted || trainee.recruiting_profile || {}
  const hasAny =
    trainee.club_team || trainee.practices_per_week != null || trainee.bullpen_sessions_per_week != null ||
    trainee.game_appearances_per_week != null || trainee.avg_pitch_count != null || trainee.pitch_arsenal ||
    trainee.long_toss_routine || trainee.arm_soreness || trainee.games_per_week != null ||
    trainee.offseason_training || trainee.other_sports ||
    ext.club_team || ext.practices_per_week != null || ext.bullpen_sessions_per_week != null

  if (!hasAny) return null

  // Resolve from trainee row first, fall back to extracted
  const g = (key) => trainee[key] ?? ext[key] ?? null

  const items = [
    { label: 'Club / travel team', value: g('club_team') },
    { label: 'Practices / week', value: g('practices_per_week') },
    { label: 'Bullpen sessions / week', value: g('bullpen_sessions_per_week') },
    { label: 'Game appearances / week', value: g('game_appearances_per_week') },
    { label: 'Avg pitch count', value: g('avg_pitch_count') },
    { label: 'Pitch arsenal', value: g('pitch_arsenal') },
    { label: 'Long toss routine', value: g('long_toss_routine') },
    { label: 'Arm soreness', value: g('arm_soreness') },
    { label: 'Games / week', value: g('games_per_week') },
    { label: 'Off-season training', value: g('offseason_training') },
    { label: 'Other sports', value: g('other_sports') },
  ].filter((r) => r.value != null && r.value !== '')

  if (items.length === 0) return null

  return (
    <section style={{ ...panelStyle, marginTop: 16, borderLeft: `4px solid ${BLUE}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Activity size={14} color={BLUE} />
        <h2 style={{ ...panelTitle, color: BLUE, margin: 0 }}>Workload</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {items.map(({ label, value }) => (
          <div key={label} style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 8, border: `1px solid ${BRD}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: GRY5, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: BLK }}>{String(value)}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IntakeBasicsEditor — the single always-editable intake surface on the
// Overview tab.  Replaces both the old read-only IntakeSummary grid and the
// temporary MissingIntakeFieldsCard: every field is rendered with its proper
// widget (radio / select / bounded number / imperial composite), missing
// required fields get a red left-border so the trainer sees exactly what's
// still blocking plan generation, and a single "Save basics" button commits
// the full patch via action=update.  Once saved, every field remains editable
// — the trainer can fix a typo or change a goal any time.
// ─────────────────────────────────────────────────────────────────────────────

const GOAL_LABELS_SHORT = {
  lose_fat: 'Lose fat',
  gain_muscle: 'Gain muscle',
  maintain: 'Maintain',
  performance: 'Performance',
  recomp: 'Recomp',
}

const EQUIPMENT_LABELS_SHORT = {
  none: 'None',
  bands: 'Bands',
  home_gym: 'Home gym',
  full_gym: 'Full gym',
}

const DIETARY_LABELS_SHORT = {
  none: 'No preference',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
  keto: 'Keto',
  paleo: 'Paleo',
  custom: 'Custom',
}

const OCCUPATION_LABELS_SHORT = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  heavy: 'Heavy',
}

function IntakeBasicsEditor({ trainee, onSave }) {
  // Snapshot current values into editor state on every trainee refresh.
  const [draft, setDraft] = useState(() => seedDraftFromTrainee(trainee))
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState(null)
  const lastTraineeId = useRef(trainee.id)

  // Re-seed whenever the parent loads a fresh trainee row (after save).
  useEffect(() => {
    if (lastTraineeId.current !== trainee.id) {
      lastTraineeId.current = trainee.id
      setDraft(seedDraftFromTrainee(trainee))
      return
    }
    // Also re-seed when specific fields change upstream (e.g. external edit).
    setDraft(seedDraftFromTrainee(trainee))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    trainee.id,
    trainee.age,
    trainee.sex,
    trainee.height_cm,
    trainee.current_weight_kg,
    trainee.target_weight_kg,
    trainee.primary_goal,
    trainee.training_experience_years,
    trainee.training_days_per_week,
    trainee.equipment_access,
    trainee.medical_flags,
    trainee.injuries,
    trainee.dietary_preference,
    trainee.allergies,
    trainee.sleep_hours_avg,
    trainee.stress_level,
    trainee.occupation_activity,
    trainee.meals_per_day,
  ])

  const missingSet = useMemo(() => {
    const set = new Set(missingIntakeFields(trainee))
    set.delete('about_you') // AboutYouCard owns that one.
    return set
  }, [trainee])

  function set(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  function buildPatch() {
    const p = {}
    // Primitive number coercions.  Empty → null so the server can accept
    // "clearing" a value (though the completeness gate will flag it on gen).
    p.age = draft.age === '' ? null : Number(draft.age)
    p.sex = draft.sex || null
    p.primary_goal = draft.primary_goal || null
    p.training_experience_years = draft.training_experience_years === '' ? null : Number(draft.training_experience_years)
    p.training_days_per_week = draft.training_days_per_week === '' ? null : Number(draft.training_days_per_week)
    p.equipment_access = draft.equipment_access || null
    p.medical_flags = draft.medical_flags?.trim() || null
    p.injuries = draft.injuries?.trim() || null
    p.dietary_preference = draft.dietary_preference || null
    p.allergies = draft.allergies?.trim() || null
    p.sleep_hours_avg = draft.sleep_hours_avg === '' ? null : Number(draft.sleep_hours_avg)
    p.stress_level = draft.stress_level === '' ? null : Number(draft.stress_level)
    p.occupation_activity = draft.occupation_activity || null
    p.meals_per_day = draft.meals_per_day === '' ? null : Number(draft.meals_per_day)

    // Imperial → metric for height / weight.
    const ft = draft.height_ft === '' ? null : Number(draft.height_ft)
    const inches = draft.height_in === '' ? null : Number(draft.height_in)
    if (ft !== null || inches !== null) {
      p.height_cm = feetInchesToCm(ft || 0, inches || 0)
    } else {
      p.height_cm = null
    }
    p.current_weight_kg = draft.current_weight_lbs === '' ? null : lbsToKg(Number(draft.current_weight_lbs))
    p.target_weight_kg = draft.target_weight_lbs === '' ? null : lbsToKg(Number(draft.target_weight_lbs))

    return p
  }

  async function handleSave() {
    setLocalError(null)
    setSaving(true)
    const ok = await onSave?.(buildPatch())
    setSaving(false)
    if (!ok) setLocalError('Save failed — see the toast for details.')
  }

  const hasAnyMissing = missingSet.size > 0

  return (
    <section
      style={{
        ...panelStyle,
        borderLeft: hasAnyMissing ? `4px solid #ea580c` : undefined,
        background: hasAnyMissing ? '#fff7ed' : '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {hasAnyMissing && <AlertTriangle size={16} color="#ea580c" />}
        <h2 style={{ ...panelTitle, color: hasAnyMissing ? '#9a3412' : T }}>
          Intake basics
        </h2>
      </div>
      {hasAnyMissing && (
        <p style={{ ...paraStyle, color: '#9a3412', marginBottom: 14 }}>
          {missingSet.size} required {missingSet.size === 1 ? 'field' : 'fields'} still
          blank. Plan generation unlocks once these are answered.
        </p>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {/* Goal */}
        <EditorField label="Primary goal *" missing={missingSet.has('primary_goal')}>
          <RadioPill
            value={draft.primary_goal}
            options={PRIMARY_GOALS}
            labels={GOAL_LABELS_SHORT}
            onChange={(v) => set('primary_goal', v)}
          />
        </EditorField>

        {/* Two-col numeric row: age + sex */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <EditorField label="Age *" missing={missingSet.has('age')}>
            <BoundedNumber value={draft.age} onChange={(v) => set('age', v)} min={10} max={120} step={1} placeholder="yrs" />
          </EditorField>
          <EditorField label="Sex *" missing={missingSet.has('sex')}>
            <RadioPill
              value={normalizeSex(draft.sex)}
              options={['M', 'F', 'Other']}
              labels={{ M: 'Male', F: 'Female', Other: 'Other' }}
              onChange={(v) => set('sex', v)}
            />
          </EditorField>
        </div>

        {/* Height + weight */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <EditorField label="Height *" missing={missingSet.has('height_cm')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <BoundedNumber value={draft.height_ft} onChange={(v) => set('height_ft', v)} min={0} max={9} step={1} placeholder="ft" />
              <BoundedNumber value={draft.height_in} onChange={(v) => set('height_in', v)} min={0} max={11} step={1} placeholder="in" />
            </div>
          </EditorField>
          <EditorField label="Current weight *" missing={missingSet.has('current_weight_kg')}>
            <BoundedNumber value={draft.current_weight_lbs} onChange={(v) => set('current_weight_lbs', v)} min={50} max={600} step={1} placeholder="lbs" />
          </EditorField>
        </div>

        {/* Target weight (optional) */}
        <EditorField label="Target weight (optional)">
          <BoundedNumber value={draft.target_weight_lbs} onChange={(v) => set('target_weight_lbs', v)} min={50} max={600} step={1} placeholder="lbs" />
        </EditorField>

        {/* Experience + days/week */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <EditorField label="Training experience (years) *" missing={missingSet.has('training_experience_years')}>
            <BoundedNumber value={draft.training_experience_years} onChange={(v) => set('training_experience_years', v)} min={0} max={60} step={0.5} placeholder="yrs" />
          </EditorField>
          <EditorField label="Training days per week *" missing={missingSet.has('training_days_per_week')}>
            <BoundedNumber value={draft.training_days_per_week} onChange={(v) => set('training_days_per_week', v)} min={0} max={7} step={1} placeholder="0–7" />
          </EditorField>
        </div>

        {/* Equipment */}
        <EditorField label="Equipment access *" missing={missingSet.has('equipment_access')}>
          <RadioPill
            value={draft.equipment_access}
            options={EQUIPMENT_ACCESS}
            labels={EQUIPMENT_LABELS_SHORT}
            onChange={(v) => set('equipment_access', v)}
          />
        </EditorField>

        {/* Health */}
        <EditorField label="Medical flags *" missing={missingSet.has('medical_flags')}>
          <NoneOrText
            value={draft.medical_flags}
            onChange={(v) => set('medical_flags', v)}
            placeholder="Cardiac, hypertension, recent surgery, meds."
          />
        </EditorField>
        <EditorField label="Injuries *" missing={missingSet.has('injuries')}>
          <NoneOrText
            value={draft.injuries}
            onChange={(v) => set('injuries', v)}
            placeholder="Current or chronic injuries affecting training."
          />
        </EditorField>

        {/* Sleep + stress */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <EditorField label="Average sleep (hrs/night) *" missing={missingSet.has('sleep_hours_avg')}>
            <BoundedNumber value={draft.sleep_hours_avg} onChange={(v) => set('sleep_hours_avg', v)} min={0} max={16} step={0.5} placeholder="hrs" />
          </EditorField>
          <EditorField label="Stress level (1–10) *" missing={missingSet.has('stress_level')}>
            <Select
              value={draft.stress_level}
              onChange={(v) => set('stress_level', v)}
              options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: String(n), label: String(n) }))}
              placeholder="—"
            />
          </EditorField>
        </div>

        {/* Dietary */}
        <EditorField label="Dietary preference *" missing={missingSet.has('dietary_preference')}>
          <Select
            value={draft.dietary_preference}
            onChange={(v) => set('dietary_preference', v)}
            options={DIETARY_PREFERENCES.map((d) => ({ value: d, label: DIETARY_LABELS_SHORT[d] }))}
            placeholder="Select preference"
          />
        </EditorField>

        <EditorField label="Allergies / intolerances *" missing={missingSet.has('allergies')}>
          <NoneOrText
            value={draft.allergies}
            onChange={(v) => set('allergies', v)}
            placeholder="e.g. shellfish, tree nuts, dairy."
          />
        </EditorField>

        {/* Occupation + meals/day */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <EditorField label="Occupation activity *" missing={missingSet.has('occupation_activity')}>
            <RadioPill
              value={draft.occupation_activity}
              options={OCCUPATION_ACTIVITIES}
              labels={OCCUPATION_LABELS_SHORT}
              onChange={(v) => set('occupation_activity', v)}
            />
          </EditorField>
          <EditorField label="Meals per day *" missing={missingSet.has('meals_per_day')}>
            <Select
              value={draft.meals_per_day}
              onChange={(v) => set('meals_per_day', v)}
              options={[3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))}
              placeholder="3–6"
            />
          </EditorField>
        </div>
      </div>

      {localError && (
        <div style={{ fontSize: 12, color: '#991b1b', marginTop: 12 }}>{localError}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={btnPrimary(saving)}
        >
          {saving ? <Loader2 size={13} /> : null}
          {saving ? 'Saving…' : 'Save basics'}
        </button>
      </div>
    </section>
  )
}

// ── Intake editor helpers ───────────────────────────────────────────────

// Canonicalize sex values coming from the DB — older trainees may have
// "Male" / "male" / "m" / "F" etc.  Map to the radio pill's value set
// (M / F / Other) so the active state renders correctly.
function normalizeSex(raw) {
  if (!raw) return ''
  const s = String(raw).trim().toLowerCase()
  if (s === 'm' || s === 'male' || s === 'man') return 'M'
  if (s === 'f' || s === 'female' || s === 'woman') return 'F'
  if (s === '' || s === 'null') return ''
  return 'Other'
}

function seedDraftFromTrainee(t) {
  return {
    age: t.age ?? '',
    // Seed the normalized form so the radio pill matches on load; saves in
    // canonical form (M / F / Other) so subsequent edits stay in sync.
    sex: normalizeSex(t.sex),
    primary_goal: t.primary_goal || '',
    training_experience_years: t.training_experience_years ?? '',
    training_days_per_week: t.training_days_per_week ?? '',
    equipment_access: t.equipment_access || '',
    medical_flags: t.medical_flags || '',
    injuries: t.injuries || '',
    dietary_preference: t.dietary_preference || '',
    allergies: t.allergies || '',
    sleep_hours_avg: t.sleep_hours_avg ?? '',
    stress_level: t.stress_level ?? '',
    occupation_activity: t.occupation_activity || '',
    meals_per_day: t.meals_per_day ?? '',
    // Imperial presentation for height / weight.
    height_ft: t.height_cm ? String(Math.floor((t.height_cm / 2.54) / 12)) : '',
    height_in: t.height_cm ? String(Math.round((t.height_cm / 2.54) % 12)) : '',
    current_weight_lbs: t.current_weight_kg ? String(Math.round(t.current_weight_kg * 2.20462)) : '',
    target_weight_lbs: t.target_weight_kg ? String(Math.round(t.target_weight_kg * 2.20462)) : '',
  }
}

function EditorField({ label, missing, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: missing ? '#9a3412' : '#374151', marginBottom: 4 }}>
        {label}
        {missing && <span style={{ marginLeft: 6, color: '#ea580c', fontSize: 10, fontWeight: 800 }}>REQUIRED</span>}
      </label>
      {children}
      {hint && <div style={{ marginTop: 4, fontSize: 10, color: GRY }}>{hint}</div>}
    </div>
  )
}

function BoundedNumber({ value, onChange, min, max, step, placeholder }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '8px 10px',
        fontSize: 13,
        border: '1px solid #d1d5db',
        borderRadius: 6,
        background: '#fff',
        color: '#0a0a0a',
        fontFamily: 'inherit',
      }}
    />
  )
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '8px 10px',
        fontSize: 13,
        border: '1px solid #d1d5db',
        borderRadius: 6,
        background: '#fff',
        color: '#0a0a0a',
        fontFamily: 'inherit',
      }}
    >
      <option value="">{placeholder || 'Select'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function RadioPill({ value, options, labels, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt) => {
        const active = String(value) === String(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              padding: '6px 12px',
              border: `1px solid ${active ? R : '#d1d5db'}`,
              borderRadius: 999,
              background: active ? R + '10' : '#fff',
              color: active ? R : '#374151',
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {labels?.[opt] || opt}
          </button>
        )
      })}
    </div>
  )
}

const textareaStyle = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 13,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  color: '#0a0a0a',
  fontFamily: 'inherit',
  lineHeight: 1.5,
}

// Free-text context feeding every Sonnet prompt.  Rendered full-width at the
// top of the Overview tab so trainers see it FIRST — before any plan-generation
// CTA — since about_you drives the quality of every downstream step.
function AboutYouCard({ trainee, onUpdateAboutYou }) {
  const hasContext = !!(trainee.about_you && trainee.about_you.trim().length > 0)
  // Compact by default when context is already on file — the trainer saw
  // this question on the intake form, shouldn't be re-prompted on detail.
  // Empty state auto-opens the editor (blocks plan generation downstream).
  const [editing, setEditing] = useState(!hasContext)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(trainee.about_you || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const ok = await onUpdateAboutYou?.(draft)
    setSaving(false)
    if (ok) setEditing(false)
  }

  // Compact single-row view when context is on file and not editing.
  if (hasContext && !editing) {
    const preview = trainee.about_you.trim().replace(/\s+/g, ' ').slice(0, 120)
    return (
      <section
        style={{
          ...panelStyle,
          marginBottom: 18,
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <span style={{ color: GRN, fontSize: 14, fontWeight: 800 }}>✓</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              About this athlete
            </span>
            <span style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              — {preview}{trainee.about_you.length > 120 ? '…' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
            >
              {expanded ? 'Hide' : 'View'}
            </button>
            {onUpdateAboutYou && (
              <button
                type="button"
                onClick={() => { setDraft(trainee.about_you || ''); setEditing(true) }}
                style={{ background: 'none', border: 'none', color: T, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                Edit
              </button>
            )}
          </div>
        </div>
        {expanded && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BRD}`, fontSize: 13, color: '#0a0a0a', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {trainee.about_you}
          </div>
        )}
      </section>
    )
  }

  // Expanded editor — empty-state OR user clicked Edit.
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
            {hasContext ? 'About this athlete' : 'Start here — About this athlete'}
          </h2>
          <div style={{ fontSize: 12, color: GRY, marginTop: 4, lineHeight: 1.5 }}>
            {hasContext
              ? 'Fed into every AI-generated step — baseline, roadmap, workouts, meals, playbook.'
              : 'Required before Koto Trainer can craft a custom plan. Sport, lifestyle, goals, constraints — in their own words.'}
          </div>
        </div>
      </div>

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
        <strong>Plan is paused.</strong> Athlete needs physician clearance before the plan tab is
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
            nutrition theme plus milestones the athlete can feel.
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
            progression rule, coaching cues, and a how-to toggle so the athlete never has to guess
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
            Collect the athlete&apos;s food preferences before generating meals. Adherence lives and
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
            organized against the athlete&apos;s preferences, plus a single grocery run by aisle so
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
          Generate the athlete&apos;s reference guide — nutrition, supplements, on-the-road eating,
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

// ── Recruiting tab ──────────────────────────────────────────────────────────

function RecruitingTab({ trainee }) {
  const ext = trainee.extracted || trainee.recruiting_profile || {}

  // Resolve from trainee row first, fall back to extracted data
  const g = (key) => trainee[key] ?? ext[key] ?? null

  // Column names here MUST match the koto_fitness_trainees schema and the
  // allowedFields list in /api/trainer/intake-chat-token — otherwise values
  // the athlete typed in chat will silently fail to surface here.
  // Handedness maps: DB stores R/L/S codes.
  const handLabel = { R: 'Right', L: 'Left', S: 'Switch' }
  const throws = g('throwing_hand')
  const bats = g('batting_hand')
  const primaryPos = g('position_primary')
  const secondaryPos = g('position_secondary')
  const position = primaryPos && secondaryPos ? `${primaryPos} / ${secondaryPos}` : primaryPos
  const testType = g('test_type')
  const testScore = g('test_score')

  const profileFields = [
    { label: 'Graduation year', value: g('grad_year') },
    { label: 'Position', value: position },
    { label: 'Throws', value: throws ? (handLabel[throws] || throws) : null },
    { label: 'Bats', value: bats ? (handLabel[bats] || bats) : null },
    { label: 'GPA', value: g('gpa') },
    { label: 'Test score', value: testScore ? (testType ? `${testType} ${testScore}` : testScore) : null },
    { label: 'High school', value: g('high_school') },
    { label: 'Travel / club team', value: g('travel_team') || g('club_team') },
    { label: 'Video link', value: g('video_link') },
    { label: 'Preferred divisions', value: Array.isArray(g('preferred_divisions')) ? g('preferred_divisions').join(', ') : g('preferred_divisions') },
    { label: 'Preferred states', value: Array.isArray(g('preferred_states')) ? g('preferred_states').join(', ') : g('preferred_states') },
    { label: 'Intended major', value: g('intended_major') },
  ]

  const measurables = [
    { label: 'FB velo peak', value: g('fastball_velo_peak'), unit: 'mph' },
    { label: 'FB velo sit', value: g('fastball_velo_sit'), unit: 'mph' },
    { label: 'Exit velo', value: g('exit_velo'), unit: 'mph' },
    { label: '60-yard time', value: g('sixty_time'), unit: 's' },
    { label: 'Pop time', value: g('pop_time'), unit: 's' },
  ]

  const hasProfile = profileFields.some((f) => f.value != null && f.value !== '')
  const hasMeasurables = measurables.some((f) => f.value != null && f.value !== '')

  const intakeUrl = `${window.location.origin}/intake/${trainee.id}`
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(intakeUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div>
      {/* Intake link */}
      <section style={{ ...panelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 300px' }}>
          <h2 style={{ ...panelTitle, color: RED, margin: '0 0 4px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Link2 size={13} /> Intake link
            </span>
          </h2>
          <div style={{ fontSize: 12, color: GRY5, wordBreak: 'break-all' }}>{intakeUrl}</div>
        </div>
        <button type="button" onClick={handleCopy} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          background: copied ? '#ecfdf5' : '#fff',
          color: copied ? '#059669' : GRY7,
          border: `1px solid ${copied ? '#059669' : BRD}`,
          borderRadius: 8,
          transition: 'all .2s ease',
        }}>
          {copied ? <><Copy size={13} /> Copied!</> : <><Copy size={13} /> Copy link</>}
        </button>
      </section>

      {/* Recruiting profile */}
      <section style={{ ...panelStyle, borderLeft: `4px solid ${RED}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <UserCheck size={14} color={RED} />
          <h2 style={{ ...panelTitle, color: RED, margin: 0 }}>Recruiting profile</h2>
        </div>
        {!hasProfile ? (
          <p style={{ ...paraStyle, color: GRY5 }}>
            No recruiting profile data yet. The athlete can fill this in via the intake chat, or it can be entered manually.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {profileFields.filter((f) => f.value != null && f.value !== '').map(({ label, value }) => {
              const isLink = label === 'Video link' && typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))
              return (
                <div key={label} style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 8, border: `1px solid ${BRD}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: GRY5, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{label}</div>
                  {isLink ? (
                    <a href={value} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: BLUE, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      View video <ExternalLink size={12} />
                    </a>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 600, color: BLK }}>{String(value)}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Measurables */}
      <section style={{ ...panelStyle, borderLeft: `4px solid ${BLUE}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Activity size={14} color={BLUE} />
          <h2 style={{ ...panelTitle, color: BLUE, margin: 0 }}>Measurables</h2>
        </div>
        {!hasMeasurables ? (
          <p style={{ ...paraStyle, color: GRY5 }}>
            No measurables recorded yet. These are typically collected during the intake process.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {measurables.filter((f) => f.value != null && f.value !== '').map(({ label, value, unit }) => (
              <div key={label} style={{
                padding: '14px 16px', background: '#f9fafb', borderRadius: 10,
                border: `1px solid ${BRD}`, textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRY5, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: BLK }}>
                  {String(value)}
                  {unit && <span style={{ fontSize: 13, fontWeight: 600, color: GRY5, marginLeft: 3 }}>{unit}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
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

// ── Panels / cards — subtle layered shadow on clean white ────────────────
const panelStyle = {
  background: '#fff',
  border: `1px solid ${BRD}`,
  borderRadius: 10,
  padding: '20px 22px',
  marginBottom: 14,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.03)',
}

// Neutral titlecase — no more uppercase accent color, no exotic letterspacing.
// Reads like a section heading in Linear / Stripe / Vercel.
const panelTitle = {
  margin: '0 0 6px',
  fontSize: 18,
  fontWeight: 700,
  color: '#0f172a',
  letterSpacing: '-.015em',
  lineHeight: 1.2,
}

const paraStyle = {
  color: '#475569',
  fontSize: 15,
  margin: '0 0 18px',
  lineHeight: 1.55,
}

const chip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '3px 9px',
  background: '#f8fafc',
  border: `1px solid ${BRD}`,
  color: '#475569',
  borderRadius: 6,
  fontSize: 11.5,
  fontWeight: 600,
  letterSpacing: '-.005em',
}

const chipAccent = {
  ...chip,
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: BLUE,
}

function btnPrimary(disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '11px 20px',
    background: disabled ? '#e2e8f0' : '#0f172a',
    color: disabled ? '#94a3b8' : '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: disabled ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.08)',
    transition: 'background .12s, box-shadow .12s, transform .08s',
    letterSpacing: '-.005em',
  }
}

function btnSecondary(disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 15px',
    background: '#fff',
    color: disabled ? '#94a3b8' : '#334155',
    border: `1px solid ${BRD}`,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    transition: 'background .12s, border-color .12s',
  }
}

// ── Intake link copy button ─────────────────────────────────────────────────

function IntakeLinkButton({ traineeId }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/intake/${traineeId}`

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={url}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        background: copied ? '#ecfdf5' : '#fff',
        color: copied ? '#059669' : '#6b7280',
        border: `1px solid ${copied ? '#059669' : '#d1d5db'}`,
        borderRadius: 8,
        transition: 'all .2s ease',
      }}
    >
      {copied ? <><Copy size={13} /> Copied!</> : <><Link2 size={13} /> Intake link</>}
    </button>
  )
}
