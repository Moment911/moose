"use client"
import { useState } from 'react'
import {
  BookOpen,
  Utensils,
  Car,
  Clock,
  Pill,
  Moon,
  AlertTriangle,
  Heart,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { R, T, BLK, GRY, GRN } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — Coaching Playbook renderer.
//
// Tabbed view over CoachingPlaybookOutput.  Big visual: this is the
// reference-depth one-time guide ($150/hr private-coach playbook).  Tabs:
//   Overview / Nutrition / Travel / Meal Prep / Supplements / Recovery /
//   Troubleshooting / Closing
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#ececef'
const BRD_LT = '#f1f1f6'
const GRY5 = '#6b7280'
const AMB = '#d97706'
const AMB_BG = '#fffbeb'

const TABS = [
  { key: 'overview', label: 'Overview', icon: BookOpen },
  { key: 'nutrition', label: 'Nutrition', icon: Utensils },
  { key: 'travel', label: 'On the Road', icon: Car },
  { key: 'mealprep', label: 'Meal Prep', icon: Clock },
  { key: 'supplements', label: 'Supplements', icon: Pill },
  { key: 'recovery', label: 'Recovery & Sleep', icon: Moon },
  { key: 'troubleshooting', label: 'Troubleshooting', icon: AlertTriangle },
  { key: 'closing', label: 'Closing', icon: Heart },
]

export default function PlaybookCard({ playbook, onRegenerate, regenerating = false }) {
  const [activeTab, setActiveTab] = useState('overview')

  if (!playbook) return null

  return (
    <section
      style={{
        background: '#fff',
        border: `1px solid ${BRD}`,
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 22px',
          borderBottom: `1px solid ${BRD}`,
          background: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={18} color={T} />
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: BLK, letterSpacing: '.02em', textTransform: 'uppercase' }}>
              Coaching Playbook
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: GRY5 }}>
              Your $150/hour private-coach reference guide
            </p>
          </div>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: T,
              background: '#fff',
              border: `1px solid ${BRD}`,
              borderRadius: 6,
              cursor: regenerating ? 'not-allowed' : 'pointer',
            }}
          >
            {regenerating ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />}
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        )}
      </header>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: '10px 14px 0',
          borderBottom: `1px solid ${BRD_LT}`,
          background: '#fcfcfc',
        }}
      >
        {TABS.map((t) => {
          const Icon = t.icon
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                color: active ? R : GRY5,
                background: active ? '#fff' : 'transparent',
                border: `1px solid ${active ? BRD : 'transparent'}`,
                borderBottom: active ? '2px solid #fff' : 'none',
                borderRadius: '6px 6px 0 0',
                marginBottom: -1,
                cursor: 'pointer',
              }}
            >
              <Icon size={12} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div style={{ padding: 22 }}>
        {activeTab === 'overview' && <OverviewTab playbook={playbook} />}
        {activeTab === 'nutrition' && <NutritionTab np={playbook.nutrition_protocol} />}
        {activeTab === 'travel' && <TravelTab otr={playbook.nutrition_protocol?.on_the_road_strategy} />}
        {activeTab === 'mealprep' && <MealPrepTab mp={playbook.meal_prep_routine} />}
        {activeTab === 'supplements' && <SupplementsTab sp={playbook.supplement_protocol} />}
        {activeTab === 'recovery' && <RecoveryTab rp={playbook.recovery_and_sleep_protocol} />}
        {activeTab === 'troubleshooting' && <TroubleshootingTab scenarios={playbook.troubleshooting_guide} />}
        {activeTab === 'closing' && <ClosingTab playbook={playbook} />}
      </div>

      <footer
        style={{
          padding: '10px 22px',
          borderTop: `1px solid ${BRD_LT}`,
          background: '#fafafa',
          fontSize: 11,
          color: GRY5,
          fontStyle: 'italic',
        }}
      >
        {playbook.disclaimer}
      </footer>
    </section>
  )
}

// ── Tab bodies ──────────────────────────────────────────────────────────────

