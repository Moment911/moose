"use client";
import { MousePointer2, Pin, ArrowUpRight, Circle, Square, PenLine, Undo2, Trash2, Link, CheckCircle } from 'lucide-react'
import ColorPicker from './ColorPicker'

const TOOLS = [
  { key: 'select', icon: MousePointer2, label: 'Select (V)' },
  { key: 'pin', icon: Pin, label: 'Comment pin (C)' },
  { key: 'arrow', icon: ArrowUpRight, label: 'Arrow (A)' },
  { key: 'circle', icon: Circle, label: 'Circle (O)' },
  { key: 'rect', icon: Square, label: 'Rectangle (R)' },
  { key: 'freehand', icon: PenLine, label: 'Freehand (F)' },
  { key: 'hotspot', icon: Link, label: 'Link hotspot (H)' },
  { key: 'approve', icon: CheckCircle, label: 'Approve stamp (G)', color: '#22c55e' },
]

const CLIENT_TOOLS = ['select', 'pin', 'arrow', 'circle', 'rect']

export default function AnnotationToolbar({ tool, setTool, color, setColor, onUndo, onClearAll, annotationCount, clientMode = false }) {
  const visibleTools = clientMode ? TOOLS.filter(t => CLIENT_TOOLS.includes(t.key)) : TOOLS
  return (
    <div style={{ background: '#1a1a1a', borderBottom: '1px solid #333', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {visibleTools.map(t => {
          const Icon = t.icon
          const isActive = tool === t.key
          return (
            <button key={t.key} title={t.label} onClick={() => setTool(t.key)}
              style={{
                width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', transition: 'all .15s',
                background: isActive ? (t.color || '#E6007E') + '20' : 'transparent',
                color: isActive ? (t.color || '#E6007E') : '#9ca3af',
                outline: isActive ? `2px solid ${t.color || '#E6007E'}40` : 'none',
              }}>
              <Icon size={20} />
            </button>
          )
        })}
      </div>

      <div style={{ width: 1, height: 24, background: '#333' }} />

      <ColorPicker mode="inline" value={color} onChange={setColor} />

      <div style={{ width: 1, height: 24, background: '#333' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button title="Undo last (Ctrl+Z)" onClick={onUndo} disabled={!annotationCount}
          style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', background: 'transparent', color: annotationCount ? '#9ca3af' : '#444', opacity: annotationCount ? 1 : 0.4 }}>
          <Undo2 size={18} />
        </button>
        <button title="Clear all annotations" onClick={onClearAll} disabled={!annotationCount}
          style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', background: 'transparent', color: annotationCount ? '#ef4444' : '#444', opacity: annotationCount ? 1 : 0.4 }}>
          <Trash2 size={18} />
        </button>
      </div>

      <div style={{ marginLeft: 'auto', fontSize: 13, color: '#666', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ background: '#2a2a2a', color: '#999', padding: '4px 10px', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>V = scroll · C/A/O/R/F = draw · G = approve · H = link</span>
      </div>
    </div>
  )
}
