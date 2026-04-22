"use client"
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Send, Check, Circle } from 'lucide-react'
import { T, BLK, GRN, R } from '../../lib/theme'
import { cmToFeetInches, kgToLbs } from '../../lib/trainer/units'
import { supabase } from '../../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// /intake/:traineeId — unique intake link for trainer-added clients.
//
// No auth required.  The traineeId in the URL acts as the token (same pattern
// as /onboard/:clientId).  Chat on the left, live card on the right.
// Fields save to the trainee row in real-time so the trainer sees progress.
// On completion → plan generation → "Done" screen.
// ─────────────────────────────────────────────────────────────────────────────

const BG = '#f9fafb'

const REQUIRED_FIELDS = [
  'about_you', 'age', 'sex', 'height_cm', 'current_weight_kg', 'primary_goal',
  'training_experience_years', 'training_days_per_week', 'equipment_access',
  'medical_flags', 'injuries', 'dietary_preference', 'allergies',
  'sleep_hours_avg', 'stress_level', 'occupation_activity', 'meals_per_day',
]

function getMissing(extracted) {
  const missing = []
  for (const f of REQUIRED_FIELDS) {
    const v = extracted[f]
    if (v === null || v === undefined) { missing.push(f); continue }
    if (typeof v === 'string' && v.trim().length === 0) { missing.push(f); continue }
    if (typeof v === 'number' && !Number.isFinite(v)) { missing.push(f); continue }
  }
  return missing
}