function OverviewTab({ playbook }) {
  return (
    <div>
      <div
        style={{
          padding: '14px 18px',
          borderLeft: `3px solid ${T}`,
          background: '#f0fbfc',
          borderRadius: 6,
          marginBottom: 18,
          fontSize: 14,
          lineHeight: 1.55,
          color: BLK,
        }}
      >
        {playbook.opening_note}
      </div>
      <div style={{ fontSize: 13, color: GRY, marginBottom: 8 }}>What&apos;s in this playbook</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: GRY }}>
        <li>Daily calorie + macro targets with rationale</li>
        <li>{playbook.nutrition_protocol?.non_negotiables?.length || 0} non-negotiable nutrition rules</li>
        <li>On-the-road eating strategy (breakfast, lunch, snacks, drive-thru backups)</li>
        <li>Home cooking framework with {playbook.nutrition_protocol?.home_cooking_framework?.dinner_ideas?.length || 0} dinner ideas</li>
        <li>{playbook.meal_prep_routine?.total_time_min || 0}-minute weekly meal prep routine</li>
        <li>Supplement protocol — {playbook.supplement_protocol?.essentials?.length || 0} essentials + what to skip</li>
        <li>Sleep + recovery + stress-management protocol</li>
        <li>{playbook.troubleshooting_guide?.length || 0} real-life scenarios with specific adjustments</li>
        <li>The &ldquo;never miss twice&rdquo; philosophy</li>
      </ul>
    </div>
  )
}

function NutritionTab({ np }) {
  if (!np) return <EmptyTab msg="Nutrition protocol not generated yet." />
  const dt = np.daily_targets
  return (
    <div>
      <SectionTitle>Daily Targets</SectionTitle>
      {dt && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
            <MacroTile label="Calories" value={dt.calories} unit="kcal" />
            <MacroTile label="Protein" value={dt.protein_g} unit="g" accent />
            <MacroTile label="Fat" value={dt.fat_g} unit="g" />
            <MacroTile label="Carbs" value={dt.carbs_g} unit="g" />
            <MacroTile label="Water" value={dt.water_oz} unit="oz" />
            <MacroTile label="Fiber" value={dt.fiber_g} unit="g" />
          </div>
          <Paragraph>{dt.rationale}</Paragraph>
        </>
      )}

      <SectionTitle>Non-Negotiables</SectionTitle>
      <ol style={{ margin: '0 0 18px', paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: BLK }}>
        {(np.non_negotiables || []).map((n, i) => (
          <li key={i} style={{ marginBottom: 4 }}>{n}</li>
        ))}
      </ol>

      <SectionTitle>Home Cooking Framework</SectionTitle>
      <div
        style={{
          padding: '12px 16px',
          background: '#f9fafb',
          border: `1px solid ${BRD_LT}`,
          borderRadius: 6,
          marginBottom: 10,
          fontSize: 14,
          lineHeight: 1.6,
          color: BLK,
          fontWeight: 600,
        }}
      >
        {np.home_cooking_framework?.dinner_template}
      </div>
      <div style={{ fontSize: 13, color: GRY, marginBottom: 6 }}>Dinner ideas:</div>
      <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: BLK }}>
        {(np.home_cooking_framework?.dinner_ideas || []).map((d, i) => (
          <li key={i} style={{ marginBottom: 3 }}>{d}</li>
        ))}
      </ul>
      {np.home_cooking_framework?.weekly_rhythm && <Paragraph>{np.home_cooking_framework.weekly_rhythm}</Paragraph>}
    </div>
  )
}

