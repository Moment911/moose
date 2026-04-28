"use client"
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Send, Check, Circle, Camera, Pencil, RefreshCw, Bookmark, Map as MapIcon, Dumbbell, BookOpen, Timer, GraduationCap, ExternalLink, Salad, ClipboardCheck, PauseCircle } from 'lucide-react'
import { PageHeader, PrimaryCTA } from '../../components/trainer/aesthetic'
import { cmToFeetInches, kgToLbs } from '../../lib/trainer/units'
import { supabase } from '../../lib/supabase'

// Cal-AI tokens — warm neutral palette
const INK = '#0a0a0a'
const INK2 = '#1f1f22'
const INK3 = '#6b6b70'
const ACCENT = '#d89a6a'
const ACCENT_BG = 'rgba(216,154,106,0.10)'
const GRN = '#10b981'
const RED = '#e9695c'
const BRD = '#ececef'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"

// ─────────────────────────────────────────────────────────────────────────────
// /intake/:traineeId — unique intake link for trainer-added clients.
//
// No auth required.  The traineeId in the URL acts as the token (same pattern
// as /onboard/:clientId).  Chat on the left, live card on the right.
// Fields save to the trainee row in real-time so the trainer sees progress.
// On completion → plan generation → "Done" screen.
// ─────────────────────────────────────────────────────────────────────────────

const BG = '#ffffff'

// Hard minimum required for a SAFE, TARGETED plan. Everything else is
// optional — the coach still asks about lifestyle, diet, recruiting,
// workload in chat, but missing answers don't block Generate. The
// server validator + Sonnet prompts handle the gaps with reasonable
// defaults (moderate activity, 7 hrs sleep, no-preference diet, etc.).
// A partial plan beats a dead-end "answer 4 more questions".
const CORE_REQUIRED = [
  'about_you',             // prompts need context
  'age', 'sex',            // calorie + training-load calc
  'height_cm', 'current_weight_kg', // BMR + macros
  'primary_goal',          // what to aim for
  'training_days_per_week', 'equipment_access', // what to program
  'medical_flags', 'injuries', // safety — never skip these
]

function getRequiredFields(_services) {
  return [...CORE_REQUIRED]
}

// Kept for the in-file iterators (findNextMissingField walks this to
// pick the next missing CHAT question). Includes diet fields so the
// coach naturally asks about meals/diet, even though they're optional.
const REQUIRED_FIELDS = [...CORE_REQUIRED, 'dietary_preference', 'meals_per_day']

function getMissing(extracted, services) {
  const required = getRequiredFields(services)
  const missing = []
  for (const f of required) {
    const v = extracted[f]
    if (v === null || v === undefined) { missing.push(f); continue }
    if (typeof v === 'string' && v.trim().length === 0) { missing.push(f); continue }
    if (typeof v === 'number' && !Number.isFinite(v)) { missing.push(f); continue }
  }
  return missing
}

// Smart fallback when model returns tool data but no text.
// Looks at what fields just changed and what's still missing, then
// generates a natural follow-up question.
// Each field has a question + optional pill buttons for quick answers
const FIELD_QUESTIONS = {
  height_cm: { q: "How tall are you? (feet and inches)" },
  current_weight_kg: { q: "What do you weigh? (in pounds)" },
  sex: { q: "Male or female?", pills: ["Male", "Female", "Other"] },
  training_experience_years: { q: "How long have you been training?", pills: ["Less than 1 year", "1-2 years", "3-5 years", "5+ years"] },
  training_days_per_week: { q: "How many days a week can you train?", pills: ["2", "3", "4", "5", "6"] },
  equipment_access: { q: "What equipment do you have access to?", pills: ["Full gym", "Home gym", "Bands only", "No equipment"] },
  medical_flags: { q: "Any medical conditions I should know about?", pills: ["None", "Yes — let me explain"] },
  injuries: { q: "Any current or past injuries?", pills: ["None", "Yes — let me explain"] },
  dietary_preference: { q: "Any dietary preferences?", pills: ["No preference", "Vegetarian", "Vegan", "Keto", "Paleo"] },
  allergies: { q: "Any food allergies?", pills: ["None", "Yes — let me explain"] },
  sleep_hours_avg: { q: "How many hours do you sleep a night?", pills: ["5-6", "7", "8", "9+"] },
  stress_level: { q: "Stress level, 1-10?", pills: ["1-3 (low)", "4-6 (moderate)", "7-8 (high)", "9-10 (very high)"] },
  occupation_activity: { q: "How active is your day outside of training?", pills: ["Desk/school", "Light activity", "On my feet", "Physical labor"] },
  meals_per_day: { q: "How many meals do you eat a day?", pills: ["3", "4", "5", "6"] },
  // Recruiting
  grad_year: { q: "What year do you graduate?", pills: ["2026", "2027", "2028", "2029"] },
  position_primary: { q: "What's your primary position?", pills: ["RHP", "LHP", "C", "SS", "2B", "3B", "1B", "OF"] },
  throwing_hand: { q: "Do you throw right or left?", pills: ["Right", "Left"] },
  batting_hand: { q: "Do you bat right, left, or switch?", pills: ["Right", "Left", "Switch"] },
  gpa: { q: "What's your current GPA?" },
  fastball_velo_peak: { q: "Do you know your peak fastball velocity?" },
  exit_velo: { q: "Do you know your exit velocity?", pills: ["Not sure — skip"] },
  sixty_time: { q: "Have you been timed in a 60-yard dash?", pills: ["Not sure — skip"] },
  high_school: { q: "What high school do you go to?" },
  travel_team: { q: "Do you play for a travel team?" },
  video_link: { q: "Do you have a highlight video link?", pills: ["Not yet"] },
  // Workload
  club_team: { q: "What club or travel team do you play for?" },
  practices_per_week: { q: "How many practices per week — HS and travel combined?", pills: ["2-3", "4-5", "6+"] },
  bullpen_sessions_per_week: { q: "How many bullpen sessions per week?", pills: ["1", "2", "3+"] },
  game_appearances_per_week: { q: "How many games do you pitch per week in-season?", pills: ["1", "2", "3+"] },
  avg_pitch_count: { q: "Average pitch count per outing?", pills: ["40-60", "60-80", "80-100", "100+"] },
  pitch_arsenal: { q: "What pitches do you throw?", pills: ["FB only", "FB + CB", "FB + SL", "FB + CH", "3+ pitches"] },
  long_toss_routine: { q: "Do you have a long-toss routine?", pills: ["Yes", "No", "Sometimes"] },
  arm_soreness: { q: "Any arm soreness or fatigue?", pills: ["None", "Sometimes after games", "Frequent", "Currently sore"] },
  games_per_week: { q: "Total games per week in-season?", pills: ["2-3", "4-5", "6+"] },
  offseason_training: { q: "What do you do in the off-season?", pills: ["Lift + throw", "Just throw", "Nothing structured"] },
  other_sports: { q: "Do you play other sports?", pills: ["Baseball only", "Yes — let me list them"] },
}

const ACKNOWLEDGMENTS = [
  "Got it.", "Noted.", "Okay, good.", "Perfect.", "Thanks.",
  "Locked in.", "That helps.", "Good to know.", "Check.",
]

// Single source of truth for "what should we ask next" — shared by the
// fallback-text generator and the pill-picker so they always agree.
function findNextMissingField(currentExtracted, services) {
  const allFields = [...REQUIRED_FIELDS]
  allFields.push('club_team', 'practices_per_week', 'bullpen_sessions_per_week', 'game_appearances_per_week', 'avg_pitch_count', 'pitch_arsenal', 'arm_soreness', 'games_per_week', 'offseason_training', 'other_sports')
  if (services?.includes('recruiting')) {
    allFields.push('grad_year', 'position_primary', 'throwing_hand', 'batting_hand', 'gpa', 'fastball_velo_peak', 'high_school', 'travel_team')
  }
  for (const f of allFields) {
    const v = currentExtracted[f]
    if ((v === undefined || v === null || v === '') && FIELD_QUESTIONS[f]) {
      return f
    }
  }
  return null
}

function buildSmartFallback(prevExtracted, currentExtracted, services) {
  const nextField = findNextMissingField(currentExtracted, services)
  const ack = ACKNOWLEDGMENTS[Math.floor(Math.random() * ACKNOWLEDGMENTS.length)]
  const fieldDef = nextField ? FIELD_QUESTIONS[nextField] : null
  return {
    text: fieldDef ? `${ack} ${fieldDef.q}` : `${ack} Looking good — your profile is coming together. Anything else you want to add?`,
    pills: fieldDef?.pills || [],
  }
}

// Dev helper — visiting /intake/:id?preset=test prefills a complete,
// safe-to-train profile so you can hit Generate immediately without
// retyping every intake. Harmless in prod: it only fills extracted
// state, doesn't bypass validation, doesn't persist anything by itself.
const TEST_PRESET = {
  full_name: 'Test Athlete',
  age: 16,
  sex: 'M',
  height_cm: 180,
  current_weight_kg: 75,
  primary_goal: 'performance',
  training_experience_years: 2,
  training_days_per_week: 4,
  equipment_access: 'full_gym',
  medical_flags: 'None',
  injuries: 'None',
  dietary_preference: 'none',
  allergies: 'None',
  sleep_hours_avg: 8,
  stress_level: 4,
  occupation_activity: 'light',
  meals_per_day: 4,
  grad_year: 2028,
  position_primary: 'RHP',
  throwing_hand: 'R',
  batting_hand: 'R',
  gpa: 3.5,
  fastball_velo_peak: 84,
  high_school: 'Test HS',
  travel_team: 'Test Travel',
}
const TEST_ABOUT_YOU = "16 yo RHP, 5'11\", 165 lbs. Two years training, throwing low 80s. Want to add velocity and get recruited. Full gym access, 4 days a week. No injuries, sleep well, eat 4 meals a day."

