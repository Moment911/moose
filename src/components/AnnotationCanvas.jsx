"use client";
import { useEffect, useRef, useState } from 'react'

const COLORS = ['#ea2729', '#185FA5', '#3B6D11', '#A32D2D', '#7C3ABF', '#0E7490']

const TOOL_CURSOR = {
  select: 'default',
  pin: 'crosshair',
  arrow: 'crosshair',
  circle: 'crosshair',
  rect: 'crosshair',
  freehand: 'crosshair',
  approve: 'crosshair',
}

export default function AnnotationCanvas({
  width,
  height,
  tool,
  color,
  annotations,
  onAddAnnotation,
  onPinPlace,
  onApprove,
  onSelectAnnotation,
  onHotspotClick,
  selectedId,
  readOnly = false,
}) {
  const svgRef = useRef(null)
  const [drawing, setDrawing] = useState(null)
  const [hovered, setHovered] = useState(null)

  useEffect(() => { setDrawing(null) }, [tool])

  function getPos(e) {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (width / rect.width),
      y: (e.clientY - rect.top) * (height / rect.height),
    }
  }

  function handleMouseDown(e) {
    if (readOnly || tool === 'select') return
    e.stopPropagation()
    e.preventDefault()
    const pos = getPos(e)
    if (tool === 'pin') {
      onPinPlace({ type: 'pin', x: pos.x, y: pos.y, color })
      return
    }
    if (tool === 'approve') {
      onApprove?.({ type: 'approve', x: pos.x, y: pos.y, color: '#22c55e' })
      return
    }
    setDrawing({ type: tool, start: pos, end: pos, color, points: [pos] })
  }

  function handleMouseMove(e) {
    if (!drawing) return
    const pos = getPos(e)
    setDrawing(d => d
      ? { ...d, end: pos, points: [...(d.points || [d.start]), pos] }
      : null
    )
  }

  function handleMouseUp(e) {
    if (!drawing) return
    const pos = getPos(e)
    const { start, end, type, color, points } = { ...drawing, end: pos }
    const dx = Math.abs(end.x - start.x)
    const dy = Math.abs(end.y - start.y)
    if (dx < 5 && dy < 5 && type !== 'freehand') { setDrawing(null); return }

    const shape = buildShape({ type, start, end, color, points })
    onAddAnnotation(shape)
    setDrawing(null)
  }

  function buildShape({ type, start, end, color, points }) {
    if (type === 'arrow') return { type: 'arrow', x1: start.x, y1: start.y, x2: end.x, y2: end.y, color }
    if (type === 'hotspot') {
      return {
        type: 'hotspot',
        x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
        w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y),
        color: '#185FA5'
      }
    }
    if (type === 'circle') {
      const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2
      const rx = Math.abs(end.x - start.x) / 2, ry = Math.abs(end.y - start.y) / 2
      return { type: 'circle', cx, cy, rx, ry, color }
    }
    if (type === 'rect') {
      return {
        type: 'rect',
        x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
        w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y), color
      }
    }
    if (type === 'freehand') {
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      return { type: 'freehand', d, color }
    }
  }

  function renderDrawing() {
    if (!drawing) return null
    const { type, start, end, color, points } = drawing
    const commonStroke = { stroke: color, strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.85 }

    if (type === 'arrow') {
      return (
        <g>
          <defs>
            <marker id="arr-preview" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <polygon points="0 0,8 3,0 6" fill={color} />
            </marker>
          </defs>
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
            stroke={color} strokeWidth={2.5} strokeDasharray="6,4"
            markerEnd="url(#arr-preview)" />
        </g>
      )
    }
    if (type === 'circle') {
      const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2
      const rx = Math.abs(end.x - start.x) / 2, ry = Math.abs(end.y - start.y) / 2
      return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...commonStroke} strokeDasharray="6,4" />
    }
    if (type === 'rect') {
      return <rect x={Math.min(start.x, end.x)} y={Math.min(start.y, end.y)}
        width={Math.abs(end.x - start.x)} height={Math.abs(end.y - start.y)}
        {...commonStroke} rx={4} strokeDasharray="6,4" />
    }
    if (type === 'freehand' && points?.length > 1) {
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      return <path d={d} {...commonStroke} />
    }
    return null
  }

  function renderAnnotation(ann, idx) {
    const isSelected = ann.id === selectedId
    const isHovered = ann.id === hovered
    const c = ann.color || COLORS[0]
    const strokeW = isSelected ? 3 : 2.5
    const opacity = isSelected ? 1 : isHovered ? 0.9 : 0.75

    const commonProps = {
      onMouseDown: (e) => {
        e.stopPropagation()
        if (readOnly && ann.type === 'hotspot' && ann.targetFileId) {
          onHotspotClick?.(ann.targetFileId)
          return
        }
        onSelectAnnotation(ann)
      },
      onClick: (e) => { e.stopPropagation() },
      onMouseEnter: () => setHovered(ann.id),
      onMouseLeave: () => setHovered(null),
      style: {
        cursor: (readOnly && ann.type === 'hotspot' && ann.targetFileId) ? 'pointer' : readOnly ? 'default' : 'pointer',
        pointerEvents: 'auto',
      },
    }

    if (ann.type === 'hotspot') {
      const linked = !!ann.targetFileId
      return (
        <g key={ann.id} {...commonProps}>
          <rect
            x={ann.x} y={ann.y} width={ann.w} height={ann.h} rx={4}
            fill={linked ? 'rgba(24,95,165,0.12)' : 'rgba(24,95,165,0.06)'}
            stroke={linked ? '#185FA5' : '#94a3b8'}
            strokeWidth={isSelected ? 2.5 : 1.5}
            strokeDasharray={linked ? 'none' : '5,3'}
          />
          <rect x={ann.x + ann.w - 56} y={ann.y + 4} width={52} height={18} rx={9} fill={linked ? '#185FA5' : '#94a3b8'} />
          <text x={ann.x + ann.w - 30} y={ann.y + 16} textAnchor="middle" fill="white" fontSize={9} fontWeight="600">
            {linked ? `→ ${ann.targetFileName?.split('.')[0]?.substring(0, 8) || 'Page'}` : '+ Link'}
          </text>
          {ann.label && (
            <text x={ann.x + 6} y={ann.y + 15} fill="#185FA5" fontSize={10} fontWeight="500">{ann.label}</text>
          )}
        </g>
      )
    }

    if (ann.type === 'approve') {
      return (
        <g key={ann.id} {...commonProps} transform={`translate(${ann.x}, ${ann.y})`}>
          <circle cx={0} cy={0} r={isSelected ? 16 : 14} fill="#22c55e" opacity={opacity}
            stroke={isSelected ? 'white' : 'rgba(0,0,0,0.1)'} strokeWidth={isSelected ? 2 : 1}
            filter={isSelected ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))'} />
          <path d="M-5 0L-1.5 3.5L5.5-3.5" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    }

    if (ann.type === 'pin') {
      const num = annotations.filter(a => a.type === 'pin').findIndex(a => a.id === ann.id) + 1
      return (
        <g key={ann.id} {...commonProps} transform={`translate(${ann.x}, ${ann.y})`}>
          <circle cx={0} cy={0} r={isSelected ? 14 : 12} fill={c} opacity={opacity}
            stroke={isSelected ? 'white' : 'rgba(0,0,0,0.15)'} strokeWidth={isSelected ? 2 : 1}
            filter={isSelected ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))'} />
          <text x={0} y={4} textAnchor="middle" fill="white" fontSize={10} fontWeight="700">{num}</text>
        </g>
      )
    }

    if (ann.type === 'arrow') {
      const id = `arr-${ann.id}`
      return (
        <g key={ann.id} {...commonProps} opacity={opacity}>
          <defs>
            <marker id={id} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <polygon points="0 0,8 3,0 6" fill={c} />
            </marker>
          </defs>
          <line x1={ann.x1} y1={ann.y1} x2={ann.x2} y2={ann.y2}
            stroke={c} strokeWidth={strokeW} markerEnd={`url(#${id})`}
            strokeLinecap="round" />
          <line x1={ann.x1} y1={ann.y1} x2={ann.x2} y2={ann.y2}
            stroke="transparent" strokeWidth={16} />
        </g>
      )
    }

    if (ann.type === 'circle') {
      return (
        <g key={ann.id} {...commonProps} opacity={opacity}>
          <ellipse cx={ann.cx} cy={ann.cy} rx={ann.rx} ry={ann.ry}
            fill="none" stroke={c} strokeWidth={strokeW} strokeLinecap="round"
            filter={isSelected ? `drop-shadow(0 0 4px ${c}88)` : ''} />
          <ellipse cx={ann.cx} cy={ann.cy} rx={ann.rx} ry={ann.ry} fill="transparent" stroke="transparent" strokeWidth={16} />
        </g>
      )
    }

    if (ann.type === 'rect') {
      return (
        <g key={ann.id} {...commonProps} opacity={opacity}>
          <rect x={ann.x} y={ann.y} width={ann.w} height={ann.h} rx={3}
            fill={`${c}18`} stroke={c} strokeWidth={strokeW}
            filter={isSelected ? `drop-shadow(0 0 4px ${c}88)` : ''} />
        </g>
      )
    }

    if (ann.type === 'freehand') {
      return (
        <g key={ann.id} {...commonProps} opacity={opacity}>
          <path d={ann.d} fill="none" stroke={c} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
          <path d={ann.d} fill="none" stroke="transparent" strokeWidth={16} />
        </g>
      )
    }

    return null
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute', top: 0, left: 0,
        cursor: readOnly ? 'default' : TOOL_CURSOR[tool] || 'default',
        userSelect: 'none',
        pointerEvents: tool === 'select' ? 'none' : 'auto',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {annotations.map((ann, i) => renderAnnotation(ann, i))}
      {renderDrawing()}
    </svg>
  )
}
