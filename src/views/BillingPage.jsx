"use client"
import { useState, useEffect } from 'react'
import { CreditCard, Check, Zap, Users, BarChart2, Shield, ExternalLink, Loader2, Star, AlertCircle, RefreshCw } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'
const BLK  = '#0a0a0a'
const FH   = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB   = "'Raleway','Helvetica Neue',sans-serif"

const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 297, period: '/mo',
    desc: 'Perfect for boutique agencies',
    color: TEAL,
    features: ['Up to 25 clients', '3 team seats', 'SEO Hub + rank tracking', 'AI review responses', 'Scout lead intelligence', 'Client onboarding forms', 'KotoDesk support tickets'],
  },
  {
    id: 'growth', name: 'Growth', price: 497, period: '/mo',
    desc: 'Most popular for growing agencies',
    color: RED, popular: true,
    features: ['Up to 100 clients', '10 team seats', 'Everything in Starter', 'Grid heatmap tracking', 'Performance marketing AI', 'White-label client portal', 'Priority support'],
  },
  {
    id: 'agency', name: 'Agency', price: 997, period: '/mo',
    desc: 'Full power for large agencies',
    color: BLK,
    features: ['Unlimited clients', 'Unlimited seats', 'Everything in Growth', 'Custom domain portal', 'API access', 'Dedicated onboarding', 'SLA support'],
  },
]

const STATUS_CFG = {
  active:   { label:'Active',   color:'#16a34a', bg:'#f0fdf4' },
  trialing: { label:'Trial',    color:'#7c3aed', bg:'#f5f3ff' },
  canceled: { label:'Canceled', color:RED,       bg:'#fef2f2' },
  past_due: { label:'Past Due', color:'#d97706', bg:'#fffbeb' },
}

