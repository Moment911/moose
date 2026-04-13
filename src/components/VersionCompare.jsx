"use client"
import { useState } from 'react'

const MODES = ['side-by-side', 'slider']

export default function VersionCompare({ fileA, fileB, onClose }) {
  const [mode, setMode] = useState('side-by-side')
  const [sliderPos, setSliderPos] = useState(50)

  const isImageA = fileA?.type?.startsWith('image/')
  const isImageB = fileB?.type?.startsWith('image/')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.9)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#1a1a1a', borderBottom: '1px solid #333', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Compare Versions</span>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>v{fileA?.version_number || 1} vs v{fileB?.version_number || 2}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {MODES.map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: mode === m ? '#E6007E' : '#333', color: '#fff', fontSize: 13, fontWeight: 600,
              textTransform: 'capitalize',
            }}>{m.replace('-', ' ')}</button>
          ))}
          <button onClick={onClose} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #555', background: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', marginLeft: 16 }}>Close</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {mode === 'side-by-side' && (
          <>
            <div style={{ flex: 1, overflow: 'auto', borderRight: '2px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20 }}>
              <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>v{fileA?.version_number || 1} (Previous)</div>
              {isImageA ? <img src={fileA.url} alt="v1" style={{ maxWidth: '100%', height: 'auto' }} /> : <iframe src={fileA?.url} title="v1" style={{ width: '100%', height: '100%', border: 'none' }} />}
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20 }}>
              <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>v{fileB?.version_number || 2} (Current)</div>
              {isImageB ? <img src={fileB.url} alt="v2" style={{ maxWidth: '100%', height: 'auto' }} /> : <iframe src={fileB?.url} title="v2" style={{ width: '100%', height: '100%', border: 'none' }} />}
            </div>
          </>
        )}
        {mode === 'slider' && isImageA && isImageB && (
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={fileB.url} alt="v2" style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${sliderPos}%`, overflow: 'hidden' }}>
              <img src={fileA.url} alt="v1" style={{ maxWidth: 'none', width: `${100 / sliderPos * 100}%`, maxHeight: '100%', display: 'block' }} />
            </div>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: 3, background: '#E6007E', cursor: 'ew-resize', zIndex: 10 }}
              onMouseDown={e => {
                const container = e.currentTarget.parentElement
                const rect = container.getBoundingClientRect()
                const onMove = ev => { setSliderPos(Math.max(5, Math.min(95, ((ev.clientX - rect.left) / rect.width) * 100))) }
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
                document.addEventListener('mousemove', onMove)
                document.addEventListener('mouseup', onUp)
              }}
            />
            <input type="range" min={5} max={95} value={sliderPos} onChange={e => setSliderPos(Number(e.target.value))} style={{ position: 'absolute', bottom: 20, left: '20%', width: '60%', zIndex: 20 }} />
          </div>
        )}
        {mode === 'slider' && (!isImageA || !isImageB) && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 15 }}>
            Slider mode only works with image files. Switch to side-by-side for PDFs and HTML.
          </div>
        )}
      </div>
    </div>
  )
}
