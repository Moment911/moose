"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getFiles } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import { ArrowLeft, ZoomIn, ZoomOut, Hand, MousePointer2, ArrowUpRight, Play, Plus, Trash2, Maximize2, FileImage, FileText, Globe } from 'lucide-react'
import toast from 'react-hot-toast'

const BG_DOT_COLOR = '#e5e7eb'
const CARD_W = 240
const CARD_H = 180

export default function ProofCanvasPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef(null)

  const [project, setProject] = useState(null)
  const [files, setFiles] = useState([])
  const [cards, setCards] = useState([]) // { id, fileId, x, y, w, h }
  const [connections, setConnections] = useState([]) // { id, fromId, toId, label }
  const [tool, setTool] = useState('select') // select, pan, connect
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(null) // { id, offsetX, offsetY }
  const [connecting, setConnecting] = useState(null) // { fromId, mouseX, mouseY }
  const [selectedCard, setSelectedCard] = useState(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [playMode, setPlayMode] = useState(false)
  const [activePlayCard, setActivePlayCard] = useState(null)

  // Load project + files
  useEffect(() => {
    if (!projectId) return
    ;(async () => {
      const { data: proj } = await supabase.from('projects').select('*, clients(name)').eq('id', projectId).single()
      setProject(proj)
      const { data: fileList } = await getFiles(projectId)
      setFiles(fileList || [])

      // Load saved canvas layout
      const { data: layout } = await supabase.from('projects').select('canvas_layout').eq('id', projectId).single()
      if (layout?.canvas_layout?.cards) {
        setCards(layout.canvas_layout.cards)
        setConnections(layout.canvas_layout.connections || [])
      } else {
        // Auto-layout files in a grid
        const autoCards = (fileList || []).map((f, i) => ({
          id: `card-${f.id}`,
          fileId: f.id,
          x: (i % 4) * (CARD_W + 40) + 60,
          y: Math.floor(i / 4) * (CARD_H + 60) + 60,
          w: CARD_W,
          h: CARD_H,
        }))
        setCards(autoCards)
      }
    })()
  }, [projectId])

  // Save layout
  const saveLayout = useCallback(async () => {
    await supabase.from('projects').update({
      canvas_layout: { cards, connections }
    }).eq('id', projectId)
    toast.success('Canvas saved')
  }, [cards, connections, projectId])

  // Get file for a card
  const getFile = (fileId) => files.find(f => f.id === fileId)

  // Mouse handlers
  function handleMouseDown(e) {
    if (e.target !== canvasRef.current && !e.target.closest('[data-canvas-bg]')) return

    if (tool === 'pan' || e.button === 1) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      return
    }

    setSelectedCard(null)
  }

  function handleMouseMove(e) {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
      return
    }

    if (dragging) {
      const rect = canvasRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left - pan.x) / zoom - dragging.offsetX
      const y = (e.clientY - rect.top - pan.y) / zoom - dragging.offsetY
      setCards(prev => prev.map(c => c.id === dragging.id ? { ...c, x, y } : c))
      return
    }

    if (connecting) {
      const rect = canvasRef.current.getBoundingClientRect()
      setConnecting(prev => prev ? {
        ...prev,
        mouseX: (e.clientX - rect.left - pan.x) / zoom,
        mouseY: (e.clientY - rect.top - pan.y) / zoom,
      } : null)
    }
  }

  function handleMouseUp() {
    setIsPanning(false)
    if (dragging) { setDragging(null); return }
    if (connecting) { setConnecting(null); return }
  }

  function handleCardMouseDown(card, e) {
    e.stopPropagation()

    if (playMode) {
      // In play mode, click navigates to connected card
      setActivePlayCard(card.id)
      return
    }

    if (tool === 'connect') {
      setConnecting({ fromId: card.id, mouseX: card.x + card.w / 2, mouseY: card.y + card.h / 2 })
      return
    }

    setSelectedCard(card.id)
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = (e.clientX - rect.left - pan.x) / zoom
    const my = (e.clientY - rect.top - pan.y) / zoom
    setDragging({ id: card.id, offsetX: mx - card.x, offsetY: my - card.y })
  }

  function handleCardMouseUp(card) {
    if (connecting && connecting.fromId !== card.id) {
      // Create connection
      const id = `conn-${Date.now()}`
      setConnections(prev => [...prev, { id, fromId: connecting.fromId, toId: card.id, label: '' }])
      setConnecting(null)
      toast.success('Connected!')
    }
  }

  function removeCard(cardId) {
    setCards(prev => prev.filter(c => c.id !== cardId))
    setConnections(prev => prev.filter(c => c.fromId !== cardId && c.toId !== cardId))
    setSelectedCard(null)
  }

  function removeConnection(connId) {
    setConnections(prev => prev.filter(c => c.id !== connId))
  }

  function handleWheel(e) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(z => Math.max(0.1, Math.min(3, z + delta)))
  }

  function addFile(file) {
    const existing = cards.find(c => c.fileId === file.id)
    if (existing) { toast.error('File already on canvas'); return }
    const id = `card-${file.id}`
    const maxX = cards.length > 0 ? Math.max(...cards.map(c => c.x + c.w)) + 40 : 60
    setCards(prev => [...prev, { id, fileId: file.id, x: maxX, y: 60, w: CARD_W, h: CARD_H }])
  }

  // Dot grid background
  const dotPattern = `radial-gradient(circle, ${BG_DOT_COLOR} 1px, transparent 1px)`
  const dotSize = 20 * zoom

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f9fafb' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
          <button onClick={() => navigate(`/project/${projectId}`)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, padding: '6px 8px', borderRadius: 6 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{project?.name || 'Canvas'}</span>
            <span style={{ fontSize: 13, color: '#9ca3af', marginLeft: 8 }}>Interactive Canvas</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Tool buttons */}
            {[
              { key: 'select', icon: MousePointer2, label: 'Select' },
              { key: 'pan', icon: Hand, label: 'Pan' },
              { key: 'connect', icon: ArrowUpRight, label: 'Connect' },
            ].map(t => (
              <button key={t.key} onClick={() => { setTool(t.key); setPlayMode(false) }}
                style={{
                  padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: tool === t.key && !playMode ? '#E6007E15' : '#f3f4f6',
                  color: tool === t.key && !playMode ? '#E6007E' : '#374151',
                  fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                }}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
            <div style={{ width: 1, height: 24, background: '#e5e7eb', margin: '0 4px' }} />
            <button onClick={() => { setPlayMode(!playMode); if (!playMode) setActivePlayCard(cards[0]?.id) }}
              style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: playMode ? '#16a34a' : '#f3f4f6',
                color: playMode ? '#fff' : '#374151',
                fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
              }}>
              <Play size={14} /> {playMode ? 'Exit Preview' : 'Preview Flow'}
            </button>
            <div style={{ width: 1, height: 24, background: '#e5e7eb', margin: '0 4px' }} />
            <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} style={{ padding: '6px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}><ZoomIn size={16} color="#374151" /></button>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.1, z - 0.2))} style={{ padding: '6px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}><ZoomOut size={16} color="#374151" /></button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} style={{ padding: '6px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}><Maximize2 size={16} color="#374151" /></button>
            <div style={{ width: 1, height: 24, background: '#e5e7eb', margin: '0 4px' }} />
            <button onClick={saveLayout} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Save</button>
          </div>
        </div>

        {/* Canvas area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* File list sidebar */}
          {!playMode && (
            <div style={{ width: 200, background: '#fff', borderRight: '1px solid #e5e7eb', overflowY: 'auto', padding: '12px 8px', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 8px', marginBottom: 8 }}>Project Files</div>
              {files.map(f => {
                const isImg = f.type?.startsWith('image/')
                const onCanvas = cards.some(c => c.fileId === f.id)
                return (
                  <button key={f.id} onClick={() => addFile(f)} disabled={onCanvas}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px', borderRadius: 8, border: 'none',
                      background: onCanvas ? '#f3f4f6' : '#fff',
                      cursor: onCanvas ? 'default' : 'pointer',
                      opacity: onCanvas ? 0.5 : 1,
                      textAlign: 'left', marginBottom: 4,
                    }}>
                    <div style={{ width: 36, height: 28, borderRadius: 4, overflow: 'hidden', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isImg ? <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FileText size={14} color="#9ca3af" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name?.replace(/\.[^.]+$/, '')}</div>
                    </div>
                    {!onCanvas && <Plus size={14} color="#9ca3af" />}
                  </button>
                )
              })}
            </div>
          )}

          {/* Infinite canvas */}
          <div
            ref={canvasRef}
            data-canvas-bg
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            style={{
              flex: 1, position: 'relative', overflow: 'hidden',
              cursor: tool === 'pan' || isPanning ? 'grab' : tool === 'connect' ? 'crosshair' : 'default',
              backgroundImage: dotPattern,
              backgroundSize: `${dotSize}px ${dotSize}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
              background: `${dotPattern}`,
              backgroundColor: '#fafafa',
            }}>

            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Connection arrows */}
                {connections.map(conn => {
                  const from = cards.find(c => c.id === conn.fromId)
                  const to = cards.find(c => c.id === conn.toId)
                  if (!from || !to) return null
                  const x1 = from.x + from.w / 2
                  const y1 = from.y + from.h
                  const x2 = to.x + to.w / 2
                  const y2 = to.y
                  const midY = (y1 + y2) / 2
                  return (
                    <g key={conn.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => removeConnection(conn.id)}>
                      <path d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                        fill="none" stroke="#E6007E" strokeWidth={2} strokeDasharray="6,4" />
                      <circle cx={x2} cy={y2} r={4} fill="#E6007E" />
                    </g>
                  )
                })}
                {/* Drawing connection */}
                {connecting && (
                  <line x1={cards.find(c => c.id === connecting.fromId)?.x + CARD_W / 2 || 0}
                    y1={(cards.find(c => c.id === connecting.fromId)?.y || 0) + CARD_H}
                    x2={connecting.mouseX} y2={connecting.mouseY}
                    stroke="#E6007E" strokeWidth={2} strokeDasharray="4,4" />
                )}
              </g>
            </svg>

            {/* Cards */}
            <div style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              {cards.map(card => {
                const file = getFile(card.fileId)
                if (!file) return null
                const isImg = file.type?.startsWith('image/')
                const isSelected = selectedCard === card.id
                const isActivePlay = activePlayCard === card.id

                return (
                  <div key={card.id}
                    onMouseDown={e => handleCardMouseDown(card, e)}
                    onMouseUp={() => handleCardMouseUp(card)}
                    onDoubleClick={() => navigate(`/project/${projectId}/review/${file.id}`)}
                    style={{
                      position: 'absolute', left: card.x, top: card.y,
                      width: card.w, height: card.h,
                      background: '#fff', borderRadius: 12,
                      border: isSelected ? '2px solid #E6007E' : isActivePlay ? '2px solid #16a34a' : '1px solid #e5e7eb',
                      boxShadow: isSelected ? '0 4px 20px rgba(230,0,126,.15)' : '0 2px 8px rgba(0,0,0,.06)',
                      cursor: playMode ? 'pointer' : tool === 'connect' ? 'crosshair' : 'grab',
                      overflow: 'hidden', userSelect: 'none',
                    }}>
                    {/* Preview */}
                    <div style={{ height: card.h - 36, overflow: 'hidden', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isImg ? (
                        <img src={file.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                      ) : (
                        <FileText size={32} color="#d1d5db" />
                      )}
                    </div>
                    {/* Label */}
                    <div style={{ height: 36, padding: '0 10px', display: 'flex', alignItems: 'center', borderTop: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {file.name?.replace(/\.[^.]+$/, '')}
                      </span>
                      {isSelected && !playMode && (
                        <button onClick={e => { e.stopPropagation(); removeCard(card.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#ef4444' }}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
