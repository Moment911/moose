"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Flame, Check, Loader2 } from 'lucide-react'
import { R, T, BLK } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — MealPlanTable.
//
// Renders a MealsOutput (minus grocery_list — handled by GroceryList.jsx).
// Two-week tabs, 7-day x meal-slots grid.  Each cell shows recipe name +
// prep/cook time + kcal, plus a Macrofactor-style logger: checkbox + 0.5/1/1.5×
// servings multiplier.  Checking a row POSTs /api/trainer/food-log with
// action=log_planned; unchecking deletes it. Cell name/click still opens the
// detail modal.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'
const BRD_LT = '#f3f4f6'
const GRY5 = '#6b7280'
const GRY7 = '#374151'
const GRN = '#16a34a'

const MULT_OPTIONS = [0.5, 1, 1.5]

function planKey(weekIdx, dayIdx, slot) {
  return `week:${weekIdx}|day:${dayIdx}|slot:${slot || 'meal'}`
}

function extractItems(meal) {
  // The food-log server expects [{name, kcal, protein_g, fat_g, carb_g}].
  // A planned meal has macros per serving, a kcal total, and a recipe name.
  // We collapse it into one line item — avoids asking Claude to parse
  // ingredients, and keeps the logged row compact.
  const macros = meal?.macros_per_serving || meal?.macros || {}
  const name = meal?.recipe_name || meal?.name || 'Meal'
  return [{
    name,
    kcal: Number(meal?.kcal) || 0,
    protein_g: Number(macros.protein_g) || 0,
    fat_g: Number(macros.fat_g) || 0,
    carb_g: Number(macros.carb_g) || 0,
    portion: meal?.servings ? `${meal.servings} serving${meal.servings === 1 ? '' : 's'}` : undefined,
  }]
}