export default function TraineeIntakePage() {
  const { traineeId } = useParams()
  const [phase, setPhase] = useState('loading') // loading | not_found | welcome | chat | generating | done
  const [trainee, setTrainee] = useState(null)
  const [agency, setAgency] = useState(null)
  const [extracted, setExtracted] = useState({})
  const [aboutYou, setAboutYou] = useState('')
  const [initialText, setInitialText] = useState('') // paragraph from welcome screen
  const [services, setServices] = useState([]) // ['training', 'diet', 'recruiting']
  const [generateError, setGenerateError] = useState(null)
  const [planResult, setPlanResult] = useState(null)
  const [planProgress, setPlanProgress] = useState({ activePhase: 'baseline', completed: [] })

  // Load trainee on mount.
  useEffect(() => {
    if (!traineeId) { setPhase('not_found'); return }
    // Dev helper: ?preset=test skips to chat with a complete profile.
    const usePreset = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preset') === 'test'
    supabase
      .from('koto_fitness_trainees')
      .select('*')
      .eq('id', traineeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setPhase('not_found'); return }
        setTrainee(data)
        if (usePreset) {
          setExtracted({ ...TEST_PRESET })
          setAboutYou(TEST_ABOUT_YOU)
          setServices(['training', 'diet', 'recruiting'])
          setPhase('chat')
          return
        }
        // Load agency for the "coach at {Agency}" framing + brand bits.
        supabase
          .from('agencies')
          .select('name, brand_name, brand_color, brand_logo_url, support_email')
          .eq('id', data.agency_id)
          .maybeSingle()
          .then(({ data: ag }) => {
            if (ag) setAgency({
              name: ag.brand_name || ag.name || null,
              brand_color: ag.brand_color || null,
              logo_url: ag.brand_logo_url || null,
              support_email: ag.support_email || null,
            })
          })
        // Pre-populate extracted from the full trainee row so anything the
        // trainer already entered on /trainer/:id — core, recruiting, and
        // workload fields — is treated as already collected.  Mirrors the
        // allowedFields set on the server (api/trainer/intake-chat-token).
        const INTAKE_KEYS = [
          // Core
          'full_name', 'age', 'sex', 'height_cm', 'current_weight_kg', 'target_weight_kg',
          'primary_goal', 'training_experience_years', 'training_days_per_week', 'equipment_access',
          'medical_flags', 'injuries', 'dietary_preference', 'allergies', 'sleep_hours_avg',
          'stress_level', 'occupation_activity', 'meals_per_day',
          // Recruiting
          'grad_year', 'position_primary', 'position_secondary', 'throwing_hand', 'batting_hand',
          'gpa', 'test_type', 'test_score', 'fastball_velo_peak', 'fastball_velo_sit',
          'exit_velo', 'sixty_time', 'pop_time', 'high_school', 'high_school_state',
          'travel_team', 'video_link', 'preferred_divisions', 'preferred_states', 'intended_major',
          // Workload
          'club_team', 'practices_per_week', 'bullpen_sessions_per_week', 'game_appearances_per_week',
          'avg_pitch_count', 'pitch_arsenal', 'long_toss_routine', 'arm_soreness',
          'games_per_week', 'offseason_training', 'other_sports',
        ]
        const pre = {}
        for (const k of INTAKE_KEYS) {
          const v = data[k]
          if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
            pre[k] = v
          }
        }
        setExtracted(pre)
        if (data.about_you) setAboutYou(data.about_you)
        // If plan already generated, show done screen.
        if (data.status === 'plan_generated') { setPhase('done'); return }
        // If they've already started the intake, go straight to chat.
        if (data.status === 'intake_started') { setPhase('chat'); return }
        setPhase('welcome')
      })
  }, [traineeId])

  const handleFieldsUpdate = useCallback((fields) => {
    setExtracted((prev) => {
      const next = { ...prev }
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined && v !== null && v !== '') next[k] = v
      }
      return next
    })
  }, [])

  const handleAboutYouAppend = useCallback((text) => {
    if (!text || !text.trim()) return
    setAboutYou((prev) => prev ? prev + ' ' + text.trim() : text.trim())
  }, [])

  async function handleGenerate() {
    setGenerateError(null)
    const payload = {
      ...extracted,
      about_you: aboutYou || extracted.about_you || '',
      full_name: extracted.full_name || trainee?.full_name || 'Athlete',
    }
    const missing = getMissing(payload, services)
    if (missing.length > 0) {
      setGenerateError(`Still missing: ${missing.join(', ')}.`)
      return
    }

    setPhase('generating')
    setPlanProgress({ activePhase: 'baseline', completed: [] })
    try {
      const res = await fetch('/api/trainer/intake-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainee_id: traineeId, intake: payload }),
      })
      if (!res.ok) {
        // Validation / early errors return JSON; stream path returns 200 OK.
        const errBody = await res.json().catch(() => ({}))
        setGenerateError(errBody?.error || `Failed (${res.status})`)
        setPhase('chat')
        return
      }
      const reader = res.body?.getReader()
      if (!reader) {
        setGenerateError('No stream available')
        setPhase('chat')
        return
      }
      const decoder = new TextDecoder()
      let buffer = ''
      let finalBody = null
      let streamError = null
      // Parse NDJSON: one event per line.
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          let event
          try { event = JSON.parse(line) } catch { continue }
          if (event.type === 'phase_start') {
            setPlanProgress((p) => ({ ...p, activePhase: event.phase }))
          } else if (event.type === 'phase_complete') {
            setPlanProgress((p) => ({
              activePhase: p.activePhase === event.phase ? event.phase : p.activePhase,
              completed: p.completed.includes(event.phase) ? p.completed : [...p.completed, event.phase],
            }))
          } else if (event.type === 'done') {
            finalBody = event
          } else if (event.type === 'error') {
            streamError = event.error || 'Plan generation failed'
          }
          // 'heartbeat' and 'start' events only keep the connection alive — no UI update.
        }
      }
      // If the stream died without a 'done' event (e.g. gateway closed
      // during the long playbook pass), the server may still have
      // persisted whatever phases finished. Poll intake-plan and salvage.
      async function recoverPartialPlan() {
        try {
          await new Promise((r) => setTimeout(r, 2500))
          const res2 = await fetch('/api/trainer/intake-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trainee_id: traineeId }),
          })
          const body = await res2.json().catch(() => ({}))
          const plan = body?.plan
          // Need at least a baseline — anything less isn't usable.
          if (plan?.baseline) {
            setPlanResult({
              baseline_ready: !!plan.baseline,
              roadmap_ready: !!plan.roadmap,
              workout_ready: !!plan.workout_plan,
              playbook_ready: !!plan.playbook,
              ok_to_train: plan.baseline?.training_readiness?.ok_to_train,
            })
            setPhase('done')
            return true
          }
        } catch {
          // fall through to error
        }
        return false
      }

      if (streamError) {
        if (await recoverPartialPlan()) return
        setGenerateError(streamError)
        setPhase('chat')
        return
      }
      if (!finalBody) {
        if (await recoverPartialPlan()) return
        setGenerateError('Plan generation stalled — please try again. Your answers are saved.')
        setPhase('chat')
        return
      }
      setPlanResult(finalBody)
      setPhase('done')
    } catch (e) {
      setGenerateError(e?.message || 'Network error')
      setPhase('chat')
    }
  }

  // about_you lives in its own state (not in `extracted`) — merge it in
  // before the completeness check so the ribbon button isn't wrongly
  // disabled on a profile where the welcome paragraph was already written.
  const missing = getMissing({ ...extracted, about_you: aboutYou || extracted.about_you }, services)

  if (phase === 'loading') return <CenteredSpinner label="Loading..." />
  if (phase === 'not_found') return <NotFoundScreen />
  if (phase === 'welcome') return <WelcomeScreen name={trainee?.full_name} onStart={(text, selectedServices) => { setInitialText(text); setServices(selectedServices); setPhase('chat') }} />
  if (phase === 'generating') return <GeneratingScreen progress={planProgress} />
  if (phase === 'done') return (
    <DoneScreen
      name={extracted.full_name || trainee?.full_name}
      agency={agency}
      planResult={planResult}
      traineeId={traineeId}
      onEditProfile={() => setPhase('chat')}
      onRegenerate={handleGenerate}
      regenerating={false}
    />
  )

  // Compute overall progress once so the ribbon + sidebar agree on the number.
  const fieldDefs = getFieldDefs(services)
  const filledCount = fieldDefs.filter(d => {
    const v = extracted[d.key]
    return v !== null && v !== undefined && v !== ''
  }).length
  const totalCount = fieldDefs.length
  const pct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0
  const allDone = missing.length === 0

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <ProgressRibbon
        filledCount={filledCount}
        totalCount={totalCount}
        pct={pct}
        allDone={allDone}
        onGenerate={handleGenerate}
        generating={phase === 'generating'}
        generateError={generateError}
      />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 16,
          alignItems: 'start',
        }}>
          {/* Chat */}
          <TokenChatWidget
            traineeId={traineeId}
            extracted={extracted}
            aboutYou={aboutYou}
            onFieldsUpdate={handleFieldsUpdate}
            onAboutYouAppend={handleAboutYouAppend}
            traineeName={trainee?.full_name || ''}
            initialText={initialText}
            services={services}
          />

          {/* Live card — desktop sidebar detail view */}
          <div style={{ position: 'sticky', top: 88 }}>
            <LiveCard
              extracted={extracted}
              missingFields={missing}
              onGenerate={handleGenerate}
              generating={phase === 'generating'}
              generateError={generateError}
              services={services}
            />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

