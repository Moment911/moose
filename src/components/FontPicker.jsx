"use client";
import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search } from 'lucide-react'

const WEB_SAFE = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Impact', 'Comic Sans MS']

const POPULAR_GOOGLE = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway', 'Nunito',
  'Playfair Display', 'Merriweather', 'Source Sans 3', 'PT Sans', 'Oswald', 'Noto Sans',
  'Ubuntu', 'Rubik', 'Work Sans', 'Quicksand', 'Libre Baskerville', 'Bebas Neue',
  'Archivo', 'DM Sans', 'Outfit', 'Space Grotesk', 'Sora', 'Manrope', 'Lexend',
  'Plus Jakarta Sans', 'Crimson Text', 'Fira Sans',
]

const loaded = new Set()

function loadFont(family) {
  if (loaded.has(family) || WEB_SAFE.includes(family)) return
  loaded.add(family)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`
  document.head.appendChild(link)
}

export default function FontPicker({ value = 'Inter', onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => { loadFont(value) }, [value])

  useEffect(() => {
    if (!open) return
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const allFonts = [...WEB_SAFE, ...POPULAR_GOOGLE.filter(f => !WEB_SAFE.includes(f))]
  const filtered = search ? allFonts.filter(f => f.toLowerCase().includes(search.toLowerCase())) : allFonts

  function selectFont(f) {
    loadFont(f); onChange(f); setOpen(false); setSearch('')
  }

  return (
    <div className="relative" ref={ref}>
      <label className="text-[13px] text-gray-500 mb-1 block">Font</label>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white hover:bg-gray-50 transition-colors text-left"
        style={{ fontFamily: value }}>
        <span className="truncate">{value}</span>
        <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
              <Search size={12} className="text-gray-400" />
              <input className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400" placeholder="Search fonts..."
                value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No fonts found</p>}
            {!search && <p className="text-[13px] text-gray-400 uppercase px-3 pt-2 pb-1 font-semibold">Web Safe</p>}
            {filtered.filter(f => WEB_SAFE.includes(f)).map(f => (
              <button key={f} onClick={() => selectFont(f)}
                onMouseEnter={() => loadFont(f)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors ${value === f ? 'bg-brand-50 text-brand-700' : 'text-gray-700'}`}
                style={{ fontFamily: f }}>{f}</button>
            ))}
            {!search && <p className="text-[13px] text-gray-400 uppercase px-3 pt-2 pb-1 font-semibold">Google Fonts</p>}
            {filtered.filter(f => !WEB_SAFE.includes(f)).map(f => (
              <button key={f} onClick={() => selectFont(f)}
                onMouseEnter={() => loadFont(f)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors ${value === f ? 'bg-brand-50 text-brand-700' : 'text-gray-700'}`}
                style={{ fontFamily: f }}>{f}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
