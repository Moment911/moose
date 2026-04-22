"use client"
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, Sparkles, ArrowLeft, Check, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import TrainerWelcomeCard from '../../components/trainer/TrainerWelcomeCard'
import {
  PRIMARY_GOALS,
  EQUIPMENT_ACCESS,
  DIETARY_PREFERENCES,
  OCCUPATION_ACTIVITIES,
  validateIntake,
} from '../../lib/trainer/intakeSchema'
import { REQUIRED_INTAKE_FIELDS, missingIntakeFields } from '../../lib/trainer/intakeCompleteness'
import { feetInchesToCm, lbsToKg } from '../../lib/trainer/units'
import { T, BLK, GRY, GRN, R } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// /my-intake — AI-first self-service intake.
//
// Three phases:
//   1. Tell us about yourself — ONE textarea.  Trainee writes as much or as
//      little as they want (sport, job, goals, injuries, equipment, etc.).
//   2. Review + fill the gaps — Sonnet reads the paragraph, auto-populates
//      every IntakeInput field it could extract, and lists targeted
//      follow-up questions for the required fields that weren't covered.
//      The trainee reviews the pre-populated values (editable) and answers
//      the gaps.
//   3. Generating plan — plan chain runs server-side (~60-90s), then
//      redirect to /my-plan.
//
// This replaces the old 17-field flat form.  Trainees never answer what
// they already said in their paragraph.
// ─────────────────────────────────────────────────────────────────────────────

const BG = '#f9fafb'
const BRD = '#e5e7eb'

