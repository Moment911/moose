"use client";
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Search, Plus, Sparkles, Check, X, Edit2, Trash2,
  Globe, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown,
  Loader2, RefreshCw, Tag, Eye, EyeOff, Filter, ArrowRight,
  CheckCircle, AlertCircle, ExternalLink, Zap, Brain, MessageSquare
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  searchKnowledge, generateAnswer, addKnowledgeEntry,
  getAllKnowledge, rateAnswer
} from '../../lib/qaKnowledge'
import toast from 'react-hot-toast'
import { useMobile } from '../../hooks/useMobile'
import { MobilePage, MobilePageHeader, MobileSearch, MobileCard, MobileRow, MobileEmpty, MobileTabs, MobileSectionHeader } from '../../components/mobile/MobilePage'

const RED = '#E6007E'
const TEAL  = '#00C2CB'
const BLACK = '#0a0a0a'

const SOURCE_CFG = {
  manual:       { label:'Manual',    color:'#374151', bg:'#f3f4f6',  icon:'✍️' },
  ticket:       { label:'Ticket',    color:'#7c3aed', bg:'#f5f3ff',  icon:'🎫' },
  web_search:   { label:'Web',       color:'#0e7490', bg:'#e8f9fa',  icon:'🌐' },
  ai_generated: { label:'AI',        color:'#d97706', bg:'#fffbeb',  icon:'🤖' },
}

const CATS = ['all','general','seo','ads','content','design','billing','technical','social','reporting']

// ── Markdown renderer (simple) ─────────────────────────────────────────────────
function MarkdownText({ text }) {
  if (!text) return null
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:900;color:#111;margin:14px 0 6px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:900;color:#111;margin:16px 0 8px;">$1</h2>')
    .replace(/^- (.+)$/gm, '<li style="margin-bottom:4px;">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin-bottom:4px;"><strong>$1.</strong> $2</li>')
    .replace(/\n\n/g, '</p><p style="margin:10px 0;">')
    .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:13px;font-family:monospace;">$1</code>')
  return <div style={{fontSize:15,color:'#374151',lineHeight:1.75}} dangerouslySetInnerHTML={{__html:`<p style="margin:0">${html}</p>`}}/>
}