export default function BillingPage() {
  const { user, agencyId } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [checkingOut,  setCheckingOut]  = useState(null)
  const [openingPortal,setOpeningPortal]= useState(false)
  const [agency,       setAgency]       = useState(null)

  useEffect(() => { if (agencyId) loadBilling() }, [agencyId])

  async function loadBilling() {
    setLoading(true)
    const [{ data: sub }, { data: ag }] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('agency_id', agencyId).maybeSingle(),
      supabase.from('agencies').select('name,plan,billing_email').eq('id', agencyId).maybeSingle(),
    ])
    setSubscription(sub)
    setAgency(ag)
    setLoading(false)
  }

  async function startCheckout(planId) {
    setCheckingOut(planId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, agency_id: agencyId, email: user?.email || agency?.billing_email, agency_name: agency?.name }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      window.location.href = data.url
    } catch (e) { toast.error('Checkout failed: ' + e.message) }
    setCheckingOut(null)
  }

  async function openBillingPortal() {
    setOpeningPortal(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agency_id: agencyId }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      window.open(data.url, '_blank')
    } catch (e) { toast.error('Failed: ' + e.message) }
    setOpeningPortal(false)
  }

  const currentPlan = PLANS.find(p => p.id === (subscription?.plan || agency?.plan))
  const statusCfg   = STATUS_CFG[subscription?.status || 'trialing'] || STATUS_CFG.trialing

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, overflowY:'auto' }}>
        <div style={{ maxWidth:960, margin:'0 auto', padding:'32px 28px' }}>

          {/* Header */}
          <div style={{ marginBottom:28 }}>
            <h1 style={{ fontFamily:FH, fontSize:24, fontWeight:800, color:BLK, margin:'0 0 4px', letterSpacing:'-.03em' }}>Billing & Plans</h1>
            <p style={{ fontSize:15, color:'#6b7280', fontFamily:FB, margin:0 }}>Manage your Koto subscription</p>
          </div>

          {/* Current subscription status */}
          {!loading && (subscription || agency) && (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px 24px', marginBottom:24, display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:48, height:48, borderRadius:14, background:statusCfg.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <CreditCard size={22} color={statusCfg.color}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:3 }}>
                  <span style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK }}>{agency?.name || 'Your Agency'}</span>
                  <span style={{ fontSize:12, fontWeight:700, padding:'2px 9px', borderRadius:20, background:statusCfg.bg, color:statusCfg.color, fontFamily:FH }}>
                    {statusCfg.label}
                  </span>
                </div>
                <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB }}>
                  {currentPlan ? `${currentPlan.name} plan — $${currentPlan.price}/mo` : 'No active plan'}
                  {subscription?.current_period_end && ` · Renews ${new Date(subscription.current_period_end).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`}
                </div>
              </div>
              {subscription?.stripe_customer_id && (
                <button onClick={openBillingPortal} disabled={openingPortal}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                  {openingPortal ? <Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> : <ExternalLink size={13}/>}
                  {openingPortal ? 'Opening…' : 'Manage Billing'}
                </button>
              )}
              <button onClick={loadBilling} disabled={loading}
                style={{ padding:'9px 12px', borderRadius:10, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#9ca3af' }}>
                <RefreshCw size={13}/>
              </button>
            </div>
          )}

          {/* Stripe not configured notice */}
          <div style={{ background:'#fffbeb', borderRadius:14, border:'1px solid #fde68a', padding:'14px 18px', marginBottom:24, display:'flex', gap:12, alignItems:'flex-start' }}>
            <AlertCircle size={18} color="#d97706" style={{ flexShrink:0, marginTop:1 }}/>
            <div>
              <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:'#92400e', marginBottom:3 }}>To enable Stripe payments, add these to Vercel env vars:</div>
              <div style={{ fontSize:13, color:'#78350f', fontFamily:'monospace', lineHeight:2 }}>
                STRIPE_SECRET_KEY=sk_live_...<br/>
                STRIPE_WEBHOOK_SECRET=whsec_...<br/>
                STRIPE_PRICE_STARTER=price_...<br/>
                STRIPE_PRICE_GROWTH=price_...<br/>
                STRIPE_PRICE_AGENCY=price_...
              </div>
              <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer"
                style={{ fontSize:13, color:'#d97706', fontFamily:FH, fontWeight:700, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:4, marginTop:6 }}>
                Open Stripe Dashboard <ExternalLink size={11}/>
              </a>
            </div>
          </div>

          {/* Plan cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:32 }}>
            {PLANS.map(plan => {
              const isCurrent = subscription?.plan === plan.id || (!subscription && agency?.plan === plan.id)
              return (
                <div key={plan.id} style={{ background:'#fff', borderRadius:18, border:isCurrent?`2px solid ${plan.color}`:`1.5px solid #e5e7eb`, padding:'24px 22px', position:'relative', overflow:'hidden' }}>
                  {plan.popular && (
                    <div style={{ position:'absolute', top:16, right:16, fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:20, background:RED, color:'#fff', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.07em' }}>
                      Most Popular
                    </div>
                  )}
                  {isCurrent && (
                    <div style={{ position:'absolute', top:16, right:plan.popular?72:16, fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:20, background:plan.color, color:'#fff', fontFamily:FH }}>
                      Current
                    </div>
                  )}
                  <div style={{ fontFamily:FH, fontSize:18, fontWeight:900, color:BLK, marginBottom:2 }}>{plan.name}</div>
                  <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB, marginBottom:14 }}>{plan.desc}</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:20 }}>
                    <span style={{ fontFamily:FH, fontSize:36, fontWeight:900, color:BLK, letterSpacing:'-.03em' }}>${plan.price}</span>
                    <span style={{ fontSize:14, color:'#9ca3af', fontFamily:FB }}>{plan.period}</span>
                  </div>
                  <button
                    onClick={()=>!isCurrent&&startCheckout(plan.id)}
                    disabled={isCurrent||checkingOut===plan.id}
                    style={{ width:'100%', padding:'11px', borderRadius:11, border:'none',
                      background:isCurrent?'#f3f4f6':plan.color, color:isCurrent?'#9ca3af':'#fff',
                      fontSize:14, fontWeight:700, cursor:isCurrent?'default':'pointer', fontFamily:FH,
                      display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:18 }}>
                    {checkingOut===plan.id ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : null}
                    {isCurrent ? 'Current Plan' : checkingOut===plan.id ? 'Opening Stripe…' : 'Choose Plan'}
                  </button>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {plan.features.map((f,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'#374151', fontFamily:FB }}>
                        <Check size={13} color={plan.color} style={{ flexShrink:0, marginTop:2 }}/> {f}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer note */}
          <div style={{ textAlign:'center', fontSize:13, color:'#9ca3af', fontFamily:FB }}>
            All plans include a 14-day free trial. Cancel anytime. Questions? Email <a href="mailto:hello@hellokoto.com" style={{ color:RED }}>hello@hellokoto.com</a>
          </div>

        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
