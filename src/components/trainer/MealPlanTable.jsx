"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Flame, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// MealPlanTable — Cal-AI card-based meal plan viewer + food logger.
//
// Replaces the old HTML table with per-day cards, each expandable to show
// individual meals. Cal-AI tokens throughout. Macro badges at top.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  ink: '#0a0a0a', ink2: '#1f1f22', ink3: '#6b6b70', ink4: '#a1a1a6',
  bg: '#ffffff', card: '#f1f1f6', border: '#ececef', divider: '#e5e5ea',
  green: '#16a34a', greenBg: '#ecfdf5', amber: '#f0b400', amberBg: '#fef9ec',
  blue: '#5aa0ff', red: '#e9695c',
  font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
  r: 16, rSm: 12, rPill: 999,
}

const MULT_OPTIONS = [0.5, 1, 1.5]

function planKey(weekIdx, dayIdx, slot) {
  return `week:${weekIdx}|day:${dayIdx}|slot:${slot || 'meal'}`
}

function extractItems(meal) {
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
  const [openDays, setOpenDays] = useState({})
  const [logState, setLogState] = useState({})
  const [savedMults, setSavedMults] = useState({})
  const [loggedKeys, setLoggedKeys] = useState(() => new Set())
  const [loadingToday, setLoadingToday] = useState(false)
  const [logAllBusy, setLogAllBusy] = useState(false)

  const weeks = Array.isArray(mealPlan?.weeks) ? mealPlan.weeks : []
  const activeWeek = weeks[weekIdx] || weeks[0] || { days: [] }
  const macros = mealPlan?.macro_daily_targets_g || {}

  const todayIdx = useMemo(() => {
    const raw = new Date().getDay()
    return raw === 0 ? 6 : raw - 1
  }, [])

  // Auto-open today
  useEffect(() => {
    setOpenDays({ [todayIdx]: true })
  }, [todayIdx])

  const loadToday = useCallback(async () => {
    if (!traineeId) return
    setLoadingToday(true)
    try {
      const res = await fetch('/api/trainer/food-log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
            if (Number.isFinite(Number(parsed.servings_mult))) mults[parsed.plan_key] = Number(parsed.servings_mult)
          }
        } catch {}
      }
      setLoggedKeys(next)
      setSavedMults(mults)
    } finally { setLoadingToday(false) }
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
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unlog_planned', trainee_id: traineeId, plan_key: key }),
        })
        if (res.ok) {
          setLoggedKeys((prev) => { const next = new Set(prev); next.delete(key); return next })
          setSavedMults((prev) => { const rest = { ...prev }; delete rest[key]; return rest })
        }
      } else {
        const items = extractItems(meal)
        const res = await fetch('/api/trainer/food-log', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'log_planned', trainee_id: traineeId, plan_key: key, items, servings_mult: mult, meal_name: meal?.recipe_name || meal?.name }),
        })
        if (res.ok) {
          setLoggedKeys((prev) => new Set(prev).add(key))
          setSavedMults((prev) => ({ ...prev, [key]: mult }))
        }
      }
    } finally { setRowState(key, { logging: false }) }
  }

  async function changeMult(key, meal, mult) {
    setRowState(key, { mult })
    if (loggedKeys.has(key) && traineeId) {
      setRowState(key, { mult, logging: true })
      try {
        const items = extractItems(meal)
        const res = await fetch('/api/trainer/food-log', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'log_planned', trainee_id: traineeId, plan_key: key, items, servings_mult: mult, meal_name: meal?.recipe_name || meal?.name }),
        })
        if (res.ok) setSavedMults((prev) => ({ ...prev, [key]: mult }))
      } finally { setRowState(key, { logging: false }) }
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
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'log_planned', trainee_id: traineeId, plan_key: key, items, servings_mult: mult, meal_name: m?.recipe_name || m?.name }),
        })
        if (res.ok) {
          setLoggedKeys((prev) => new Set(prev).add(key))
          setSavedMults((prev) => ({ ...prev, [key]: mult }))
        }
      }
    } finally { setLogAllBusy(false) }
  }

  if (!mealPlan) return null

  return (
    <div style={{ fontFamily: C.font }}>
      {/* Header + macro badges */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>
          {mealPlan.plan_name || 'Meal Plan'}
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <MacroBadge label="Calories" value={mealPlan.calorie_daily_target_kcal} color={C.ink} icon={<Flame size={12} />} />
          <MacroBadge label="Protein" value={macros.protein_g} unit="g" color={C.blue} />
          <MacroBadge label="Carbs" value={macros.carb_g} unit="g" color="#16a34a" />
          <MacroBadge label="Fat" value={macros.fat_g} unit="g" color="#d97706" />
        </div>
      </div>

      {/* Week pill selector */}
      {weeks.length > 1 && (
        <div style={{ display: 'inline-flex', padding: 3, background: C.card, borderRadius: C.rSm, marginBottom: 16 }}>
          {weeks.map((_, i) => {
            const active = i === weekIdx
            return (
              <button key={i} type="button" onClick={() => { setWeekIdx(i); setSelected(null) }} style={{
                padding: '8px 20px', background: active ? C.bg : 'transparent',
                border: 'none', borderRadius: 9, color: active ? C.ink : C.ink3,
                fontSize: 14, fontWeight: active ? 600 : 500, cursor: 'pointer',
                fontFamily: C.font, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
                Week {i + 1}
              </button>
            )
          })}
        </div>
      )}

      {/* Day cards */}
      <div style={{ display: 'grid', gap: 8 }}>
        {(activeWeek.days || []).map((day, di) => {
          const isToday = di === todayIdx
          const isOpen = !!openDays[di]
          const meals = Array.isArray(day?.meals) ? day.meals : []
          const dayKcal = day.daily_totals?.kcal || meals.reduce((a, m) => a + (Number(m.macros_per_serving?.kcal || m.kcal) || 0), 0)

          // Log status
          let loggedCount = 0
          for (const m of meals) {
            const slot = m.slot || m.meal_slot || 'meal'
            if (loggedKeys.has(planKey(weekIdx, di, slot))) loggedCount++
          }
          const allLogged = meals.length > 0 && loggedCount >= meals.length

          return (
            <div key={di}>
              {/* Day header — tap to expand */}
              <button type="button" onClick={() => setOpenDays((prev) => ({ ...prev, [di]: !prev[di] }))} style={{
                display: 'flex', alignItems: 'center', width: '100%', padding: '14px 16px',
                background: isOpen ? C.bg : C.card,
                border: `1px solid ${isOpen ? C.border : 'transparent'}`,
                borderRadius: isOpen ? `${C.rSm}px ${C.rSm}px 0 0` : C.rSm,
                cursor: 'pointer', textAlign: 'left', fontFamily: C.font, gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>
                      {day.day_label || `Day ${di + 1}`}
                    </span>
                    {isToday && (
                      <span style={{ padding: '2px 8px', background: C.ink, color: '#fff', borderRadius: C.rPill, fontSize: 10, fontWeight: 700 }}>Today</span>
                    )}
                    {allLogged && (
                      <span style={{ padding: '2px 8px', background: C.greenBg, color: C.green, borderRadius: C.rPill, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Check size={10} strokeWidth={3} /> All logged
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: C.ink3, marginTop: 2 }}>
                    {meals.length} meal{meals.length !== 1 ? 's' : ''} · {dayKcal} kcal
                    {loggedCount > 0 && !allLogged && ` · ${loggedCount}/${meals.length} logged`}
                  </div>
                </div>
                {isOpen ? <ChevronUp size={18} color={C.ink3} /> : <ChevronDown size={18} color={C.ink3} />}
              </button>

              {/* Expanded — meal cards */}
              {isOpen && (
                <div style={{
                  border: `1px solid ${C.border}`, borderTop: 'none',
                  borderRadius: `0 0 ${C.rSm}px ${C.rSm}px`, padding: 12,
                  background: C.bg, display: 'grid', gap: 8,
                }}>
                  {meals.map((meal, mi) => {
                    const slot = meal.slot || meal.meal_slot || 'meal'
                    const key = planKey(weekIdx, di, slot)
                    const isLogged = loggedKeys.has(key)
                    const mult = Number(logState[key]?.mult) || savedMults[key] || 1
                    const busy = !!logState[key]?.logging
                    const mealMacros = meal.macros_per_serving || meal.macros || {}
                    const kcal = Math.round((Number(mealMacros.kcal || meal.kcal) || 0) * mult)

                    return (
                      <div key={mi} style={{
                        background: isLogged ? C.greenBg : C.card,
                        border: `1px solid ${isLogged ? C.green + '25' : 'transparent'}`,
                        borderRadius: C.rSm, padding: '12px 14px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.ink4, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                              {capitalize(slot)}
                            </div>
                            <button type="button" onClick={() => setSelected({ week: weekIdx, day: di, slot, meal })} style={{
                              background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: C.font,
                            }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{meal.recipe_name || meal.name || 'Meal'}</div>
                            </button>
                            <div style={{ fontSize: 13, color: C.ink3, marginTop: 2 }}>
                              {(Number(meal.prep_time_min || 0) + Number(meal.cook_time_min || 0))} min · {kcal} kcal
                              {mealMacros.protein_g ? ` · ${Math.round(mealMacros.protein_g * mult)}g protein` : ''}
                            </div>
                          </div>

                          {/* Log checkbox */}
                          {traineeId && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <MultSegment value={mult} busy={busy} onChange={(m) => changeMult(key, meal, m)} />
                              <button type="button" onClick={() => toggleLogged(key, meal)}
                                disabled={busy} aria-pressed={isLogged}
                                style={{
                                  width: 28, height: 28, borderRadius: 8, cursor: busy ? 'wait' : 'pointer',
                                  background: isLogged ? C.green : '#fff', border: `1.5px solid ${isLogged ? C.green : C.border}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                                }}>
                                {busy
                                  ? <Loader2 size={12} color={isLogged ? '#fff' : C.ink4} style={{ animation: 'kotoSpin 0.8s linear infinite' }} />
                                  : isLogged ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Log whole day button */}
                  {traineeId && meals.length > 0 && !allLogged && (
                    <button type="button" onClick={() => logWholeDay(di, day)}
                      disabled={logAllBusy}
                      style={{
                        padding: '10px 16px', background: C.card, border: `1px solid ${C.border}`,
                        borderRadius: C.rSm, cursor: logAllBusy ? 'default' : 'pointer',
                        fontSize: 13, fontWeight: 600, color: C.ink2, fontFamily: C.font,
                        textAlign: 'center',
                      }}>
                      {logAllBusy ? 'Logging...' : `Log all ${meals.length} meals`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Meal detail modal */}
      {selected?.meal && <MealDetail meal={selected.meal} onClose={() => setSelected(null)} />}
      <style>{'@keyframes kotoSpin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

function MacroBadge({ label, value, unit, color, icon }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '5px 12px', background: color + '10', borderRadius: C.rPill,
      fontSize: 12, fontWeight: 600, color,
    }}>
      {icon}
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value ?? '—'}{unit || ''}</span>
    </span>
  )
}

function MultSegment({ value, onChange, busy }) {
  return (
    <div style={{ display: 'inline-flex', padding: 2, gap: 1, background: 'rgba(0,0,0,0.05)', borderRadius: 6 }}>
      {MULT_OPTIONS.map((m) => {
        const active = Math.abs(m - value) < 1e-3
        return (
          <button key={m} type="button" onClick={(e) => { e.stopPropagation(); onChange(m) }}
            disabled={busy}
            style={{
              padding: '2px 7px', fontSize: 10, fontWeight: 700,
              background: active ? '#fff' : 'transparent', color: active ? C.ink : C.ink3,
              border: 'none', borderRadius: 4, cursor: busy ? 'wait' : 'pointer',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}>
            {m === 1 ? '1x' : `${m}x`}
          </button>
        )
      })}
    </div>
  )
}

function MealDetail({ meal, onClose }) {
  const macros = meal.macros_per_serving || meal.macros || {}
  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: C.r, padding: '24px 24px',
        maxWidth: 560, width: '100%', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>
              {meal.recipe_name || meal.name}
            </h3>
            <div style={{ color: C.ink3, fontSize: 13, marginTop: 4 }}>
              Prep {meal.prep_time_min ?? 0} min · Cook {meal.cook_time_min ?? 0} min
              {meal.serves ? ` · ${meal.serves} servings` : ''}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{
            width: 32, height: 32, background: C.card, border: 'none', borderRadius: 8,
            cursor: 'pointer', color: C.ink3, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700,
          }}>x</button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {macros.kcal && <MacroBadge label="Cal" value={macros.kcal} color={C.ink} />}
          {macros.protein_g && <MacroBadge label="Protein" value={macros.protein_g} unit="g" color={C.blue} />}
          {macros.carb_g && <MacroBadge label="Carbs" value={macros.carb_g} unit="g" color="#16a34a" />}
          {macros.fat_g && <MacroBadge label="Fat" value={macros.fat_g} unit="g" color="#d97706" />}
        </div>

        {Array.isArray(meal.ingredients) && meal.ingredients.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.ink4, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Ingredients</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: C.ink2, fontSize: 14, lineHeight: 1.7 }}>
              {meal.ingredients.map((ing, i) => (
                <li key={i}>{typeof ing === 'string' ? ing : `${ing.amount || ''}${ing.unit ? ' ' + ing.unit : ''} ${ing.item || ing.name || ''}`.trim()}</li>
              ))}
            </ul>
          </div>
        )}

        {(meal.instructions_short || meal.instructions) && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.ink4, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Instructions</div>
            <p style={{ margin: 0, color: C.ink2, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {meal.instructions_short || meal.instructions}
            </p>
          </div>
        )}

        {meal.leftover_strategy && (
          <div style={{ padding: '10px 14px', background: C.card, borderRadius: C.rSm, fontSize: 13, color: C.ink2 }}>
            <strong style={{ color: C.ink, fontWeight: 600 }}>Leftover tip:</strong> {meal.leftover_strategy}
          </div>
        )}
      </div>
    </div>
  )
}

function capitalize(s) {
  if (!s || typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}
