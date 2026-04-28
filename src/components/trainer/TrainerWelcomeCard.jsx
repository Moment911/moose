"use client"
import { GraduationCap, Sparkles, Dumbbell } from 'lucide-react'
// Cal-AI tokens
const T = '#5aa0ff'
const BLK = '#0a0a0a'
const GRY = '#f1f1f6'

// ─────────────────────────────────────────────────────────────────────────────
// TrainerWelcomeCard
//
// First thing a trainee (or a trainer filling in for a trainee) sees before
// the intake form.  Sets expectations: this is not a template — it's a
// programming system built on a specific expert stack that reads every
// answer and adjusts every 2 weeks from logged results.
//
// Mount on TrainerIntakePage + optionally on MyPlanPage first-visit.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#ececef'

export default function TrainerWelcomeCard({ compact = false }) {
  return (
    <section
      style={{
        background: '#fff',
        border: `1px solid ${BRD}`,
        borderLeft: `4px solid ${T}`,
        borderRadius: 12,
        padding: compact ? '16px 18px' : '22px 24px',
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Sparkles size={16} color={T} />
        <h2 style={{ margin: 0, fontSize: compact ? 15 : 18, fontWeight: 800, color: BLK, letterSpacing: '-.2px' }}>
          Welcome to Koto Trainer
        </h2>
      </div>

      <p style={{ margin: '0 0 14px', color: '#374151', fontSize: 13.5, lineHeight: 1.6 }}>
        A personalized strength &amp; nutrition system. Your intake drives a
        2-week workout block, a meal plan, and a 90-day roadmap — then the
        system reads your logged sessions every block and adjusts the next
        block from your actual numbers, not a template.
      </p>

      <div
        style={{
          background: '#f9fafb',
          border: `1px solid ${BRD}`,
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: compact ? 0 : 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: T,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <GraduationCap size={12} /> The experts behind your plan
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, color: '#374151', fontSize: 13, lineHeight: 1.65 }}>
          <li><strong>PhD</strong> in Exercise Physiology — programming principles, load management, periodization.</li>
          <li><strong>Master's</strong> in Nutrition — calorie &amp; macro targets grounded in sport-science, not fads.</li>
          <li>
            Former MLB training facility with <strong>hitting, pitching, and throwing coaches</strong> on staff — each with 15 seasons of professional baseball experience.
          </li>
        </ul>
      </div>

      {!compact && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: GRY,
            marginTop: 4,
          }}
        >
          <Dumbbell size={12} />
          <span>Built by Koto. Every plan is generated for the individual — no templates, no copy-paste.</span>
        </div>
      )}
    </section>
  )
}