export default function TraineeIntakePage() {
  const { traineeId } = useParams()
  const [phase, setPhase] = useState('loading') // loading | not_found | welcome | chat | generating | done
  const [trainee, setTrainee] = useState(null)
  const [extracted, setExtracted] = useState({})
  const [aboutYou, setAboutYou] = useState('')
  const [initialText, setInitialText] = useState('') // paragraph from welcome screen
  const [services, setServices] = useState([]) // ['training', 'diet', 'recruiting']
  const [generateError, setGenerateError] = useState(null)

  // Load trainee on mount.
  useEffect(() => {
    if (!traineeId) { setPhase('not_found'); return }
    supabase
      .from('koto_fitness_trainees')
      .select('id, full_name, agency_id, status, age, sex, height_cm, current_weight_kg, target_weight_kg, primary_goal, training_experience_years, training_days_per_week, equipment_access, medical_flags, injuries, dietary_preference, allergies, sleep_hours_avg, stress_level, occupation_activity, meals_per_day, about_you')
      .eq('id', traineeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setPhase('not_found'); return }
        setTrainee(data)
        // Pre-populate extracted from existing trainee data.
        const pre = {}
        for (const k of [...REQUIRED_FIELDS, 'full_name', 'target_weight_kg']) {
          if (data[k] !== null && data[k] !== undefined && data[k] !== '') {
            pre[k] = data[k]
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
      full_name: extracted.full_name || trainee?.full_name || 'Trainee',
    }
    const missing = getMissing(payload)
    if (missing.length > 0) {
      setGenerateError(`Still missing: ${missing.join(', ')}.`)
      return
    }

    setPhase('generating')
    try {
      const res = await fetch('/api/trainer/intake-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainee_id: traineeId, intake: payload }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenerateError(body?.error || `Failed (${res.status})`)
        setPhase('chat')
        return
      }
      setPhase('done')
    } catch (e) {
      setGenerateError(e?.message || 'Network error')
      setPhase('chat')
    }
  }

  const missing = getMissing(extracted)

  if (phase === 'loading') return <CenteredSpinner label="Loading..." />
  if (phase === 'not_found') return <NotFoundScreen />
  if (phase === 'welcome') return <WelcomeScreen name={trainee?.full_name} onStart={(text, selectedServices) => { setInitialText(text); setServices(selectedServices); setPhase('chat') }} />
  if (phase === 'generating') return <GeneratingScreen />
  if (phase === 'done') return <DoneScreen name={extracted.full_name || trainee?.full_name} />

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '24px 16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: BLK, letterSpacing: '-.3px' }}>
            Tell us about you
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Chat with your coach — your profile builds itself as you go.
          </p>
        </header>

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
            onFieldsUpdate={handleFieldsUpdate}
            onAboutYouAppend={handleAboutYouAppend}
            traineeName={trainee?.full_name || ''}
            initialText={initialText}
            services={services}
          />

          {/* Live card */}
          <div style={{ position: 'sticky', top: 24 }}>
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

// ── Token-based chat widget (uses trainee_id auth, not JWT) ─────────────────

function TokenChatWidget({ traineeId, extracted, onFieldsUpdate, onAboutYouAppend, traineeName, initialText, services }) {
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

  // Store last messages for retry.
  const lastTurnRef = useRef(null)

  const streamTurn = useCallback(async (turnMessages) => {
    lastTurnRef.current = turnMessages
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
        body: JSON.stringify({ trainee_id: traineeId, messages: turnMessages, extracted, services: services || ['training'] }),
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
      let retried = false

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
            if (event.extracted && typeof event.extracted === 'object') onFieldsUpdate(event.extracted)
            if (event.about_you_append && typeof event.about_you_append === 'string') onAboutYouAppend(event.about_you_append)
            if (Array.isArray(event.suggested_replies) && event.suggested_replies.length > 0) {
              replies = event.suggested_replies
            }
          }
          if (event.type === 'error') setError(event.error || 'Stream error')
        }
      }

      clearTimeout(timeout)

      if (fullText) {
        setMessages((prev) => [...prev, { role: 'assistant', content: fullText }])
      } else {
        // Model produced only a tool call with no visible text.
        // This happens sometimes — auto-retry once silently.
        if (!retried) {
          retried = true
          // Small delay then retry the same turn
          await new Promise(r => setTimeout(r, 500))
          const retryRes = await fetch('/api/trainer/intake-chat-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trainee_id: traineeId, messages: turnMessages, extracted, services: services || ['training'] }),
          })
          if (retryRes.ok && retryRes.body) {
            const retryReader = retryRes.body.getReader()
            let retryBuf = ''
            let retryText = ''
            while (true) {
              const { done: rd, value: rv } = await retryReader.read()
              if (rd) break
              retryBuf += decoder.decode(rv, { stream: true })
              const retryLines = retryBuf.split('\n')
              retryBuf = retryLines.pop() ?? ''
              for (const rl of retryLines) {
                if (!rl.trim()) continue
                let re; try { re = JSON.parse(rl) } catch { continue }
                if (re.type === 'text_delta') { retryText += re.text; setStreamingText(retryText) }
                if (re.type === 'fields') {
                  if (re.extracted) onFieldsUpdate(re.extracted)
                  if (re.about_you_append) onAboutYouAppend(re.about_you_append)
                  if (Array.isArray(re.suggested_replies) && re.suggested_replies.length > 0) replies = re.suggested_replies
                }
              }
            }
            if (retryText) { setMessages((prev) => [...prev, { role: 'assistant', content: retryText }]); fullText = retryText }
          }
        }
        if (!fullText) {
          // Still no text after retry — show a generic acknowledgment
          const fallback = 'Got it. What else can you tell me?'
          setMessages((prev) => [...prev, { role: 'assistant', content: fallback }])
        }
      }
      if (replies.length > 0) setQuickReplies(replies)
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
  }

  function handleSend() { sendText(input) }

  function handleQuickReply(text) { sendText(text) }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', height: '100%', minHeight: 500 }}>
      <div style={{ padding: '12px 16px', background: BLK, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: T, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>K</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Koto Coach</div>
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
                  padding: '8px 14px', border: `1px solid ${T}`, borderRadius: 20,
                  background: '#fff', color: T, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = T }}
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
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
            >
              Answer later →
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 12px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type your answer..." rows={1} disabled={streaming}
          style={{ flex: 1, padding: '10px 12px', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 10, resize: 'none', fontFamily: 'inherit', lineHeight: 1.4, color: BLK, outline: 'none' }} />
        <button onClick={handleSend} disabled={!input.trim() || streaming}
          style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: input.trim() && !streaming ? R : '#e5e7eb', color: input.trim() && !streaming ? '#fff' : '#9ca3af', cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
      <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: isUser ? R : '#f3f4f6', color: isUser ? '#fff' : BLK, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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

function getFieldDefs(services) {
  const fields = [...TRAINING_FIELDS]
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
  basics: '👤 Basics',
  training: '💪 Training',
  health: '🏥 Health',
  nutrition: '🥗 Nutrition',
  lifestyle: '😴 Lifestyle',
  recruiting: '🎓 Recruiting',
  academics: '📚 Academics',
  measurables: '📊 Measurables',
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
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: BLK, letterSpacing: '.03em', textTransform: 'uppercase' }}>Your Profile</h3>
          <span style={{ fontSize: 12, fontWeight: 700, color: allDone ? GRN : '#6b7280' }}>{filledCount} / {totalCount}</span>
        </div>
        <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: allDone ? GRN : T, borderRadius: 2, transition: 'width 0.4s ease' }} />
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
                  <span style={{ fontSize: 12, fontWeight: isFilled ? 700 : 400, color: isFilled ? BLK : '#d1d5db', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {def.format === 'link' && display ? <a href={display} target="_blank" rel="noopener noreferrer" style={{ color: T, textDecoration: 'none' }}>View →</a> : (display ?? '---')}
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
          style={{ width: '100%', padding: '12px 16px', background: allDone ? R : '#e5e7eb', color: allDone ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: allDone ? 'pointer' : 'not-allowed' }}>
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
  { id: 'training', label: 'Training Plan', desc: 'Workout programming, mechanics, strength & conditioning, recovery', icon: '💪', default: true },
  { id: 'diet', label: 'Diet & Nutrition', desc: 'Meal plans, macros, recipes, fueling strategies', icon: '🥗' },
  { id: 'recruiting', label: 'College Recruiting', desc: 'ProPath Score, school matching, coach outreach, recruiting timeline', icon: '🎓' },
]

function getServiceSummary(selected) {
  const parts = []
  if (selected.includes('training')) parts.push("Your AI coach will build a personalized training plan — workouts, mechanics drills, arm care, strength & conditioning, and mental performance routines tailored to your position and goals.")
  if (selected.includes('diet')) parts.push("You'll also get a custom nutrition plan — daily macros, meal timing, recipes, and fueling strategies designed for a competitive baseball athlete.")
  if (selected.includes('recruiting')) parts.push("For recruiting, we'll collect your stats, measurables, GPA, and preferences to generate your ProPath Score — matching you with the best-fit college programs across D1, D2, D3, and JUCO. You'll get coach contact info, email templates, and a grade-by-grade recruiting roadmap.")
  return parts.join('\n\n')
}

function WelcomeScreen({ name, onStart }) {
  const firstName = name ? name.split(' ')[0] : null
  const [text, setText] = useState('')
  const [selected, setSelected] = useState(['training']) // training always on by default
  const [error, setError] = useState(null)

  function toggleService(id) {
    if (id === 'training') return // training is always included
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  function handleSubmit() {
    if (text.trim().length < 20) {
      setError('Write at least a sentence or two — the more you share, the better your plan.')
      return
    }
    onStart(text, selected)
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '32px 20px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Hero / Logo header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: '0 auto 14px',
            background: `linear-gradient(135deg, ${BLK} 0%, #1e293b 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,.15)',
          }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: T, letterSpacing: '-1px', fontFamily: 'inherit' }}>K</span>
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 900, color: BLK, letterSpacing: '-.5px' }}>
            Koto
          </h1>
          <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: T, letterSpacing: '.02em' }}>
            Train. Fuel. Get Recruited.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>💪 AI Training Plans</span>
            <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>🥗 Custom Nutrition</span>
            <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>🎓 College Recruiting</span>
          </div>
        </div>

        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '28px 28px 24px', marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 900, color: BLK, letterSpacing: '-.3px' }}>
            {firstName ? `Welcome, ${firstName}` : 'Welcome'}
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
            Your AI-powered coach for baseball performance, nutrition, and college recruiting — all in one place. Chat with your coach, build your profile, and get a personalized plan built by PhDs, ex-MLB pros, and 20-year coaching veterans.
          </p>

          {/* Expert credentials */}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Powered by expert-level AI
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', fontSize: 13, lineHeight: 1.65 }}>
              <li><strong>PhD in Biomechanics</strong> — throwing mechanics, swing analysis, movement efficiency</li>
              <li><strong>PhD in Nutrition</strong> — sport-science nutrition, calorie & macro programming for athletes</li>
              <li><strong>PhD in Strength & Conditioning</strong> — periodization, load management, power development</li>
              <li><strong>PhD in Exercise Physiology</strong> — recovery protocols, injury prevention, youth athlete development</li>
              <li><strong>PhD in Sports Psychology</strong> — mental performance, confidence, focus under pressure</li>
              <li><strong>Ex-MLB player</strong> — pitcher and outfielder with professional playing experience</li>
              <li><strong>20-year pro coaching staff</strong> — hitting, pitching, and throwing coaches at the highest level</li>
            </ul>
          </div>

          {/* Service selection */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: BLK, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              What do you want from your coach?
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
                      padding: '12px 14px', borderRadius: 10, cursor: isLocked ? 'default' : 'pointer',
                      border: `2px solid ${isOn ? T : '#e5e7eb'}`,
                      background: isOn ? T + '08' : '#fff',
                      textAlign: 'left', transition: 'all .15s',
                    }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{svc.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: BLK }}>{svc.label}{isLocked ? ' (included)' : ''}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{svc.desc}</div>
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${isOn ? T : '#d1d5db'}`,
                      background: isOn ? T : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isOn && <Check size={14} color="#fff" strokeWidth={3} />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* What happens next — based on selection */}
          {selected.length > 0 && (
            <div style={{ background: '#f0fdfa', border: `1px solid ${T}30`, borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                Here's what happens next
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {getServiceSummary(selected)}
              </p>
            </div>
          )}

          {/* Free-text intro */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 6 }}>
              Tell us about you — who you are, your goals, and what you want to accomplish
            </label>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
              Mention anything relevant — your sport, job, injuries, equipment, experience level, age, height, weight. The more you share here, the fewer questions we'll need to ask.
            </p>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setError(null) }}
              rows={8}
              placeholder={"Example:\n\nI'm a 28-year-old guy, 5'11, 195 lbs. I played college baseball and want to get back in shape — lost about 20 lbs of muscle since I stopped playing. I have a full gym membership, can train 4 days a week. Had a minor shoulder impingement last year but it's cleared up. No allergies, I eat pretty much everything. Desk job, sleep about 7 hours, stress is moderate."}
              style={{
                width: '100%', padding: '14px 16px', fontSize: 14,
                border: '1px solid #d1d5db', borderRadius: 10,
                fontFamily: 'inherit', lineHeight: 1.55, color: '#0a0a0a',
                resize: 'vertical', minHeight: 180, outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 12, padding: '8px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: R,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '-.2px',
            }}
          >
            Start chatting with your coach
          </button>
        </section>

        <div style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
          Built by Koto. Every plan is generated for the individual — no templates, no copy-paste.
        </div>
      </div>
    </div>
  )
}

