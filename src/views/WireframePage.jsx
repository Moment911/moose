"use client";
"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Save, Download, Upload, Undo2, Redo2, Trash2,
         Square, Type, Image as ImageIcon, Circle, Minus, MousePointer,
         Layout, FormInput, CreditCard, Star, PenLine, Plus, X, FileText,
         Layers, Grid3X3, Code, Eye, EyeOff, Lock, Unlock, Wand2, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase, createWireframeRecord, updateWireframeRecord, uploadFile, createFile } from '../lib/supabase'
import { callClaude } from '../lib/ai'
import Sidebar from '../components/Sidebar'
import ColorPicker from '../components/ColorPicker'
import FontPicker from '../components/FontPicker'
import toast from 'react-hot-toast'

const PALETTE = [
  { type: 'rect', label: 'Rectangle', icon: Square, w: 200, h: 120 },
  { type: 'text', label: 'Text Block', icon: Type, w: 240, h: 40, text: 'Click to edit text' },
  { type: 'image', label: 'Image', icon: ImageIcon, w: 200, h: 150 },
  { type: 'button', label: 'Button', icon: MousePointer, w: 140, h: 44, text: 'Button' },
  { type: 'nav', label: 'Nav Bar', icon: Layout, w: 1200, h: 56 },
  { type: 'card', label: 'Card', icon: CreditCard, w: 320, h: 200 },
  { type: 'input', label: 'Form Field', icon: FormInput, w: 300, h: 44, text: 'Input field' },
  { type: 'divider', label: 'Divider', icon: Minus, w: 400, h: 2 },
  { type: 'circle', label: 'Circle', icon: Circle, w: 100, h: 100 },
  { type: 'icon', label: 'Icon', icon: Star, w: 48, h: 48 },
]

const SNAP_THRESHOLD = 6
const TYPE_ICONS = { rect: Square, text: Type, image: ImageIcon, button: MousePointer, nav: Layout, card: CreditCard, input: FormInput, divider: Minus, circle: Circle, icon: Star }

