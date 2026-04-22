"use client"
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, Sparkles, ArrowLeft, Check, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import TrainerWelcomeCard from '../../components/trainer/TrainerWelcomeCard'
import NoneOrText from '../../components/trainer/NoneOrText'
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
// /my-intake — self-service intake.  Three-phase flow:
//
//   Phase 1 — "Basics + your story"
//     Structured: name / age / sex / height / weight.
//     Plus: free-text paragraph about themselves + goals.
//   Phase 2 — "Quick confirm"
//     Sonnet reads the paragraph + structured basics, populates every other
//     required field it can extract, and lists follow-up questions for what's
//     still missing.  Everything is editable before submission.
//   Phase 3 — plan generation (~60-90s), then /my-plan.
// ─────────────────────────────────────────────────────────────────────────────

const BG = '#f9fafb'
const BRD = '#e5e7eb'

export default function SelfIntakePage() {
  const navigate = useNavigate()

  const [sessionState, setSessionState] = useState({ loading: true, user: null })
  const [phase, setPhase] = useState('basics') // 'basics' | 'extracting' | 'review' | 'generating'

  // Phase 1 state — structured basics
  const [basics, setBasics] = useState({
    full_name: '',
    age: '',
    sex: '',
    height_ft: '',
    height_in: '',
    current_weight_lbs: '',
  })
  const [freeText, setFreeText] = useState('')
  const [basicsError, setBasicsError] = useState(null)

  // Phase 2 state — extracted + review + follow-ups
  const [extracted, setExtracted] = useState({})
  const [aboutYou, setAboutYou] = useState('')
  const [remainingQuestions, setRemainingQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [reviewDraft, setReviewDraft] = useState({})

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
      setBasics((b) => ({
        ...b,
        full_name: user.user_metadata?.full_name || '',
      }))
    })
    return () => { cancelled = true }
  }, [navigate])

  function setBasic(field, value) {
    setBasics((b) => ({ ...b, [field]: value }))
  }

  // ── Phase 1 → 2: submit basics + story to extract endpoint ──────────────
  async function handleBasicsSubmit(e) {
    e?.preventDefault?.()
    setBasicsError(null)

    // Validate required basics.
    const missing = []
    if (!basics.full_name.trim()) missing.push('name')
    if (basics.age === '' || !Number.isFinite(Number(basics.age))) missing.push('age')
    if (!basics.sex) missing.push('sex')
    if (basics.height_ft === '' && basics.height_in === '') missing.push('height')
    if (basics.current_weight_lbs === '') missing.push('weight')
    if (freeText.trim().length < 20) missing.push('about you (write at least a sentence)')
    if (missing.length > 0) {
      setBasicsError(`Fill these in before continuing: ${missing.join(', ')}.`)
      return
    }

    // Build the already_filled payload we'll hand to Sonnet.
    const ft = basics.height_ft === '' ? 0 : Number(basics.height_ft)
    const inches = basics.height_in === '' ? 0 : Number(basics.height_in)
    const alreadyFilled = {
      full_name: basics.full_name.trim(),
      age: Number(basics.age),
      sex: basics.sex,
      height_cm: feetInchesToCm(ft, inches),
      current_weight_kg: lbsToKg(Number(basics.current_weight_lbs)),
    }

    setPhase('extracting')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (!token) { setBasicsError('Your session expired. Sign in again.'); setPhase('basics'); return }
      const res = await fetch('/api/trainer/intake-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ free_text: freeText.trim(), already_filled: alreadyFilled }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBasicsError(payload?.detail || payload?.error || `Could not read your story (${res.status})`)
        setPhase('basics')
        return
      }
      // Merge the structured basics into the extracted object so the review
      // view renders a complete recap from the start.
      const merged = { ...alreadyFilled, ...payload.extracted }
      setExtracted(merged)
      setAboutYou(payload.about_you || freeText.trim())
      setRemainingQuestions(payload.remaining_questions || [])
      setReviewDraft(seedReviewDraft(merged))
      setAnswers({})
      setPhase('review')
    } catch (err) {
      setBasicsError(err?.message || 'Network error while reading your story.')
      setPhase('basics')
    }
  }

  // ── Phase 2 → 3: final submit → plan generation ─────────────────────────
  async function handleGenerate() {
    setGenerateError(null)
    setSubmittedFieldErrors({})

    const payload = {
      full_name: reviewDraft.full_name || basics.full_name || extracted.full_name || 'New trainee',
      about_you: aboutYou,
      ...buildIntakeFromReview(reviewDraft),
      ...buildIntakeFromAnswers(remainingQuestions, answers),
    }

    const validation = validateIntake(payload)
    if (!validation.ok) {
      setSubmittedFieldErrors(validation.errors)
      setGenerateError('A few answers still need attention — see the red notes below.')
      return
    }
    const missing = missingIntakeFields(validation.data)
    if (missing.length > 0) {
      const e = {}
      for (const f of missing) e[f] = 'Required'
      setSubmittedFieldErrors(e)
      setGenerateError(`Still missing: ${missing.join(', ')}.`)
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
          const e = {}
          for (const f of body.missing_fields) e[f] = 'Required'
          setSubmittedFieldErrors(e)
          setGenerateError(`Still missing: ${body.missing_fields.join(', ')}.`)
        } else {
          setGenerateError(body?.error || `Save failed (${res.status})`)
        }
        setPhase('review')
        return
      }
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
            Step {phase === 'basics' ? '1' : '2'} of 2
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 900, color: BLK, letterSpacing: '-.3px' }}>
            {phase === 'basics' && 'Your basics + your story'}
            {phase === 'extracting' && 'Reading your story…'}
            {phase === 'review' && 'Full profile — confirm + fill the gaps'}
            {phase === 'generating' && 'Crafting your plan'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: GRY }}>
            {phase === 'basics' && 'Quick basics, then tell us about you in your own words. Anything you mention — we skip asking again.'}
            {phase === 'extracting' && 'Sonnet is pulling everything it can from what you wrote…'}
            {phase === 'review' && 'Here’s the full picture. Fix anything off, and answer the gaps the AI flagged.'}
            {phase === 'generating' && 'Baseline, roadmap, 2-week workout, playbook — ~60-90s.'}
          </p>
        </header>

        {phase === 'basics' && <TrainerWelcomeCard compact />}

        {phase === 'basics' && (
          <BasicsAndStoryForm
            basics={basics}
            onChangeBasic={setBasic}
            freeText={freeText}
            onChangeFreeText={setFreeText}
            onSubmit={handleBasicsSubmit}
            error={basicsError}
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
            onBack={() => setPhase('basics')}
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

// ── Phase 1 — Basics form + story textarea ─────────────────────────────────

function BasicsAndStoryForm({ basics, onChangeBasic, freeText, onChangeFreeText, onSubmit, error }) {
  return (
    <section style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 12, padding: '22px 24px' }}>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr' }}>
          <Field label="Your name *">
            <input value={basics.full_name} onChange={(e) => onChangeBasic('full_name', e.target.value)} style={inputStyle} autoComplete="name" />
          </Field>

          <Row2>
            <Field label="Age *">
              <NumInput value={basics.age} onChange={(v) => onChangeBasic('age', v)} min={10} max={120} step={1} placeholder="yrs" />
            </Field>
            <Field label="Sex *">
              <RadioPill
                value={basics.sex}
                options={['M', 'F', 'Other']}
                labels={{ M: 'Male', F: 'Female', Other: 'Other' }}
                onChange={(v) => onChangeBasic('sex', v)}
              />
            </Field>
          </Row2>

          <Row2>
            <Field label="Height *">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <NumInput value={basics.height_ft} onChange={(v) => onChangeBasic('height_ft', v)} min={0} max={9} step={1} placeholder="ft" />
                <NumInput value={basics.height_in} onChange={(v) => onChangeBasic('height_in', v)} min={0} max={11} step={1} placeholder="in" />
              </div>
            </Field>
            <Field label="Current weight *">
              <NumInput value={basics.current_weight_lbs} onChange={(v) => onChangeBasic('current_weight_lbs', v)} min={50} max={600} step={1} placeholder="lbs" />
            </Field>
          </Row2>
        </div>

        <div style={{ marginTop: 4 }}>
          <Field label="Tell us about you and what you want *" hint="Anything you mention — sport, job, injuries, equipment, goals — we skip asking again.">
            <textarea
              value={freeText}
              onChange={(e) => onChangeFreeText(e.target.value)}
              rows={10}
              placeholder={PLACEHOLDER}
              style={{
                width: '100%', padding: '12px 14px', fontSize: 14,
                border: `1px solid #d1d5db`, borderRadius: 10,
                fontFamily: 'inherit', lineHeight: 1.55, color: '#0a0a0a',
                resize: 'vertical', minHeight: 200,
              }}
            />
          </Field>
        </div>

        {error && (
          <div style={{ padding: '10px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" style={btnPrimary()}>
            <Sparkles size={14} /> Continue
          </button>
        </div>
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
      {/* Summary bar */}
      <section style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: `4px solid ${GRN}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Check size={16} color={GRN} />
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#065f46', letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Full profile so far
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#065f46', lineHeight: 1.55 }}>
          Pulled <strong>{extractedCount}</strong> answers from your basics + story.
          Fix anything below that’s off — you know you better than we do.
        </p>
      </section>

      {/* Editable recap */}
      <section style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: T, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          Your recap
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
              <RadioPill value={reviewDraft.sex} options={['M', 'F', 'Other']} labels={{ M: 'Male', F: 'Female', Other: 'Other' }} onChange={(v) => setDraft('sex', v)} />
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
            <RadioPill value={reviewDraft.primary_goal} options={[...PRIMARY_GOALS]} labels={GOAL_LABELS} onChange={(v) => setDraft('primary_goal', v)} />
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
            <RadioPill value={reviewDraft.equipment_access} options={[...EQUIPMENT_ACCESS]} labels={EQUIPMENT_LABELS} onChange={(v) => setDraft('equipment_access', v)} />
          </Field>

          <Field label="Medical flags *" error={fieldErrors.medical_flags}>
            <NoneOrText value={reviewDraft.medical_flags} onChange={(v) => setDraft('medical_flags', v)} placeholder="Cardiac, hypertension, recent surgery, medications, etc." />
          </Field>
          <Field label="Injuries *" error={fieldErrors.injuries}>
            <NoneOrText value={reviewDraft.injuries} onChange={(v) => setDraft('injuries', v)} placeholder="Current or chronic injuries affecting training." />
          </Field>

          <Row2>
            <Field label="Average sleep (hrs/night) *" error={fieldErrors.sleep_hours_avg}>
              <NumInput value={reviewDraft.sleep_hours_avg} onChange={(v) => setDraft('sleep_hours_avg', v)} min={0} max={16} step={0.5} placeholder="hrs" />
            </Field>
            <Field label="Stress (1–10) *" error={fieldErrors.stress_level}>
              <Select value={reviewDraft.stress_level} onChange={(v) => setDraft('stress_level', v)} options={[1,2,3,4,5,6,7,8,9,10].map((n) => ({ value: String(n), label: String(n) }))} placeholder="—" />
            </Field>
          </Row2>

          <Field label="Dietary preference *" error={fieldErrors.dietary_preference}>
            <Select value={reviewDraft.dietary_preference} onChange={(v) => setDraft('dietary_preference', v)} options={DIETARY_PREFERENCES.map((d) => ({ value: d, label: DIET_LABELS[d] }))} placeholder="Pick one" />
          </Field>
          <Field label="Allergies / intolerances *" error={fieldErrors.allergies}>
            <NoneOrText value={reviewDraft.allergies} onChange={(v) => setDraft('allergies', v)} placeholder="e.g. shellfish, tree nuts, dairy." />
          </Field>

          <Row2>
            <Field label="Occupation activity *" error={fieldErrors.occupation_activity}>
              <RadioPill value={reviewDraft.occupation_activity} options={[...OCCUPATION_ACTIVITIES]} labels={OCCUPATION_LABELS} onChange={(v) => setDraft('occupation_activity', v)} />
            </Field>
            <Field label="Meals per day *" error={fieldErrors.meals_per_day}>
              <Select value={reviewDraft.meals_per_day} onChange={(v) => setDraft('meals_per_day', v)} options={[3,4,5,6].map((n) => ({ value: String(n), label: String(n) }))} placeholder="3–6" />
            </Field>
          </Row2>
        </div>
      </section>

      {/* AI-generated follow-ups for fields still not answered */}
      {remainingQuestions.length > 0 && (
        <section style={{ background: '#fffbea', border: '1px solid #fde68a', borderLeft: `4px solid #f59e0b`, borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <AlertTriangle size={16} color="#b45309" />
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#78350f', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              A few questions we still need
            </h2>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#78350f', lineHeight: 1.55 }}>
            Not covered in your story. The coach needs these to tailor the plan.
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
  const isHealthField = q.question_id === 'medical_flags' || q.question_id === 'injuries' || q.question_id === 'allergies'
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
      {isHealthField ? (
        <NoneOrText value={value} onChange={onChange} placeholder={q.placeholder || ''} />
      ) : q.question_type === 'select' && Array.isArray(q.options) ? (
        <RadioPill value={value} options={q.options} onChange={onChange} />
      ) : q.question_type === 'number' ? (
        <NumInput value={value} onChange={onChange} placeholder={q.placeholder || ''} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={q.placeholder || ''} style={inputStyle} />
      )}
    </div>
  )
}

// ── Data helpers ───────────────────────────────────────────────────────────

function seedReviewDraft(extracted) {
  return {
    full_name: extracted.full_name ?? '',
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
    <input type="number" value={value} onChange={(e) => onChange(e.target.value)} min={min} max={max} step={step} placeholder={placeholder} style={inputStyle} />
  )
}

function RadioPill({ value, options, labels, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt) => {
        const active = String(value) === String(opt)
        return (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            style={{
              padding: '6px 12px',
              border: `1px solid ${active ? R : '#d1d5db'}`,
              borderRadius: 999,
              background: active ? R + '10' : '#fff',
              color: active ? R : '#374151',
              fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
            }}>
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
      <div style={{ width: 44, height: 44, margin: '0 auto 16px', border: `4px solid #f3f4f6`, borderTopColor: T, borderRadius: '50%', animation: 'kotoExtractSpin 0.9s linear infinite' }} />
      <style>{'@keyframes kotoExtractSpin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ fontSize: 14, color: BLK, fontWeight: 700, marginBottom: 4 }}>Reading your story…</div>
      <div style={{ fontSize: 12, color: GRY }}>Pulling goal, equipment, experience, injuries, and anything else you mentioned.</div>
    </section>
  )
}

function GeneratingScreen() {
  return (
    <section style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 12, padding: '32px 28px', textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, margin: '0 auto 20px', border: `4px solid #f3f4f6`, borderTopColor: R, borderRadius: '50%', animation: 'kotoGenerateSpin 0.9s linear infinite' }} />
      <style>{'@keyframes kotoGenerateSpin{to{transform:rotate(360deg)}}'}</style>
      <h1 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: BLK, letterSpacing: '-.3px' }}>Crafting your plan</h1>
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

const GOAL_LABELS = { lose_fat: 'Lose fat', gain_muscle: 'Gain muscle', maintain: 'Maintain', performance: 'Performance', recomp: 'Recomp' }
const EQUIPMENT_LABELS = { none: 'None', bands: 'Bands', home_gym: 'Home gym', full_gym: 'Full gym' }
const DIET_LABELS = { none: 'No preference', vegetarian: 'Vegetarian', vegan: 'Vegan', pescatarian: 'Pescatarian', keto: 'Keto', paleo: 'Paleo', custom: 'Custom' }
const OCCUPATION_LABELS = { sedentary: 'Sedentary', light: 'Light', moderate: 'Moderate', heavy: 'Heavy' }

// ── Styles ─────────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #d1d5db', borderRadius: 6,
  background: '#fff', color: '#0a0a0a', fontFamily: 'inherit',
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

const PLACEHOLDER = `Example:\n\nI'm a junior-year high school baseball pitcher, starter in the rotation, throwing around 82 mph.  Want to add velocity without blowing out my shoulder.  Coach said I need to be stronger in the offseason.  I lift at the school weight room 3 days a week, it has racks and dumbbells.  Played through a minor elbow flare last spring so I want to protect the arm.  I sleep about 7 hours most nights, eat 4 meals a day, no allergies, no medications.`
