"use client";
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft, Plus, Trash2, GripVertical, Sparkles,
  Send, CheckCircle, FileText, Edit3, DollarSign,
  Clock, ChevronDown, ChevronUp, Copy, Eye,
  Loader2, Check, User, Building, X, AlertCircle,
  ArrowRight, Pen, Shield, ToggleLeft, ToggleRight
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import AIThinkingBox from '../components/AIThinkingBox'
import { supabase } from '../lib/supabase'
import { callClaude } from '../lib/ai'
import { useAuth } from '../hooks/useAuth'
import { useClient } from '../context/ClientContext'
import toast from 'react-hot-toast'

const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'

const PRICE_LABELS = { monthly:'/ mo', one_time:'one-time', hourly:'/ hr', custom:'custom' }

// ── Inline text editor with AI supercharge ─────────────────────────────────
function AITextarea({ value, onChange, placeholder, rows=4, clientContext='', fieldName='' }) {
  const [generating, setGenerating] = useState(false)

  async function supercharge() {
    if (!value.trim()) { toast.error('Write something first, then AI will supercharge it'); return }
    setGenerating(true)
    try {
      const result = await callClaude(
        `You are an expert marketing agency proposal writer. Rewrite the following ${fieldName || 'text'} to be more compelling, professional, and persuasive. Keep it concise but powerful. Use "we" and "our" for the agency. ${clientContext ? `Client context: ${clientContext}` : ''} Return ONLY the rewritten text, no preamble.`,
        value, 800
      )
      onChange(result)
      toast.success('AI supercharged!')
    } catch(e) {
      toast.error('AI unavailable — check API key')
    }
    setGenerating(false)
  }

  async function generateFresh() {
    if (!clientContext && !placeholder) return
    setGenerating(true)
    try {
      const result = await callClaude(
        `You are an expert marketing agency proposal writer. Write a compelling ${fieldName || 'section'} for an agency proposal. ${clientContext ? `Client context: ${clientContext}` : ''} Be professional, specific, and persuasive. Return ONLY the text, no preamble or headers.`,
        `Write the ${fieldName || 'section'}`, 600
      )
      onChange(result)
      toast.success('Generated!')
    } catch(e) {
      toast.error('AI unavailable')
    }
    setGenerating(false)
  }

  return (
    <div style={{ position:'relative' }}>
      <textarea value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{ width:'100%', padding:'12px 14px', paddingBottom:40, borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', resize:'vertical', fontFamily:'inherit', color:'#111', background:'#fff', lineHeight:1.65, boxSizing:'border-box' }}
        onFocus={e=>e.target.style.borderColor=ACCENT}
        onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
      {generating && (
        <div style={{ position:'absolute', bottom:44, left:8, right:8 }}>
          <AIThinkingBox active={generating} task='proposal' inline/>
        </div>
      )}
      <div style={{ position:'absolute', bottom:8, right:10, display:'flex', gap:6 }}>
        {!value?.trim() ? (
          <button onClick={generateFresh} disabled={generating}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 11px', borderRadius:7, border:'none', background:ACCENT, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', opacity:generating?.7:1 }}>
            {generating?<Loader2 size={11} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={11}/>}
            Generate with AI
          </button>
        ) : (
          <button onClick={supercharge} disabled={generating}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 11px', borderRadius:7, border:'none', background:'#7c3aed', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', opacity:generating?.7:1 }}>
            {generating?<Loader2 size={11} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={11}/>}
            {generating?'Supercharging…':'Supercharge with AI'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Section card (draggable service block) ─────────────────────────────────
function SectionCard({ section, index, total, clientContext, onChange, onDelete, onMoveUp, onMoveDown }) {
  const [expanded, setExpanded] = useState(true)
  const [generatingDeliverables, setGeneratingDeliverables] = useState(false)

  async function aiDeliverables() {
    setGeneratingDeliverables(true)
    try {
      const result = await callClaude(
        'You are an expert marketing agency proposal writer. Generate 4-6 specific, compelling deliverables for this service. Each should be a concrete, tangible item the client receives. Return ONLY a JSON array of strings, no other text.',
        `Service: ${section.title}\nDescription: ${section.content || ''}\n${clientContext ? `Client: ${clientContext}` : ''}`,
        400
      )
      const cleaned = result.replace(/```json|```/g,'').trim()
      const items = JSON.parse(cleaned.slice(cleaned.indexOf('['), cleaned.lastIndexOf(']')+1))
      onChange({ ...section, deliverables: items })
      toast.success('Deliverables generated!')
    } catch(e) {
      toast.error('Could not generate deliverables')
    }
    setGeneratingDeliverables(false)
  }

  const deliverables = Array.isArray(section.deliverables) ? section.deliverables :
    (typeof section.deliverables === 'string' ? JSON.parse(section.deliverables || '[]') : [])

  return (
    <div style={{ background:'#fff', borderRadius:14, border:`1.5px solid ${expanded?ACCENT+'30':'#e5e7eb'}`, overflow:'hidden', marginBottom:10 }}>
      {/* Card header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 16px', cursor:'pointer', background: expanded?'#f0fbfc':'#fff' }}
        onClick={()=>setExpanded(e=>!e)}>
        <GripVertical size={14} color="#d1d5db" style={{ flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <input value={section.title} onChange={e=>{e.stopPropagation();onChange({...section,title:e.target.value})}}
            onClick={e=>e.stopPropagation()}
            style={{ fontSize:15, fontWeight:700, color:'#111', border:'none', outline:'none', background:'transparent', width:'100%' }}
            placeholder="Section title…"/>
        </div>
        {section.price > 0 && (
          <span style={{ fontSize:15, fontWeight:800, color:ACCENT, flexShrink:0 }}>
            ${Number(section.price).toLocaleString()} {PRICE_LABELS[section.price_type]||''}
          </span>
        )}
        {section.is_optional && <span style={{ fontSize:13, padding:'2px 8px', borderRadius:20, background:'#f3f4f6', color:'#374151', fontWeight:700 }}>Optional</span>}
        <div style={{ display:'flex', gap:4 }} onClick={e=>e.stopPropagation()}>
          {index > 0     && <button onClick={()=>onMoveUp(index)}   style={{ padding:4, border:'none', background:'none', cursor:'pointer', color:'#4b5563' }}><ChevronUp size={13}/></button>}
          {index < total-1 && <button onClick={()=>onMoveDown(index)} style={{ padding:4, border:'none', background:'none', cursor:'pointer', color:'#4b5563' }}><ChevronDown size={13}/></button>}
          <button onClick={()=>onDelete(index)} style={{ padding:4, border:'none', background:'none', cursor:'pointer', color:'#fca5a5' }}><Trash2 size={13}/></button>
        </div>
        {expanded ? <ChevronUp size={13} color="#9ca3af"/> : <ChevronDown size={13} color="#9ca3af"/>}
      </div>

      {expanded && (
        <div style={{ padding:'0 16px 16px', borderTop:'1px solid #f9fafb' }}>
          {/* Description */}
          <div style={{ marginTop:12, marginBottom:12 }}>
            <label style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:6 }}>Description</label>
            <AITextarea value={section.content} onChange={v=>onChange({...section,content:v})}
              placeholder="Describe what this service includes and the value it delivers…"
              rows={3} clientContext={clientContext} fieldName={section.title + ' service description'}/>
          </div>

          {/* Deliverables */}
          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <label style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.05em' }}>Deliverables</label>
              <button onClick={aiDeliverables} disabled={generatingDeliverables}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:7, border:'none', background:'#7c3aed', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                {generatingDeliverables?<Loader2 size={10} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={10}/>}
                {generatingDeliverables?'Working…':'AI Generate'}
              </button>
            </div>
            {deliverables.map((d, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <Check size={12} color={ACCENT} style={{ flexShrink:0 }}/>
                <input value={d} onChange={e=>{const next=[...deliverables]; next[i]=e.target.value; onChange({...section,deliverables:next})}}
                  style={{ flex:1, fontSize:15, border:'none', borderBottom:'1px solid #f3f4f6', outline:'none', padding:'3px 0', color:'#374151', background:'transparent' }}/>
                <button onClick={()=>{ const next=deliverables.filter((_,j)=>j!==i); onChange({...section,deliverables:next}) }}
                  style={{ border:'none', background:'none', cursor:'pointer', color:'#fca5a5', padding:2 }}><X size={11}/></button>
              </div>
            ))}
            {generatingDeliverables && (
              <div style={{ marginTop:8 }}>
                <AIThinkingBox active={generatingDeliverables} task='proposal' label='Generating deliverables' inline/>
              </div>
            )}
            <button onClick={()=>onChange({...section,deliverables:[...deliverables,'']})}
              style={{ display:'flex', alignItems:'center', gap:6, fontSize:14, color:ACCENT, border:'none', background:'none', cursor:'pointer', marginTop:4, padding:'3px 0' }}>
              <Plus size={11}/> Add deliverable
            </button>
          </div>

          {/* Pricing row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 130px 160px auto', gap:10, alignItems:'end' }}>
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:5 }}>Timeline</label>
              <input value={section.timeline||''} onChange={e=>onChange({...section,timeline:e.target.value})}
                placeholder="e.g. 4–6 weeks, Ongoing"
                style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', color:'#111' }}/>
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:5 }}>Price</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'#4b5563' }}>$</span>
                <input type="number" value={section.price||''} onChange={e=>onChange({...section,price:+e.target.value})}
                  placeholder="0"
                  style={{ width:'100%', padding:'8px 12px 8px 24px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', color:'#111' }}/>
              </div>
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:5 }}>Billing type</label>
              <select value={section.price_type||'monthly'} onChange={e=>onChange({...section,price_type:e.target.value})}
                style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', color:'#111', background:'#fff' }}>
                {Object.entries(PRICE_LABELS).map(([k,v])=><option key={k} value={k}>{k.charAt(0).toUpperCase()+k.slice(1).replace('_',' ')} {v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:5 }}>Optional</label>
              <button onClick={()=>onChange({...section,is_optional:!section.is_optional})}
                style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', background:'#fff', cursor:'pointer', color:section.is_optional?ACCENT:'#9ca3af', display:'flex', alignItems:'center', gap:5, fontSize:14 }}>
                {section.is_optional?<ToggleRight size={15} color={ACCENT}/>:<ToggleLeft size={15}/>}
                {section.is_optional?'Yes':'No'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Module picker modal ────────────────────────────────────────────────────
function ModulePicker({ modules, onAdd, onClose }) {
  const [search, setSearch] = useState('')
  const cats = [...new Set(modules.map(m=>m.category))]
  const filtered = modules.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:600, maxHeight:'80vh', display:'flex', flexDirection:'column', overflow:'hidden' }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ padding:'20px 20px 14px', borderBottom:'1px solid #f3f4f6' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <h3 style={{ fontSize:17, fontWeight:800, color:'#111' }}>Add from Service Library</h3>
            <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', color:'#4b5563', padding:4 }}><X size={18}/></button>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f9fafb', borderRadius:10, padding:'8px 14px', border:'1.5px solid #e5e7eb' }}>
            <Edit3 size={14} color="#9ca3af"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search services…"
              style={{ border:'none', outline:'none', background:'transparent', fontSize:15, flex:1, color:'#111' }}/>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }}>
          {cats.map(cat => {
            const items = filtered.filter(m=>m.category===cat)
            if (!items.length) return null
            return (
              <div key={cat} style={{ marginBottom:18 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                  {cat.replace('_',' ')}
                </div>
                {items.map(m => (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:12, border:'1.5px solid #e5e7eb', marginBottom:8, cursor:'pointer', transition:'all .12s' }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor=ACCENT; e.currentTarget.style.background='#f0fbfc' }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.background='#fff' }}
                    onClick={()=>{ onAdd(m); onClose() }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:'#111', marginBottom:2 }}>{m.name}</div>
                      <div style={{ fontSize:14, color:'#4b5563', lineHeight:1.5 }}>{m.description?.slice(0,80)}{m.description?.length>80?'…':''}</div>
                    </div>
                    {m.price > 0 && (
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:15, fontWeight:800, color:ACCENT }}>${Number(m.price).toLocaleString()}</div>
                        <div style={{ fontSize:13, color:'#4b5563' }}>{PRICE_LABELS[m.price_type]||''}</div>
                      </div>
                    )}
                    <Plus size={16} color={ACCENT}/>
                  </div>
                ))}
              </div>
            )
          })}
          <button onClick={()=>{ onAdd(null); onClose() }}
            style={{ width:'100%', padding:'12px', borderRadius:12, border:`1.5px dashed ${ACCENT}`, background:'#f0fbfc', color:ACCENT, fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
            <Plus size={14}/> Add blank section
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Main builder
// ══════════════════════════════════════════════════════════════════════════════
export default function ProposalBuilderPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { agencyId } = useAuth()
  const { clients } = useClient()

  const [proposal, setProposal] = useState(null)
  const [sections, setSections] = useState([])
  const [modules, setModules]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [showModulePicker, setShowModulePicker] = useState(false)
  const [activePanel, setActivePanel] = useState('build') // build | preview | sign
  const [sending, setSending]   = useState(false)
  const [converting, setConverting] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => { load() }, [id])

  // Auto-convert to agreement if param set
  useEffect(() => {
    if (searchParams.get('convert') === 'agreement' && proposal) {
      convertToAgreement()
    }
  }, [proposal, searchParams.get('convert')])

  async function load() {
    const [{ data: prop }, { data: secs }, { data: mods }] = await Promise.all([
      supabase.from('proposals').select('*, clients(*)').eq('id', id).single(),
      supabase.from('proposal_sections').select('*').eq('proposal_id', id).order('sort_order'),
      supabase.from('service_modules').select('*').eq('agency_id', agencyId).eq('is_active', true).order('sort_order'),
    ])
    setProposal(prop || {})
    setSections(secs || [])
    setModules(mods || [])
    setLoading(false)
  }

  // Debounced auto-save
  const scheduleAutoSave = useCallback((updatedProposal, updatedSections) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(updatedProposal, updatedSections), 1200)
  }, [])

  function setProp(key, val) {
    const next = { ...proposal, [key]: val }
    setProposal(next)
    scheduleAutoSave(next, sections)
  }

  function setSec(index, updated) {
    const next = sections.map((s, i) => i === index ? updated : s)
    setSections(next)
    scheduleAutoSave(proposal, next)
  }

  function addSection(module) {
    const newSec = module ? {
      proposal_id: id, module_id: module.id,
      type: 'service', title: module.name, content: module.description,
      deliverables: typeof module.deliverables === 'string' ? JSON.parse(module.deliverables||'[]') : (module.deliverables||[]),
      price: module.price, price_type: module.price_type, timeline: module.timeline,
      sort_order: sections.length, is_optional: false,
    } : {
      proposal_id: id, type: 'service', title: 'New Section', content: '',
      deliverables: [], price: null, price_type: 'monthly', sort_order: sections.length, is_optional: false,
    }
    const next = [...sections, newSec]
    setSections(next)
    scheduleAutoSave(proposal, next)
  }

  function deleteSection(index) {
    const next = sections.filter((_, i) => i !== index).map((s, i) => ({ ...s, sort_order: i }))
    setSections(next)
    scheduleAutoSave(proposal, next)
  }

  function moveSection(from, to) {
    const next = [...sections]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    const reordered = next.map((s, i) => ({ ...s, sort_order: i }))
    setSections(reordered)
    scheduleAutoSave(proposal, reordered)
  }

  async function save(p = proposal, s = sections) {
    setSaving(true)
    const total = s.reduce((sum, sec) => sec.price_type === 'monthly' ? sum + (sec.price||0) : sum, 0)
    await supabase.from('proposals').update({
      title: p.title, client_id: p.client_id, type: p.type,
      intro: p.intro, executive_summary: p.executive_summary,
      terms: p.terms, valid_until: p.valid_until,
      total_value: total, updated_at: new Date().toISOString(),
    }).eq('id', id)

    // Upsert sections
    const existingIds = s.filter(s=>s.id).map(s=>s.id)
    const { data: currentSecs } = await supabase.from('proposal_sections').select('id').eq('proposal_id', id)
    const toDelete = (currentSecs||[]).filter(cs=>!existingIds.includes(cs.id)).map(cs=>cs.id)
    if (toDelete.length) await supabase.from('proposal_sections').delete().in('id', toDelete)

    for (const sec of s) {
      const payload = { proposal_id:id, title:sec.title, content:sec.content,
        deliverables: typeof sec.deliverables==='string'?sec.deliverables:JSON.stringify(sec.deliverables||[]),
        price:sec.price, price_type:sec.price_type, timeline:sec.timeline,
        sort_order:sec.sort_order, is_optional:sec.is_optional, module_id:sec.module_id||null }
      if (sec.id) await supabase.from('proposal_sections').update(payload).eq('id', sec.id)
      else {
        const { data: ins } = await supabase.from('proposal_sections').insert(payload).select().single()
        if (ins) sec.id = ins.id
      }
    }
    setSaving(false)
  }

  async function sendProposal() {
    setSending(true)
    await save()
    await supabase.from('proposals').update({ status:'sent', sent_at: new Date().toISOString() }).eq('id', id)
    setProposal(p=>({...p, status:'sent'}))
    const link = `${window.location.origin}/p/${proposal.public_token}`
    navigator.clipboard.writeText(link)
    toast.success('Status set to Sent — client link copied to clipboard!')
    setSending(false)
  }

  async function convertToAgreement() {
    setConverting(true)
    await save()
    await supabase.from('proposals').update({ type:'agreement', status:'agreement' }).eq('id', id)
    setProposal(p=>({...p, type:'agreement', status:'agreement'}))
    toast.success('Converted to Agreement — ready for signatures')
    setConverting(false)
    setActivePanel('sign')
  }

  const clientContext = proposal?.clients
    ? `${proposal.clients.name} — ${proposal.clients.industry || ''} business`
    : ''

  const totalMonthly = sections.filter(s=>s.price_type==='monthly').reduce((sum,s)=>sum+(s.price||0),0)
  const totalOneTime = sections.filter(s=>s.price_type==='one_time').reduce((sum,s)=>sum+(s.price||0),0)

  if (loading) return (
    <div className="page-shell" style={{ display:'flex', height:'100vh' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Loader2 size={28} color={ACCENT} style={{ animation:'spin 1s linear infinite' }}/>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', height:'100vh', background:'#f4f4f5', overflow:'hidden' }}>
      <Sidebar/>

      {showModulePicker && <ModulePicker modules={modules} onAdd={addSection} onClose={()=>setShowModulePicker(false)}/>}

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Top bar */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'10px 20px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <button onClick={()=>navigate('/proposals')}
            style={{ display:'flex', alignItems:'center', gap:5, border:'none', background:'none', cursor:'pointer', color:'#374151', fontSize:15 }}>
            <ChevronLeft size={15}/> Proposals
          </button>
          <div style={{ width:'1px', height:16, background:'#e5e7eb' }}/>
          <input value={proposal.title||''} onChange={e=>setProp('title',e.target.value)}
            style={{ fontSize:15, fontWeight:700, color:'#111', border:'none', outline:'none', flex:1, background:'transparent' }}
            placeholder="Proposal title…"/>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:14, color:'#4b5563', display:'flex', alignItems:'center', gap:5 }}>
              {saving ? <AIThinkingBox active={saving} task='proposal' label='Saving' inline dark/> : <><Check size={11} color="#16a34a"/> Saved</>}
            </span>
          </div>
          {/* Panel switcher */}
          <div style={{ display:'flex', gap:2, background:'#f3f4f6', borderRadius:9, padding:3 }}>
            {[['build','Build'],['preview','Preview'],['sign','Sign']].map(([p,l])=>(
              <button key={p} onClick={()=>setActivePanel(p)}
                style={{ padding:'5px 14px', borderRadius:7, border:'none', background:activePanel===p?'#fff':'transparent', color:activePanel===p?'#111':'#6b7280', fontSize:14, fontWeight:activePanel===p?700:500, cursor:'pointer', boxShadow:activePanel===p?'0 1px 3px rgba(0,0,0,.1)':'' }}>
                {l}
              </button>
            ))}
          </div>

          {/* Actions */}
          <select value={proposal.type||'proposal'} onChange={e=>setProp('type',e.target.value)}
            style={{ padding:'7px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, color:'#374151', background:'#fff', outline:'none' }}>
            <option value="proposal">Proposal</option>
            <option value="sow">Statement of Work</option>
            <option value="agreement">Agreement</option>
          </select>

          {proposal.type !== 'agreement' && (
            <button onClick={convertToAgreement} disabled={converting}
              style={{ padding:'7px 14px', borderRadius:9, border:'none', background:'#7c3aed', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              <FileText size={13}/> {converting?'Converting…':'Convert to Agreement'}
            </button>
          )}

          <button onClick={sendProposal} disabled={sending}
            style={{ padding:'7px 16px', borderRadius:9, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:`0 4px 12px ${ACCENT}40` }}>
            <Send size={13}/> {sending?'Sending…':'Send to Client'}
          </button>
        </div>

        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

          {/* ── BUILD PANEL ── */}
          {activePanel === 'build' && (
            <>
              {/* Left: settings */}
              <div style={{ width:280, flexShrink:0, background:'#fff', borderRight:'1px solid #e5e7eb', overflowY:'auto', padding:'18px 16px' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>Proposal Settings</div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:14, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Client</label>
                  <select value={proposal.client_id||''} onChange={e=>setProp('client_id',e.target.value||null)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, color:'#111', background:'#fff', outline:'none' }}>
                    <option value="">Select client…</option>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:14, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Valid until</label>
                  <input type="date" value={proposal.valid_until||''} onChange={e=>setProp('valid_until',e.target.value)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, color:'#111', outline:'none' }}/>
                </div>

                <div style={{ height:'0.5px', background:'#f3f4f6', margin:'14px 0' }}/>

                {/* Pricing summary */}
                <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Pricing Summary</div>
                {totalMonthly > 0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, color:'#374151', marginBottom:6 }}>
                    <span>Monthly recurring</span>
                    <span style={{ fontWeight:700 }}>${totalMonthly.toLocaleString()}/mo</span>
                  </div>
                )}
                {totalOneTime > 0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, color:'#374151', marginBottom:6 }}>
                    <span>One-time fees</span>
                    <span style={{ fontWeight:700 }}>${totalOneTime.toLocaleString()}</span>
                  </div>
                )}
                {sections.filter(s=>s.is_optional&&s.price>0).length > 0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, color:'#4b5563', marginBottom:6 }}>
                    <span>Optional add-ons</span>
                    <span>${sections.filter(s=>s.is_optional).reduce((sum,s)=>sum+(s.price||0),0).toLocaleString()}</span>
                  </div>
                )}
                {totalMonthly === 0 && totalOneTime === 0 && (
                  <div style={{ fontSize:15, color:'#d1d5db' }}>Add sections with pricing</div>
                )}

                <div style={{ height:'0.5px', background:'#f3f4f6', margin:'14px 0' }}/>

                <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Client link</div>
                <div style={{ display:'flex', gap:6 }}>
                  <div style={{ flex:1, fontSize:13, color:'#374151', background:'#f9fafb', padding:'7px 10px', borderRadius:8, border:'1px solid #f3f4f6', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    /p/{proposal.public_token?.slice(0,16)}…
                  </div>
                  <button onClick={()=>{ navigator.clipboard.writeText(`${window.location.origin}/p/${proposal.public_token}`); toast.success('Copied!') }}
                    style={{ padding:'7px 10px', borderRadius:8, border:'1.5px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#374151', display:'flex', alignItems:'center' }}>
                    <Copy size={13}/>
                  </button>
                </div>
              </div>

              {/* Center: editor */}
              <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

                {/* Intro */}
                <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 20px', marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Introduction / Cover Letter</div>
                  <AITextarea value={proposal.intro} onChange={v=>setProp('intro',v)}
                    placeholder="Start with a warm, personalized introduction. Reference the client's business and what you talked about…"
                    rows={4} clientContext={clientContext} fieldName="proposal introduction"/>
                </div>

                {/* Executive Summary */}
                <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 20px', marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Executive Summary</div>
                  <AITextarea value={proposal.executive_summary} onChange={v=>setProp('executive_summary',v)}
                    placeholder="Summarize the challenge, your approach, and expected outcomes in 2-3 paragraphs…"
                    rows={5} clientContext={clientContext} fieldName="executive summary"/>
                </div>

                {/* Service sections */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.06em' }}>Services & Deliverables</div>
                    <button onClick={()=>setShowModulePicker(true)}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, border:`1.5px solid ${ACCENT}`, background:'#f0fbfc', color:ACCENT, fontSize:14, fontWeight:700, cursor:'pointer' }}>
                      <Plus size={13}/> Add Service
                    </button>
                  </div>

                  {sections.length === 0 ? (
                    <div style={{ background:'#fff', borderRadius:14, border:`2px dashed ${ACCENT}30`, padding:'40px 24px', textAlign:'center', cursor:'pointer' }}
                      onClick={()=>setShowModulePicker(true)}>
                      <Plus size={28} color={ACCENT} style={{ margin:'0 auto 12px' }}/>
                      <div style={{ fontSize:15, fontWeight:700, color:'#374151', marginBottom:6 }}>Add your first service</div>
                      <div style={{ fontSize:15, color:'#4b5563' }}>Pick from your service library or add a blank section</div>
                    </div>
                  ) : (
                    sections.map((sec, i) => (
                      <SectionCard key={i} section={sec} index={i} total={sections.length}
                        clientContext={clientContext}
                        onChange={updated => setSec(i, updated)}
                        onDelete={() => deleteSection(i)}
                        onMoveUp={() => moveSection(i, i-1)}
                        onMoveDown={() => moveSection(i, i+1)}/>
                    ))
                  )}

                  {sections.length > 0 && (
                    <button onClick={()=>setShowModulePicker(true)}
                      style={{ width:'100%', padding:'12px', borderRadius:12, border:`1.5px dashed #e5e7eb`, background:'#fff', color:'#4b5563', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, marginTop:8 }}>
                      <Plus size={13}/> Add another service
                    </button>
                  )}
                </div>

                {/* Terms */}
                <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Terms & Conditions</div>
                  <AITextarea value={proposal.terms} onChange={v=>setProp('terms',v)}
                    placeholder="Payment terms, revision policy, cancellation terms, intellectual property rights…"
                    rows={5} clientContext={clientContext} fieldName="terms and conditions"/>
                </div>

              </div>
            </>
          )}

          {/* ── PREVIEW PANEL ── */}
          {activePanel === 'preview' && (
            <div style={{ flex:1, overflowY:'auto', background:'#f4f4f5', padding:'32px' }}>
              <div style={{ maxWidth:780, margin:'0 auto', background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                {/* Proposal header */}
                <div style={{ background:'#18181b', padding:'40px 48px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>
                    {proposal.type === 'agreement' ? 'Service Agreement' : proposal.type === 'sow' ? 'Statement of Work' : 'Proposal'}
                  </div>
                  <h1 style={{ fontSize:28, fontWeight:900, color:'#fff', marginBottom:10 }}>{proposal.title}</h1>
                  {proposal.clients && <div style={{ fontSize:15, color:'rgba(255,255,255,.5)' }}>Prepared for {proposal.clients.name}</div>}
                  {proposal.valid_until && <div style={{ fontSize:15, color:'rgba(255,255,255,.4)', marginTop:6 }}>Valid until {new Date(proposal.valid_until).toLocaleDateString()}</div>}
                </div>

                <div style={{ padding:'40px 48px' }}>
                  {proposal.intro && (
                    <div style={{ marginBottom:32 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Introduction</div>
                      <div style={{ fontSize:15, color:'#374151', lineHeight:1.8, whiteSpace:'pre-wrap' }}>{proposal.intro}</div>
                    </div>
                  )}
                  {proposal.executive_summary && (
                    <div style={{ marginBottom:32 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Executive Summary</div>
                      <div style={{ fontSize:15, color:'#374151', lineHeight:1.8, whiteSpace:'pre-wrap' }}>{proposal.executive_summary}</div>
                    </div>
                  )}

                  {/* Sections */}
                  {sections.length > 0 && (
                    <div style={{ marginBottom:32 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:16 }}>Services & Deliverables</div>
                      {sections.map((sec, i) => {
                        const delivs = typeof sec.deliverables==='string' ? JSON.parse(sec.deliverables||'[]') : (sec.deliverables||[])
                        return (
                          <div key={i} style={{ borderLeft:`3px solid ${ACCENT}`, paddingLeft:20, marginBottom:28 }}>
                            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:8 }}>
                              <h3 style={{ fontSize:16, fontWeight:800, color:'#111' }}>{sec.title}</h3>
                              <div style={{ textAlign:'right' }}>
                                {sec.price > 0 && <span style={{ fontSize:16, fontWeight:800, color:ACCENT }}>${Number(sec.price).toLocaleString()} {PRICE_LABELS[sec.price_type]}</span>}
                                {sec.is_optional && <div style={{ fontSize:13, color:'#4b5563' }}>Optional</div>}
                              </div>
                            </div>
                            {sec.content && <div style={{ fontSize:15, color:'#374151', lineHeight:1.7, marginBottom:10, whiteSpace:'pre-wrap' }}>{sec.content}</div>}
                            {delivs.filter(d=>d).length > 0 && (
                              <div>
                                {delivs.filter(d=>d).map((d,j)=>(
                                  <div key={j} style={{ display:'flex', alignItems:'center', gap:8, fontSize:15, color:'#374151', marginBottom:4 }}>
                                    <Check size={12} color={ACCENT} style={{ flexShrink:0 }}/> {d}
                                  </div>
                                ))}
                              </div>
                            )}
                            {sec.timeline && <div style={{ fontSize:14, color:'#4b5563', marginTop:8, display:'flex', alignItems:'center', gap:5 }}><Clock size={11}/> {sec.timeline}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Pricing summary */}
                  {(totalMonthly > 0 || totalOneTime > 0) && (
                    <div style={{ background:'#f9fafb', borderRadius:12, padding:'20px 24px', marginBottom:32, border:'1px solid #f3f4f6' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Investment Summary</div>
                      {totalMonthly > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, color:'#374151', marginBottom:6 }}><span>Monthly retainer</span><span style={{ fontWeight:800 }}>${totalMonthly.toLocaleString()}/mo</span></div>}
                      {totalOneTime > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, color:'#374151' }}><span>One-time setup</span><span style={{ fontWeight:800 }}>${totalOneTime.toLocaleString()}</span></div>}
                    </div>
                  )}

                  {proposal.terms && (
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Terms & Conditions</div>
                      <div style={{ fontSize:15, color:'#374151', lineHeight:1.8, whiteSpace:'pre-wrap' }}>{proposal.terms}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SIGN PANEL ── */}
          {activePanel === 'sign' && (
            <SignaturePanel proposalId={id} proposal={proposal} sections={sections} totalMonthly={totalMonthly} totalOneTime={totalOneTime}/>
          )}

        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Signature Panel ────────────────────────────────────────────────────────────
function SignaturePanel({ proposalId, proposal, sections, totalMonthly, totalOneTime }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing]   = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signerTitle, setSignerTitle] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [agencyName, setAgencyName]   = useState('')
  const [agreed, setAgreed]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [existingSig, setExistingSig] = useState(null)
  const [agencySig, setAgencySig]     = useState(null)

  useEffect(() => {
    supabase.from('proposal_signatures').select('*').eq('proposal_id', proposalId).then(({data}) => {
      if (data) {
        setExistingSig(data.find(s=>s.party==='client')||null)
        setAgencySig(data.find(s=>s.party==='agency')||null)
      }
    })
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    }
  }, [])

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const t = e.touches?.[0] || e
    return { x: t.clientX - rect.left, y: t.clientY - rect.top }
  }

  function start(e) {
    e.preventDefault()
    setDrawing(true)
    const ctx = canvasRef.current.getContext('2d')
    const {x, y} = getPos(e, canvasRef.current)
    ctx.beginPath(); ctx.moveTo(x, y)
  }

  function move(e) {
    e.preventDefault()
    if (!drawing) return
    const ctx = canvasRef.current.getContext('2d')
    const {x, y} = getPos(e, canvasRef.current)
    ctx.lineTo(x, y); ctx.stroke()
  }

  function clearSig() {
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  async function sign(party) {
    const sigData = canvasRef.current.toDataURL('image/png')
    const name = party === 'agency' ? agencyName : signerName
    if (!name.trim() || !agreed) { toast.error('Fill in your name and check the agreement box'); return }
    setSubmitting(true)
    const { error } = await supabase.from('proposal_signatures').insert({
      proposal_id: proposalId,
      signer_name: name, signer_email: signerEmail, signer_title: signerTitle,
      signature_data: sigData, party,
    })
    if (error) { toast.error('Failed to save signature'); setSubmitting(false); return }

    // If both parties signed, mark as accepted
    const { data: sigs } = await supabase.from('proposal_signatures').select('party').eq('proposal_id', proposalId)
    const parties = sigs?.map(s=>s.party)||[]
    if (parties.includes('client') || party === 'client') {
      await supabase.from('proposals').update({ status:'accepted', accepted_at: new Date().toISOString() }).eq('id', proposalId)
    }

    party === 'client' ? setExistingSig({ signer_name: name, signed_at: new Date().toISOString() }) : setAgencySig({ signer_name: name, signed_at: new Date().toISOString() })
    toast.success(party === 'client' ? 'Client signature saved!' : 'Agency signature saved!')
    setSubmitting(false)
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'28px 32px', background:'#f4f4f5' }}>
      <div style={{ maxWidth:680, margin:'0 auto' }}>

        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'24px 28px', marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#111', marginBottom:4 }}>
            {proposal.type === 'agreement' ? 'Service Agreement' : 'Proposal'}: {proposal.title}
          </div>
          {(totalMonthly > 0 || totalOneTime > 0) && (
            <div style={{ fontSize:15, color:'#374151' }}>
              {totalMonthly > 0 && <span>${totalMonthly.toLocaleString()}/mo recurring</span>}
              {totalMonthly > 0 && totalOneTime > 0 && <span> + </span>}
              {totalOneTime > 0 && <span>${totalOneTime.toLocaleString()} one-time</span>}
            </div>
          )}
        </div>

        {/* Agency signature */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'24px 28px', marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#111', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            <Shield size={16} color={ACCENT}/> Agency Signature
          </div>
          {agencySig ? (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'#f0fdf4', borderRadius:10 }}>
              <CheckCircle size={16} color="#16a34a"/>
              <div style={{ fontSize:15, color:'#16a34a' }}>Signed by {agencySig.signer_name} · {new Date(agencySig.signed_at).toLocaleString()}</div>
            </div>
          ) : (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', display:'block', marginBottom:4 }}>Your name</label>
                  <input value={agencyName} onChange={e=>setAgencyName(e.target.value)} placeholder="Full legal name"
                    style={{ width:'100%', padding:'8px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', display:'block', marginBottom:4 }}>Title</label>
                  <input value={signerTitle} onChange={e=>setSignerTitle(e.target.value)} placeholder="CEO, Account Manager…"
                    style={{ width:'100%', padding:'8px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                </div>
              </div>
              <label style={{ fontSize:14, color:'#374151', display:'flex', alignItems:'flex-start', gap:8, marginBottom:12, cursor:'pointer' }}>
                <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{ marginTop:2 }}/>
                I authorize this {proposal.type || 'proposal'} and agree to its terms on behalf of the agency.
              </label>
              <SignatureCanvas canvasRef={canvasRef} onStart={start} onMove={move} onEnd={()=>setDrawing(false)} onClear={clearSig}/>
              <button onClick={()=>sign('agency')} disabled={submitting||!agencyName.trim()||!agreed}
                style={{ width:'100%', marginTop:12, padding:'11px', borderRadius:10, border:'none', background:'#18181b', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', opacity:!agencyName.trim()||!agreed?.5:1 }}>
                {submitting?'Saving…':'Sign as Agency'}
              </button>
            </div>
          )}
        </div>

        {/* Client signature */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'24px 28px', marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#111', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            <User size={16} color="#3b82f6"/> Client Signature
          </div>
          {existingSig ? (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'#f0fdf4', borderRadius:10 }}>
              <CheckCircle size={16} color="#16a34a"/>
              <div style={{ fontSize:15, color:'#16a34a' }}>Signed by {existingSig.signer_name} · {new Date(existingSig.signed_at).toLocaleString()}</div>
            </div>
          ) : (
            <div>
              <div style={{ padding:'12px 14px', background:'#eff6ff', borderRadius:10, marginBottom:14, fontSize:15, color:'#1d4ed8' }}>
                Share the client link and they can sign directly from their browser — no account needed.
                <button onClick={()=>{ navigator.clipboard.writeText(`${window.location.origin}/p/${proposal.public_token}`); toast.success('Link copied!') }}
                  style={{ display:'block', marginTop:6, fontSize:14, color:'#1d4ed8', fontWeight:700, background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0 }}>
                  Copy client signing link →
                </button>
              </div>
              <div style={{ fontSize:14, color:'#4b5563', textAlign:'center' }}>— or sign on their behalf —</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, margin:'12px 0' }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', display:'block', marginBottom:4 }}>Client name</label>
                  <input value={signerName} onChange={e=>setSignerName(e.target.value)} placeholder="Client's full name"
                    style={{ width:'100%', padding:'8px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', display:'block', marginBottom:4 }}>Email</label>
                  <input value={signerEmail} onChange={e=>setSignerEmail(e.target.value)} placeholder="client@email.com"
                    style={{ width:'100%', padding:'8px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                </div>
              </div>
              <button onClick={()=>sign('client')} disabled={submitting||!signerName.trim()}
                style={{ width:'100%', padding:'11px', borderRadius:10, border:'none', background:'#3b82f6', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', opacity:!signerName.trim()?.5:1 }}>
                {submitting?'Saving…':'Save Client Signature'}
              </button>
            </div>
          )}
        </div>

        {agencySig && existingSig && (
          <div style={{ background:'#f0fdf4', borderRadius:14, border:'1px solid #bbf7d0', padding:'16px 20px', display:'flex', alignItems:'center', gap:12 }}>
            <CheckCircle size={20} color="#16a34a"/>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#16a34a' }}>Fully executed — both parties signed</div>
              <div style={{ fontSize:14, color:'#16a34a', opacity:.8 }}>This agreement is legally binding. Keep a copy for your records.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SignatureCanvas({ canvasRef, onStart, onMove, onEnd, onClear }) {
  return (
    <div>
      <label style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', display:'block', marginBottom:5 }}>Signature</label>
      <div style={{ border:'2px dashed #e5e7eb', borderRadius:12, overflow:'hidden', background:'#fff', position:'relative' }}>
        <canvas ref={canvasRef} width={600} height={140} style={{ width:'100%', cursor:'crosshair', display:'block' }}
          onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
          onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}/>
        <button onClick={onClear} style={{ position:'absolute', top:8, right:8, fontSize:13, color:'#4b5563', border:'none', background:'none', cursor:'pointer' }}>Clear</button>
        <div style={{ position:'absolute', bottom:6, left:0, right:0, borderTop:'1px solid #f3f4f6', pointerEvents:'none' }}/>
      </div>
      <div style={{ fontSize:13, color:'#4b5563', marginTop:4 }}>Draw signature above using mouse or touchscreen</div>
    </div>
  )
}
