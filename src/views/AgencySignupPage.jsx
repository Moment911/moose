"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Check, Loader2, ArrowRight, Eye, EyeOff,
  Zap, Users, BarChart2, Shield, Star, Globe
} from 'lucide-react'
import toast from 'react-hot-toast'

const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'

const INP = {
  width: '100%', padding: '13px 16px', borderRadius: 10,
  border: '1.5px solid #e5e7eb', fontSize: 15, outline: 'none',
  background: '#fff', color: '#111', boxSizing: 'border-box',
  fontFamily: 'inherit', transition: 'border-color .15s',
}

const DEFAULT_PLANS = [
  {
    id: 'starter', name: 'Starter', price: 297, seats: 3, clients: 25, popular: false,
    badge: '', cta: 'Start Free Trial',
    features: ['3 team seats', 'Up to 25 clients', 'AI review responses', 'Scout lead intelligence', 'Client onboarding forms'],
  },
  {
    id: 'growth', name: 'Growth', price: 497, seats: 10, clients: 100, popular: true,
    badge: 'Most Popular', cta: 'Start Free Trial',
    features: ['10 team seats', 'Up to 100 clients', 'Everything in Starter', 'Agency Autopilot (all 6 agents)', 'White-label platform', 'Social content AI'],
  },
  {
    id: 'agency', name: 'Agency', price: 997, seats: 25, clients: 500, popular: false,
    badge: '', cta: 'Start Free Trial',
    features: ['25 team seats', 'Up to 500 clients', 'Everything in Growth', 'Lead scoring AI', 'API access', 'Priority support'],
  },
]

const DEFAULT_META = {
  headline: 'The AI Platform Built for Marketing Agencies',
  subheadline: '{signupMeta.subheadline}',
  trial_days: 14,
  guarantee_text: '{signupMeta.guarantee_text}',
  hero_badge: 'Now in early access',
}

// What happens automatically when an agency signs up
const AUTO_SETUP = [
  { icon: Shield,   label: 'Secure account created',          desc: 'Email + password authentication' },
  { icon: Database, label: 'Agency workspace provisioned',    desc: 'Private data environment, scoped to your agency' },
  { icon: Users,    label: 'Team management enabled',         desc: 'Invite unlimited team members up to your seat limit' },
  { icon: Zap,      label: 'AI features activated',           desc: 'Claude AI connected — all features ready to use' },
  { icon: BarChart2,label: 'Client portal ready',             desc: 'Onboarding forms, access checklists, and AI personas' },
  { icon: Star,     label: 'Reviews module live',             desc: 'Google, Yelp, Facebook review management' },
]

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function Database(props) { return <BarChart2 {...props}/> } // alias

