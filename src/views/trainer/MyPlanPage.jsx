"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Loader2, LayoutGrid, Dumbbell, Utensils, TrendingUp, User,
  MessageCircle, ChevronDown, ChevronRight, Info, ExternalLink,
  Check, Camera, Printer, ShoppingBag, ChevronLeft, ChevronUp,
  BookOpen, Search, Activity, Target, Sparkles, ArrowRight,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, ReferenceLine,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import {
  fetchMyPlan, logSet as apiLogSet, updateMyIntake, deleteMyAccount,
  adjustPlanNL, generateFullPlan,
} from '../../lib/trainer/myPlanFetch'
import MyPlanShell from '../../components/trainer/MyPlanShell'
import IntakeChatWidget from '../../components/trainer/IntakeChatWidget'
import PlanBaselineCard from '../../components/trainer/PlanBaselineCard'
import RoadmapCard from '../../components/trainer/RoadmapCard'
import WorkoutAccordion from '../../components/trainer/WorkoutAccordion'
import PlaybookCard from '../../components/trainer/PlaybookCard'
import MealPlanTable from '../../components/trainer/MealPlanTable'
import GroceryList from '../../components/trainer/GroceryList'
import TraineeDisclaimerAckModal from './TraineeDisclaimerAckModal'
import NoneOrText from '../../components/trainer/NoneOrText'
import { DateStrip, RingMetricTile, lastNDays, T as TK } from '../../components/trainer/aesthetic'
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

// Phase 1 token swap — Cal-AI-inspired neutral palette.
// Same keys as before so nothing downstream breaks; just hex shifts.
// Headline / body weight changes belong to Phase 2 (per-component).
const A = {
  bg:       '#ffffff',
  card:     '#ffffff',
  cardAlt:  '#f1f1f6',
  ink:      '#0a0a0a',
  ink2:     '#1f1f22',
  ink3:     '#6b6b70',
  accent:   '#d89a6a',
  accentBg: 'rgba(216,154,106,0.10)',
  green:    '#10b981',
  greenBg:  'rgba(16,185,129,0.10)',
  red:      '#e9695c',
  amber:    '#f0b400',
  border:   '#ececef',
  shadow1:  '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
  shadow2:  '0 6px 16px rgba(0,0,0,0.06)',
  font:     "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
  mono:     "'SF Mono', 'Menlo', monospace",
  r:        16,
  rSm:      12,
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
  { key: 'learn',     label: 'Learn',     Icon: BookOpen },
  { key: 'profile',   label: 'Profile',   Icon: User },
]

// ── Main Page ───────────────────────────────────────────────────────────────