export default function SelfIntakePage() {
  const navigate = useNavigate()

  const [sessionState, setSessionState] = useState({ loading: true, user: null })
  const [phase, setPhase] = useState('story') // 'story' | 'extracting' | 'review' | 'generating' | 'done'
  const [freeText, setFreeText] = useState('')
  const [extractError, setExtractError] = useState(null)
  const [extracted, setExtracted] = useState({})       // partial IntakeInput from Sonnet
  const [aboutYou, setAboutYou] = useState('')         // cleaned paragraph
  const [remainingQuestions, setRemainingQuestions] = useState([])
  const [answers, setAnswers] = useState({})           // question_id → value
  const [reviewDraft, setReviewDraft] = useState({})   // editable view of extracted fields
  const [generateError, setGenerateError] = useState(null)
  const [submittedFieldErrors, setSubmittedFieldErrors] = useState({})

  // Gate to auth + bounce existing trainees to /my-plan.
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      const user = data?.session?.user
      if (!user) { navigate('/start'); return }
      const { data: mapping } = await supabase
        .from('koto_fitness_trainee_users')
        .select('trainee_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (mapping) { navigate('/my-plan'); return }
      setSessionState({ loading: false, user })
    })
    return () => { cancelled = true }
  }, [navigate])

  async function handleExtract(e) {
    e?.preventDefault?.()
    if (freeText.trim().length < 20) {
      setExtractError('Write at least a sentence — we need something to work with.')
      return
    }
    setExtractError(null)
    setPhase('extracting')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (!token) { setExtractError('Your session expired. Sign in again.'); setPhase('story'); return }
      const res = await fetch('/api/trainer/intake-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ free_text: freeText.trim() }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setExtractError(payload?.detail || payload?.error || `Could not read your story (${res.status})`)
        setPhase('story')
        return
      }
      setExtracted(payload.extracted || {})
      setAboutYou(payload.about_you || freeText.trim())
      setRemainingQuestions(payload.remaining_questions || [])
      setReviewDraft(seedReviewDraft(payload.extracted || {}))
      setAnswers({})
      setPhase('review')
    } catch (err) {
      setExtractError(err?.message || 'Network error while reading your story.')
      setPhase('story')
    }
  }

  async function handleGenerate() {
    setGenerateError(null)
    setSubmittedFieldErrors({})

    // Build the full IntakeInput payload from review draft + follow-up answers.
    const payload = {
      full_name:
        sessionState.user?.user_metadata?.full_name ||
        extracted.full_name ||
        (sessionState.user?.email || '').split('@')[0] || 'New trainee',
      about_you: aboutYou,
      ...buildIntakeFromReview(reviewDraft),
      ...buildIntakeFromAnswers(remainingQuestions, answers),
    }

    // Client-side validate; duplicates the server check but catches obvious
    // gaps before we fire the expensive Sonnet chain.
    const validation = validateIntake(payload)
    if (!validation.ok) {
      setSubmittedFieldErrors(validation.errors)
      setGenerateError('A few answers still need attention — see the red flags below.')
      return
    }

    // Also enforce the full completeness list (validateIntake only requires
    // full_name + about_you; the server gate wants all 17).
    const missing = missingIntakeFields(validation.data)
    if (missing.length > 0) {
      const missingErrors = {}
      for (const f of missing) missingErrors[f] = 'Required'
      setSubmittedFieldErrors(missingErrors)
      setGenerateError(`Still missing: ${missing.join(', ')}.  Scroll up and finish those.`)
      return
    }

    setPhase('generating')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (!token) { setGenerateError('Session expired.'); setPhase('review'); setTimeout(() => navigate('/start'), 1200); return }
      const res = await fetch('/api/trainer/self-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ intake: validation.data }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (body?.error === 'intake_incomplete' && Array.isArray(body.missing_fields)) {
          const missingErrors = {}
          for (const f of body.missing_fields) missingErrors[f] = 'Required'
          setSubmittedFieldErrors(missingErrors)
          setGenerateError(`Still missing: ${body.missing_fields.join(', ')}.`)
        } else {
          setGenerateError(body?.error || `Save failed (${res.status})`)
        }
        setPhase('review')
        return
      }
      setPhase('done')
      navigate('/my-plan')
    } catch (err) {
      setGenerateError(err?.message || 'Network error during setup.')
      setPhase('review')
    }
  }

  if (sessionState.loading) return <CenteredSpinner label="Loading your account…" />

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '32px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <header style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: GRY, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Step 2 of 2
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 900, color: BLK, letterSpacing: '-.3px' }}>
            {phase === 'story' && 'Tell us about yourself'}
            {phase === 'extracting' && 'Reading your story…'}
            {phase === 'review' && 'Quick confirm'}
            {phase === 'generating' && 'Crafting your plan'}
            {phase === 'done' && 'Almost there…'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: GRY }}>
            {phase === 'story' && 'One paragraph. Anything you already say here, we won’t ask again.'}
            {phase === 'extracting' && 'Sonnet is pulling fields from what you wrote…'}
            {phase === 'review' && 'We filled in what you already said. Fix anything that’s wrong and answer the few questions we still need.'}
            {phase === 'generating' && 'Baseline, roadmap, workout, playbook — ~60-90s.'}
            {phase === 'done' && 'Redirecting to your plan.'}
          </p>
        </header>

        {phase === 'story' && (
          <TrainerWelcomeCard compact />
        )}

        {phase === 'story' && (
          <StoryForm
            freeText={freeText}
            onChange={setFreeText}
            onSubmit={handleExtract}
            error={extractError}
          />
        )}

        {phase === 'extracting' && <ExtractingScreen />}

        {phase === 'review' && (
          <ReviewFormScreen
            aboutYou={aboutYou}
            extracted={extracted}
            reviewDraft={reviewDraft}
            setReviewDraft={setReviewDraft}
            remainingQuestions={remainingQuestions}
            answers={answers}
            setAnswers={setAnswers}
            onBack={() => setPhase('story')}
            onGenerate={handleGenerate}
            generateError={generateError}
            fieldErrors={submittedFieldErrors}
          />
        )}

        {phase === 'generating' && <GeneratingScreen />}

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: GRY }}>
          <Link to="/start" style={{ color: T, textDecoration: 'none', fontWeight: 700 }}>← Back</Link>
        </div>
      </div>
    </div>
  )
}

// ── Phase 1 — Story textarea ───────────────────────────────────────────────

function StoryForm({ freeText, onChange, onSubmit, error }) {
  return (
    <section style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 12, padding: '22px 24px' }}>
      <form onSubmit={onSubmit}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: BLK, marginBottom: 8 }}>
          About you and your goals *
        </label>
        <textarea
          value={freeText}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          rows={10}
          placeholder={PLACEHOLDER}
          style={{
            width: '100%', padding: '12px 14px', fontSize: 14,
            border: `1px solid #d1d5db`, borderRadius: 10,
            fontFamily: 'inherit', lineHeight: 1.55, color: '#0a0a0a',
            resize: 'vertical', minHeight: 200,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 11, color: GRY }}>
            Anything you mention — age, sport, injuries, sleep, job, equipment — we’ll pre-fill and skip on the next page.
          </span>
          <button
            type="submit"
            disabled={freeText.trim().length < 20}
            style={{
              padding: '12px 18px',
              background: freeText.trim().length < 20 ? '#9ca3af' : R,
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 800, cursor: freeText.trim().length < 20 ? 'default' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Sparkles size={14} /> Continue
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
            {error}
          </div>
        )}
      </form>
    </section>
  )
}

