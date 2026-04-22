"use client"
import { useState } from 'react'
import { Flame } from 'lucide-react'
import { R, T, BLK } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — MealPlanTable.
//
// Renders a MealsOutput (minus grocery_list — handled by GroceryList.jsx).
// Two-week tabs, 7-day x meal-slots grid.  Cell shows recipe_name + prep+cook
// time + kcal.  Click a cell → expand a panel below the grid with ingredients,
// short instructions, macros, and leftover strategy.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'
const BRD_LT = '#f3f4f6'
const GRY5 = '#6b7280'
const GRY7 = '#374151'

export default function MealPlanTable({ mealPlan }) {
  const [weekIdx, setWeekIdx] = useState(0)
  const [selected, setSelected] = useState(null)

  if (!mealPlan) return null
  const weeks = Array.isArray(mealPlan.weeks) ? mealPlan.weeks : []
  const activeWeek = weeks[weekIdx] || weeks[0] || { days: [] }
  const macros = mealPlan.macro_daily_targets_g || {}

  // Determine all meal slots across the active week for consistent columns.
  const slotSet = new Set()
  ;(activeWeek.days || []).forEach((d) => {
    ;(d.meals || []).forEach((m) => slotSet.add(m.slot || m.meal_slot || 'meal'))
  })
  const slots = Array.from(slotSet)
  if (slots.length === 0) slots.push('meal')

  return (
    <section style={cardStyle}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={titleStyle}>{mealPlan.plan_name || 'Meal plan'}</h2>
          <div style={{ color: GRY5, fontSize: 12, marginTop: 4 }}>
            2-week plan · {activeWeek.days?.length || 7} days per week
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Badge icon={<Flame size={12} />} label="kcal" value={mealPlan.calorie_daily_target_kcal} />
          <Badge label="P" value={macros.protein_g} unit="g" />
          <Badge label="F" value={macros.fat_g} unit="g" />
          <Badge label="C" value={macros.carb_g} unit="g" />
        </div>
      </header>

      {weeks.length > 1 && (
        <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${BRD}`, marginBottom: 14 }}>
          {weeks.map((_, i) => {
            const active = i === weekIdx
            return (
              <button
                key={i}
                type="button"
                onClick={() => { setWeekIdx(i); setSelected(null) }}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${active ? R : 'transparent'}`,
                  color: active ? R : GRY7,
                  fontSize: 13,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                Week {i + 1}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: `1px solid ${BRD}` }}>
              <Th>Day</Th>
              {slots.map((s) => (
                <Th key={s}>{capitalize(s)}</Th>
              ))}
              <Th>Day kcal</Th>
            </tr>
          </thead>
          <tbody>
            {(activeWeek.days || []).map((d, di) => {
              const dayKey = `${weekIdx}-${di}`
              const byslot = {}
              ;(d.meals || []).forEach((m) => {
                byslot[m.slot || m.meal_slot || 'meal'] = m
              })
              return (
                <tr key={dayKey} style={{ borderBottom: `1px solid ${BRD_LT}` }}>
                  <td style={{ padding: '6px 10px', color: BLK, fontWeight: 700 }}>
                    {d.day_label || `Day ${di + 1}`}
                  </td>
                  {slots.map((s) => {
                    const meal = byslot[s]
                    if (!meal) {
                      return <td key={s} style={{ padding: '8px 10px', color: '#d1d5db' }}>—</td>
                    }
                    const isSel = selected && selected.week === weekIdx && selected.day === di && selected.slot === s
                    return (
                      <td key={s} style={{ padding: 6, verticalAlign: 'top' }}>
                        <button
                          type="button"
                          onClick={() => setSelected(isSel ? null : { week: weekIdx, day: di, slot: s, meal })}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 10px',
                            background: isSel ? T + '15' : '#fff',
                            border: `1px solid ${isSel ? T : BRD}`,
                            borderRadius: 8,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ color: BLK, fontWeight: 700, fontSize: 12, marginBottom: 3 }}>
                            {meal.recipe_name || meal.name || 'Meal'}
                          </div>
                          <div style={{ color: GRY5, fontSize: 11 }}>
                            {Number(meal.prep_minutes || 0) + Number(meal.cook_minutes || 0)} min
                            {meal.kcal ? ` · ${meal.kcal} kcal` : ''}
                          </div>
                        </button>
                      </td>
                    )
                  })}
                  <td style={{ padding: '8px 10px', color: GRY7, fontWeight: 700 }}>
                    {d.day_kcal || d.daily_kcal || sumKcal(d)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && selected.meal && (
        <MealDetail meal={selected.meal} onClose={() => setSelected(null)} />
      )}
    </section>
  )
}

function MealDetail({ meal, onClose }) {
  const macros = meal.macros_per_serving || meal.macros || {}
  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        background: '#fafbfd',
        border: `1px solid ${BRD}`,
        borderRadius: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: BLK, fontWeight: 800 }}>
            {meal.recipe_name || meal.name}
          </h3>
          <div style={{ color: GRY5, fontSize: 12, marginTop: 4 }}>
            Prep {meal.prep_minutes ?? 0} min · Cook {meal.cook_minutes ?? 0} min
            {meal.servings ? ` · ${meal.servings} servings` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: GRY5, fontSize: 12, fontWeight: 700 }}
        >
          Close
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {meal.kcal && <MiniBadge label="kcal" value={meal.kcal} />}
        {macros.protein_g && <MiniBadge label="P" value={`${macros.protein_g}g`} />}
        {macros.fat_g && <MiniBadge label="F" value={`${macros.fat_g}g`} />}
        {macros.carb_g && <MiniBadge label="C" value={`${macros.carb_g}g`} />}
      </div>

      {Array.isArray(meal.ingredients) && meal.ingredients.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={subLabel}>Ingredients</div>
          <ul style={{ margin: 0, paddingLeft: 20, color: GRY7, fontSize: 12 }}>
            {meal.ingredients.map((ing, i) => (
              <li key={i} style={{ padding: '2px 0' }}>
                {typeof ing === 'string'
                  ? ing
                  : `${ing.amount || ''}${ing.unit ? ' ' + ing.unit : ''} ${ing.item || ing.name || ''}`.trim()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(meal.instructions_short || meal.instructions) && (
        <div style={{ marginTop: 12 }}>
          <div style={subLabel}>Instructions</div>
          <p style={{ margin: 0, color: GRY7, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {meal.instructions_short || meal.instructions}
          </p>
        </div>
      )}

      {meal.leftover_strategy && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: '#f0fbfc', borderRadius: 8, color: GRY7, fontSize: 12 }}>
          <strong style={{ color: T }}>Leftover strategy:</strong> {meal.leftover_strategy}
        </div>
      )}
    </div>
  )
}

function sumKcal(d) {
  const ms = Array.isArray(d.meals) ? d.meals : []
  const total = ms.reduce((a, m) => a + (Number(m.kcal) || 0), 0)
  return total || '—'
}

function capitalize(s) {
  if (!s || typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

function Th({ children }) {
  return (
    <th style={{ textAlign: 'left', padding: '10px', color: GRY5, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>
      {children}
    </th>
  )
}

function Badge({ icon, label, value, unit }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#f9fafb', border: `1px solid ${BRD}`, borderRadius: 20, fontSize: 11, color: GRY7, fontWeight: 700 }}>
      {icon}
      <span style={{ color: GRY5 }}>{label}</span>
      <span style={{ color: BLK, fontWeight: 800 }}>
        {value ?? '—'}{unit ? ` ${unit}` : ''}
      </span>
    </span>
  )
}

function MiniBadge({ label, value }) {
  return (
    <span style={{ padding: '3px 8px', background: '#fff', border: `1px solid ${BRD}`, borderRadius: 20, fontSize: 11, color: GRY7 }}>
      <strong style={{ color: BLK }}>{label}</strong> {value}
    </span>
  )
}

const subLabel = {
  color: GRY5,
  fontSize: 10,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: 4,
}

const cardStyle = {
  background: '#fff',
  border: `1px solid ${BRD}`,
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
}

const titleStyle = { margin: 0, fontSize: 13, fontWeight: 800, color: T, letterSpacing: '.05em', textTransform: 'uppercase' }