function NotFoundScreen() {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '40px 32px', textAlign: 'center', maxWidth: 400 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900, color: BLK }}>Link not found</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>This intake link is invalid or has expired. Contact your trainer for a new one.</p>
      </div>
    </div>
  )
}

function GeneratingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '32px 28px', textAlign: 'center', maxWidth: 480 }}>
        <div style={{ width: 48, height: 48, margin: '0 auto 20px', border: '4px solid #f3f4f6', borderTopColor: R, borderRadius: '50%', animation: 'kotoSpin 0.9s linear infinite' }} />
        <style>{'@keyframes kotoSpin{to{transform:rotate(360deg)}}'}</style>
        <h1 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: BLK }}>Crafting your plan</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.55 }}>
          Your baseline, 90-day roadmap, 2-week workout block, and coaching playbook are generating now. This takes about a minute.
        </p>
      </section>
    </div>
  )
}

function DoneScreen({ name }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '40px 32px', textAlign: 'center', maxWidth: 480 }}>
        <div style={{ width: 48, height: 48, margin: '0 auto 16px', background: GRN + '15', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={24} color={GRN} />
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: BLK }}>You're all set{name ? `, ${name.split(' ')[0]}` : ''}!</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.55 }}>
          Your personalized plan has been generated. Your trainer will review it and reach out with next steps.
        </p>
      </section>
    </div>
  )
}