// ── Phase 2 — Review extracted + fill gaps ─────────────────────────────────

function ReviewFormScreen({
  aboutYou,
  extracted,
  reviewDraft,
  setReviewDraft,
  remainingQuestions,
  answers,
  setAnswers,
  onBack,
  onGenerate,
  generateError,
  fieldErrors,
}) {
  const extractedCount = Object.keys(extracted || {}).filter((k) => extracted[k] !== undefined && extracted[k] !== null && extracted[k] !== '').length

  function setDraft(field, value) {
    setReviewDraft((prev) => ({ ...prev, [field]: value }))
  }
  function setAnswer(qid, value) {
    setAnswers((prev) => ({ ...prev, [qid]: value }))
  }

  return (
    <>
      {/* Extracted summary */}
      <section style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: `4px solid ${GRN}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Check size={16} color={GRN} />
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#065f46', letterSpacing: '.04em', textTransform: 'uppercase' }}>
            We read your story
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#065f46', lineHeight: 1.55 }}>
          Pulled <strong>{extractedCount}</strong> answers from what you wrote.
          Fix anything below that’s off — you know you better than we do.
        </p>
      </section>

      {/* Editable pre-populated fields */}
      <section style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: T, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          What we got
        </h2>

        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="About you" hint="Fed into every AI-generated step — baseline, roadmap, workouts, meals, playbook.">
            <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: `1px dashed ${BRD}`, fontSize: 13, color: '#0a0a0a', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {aboutYou}
            </div>
          </Field>

          <Row2>
            <Field label="Age *" error={fieldErrors.age}>
              <NumInput value={reviewDraft.age} onChange={(v) => setDraft('age', v)} min={10} max={120} step={1} placeholder="yrs" />
            </Field>
            <Field label="Sex *" error={fieldErrors.sex}>
              <RadioPill
                value={reviewDraft.sex}
                options={['M', 'F', 'Other']}
                labels={{ M: 'Male', F: 'Female', Other: 'Other' }}
                onChange={(v) => setDraft('sex', v)}
              />
            </Field>
          </Row2>

          <Row2>
            <Field label="Height *" error={fieldErrors.height_cm}>
              <Row2Tight>
                <NumInput value={reviewDraft.height_ft} onChange={(v) => setDraft('height_ft', v)} min={0} max={9} placeholder="ft" />
                <NumInput value={reviewDraft.height_in} onChange={(v) => setDraft('height_in', v)} min={0} max={11} placeholder="in" />
              </Row2Tight>
            </Field>
            <Field label="Current weight *" error={fieldErrors.current_weight_kg}>
              <NumInput value={reviewDraft.current_weight_lbs} onChange={(v) => setDraft('current_weight_lbs', v)} min={50} max={600} step={1} placeholder="lbs" />
            </Field>
          </Row2>

          <Field label="Target weight (optional)">
            <NumInput value={reviewDraft.target_weight_lbs} onChange={(v) => setDraft('target_weight_lbs', v)} min={50} max={600} step={1} placeholder="lbs" />
          </Field>

          <Field label="Primary goal *" error={fieldErrors.primary_goal}>
            <RadioPill
              value={reviewDraft.primary_goal}
              options={[...PRIMARY_GOALS]}
              labels={GOAL_LABELS}
              onChange={(v) => setDraft('primary_goal', v)}
            />
          </Field>

          <Row2>
            <Field label="Training experience (years) *" error={fieldErrors.training_experience_years}>
              <NumInput value={reviewDraft.training_experience_years} onChange={(v) => setDraft('training_experience_years', v)} min={0} max={60} step={0.5} placeholder="yrs" />
            </Field>
            <Field label="Training days/week *" error={fieldErrors.training_days_per_week}>
              <NumInput value={reviewDraft.training_days_per_week} onChange={(v) => setDraft('training_days_per_week', v)} min={0} max={7} step={1} placeholder="0–7" />
            </Field>
          </Row2>

          <Field label="Equipment access *" error={fieldErrors.equipment_access}>
            <RadioPill
              value={reviewDraft.equipment_access}
              options={[...EQUIPMENT_ACCESS]}
              labels={EQUIPMENT_LABELS}
              onChange={(v) => setDraft('equipment_access', v)}
            />
          </Field>

          <Field label="Medical flags *" error={fieldErrors.medical_flags} hint='"None" is a valid answer.'>
            <textarea value={reviewDraft.medical_flags || ''} onChange={(e) => setDraft('medical_flags', e.target.value)} rows={2} style={taStyle} placeholder='Cardiac, hypertension, surgery, meds — or "None".' />
          </Field>
          <Field label="Injuries *" error={fieldErrors.injuries} hint='"None" is a valid answer.'>
            <textarea value={reviewDraft.injuries || ''} onChange={(e) => setDraft('injuries', e.target.value)} rows={2} style={taStyle} placeholder='Current or chronic injuries — or "None".' />
          </Field>

          <Row2>
            <Field label="Average sleep (hrs/night) *" error={fieldErrors.sleep_hours_avg}>
              <NumInput value={reviewDraft.sleep_hours_avg} onChange={(v) => setDraft('sleep_hours_avg', v)} min={0} max={16} step={0.5} placeholder="hrs" />
            </Field>
            <Field label="Stress (1–10) *" error={fieldErrors.stress_level}>
              <Select
                value={reviewDraft.stress_level}
                onChange={(v) => setDraft('stress_level', v)}
                options={[1,2,3,4,5,6,7,8,9,10].map((n) => ({ value: String(n), label: String(n) }))}
                placeholder="—"
              />
            </Field>
          </Row2>

          <Field label="Dietary preference *" error={fieldErrors.dietary_preference}>
            <Select
              value={reviewDraft.dietary_preference}
              onChange={(v) => setDraft('dietary_preference', v)}
              options={DIETARY_PREFERENCES.map((d) => ({ value: d, label: DIET_LABELS[d] }))}
              placeholder="Pick one"
            />
          </Field>
          <Field label="Allergies / intolerances *" error={fieldErrors.allergies} hint='"None" is a valid answer.'>
            <textarea value={reviewDraft.allergies || ''} onChange={(e) => setDraft('allergies', e.target.value)} rows={2} style={taStyle} placeholder='e.g. shellfish, tree nuts — or "None".' />
          </Field>

          <Row2>
            <Field label="Occupation activity *" error={fieldErrors.occupation_activity}>
              <RadioPill
                value={reviewDraft.occupation_activity}
                options={[...OCCUPATION_ACTIVITIES]}
                labels={OCCUPATION_LABELS}
                onChange={(v) => setDraft('occupation_activity', v)}
              />
            </Field>
            <Field label="Meals per day *" error={fieldErrors.meals_per_day}>
              <Select
                value={reviewDraft.meals_per_day}
                onChange={(v) => setDraft('meals_per_day', v)}
                options={[3,4,5,6].map((n) => ({ value: String(n), label: String(n) }))}
                placeholder="3–6"
              />
            </Field>
          </Row2>
        </div>
      </section>

      {/* Follow-up questions surfaced by Sonnet */}
      {remainingQuestions.length > 0 && (
        <section style={{ background: '#fffbea', border: '1px solid #fde68a', borderLeft: `4px solid #f59e0b`, borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <AlertTriangle size={16} color="#b45309" />
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#78350f', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              A few we still need
            </h2>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#78350f', lineHeight: 1.55 }}>
            You didn’t mention these in your story, and the plan needs them.
          </p>
          <div style={{ display: 'grid', gap: 14 }}>
            {remainingQuestions.map((q) => (
              <FollowUpQuestion key={q.question_id} q={q} value={answers[q.question_id] || ''} onChange={(v) => setAnswer(q.question_id, v)} />
            ))}
          </div>
        </section>
      )}

      {generateError && (
        <div style={{ marginBottom: 16, padding: '10px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
          {generateError}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={onBack} style={btnSecondary()}>
          <ArrowLeft size={13} /> Back
        </button>
        <button type="button" onClick={onGenerate} style={btnPrimary()}>
          Generate my plan <Sparkles size={13} />
        </button>
      </div>
    </>
  )
}

function FollowUpQuestion({ q, value, onChange }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 4 }}>
        {q.question_text}
      </label>
      {q.why_asked && (
        <div style={{ fontSize: 11, color: '#78350f', marginBottom: 6, fontStyle: 'italic' }}>
          {q.why_asked}
        </div>
      )}
      {q.question_type === 'select' && Array.isArray(q.options) ? (
        <RadioPill value={value} options={q.options} onChange={onChange} />
      ) : q.question_type === 'number' ? (
        <NumInput value={value} onChange={onChange} placeholder={q.placeholder || ''} />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder || ''}
          style={inputStyle}
        />
      )}
    </div>
  )
}

