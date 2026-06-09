"use client"
// ── CityPicker — shared Census-backed city multi-select ─────────────────────
// Extracted verbatim (Phase 11 Plan 04 / WS4) from TopicCampaignPanel.jsx's
// step-2 picker so the guided onboarding shell and the campaign panel share ONE
// targeting control. Controlled component: the parent owns `selectedCities`
// (a Set of city names) + the chosen state. Cities load from Census via the
// existing `/api/kotoiq/topic-campaign` `list_cities` action (which wraps
// geoLookup) — provenance preserved, never fabricated (data-integrity standard).
//
// Behaviour MUST stay identical to the original in-panel picker:
//  - state <select>, city filter <input>, selectedCities Set
//  - "Select all filtered" / "Clear", 500-render cap, "Cap: N per deploy" hint
//  - cities loaded on state change, selection reset when the state changes
//
// Styling intentionally reuses the existing TopicCampaignPanel old-theme tokens
// (R/BLK/FH/FB from ../../lib/theme) rather than koto/* primitives so the host
// panel — which is still entirely old-theme — renders byte-identically.
// Restyling the panel to DESIGN.md primitives is a separate migration (DESIGN.md
// §Migration Notes; RESEARCH Pitfall 6), out of scope for this extraction.

import React, { useEffect, useRef, useState } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, BLK, FH, FB } from '../../lib/theme'

// Coerce any error value (string / Error / {code,message}) into a plain string —
// passing an object to toast.error() throws React error #31. Mirrors the helper
// in TopicCampaignPanel so the extracted picker is self-contained.
function errText(e) {
  if (e == null) return 'Request failed'
  if (typeof e === 'string') return e
  if (typeof e === 'object') return e.message || e.error || e.code || JSON.stringify(e)
  return String(e)
}

/**
 * Controlled Census city multi-select.
 *
 * Props:
 *  - agencyId            string  — required for the list_cities Census fetch
 *  - states              string[] — state abbreviations for the <select>
 *  - state               string  — currently selected state abbr (controlled)
 *  - onStateChange       (abbr) => void
 *  - selectedCities      Set<string> — selected city NAMES (controlled)
 *  - onToggle            (name) => void
 *  - onSelectAllFiltered (names: string[]) => void
 *  - onClear             () => void
 *  - cap                 number  — per-deploy cap shown in the hint (default 100)
 *  - title               string  — header label (default "Pick cities")
 *  - subtitle            string  — plain-English "what this does" line
 *  - renderCap           number  — max chips rendered at once (default 500)
 */
export default function CityPicker({
  agencyId,
  states = [],
  state = '',
  onStateChange,
  selectedCities = new Set(),
  onToggle,
  onSelectAllFiltered,
  onClear,
  cap = 100,
  title = 'Pick cities',
  subtitle = 'Each city you select gets its own published page with the city baked into the HTML.',
  renderCap = 500,
}) {
  const [cities, setCities] = useState([])
  const [loadingCities, setLoadingCities] = useState(false)
  const [citySearch, setCitySearch] = useState('')

  // Track the last loaded state so we only reset the parent's selection on an
  // ACTUAL state change — not when this component re-mounts (e.g. the campaign
  // panel toggling between step 1 and step 2). The original in-panel picker
  // lived in an always-mounted parent, so its load effect never fired on
  // re-entry; preserving that keeps behaviour identical.
  const lastLoadedState = useRef(null)

  // Census load path — IDENTICAL to TopicCampaignPanel.loadCities(): the
  // list_cities action wraps geoLookup (Census), each city {name, fips, kind}.
  async function loadCities(resetSelection) {
    if (!state) { setCities([]); return }
    setLoadingCities(true)
    setCitySearch('')
    if (resetSelection) onClear?.()
    try {
      const r = await fetch('/api/kotoiq/topic-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_cities', agency_id: agencyId, state_abbr: state }),
      })
      const d = await r.json()
      if (d.error) { toast.error(errText(d.error)); return }
      setCities(d.cities || [])
    } catch (e) { toast.error(e.message) }
    setLoadingCities(false)
  }

  useEffect(() => {
    if (!state) { setCities([]); lastLoadedState.current = null; return }
    // Reset the selection only when the chosen state genuinely changed.
    const stateChanged = lastLoadedState.current != null && lastLoadedState.current !== state
    lastLoadedState.current = state
    loadCities(stateChanged)
  }, [state]) // eslint-disable-line

  function filteredCities() {
    if (!citySearch.trim()) return cities
    const q = citySearch.toLowerCase()
    return cities.filter(c => c.name.toLowerCase().includes(q))
  }

  const filtered = filteredCities()

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <MapPin size={20} color={R}/>
        <div>
          <div style={{ fontFamily:FH, fontWeight:800, fontSize:20, color:BLK }}>{title}</div>
          {subtitle && (
            <div style={{ fontFamily:FB, fontSize:13, color:'#6b7280', marginTop:2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div style={{ display:'flex', gap:14, marginBottom:14 }}>
        <Field label="State">
          <select value={state} onChange={e => onStateChange?.(e.target.value)} style={inp()}>
            <option value="">— pick state —</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Filter cities">
          <input value={citySearch} onChange={e => setCitySearch(e.target.value)} placeholder="Type to filter…"
            style={inp()} disabled={!cities.length}/>
        </Field>
      </div>

      {loadingCities && (
        <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:FB, fontSize:13, color:'#6b7280' }}>
          <Loader2 size={14} className="spin"/> Loading cities from Census…
        </div>
      )}

      {!loadingCities && cities.length > 0 && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:12, color:'#6b7280', fontFamily:FB }}>
            <span><strong>{selectedCities.size}</strong> of {filtered.length} selected</span>
            <button onClick={() => onSelectAllFiltered?.(filtered.map(c => c.name))} style={miniBtn()}>Select all filtered</button>
            <button onClick={() => onClear?.()} style={miniBtn()}>Clear</button>
            <span style={{ marginLeft:'auto', fontFamily:FB, fontSize:11 }}>
              Cap: {cap} per deploy
            </span>
          </div>
          <div style={{ maxHeight:340, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:8, padding:8, background:'#fff' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:6 }}>
              {filtered.slice(0, renderCap).map(c => (
                <label key={c.fips} style={cityChip(selectedCities.has(c.name))}>
                  <input type="checkbox" checked={selectedCities.has(c.name)} onChange={() => onToggle?.(c.name)}
                    style={{ marginRight:6 }}/>
                  <span style={{ flex:1, fontSize:13 }}>{c.name}</span>
                  <span style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase' }}>{c.kind}</span>
                </label>
              ))}
            </div>
            {filtered.length > renderCap && (
              <div style={{ marginTop:10, fontSize:11, color:'#9ca3af', fontFamily:FB, textAlign:'center' }}>
                Showing first {renderCap} — narrow the filter to see more
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Local style helpers (mirrors TopicCampaignPanel so the picker is self-contained) ──
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
const miniBtn = (x={}) => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 13px', borderRadius:8, border:`1px solid ${x.borderColor||'#e5e7eb'}`, background:x.background||'#fff', color:x.color||'#6b7280', fontFamily:FH, fontSize:13, fontWeight:700, cursor:'pointer' })
const cityChip = (selected) => ({
  display:'flex', alignItems:'center', padding:'6px 10px', borderRadius:7,
  border:`1px solid ${selected ? R : '#e5e7eb'}`,
  background: selected ? `${R}10` : '#fff',
  cursor:'pointer', fontFamily:FB,
})
