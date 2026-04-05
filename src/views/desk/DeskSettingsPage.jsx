"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Plus, Trash2, Save, User, DollarSign,
  ToggleLeft, ToggleRight, Loader2, AlertCircle, Check
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { CATEGORIES } from '../../lib/moosedesk'
import toast from 'react-hot-toast'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'
const BLACK = '#0a0a0a'

const SKILLS = ['SEO','Paid Ads','Social Media','Content','Design','Development','Email','Reporting','Billing','Support','Strategy','Video']
const AVATAR_COLORS = [RED,'#3b82f6','#16a34a','#d97706','#8b5cf6',TEAL,'#ec4899','#f59e0b','#6b7280','#14b8a6']

function PillToggle({ label, active, onChange }) {
  return (
    <button onClick={()=>onChange(!active)}
      style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 14px',
        borderRadius:20,border:'none',cursor:'pointer',transition:'all .15s',
        background:active?RED:'#f3f4f6',color:active?'#fff':'#374151',
        fontSize:13,fontWeight:700}}>
      {active ? <Check size={12}/> : <span style={{width:12,height:12,borderRadius:'50%',background:'#d1d5db',display:'inline-block'}}/>}
      {label}
    </button>
  )
}

export default function DeskSettingsPage() {
  const navigate  = useNavigate()
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [agents,  setAgents]  = useState([])
  const [rules,   setRules]   = useState([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('agents')
  const [saving,  setSaving]  = useState(false)

  // New agent form
  const [newAgent, setNewAgent] = useState({
    name:'', email:'', role:'agent', hourly_rate:0, skills:[], avatar_color:RED
  })
  // New rule form
  const [newRule, setNewRule] = useState({
    name:'', match_category:[], match_keywords:'', match_priority:[],
    assign_team:[], auto_reply:'', is_active:true
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: aa }, { data: rr }] = await Promise.all([
      supabase.from('desk_agents').select('*').eq('agency_id', aid).order('created_at'),
      supabase.from('desk_routing_rules').select('*').eq('agency_id', aid).order('priority'),
    ])
    setAgents(aa||[])
    setRules(rr||[])
    setLoading(false)
  }

  async function saveAgent() {
    if (!newAgent.name.trim() || !newAgent.email.trim()) { toast.error('Name and email required'); return }
    setSaving(true)
    const { error } = await supabase.from('desk_agents').insert({
      agency_id: aid, ...newAgent,
      hourly_rate: parseFloat(newAgent.hourly_rate)||0,
    })
    if (error) toast.error(error.message)
    else { toast.success('Agent added'); setNewAgent({name:'',email:'',role:'agent',hourly_rate:0,skills:[],avatar_color:RED}); load() }
    setSaving(false)
  }

  async function updateAgent(id, field, value) {
    await supabase.from('desk_agents').update({[field]:value}).eq('id',id)
    setAgents(prev=>prev.map(a=>a.id===id?{...a,[field]:value}:a))
  }

  async function deleteAgent(id) {
    if (!confirm('Remove this agent?')) return
    await supabase.from('desk_agents').delete().eq('id',id)
    setAgents(prev=>prev.filter(a=>a.id!==id))
    toast.success('Agent removed')
  }

  async function saveRule() {
    if (!newRule.name.trim()) { toast.error('Rule name required'); return }
    setSaving(true)
    const { error } = await supabase.from('desk_routing_rules').insert({
      agency_id: aid, ...newRule,
      match_keywords: newRule.match_keywords ? newRule.match_keywords.split(',').map(k=>k.trim()).filter(Boolean) : [],
      priority: rules.length,
    })
    if (error) toast.error(error.message)
    else { toast.success('Rule saved'); setNewRule({name:'',match_category:[],match_keywords:'',match_priority:[],assign_team:[],auto_reply:'',is_active:true}); load() }
    setSaving(false)
  }

  async function toggleRule(id, current) {
    await supabase.from('desk_routing_rules').update({is_active:!current}).eq('id',id)
    setRules(prev=>prev.map(r=>r.id===id?{...r,is_active:!current}:r))
  }

  async function deleteRule(id) {
    if (!confirm('Delete this rule?')) return
    await supabase.from('desk_routing_rules').delete().eq('id',id)
    setRules(prev=>prev.filter(r=>r.id!==id))
    toast.success('Rule deleted')
  }

  const INP = {width:'100%',padding:'9px 12px',borderRadius:10,border:'1.5px solid #e5e7eb',
    fontSize:14,outline:'none',color:'#111',boxSizing:'border-box',fontFamily:'inherit',background:'#fff'}

  const TABS = [{key:'agents',label:'Team Agents'},{key:'routing',label:'Routing Rules'},{key:'categories',label:'Categories'}]

  return (
    <div className="page-shell" style={{display:'flex',height:'100vh',overflow:'hidden',background:'#f4f4f5'}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        <div style={{background:BLACK,padding:'16px 28px',flexShrink:0,display:'flex',alignItems:'center',gap:14}}>
          <button onClick={()=>navigate('/desk')}
            style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:9,
              border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',
              color:'rgba(255,255,255,.7)',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            <ChevronLeft size={14}/> Back
          </button>
          <h1 style={{fontSize:20,fontWeight:900,color:'#fff',margin:0}}>KotoDesk Settings</h1>
        </div>

        <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'0 28px',flexShrink:0,display:'flex'}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{padding:'12px 20px',border:'none',borderBottom:'2.5px solid '+(tab===t.key?RED:'transparent'),
                background:'transparent',color:tab===t.key?RED:'#374151',
                fontSize:14,fontWeight:tab===t.key?800:600,cursor:'pointer'}}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'28px'}}>
          {loading ? (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:60}}>
              <Loader2 size={24} color={RED} style={{animation:'spin 1s linear infinite'}}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (

          <>
          {/* ── AGENTS TAB ── */}
          {tab === 'agents' && (
            <div style={{maxWidth:800}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                <div>
                  <h2 style={{fontSize:20,fontWeight:900,color:'#111',margin:'0 0 4px'}}>Team Agents</h2>
                  <p style={{fontSize:14,color:'#374151',margin:0}}>Add your team members. Set hourly rates for cost tracking.</p>
                </div>
              </div>

              {/* Existing agents */}
              {agents.map(agent=>(
                <div key={agent.id} style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',
                  padding:'18px 20px',marginBottom:12}}>
                  <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr auto auto',gap:14,alignItems:'center'}}>
                    <div style={{width:42,height:42,borderRadius:'50%',background:agent.avatar_color||RED,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:16,fontWeight:900,color:'#fff'}}>
                      {agent.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:'#111'}}>{agent.name}</div>
                      <div style={{fontSize:13,color:'#374151'}}>{agent.email}</div>
                    </div>
                    <div>
                      <div style={{fontSize:13,color:'#9ca3af',marginBottom:4}}>Hourly rate</div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <DollarSign size={13} color="#374151"/>
                        <input type="number" value={agent.hourly_rate||0}
                          onChange={e=>updateAgent(agent.id,'hourly_rate',parseFloat(e.target.value)||0)}
                          style={{width:80,...INP,padding:'5px 8px'}}/>
                        <span style={{fontSize:13,color:'#374151'}}>/hr</span>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:13,color:'#9ca3af',marginBottom:6}}>Active</div>
                      <button onClick={()=>updateAgent(agent.id,'is_active',!agent.is_active)}
                        style={{border:'none',background:'none',cursor:'pointer',padding:0}}>
                        {agent.is_active
                          ? <ToggleRight size={28} color={TEAL}/>
                          : <ToggleLeft size={28} color="#d1d5db"/>}
                      </button>
                    </div>
                    <button onClick={()=>deleteAgent(agent.id)}
                      style={{border:'none',background:'#fef2f2',color:RED,borderRadius:9,
                        padding:'8px',cursor:'pointer'}}>
                      <Trash2 size={15}/>
                    </button>
                  </div>
                  {/* Skills */}
                  <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid #f3f4f6'}}>
                    <div style={{fontSize:13,color:'#9ca3af',marginBottom:8}}>Skills</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {SKILLS.map(skill=>(
                        <PillToggle key={skill} label={skill}
                          active={(agent.skills||[]).includes(skill)}
                          onChange={on=>{
                            const s = on ? [...(agent.skills||[]),skill] : (agent.skills||[]).filter(x=>x!==skill)
                            updateAgent(agent.id,'skills',s)
                          }}/>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add new agent */}
              <div style={{background:'#f9fafb',borderRadius:14,border:'2px dashed #e5e7eb',padding:'20px'}}>
                <div style={{fontSize:15,fontWeight:800,color:'#111',marginBottom:14}}>Add Team Member</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  <div>
                    <label style={{fontSize:13,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Name *</label>
                    <input value={newAgent.name} onChange={e=>setNewAgent(a=>({...a,name:e.target.value}))} placeholder="Jane Smith" style={INP}/>
                  </div>
                  <div>
                    <label style={{fontSize:13,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Email *</label>
                    <input value={newAgent.email} onChange={e=>setNewAgent(a=>({...a,email:e.target.value}))} placeholder="jane@agency.com" style={INP}/>
                  </div>
                  <div>
                    <label style={{fontSize:13,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Role</label>
                    <select value={newAgent.role} onChange={e=>setNewAgent(a=>({...a,role:e.target.value}))} style={INP}>
                      {['agent','senior','lead','manager'].map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:13,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Hourly Rate ($)</label>
                    <input type="number" value={newAgent.hourly_rate}
                      onChange={e=>setNewAgent(a=>({...a,hourly_rate:parseFloat(e.target.value)||0}))}
                      placeholder="75" style={INP}/>
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#374151',marginBottom:8}}>Avatar Color</div>
                  <div style={{display:'flex',gap:8}}>
                    {AVATAR_COLORS.map(c=>(
                      <button key={c} onClick={()=>setNewAgent(a=>({...a,avatar_color:c}))}
                        style={{width:28,height:28,borderRadius:'50%',background:c,border:newAgent.avatar_color===c?'3px solid #111':'3px solid transparent',cursor:'pointer'}}/>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#374151',marginBottom:8}}>Skills</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {SKILLS.map(skill=>(
                      <PillToggle key={skill} label={skill}
                        active={newAgent.skills.includes(skill)}
                        onChange={on=>setNewAgent(a=>({...a,skills:on?[...a.skills,skill]:a.skills.filter(x=>x!==skill)}))}/>
                    ))}
                  </div>
                </div>
                <button onClick={saveAgent} disabled={saving}
                  style={{padding:'10px 24px',borderRadius:10,border:'none',background:RED,
                    color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer',
                    display:'flex',alignItems:'center',gap:8}}>
                  {saving?<><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Saving…</>:<><Plus size={14}/> Add Agent</>}
                </button>
              </div>
            </div>
          )}

          {/* ── ROUTING RULES TAB ── */}
          {tab === 'routing' && (
            <div style={{maxWidth:800}}>
              <div style={{marginBottom:20}}>
                <h2 style={{fontSize:20,fontWeight:900,color:'#111',margin:'0 0 4px'}}>Routing Rules</h2>
                <p style={{fontSize:14,color:'#374151',margin:0}}>Rules run in order. First match wins. AI categorizes tickets before rules apply.</p>
              </div>

              {rules.map((rule,i)=>(
                <div key={rule.id} style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',
                  padding:'16px 20px',marginBottom:10,opacity:rule.is_active?1:.6}}>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:26,height:26,borderRadius:'50%',background:'#f3f4f6',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:13,fontWeight:900,color:'#374151',flexShrink:0}}>{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,fontWeight:800,color:'#111',marginBottom:4}}>{rule.name}</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {rule.match_category?.map(c=>(
                          <span key={c} style={{fontSize:13,fontWeight:700,padding:'2px 8px',borderRadius:20,
                            background:'#eff6ff',color:'#3b82f6',textTransform:'capitalize'}}>{c.replace(/_/g,' ')}</span>
                        ))}
                        {rule.match_priority?.map(p=>(
                          <span key={p} style={{fontSize:13,fontWeight:700,padding:'2px 8px',borderRadius:20,
                            background:'#fef2f2',color:RED,textTransform:'capitalize'}}>{p}</span>
                        ))}
                        {rule.match_keywords?.map(k=>(
                          <span key={k} style={{fontSize:13,fontWeight:700,padding:'2px 8px',borderRadius:20,
                            background:'#f9fafb',color:'#374151'}}>"{k}"</span>
                        ))}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
                      <button onClick={()=>toggleRule(rule.id,rule.is_active)}
                        style={{border:'none',background:'none',cursor:'pointer',padding:0}}>
                        {rule.is_active?<ToggleRight size={26} color={TEAL}/>:<ToggleLeft size={26} color="#d1d5db"/>}
                      </button>
                      <button onClick={()=>deleteRule(rule.id)}
                        style={{border:'none',background:'#fef2f2',color:RED,borderRadius:9,padding:'7px',cursor:'pointer'}}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add rule */}
              <div style={{background:'#f9fafb',borderRadius:14,border:'2px dashed #e5e7eb',padding:'20px',marginTop:16}}>
                <div style={{fontSize:15,fontWeight:800,color:'#111',marginBottom:14}}>Add Routing Rule</div>
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:13,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Rule Name *</label>
                  <input value={newRule.name} onChange={e=>setNewRule(r=>({...r,name:e.target.value}))}
                    placeholder="e.g. Urgent bugs → Lead dev" style={INP}/>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#374151',marginBottom:8}}>Match Category (any)</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {CATEGORIES.map(c=>(
                      <PillToggle key={c} label={c.replace(/_/g,' ')}
                        active={newRule.match_category.includes(c)}
                        onChange={on=>setNewRule(r=>({...r,match_category:on?[...r.match_category,c]:r.match_category.filter(x=>x!==c)}))}/>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#374151',marginBottom:8}}>Match Priority (any)</div>
                  <div style={{display:'flex',gap:6}}>
                    {['low','normal','high','urgent','critical'].map(p=>(
                      <PillToggle key={p} label={p}
                        active={newRule.match_priority.includes(p)}
                        onChange={on=>setNewRule(r=>({...r,match_priority:on?[...r.match_priority,p]:r.match_priority.filter(x=>x!==p)}))}/>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:13,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Match Keywords (comma-separated)</label>
                  <input value={newRule.match_keywords}
                    onChange={e=>setNewRule(r=>({...r,match_keywords:e.target.value}))}
                    placeholder="crash, broken, urgent, refund" style={INP}/>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:13,fontWeight:700,color:'#374151',display:'block',marginBottom:5}}>Auto-reply message (optional)</label>
                  <textarea value={newRule.auto_reply}
                    onChange={e=>setNewRule(r=>({...r,auto_reply:e.target.value}))}
                    rows={3} placeholder="We received your request and are treating it as urgent…"
                    style={{...INP,resize:'vertical',lineHeight:1.6}}/>
                </div>
                <button onClick={saveRule} disabled={saving}
                  style={{padding:'10px 24px',borderRadius:10,border:'none',background:RED,
                    color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer',
                    display:'flex',alignItems:'center',gap:8}}>
                  {saving?<><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Saving…</>:<><Plus size={14}/> Add Rule</>}
                </button>
              </div>
            </div>
          )}

          {/* ── CATEGORIES TAB ── */}
          {tab === 'categories' && (
            <div style={{maxWidth:700}}>
              <h2 style={{fontSize:20,fontWeight:900,color:'#111',margin:'0 0 8px'}}>Ticket Categories</h2>
              <p style={{fontSize:14,color:'#374151',marginBottom:24}}>
                These categories are used by AI to automatically classify incoming tickets. They are also available for manual selection when submitting a ticket.
              </p>
              <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
                {CATEGORIES.map(c=>(
                  <div key={c} style={{background:'#fff',borderRadius:12,border:'1.5px solid #e5e7eb',
                    padding:'12px 18px',fontSize:14,fontWeight:700,color:'#111',
                    textTransform:'capitalize'}}>
                    {c.replace(/_/g,' ')}
                  </div>
                ))}
              </div>
              <p style={{fontSize:13,color:'#9ca3af',marginTop:16}}>
                More category customization coming soon. Contact support to add custom categories.
              </p>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  )
}