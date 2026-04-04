"use client";
"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2, Copy, Check, Download, Upload, Share2, Palette, Type, Image as ImageIcon, MessageSquare, BookOpen, Star, X } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ColorPicker from '../components/ColorPicker'
import { supabase, uploadFile } from '../lib/supabase'
import { hexToRgb, rgbToCmyk } from '../lib/colorUtils'
import toast from 'react-hot-toast'

const CATEGORIES = ['Primary', 'Secondary', 'Accent', 'Neutral', 'Background']
const SECTIONS = [
  { id: 'colors', label: 'Colors', icon: Palette },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'logos', label: 'Logos', icon: ImageIcon },
  { id: 'voice', label: 'Voice & Tone', icon: MessageSquare },
  { id: 'story', label: 'Brand Story', icon: BookOpen },
]

function loadFont(name) {
  if (!name || document.querySelector(`link[data-font="${name}"]`)) return
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.dataset.font = name
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@100;300;400;500;600;700;900&display=swap`
  document.head.appendChild(link)
}

export default function BrandGuidelinesPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [brand, setBrand] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('colors')
  const [copied, setCopied] = useState(null)
  const [showAddColor, setShowAddColor] = useState(false)
  const [newColor, setNewColor] = useState('#ea2729')
  const [newColorName, setNewColorName] = useState('')
  const [newColorCat, setNewColorCat] = useState('Primary')
  const [showAddFont, setShowAddFont] = useState(false)
  const [newFontName, setNewFontName] = useState('Inter')
  const [newFontCat, setNewFontCat] = useState('Primary')
  const [newFontUsage, setNewFontUsage] = useState('Headings and body text')
  const logoInputRef = useRef(null)
  const saveTimer = useRef(null)

  useEffect(() => { loadBrand() }, [clientId])

  async function loadBrand() {
    setLoading(true)
    const { data: cl } = await supabase.from('clients').select('*').eq('id', clientId).single()
    setClient(cl)
    let { data: bg } = await supabase.from('brand_guidelines').select('*').eq('client_id', clientId).maybeSingle()
    if (!bg) {
      const { data: created } = await supabase.from('brand_guidelines').insert({ client_id: clientId }).select().single()
      bg = created
    }
    setBrand(bg)
    ;(bg?.fonts || []).forEach(f => loadFont(f.name))
    setLoading(false)
  }

  function autoSave(updates) {
    setBrand(prev => ({ ...prev, ...updates }))
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await supabase.from('brand_guidelines').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', brand.id)
      toast.success('Saved', { duration: 1000, style: { fontSize: '12px' } })
    }, 800)
  }

  function copyText(text, label) {
    navigator.clipboard.writeText(text); setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  // Colors
  function addColor() {
    if (!newColorName.trim()) { toast.error('Enter a color name'); return }
    const colors = [...(brand.primary_colors || []), { hex: newColor, name: newColorName, category: newColorCat }]
    autoSave({ primary_colors: colors }); setShowAddColor(false); setNewColorName('')
  }

  function deleteColor(idx) {
    const colors = (brand.primary_colors || []).filter((_, i) => i !== idx)
    autoSave({ primary_colors: colors })
  }

  // Fonts
  function addFont() {
    if (!newFontName.trim()) return
    loadFont(newFontName)
    const fonts = [...(brand.fonts || []), { name: newFontName, category: newFontCat, usage: newFontUsage }]
    autoSave({ fonts }); setShowAddFont(false); setNewFontName('Inter')
  }

  function deleteFont(idx) { autoSave({ fonts: (brand.fonts || []).filter((_, i) => i !== idx) }) }

  // Logos
  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]; if (!file) return
    toast.loading('Uploading...', { id: 'logo' })
    try {
      const path = `clients/${clientId}/logos/${crypto.randomUUID()}.${file.name.split('.').pop()}`
      const url = await uploadFile(file, path)
      const logos = [...(brand.logo_files || []), { url, name: file.name, type: file.type, size: file.size, category: 'primary' }]
      autoSave({ logo_files: logos })
      toast.success('Logo uploaded!', { id: 'logo' })
    } catch { toast.error('Upload failed', { id: 'logo' }) }
    e.target.value = ''
  }

  function deleteLogo(idx) { autoSave({ logo_files: (brand.logo_files || []).filter((_, i) => i !== idx) }) }

  // Do/Don't lists
  function addDo() { autoSave({ do_list: [...(brand.do_list || []), 'Click to edit'] }) }
  function addDont() { autoSave({ dont_list: [...(brand.dont_list || []), 'Click to edit'] }) }
  function updateDo(idx, val) { const list = [...(brand.do_list || [])]; list[idx] = val; autoSave({ do_list: list }) }
  function updateDont(idx, val) { const list = [...(brand.dont_list || [])]; list[idx] = val; autoSave({ dont_list: list }) }
  function removeDo(idx) { autoSave({ do_list: (brand.do_list || []).filter((_, i) => i !== idx) }) }
  function removeDont(idx) { autoSave({ dont_list: (brand.dont_list || []).filter((_, i) => i !== idx) }) }

  // Share
  function copyShareLink() {
    copyText(`${window.location.origin}/brand/view/${clientId}/${brand?.share_token}`, 'share')
    toast.success('Share link copied!')
  }

  // Export
  function exportBrandKit() {
    const colors = (brand?.primary_colors || [])
    const css = `:root {\n${colors.map(c => `  --color-${c.name.toLowerCase().replace(/\s+/g, '-')}: ${c.hex};`).join('\n')}\n}`
    const json = JSON.stringify({ colors: colors.map(c => ({ name: c.name, hex: c.hex, category: c.category })), fonts: brand?.fonts || [], tagline: brand?.tagline || '' }, null, 2)

    const downloadFile = (content, name, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click() }
    downloadFile(css, 'brand-colors.css', 'text/css')
    setTimeout(() => downloadFile(json, 'brand-tokens.json', 'application/json'), 300)
    toast.success('Brand kit exported!')
  }

  if (loading) return <div className="flex h-screen"><Sidebar activeClientId={clientId} /><div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div></div>

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeClientId={clientId} />
      <div className="flex-1 flex overflow-hidden">
        {/* Section nav */}
        <div className="w-52 bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="px-4 py-5 border-b border-gray-200">
            <button onClick={() => navigate(`/client/${clientId}`)} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-2"><ChevronLeft size={12} /> Back</button>
            <h2 className="text-base font-bold text-gray-900">{client?.name}</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Brand Guidelines</p>
          </div>
          <nav className="flex-1 py-3 px-2">
            {SECTIONS.map(s => { const I = s.icon; return (
              <button key={s.id} onClick={() => { setActiveSection(s.id); document.getElementById(`brand-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${activeSection === s.id ? 'bg-white text-gray-900 shadow-sm border border-gray-200 font-medium' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}>
                <I size={14} strokeWidth={1.5} className={activeSection === s.id ? 'text-brand-500' : 'text-gray-400'} /> {s.label}
              </button>
            )})}
          </nav>
          <div className="p-3 border-t border-gray-200 space-y-1.5">
            <button onClick={copyShareLink} className="w-full btn-secondary text-xs justify-center"><Share2 size={12} strokeWidth={1.5} /> Share</button>
            <button onClick={exportBrandKit} className="w-full btn-primary text-xs justify-center"><Download size={12} strokeWidth={1.5} /> Export Kit</button>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-white p-8">
          <div className="max-w-4xl mx-auto space-y-12">

            {/* COLORS */}
            <section id="brand-colors">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Palette size={20} strokeWidth={1.5} className="text-brand-500" /> Color Palette</h2>
                <button onClick={() => setShowAddColor(true)} className="btn-secondary text-xs"><Plus size={12} /> Add Color</button>
              </div>

              {showAddColor && (
                <div className="card p-5 mb-4">
                  <div className="flex gap-4 items-end">
                    <div className="w-32"><ColorPicker value={newColor} onChange={setNewColor} label="Color" /></div>
                    <div className="flex-1"><label className="text-xs text-gray-500 block mb-1">Name</label><input className="input text-sm" placeholder="Brand Orange" value={newColorName} onChange={e => setNewColorName(e.target.value)} /></div>
                    <div className="w-32"><label className="text-xs text-gray-500 block mb-1">Category</label><select className="input text-sm" value={newColorCat} onChange={e => setNewColorCat(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                    <button onClick={addColor} className="btn-primary text-sm h-[38px]">Add</button>
                    <button onClick={() => setShowAddColor(false)} className="btn-secondary text-sm h-[38px]">Cancel</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                {(brand?.primary_colors || []).map((c, i) => {
                  const rgb = hexToRgb(c.hex); const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b)
                  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
                  const contrastWhite = (luminance + 0.05) / 0.05; const contrastBlack = 1.05 / (luminance + 0.05)
                  const wcagWhite = contrastWhite >= 7 ? 'AAA' : contrastWhite >= 4.5 ? 'AA' : 'Fail'
                  return (
                    <div key={i} className="card overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-0.5">
                      <div className="h-32 relative cursor-pointer" style={{ background: c.hex }} onClick={() => { copyText(c.hex, `color-${i}`); toast.success(`${c.hex} copied!`) }}>
                        <span className={`absolute bottom-2 left-3 text-xs font-mono font-medium ${luminance > 0.5 ? 'text-gray-900' : 'text-white'}`}>{c.hex}</span>
                        <span className={`absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${wcagWhite === 'AAA' ? 'bg-green-500 text-white' : wcagWhite === 'AA' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}`}>
                          {wcagWhite} on white
                        </span>
                        <button onClick={e => { e.stopPropagation(); deleteColor(i) }} className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 w-6 h-6 bg-white/80 rounded flex items-center justify-center text-brand-500"><Trash2 size={11} /></button>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">{c.category}</span>
                        </div>
                        <div className="space-y-0.5 text-[10px] text-gray-400 font-mono">
                          <div className="flex justify-between"><span>RGB</span><span className="cursor-pointer hover:text-gray-700" onClick={() => copyText(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, `rgb-${i}`)}>{rgb.r}, {rgb.g}, {rgb.b} {copied === `rgb-${i}` ? '✓' : ''}</span></div>
                          <div className="flex justify-between"><span>CMYK</span><span>{cmyk.c}, {cmyk.m}, {cmyk.y}, {cmyk.k}</span></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {(brand?.primary_colors || []).length === 0 && <div className="col-span-3 py-12 text-center text-sm text-gray-400">No colors yet. Click "Add Color" to start building your palette.</div>}
              </div>
            </section>

            {/* TYPOGRAPHY */}
            <section id="brand-typography">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Type size={20} strokeWidth={1.5} className="text-brand-500" /> Typography</h2>
                <button onClick={() => setShowAddFont(true)} className="btn-secondary text-xs"><Plus size={12} /> Add Font</button>
              </div>

              {showAddFont && (
                <div className="card p-5 mb-4">
                  <div className="flex gap-3 items-end">
                    <div className="flex-1"><label className="text-xs text-gray-500 block mb-1">Font Name (Google Fonts)</label><input className="input text-sm" value={newFontName} onChange={e => setNewFontName(e.target.value)} /></div>
                    <div className="w-28"><label className="text-xs text-gray-500 block mb-1">Category</label><select className="input text-sm" value={newFontCat} onChange={e => setNewFontCat(e.target.value)}><option>Primary</option><option>Secondary</option><option>Monospace</option></select></div>
                    <div className="flex-1"><label className="text-xs text-gray-500 block mb-1">Usage</label><input className="input text-sm" value={newFontUsage} onChange={e => setNewFontUsage(e.target.value)} /></div>
                    <button onClick={addFont} className="btn-primary text-sm h-[38px]">Add</button>
                    <button onClick={() => setShowAddFont(false)} className="btn-secondary text-sm h-[38px]">Cancel</button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {(brand?.fonts || []).map((f, i) => {
                  loadFont(f.name)
                  return (
                    <div key={i} className="card p-6 group hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{f.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{f.category}</span>
                            <span className="text-xs text-gray-400">{f.usage}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <button onClick={() => { copyText(`@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.name)}:wght@400;700&display=swap');`, 'css'); toast.success('CSS import copied!') }} className="text-xs text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100"><Copy size={12} /></button>
                          <button onClick={() => deleteFont(i)} className="text-xs text-gray-400 hover:text-brand-500 p-1 rounded hover:bg-brand-50"><Trash2 size={12} /></button>
                        </div>
                      </div>
                      <div style={{ fontFamily: `'${f.name}', sans-serif` }}>
                        <p className="text-5xl text-gray-900 mb-2" style={{ fontWeight: 700 }}>Aa Bb Cc</p>
                        <p className="text-xl text-gray-600 mb-2">The quick brown fox jumps over the lazy dog</p>
                        <p className="text-sm text-gray-400 font-mono tracking-wider">ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</p>
                      </div>
                      <div className="flex gap-3 mt-4 text-xs text-gray-400">
                        {[100, 300, 400, 500, 700, 900].map(w => <span key={w} style={{ fontFamily: `'${f.name}'`, fontWeight: w }}>Aa <span className="text-[9px] text-gray-300">{w}</span></span>)}
                      </div>
                    </div>
                  )
                })}
                {(brand?.fonts || []).length === 0 && <div className="py-12 text-center text-sm text-gray-400">No fonts added. Click "Add Font" to add Google Fonts.</div>}
              </div>
            </section>

            {/* LOGOS */}
            <section id="brand-logos">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ImageIcon size={20} strokeWidth={1.5} className="text-brand-500" /> Logo Library</h2>
                <button onClick={() => logoInputRef.current?.click()} className="btn-secondary text-xs"><Upload size={12} /> Upload Logo</button>
                <input ref={logoInputRef} type="file" accept="image/*,.svg,.pdf" className="hidden" onChange={handleLogoUpload} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {(brand?.logo_files || []).map((logo, i) => (
                  <div key={i} className="card overflow-hidden group hover:shadow-lg transition-all">
                    <div className="h-32 flex items-center justify-center p-4" style={{ background: 'repeating-conic-gradient(#f3f4f6 0% 25%, white 0% 50%) 0 0 / 16px 16px' }}>
                      <img src={logo.url} alt={logo.name} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-900 truncate">{logo.name}</p>
                        <p className="text-[9px] text-gray-400">{logo.type} &middot; {logo.size ? `${(logo.size / 1024).toFixed(0)} KB` : ''}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                        <a href={logo.url} download className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><Download size={12} /></a>
                        <button onClick={() => deleteLogo(i)} className="p-1.5 rounded hover:bg-brand-50 text-gray-400 hover:text-brand-500"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                ))}
                {(brand?.logo_files || []).length === 0 && (
                  <div className="col-span-3 py-12 text-center border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-300" onClick={() => logoInputRef.current?.click()}>
                    <Upload size={24} strokeWidth={1.5} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Drag & drop logos here or click to upload</p>
                    <p className="text-xs text-gray-300 mt-1">SVG, PNG, PDF, EPS</p>
                  </div>
                )}
              </div>
            </section>

            {/* VOICE & TONE */}
            <section id="brand-voice">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4"><MessageSquare size={20} strokeWidth={1.5} className="text-brand-500" /> Voice & Tone</h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-green-700 flex items-center gap-1.5 mb-3"><Check size={14} strokeWidth={2} /> We are...</h3>
                  <div className="space-y-1.5">
                    {(brand?.do_list || []).map((item, i) => (
                      <div key={i} className="flex items-center gap-2 group">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                        <input className="flex-1 text-sm text-gray-700 bg-transparent border-none focus:outline-none focus:bg-gray-50 rounded px-1 py-0.5" value={item} onChange={e => updateDo(i, e.target.value)} />
                        <button onClick={() => removeDo(i)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-brand-500"><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addDo} className="text-xs text-green-600 hover:text-green-800 mt-2 flex items-center gap-1"><Plus size={10} /> Add</button>
                </div>

                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-brand-700 flex items-center gap-1.5 mb-3"><X size={14} strokeWidth={2} /> We are not...</h3>
                  <div className="space-y-1.5">
                    {(brand?.dont_list || []).map((item, i) => (
                      <div key={i} className="flex items-center gap-2 group">
                        <div className="w-1.5 h-1.5 bg-brand-500 rounded-full flex-shrink-0" />
                        <input className="flex-1 text-sm text-gray-700 bg-transparent border-none focus:outline-none focus:bg-gray-50 rounded px-1 py-0.5" value={item} onChange={e => updateDont(i, e.target.value)} />
                        <button onClick={() => removeDont(i)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-brand-500"><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addDont} className="text-xs text-brand-600 hover:text-brand-800 mt-2 flex items-center gap-1"><Plus size={10} /> Add</button>
                </div>
              </div>

              <div className="card p-5">
                <label className="text-sm font-semibold text-gray-900 mb-2 block">Tone of Voice</label>
                <textarea className="input text-sm resize-none w-full" rows={4} placeholder="Describe how your brand should sound... e.g. Warm, professional, and approachable. We speak plainly and avoid jargon."
                  value={brand?.tone_of_voice || ''} onChange={e => autoSave({ tone_of_voice: e.target.value })} />
              </div>
            </section>

            {/* BRAND STORY */}
            <section id="brand-story">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4"><BookOpen size={20} strokeWidth={1.5} className="text-brand-500" /> Brand Story</h2>

              <div className="card p-5 mb-4">
                <label className="text-sm font-semibold text-gray-900 mb-2 block">Tagline</label>
                <input className="w-full text-2xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:bg-gray-50 rounded px-2 py-1" placeholder="Your brand tagline..."
                  value={brand?.tagline || ''} onChange={e => autoSave({ tagline: e.target.value })}
                  style={{ fontFamily: (brand?.fonts || [])[0]?.name ? `'${brand.fonts[0].name}', sans-serif` : 'Inter, sans-serif' }} />
              </div>

              <div className="card p-5">
                <label className="text-sm font-semibold text-gray-900 mb-2 block">Brand Story</label>
                <textarea className="input text-sm resize-none w-full" rows={6} placeholder="Tell your brand's story... What's your mission? What do you stand for? Why do you exist?"
                  value={brand?.brand_story || ''} onChange={e => autoSave({ brand_story: e.target.value })} />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