function TravelTab({ otr }) {
  if (!otr) return <EmptyTab msg="Travel strategy not generated yet." />
  return (
    <div>
      <Paragraph>{otr.context_note}</Paragraph>

      <SectionTitle>Breakfast Options</SectionTitle>
      <MealOptionGrid items={otr.breakfast_options} />

      <SectionTitle>Lunch Options</SectionTitle>
      <MealOptionGrid items={otr.lunch_options} />

      <SectionTitle>Snack Bag</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8, marginBottom: 14 }}>
        {(otr.snack_bag_items || []).map((s, i) => {
          // Back-compat: older playbooks stored plain strings.
          const name = typeof s === 'string' ? s : s?.name
          const kcal = typeof s === 'object' ? s?.kcal_est : null
          const protein = typeof s === 'object' ? s?.protein_g_est : null
          return (
            <div key={i} style={{
              padding: '10px 12px', border: `1px solid ${BRD_LT}`, borderRadius: 8,
              background: '#fff', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ fontSize: 13, color: BLK, fontWeight: 600, letterSpacing: '-.005em' }}>{name}</div>
              {(kcal != null || protein != null) && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {kcal != null && <MacroChip label="Calories" value={kcal} color="#0a0a0a" />}
                  {protein != null && <MacroChip label="Protein" value={`${protein}g`} color="#5aa0ff" />}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <SectionTitle>Drive-Thru Backup</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(otr.drive_thru_backup || []).map((b, i) => (
          <div key={i} style={{
            padding: '12px 14px', border: `1px solid ${BRD_LT}`, borderRadius: 8,
            background: '#fff', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap',
          }}>
            <div style={{ flex: '1 1 260px', minWidth: 0, fontSize: 13 }}>
              <strong style={{ color: BLK, letterSpacing: '-.005em' }}>{b.chain}:</strong>{' '}
              <span style={{ color: GRY, lineHeight: 1.55 }}>{b.order}</span>
            </div>
            {(b.kcal_est != null || b.protein_g_est != null) && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
                {b.kcal_est != null && <MacroChip label="Calories" value={b.kcal_est} color="#0a0a0a" />}
                {b.protein_g_est != null && <MacroChip label="Protein" value={`${b.protein_g_est}g`} color="#5aa0ff" />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MealPrepTab({ mp }) {
  if (!mp) return <EmptyTab msg="Meal prep routine not generated yet." />
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: BLK }}>{mp.routine_name}</h3>
        <span style={{ padding: '3px 10px', background: T + '15', color: T, fontSize: 11, fontWeight: 700, borderRadius: 20 }}>
          {mp.total_time_min} min
        </span>
      </div>
      <Paragraph>{mp.before_you_start}</Paragraph>

      <SectionTitle>Step-by-Step</SectionTitle>
      <ol style={{ margin: '0 0 18px', paddingLeft: 0, listStyle: 'none' }}>
        {(mp.steps || []).map((s, i) => (
          <li
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr',
              gap: 12,
              padding: '10px 12px',
              border: `1px solid ${BRD_LT}`,
              borderRadius: 6,
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: T }}>{s.minutes_range} min</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: BLK, marginBottom: 2 }}>{s.step_name}</div>
              <div style={{ fontSize: 13, color: GRY, lineHeight: 1.5 }}>{s.instructions}</div>
            </div>
          </li>
        ))}
      </ol>

      <SectionTitle>Mid-Week Mini-Prep</SectionTitle>
      <Paragraph>{mp.mid_week_mini_prep}</Paragraph>

      <SectionTitle>Core Principle</SectionTitle>
      <div
        style={{
          padding: '14px 18px',
          borderLeft: `3px solid ${GRN}`,
          background: '#f0fdf4',
          borderRadius: 6,
          fontSize: 14,
          lineHeight: 1.55,
          color: BLK,
          fontWeight: 500,
        }}
      >
        {mp.core_principle}
      </div>
    </div>
  )
}

function SupplementsTab({ sp }) {
  if (!sp) return <EmptyTab msg="Supplement protocol not generated yet." />
  return (
    <div>
      <SectionTitle>Essentials</SectionTitle>
      {(sp.essentials || []).map((s, i) => (
        <SupplementRow key={i} entry={s} accent />
      ))}

      {(sp.worth_considering || []).length > 0 && (
        <>
          <SectionTitle>Worth Considering</SectionTitle>
          {sp.worth_considering.map((s, i) => (
            <SupplementRow key={i} entry={s} />
          ))}
        </>
      )}

      <SectionTitle>Skip</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {(sp.skip || []).map((s, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '10px 12px',
              border: `1px solid ${BRD_LT}`,
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            <XCircle size={14} color="#e9695c" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: BLK }}>{s.name}</strong>{' '}
              <span style={{ color: GRY }}>— {s.why_skip}</span>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '14px 18px',
          background: '#f0fdf4',
          borderLeft: `3px solid ${GRN}`,
          borderRadius: 6,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: GRN, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
          The Real Stack
        </div>
        <div style={{ fontSize: 14, color: BLK, lineHeight: 1.55 }}>{sp.the_real_stack_summary}</div>
      </div>

      {typeof sp.monthly_cost_estimate_usd === 'number' && (
        <div style={{ fontSize: 12, color: GRY }}>
          Estimated monthly cost: <strong style={{ color: BLK }}>${sp.monthly_cost_estimate_usd}</strong>
        </div>
      )}
    </div>
  )
}

function SupplementRow({ entry, accent }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        border: `1px solid ${accent ? T + '40' : BRD_LT}`,
        borderRadius: 6,
        marginBottom: 8,
        background: accent ? T + '05' : '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <strong style={{ fontSize: 14, color: BLK }}>{entry.name}</strong>
        <span style={{ fontSize: 12, color: T, fontWeight: 700 }}>{entry.dose}</span>
      </div>
      <div style={{ fontSize: 13, color: GRY, lineHeight: 1.5, marginBottom: 4 }}>{entry.rationale}</div>
      <div style={{ fontSize: 11, color: GRY5 }}>
        <strong>When:</strong> {entry.when_to_take} · <strong>Brands:</strong> {entry.brand_recs?.join(', ')}
      </div>
    </div>
  )
}

function RecoveryTab({ rp }) {
  if (!rp) return <EmptyTab msg="Recovery protocol not generated yet." />
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Moon size={18} color={T} />
        <h3 style={{ margin: 0, fontSize: 18, color: BLK }}>Sleep target: {rp.sleep_target_hours} hours</h3>
      </div>

      <SectionTitle>Wind-Down Routine</SectionTitle>
      <BulletList items={rp.wind_down_routine} icon={CheckCircle} iconColor={GRN} />

      <SectionTitle>What good sleep does for you</SectionTitle>
      <BulletList items={rp.what_good_sleep_does} />

      <SectionTitle>When sleep is short</SectionTitle>
      <BulletList items={rp.not_enough_sleep_protocol} />

      <SectionTitle>Daily walking</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: BLK }}>{rp.daily_walking_target_steps?.toLocaleString()}</div>
        <div style={{ fontSize: 12, color: GRY }}>steps / day</div>
      </div>
      <Paragraph>{rp.daily_walking_rationale}</Paragraph>

      <SectionTitle>Mobility + Rest Day</SectionTitle>
      <Paragraph>{rp.mobility_guidance}</Paragraph>
      <Paragraph>{rp.true_rest_day_note}</Paragraph>

      <SectionTitle>Stress Management</SectionTitle>
      <div style={{ fontSize: 13, color: GRY, marginBottom: 6 }}>Daily 5-minute options:</div>
      <Chips items={rp.stress_management?.daily_5min_options} />
      <div
        style={{
          marginTop: 10,
          padding: '12px 16px',
          background: '#fef3c7',
          borderLeft: `3px solid ${AMB}`,
          borderRadius: 6,
          fontSize: 13,
          color: '#78350f',
          lineHeight: 1.55,
        }}
      >
        <strong>Weekly non-negotiable:</strong> {rp.stress_management?.weekly_non_negotiable}
      </div>

      {rp.age_or_hormonal_considerations && (
        <>
          <SectionTitle>Age / Hormonal Considerations</SectionTitle>
          <Paragraph>{rp.age_or_hormonal_considerations}</Paragraph>
        </>
      )}
    </div>
  )
}