// ── Q&A Ask interface ──────────────────────────────────────────────────────────
function AskInterface({ agencyId }) {
  const [q, setQ]               = useState('')
  const [searching, setSearching]= useState(false)
  const [progress, setProgress]  = useState('')
  const [result, setResult]      = useState(null)
  const [saved, setSaved]        = useState(false)
  const [pct, setPct]            = useState(0)

  async function ask() {
    if (!q.trim()) return
    setSearching(true); setResult(null); setSaved(false); setPct(0)
    try {
      const ans = await generateAnswer(q.trim(), agencyId, (msg, p) => {
        setProgress(msg); setPct(p)
      })
      setResult(ans)
    } catch(e) { toast.error(e.message) }
    setSearching(false); setProgress(''); setPct(0)
  }

  async function saveToKB() {
    if (!result) return
    const { error } = await addKnowledgeEntry({
      question:     q,
      answer:       result.answer,
      answer_short: result.short_answer,
      category:     result.category || 'general',
      tags:         result.tags || [],
      source:       'ai_generated',
      is_verified:  false,
    }, agencyId)
    if (error) toast.error(error.message)
    else { toast.success('Saved to knowledge base!'); setSaved(true) }
  }

  return (
    <div style={{marginBottom:32}}>
      {/* Search bar */}
      <div style={{background:'#fff',borderRadius:14,border:'1px solid #ececea',
        padding:'4px 4px 4px 20px',display:'flex',alignItems:'center',gap:8,
        boxShadow:'0 4px 24px rgba(0,0,0,.06)'}}>
        <Brain size={18} color={TEAL} style={{flexShrink:0}}/>
        <input
          value={q} onChange={e=>setQ(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&!searching&&ask()}
          placeholder="Ask anything — how to improve Google rankings, why ads aren't converting, what's schema markup…"
          style={{flex:1,border:'none',outline:'none',fontSize:16,color:'#111',
            background:'transparent',padding:'12px 0',fontFamily:'inherit'}}/>
        <button onClick={ask} disabled={searching||!q.trim()}
          style={{display:'flex',alignItems:'center',gap:8,padding:'11px 24px',
            borderRadius:12,border:'none',background:searching||!q.trim()?'#e5e7eb':RED,
            color:searching||!q.trim()?'#9ca3af':'#fff',fontSize:15,fontWeight:800,
            cursor:searching||!q.trim()?'not-allowed':'pointer',transition:'all .2s',
            boxShadow:!searching&&q.trim()?`0 4px 14px ${RED}40`:'none'}}>
          {searching
            ? <><Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/> Searching…</>
            : <><Sparkles size={15}/> Ask AI</>}
        </button>
      </div>

      {/* Progress */}
      {searching && (
        <div style={{marginTop:16,background: '#ffffff',borderRadius:14,padding:'18px 22px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <Sparkles size={15} color={TEAL} style={{animation:'spin 2s linear infinite'}}/>
            <div style={{fontSize:14,fontWeight:700,color:TEAL}}>{progress || 'Thinking…'}</div>
            <div style={{marginLeft:'auto',fontSize:13,fontWeight:800,color:'#999999'}}>{pct}%</div>
          </div>
          <div style={{height:4,background:'rgba(255,255,255,.1)',borderRadius:2,overflow:'hidden'}}>
            <div style={{height:'100%',width:pct+'%',background:`linear-gradient(90deg,${TEAL},${RED})`,
              borderRadius:2,transition:'width .4s ease'}}/>
          </div>
        </div>
      )}

      {/* Answer */}
      {result && !searching && (
        <div style={{marginTop:16,background:'#fff',borderRadius:14,
          border:'1px solid #ececea',overflow:'hidden',
          boxShadow:'0 4px 24px rgba(0,0,0,.06)'}}>

          {/* Short answer hero */}
          <div style={{background: '#ffffff',padding:'22px 26px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <Brain size={15} color={TEAL}/>
              <span style={{fontSize:13,fontWeight:800,color:TEAL,textTransform:'uppercase',letterSpacing:'.08em'}}>AI Answer</span>
              <span style={{fontSize:13,fontWeight:700,color:'#999999',marginLeft:'auto'}}>
                Confidence: {Math.round((result.confidence||0.85)*100)}%
              </span>
            </div>
            <p style={{fontSize:18,fontWeight:800,color:'#fff',lineHeight:1.55,margin:0}}>
              {result.short_answer}
            </p>
          </div>

          {/* Full answer */}
          <div style={{padding:'24px 26px'}}>
            <MarkdownText text={result.answer}/>

            {/* Web sources */}
            {result.web_sources?.length > 0 && (
              <div style={{marginTop:20,paddingTop:18,borderTop:'1px solid #f3f4f6'}}>
                <div style={{fontSize:13,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',
                  letterSpacing:'.07em',marginBottom:10}}>Sources</div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {result.web_sources.slice(0,4).map((s,i)=>(
                    <a key={i} href={s.url} target="_blank" rel="noreferrer"
                      style={{display:'flex',alignItems:'flex-start',gap:8,padding:'10px 12px',
                        borderRadius:10,background:'#f8f8f6',border:'1px solid #f3f4f6',
                        textDecoration:'none',transition:'all .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f0fbfc'}
                      onMouseLeave={e=>e.currentTarget.style.background='#f9fafb'}>
                      <Globe size={13} color={TEAL} style={{flexShrink:0,marginTop:2}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:'#111',
                          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                          {s.title}
                        </div>
                        <div style={{fontSize:13,color:'#374151',marginTop:2,
                          overflow:'hidden',display:'-webkit-box',
                          WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
                          {s.snippet}
                        </div>
                      </div>
                      <ExternalLink size={11} color="#9ca3af" style={{flexShrink:0}}/>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Existing KB matches */}
            {result.existing_matches?.length > 0 && (
              <div style={{marginTop:16,padding:'14px 16px',background:'#f0fdf4',
                borderRadius:12,border:'1px solid #bbf7d0'}}>
                <div style={{fontSize:13,fontWeight:800,color:'#16a34a',marginBottom:6}}>
                  ✓ {result.existing_matches.length} related entries found in your knowledge base
                </div>
                {result.existing_matches.slice(0,2).map((m,i)=>(
                  <div key={i} style={{fontSize:13,color:'#374151',marginBottom:3}}>
                    · {m.question || m.subject_pattern}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{padding:'16px 26px',borderTop:'1px solid #f3f4f6',
            display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',gap:8}}>
              {result.tags?.map((tag,i)=>(
                <span key={i} style={{fontSize:13,fontWeight:600,padding:'3px 10px',borderRadius:20,
                  background:'#F9F9F9',color:'#374151'}}>#{tag}</span>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              {!saved ? (
                <button onClick={saveToKB}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'7px 16px',
                    borderRadius:9,border:'none',background:RED,color:'#fff',
                    fontSize:13,fontWeight:700,cursor:'pointer'}}>
                  <Plus size={13}/> Save to Knowledge Base
                </button>
              ) : (
                <span style={{display:'flex',alignItems:'center',gap:5,fontSize:13,
                  fontWeight:700,color:'#16a34a'}}>
                  <CheckCircle size={14}/> Saved!
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Knowledge entry card ───────────────────────────────────────────────────────
function KnowledgeCard({ entry, onEdit, onDelete, onToggleVerified, onTogglePublic }) {
  const [expanded, setExpanded] = useState(false)
  const src = SOURCE_CFG[entry.source] || SOURCE_CFG.manual

  return (
    <div style={{background:'#fff',borderRadius:14,border:'1px solid #ececea',
      marginBottom:10,overflow:'hidden',
      borderLeft:`3px solid ${entry.is_verified?'#16a34a':entry.source==='ticket'?'#7c3aed':entry.source==='web_search'?TEAL:'#e5e7eb'}`}}>

      {/* Header row */}
      <div style={{padding:'14px 18px',display:'flex',alignItems:'flex-start',gap:12,cursor:'pointer'}}
        onClick={()=>setExpanded(e=>!e)}>

        <div style={{marginTop:2,flexShrink:0}}>
          <span style={{fontSize:18}}>{src.icon}</span>
        </div>

        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:800,color:'#111',marginBottom:4}}>
            {entry.question || entry.subject_pattern || 'Untitled entry'}
          </div>
          {entry.answer_short && (
            <div style={{fontSize:13,color:'#374151',lineHeight:1.5,
              overflow:'hidden',display:'-webkit-box',
              WebkitLineClamp:expanded?100:2,WebkitBoxOrient:'vertical'}}>
              {entry.answer_short}
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8,flexWrap:'wrap'}}>
            <span style={{fontSize:13,fontWeight:700,padding:'2px 8px',borderRadius:20,
              background:src.bg,color:src.color}}>{src.label}</span>
            <span style={{fontSize:13,fontWeight:600,padding:'2px 8px',borderRadius:20,
              background:'#F9F9F9',color:'#374151',textTransform:'capitalize'}}>
              {entry.category}
            </span>
            {entry.is_verified && (
              <span style={{fontSize:13,fontWeight:700,color:'#16a34a',
                display:'flex',alignItems:'center',gap:3}}>
                <CheckCircle size={11}/> Verified
              </span>
            )}
            {!entry.is_public && (
              <span style={{fontSize:13,fontWeight:700,color:'#9ca3af',
                display:'flex',alignItems:'center',gap:3}}>
                <EyeOff size={11}/> Internal
              </span>
            )}
            {entry.tags?.slice(0,3).map((t,i)=>(
              <span key={i} style={{fontSize:13,color:'#9ca3af'}}>#{t}</span>
            ))}
            <span style={{fontSize:13,color:'#9ca3af',marginLeft:'auto'}}>
              {entry.use_count||0} uses · {entry.helpful_count||0} 👍
            </span>
          </div>
        </div>

        <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
          <button onClick={e=>{e.stopPropagation();onToggleVerified(entry)}}
            title={entry.is_verified?'Mark unverified':'Mark verified'}
            style={{padding:'5px',borderRadius:7,border:'none',cursor:'pointer',
              background:entry.is_verified?'#f0fdf4':'#f3f4f6',
              color:entry.is_verified?'#16a34a':'#9ca3af'}}>
            <CheckCircle size={14}/>
          </button>
          <button onClick={e=>{e.stopPropagation();onEdit(entry)}}
            style={{padding:'5px',borderRadius:7,border:'none',cursor:'pointer',
              background:'#F9F9F9',color:'#374151'}}>
            <Edit2 size={14}/>
          </button>
          <button onClick={e=>{e.stopPropagation();onDelete(entry.id)}}
            style={{padding:'5px',borderRadius:7,border:'none',cursor:'pointer',
              background:'#fef2f2',color:RED}}>
            <Trash2 size={14}/>
          </button>
          <ChevronRight size={16} color="#9ca3af"
            style={{transform:expanded?'rotate(90deg)':'none',transition:'transform .2s'}}/>
        </div>
      </div>

      {/* Expanded full answer */}
      {expanded && entry.answer && (
        <div style={{padding:'0 18px 18px',borderTop:'1px solid #f3f4f6',paddingTop:16}}>
          <MarkdownText text={entry.answer}/>
          {entry.web_sources?.length > 0 && (
            <div style={{marginTop:14}}>
              <div style={{fontSize:13,fontWeight:800,color:'#9ca3af',marginBottom:8}}>Sources</div>
              {(entry.web_sources||[]).map((s,i)=>(
                <a key={i} href={s.url} target="_blank" rel="noreferrer"
                  style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:TEAL,
                    textDecoration:'none',marginBottom:5}}>
                  <Globe size={11}/> {s.title||s.url}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add/Edit modal ─────────────────────────────────────────────────────────────
function EntryModal({ entry, agencyId, onSave, onClose }) {
  const [form, setForm] = useState({
    question:     entry?.question || '',
    answer:       entry?.answer || '',
    answer_short: entry?.answer_short || '',
    category:     entry?.category || 'general',
    tags:         (entry?.tags||[]).join(', '),
    is_verified:  entry?.is_verified || false,
    is_public:    entry?.is_public !== false,
    source:       entry?.source || 'manual',
  })
  const [saving, setSaving] = useState(false)
  const INP = { width:'100%', padding:'10px 13px', borderRadius:10, border:'1px solid #ececea',
    fontSize:14, outline:'none', color:'#111', boxSizing:'border-box', fontFamily:'inherit', background:'#fff' }

  async function save() {
    if (!form.question.trim() || !form.answer.trim()) { toast.error('Question and answer required'); return }
    setSaving(true)
    try {
      const tags = form.tags.split(',').map(t=>t.trim()).filter(Boolean)
      if (entry?.id) {
        await supabase.from('desk_knowledge').update({
          ...form, tags, updated_at: new Date().toISOString()
        }).eq('id', entry.id)
        toast.success('Entry updated')
      } else {
        await addKnowledgeEntry({ ...form, tags }, agencyId)
        toast.success('Entry added to knowledge base')
      }
      onSave()
    } catch(e) { toast.error(e.message) }
    setSaving(false)
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.6)',
      backdropFilter:'blur(8px)',display:'flex',alignItems:'center',
      justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:640,
        maxHeight:'92vh',overflow:'auto',boxShadow:'0 32px 80px rgba(0,0,0,.25)'}}>
        <div style={{background: '#ffffff',borderRadius:'20px 20px 0 0',padding:'20px 26px',
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:17,fontWeight:900,color:'#fff'}}>
            {entry?.id ? 'Edit Entry' : 'Add Knowledge Entry'}
          </div>
          <button onClick={onClose} style={{border:'none',background:'rgba(255,255,255,.1)',
            color:'#fff',borderRadius:8,padding:'5px 10px',cursor:'pointer'}}>✕</button>
        </div>
        <div style={{padding:'24px 26px',display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:5}}>Question *</label>
            <input value={form.question} onChange={e=>setForm(f=>({...f,question:e.target.value}))}
              placeholder="How do I improve my Google Business Profile ranking?" style={INP}/>
          </div>
          <div>
            <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:5}}>Short Answer (1 sentence) *</label>
            <input value={form.answer_short} onChange={e=>setForm(f=>({...f,answer_short:e.target.value}))}
              placeholder="Optimize your GBP by completing all fields, posting weekly, and getting reviews." style={INP}/>
          </div>
          <div>
            <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:5}}>Full Answer * (markdown supported)</label>
            <textarea value={form.answer} onChange={e=>setForm(f=>({...f,answer:e.target.value}))}
              rows={8} placeholder="## How to improve GBP rankings&#10;&#10;**Key steps:**&#10;- Complete every field in your profile&#10;- Add photos weekly&#10;- Respond to all reviews..."
              style={{...INP,resize:'vertical',lineHeight:1.65,fontFamily:'monospace',fontSize:13}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:5}}>Category</label>
              <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={INP}>
                {CATS.filter(c=>c!=='all').map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:5}}>Tags (comma-separated)</label>
              <input value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))}
                placeholder="gbp, local seo, rankings" style={INP}/>
            </div>
          </div>
          <div style={{display:'flex',gap:16}}>
            {[
              {key:'is_verified', label:'Mark as Verified'},
              {key:'is_public',   label:'Visible to Clients'},
            ].map(opt=>(
              <label key={opt.key} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <div onClick={()=>setForm(f=>({...f,[opt.key]:!f[opt.key]}))}
                  style={{width:44,height:24,borderRadius:12,position:'relative',cursor:'pointer',
                    background:form[opt.key]?RED:'#e5e7eb',transition:'background .2s'}}>
                  <div style={{position:'absolute',top:3,width:18,height:18,borderRadius:'50%',
                    background:'#fff',transition:'left .2s',
                    left:form[opt.key]?'23px':'3px',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
                </div>
                <span style={{fontSize:14,fontWeight:600,color:'#374151'}}>{opt.label}</span>
              </label>
            ))}
          </div>
          <button onClick={save} disabled={saving}
            style={{padding:'13px',borderRadius:12,border:'none',background:RED,
              color:'#fff',fontSize:15,fontWeight:800,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            {saving?<><Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/> Saving…</>:'Save Entry'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function QAKnowledgePage() {
  const navigate  = useNavigate()
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [entries,  setEntries]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('ask')      // ask | browse | tickets
  const [filterQ,  setFilterQ]  = useState('')
  const [filterCat,setFilterCat]= useState('all')
  const [filterSrc,setFilterSrc]= useState('all')
  const [editEntry,setEditEntry] = useState(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [tickets,  setTickets]  = useState([])

  useEffect(() => { loadKnowledge(); loadResolvedTickets() }, [])

  async function loadKnowledge() {
    setLoading(true)
    try {
      const data = await getAllKnowledge(aid)
      setEntries(data || [])
    } catch(err) {
      console.warn('loadKnowledge:', err.message)
      setEntries([])
    }
    setLoading(false)
  }

  async function loadResolvedTickets() {
    try {
      const { data } = await supabase.from('desk_tickets')
        .select('*').eq('agency_id', aid)
        .in('status', ['resolved','closed'])
        .is('ai_summary', null)
        .order('resolved_at', { ascending: false }).limit(20)
      setTickets(data || [])
    } catch(err) {
      console.warn('loadResolvedTickets:', err.message)
      setTickets([])
    }
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return
    await supabase.from('desk_knowledge').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
    toast.success('Deleted')
  }

  async function toggleVerified(entry) {
    const newVal = !entry.is_verified
    await supabase.from('desk_knowledge').update({ is_verified: newVal }).eq('id', entry.id)
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, is_verified: newVal } : e))
    toast.success(newVal ? 'Marked as verified ✓' : 'Marked as unverified')
  }

  async function learnFromTicket(ticket) {
    toast.loading('AI extracting Q&A from ticket…', { id: 'learn-'+ticket.id })
    try {
      const { data: replies } = await supabase.from('desk_replies')
        .select('*').eq('ticket_id', ticket.id).order('created_at')

      const { learnFromResolvedTicket } = await import('../../lib/qaKnowledge')
      const result = await learnFromResolvedTicket(ticket, replies || [], aid)

      if (result) {
        toast.success('Q&A extracted and added to knowledge base!', { id: 'learn-'+ticket.id })
        loadKnowledge()
        setTickets(prev => prev.filter(t => t.id !== ticket.id))
      } else {
        toast.error('Could not extract useful Q&A from this ticket', { id: 'learn-'+ticket.id })
      }
    } catch(e) {
      toast.error(e.message, { id: 'learn-'+ticket.id })
    }
  }

  const filtered = entries.filter(e => {
    const matchQ   = !filterQ || [e.question,e.answer,e.subject_pattern,...(e.tags||[])]
      .some(f=>f?.toLowerCase().includes(filterQ.toLowerCase()))
    const matchCat = filterCat === 'all' || e.category === filterCat
    const matchSrc = filterSrc === 'all' || e.source === filterSrc
    return matchQ && matchCat && matchSrc
  })

  const stats = {
    total:    entries.length,
    verified: entries.filter(e=>e.is_verified).length,
    fromTickets: entries.filter(e=>e.source==='ticket').length,
    fromWeb:  entries.filter(e=>e.source==='web_search'||e.source==='ai_generated').length,
  }

  const TABS = [
    { key:'ask',     label:'Ask AI',        icon: Brain },
    { key:'browse',  label:'Knowledge Base', icon: BookOpen, count: stats.total },
    { key:'tickets', label:'Learn from Tickets', icon: MessageSquare, count: tickets.length, alert: tickets.length > 0 },
  ]

  const isMobile = useMobile()

  /* ─── MOBILE ─── */
  if (isMobile) {
    const mTabs = [
      {key:'ask',     label:'Ask AI'},
      {key:'browse',  label:'Browse', count:entries.length},
    ]
    return (
      <MobilePage padded={false}>
        <MobilePageHeader title="Q&A Knowledge" subtitle="AI-powered support knowledge base"/>
        <MobileTabs tabs={mTabs} active={tab} onChange={setTab}/>

        {tab==='ask' && (
          <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
            <div style={{background:'#fff',borderRadius:14,border:'1px solid #ececea',padding:'14px'}}>
              <textarea value={askQ} onChange={e=>setAskQ(e.target.value)}
                placeholder="Ask anything about your clients or services…" rows={3}
                style={{width:'100%',border:'none',outline:'none',fontSize:16,resize:'none',fontFamily:"'Raleway',sans-serif",color:'#0a0a0a',boxSizing:'border-box'}}/>
              <button onClick={handleAsk} disabled={!askQ.trim()||askLoading}
                style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:'#E6007E',color:'#fff',fontSize:15,fontWeight:700,cursor:askLoading||!askQ.trim()?'not-allowed':'pointer',opacity:askLoading||!askQ.trim()?0.6:1,fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",marginTop:10}}>
                {askLoading?'Thinking…':'Ask AI'}
              </button>
            </div>
            {askAnswer && (
              <div style={{background:'#fff',borderRadius:14,border:'1px solid #00C2CB',padding:'14px'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#00C2CB',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>AI Answer</div>
                <p style={{fontSize:15,color:'#0a0a0a',lineHeight:1.65,margin:0,fontFamily:"'Raleway',sans-serif"}}>{askAnswer}</p>
              </div>
            )}
          </div>
        )}

        {tab==='browse' && (
          <>
            <MobileSearch value={filterQ} onChange={setFilterQ} placeholder="Search knowledge base…"/>
            {loading ? (
              <div style={{padding:40,textAlign:'center',color:'#9a9a96'}}>Loading…</div>
            ) : entries.length===0 ? (
              <div style={{padding:'40px 24px',textAlign:'center',color:'#9a9a96',fontSize:14}}>No entries yet — resolve tickets to auto-learn</div>
            ) : (
              <MobileCard style={{margin:'0 16px 16px'}}>
                {entries.filter(e=>!filterQ||e.question?.toLowerCase().includes(filterQ.toLowerCase())||e.answer?.toLowerCase().includes(filterQ.toLowerCase())).map((e,i,arr)=>(
                  <MobileRow key={e.id}
                    borderBottom={i<arr.length-1}
                    left={<div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:e.is_verified?'#16a34a':'#d0d0cc'}}/>}
                    title={e.question||e.subject_pattern||'Entry'}
                    subtitle={e.answer_short||e.resolution||''}
                    badge={e.is_verified?<span style={{fontSize:10,fontWeight:800,color:'#16a34a',background:'#f0fdf4',padding:'1px 6px',borderRadius:20,fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>✓</span>:null}/>
                ))}
              </MobileCard>
            )}
          </>
        )}
      </MobilePage>
    )
  }

  /* ─── DESKTOP ─── */
  return (
    <div className="page-shell" style={{display:'flex',height:'100vh',overflow:'hidden',background:'#F9F9F9',fontFamily:"var(--font-body)"}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Header */}
        <div style={{background: '#ffffff',padding:'18px 28px 0',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                <div style={{width:34,height:34,borderRadius:10,background:RED,
                  display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Brain size={17} color="#fff"/>
                </div>
                <h1 style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:800,color:'#111',letterSpacing:'-.02em',margin:0,letterSpacing:-0.3}}>
                  Q&A Knowledge Base
                </h1>
                <span style={{fontSize:13,fontWeight:800,color:TEAL,background:TEAL+'20',
                  padding:'2px 8px',borderRadius:20,border:'1px solid '+TEAL+'40'}}>
                  Self-Learning AI
                </span>
              </div>
              <p style={{fontSize:14,color:'#999999',margin:0}}>
                {stats.total} entries · {stats.verified} verified · learns from every resolved ticket
              </p>
            </div>
            <button onClick={()=>setShowAdd(true)}
              style={{display:'flex',alignItems:'center',gap:7,padding:'8px 18px',
                borderRadius:10,border:'none',background:RED,color:'#fff',
                fontSize:14,fontWeight:800,cursor:'pointer'}}>
              <Plus size={14}/> Add Entry
            </button>
          </div>

          {/* Stats strip */}
          <div style={{display:'flex',gap:28,marginBottom:0}}>
            {[
              {label:'Total entries',  value:stats.total},
              {label:'Verified',       value:stats.verified},
              {label:'From tickets',   value:stats.fromTickets},
              {label:'AI generated',   value:stats.fromWeb},
              {label:'Pending tickets',value:tickets.length, alert:tickets.length>0},
            ].map(s=>(
              <div key={s.label} style={{padding:'10px 0'}}>
                <div style={{fontSize:20,fontWeight:900,color:s.alert?RED:'#111',lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:13,color:'#999999',marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{display:'flex',gap:0,marginTop:4}}>
            {TABS.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                style={{display:'flex',alignItems:'center',gap:7,padding:'11px 20px',
                  border:'none',borderBottom:'2.5px solid '+(tab===t.key?RED:'transparent'),
                  background:'transparent',color:tab===t.key?'#111':'#9ca3af',
                  fontSize:14,fontWeight:tab===t.key?800:600,cursor:'pointer',transition:'all .15s'}}>
                <t.icon size={14}/>
                {t.label}
                {(t.count||0) > 0 && (
                  <span style={{fontSize:13,fontWeight:800,padding:'1px 6px',borderRadius:20,
                    background:t.alert&&tab!==t.key?RED+'20':tab===t.key?RED+'20':'#f3f4f6',
                    color:t.alert&&tab!==t.key?RED:tab===t.key?RED:'#6b7280'}}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Filter bar (browse tab) */}
        {tab === 'browse' && (
          <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',
            padding:'12px 28px',flexShrink:0,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,background:'#F9F9F9',
              borderRadius:10,padding:'8px 14px',flex:1,maxWidth:360}}>
              <Search size={14} color="#9ca3af"/>
              <input value={filterQ} onChange={e=>setFilterQ(e.target.value)}
                placeholder="Search questions, answers, tags…"
                style={{border:'none',outline:'none',fontSize:14,
                  background:'transparent',flex:1,color:'#111'}}/>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {CATS.map(c=>(
                <button key={c} onClick={()=>setFilterCat(c)}
                  style={{padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',
                    background:filterCat===c?RED:'#f3f4f6',
                    color:filterCat===c?'#fff':'#374151',
                    fontSize:13,fontWeight:filterCat===c?800:600}}>
                  {c.charAt(0).toUpperCase()+c.slice(1)}
                </button>
              ))}
            </div>
            <div style={{display:'flex',gap:6,borderLeft:'1px solid #e5e7eb',paddingLeft:10}}>
              {[{key:'all',label:'All Sources'}, ...Object.entries(SOURCE_CFG).map(([k,v])=>({key:k,label:v.label}))].map(s=>(
                <button key={s.key} onClick={()=>setFilterSrc(s.key)}
                  style={{padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',
                    background:filterSrc===s.key?'#374151':'#f3f4f6',
                    color:filterSrc===s.key?'#fff':'#374151',fontSize:13,fontWeight:600}}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>

          {/* ── ASK AI TAB ── */}
          {tab === 'ask' && <AskInterface agencyId={aid}/>}

          {/* ── BROWSE TAB ── */}
          {tab === 'browse' && (
            loading ? (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:80}}>
                <Loader2 size={28} color={RED} style={{animation:'spin 1s linear infinite'}}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{textAlign:'center',padding:'60px 24px'}}>
                <BookOpen size={40} color="#e5e7eb" style={{margin:'0 auto 16px',display:'block'}}/>
                <div style={{fontSize:17,fontWeight:800,color:'#111',marginBottom:8}}>
                  {entries.length === 0 ? 'Knowledge base is empty' : 'No matches found'}
                </div>
                <div style={{fontSize:14,color:'#374151',marginBottom:20}}>
                  {entries.length === 0
                    ? 'Use the Ask AI tab to generate answers, or add entries manually'
                    : 'Try a different search or category filter'}
                </div>
                {entries.length === 0 && (
                  <button onClick={()=>setTab('ask')}
                    style={{padding:'10px 24px',borderRadius:10,border:'none',
                      background:RED,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                    Ask AI a Question
                  </button>
                )}
              </div>
            ) : (
              <>
                <div style={{fontSize:13,color:'#374151',marginBottom:14,fontWeight:600}}>
                  {filtered.length} entr{filtered.length===1?'y':'ies'}
                  {filterQ&&<span style={{color:TEAL}}> matching "{filterQ}"</span>}
                </div>
                {filtered.map(entry=>(
                  <KnowledgeCard
                    key={entry.id}
                    entry={entry}
                    onEdit={e=>{setEditEntry(e);setShowAdd(true)}}
                    onDelete={deleteEntry}
                    onToggleVerified={toggleVerified}
                    onTogglePublic={e=>{}}
                  />
                ))}
              </>
            )
          )}

          {/* ── LEARN FROM TICKETS TAB ── */}
          {tab === 'tickets' && (
            <div>
              <div style={{background:'#f0fdf4',borderRadius:14,border:'1px solid #bbf7d0',
                padding:'16px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:12}}>
                <Sparkles size={18} color="#16a34a"/>
                <div>
                  <div style={{fontSize:15,fontWeight:800,color:'#111',marginBottom:2}}>
                    Auto-learn from resolved tickets
                  </div>
                  <div style={{fontSize:13,color:'#374151'}}>
                    Click "Extract Q&A" on any resolved ticket. AI will read the full thread and add a reusable Q&A entry to your knowledge base.
                  </div>
                </div>
              </div>

              {tickets.length === 0 ? (
                <div style={{textAlign:'center',padding:'60px 24px'}}>
                  <CheckCircle size={40} color="#16a34a" style={{margin:'0 auto 16px',display:'block'}}/>
                  <div style={{fontSize:17,fontWeight:800,color:'#111',marginBottom:6}}>All caught up!</div>
                  <div style={{fontSize:14,color:'#374151'}}>
                    All resolved tickets have been processed. New ones will appear here as they're resolved.
                  </div>
                </div>
              ) : (
                tickets.map(ticket=>(
                  <div key={ticket.id} style={{background:'#fff',borderRadius:14,
                    border:'1px solid #ececea',padding:'16px 20px',marginBottom:10,
                    display:'flex',alignItems:'flex-start',gap:14}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontSize:13,fontWeight:800,color:TEAL}}>{ticket.ticket_number}</span>
                        <span style={{fontSize:13,fontWeight:600,padding:'2px 8px',borderRadius:20,
                          background:'#f0fdf4',color:'#16a34a'}}>Resolved</span>
                      </div>
                      <div style={{fontSize:15,fontWeight:800,color:'#111',marginBottom:4}}>
                        {ticket.subject}
                      </div>
                      {ticket.ai_summary && (
                        <div style={{fontSize:13,color:'#374151',lineHeight:1.5}}>{ticket.ai_summary}</div>
                      )}
                      <div style={{fontSize:13,color:'#9ca3af',marginTop:6}}>
                        From {ticket.submitter_name} · Resolved {ticket.resolved_at
                          ? new Date(ticket.resolved_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})
                          : 'recently'}
                      </div>
                    </div>
                    <button onClick={()=>learnFromTicket(ticket)}
                      style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',
                        borderRadius:10,border:'none',background:RED,color:'#fff',
                        fontSize:13,fontWeight:800,cursor:'pointer',flexShrink:0}}>
                      <Sparkles size={13}/> Extract Q&A
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      {(showAdd || editEntry) && (
        <EntryModal
          entry={editEntry}
          agencyId={aid}
          onSave={()=>{ setShowAdd(false); setEditEntry(null); loadKnowledge() }}
          onClose={()=>{ setShowAdd(false); setEditEntry(null) }}
        />
      )}
    </div>
  )
}