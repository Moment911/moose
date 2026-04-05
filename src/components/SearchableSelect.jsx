"use client"
import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, X, Check } from 'lucide-react'

/**
 * SearchableSelect — a combobox that filters as you type.
 *
 * Props:
 *   value        string — current selected value
 *   onChange     (value, option) => void
 *   options      Array<{ value, label, group?, sub?, keywords? }>
 *   placeholder  string
 *   searchPlaceholder string
 *   grouped      bool — show optgroup-style headers
 *   disabled     bool
 *   style        object — outer wrapper style overrides
 *   dark         bool — dark theme (for dark headers)
 */
export default function SearchableSelect({
  value, onChange, options = [], placeholder = 'Select…',
  searchPlaceholder = 'Search…', grouped = false, disabled = false,
  style = {}, dark = false, noResultsText = 'No results found',
}) {
  const [open,   setOpen]   = useState(false)
  const [query,  setQuery]  = useState('')
  const wrapRef  = useRef(null)
  const inputRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
    }
  }, [open])

  const selected = options.find(o => o.value === value)

  // Filter options by query — searches label, sub, keywords
  const q = query.toLowerCase().trim()
  const filtered = q
    ? options.filter(o =>
        o.label?.toLowerCase().includes(q) ||
        o.sub?.toLowerCase().includes(q) ||
        o.keywords?.toLowerCase().includes(q) ||
        o.value?.toLowerCase().includes(q) ||
        o.group?.toLowerCase().includes(q)
      )
    : options

  // Group filtered results
  const groups = grouped
    ? [...new Set(filtered.map(o => o.group || ''))]
    : null

  const BG     = dark ? '#1a1a1a' : '#fff'
  const BORDER = dark ? '#2a2a2a' : '#e5e7eb'
  const TEXT   = dark ? '#fff'    : '#111'
  const MUTED  = dark ? '#666'    : '#9ca3af'
  const HOVER  = dark ? '#252525' : '#f9fafb'
  const ACCENT = '#ea2729'

  return (
    <div ref={wrapRef} style={{ position:'relative', ...style }}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        style={{
          width:'100%', padding:'9px 12px', borderRadius:9,
          border:`1.5px solid ${open ? ACCENT : BORDER}`,
          background:BG, color: selected ? TEXT : MUTED,
          fontSize:13, fontWeight: selected ? 600 : 400,
          cursor:'pointer', display:'flex', alignItems:'center',
          justifyContent:'space-between', gap:8, textAlign:'left',
          transition:'border-color .15s', boxSizing:'border-box',
          outline:'none',
        }}>
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
          {selected ? selected.label : placeholder}
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
          {value && (
            <span onClick={e=>{ e.stopPropagation(); onChange('', null); setOpen(false) }}
              style={{ color:MUTED, display:'flex', cursor:'pointer', padding:2 }}>
              <X size={12}/>
            </span>
          )}
          <ChevronDown size={14} color={MUTED} style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform .15s' }}/>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:9999,
          background:BG, border:`1px solid ${BORDER}`, borderRadius:11,
          boxShadow:'0 8px 32px rgba(0,0,0,.15)', overflow:'hidden',
          maxHeight:320, display:'flex', flexDirection:'column',
        }}>
          {/* Search input */}
          <div style={{ padding:'8px 10px', borderBottom:`1px solid ${BORDER}`, flexShrink:0, display:'flex', alignItems:'center', gap:7 }}>
            <Search size={13} color={MUTED}/>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:13, color:TEXT, fontFamily:'inherit' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background:'none', border:'none', cursor:'pointer', color:MUTED, padding:0, display:'flex' }}>
                <X size={12}/>
              </button>
            )}
          </div>

          {/* Options list */}
          <div style={{ overflowY:'auto', flex:1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding:'14px 16px', fontSize:13, color:MUTED, textAlign:'center' }}>{noResultsText}</div>
            ) : grouped && groups ? (
              groups.map(group => (
                <div key={group}>
                  {group && (
                    <div style={{ padding:'7px 12px 3px', fontSize:10, fontWeight:800, color:MUTED, textTransform:'uppercase', letterSpacing:'.08em', background: dark?'#141414':'#f9fafb', borderBottom:`1px solid ${BORDER}` }}>
                      {group}
                    </div>
                  )}
                  {filtered.filter(o => (o.group || '') === group).map(opt => (
                    <OptionRow key={opt.value + opt.label} opt={opt} selected={value === opt.value}
                      onSelect={() => { onChange(opt.value, opt); setOpen(false); setQuery('') }}
                      hover={HOVER} text={TEXT} muted={MUTED} accent={ACCENT} query={q}/>
                  ))}
                </div>
              ))
            ) : (
              filtered.map(opt => (
                <OptionRow key={opt.value + opt.label} opt={opt} selected={value === opt.value}
                  onSelect={() => { onChange(opt.value, opt); setOpen(false); setQuery('') }}
                  hover={HOVER} text={TEXT} muted={MUTED} accent={ACCENT} query={q}/>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function highlight(text, query) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background:'#fef08a', borderRadius:2, padding:'0 1px' }}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function OptionRow({ opt, selected, onSelect, hover, text, muted, accent, query }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding:'8px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:10,
        background: selected ? accent + '12' : hov ? hover : 'transparent',
        transition:'background .1s',
      }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight: selected ? 700 : 500, color: selected ? accent : text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {highlight(opt.label, query)}
        </div>
        {opt.sub && (
          <div style={{ fontSize:11, color:muted, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {highlight(opt.sub, query)}
          </div>
        )}
      </div>
      {selected && <Check size={13} color={accent} style={{ flexShrink:0 }}/>}
    </div>
  )
}
