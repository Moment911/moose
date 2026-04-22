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
  CheckCircle,
  Circle,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { FeatureDisabledPanel } from './TrainerListPage'
import { trainerFetch } from '../../lib/trainer/trainerFetch'
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

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — /trainer/:traineeId full plan view.
//
// Replaces the Phase 1 stub.  Orchestrates the Sonnet chain:
//   baseline → roadmap → workout(phase) → food_prefs → meals → grocery → adjust
// via POST /api/trainer/generate, and drives the per-set workout log via
// POST /api/trainer/workout-logs.
//
// Plan state lives in this component.  If Agent B ships a `get_current_plan`
// action on /api/trainer/generate we pick it up on mount; otherwise state
// starts empty and the operator drives each step.  Flagged in the report.
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

  // Stable toast message ref so transient errors can auto-clear.
  const toastTimer = useRef(null)
  function flashError(msg) {
    setStepError(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setStepError(null), 8000)
  }

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
        const detail = await res.text().catch(() => '')
        flashError(`Generation failed (${res.status})${detail ? `: ${detail.slice(0, 160)}` : ''}`)
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
  const hasWorkout = !!plan?.workout_plan
  const hasPrefs = !!plan?.food_preferences
  const hasMeals = !!plan?.meal_plan
  const hasGrocery = !!plan?.grocery_list

  // Next-block gating: ≥ 40% adherence AND ≥ 11 days since workout generated.
  const canAdjust = useMemo(() => {
    if (!plan?.workout_plan || !plan?.generated_at) return false
    const days = (Date.now() - new Date(plan.generated_at).getTime()) / (1000 * 60 * 60 * 24)
    const pct = Number(adherence?.adherence_pct ?? 0)
    return days >= 11 && pct >= 40 && currentPhase < 3
  }, [plan?.workout_plan, plan?.generated_at, adherence?.adherence_pct, currentPhase])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
        <Link
          to="/trainer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T, textDecoration: 'none', fontSize: 13, fontWeight: 600, marginBottom: 16 }}
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
            <Header
              trainee={trainee}
              actionPending={actionPending}
              onArchive={() => callTraineeAction('archive')}
              onUnarchive={() => callTraineeAction('unarchive')}
            />

            {stepError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertTriangle size={14} /> {stepError}
              </div>
            )}

            <StatusStrip
              hasBaseline={hasBaseline}
              hasRoadmap={hasRoadmap}
              hasWorkout={hasWorkout}
              hasPrefs={hasPrefs}
              hasMeals={hasMeals}
              hasLogs={logs.length > 0}
            />

            {/* ── Baseline ─────────────────────────────────────────────────── */}
            {!hasBaseline ? (
              <section style={{ ...panelStyle, background: '#fff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <h2 style={panelTitle}>Intake summary</h2>
                    <Row k="Goal" v={trainee.primary_goal} />
                    <Row k="Age" v={trainee.age} />
                    <Row k="Sex" v={trainee.sex} />
                    <Row k="Height" v={trainee.height_cm ? cmToFeetInches(trainee.height_cm) : null} />
                    <Row k="Weight" v={trainee.current_weight_kg ? `${kgToLbs(trainee.current_weight_kg)} lbs` : null} />
                    <Row k="Target" v={trainee.target_weight_kg ? `${kgToLbs(trainee.target_weight_kg)} lbs` : null} />
                    <Row k="Training days/wk" v={trainee.training_days_per_week} />
                    <Row k="Equipment" v={trainee.equipment_access} />
                    <Row k="Dietary preference" v={trainee.dietary_preference} />
                    <Row k="Allergies" v={trainee.allergies} />
                    <Row k="Medical flags" v={trainee.medical_flags} />
                    <Row k="Injuries" v={trainee.injuries} />
                  </div>
                  <div>
                    <h2 style={panelTitle}>Start here</h2>
                    <p style={{ color: GRY7, fontSize: 13, lineHeight: 1.55, margin: '0 0 16px' }}>
                      Generate the baseline assessment — calories, macros, training readiness,
                      and the three focus areas that will move the needle most for this trainee.
                      This is the input every downstream step reads from.
                    </p>
                    <button
                      type="button"
                      onClick={handleGenerateBaseline}
                      disabled={pending.baseline}
                      style={btnPrimary(pending.baseline)}
                    >
                      {pending.baseline ? <Loader2 size={14} /> : <Sparkles size={14} />}
                      {pending.baseline ? 'Generating baseline…' : 'Generate baseline'}
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <PlanBaselineCard
                baseline={plan.baseline}
                onRegenerate={handleGenerateBaseline}
                regenerating={pending.baseline}
              />
            )}

            {/* Stop chain if not ok to train. */}
            {hasBaseline && !okToTrain && (
              <section
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 10,
                  padding: 20,
                  marginBottom: 18,
                  color: '#991b1b',
                }}
              >
                <strong>Plan is paused.</strong> This trainee needs physician clearance before
                Koto Trainer generates a workout or meal plan. Update medical_flags / injuries in
                the intake once the operator has documented clearance, then regenerate.
              </section>
            )}

            {/* ── Roadmap ──────────────────────────────────────────────────── */}
            {hasBaseline && okToTrain && !hasRoadmap && (
              <section style={panelStyle}>
                <h2 style={panelTitle}>Next: 90-day roadmap</h2>
                <p style={{ color: GRY7, fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                  Break the target into three 30-day phases. Each phase has its own training and
                  nutrition theme and clear milestones the trainee can feel.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateRoadmap}
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
                onSelectPhase={(n) => handleGenerateWorkout(n)}
              />
            )}

            {/* ── Coaching Playbook ─────────────────────────────────────────── */}
            {hasRoadmap && !plan?.playbook && (
              <section style={panelStyle}>
                <h2 style={panelTitle}>Coaching playbook</h2>
                <p style={{ color: GRY7, fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                  Generate the trainee&apos;s full reference guide: nutrition protocol, supplement
                  protocol, on-the-road eating strategy, weekly meal-prep routine, recovery + sleep
                  protocol, and an 8-scenario troubleshooting guide. One-time output — re-generate
                  anytime to refresh.
                </p>
                <button
                  type="button"
                  onClick={handleGeneratePlaybook}
                  disabled={pending.playbook}
                  style={btnPrimary(pending.playbook)}
                >
                  {pending.playbook ? <Loader2 size={14} /> : <Sparkles size={14} />}
                  {pending.playbook ? 'Generating playbook…' : 'Generate coaching playbook'}
                </button>
              </section>
            )}

            {plan?.playbook && (
              <PlaybookCard
                playbook={plan.playbook}
                onRegenerate={handleGeneratePlaybook}
                regenerating={pending.playbook}
              />
            )}

            {/* ── Workout ──────────────────────────────────────────────────── */}
            {hasRoadmap && !hasWorkout && (
              <section style={panelStyle}>
                <h2 style={panelTitle}>Next: 2-week training block</h2>
                <p style={{ color: GRY7, fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                  Generate a 2-week workout block for phase {currentPhase}. Every exercise includes
                  loadable set/rep targets, a progression rule, coaching cues, and a how-to toggle
                  so the trainee never has to guess form.
                </p>
                <button
                  type="button"
                  onClick={() => handleGenerateWorkout(currentPhase)}
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
                onLogSet={handleLogSet}
                expandSessionDay={expandSessionDay}
              />
            )}

            {/* ── Food prefs ───────────────────────────────────────────────── */}
            {hasWorkout && !hasPrefs && (
              <section style={panelStyle}>
                <h2 style={panelTitle}>Next: food preferences</h2>
                <p style={{ color: GRY7, fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                  Collect the trainee&apos;s food preferences before generating meals. Adherence
                  lives and dies here — people eat food they chose, not food they were assigned.
                </p>
                <button
                  type="button"
                  onClick={handleElicitFoodPrefs}
                  disabled={pending.food_prefs}
                  style={btnPrimary(pending.food_prefs)}
                >
                  {pending.food_prefs ? <Loader2 size={14} /> : <Utensils size={14} />}
                  {pending.food_prefs ? 'Preparing questions…' : 'Collect food preferences'}
                </button>
              </section>
            )}

            {/* ── Meals ────────────────────────────────────────────────────── */}
            {hasPrefs && !hasMeals && (
              <section style={panelStyle}>
                <h2 style={panelTitle}>Next: 2-week meals + grocery</h2>
                <p style={{ color: GRY7, fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                  Generate a full 2-week meal plan hitting the baseline calorie + macro targets,
                  organized against the trainee&apos;s actual preferences, and a single grocery run
                  by aisle so Sunday shopping is one trip.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateMeals}
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

            {/* ── Workout log grid ─────────────────────────────────────────── */}
            {hasWorkout && (
              <WorkoutLogGrid
                workoutPlan={plan.workout_plan}
                logs={logs}
                adherence={adherence}
                onOpenSession={(day) => {
                  setExpandSessionDay(day)
                  // Reset after a tick so repeat clicks re-trigger the effect.
                  setTimeout(() => setExpandSessionDay(null), 400)
                }}
              />
            )}

            {/* ── Adjust-block ─────────────────────────────────────────────── */}
            {hasWorkout && (
              <section style={panelStyle}>
                <h2 style={panelTitle}>Adjust block</h2>
                <p style={{ color: GRY7, fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>
                  Generate the next 2-week block based on adherence + recent performance.
                  Enabled once the trainee has ≥ 40% adherence and the block is ≥ 11 days old.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleGenerateNextBlock}
                    disabled={!canAdjust || pending.adjust}
                    style={btnPrimary(!canAdjust || pending.adjust)}
                  >
                    {pending.adjust ? <Loader2 size={14} /> : <ArrowRight size={14} />}
                    {pending.adjust ? 'Adjusting…' : 'Generate next block'}
                  </button>
                  {!canAdjust && (
                    <span style={{ color: GRY5, fontSize: 12 }}>
                      {(() => {
                        if (currentPhase >= 3) return 'Final phase reached.'
                        const pct = Math.round(Number(adherence?.adherence_pct ?? 0))
                        const daysOld = plan?.generated_at
                          ? Math.floor(
                              (Date.now() - new Date(plan.generated_at).getTime()) /
                                (1000 * 60 * 60 * 24),
                            )
                          : 0
                        return `${pct}% adherence · block is ${daysOld} day${daysOld === 1 ? '' : 's'} old`
                      })()}
                    </span>
                  )}
                </div>
              </section>
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
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Header({ trainee, actionPending, onArchive, onUnarchive }) {
  return (
    <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, color: BLK }}>{trainee.full_name}</h1>
        <p style={{ margin: '6px 0 0', color: GRY5, fontSize: 14 }}>
          {trainee.primary_goal || 'no goal set'} · created{' '}
          {trainee.created_at ? new Date(trainee.created_at).toLocaleDateString() : '—'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
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
    </header>
  )
}

function StatusStrip({ hasBaseline, hasRoadmap, hasWorkout, hasPrefs, hasMeals, hasLogs }) {
  const steps = [
    { label: 'Baseline', done: hasBaseline, icon: <Target size={13} /> },
    { label: 'Roadmap', done: hasRoadmap, icon: <TrendingUp size={13} /> },
    { label: 'Workout', done: hasWorkout, icon: <Dumbbell size={13} /> },
    { label: 'Food prefs', done: hasPrefs, icon: <Utensils size={13} /> },
    { label: 'Meals', done: hasMeals, icon: <Utensils size={13} /> },
    { label: 'Logs', done: hasLogs, icon: <CheckCircle size={13} /> },
  ]
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}
    >
      {steps.map((s, i) => (
        <span
          key={s.label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 11px',
            background: s.done ? GRN + '15' : '#fff',
            color: s.done ? GRN : GRY5,
            border: `1px solid ${s.done ? GRN + '40' : BRD}`,
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.03em',
          }}
        >
          {s.done ? <CheckCircle size={13} /> : <Circle size={13} />}
          {s.label}
          {i < steps.length - 1 && <span style={{ color: '#d1d5db', marginLeft: 4 }}>·</span>}
        </span>
      ))}
    </div>
  )
}

function Row({ k, v }) {
  if (v === null || v === undefined || v === '') return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', padding: '5px 0', fontSize: 13 }}>
      <span style={{ color: GRY5, fontWeight: 600 }}>{k}</span>
      <span style={{ color: BLK }}>{String(v)}</span>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const panelStyle = {
  background: '#fff',
  border: `1px solid ${BRD}`,
  borderRadius: 12,
  padding: 24,
  marginBottom: 18,
}

const panelTitle = { margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: T, letterSpacing: '.04em', textTransform: 'uppercase' }

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
