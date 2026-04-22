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
  const [phase, setPhase] = useState('loading') // loading | not_found | chat | generating | done
  const [trainee, setTrainee] = useState(null)
  const [extracted, setExtracted] = useState({})
  const [aboutYou, setAboutYou] = useState('')
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
        setPhase('chat')
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
          />

          {/* Live card */}
          <div style={{ position: 'sticky', top: 24 }}>
            <LiveCard
              extracted={extracted}
              missingFields={missing}
              onGenerate={handleGenerate}
              generating={phase === 'generating'}
              generateError={generateError}
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

function TokenChatWidget({ traineeId, extracted, onFieldsUpdate, onAboutYouAppend, traineeName }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, streamingText])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  const streamTurn = useCallback(async (turnMessages) => {
    setStreaming(true)
    setStreamingText('')
    setError(null)

    try {
      const res = await fetch('/api/trainer/intake-chat-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainee_id: traineeId, messages: turnMessages, extracted }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error || `Error (${res.status})`)
        setStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setError('No stream'); setStreaming(false); return }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

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
          }
          if (event.type === 'error') setError(event.error || 'Stream error')
        }
      }

      if (fullText) setMessages((prev) => [...prev, { role: 'assistant', content: fullText }])
    } catch (e) {
      setError(e?.message || 'Network error')
    }
    setStreamingText('')
    setStreaming(false)
  }, [traineeId, extracted, onFieldsUpdate, onAboutYouAppend])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    streamTurn([])
  }, [streamTurn])

  function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    streamTurn(newMessages)
  }

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
        {error && <div style={{ padding: '8px 10px', background: '#fee2e2', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>{error}</div>}
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

const FIELD_DEFS = [
  { key: 'full_name', label: 'Name' },
  { key: 'age', label: 'Age', suffix: ' yrs' },
  { key: 'sex', label: 'Sex', map: { M: 'Male', F: 'Female', Other: 'Other' } },
  { key: 'height_cm', label: 'Height', format: 'height' },
  { key: 'current_weight_kg', label: 'Weight', format: 'weight' },
  { key: 'primary_goal', label: 'Goal', map: GOAL_LABELS },
  { key: 'training_experience_years', label: 'Experience', suffix: ' yrs' },
  { key: 'training_days_per_week', label: 'Days/week', suffix: ' days' },
  { key: 'equipment_access', label: 'Equipment', map: EQUIP_LABELS },
  { key: 'medical_flags', label: 'Medical' },
  { key: 'injuries', label: 'Injuries' },
  { key: 'dietary_preference', label: 'Diet', map: DIET_LABELS },
  { key: 'allergies', label: 'Allergies' },
  { key: 'sleep_hours_avg', label: 'Sleep', suffix: ' hrs' },
  { key: 'stress_level', label: 'Stress', suffix: '/10' },
  { key: 'occupation_activity', label: 'Activity', map: OCC_LABELS },
  { key: 'meals_per_day', label: 'Meals/day' },
]

function fmtVal(def, v) {
  if (v === null || v === undefined || v === '') return null
  if (def.format === 'height') return cmToFeetInches(v)
  if (def.format === 'weight') return `${kgToLbs(v)} lbs`
  if (def.map) return def.map[v] || String(v)
  if (def.suffix) return `${v}${def.suffix}`
  return String(v)
}

function LiveCard({ extracted, missingFields, onGenerate, generating, generateError }) {
  const filled = FIELD_DEFS.length - missingFields.length
  const allDone = missingFields.length === 0
  const pct = Math.round((filled / FIELD_DEFS.length) * 100)

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: BLK, letterSpacing: '.03em', textTransform: 'uppercase' }}>Your Profile</h3>
          <span style={{ fontSize: 12, fontWeight: 700, color: allDone ? GRN : '#6b7280' }}>{filled} / {FIELD_DEFS.length}</span>
        </div>
        <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: allDone ? GRN : T, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
      </div>
      <div style={{ padding: '6px 6px 10px' }}>
        {FIELD_DEFS.map((def) => {
          const display = fmtVal(def, extracted[def.key])
          const isFilled = display !== null
          return (
            <div key={def.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6 }}>
              {isFilled ? <Check size={13} color={GRN} strokeWidth={3} /> : <Circle size={13} color="#d1d5db" strokeWidth={1.5} />}
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', minWidth: 80 }}>{def.label}</span>
              <span style={{ fontSize: 13, fontWeight: isFilled ? 700 : 400, color: isFilled ? BLK : '#d1d5db', flex: 1 }}>{display ?? '---'}</span>
            </div>
          )
        })}
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
