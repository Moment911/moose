"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Loader2, LayoutGrid, Dumbbell, Utensils, TrendingUp, User,
  MessageCircle, ChevronDown, ChevronRight, Info, ExternalLink,
  Check, Camera, Printer, ShoppingBag, ChevronLeft, ChevronUp,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, ReferenceLine,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import {
  fetchMyPlan, logSet as apiLogSet, updateMyIntake, deleteMyAccount,
  adjustPlanNL,
} from '../../lib/trainer/myPlanFetch'
import MyPlanShell from '../../components/trainer/MyPlanShell'
import IntakeChatWidget from '../../components/trainer/IntakeChatWidget'
import TraineeDisclaimerAckModal from './TraineeDisclaimerAckModal'
import NoneOrText from '../../components/trainer/NoneOrText'
import {
  PRIMARY_GOALS,
  EQUIPMENT_ACCESS,
  DIETARY_PREFERENCES,
  OCCUPATION_ACTIVITIES,
} from '../../lib/trainer/intakeSchema'
import { feetInchesToCm, lbsToKg } from '../../lib/trainer/units'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 4 — Apple-style /my-plan athlete dashboard.
//
// Self-contained rewrite. All sub-components are defined inline in this file
// using the shared APPLE design tokens. Shared coach components (WorkoutAccordion,
// MealPlanTable, GroceryList) are NOT imported — this is an entirely new UX.
//
// Auth model unchanged: Supabase magic link → verifyTraineeSession.
// ─────────────────────────────────────────────────────────────────────────────

// ── Apple Design Tokens ─────────────────────────────────────────────────────

const A = {
  bg:       '#f5f5f7',
  card:     '#ffffff',
  cardAlt:  '#f9f9fb',
  ink:      '#1d1d1f',
  ink2:     '#424245',
  ink3:     '#86868b',
  accent:   '#0071e3',
  accentBg: 'rgba(0,113,227,0.06)',
  green:    '#34c759',
  greenBg:  'rgba(52,199,89,0.08)',
  red:      '#ff3b30',
  amber:    '#ff9f0a',
  border:   'rgba(0,0,0,0.06)',
  shadow1:  '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
  shadow2:  '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
  font:     "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', 'Segoe UI', sans-serif",
  mono:     "'SF Mono', 'Menlo', monospace",
  r:        16,
  rSm:      10,
  rPill:    999,
}

function useIsMobile() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setM(mq.matches)
    const h = (e) => setM(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

// ── Tabs ────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'home',      label: 'Home',      Icon: LayoutGrid },
  { key: 'coach',     label: 'Coach',     Icon: MessageCircle },
  { key: 'workouts',  label: 'Workouts',  Icon: Dumbbell },
  { key: 'meals',     label: 'Meals',     Icon: Utensils },
  { key: 'progress',  label: 'Progress',  Icon: TrendingUp },
  { key: 'profile',   label: 'Profile',   Icon: User },
]

// ── Main Page ───────────────────────────────────────────────────────────────

