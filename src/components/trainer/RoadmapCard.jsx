"use client"
import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Dumbbell, Utensils, Target, Heart, TrendingUp } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// RoadmapCard — Cal-AI 90-day roadmap. Vertical phase cards, not cramped
// 3-column grid. Each phase expands to show Training, Nutrition, Milestones,
// Recovery as distinct visual sections.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  ink: '#0a0a0a', ink2: '#1f1f22', ink3: '#6b6b70', ink4: '#a1a1a6',
  bg: '#ffffff', card: '#f1f1f6', border: '#ececef', divider: '#e5e5ea',
  green: '#16a34a', greenBg: '#ecfdf5', blue: '#5aa0ff', amber: '#d89a6a',
  font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
  r: 16, rSm: 12, rPill: 999,
}

const PHASE_COLORS = ['#e9695c', '#5aa0ff', '#16a34a']

export default function RoadmapCard({ roadmap, currentPhase = 1, onSelectPhase }) {
  const [expandedPhase, setExpandedPhase] = useState(currentPhase)

  if (!roadmap) return null
  const phases = Array.isArray(roadmap.phases) ? roadmap.phases : []

  return (
    <div style={{ fontFamily: C.font }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>
          90-Day Roadmap
        </h3>
        {roadmap.client_context_summary && (
          <p style={{ margin: '6px 0 0', fontSize: 14, color: C.ink3, lineHeight: 1.5 }}>
            {roadmap.client_context_summary}
          </p>
        )}
      </div>

      {/* Phase timeline indicator */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {phases.map((p) => {
          const n = p.phase_number ?? 1
          const isCurrent = n === currentPhase
          const color = PHASE_COLORS[(n - 1) % 3]
          return (
            <button key={n} type="button"
              onClick={() => setExpandedPhase(expandedPhase === n ? null : n)}
              style={{
                flex: 1, padding: '10px 14px',
                background: isCurrent ? color + '12' : C.card,
                border: `1.5px solid ${isCurrent ? color : 'transparent'}`,
                borderRadius: C.rSm, cursor: 'pointer', fontFamily: C.font,
                textAlign: 'center', transition: 'all .15s',
              }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: isCurrent ? color : C.ink4, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Phase {n}
                {isCurrent && ' · Current'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 4 }}>
                {p.phase_name || `Phase ${n}`}
              </div>
            </button>
          )
        })}
      </div>

      {/* Phase detail cards */}
      <div style={{ display: 'grid', gap: 10 }}>
        {phases.map((p) => {
          const n = p.phase_number ?? 1
          const isCurrent = n === currentPhase
          const isOpen = expandedPhase === n
          const color = PHASE_COLORS[(n - 1) % 3]
          const daysLabel = p.days_range?.start && p.days_range?.end
            ? `Days ${p.days_range.start}–${p.days_range.end}`
            : `Days ${(n - 1) * 30 + 1}–${n * 30}`

          return (
            <div key={n}>
              {/* Phase header — tap to expand */}
              <button type="button" onClick={() => setExpandedPhase(isOpen ? null : n)} style={{
                display: 'flex', alignItems: 'center', width: '100%', padding: '16px 18px',
                background: '#fff',
                border: `1px solid ${isOpen ? color + '30' : C.border}`,
                borderLeft: `4px solid ${color}`,
                borderRadius: isOpen ? `${C.r}px ${C.r}px 0 0` : C.r,
                cursor: 'pointer', textAlign: 'left', fontFamily: C.font, gap: 14,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>
                      {p.phase_name || `Phase ${n}`}
                    </span>
                    {isCurrent && (
                      <span style={{ padding: '2px 8px', background: color + '15', color, borderRadius: C.rPill, fontSize: 10, fontWeight: 700 }}>
                        Current
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: C.ink3 }}>
                    {daysLabel}
                  </div>
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: C.rPill, background: C.card,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {isOpen ? <ChevronUp size={18} color={C.ink3} /> : <ChevronDown size={18} color={C.ink3} />}
                </div>
              </button>

              {/* Expanded phase content */}
              {isOpen && (
                <div style={{
                  border: `1px solid ${color}30`, borderTop: 'none',
                  borderLeft: `4px solid ${color}`,
                  borderRadius: `0 0 ${C.r}px ${C.r}px`,
                  padding: '4px 4px 4px',
                  background: C.card,
                }}>
                  {/* Progression overview */}
                  {p.progression_description && (
                    <div style={{ margin: '8px 12px', padding: '14px 16px', background: '#fff', borderRadius: C.rSm, fontSize: 15, fontWeight: 500, color: C.ink2, lineHeight: 1.6 }}>
                      {p.progression_description}
                    </div>
                  )}

                  {/* Training section */}
                  {p.training_theme && (
                    <Section icon={<Dumbbell size={16} />} label="Training" color={color}>
                      <p style={{ margin: 0, fontSize: 14, color: C.ink2, lineHeight: 1.65 }}>{p.training_theme}</p>
                    </Section>
                  )}

                  {/* Nutrition section */}
                  {p.nutrition_theme && (
                    <Section icon={<Utensils size={16} />} label="Nutrition" color="#d89a6a">
                      <p style={{ margin: 0, fontSize: 14, color: C.ink2, lineHeight: 1.65 }}>{p.nutrition_theme}</p>
                    </Section>
                  )}

                  {/* Milestones */}
                  {Array.isArray(p.end_of_phase_milestones) && p.end_of_phase_milestones.length > 0 && (
                    <Section icon={<Target size={16} />} label="Milestones" color="#5aa0ff">
                      <div style={{ display: 'grid', gap: 6 }}>
                        {p.end_of_phase_milestones.map((m, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, color: C.ink2, lineHeight: 1.5 }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: C.rPill, flexShrink: 0, marginTop: 1,
                              background: C.card, border: `1.5px solid ${C.border}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: C.ink3 }}>{i + 1}</span>
                            </div>
                            <span>{m}</span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Recovery */}
                  {Array.isArray(p.recovery_focus) && p.recovery_focus.length > 0 && (
                    <Section icon={<Heart size={16} />} label="Recovery" color="#16a34a">
                      <div style={{ display: 'grid', gap: 4 }}>
                        {p.recovery_focus.map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 14, color: C.ink2, lineHeight: 1.5 }}>
                            <Check size={14} color="#16a34a" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 3 }} />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Generate workout CTA for non-current phases */}
                  {!isCurrent && onSelectPhase && (
                    <div style={{ margin: '4px 12px 12px' }}>
                      <button type="button" onClick={() => onSelectPhase(n)} style={{
                        width: '100%', padding: '12px 16px', background: color, color: '#fff',
                        border: 'none', borderRadius: C.rSm, fontSize: 14, fontWeight: 600,
                        cursor: 'pointer', fontFamily: C.font,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        <TrendingUp size={16} /> Generate workout for Phase {n}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Section({ icon, label, color, children }) {
  return (
    <div style={{ margin: '4px 12px', padding: '14px 16px', background: '#fff', borderRadius: C.rSm }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      </div>
      {children}
    </div>
  )
}
