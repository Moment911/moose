'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, ChevronRight, Building2 } from 'lucide-react'
import { searchNAICS, getNAICSByCode } from '../data/naicsCodes'

// Design tokens matching the Koto design system
const R   = '#E6007E'   // brand red
const T   = '#111111'   // text black
const BLK = '#000000'   // true black
const GRY = '#9ca3af'   // gray muted

const BORDER = '#e5e7eb'
const HOVER  = '#f9fafb'
const ACCENT = R

/**
 * NAICSSelector — searchable NAICS code picker.
 *
 * Props:
 *   value        { code, title, level } | null
 *   onChange     ({ code, title, level }) => void
 *   placeholder  string
 */
export default function NAICSSelector({
  value,
  onChange,
  placeholder = 'Search NAICS codes…',
}) {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [active,  setActive]  = useState(-1)

  const wrapRef   = useRef(null)
  const inputRef  = useRef(null)
  const listRef   = useRef(null)
  const timerRef  = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus input when dropdown opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setResults(searchNAICS(''))
      setActive(-1)
    }
  }, [open])

  // Debounced search
  const runSearch = useCallback((q) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setResults(searchNAICS(q))
      setActive(-1)
    }, 200)
  }, [])

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  function handleQueryChange(e) {
    const q = e.target.value
    setQuery(q)
    runSearch(q)
  }

  function handleSelect(entry) {
    onChange({ code: entry.code, title: entry.title, level: entry.level })
    setOpen(false)
    setQuery('')
  }

  function handleClear(e) {
    e.stopPropagation()
    onChange(null)
    setOpen(false)
  }

  // Keyboard navigation
  function handleKeyDown(e) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0 && results[active]) handleSelect(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (active >= 0 && listRef.current) {
      const item = listRef.current.querySelector(`[data-idx="${active}"]`)
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [active])

  // Group results by 2-digit sector prefix
  const grouped = groupBySector(results)

  const levelLabel = {
    2: 'Sector',
    3: 'Subsector',
    4: 'Industry Group',
    5: 'Industry',
    6: 'National Industry',
  }

  const levelColor = {
    2: '#7c3aed',
    3: '#2563eb',
    4: '#059669',
    5: '#d97706',
    6: '#dc2626',
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', fontFamily: 'inherit' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: 9,
          border: `1.5px solid ${open ? ACCENT : BORDER}`,
          background: '#fff',
          color: value ? T : GRY,
          fontSize: 13,
          fontWeight: value ? 600 : 400,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          textAlign: 'left',
          transition: 'border-color .15s',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Building2 size={14} color={value ? ACCENT : GRY} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value
              ? <><strong style={{ color: ACCENT }}>{value.code}</strong> — {value.title}</>
              : placeholder
            }
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {value && (
            <span
              role="button"
              aria-label="Clear selection"
              onClick={handleClear}
              style={{ color: GRY, display: 'flex', cursor: 'pointer', padding: 2 }}
            >
              <X size={12} />
            </span>
          )}
          <ChevronRight
            size={13}
            color={GRY}
            style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
          />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          zIndex: 9999,
          background: '#fff',
          border: `1px solid ${BORDER}`,
          borderRadius: 11,
          boxShadow: '0 8px 32px rgba(0,0,0,.14)',
          overflow: 'hidden',
          maxHeight: 360,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Search input */}
          <div style={{
            padding: '8px 10px',
            borderBottom: `1px solid ${BORDER}`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}>
            <Search size={13} color={GRY} />
            <input
              ref={inputRef}
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              placeholder="Type code or industry name…"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 13,
                color: T,
                fontFamily: 'inherit',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults(searchNAICS('')); setActive(-1) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRY, padding: 0, display: 'flex' }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Results list */}
          <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
            {results.length === 0 ? (
              <div style={{ padding: '14px 16px', fontSize: 13, color: GRY, textAlign: 'center' }}>
                No NAICS codes found
              </div>
            ) : (
              grouped.map(({ sector, entries }) => {
                return (
                  <div key={sector}>
                    {/* Sector header */}
                    <div style={{
                      padding: '6px 12px 3px',
                      fontSize: 10,
                      fontWeight: 800,
                      color: GRY,
                      textTransform: 'uppercase',
                      letterSpacing: '.07em',
                      background: '#f9fafb',
                      borderBottom: `1px solid ${BORDER}`,
                      borderTop: `1px solid ${BORDER}`,
                    }}>
                      {sector}
                    </div>
                    {entries.map(entry => {
                      const idx = results.indexOf(entry)
                      const isActive = idx === active
                      const isSelected = value?.code === entry.code
                      const indent = Math.max(0, entry.level - 2) * 10

                      return (
                        <div
                          key={entry.code}
                          data-idx={idx}
                          onClick={() => handleSelect(entry)}
                          onMouseEnter={() => setActive(idx)}
                          style={{
                            padding: `7px 12px 7px ${12 + indent}px`,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            background: isSelected
                              ? ACCENT + '12'
                              : isActive
                                ? HOVER
                                : 'transparent',
                            transition: 'background .08s',
                            borderLeft: isSelected ? `2px solid ${ACCENT}` : '2px solid transparent',
                          }}
                        >
                          {/* Code badge */}
                          <span style={{
                            fontWeight: 700,
                            fontSize: 12,
                            color: isSelected ? ACCENT : T,
                            fontVariantNumeric: 'tabular-nums',
                            minWidth: 42,
                            flexShrink: 0,
                            fontFamily: 'ui-monospace, monospace',
                          }}>
                            {entry.code}
                          </span>

                          {/* Title */}
                          <span style={{
                            flex: 1,
                            fontSize: 13,
                            color: isSelected ? ACCENT : T,
                            fontWeight: isSelected ? 600 : 400,
                            lineHeight: 1.4,
                          }}>
                            {highlightMatch(entry.title, query)}
                          </span>

                          {/* Level chip */}
                          <span style={{
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '.05em',
                            color: '#fff',
                            background: levelColor[entry.level] || GRY,
                            borderRadius: 4,
                            padding: '1px 5px',
                            flexShrink: 0,
                            alignSelf: 'center',
                            opacity: 0.85,
                          }}>
                            {levelLabel[entry.level] || `L${entry.level}`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer hint */}
          {results.length > 0 && (
            <div style={{
              padding: '5px 12px',
              borderTop: `1px solid ${BORDER}`,
              fontSize: 10,
              color: GRY,
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
              <span>↑↓ navigate · ↵ select · esc close</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSectorName(code) {
  // Map 2-digit prefix to sector name
  const SECTOR_NAMES = {
    '11': 'Agriculture, Forestry, Fishing & Hunting',
    '21': 'Mining, Quarrying & Oil and Gas',
    '22': 'Utilities',
    '23': 'Construction',
    '31': 'Manufacturing',
    '32': 'Manufacturing',
    '33': 'Manufacturing',
    '42': 'Wholesale Trade',
    '44': 'Retail Trade',
    '45': 'Retail Trade',
    '48': 'Transportation & Warehousing',
    '49': 'Transportation & Warehousing',
    '51': 'Information',
    '52': 'Finance & Insurance',
    '53': 'Real Estate & Rental',
    '54': 'Professional & Technical Services',
    '55': 'Management of Companies',
    '56': 'Administrative & Support Services',
    '61': 'Educational Services',
    '62': 'Health Care & Social Assistance',
    '71': 'Arts, Entertainment & Recreation',
    '72': 'Accommodation & Food Services',
    '81': 'Other Services',
    '92': 'Public Administration',
  }
  const prefix = String(code).slice(0, 2)
  return SECTOR_NAMES[prefix] || `Sector ${prefix}`
}

function groupBySector(entries) {
  const map = new Map()
  for (const entry of entries) {
    const sector = getSectorName(entry.code)
    if (!map.has(sector)) map.set(sector, [])
    map.get(sector).push(entry)
  }
  return Array.from(map.entries()).map(([sector, entries]) => ({ sector, entries }))
}

function highlightMatch(text, query) {
  if (!query || !query.trim()) return text
  const q = query.trim()
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#fef08a', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}
