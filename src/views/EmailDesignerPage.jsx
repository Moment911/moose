"use client";
"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Save, Download, Code2, Eye, Type, Image as ImageIcon, MousePointer,
         Minus, ArrowUp, ArrowDown, Trash2, Plus, Mail, Columns, FileText, Square } from 'lucide-react'
import { supabase, createEmailDesign, updateEmailDesign } from '../lib/supabase'
import ColorPicker from '../components/ColorPicker'
import FontPicker from '../components/FontPicker'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'

const BLOCK_TYPES = [
  { type: 'header', label: 'Header', icon: Mail, defaults: { logoText: 'Koto', tagline: 'Design That Moves', bgColor: '#231f20', textColor: '#ffffff' } },
  { type: 'text', label: 'Text', icon: Type, defaults: { content: 'Write your content here. Click to edit this text block.', fontSize: 16, textColor: '#333333', bgColor: '#ffffff', align: 'left', padding: 24 } },
  { type: 'image', label: 'Image', icon: ImageIcon, defaults: { src: '', alt: 'Image', caption: '', bgColor: '#ffffff', padding: 16 } },
  { type: 'button', label: 'Button', icon: MousePointer, defaults: { text: 'Learn More', url: '#', btnColor: '#ea2729', textColor: '#ffffff', bgColor: '#ffffff', align: 'center', padding: 24, borderRadius: 8 } },
  { type: 'divider', label: 'Divider', icon: Minus, defaults: { color: '#e5e7eb', thickness: 1, bgColor: '#ffffff', padding: 16 } },
  { type: 'spacer', label: 'Spacer', icon: Square, defaults: { height: 32, bgColor: '#ffffff' } },
  { type: 'twocol', label: '2 Columns', icon: Columns, defaults: { leftContent: 'Left column content', rightContent: 'Right column content', bgColor: '#ffffff', textColor: '#333333', padding: 24 } },
  { type: 'footer', label: 'Footer', icon: FileText, defaults: { text: '\u00a9 2026 Koto. All rights reserved.', links: 'Unsubscribe | View in browser', bgColor: '#f5f5f5', textColor: '#999999', padding: 24 } },
]