export default function MyPlanPage() {
  const [sessionState, setSessionState] = useState({ loading: true, user: null })
  const [planState, setPlanState] = useState({ loading: true, error: null, data: null })
  const [tab, setTab] = useState('home')
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const isMobile = useIsMobile()

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
    return () => { cancelled = true; sub?.subscription?.unsubscribe?.() }
  }, [])

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
    if (sessionState.loading || !sessionState.user) return
    loadPlan()
  }, [sessionState.loading, sessionState.user, loadPlan])

  // Disclaimer gate
  const shouldShowDisclaimer = useMemo(() => {
    if (!planState.data || !sessionState.user) return null
    const dbAck = planState.data?.invite?.disclaimer_ack_at
    const metaAck = sessionState.user?.user_metadata?.trainer_disclaimer_ack_at
    return !(dbAck || metaAck)
  }, [planState.data, sessionState.user])

  useEffect(() => {
    if (shouldShowDisclaimer !== null) setShowDisclaimer(shouldShowDisclaimer)
  }, [shouldShowDisclaimer])

  async function handleDisclaimerAcked() {
    const { data } = await supabase.auth.getSession()
    setSessionState({ loading: false, user: data?.session?.user ?? null })
    setShowDisclaimer(false)
  }

  // Log-set callback
  const handleLogSet = useCallback(async (payload) => {
    if (!planState.data?.plan?.id) return
    try {
      await apiLogSet({ plan_id: planState.data.plan.id, ...payload })
      await loadPlan()
    } catch (e) {
      console.error('[MyPlan] log_set failed:', e?.message)
    }
  }, [planState.data, loadPlan])

  // ── Render paths ──────────────────────────────────────────────────────────

  if (sessionState.loading || (sessionState.user && planState.loading)) {
    return (
      <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: A.font }}>
        <Loader2 size={24} style={{ color: A.ink3, animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!sessionState.user) {
    return <Navigate to="/login" replace state={{ from: '/my-plan' }} />
  }

  if (planState.error) {
    const isNotFound = planState.error?.status === 404 || planState.error?.status === 401
    return (
      <MyPlanShell agency={null}>
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: A.ink, letterSpacing: '-0.02em' }}>
            {isNotFound ? 'No plan on file' : 'Something went wrong'}
          </h2>
          <p style={{ margin: 0, color: A.ink3, fontSize: 15, lineHeight: 1.6 }}>
            {isNotFound
              ? "Your coach hasn't invited you yet, or the invitation has been revoked."
              : planState.error?.message || 'Please try again in a moment.'}
          </p>
        </div>
      </MyPlanShell>
    )
  }

  const { plan, logs, trainee, agency } = planState.data || {}

  // Auto-navigate new users to Coach tab for onboarding
  useEffect(() => {
    if (!plan && trainee && tab !== 'coach') setTab('coach')
  }, [plan, trainee])

  if (!plan && tab !== 'coach') {
    // While waiting for auto-nav, show nothing jarring
  }

  return (
    <MyPlanShell agency={agency} hasMobileTabBar={isMobile}>
      {showDisclaimer && <TraineeDisclaimerAckModal onAcked={handleDisclaimerAcked} />}

      {/* Desktop top tabs */}
      {!isMobile && (
        <nav className="no-print" style={{
          display: 'flex', gap: 4, padding: '16px 0 0',
          borderBottom: `1px solid ${A.border}`, marginBottom: 24,
        }}>
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key
            return (
              <button key={key} type="button" onClick={() => setTab(key)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${active ? A.ink : 'transparent'}`,
                color: active ? A.ink : A.ink3,
                fontSize: 14, fontWeight: active ? 600 : 500,
                cursor: 'pointer', fontFamily: A.font,
                transition: 'color .15s, border-color .15s',
              }}>
                <Icon size={16} strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </button>
            )
          })}
        </nav>
      )}

      {/* Mobile header */}
      {isMobile && (
        <div style={{ padding: '20px 0 16px' }}>
          <GreetingHeader trainee={trainee} />
        </div>
      )}

      {/* Tab content */}
      <div style={{ paddingTop: isMobile ? 0 : 0 }}>
        {tab === 'home' && (
          <OverviewTab
            trainee={trainee}
            plan={plan}
            logs={logs || []}
            isMobile={isMobile}
            onAfterAdjust={loadPlan}
            onGotoTab={setTab}
            onRefresh={loadPlan}
          />
        )}
        {tab === 'coach' && (
          <CoachTab
            trainee={trainee}
            plan={plan}
            onFieldsUpdate={async (fields) => {
              // Save extracted fields to trainee row
              if (fields && Object.keys(fields).length > 0) {
                try { await updateMyIntake(fields); await loadPlan() } catch {}
              }
            }}
            onRefresh={loadPlan}
          />
        )}
        {tab === 'workouts' && (
          <WorkoutsTab
            plan={plan}
            logs={logs || []}
            onLogSet={handleLogSet}
            isMobile={isMobile}
          />
        )}
        {tab === 'meals' && (
          <MealsTab
            plan={plan}
            traineeId={trainee?.id}
            isMobile={isMobile}
          />
        )}
        {tab === 'progress' && (
          <ProgressTab
            plan={plan}
            logs={logs || []}
            traineeId={trainee?.id}
            isMobile={isMobile}
            onRefresh={loadPlan}
          />
        )}
        {tab === 'profile' && (
          <ProfileTab trainee={trainee} onAfterChange={loadPlan} />
        )}
      </div>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <nav className="no-print" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: 56,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderTop: `0.5px solid ${A.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          zIndex: 50,
        }}>
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key
            return (
              <button key={key} type="button" onClick={() => setTab(key)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, padding: '6px 0', background: 'transparent', border: 'none',
                color: active ? A.accent : A.ink3,
                fontSize: 10, fontWeight: active ? 600 : 500,
                cursor: 'pointer', fontFamily: A.font,
                minWidth: 56,
              }}>
                <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>
      )}
    </MyPlanShell>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  SHARED PRIMITIVES
// ═════════════════════════════════════════════════════════════════════════════

function Card({ children, style, className }) {
  return (
    <div className={className} style={{
      background: A.card,
      borderRadius: A.r,
      boxShadow: A.shadow1,
      padding: 20,
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 600, color: A.ink3,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function GreetingHeader({ trainee }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = trainee?.full_name?.split(' ')[0] || ''
  return (
    <div>
      <div style={{ fontSize: 15, color: A.ink3, fontWeight: 500, marginBottom: 2 }}>
        {greeting}
      </div>
      <h1 style={{
        margin: 0, fontSize: 34, fontWeight: 700, color: A.ink,
        letterSpacing: '-0.02em', lineHeight: 1.1, fontFamily: A.font,
      }}>
        {firstName || 'Your plan'}
      </h1>
    </div>
  )
}

function EmptyCard({ label }) {
  return (
    <Card style={{ textAlign: 'center', padding: '40px 20px', color: A.ink3 }}>
      <p style={{ margin: 0, fontSize: 15 }}>{label}</p>
    </Card>
  )
}

function MacroPill({ label, value, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', background: color + '12',
      borderRadius: A.rPill, fontSize: 12, fontWeight: 600,
      color: color || A.ink2,
    }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{value}</span>
    </span>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  OVERVIEW TAB
// ═════════════════════════════════════════════════════════════════════════════

function OverviewTab({ trainee, plan, logs, isMobile, onAfterAdjust, onGotoTab, onRefresh }) {
  const hasWorkout = !!plan?.workout_plan
  const hasMeals = !!plan?.meal_plan

  // 7-day streak: count days with at least one workout log
  const streakDays = useMemo(() => {
    const s = new Set()
    for (const log of logs) {
      const d = log.session_logged_at || log.logged_at || log.created_at
      if (d) s.add(new Date(d).toISOString().slice(0, 10))
    }
    const result = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      const dayLabel = d.toLocaleDateString([], { weekday: 'short' }).slice(0, 1)
      result.push({ key, label: dayLabel, active: s.has(key) })
    }
    return result
  }, [logs])

  // Roadmap phases
  const roadmap = plan?.roadmap
  const currentPhaseNum = (() => {
    const ref = plan?.phase_ref
    if (typeof ref === 'number') return ref
    if (typeof ref === 'string' && ref.startsWith('phase_')) {
      const n = Number(ref.replace('phase_', ''))
      return Number.isFinite(n) ? n : 1
    }
    return 1
  })()

  // Update prompts — computed from log staleness
  const prompts = useMemo(() => {
    const items = []
    // Check if no plan yet — prompt to chat
    if (!plan) {
      items.push({ key: 'onboard', text: 'Complete your profile to get a custom plan', cta: 'Start chat', tab: 'coach' })
      return items
    }
    return items
  }, [plan])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Greeting (desktop only — mobile has it in header) */}
      {!isMobile && <GreetingHeader trainee={trainee} />}

      {/* Update prompts */}
      {prompts.map((p) => (
        <button key={p.key} type="button" onClick={() => onGotoTab(p.tab)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: A.r, cursor: 'pointer', textAlign: 'left',
          fontFamily: A.font, width: '100%',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>{p.text}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: A.accent, whiteSpace: 'nowrap' }}>{p.cta} →</span>
        </button>
      ))}

      {/* Today's snapshot */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: hasMeals ? '1fr 1fr' : '1fr', gap: 16 }}>
          {hasWorkout && (
            <button type="button" onClick={() => onGotoTab('workouts')} style={{
              background: A.accentBg, border: 'none', borderRadius: A.rSm,
              padding: 16, cursor: 'pointer', textAlign: 'left',
            }}>
              <Dumbbell size={20} color={A.accent} strokeWidth={1.75} />
              <div style={{ marginTop: 8, fontSize: 17, fontWeight: 600, color: A.ink, letterSpacing: '-0.01em' }}>
                Today&apos;s workout
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: A.ink3 }}>
                Tap to log your session
              </div>
            </button>
          )}
          {hasMeals && (
            <button type="button" onClick={() => onGotoTab('meals')} style={{
              background: A.greenBg, border: 'none', borderRadius: A.rSm,
              padding: 16, cursor: 'pointer', textAlign: 'left',
            }}>
              <Utensils size={20} color={A.green} strokeWidth={1.75} />
              <div style={{ marginTop: 8, fontSize: 17, fontWeight: 600, color: A.ink, letterSpacing: '-0.01em' }}>
                Meal plan
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: A.ink3 }}>
                Log meals &amp; snap photos
              </div>
            </button>
          )}
        </div>
      </Card>

      {/* 7-day streak */}
      <Card style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: A.ink }}>This week</span>
          <span style={{ fontSize: 13, color: A.ink3 }}>
            {streakDays.filter((d) => d.active).length} of 7 days
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {streakDays.map((d) => (
            <div key={d.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 999,
                background: d.active ? A.green : 'rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {d.active && <Check size={16} color="#fff" strokeWidth={2.5} />}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: d.active ? A.ink2 : A.ink3 }}>{d.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Roadmap progress */}
      {roadmap && (
        <Card>
          <SectionLabel>Development roadmap</SectionLabel>
          <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
            {[1, 2, 3].map((phase) => {
              const isActive = phase === currentPhaseNum
              const isDone = phase < currentPhaseNum
              return (
                <div key={phase} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 999,
                    background: isDone ? A.green : isActive ? A.accent : 'rgba(0,0,0,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: isDone || isActive ? '#fff' : A.ink3,
                  }}>
                    {isDone ? <Check size={14} strokeWidth={2.5} /> : phase}
                  </div>
                  <div style={{
                    marginTop: 6, fontSize: 12, fontWeight: isActive ? 600 : 500,
                    color: isActive ? A.ink : A.ink3, textAlign: 'center',
                  }}>
                    Phase {phase}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Progress bar */}
          <div style={{ marginTop: 12, height: 4, background: 'rgba(0,0,0,0.04)', borderRadius: 999 }}>
            <div style={{
              height: '100%', borderRadius: 999, background: A.accent,
              width: `${Math.min(100, ((currentPhaseNum - 1) / 2) * 100)}%`,
              transition: 'width .3s',
            }} />
          </div>
        </Card>
      )}

      {/* Baseline summary */}
      {plan.baseline && (
        <Card>
          <SectionLabel>Your baseline</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {plan.baseline.daily_calories && (
              <MiniStat label="Daily calories" value={plan.baseline.daily_calories} unit="kcal" />
            )}
            {plan.baseline.protein_g && (
              <MiniStat label="Protein" value={plan.baseline.protein_g} unit="g/day" />
            )}
            {plan.baseline.training_readiness && (
              <MiniStat label="Readiness" value={plan.baseline.training_readiness} />
            )}
          </div>
          {Array.isArray(plan.baseline.focus_areas) && plan.baseline.focus_areas.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: A.ink3, marginBottom: 6 }}>Focus areas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {plan.baseline.focus_areas.map((f, i) => (
                  <span key={i} style={{
                    padding: '5px 12px', background: A.accentBg,
                    borderRadius: A.rPill, fontSize: 13, fontWeight: 500, color: A.accent,
                  }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Natural adjust box */}
      {hasWorkout && <AdjustBox onAfterAdjust={onAfterAdjust} />}
    </div>
  )
}

function MiniStat({ label, value, unit }) {
  return (
    <div style={{ padding: '12px 14px', background: A.cardAlt, borderRadius: A.rSm }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: A.ink3, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: A.ink, fontFamily: A.font, letterSpacing: '-0.02em' }}>
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 500, color: A.ink3, marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}

// ── Intake Profile Card ─────────────────────────────────────────────────────
// Shows all fields extracted from the AI chat conversation.
// Always editable — fields are inline inputs that auto-save on blur.

function IntakeProfileCard({ trainee, onSaved }) {
  const [draft, setDraft] = useState(() => buildProfileDraft(trainee))
  const [saving, setSaving] = useState(false)
  const [saveNote, setSaveNote] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const dirty = useRef(false)

  // Re-seed when trainee updates upstream
  useEffect(() => { setDraft(buildProfileDraft(trainee)) }, [trainee])

  function set(key, value) {
    setDraft((d) => ({ ...d, [key]: value }))
    dirty.current = true
  }

  async function save() {
    if (!dirty.current) return
    setSaving(true); setSaveNote(null); setSaveError(null)
    try {
      const patch = {}
      if (draft.age !== '') patch.age = Number(draft.age)
      if (draft.sex) patch.sex = draft.sex
      if (draft.primary_goal) patch.primary_goal = draft.primary_goal
      if (draft.training_experience_years !== '') patch.training_experience_years = Number(draft.training_experience_years)
      if (draft.training_days_per_week !== '') patch.training_days_per_week = Number(draft.training_days_per_week)
      if (draft.equipment_access) patch.equipment_access = draft.equipment_access
      if (draft.dietary_preference) patch.dietary_preference = draft.dietary_preference
      if (draft.allergies) patch.allergies = draft.allergies
      if (draft.meals_per_day !== '') patch.meals_per_day = Number(draft.meals_per_day)
      if (draft.sleep_hours_avg !== '') patch.sleep_hours_avg = Number(draft.sleep_hours_avg)
      if (draft.stress_level !== '') patch.stress_level = Number(draft.stress_level)
      if (draft.medical_flags) patch.medical_flags = draft.medical_flags
      if (draft.injuries) patch.injuries = draft.injuries
      if (draft.about_you) patch.about_you = draft.about_you
      // Weight in lbs → kg
      if (draft.current_weight_lbs !== '') patch.current_weight_kg = Number(draft.current_weight_lbs) / 2.20462
      if (draft.target_weight_lbs !== '') patch.target_weight_kg = Number(draft.target_weight_lbs) / 2.20462
      // Height ft/in → cm
      const ft = Number(draft.height_ft) || 0
      const inches = Number(draft.height_in) || 0
      if (ft || inches) patch.height_cm = (ft * 12 + inches) * 2.54
      // Baseball fields
      if (draft.position_primary) patch.position_primary = draft.position_primary
      if (draft.throwing_hand) patch.throwing_hand = draft.throwing_hand
      if (draft.batting_hand) patch.batting_hand = draft.batting_hand
      if (draft.fastball_velo_peak !== '') patch.fastball_velo_peak = Number(draft.fastball_velo_peak)
      if (draft.fastball_velo_sit !== '') patch.fastball_velo_sit = Number(draft.fastball_velo_sit)
      if (draft.exit_velo !== '') patch.exit_velo = Number(draft.exit_velo)
      if (draft.sixty_time !== '') patch.sixty_time = Number(draft.sixty_time)
      if (draft.grad_year !== '') patch.grad_year = Number(draft.grad_year)
      if (draft.gpa !== '') patch.gpa = Number(draft.gpa)
      if (draft.club_team) patch.club_team = draft.club_team

      if (Object.keys(patch).length === 0) return
      await updateMyIntake(patch)
      dirty.current = false
      setSaveNote('Saved')
      setTimeout(() => setSaveNote(null), 2000)
      onSaved?.()
    } catch (e) {
      setSaveError(e?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  // Field definitions for display
  const fieldGroups = [
    {
      title: 'Basics',
      fields: [
        { key: 'age', label: 'Age', type: 'number', placeholder: 'yrs' },
        { key: 'sex', label: 'Sex', type: 'pills', options: ['M', 'F'], labels: { M: 'Male', F: 'Female' } },
        { key: 'height_ft', label: 'Height (ft)', type: 'number', placeholder: 'ft', half: true },
        { key: 'height_in', label: 'Height (in)', type: 'number', placeholder: 'in', half: true },
        { key: 'current_weight_lbs', label: 'Weight (lbs)', type: 'number', placeholder: 'lbs' },
        { key: 'target_weight_lbs', label: 'Target (lbs)', type: 'number', placeholder: 'lbs' },
        { key: 'primary_goal', label: 'Goal', type: 'pills', options: ['lose_fat', 'gain_muscle', 'maintain', 'performance'], labels: { lose_fat: 'Lose fat', gain_muscle: 'Gain muscle', maintain: 'Maintain', performance: 'Performance' } },
      ],
    },
    {
      title: 'Training',
      fields: [
        { key: 'training_experience_years', label: 'Experience (yrs)', type: 'number', placeholder: 'yrs' },
        { key: 'training_days_per_week', label: 'Days/week', type: 'number', placeholder: '0-7' },
        { key: 'equipment_access', label: 'Equipment', type: 'pills', options: ['none', 'bands', 'home_gym', 'full_gym'], labels: { none: 'None', bands: 'Bands', home_gym: 'Home gym', full_gym: 'Full gym' } },
      ],
    },
    {
      title: 'Nutrition & Recovery',
      fields: [
        { key: 'dietary_preference', label: 'Diet', type: 'text', placeholder: 'e.g. no restrictions' },
        { key: 'allergies', label: 'Allergies', type: 'text', placeholder: 'e.g. none' },
        { key: 'meals_per_day', label: 'Meals/day', type: 'number', placeholder: '3-6' },
        { key: 'sleep_hours_avg', label: 'Sleep (hrs)', type: 'number', placeholder: 'hrs' },
        { key: 'stress_level', label: 'Stress (1-10)', type: 'number', placeholder: '1-10' },
      ],
    },
    {
      title: 'Health',
      fields: [
        { key: 'medical_flags', label: 'Medical flags', type: 'text', placeholder: 'None' },
        { key: 'injuries', label: 'Injuries', type: 'text', placeholder: 'None' },
      ],
    },
    {
      title: 'Baseball',
      fields: [
        { key: 'position_primary', label: 'Position', type: 'text', placeholder: 'e.g. RHP, OF' },
        { key: 'throwing_hand', label: 'Throws', type: 'pills', options: ['R', 'L'], labels: { R: 'Right', L: 'Left' } },
        { key: 'batting_hand', label: 'Bats', type: 'pills', options: ['R', 'L', 'S'], labels: { R: 'Right', L: 'Left', S: 'Switch' } },
        { key: 'fastball_velo_peak', label: 'FB peak (mph)', type: 'number', placeholder: 'mph' },
        { key: 'fastball_velo_sit', label: 'FB sitting (mph)', type: 'number', placeholder: 'mph' },
        { key: 'exit_velo', label: 'Exit velo (mph)', type: 'number', placeholder: 'mph' },
        { key: 'sixty_time', label: '60-yard (s)', type: 'number', placeholder: 'sec' },
        { key: 'grad_year', label: 'Grad year', type: 'number', placeholder: '2028' },
        { key: 'gpa', label: 'GPA', type: 'number', placeholder: '0-4.0' },
        { key: 'club_team', label: 'Team', type: 'text', placeholder: 'Club or travel team' },
      ],
    },
  ]

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <SectionLabel>Your profile</SectionLabel>
        {saving && <Loader2 size={14} color={A.ink3} style={{ animation: 'spin 1s linear infinite' }} />}
        {saveNote && <span style={{ fontSize: 12, color: A.green, fontWeight: 600 }}>{saveNote}</span>}
        {saveError && <span style={{ fontSize: 12, color: A.red, fontWeight: 600 }}>{saveError}</span>}
      </div>

      {/* About you */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: A.ink3, marginBottom: 6 }}>About you</div>
        <textarea
          value={draft.about_you}
          onChange={(e) => set('about_you', e.target.value)}
          onBlur={save}
          rows={3}
          placeholder="Tell us about yourself, your goals, schedule..."
          style={{
            width: '100%', padding: '12px 14px', fontSize: 15,
            border: `1px solid ${A.border}`, borderRadius: A.rSm,
            background: A.cardAlt, color: A.ink, fontFamily: A.font,
            lineHeight: 1.5, resize: 'vertical', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Field sections */}
      {fieldGroups.map((group) => (
        <div key={group.title} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: A.ink3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {group.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {group.fields.map((field) => {
              if (field.type === 'pills') {
                return (
                  <div key={field.key} style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: A.ink3, marginBottom: 4 }}>{field.label}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {field.options.map((opt) => {
                        const active = String(draft[field.key]) === String(opt)
                        return (
                          <button key={opt} type="button" onClick={() => { set(field.key, opt); setTimeout(save, 50) }} style={{
                            padding: '8px 14px',
                            border: `1.5px solid ${active ? A.accent : A.border}`,
                            borderRadius: A.rPill,
                            background: active ? A.accentBg : A.card,
                            color: active ? A.accent : A.ink2,
                            fontSize: 13, fontWeight: active ? 600 : 500,
                            cursor: 'pointer', fontFamily: A.font,
                          }}>
                            {field.labels?.[opt] || opt}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              }
              return (
                <div key={field.key}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: A.ink3, marginBottom: 4 }}>{field.label}</div>
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    inputMode={field.type === 'number' ? 'decimal' : 'text'}
                    value={draft[field.key] ?? ''}
                    onChange={(e) => set(field.key, e.target.value)}
                    onBlur={save}
                    placeholder={field.placeholder}
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: 15, height: 42,
                      border: `1px solid ${A.border}`, borderRadius: 8,
                      background: A.cardAlt, color: A.ink, fontFamily: A.font,
                      fontWeight: 600, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Manual save button for good measure */}
      <button type="button" onClick={save} disabled={saving} style={{
        width: '100%', padding: '14px', marginTop: 4,
        background: saving ? A.ink3 : A.ink, color: '#fff',
        border: 'none', borderRadius: A.rSm,
        fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
        fontFamily: A.font,
      }}>
        {saving ? 'Saving...' : 'Save profile'}
      </button>
    </Card>
  )
}

function buildProfileDraft(t) {
  return {
    about_you: t?.about_you || '',
    age: t?.age ?? '',
    sex: normalizeSex(t?.sex),
    primary_goal: t?.primary_goal || '',
    training_experience_years: t?.training_experience_years ?? '',
    training_days_per_week: t?.training_days_per_week ?? '',
    equipment_access: t?.equipment_access || '',
    dietary_preference: t?.dietary_preference || '',
    allergies: t?.allergies || '',
    meals_per_day: t?.meals_per_day ?? '',
    sleep_hours_avg: t?.sleep_hours_avg ?? '',
    stress_level: t?.stress_level ?? '',
    medical_flags: t?.medical_flags || '',
    injuries: t?.injuries || '',
    height_ft: t?.height_cm ? String(Math.floor((t.height_cm / 2.54) / 12)) : '',
    height_in: t?.height_cm ? String(Math.round((t.height_cm / 2.54) % 12)) : '',
    current_weight_lbs: t?.current_weight_kg ? String(Math.round(t.current_weight_kg * 2.20462)) : '',
    target_weight_lbs: t?.target_weight_kg ? String(Math.round(t.target_weight_kg * 2.20462)) : '',
    position_primary: t?.position_primary || '',
    throwing_hand: t?.throwing_hand || '',
    batting_hand: t?.batting_hand || '',
    fastball_velo_peak: t?.fastball_velo_peak ?? '',
    fastball_velo_sit: t?.fastball_velo_sit ?? '',
    exit_velo: t?.exit_velo ?? '',
    sixty_time: t?.sixty_time ?? '',
    grad_year: t?.grad_year ?? '',
    gpa: t?.gpa ?? '',
    club_team: t?.club_team || t?.travel_team || '',
  }
}

function AdjustBox({ onAfterAdjust }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)

  async function handleSubmit(e) {
    e?.preventDefault?.()
    if (!message.trim() || sending) return
    setSending(true); setError(null); setNote(null)
    try {
      const res = await adjustPlanNL({ message: message.trim(), scope: 'rest_of_block' })
      setNote(res.adherence_note || 'Plan adjusted.')
      setMessage('')
      onAfterAdjust?.()
    } catch (err) {
      setError(err?.message || 'Adjust failed.')
    } finally { setSending(false) }
  }

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 600, color: A.ink, marginBottom: 4 }}>
        Something changed?
      </div>
      <div style={{ fontSize: 13, color: A.ink3, marginBottom: 12, lineHeight: 1.5 }}>
        Tell your AI coach and we&apos;ll adjust your plan. Injury, travel, schedule — anything.
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. I tweaked my shoulder..."
          disabled={sending}
          style={{
            flex: 1, padding: '12px 14px', fontSize: 15,
            border: `1px solid ${A.border}`, borderRadius: A.rSm,
            background: A.card, color: A.ink, fontFamily: A.font,
            outline: 'none',
          }}
        />
        <button type="submit" disabled={sending || !message.trim()} style={{
          padding: '12px 18px', background: sending ? A.ink3 : A.ink,
          color: '#fff', border: 'none', borderRadius: A.rSm,
          fontSize: 14, fontWeight: 600, cursor: sending ? 'default' : 'pointer',
          fontFamily: A.font, whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {sending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          {sending ? 'Updating' : 'Send'}
        </button>
      </form>
      {note && (
        <div style={{ marginTop: 10, padding: '10px 14px', background: A.greenBg, borderRadius: A.rSm, fontSize: 13, color: '#065f46' }}>
          {note}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 10, padding: '10px 14px', background: '#fee2e2', borderRadius: A.rSm, fontSize: 13, color: '#991b1b' }}>
          {error}
        </div>
      )}
    </Card>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  COACH TAB
// ═════════════════════════════════════════════════════════════════════════════

function CoachTab({ trainee, plan, onFieldsUpdate, onRefresh }) {
  const [extracted, setExtracted] = useState(() => {
    // Seed from trainee row so the chat knows what's already filled
    if (!trainee) return {}
    const t = trainee
    const seed = {}
    if (t.full_name) seed.full_name = t.full_name
    if (t.age) seed.age = t.age
    if (t.sex) seed.sex = t.sex
    if (t.height_cm) seed.height_cm = t.height_cm
    if (t.current_weight_kg) seed.current_weight_kg = t.current_weight_kg
    if (t.primary_goal) seed.primary_goal = t.primary_goal
    if (t.training_experience_years) seed.training_experience_years = t.training_experience_years
    if (t.training_days_per_week) seed.training_days_per_week = t.training_days_per_week
    if (t.equipment_access) seed.equipment_access = t.equipment_access
    if (t.medical_flags) seed.medical_flags = t.medical_flags
    if (t.injuries) seed.injuries = t.injuries
    if (t.dietary_preference) seed.dietary_preference = t.dietary_preference
    if (t.allergies) seed.allergies = t.allergies
    if (t.sleep_hours_avg) seed.sleep_hours_avg = t.sleep_hours_avg
    if (t.stress_level) seed.stress_level = t.stress_level
    if (t.occupation_activity) seed.occupation_activity = t.occupation_activity
    if (t.meals_per_day) seed.meals_per_day = t.meals_per_day
    return seed
  })

  const hasPlan = !!plan
  const mode = hasPlan ? 'coaching' : 'onboarding'

  function handleFieldsUpdate(fields) {
    setExtracted((prev) => ({ ...prev, ...fields }))
    onFieldsUpdate?.(fields)
  }

  function handleAboutYouAppend(text) {
    if (!text) return
    // Append to about_you via the intake update
    onFieldsUpdate?.({ about_you: ((trainee?.about_you || '') + ' ' + text).trim() })
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: A.ink, letterSpacing: '-0.02em' }}>
          {mode === 'onboarding' ? 'Let\u2019s get you set up' : 'Your AI Coach'}
        </h2>
      </div>
      {mode === 'onboarding' && (
        <div style={{ fontSize: 14, color: A.ink3, lineHeight: 1.5, marginTop: -8 }}>
          Answer a few questions so we can build your custom plan. Tap the buttons or type freely.
        </div>
      )}
      <div style={{
        borderRadius: A.r, overflow: 'hidden',
        boxShadow: A.shadow1, background: A.card,
        minHeight: 480,
      }}>
        <IntakeChatWidget
          extracted={extracted}
          onFieldsUpdate={handleFieldsUpdate}
          onAboutYouAppend={handleAboutYouAppend}
          userName={trainee?.full_name?.split(' ')[0] || ''}
          mode={mode}
        />
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  WORKOUTS TAB
// ═════════════════════════════════════════════════════════════════════════════

function WorkoutsTab({ plan, logs, onLogSet, isMobile }) {
  const [weekIdx, setWeekIdx] = useState(0)
  const [openSession, setOpenSession] = useState(null)

  const workoutPlan = plan?.workout_plan
  if (!workoutPlan) return <EmptyCard label="Your workout plan is being prepared." />

  const weeks = Array.isArray(workoutPlan.weeks) ? workoutPlan.weeks : []
  const activeWeek = weeks[weekIdx] || weeks[0] || { sessions: [] }

  // Index logs
  const logIndex = useMemo(() => {
    const m = new Map()
    for (const log of logs) {
      const k = `${log.session_day_number}|${log.exercise_id}|${log.set_number}`
      m.set(k, log)
    }
    return m
  }, [logs])

  // Count logged sets per session
  const sessionLogCounts = useMemo(() => {
    const counts = new Map()
    for (const log of logs) counts.set(log.session_day_number, (counts.get(log.session_day_number) || 0) + 1)
    return counts
  }, [logs])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: A.ink, letterSpacing: '-0.02em' }}>
            {workoutPlan.program_name || 'Workouts'}
          </h2>
          {workoutPlan.phase_ref && (
            <div style={{ marginTop: 2, fontSize: 13, color: A.ink3 }}>
              Block {workoutPlan.block_number ?? '—'} · {workoutPlan.phase_ref}
            </div>
          )}
        </div>
      </div>

      {/* Week segmented control */}
      {weeks.length > 1 && (
        <div style={{
          display: 'inline-flex', padding: 3,
          background: 'rgba(0,0,0,0.05)', borderRadius: A.rSm,
          alignSelf: 'flex-start',
        }}>
          {weeks.map((_, i) => {
            const active = i === weekIdx
            return (
              <button key={i} type="button" onClick={() => { setWeekIdx(i); setOpenSession(null) }} style={{
                padding: '8px 20px',
                background: active ? A.card : 'transparent',
                border: 'none', borderRadius: 7,
                color: active ? A.ink : A.ink3,
                fontSize: 14, fontWeight: active ? 600 : 500,
                cursor: 'pointer', fontFamily: A.font,
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
                Week {i + 1}
              </button>
            )
          })}
        </div>
      )}

      {/* Session cards */}
      {(activeWeek.sessions || []).map((session, si) => {
        const dayNum = session.day_number ?? si + 1
        const isOpen = openSession === dayNum
        const totalSets = (session.blocks || []).reduce((a, b) => a + (b.exercises || []).reduce((x, ex) => x + (Number(ex.sets) || 0), 0), 0)
        const loggedSets = sessionLogCounts.get(dayNum) || 0
        const pct = totalSets > 0 ? Math.min(100, Math.round((loggedSets / totalSets) * 100)) : 0
        const complete = pct >= 100

        return (
          <Card key={`${weekIdx}-${dayNum}`} style={{ padding: 0, overflow: 'hidden' }}>
            {/* Session header */}
            <button type="button" onClick={() => setOpenSession(isOpen ? null : dayNum)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '16px 20px',
              background: 'transparent', border: 'none',
              cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                {/* Completion ring */}
                <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                  <svg width={40} height={40} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={20} cy={20} r={17} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={3} />
                    <circle cx={20} cy={20} r={17} fill="none"
                      stroke={complete ? A.green : A.accent}
                      strokeWidth={3} strokeLinecap="round"
                      strokeDasharray={`${(pct / 100) * 106.8} 106.8`}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: complete ? A.green : A.ink2,
                  }}>
                    {complete ? <Check size={16} color={A.green} strokeWidth={2.5} /> : `${pct}%`}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: A.ink3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {session.day_label || `Day ${dayNum}`}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: A.ink, letterSpacing: '-0.01em', marginTop: 1 }}>
                    {session.session_name || 'Session'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {session.estimated_duration_min && (
                  <span style={{ fontSize: 13, color: A.ink3 }}>{session.estimated_duration_min} min</span>
                )}
                {isOpen
                  ? <ChevronUp size={18} color={A.ink3} />
                  : <ChevronDown size={18} color={A.ink3} />}
              </div>
            </button>

            {/* Expanded session */}
            {isOpen && (
              <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${A.border}` }}>
                {/* Warmup */}
                {Array.isArray(session.warmup) && session.warmup.length > 0 && (
                  <div style={{ padding: '14px 0 10px' }}>
                    <SectionLabel>Warm-up</SectionLabel>
                    <ul style={{ margin: 0, paddingLeft: 20, color: A.ink2, fontSize: 14, lineHeight: 1.6 }}>
                      {session.warmup.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}

                {/* Exercise blocks */}
                {Array.isArray(session.blocks) && session.blocks.map((block, bi) => (
                  <div key={bi} style={{ marginTop: bi === 0 && !session.warmup?.length ? 14 : 6 }}>
                    <SectionLabel>
                      {{ main_lift: 'Main Lift', accessory: 'Accessory', conditioning: 'Conditioning', mobility: 'Mobility' }[block.block_type] || block.block_type}
                    </SectionLabel>
                    {(block.exercises || []).map((ex, ei) => (
                      <ExerciseCard
                        key={ex.exercise_id || ei}
                        exercise={ex}
                        dayNum={dayNum}
                        logIndex={logIndex}
                        onLogSet={onLogSet}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>
                ))}

                {/* Cooldown */}
                {Array.isArray(session.cooldown) && session.cooldown.length > 0 && (
                  <div style={{ paddingTop: 10 }}>
                    <SectionLabel>Cool-down</SectionLabel>
                    <ul style={{ margin: 0, paddingLeft: 20, color: A.ink2, fontSize: 14, lineHeight: 1.6 }}>
                      {session.cooldown.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}

      {(!activeWeek.sessions || activeWeek.sessions.length === 0) && (
        <EmptyCard label="No sessions in this block." />
      )}
    </div>
  )
}

function ExerciseCard({ exercise, dayNum, logIndex, onLogSet, isMobile }) {
  const [showHowTo, setShowHowTo] = useState(false)
  const {
    exercise_id, name, sets = 0, target_reps, target_weight_kg_or_cue,
    rest_seconds, progression_rule, coaching_cue,
    performance_cues, common_mistakes, video_query,
  } = exercise

  const setRows = []
  for (let i = 1; i <= (Number(sets) || 0); i++) setRows.push(i)

  return (
    <div style={{
      background: A.cardAlt, borderRadius: A.rSm,
      padding: 16, marginBottom: 10,
    }}>
      {/* Exercise header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: A.ink, letterSpacing: '-0.01em' }}>{name}</div>
          <div style={{ fontSize: 13, color: A.ink3, marginTop: 2 }}>
            {sets} × {target_reps || '—'}
            {target_weight_kg_or_cue ? ` @ ${target_weight_kg_or_cue}` : ''}
            {rest_seconds ? ` · rest ${rest_seconds}s` : ''}
          </div>
        </div>
        <button type="button" onClick={() => setShowHowTo(!showHowTo)} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 10px', background: showHowTo ? A.accentBg : A.card,
          border: `1px solid ${showHowTo ? A.accent + '30' : A.border}`,
          borderRadius: 8, fontSize: 12, fontWeight: 600,
          color: showHowTo ? A.accent : A.ink3, cursor: 'pointer',
          flexShrink: 0,
        }}>
          <Info size={13} /> How to
        </button>
      </div>

      {coaching_cue && (
        <div style={{ marginTop: 6, fontSize: 13, color: A.ink3, fontStyle: 'italic' }}>{coaching_cue}</div>
      )}

      {/* How-to panel */}
      {showHowTo && (
        <div style={{
          marginTop: 10, padding: 14, background: A.card,
          border: `1px solid ${A.border}`, borderRadius: 8,
        }}>
          {Array.isArray(performance_cues) && performance_cues.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: A.ink3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                Performance cues
              </div>
              <ol style={{ margin: '0 0 10px', paddingLeft: 20, color: A.ink2, fontSize: 13, lineHeight: 1.5 }}>
                {performance_cues.map((c, i) => <li key={i}>{c}</li>)}
              </ol>
            </>
          )}
          {Array.isArray(common_mistakes) && common_mistakes.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: A.amber, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                Common mistakes
              </div>
              <ul style={{ margin: '0 0 10px', paddingLeft: 20, color: '#92400e', fontSize: 13, lineHeight: 1.5 }}>
                {common_mistakes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </>
          )}
          {video_query && (
            <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(video_query)}`}
              target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: A.accent, fontWeight: 600, textDecoration: 'none' }}>
              <ExternalLink size={13} /> Search how to: &ldquo;{video_query}&rdquo;
            </a>
          )}
        </div>
      )}

      {/* Set logging */}
      {setRows.length > 0 && (
        <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
          {setRows.map((sn) => (
            <SetStrip
              key={sn}
              setNumber={sn}
              dayNum={dayNum}
              exerciseId={exercise_id}
              exerciseName={name}
              existing={logIndex.get(`${dayNum}|${exercise_id}|${sn}`)}
              onLogSet={onLogSet}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}

      {progression_rule && (
        <div style={{ marginTop: 10, fontSize: 12, color: A.ink3 }}>
          <span style={{ fontWeight: 600, color: A.ink2 }}>Progression:</span> {progression_rule}
        </div>
      )}
    </div>
  )
}

function SetStrip({ setNumber, dayNum, exerciseId, exerciseName, existing, onLogSet, isMobile }) {
  const [weight, setWeight] = useState(existing?.actual_weight_kg ?? '')
  const [reps, setReps] = useState(existing?.actual_reps ?? '')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setWeight(existing?.actual_weight_kg ?? '')
    setReps(existing?.actual_reps ?? '')
    setDirty(false)
  }, [existing?.log_id, existing?.actual_weight_kg, existing?.actual_reps])

  async function commit() {
    if (!dirty || reps === '' || reps === null || !onLogSet) return
    setSaving(true)
    try {
      await onLogSet({
        session_day_number: dayNum,
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        set_number: setNumber,
        actual_weight_kg: weight === '' ? null : Number(weight),
        actual_reps: Number(reps),
        rpe: null,
        notes: null,
        existing_log_id: existing?.log_id || null,
      })
      setDirty(false)
    } finally { setSaving(false) }
  }

  const logged = !!existing

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10,
      padding: '8px 12px', background: A.card,
      border: `1px solid ${logged ? A.green + '30' : A.border}`,
      borderRadius: 10,
    }}>
      {/* Set badge */}
      <div style={{
        width: 28, height: 28, borderRadius: 999, flexShrink: 0,
        background: logged ? A.green : 'rgba(0,0,0,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
        color: logged ? '#fff' : A.ink3,
      }}>
        {logged ? <Check size={14} strokeWidth={2.5} /> : setNumber}
      </div>

      {/* Weight input */}
      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        value={weight}
        onChange={(e) => { setWeight(e.target.value); setDirty(true) }}
        onBlur={commit}
        placeholder="lbs"
        style={{
          width: isMobile ? 56 : 64, padding: '6px 4px',
          fontSize: 20, fontWeight: 600, textAlign: 'center',
          border: `1px solid ${A.border}`, borderRadius: 8,
          background: A.card, color: A.ink, fontFamily: A.font,
          outline: 'none',
        }}
      />

      <span style={{ fontSize: 16, color: A.ink3, fontWeight: 500 }}>×</span>

      {/* Reps input */}
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={reps}
        onChange={(e) => { setReps(e.target.value); setDirty(true) }}
        onBlur={commit}
        placeholder="reps"
        style={{
          width: isMobile ? 48 : 56, padding: '6px 4px',
          fontSize: 20, fontWeight: 600, textAlign: 'center',
          border: `1px solid ${A.border}`, borderRadius: 8,
          background: A.card, color: A.ink, fontFamily: A.font,
          outline: 'none',
        }}
      />

      {/* Status */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {saving && <Loader2 size={16} color={A.ink3} style={{ animation: 'spin 1s linear infinite' }} />}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  MEALS TAB
// ═════════════════════════════════════════════════════════════════════════════

function MealsTab({ plan, traineeId, isMobile }) {
  const mealPlan = plan?.meal_plan
  const groceryList = plan?.grocery_list
  const [weekIdx, setWeekIdx] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [showGrocery, setShowGrocery] = useState(false)
  const [loggedKeys, setLoggedKeys] = useState(() => new Set())
  const [logState, setLogState] = useState({})
  const [loadingToday, setLoadingToday] = useState(false)
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [scanSuccess, setScanSuccess] = useState(null)

  // Auto-select today
  useEffect(() => {
    const raw = new Date().getDay()
    setSelectedDay(raw === 0 ? 6 : raw - 1)
  }, [])

  // Load today's logged meals
  const loadToday = useCallback(async () => {
    if (!traineeId) return
    setLoadingToday(true)
    try {
      const res = await fetch('/api/trainer/food-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_today', trainee_id: traineeId }),
      })
      if (!res.ok) return
      const data = await res.json()
      const next = new Set()
      for (const row of data.logs || []) {
        if (!row.notes) continue
        try {
          const parsed = JSON.parse(row.notes)
          if (parsed?.plan_key) next.add(parsed.plan_key)
        } catch { /* */ }
      }
      setLoggedKeys(next)
    } finally { setLoadingToday(false) }
  }, [traineeId])

  useEffect(() => { loadToday() }, [loadToday])

  if (!mealPlan) return <EmptyCard label="Your meal plan is being prepared." />

  const weeks = Array.isArray(mealPlan.weeks) ? mealPlan.weeks : []
  const activeWeek = weeks[weekIdx] || weeks[0] || { days: [] }
  const days = activeWeek.days || []
  const day = days[selectedDay] || days[0]
  const meals = day?.meals || []
  const macros = mealPlan.macro_daily_targets_g || {}

  function planKey(dayIdx, slot) {
    return `week:${weekIdx}|day:${dayIdx}|slot:${slot || 'meal'}`
  }

  async function toggleMealLog(meal, dayIdx) {
    if (!traineeId) return
    const slot = meal.slot || meal.meal_slot || 'meal'
    const key = planKey(dayIdx, slot)
    const isLogged = loggedKeys.has(key)
    setLogState((s) => ({ ...s, [key]: { logging: true } }))
    try {
      if (isLogged) {
        const res = await fetch('/api/trainer/food-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unlog_planned', trainee_id: traineeId, plan_key: key }),
        })
        if (res.ok) setLoggedKeys((prev) => { const n = new Set(prev); n.delete(key); return n })
      } else {
        const macrosData = meal.macros_per_serving || meal.macros || {}
        const items = [{
          name: meal.recipe_name || meal.name || 'Meal',
          kcal: Number(meal.kcal) || 0,
          protein_g: Number(macrosData.protein_g) || 0,
          fat_g: Number(macrosData.fat_g) || 0,
          carb_g: Number(macrosData.carb_g) || 0,
        }]
        const res = await fetch('/api/trainer/food-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'log_planned',
            trainee_id: traineeId,
            plan_key: key,
            items,
            servings_mult: 1,
            meal_name: meal.recipe_name || meal.name,
          }),
        })
        if (res.ok) setLoggedKeys((prev) => new Set(prev).add(key))
      }
    } finally {
      setLogState((s) => ({ ...s, [key]: { logging: false } }))
    }
  }

  async function handlePhotoScan(file) {
    if (!file || !traineeId) return
    if (!file.type.startsWith('image/')) { setScanError('Pick an image file.'); return }
    setUploading(true); setScanError(null); setScanSuccess(null)
    try {
      const reader = new FileReader()
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => {
          const s = String(reader.result || '')
          const i = s.indexOf(',')
          resolve(i >= 0 ? s.slice(i + 1) : s)
        }
        reader.onerror = () => reject(new Error('Could not read file'))
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/trainer/food-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_photo', trainee_id: traineeId, photo_base64: base64, photo_mime: file.type }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail || body?.error || `Scan failed (${res.status})`)
      }
      const data = await res.json()
      const items = data?.items || data?.logged?.items || []
      const totalKcal = items.reduce((a, it) => a + (Number(it.kcal) || 0), 0)
      setScanSuccess(`Logged ${items.length} item${items.length === 1 ? '' : 's'} · ${totalKcal} kcal`)
      await loadToday()
    } catch (e) {
      setScanError(e.message || 'Scan failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const dayIdx = selectedDay ?? 0

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: A.ink, letterSpacing: '-0.02em' }}>
          Meals
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Photo scan */}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={(e) => handlePhotoScan(e.target.files?.[0])} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="no-print"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px', background: A.ink, color: '#fff',
              border: 'none', borderRadius: A.rSm,
              fontSize: 14, fontWeight: 600, cursor: uploading ? 'wait' : 'pointer',
              fontFamily: A.font,
            }}>
            {uploading
              ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              : <Camera size={16} strokeWidth={1.75} />}
            {uploading ? 'Scanning' : 'Snap food'}
          </button>
          {/* Print */}
          <button type="button" onClick={() => window.print()}
            className="no-print"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px', background: A.card, color: A.ink2,
              border: `1px solid ${A.border}`, borderRadius: A.rSm,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: A.font,
            }}>
            <Printer size={16} strokeWidth={1.75} /> Print
          </button>
        </div>
      </div>

      {/* Scan feedback */}
      {scanError && (
        <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: A.rSm, fontSize: 13, color: '#991b1b' }}>
          {scanError}
        </div>
      )}
      {scanSuccess && (
        <div style={{ padding: '10px 14px', background: A.greenBg, borderRadius: A.rSm, fontSize: 13, color: '#065f46' }}>
          {scanSuccess}
        </div>
      )}

      {/* Daily macro targets */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {mealPlan.calorie_daily_target_kcal && <MacroPill label="Cal" value={`${mealPlan.calorie_daily_target_kcal}`} color="#0f172a" />}
        {macros.protein_g && <MacroPill label="P" value={`${macros.protein_g}g`} color="#2563eb" />}
        {macros.carb_g && <MacroPill label="C" value={`${macros.carb_g}g`} color="#059669" />}
        {macros.fat_g && <MacroPill label="F" value={`${macros.fat_g}g`} color="#d97706" />}
      </div>

      {/* Week selector */}
      {weeks.length > 1 && (
        <div style={{
          display: 'inline-flex', padding: 3,
          background: 'rgba(0,0,0,0.05)', borderRadius: A.rSm,
          alignSelf: 'flex-start',
        }}>
          {weeks.map((_, i) => {
            const active = i === weekIdx
            return (
              <button key={i} type="button" onClick={() => { setWeekIdx(i); setSelectedDay(0) }} style={{
                padding: '8px 20px', background: active ? A.card : 'transparent',
                border: 'none', borderRadius: 7,
                color: active ? A.ink : A.ink3,
                fontSize: 14, fontWeight: active ? 600 : 500,
                cursor: 'pointer', fontFamily: A.font,
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
                Week {i + 1}
              </button>
            )
          })}
        </div>
      )}

      {/* Day selector pills */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        {days.map((d, di) => {
          const active = di === dayIdx
          const todayIdx = (() => { const raw = new Date().getDay(); return raw === 0 ? 6 : raw - 1 })()
          const isToday = di === todayIdx
          return (
            <button key={di} type="button" onClick={() => setSelectedDay(di)}
              className="no-print"
              style={{
                padding: '8px 14px', flexShrink: 0,
                background: active ? A.ink : A.card,
                color: active ? '#fff' : A.ink2,
                border: `1px solid ${active ? A.ink : A.border}`,
                borderRadius: A.rPill,
                fontSize: 13, fontWeight: active ? 600 : 500,
                cursor: 'pointer', fontFamily: A.font,
                whiteSpace: 'nowrap',
              }}>
              {d.day_label || `Day ${di + 1}`}
              {isToday && !active ? ' ·' : ''}
            </button>
          )
        })}
      </div>

      {/* Meal cards */}
      <div className="print-meals" style={{ display: 'grid', gap: 10 }}>
        {meals.map((meal, mi) => {
          const slot = meal.slot || meal.meal_slot || 'meal'
          const key = planKey(dayIdx, slot)
          const isLogged = loggedKeys.has(key)
          const busy = !!logState[key]?.logging
          const mealMacros = meal.macros_per_serving || meal.macros || {}

          return (
            <Card key={mi} style={{
              padding: 0, overflow: 'hidden',
              borderLeft: isLogged ? `3px solid ${A.green}` : '3px solid transparent',
            }}>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: A.ink3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      {capitalize(slot)}
                    </div>
                    <button type="button" onClick={() => setSelectedMeal(meal)} style={{
                      background: 'none', border: 'none', padding: 0,
                      fontSize: 17, fontWeight: 600, color: A.ink,
                      cursor: 'pointer', textAlign: 'left', fontFamily: A.font,
                      letterSpacing: '-0.01em',
                    }}>
                      {meal.recipe_name || meal.name || 'Meal'}
                    </button>
                    <div style={{ marginTop: 4, fontSize: 13, color: A.ink3 }}>
                      {Number(meal.prep_minutes || 0) + Number(meal.cook_minutes || 0)} min
                      {meal.kcal ? ` · ${meal.kcal} kcal` : ''}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {mealMacros.protein_g && <MacroPill label="P" value={`${mealMacros.protein_g}g`} color="#2563eb" />}
                      {mealMacros.carb_g && <MacroPill label="C" value={`${mealMacros.carb_g}g`} color="#059669" />}
                      {mealMacros.fat_g && <MacroPill label="F" value={`${mealMacros.fat_g}g`} color="#d97706" />}
                    </div>
                  </div>

                  {/* Log toggle */}
                  <button type="button" onClick={() => toggleMealLog(meal, dayIdx)}
                    disabled={busy} className="no-print"
                    style={{
                      width: 44, height: 44, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 999, cursor: busy ? 'wait' : 'pointer',
                      background: isLogged ? A.green : 'rgba(0,0,0,0.04)',
                      border: `2px solid ${isLogged ? A.green : 'rgba(0,0,0,0.1)'}`,
                      transition: 'all .15s',
                    }}>
                    {busy
                      ? <Loader2 size={18} color={isLogged ? '#fff' : A.ink3} style={{ animation: 'spin 1s linear infinite' }} />
                      : isLogged ? <Check size={20} color="#fff" strokeWidth={2.5} /> : null}
                  </button>
                </div>
              </div>
            </Card>
          )
        })}
        {meals.length === 0 && (
          <EmptyCard label="No meals planned for this day." />
        )}
      </div>

      {/* Grocery list section */}
      {groceryList && (
        <div className="print-grocery">
          <button type="button" onClick={() => setShowGrocery(!showGrocery)}
            className="no-print"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '14px 18px', background: A.card, border: `1px solid ${A.border}`,
              borderRadius: A.r, cursor: 'pointer', textAlign: 'left',
              boxShadow: A.shadow1, fontFamily: A.font,
            }}>
            <ShoppingBag size={18} color={A.ink2} />
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: A.ink }}>
              Grocery list
              <span style={{ fontWeight: 400, color: A.ink3, marginLeft: 6, fontSize: 13 }}>
                {(groceryList.organized_by_aisle || []).reduce((a, aisle) => a + (aisle.items?.length || 0), 0)} items
                {groceryList.estimated_total_usd ? ` · $${Number(groceryList.estimated_total_usd).toFixed(0)}` : ''}
              </span>
            </span>
            {showGrocery ? <ChevronUp size={18} color={A.ink3} /> : <ChevronDown size={18} color={A.ink3} />}
          </button>

          {showGrocery && (
            <GrocerySection groceryList={groceryList} />
          )}
        </div>
      )}

      {/* Recipe detail modal */}
      {selectedMeal && (
        <RecipeModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}

      {/* Print styles for meals */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-meals > div { break-inside: avoid; box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          .print-grocery { break-before: page; }
        }
      `}</style>
    </div>
  )
}

function GrocerySection({ groceryList }) {
  const [checked, setChecked] = useState({})
  const aisles = Array.isArray(groceryList.organized_by_aisle) ? groceryList.organized_by_aisle : []

  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
      {aisles.map((aisle) => {
        const name = aisle.aisle || aisle.name || 'Other'
        const items = Array.isArray(aisle.items) ? aisle.items : []
        return (
          <Card key={name} style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '12px 16px', background: A.cardAlt,
              borderBottom: `1px solid ${A.border}`,
              fontSize: 14, fontWeight: 600, color: A.ink,
            }}>
              {name}
              <span style={{ marginLeft: 6, fontSize: 12, color: A.ink3 }}>{items.length}</span>
            </div>
            <div>
              {items.map((it, i) => {
                const k = `${name}|${it.item || i}`
                const done = !!checked[k]
                return (
                  <label key={k} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 16px', cursor: 'pointer',
                    borderTop: i > 0 ? `1px solid ${A.border}` : 'none',
                    opacity: done ? 0.5 : 1,
                  }}>
                    <input type="checkbox" checked={done}
                      onChange={() => setChecked((p) => ({ ...p, [k]: !p[k] }))}
                      className="no-print"
                      style={{ margin: 0, width: 18, height: 18, accentColor: A.green }} />
                    <span style={{
                      flex: 1, fontSize: 14, fontWeight: 500, color: A.ink,
                      textDecoration: done ? 'line-through' : 'none',
                    }}>
                      {it.item}
                    </span>
                    <span style={{ fontSize: 13, color: A.ink3 }}>
                      {it.total_amount ?? ''}{it.unit ? ` ${it.unit}` : ''}
                    </span>
                  </label>
                )
              })}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function RecipeModal({ meal, onClose }) {
  const macros = meal.macros_per_serving || meal.macros || {}
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: 0,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: A.card, borderRadius: '20px 20px 0 0',
        padding: '24px 20px', width: '100%', maxWidth: 680,
        maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
        fontFamily: A.font,
      }}>
        {/* Handle bar */}
        <div style={{ width: 36, height: 4, background: 'rgba(0,0,0,0.15)', borderRadius: 999, margin: '0 auto 16px' }} />

        <h3 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: A.ink, letterSpacing: '-0.02em' }}>
          {meal.recipe_name || meal.name}
        </h3>
        <div style={{ fontSize: 14, color: A.ink3, marginBottom: 14 }}>
          Prep {meal.prep_minutes ?? 0} min · Cook {meal.cook_minutes ?? 0} min
          {meal.servings ? ` · ${meal.servings} servings` : ''}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {meal.kcal && <MacroPill label="Cal" value={meal.kcal} color="#0f172a" />}
          {macros.protein_g && <MacroPill label="Protein" value={`${macros.protein_g}g`} color="#2563eb" />}
          {macros.carb_g && <MacroPill label="Carbs" value={`${macros.carb_g}g`} color="#059669" />}
          {macros.fat_g && <MacroPill label="Fat" value={`${macros.fat_g}g`} color="#d97706" />}
        </div>

        {Array.isArray(meal.ingredients) && meal.ingredients.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SectionLabel>Ingredients</SectionLabel>
            <ul style={{ margin: 0, paddingLeft: 20, color: A.ink2, fontSize: 14, lineHeight: 1.7 }}>
              {meal.ingredients.map((ing, i) => (
                <li key={i}>
                  {typeof ing === 'string'
                    ? ing
                    : `${ing.amount || ''}${ing.unit ? ' ' + ing.unit : ''} ${ing.item || ing.name || ''}`.trim()}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(meal.instructions_short || meal.instructions) && (
          <div style={{ marginBottom: 18 }}>
            <SectionLabel>Instructions</SectionLabel>
            <p style={{ margin: 0, color: A.ink2, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {meal.instructions_short || meal.instructions}
            </p>
          </div>
        )}

        <button type="button" onClick={onClose} style={{
          width: '100%', padding: '14px', background: A.cardAlt,
          border: 'none', borderRadius: A.rSm,
          fontSize: 16, fontWeight: 600, color: A.ink2,
          cursor: 'pointer', fontFamily: A.font,
        }}>
          Close
        </button>
      </div>
    </div>
  )
}

function capitalize(s) {
  if (!s || typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

// ═════════════════════════════════════════════════════════════════════════════
//  PROGRESS TAB
// ═════════════════════════════════════════════════════════════════════════════

function ProgressTab({ plan, logs, traineeId, isMobile, onRefresh }) {
  const [weightInput, setWeightInput] = useState('')
  const [logging, setLogging] = useState(false)
  const [progressData, setProgressData] = useState(null)
  const [loadingProgress, setLoadingProgress] = useState(true)

  // Load progress history
  useEffect(() => {
    if (!traineeId) return
    let cancelled = false
    async function load() {
      setLoadingProgress(true)
      try {
        const res = await fetch('/api/trainer/my-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_progress_history' }),
        })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setProgressData(data)
        }
      } catch { /* */ }
      finally { if (!cancelled) setLoadingProgress(false) }
    }
    load()
    return () => { cancelled = true }
  }, [traineeId])

  async function handleLogWeight() {
    if (!weightInput || !traineeId) return
    setLogging(true)
    try {
      const weightKg = Number(weightInput) / 2.20462
      const res = await fetch('/api/trainer/my-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log_progress', weight_kg: weightKg }),
      })
      if (res.ok) {
        setWeightInput('')
        // Reload progress
        const res2 = await fetch('/api/trainer/my-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_progress_history' }),
        })
        if (res2.ok) setProgressData(await res2.json())
      }
    } finally { setLogging(false) }
  }

  // Build chart data from logs
  const volumeData = useMemo(() => {
    if (!logs || logs.length === 0) return []
    const byDate = new Map()
    for (const log of logs) {
      const d = (log.session_logged_at || log.logged_at || log.created_at || '').slice(0, 10)
      if (!d) continue
      const vol = (Number(log.actual_weight_kg) || 0) * (Number(log.actual_reps) || 0)
      byDate.set(d, (byDate.get(d) || 0) + vol)
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, volume]) => ({
        date: date.slice(5), // MM-DD
        volume: Math.round(volume * 2.20462), // convert to lbs
      }))
  }, [logs])

  const weightData = useMemo(() => {
    if (!progressData?.weight_history) return []
    return progressData.weight_history.map((w) => ({
      date: (w.checked_in_at || w.created_at || '').slice(5, 10),
      weight: Math.round(w.weight_kg * 2.20462),
    }))
  }, [progressData])

  // Adherence
  const adherenceData = useMemo(() => {
    if (!plan?.workout_plan) return null
    const weeks = plan.workout_plan.weeks || []
    const totalSessions = weeks.reduce((a, w) => a + (w.sessions?.length || 0), 0)
    const loggedDays = new Set()
    for (const log of logs) {
      if (log.session_day_number) loggedDays.add(log.session_day_number)
    }
    return {
      logged: loggedDays.size,
      total: totalSessions,
      pct: totalSessions > 0 ? Math.round((loggedDays.size / totalSessions) * 100) : 0,
    }
  }, [plan, logs])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: A.ink, letterSpacing: '-0.02em' }}>
        Progress
      </h2>

      {/* Weight check-in */}
      <Card>
        <SectionLabel>Body weight check-in</SectionLabel>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="number"
            inputMode="decimal"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder="Weight in lbs"
            style={{
              flex: 1, padding: '12px 14px', fontSize: 16,
              border: `1px solid ${A.border}`, borderRadius: A.rSm,
              background: A.card, color: A.ink, fontFamily: A.font,
              outline: 'none',
            }}
          />
          <button type="button" onClick={handleLogWeight} disabled={logging || !weightInput}
            style={{
              padding: '12px 20px', background: logging ? A.ink3 : A.ink,
              color: '#fff', border: 'none', borderRadius: A.rSm,
              fontSize: 14, fontWeight: 600, cursor: logging ? 'default' : 'pointer',
              fontFamily: A.font, whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {logging && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Log weight
          </button>
        </div>
      </Card>

      {/* Body weight chart */}
      {weightData.length > 1 && (
        <Card>
          <SectionLabel>Body weight trend</SectionLabel>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: A.ink3 }} tickLine={false} axisLine={{ stroke: A.border }} />
                <YAxis tick={{ fontSize: 11, fill: A.ink3 }} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip
                  contentStyle={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 8, fontSize: 13, fontFamily: A.font }}
                  formatter={(v) => [`${v} lbs`, 'Weight']}
                />
                <Line type="monotone" dataKey="weight" stroke={A.accent} strokeWidth={2.5} dot={{ r: 4, fill: A.accent }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Lift volume chart */}
      {volumeData.length > 1 && (
        <Card>
          <SectionLabel>Training volume</SectionLabel>
          <div style={{ fontSize: 12, color: A.ink3, marginBottom: 12 }}>Total weight × reps per session (lbs)</div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: A.ink3 }} tickLine={false} axisLine={{ stroke: A.border }} />
                <YAxis tick={{ fontSize: 11, fill: A.ink3 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 8, fontSize: 13, fontFamily: A.font }}
                  formatter={(v) => [`${v.toLocaleString()} lbs`, 'Volume']}
                />
                <Bar dataKey="volume" fill={A.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Adherence */}
      {adherenceData && (
        <Card>
          <SectionLabel>Workout adherence</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              position: 'relative', width: 72, height: 72, flexShrink: 0,
            }}>
              <svg width={72} height={72} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={36} cy={36} r={30} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={6} />
                <circle cx={36} cy={36} r={30} fill="none"
                  stroke={adherenceData.pct >= 80 ? A.green : adherenceData.pct >= 40 ? A.amber : A.red}
                  strokeWidth={6} strokeLinecap="round"
                  strokeDasharray={`${(adherenceData.pct / 100) * 188.5} 188.5`}
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, color: A.ink, fontFamily: A.font,
              }}>
                {adherenceData.pct}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: A.ink }}>
                {adherenceData.logged} of {adherenceData.total} sessions
              </div>
              <div style={{ fontSize: 13, color: A.ink3, marginTop: 4 }}>
                {adherenceData.pct >= 80 ? 'Great consistency!' :
                 adherenceData.pct >= 40 ? 'Keep showing up.' :
                 'Let\'s get more sessions in.'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {volumeData.length <= 1 && weightData.length <= 1 && !adherenceData && (
        <EmptyCard label="Start logging workouts and weigh-ins to see your progress here." />
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  SETTINGS TAB
// ═════════════════════════════════════════════════════════════════════════════

function ProfileTab({ trainee, onAfterChange }) {
  const [draft, setDraft] = useState(() => seedDraft(trainee))
  const [saving, setSaving] = useState(false)
  const [saveNote, setSaveNote] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [deleteStage, setDeleteStage] = useState('idle')
  const [deleteError, setDeleteError] = useState(null)

  useEffect(() => { setDraft(seedDraft(trainee)) }, [trainee])

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
    setSaving(true); setSaveNote(null); setSaveError(null)
    try {
      await updateMyIntake(buildPatch())
      setSaveNote('Saved.')
      onAfterChange?.()
    } catch (e) { setSaveError(e?.message || 'Save failed.') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleteStage('deleting'); setDeleteError(null)
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
    <div style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: A.ink, letterSpacing: '-0.02em' }}>
        Profile
      </h2>

      {/* About you */}
      <Card>
        <SectionLabel>About you</SectionLabel>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: A.ink3, lineHeight: 1.5 }}>
          This shapes every AI-generated plan. Edit it any time.
        </p>
        <textarea
          value={draft.about_you}
          onChange={(e) => set('about_you', e.target.value)}
          rows={5}
          style={{
            width: '100%', padding: '12px 14px', fontSize: 15,
            border: `1px solid ${A.border}`, borderRadius: A.rSm,
            fontFamily: A.font, lineHeight: 1.5, color: A.ink,
            background: A.card, resize: 'vertical', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </Card>

      {/* Basics */}
      <Card>
        <SectionLabel>Basics</SectionLabel>
        <div style={{ display: 'grid', gap: 14 }}>
          <SRow>
            <SField label="Age">
              <SInput type="number" value={draft.age} onChange={(v) => set('age', v)} placeholder="yrs" />
            </SField>
            <SField label="Sex">
              <SPills value={draft.sex} options={['M','F','Other']} labels={{M:'Male',F:'Female',Other:'Other'}} onChange={(v) => set('sex', v)} />
            </SField>
          </SRow>
          <SRow>
            <SField label="Height">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <SInput type="number" value={draft.height_ft} onChange={(v) => set('height_ft', v)} placeholder="ft" />
                <SInput type="number" value={draft.height_in} onChange={(v) => set('height_in', v)} placeholder="in" />
              </div>
            </SField>
            <SField label="Current weight">
              <SInput type="number" value={draft.current_weight_lbs} onChange={(v) => set('current_weight_lbs', v)} placeholder="lbs" />
            </SField>
          </SRow>
          <SField label="Target weight (optional)">
            <SInput type="number" value={draft.target_weight_lbs} onChange={(v) => set('target_weight_lbs', v)} placeholder="lbs" />
          </SField>
          <SField label="Primary goal">
            <SPills value={draft.primary_goal} options={[...PRIMARY_GOALS]} labels={{lose_fat:'Lose fat',gain_muscle:'Gain muscle',maintain:'Maintain',performance:'Performance',recomp:'Recomp'}} onChange={(v) => set('primary_goal', v)} />
          </SField>
          <SRow>
            <SField label="Experience (years)">
              <SInput type="number" value={draft.training_experience_years} onChange={(v) => set('training_experience_years', v)} placeholder="yrs" />
            </SField>
            <SField label="Training days/week">
              <SInput type="number" value={draft.training_days_per_week} onChange={(v) => set('training_days_per_week', v)} placeholder="0-7" />
            </SField>
          </SRow>
          <SField label="Equipment access">
            <SPills value={draft.equipment_access} options={[...EQUIPMENT_ACCESS]} labels={{none:'None',bands:'Bands',home_gym:'Home gym',full_gym:'Full gym'}} onChange={(v) => set('equipment_access', v)} />
          </SField>
          <SField label="Medical flags">
            <NoneOrText value={draft.medical_flags} onChange={(v) => set('medical_flags', v)} placeholder="Cardiac, hypertension, meds, etc." />
          </SField>
          <SField label="Injuries">
            <NoneOrText value={draft.injuries} onChange={(v) => set('injuries', v)} placeholder="Current or chronic injuries." />
          </SField>
          <SRow>
            <SField label="Average sleep (hrs/night)">
              <SInput type="number" value={draft.sleep_hours_avg} onChange={(v) => set('sleep_hours_avg', v)} placeholder="hrs" />
            </SField>
            <SField label="Stress (1-10)">
              <SSelect value={draft.stress_level} onChange={(v) => set('stress_level', v)}
                options={[1,2,3,4,5,6,7,8,9,10].map(n=>({value:String(n),label:String(n)}))} placeholder="-" />
            </SField>
          </SRow>
          <SField label="Dietary preference">
            <SSelect value={draft.dietary_preference} onChange={(v) => set('dietary_preference', v)}
              options={DIETARY_PREFERENCES.map(d=>({value:d,label:d}))} placeholder="Pick one" />
          </SField>
          <SField label="Allergies / intolerances">
            <NoneOrText value={draft.allergies} onChange={(v) => set('allergies', v)} placeholder="e.g. shellfish, tree nuts." />
          </SField>
          <SRow>
            <SField label="Occupation activity">
              <SPills value={draft.occupation_activity} options={[...OCCUPATION_ACTIVITIES]} labels={{sedentary:'Sedentary',light:'Light',moderate:'Moderate',heavy:'Heavy'}} onChange={(v) => set('occupation_activity', v)} />
            </SField>
            <SField label="Meals per day">
              <SSelect value={draft.meals_per_day} onChange={(v) => set('meals_per_day', v)}
                options={[3,4,5,6].map(n=>({value:String(n),label:String(n)}))} placeholder="3-6" />
            </SField>
          </SRow>
        </div>

        {saveError && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fee2e2', borderRadius: A.rSm, fontSize: 13, color: '#991b1b' }}>{saveError}</div>}
        {saveNote && <div style={{ marginTop: 12, padding: '10px 14px', background: A.greenBg, borderRadius: A.rSm, fontSize: 13, color: '#065f46' }}>{saveNote}</div>}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleSave} disabled={saving} style={{
            padding: '12px 24px', background: saving ? A.ink3 : A.ink,
            color: '#fff', border: 'none', borderRadius: A.rSm,
            fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
            fontFamily: A.font,
          }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </Card>

      {/* Danger zone */}
      <Card style={{ border: `1px solid ${A.red}30`, boxShadow: 'none' }}>
        <SectionLabel>Danger zone</SectionLabel>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: A.ink2, lineHeight: 1.5 }}>
          Delete your account permanently. Your intake, plan, workout logs, and login are removed.
        </p>
        {deleteStage === 'idle' && (
          <button type="button" onClick={() => setDeleteStage('confirm')} style={{
            padding: '10px 16px', background: A.card, color: A.red,
            border: `1px solid ${A.red}40`, borderRadius: A.rSm,
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: A.font,
          }}>
            Delete my account
          </button>
        )}
        {deleteStage === 'confirm' && (
          <DeleteConfirmBox onConfirm={handleDelete} onCancel={() => setDeleteStage('idle')} />
        )}
        {deleteStage === 'deleting' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: A.red, fontSize: 14 }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Deleting...
          </div>
        )}
        {deleteStage === 'error' && (
          <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: A.rSm, fontSize: 13, color: '#991b1b' }}>
            {deleteError || 'Delete failed.'}
            <button type="button" onClick={() => setDeleteStage('confirm')} style={{
              display: 'block', marginTop: 6, background: 'none', border: 'none',
              color: '#991b1b', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0,
            }}>
              Retry
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Settings primitives ─────────────────────────────────────────────────────

function seedDraft(t) {
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

function normalizeSex(raw) {
  if (!raw) return ''
  const s = String(raw).trim().toLowerCase()
  if (s === 'm' || s === 'male' || s === 'man') return 'M'
  if (s === 'f' || s === 'female' || s === 'woman') return 'F'
  if (s === '' || s === 'null') return ''
  return 'Other'
}

function SField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: A.ink2, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function SInput({ type = 'text', value, onChange, placeholder }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{
        width: '100%', padding: '10px 14px', fontSize: 15, height: 44,
        border: `1px solid ${A.border}`, borderRadius: A.rSm,
        background: A.card, color: A.ink, fontFamily: A.font,
        outline: 'none', boxSizing: 'border-box',
      }} />
  )
}

function SSelect({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', padding: '10px 14px', fontSize: 15, height: 44,
        border: `1px solid ${A.border}`, borderRadius: A.rSm,
        background: A.card, color: A.ink, fontFamily: A.font,
        outline: 'none', boxSizing: 'border-box',
      }}>
      <option value="">{placeholder || 'Select'}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function SPills({ value, options, labels, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt) => {
        const active = String(value) === String(opt)
        return (
          <button key={opt} type="button" onClick={() => onChange(opt)} style={{
            padding: '8px 14px',
            border: `1.5px solid ${active ? A.accent : A.border}`,
            borderRadius: A.rPill,
            background: active ? A.accentBg : A.card,
            color: active ? A.accent : A.ink2,
            fontSize: 13, fontWeight: active ? 600 : 500,
            cursor: 'pointer', fontFamily: A.font,
          }}>
            {labels?.[opt] || opt}
          </button>
        )
      })}
    </div>
  )
}

function SRow({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

function DeleteConfirmBox({ onConfirm, onCancel }) {
  const [text, setText] = useState('')
  const ok = text.trim().toLowerCase() === 'delete'
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder='type "delete"'
        style={{
          padding: '10px 14px', fontSize: 14, height: 44,
          border: `1px solid ${A.red}40`, borderRadius: A.rSm,
          background: A.card, color: A.ink, fontFamily: A.font,
          outline: 'none', minWidth: 160,
        }} />
      <button type="button" onClick={onCancel} style={{
        padding: '10px 16px', height: 44, background: A.card, color: A.ink2,
        border: `1px solid ${A.border}`, borderRadius: A.rSm,
        fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: A.font,
      }}>
        Cancel
      </button>
      <button type="button" onClick={onConfirm} disabled={!ok} style={{
        padding: '10px 16px', height: 44,
        background: ok ? A.red : A.ink3, color: '#fff',
        border: 'none', borderRadius: A.rSm,
        fontSize: 14, fontWeight: 600, cursor: ok ? 'pointer' : 'default',
        fontFamily: A.font,
      }}>
        Confirm delete
      </button>
    </div>
  )
}
