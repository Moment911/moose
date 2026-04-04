import { useState, useRef, useEffect, useCallback } from 'react'
import { Pipette } from 'lucide-react'
import { hexToRgb, rgbToHex, rgbToCmyk, cmykToHex, hsvToRgb, rgbToHsv } from '../lib/colorUtils'

const PRESETS = ['#ea2729', '#59c6d0', '#231f20', '#185FA5', '#3B6D11', '#7C3ABF', '#ffffff', '#f5f5f5', '#000000', '#f59e0b']

export default function ColorPicker({ value = '#000000', onChange, label, mode = 'field', presets = PRESETS }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('hex')
  const [hex, setHex] = useState(value)
  const [hsv, setHsv] = useState(() => { const { r, g, b } = hexToRgb(value); return rgbToHsv(r, g, b) })
  const popRef = useRef(null)
  const satRef = useRef(null)
  const dragging = useRef(false)

  useEffect(() => { setHex(value); const { r, g, b } = hexToRgb(value); setHsv(rgbToHsv(r, g, b)) }, [value])

  useEffect(() => {
    if (!open) return
    function close(e) { if (popRef.current && !popRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function applyHsv(h, s, v) {
    const { r, g, b } = hsvToRgb(h, s, v)
    const newHex = rgbToHex(r, g, b)
    setHsv({ h, s, v }); setHex(newHex); onChange(newHex)
  }

  function handleSatMouseDown(e) { dragging.current = true; updateSat(e) }
  function handleSatMouseMove(e) { if (dragging.current) updateSat(e) }
  function handleSatMouseUp() { dragging.current = false }

  function updateSat(e) {
    if (!satRef.current) return
    const rect = satRef.current.getBoundingClientRect()
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
    applyHsv(hsv.h, s, v)
  }

  function handleHueChange(e) { applyHsv(+e.target.value, hsv.s, hsv.v) }

  function handleHexInput(v) {
    const clean = v.startsWith('#') ? v : '#' + v
    setHex(clean)
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) { const { r, g, b } = hexToRgb(clean); setHsv(rgbToHsv(r, g, b)); onChange(clean) }
  }

  function handleRgbChange(field, val) {
    const { r, g, b } = hexToRgb(hex)
    const updated = { r, g, b, [field]: Math.max(0, Math.min(255, +val || 0)) }
    const newHex = rgbToHex(updated.r, updated.g, updated.b)
    setHex(newHex); setHsv(rgbToHsv(updated.r, updated.g, updated.b)); onChange(newHex)
  }

  function handleCmykChange(field, val) {
    const cmyk = { ...hexToCmykObj(hex), [field]: Math.max(0, Math.min(100, +val || 0)) }
    const newHex = cmykToHex(cmyk.c, cmyk.m, cmyk.y, cmyk.k)
    setHex(newHex); const { r, g, b } = hexToRgb(newHex); setHsv(rgbToHsv(r, g, b)); onChange(newHex)
  }

  function hexToCmykObj(h) { const { r, g, b } = hexToRgb(h); return rgbToCmyk(r, g, b) }

  async function handleEyedropper() {
    if (!window.EyeDropper) return
    try { const result = await new window.EyeDropper().open(); handleHexInput(result.sRGBHex) } catch {}
  }

  const rgb = hexToRgb(hex)
  const cmyk = hexToCmykObj(hex)
  const hueColor = rgbToHex(...Object.values(hsvToRgb(hsv.h, 1, 1)))

  const picker = (
    <div ref={popRef} className="bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-64 z-50" style={{ position: mode === 'inline' ? 'absolute' : undefined, top: mode === 'inline' ? '100%' : undefined, left: mode === 'inline' ? 0 : undefined, marginTop: mode === 'inline' ? 4 : 0 }}
      onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      {/* Saturation/Value area */}
      <div ref={satRef} className="w-full h-36 rounded-lg relative cursor-crosshair mb-2" style={{ background: `linear-gradient(to right, #fff, ${hueColor})` }}
        onMouseDown={handleSatMouseDown} onMouseMove={handleSatMouseMove} onMouseUp={handleSatMouseUp} onMouseLeave={handleSatMouseUp}>
        <div className="absolute inset-0 rounded-lg" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
        <div className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-md pointer-events-none" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, transform: 'translate(-50%,-50%)', background: hex }} />
      </div>

      {/* Hue slider */}
      <input type="range" min={0} max={360} value={Math.round(hsv.h)} onChange={handleHueChange}
        className="w-full h-2.5 rounded-full appearance-none mb-3 cursor-pointer"
        style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }} />

      {/* Presets */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {presets.map(c => (
          <button key={c} onClick={() => handleHexInput(c)} style={{ background: c }}
            className={`w-5 h-5 rounded-full border transition-all ${hex.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : c === '#ffffff' || c === '#f5f5f5' ? 'border-gray-300' : 'border-transparent'} hover:scale-110`} />
        ))}
        {window.EyeDropper && (
          <button onClick={handleEyedropper} className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100" title="Eyedropper"><Pipette size={10} className="text-gray-500" /></button>
        )}
      </div>

      {/* Format tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-2">
        {['hex', 'rgb', 'cmyk'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 text-[10px] py-1 rounded-md font-semibold uppercase transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{t}</button>
        ))}
      </div>

      {/* Format inputs */}
      {tab === 'hex' && (
        <input className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-brand-400"
          value={hex} onChange={e => handleHexInput(e.target.value)} />
      )}
      {tab === 'rgb' && (
        <div className="flex gap-1.5">
          {['r', 'g', 'b'].map(f => (
            <div key={f} className="flex-1">
              <label className="text-[9px] text-gray-400 uppercase block mb-0.5 text-center">{f}</label>
              <input className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-center font-mono focus:outline-none focus:ring-1 focus:ring-brand-400"
                type="number" min={0} max={255} value={rgb[f]} onChange={e => handleRgbChange(f, e.target.value)} />
            </div>
          ))}
        </div>
      )}
      {tab === 'cmyk' && (
        <div className="flex gap-1.5">
          {['c', 'm', 'y', 'k'].map(f => (
            <div key={f} className="flex-1">
              <label className="text-[9px] text-gray-400 uppercase block mb-0.5 text-center">{f}</label>
              <input className="w-full text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 text-center font-mono focus:outline-none focus:ring-1 focus:ring-brand-400"
                type="number" min={0} max={100} value={cmyk[f]} onChange={e => handleCmykChange(f, e.target.value)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (mode === 'inline') {
    return (
      <div className="relative">
        <button onClick={() => setOpen(!open)} style={{ background: value }} className="w-6 h-6 rounded-full border border-gray-300 shadow-sm hover:scale-110 transition-transform" />
        {open && picker}
      </div>
    )
  }

  return (
    <div>
      {label && <label className="text-[10px] text-gray-500 mb-1 block">{label}</label>}
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(!open)} style={{ background: value }} className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm flex-shrink-0 hover:scale-105 transition-transform" />
        <input className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-brand-400"
          value={hex} onChange={e => handleHexInput(e.target.value)} />
      </div>
      {open && <div className="mt-2">{picker}</div>}
    </div>
  )
}