function TroubleshootingTab({ scenarios }) {
  if (!scenarios?.length) return <EmptyTab msg="Troubleshooting guide not generated yet." />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {scenarios.map((s, i) => (
        <details
          key={i}
          style={{
            border: `1px solid ${BRD_LT}`,
            borderRadius: 8,
            padding: '10px 14px',
            background: '#fff',
          }}
        >
          <summary
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: BLK,
              cursor: 'pointer',
              listStyle: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={14} color={AMB} />
            {s.scenario_name}
          </summary>
          <div style={{ marginTop: 10 }}>
            <Paragraph>{s.description}</Paragraph>
            <AdjustRow label="Training" text={s.training_adjustment} />
            <AdjustRow label="Nutrition" text={s.nutrition_adjustment} />
            <AdjustRow label="Sleep" text={s.sleep_adjustment} />
            <div
              style={{
                marginTop: 10,
                padding: '10px 14px',
                background: AMB_BG,
                borderLeft: `3px solid ${AMB}`,
                borderRadius: 6,
                fontSize: 13,
                color: '#78350f',
                lineHeight: 1.55,
              }}
            >
              <strong>Mindset:</strong> {s.mindset_note}
            </div>
          </div>
        </details>
      ))}
    </div>
  )
}

function AdjustRow({ label, text }) {
  return (
    <div style={{ padding: '6px 0', borderBottom: `1px solid ${BRD_LT}`, fontSize: 13 }}>
      <strong style={{ color: T, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</strong>
      <div style={{ color: BLK, marginTop: 2, lineHeight: 1.55 }}>{text}</div>
    </div>
  )
}

function ClosingTab({ playbook }) {
  return (
    <div>
      <SectionTitle>Never Miss Twice</SectionTitle>
      <div
        style={{
          padding: '16px 20px',
          background: '#fff7ed',
          borderLeft: `3px solid ${AMB}`,
          borderRadius: 6,
          fontSize: 14,
          color: BLK,
          lineHeight: 1.7,
          marginBottom: 22,
        }}
      >
        {playbook.never_miss_twice_philosophy}
      </div>

      <SectionTitle>A Personal Note</SectionTitle>
      <div
        style={{
          padding: '18px 22px',
          background: '#fff',
          border: `1px solid ${BRD}`,
          borderRadius: 8,
          fontSize: 14,
          color: BLK,
          lineHeight: 1.7,
          fontStyle: 'italic',
        }}
      >
        {playbook.personal_closing_note}
      </div>
      <div style={{ textAlign: 'right', marginTop: 10, fontSize: 12, color: GRY5, fontStyle: 'italic' }}>
        — Your Koto Trainer
      </div>
    </div>
  )
}

// ── Primitives ──────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <h4 style={{ margin: '16px 0 8px', fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.08em' }}>
      {children}
    </h4>
  )
}

