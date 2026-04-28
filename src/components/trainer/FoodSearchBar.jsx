"use client"
import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, Loader2, Check, Flame, Barcode } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// FoodSearchBar — FatSecret-powered food search + quick-add.
//
// Search by name or barcode. Results show food name, brand, and macro summary.
// Tap a result to expand serving options, then "Add" to log via food-log API.
// Cal-AI aesthetic: clean white, ink text, card bg results.
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  ink: '#0a0a0a', ink2: '#1f1f22', ink3: '#6b6b70', ink4: '#a1a1a6',
  bg: '#ffffff', card: '#f1f1f6', border: '#ececef',
  green: '#16a34a', greenBg: '#ecfdf5', blue: '#5aa0ff',
  font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
  r: 16, rSm: 12, rPill: 999,
}

export default function FoodSearchBar({ traineeId, onLogged }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null) // null = not searched, [] = no results
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [servingIdx, setServingIdx] = useState(0)
  const [servings, setServings] = useState(1)
  const [logging, setLogging] = useState(false)
  const [logged, setLogged] = useState(false)
  const debounce = useRef(null)
  const inputRef = useRef(null)

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/trainer/food-search?q=${encodeURIComponent(q)}`)
      if (!res.ok) { setResults([]); return }
      const data = await res.json()
      setResults(data.foods || [])
    } catch {
      setResults([])
    } finally { setLoading(false) }
  }, [])

  function handleChange(val) {
    setQuery(val)
    setSelectedId(null)
    setDetail(null)
    setLogged(false)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(val), 350)
  }

  async function handleSelect(food) {
    if (selectedId === food.id) { setSelectedId(null); setDetail(null); return }
    setSelectedId(food.id)
    setDetailLoading(true)
    setServingIdx(0)
    setServings(1)
    setLogged(false)
    try {
      const res = await fetch(`/api/trainer/food-search?id=${food.id}`)
      if (res.ok) {
        const data = await res.json()
        setDetail(data.food)
      }
    } finally { setDetailLoading(false) }
  }

  async function handleBarcode() {
    const code = prompt('Enter barcode number:')
    if (!code) return
    setQuery(code)
    setLoading(true)
    setResults(null)
    try {
      const res = await fetch(`/api/trainer/food-search?barcode=${encodeURIComponent(code)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.food) {
          setDetail(data.food)
          setSelectedId(data.food.id)
          setResults([{ id: data.food.id, name: data.food.name, brand: data.food.brand, type: data.food.type, description: '' }])
        } else {
          setResults([])
        }
      }
    } finally { setLoading(false) }
  }

  async function handleLog() {
    if (!detail || !traineeId) return
    const serving = detail.servings?.[servingIdx]
    if (!serving) return
    setLogging(true)
    try {
      const items = [{
        name: detail.brand ? `${detail.name} (${detail.brand})` : detail.name,
        kcal: Math.round(serving.kcal * servings),
        protein_g: Math.round(serving.protein_g * servings),
        fat_g: Math.round(serving.fat_g * servings),
        carb_g: Math.round(serving.carb_g * servings),
        portion: `${servings}x ${serving.description}`,
      }]
      const res = await fetch('/api/trainer/food-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log_custom',
          trainee_id: traineeId,
          items,
          meal_name: items[0].name,
          source: 'fatsecret',
          source_id: detail.id,
        }),
      })
      if (res.ok) {
        setLogged(true)
        if (onLogged) onLogged()
        setTimeout(() => {
          setQuery('')
          setResults(null)
          setSelectedId(null)
          setDetail(null)
          setLogged(false)
        }, 1500)
      }
    } finally { setLogging(false) }
  }

  const activeServing = detail?.servings?.[servingIdx]

  return (
    <div style={{ fontFamily: T.font }}>
      {/* Search input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', background: T.card, borderRadius: T.r,
        border: `1px solid ${results !== null ? T.ink + '15' : 'transparent'}`,
        transition: 'border-color .15s',
      }}>
        <Search size={18} color={T.ink4} style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search foods (e.g. chicken breast, oatmeal)..."
          style={{
            flex: 1, border: 'none', background: 'transparent', outline: 'none',
            fontSize: 16, fontWeight: 500, color: T.ink, fontFamily: T.font,
          }}
        />
        {loading && <Loader2 size={16} color={T.ink3} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
        {query && !loading && (
          <button type="button" onClick={() => { setQuery(''); setResults(null); setSelectedId(null); setDetail(null) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: T.ink4, flexShrink: 0 }}>
            <X size={16} />
          </button>
        )}
        <button type="button" onClick={handleBarcode} title="Scan barcode"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: T.ink3, flexShrink: 0 }}>
          <Barcode size={18} />
        </button>
      </div>

      {/* Results */}
      {results !== null && (
        <div style={{ marginTop: 8, maxHeight: 400, overflowY: 'auto', borderRadius: T.rSm }}>
          {results.length === 0 && !loading && (
            <div style={{ padding: 20, textAlign: 'center', color: T.ink3, fontSize: 14 }}>
              No foods found. Try a different search.
            </div>
          )}
          {results.map((food) => {
            const isSelected = selectedId === food.id
            return (
              <div key={food.id}>
                <button type="button" onClick={() => handleSelect(food)} style={{
                  display: 'flex', alignItems: 'center', width: '100%', padding: '12px 14px',
                  background: isSelected ? '#fff' : 'transparent',
                  border: 'none', borderBottom: `1px solid ${T.border}`,
                  cursor: 'pointer', textAlign: 'left', fontFamily: T.font, gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{food.name}</div>
                    <div style={{ fontSize: 13, color: T.ink3, marginTop: 2 }}>
                      {food.brand && <span style={{ fontWeight: 600 }}>{food.brand} · </span>}
                      {food.description ? parseMacroLine(food.description) : food.type}
                    </div>
                  </div>
                  {isSelected && detailLoading && <Loader2 size={14} color={T.ink3} style={{ animation: 'spin 1s linear infinite' }} />}
                </button>

                {/* Expanded detail — serving picker + log button */}
                {isSelected && detail && (
                  <div style={{ padding: '12px 14px', background: '#fff', borderBottom: `1px solid ${T.border}` }}>
                    {/* Serving selector */}
                    {detail.servings?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T.ink4, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Serving size</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {detail.servings.slice(0, 5).map((s, i) => (
                            <button key={s.id} type="button" onClick={() => setServingIdx(i)} style={{
                              padding: '6px 12px', borderRadius: T.rPill, border: 'none',
                              background: servingIdx === i ? T.ink : T.card,
                              color: servingIdx === i ? '#fff' : T.ink3,
                              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
                            }}>
                              {s.description}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Servings multiplier */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.ink3 }}>Servings:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {[0.5, 1, 1.5, 2].map((n) => (
                          <button key={n} type="button" onClick={() => setServings(n)} style={{
                            padding: '4px 10px', borderRadius: T.rPill, border: 'none',
                            background: servings === n ? T.ink : T.card,
                            color: servings === n ? '#fff' : T.ink3,
                            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: T.font,
                          }}>
                            {n}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Macro preview */}
                    {activeServing && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <MacroPill label="Cal" value={Math.round(activeServing.kcal * servings)} color={T.ink} />
                        <MacroPill label="P" value={Math.round(activeServing.protein_g * servings)} unit="g" color={T.blue} />
                        <MacroPill label="C" value={Math.round(activeServing.carb_g * servings)} unit="g" color="#16a34a" />
                        <MacroPill label="F" value={Math.round(activeServing.fat_g * servings)} unit="g" color="#d97706" />
                      </div>
                    )}

                    {/* Log button */}
                    <button type="button" onClick={handleLog} disabled={logging || logged} style={{
                      width: '100%', padding: '12px', borderRadius: T.rSm, border: 'none',
                      background: logged ? T.greenBg : logging ? T.card : T.ink,
                      color: logged ? T.green : logging ? T.ink3 : '#fff',
                      fontSize: 15, fontWeight: 600, cursor: logging ? 'default' : 'pointer',
                      fontFamily: T.font, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                      {logged ? <><Check size={16} strokeWidth={3} /> Logged</> :
                       logging ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Logging...</> :
                       <><Flame size={16} /> Add to food log</>}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

function MacroPill({ label, value, unit, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', background: color + '10', borderRadius: T.rPill,
      fontSize: 13, fontWeight: 700, color,
    }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      {value}{unit || ''}
    </span>
  )
}

function parseMacroLine(desc) {
  // FatSecret description format: "Per 100g - Calories: 165kcal | Fat: 3.57g | Carbs: 0.00g | Protein: 31.02g"
  if (!desc) return ''
  const match = desc.match(/Calories:\s*([\d.]+)/)
  if (match) return desc.replace(/Per\s+/i, '').replace(/\s*-\s*/, ' — ')
  return desc
}
