"use client"
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchMyPlan, logSet as apiLogSet } from '../../lib/trainer/myPlanFetch'
import MyPlanShell from '../../components/trainer/MyPlanShell'
import TrainerWelcomeCard from '../../components/trainer/TrainerWelcomeCard'
import NaturalAdjustBox from '../../components/trainer/NaturalAdjustBox'
import NoneOrText from '../../components/trainer/NoneOrText'
import TraineeDisclaimerAckModal from './TraineeDisclaimerAckModal'
import { updateMyIntake, deleteMyAccount } from '../../lib/trainer/myPlanFetch'
import {
  PRIMARY_GOALS,
  EQUIPMENT_ACCESS,
  DIETARY_PREFERENCES,
  OCCUPATION_ACTIVITIES,
} from '../../lib/trainer/intakeSchema'
import { feetInchesToCm, lbsToKg } from '../../lib/trainer/units'
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
  { key: 'settings', label: 'Settings' },
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
            <NaturalAdjustBox
              disabled={!plan.workout_plan}
              onAfterAdjust={loadPlan}
            />
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
            <MealPlanTable mealPlan={plan.meal_plan} traineeId={trainee?.id} />
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

        {tab === 'settings' ? (
          <SettingsTab trainee={trainee} onAfterChange={loadPlan} />
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

// ─────────────────────────────────────────────────────────────────────────────
// SettingsTab — trainee edits their own intake, deletes their own account.
//
// Every field is always-editable (no "click to edit" mode); hit Save to
// commit the whole patch via /api/trainer/my-plan action=update_intake.
// Delete flow: confirmation step, then action=delete_my_account, then
// sign out and bounce to /start.
// ─────────────────────────────────────────────────────────────────────────────

const SET_BRD = '#e5e7eb'
const SET_INK = '#0a0a0a'
const SET_GRY = '#6b7280'
const SET_T = '#00c2cb'
const SET_R = '#ea2729'
const SET_GRN = '#10b981'

function normalizeSex(raw) {
  if (!raw) return ''
  const s = String(raw).trim().toLowerCase()
  if (s === 'm' || s === 'male' || s === 'man') return 'M'
  if (s === 'f' || s === 'female' || s === 'woman') return 'F'
  if (s === '' || s === 'null') return ''
  return 'Other'
}

function seedSettingsDraft(t) {
  return {
    about_you: t?.about_you || '',
    age: t?.age ?? '',
    sex: normalizeSex(t?.sex),
    primary_goal: t?.primary_goal || '',
    training_experience_years: t?.training_experience_years ?? '',
    training_days_per_week: t?.training_days_per_week ?? '',
    equipment_access: t?.equipment_access || '',
    medical_flags: t?.medical_flags || '',
    injuries: t?.injuries || '',
    dietary_preference: t?.dietary_preference || '',
    allergies: t?.allergies || '',
    sleep_hours_avg: t?.sleep_hours_avg ?? '',
    stress_level: t?.stress_level ?? '',
    occupation_activity: t?.occupation_activity || '',
    meals_per_day: t?.meals_per_day ?? '',
    height_ft: t?.height_cm ? String(Math.floor((t.height_cm / 2.54) / 12)) : '',
    height_in: t?.height_cm ? String(Math.round((t.height_cm / 2.54) % 12)) : '',
    current_weight_lbs: t?.current_weight_kg ? String(Math.round(t.current_weight_kg * 2.20462)) : '',
    target_weight_lbs: t?.target_weight_kg ? String(Math.round(t.target_weight_kg * 2.20462)) : '',
  }
}

function SettingsTab({ trainee, onAfterChange }) {
  const [draft, setDraft] = useState(() => seedSettingsDraft(trainee))
  const [saving, setSaving] = useState(false)
  const [saveNote, setSaveNote] = useState(null)
  const [saveError, setSaveError] = useState(null)

  // Delete-account flow state
  const [deleteStage, setDeleteStage] = useState('idle') // 'idle' | 'confirm' | 'deleting' | 'error'
  const [deleteError, setDeleteError] = useState(null)

  // Re-seed when the trainee row refreshes upstream.
  useEffect(() => { setDraft(seedSettingsDraft(trainee)) }, [trainee])

  function set(field, value) { setDraft((d) => ({ ...d, [field]: value })) }

  function buildPatch() {
    const p = {
      about_you: (draft.about_you || '').trim() || null,
      age: draft.age === '' ? null : Number(draft.age),
      sex: draft.sex || null,
      primary_goal: draft.primary_goal || null,
      training_experience_years: draft.training_experience_years === '' ? null : Number(draft.training_experience_years),
      training_days_per_week: draft.training_days_per_week === '' ? null : Number(draft.training_days_per_week),
      equipment_access: draft.equipment_access || null,
      medical_flags: (draft.medical_flags || '').trim() || null,
      injuries: (draft.injuries || '').trim() || null,
      dietary_preference: draft.dietary_preference || null,
      allergies: (draft.allergies || '').trim() || null,
      sleep_hours_avg: draft.sleep_hours_avg === '' ? null : Number(draft.sleep_hours_avg),
      stress_level: draft.stress_level === '' ? null : Number(draft.stress_level),
      occupation_activity: draft.occupation_activity || null,
      meals_per_day: draft.meals_per_day === '' ? null : Number(draft.meals_per_day),
    }
    const ft = draft.height_ft === '' ? null : Number(draft.height_ft)
    const inches = draft.height_in === '' ? null : Number(draft.height_in)
    if (ft !== null || inches !== null) p.height_cm = feetInchesToCm(ft || 0, inches || 0)
    if (draft.current_weight_lbs !== '') {
      const n = Number(draft.current_weight_lbs)
      if (Number.isFinite(n)) p.current_weight_kg = lbsToKg(n)
    }
    if (draft.target_weight_lbs !== '') {
      const n = Number(draft.target_weight_lbs)
      if (Number.isFinite(n)) p.target_weight_kg = lbsToKg(n)
    }
    return p
  }

  async function handleSave() {
    setSaving(true)
    setSaveNote(null)
    setSaveError(null)
    try {
      const patch = buildPatch()
      await updateMyIntake(patch)
      setSaveNote('Saved.')
      onAfterChange?.()
    } catch (e) {
      setSaveError(e?.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleteStage('deleting')
    setDeleteError(null)
    try {
      await deleteMyAccount()
      await supabase.auth.signOut()
      window.location.href = '/start'
    } catch (e) {
      setDeleteError(e?.message || 'Delete failed.')
      setDeleteStage('error')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* About you */}
      <section style={{ background: '#fff', border: `1px solid ${SET_BRD}`, borderRadius: 12, padding: '20px 22px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: SET_T, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          About you
        </h2>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: SET_GRY, lineHeight: 1.55 }}>
          Fed into every AI-generated step. Edit it here any time — it shapes the next plan adjust.
        </p>
        <textarea
          value={draft.about_you}
          onChange={(e) => set('about_you', e.target.value)}
          rows={6}
          style={{
            width: '100%', padding: '10px 12px', fontSize: 13,
            border: `1px solid #d1d5db`, borderRadius: 8, fontFamily: 'inherit',
            lineHeight: 1.5, color: SET_INK, background: '#fff', resize: 'vertical',
          }}
        />
      </section>

      {/* Basics */}
      <section style={{ background: '#fff', border: `1px solid ${SET_BRD}`, borderRadius: 12, padding: '20px 22px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: SET_T, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          Basics
        </h2>
        <div style={{ display: 'grid', gap: 14 }}>
          <SRow2>
            <SField label="Age">
              <SNum value={draft.age} onChange={(v) => set('age', v)} min={10} max={120} step={1} placeholder="yrs" />
            </SField>
            <SField label="Sex">
              <SPill value={draft.sex} options={['M','F','Other']} labels={{M:'Male',F:'Female',Other:'Other'}} onChange={(v) => set('sex', v)} />
            </SField>
          </SRow2>

          <SRow2>
            <SField label="Height">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <SNum value={draft.height_ft} onChange={(v) => set('height_ft', v)} min={0} max={9} placeholder="ft" />
                <SNum value={draft.height_in} onChange={(v) => set('height_in', v)} min={0} max={11} placeholder="in" />
              </div>
            </SField>
            <SField label="Current weight">
              <SNum value={draft.current_weight_lbs} onChange={(v) => set('current_weight_lbs', v)} min={50} max={600} placeholder="lbs" />
            </SField>
          </SRow2>

          <SField label="Target weight (optional)">
            <SNum value={draft.target_weight_lbs} onChange={(v) => set('target_weight_lbs', v)} min={50} max={600} placeholder="lbs" />
          </SField>

          <SField label="Primary goal">
            <SPill value={draft.primary_goal} options={[...PRIMARY_GOALS]} labels={{lose_fat:'Lose fat',gain_muscle:'Gain muscle',maintain:'Maintain',performance:'Performance',recomp:'Recomp'}} onChange={(v) => set('primary_goal', v)} />
          </SField>

          <SRow2>
            <SField label="Experience (years)">
              <SNum value={draft.training_experience_years} onChange={(v) => set('training_experience_years', v)} min={0} max={60} step={0.5} placeholder="yrs" />
            </SField>
            <SField label="Training days/week">
              <SNum value={draft.training_days_per_week} onChange={(v) => set('training_days_per_week', v)} min={0} max={7} placeholder="0–7" />
            </SField>
          </SRow2>

          <SField label="Equipment access">
            <SPill value={draft.equipment_access} options={[...EQUIPMENT_ACCESS]} labels={{none:'None',bands:'Bands',home_gym:'Home gym',full_gym:'Full gym'}} onChange={(v) => set('equipment_access', v)} />
          </SField>

          <SField label="Medical flags">
            <NoneOrText value={draft.medical_flags} onChange={(v) => set('medical_flags', v)} placeholder="Cardiac, hypertension, meds, etc." />
          </SField>
          <SField label="Injuries">
            <NoneOrText value={draft.injuries} onChange={(v) => set('injuries', v)} placeholder="Current or chronic injuries." />
          </SField>

          <SRow2>
            <SField label="Average sleep (hrs/night)">
              <SNum value={draft.sleep_hours_avg} onChange={(v) => set('sleep_hours_avg', v)} min={0} max={16} step={0.5} placeholder="hrs" />
            </SField>
            <SField label="Stress (1–10)">
              <SSelect value={draft.stress_level} onChange={(v) => set('stress_level', v)} options={[1,2,3,4,5,6,7,8,9,10].map(n=>({value:String(n),label:String(n)}))} placeholder="—" />
            </SField>
          </SRow2>

          <SField label="Dietary preference">
            <SSelect value={draft.dietary_preference} onChange={(v) => set('dietary_preference', v)} options={DIETARY_PREFERENCES.map(d=>({value:d,label:d}))} placeholder="Pick one" />
          </SField>
          <SField label="Allergies / intolerances">
            <NoneOrText value={draft.allergies} onChange={(v) => set('allergies', v)} placeholder="e.g. shellfish, tree nuts." />
          </SField>

          <SRow2>
            <SField label="Occupation activity">
              <SPill value={draft.occupation_activity} options={[...OCCUPATION_ACTIVITIES]} labels={{sedentary:'Sedentary',light:'Light',moderate:'Moderate',heavy:'Heavy'}} onChange={(v) => set('occupation_activity', v)} />
            </SField>
            <SField label="Meals per day">
              <SSelect value={draft.meals_per_day} onChange={(v) => set('meals_per_day', v)} options={[3,4,5,6].map(n=>({value:String(n),label:String(n)}))} placeholder="3–6" />
            </SField>
          </SRow2>
        </div>

        {saveError && <div style={{ marginTop: 12, padding: '10px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{saveError}</div>}
        {saveNote && <div style={{ marginTop: 12, padding: '10px 12px', background: '#f0fdf4', border: `1px solid #bbf7d0`, borderRadius: 8, fontSize: 13, color: '#065f46' }}>{saveNote}</div>}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleSave} disabled={saving}
            style={{
              padding: '10px 18px', background: saving ? '#9ca3af' : SET_R, color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: saving ? 'default' : 'pointer',
            }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section style={{ background: '#fff', border: `1px solid #fca5a5`, borderRadius: 12, padding: '20px 22px' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: '#991b1b', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          Danger zone
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#991b1b', lineHeight: 1.55 }}>
          Delete your account. Your intake, plan, workout logs, and login are permanently removed.
        </p>
        {deleteStage === 'idle' && (
          <button type="button" onClick={() => setDeleteStage('confirm')}
            style={{ padding: '10px 16px', background: '#fff', color: '#991b1b', border: `1px solid #fca5a5`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Delete my account
          </button>
        )}
        {deleteStage === 'confirm' && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#991b1b' }}>
              This cannot be undone. Type <code style={{ background: '#fee2e2', padding: '1px 4px', borderRadius: 3 }}>delete</code> below and click confirm.
            </p>
            <DeleteConfirm onConfirm={handleDelete} onCancel={() => setDeleteStage('idle')} />
          </div>
        )}
        {deleteStage === 'deleting' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', fontSize: 13 }}>
            <Loader2 size={14} /> Deleting your account…
          </div>
        )}
        {deleteStage === 'error' && (
          <div style={{ padding: '10px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
            {deleteError || 'Delete failed.'}
            <div style={{ marginTop: 6 }}>
              <button type="button" onClick={() => setDeleteStage('confirm')} style={{ background: 'none', border: 'none', color: '#991b1b', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                Retry
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function DeleteConfirm({ onConfirm, onCancel }) {
  const [text, setText] = useState('')
  const canConfirm = text.trim().toLowerCase() === 'delete'
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder='type "delete"'
        style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', color: SET_INK, minWidth: 180 }} />
      <button type="button" onClick={onCancel}
        style={{ padding: '8px 14px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        Cancel
      </button>
      <button type="button" onClick={onConfirm} disabled={!canConfirm}
        style={{ padding: '8px 14px', background: canConfirm ? '#991b1b' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: canConfirm ? 'pointer' : 'default' }}>
        Confirm delete
      </button>
    </div>
  )
}

// Settings-tab-scoped primitives (prefixed with "S" so they don't collide
// with any other helpers in this file if they're added later).
function SField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}
function SNum({ value, onChange, min, max, step = 1, placeholder }) {
  return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} min={min} max={max} step={step} placeholder={placeholder}
    style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: SET_INK, fontFamily: 'inherit' }} />
}
function SSelect({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: SET_INK, fontFamily: 'inherit' }}>
      <option value="">{placeholder || 'Select'}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
function SPill({ value, options, labels, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt) => {
        const active = String(value) === String(opt)
        return (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            style={{
              padding: '6px 12px',
              border: `1px solid ${active ? SET_R : '#d1d5db'}`,
              borderRadius: 999,
              background: active ? SET_R + '10' : '#fff',
              color: active ? SET_R : '#374151',
              fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
            }}>
            {labels?.[opt] || opt}
          </button>
        )
      })}
    </div>
  )
}
function SRow2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}
