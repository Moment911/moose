"use client"
// ── CityPicker — hierarchical Census geo selector ───────────────────────────
// State → Counties (multi-select) → Cities/Townships per county. The previous
// version was a flat state→places list that (a) dropped townships/boroughs by
// filtering to incorporated city/town only, and (b) had no county tier. This
// version drills down properly using Census county subdivisions (MCDs), which
// nest under counties and DO include townships.
//
// Controlled contract is UNCHANGED so both callers (guided StepCompetitors +
// TopicCampaignPanel) keep working: the parent still owns `selectedCities` (a
// Set of place NAMES) + the chosen `state`. County selection is internal UI.
// All multi-select goes through onToggle(name) loops (never onSelectAllFiltered,
// whose add-vs-replace semantics differ between the two callers).
//
// Data: /api/kotoiq/topic-campaign list_counties + list_subdivisions (both wrap
// geoLookup → Census, provenance preserved, never fabricated).

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Loader2, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, BLK, FH, FB } from '../../lib/theme'

function errText(e) {
  if (e == null) return 'Request failed'
  if (typeof e === 'string') return e
  if (typeof e === 'object') return e.message || e.error || e.code || JSON.stringify(e)
  return String(e)
}

/**
 * Controlled Census geo selector (state → counties → cities/townships).
 *
 * Props (controlled bits unchanged from the original flat picker):
 *  - agencyId            string  — required for the Census-backed fetches
 *  - states              string[] — state abbreviations for the <select>
 *  - state               string  — currently selected state abbr (controlled)
 *  - onStateChange       (abbr) => void
 *  - selectedCities      Set<string> — selected place NAMES (controlled)
 *  - onToggle            (name) => void
 *  - onSelectAllFiltered (names) => void   — kept for back-compat (unused here)
 *  - onClear             () => void
 *  - cap                 number  — per-deploy cap shown in the hint (default 100)
 *  - title               string
 *  - subtitle            string
 */
