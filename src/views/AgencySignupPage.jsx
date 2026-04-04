"use client";
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Check, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

const ACCENT = '#E8551A'
const INP = { width:'100%', padding:'14px 18px', borderRadius:12, border:'2px solid #e5e7eb', fontSize:15, outline:'none', background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit', transition:'border-color .15s' }

const PLANS = [
  { id:'starter', name:'Starter', price:297, seats:3, clients:25, popular:false },
  { id:'growth',  name:'Growth',  price:497, seats:10, clients:100, popular:true },
  { id:'pro',     name:'Pro',     price:897, seats:25, clients:500, popular:false },
]

export default function AgencySignupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1=plan, 2=account, 3=agency
  const [plan, setPlan] = useState('growth')
  const [form, setForm] = useState({ email:'', password:'', first_name:'', last_name:'', agency_name:'', agency_slug:'', billing_email:'' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  function slugify(str) { return str.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') }

  async function createAgency() {
    setLoading(true)
    try {
      // 1. Create auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: { data: { first_name: form.first_name, last_name: form.last_name } }
      })
      if (authErr) throw authErr

      const userId = authData.user.id

      // 2. Create agency record
      const { data: agency, error: agErr } = await supabase.from('agencies').insert({
        name: form.agency_name,
        slug: form.agency_slug || slugify(form.agency_name),
        owner_id: userId,
        plan: plan,
        plan_seats: PLANS.find(p=>p.id===plan)?.seats || 3,
        max_clients: PLANS.find(p=>p.id===plan)?.clients || 25,
        billing_email: form.billing_email || form.email,
        brand_name: form.agency_name,
      }).select().single()
      if (agErr) throw agErr

      // 3. Add user as owner member
      await supabase.from('agency_members').insert({
        agency_id: agency.id, user_id: userId, role: 'owner', accepted_at: new Date().toISOString()
      })

      // 4. Create feature flags
      const selectedPlan = PLANS.find(p=>p.id===plan)
      await supabase.from('agency_features').insert({
        agency_id: agency.id,
        ai_personas: true,
        ai_social_posts: plan !== 'starter',
        ai_review_responses: plan !== 'starter',
        ai_lead_qualifier: plan === 'pro',
        white_label: plan !== 'starter',
        api_access: false,
        max_ai_calls_month: plan==='starter'?500:plan==='growth'?2000:10000,
      })

      toast.success('Agency created! Welcome to Moose AI 🎉')
      navigate('/')
    } catch(e) {
      toast.error(e.message || 'Signup failed — please try again')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f4f4f5', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'#18181b', padding:'14px 28px', display:'flex', alignItems:'center', gap:12 }}>
        <img src="/moose-logo.svg" alt="Moose AI" style={{ height:24, filter:'brightness(0) invert(1)' }}/>
        <div style={{ width:1, height:20, background:'rgba(255,255,255,.15)' }}/>
        <span style={{ fontSize:13, color:'#a1a1aa' }}>Start your free trial</span>
      </div>

      {/* Progress */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'12px 28px', display:'flex', gap:8, alignItems:'center', justifyContent:'center' }}>
        {['Choose Plan','Create Account','Agency Setup'].map((s,i)=>(
          <div key={s} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <div style={{ width:26, height:26, borderRadius:'50%', background:i+1<step?'#22c55e':i+1===step?ACCENT:'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {i+1<step?<Check size={13} color="#fff" strokeWidth={3}/>:<span style={{ fontSize:12, fontWeight:700, color:i+1===step?'#fff':'#9ca3af' }}>{i+1}</span>}
              </div>
              <span style={{ fontSize:13, fontWeight:i+1===step?700:500, color:i+1===step?'#111':'#9ca3af' }}>{s}</span>
            </div>
            {i<2&&<div style={{ width:40, height:1, background:'#e5e7eb' }}/>}
          </div>
        ))}
      </div>

      <div style={{ flex:1, maxWidth:640, margin:'40px auto', width:'100%', padding:'0 20px 60px' }}>

        {/* Step 1: Plan */}
        {step===1&&(
          <div>
            <h1 style={{ fontSize:28, fontWeight:900, color:'#111', marginBottom:6, textAlign:'center' }}>Choose your plan</h1>
            <p style={{ fontSize:15, color:'#6b7280', textAlign:'center', marginBottom:28 }}>14-day free trial on all plans. No credit card needed.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:28 }}>
              {PLANS.map(p=>(
                <div key={p.id} onClick={()=>setPlan(p.id)}
                  style={{ background:'#fff', borderRadius:16, border:`2px solid ${plan===p.id?ACCENT:'#e5e7eb'}`, padding:'20px 22px', cursor:'pointer', position:'relative', transition:'border-color .15s' }}>
                  {p.popular&&<div style={{ position:'absolute', top:-10, right:20, fontSize:10, fontWeight:800, color:'#fff', background:ACCENT, borderRadius:20, padding:'2px 12px' }}>POPULAR</div>}
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${plan===p.id?ACCENT:'#d1d5db'}`, background:plan===p.id?ACCENT:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {plan===p.id&&<Check size={12} color="#fff" strokeWidth={3}/>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:16, fontWeight:800, color:'#111' }}>{p.name}</span>
                        <span style={{ fontSize:11, color:'#9ca3af' }}>— {p.seats} seats · {p.clients} clients</span>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:22, fontWeight:900, color:plan===p.id?ACCENT:'#111' }}>${p.price}<span style={{ fontSize:12, fontWeight:500, color:'#9ca3af' }}>/mo</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={()=>setStep(2)} style={{ width:'100%', padding:'15px', borderRadius:13, border:'none', background:ACCENT, color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              Continue with {PLANS.find(p=>p.id===plan)?.name} <ArrowRight size={18}/>
            </button>
          </div>
        )}

        {/* Step 2: Account */}
        {step===2&&(
          <div style={{ background:'#fff', borderRadius:20, border:'1px solid #e5e7eb', padding:'32px' }}>
            <h2 style={{ fontSize:24, fontWeight:900, color:'#111', marginBottom:6 }}>Create your account</h2>
            <p style={{ fontSize:14, color:'#6b7280', marginBottom:24 }}>You'll use this to log into your agency dashboard.</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
              <div><label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>First Name</label><input value={form.first_name} onChange={e=>set('first_name',e.target.value)} placeholder="John" style={INP}/></div>
              <div><label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Last Name</label><input value={form.last_name} onChange={e=>set('last_name',e.target.value)} placeholder="Smith" style={INP}/></div>
            </div>
            <div style={{ marginBottom:14 }}><label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Work Email</label><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="john@youragency.com" style={INP}/></div>
            <div style={{ marginBottom:24 }}>
              <label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Password</label>
              <div style={{ position:'relative' }}>
                <input type={showPw?'text':'password'} value={form.password} onChange={e=>set('password',e.target.value)} placeholder="8+ characters" style={{ ...INP, paddingRight:44 }}/>
                <button type="button" onClick={()=>setShowPw(s=>!s)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>
                  {showPw?<EyeOff size={16}/>:<Eye size={16}/>}
                </button>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setStep(1)} style={{ padding:'14px 20px', borderRadius:12, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:14, cursor:'pointer', color:'#374151', fontWeight:600 }}>← Back</button>
              <button onClick={()=>{ if(!form.email||!form.password||!form.first_name) { toast.error('Please fill all fields'); return; } setStep(3) }} style={{ flex:1, padding:'14px', borderRadius:12, border:'none', background:ACCENT, color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                Continue <ArrowRight size={16}/>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Agency */}
        {step===3&&(
          <div style={{ background:'#fff', borderRadius:20, border:'1px solid #e5e7eb', padding:'32px' }}>
            <h2 style={{ fontSize:24, fontWeight:900, color:'#111', marginBottom:6 }}>Set up your agency</h2>
            <p style={{ fontSize:14, color:'#6b7280', marginBottom:24 }}>This is how your brand will appear to your clients.</p>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Agency Name</label>
              <input value={form.agency_name} onChange={e=>{ set('agency_name',e.target.value); set('agency_slug',slugify(e.target.value)) }} placeholder="Apex Digital Marketing" style={INP}/>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Your Subdomain</label>
              <div style={{ display:'flex', alignItems:'center', borderRadius:12, border:'2px solid #e5e7eb', overflow:'hidden', background:'#fff' }}>
                <input value={form.agency_slug} onChange={e=>set('agency_slug',slugify(e.target.value))} placeholder="apex-digital" style={{ ...INP, border:'none', borderRadius:0, flex:1 }}/>
                <span style={{ padding:'14px 16px', background:'#f9fafb', fontSize:14, color:'#9ca3af', borderLeft:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>.mooseai.com</span>
              </div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:5 }}>Your clients will use: app.{form.agency_slug||'your-agency'}.mooseai.com</div>
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={{ fontSize:13, fontWeight:700, display:'block', marginBottom:6 }}>Billing Email</label>
              <input type="email" value={form.billing_email} onChange={e=>set('billing_email',e.target.value)} placeholder={form.email||'billing@youragency.com'} style={INP}/>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setStep(2)} style={{ padding:'14px 20px', borderRadius:12, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:14, cursor:'pointer', color:'#374151', fontWeight:600 }}>← Back</button>
              <button onClick={createAgency} disabled={loading||!form.agency_name}
                style={{ flex:1, padding:'14px', borderRadius:12, border:'none', background:'#22c55e', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', opacity:loading||!form.agency_name?.7:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {loading?<><Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/> Creating Agency…</>:<>Launch My Agency 🚀</>}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