// ── Data helpers ───────────────────────────────────────────────────────────

function seedReviewDraft(extracted) {
  return {
    age: extracted.age ?? '',
    sex: extracted.sex ?? '',
    primary_goal: extracted.primary_goal ?? '',
    training_experience_years: extracted.training_experience_years ?? '',
    training_days_per_week: extracted.training_days_per_week ?? '',
    equipment_access: extracted.equipment_access ?? '',
    medical_flags: extracted.medical_flags ?? '',
    injuries: extracted.injuries ?? '',
    dietary_preference: extracted.dietary_preference ?? '',
    allergies: extracted.allergies ?? '',
    sleep_hours_avg: extracted.sleep_hours_avg ?? '',
    stress_level: extracted.stress_level ?? '',
    occupation_activity: extracted.occupation_activity ?? '',
    meals_per_day: extracted.meals_per_day ?? '',
    height_ft: extracted.height_cm ? String(Math.floor((extracted.height_cm / 2.54) / 12)) : '',
    height_in: extracted.height_cm ? String(Math.round((extracted.height_cm / 2.54) % 12)) : '',
    current_weight_lbs: extracted.current_weight_kg ? String(Math.round(extracted.current_weight_kg * 2.20462)) : '',
    target_weight_lbs: extracted.target_weight_kg ? String(Math.round(extracted.target_weight_kg * 2.20462)) : '',
  }
}

