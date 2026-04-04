"use client";
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Sparkles, Loader2, Users, DollarSign, Target, MapPin, BarChart2, Zap, Globe, TrendingUp, Award, Copy, RefreshCw, ShieldCheck } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { callClaude } from '../lib/ai'
import toast from 'react-hot-toast'

const ACCENT = '#E8551A'

function Pill({ text, color=ACCENT }) {
  return <span style={{ display:'inline-flex', fontSize:12, fontWeight:600, padding:'4px 10px', borderRadius:20, background:color+'18', color, border:`1px solid ${color}28`, margin:'0 4px 5px 0' }}>{text}</span>
}

function Card({ title, icon:Icon, color=ACCENT, children }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:18 }}>
      <div style={{ padding:'13px 18px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:9 }}>
        <div style={{ width:30, height:30, borderRadius:8, background:color+'15', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon size={14} color={color}/></div>
        <span style={{ fontSize:13, fontWeight:700, color:'#111' }}>{title}</span>
      </div>
      <div style={{ padding:'16px 18px' }}>{children}</div>
    </div>
  )
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
      <div style={{ fontSize:11, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color:color||'#111' }}>{value}</div>
      {sub&&<div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

export default function ClientPersonaPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [persona, setPersona] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => { loadClient() }, [clientId])

  async function loadClient() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
    setClient(data||null)
    // Try to load onboarding profile data
    if (data) {
      const { data: prof } = await supabase.from('client_profiles').select('*').eq('client_id', clientId).single()
      setProfile(prof||null)
      if (data.ai_persona) { try { setPersona(typeof data.ai_persona==='string'?JSON.parse(data.ai_persona):data.ai_persona) } catch {} }
    }
    setLoading(false)
  }

  async function generatePersona() {
    if (!client) return
    setGenerating(true)
    try {
      const ctx = {
        name: client.name, industry: profile?.industry || client.industry,
        city: profile?.address?.city, state: profile?.address?.state,
        description: profile?.brand?.mission_statement || '',
        target_audience: profile?.marketing?.target_audience || '',
        competitors: profile?.marketing?.competitors || [],
        goals: profile?.marketing?.goals || [],
        budget: profile?.marketing?.current_budget || '',
      }
      const result = await callClaude(
        'You are a senior marketing strategist. Generate a detailed client marketing persona and strategy brief as JSON only, no markdown, no preamble.',
        `Generate a comprehensive marketing persona for this business: ${JSON.stringify(ctx)}

Return ONLY valid JSON with these keys:
{
  "persona_name": "catchy name like 'Suburban Sally'",
  "persona_summary": "2-3 sentence ideal customer summary",
  "demographics": { "age_range": "", "gender_split": "", "income_level": "", "education": "" },
  "psychographics": { "values": [], "motivations": [], "fears": [], "aspirations": [] },
  "online_behavior": { "social_platforms": [], "peak_usage_time": "", "search_triggers": [] },
  "buying_journey": { "awareness": "", "decision_factors": [], "preferred_contact": "" },
  "ad_targeting": { "google_keywords": [], "facebook_interests": [], "geo_radius": "" },
  "messaging": { "headline_angles": [], "pain_point_hooks": [], "trust_builders": [], "cta_styles": [] },
  "recommended_channels": [{"channel":"","priority":"high/mid/low","rationale":"","budget_allocation":""}],
  "quick_wins": [],
  "ltv_analysis": { "first_year_value": "", "three_year_value": "", "upsell_opportunities": [] }
}`, 2500
      )
      const cleaned = result.replace(/```json|```/g,'').trim()
      const parsed = JSON.parse(cleaned.slice(cleaned.indexOf('{')))
      await supabase.from('clients').update({ ai_persona: JSON.stringify(parsed) }).eq('id', client.id)
      setPersona(parsed)
      toast.success('AI persona generated!')
    } catch(e) {
      console.error(e)
      toast.error('Generation failed — try again')
    }
    setGenerating(false)
  }

  if (loading) return <div style={{ display:'flex', minHeight:'100vh' }}><Sidebar/><div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}><Loader2 size={28} color={ACCENT} style={{ animation:'spin 1s linear infinite' }}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div></div>

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f4f5' }}>
      <Sidebar/>
      <div style={{ flex:1, overflowY:'auto' }}>
        {/* Header */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'13px 24px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:10 }}>
          <button onClick={()=>navigate(`/clients/${clientId}`)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><ChevronLeft size={17}/></button>
          <div style={{ width:36, height:36, borderRadius:9, background:ACCENT, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:15 }}>{client?.name?.[0]}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#111' }}>{client?.name}</div>
            <div style={{ fontSize:11, color:'#9ca3af' }}>Client Persona & Marketing Intelligence</div>
          </div>
          <button onClick={generatePersona} disabled={generating}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:9, border:'none', background:ACCENT, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', opacity:generating?.7:1 }}>
            {generating?<Loader2 size={13} style={{ animation:'spin 1s linear infinite' }}/>:<Sparkles size={13}/>}
            {generating?'Generating…':persona?'Regenerate AI Persona':'Generate AI Persona'}
          </button>
        </div>

        <div style={{ maxWidth:1060, margin:'0 auto', padding:'24px 24px' }}>
          {/* No data yet */}
          {!persona&&!profile&&(
            <div style={{ background:'#fff', borderRadius:14, border:'1.5px dashed #e5e7eb', padding:48, textAlign:'center', marginBottom:20 }}>
              <Users size={44} color="#e5e7eb" strokeWidth={1} style={{ margin:'0 auto 14px' }}/>
              <div style={{ fontSize:17, fontWeight:700, color:'#374151', marginBottom:7 }}>No persona data yet</div>
              <div style={{ fontSize:13, color:'#9ca3af', marginBottom:20, maxWidth:420, margin:'0 auto 20px' }}>Send the client their onboarding link so they fill in their business info. Then click Generate AI Persona above to create a full marketing intelligence brief.</div>
              <button onClick={generatePersona} disabled={generating} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'10px 22px', borderRadius:9, border:'none', background:ACCENT, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                <Sparkles size={14}/> Generate Anyway
              </button>
            </div>
          )}

          {persona&&(
            <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20 }}>
              {/* Left */}
              <div>
                {/* Persona summary */}
                <div style={{ background:'linear-gradient(135deg,#18181b,#27272a)', borderRadius:16, padding:'22px 24px', marginBottom:18 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <Sparkles size={15} color={ACCENT}/>
                    <span style={{ fontSize:12, fontWeight:700, color:ACCENT, textTransform:'uppercase', letterSpacing:'.05em' }}>AI Persona</span>
                  </div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#fff', marginBottom:6 }}>"{persona.persona_name}"</div>
                  <div style={{ fontSize:14, color:'#a1a1aa', lineHeight:1.65 }}>{persona.persona_summary}</div>
                </div>

                {/* Demographics */}
                {persona.demographics&&(
                  <Card title="Demographics" icon={Users} color="#8b5cf6">
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      {Object.entries(persona.demographics).filter(([,v])=>v).map(([k,v])=>(
                        <div key={k} style={{ background:'#f9fafb', borderRadius:9, padding:'10px 12px' }}>
                          <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:3 }}>{k.replace(/_/g,' ')}</div>
                          <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Psychographics */}
                {persona.psychographics&&(
                  <Card title="Psychographics" icon={Award} color="#f59e0b">
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                      {[['Core Values',persona.psychographics.values,'#10b981'],['Motivations',persona.psychographics.motivations,'#3b82f6'],['Fears / Objections',persona.psychographics.fears,'#ef4444'],['Aspirations',persona.psychographics.aspirations,'#8b5cf6']].map(([label,items,color])=>(
                        <div key={label}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:7 }}>{label}</div>
                          {(items||[]).map((item,i)=><div key={i} style={{ display:'flex', gap:6, marginBottom:5, fontSize:12, color:'#374151' }}><div style={{ width:5, height:5, borderRadius:'50%', background:color, flexShrink:0, marginTop:5 }}/>{item}</div>)}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Ad Targeting */}
                {persona.ad_targeting&&(
                  <Card title="AI-Recommended Ad Targeting" icon={Zap} color={ACCENT}>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>📍 Google Keywords</div>
                      <div style={{ display:'flex', flexWrap:'wrap' }}>{persona.ad_targeting.google_keywords?.map(k=><Pill key={k} text={k} color="#3b82f6"/>)}</div>
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>👥 Facebook Interests</div>
                      <div style={{ display:'flex', flexWrap:'wrap' }}>{persona.ad_targeting.facebook_interests?.map(i=><Pill key={i} text={i} color="#8b5cf6"/>)}</div>
                    </div>
                    {persona.ad_targeting.geo_radius&&<div style={{ fontSize:12, color:'#6b7280' }}>📍 {persona.ad_targeting.geo_radius}</div>}
                  </Card>
                )}

                {/* Messaging */}
                {persona.messaging&&(
                  <Card title="Ad Messaging Playbook" icon={Target} color="#f59e0b">
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>🎯 Headline Angles</div>
                      {persona.messaging.headline_angles?.map((h,i)=>(
                        <div key={i} style={{ display:'flex', gap:9, marginBottom:6, padding:'7px 11px', background:'#f9fafb', borderRadius:8, border:'1px solid #f3f4f6' }}>
                          <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', flexShrink:0 }}>H{i+1}</span>
                          <span style={{ fontSize:13, color:'#374151', flex:1 }}>{h}</span>
                          <button onClick={()=>{navigator.clipboard.writeText(h);toast.success('Copied')}} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', flexShrink:0 }}><Copy size={10}/></button>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>😰 Pain Point Hooks</div>
                      <div style={{ display:'flex', flexWrap:'wrap' }}>{persona.messaging.pain_point_hooks?.map(h=><Pill key={h} text={h} color="#ef4444"/>)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>✅ Trust Builders</div>
                      <div style={{ display:'flex', flexWrap:'wrap' }}>{persona.messaging.trust_builders?.map(t=><Pill key={t} text={t} color="#10b981"/>)}</div>
                    </div>
                  </Card>
                )}
              </div>

              {/* Right sidebar */}
              <div>
                {persona.ltv_analysis&&(
                  <Card title="LTV Analysis" icon={DollarSign} color="#10b981">
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:12 }}>
                      <div style={{ background:'#f0fdf4', borderRadius:9, padding:'11px', textAlign:'center' }}><div style={{ fontSize:15, fontWeight:800, color:'#166534' }}>{persona.ltv_analysis.first_year_value}</div><div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>Year 1</div></div>
                      <div style={{ background:'#eff6ff', borderRadius:9, padding:'11px', textAlign:'center' }}><div style={{ fontSize:15, fontWeight:800, color:'#1d4ed8' }}>{persona.ltv_analysis.three_year_value}</div><div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>3-Year LTV</div></div>
                    </div>
                    {persona.ltv_analysis.upsell_opportunities?.map((u,i)=><div key={i} style={{ fontSize:12, color:'#374151', display:'flex', gap:5, marginBottom:4 }}><span style={{ color:'#10b981', fontWeight:700 }}>↑</span>{u}</div>)}
                  </Card>
                )}

                {persona.recommended_channels&&(
                  <Card title="Recommended Channels" icon={BarChart2} color="#8b5cf6">
                    {persona.recommended_channels.map((ch,i)=>(
                      <div key={i} style={{ marginBottom:12 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                          <div><span style={{ fontSize:13, fontWeight:600, color:'#111' }}>{ch.channel}</span><span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:8, marginLeft:6, background:ch.priority==='high'?'#fef2f2':ch.priority==='mid'?'#fffbeb':'#f0fdf4', color:ch.priority==='high'?'#dc2626':ch.priority==='mid'?'#d97706':'#16a34a' }}>{ch.priority?.toUpperCase()}</span></div>
                          <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af' }}>{ch.budget_allocation}</span>
                        </div>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>{ch.rationale}</div>
                      </div>
                    ))}
                  </Card>
                )}

                {persona.quick_wins&&(
                  <Card title="30-Day Quick Wins" icon={Zap} color="#f59e0b">
                    {persona.quick_wins.map((win,i)=>(
                      <div key={i} style={{ display:'flex', gap:9, marginBottom:8, padding:'7px 11px', background:'#fffbeb', borderRadius:8, border:'1px solid #fde68a' }}>
                        <span style={{ fontSize:11, fontWeight:800, color:'#d97706', flexShrink:0, width:16 }}>{i+1}.</span>
                        <span style={{ fontSize:12, color:'#374151', lineHeight:1.4 }}>{win}</span>
                      </div>
                    ))}
                  </Card>
                )}

                {persona.online_behavior&&(
                  <Card title="Online Behavior" icon={Globe} color="#06b6d4">
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', marginBottom:6, textTransform:'uppercase' }}>Platforms Used</div>
                      <div style={{ display:'flex', flexWrap:'wrap' }}>{persona.online_behavior.social_platforms?.map(p=><Pill key={p} text={p} color="#06b6d4"/>)}</div>
                    </div>
                    {persona.online_behavior.peak_usage_time&&<div style={{ fontSize:12, color:'#374151', marginBottom:8 }}><strong>Peak time:</strong> {persona.online_behavior.peak_usage_time}</div>}
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', marginBottom:6, textTransform:'uppercase' }}>Search Triggers</div>
                      {persona.online_behavior.search_triggers?.map((t,i)=><div key={i} style={{ fontSize:12, color:'#374151', display:'flex', gap:5, marginBottom:4 }}><span style={{ color:'#06b6d4', fontWeight:700 }}>→</span>{t}</div>)}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