// ── Sticky progress ribbon (top of chat view) ───────────────────────────────
// Always-visible progress + the "Finish & build my plan" CTA so trainees on
// mobile — where the sidebar collapses below the chat — always see what to do
// next.

function ProgressRibbon({ filledCount, totalCount, pct, allDone, onGenerate, generating, generateError }) {
  const label = 'Building your profile'
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: '#fff',
      borderBottom: '1px solid #ececef',
      boxShadow: '0 1px 2px rgba(0,0,0,.03)',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', minWidth: 220 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: INK, letterSpacing: '-.1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: allDone ? GRN : '#6b7280', flexShrink: 0 }}>
              {filledCount} of {totalCount} · {pct}%
            </span>
          </div>
          <div style={{ height: 4, background: '#f1f1f6', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: allDone ? GRN : ACCENT, borderRadius: 2, transition: 'width 0.4s ease' }} />
          </div>
        </div>
        <button
          onClick={onGenerate}
          disabled={!allDone || generating}
          style={{
            padding: '10px 18px',
            background: allDone ? INK : '#ececef',
            color: allDone ? '#fff' : '#9ca3af',
            border: 'none', borderRadius: 10,
            fontSize: 13, fontWeight: 800,
            cursor: allDone && !generating ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {generating ? 'Generating…' : allDone ? 'Finish & build my plan' : `${totalCount - filledCount} to go`}
        </button>
      </div>
      {generateError && (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 10px' }}>
          <div style={{ padding: '8px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>{generateError}</div>
        </div>
      )}
    </div>
  )
}

// ── Token-based chat widget (uses trainee_id auth, not JWT) ─────────────────

function TokenChatWidget({ traineeId, extracted, aboutYou, onFieldsUpdate, onAboutYouAppend, traineeName, initialText, services }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [quickReplies, setQuickReplies] = useState([]) // clickable option buttons
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, streamingText, quickReplies])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  // Track state for smart fallback.
  const lastTurnRef = useRef(null)
  const lastExtractedRef = useRef({})

  const streamTurn = useCallback(async (turnMessages) => {
    lastTurnRef.current = turnMessages
    lastExtractedRef.current = { ...extracted }
    setStreaming(true)
    setStreamingText('')
    setQuickReplies([])
    setError(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

    try {
      const res = await fetch('/api/trainer/intake-chat-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainee_id: traineeId,
          messages: turnMessages,
          // Merge aboutYou into the fields payload so the server persists
          // the welcome paragraph / running narrative on every turn, not
          // just at Generate time. Protects against mid-chat abandonment.
          extracted: aboutYou ? { ...extracted, about_you: aboutYou } : extracted,
          services: services || ['training'],
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error || `Error (${res.status})`)
        setStreaming(false)
        clearTimeout(timeout)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setError('No stream'); setStreaming(false); clearTimeout(timeout); return }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let replies = []
      let askingField = '' // Server-supplied: which field the coach just asked about
      let fieldsThisTurn = {} // Track fields extracted THIS turn for accurate fallback

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          let event
          try { event = JSON.parse(line) } catch { continue }
          if (event.type === 'text_delta' && typeof event.text === 'string') {
            fullText += event.text
            setStreamingText(fullText)
          }
          if (event.type === 'fields') {
            if (event.extracted && typeof event.extracted === 'object') {
              // Defensive: strip suggested_replies if the model mis-nests
              // it inside extracted (schema puts it at the top level, but
              // Haiku has been observed dumping it in extracted anyway).
              // Also: rescue the pills if that happens and top-level was
              // empty, so the trainee still sees the right buttons.
              const nestedPills = Array.isArray(event.extracted.suggested_replies)
                ? event.extracted.suggested_replies
                : null
              const nestedAsking = typeof event.extracted.asking_field === 'string' && event.extracted.asking_field
                ? event.extracted.asking_field
                : null
              const fieldsOnly = { ...event.extracted }
              delete fieldsOnly.suggested_replies
              delete fieldsOnly.asking_field
              onFieldsUpdate(fieldsOnly)
              fieldsThisTurn = { ...fieldsThisTurn, ...fieldsOnly }
              if (nestedPills && nestedPills.length > 0 && !Array.isArray(event.suggested_replies)) {
                replies = nestedPills
              }
              if (nestedAsking && !askingField) {
                askingField = nestedAsking
              }
            }
            if (event.about_you_append && typeof event.about_you_append === 'string') onAboutYouAppend(event.about_you_append)
            if (Array.isArray(event.suggested_replies) && event.suggested_replies.length > 0) {
              replies = event.suggested_replies
            }
            if (typeof event.asking_field === 'string' && event.asking_field) {
              askingField = event.asking_field
            }
          }
          if (event.type === 'error') setError(event.error || 'Stream error')
        }
      }

      clearTimeout(timeout)

      // Pill selection.  Priority:
      //   1. Server-supplied suggested_replies (if non-empty) — always win.
      //   2. Rescue via askingField: server told us which field it asked
      //      about; if that field has hand-curated pills, use them.  This
      //      catches Haiku dropping suggested_replies for mapped fields.
      //   3. Fallback (no model text at all): we generated the question, so
      //      we know which field it's about and use its pills.
      // setQuickReplies always fires so stale pills from a prior turn can
      // never persist into this one.
      let pillsToShow = []
      if (fullText) {
        setMessages((prev) => [...prev, { role: 'assistant', content: fullText }])
        if (replies.length > 0) {
          pillsToShow = replies
        } else if (askingField && FIELD_QUESTIONS[askingField]?.pills?.length > 0) {
          pillsToShow = FIELD_QUESTIONS[askingField].pills
        }
      } else {
        const mergedExtracted = { ...extracted, ...fieldsThisTurn }
        const fallback = buildSmartFallback(lastExtractedRef.current, mergedExtracted, services)
        setMessages((prev) => [...prev, { role: 'assistant', content: fallback.text }])
        pillsToShow = fallback.pills || []
      }
      setQuickReplies(pillsToShow)
    } catch (e) {
      clearTimeout(timeout)
      if (e?.name === 'AbortError') {
        setError('Response took too long. Tap retry to try again.')
      } else {
        setError(e?.message || 'Network error')
      }
    }
    setStreamingText('')
    setStreaming(false)
  }, [traineeId, extracted, onFieldsUpdate, onAboutYouAppend])

  function handleRetry() {
    if (lastTurnRef.current) streamTurn(lastTurnRef.current)
  }

  // On mount: send the initial paragraph as the first user message.
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    if (initialText && initialText.trim()) {
      const userMsg = { role: 'user', content: initialText.trim() }
      setMessages([userMsg])
      streamTurn([userMsg])
    } else {
      streamTurn([])
    }
  }, [streamTurn, initialText])

  function sendText(text) {
    if (!text.trim() || streaming) return
    setInput('')
    setQuickReplies([])
    const userMsg = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    streamTurn(newMessages)
    // Keep cursor in textarea for quick follow-up typing
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function handleSend() { sendText(input) }

  function handleQuickReply(text) { sendText(text) }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #ececef', borderRadius: 12, overflow: 'hidden', height: '100%', minHeight: 500 }}>
      <div style={{ padding: '12px 16px', background: INK, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>K</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT }}>Your Coach</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Building your profile</div>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)}
        {streaming && streamingText && <Bubble role="assistant" content={streamingText} />}
        {streaming && !streamingText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 13 }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Thinking...
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          </div>
        )}
        {error && (
          <div style={{ padding: '8px 10px', background: '#fee2e2', borderRadius: 8, fontSize: 12, color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>{error}</span>
            <button onClick={handleRetry} disabled={streaming} style={{ padding: '4px 10px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#991b1b', cursor: 'pointer', whiteSpace: 'nowrap' }}>Retry</button>
          </div>
        )}

        {/* Quick reply buttons + Answer later */}
        {!streaming && messages.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {quickReplies.map((reply, i) => (
              <button key={i} onClick={() => handleQuickReply(reply)}
                style={{
                  padding: '8px 14px', border: `1px solid ${INK}`, borderRadius: 20,
                  background: '#fff', color: ACCENT, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = INK; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = INK }}
              >
                {reply}
              </button>
            ))}
            <button onClick={() => handleQuickReply("I'll answer that later — skip for now")}
              style={{
                padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 20,
                background: '#fff', color: '#6b7280', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f1f1f6' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
            >
              Answer later →
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f6', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type your answer..." rows={1} disabled={streaming}
          style={{ flex: 1, padding: '10px 12px', fontSize: 14, border: '1px solid #ececef', borderRadius: 10, resize: 'none', fontFamily: 'inherit', lineHeight: 1.4, color: INK, outline: 'none' }} />
        <button onClick={handleSend} disabled={!input.trim() || streaming}
          style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: input.trim() && !streaming ? INK : '#ececef', color: input.trim() && !streaming ? '#fff' : '#9ca3af', cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

function Bubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: isUser ? INK : '#f1f1f6', color: isUser ? '#fff' : INK, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {content}
      </div>
    </div>
  )
}

// ── Live card (inline — same as IntakeLiveCard but self-contained) ───────────

const GOAL_LABELS = { lose_fat: 'Lose fat', gain_muscle: 'Gain muscle', maintain: 'Maintain', performance: 'Performance', recomp: 'Recomp' }
const EQUIP_LABELS = { none: 'None', bands: 'Bands', home_gym: 'Home gym', full_gym: 'Full gym' }
const DIET_LABELS = { none: 'No preference', vegetarian: 'Vegetarian', vegan: 'Vegan', pescatarian: 'Pescatarian', keto: 'Keto', paleo: 'Paleo', custom: 'Custom' }
const OCC_LABELS = { sedentary: 'Sedentary', light: 'Light', moderate: 'Moderate', heavy: 'Heavy' }

const TRAINING_FIELDS = [
  { key: 'full_name', label: 'Name', section: 'basics' },
  { key: 'age', label: 'Age', suffix: ' yrs', section: 'basics' },
  { key: 'sex', label: 'Sex', map: { M: 'Male', F: 'Female', Other: 'Other' }, section: 'basics' },
  { key: 'height_cm', label: 'Height', format: 'height', section: 'basics' },
  { key: 'current_weight_kg', label: 'Weight', format: 'weight', section: 'basics' },
  { key: 'primary_goal', label: 'Goal', map: GOAL_LABELS, section: 'basics' },
  { key: 'training_experience_years', label: 'Experience', suffix: ' yrs', section: 'training' },
  { key: 'training_days_per_week', label: 'Days/week', suffix: ' days', section: 'training' },
  { key: 'equipment_access', label: 'Equipment', map: EQUIP_LABELS, section: 'training' },
  { key: 'medical_flags', label: 'Medical', section: 'health' },
  { key: 'injuries', label: 'Injuries', section: 'health' },
  { key: 'dietary_preference', label: 'Diet', map: DIET_LABELS, section: 'nutrition' },
  { key: 'allergies', label: 'Allergies', section: 'nutrition' },
  { key: 'sleep_hours_avg', label: 'Sleep', suffix: ' hrs', section: 'lifestyle' },
  { key: 'stress_level', label: 'Stress', suffix: '/10', section: 'lifestyle' },
  { key: 'occupation_activity', label: 'Activity', map: OCC_LABELS, section: 'lifestyle' },
  { key: 'meals_per_day', label: 'Meals/day', section: 'nutrition' },
]

const RECRUITING_FIELDS = [
  { key: 'grad_year', label: 'Grad Year', section: 'recruiting' },
  { key: 'position_primary', label: 'Position', section: 'recruiting' },
  { key: 'position_secondary', label: '2nd Position', section: 'recruiting' },
  { key: 'throwing_hand', label: 'Throws', map: { R: 'Right', L: 'Left' }, section: 'recruiting' },
  { key: 'batting_hand', label: 'Bats', map: { R: 'Right', L: 'Left', S: 'Switch' }, section: 'recruiting' },
  { key: 'gpa', label: 'GPA', section: 'academics' },
  { key: 'test_score', label: 'SAT/ACT', section: 'academics' },
  { key: 'fastball_velo_peak', label: 'FB Velo (peak)', suffix: ' mph', section: 'measurables' },
  { key: 'fastball_velo_sit', label: 'FB Velo (sit)', suffix: ' mph', section: 'measurables' },
  { key: 'exit_velo', label: 'Exit Velo', suffix: ' mph', section: 'measurables' },
  { key: 'sixty_time', label: '60-Yard Dash', suffix: ' sec', section: 'measurables' },
  { key: 'high_school', label: 'High School', section: 'recruiting' },
  { key: 'travel_team', label: 'Travel Team', section: 'recruiting' },
  { key: 'video_link', label: 'Video', format: 'link', section: 'recruiting' },
  { key: 'intended_major', label: 'Major', section: 'academics' },
]

const WORKLOAD_FIELDS = [
  { key: 'club_team', label: 'Club Team', section: 'workload' },
  { key: 'practices_per_week', label: 'Practices/wk', suffix: 'x', section: 'workload' },
  { key: 'bullpen_sessions_per_week', label: 'Bullpens/wk', suffix: 'x', section: 'workload' },
  { key: 'game_appearances_per_week', label: 'Game apps/wk', suffix: 'x', section: 'workload' },
  { key: 'avg_pitch_count', label: 'Avg pitches', section: 'workload' },
  { key: 'pitch_arsenal', label: 'Pitches', section: 'workload' },
  { key: 'long_toss_routine', label: 'Long toss', section: 'workload' },
  { key: 'arm_soreness', label: 'Arm soreness', section: 'workload' },
  { key: 'games_per_week', label: 'Games/wk', suffix: 'x', section: 'workload' },
  { key: 'offseason_training', label: 'Off-season', section: 'workload' },
  { key: 'other_sports', label: 'Other sports', section: 'workload' },
]

function getFieldDefs(services) {
  const fields = [...TRAINING_FIELDS]
  // Always show workload fields for baseball athletes
  fields.push(...WORKLOAD_FIELDS)
  if (services?.includes('recruiting')) fields.push(...RECRUITING_FIELDS)
  return fields
}

function fmtVal(def, v) {
  if (v === null || v === undefined || v === '') return null
  if (def.format === 'height') return cmToFeetInches(v)
  if (def.format === 'weight') return `${kgToLbs(v)} lbs`
  if (def.map) return def.map[v] || String(v)
  if (def.suffix) return `${v}${def.suffix}`
  return String(v)
}

const SECTION_LABELS = {
  basics: 'Basics',
  training: 'Training',
  health: 'Health',
  nutrition: 'Nutrition',
  lifestyle: 'Lifestyle',
  workload: 'Baseball Workload',
  recruiting: 'Recruiting',
  academics: 'Academics',
  measurables: 'Measurables',
}

function LiveCard({ extracted, missingFields, onGenerate, generating, generateError, services }) {
  const fieldDefs = getFieldDefs(services)
  const filledCount = fieldDefs.filter(d => {
    const v = extracted[d.key]
    return v !== null && v !== undefined && v !== ''
  }).length
  const totalCount = fieldDefs.length
  const allDone = missingFields.length === 0
  const pct = Math.round((filledCount / totalCount) * 100)

  // Group by section
  const sections = []
  let lastSection = null
  for (const def of fieldDefs) {
    if (def.section !== lastSection) {
      sections.push({ section: def.section, label: SECTION_LABELS[def.section] || def.section, fields: [] })
      lastSection = def.section
    }
    sections[sections.length - 1].fields.push(def)
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f1f1f6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: INK, letterSpacing: '.03em', textTransform: 'uppercase' }}>Your Profile</h3>
          <span style={{ fontSize: 12, fontWeight: 700, color: allDone ? GRN : '#6b7280' }}>{filledCount} / {totalCount}</span>
        </div>
        <div style={{ height: 4, background: '#f1f1f6', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: allDone ? GRN : ACCENT, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
      </div>
      <div style={{ padding: '4px 6px 10px', maxHeight: 500, overflowY: 'auto' }}>
        {sections.map((sec) => (
          <div key={sec.section}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 10px 2px' }}>
              {sec.label}
            </div>
            {sec.fields.map((def) => {
              const v = extracted[def.key]
              const display = fmtVal(def, v)
              const isFilled = display !== null
              return (
                <div key={def.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6 }}>
                  {isFilled ? <Check size={12} color={GRN} strokeWidth={3} /> : <Circle size={12} color="#d1d5db" strokeWidth={1.5} />}
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', minWidth: 75 }}>{def.label}</span>
                  <span style={{ fontSize: 12, fontWeight: isFilled ? 700 : 400, color: isFilled ? INK : '#d1d5db', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {def.format === 'link' && display ? <a href={display} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: 'none' }}>View →</a> : (display ?? '---')}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 16px 16px' }}>
        {generateError && <div style={{ marginBottom: 8, padding: '8px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>{generateError}</div>}
        <button onClick={onGenerate} disabled={!allDone || generating}
          style={{ width: '100%', padding: '14px 16px', background: allDone ? INK : '#ececef', color: allDone ? '#fff' : '#c8c8cc', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: allDone ? 'pointer' : 'not-allowed' }}>
          {generating ? 'Generating...' : 'Generate my plan'}
        </button>
        {!allDone && <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>{missingFields.length} field{missingFields.length !== 1 ? 's' : ''} remaining</div>}
      </div>
    </div>
  )
}

// ── Utility screens ─────────────────────────────────────────────────────────

function CenteredSpinner({ label }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: 14 }}><Loader2 size={16} /> {label}</div>
    </div>
  )
}

const SERVICE_OPTIONS = [
  { id: 'training', label: 'Training Plan', desc: 'Workout programming, mechanics, strength & conditioning, recovery', Icon: Dumbbell, default: true },
  { id: 'diet', label: 'Diet & Nutrition', desc: 'Meal plans, macros, recipes, fueling strategies', Icon: Salad },
  { id: 'recruiting', label: 'College Recruiting', desc: 'ProPath Score, school matching, coach outreach, recruiting timeline', Icon: GraduationCap },
]

const OUTCOME_CHIPS = {
  training: [
    { Icon: MapIcon, label: '90-day roadmap' },
    { Icon: Dumbbell, label: 'Custom workouts' },
    { Icon: BookOpen, label: 'Coaching playbook' },
  ],
  diet: [{ Icon: Salad, label: 'Custom nutrition' }],
  recruiting: [{ Icon: GraduationCap, label: 'ProPath recruiting score' }],
}

function WelcomeScreen({ name, onStart }) {
  const firstName = name ? name.split(' ')[0] : null
  const [text, setText] = useState('')
  const [selected, setSelected] = useState(['training'])
  const [error, setError] = useState(null)
  const [credentialsOpen, setCredentialsOpen] = useState(false)

  function toggleService(id) {
    if (id === 'training') return
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  function handleSubmit() {
    if (text.trim().length < 20) {
      setError('Share a couple sentences — the more you tell us here, the fewer questions we have to ask.')
      return
    }
    onStart(text, selected)
  }

  // Outcome chips reflect the services currently selected — so the trainee
  // sees "the prize" change in real time as they toggle add-ons.
  const outcomeChips = [
    ...OUTCOME_CHIPS.training,
    ...(selected.includes('diet') ? OUTCOME_CHIPS.diet : []),
    ...(selected.includes('recruiting') ? OUTCOME_CHIPS.recruiting : []),
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', padding: '0 20px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        <PageHeader
          title={firstName ? `${firstName}, let's build your plan.` : "Let's build your plan."}
          subtitle="A 5-minute conversation. Then a complete personalized program — training, nutrition, everything."
        />

        <div style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#fff', border: '1px solid #ececef', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#6b7280' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Timer size={12} strokeWidth={1.75} /> About 5 minutes</span>
          <span style={{ color: '#d1d5db' }}>·</span>
          <span>Pause & return anytime</span>
        </div>

        <section style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 16, padding: '22px 22px 20px', marginBottom: 14 }}>

          {/* Credentials — AI modeled after an expert stack */}
          <div style={{ marginBottom: 18 }}>
            <button
              type="button"
              onClick={() => setCredentialsOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 12px',
                background: '#f9fafb', border: '1px solid #ececef', borderRadius: 8,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <GraduationCap size={14} strokeWidth={1.75} color="#0a0a0a" />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#374151' }}>
                AI tool modeled after a PhD + ex-MLB + pro-coach expert stack
              </span>
              <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>
                {credentialsOpen ? 'Hide' : "Who's inside?"} {credentialsOpen ? '▴' : '▾'}
              </span>
            </button>
            {credentialsOpen && (
              <ul style={{ margin: '8px 0 0', padding: '10px 14px 10px 28px', background: '#f9fafb', border: '1px solid #ececef', borderRadius: 8, color: '#374151', fontSize: 12, lineHeight: 1.6 }}>
                <li><strong>PhD in Biomechanics</strong> — throwing mechanics, swing, movement</li>
                <li><strong>PhD in Nutrition</strong> — macros + fueling for athletes</li>
                <li><strong>PhD in Strength & Conditioning</strong> — periodization, power</li>
                <li><strong>PhD in Exercise Physiology</strong> — recovery, injury prevention</li>
                <li><strong>PhD in Sports Psychology</strong> — focus, confidence under pressure</li>
                <li><strong>Ex-MLB player</strong> — pitcher and outfielder</li>
                <li><strong>20-year pro coaching staff</strong> — hitting, pitching, throwing</li>
              </ul>
            )}
          </div>

          {/* Outcome chips — "here's what you get" */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: INK, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              What you&apos;ll walk away with
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {outcomeChips.map((c) => (
                <span key={c.label} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px',
                  background: ACCENT_BG, border: `1px solid ${ACCENT}30`,
                  borderRadius: 999, fontSize: 12, fontWeight: 600, color: INK2,
                }}>
                  <c.Icon size={13} strokeWidth={2.2} />{c.label}
                </span>
              ))}
            </div>
          </div>

          {/* Service picker — above the paragraph because it changes scope */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: INK, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              1. What do you want help with?
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {SERVICE_OPTIONS.map(svc => {
                const isOn = selected.includes(svc.id)
                const isLocked = svc.id === 'training'
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => toggleService(svc.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12, cursor: isLocked ? 'default' : 'pointer',
                      border: `2px solid ${isOn ? INK : BRD}`,
                      background: isOn ? INK + '06' : '#fff',
                      textAlign: 'left', transition: 'all .15s',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, flexShrink: 0,
                      borderRadius: 8,
                      background: isOn ? INK + '10' : '#f1f1f6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isOn ? INK : '#4b5563',
                    }}>
                      <svc.Icon size={17} strokeWidth={2} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{svc.label}{isLocked ? ' · included' : ''}</div>
                      <div style={{ fontSize: 11, color: INK3, lineHeight: 1.4 }}>{svc.desc}</div>
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${isOn ? INK : '#d1d5db'}`,
                      background: isOn ? INK : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isOn && <Check size={12} color="#fff" strokeWidth={3} />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Free-text intro */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: INK, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>
              2. Tell us about you
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
              A couple sentences is fine — your sport, goal, age, height, weight, injuries, equipment. We&apos;ll ask follow-ups in chat if we need anything else.
            </p>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setError(null) }}
              rows={7}
              placeholder={"Example:\n\n28, 5'11\", 195 lbs. Played college baseball, want to get back in shape — lost ~20 lbs of muscle. Full gym, 4 days/week. Minor shoulder impingement last year, cleared now. Desk job, 7 hrs sleep."}
              style={{
                width: '100%', padding: '12px 14px', fontSize: 14,
                border: '1px solid #d1d5db', borderRadius: 10,
                fontFamily: 'inherit', lineHeight: 1.55, color: '#0a0a0a',
                resize: 'vertical', minHeight: 150, outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 12, padding: '8px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>
              {error}
            </div>
          )}

          <PrimaryCTA pinned={false} onClick={handleSubmit}>
            Start building my plan
          </PrimaryCTA>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>
            Answers save as you chat.
          </p>
        </section>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
          Every plan is generated for the individual — no templates, no copy-paste.
        </div>
      </div>
    </div>
  )
}

function NotFoundScreen() {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 12, padding: '40px 32px', textAlign: 'center', maxWidth: 400 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900, color: INK }}>Link not found</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>This intake link is invalid or has expired. Contact your trainer for a new one.</p>
      </div>
    </div>
  )
}

// Baseball trivia shown while the plan generates. Widely-known ranges, not
// precise claims — framed as "Did you know?" so athletes understand it's
// entertainment, not personal data. If multi-sport lands later, filter by
// the athlete's sport.
const BASEBALL_TRIVIA = [
  { icon: '⚾', text: 'Roughly 2% of HS baseball players make it to an NCAA D1 roster.' },
  { icon: '🎯', text: 'Most D1 pitchers sit 88-92 mph as incoming freshmen. Upper-tier arms hit 94+.' },
  { icon: '🏃', text: 'A sub-6.7 second 60-yard dash is the D1 benchmark for most infielders.' },
  { icon: '💥', text: 'Average D1 position players put up 90-95 mph exit velos. Power hitters push 100+.' },
  { icon: '🚀', text: 'Aroldis Chapman holds the MLB record for fastest pitch: 105.8 mph (2010).' },
  { icon: '🧠', text: 'Hitters have ~150 ms to decide to swing on a 95 mph fastball.' },
  { icon: '⏱', text: 'Healthy HS pitchers throw 400-600 pitches per week in-season across games + bullpens.' },
  { icon: '🎓', text: 'Only about 1 in 200 HS position players ever reach the majors.' },
  { icon: '📈', text: 'Catchers with sub-1.9 second pop times climb recruiting boards quickly.' },
  { icon: '🔨', text: 'Structured velo training can add 3-5 mph in 12 weeks — with proper arm care.' },
  { icon: '💪', text: 'Top HS prospects typically squat 1.5x bodyweight by junior year.' },
  { icon: '🧬', text: 'Chronic sleep under 7 hrs drops reaction time by roughly 10%. Recovery is training.' },
  { icon: '🏟', text: 'D2 and JUCO are the largest growing segments of college baseball recruiting.' },
  { icon: '🧢', text: 'Switch hitters represent ~12% of MLB starters and ~7% of college starters.' },
  { icon: '📊', text: 'Barrel rate — hard contact at the right launch angle — correlates more with success than exit velo alone.' },
  { icon: '🎣', text: 'Curveball spin rates above 2800 rpm consistently grade out plus at the D1 level.' },
  { icon: '🔥', text: 'The average MLB fastball today sits at 94.2 mph — up from 91.6 mph in 2008.' },
  { icon: '🧤', text: 'First-step quickness matters more than top speed for middle infielders. Roughly 90% of plays close in under 2 seconds.' },
  { icon: '⚡', text: 'Pitchers who finish strongly into their front hip generate 15-20% more rotational power.' },
  { icon: '🥜', text: 'For a 15-year-old training hard, 1 g protein per pound of bodyweight is the recovery gold standard.' },
  { icon: '🛌', text: 'Every extra hour of sleep correlates with ~0.6% better athletic reaction time in teen athletes (Stanford study).' },
  { icon: '🦵', text: 'Jump rope for 10 min = roughly a 10-min mile, with zero wasted impact on the knees.' },
  { icon: '🍌', text: 'Pre-workout carbs within 60 min of training boost sprint output by up to 7%.' },
  { icon: '🔁', text: 'Consistent sleep/wake times matter more than total hours for next-day performance.' },
  { icon: '🧊', text: 'Post-game cold exposure can cut perceived soreness by ~20% in high-volume weeks.' },
  { icon: '🎢', text: 'Most college arms log 8-12% velocity swings between cold starts and late-inning adrenaline.' },
  { icon: '🧱', text: 'The deadlift at 1.5x bodyweight correlates strongly with pitching velo gains in teen athletes.' },
  { icon: '📡', text: 'MLB teams now track "attack angle" on swings — the closer to +10°, the more extra-base contact.' },
  { icon: '🗓', text: 'Top recruiters watch you in FALL of your junior year. The summer before is when commitments accelerate.' },
  { icon: '🔬', text: 'Force-plate data shows peak power output happens between ages 16-22 for most athletes.' },
  { icon: '🏆', text: 'The CWS (College World Series) has been contested 77+ times — only 14 programs have ever won it.' },
  { icon: '🌎', text: 'Over 35% of MLB rosters were born outside the US — pipelines like the Dominican Republic shape the sport.' },
  { icon: '🏋', text: 'Trap bar deadlifts produce 9% more peak power than conventional for most athletes — safer for teenagers too.' },
  { icon: '🧯', text: 'Arm soreness lasting over 72 hours after an outing is a yellow flag — check mechanics, volume, sleep.' },
  { icon: '⏳', text: 'Bone density for throwing athletes peaks at age 20-24 — the training you do NOW sets your ceiling.' },
]

const PLAN_PHASES = [
  { key: 'baseline', label: 'Baseline', desc: 'Readiness check + starting point' },
  { key: 'roadmap', label: '90-day roadmap', desc: 'Three phases toward the goal' },
  { key: 'workout', label: 'Workout block', desc: 'First 2 weeks of sessions' },
  { key: 'playbook', label: 'Playbook', desc: 'How your coach works with you' },
]

function GeneratingScreen({ progress }) {
  const [statIdx, setStatIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const statTimer = setInterval(() => setStatIdx((i) => (i + 1) % BASEBALL_TRIVIA.length), 6500)
    const elapsedTimer = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => { clearInterval(statTimer); clearInterval(elapsedTimer) }
  }, [])

  // Real phase progression from server stream: whichever phase the server
  // most recently emitted 'phase_start' for is active; anything in
  // progress.completed is done.
  const activePhaseKey = progress?.activePhase || 'baseline'
  const completed = progress?.completed || []
  const activePhase = (() => {
    const idx = PLAN_PHASES.findIndex((p) => p.key === activePhaseKey)
    return idx >= 0 ? idx : 0
  })()
  const stat = BASEBALL_TRIVIA[statIdx]

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <section style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 14, padding: '32px 28px', maxWidth: 620, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
          <div style={{ width: 48, height: 48, flexShrink: 0, border: '4px solid #f1f1f6', borderTopColor: ACCENT, borderRadius: '50%', animation: 'kotoSpin 0.9s linear infinite' }} />
          <style>{'@keyframes kotoSpin{to{transform:rotate(360deg)}}@keyframes kotoFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'}</style>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: INK, letterSpacing: '-.3px' }}>Crafting your plan</h1>
            <p style={{ margin: '4px 0 0', fontSize: 15, color: '#6b7280' }}>4 AI passes · about a minute</p>
          </div>
        </div>

        {/* Phase progression tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 26 }}>
          {PLAN_PHASES.map((p, i) => {
            const done = completed.includes(p.key)
            const active = !done && i === activePhase
            return (
              <div key={p.key} style={{
                padding: '14px 10px', borderRadius: 10, textAlign: 'center',
                background: done ? GRN + '12' : active ? ACCENT + '10' : '#f9fafb',
                border: `1px solid ${done ? GRN + '40' : active ? ACCENT + '40' : '#ececef'}`,
                transition: 'all 0.3s ease',
              }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>
                  {done ? '✓' : active ? '⏳' : '·'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: done ? GRN : active ? ACCENT : '#9ca3af', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  {p.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* Rotating trivia card */}
        <div key={statIdx} style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1f1f22 100%)',
          color: '#fff', borderRadius: 12, padding: '26px 26px', textAlign: 'left',
          animation: 'kotoFadeUp 0.45s ease',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>
            Did you know?
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
            <span style={{ fontSize: 40, flexShrink: 0, lineHeight: 1 }}>{stat.icon}</span>
            <div style={{ fontSize: 20, lineHeight: 1.45, color: '#e2e8f0', fontWeight: 500 }}>{stat.text}</div>
          </div>
        </div>

        <div style={{ marginTop: 18, fontSize: 14, color: '#6b7280', textAlign: 'center', fontWeight: 600 }}>
          {elapsed}s elapsed · {PLAN_PHASES[activePhase].desc}
        </div>
      </section>
    </div>
  )
}

const PLAN_PIECES = [
  { key: 'baseline_ready', label: 'Baseline assessment', desc: 'Where you are right now + what you\'re ready for' },
  { key: 'roadmap_ready', label: '90-day roadmap', desc: '3 phases, week by week, toward your goal' },
  { key: 'workout_ready', label: '2-week workout block', desc: 'Your first block of sessions, sets, and reps' },
  { key: 'playbook_ready', label: 'Coaching playbook', desc: 'How your coach will work with you day to day' },
]

function DoneScreen({ name, agency, planResult, traineeId, onEditProfile, onRegenerate }) {
  const firstName = name ? name.split(' ')[0] : null
  const supportEmail = agency?.support_email || null

  // Fetch the actual plan data so the athlete can SEE it. The trainee_id
  // in the URL is the token — no auth needed (same model as /intake/:id).
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(true)
  useEffect(() => {
    if (!traineeId) { setPlanLoading(false); return }
    let cancelled = false
    fetch('/api/trainer/intake-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainee_id: traineeId }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return
        setPlan(data?.plan || null)
        setPlanLoading(false)
      })
      .catch(() => {
        if (!cancelled) setPlanLoading(false)
      })
    return () => { cancelled = true }
  }, [traineeId])

  // Medical-hold variant — baseline said no-go, so no workouts generated.
  const okToTrain = planResult?.ok_to_train !== false
  const redFlags = Array.isArray(planResult?.red_flags) ? planResult.red_flags : []

  if (!okToTrain) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
        <section style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 12, padding: '36px 28px', maxWidth: 520, width: '100%' }}>
          <div style={{ width: 48, height: 48, margin: '0 auto 14px', background: '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PauseCircle size={24} strokeWidth={2} color="#b45309" />
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: INK, textAlign: 'center' }}>
            A quick review first{firstName ? `, ${firstName}` : ''}
          </h1>
          <p style={{ margin: '0 0 18px', fontSize: 14, color: '#4b5563', lineHeight: 1.6, textAlign: 'center' }}>
            Based on what you shared, we want to go over a few things with you before finalizing your training plan.
          </p>
          {redFlags.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                Flagged for review
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#78350f', lineHeight: 1.55 }}>
                {redFlags.map((f, i) => <li key={i}>{typeof f === 'string' ? f : (f?.reason || f?.flag || JSON.stringify(f))}</li>)}
              </ul>
            </div>
          )}
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6, textAlign: 'center' }}>
            We&apos;ll be in touch shortly{supportEmail ? <> or you can email <a href={`mailto:${supportEmail}`} style={{ color: ACCENT, textDecoration: 'none', fontWeight: 700 }}>{supportEmail}</a></> : null}.
          </p>
        </section>
      </div>
    )
  }

  const baseline = plan?.baseline
  const roadmap = plan?.roadmap
  const workout = plan?.workout_plan

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '28px 20px 48px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, margin: '0 auto 14px', background: GRN + '18', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={28} color={GRN} strokeWidth={3} />
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 900, color: INK, letterSpacing: '-.4px' }}>
            Your plan is built{firstName ? `, ${firstName}` : ''}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#4b5563', lineHeight: 1.55 }}>
            Bookmark this page — your plan lives here.
          </p>
        </div>

        {/* Readiness strip — compact */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 18 }}>
          {PLAN_PIECES.map((p) => {
            const ready = planResult?.[p.key] !== false
            return (
              <div key={p.key} style={{
                padding: '8px 6px', borderRadius: 8, textAlign: 'center',
                background: ready ? GRN + '10' : '#f9fafb',
                border: `1px solid ${ready ? GRN + '40' : '#ececef'}`,
              }}>
                <div style={{ fontSize: 16, marginBottom: 2 }}>{ready ? '✓' : '·'}</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: ready ? GRN : '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em' }}>{p.label}</div>
              </div>
            )
          })}
        </div>

        {planLoading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', marginBottom: 6 }} /><br />
            Loading your plan…
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          </div>
        )}

        {!planLoading && baseline && <BaselineCard baseline={baseline} />}
        {!planLoading && roadmap && <RoadmapCard roadmap={roadmap} />}
        {!planLoading && workout && <WorkoutBlockCard workout={workout} />}

        {/* Today's nutrition tracker — photo log + running totals vs. target. */}
        <NutritionToday traineeId={traineeId} />

        {/* Sleep tracker — one entry per night, 14-day trend. */}
        <SleepTracker traineeId={traineeId} />

        {/* Actions — edit profile, regenerate */}
        <section style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 12, padding: '14px 16px', marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onEditProfile}
            style={{
              flex: '1 1 200px', padding: '10px 16px',
              background: '#fff', color: INK,
              border: '1px solid #d1d5db', borderRadius: 10,
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}
          >
            <Pencil size={16} strokeWidth={1.75} />  Update my profile
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            style={{
              flex: '1 1 200px', padding: '10px 16px',
              background: INK, color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} strokeWidth={1.75} />  Regenerate my plan
          </button>
        </section>

        {/* Footer — bookmark + support */}
        <section style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 12, padding: '16px 18px', marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Bookmark size={20} strokeWidth={1.75} style={{ flexShrink: 0, color: '#0a0a0a' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginBottom: 3 }}>Bookmark this page</div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                This link is your plan — keep it handy. You can come back anytime to update your profile or regenerate.
              </div>
              {supportEmail && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                  Questions? Email <a href={`mailto:${supportEmail}`} style={{ color: ACCENT, textDecoration: 'none', fontWeight: 700 }}>{supportEmail}</a>.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// ── Plan render helpers ─────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: ACCENT, letterSpacing: '.08em', textTransform: 'uppercase' }}>{eyebrow}</div>
      <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 900, color: INK, letterSpacing: '-.2px' }}>{title}</h2>
    </div>
  )
}

function BaselineCard({ baseline }) {
  const kcal = baseline?.calorie_target_kcal
  const macros = baseline?.macro_targets_g
  const focus = Array.isArray(baseline?.top_3_focus_areas) ? baseline.top_3_focus_areas : []
  const level = baseline?.starting_fitness_level
  const note = baseline?.coach_summary
  return (
    <section style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 12, padding: '18px 20px', marginBottom: 14 }}>
      <SectionHeader eyebrow="01 · Baseline" title="Your starting point" />
      {note && (
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{note}</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
        {level && <Stat label="Starting level" value={level.replace(/^\w/, (c) => c.toUpperCase())} />}
        {typeof kcal === 'number' && <Stat label="Daily calories" value={`${kcal} kcal`} />}
        {macros?.protein_g != null && <Stat label="Protein" value={`${macros.protein_g}g`} />}
        {macros?.fat_g != null && <Stat label="Fat" value={`${macros.fat_g}g`} />}
        {macros?.carb_g != null && <Stat label="Carbs" value={`${macros.carb_g}g`} />}
      </div>
      {focus.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
            Top 3 focus areas
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#374151', fontSize: 13, lineHeight: 1.6 }}>
            {focus.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ padding: '8px 10px', background: '#f9fafb', border: '1px solid #ececef', borderRadius: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function RoadmapCard({ roadmap }) {
  const phases = Array.isArray(roadmap?.phases) ? roadmap.phases : []
  const intro = roadmap?.client_context_summary
  const strategy = roadmap?.overall_strategy_note
  return (
    <section style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 12, padding: '18px 20px', marginBottom: 14 }}>
      <SectionHeader eyebrow="02 · Roadmap" title="Your 90-day plan" />
      {intro && <p style={{ margin: '0 0 10px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{intro}</p>}
      {strategy && <p style={{ margin: '0 0 14px', fontSize: 13, color: '#4b5563', lineHeight: 1.6, fontStyle: 'italic' }}>{strategy}</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {phases.map((p, i) => (
          <div key={i} style={{ border: '1px solid #ececef', borderLeft: `4px solid ${ACCENT}`, borderRadius: 8, padding: '10px 12px', background: '#f9fafb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{p.phase_name || `Phase ${p.phase_number}`}</div>
              {p.days_range && <div style={{ fontSize: 11, color: '#6b7280' }}>Days {p.days_range.start}–{p.days_range.end}</div>}
            </div>
            {p.training_theme && <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}><strong>Training:</strong> {p.training_theme}</div>}
            {p.nutrition_theme && <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}><strong>Nutrition:</strong> {p.nutrition_theme}</div>}
            {Array.isArray(p.end_of_phase_milestones) && p.end_of_phase_milestones.length > 0 && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ fontSize: 11, color: ACCENT, fontWeight: 700, cursor: 'pointer' }}>Milestones by end of phase</summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
                  {p.end_of_phase_milestones.map((m, j) => <li key={j}>{m}</li>)}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function WorkoutBlockCard({ workout }) {
  const weeks = Array.isArray(workout?.weeks) ? workout.weeks : []
  return (
    <section style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 12, padding: '18px 20px', marginBottom: 14 }}>
      <SectionHeader eyebrow="03 · Training" title={workout?.program_name || 'Your first 2 weeks'} />
      {weeks.map((w) => (
        <div key={w.week_number} style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            Week {w.week_number}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {(Array.isArray(w.sessions) ? w.sessions : []).map((s, i) => (
              <details key={i} style={{ border: '1px solid #ececef', borderRadius: 8, background: '#f9fafb' }}>
                <summary style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: INK, fontWeight: 700 }}>
                  <span>{s.day_label} · {s.session_name}</span>
                  <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{s.estimated_duration_min} min</span>
                </summary>
                <div style={{ padding: '0 12px 12px', fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                  {Array.isArray(s.warmup) && s.warmup.length > 0 && (
                    <div style={{ marginTop: 6 }}><strong>Warmup:</strong> {s.warmup.join(' · ')}</div>
                  )}
                  {Array.isArray(s.blocks) && s.blocks.map((b, bi) => (
                    <div key={bi} style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '.05em' }}>{b.block_type.replace('_', ' ')}</div>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {(Array.isArray(b.exercises) ? b.exercises : []).map((ex, ei) => (
                          <li key={ei}>
                            <strong>{ex.name}</strong>
                            {ex.sets && ex.reps ? ` — ${ex.sets}×${ex.reps}` : ''}
                            {ex.load ? ` @ ${ex.load}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {Array.isArray(s.cooldown) && s.cooldown.length > 0 && (
                    <div style={{ marginTop: 8 }}><strong>Cooldown:</strong> {s.cooldown.join(' · ')}</div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

// ── Today's nutrition (Phase B food log) ────────────────────────────────────
// Fetches today's food_log rows + target macros, renders 4 progress bars
// (kcal + P/F/C) and a list of today's entries. Photo upload sends a
// base64 image to /api/trainer/food-log with action=scan_photo; Claude
// Haiku vision reads the plate, caches the items at the agency level,
// and pushes a new log row. On error we fall back to manual entry.

function NutritionToday({ traineeId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  // Queue model: users can pick multiple photos back-to-back and walk
  // away. Each photo scans sequentially (Anthropic rate-limits parallel
  // vision calls) but the UI stays unblocked. queue holds pending +
  // in-flight items with status so the user sees progress.
  const [queue, setQueue] = useState([]) // {id, name, status: 'pending'|'scanning'|'done'|'error', errorMsg?}
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const reload = useCallback(async () => {
    if (!traineeId) return
    try {
      const res = await fetch('/api/trainer/food-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_today', trainee_id: traineeId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || `Failed (${res.status})`)
      setData(body)
    } catch (e) {
      setError(e.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }, [traineeId])

  useEffect(() => { reload() }, [reload])

  // Enqueue multiple photos, scan sequentially. UI stays unblocked so the
  // athlete can keep picking more while prior scans are still running.
  const processingRef = useRef(false)
  const scanOne = useCallback(async (item) => {
    try {
      const base64 = await fileToBase64(item.file)
      const res = await fetch('/api/trainer/food-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scan_photo',
          trainee_id: traineeId,
          photo_base64: base64,
          photo_mime: item.file.type,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.detail || body?.error || `Failed (${res.status})`)
      setQueue((q) => q.map((it) => (it.id === item.id ? { ...it, status: 'done' } : it)))
      return true
    } catch (e) {
      setQueue((q) => q.map((it) => (it.id === item.id ? { ...it, status: 'error', errorMsg: e.message || 'Scan failed' } : it)))
      return false
    }
  }, [traineeId])

  useEffect(() => {
    // Drain the queue one item at a time whenever there's a pending entry.
    if (processingRef.current) return
    const next = queue.find((it) => it.status === 'pending')
    if (!next) return
    processingRef.current = true
    ;(async () => {
      setQueue((q) => q.map((it) => (it.id === next.id ? { ...it, status: 'scanning' } : it)))
      await scanOne(next)
      processingRef.current = false
      // Reload totals; drop completed items from the visible list after 2s.
      await reload()
      setTimeout(() => {
        setQueue((q) => q.filter((it) => it.status !== 'done'))
      }, 2000)
    })()
  }, [queue, scanOne, reload])

  function handleFiles(files) {
    setError(null)
    if (!files || files.length === 0) return
    const toAdd = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { setError('One of the files is not an image.'); continue }
      if (file.size > 5 * 1024 * 1024) { setError(`${file.name} is over 5MB — skipped.`); continue }
      toAdd.push({
        id: Math.random().toString(36).slice(2),
        name: file.name || 'photo',
        file,
        status: 'pending',
      })
    }
    if (toAdd.length > 0) setQueue((q) => [...q, ...toAdd])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDelete(logId) {
    setError(null)
    try {
      const res = await fetch('/api/trainer/food-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', trainee_id: traineeId, log_id: logId }),
      })
      if (!res.ok) throw new Error('Delete failed')
      await reload()
    } catch (e) {
      setError(e.message || 'Delete failed')
    }
  }

  const totals = data?.totals || { kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0 }
  const targets = data?.targets || {}
  const logs = data?.logs || []

  const macros = [
    { label: 'Calories', total: totals.kcal, target: targets.kcal, unit: 'kcal', color: '#0a0a0a' },
    { label: 'Protein', total: totals.protein_g, target: targets.protein_g, unit: 'g', color: '#5aa0ff' },
    { label: 'Carbs', total: totals.carb_g, target: targets.carb_g, unit: 'g', color: '#059669' },
    { label: 'Fat', total: totals.fat_g, target: targets.fat_g, unit: 'g', color: '#d97706' },
  ]

  return (
    <section style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 12, padding: '18px 20px', marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, letterSpacing: '.06em', textTransform: 'uppercase' }}>Today</div>
          <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 900, color: INK, letterSpacing: '-.2px' }}>Nutrition tracker</h2>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'} · {new Date().toLocaleDateString()}
        </div>
      </div>

      {loading && <div style={{ padding: 16, fontSize: 13, color: '#6b7280' }}>Loading…</div>}

      {!loading && (
        <>
          {/* Progress bars */}
          <div style={{ display: 'grid', gap: 10, margin: '14px 0 16px' }}>
            {macros.map((m) => (
              <MacroBar key={m.label} {...m} />
            ))}
          </div>

          {/* Photo picker — multiple files, scan queue, keep it modern */}
          <div style={{ marginBottom: 14 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                padding: '14px 18px',
                background: 'linear-gradient(135deg, #0a0a0a 0%, #1f1f22 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '-.01em',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08), 0 8px 24px -12px rgba(15, 23, 42, 0.4)',
                transition: 'transform .12s ease, box-shadow .12s ease',
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <Camera size={18} strokeWidth={1.75} />
              <span>Snap photos of what you ate</span>
              <span style={{ fontSize: 11, opacity: 0.65, fontWeight: 500, marginLeft: 4 }}>· pick many at once</span>
              <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
            </button>
          </div>

          {/* Active scan queue */}
          {queue.length > 0 && (
            <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              {queue.map((item) => (
                <ScanQueueRow key={item.id} item={item} />
              ))}
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 12, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 12, color: '#991b1b' }}>
              {error}
            </div>
          )}

          {/* Today's log list */}
          {logs.length === 0 ? (
            <div style={{ padding: '14px 12px', fontSize: 13, color: '#9ca3af', textAlign: 'center', background: '#f9fafb', border: '1px dashed #ececef', borderRadius: 8 }}>
              Nothing logged yet today. Snap a photo to start tracking.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.map((log) => <FoodLogRow key={log.id} log={log} onDelete={() => handleDelete(log.id)} />)}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function MacroBar({ label, total, target, unit, color }) {
  const hasTarget = typeof target === 'number' && target > 0
  const pct = hasTarget ? Math.min(100, Math.round((total / target) * 100)) : 0
  const remaining = hasTarget ? Math.max(0, Math.round(target - total)) : null
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, fontSize: 12 }}>
        <span style={{ fontWeight: 700, color: INK }}>{label}</span>
        <span style={{ color: '#6b7280', fontWeight: 600 }}>
          <strong style={{ color: INK }}>{Math.round(total)}</strong>{hasTarget ? ` / ${target}` : ''} {unit}
          {hasTarget && <span style={{ marginLeft: 8, color: remaining === 0 ? '#059669' : color, fontWeight: 700 }}>{remaining}{unit} left</span>}
        </span>
      </div>
      <div style={{ height: 8, background: '#f1f1f6', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  )
}

function FoodLogRow({ log, onDelete }) {
  const items = Array.isArray(log.items) ? log.items : []
  const time = log.logged_at ? new Date(log.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <div style={{ padding: '10px 12px', border: '1px solid #ececef', borderRadius: 8, background: '#f9fafb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
          {time} · {log.source === 'photo' ? 'Photo' : 'Manual'} · {log.total_kcal} kcal · {log.total_protein_g}g P
        </div>
        <button
          type="button"
          onClick={onDelete}
          style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #ececef', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}
        >
          Delete
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((it, i) => (
          <span key={i} style={{
            padding: '4px 10px', background: '#fff', border: '1px solid #ececef',
            borderRadius: 6, fontSize: 12, color: INK, fontWeight: 600,
          }}>
            {it.name}{it.portion ? ` · ${it.portion}` : ''}{' · '}
            <span style={{ color: '#6b7280', fontWeight: 500 }}>{Math.round(it.kcal || 0)} kcal</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const str = String(reader.result || '')
      const i = str.indexOf(',')
      resolve(i >= 0 ? str.slice(i + 1) : str)
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

// One row in the in-flight scan queue — shows per-photo status with a
// subtle pulsing dot while scanning. Fades (via parent's delayed cleanup)
// once done.
function ScanQueueRow({ item }) {
  const s = item.status
  const color = s === 'done' ? '#16a34a' : s === 'error' ? '#e9695c' : s === 'scanning' ? '#5aa0ff' : '#a1a1a6'
  const label = s === 'done' ? 'Added to today' : s === 'error' ? (item.errorMsg || 'Failed') : s === 'scanning' ? 'Scanning…' : 'Queued'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      background: 'rgba(15, 23, 42, 0.02)',
      border: '1px solid rgba(15, 23, 42, 0.08)',
      borderRadius: 12,
      fontSize: 13,
    }}>
      <span style={{
        width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0,
        boxShadow: s === 'scanning' ? `0 0 0 4px ${color}25` : 'none',
        animation: s === 'scanning' ? 'kotoScanPulse 1.2s ease-in-out infinite' : 'none',
      }} />
      <style>{'@keyframes kotoScanPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}'}</style>
      <span style={{ flex: 1, color: '#0a0a0a', fontWeight: 500, letterSpacing: '-.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.name}
      </span>
      <span style={{ color, fontWeight: 600, fontSize: 12, letterSpacing: '-.01em', flexShrink: 0 }}>{label}</span>
    </div>
  )
}

// ── Sleep tracker (Phase C) ─────────────────────────────────────────────────
// Minimum-viable sleep log: hours slept + quality 1-10. Upsert per night
// (UNIQUE(trainee_id, sleep_date)). 14-day trailing chart + an honest
// "performance impact" note tied to hours.

function SleepTracker({ traineeId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hours, setHours] = useState('')
  const [quality, setQuality] = useState('')
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/trainer/sleep-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'latest', trainee_id: traineeId }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setData(body)
        if (body.latest && body.latest.sleep_date === new Date().toISOString().slice(0, 10)) {
          setHours(String(body.latest.hours_slept))
          setQuality(body.latest.quality_1_10 ? String(body.latest.quality_1_10) : '')
        }
      }
    } finally {
      setLoading(false)
    }
  }, [traineeId])

  useEffect(() => { if (traineeId) reload() }, [traineeId, reload])

  async function handleSave() {
    const h = Number(hours)
    if (!Number.isFinite(h) || h <= 0 || h > 24) { setError('Enter hours between 0 and 24.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/trainer/sleep-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          trainee_id: traineeId,
          sleep_date: new Date().toISOString().slice(0, 10),
          hours_slept: h,
          quality_1_10: quality ? Number(quality) : undefined,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      await reload()
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !data) return null

  const logs = data.logs || []
  const latest = data.latest

  // 14-day trailing chart
  const byDate = new Map(logs.map((l) => [l.sleep_date, l.hours_slept]))
  const days = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    days.push({ date: d, hours: Number(byDate.get(d) || 0) })
  }
  const recorded = days.filter((d) => d.hours > 0)
  const avg = recorded.length > 0 ? recorded.reduce((a, d) => a + d.hours, 0) / recorded.length : 0
  const debtNights = days.filter((d) => d.hours > 0 && d.hours < 7).length

  return (
    <section style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 12, padding: '18px 20px', marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, letterSpacing: '.06em', textTransform: 'uppercase' }}>Sleep</div>
          <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 900, color: INK, letterSpacing: '-.2px' }}>Last night + 14-day trend</h2>
        </div>
        {recorded.length > 0 && (
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Avg {avg.toFixed(1)} hrs · {debtNights} night{debtNights !== 1 ? 's' : ''} under 7
          </div>
        )}
      </div>

      {/* Log form */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '14px 0 10px' }}>
        <label style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
          Hours slept
          <input
            type="number" step="0.5" min="0" max="24"
            value={hours}
            onChange={(e) => { setHours(e.target.value); setError(null) }}
            placeholder="7.5"
            style={{ marginLeft: 8, padding: '8px 10px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, width: 80, fontFamily: 'inherit' }}
          />
        </label>
        <label style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
          Quality
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            style={{ marginLeft: 8, padding: '8px 10px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontFamily: 'inherit' }}
          >
            <option value="">—</option>
            {[1,2,3,4,5,6,7,8,9,10].map((q) => <option key={q} value={q}>{q}/10</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hours}
          style={{
            padding: '9px 16px', background: saving || !hours ? '#ececef' : '#0a0a0a',
            color: saving || !hours ? '#9ca3af' : '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: saving || !hours ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : latest && latest.sleep_date === new Date().toISOString().slice(0, 10) ? 'Update tonight' : 'Log last night'}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 10, padding: '6px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>
          {error}
        </div>
      )}

      {/* 14-day bars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 3, alignItems: 'end', height: 90, position: 'relative', marginBottom: 8 }}>
        {/* 7-hour target reference line */}
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: `${(7 / 12) * 100}%`, borderTop: '1px dashed #a1a1a6', pointerEvents: 'none' }} />
        {days.map((d) => {
          const h = d.hours
          const pct = Math.min(100, (h / 12) * 100)
          const color = h === 0 ? '#ececef' : h < 6 ? '#e9695c' : h < 7 ? '#d97706' : h >= 9 ? '#5aa0ff' : '#059669'
          return (
            <div key={d.date} title={`${d.date}: ${h ? h + ' hrs' : 'no entry'}`} style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
              <div style={{ width: '100%', height: `${pct}%`, background: color, borderRadius: 2, transition: 'height .3s' }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#a1a1a6', fontWeight: 600, marginBottom: 14 }}>
        <span>14 days ago</span>
        <span style={{ color: '#a1a1a6' }}>--- 7 hr target</span>
        <span>Today</span>
      </div>

      {/* Performance note — honest, not preachy */}
      {recorded.length >= 3 && (
        <div style={{ padding: '10px 12px', background: '#f1f1f6', border: '1px solid #ececef', borderRadius: 8, fontSize: 12, color: '#6b6b70', lineHeight: 1.55 }}>
          <strong style={{ color: '#0a0a0a' }}>Performance note:</strong>{' '}
          {debtNights >= 3
            ? `${debtNights} nights under 7 hrs in the last 14. Expect a measurable drop in reaction time + velo during training this week.`
            : avg >= 8
            ? `Averaging ${avg.toFixed(1)} hrs — you're in the recovery sweet spot. Growth hormone + CNS recovery both peak at 8-9 hrs.`
            : `Averaging ${avg.toFixed(1)} hrs. Consistent > total — same bedtime every night matters more than hitting 8 sometimes.`}
        </div>
      )}
    </section>
  )
}