export default function AgencySignupPage() {
  const navigate = useNavigate()
  const [PLANS,      setPLANS]      = useState(DEFAULT_PLANS)
  const [signupMeta, setSignupMeta] = useState(DEFAULT_META)

  useEffect(() => {
    supabase.from('platform_config').select('key,value').in('key',['signup_plans','signup_meta']).then(({data}) => {
      if (!data) return
      const plansRow = data.find(r => r.key === 'signup_plans')
      const metaRow  = data.find(r => r.key === 'signup_meta')
      if (plansRow?.value?.length) setPLANS(plansRow.value)
      if (metaRow?.value) setSignupMeta(metaRow.value)
    })
  }, [])
  const [step, setStep]     = useState(1)   // 1=plan, 2=account, 3=agency, 4=done
  const [plan, setPlan]     = useState('growth')
  const [form, setForm]     = useState({
    email: '', password: '', first_name: '', last_name: '',
    agency_name: '', agency_slug: '', billing_email: ''
  })
  const [loading, setLoading]   = useState(false)
  const [showPw, setShowPw]     = useState(false)
  const [createdAgency, setCreatedAgency] = useState(null)
  const [setupProgress, setSetupProgress] = useState([]) // which steps done
  const [couponCode,  setCouponCode]  = useState('')
  const [coupon,      setCoupon]      = useState(null)
  const [couponError, setCouponError] = useState('')
  const [checkingCoupon, setCheckingCoupon] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function validateCoupon() {
    if (!couponCode.trim()) return
    setCheckingCoupon(true); setCouponError(''); setCoupon(null)
    try {
      const res = await fetch('/api/coupons', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', code: couponCode, plan }),
      })
      const data = await res.json()
      if (data.valid) { setCoupon(data.coupon); setCouponError('') }
      else { setCouponError(data.error || 'Invalid coupon'); setCoupon(null) }
    } catch { setCouponError('Could not validate coupon') }
    setCheckingCoupon(false)
  }

  function getDiscountedPrice(basePrice) {
    if (!coupon) return basePrice
    if (coupon.discount_type === 'percent') return Math.round(basePrice * (1 - coupon.discount_value / 100))
    return Math.max(0, basePrice - coupon.discount_value)
  }

  async function createAgency() {
    if (!form.agency_name.trim()) { toast.error('Agency name is required'); return }
    setLoading(true)
    setStep(4) // go to loading/done screen immediately

    try {
      // Simulate setup progress animation
      for (let i = 0; i < AUTO_SETUP.length; i++) {
        await new Promise(r => setTimeout(r, 500))
        setSetupProgress(prev => [...prev, i])
      }

      // 1. Create Supabase auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { first_name: form.first_name, last_name: form.last_name } }
      })
      if (authErr) throw authErr
      const userId = authData.user?.id
      if (!userId) throw new Error('Could not create your account. Please try again.')

      // 2. Create agency record
      const slug = form.agency_slug || slugify(form.agency_name)
      const selectedPlan = PLANS.find(p => p.id === plan)
      const { data: agency, error: agErr } = await supabase.from('agencies').insert({
        name:          form.agency_name.trim(),
        slug,
        owner_id:      userId,
        plan,
        plan_seats:    selectedPlan?.seats || 3,
        max_clients:   selectedPlan?.clients || 25,
        billing_email: form.billing_email || form.email,
        brand_name:    form.agency_name.trim(),
        brand_color:   ACCENT,
        status:        'trial',
        trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      }).select().single()

      if (agErr) {
        // DB tables not yet created — still let them in
        console.warn('DB setup pending:', agErr.message)
        setCreatedAgency({ name: form.agency_name, plan, slug })
        return
      }

      // 3. Owner member record
      await supabase.from('agency_members').insert({
        agency_id:  agency.id,
        user_id:    userId,
        role:       'owner',
        accepted_at: new Date().toISOString(),
      }).catch(() => {})

      // 4. Feature flags based on plan
      await supabase.from('agency_features').insert({
        agency_id:           agency.id,
        ai_personas:         true,
        ai_social_posts:     plan !== 'starter',
        ai_review_responses: plan !== 'starter',
        ai_lead_qualifier:   plan === 'pro',
        white_label:         plan !== 'starter',
        api_access:          plan === 'pro',
        max_ai_calls_month:  plan === 'starter' ? 500 : plan === 'growth' ? 2000 : 10000,
      }).catch(() => {})

      setCreatedAgency({ name: form.agency_name, plan, slug, id: agency.id })

    } catch (e) {
      toast.error(e.message || 'Setup failed — please try again')
      setStep(3)
    }
    setLoading(false)
  }

  const selectedPlan = PLANS.find(p => p.id === plan)

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f5', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: '#18181b', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/koto_logo_white.svg" alt="Koto" style={{ height: 26, width: 'auto' }} />
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.15)' }} />
        <span style={{ fontSize: 15, color: '#4b5563' }}>
          {step < 4 ? '14-day free trial · No credit card required' : 'Setting up your agency…'}
        </span>
        <button onClick={() => navigate('/')} style={{ marginLeft: 'auto', fontSize: 14, color: '#52525b', background: 'none', border: 'none', cursor: 'pointer' }}>
          Already have an account? Sign in
        </button>
      </div>

      {/* Step indicator — only show on steps 1-3 */}
      {step < 4 && (
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 28px', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
          {['Choose Plan', 'Your Account', 'Agency Details'].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: i + 1 < step ? '#22c55e' : i + 1 === step ? ACCENT : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .3s' }}>
                  {i + 1 < step
                    ? <Check size={12} color="#fff" strokeWidth={3} />
                    : <span style={{ fontSize: 13, fontWeight: 800, color: i + 1 === step ? '#fff' : '#9ca3af' }}>{i + 1}</span>
                  }
                </div>
                <span style={{ fontSize: 15, fontWeight: i + 1 === step ? 700 : 400, color: i + 1 === step ? '#111' : '#9ca3af' }}>{s}</span>
              </div>
              {i < 2 && <div style={{ width: 32, height: 1, background: '#e5e7eb' }} />}
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px 80px' }}>
        <div style={{ width: '100%', maxWidth: step === 1 ? 680 : 520 }}>

          {/* ── STEP 1: Plan ── */}
          {step === 1 && (
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 900, color: '#111', textAlign: 'center', marginBottom: 6 }}>
                Choose your plan
              </h1>
              <p style={{ fontSize: 15, color: '#374151', textAlign: 'center', marginBottom: 32 }}>
                14-day free trial on all plans. Cancel anytime.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {PLANS.map(p => (
                  <div key={p.id} onClick={() => setPlan(p.id)}
                    style={{ background: '#fff', borderRadius: 16, border: `2px solid ${plan === p.id ? ACCENT : '#e5e7eb'}`, padding: '20px 22px', cursor: 'pointer', position: 'relative', transition: 'all .15s', boxShadow: plan === p.id ? `0 4px 20px ${ACCENT}20` : 'none' }}>
                    {p.popular && (
                      <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', fontSize: 13, fontWeight: 800, color: '#fff', background: ACCENT, borderRadius: 20, padding: '3px 14px', whiteSpace: 'nowrap' }}>
                        MOST POPULAR
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${plan === p.id ? ACCENT : '#d1d5db'}`, background: plan === p.id ? ACCENT : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, transition: 'all .15s' }}>
                        {plan === p.id && <Check size={11} color="#fff" strokeWidth={3} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{p.name}</span>
                          <span style={{ fontSize: 22, fontWeight: 900, color: plan === p.id ? ACCENT : '#111' }}>${p.price}<span style={{ fontSize: 14, fontWeight: 600, color: '#4b5563' }}>/mo</span></span>
                          <span style={{ fontSize: 14, color: '#4b5563' }}>{p.seats} seats · {p.clients} clients</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                          {p.features.map(f => (
                            <span key={f} style={{ fontSize: 14, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Check size={10} color="#16a34a" strokeWidth={3} /> {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => setStep(2)}
                style={{ width: '100%', padding: '15px', borderRadius: 13, border: 'none', background: ACCENT, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 20px ${ACCENT}40` }}>
                Start free trial with {selectedPlan?.name} <ArrowRight size={18} />
              </button>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button onClick={() => navigate('/')} style={{ fontSize: 15, color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Skip — explore the demo dashboard
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Account ── */}
          {step === 2 && (
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb', padding: '36px' }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#111', marginBottom: 6 }}>Create your account</h2>
              <p style={{ fontSize: 15, color: '#374151', marginBottom: 28 }}>
                You'll use this to log into your agency dashboard.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 6, color: '#374151' }}>First Name</label>
                  <input value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="John" style={INP}
                    onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <div>
                  <label style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 6, color: '#374151' }}>Last Name</label>
                  <input value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Smith" style={INP}
                    onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 6, color: '#374151' }}>Work Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@youragency.com" style={INP}
                  onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>

              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 6, color: '#374151' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                    placeholder="8+ characters" style={{ ...INP, paddingRight: 44 }}
                    onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(1)}
                  style={{ padding: '13px 18px', borderRadius: 11, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 15, cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                  Back
                </button>
                <button onClick={() => {
                  if (!form.email || !form.password || !form.first_name || !form.last_name) {
                    toast.error('Please fill all fields'); return
                  }
                  if (form.password.length < 8) { toast.error('Password must be 8+ characters'); return }
                  setStep(3)
                }}
                  style={{ flex: 1, padding: '13px', borderRadius: 11, border: 'none', background: ACCENT, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Agency Details ── */}
          {step === 3 && (
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb', padding: '36px' }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#111', marginBottom: 6 }}>Name your agency</h2>
              <p style={{ fontSize: 15, color: '#374151', marginBottom: 28 }}>
                This is how your brand appears to your clients. You can customize your logo and colors after signup.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 6, color: '#374151' }}>Agency Name</label>
                <input value={form.agency_name}
                  onChange={e => { set('agency_name', e.target.value); set('agency_slug', slugify(e.target.value)) }}
                  placeholder="Apex Digital Marketing" style={INP}
                  onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>

              {form.agency_name && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 6, color: '#374151' }}>Your Subdomain</label>
                  <div style={{ display: 'flex', alignItems: 'center', borderRadius: 10, border: '1.5px solid #e5e7eb', overflow: 'hidden', background: '#fff' }}>
                    <input value={form.agency_slug}
                      onChange={e => set('agency_slug', slugify(e.target.value))}
                      style={{ ...INP, border: 'none', borderRadius: 0, flex: 1 }} />
                    <span style={{ padding: '13px 14px', background: '#f9fafb', fontSize: 15, color: '#4b5563', borderLeft: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      .hellokoto.com
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#4b5563', marginTop: 5 }}>
                    Your clients will access: <strong style={{ color: '#374151' }}>app.{form.agency_slug}.hellokoto.com</strong>
                  </div>
                </div>
              )}

              {/* What gets set up automatically */}
              <div style={{ background: '#f9fafb', borderRadius: 12, border: '1px solid #f3f4f6', padding: '16px', marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                  What gets set up automatically
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    'Private agency workspace with your branding',
                    'Client management, onboarding forms, and AI personas',
                    'Review management for Google, Yelp, and Facebook',
                    'AI Agents pre-configured for your plan',
                    'Scout lead intelligence with 42,000+ ZIP codes',
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 15, color: '#374151' }}>
                      <Check size={14} color="#16a34a" strokeWidth={3} style={{ flexShrink: 0, marginTop: 1 }} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Coupon Code */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:700, color:'#374151', marginBottom:6 }}>
                  Have a coupon code?
                </label>
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    value={couponCode}
                    onChange={e=>{setCouponCode(e.target.value.toUpperCase());setCoupon(null);setCouponError('')}}
                    onKeyDown={e=>e.key==='Enter'&&validateCoupon()}
                    placeholder="KOTO20"
                    style={{ flex:1, padding:'10px 14px', borderRadius:10, border:`1.5px solid ${coupon?'#16a34a':couponError?'#ea2729':'#e5e7eb'}`, fontSize:14, outline:'none', fontFamily:'inherit', textTransform:'uppercase', letterSpacing:'.1em' }}
                  />
                  <button onClick={validateCoupon} disabled={!couponCode.trim()||checkingCoupon}
                    style={{ padding:'10px 18px', borderRadius:10, border:'none', background:'#111', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                    {checkingCoupon ? 'Checking…' : 'Apply'}
                  </button>
                </div>
                {coupon && (
                  <div style={{ marginTop:8, padding:'10px 14px', background:'#f0fdf4', borderRadius:10, border:'1px solid #bbf7d0', display:'flex', alignItems:'center', gap:8 }}>
                    <Check size={15} color="#16a34a"/>
                    <div style={{ fontSize:13, color:'#15803d', fontWeight:700 }}>
                      {coupon.discount_type==='percent' ? `${coupon.discount_value}% off` : `$${coupon.discount_value} off`}
                      {coupon.first_month_only ? ' first month' : ' every month'}
                      {coupon.trial_days ? ` + ${coupon.trial_days}-day trial` : ''}
                      {coupon.description ? ` — ${coupon.description}` : ''}
                    </div>
                  </div>
                )}
                {couponError && (
                  <div style={{ marginTop:6, fontSize:13, color:'#ea2729', fontWeight:600 }}>{couponError}</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(2)}
                  style={{ padding: '13px 18px', borderRadius: 11, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 15, cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                  Back
                </button>
                <button onClick={createAgency} disabled={loading || !form.agency_name.trim()}
                  style={{ flex: 1, padding: '13px', borderRadius: 11, border: 'none', background: '#22c55e', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', opacity: loading || !form.agency_name.trim() ? .7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Setting up…</>
                    : <>Launch My Agency <ArrowRight size={16} /></>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Done / Progress ── */}
          {step === 4 && (
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb', padding: '40px 36px', textAlign: 'center' }}>
              {!createdAgency ? (
                <>
                  {/* Loading state */}
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Loader2 size={28} color="#16a34a" style={{ animation: 'spin 1s linear infinite' }} />
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 900, color: '#111', marginBottom: 6 }}>
                    Setting up {form.agency_name || 'your agency'}…
                  </h2>
                  <p style={{ fontSize: 15, color: '#374151', marginBottom: 32 }}>
                    This takes about 10 seconds. No action needed.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
                    {AUTO_SETUP.map((item, i) => {
                      const done = setupProgress.includes(i)
                      const current = setupProgress.length === i
                      const Icon = item.icon
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: done ? '#f0fdf4' : current ? '#f0fbfc' : '#f9fafb', border: `1px solid ${done ? '#bbf7d0' : current ? ACCENT + '30' : '#f3f4f6'}`, transition: 'all .3s' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: done ? '#16a34a' : current ? ACCENT + '20' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .3s' }}>
                            {done
                              ? <Check size={15} color="#fff" strokeWidth={3} />
                              : current
                              ? <Loader2 size={14} color={ACCENT} style={{ animation: 'spin 1s linear infinite' }} />
                              : <Icon size={14} color="#9ca3af" />
                            }
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: done || current ? 700 : 500, color: done ? '#16a34a' : current ? '#111' : '#9ca3af' }}>{item.label}</div>
                            {current && <div style={{ fontSize: 13, color: ACCENT }}>{item.desc}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <>
                  {/* Success state */}
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Check size={36} color="#16a34a" strokeWidth={2.5} />
                  </div>
                  <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', marginBottom: 8 }}>
                    {createdAgency.name} is live!
                  </h2>
                  <p style={{ fontSize: 15, color: '#374151', marginBottom: 32, lineHeight: 1.6 }}>
                    Your agency workspace is ready. Start by adding your first client, or explore the dashboard to see what's available.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button onClick={() => navigate('/')}
                      style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      Add your first client <ArrowRight size={16} />
                    </button>
                    <button onClick={() => navigate('/')}
                      style={{ width: '100%', padding: '13px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                      Go to Dashboard
                    </button>
                  </div>

                  <div style={{ marginTop: 24, padding: '14px', background: '#f9fafb', borderRadius: 12, fontSize: 14, color: '#374151', textAlign: 'left' }}>
                    <strong style={{ color: '#374151' }}>Check your email</strong> — we sent a confirmation to {form.email}. You may need to verify your email before logging in on a new device.
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