function generateHtml(blocks, subject) {
  const rows = blocks.map(b => {
    const d = b.data
    if (b.type === 'header') return `<tr><td style="background:${d.bgColor};padding:32px 40px;text-align:center;"><h1 style="margin:0;color:${d.textColor};font-size:28px;font-weight:700;font-family:Arial,sans-serif;">${d.logoText}</h1>${d.tagline ? `<p style="margin:8px 0 0;color:${d.textColor};opacity:0.7;font-size:14px;">${d.tagline}</p>` : ''}</td></tr>`
    if (b.type === 'text') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;text-align:${d.align};"><p style="margin:0;color:${d.textColor};font-size:${d.fontSize}px;line-height:1.6;font-family:Arial,sans-serif;">${d.content.replace(/\n/g, '<br>')}</p></td></tr>`
    if (b.type === 'image') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;text-align:center;">${d.src ? `<img src="${d.src}" alt="${d.alt}" style="max-width:100%;height:auto;border-radius:4px;">` : '<div style="background:#f3f4f6;height:200px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:14px;">Image placeholder</div>'}${d.caption ? `<p style="margin:8px 0 0;color:#999;font-size:12px;">${d.caption}</p>` : ''}</td></tr>`
    if (b.type === 'button') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;text-align:${d.align};"><a href="${d.url}" style="display:inline-block;background:${d.btnColor};color:${d.textColor};padding:14px 32px;border-radius:${d.borderRadius}px;text-decoration:none;font-weight:600;font-size:16px;font-family:Arial,sans-serif;">${d.text}</a></td></tr>`
    if (b.type === 'divider') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;"><hr style="border:none;border-top:${d.thickness}px solid ${d.color};margin:0;"></td></tr>`
    if (b.type === 'spacer') return `<tr><td style="background:${d.bgColor};height:${d.height}px;font-size:0;line-height:0;">&nbsp;</td></tr>`
    if (b.type === 'twocol') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" valign="top" style="padding-right:12px;color:${d.textColor};font-size:14px;line-height:1.6;font-family:Arial,sans-serif;">${d.leftContent.replace(/\n/g, '<br>')}</td><td width="50%" valign="top" style="padding-left:12px;color:${d.textColor};font-size:14px;line-height:1.6;font-family:Arial,sans-serif;">${d.rightContent.replace(/\n/g, '<br>')}</td></tr></table></td></tr>`
    if (b.type === 'footer') return `<tr><td style="background:${d.bgColor};padding:${d.padding}px 40px;text-align:center;"><p style="margin:0;color:${d.textColor};font-size:12px;line-height:1.6;font-family:Arial,sans-serif;">${d.text}</p>${d.links ? `<p style="margin:8px 0 0;color:${d.textColor};font-size:11px;">${d.links}</p>` : ''}</td></tr>`
    return ''
  }).join('\n')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${subject || 'Email'}</title></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;"><tr><td align="center" style="padding:24px 0;"><table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">\n${rows}\n</table></td></tr></table></body></html>`
}

export default function EmailDesignerPage() {
  const { projectId, emailId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [emailDesign, setEmailDesign] = useState(null)
  const [name, setName] = useState('Untitled Email')
  const [subject, setSubject] = useState('')
  const [blocks, setBlocks] = useState([
    { id: 'b1', type: 'header', data: { ...BLOCK_TYPES[0].defaults } },
    { id: 'b2', type: 'text', data: { ...BLOCK_TYPES[1].defaults } },
    { id: 'b3', type: 'button', data: { ...BLOCK_TYPES[3].defaults } },
    { id: 'b4', type: 'footer', data: { ...BLOCK_TYPES[7].defaults } },
  ])
  const [selectedId, setSelectedId] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!emailId)
  const fileInputRef = useRef(null)
  const [panelWidth, setPanelWidth] = useState(() => parseInt(localStorage.getItem('mm_email_panel') || '280'))
  const resizingPanel = useRef(false)

  useEffect(() => {
    supabase.from('projects').select('*, clients(*)').eq('id', projectId).single().then(({ data }) => { if (data) setProject(data) })
    if (emailId) loadEmail()
  }, [projectId, emailId])

  async function loadEmail() {
    setLoading(true)
    const { data } = await supabase.from('email_designs').select('*').eq('id', emailId).single()
    if (data) { setEmailDesign(data); setName(data.name); setSubject(data.subject || ''); setBlocks(data.blocks || []) }
    setLoading(false)
  }

  function addBlock(type) {
    const bt = BLOCK_TYPES.find(t => t.type === type)
    if (!bt) return
    const b = { id: 'b' + Date.now(), type, data: { ...bt.defaults } }
    const idx = selectedId ? blocks.findIndex(x => x.id === selectedId) + 1 : blocks.length
    const next = [...blocks]; next.splice(idx, 0, b)
    setBlocks(next); setSelectedId(b.id)
  }

  function updateBlock(id, data) { setBlocks(prev => prev.map(b => b.id === id ? { ...b, data: { ...b.data, ...data } } : b)) }
  function deleteBlock(id) { setBlocks(prev => prev.filter(b => b.id !== id)); if (selectedId === id) setSelectedId(null) }
  function moveBlock(id, dir) {
    const idx = blocks.findIndex(b => b.id === id)
    if (idx < 0 || (dir === -1 && idx === 0) || (dir === 1 && idx === blocks.length - 1)) return
    const next = [...blocks]; const [item] = next.splice(idx, 1); next.splice(idx + dir, 0, item); setBlocks(next)
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0]; if (!file || !selectedId) return
    const reader = new FileReader()
    reader.onload = (ev) => { updateBlock(selectedId, { src: ev.target.result }) }
    reader.readAsDataURL(file); e.target.value = ''
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (emailDesign) await updateEmailDesign(emailDesign.id, { name, subject, blocks })
      else { const { data } = await createEmailDesign({ project_id: projectId, name, subject, blocks }); setEmailDesign(data); if (data) navigate(`/project/${projectId}/email/${data.id}`, { replace: true }) }
      toast.success('Saved!')
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  function handleExportHtml() {
    const html = generateHtml(blocks, subject)
    const blob = new Blob([html], { type: 'text/html' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.html`; a.click()
    URL.revokeObjectURL(a.href)
  }

  function handleCopyHtml() {
    navigator.clipboard.writeText(generateHtml(blocks, subject))
    toast.success('HTML copied to clipboard!')
  }

  const sel = selectedId ? blocks.find(b => b.id === selectedId) : null

  function renderBlock(b) {
    const d = b.data; const isSel = b.id === selectedId
    const wrap = (children) => (
      <div key={b.id} className={`relative group cursor-pointer transition-all ${isSel ? 'ring-2 ring-brand-500 ring-offset-2' : 'hover:ring-1 hover:ring-gray-300 hover:ring-offset-1'}`}
        onClick={() => setSelectedId(b.id)}>
        {children}
        <div className={`absolute top-1 right-1 flex gap-0.5 ${isSel ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          <button onClick={e => { e.stopPropagation(); moveBlock(b.id, -1) }} className="w-5 h-5 bg-white shadow rounded text-gray-700 hover:text-gray-800 flex items-center justify-center"><ArrowUp size={10} /></button>
          <button onClick={e => { e.stopPropagation(); moveBlock(b.id, 1) }} className="w-5 h-5 bg-white shadow rounded text-gray-700 hover:text-gray-800 flex items-center justify-center"><ArrowDown size={10} /></button>
          <button onClick={e => { e.stopPropagation(); deleteBlock(b.id) }} className="w-5 h-5 bg-white shadow rounded text-red-400 hover:text-red-600 flex items-center justify-center"><Trash2 size={10} /></button>
        </div>
      </div>
    )

    if (b.type === 'header') return wrap(<div style={{ background: d.bgColor, padding: '32px 40px', textAlign: 'center' }}><h1 style={{ margin: 0, color: d.textColor, fontSize: 28, fontWeight: 700 }}>{d.logoText}</h1>{d.tagline && <p style={{ margin: '8px 0 0', color: d.textColor, opacity: 0.7, fontSize: 15 }}>{d.tagline}</p>}</div>)
    if (b.type === 'text') return wrap(<div style={{ background: d.bgColor, padding: `${d.padding}px 40px`, textAlign: d.align }}><p style={{ margin: 0, color: d.textColor, fontSize: d.fontSize, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.content}</p></div>)
    if (b.type === 'image') return wrap(<div style={{ background: d.bgColor, padding: `${d.padding}px 40px`, textAlign: 'center' }}>{d.src ? <img src={d.src} alt={d.alt} style={{ maxWidth: '100%', borderRadius: 4 }} /> : <div style={{ background: '#f3f4f6', height: 200, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontSize: 15 }}>Click to add image</div>}{d.caption && <p style={{ margin: '8px 0 0', color: '#999', fontSize: 14 }}>{d.caption}</p>}</div>)
    if (b.type === 'button') return wrap(<div style={{ background: d.bgColor, padding: `${d.padding}px 40px`, textAlign: d.align }}><a style={{ display: 'inline-block', background: d.btnColor, color: d.textColor, padding: '14px 32px', borderRadius: d.borderRadius, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>{d.text}</a></div>)
    if (b.type === 'divider') return wrap(<div style={{ background: d.bgColor, padding: `${d.padding}px 40px` }}><hr style={{ border: 'none', borderTop: `${d.thickness}px solid ${d.color}`, margin: 0 }} /></div>)
    if (b.type === 'spacer') return wrap(<div style={{ background: d.bgColor, height: d.height }} />)
    if (b.type === 'twocol') return wrap(<div style={{ background: d.bgColor, padding: `${d.padding}px 40px`, display: 'flex', gap: 24 }}><div style={{ flex: 1, color: d.textColor, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.leftContent}</div><div style={{ flex: 1, color: d.textColor, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.rightContent}</div></div>)
    if (b.type === 'footer') return wrap(<div style={{ background: d.bgColor, padding: `${d.padding}px 40px`, textAlign: 'center' }}><p style={{ margin: 0, color: d.textColor, fontSize: 14, lineHeight: 1.6 }}>{d.text}</p>{d.links && <p style={{ margin: '8px 0 0', color: d.textColor, fontSize: 13 }}>{d.links}</p>}</div>)
    return null
  }

  if (loading) return <div className="flex h-screen"><Sidebar activeProjectId={projectId} /><div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div></div>

  return (
    <div className="page-shell flex h-screen overflow-hidden">
      <Sidebar activeProjectId={projectId} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 flex-shrink-0">
          <Link to={`/project/${projectId}`} className="text-gray-700 hover:text-gray-700"><ChevronLeft size={18} /></Link>
          <Mail size={15} className="text-brand-500" />
          <input className="text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none" value={name} onChange={e => setName(e.target.value)} placeholder="Email name..." />
          <div className="w-px h-5 bg-gray-200" />
          <input className="text-sm text-gray-700 bg-transparent border-none focus:outline-none flex-1" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line..." />
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowPreview(!showPreview)} className={`btn-secondary text-sm ${showPreview ? 'bg-brand-50 text-brand-700 border-brand-300' : ''}`}><Eye size={13} /> Preview</button>
            <button onClick={handleSave} disabled={saving} className="btn-secondary text-sm"><Save size={13} /> Save</button>
            <button onClick={handleCopyHtml} className="btn-secondary text-sm"><Code2 size={13} /> Copy HTML</button>
            <button onClick={handleExportHtml} className="btn-primary text-sm"><Download size={13} /> Export HTML</button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Block palette */}
          <div className="w-48 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0 p-3">
            <p className="text-[13px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Add Block</p>
            <div className="space-y-0.5">
              {BLOCK_TYPES.map(bt => { const I = bt.icon; return (
                <button key={bt.type} onClick={() => addBlock(bt.type)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <I size={14} className="text-gray-700 flex-shrink-0" /> {bt.label}
                </button>
              )})}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-[13px] text-gray-700 leading-relaxed">Click a block to add it below the selected block. Drag arrows to reorder.</p>
            </div>
          </div>

          {/* Email canvas */}
          <div className="flex-1 overflow-auto bg-gray-100 p-8">
            <div className="mx-auto" style={{ width: 600 }}>
              {blocks.length === 0 && (
                <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
                  <Mail size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-700">Add blocks from the left panel to build your email</p>
                </div>
              )}
              <div className="bg-white rounded-xl overflow-hidden shadow-lg">
                {blocks.map(b => renderBlock(b))}
              </div>
            </div>
          </div>

          {/* Resize handle */}
          <div className="w-1.5 bg-gray-100 hover:bg-brand-200 cursor-col-resize flex-shrink-0 flex items-center justify-center transition-colors"
            onMouseDown={e => {
              e.preventDefault(); resizingPanel.current = true
              const startX = e.clientX, startW = panelWidth
              const move = ev => { const w = Math.max(200, Math.min(500, startW + (startX - ev.clientX))); setPanelWidth(w) }
              const up = () => { resizingPanel.current = false; localStorage.setItem('mm_email_panel', String(panelWidth)); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
              window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
            }}>
            <div className="w-0.5 h-8 bg-gray-300 rounded-full" />
          </div>

          {/* Properties panel */}
          {sel ? (
            <div style={{ width: panelWidth }} className="bg-white border-l border-gray-200 p-4 overflow-y-auto flex-shrink-0">
              <p className="text-[13px] font-semibold text-gray-700 uppercase mb-3">{BLOCK_TYPES.find(t => t.type === sel.type)?.label} Properties</p>
              <div className="space-y-3">
                {sel.type === 'header' && (<>
                  <Field label="Logo Text" value={sel.data.logoText} onChange={v => updateBlock(sel.id, { logoText: v })} />
                  <Field label="Tagline" value={sel.data.tagline} onChange={v => updateBlock(sel.id, { tagline: v })} />
                  <ColorField label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                  <ColorField label="Text Color" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                </>)}
                {sel.type === 'text' && (<>
                  <div><label className="text-[13px] text-gray-700 mb-1 block">Content</label>
                    <textarea className="input text-sm py-1 resize-none" rows={4} value={sel.data.content} onChange={e => updateBlock(sel.id, { content: e.target.value })} /></div>
                  <NumberField label="Font Size" value={sel.data.fontSize} onChange={v => updateBlock(sel.id, { fontSize: v })} min={10} max={36} />
                  <SelectField label="Align" value={sel.data.align} options={['left', 'center', 'right']} onChange={v => updateBlock(sel.id, { align: v })} />
                  <ColorField label="Text Color" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                  <ColorField label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                  <NumberField label="Padding" value={sel.data.padding} onChange={v => updateBlock(sel.id, { padding: v })} min={0} max={64} />
                </>)}
                {sel.type === 'image' && (<>
                  <div><button onClick={() => fileInputRef.current?.click()} className="w-full btn-secondary text-sm justify-center"><ImageIcon size={12} /> {sel.data.src ? 'Replace Image' : 'Upload Image'}</button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></div>
                  <Field label="Alt Text" value={sel.data.alt} onChange={v => updateBlock(sel.id, { alt: v })} />
                  <Field label="Caption" value={sel.data.caption} onChange={v => updateBlock(sel.id, { caption: v })} />
                  <ColorField label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                </>)}
                {sel.type === 'button' && (<>
                  <Field label="Button Text" value={sel.data.text} onChange={v => updateBlock(sel.id, { text: v })} />
                  <Field label="Link URL" value={sel.data.url} onChange={v => updateBlock(sel.id, { url: v })} />
                  <ColorField label="Button Color" value={sel.data.btnColor} onChange={v => updateBlock(sel.id, { btnColor: v })} />
                  <ColorField label="Text Color" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                  <SelectField label="Align" value={sel.data.align} options={['left', 'center', 'right']} onChange={v => updateBlock(sel.id, { align: v })} />
                  <NumberField label="Border Radius" value={sel.data.borderRadius} onChange={v => updateBlock(sel.id, { borderRadius: v })} min={0} max={32} />
                </>)}
                {sel.type === 'divider' && (<>
                  <ColorField label="Line Color" value={sel.data.color} onChange={v => updateBlock(sel.id, { color: v })} />
                  <NumberField label="Thickness" value={sel.data.thickness} onChange={v => updateBlock(sel.id, { thickness: v })} min={1} max={4} />
                </>)}
                {sel.type === 'spacer' && (<>
                  <NumberField label="Height" value={sel.data.height} onChange={v => updateBlock(sel.id, { height: v })} min={8} max={96} />
                </>)}
                {sel.type === 'twocol' && (<>
                  <div><label className="text-[13px] text-gray-700 mb-1 block">Left Column</label>
                    <textarea className="input text-sm py-1 resize-none" rows={3} value={sel.data.leftContent} onChange={e => updateBlock(sel.id, { leftContent: e.target.value })} /></div>
                  <div><label className="text-[13px] text-gray-700 mb-1 block">Right Column</label>
                    <textarea className="input text-sm py-1 resize-none" rows={3} value={sel.data.rightContent} onChange={e => updateBlock(sel.id, { rightContent: e.target.value })} /></div>
                  <ColorField label="Text Color" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                  <ColorField label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                </>)}
                {sel.type === 'footer' && (<>
                  <Field label="Footer Text" value={sel.data.text} onChange={v => updateBlock(sel.id, { text: v })} />
                  <Field label="Links" value={sel.data.links} onChange={v => updateBlock(sel.id, { links: v })} />
                  <ColorField label="Background" value={sel.data.bgColor} onChange={v => updateBlock(sel.id, { bgColor: v })} />
                  <ColorField label="Text Color" value={sel.data.textColor} onChange={v => updateBlock(sel.id, { textColor: v })} />
                </>)}
                <button onClick={() => deleteBlock(sel.id)} className="w-full flex items-center justify-center gap-1.5 text-sm text-red-500 hover:bg-red-50 py-2 rounded-lg transition-colors mt-2"><Trash2 size={12} /> Delete Block</button>
              </div>
            </div>
          ) : showPreview ? (
            <div style={{ width: panelWidth }} className="bg-white border-l border-gray-200 flex-shrink-0 overflow-hidden">
              <div className="p-3 border-b border-gray-100"><p className="text-[13px] font-semibold text-gray-700 uppercase">HTML Preview</p></div>
              <iframe srcDoc={generateHtml(blocks, subject)} className="w-full h-full border-none" title="Email Preview" style={{ transform: 'scale(0.4)', transformOrigin: 'top left', width: '250%', height: '250%' }} />
            </div>
          ) : (
            <div style={{ width: panelWidth }} className="bg-white border-l border-gray-200 p-4 flex-shrink-0">
              <p className="text-[13px] font-semibold text-gray-700 uppercase mb-3">Email Designer</p>
              <p className="text-sm text-gray-700 leading-relaxed">Click a block in the email to edit it. Use the left panel to add new blocks. Reorder with arrow buttons.</p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-brand-500" /><span className="text-[13px] text-gray-700">Koto Red: #ea2729</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-brand-500" /><span className="text-[13px] text-gray-700">Koto Teal: #59c6d0</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: '#231f20' }} /><span className="text-[13px] text-gray-700">Koto Dark: #231f20</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return <div><label className="text-[13px] text-gray-700 mb-1 block">{label}</label>
    <input className="input text-sm py-1" value={value || ''} onChange={e => onChange(e.target.value)} /></div>
}

function NumberField({ label, value, onChange, min = 0, max = 999 }) {
  return <div><label className="text-[13px] text-gray-700 mb-1 block">{label}</label>
    <input className="input text-sm py-1" type="number" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} /></div>
}

function ColorField({ label, value, onChange }) {
  return <ColorPicker label={label} value={value} onChange={onChange} />
}

function SelectField({ label, value, options, onChange }) {
  return <div><label className="text-[13px] text-gray-700 mb-1 block">{label}</label>
    <select className="input text-sm py-1" value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
}