export default function WireframePage() {
  const { projectId, canvasId } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const [project, setProject] = useState(null)
  const [wireframe, setWireframe] = useState(null)
  const [pages, setPages] = useState([{ id: 'page-1', name: 'Page 1', components: [], paths: [], bgColor: '#ffffff' }])
  const [activePageId, setActivePageId] = useState('page-1')
  const [selectedId, setSelectedId] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [resizing, setResizing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [activeTool, setActiveTool] = useState('select')
  const [drawColor, setDrawColor] = useState('#231f20')
  const [drawWidth, setDrawWidth] = useState(2)
  const [drawingPath, setDrawingPath] = useState(null)
  const [history, setHistory] = useState([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [wfName, setWfName] = useState('Untitled Canvas')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!canvasId)
  // New state for 6 features
  const [showLayers, setShowLayers] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [gridCols, setGridCols] = useState(12)
  const [gridGutter, setGridGutter] = useState(20)
  const [showCssModal, setShowCssModal] = useState(null)
  const [snapLines, setSnapLines] = useState([])
  const [textStyles, setTextStyles] = useState(() => JSON.parse(localStorage.getItem('mm_text_styles') || '[]'))
  const [aiCopyLoading, setAiCopyLoading] = useState(false)
  const [contextMenu, setContextMenu] = useState(null) // { x, y, comp }

  // Close context menu on any click
  useEffect(() => { const close = () => setContextMenu(null); window.addEventListener('click', close); return () => window.removeEventListener('click', close) }, [])

  const activePage = pages.find(p => p.id === activePageId) || pages[0]
  const components = activePage?.components || []
  const paths = activePage?.paths || []

  useEffect(() => {
    supabase.from('projects').select('*, clients(*)').eq('id', projectId).single().then(({ data }) => { if (data) setProject(data) })
    if (canvasId) loadCanvas()
  }, [projectId, canvasId])

  async function loadCanvas() {
    setLoading(true)
    const { data } = await supabase.from('wireframes').select('*').eq('id', canvasId).single()
    if (data) { setWireframe(data); setWfName(data.name || 'Untitled Canvas'); const d = data.data || {}; if (d.pages) { setPages(d.pages); setActivePageId(d.pages[0]?.id || 'page-1') } }
    setLoading(false)
  }

  function updatePage(pageId, updates) { setPages(prev => prev.map(p => p.id === pageId ? { ...p, ...updates } : p)) }
  function pushHistory() { const snap = JSON.parse(JSON.stringify(pages)); const h = history.slice(0, historyIdx + 1); h.push(snap); setHistory(h); setHistoryIdx(h.length - 1) }
  function undo() { if (historyIdx <= 0) return; setHistoryIdx(historyIdx - 1); setPages(JSON.parse(JSON.stringify(history[historyIdx - 1]))) }
  function redo() { if (historyIdx >= history.length - 1) return; setHistoryIdx(historyIdx + 1); setPages(JSON.parse(JSON.stringify(history[historyIdx + 1]))) }

  function addPage() { const id = 'page-' + Date.now(); setPages(prev => [...prev, { id, name: `Page ${prev.length + 1}`, components: [], paths: [], bgColor: '#ffffff' }]); setActivePageId(id); pushHistory() }
  function deletePage(id) { if (pages.length <= 1) return; setPages(prev => prev.filter(p => p.id !== id)); if (activePageId === id) setActivePageId(pages.find(p => p.id !== id)?.id); pushHistory() }

  function addComponent(type) {
    setActiveTool('select')
    const p = PALETTE.find(x => x.type === type); if (!p) return
    const c = { id: crypto.randomUUID(), type, x: 40 + Math.random() * 200, y: 40 + Math.random() * 200, width: p.w, height: p.h, text: p.text || '', fontSize: 14, imageUrl: '', name: `${p.label} ${components.length + 1}`, visible: true, locked: false }
    updatePage(activePageId, { components: [...components, c] }); setSelectedId(c.id); pushHistory()
  }

  function deleteSelected() { if (!selectedId) return; updatePage(activePageId, { components: components.filter(c => c.id !== selectedId) }); setSelectedId(null); pushHistory() }
  function updateComp(id, upd) { updatePage(activePageId, { components: components.map(c => c.id === id ? { ...c, ...upd } : c) }) }

  // ── Smart snap ──
  function calcSnapLines(dragId, mx, my, ox, oy) {
    const newX = mx - ox, newY = my - oy
    const dragComp = components.find(c => c.id === dragId); if (!dragComp) return { x: newX, y: newY, lines: [] }
    const dw = dragComp.width, dh = dragComp.height
    const lines = []; let snapX = newX, snapY = newY
    const canvasCx = 640, canvasCy = 400 // center of 1280x800

    for (const other of components) {
      if (other.id === dragId) continue
      const ox2 = other.x, oy2 = other.y, ow = other.width, oh = other.height
      // Snap left edge to left/right/center of other
      if (Math.abs(newX - ox2) < SNAP_THRESHOLD) { snapX = ox2; lines.push({ x1: ox2, y1: Math.min(newY, oy2), x2: ox2, y2: Math.max(newY + dh, oy2 + oh) }) }
      if (Math.abs(newX - (ox2 + ow)) < SNAP_THRESHOLD) { snapX = ox2 + ow; lines.push({ x1: ox2 + ow, y1: Math.min(newY, oy2), x2: ox2 + ow, y2: Math.max(newY + dh, oy2 + oh) }) }
      if (Math.abs((newX + dw / 2) - (ox2 + ow / 2)) < SNAP_THRESHOLD) { snapX = ox2 + ow / 2 - dw / 2; const cx = ox2 + ow / 2; lines.push({ x1: cx, y1: Math.min(newY, oy2), x2: cx, y2: Math.max(newY + dh, oy2 + oh) }) }
      if (Math.abs((newX + dw) - ox2) < SNAP_THRESHOLD) { snapX = ox2 - dw; lines.push({ x1: ox2, y1: Math.min(newY, oy2), x2: ox2, y2: Math.max(newY + dh, oy2 + oh) }) }
      // Snap top edge
      if (Math.abs(newY - oy2) < SNAP_THRESHOLD) { snapY = oy2; lines.push({ x1: Math.min(newX, ox2), y1: oy2, x2: Math.max(newX + dw, ox2 + ow), y2: oy2 }) }
      if (Math.abs(newY - (oy2 + oh)) < SNAP_THRESHOLD) { snapY = oy2 + oh; lines.push({ x1: Math.min(newX, ox2), y1: oy2 + oh, x2: Math.max(newX + dw, ox2 + ow), y2: oy2 + oh }) }
      if (Math.abs((newY + dh / 2) - (oy2 + oh / 2)) < SNAP_THRESHOLD) { snapY = oy2 + oh / 2 - dh / 2; const cy = oy2 + oh / 2; lines.push({ x1: Math.min(newX, ox2), y1: cy, x2: Math.max(newX + dw, ox2 + ow), y2: cy }) }
    }
    // Snap to canvas center
    if (Math.abs((newX + dw / 2) - canvasCx) < SNAP_THRESHOLD) { snapX = canvasCx - dw / 2; lines.push({ x1: canvasCx, y1: 0, x2: canvasCx, y2: 800 }) }
    if (Math.abs((newY + dh / 2) - canvasCy) < SNAP_THRESHOLD) { snapY = canvasCy - dh / 2; lines.push({ x1: 0, y1: canvasCy, x2: 1280, y2: canvasCy }) }
    return { x: Math.max(0, snapX), y: Math.max(0, snapY), lines }
  }

  function handleCanvasMouseDown(e) {
    if (e.target !== canvasRef.current && !e.target.classList.contains('canvas-bg')) return
    setSelectedId(null); setEditing(null)
    if (activeTool === 'freehand') { const rect = canvasRef.current.getBoundingClientRect(); setDrawingPath({ points: [{ x: e.clientX - rect.left, y: e.clientY - rect.top }], color: drawColor, width: drawWidth }) }
  }

  function handleCanvasMouseMove(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    if (drawingPath) { setDrawingPath(prev => ({ ...prev, points: [...prev.points, { x: mx, y: my }] })); return }
    if (dragging) {
      const snap = calcSnapLines(dragging.id, mx, my, dragging.ox, dragging.oy)
      setSnapLines(snap.lines)
      updatePage(activePageId, { components: components.map(c => c.id === dragging.id ? { ...c, x: snap.x, y: snap.y } : c) })
    }
    if (resizing) {
      const dir = resizing.dir || 'se'
      updatePage(activePageId, { components: components.map(c => {
        if (c.id !== resizing.id) return c
        let { x, y, width, height } = c
        if (dir.includes('e')) width = Math.max(20, mx - x)
        if (dir.includes('s')) height = Math.max(10, my - y)
        if (dir.includes('w')) { const newW = Math.max(20, (x + width) - mx); x = x + width - newW; width = newW }
        if (dir.includes('n')) { const newH = Math.max(10, (y + height) - my); y = y + height - newH; height = newH }
        return { ...c, x, y, width, height }
      }) })
    }
  }

  function handleCanvasMouseUp() {
    if (drawingPath && drawingPath.points.length > 2) { const d = drawingPath.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' '); updatePage(activePageId, { paths: [...paths, { id: crypto.randomUUID(), d, color: drawingPath.color, width: drawingPath.width }] }); pushHistory() }
    setDrawingPath(null); setSnapLines([]); if (dragging || resizing) pushHistory(); setDragging(null); setResizing(null)
  }

  function handleCompMouseDown(e, id) {
    if (activeTool === 'freehand') return
    const comp = components.find(c => c.id === id); if (!comp || comp.locked) return
    e.stopPropagation(); setSelectedId(id); setEditing(null)
    const rect = canvasRef.current.getBoundingClientRect()
    setDragging({ id, ox: e.clientX - rect.left - comp.x, oy: e.clientY - rect.top - comp.y })
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (selectedId && components.find(c => c.id === selectedId)?.type === 'image') { updateComp(selectedId, { imageUrl: ev.target.result }); pushHistory() }
      else { updatePage(activePageId, { components: [...components, { id: crypto.randomUUID(), type: 'image', x: 40, y: 40, width: 300, height: 200, text: '', fontSize: 14, imageUrl: ev.target.result, name: `Image ${components.length + 1}`, visible: true, locked: false }] }); pushHistory() }
    }
    reader.readAsDataURL(file); e.target.value = ''
  }

  // ── Copy CSS ──
  function generateCss(c) {
    const lines = [`position: absolute;`, `left: ${c.x}px;`, `top: ${c.y}px;`, `width: ${c.width}px;`, `height: ${c.height}px;`]
    if (c.type === 'text') { lines.push(`font-family: ${c.fontFamily || 'Inter, sans-serif'};`, `font-size: ${c.fontSize || 14}px;`, `color: ${c.textColor || '#231f20'};`, `font-weight: ${c.bold ? 700 : 400};`, `font-style: ${c.italic ? 'italic' : 'normal'};`) }
    if (c.type === 'rect') lines.push('background: #e5e7eb;', 'border: 1px solid #d1d5db;', 'border-radius: 4px;')
    if (c.type === 'button') lines.push(`background: #231f20;`, `color: #ffffff;`, `border-radius: 8px;`, `font-weight: 600;`, `font-size: 14px;`, `display: flex;`, `align-items: center;`, `justify-content: center;`)
    if (c.type === 'card') lines.push('background: #ffffff;', 'border: 1px solid #e5e7eb;', 'box-shadow: 0 1px 3px rgba(0,0,0,0.1);', 'border-radius: 4px;')
    if (c.type === 'circle') lines.push('background: #e5e7eb;', 'border: 1px solid #d1d5db;', 'border-radius: 50%;')
    if (c.type === 'input') lines.push('background: #ffffff;', 'border: 1px solid #d1d5db;', 'border-radius: 4px;', 'padding: 0 12px;')
    if (c.type === 'nav') lines.push('background: #231f20;', 'display: flex;', 'align-items: center;', 'padding: 0 20px;')
    return lines.join('\n')
  }

  // ── Text Style Presets ──
  function saveTextStyle() {
    const c = components.find(x => x.id === selectedId)
    if (!c || c.type !== 'text') return
    const name = prompt('Style name:', `Style ${textStyles.length + 1}`)
    if (!name) return
    const style = { name, fontFamily: c.fontFamily || 'Inter', fontSize: c.fontSize || 14, fontWeight: c.fontWeight || (c.bold ? 700 : 400), bold: c.bold || false, italic: c.italic || false, textColor: c.textColor || '#231f20', textAlign: c.textAlign || 'left', lineHeight: c.lineHeight || 1.5 }
    const next = [...textStyles, style]
    setTextStyles(next); localStorage.setItem('mm_text_styles', JSON.stringify(next))
    toast.success(`Style "${name}" saved`)
  }

  function applyTextStyle(style) {
    if (!selectedId) return
    updateComp(selectedId, { fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, bold: style.bold, italic: style.italic, textColor: style.textColor, textAlign: style.textAlign, lineHeight: style.lineHeight })
    pushHistory()
  }

  // ── AI Copy Generator ──
  async function generateAiCopy() {
    const c = components.find(x => x.id === selectedId)
    if (!c) return
    const prompt = window.prompt('What kind of copy? (e.g. "hero headline for wellness brand", "CTA button text", "product description")')
    if (!prompt) return
    setAiCopyLoading(true)
    try {
      const result = await callClaude(`You are a copywriter for ${project?.name || 'a design project'}. Project type: ${project?.project_type || 'website'}. Write concise, compelling copy.`, `Write ${prompt}. Return ONLY the copy text, nothing else. Keep it short and punchy.`, 200)
      updateComp(selectedId, { text: (result || '').trim() }); pushHistory()
      toast.success('Copy generated!')
    } catch (e) { toast.error('AI unavailable — set VITE_ANTHROPIC_API_KEY') }
    setAiCopyLoading(false)
  }

  // ── Export ──
  function exportToPng() {
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 800; const ctx = cv.getContext('2d')
    ctx.fillStyle = activePage?.bgColor || '#fff'; ctx.fillRect(0, 0, 1280, 800)
    paths.forEach(p => { ctx.strokeStyle = p.color || '#231f20'; ctx.lineWidth = p.width || 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; const pts = p.d.replace(/[ML]/g, '').split(' ').filter(Boolean).map(s => { const [x, y] = s.split(','); return { x: +x, y: +y } }); if (pts.length < 2) return; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y)); ctx.stroke() })
    components.filter(c => c.visible !== false).forEach(c => { ctx.lineWidth = 1; if (c.type === 'rect') { ctx.fillStyle = '#e5e7eb'; ctx.strokeStyle = '#d1d5db'; ctx.fillRect(c.x, c.y, c.width, c.height); ctx.strokeRect(c.x, c.y, c.width, c.height) } else if (c.type === 'text') { ctx.fillStyle = c.textColor || '#231f20'; ctx.font = `${c.bold ? 'bold ' : ''}${c.italic ? 'italic ' : ''}${c.fontSize || 14}px ${c.fontFamily || 'Inter'},sans-serif`; ctx.textAlign = 'start'; ctx.fillText(c.text || 'Text', c.x + 4, c.y + (c.fontSize || 14) + 4) } else if (c.type === 'button') { ctx.fillStyle = '#231f20'; ctx.beginPath(); ctx.roundRect(c.x, c.y, c.width, c.height, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(c.text || 'Button', c.x + c.width / 2, c.y + c.height / 2 + 5); ctx.textAlign = 'start' } })
    return cv.toDataURL('image/png')
  }

  async function handleSave() { setSaving(true); try { if (wireframe) await updateWireframeRecord(wireframe.id, { name: wfName, data: { pages } }); else { const { data: d } = await createWireframeRecord({ project_id: projectId, name: wfName, data: { pages } }); setWireframe(d); if (d) navigate(`/project/${projectId}/canvas/${d.id}`, { replace: true }) }; toast.success('Saved!') } catch { toast.error('Save failed') } setSaving(false) }
  function handleDownload() { const a = document.createElement('a'); a.href = exportToPng(); a.download = `${wfName} - ${activePage.name}.png`; a.click() }
  async function handleAddToProject() { try { const blob = await (await fetch(exportToPng())).blob(); const path = `${projectId}/${crypto.randomUUID()}.png`; const url = await uploadFile(blob, path); await createFile({ project_id: projectId, name: `${wfName} - ${activePage.name}.png`, url, storage_path: path, type: 'image/png', size: blob.size }); toast.success('Added!') } catch { toast.error('Export failed') } }

  function exportToHtml() {
    const css = components.filter(c => c.visible !== false).map(c => `.el-${c.id.substring(0,8)} { ${generateCss(c)} }`).join('\n\n')
    const divs = components.filter(c => c.visible !== false).map(c => {
      if (c.type === 'text') return `  <p class="el-${c.id.substring(0,8)}">${c.text || ''}</p>`
      if (c.type === 'button') return `  <button class="el-${c.id.substring(0,8)}">${c.text || 'Button'}</button>`
      if (c.type === 'input') return `  <input class="el-${c.id.substring(0,8)}" placeholder="${c.text || ''}" />`
      return `  <div class="el-${c.id.substring(0,8)}"></div>`
    }).join('\n')
    const html = `<!-- Generated by Moose - moose.ai -->\n<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${wfName}</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body style="position:relative;width:1280px;height:800px;margin:0 auto;background:${activePage?.bgColor || '#fff'};font-family:Inter,sans-serif;">\n${divs}\n</body>\n</html>`
    const cssFile = `/* Generated by Moose - moose.ai */\n/* ${wfName} - ${activePage?.name} */\n\n${css}`
    // Download as separate files
    const downloadFile = (content, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' })); a.download = name; a.click() }
    downloadFile(html, 'index.html')
    setTimeout(() => downloadFile(cssFile, 'styles.css'), 500)
    toast.success('HTML + CSS exported!')
  }

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
      if (e.key === 'd') setActiveTool('freehand')
      if (e.key === 'v' || e.key === 'Escape') { setActiveTool('select'); setDrawingPath(null) }
      if (e.key === 'l') setShowLayers(v => !v)
      if (e.key === 'g') setShowGrid(v => !v)
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, components, history, historyIdx, pages])

  function renderComp(c) {
    const base = { width: '100%', height: '100%', borderRadius: 4 }
    if (c.visible === false) return <div style={{ ...base, opacity: 0.15, background: '#f3f4f6', border: '1px dashed #d1d5db' }} />
    if (c.type === 'rect') return <div style={{ ...base, background: c.bgColor || '#e5e7eb', border: `${c.borderWidth ?? 1}px solid ${c.borderColor || '#d1d5db'}`, borderRadius: c.borderRadius ?? 4, opacity: c.opacity ?? 1 }} />
    if (c.type === 'text') {
      if (editing === c.id) return <div contentEditable suppressContentEditableWarning style={{ ...base, padding: 4, fontSize: c.fontSize || 14, color: '#231f20', outline: '2px solid #ea2729', outlineOffset: -2, cursor: 'text', whiteSpace: 'pre-wrap' }}
        onBlur={e => { updateComp(c.id, { text: e.target.innerText }); setEditing(null); pushHistory() }}>{c.text}</div>
      return <div style={{ ...base, padding: 4, fontSize: c.fontSize || 14, color: c.textColor || '#231f20', overflow: 'hidden', whiteSpace: 'pre-wrap', fontWeight: c.fontWeight || (c.bold ? 700 : 400), fontStyle: c.italic ? 'italic' : 'normal', fontFamily: c.fontFamily || 'Inter, sans-serif', textDecoration: c.underline ? 'underline' : 'none', textAlign: c.textAlign || 'left', lineHeight: c.lineHeight || 1.5 }}>{c.text || 'Click to edit'}</div>
    }
    if (c.type === 'image') { if (c.imageUrl) return <img src={c.imageUrl} alt="" style={{ ...base, objectFit: 'cover' }} draggable={false} />; return <div style={{ ...base, background: '#f3f4f6', border: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }} onClick={() => { setSelectedId(c.id); fileInputRef.current?.click() }}><ImageIcon size={24} style={{ color: '#9ca3af' }} /><span style={{ fontSize: 11, color: '#9ca3af' }}>Upload</span></div> }
    if (c.type === 'button') { if (editing === c.id) return <input style={{ ...base, background: '#231f20', color: '#fff', textAlign: 'center', fontWeight: 600, fontSize: 14, border: '2px solid #ea2729', padding: '0 12px', borderRadius: 8 }} value={c.text} onChange={e => updateComp(c.id, { text: e.target.value })} onBlur={() => { setEditing(null); pushHistory() }} autoFocus />; return <div style={{ ...base, background: '#231f20', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, borderRadius: 8 }}>{c.text || 'Button'}</div> }
    if (c.type === 'nav') return <div style={{ ...base, background: '#231f20', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 32, borderRadius: 0 }}><span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Logo</span></div>
    if (c.type === 'card') return <div style={{ ...base, background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
    if (c.type === 'input') { if (editing === c.id) return <input style={{ ...base, border: '1px solid #ea2729', padding: '0 12px', fontSize: 13, outline: 'none' }} value={c.text} onChange={e => updateComp(c.id, { text: e.target.value })} onBlur={() => { setEditing(null); pushHistory() }} autoFocus />; return <div style={{ ...base, border: '1px solid #d1d5db', background: '#fff', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 13, color: '#9ca3af' }}>{c.text || 'Input'}</div> }
    if (c.type === 'divider') return <div style={{ width: '100%', height: 1, background: '#d1d5db', marginTop: c.height / 2 }} />
    if (c.type === 'circle') return <div style={{ ...base, background: '#e5e7eb', border: '1px solid #d1d5db', borderRadius: '50%' }} />
    if (c.type === 'icon') return <div style={{ ...base, background: '#9ca3af', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff', fontSize: 20 }}>{'\u2605'}</span></div>
    return null
  }

  const sel = components.find(c => c.id === selectedId)

  if (loading) return <div className="flex h-screen overflow-hidden"><Sidebar activeProjectId={projectId} /><div className="flex-1 flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div></div>

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeProjectId={projectId} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-11 bg-white border-b border-gray-200 px-4 flex items-center gap-3 flex-shrink-0">
          <Link to={`/project/${projectId}`} className="text-gray-400 hover:text-gray-700"><ChevronLeft size={16} /></Link>
          <PenLine size={14} className="text-brand-500" />
          <input className="text-[13px] font-medium text-gray-900 bg-transparent border-none focus:outline-none" value={wfName} onChange={e => setWfName(e.target.value)} />
          <span className="text-[11px] text-gray-400">{project?.name}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setShowLayers(v => !v)} className={`p-1.5 rounded-lg transition-colors ${showLayers ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`} title="Layers (L)"><Layers size={14} /></button>
            <button onClick={() => setShowGrid(v => !v)} className={`p-1.5 rounded-lg transition-colors ${showGrid ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`} title="Grid (G)"><Grid3X3 size={14} /></button>
            <div className="w-px h-4 bg-gray-200" />
            <button onClick={undo} disabled={historyIdx <= 0} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30"><Undo2 size={14} /></button>
            <button onClick={redo} disabled={historyIdx >= history.length - 1} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30"><Redo2 size={14} /></button>
            <div className="w-px h-4 bg-gray-200" />
            <button onClick={handleSave} disabled={saving} className="btn-secondary text-[11px] py-1 px-2.5"><Save size={12} /> Save</button>
            <button onClick={handleDownload} className="btn-secondary text-[11px] py-1 px-2.5" title="Export PNG"><Download size={12} /></button>
            <button onClick={exportToHtml} className="btn-secondary text-[11px] py-1 px-2.5" title="Export HTML+CSS"><Code size={12} /></button>
            <button onClick={handleAddToProject} className="btn-primary text-[11px] py-1 px-2.5"><Upload size={12} /> Add</button>
          </div>
        </div>

        {/* Page tabs */}
        <div className="h-8 bg-gray-50 border-b border-gray-200 px-4 flex items-center gap-1 flex-shrink-0">
          {pages.map(p => (
            <div key={p.id} className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${p.id === activePageId ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActivePageId(p.id)}>
              <span onDoubleClick={() => { const n = prompt('Rename:', p.name); if (n) setPages(prev => prev.map(pg => pg.id === p.id ? { ...pg, name: n } : pg)) }}>{p.name}</span>
              {pages.length > 1 && <button onClick={e => { e.stopPropagation(); deletePage(p.id) }} className="text-gray-400 hover:text-red-500"><X size={9} /></button>}
            </div>
          ))}
          <button onClick={addPage} className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white"><Plus size={12} /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left palette */}
          <div className="w-44 bg-white border-r border-gray-100 overflow-y-auto flex-shrink-0">
            <div className="p-2.5">
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">Components</p>
              {PALETTE.map(p => { const I = p.icon; return (
                <button key={p.type} onClick={() => addComponent(p.type)} className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-gray-600 hover:bg-gray-100 rounded transition-colors">
                  <I size={12} className="text-gray-400" /> {p.label}
                </button>
              )})}
            </div>
            <div className="p-2.5 border-t border-gray-100">
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">Draw</p>
              <div className="flex gap-1 mb-2">
                <button onClick={() => setActiveTool('select')} className={`flex-1 text-[10px] py-1 rounded border ${activeTool === 'select' ? 'bg-gray-100 border-gray-300 text-gray-800 font-medium' : 'border-gray-200 text-gray-500'}`}><MousePointer size={10} className="inline mr-0.5" />V</button>
                <button onClick={() => setActiveTool('freehand')} className={`flex-1 text-[10px] py-1 rounded border ${activeTool === 'freehand' ? 'bg-brand-50 border-brand-300 text-brand-700 font-medium' : 'border-gray-200 text-gray-500'}`}><PenLine size={10} className="inline mr-0.5" />D</button>
              </div>
              <ColorPicker mode="inline" value={drawColor} onChange={setDrawColor} />
            </div>
            <div className="p-2.5 border-t border-gray-100">
              <ColorPicker label="Background" value={activePage?.bgColor || '#ffffff'} onChange={c => { updatePage(activePageId, { bgColor: c }); pushHistory() }} />
            </div>
            {/* Text Style Presets */}
            {textStyles.length > 0 && (
              <div className="p-2.5 border-t border-gray-100">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">Text Styles</p>
                {textStyles.map((s, i) => (
                  <button key={i} onClick={() => applyTextStyle(s)} className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-gray-100 rounded transition-colors flex items-center justify-between group">
                    <span style={{ fontFamily: s.fontFamily, fontSize: Math.min(s.fontSize, 14), fontWeight: s.bold ? 700 : 400, fontStyle: s.italic ? 'italic' : 'normal', color: s.textColor }}>{s.name}</span>
                    <button onClick={e => { e.stopPropagation(); const next = textStyles.filter((_, j) => j !== i); setTextStyles(next); localStorage.setItem('mm_text_styles', JSON.stringify(next)) }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"><X size={8} /></button>
                  </button>
                ))}
              </div>
            )}
            <div className="p-2.5 border-t border-gray-100">
              <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-gray-600 hover:bg-gray-100 rounded"><Upload size={12} className="text-gray-400" /> Upload Image</button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
          </div>

          {/* Layers panel (toggle) */}
          {showLayers && (
            <div className="w-48 bg-white border-r border-gray-100 overflow-y-auto flex-shrink-0">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-gray-500 uppercase">Layers</p>
                <span className="text-[9px] text-gray-400">{components.length}</span>
              </div>
              {[...components].reverse().map((c, i) => {
                const Icon = TYPE_ICONS[c.type] || Square
                return (
                  <div key={c.id} className={`flex items-center gap-1.5 px-2 py-1.5 text-[11px] cursor-pointer transition-colors ${selectedId === c.id ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    onClick={() => setSelectedId(c.id)}>
                    <Icon size={10} className="text-gray-400 flex-shrink-0" />
                    <span className="flex-1 truncate">{c.name || c.type}</span>
                    <button onClick={e => { e.stopPropagation(); updateComp(c.id, { visible: c.visible === false ? true : false }); pushHistory() }} className="text-gray-300 hover:text-gray-600">
                      {c.visible === false ? <EyeOff size={9} /> : <Eye size={9} />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); updateComp(c.id, { locked: !c.locked }); pushHistory() }} className="text-gray-300 hover:text-gray-600">
                      {c.locked ? <Lock size={9} /> : <Unlock size={9} />}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-gray-100/80 p-6 flex items-start justify-center">
            <div ref={canvasRef} className="rounded relative canvas-bg" style={{ width: 1280, height: 800, minWidth: 1280, cursor: activeTool === 'freehand' ? 'crosshair' : 'default', background: activePage?.bgColor || '#ffffff', boxShadow: '0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)' }}
              onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}>

              {/* Grid overlay */}
              {showGrid && (
                <svg className="absolute inset-0 pointer-events-none" width={1280} height={800} style={{ zIndex: 0 }}>
                  {Array.from({ length: gridCols + 1 }).map((_, i) => {
                    const x = (1280 / gridCols) * i
                    return <line key={i} x1={x} y1={0} x2={x} y2={800} stroke="#ea272920" strokeWidth={1} />
                  })}
                  {Array.from({ length: Math.ceil(800 / 8) }).map((_, i) => (
                    <line key={`h${i}`} x1={0} y1={i * 8} x2={1280} y2={i * 8} stroke="#ea272908" strokeWidth={0.5} />
                  ))}
                </svg>
              )}

              {/* Snap lines */}
              {snapLines.length > 0 && (
                <svg className="absolute inset-0 pointer-events-none" width={1280} height={800} style={{ zIndex: 100 }}>
                  {snapLines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#ea2729" strokeWidth={1} strokeDasharray="4,3" />)}
                </svg>
              )}

              {/* Freehand paths */}
              <svg className="absolute inset-0 pointer-events-none" width={1280} height={800} style={{ zIndex: 0 }}>
                {paths.map(p => <path key={p.id} d={p.d} fill="none" stroke={p.color} strokeWidth={p.width} strokeLinecap="round" strokeLinejoin="round" />)}
                {drawingPath && drawingPath.points.length > 1 && <path d={drawingPath.points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ')} fill="none" stroke={drawingPath.color} strokeWidth={drawingPath.width} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />}
              </svg>

              {components.length === 0 && paths.length === 0 && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="text-center"><Layout size={32} className="text-gray-200 mx-auto mb-2" /><p className="text-[12px] text-gray-300">Click a component to add it</p></div></div>}

              {components.map(c => (
                <div key={c.id} style={{ position: 'absolute', left: c.x, top: c.y, width: c.width, height: c.height, cursor: c.locked ? 'not-allowed' : activeTool === 'freehand' ? 'crosshair' : dragging?.id === c.id ? 'grabbing' : 'grab', outline: selectedId === c.id ? '2px solid #ea2729' : 'none', outlineOffset: 2, zIndex: selectedId === c.id ? 10 : 1, opacity: c.visible === false ? 0.2 : 1 }}
                  onMouseDown={e => handleCompMouseDown(e, c.id)} onDoubleClick={() => { if (['text', 'button', 'input'].includes(c.type)) setEditing(c.id) }}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, comp: c }) }}>
                  {renderComp(c)}
                  {selectedId === c.id && !c.locked && <>
                    {/* 4 corner handles */}
                    <div style={{ position:'absolute',right:-4,bottom:-4,width:7,height:7,background:'#ea2729',borderRadius:1,cursor:'se-resize' }} onMouseDown={e=>{e.stopPropagation();setResizing({id:c.id,dir:'se'})}} />
                    <div style={{ position:'absolute',left:-4,bottom:-4,width:7,height:7,background:'#ea2729',borderRadius:1,cursor:'sw-resize' }} onMouseDown={e=>{e.stopPropagation();setResizing({id:c.id,dir:'sw'})}} />
                    <div style={{ position:'absolute',right:-4,top:-4,width:7,height:7,background:'#ea2729',borderRadius:1,cursor:'ne-resize' }} onMouseDown={e=>{e.stopPropagation();setResizing({id:c.id,dir:'ne'})}} />
                    <div style={{ position:'absolute',left:-4,top:-4,width:7,height:7,background:'#ea2729',borderRadius:1,cursor:'nw-resize' }} onMouseDown={e=>{e.stopPropagation();setResizing({id:c.id,dir:'nw'})}} />
                    {/* 4 edge handles */}
                    <div style={{ position:'absolute',right:-4,top:'50%',marginTop:-3,width:7,height:7,background:'#ea2729',borderRadius:1,cursor:'e-resize' }} onMouseDown={e=>{e.stopPropagation();setResizing({id:c.id,dir:'e'})}} />
                    <div style={{ position:'absolute',left:-4,top:'50%',marginTop:-3,width:7,height:7,background:'#ea2729',borderRadius:1,cursor:'w-resize' }} onMouseDown={e=>{e.stopPropagation();setResizing({id:c.id,dir:'w'})}} />
                    <div style={{ position:'absolute',left:'50%',top:-4,marginLeft:-3,width:7,height:7,background:'#ea2729',borderRadius:1,cursor:'n-resize' }} onMouseDown={e=>{e.stopPropagation();setResizing({id:c.id,dir:'n'})}} />
                    <div style={{ position:'absolute',left:'50%',bottom:-4,marginLeft:-3,width:7,height:7,background:'#ea2729',borderRadius:1,cursor:'s-resize' }} onMouseDown={e=>{e.stopPropagation();setResizing({id:c.id,dir:'s'})}} />
                  </>}
                </div>
              ))}
            </div>
          </div>

          {/* Properties panel */}
          {sel && (
            <div className="w-52 bg-white border-l border-gray-100 p-3 overflow-y-auto flex-shrink-0">
              <p className="text-[9px] font-semibold text-gray-400 uppercase mb-2">Properties</p>
              <div className="space-y-2.5">
                <div><label className="text-[9px] text-gray-400 mb-0.5 block">Name</label><input className="input text-[11px] py-1" value={sel.name || ''} onChange={e => updateComp(sel.id, { name: e.target.value })} onBlur={pushHistory} /></div>
                <div><label className="text-[9px] text-gray-400 mb-0.5 block">Position</label><div className="flex gap-1.5"><input className="input text-[11px] py-1 w-full" type="number" value={Math.round(sel.x)} onChange={e => updateComp(sel.id, { x: +e.target.value || 0 })} onBlur={pushHistory} /><input className="input text-[11px] py-1 w-full" type="number" value={Math.round(sel.y)} onChange={e => updateComp(sel.id, { y: +e.target.value || 0 })} onBlur={pushHistory} /></div></div>
                <div><label className="text-[9px] text-gray-400 mb-0.5 block">Size</label><div className="flex gap-1.5"><input className="input text-[11px] py-1 w-full" type="number" value={Math.round(sel.width)} onChange={e => updateComp(sel.id, { width: +e.target.value || 20 })} onBlur={pushHistory} /><input className="input text-[11px] py-1 w-full" type="number" value={Math.round(sel.height)} onChange={e => updateComp(sel.id, { height: +e.target.value || 10 })} onBlur={pushHistory} /></div></div>
                {sel.text !== undefined && <div><label className="text-[9px] text-gray-400 mb-0.5 block">Text</label><textarea className="input text-[11px] py-1 w-full resize-none" rows={2} value={sel.text} onChange={e => updateComp(sel.id, { text: e.target.value })} onBlur={pushHistory} /></div>}
                {sel.type === 'text' && (<>
                  <div className="flex gap-1.5">
                    <div className="flex-1"><label className="text-[9px] text-gray-400 mb-0.5 block">Size</label><input className="input text-[11px] py-1 w-full" type="number" min={8} max={120} value={sel.fontSize || 14} onChange={e => updateComp(sel.id, { fontSize: +e.target.value || 14 })} onBlur={pushHistory} /></div>
                    <div className="flex-1"><label className="text-[9px] text-gray-400 mb-0.5 block">Weight</label>
                      <select className="input text-[11px] py-1 w-full" value={sel.fontWeight || (sel.bold ? 700 : 400)} onChange={e => { updateComp(sel.id, { fontWeight: +e.target.value, bold: +e.target.value >= 600 }); pushHistory() }}>
                        {[{v:100,l:'Thin'},{v:200,l:'ExLight'},{v:300,l:'Light'},{v:400,l:'Regular'},{v:500,l:'Medium'},{v:600,l:'SemiBold'},{v:700,l:'Bold'},{v:800,l:'ExBold'},{v:900,l:'Black'}].map(w => (
                          <option key={w.v} value={w.v} style={{ fontWeight: w.v }}>{w.v} {w.l}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <button onClick={() => { updateComp(sel.id, { italic: !sel.italic }); pushHistory() }} className={`flex-1 text-[10px] py-1 rounded border ${sel.italic ? 'bg-gray-200 border-gray-400' : 'border-gray-200 text-gray-500'}`}>Italic</button>
                    <button onClick={() => { updateComp(sel.id, { underline: !sel.underline }); pushHistory() }} className={`flex-1 text-[10px] py-1 rounded border ${sel.underline ? 'bg-gray-200 border-gray-400' : 'border-gray-200 text-gray-500'}`}>Underline</button>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="flex-1"><label className="text-[9px] text-gray-400 mb-0.5 block">Align</label>
                      <div className="flex">
                        {['left','center','right'].map(a => (
                          <button key={a} onClick={() => { updateComp(sel.id, { textAlign: a }); pushHistory() }}
                            className={`flex-1 text-[9px] py-1 border ${(sel.textAlign || 'left') === a ? 'bg-gray-200 border-gray-400 font-medium' : 'border-gray-200 text-gray-500'} ${a === 'left' ? 'rounded-l' : a === 'right' ? 'rounded-r' : ''}`}>{a[0].toUpperCase()}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1"><label className="text-[9px] text-gray-400 mb-0.5 block">Line H</label>
                      <input className="input text-[11px] py-1 w-full" type="number" min={1} max={3} step={0.1} value={sel.lineHeight || 1.5} onChange={e => updateComp(sel.id, { lineHeight: +e.target.value || 1.5 })} onBlur={pushHistory} />
                    </div>
                  </div>
                  <FontPicker value={sel.fontFamily || 'Inter'} onChange={f => { updateComp(sel.id, { fontFamily: f }); pushHistory() }} />
                  <ColorPicker label="Color" value={sel.textColor || '#231f20'} onChange={c => { updateComp(sel.id, { textColor: c }); pushHistory() }} />
                  <div className="flex gap-1.5">
                    <button onClick={saveTextStyle} className="flex-1 text-[10px] py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100">Save Style</button>
                    <button onClick={generateAiCopy} disabled={aiCopyLoading} className="flex-1 text-[10px] py-1.5 rounded-lg border border-brand-200 text-brand-600 hover:bg-brand-50 flex items-center justify-center gap-1"><Wand2 size={9} /> {aiCopyLoading ? '...' : 'AI Copy'}</button>
                  </div>
                </>)}
                {sel.type === 'image' && <button onClick={() => fileInputRef.current?.click()} className="w-full text-[10px] py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100">{sel.imageUrl ? 'Replace' : 'Upload'} Image</button>}
                {['rect','button','card','circle'].includes(sel.type) && (<>
                  <ColorPicker label="Background" value={sel.bgColor || (sel.type === 'button' ? '#231f20' : '#e5e7eb')} onChange={c => { updateComp(sel.id, { bgColor: c }); pushHistory() }} />
                  <div className="flex gap-1.5">
                    <div className="flex-1"><label className="text-[9px] text-gray-400 mb-0.5 block">Border W</label><input className="input text-[11px] py-1 w-full" type="number" min={0} max={10} value={sel.borderWidth ?? 1} onChange={e => { updateComp(sel.id, { borderWidth: +e.target.value }); pushHistory() }} /></div>
                    <div className="flex-1"><label className="text-[9px] text-gray-400 mb-0.5 block">Radius</label><input className="input text-[11px] py-1 w-full" type="number" min={0} max={100} value={sel.borderRadius ?? 4} onChange={e => { updateComp(sel.id, { borderRadius: +e.target.value }); pushHistory() }} /></div>
                  </div>
                  <ColorPicker label="Border Color" value={sel.borderColor || '#d1d5db'} onChange={c => { updateComp(sel.id, { borderColor: c }); pushHistory() }} />
                </>)}
                <div><label className="text-[9px] text-gray-400 mb-0.5 block">Opacity</label><input className="input text-[11px] py-1 w-full" type="range" min={0} max={1} step={0.05} value={sel.opacity ?? 1} onChange={e => { updateComp(sel.id, { opacity: +e.target.value }); pushHistory() }} /><span className="text-[9px] text-gray-400">{Math.round((sel.opacity ?? 1) * 100)}%</span></div>
                <div className="flex gap-1.5">
                  <button onClick={() => { const idx = components.findIndex(c => c.id === sel.id); if (idx < components.length - 1) { const next = [...components]; const [item] = next.splice(idx, 1); next.push(item); updatePage(activePageId, { components: next }); pushHistory() } }} className="flex-1 text-[10px] py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"><ChevronUp size={9} className="inline" /> Front</button>
                  <button onClick={() => { const idx = components.findIndex(c => c.id === sel.id); if (idx > 0) { const next = [...components]; const [item] = next.splice(idx, 1); next.unshift(item); updatePage(activePageId, { components: next }); pushHistory() } }} className="flex-1 text-[10px] py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"><ChevronDown size={9} className="inline" /> Back</button>
                </div>
                <button onClick={() => setShowCssModal(sel)} className="w-full text-[10px] py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center gap-1"><Code size={9} /> Copy CSS</button>
                <button onClick={deleteSelected} className="w-full text-[10px] py-1.5 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center gap-1"><Trash2 size={9} /> Delete</button>
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="h-7 bg-white border-t border-gray-100 px-4 flex items-center gap-4 text-[10px] text-gray-400 flex-shrink-0">
          <span>{activeTool === 'freehand' ? 'Draw' : 'Select'} mode</span>
          <span>{components.length} elements</span>
          {showGrid && <span className="text-brand-500">{gridCols}-col grid</span>}
          {showLayers && <span className="text-brand-500">Layers open</span>}
          <span className="ml-auto">V=Select D=Draw L=Layers G=Grid Del=Delete Right-click=CSS</span>
        </div>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 py-1 min-w-[180px]" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <button onClick={() => { navigator.clipboard.writeText(generateCss(contextMenu.comp)); toast.success('CSS copied!'); setContextMenu(null) }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><Code size={13} /> Copy CSS</button>
          <button onClick={() => { setShowCssModal(contextMenu.comp); setContextMenu(null) }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><Eye size={13} /> View CSS</button>
          <button onClick={() => { const c = contextMenu.comp; updateComp(c.id, { ...c, id: crypto.randomUUID(), x: c.x + 20, y: c.y + 20, name: c.name + ' copy' }); const dup = { ...c, id: crypto.randomUUID(), x: c.x + 20, y: c.y + 20, name: (c.name || c.type) + ' copy' }; updatePage(activePageId, { components: [...components, dup] }); pushHistory(); setContextMenu(null) }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><Copy size={13} /> Duplicate</button>
          <div className="border-t border-gray-100 my-1" />
          <button onClick={() => { deleteSelected(); setContextMenu(null) }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={13} /> Delete</button>
        </div>
      )}

      {/* CSS Modal */}
      {showCssModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCssModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Code size={14} /> CSS for "{showCssModal.name || showCssModal.type}"</h3>
              <button onClick={() => setShowCssModal(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="p-4">
              <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-auto font-mono leading-relaxed" style={{ maxHeight: 300 }}>{generateCss(showCssModal)}</pre>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { navigator.clipboard.writeText(generateCss(showCssModal)); toast.success('CSS copied!') }} className="btn-primary text-xs"><Copy size={12} /> Copy CSS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