export default function MealPlanTable({ mealPlan, traineeId }) {
  const [weekIdx, setWeekIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  // plan_key -> { logging: bool, mult: number, logId?: string }
  const [logState, setLogState] = useState({})
  // plan_key -> number (last saved mult, for pill display)
  const [savedMults, setSavedMults] = useState({})
  // which plan_keys are currently logged (server-confirmed)
  const [loggedKeys, setLoggedKeys] = useState(() => new Set())
  const [loadingToday, setLoadingToday] = useState(false)
  const [logAllBusy, setLogAllBusy] = useState(false)

  const weeks = Array.isArray(mealPlan?.weeks) ? mealPlan.weeks : []
  const activeWeek = weeks[weekIdx] || weeks[0] || { days: [] }
  const macros = mealPlan?.macro_daily_targets_g || {}

  // Which weekday is "today"? Days are in Mon..Sun order with day_label set.
  const todayIdx = useMemo(() => {
    const raw = new Date().getDay() // 0=Sun..6=Sat
    return raw === 0 ? 6 : raw - 1  // Mon=0..Sun=6
  }, [])

  // Fetch today's logs so we know which planned meals are already logged.
  const loadToday = useCallback(async () => {
    if (!traineeId) return
    setLoadingToday(true)
    try {
      const res = await fetch('/api/trainer/food-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_today', trainee_id: traineeId }),
      })
      if (!res.ok) return
      const data = await res.json()
      const next = new Set()
      const mults = {}
      for (const row of data.logs || []) {
        if (!row.notes) continue
        try {
          const parsed = JSON.parse(row.notes)
          if (parsed?.plan_key) {
            next.add(parsed.plan_key)
            if (Number.isFinite(Number(parsed.servings_mult))) {
              mults[parsed.plan_key] = Number(parsed.servings_mult)
            }
          }
        } catch { /* not a planned row */ }
      }
      setLoggedKeys(next)
      setSavedMults(mults)
    } finally {
      setLoadingToday(false)
    }
  }, [traineeId])

  useEffect(() => { loadToday() }, [loadToday])

  const setRowState = (key, patch) =>
    setLogState((s) => ({ ...s, [key]: { ...(s[key] || { mult: 1 }), ...patch } }))

  async function toggleLogged(key, meal) {
    if (!traineeId) return
    const isOn = loggedKeys.has(key)
    const mult = Number(logState[key]?.mult) || savedMults[key] || 1

    setRowState(key, { logging: true })

    try {
      if (isOn) {
        const res = await fetch('/api/trainer/food-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unlog_planned', trainee_id: traineeId, plan_key: key }),
        })
        if (res.ok) {
          setLoggedKeys((prev) => {
            const next = new Set(prev); next.delete(key); return next
          })
          setSavedMults((prev) => {
            const rest = { ...prev }
            delete rest[key]
            return rest
          })
        }
      } else {
        const items = extractItems(meal)
        const res = await fetch('/api/trainer/food-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'log_planned',
            trainee_id: traineeId,
            plan_key: key,
            items,
            servings_mult: mult,
            meal_name: meal?.recipe_name || meal?.name,
          }),
        })
        if (res.ok) {
          setLoggedKeys((prev) => new Set(prev).add(key))
          setSavedMults((prev) => ({ ...prev, [key]: mult }))
        }
      }
    } finally {
      setRowState(key, { logging: false })
    }
  }

  async function changeMult(key, meal, mult) {
    setRowState(key, { mult })
    if (loggedKeys.has(key) && traineeId) {
      // Re-log at the new multiplier. Server drops the prior row for this key.
      setRowState(key, { mult, logging: true })
      try {
        const items = extractItems(meal)
        const res = await fetch('/api/trainer/food-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'log_planned',
            trainee_id: traineeId,
            plan_key: key,
            items,
            servings_mult: mult,
            meal_name: meal?.recipe_name || meal?.name,
          }),
        })
        if (res.ok) setSavedMults((prev) => ({ ...prev, [key]: mult }))
      } finally {
        setRowState(key, { logging: false })
      }
    }
  }

  async function logWholeDay(dayIdx, day) {
    if (!traineeId) return
    const meals = Array.isArray(day?.meals) ? day.meals : []
    if (meals.length === 0) return
    setLogAllBusy(true)
    try {
      for (const m of meals) {
        const slot = m.slot || m.meal_slot || 'meal'
        const key = planKey(weekIdx, dayIdx, slot)
        if (loggedKeys.has(key)) continue
        const items = extractItems(m)
        const mult = Number(logState[key]?.mult) || 1
        const res = await fetch('/api/trainer/food-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'log_planned',
            trainee_id: traineeId,
            plan_key: key,
            items,
            servings_mult: mult,
            meal_name: m?.recipe_name || m?.name,
          }),
        })
        if (res.ok) {
          setLoggedKeys((prev) => new Set(prev).add(key))
          setSavedMults((prev) => ({ ...prev, [key]: mult }))
        }
      }
    } finally {
      setLogAllBusy(false)
    }
  }

  if (!mealPlan) return null

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
            {traineeId && loadingToday ? ' · loading today…' : null}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Badge icon={<Flame size={12} />} label="Calories" value={mealPlan.calorie_daily_target_kcal} />
          <Badge label="Protein" value={macros.protein_g} unit="g" />
          <Badge label="Fat" value={macros.fat_g} unit="g" />
          <Badge label="Carbs" value={macros.carb_g} unit="g" />
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
              {traineeId ? <Th>Log</Th> : null}
            </tr>
          </thead>
          <tbody>
            {(activeWeek.days || []).map((d, di) => {
              const dayKey = `${weekIdx}-${di}`
              const byslot = {}
              ;(d.meals || []).forEach((m) => {
                byslot[m.slot || m.meal_slot || 'meal'] = m
              })

              // Loggeds for this row — drives the "X of Y logged" counter.
              let loggedCount = 0
              const slotKeys = slots.map((s) => ({ s, key: planKey(weekIdx, di, s) }))
              for (const { key } of slotKeys) if (loggedKeys.has(key)) loggedCount += 1
              const rowMealCount = (d.meals || []).length
              const allDayLogged = rowMealCount > 0 && loggedCount >= rowMealCount
              const isToday = di === todayIdx

              return (
                <tr key={dayKey} style={{
                  borderBottom: `1px solid ${BRD_LT}`,
                  background: isToday ? '#fefce8' : undefined,
                }}>
                  <td style={{ padding: '6px 10px', color: BLK, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {d.day_label || `Day ${di + 1}`}
                    {isToday ? (
                      <span style={{
                        marginLeft: 6, padding: '1px 6px',
                        background: '#fde68a', color: '#713f12',
                        borderRadius: 10, fontSize: 9, fontWeight: 800,
                        letterSpacing: '.04em', textTransform: 'uppercase',
                      }}>Today</span>
                    ) : null}
                  </td>
                  {slots.map((s) => {
                    const meal = byslot[s]
                    if (!meal) {
                      return <td key={s} style={{ padding: '8px 10px', color: '#d1d5db' }}>—</td>
                    }
                    const key = planKey(weekIdx, di, s)
                    const isSel = selected && selected.week === weekIdx && selected.day === di && selected.slot === s
                    const isLogged = loggedKeys.has(key)
                    const mult = Number(logState[key]?.mult) || savedMults[key] || 1
                    const busy = !!logState[key]?.logging
                    const kcalScaled = meal.kcal ? Math.round((Number(meal.kcal) || 0) * mult) : null

                    return (
                      <td key={s} style={{ padding: 6, verticalAlign: 'top', minWidth: 180 }}>
                        <div style={{
                          background: isSel ? T + '15' : isLogged ? '#f0fdf4' : '#fff',
                          border: `1px solid ${isSel ? T : isLogged ? '#bbf7d0' : BRD}`,
                          borderRadius: 8,
                          overflow: 'hidden',
                        }}>
                          <button
                            type="button"
                            onClick={() => setSelected(isSel ? null : { week: weekIdx, day: di, slot: s, meal })}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 10px 6px',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{
                              color: isLogged ? '#14532d' : BLK,
                              fontWeight: 700, fontSize: 12, marginBottom: 3,
                              textDecoration: isLogged ? 'none' : 'none',
                            }}>
                              {meal.recipe_name || meal.name || 'Meal'}
                            </div>
                            <div style={{ color: GRY5, fontSize: 11 }}>
                              {Number(meal.prep_minutes || 0) + Number(meal.cook_minutes || 0)} min
                              {kcalScaled != null ? ` · ${kcalScaled} kcal` : ''}
                              {isLogged && mult !== 1 ? ` · ${mult}×` : ''}
                            </div>
                          </button>
                          {traineeId && (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '5px 8px 7px',
                              borderTop: `1px solid ${isLogged ? '#dcfce7' : BRD_LT}`,
                              background: isLogged ? 'rgba(22,163,74,0.04)' : 'transparent',
                            }}>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleLogged(key, meal) }}
                                aria-pressed={isLogged}
                                aria-label={isLogged ? 'Unlog this meal' : 'Log this meal'}
                                disabled={busy}
                                style={{
                                  width: 18, height: 18, flexShrink: 0,
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  borderRadius: 5, cursor: busy ? 'wait' : 'pointer',
                                  background: isLogged ? GRN : '#fff',
                                  border: `1.5px solid ${isLogged ? GRN : '#d1d5db'}`,
                                  padding: 0,
                                  boxShadow: isLogged ? '0 1px 2px rgba(22,163,74,0.25)' : 'none',
                                }}
                              >
                                {busy
                                  ? <Loader2 size={11} color={isLogged ? '#fff' : '#9ca3af'} style={{ animation: 'kotoSpin 0.8s linear infinite' }} />
                                  : isLogged ? <Check size={12} color="#fff" strokeWidth={3.5} /> : null}
                              </button>
                              <MultSegment
                                value={mult}
                                busy={busy}
                                onChange={(m) => changeMult(key, meal, m)}
                              />
                              <style>{'@keyframes kotoSpin{to{transform:rotate(360deg)}}'}</style>
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                  <td style={{ padding: '8px 10px', color: GRY7, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {d.day_kcal || d.daily_kcal || sumKcal(d)}
                    {traineeId && rowMealCount > 0 ? (
                      <div style={{
                        marginTop: 2, fontSize: 10, fontWeight: 700,
                        color: allDayLogged ? GRN : '#9ca3af', letterSpacing: '.03em',
                      }}>
                        {loggedCount}/{rowMealCount} logged
                      </div>
                    ) : null}
                  </td>
                  {traineeId ? (
                    <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => logWholeDay(di, d)}
                        disabled={allDayLogged || logAllBusy || rowMealCount === 0}
                        style={{
                          padding: '5px 10px',
                          fontSize: 11, fontWeight: 700,
                          background: allDayLogged ? '#f0fdf4' : '#fff',
                          color: allDayLogged ? GRN : GRY7,
                          border: `1px solid ${allDayLogged ? '#bbf7d0' : BRD}`,
                          borderRadius: 6,
                          cursor: allDayLogged ? 'default' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {allDayLogged ? 'All logged' : 'Log day'}
                      </button>
                    </td>
                  ) : null}
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

// Multiplier segmented control — 0.5× / 1× / 1.5×.
function MultSegment({ value, onChange, busy }) {
  return (
    <div style={{
      display: 'inline-flex',
      padding: 2, gap: 1,
      background: 'rgba(17,17,17,0.06)',
      borderRadius: 6,
    }}>
      {MULT_OPTIONS.map((m) => {
        const active = Math.abs(m - value) < 1e-3
        return (
          <button
            key={m}
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(m) }}
            disabled={busy}
            style={{
              padding: '2px 7px',
              fontSize: 10, fontWeight: 700,
              letterSpacing: '-.01em',
              background: active ? '#fff' : 'transparent',
              color: active ? BLK : '#6b7280',
              border: 'none',
              borderRadius: 4,
              cursor: busy ? 'wait' : 'pointer',
              boxShadow: active ? '0 1px 2px rgba(17,17,17,0.06)' : 'none',
            }}
          >
            {m === 1 ? '1×' : `${m}×`}
          </button>
        )
      })}
    </div>
  )
}

function MealDetail({ meal, onClose }) {
  const macros = meal.macros_per_serving || meal.macros || {}
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'kotoFade .15s ease',
      }}
    >
      <style>{'@keyframes kotoFade{from{opacity:0}to{opacity:1}}'}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          border: `1px solid ${BRD}`,
          borderRadius: 14,
          padding: '22px 24px',
          maxWidth: 560, width: '100%',
          maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 20, color: BLK, fontWeight: 800, letterSpacing: '-.015em', lineHeight: 1.2 }}>
              {meal.recipe_name || meal.name}
            </h3>
            <div style={{ color: GRY5, fontSize: 13, marginTop: 6 }}>
              Prep {meal.prep_minutes ?? 0} min · Cook {meal.cook_minutes ?? 0} min
              {meal.servings ? ` · ${meal.servings} servings` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 32, height: 32,
              background: '#f8fafc', border: `1px solid ${BRD}`, borderRadius: 8,
              cursor: 'pointer', color: GRY7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {meal.kcal && <MiniBadge label="Calories" value={meal.kcal} color="#0f172a" />}
          {macros.protein_g && <MiniBadge label="Protein" value={`${macros.protein_g}g`} color="#2563eb" />}
          {macros.carb_g && <MiniBadge label="Carbs" value={`${macros.carb_g}g`} color="#059669" />}
          {macros.fat_g && <MiniBadge label="Fat" value={`${macros.fat_g}g`} color="#d97706" />}
          {macros.fiber_g && <MiniBadge label="Fiber" value={`${macros.fiber_g}g`} color="#7c3aed" />}
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

function MiniBadge({ label, value, color }) {
  const c = color || '#0f172a'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px',
      background: c + '10',
      border: `1px solid ${c}30`,
      color: c,
      borderRadius: 999, fontSize: 12, fontWeight: 700,
      letterSpacing: '-.005em',
    }}>
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span>{value}</span>
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