function buildIntakeFromReview(r) {
  const out = {
    age: r.age === '' ? null : Number(r.age),
    sex: r.sex || null,
    primary_goal: r.primary_goal || null,
    training_experience_years: r.training_experience_years === '' ? null : Number(r.training_experience_years),
    training_days_per_week: r.training_days_per_week === '' ? null : Number(r.training_days_per_week),
    equipment_access: r.equipment_access || null,
    medical_flags: (r.medical_flags || '').trim() || null,
    injuries: (r.injuries || '').trim() || null,
    dietary_preference: r.dietary_preference || null,
    allergies: (r.allergies || '').trim() || null,
    sleep_hours_avg: r.sleep_hours_avg === '' ? null : Number(r.sleep_hours_avg),
    stress_level: r.stress_level === '' ? null : Number(r.stress_level),
    occupation_activity: r.occupation_activity || null,
    meals_per_day: r.meals_per_day === '' ? null : Number(r.meals_per_day),
  }
  const ft = r.height_ft === '' ? null : Number(r.height_ft)
  const inches = r.height_in === '' ? null : Number(r.height_in)
  if (ft !== null || inches !== null) out.height_cm = feetInchesToCm(ft || 0, inches || 0)
  if (r.current_weight_lbs !== '') {
    const n = Number(r.current_weight_lbs)
    if (Number.isFinite(n)) out.current_weight_kg = lbsToKg(n)
  }
  if (r.target_weight_lbs !== '') {
    const n = Number(r.target_weight_lbs)
    if (Number.isFinite(n)) out.target_weight_kg = lbsToKg(n)
  }
  // Strip nulls so validateIntake doesn't see empty strings either.
  const cleaned = {}
  for (const [k, v] of Object.entries(out)) {
    if (v === null || v === undefined || v === '') continue
    cleaned[k] = v
  }
  return cleaned
}

function buildIntakeFromAnswers(questions, answers) {
  const out = {}
  const numericFields = new Set(REQUIRED_INTAKE_FIELDS.filter((f) => [
    'age','height_cm','current_weight_kg','training_experience_years','training_days_per_week','sleep_hours_avg','stress_level','meals_per_day',
  ].includes(f)))
  for (const q of questions) {
    const v = answers[q.question_id]
    if (v === undefined || v === '' || v === null) continue
    if (numericFields.has(q.question_id)) {
      const n = Number(v)
      if (Number.isFinite(n)) out[q.question_id] = n
    } else {
      out[q.question_id] = v
    }
  }
  return out
}

