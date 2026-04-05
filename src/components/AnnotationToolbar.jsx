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
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
      <div className="flex items-center gap-1">
        {visibleTools.map(t => {
          const Icon = t.icon
          const isActive = tool === t.key
          return (
            <button key={t.key} title={t.label} onClick={() => setTool(t.key)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                isActive
                  ? t.color ? 'bg-green-50 text-green-600 ring-1 ring-green-300' : 'bg-brand-50 text-brand-600 ring-1 ring-brand-300'
                  : t.color ? 'text-green-500 hover:bg-green-50 hover:text-green-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
              }`}>
              <Icon size={15} />
            </button>
          )
        })}
      </div>

      <div className="w-px h-5 bg-gray-200" />

      {/* Full color picker */}
      <ColorPicker mode="inline" value={color} onChange={setColor} />

      <div className="w-px h-5 bg-gray-200" />

      <div className="flex items-center gap-1">
        <button title="Undo last (Ctrl+Z)" onClick={onUndo} disabled={!annotationCount}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 transition-colors">
          <Undo2 size={14} />
        </button>
        <button title="Clear all annotations" onClick={onClearAll} disabled={!annotationCount}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="ml-auto text-[13px] text-gray-400 hidden lg:flex items-center gap-3">
        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">V = scroll &middot; C/A/O/R/F = draw &middot; G = approve &middot; H = link</span>
      </div>
    </div>
  )
}
