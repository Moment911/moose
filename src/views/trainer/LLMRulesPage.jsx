"use client"
import { useState, useEffect, useCallback } from 'react'
import { Loader2, Save, RotateCcw, ChevronDown, ChevronRight, Shield, MessageCircle, Dumbbell, Utensils, Target, BookOpen, AlertTriangle, Brain, Sparkles } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { useAuth } from '../../hooks/useAuth'

// ─────────────────────────────────────────────────────────────────────────────
// /trainer/llm-rules — Admin page for viewing and editing all LLM rules.
//
// Sections organized by what they control:
// 1. Coach Persona — voice, credentials, language rules
// 2. Legal & Safety — compliance preamble, calorie floors, guardrail patterns
// 3. Intake Chat — conversation rules, pill options, field collection
// 4. Workout Design — exercise programming rules, periodization, RPE
// 5. Nutrition & Meals — calorie tolerances, macro rules, phase lens
// 6. Baseline Assessment — BMR formulas, activity factors, goal deltas
// 7. 90-Day Roadmap — phase themes, milestones, progression
// 8. Coaching Playbook — supplement rules, recovery, troubleshooting
// 9. Plan Adjustment — RPE thresholds, adherence modifiers, deload rules
// 10. Website Copy — landing page disclaimers, testimonials
// 11. Model Config — model IDs, budget caps, feature tags
// ─────────────────────────────────────────────────────────────────────────────

const INK = '#0a0a0a'
const INK2 = '#1f1f22'
const INK3 = '#6b6b70'
const INK4 = '#a1a1a6'
const GRN = '#10b981'
const RED = '#e9695c'
const BRD = '#ececef'
const CARD = '#f1f1f6'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"

const SECTIONS = [
  {
    key: 'coach_voice',
    title: 'Coach Persona & Voice',
    icon: Brain,
    desc: 'How the AI introduces itself, its credentials, language style, and personality.',
    file: 'trainerConfig.ts → COACH_VOICE',
  },
  {
    key: 'legal_compliance',
    title: 'Legal & Compliance',
    icon: Shield,
    desc: 'Hard guardrails injected at the top of every prompt. Calorie floors, no-medical-advice rules, required language style.',
    file: 'legalCompliance.ts → LEGAL_COMPLIANCE_PREAMBLE',
  },
  {
    key: 'guardrail_patterns',
    title: 'Safety Guardrails',
    icon: AlertTriangle,
    desc: 'Detection patterns that block or warn on dangerous inputs (emergency, medical, eating disorder, injury). These fire BEFORE the AI sees the message.',
    file: 'guardrails.ts → EMERGENCY / MEDICAL / EATING_DISORDER / INJURY patterns',
  },
  {
    key: 'intake_chat',
    title: 'Intake Chat Rules',
    icon: MessageCircle,
    desc: 'How the AI conducts the intake conversation — question order, pill options, one-at-a-time rules, field extraction.',
    file: 'intakeChat.ts → buildIntakeChatPrompt()',
  },
  {
    key: 'workout_design',
    title: 'Workout Design',
    icon: Dumbbell,
    desc: 'Exercise programming rules — periodization, RPE targets, equipment matching, warmup/cooldown, exercise metadata requirements.',
    file: 'workout.ts → buildWorkoutPrompt()',
  },
  {
    key: 'nutrition_meals',
    title: 'Nutrition & Meals',
    icon: Utensils,
    desc: 'Meal plan rules — calorie/macro tolerances, variety strategy, cook time, batch prep, grocery list, phase-specific nutrition lens.',
    file: 'meals.ts → buildMealsPrompt()',
  },
  {
    key: 'baseline_assessment',
    title: 'Baseline Assessment',
    icon: Target,
    desc: 'Fitness baseline rules — BMR formula (Mifflin-St Jeor), activity factors, calorie goal deltas, protein floors, weight change rates.',
    file: 'baseline.ts → buildBaselinePrompt()',
  },
  {
    key: 'roadmap_phases',
    title: '90-Day Roadmap',
    icon: Target,
    desc: 'Phase structure rules — 3 x 30-day phases, theme distinctiveness, milestone measurement requirements, nutrition theme per goal.',
    file: 'roadmap.ts → buildRoadmapPrompt()',
  },
  {
    key: 'coaching_playbook',
    title: 'Coaching Playbook',
    icon: BookOpen,
    desc: 'Reference guide rules — nutrition protocol, supplements, recovery, meal prep, troubleshooting scenarios, never-miss-twice philosophy.',
    file: 'playbook.ts → buildPlaybookPrompt()',
  },
  {
    key: 'plan_adjustment',
    title: 'Plan Adjustment Logic',
    icon: Sparkles,
    desc: 'How the AI adjusts the next block based on logged data — RPE thresholds, adherence modifiers, deload rules, volume progression.',
    file: 'adjust.ts → buildAdjustPrompt()',
  },
  {
    key: 'website_copy',
    title: 'Website Copy & Disclaimers',
    icon: Shield,
    desc: 'Landing page disclaimers, footer text, testimonial disclaimer, plan output microcopy.',
    file: 'TrainerLandingPage.jsx + TrainerFooter.jsx',
  },
  {
    key: 'model_config',
    title: 'Model & Budget Config',
    icon: Sparkles,
    desc: 'Claude model IDs, daily budget cap per agency, feature tags for cost tracking.',
    file: 'trainerConfig.ts → MODELS, DAILY_AGENCY_USD_CAP_DEFAULT',
  },
]