// ── Rendering primitives ───────────────────────────────────────────────────

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: GRY, marginTop: 4 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{error}</div>}
    </div>
  )
}

function NumInput({ value, onChange, min, max, step = 1, placeholder }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={min} max={max} step={step} placeholder={placeholder}
      style={inputStyle}
    />
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

function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      <option value="">{placeholder || 'Select'}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Row2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

function Row2Tight({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{children}</div>
}

// ── Progress screens ───────────────────────────────────────────────────────

function CenteredSpinner({ label }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: GRY, fontSize: 14 }}>
        <Loader2 size={16} /> {label}
      </div>
    </div>
  )
}

function ExtractingScreen() {
  return (
    <section style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 12, padding: '32px 28px', textAlign: 'center' }}>
      <div
        style={{
          width: 44, height: 44, margin: '0 auto 16px',
          border: `4px solid #f3f4f6`, borderTopColor: T,
          borderRadius: '50%',
          animation: 'kotoExtractSpin 0.9s linear infinite',
        }}
      />
      <style>{'@keyframes kotoExtractSpin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ fontSize: 14, color: BLK, fontWeight: 700, marginBottom: 4 }}>Reading your story…</div>
      <div style={{ fontSize: 12, color: GRY }}>Pulling age, height, weight, goal, equipment, and anything else you mentioned.</div>
    </section>
  )
}

function GeneratingScreen() {
  return (
    <section style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 12, padding: '32px 28px', textAlign: 'center' }}>
      <div
        style={{
          width: 48, height: 48, margin: '0 auto 20px',
          border: `4px solid #f3f4f6`, borderTopColor: R,
          borderRadius: '50%',
          animation: 'kotoGenerateSpin 0.9s linear infinite',
        }}
      />
      <style>{'@keyframes kotoGenerateSpin{to{transform:rotate(360deg)}}'}</style>
      <h1 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: BLK, letterSpacing: '-.3px' }}>
        Crafting your plan
      </h1>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: GRY, lineHeight: 1.55 }}>
        Your baseline, 90-day roadmap, 2-week workout block, and coaching playbook are
        generating now. This takes about a minute — don’t close this tab.
      </p>
      <ul style={{ textAlign: 'left', margin: '0 auto', paddingLeft: 20, fontSize: 12, color: GRY, lineHeight: 1.9, maxWidth: 360 }}>
        <li>Calorie + macro targets + training readiness</li>
        <li>3 × 30-day phases with measurable milestones</li>
        <li>2-week trackable workout block</li>
        <li>Coaching playbook — supplements, travel, recovery, scenarios</li>
      </ul>
    </section>
  )
}

// ── Label maps ─────────────────────────────────────────────────────────────

const GOAL_LABELS = {
  lose_fat: 'Lose fat',
  gain_muscle: 'Gain muscle',
  maintain: 'Maintain',
  performance: 'Performance',
  recomp: 'Recomp',
}
const EQUIPMENT_LABELS = {
  none: 'None',
  bands: 'Bands',
  home_gym: 'Home gym',
  full_gym: 'Full gym',
}
const DIET_LABELS = {
  none: 'No preference',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
  keto: 'Keto',
  paleo: 'Paleo',
  custom: 'Custom',
}
const OCCUPATION_LABELS = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  heavy: 'Heavy',
}

// ── Styles ─────────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #d1d5db', borderRadius: 6,
  background: '#fff', color: '#0a0a0a', fontFamily: 'inherit',
}
const taStyle = {
  ...inputStyle,
  lineHeight: 1.5,
  resize: 'vertical',
}

function btnPrimary() {
  return {
    padding: '12px 18px', background: R, color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  }
}
function btnSecondary() {
  return {
    padding: '12px 18px', background: '#fff', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  }
}

const PLACEHOLDER = `Example:\n\nI'm a 16-year-old high school baseball pitcher, junior year, starter in the rotation.  I'm throwing around 82 mph and want to add velocity without blowing out my shoulder.  Coach said I need to be stronger in the offseason.  I lift at the school weight room 3 days a week, it has racks and dumbbells.  Played through a minor elbow flare last spring so I want to protect the arm.  I sleep about 7 hours most nights, eat 4 meals a day, no allergies, no medications.  5 feet 11, 170 lbs.`
