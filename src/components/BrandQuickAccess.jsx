import { useState, useEffect, useRef } from 'react'
import { Palette, X, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function BrandQuickAccess() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [brands, setBrands] = useState([])
  const [copied, setCopied] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!user) return
    supabase.from('brand_guidelines').select('*, clients(name)').then(({ data }) => {
      setBrands((data || []).filter(b => b.primary_colors?.length || b.fonts?.length || b.logo_files?.length))
    }).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!open) return
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close)
  }, [open])

  function copy(text, label) {
    navigator.clipboard.writeText(text); setCopied(label)
    setTimeout(() => setCopied(null), 1500)
    toast.success('Copied!', { duration: 1000 })
  }

  if (!user || brands.length === 0) return null

  return (
    <div className="fixed bottom-6 left-64 z-40" ref={ref}>
      {/* Toggle button */}
      <button onClick={() => setOpen(!open)}
        className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${open ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:shadow-xl'}`}
        title="Brand Assets">
        <Palette size={16} strokeWidth={1.5} />
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute bottom-14 left-0 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden" style={{ maxHeight: 400 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Brand Assets</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
            {brands.map((ba, bi) => (
              <div key={bi} className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-700 mb-2">{ba.clients?.name || 'Client'}</p>

                {/* Colors */}
                {(ba.primary_colors || []).length > 0 && (
                  <div className="mb-3">
                    <p className="text-[9px] text-gray-400 uppercase font-semibold mb-1.5">Colors</p>
                    <div className="space-y-1">
                      {(ba.primary_colors || []).map((c, ci) => (
                        <button key={ci} onClick={() => copy(c.hex, `color-${bi}-${ci}`)}
                          className="w-full flex items-center gap-2 text-left hover:bg-gray-50 rounded-lg px-1.5 py-1 transition-colors group">
                          <div className="w-6 h-6 rounded border border-gray-200" style={{ background: c.hex }} />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-gray-700 block truncate">{c.name}</span>
                            <span className="text-[9px] text-gray-400 font-mono">{c.hex}</span>
                          </div>
                          {copied === `color-${bi}-${ci}` ? <Check size={10} className="text-green-500" /> : <Copy size={10} className="text-gray-300 opacity-0 group-hover:opacity-100" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fonts */}
                {(ba.fonts || []).length > 0 && (
                  <div className="mb-3">
                    <p className="text-[9px] text-gray-400 uppercase font-semibold mb-1.5">Fonts</p>
                    {(ba.fonts || []).map((f, fi) => (
                      <button key={fi} onClick={() => copy(f.name, `font-${bi}-${fi}`)}
                        className="w-full flex items-center justify-between text-left hover:bg-gray-50 rounded-lg px-1.5 py-1 transition-colors group">
                        <div>
                          <span className="text-xs text-gray-700" style={{ fontFamily: f.name }}>{f.name}</span>
                          <span className="text-[9px] text-gray-400 ml-1">({f.category})</span>
                        </div>
                        {copied === `font-${bi}-${fi}` ? <Check size={10} className="text-green-500" /> : <Copy size={10} className="text-gray-300 opacity-0 group-hover:opacity-100" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Logos */}
                {(ba.logo_files || []).length > 0 && (
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase font-semibold mb-1.5">Logos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(ba.logo_files || []).map((logo, li) => (
                        <button key={li} onClick={() => copy(logo.url, `logo-${bi}-${li}`)} title={`${logo.name} — click to copy URL`}
                          className="w-12 h-12 rounded-lg border border-gray-200 bg-white p-1 hover:border-brand-400 transition-all cursor-pointer">
                          <img src={logo.url} alt="" className="w-full h-full object-contain" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