export default function CityPicker({
  agencyId,
  states = [],
  state = '',
  onStateChange,
  selectedCities = new Set(),
  onToggle,
  // onSelectAllFiltered intentionally NOT destructured — its add-vs-replace
  // semantics differ between callers, so this picker drives multi-select via
  // onToggle loops instead. The prop is still accepted (and ignored) for compat.
  onClear,
  cap = 100,
  title = 'Pick where you serve',
  subtitle = 'Drill down by county, then choose the cities and townships you want pages for. Each one gets its own published page.',
}) {
  const [counties, setCounties] = useState([])          // [{name, fips}]
  const [subs, setSubs] = useState([])                  // [{name, kind, fips, county_fips}]
  const [loadingGeo, setLoadingGeo] = useState(false)
  const [selectedCounties, setSelectedCounties] = useState(() => new Set()) // county fips
  const [countySearch, setCountySearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [expanded, setExpanded] = useState(() => new Set()) // county fips expanded

  const lastLoadedState = useRef(null)

  // ── Load counties + subdivisions for the chosen state (one call each). ──────
  async function loadGeo(resetSelection) {
    if (!state) { setCounties([]); setSubs([]); return }
    setLoadingGeo(true)
    setCountySearch(''); setCityFilter('')
    if (resetSelection) { onClear?.(); setSelectedCounties(new Set()); setExpanded(new Set()) }
    try {
      const post = (action) => fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, agency_id: agencyId, state_abbr: state }),
      }).then(r => r.json())
      const [c, sub] = await Promise.all([post('list_counties'), post('list_subdivisions')])
      if (c?.error) { toast.error(errText(c.error)); setCounties([]) } else setCounties(c.counties || [])
      if (sub?.error) { toast.error(errText(sub.error)); setSubs([]) } else setSubs(sub.subdivisions || [])
    } catch (e) {
      toast.error(e.message)
    }
    setLoadingGeo(false)
  }

  useEffect(() => {
    if (!state) { setCounties([]); setSubs([]); lastLoadedState.current = null; return }
    const stateChanged = lastLoadedState.current != null && lastLoadedState.current !== state
    lastLoadedState.current = state
    loadGeo(stateChanged)
  }, [state]) // eslint-disable-line

  // Group subdivisions by county for fast lookup.
  const subsByCounty = useMemo(() => {
    const m = new Map()
    for (const s of subs) {
      if (!m.has(s.county_fips)) m.set(s.county_fips, [])
      m.get(s.county_fips).push(s)
    }
    return m
  }, [subs])

  const filteredCounties = useMemo(() => {
    const q = countySearch.trim().toLowerCase()
    const list = q ? counties.filter(c => c.name.toLowerCase().includes(q)) : counties
    return list
  }, [counties, countySearch])

  // The chosen counties, in display order, each with its (optionally filtered) subs.
  const chosen = useMemo(() => {
    const q = cityFilter.trim().toLowerCase()
    return counties
      .filter(c => selectedCounties.has(c.fips))
      .map(c => {
        let items = subsByCounty.get(c.fips) || []
        if (q) items = items.filter(s => s.name.toLowerCase().includes(q))
        return { county: c, items }
      })
  }, [counties, selectedCounties, subsByCounty, cityFilter])

  // All currently-visible subdivision names across chosen counties.
  const visibleNames = useMemo(() => chosen.flatMap(g => g.items.map(s => s.name)), [chosen])

  // ── Selection helpers — onToggle loops only (consistent across both callers). ──
  const toggleCounty = (fips) => {
    setSelectedCounties(prev => {
      const next = new Set(prev)
      if (next.has(fips)) next.delete(fips); else { next.add(fips); setExpanded(e => new Set(e).add(fips)) }
      return next
    })
  }
  const selectAllCounties = () => setSelectedCounties(new Set(filteredCounties.map(c => c.fips)))
  const clearCounties = () => { setSelectedCounties(new Set()); onClear?.() }

  const addNames = (names) => names.filter(n => !selectedCities.has(n)).forEach(n => onToggle?.(n))
  const removeNames = (names) => names.filter(n => selectedCities.has(n)).forEach(n => onToggle?.(n))

  const toggleExpand = (fips) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(fips)) next.delete(fips); else next.add(fips)
    return next
  })

  const resetAll = () => { onClear?.(); setSelectedCounties(new Set()); setExpanded(new Set()); setCountySearch(''); setCityFilter('') }

  const totalSubs = subs.length

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <MapPin size={20} color={R}/>
        <div>
          <div style={{ fontFamily:FH, fontWeight:800, fontSize:20, color:BLK }}>{title}</div>
          {subtitle && <div style={{ fontFamily:FB, fontSize:13, color:'#6b7280', marginTop:2 }}>{subtitle}</div>}
        </div>
      </div>

      {/* State select. */}
      <div style={{ display:'flex', gap:14, marginBottom:14, flexWrap:'wrap' }}>
        <Field label="State">
          <select value={state} onChange={e => onStateChange?.(e.target.value)} style={inp()}>
            <option value="">— pick state —</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      {loadingGeo && (
        <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:FB, fontSize:13, color:'#6b7280', marginBottom:12 }}>
          <Loader2 size={14} className="spin"/> Loading counties &amp; places from Census…
        </div>
      )}

      {!loadingGeo && state && counties.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'minmax(220px, 280px) 1fr', gap:16, alignItems:'start' }}>
          {/* ── County column ──────────────────────────────────────────── */}
          <div style={{ border:'1px solid #e5e7eb', borderRadius:10, background:'#fff', padding:12 }}>
            <div style={{ fontSize:12, fontFamily:FH, fontWeight:800, color:BLK, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
              Counties
            </div>
            <input value={countySearch} onChange={e => setCountySearch(e.target.value)} placeholder="Filter counties…" style={{ ...inp(), marginBottom:8 }}/>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, fontSize:11, color:'#6b7280', fontFamily:FB }}>
              <span><strong>{selectedCounties.size}</strong> selected</span>
              <button onClick={selectAllCounties} style={miniBtn()}>All</button>
              <button onClick={clearCounties} style={miniBtn()}>Clear</button>
            </div>
            <div style={{ maxHeight:320, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
              {filteredCounties.map(c => {
                const on = selectedCounties.has(c.fips)
                const n = (subsByCounty.get(c.fips) || []).length
                return (
                  <label key={c.fips} style={countyRow(on)}>
                    <input type="checkbox" checked={on} onChange={() => toggleCounty(c.fips)} style={{ marginRight:8 }}/>
                    <span style={{ flex:1, fontSize:13, color:BLK }}>{c.name}</span>
                    <span style={{ fontSize:10, color:'#9ca3af' }}>{n}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* ── Cities / townships column (per selected county) ─────────── */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
              <input value={cityFilter} onChange={e => setCityFilter(e.target.value)} placeholder="Filter cities & townships…"
                style={{ ...inp(), maxWidth:260 }} disabled={selectedCounties.size === 0}/>
              <span style={{ fontFamily:FB, fontSize:12, color:'#6b7280' }}>
                <strong style={{ color:R }}>{selectedCities.size}</strong> selected
              </span>
              {visibleNames.length > 0 && (
                <>
                  <button onClick={() => addNames(visibleNames)} style={miniBtn({ background:`${R}10`, borderColor:R, color:R })}>Select all shown</button>
                  <button onClick={() => removeNames(visibleNames)} style={miniBtn()}>Deselect shown</button>
                </>
              )}
              <button onClick={resetAll} style={{ ...miniBtn(), marginLeft:'auto', display:'inline-flex', alignItems:'center', gap:6 }}>
                <RotateCcw size={12}/> Reset
              </button>
            </div>
            <div style={{ fontFamily:FB, fontSize:11, color:'#9ca3af', marginBottom:10 }}>
              Cap: {cap} per deploy · {totalSubs} places across {counties.length} counties
            </div>

            {selectedCounties.size === 0 && (
              <div style={{ border:'1px dashed #d1d5db', borderRadius:10, padding:'24px 16px', textAlign:'center', color:'#6b7280', fontFamily:FB, fontSize:13 }}>
                Pick one or more counties on the left to see the cities and townships in them.
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:10, maxHeight:520, overflowY:'auto' }}>
              {chosen.map(({ county, items }) => {
                const names = items.map(s => s.name)
                const selCount = names.filter(n => selectedCities.has(n)).length
                const isOpen = expanded.has(county.fips)
                return (
                  <div key={county.fips} style={{ border:'1px solid #e5e7eb', borderRadius:10, background:'#fff' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderBottom: isOpen ? '1px solid #f0f0f2' : 'none' }}>
                      <button onClick={() => toggleExpand(county.fips)} style={{ border:'none', background:'transparent', cursor:'pointer', padding:0, display:'inline-flex' }}>
                        {isOpen ? <ChevronDown size={16} color="#6b7280"/> : <ChevronRight size={16} color="#6b7280"/>}
                      </button>
                      <span style={{ fontFamily:FH, fontWeight:700, fontSize:14, color:BLK }}>{county.name} County</span>
                      <span style={{ fontSize:11, color:'#9ca3af' }}>{selCount}/{items.length}</span>
                      <span style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                        <button onClick={() => addNames(names)} style={miniBtn({ background:`${R}10`, borderColor:R, color:R })}>All</button>
                        <button onClick={() => removeNames(names)} style={miniBtn()}>None</button>
                      </span>
                    </div>
                    {isOpen && (
                      <div style={{ padding:8 }}>
                        {items.length === 0 ? (
                          <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, padding:'6px 8px' }}>No matches in this county.</div>
                        ) : (
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:6 }}>
                            {items.map(s => (
                              <label key={s.fips} style={cityChip(selectedCities.has(s.name))}>
                                <input type="checkbox" checked={selectedCities.has(s.name)} onChange={() => onToggle?.(s.name)} style={{ marginRight:6 }}/>
                                <span style={{ flex:1, fontSize:13 }}>{s.name}</span>
                                <span style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase' }}>{s.kind}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {!loadingGeo && state && counties.length === 0 && (
        <div style={{ fontFamily:FB, fontSize:13, color:'#6b7280' }}>
          No counties came back for {state}. Try again in a moment — the Census API may be busy.
        </div>
      )}
    </div>
  )
}

// ── Local style helpers (mirror the original so the picker stays self-contained) ──
function Field({ label, hint, required, children }) {
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ fontSize:12, fontFamily:FH, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>
        {label} {required && <span style={{ color:R }}>*</span>}
      </div>
      {children}
      {hint && <div style={{ marginTop:4, fontSize:11, color:'#9ca3af', fontFamily:FB }}>{hint}</div>}
    </div>
  )
}

const inp = (x={}) => ({ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:14, fontFamily:FB, outline:'none', background:'#fff', ...x })
const miniBtn = (x={}) => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 11px', borderRadius:8, border:`1px solid ${x.borderColor||'#e5e7eb'}`, background:x.background||'#fff', color:x.color||'#6b7280', fontFamily:FH, fontSize:12, fontWeight:700, cursor:'pointer' })
const countyRow = (selected) => ({
  display:'flex', alignItems:'center', padding:'7px 9px', borderRadius:7,
  border:`1px solid ${selected ? R : '#eef0f2'}`,
  background: selected ? `${R}0d` : '#fff', cursor:'pointer', fontFamily:FB,
})
const cityChip = (selected) => ({
  display:'flex', alignItems:'center', padding:'6px 10px', borderRadius:7,
  border:`1px solid ${selected ? R : '#e5e7eb'}`,
  background: selected ? `${R}10` : '#fff',
  cursor:'pointer', fontFamily:FB,
})