export default function LLMRulesPage() {
  const { agencyId } = useAuth()
  const [rules, setRules] = useState({})
  const [defaults, setDefaults] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [saved, setSaved] = useState({})
  const [expanded, setExpanded] = useState({})
  const [error, setError] = useState(null)

  // Load saved rules from DB
  useEffect(() => {
    fetch('/api/trainer/llm-rules')
      .then((r) => r.json())
      .then((data) => {
        setRules(data.rules || {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Load code defaults
  useEffect(() => {
    fetch('/api/trainer/llm-rules/defaults')
      .then((r) => r.json())
      .then((data) => setDefaults(data.defaults || {}))
      .catch(() => {})
  }, [])

  function toggleExpand(key) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleChange(key, value) {
    setRules((prev) => ({ ...prev, [key]: value }))
    setSaved((prev) => ({ ...prev, [key]: false }))
  }

  async function handleSave(key) {
    setSaving((prev) => ({ ...prev, [key]: true }))
    setError(null)
    try {
      const res = await fetch('/api/trainer/llm-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', section_key: key, content: rules[key] || '' }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved((prev) => ({ ...prev, [key]: true }))
      setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 2000)
    } catch (e) {
      setError(`Failed to save ${key}`)
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }))
    }
  }

  async function handleReset(key) {
    if (!confirm('Reset to code default? This removes your custom override.')) return
    setSaving((prev) => ({ ...prev, [key]: true }))
    try {
      await fetch('/api/trainer/llm-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', section_key: key }),
      })
      setRules((prev) => { const next = { ...prev }; delete next[key]; return next })
    } catch {} finally {
      setSaving((prev) => ({ ...prev, [key]: false }))
    }
  }

  if (loading) {
    return (
      <TrainerPortalShell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: INK3, fontSize: 14, fontFamily: FONT }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
          Loading LLM rules...
          <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        </div>
      </TrainerPortalShell>
    )
  }

  return (
    <TrainerPortalShell>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', fontFamily: FONT }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: INK, letterSpacing: '-.3px' }}>
            LLM Rules & Prompts
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: INK3 }}>
            Control how the AI behaves across every part of the platform. Changes take effect within 60 seconds.
          </p>
        </header>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 10, color: '#991b1b', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {SECTIONS.map((section) => {
            const Icon = section.icon
            const isOpen = !!expanded[section.key]
            const hasOverride = !!(rules[section.key] && rules[section.key].trim())
            const currentValue = rules[section.key] ?? defaults[section.key] ?? ''
            const isSaving = !!saving[section.key]
            const isSaved = !!saved[section.key]

            return (
              <div key={section.key} style={{
                background: '#fff',
                border: `1px solid ${BRD}`,
                borderRadius: 14,
                overflow: 'hidden',
              }}>
                {/* Header — clickable to expand */}
                <button
                  type="button"
                  onClick={() => toggleExpand(section.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '16px 18px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontFamily: FONT,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: hasOverride ? GRN + '12' : CARD,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: hasOverride ? GRN : INK3,
                  }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>{section.title}</span>
                      {hasOverride && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: GRN, background: GRN + '15', padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                          Custom
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: INK3, marginTop: 2 }}>{section.desc}</div>
                  </div>
                  {isOpen ? <ChevronDown size={16} color={INK3} /> : <ChevronRight size={16} color={INK3} />}
                </button>

                {/* Expanded editor */}
                {isOpen && (
                  <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${BRD}` }}>
                    <div style={{ fontSize: 11, color: INK4, marginTop: 12, marginBottom: 8 }}>
                      Source: <code style={{ background: CARD, padding: '2px 6px', borderRadius: 4 }}>{section.file}</code>
                      {!hasOverride && <span style={{ marginLeft: 8, color: INK4 }}>(showing code default)</span>}
                    </div>

                    <textarea
                      value={currentValue}
                      onChange={(e) => handleChange(section.key, e.target.value)}
                      rows={Math.min(20, Math.max(6, currentValue.split('\n').length + 2))}
                      style={{
                        width: '100%', padding: '14px 16px',
                        fontSize: 13, lineHeight: 1.6,
                        fontFamily: "'SF Mono', 'Menlo', 'Consolas', monospace",
                        color: INK, background: CARD,
                        border: `1px solid ${BRD}`, borderRadius: 10,
                        resize: 'vertical', outline: 'none',
                        boxSizing: 'border-box',
                        minHeight: 120,
                      }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => handleSave(section.key)}
                        disabled={isSaving}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 16px',
                          background: isSaved ? GRN : INK,
                          color: '#fff', border: 'none', borderRadius: 8,
                          fontSize: 13, fontWeight: 600, fontFamily: FONT,
                          cursor: isSaving ? 'default' : 'pointer',
                        }}
                      >
                        {isSaving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                        {isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}
                      </button>

                      {hasOverride && (
                        <button
                          type="button"
                          onClick={() => handleReset(section.key)}
                          disabled={isSaving}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px',
                            background: '#fff', color: INK3,
                            border: `1px solid ${BRD}`, borderRadius: 8,
                            fontSize: 13, fontWeight: 600, fontFamily: FONT,
                            cursor: 'pointer',
                          }}
                        >
                          <RotateCcw size={13} />
                          Reset to default
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </TrainerPortalShell>
  )
}