function Paragraph({ children }) {
  return <p style={{ margin: '0 0 12px', fontSize: 14, color: BLK, lineHeight: 1.65 }}>{children}</p>
}

function EmptyTab({ msg }) {
  return <div style={{ padding: 20, textAlign: 'center', color: GRY5, fontSize: 13 }}>{msg}</div>
}

function MacroTile({ label, value, unit, accent }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: accent ? R + '08' : '#f9fafb',
        border: `1px solid ${accent ? R + '30' : BRD_LT}`,
        borderRadius: 6,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: accent ? R : GRY5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: BLK, marginTop: 2 }}>
        {value}
        <span style={{ fontSize: 11, fontWeight: 500, color: GRY5, marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  )
}

function MealOptionGrid({ items }) {
  if (!items?.length) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginBottom: 14 }}>
      {items.map((m, i) => (
        <div
          key={i}
          style={{
            padding: '12px 14px',
            border: `1px solid ${BRD_LT}`,
            borderRadius: 8,
            background: '#fff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <strong style={{ fontSize: 14, color: BLK, letterSpacing: '-.01em' }}>{m.name}</strong>
            {m.kcal_est != null && (
              <span style={{ fontSize: 12, color: '#0a0a0a', fontWeight: 700, whiteSpace: 'nowrap' }}>{m.kcal_est} kcal</span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: GRY, lineHeight: 1.55, marginBottom: 10 }}>{m.description}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {m.protein_g_est != null && <MacroChip label="Protein" value={`${m.protein_g_est}g`} color="#5aa0ff" />}
            {m.carb_g_est != null && <MacroChip label="Carbs" value={`${m.carb_g_est}g`} color="#059669" />}
            {m.fat_g_est != null && <MacroChip label="Fat" value={`${m.fat_g_est}g`} color="#d97706" />}
          </div>
          <div style={{ fontSize: 11, color: GRY5 }}>{m.prep_time_min} min prep</div>
        </div>
      ))}
    </div>
  )
}

function MacroChip({ label, value, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px',
      background: color + '10',
      border: `1px solid ${color}30`,
      color: color,
      borderRadius: 999,
      fontSize: 11, fontWeight: 700,
      letterSpacing: '-.01em',
    }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{value}</span>
    </span>
  )
}

function Chips({ items }) {
  if (!items?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
      {items.map((c, i) => (
        <span
          key={i}
          style={{
            padding: '5px 11px',
            background: '#f1f1f6',
            color: BLK,
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 20,
          }}
        >
          {c}
        </span>
      ))}
    </div>
  )
}

function BulletList({ items, icon: Icon, iconColor }) {
  if (!items?.length) return null
  return (
    <ul style={{ margin: '0 0 14px', paddingLeft: 0, listStyle: 'none' }}>
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '5px 0',
            fontSize: 13,
            color: BLK,
            lineHeight: 1.55,
          }}
        >
          {Icon ? (
            <Icon size={13} color={iconColor || T} style={{ flexShrink: 0, marginTop: 3 }} />
          ) : (
            <span style={{ color: T, marginTop: 2, flexShrink: 0 }}>•</span>
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