export default function MyPlanPage() {
  const [sessionState, setSessionState] = useState({ loading: true, user: null })
  const [planState, setPlanState] = useState({ loading: true, error: null, data: null })
  const [tab, setTab] = useState('home')
  // Bumped each time a meal logs anywhere — DateStripWithMacros listens to
  // this so the Home rings refetch live without needing a tab swap.
  const [mealsRefreshKey, setMealsRefreshKey] = useState(0)
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

  // Tabs that surface plan content show a green dot when their section is ready,
  // a faint gray dot when still pending — so the user can see at-a-glance what's
  // accessible without opening each one. Always-available tabs (home/coach/
  // learn/profile) get no dot since there's nothing to "wait for".
  const tabReadiness = {
    workouts: !!plan?.workout_plan,
    meals: !!plan?.meal_plan,
    progress: !!plan?.workout_plan,
  }

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
            const hasContent = key in tabReadiness
            const ready = tabReadiness[key]
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
                {hasContent && (
                  <span aria-hidden style={{
                    width: 6, height: 6, borderRadius: 999,
                    background: ready ? '#10b981' : 'rgba(0,0,0,0.18)',
                    marginLeft: 2,
                  }} />
                )}
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
            mealsRefreshKey={mealsRefreshKey}
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
            onMealLogged={() => setMealsRefreshKey((k) => k + 1)}
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
        {tab === 'learn' && <LearnTab />}
        {tab === 'profile' && (
          <ProfileTab trainee={trainee} onAfterChange={loadPlan} />
        )}
      </div>

      {/* Mobile bottom tab bar — Cal-AI floating white surface, active pill,
          shadow lift. The bar floats above content with side margin so it
          reads as an "object" rather than a chrome strip. */}
      {isMobile && (
        <nav className="no-print" style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          left: 12, right: 12,
          height: 64,
          background: '#ffffff',
          borderRadius: 22,
          boxShadow: '0 8px 28px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          padding: '0 8px',
          zIndex: 50,
        }}>
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key
            const hasContent = key in tabReadiness
            const ready = tabReadiness[key]
            return (
              <button key={key} type="button" onClick={() => setTab(key)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2,
                padding: active ? '6px 12px' : '6px 8px',
                background: active ? A.cardAlt : 'transparent',
                border: 'none', borderRadius: 14,
                color: active ? A.ink : A.ink3,
                fontSize: 10, fontWeight: active ? 700 : 500,
                cursor: 'pointer', fontFamily: A.font,
                minWidth: 52, position: 'relative',
                transition: 'background .15s ease',
              }}>
                <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
                {hasContent && ready && (
                  <span aria-hidden style={{
                    position: 'absolute', top: 4, right: 10,
                    width: 6, height: 6, borderRadius: 999,
                    background: '#10b981',
                    boxShadow: '0 0 0 1.5px #fff',
                  }} />
                )}
                <span>{label}</span>
              </button>
            )
          })}
        </nav>
      )}

      {/* Floating action button — Cal-AI signature outside the tab bar.
          Only on Home for now: jumps to Meals tab where the camera lives.
          Other tabs hide it (Workouts logs inline; Coach/Learn/Profile
          have no clear primary action). */}
      {isMobile && tab === 'home' && plan?.meal_plan && (
        <button
          type="button"
          onClick={() => setTab('meals')}
          aria-label="Log a meal"
          className="no-print"
          style={{
            position: 'fixed',
            right: 24,
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
            width: 56, height: 56, borderRadius: 999,
            background: '#0a0a0a', color: '#ffffff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)',
            cursor: 'pointer', zIndex: 51,
            transition: 'transform .12s ease',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.94)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = '' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
        >
          <Camera size={22} strokeWidth={2} />
        </button>
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

function OverviewTab({ trainee, plan, logs, isMobile, onAfterAdjust, onGotoTab, onRefresh, mealsRefreshKey }) {
  const hasBaseline = !!plan?.baseline
  const hasWorkout = !!plan?.workout_plan
  const hasMeals = !!plan?.meal_plan
  const [generating, setGenerating] = useState(false)
  const pollRef = useRef(null)

  // 7-day streak
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

  // Plan steps
  const STEP_COLORS = ['#e9695c', '#5aa0ff', '#7c3aed', '#059669', '#d97706', '#0891b2']
  // hasPrefs mirrors TrainerDetailPage — a bare envelope shouldn't pass as ready.
  const prefsAnswers = plan?.food_preferences?.answers
  const hasPrefs = Array.isArray(prefsAnswers) && prefsAnswers.length > 0
  const hasRoadmap = !!plan?.roadmap
  const hasPlaybook = !!plan?.playbook
  const hasGrocery = !!plan?.grocery_list
  const steps = [
    { key: 'baseline', label: 'Baseline', done: hasBaseline, Icon: Activity },
    { key: 'roadmap', label: 'Roadmap', done: hasRoadmap, Icon: Target },
    { key: 'workout', label: 'Workout', done: hasWorkout, Icon: Dumbbell },
    { key: 'playbook', label: 'Playbook', done: hasPlaybook, Icon: BookOpen },
    { key: 'food', label: 'Food', done: hasPrefs, Icon: Utensils },
    { key: 'meals', label: 'Meals', done: hasMeals, Icon: TrendingUp },
  ]
  const doneCount = steps.filter((s) => s.done).length
  // Build order drives "building vs pending" — first not-done while generating is active.
  const firstPendingKey = steps.find((s) => !s.done)?.key

  // Did you know facts
  const DYK = [
    'Your muscles grow during rest, not during the workout. Sleep is when the real gains happen.',
    'Drinking water boosts performance by up to 25%. Most athletes are dehydrated.',
    'Athletes who track food are 2x more likely to hit body composition goals.',
    'A single night of bad sleep reduces power output by up to 20%.',
    'Dynamic stretching before activity improves performance. Static stretching is for after.',
    'Protein eaten within 30 min after training is absorbed 50% more efficiently.',
    'Creatine is the most studied sports supplement — safe and effective for strength gains.',
    'Foam rolling for 2 min per muscle group increases range of motion by 10-15%.',
  ]
  const [factIdx, setFactIdx] = useState(0)
  useEffect(() => {
    if (!generating) return
    const t = setInterval(() => setFactIdx((i) => (i + 1) % DYK.length), 5000)
    return () => clearInterval(t)
  }, [generating])

  async function handleGenerate() {
    setGenerating(true)
    try {
      await generateFullPlan()
    } catch { /* */ }
    // Poll for results
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      await onRefresh()
    }, 5000)
    setTimeout(() => { if (pollRef.current) clearInterval(pollRef.current); setGenerating(false) }, 300000)
  }

  // Stop polling when all done
  useEffect(() => {
    if (doneCount >= 6 && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
      setGenerating(false)
    }
  }, [doneCount])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {!isMobile && <GreetingHeader trainee={trainee} />}

      {/* ══ Plan Steps Checklist — only while there's work to do.
          When everything is ready, this dark hero disappears so the
          daily-driver content (date strip, calories, today's stuff)
          owns the top of the screen. ══ */}
      {doneCount < 6 && (
      <div style={{
        background: '#0a0a0a', borderRadius: A.r, padding: '24px 16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      }}>
        <style>{`
          @keyframes mpSpin { to { transform: rotate(360deg) } }
          @keyframes mpPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
          @keyframes mpFade { 0% { opacity: 0; transform: translateY(8px) } 100% { opacity: 1; transform: translateY(0) } }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Your Plan</span>
          <span style={{ padding: '5px 14px', borderRadius: 999, background: doneCount === 6 ? '#34c75925' : 'rgba(255,255,255,0.1)', fontSize: 14, fontWeight: 700, color: doneCount === 6 ? '#34c759' : 'rgba(255,255,255,0.6)' }}>
            {doneCount}/{steps.length}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {steps.map((step, i) => {
            const color = STEP_COLORS[i]
            const sz = 68, r = 28, circ = 2 * Math.PI * r
            const StepIcon = step.Icon
            const isGen = generating && !step.done
            return (
              <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', width: sz, height: sz }}>
                  <svg width={sz} height={sz} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
                    <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={step.done ? color : 'transparent'} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${step.done ? circ : 0} ${circ}`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                    {isGen && <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${circ*0.3} ${circ*0.7}`} style={{ animation: 'mpSpin 1.2s linear infinite', transformOrigin: `${sz/2}px ${sz/2}px` }} />}
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...(isGen ? { animation: 'mpPulse 1.5s ease infinite' } : {}) }}>
                    {step.done ? <Check size={24} color={color} strokeWidth={3} /> : <StepIcon size={22} color={isGen ? color : 'rgba(255,255,255,0.25)'} strokeWidth={1.75} />}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: step.done ? color : isGen ? color : 'rgba(255,255,255,0.3)' }}>{step.label}</span>
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 999, marginBottom: generating ? 16 : 14 }}>
          <div style={{ height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${STEP_COLORS[0]}, ${STEP_COLORS[2]}, ${STEP_COLORS[3]})`, width: `${Math.round((doneCount/6)*100)}%`, transition: 'width .6s ease' }} />
        </div>

        {/* Generate CTA — always shown inside this block since it only
            renders when doneCount < 6 anyway. */}
        <button type="button" onClick={handleGenerate} disabled={generating} style={{
          width: '100%', padding: '14px 16px',
          background: generating ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${STEP_COLORS[0]}, ${STEP_COLORS[2]})`,
          color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800,
          cursor: generating ? 'default' : 'pointer', fontFamily: A.font,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: generating ? 'none' : `0 4px 16px ${STEP_COLORS[0]}40`,
        }}>
          {generating ? <Loader2 size={16} style={{ animation: 'mpSpin 1s linear infinite' }} /> : <Sparkles size={16} />}
          {generating ? 'Building your plan...' : doneCount > 0 ? `Continue building (${doneCount}/6)` : 'Generate my full plan'}
        </button>
      </div>
      )}

      {/* ══ Quick Actions ══ */}
      {(hasWorkout || hasMeals) && (
        <div style={{ display: 'grid', gridTemplateColumns: hasMeals ? '1fr 1fr' : '1fr', gap: 10 }}>
          {hasWorkout && (
            <button type="button" onClick={() => onGotoTab('workouts')} style={{
              background: A.card, border: `1px solid ${A.border}`, borderRadius: A.r,
              padding: 16, cursor: 'pointer', textAlign: 'left', boxShadow: A.shadow1,
            }}>
              <Dumbbell size={20} color={A.accent} strokeWidth={1.75} />
              <div style={{ marginTop: 8, fontSize: 15, fontWeight: 600, color: A.ink }}>Today&apos;s workout</div>
            </button>
          )}
          {hasMeals && (
            <button type="button" onClick={() => onGotoTab('meals')} style={{
              background: A.card, border: `1px solid ${A.border}`, borderRadius: A.r,
              padding: 16, cursor: 'pointer', textAlign: 'left', boxShadow: A.shadow1,
            }}>
              <Utensils size={20} color={A.green} strokeWidth={1.75} />
              <div style={{ marginTop: 8, fontSize: 15, fontWeight: 600, color: A.ink }}>Meal plan</div>
            </button>
          )}
        </div>
      )}

      {/* ══ DateStrip + daily macros (Cal-AI Home language) ══
          DateStrip selection is local-only for now — there's no per-day data
          to swap into yet. When food-log fetching lands here, the rings
          turn into "actual / target" instead of just showing the target. */}
      <DateStripWithMacros plan={plan} traineeId={trainee?.id} refreshKey={mealsRefreshKey} />

      {/* ══ Plan Sections ══
          Tiles always render. Each flips to ready as its key on `plan` lands;
          building/pending show skeletons so the user can read finished sections
          while heavier ones build. */}
      <PlanSectionTile
        title="Baseline"
        icon={<Activity size={16} />}
        color="#e9695c"
        state={hasBaseline ? 'ready' : (generating && firstPendingKey === 'baseline') ? 'building' : 'pending'}
        etaLabel="~15s"
        defaultOpen
      >
        {hasBaseline && <PlanBaselineCard baseline={plan.baseline} />}
      </PlanSectionTile>

      <PlanSectionTile
        title="Roadmap"
        icon={<Target size={16} />}
        color="#5aa0ff"
        state={hasRoadmap ? 'ready' : (generating && firstPendingKey === 'roadmap') ? 'building' : 'pending'}
        etaLabel="~30s"
      >
        {hasRoadmap && <RoadmapCard roadmap={plan.roadmap} currentPhase={plan.phase_ref || 1} />}
      </PlanSectionTile>

      <PlanSectionTile
        title="Workout"
        icon={<Dumbbell size={16} />}
        color="#7c3aed"
        state={hasWorkout ? 'ready' : (generating && firstPendingKey === 'workout') ? 'building' : 'pending'}
        etaLabel="~90s"
        onOpenFull={hasWorkout ? () => onGotoTab('workouts') : undefined}
        openFullLabel="Open Workouts tab"
      >
        {hasWorkout && <WorkoutAccordion workoutPlan={plan.workout_plan} logs={logs || []} onLogSet={() => {}} />}
      </PlanSectionTile>

      <PlanSectionTile
        title="Playbook"
        icon={<BookOpen size={16} />}
        color="#059669"
        state={hasPlaybook ? 'ready' : (generating && firstPendingKey === 'playbook') ? 'building' : 'pending'}
        etaLabel="~120s"
      >
        {hasPlaybook && <PlaybookCard playbook={plan.playbook} />}
      </PlanSectionTile>

      <PlanSectionTile
        title="Food preferences"
        icon={<Utensils size={16} />}
        color="#d97706"
        state={hasPrefs ? 'ready' : (generating && firstPendingKey === 'food') ? 'building' : 'pending'}
        etaLabel="~15s"
      >
        {hasPrefs && (
          <div style={{ fontSize: 14, color: A.ink2, lineHeight: 1.6 }}>
            Food preferences captured ({prefsAnswers.length} answer{prefsAnswers.length === 1 ? '' : 's'}). Used to tailor your meal plan.
          </div>
        )}
      </PlanSectionTile>

      <PlanSectionTile
        title="Meal Plan"
        icon={<Utensils size={16} />}
        color="#d97706"
        state={hasMeals ? 'ready' : (generating && firstPendingKey === 'meals') ? 'building' : 'pending'}
        etaLabel="~120s"
        onOpenFull={hasMeals ? () => onGotoTab('meals') : undefined}
        openFullLabel="Open Meals tab"
      >
        {hasMeals && <MealPlanTable mealPlan={plan.meal_plan} traineeId={trainee?.id} />}
      </PlanSectionTile>

      {hasGrocery && (
        <PlanCard title="Grocery List" icon={<TrendingUp size={16} />} color="#0891b2">
          <GroceryList groceryList={plan.grocery_list} />
        </PlanCard>
      )}

      {/* Adjust box */}
      {hasWorkout && <AdjustBox onAfterAdjust={onAfterAdjust} />}

      {/* ══ Did you know? ══
          Slim footer strip during generation — non-blocking, rotates every 5s. */}
      {generating && (
        <div key={factIdx} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: A.cardAlt,
          border: `1px solid ${A.border}`,
          borderLeft: `3px solid ${STEP_COLORS[factIdx % STEP_COLORS.length]}`,
          borderRadius: A.rSm,
          animation: 'mpFade 0.4s ease',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: STEP_COLORS[factIdx % STEP_COLORS.length],
            textTransform: 'uppercase', letterSpacing: '.06em',
            flexShrink: 0,
          }}>
            Did you know?
          </span>
          <span style={{ fontSize: 12, color: A.ink2, lineHeight: 1.45 }}>
            {DYK[factIdx]}
          </span>
        </div>
      )}
    </div>
  )
}

// DateStripWithMacros — Cal-AI Home top: 7-day date selector + Calories ring
// + 3-up Macros tile row.  Fetches food logs once per visible 7-day window
// and computes per-day totals; selecting a day swaps which day's totals
// drive the rings. Activity strip under the date row reflects food-logged
// days, not workout days (workouts live in their own tab).
function DateStripWithMacros({ plan, traineeId, refreshKey = 0 }) {
  const days = useMemo(() => lastNDays(7), [])
  const [selected, setSelected] = useState(() => new Date())
  const [perDay, setPerDay] = useState({})  // { 'YYYY-MM-DD': { kcal, p, c, f } }
  const [loading, setLoading] = useState(false)

  const baseline = plan?.baseline || null
  const calTarget = baseline?.calorie_target_kcal ?? null
  const macros = baseline?.macro_targets_g || {}
  const proteinTarget = macros.protein_g ?? null
  const carbsTarget = macros.carb_g ?? null
  const fatTarget = macros.fat_g ?? null

  const fromKey = days[0].toISOString().slice(0, 10)
  const toKey = days[days.length - 1].toISOString().slice(0, 10)

  // One round-trip per 7-day window. The cancel ref guards against a stale
  // response landing after an unmount or window change.
  useEffect(() => {
    if (!traineeId) return
    let cancelled = false
    setLoading(true)
    fetch('/api/trainer/food-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_range', trainee_id: traineeId, from: fromKey, to: toKey }),
    })
      .then((r) => r.ok ? r.json() : { logs: [] })
      .then((data) => {
        if (cancelled) return
        const out = {}
        for (const log of data.logs || []) {
          const k = log.log_date
          if (!out[k]) out[k] = { kcal: 0, p: 0, c: 0, f: 0 }
          out[k].kcal += Number(log.total_kcal || 0)
          out[k].p += Number(log.total_protein_g || 0)
          out[k].c += Number(log.total_carb_g || 0)
          out[k].f += Number(log.total_fat_g || 0)
        }
        setPerDay(out)
      })
      .catch(() => { if (!cancelled) setPerDay({}) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [traineeId, fromKey, toKey, refreshKey])

  const selectedKey = selected.toISOString().slice(0, 10)
  const todays = perDay[selectedKey] || { kcal: 0, p: 0, c: 0, f: 0 }
  const isToday = selectedKey === new Date().toISOString().slice(0, 10)

  // Pct clamps at 1.0 visually so the ring doesn't loop; over-budget shows
  // up via the value going past target (a future polish: warn color).
  const pct = (actual, target) => target ? Math.max(0, Math.min(1, actual / target)) : 0

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <DateStrip days={days} selected={selected} onSelect={setSelected} />
      {/* Activity strip — food-logged days for the visible window */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: -8 }}>
        {days.map((d) => {
          const k = d.toISOString().slice(0, 10)
          const logged = perDay[k] && perDay[k].kcal > 0
          return (
            <span key={k} aria-hidden style={{
              flex: 1, height: 4, margin: '0 6px',
              background: logged ? TK.accent : 'transparent',
              borderRadius: 2,
            }} />
          )
        })}
      </div>

      {calTarget != null && (
        <RingMetricTile
          label={isToday ? 'Calories today' : 'Calories'}
          value={Math.round(todays.kcal)}
          unit={`/ ${calTarget} kcal`}
          pct={pct(todays.kcal, calTarget)}
          color={TK.ink}
          hint={loading ? 'Loading…' : todays.kcal === 0 ? 'Snap a meal photo to start logging' : undefined}
        />
      )}

      {(proteinTarget != null || carbsTarget != null || fatTarget != null) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {proteinTarget != null && (
            <RingMetricTile compact label="Protein" value={Math.round(todays.p)} unit={`/ ${proteinTarget}g`} pct={pct(todays.p, proteinTarget)} color={TK.accentRed} />
          )}
          {carbsTarget != null && (
            <RingMetricTile compact label="Carbs" value={Math.round(todays.c)} unit={`/ ${carbsTarget}g`} pct={pct(todays.c, carbsTarget)} color={TK.accent} />
          )}
          {fatTarget != null && (
            <RingMetricTile compact label="Fat" value={Math.round(todays.f)} unit={`/ ${fatTarget}g`} pct={pct(todays.f, fatTarget)} color={TK.accentBlue} />
          )}
        </div>
      )}
    </section>
  )
}

function PlanSectionTile({ title, icon, color = '#0a0a0a', state, etaLabel, defaultOpen = false, onOpenFull, openFullLabel, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const wasReady = useRef(state === 'ready')
  // Auto-open the FIRST time a tile becomes ready, so the user sees finished
  // sections without having to click. Subsequent user-collapses are respected.
  useEffect(() => {
    if (state === 'ready' && !wasReady.current) {
      setOpen(true)
      wasReady.current = true
    }
  }, [state])

  const isReady = state === 'ready'
  const isBuilding = state === 'building'

  const headerBg = isReady ? (open ? A.card : A.cardAlt) : A.cardAlt
  const borderColor = isReady ? (open ? color + '30' : A.border) : A.border

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        type="button"
        onClick={() => isReady && setOpen(!open)}
        disabled={!isReady}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '14px 18px', background: headerBg,
          border: `1px solid ${borderColor}`,
          borderLeft: `3px solid ${isReady ? color : color + '60'}`,
          borderRadius: isReady && open ? `${A.r}px ${A.r}px 0 0` : A.r,
          cursor: isReady ? 'pointer' : 'default',
          textAlign: 'left', fontFamily: A.font,
          opacity: isReady ? 1 : 0.95,
        }}
      >
        <span style={{ color: isReady ? color : A.ink3, display: 'flex' }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: isReady ? A.ink : A.ink2 }}>
          {title}
        </span>
        {isReady && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: A.rPill,
            background: color + '15', color,
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
          }}>
            <Check size={11} strokeWidth={3} /> Ready
          </span>
        )}
        {isBuilding && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '2px 8px', borderRadius: A.rPill,
            background: color + '15', color,
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
          }}>
            <Loader2 size={11} style={{ animation: 'mpSpin 1s linear infinite' }} />
            Building{etaLabel ? ` (${etaLabel})` : ''}
          </span>
        )}
        {!isReady && !isBuilding && (
          <span style={{
            padding: '2px 8px', borderRadius: A.rPill,
            background: 'rgba(0,0,0,0.04)', color: A.ink3,
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
          }}>
            Up next{etaLabel ? ` · ${etaLabel}` : ''}
          </span>
        )}
        {isReady && (
          <span style={{ color: A.ink3, fontSize: 13, marginLeft: 4 }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </button>

      {isReady && open && (
        <div style={{
          border: `1px solid ${color}20`, borderTop: 'none',
          borderLeft: `3px solid ${color}`,
          borderRadius: `0 0 ${A.r}px ${A.r}px`,
          padding: 18, background: A.card,
        }}>
          {children}
          {onOpenFull && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${A.border}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onOpenFull}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', background: 'transparent',
                  border: `1px solid ${color}30`,
                  borderRadius: A.rPill, color,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: A.font, letterSpacing: '.01em',
                }}
              >
                {openFullLabel || 'Open full view'} <ArrowRight size={12} strokeWidth={2.25} />
              </button>
            </div>
          )}
        </div>
      )}

      {!isReady && (
        <PlanSectionSkeleton color={color} building={isBuilding} />
      )}
    </div>
  )
}

function PlanSectionSkeleton({ color, building }) {
  const barBase = 'rgba(0,0,0,0.05)'
  const shimmer = building
    ? `linear-gradient(90deg, ${barBase} 0%, ${color}22 50%, ${barBase} 100%)`
    : barBase
  return (
    <div style={{
      border: `1px solid ${A.border}`, borderTop: 'none',
      borderLeft: `3px solid ${color}40`,
      borderRadius: `0 0 ${A.r}px ${A.r}px`,
      padding: 18, background: A.cardAlt,
    }}>
      <style>{`
        @keyframes mpShimmer { 0% { background-position: -300px 0 } 100% { background-position: 300px 0 } }
      `}</style>
      <div style={{ display: 'grid', gap: 10 }}>
        {[88, 64, 76].map((w, i) => (
          <div key={i} style={{
            height: 12, width: `${w}%`, borderRadius: 6,
            background: shimmer,
            backgroundSize: building ? '600px 100%' : 'auto',
            animation: building ? 'mpShimmer 1.4s linear infinite' : 'none',
          }} />
        ))}
      </div>
    </div>
  )
}

function PlanCard({ title, icon, color = '#0a0a0a', defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 4 }}>
      <button type="button" onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '14px 18px', background: open ? A.card : A.cardAlt,
        border: `1px solid ${open ? color + '30' : A.border}`,
        borderLeft: `3px solid ${color}`, borderRadius: open ? `${A.r}px ${A.r}px 0 0` : A.r,
        cursor: 'pointer', textAlign: 'left', fontFamily: A.font,
      }}>
        <span style={{ color, display: 'flex' }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: A.ink }}>{title}</span>
        <span style={{ color: A.ink3, fontSize: 13 }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div style={{ border: `1px solid ${color}20`, borderTop: 'none', borderLeft: `3px solid ${color}`, borderRadius: `0 0 ${A.r}px ${A.r}px`, padding: 18, background: A.card }}>
          {children}
        </div>
      )}
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
          onMessagesChange={(msgs) => {
            updateMyIntake({ chat_history: msgs }).catch(() => {})
          }}
          initialMessages={Array.isArray(trainee?.chat_history) ? trainee.chat_history : []}
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

function MealsTab({ plan, traineeId, isMobile, onMealLogged }) {
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
        if (res.ok) {
          setLoggedKeys((prev) => { const n = new Set(prev); n.delete(key); return n })
          onMealLogged?.()
        }
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
        if (res.ok) {
          setLoggedKeys((prev) => new Set(prev).add(key))
          onMealLogged?.()
        }
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
      onMealLogged?.()
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
        {mealPlan.calorie_daily_target_kcal && <MacroPill label="Cal" value={`${mealPlan.calorie_daily_target_kcal}`} color="#0a0a0a" />}
        {macros.protein_g && <MacroPill label="P" value={`${macros.protein_g}g`} color="#5aa0ff" />}
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
                      {mealMacros.protein_g && <MacroPill label="P" value={`${mealMacros.protein_g}g`} color="#5aa0ff" />}
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
          .print-meals > div { break-inside: avoid; box-shadow: none !important; border: 1px solid #ececef !important; }
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
          {meal.kcal && <MacroPill label="Cal" value={meal.kcal} color="#0a0a0a" />}
          {macros.protein_g && <MacroPill label="Protein" value={`${macros.protein_g}g`} color="#5aa0ff" />}
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

      {/* AI Weekly Insight */}
      <AIInsightCard traineeId={traineeId} />

      {/* Progress photos */}
      <ProgressPhotosSection traineeId={traineeId} />

      {/* Body measurements */}
      <BodyMeasurementsSection traineeId={traineeId} />

      {/* Empty state */}
      {volumeData.length <= 1 && weightData.length <= 1 && !adherenceData && (
        <EmptyCard label="Start logging workouts and weigh-ins to see your progress here." />
      )}
    </div>
  )
}

// ── Body Measurements Section ──────────────────────────────────────────────

const BODY_FIELDS = [
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'neck', label: 'Neck' },
  { key: 'bicep_left', label: 'Bicep (L)' },
  { key: 'bicep_right', label: 'Bicep (R)' },
  { key: 'thigh_left', label: 'Thigh (L)' },
  { key: 'thigh_right', label: 'Thigh (R)' },
  { key: 'calf_left', label: 'Calf (L)' },
  { key: 'calf_right', label: 'Calf (R)' },
  { key: 'forearm_left', label: 'Forearm (L)' },
  { key: 'forearm_right', label: 'Forearm (R)' },
]

// ── AI Weekly Insight Card ─────────────────────────────────────────────────

function AIInsightCard({ traineeId }) {
  const [insight, setInsight] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!traineeId) return
    let c = false
    async function load() {
      try {
        const res = await fetch('/api/trainer/my-plan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_insights' }),
        })
        if (c || !res.ok) return
        const d = await res.json()
        if (d.insights?.length > 0) setInsight(d.insights[0])
      } catch {} finally { if (!c) setLoading(false) }
    }
    load()
    return () => { c = true }
  }, [traineeId])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/trainer/my-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_weekly_insight' }),
      })
      if (res.ok) {
        const d = await res.json()
        setInsight({ ...d.insight, generated_at: new Date().toISOString() })
      }
    } catch {} finally { setGenerating(false) }
  }

  return (
    <Card style={{ background: '#0a0a0a', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          AI Weekly Analysis
        </div>
        <button type="button" onClick={handleGenerate} disabled={generating} style={{
          padding: '6px 12px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
          border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: generating ? 'default' : 'pointer',
          fontFamily: A.font, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {generating ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
          {generating ? 'Analyzing...' : insight ? 'Refresh' : 'Generate'}
        </button>
      </div>

      {insight ? (
        <div>
          <div style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>
            {insight.summary}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#34c759', textTransform: 'uppercase', marginBottom: 6 }}>Working</div>
              {(Array.isArray(insight.whats_working) ? insight.whats_working : []).map((w, i) => (
                <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 4, paddingLeft: 10, borderLeft: '2px solid #34c759' }}>{w}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#ff9f0a', textTransform: 'uppercase', marginBottom: 6 }}>Needs attention</div>
              {(Array.isArray(insight.needs_attention) ? insight.needs_attention : []).map((w, i) => (
                <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 4, paddingLeft: 10, borderLeft: '2px solid #ff9f0a' }}>{w}</div>
              ))}
            </div>
          </div>
          {Array.isArray(insight.plan_changes) && insight.plan_changes.length > 0 && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>Plan adjustments</div>
              {insight.plan_changes.map((c, i) => (
                <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 2 }}>{c}</div>
              ))}
            </div>
          )}
        </div>
      ) : !loading ? (
        <div style={{ textAlign: 'center', padding: 16, color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          Log some workouts, meals, and measurements first. Then generate your weekly analysis.
        </div>
      ) : null}
    </Card>
  )
}

// ── Progress Photos Section ───────────────────────────────────────────────

function ProgressPhotosSection({ traineeId }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showCapture, setShowCapture] = useState(false)
  const [selectedPose, setSelectedPose] = useState('front')
  const [compareIdx, setCompareIdx] = useState(0)
  const [overlayOpacity, setOverlayOpacity] = useState(50)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!traineeId) return
    let c = false
    async function load() {
      try {
        const res = await fetch('/api/trainer/my-plan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_progress_photos' }),
        })
        if (c || !res.ok) return
        const d = await res.json()
        setPhotos(d.photos || [])
      } catch {} finally { if (!c) setLoading(false) }
    }
    load()
    return () => { c = true }
  }, [traineeId])

  async function handleUpload(file) {
    if (!file || !traineeId) return
    setUploading(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => { const s = String(reader.result || ''); const i = s.indexOf(','); resolve(i >= 0 ? s.slice(i + 1) : s) }
        reader.onerror = () => reject(new Error('Read failed'))
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/trainer/my-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload_progress_photo', photo_base64: base64, pose: selectedPose }),
      })
      if (res.ok) {
        setShowCapture(false)
        // Reload photos
        const res2 = await fetch('/api/trainer/my-plan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_progress_photos' }),
        })
        if (res2.ok) { const d = await res2.json(); setPhotos(d.photos || []) }
      }
    } catch {} finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const frontPhotos = photos.filter((p) => p.pose === 'front')
  const hasComparison = frontPhotos.length >= 2

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionLabel>Progress photos</SectionLabel>
        <button type="button" onClick={() => setShowCapture(!showCapture)} style={{
          padding: '6px 14px', background: showCapture ? A.ink : A.card,
          color: showCapture ? '#fff' : A.ink2, border: `1px solid ${A.border}`,
          borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: A.font,
        }}>
          {showCapture ? 'Cancel' : '+ Take photo'}
        </button>
      </div>

      {/* Photo capture with alignment guide */}
      {showCapture && (
        <div style={{ marginBottom: 16 }}>
          {/* Pose selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['front', 'side', 'back'].map((pose) => (
              <button key={pose} type="button" onClick={() => setSelectedPose(pose)} style={{
                padding: '8px 16px', background: selectedPose === pose ? A.ink : A.card,
                color: selectedPose === pose ? '#fff' : A.ink2,
                border: `1px solid ${selectedPose === pose ? A.ink : A.border}`,
                borderRadius: A.rPill, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: A.font, textTransform: 'capitalize',
              }}>
                {pose}
              </button>
            ))}
          </div>

          {/* Alignment guide frame */}
          <div style={{
            position: 'relative', width: '100%', maxWidth: 300, margin: '0 auto',
            aspectRatio: '3 / 4', background: A.cardAlt, borderRadius: A.rSm,
            border: `2px dashed ${A.border}`, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Body outline guide */}
            <svg viewBox="0 0 200 280" style={{ width: '60%', opacity: 0.15 }}>
              <ellipse cx="100" cy="45" rx="25" ry="30" fill="none" stroke="#0a0a0a" strokeWidth="2" />
              <line x1="100" y1="75" x2="100" y2="170" stroke="#0a0a0a" strokeWidth="2" />
              <line x1="100" y1="100" x2="55" y2="140" stroke="#0a0a0a" strokeWidth="2" />
              <line x1="100" y1="100" x2="145" y2="140" stroke="#0a0a0a" strokeWidth="2" />
              <line x1="100" y1="170" x2="70" y2="260" stroke="#0a0a0a" strokeWidth="2" />
              <line x1="100" y1="170" x2="130" y2="260" stroke="#0a0a0a" strokeWidth="2" />
            </svg>
            <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: A.ink3 }}>
              Align yourself with the outline
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }}
            onChange={(e) => handleUpload(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{
            width: '100%', maxWidth: 300, margin: '12px auto 0', display: 'flex',
            padding: '12px', background: A.ink, color: '#fff', border: 'none',
            borderRadius: A.rSm, fontSize: 14, fontWeight: 600, cursor: uploading ? 'default' : 'pointer',
            fontFamily: A.font, alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {uploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={16} />}
            {uploading ? 'Uploading...' : `Capture ${selectedPose} photo`}
          </button>
        </div>
      )}

      {/* Photo comparison slider */}
      {hasComparison && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: A.ink3, textTransform: 'uppercase', marginBottom: 8 }}>
            Compare progress
          </div>
          <div style={{
            position: 'relative', width: '100%', maxWidth: 300, margin: '0 auto',
            aspectRatio: '3 / 4', borderRadius: A.rSm, overflow: 'hidden', background: '#000',
          }}>
            {/* First photo (background) */}
            <img src={frontPhotos[0].public_url} alt="Start" style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            }} />
            {/* Latest photo (overlay with opacity) */}
            <img src={frontPhotos[frontPhotos.length - 1].public_url} alt="Latest" style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              opacity: overlayOpacity / 100,
            }} />
            {/* Labels */}
            <div style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', background: 'rgba(0,0,0,0.6)', borderRadius: 6, fontSize: 10, color: '#fff', fontWeight: 600 }}>
              {new Date(frontPhotos[0].taken_at).toLocaleDateString()}
            </div>
            <div style={{ position: 'absolute', top: 8, right: 8, padding: '2px 8px', background: 'rgba(0,0,0,0.6)', borderRadius: 6, fontSize: 10, color: '#fff', fontWeight: 600 }}>
              {new Date(frontPhotos[frontPhotos.length - 1].taken_at).toLocaleDateString()}
            </div>
          </div>
          {/* Opacity slider */}
          <div style={{ maxWidth: 300, margin: '8px auto 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: A.ink3 }}>Before</span>
            <input type="range" min="0" max="100" value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, color: A.ink3 }}>After</span>
          </div>
        </div>
      )}

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ aspectRatio: '3 / 4', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
              <img src={p.public_url} alt={p.pose} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 4, left: 4, padding: '1px 6px', background: 'rgba(0,0,0,0.6)', borderRadius: 4, fontSize: 9, color: '#fff', fontWeight: 600, textTransform: 'capitalize' }}>
                {p.pose}
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && !loading && !showCapture && (
        <div style={{ textAlign: 'center', padding: 16, color: A.ink3, fontSize: 14 }}>
          Take your first progress photo to start tracking visual changes.
        </div>
      )}
    </Card>
  )
}

function BodyMeasurementsSection({ traineeId }) {
  const [measurements, setMeasurements] = useState([])
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load history
  useEffect(() => {
    if (!traineeId) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/trainer/my-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_body_measurements' }),
        })
        if (cancelled || !res.ok) return
        const data = await res.json()
        setMeasurements(data.measurements || [])
      } catch { /* */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [traineeId])

  async function handleSave() {
    const hasAny = BODY_FIELDS.some((f) => draft[f.key] && String(draft[f.key]).trim() !== '')
    if (!hasAny) return
    setSaving(true)
    try {
      const body = { action: 'log_body_measurements' }
      for (const f of BODY_FIELDS) {
        if (draft[f.key] && String(draft[f.key]).trim() !== '') body[f.key] = Number(draft[f.key])
      }
      const res = await fetch('/api/trainer/my-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setDraft({}); setSaved(true); setShowForm(false)
        setTimeout(() => setSaved(false), 3000)
        // Reload
        const res2 = await fetch('/api/trainer/my-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_body_measurements' }),
        })
        if (res2.ok) { const d = await res2.json(); setMeasurements(d.measurements || []) }
      }
    } catch { /* */ }
    finally { setSaving(false) }
  }

  // Build chart data — pick the most commonly logged fields
  const chartFields = useMemo(() => {
    if (measurements.length < 2) return []
    const counts = {}
    for (const m of measurements) {
      for (const f of BODY_FIELDS) {
        if (m[f.key] != null) counts[f.key] = (counts[f.key] || 0) + 1
      }
    }
    return BODY_FIELDS.filter((f) => (counts[f.key] || 0) >= 2).slice(0, 6)
  }, [measurements])

  const chartData = useMemo(() => {
    return measurements.map((m) => {
      const d = { date: (m.measured_at || '').slice(5, 10) }
      for (const f of chartFields) d[f.key] = m[f.key] ?? null
      return d
    })
  }, [measurements, chartFields])

  const CHART_COLORS = ['#e9695c', '#5aa0ff', '#7c3aed', '#059669', '#d97706', '#0891b2']

  // Latest vs first comparison
  const changes = useMemo(() => {
    if (measurements.length < 2) return []
    const first = measurements[0]
    const last = measurements[measurements.length - 1]
    return BODY_FIELDS.map((f) => {
      const start = first[f.key]
      const end = last[f.key]
      if (start == null || end == null) return null
      const diff = Number(end) - Number(start)
      return { label: f.label, start: Number(start), end: Number(end), diff }
    }).filter(Boolean)
  }, [measurements])

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionLabel>Body measurements</SectionLabel>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 12, fontWeight: 600, color: A.green }}>Saved</span>}
          <button type="button" onClick={() => setShowForm(!showForm)} style={{
            padding: '6px 14px', background: showForm ? A.ink : A.card,
            color: showForm ? '#fff' : A.ink2, border: `1px solid ${A.border}`,
            borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: A.font,
          }}>
            {showForm ? 'Cancel' : '+ Log measurements'}
          </button>
        </div>
      </div>

      {/* Input form */}
      {showForm && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: A.ink3, marginBottom: 10 }}>Enter measurements in inches. Leave blank any you did not measure.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {BODY_FIELDS.map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: 11, fontWeight: 600, color: A.ink3, marginBottom: 3 }}>{f.label}</div>
                <input type="number" inputMode="decimal" step="0.25" value={draft[f.key] || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  placeholder="in"
                  style={{
                    width: '100%', padding: '8px 10px', fontSize: 15, fontWeight: 600,
                    border: `1px solid ${A.border}`, borderRadius: 8,
                    background: A.cardAlt, color: A.ink, fontFamily: A.font,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
          <button type="button" onClick={handleSave} disabled={saving} style={{
            width: '100%', marginTop: 12, padding: '12px',
            background: saving ? A.ink3 : A.ink, color: '#fff', border: 'none',
            borderRadius: A.rSm, fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
            fontFamily: A.font, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Save measurements
          </button>
        </div>
      )}

      {/* Changes summary */}
      {changes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: A.ink3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Changes since first measurement
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
            {changes.map((c) => (
              <div key={c.label} style={{
                padding: '8px 10px', background: A.cardAlt, borderRadius: 8,
              }}>
                <div style={{ fontSize: 11, color: A.ink3, marginBottom: 2 }}>{c.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: A.ink }}>{c.end}"</div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: c.diff > 0 ? '#059669' : c.diff < 0 ? '#e9695c' : A.ink3,
                }}>
                  {c.diff > 0 ? '+' : ''}{c.diff.toFixed(1)}"
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Measurement charts */}
      {chartFields.length > 0 && chartData.length > 1 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: A.ink3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Measurement trends
          </div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: A.ink3 }} tickLine={false} axisLine={{ stroke: A.border }} />
                <YAxis tick={{ fontSize: 11, fill: A.ink3 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 8, fontSize: 13, fontFamily: A.font }} />
                {chartFields.map((f, i) => (
                  <Line key={f.key} type="monotone" dataKey={f.key} name={f.label}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2}
                    dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' }}>
            {chartFields.map((f, i) => (
              <span key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: A.ink3 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {f.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {measurements.length === 0 && !loading && !showForm && (
        <div style={{ textAlign: 'center', padding: 16, color: A.ink3, fontSize: 14 }}>
          No measurements logged yet. Tap the button above to start tracking.
        </div>
      )}
    </Card>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  SETTINGS TAB
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
//  LEARN TAB — Dictionary + FAQ
// ═════════════════════════════════════════════════════════════════════════════

const DICTIONARY = [
  { term: 'BMR', simple: 'Basal Metabolic Rate', explain: 'How many calories your body burns just staying alive — breathing, pumping blood, keeping your brain running. Even if you laid in bed all day, this is what you\'d burn.' },
  { term: 'TDEE', simple: 'Total Daily Energy Expenditure', explain: 'Your BMR plus all the calories you burn from moving around, training, playing sports, and just living your life. This is the real number that determines if you gain or lose weight.' },
  { term: 'Macros', simple: 'Macronutrients', explain: 'The three main types of fuel your body uses: protein (builds muscle), carbs (energy for training and games), and fat (hormones, brain function, joint health). Getting the right balance matters more than just calories.' },
  { term: 'Protein', simple: 'Muscle-building fuel', explain: 'The nutrient that repairs and builds your muscles after training. Think chicken, eggs, beef, fish, Greek yogurt. Athletes need more than regular people — usually around 1 gram per pound of body weight.' },
  { term: 'Caloric Surplus', simple: 'Eating more than you burn', explain: 'When you eat more calories than your body uses. This is how you gain weight and build muscle. To put on size, you need to be in a surplus — usually 300-500 extra calories per day.' },
  { term: 'Caloric Deficit', simple: 'Eating less than you burn', explain: 'When you eat fewer calories than your body uses. This is how you lose fat. Your body makes up the difference by burning stored fat for energy.' },
  { term: 'RPE', simple: 'Rate of Perceived Exertion', explain: 'A 1-10 scale of how hard a set felt. RPE 7 means you had about 3 reps left in the tank. RPE 9 means you barely got it. RPE 10 means absolute max effort. We use this to make sure you\'re training hard enough but not burning out.' },
  { term: 'Progressive Overload', simple: 'Doing a little more each time', explain: 'The #1 rule of getting stronger: you have to gradually increase the challenge. Add 5 lbs, do 1 more rep, or do 1 more set. If you do the same thing every week, your body stops adapting.' },
  { term: 'Periodization', simple: 'Training in phases', explain: 'Splitting your training into blocks (usually 3-4 weeks each) where each block has a different focus. Phase 1 might be building a base, Phase 2 adds intensity, Phase 3 peaks for your season. This prevents burnout and keeps you improving.' },
  { term: 'Hypertrophy', simple: 'Muscle growth', explain: 'Training specifically to make muscles bigger. Usually means 3-4 sets of 8-12 reps with moderate weight. It\'s not just about strength — bigger muscles look better AND perform better.' },
  { term: 'Compound Movement', simple: 'Exercises that work multiple muscles', explain: 'Exercises like squats, deadlifts, bench press, and pull-ups that hit several muscle groups at once. These give you the most bang for your buck and are the foundation of any good program.' },
  { term: 'Isolation Movement', simple: 'Exercises that target one muscle', explain: 'Exercises like bicep curls, tricep extensions, or calf raises that focus on a single muscle. Good for bringing up weak areas after you\'ve done your compound work.' },
  { term: 'Deload', simple: 'A planned easy week', explain: 'A week where you intentionally train lighter (50-60% of normal). It lets your body recover, repair, and come back stronger. Think of it like a rest day for your whole week. Usually every 4-6 weeks.' },
  { term: 'Velo', simple: 'Velocity (pitch speed)', explain: 'How fast your pitch is moving when it reaches the plate, measured in mph. "Sitting velo" is your average speed. "Peak velo" is your hardest throw. College scouts care about both.' },
  { term: 'Exit Velo', simple: 'How hard you hit the ball', explain: 'The speed of the ball coming off your bat, measured in mph. Higher exit velo = harder contact = more base hits and extra-base hits. It\'s the #1 offensive measurable scouts look at.' },
  { term: '60-Yard Dash', simple: 'Speed test for baseball', explain: 'The standard speed test in baseball — sprint 60 yards as fast as you can. Under 7.0 seconds is elite for high schoolers. Scouts use this to evaluate baserunning and outfield range.' },
  { term: 'Pop Time', simple: 'Catcher throw-down speed', explain: 'The time from when the pitch hits your glove to when the ball arrives at second base. A good high school pop time is under 2.0 seconds. College-level is 1.9 or better.' },
  { term: 'Long Toss', simple: 'Throwing far to build arm strength', explain: 'A throwing program where you gradually increase distance (up to 200+ feet) to build arm strength and endurance. It\'s like cardio for your arm. Most pitching coaches recommend it 2-3 times per week.' },
  { term: 'Rotational Power', simple: 'How explosively you can twist', explain: 'The ability to generate force by rotating your hips and torso. This is what drives both pitching velocity and bat speed. Exercises like med ball throws and cable chops build it.' },
  { term: 'Posterior Chain', simple: 'The muscles on the back of your body', explain: 'Your glutes (butt), hamstrings (back of thighs), and lower back. These are the power muscles for sprinting, jumping, and throwing. Most athletes are weak here compared to their front side.' },
  { term: 'Scapular Stability', simple: 'Shoulder blade control', explain: 'How well the muscles around your shoulder blades hold them in position during throwing and lifting. Weak scap stability = shoulder injuries waiting to happen. Face pulls, band pull-aparts, and rows build it.' },
]

const FAQ = [
  { q: 'How many calories should I eat?', a: 'It depends on your age, size, activity level, and goal. Your plan has a specific calorie target calculated for you. The general rule: eat more than you burn to gain muscle, less to lose fat. Check your Meals tab for your daily target.' },
  { q: 'How much protein do I need?', a: 'For athletes building muscle, aim for about 1 gram of protein per pound of body weight per day. So if you\'re 150 lbs, that\'s ~150g of protein. Spread it across 4-5 meals. Chicken, eggs, beef, fish, Greek yogurt, and protein shakes are your best sources.' },
  { q: 'Can I gain muscle and lose fat at the same time?', a: 'Yes, especially if you\'re a teenager or just starting to train seriously. It\'s called "recomp." Eat at maintenance calories (not too much, not too little), hit your protein target, and train hard. It\'s slower than bulking, but it works.' },
  { q: 'How do I throw harder?', a: 'Velocity comes from three things: (1) lower body power — hip drive and leg strength, (2) rotational power — core and torso, (3) arm health and mechanics. Squats, deadlifts, med ball throws, and a consistent long-toss program are the foundation. Gaining 10-15 lbs of muscle usually adds 3-5 mph.' },
  { q: 'How do I increase my exit velo?', a: 'Exit velo = bat speed + quality of contact. Train rotational power (cable chops, med ball slams), build your legs and core (squats, lunges), and get stronger overall. Heavier bat? No — swing a normal bat faster. Bat speed drills with underload/overload bats help too.' },
  { q: 'Should I lift heavy or light?', a: 'Both, at different times. Heavy (3-5 reps) builds strength. Moderate (8-12 reps) builds muscle size. Light (15-20 reps) builds endurance. Your plan phases through all of these. For most teen athletes, moderate weight with good form is the sweet spot.' },
  { q: 'My arm is sore — should I still throw?', a: 'Stop. Arm soreness is your body telling you something. Rest it, ice it, and see a doctor or athletic trainer if it doesn\'t go away in 2-3 days. Playing through arm pain is how you end up with serious injuries. We can adjust your plan to work around it.' },
  { q: 'How much sleep do I need?', a: 'Teenagers need 8-10 hours. Sleep is when your body builds muscle, repairs tissue, and consolidates motor learning (throwing mechanics, swing adjustments). Bad sleep = bad recovery = slower gains. It\'s not optional — it\'s part of training.' },
  { q: 'What should I eat before a game?', a: 'A meal 2-3 hours before: lean protein + complex carbs + low fat. Example: chicken breast with rice and vegetables. Then a small snack 30-60 minutes before: banana, granola bar, or toast with peanut butter. Avoid anything heavy, greasy, or high-fiber right before playing.' },
  { q: 'What supplements should I take?', a: 'For teen athletes: a basic multivitamin and creatine monohydrate (5g/day) are the only supplements with strong evidence. Creatine is safe, well-studied, and helps with strength and power. Everything else — pre-workout, BCAAs, fat burners — is either unnecessary or not appropriate for your age. Talk to your doctor first.' },
  { q: 'How do college coaches find me?', a: 'They don\'t find you — you find them. Email coaches directly with your highlight video, stats, and academic info. Attend camps and showcases at schools you\'re interested in. Register with the NCAA Eligibility Center. Your ProPath Score in the Recruiting tab shows which programs fit your measurables.' },
  { q: 'What\'s a good GPA for recruiting?', a: 'D1 programs generally want 3.0+. D2 and D3 are more flexible. JUCO has minimal requirements. But higher GPA = more options and more academic scholarship money to stack on top of athletic aid. Grades are leverage — don\'t ignore them.' },
]

function LearnTab() {
  const [searchTerm, setSearchTerm] = useState('')
  const [openFaq, setOpenFaq] = useState(null)

  const filteredDict = searchTerm
    ? DICTIONARY.filter((d) =>
        d.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.simple.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.explain.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : DICTIONARY

  const filteredFaq = searchTerm
    ? FAQ.filter((f) =>
        f.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.a.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : FAQ

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: A.ink, letterSpacing: '-0.02em' }}>
        Learn
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: A.ink3, lineHeight: 1.5 }}>
        Everything explained in plain English. No jargon. Search or scroll to learn what any term means.
      </p>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={18} color={A.ink3} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search terms or questions..."
          style={{
            width: '100%', padding: '12px 14px 12px 42px', fontSize: 15,
            border: `1px solid ${A.border}`, borderRadius: A.rSm,
            background: A.card, color: A.ink, fontFamily: A.font,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Dictionary */}
      <Card>
        <SectionLabel>Dictionary</SectionLabel>
        <div style={{ display: 'grid', gap: 2 }}>
          {filteredDict.map((d) => (
            <div key={d.term} style={{
              padding: '14px 16px', borderRadius: A.rSm,
              background: A.cardAlt, marginBottom: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: A.accent }}>{d.term}</span>
                <span style={{ fontSize: 13, color: A.ink3 }}>— {d.simple}</span>
              </div>
              <div style={{ fontSize: 14, color: A.ink2, lineHeight: 1.6 }}>
                {d.explain}
              </div>
            </div>
          ))}
          {filteredDict.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: A.ink3, fontSize: 14 }}>
              No terms match &ldquo;{searchTerm}&rdquo;
            </div>
          )}
        </div>
      </Card>

      {/* FAQ */}
      <Card>
        <SectionLabel>Frequently Asked Questions</SectionLabel>
        <div style={{ display: 'grid', gap: 2 }}>
          {filteredFaq.map((f, i) => {
            const isOpen = openFaq === i
            return (
              <div key={i} style={{ marginBottom: 4 }}>
                <button type="button" onClick={() => setOpenFaq(isOpen ? null : i)} style={{
                  width: '100%', textAlign: 'left', padding: '14px 16px',
                  background: isOpen ? A.accentBg : A.cardAlt,
                  border: `1px solid ${isOpen ? A.accent + '20' : 'transparent'}`,
                  borderRadius: isOpen ? `${A.rSm}px ${A.rSm}px 0 0` : A.rSm,
                  cursor: 'pointer', fontFamily: A.font,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: A.ink }}>{f.q}</span>
                  {isOpen ? <ChevronUp size={18} color={A.ink3} /> : <ChevronDown size={18} color={A.ink3} />}
                </button>
                {isOpen && (
                  <div style={{
                    padding: '14px 16px', background: A.card,
                    border: `1px solid ${A.accent}20`, borderTop: 'none',
                    borderRadius: `0 0 ${A.rSm}px ${A.rSm}px`,
                    fontSize: 14, color: A.ink2, lineHeight: 1.7,
                  }}>
                    {f.a}
                  </div>
                )}
              </div>
            )
          })}
          {filteredFaq.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: A.ink3, fontSize: 14 }}>
              No questions match &ldquo;{searchTerm}&rdquo;
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

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
