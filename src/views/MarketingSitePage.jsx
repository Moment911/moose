"use client";
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, Check, Star, Zap, Globe, Users, BarChart2,
  Shield, ArrowRight, Play, Menu, X, ChevronDown,
  Sparkles, Target, TrendingUp, DollarSign, Clock,
  MessageSquare, Phone, Mail, Building, Cpu, RefreshCw
} from 'lucide-react'

const ACCENT = '#E8551A'
const DARK   = '#0f0f11'
const DARK2  = '#18181b'

// ── Reusable primitives ───────────────────────────────────────────────────────
function Btn({ children, variant='primary', size='md', onClick, href, style={} }) {
  const base = {
    display:'inline-flex', alignItems:'center', gap:8, fontWeight:700,
    cursor:'pointer', borderRadius:12, textDecoration:'none', border:'none',
    transition:'all .15s', fontFamily:'inherit',
    ...(size==='lg' ? { padding:'16px 32px', fontSize:17 } :
        size==='sm' ? { padding:'8px 16px', fontSize:15 } :
                      { padding:'12px 24px', fontSize:15 }),
    ...(variant==='primary' ? { background:ACCENT, color:'#fff', boxShadow:`0 6px 24px ${ACCENT}40` } :
        variant==='dark'    ? { background:DARK2, color:'#fff', boxShadow:'0 4px 16px rgba(0,0,0,.3)' } :
        variant==='outline' ? { background:'transparent', color:ACCENT, border:`2px solid ${ACCENT}` } :
        variant==='ghost'   ? { background:'rgba(255,255,255,.08)', color:'#fff', border:'1px solid rgba(255,255,255,.15)' } :
                              { background:'#fff', color:'#111' }),
    ...style,
  }
  const el = href
    ? <a href={href} style={base} onClick={onClick}>{children}</a>
    : <button style={base} onClick={onClick}>{children}</button>
  return el
}

function Badge({ children, color=ACCENT }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:14, fontWeight:800, color, background:color+'15', border:`1px solid ${color}30`, borderRadius:20, padding:'4px 14px', textTransform:'uppercase', letterSpacing:'.06em' }}>
      {children}
    </span>
  )
}

function SectionLabel({ children }) {
  return <Badge color={ACCENT}><Sparkles size={11}/>{children}</Badge>
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ onLogin }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])
  const links = ['Features','Pricing','How It Works','FAQ']
  return (
    <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, transition:'all .3s', background: scrolled?'rgba(15,15,17,.95)':'transparent', backdropFilter: scrolled?'blur(20px)':'none', borderBottom: scrolled?'1px solid rgba(255,255,255,.08)':'none' }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 24px', height:68, display:'flex', alignItems:'center', gap:32 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <img src="/moose-logo.svg" alt="Moose AI" style={{ height:28, filter:'brightness(0) invert(1)' }} />
        </div>
        <div style={{ flex:1, display:'flex', gap:28, justifyContent:'center' }}>
          {links.map(l => <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-')}`} style={{ fontSize:15, fontWeight:600, color:'rgba(255,255,255,.7)', textDecoration:'none', transition:'color .15s' }} onMouseEnter={e=>e.target.style.color='#fff'} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,.7)'}>{l}</a>)}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="ghost" size="sm" onClick={onLogin}>Sign In</Btn>
          <Btn variant="primary" size="sm" href="#pricing">Start Free Trial</Btn>
        </div>
      </div>
    </nav>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ onLogin }) {
  return (
    <section style={{ background:`linear-gradient(160deg, ${DARK} 0%, #1a0a04 50%, ${DARK} 100%)`, minHeight:'100vh', display:'flex', alignItems:'center', position:'relative', overflow:'hidden', paddingTop:80 }}>
      {/* Background glow orbs */}
      <div style={{ position:'absolute', top:'20%', left:'10%', width:500, height:500, borderRadius:'50%', background:`radial-gradient(circle, ${ACCENT}18 0%, transparent 70%)`, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'10%', right:'5%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, #8b5cf615 0%, transparent 70%)', pointerEvents:'none' }}/>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'80px 24px', textAlign:'center', position:'relative', zIndex:1 }}>
        <div style={{ marginBottom:28 }}>
          <SectionLabel>The AI Platform for Marketing Agencies</SectionLabel>
        </div>

        <h1 style={{ fontSize:'clamp(42px,7vw,80px)', fontWeight:900, color:'#fff', margin:'0 0 24px', lineHeight:1.05, letterSpacing:-2 }}>
          Your agency runs on{' '}
          <span style={{ background:`linear-gradient(135deg, ${ACCENT}, #ff8c42)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            AI now.
          </span>
        </h1>

        <p style={{ fontSize:'clamp(17px,2.5vw,22px)', color:'rgba(255,255,255,.65)', maxWidth:680, margin:'0 auto 48px', lineHeight:1.65 }}>
          White-label Moose AI under your agency brand. Your clients fill out one smart onboarding form. Our AI builds their marketing strategy, generates their persona, writes their content, and manages their accounts — automatically.
        </p>

        <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap', marginBottom:60 }}>
          <Btn variant="primary" size="lg" href="#pricing">
            Start 14-Day Free Trial <ArrowRight size={18}/>
          </Btn>
          <Btn variant="ghost" size="lg" href="#how-it-works">
            <Play size={16}/> See It In Action
          </Btn>
        </div>

        {/* Social proof bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:32, flexWrap:'wrap' }}>
          {[
            { n:'500+', label:'Agency Clients Onboarded' },
            { n:'94%', label:'Client Retention Rate' },
            { n:'12hrs', label:'Saved Per Client Per Week' },
            { n:'$0', label:'Per Seat to Get Started' },
          ].map(s => (
            <div key={s.label} style={{ textAlign:'center' }}>
              <div style={{ fontSize:28, fontWeight:900, color:'#fff' }}>{s.n}</div>
              <div style={{ fontSize:14, color:'rgba(255,255,255,.4)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Hero visual mockup */}
        <div style={{ marginTop:72, maxWidth:900, margin:'72px auto 0', position:'relative' }}>
          <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:20, padding:3, backdropFilter:'blur(10px)' }}>
            <div style={{ background:DARK2, borderRadius:18, overflow:'hidden' }}>
              {/* Fake browser chrome */}
              <div style={{ background:'#0a0a0d', padding:'12px 16px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                {['#ff5f57','#febc2e','#28c840'].map(c=><div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }}/>)}
                <div style={{ flex:1, background:'rgba(255,255,255,.05)', borderRadius:6, height:24, marginLeft:12, display:'flex', alignItems:'center', paddingLeft:12 }}>
                  <span style={{ fontSize:13, color:'rgba(255,255,255,.3)' }}>app.youragency.com</span>
                </div>
              </div>
              {/* Dashboard preview */}
              <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', height:380 }}>
                {/* Sidebar */}
                <div style={{ background:'#111113', borderRight:'1px solid rgba(255,255,255,.06)', padding:'16px 12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24, padding:'0 8px' }}>
                    <div style={{ width:28, height:28, borderRadius:7, background:ACCENT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:'#fff' }}>Y</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>Your Agency</div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,.3)' }}>White-labeled</div>
                    </div>
                  </div>
                  {['Project Hub','Clients','Scout','AI Agents','Social Planner','Reporting','Payments'].map((item, i) => (
                    <div key={item} style={{ padding:'8px 10px', borderRadius:8, marginBottom:2, background: i===1?'rgba(232,85,26,.15)':'transparent', display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background: i===1?ACCENT:'rgba(255,255,255,.15)' }}/>
                      <span style={{ fontSize:14, color: i===1?ACCENT:'rgba(255,255,255,.45)', fontWeight: i===1?700:400 }}>{item}</span>
                    </div>
                  ))}
                </div>
                {/* Main area */}
                <div style={{ padding:20, overflow:'hidden' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>Clients — 18 Active</div>
                    <div style={{ fontSize:13, padding:'4px 10px', borderRadius:7, background:ACCENT+'20', color:ACCENT, fontWeight:700 }}>+ Add Client</div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                    {['Acme Plumbing','Miami Dental','FitLife Gym','Sunrise HVAC','LexGroup Law','GreenThumb Co'].map((name,i) => (
                      <div key={name} style={{ background:'rgba(255,255,255,.04)', borderRadius:10, padding:'10px 12px', border:'1px solid rgba(255,255,255,.07)' }}>
                        <div style={{ width:24, height:24, borderRadius:6, background:ACCENT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', marginBottom:6 }}>{name[0]}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:2 }}>{name}</div>
                        <div style={{ fontSize:12, color:'rgba(255,255,255,.3)' }}>{['Active','Onboarding','Active','Active','Onboarding','Active'][i]}</div>
                      </div>
                    ))}
                  </div>
                  {/* AI activity pulse */}
                  <div style={{ marginTop:14, background:'rgba(232,85,26,.08)', border:'1px solid rgba(232,85,26,.2)', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', animation:'pulse 1.5s infinite' }}/>
                    <span style={{ fontSize:13, color:'rgba(255,255,255,.6)' }}>AI generated 3 social posts, responded to 7 reviews, sent 12 follow-up emails today</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Glow under mockup */}
          <div style={{ position:'absolute', bottom:-40, left:'50%', transform:'translateX(-50%)', width:'60%', height:60, background:ACCENT, borderRadius:'50%', filter:'blur(40px)', opacity:.2 }}/>
        </div>
      </div>
    </section>
  )
}

// ── How It Works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { n:'01', icon:'🏷️', title:'You white-label it', desc:'Add your agency name, logo, and colors. Share your custom URL with clients. They never see "Moose AI" — just your brand.' },
    { n:'02', icon:'📋', title:'Client fills out onboarding', desc:'A beautiful 14-step AI-assisted form captures everything: business info, competitors, ideal customers, brand voice, logins, and goals.' },
    { n:'03', icon:'🤖', title:'AI builds their profile', desc:'Claude generates a detailed customer persona, ad targeting strategy, keyword list, headline angles, and channel recommendations — automatically.' },
    { n:'04', icon:'🚀', title:'AI works every day', desc:'Review responses, social posts, lead follow-ups, performance reports — generated and queued automatically. You review and approve in seconds.' },
    { n:'05', icon:'📈', title:'You look like a superagency', desc:'Your clients get Fortune-500 quality marketing intelligence. You deliver 10x more value with the same team size. Everyone wins.' },
  ]
  return (
    <section id="how-it-works" style={{ background:'#fff', padding:'100px 24px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <SectionLabel>How It Works</SectionLabel>
          <h2 style={{ fontSize:'clamp(32px,5vw,52px)', fontWeight:900, color:'#111', margin:'16px 0 20px', letterSpacing:-1 }}>
            Up and running in one afternoon
          </h2>
          <p style={{ fontSize:18, color:'#6b7280', maxWidth:560, margin:'0 auto' }}>
            No engineers needed. No long onboarding. Your first client can be set up today.
          </p>
        </div>
        <div style={{ position:'relative' }}>
          {/* Connecting line */}
          <div style={{ position:'absolute', top:40, left:40, right:40, height:2, background:'linear-gradient(90deg,#f3f4f6,#e5e7eb,#f3f4f6)', zIndex:0 }}/>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:20, position:'relative', zIndex:1 }}>
            {steps.map((s,i) => (
              <div key={s.n} style={{ textAlign:'center' }}>
                <div style={{ width:80, height:80, borderRadius:'50%', background: i===2?ACCENT:'#f9fafb', border: `2px solid ${i===2?ACCENT:'#e5e7eb'}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:32, boxShadow: i===2?`0 8px 24px ${ACCENT}35`:'none', position:'relative' }}>
                  {s.icon}
                  <div style={{ position:'absolute', top:-6, right:-6, width:22, height:22, borderRadius:'50%', background:ACCENT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:'#fff' }}>{s.n}</div>
                </div>
                <h3 style={{ fontSize:15, fontWeight:800, color:'#111', marginBottom:8, lineHeight:1.3 }}>{s.title}</h3>
                <p style={{ fontSize:15, color:'#6b7280', lineHeight:1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Features ─────────────────────────────────────────────────────────────────
function Features() {
  const features = [
    {
      icon:'🎯', color:'#8b5cf6', title:'Smart Client Onboarding',
      desc:'14-step AI-assisted form collects everything your team needs: competitors, ideal customers, brand voice, logins, goals, and more. Clients love it.',
      bullets:['AI suggests answers when clients get stuck','Secure encrypted password storage','Step-by-step platform access guides (GA4, Meta, GBP)','Persona generated automatically on submit'],
    },
    {
      icon:'🤖', color:ACCENT, title:'AI Customer Persona Builder',
      desc:'After onboarding, Claude analyzes everything and builds a detailed marketing persona — complete with targeting, messaging, and channel strategy.',
      bullets:['Named persona with psychographic profile','Google keywords + Facebook interests','Ad headline angles that convert','Client approves and can request changes'],
    },
    {
      icon:'🔑', color:'#10b981', title:'Account Access Checklist',
      desc:'A live checklist of every platform your team needs access to — with step-by-step instructions for each. Clients fill it out on their own.',
      bullets:['GA4, Search Console, GTM, GBP, Meta, Google Ads','Real-time updates — see when clients grant access','Staff verification stamps with timestamps','Live activity feed on agency dashboard'],
    },
    {
      icon:'📊', color:'#3b82f6', title:'Client Intelligence Dashboard',
      desc:'Every client\'s full profile, beautifully organized. Business info, brand colors, competitor analysis, social accounts, logins — all in one place.',
      bullets:['Passwords masked by default — click to reveal','Color-coded pill tags for quick scanning','Change history on every client record','AI persona saved and accessible to your whole team'],
    },
    {
      icon:'⚡', color:'#f59e0b', title:'AI Agents (Coming Soon)',
      desc:'Set-and-forget automation that runs for every client: review responses, social posts, lead follow-ups, and monthly performance reports.',
      bullets:['Review response bot (Google + Yelp)','Social planner auto-posts 3-5x/week','Lead qualifier via SMS + email','Monthly report auto-generated and sent'],
    },
    {
      icon:'🏷️', color:'#ec4899', title:'Complete White Label',
      desc:'Your brand, your domain, your colors. Clients never see Moose AI. You look like you built a $500K platform from scratch.',
      bullets:['Custom domain support (app.youragency.com)','Your logo, colors, and agency name everywhere','Branded onboarding forms','Branded client portal'],
    },
  ]
  return (
    <section id="features" style={{ background:'#f4f4f5', padding:'100px 24px' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <SectionLabel>Everything Included</SectionLabel>
          <h2 style={{ fontSize:'clamp(32px,5vw,52px)', fontWeight:900, color:'#111', margin:'16px 0 20px', letterSpacing:-1 }}>
            Built for agencies who want to scale
          </h2>
          <p style={{ fontSize:18, color:'#6b7280', maxWidth:540, margin:'0 auto' }}>
            Every tool your team needs to deliver world-class marketing without the overhead of a 20-person agency.
          </p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:20 }}>
          {features.map(f => (
            <div key={f.title} style={{ background:'#fff', borderRadius:20, border:'1px solid #e5e7eb', padding:'28px 28px', transition:'transform .15s, box-shadow .15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow=`0 16px 40px rgba(0,0,0,.1)` }}
              onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none' }}>
              <div style={{ fontSize:36, marginBottom:16 }}>{f.icon}</div>
              <h3 style={{ fontSize:20, fontWeight:800, color:'#111', marginBottom:10, letterSpacing:-.3 }}>{f.title}</h3>
              <p style={{ fontSize:15, color:'#6b7280', lineHeight:1.65, marginBottom:18 }}>{f.desc}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {f.bullets.map(b => (
                  <div key={b} style={{ display:'flex', gap:10, fontSize:15, color:'#374151' }}>
                    <div style={{ width:18, height:18, borderRadius:'50%', background:f.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Check size={10} color={f.color} strokeWidth={3}/>
                    </div>
                    {b}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────────────────────────
function Pricing() {
  const [annual, setAnnual] = useState(false)
  const plans = [
    {
      name:'Starter', price: annual?247:297, period:'mo',
      desc:'Perfect for solo consultants and small agencies just getting started.',
      color:'#6b7280',
      seats:3, clients:25,
      features:['3 team seats','Up to 25 clients','Smart onboarding forms','AI persona builder','Client intelligence dashboard','Account access checklist','Email support'],
      cta:'Start Free Trial',
    },
    {
      name:'Growth', price: annual?397:497, period:'mo',
      desc:'For growing agencies ready to automate client delivery.',
      color:ACCENT, popular:true,
      seats:10, clients:100,
      features:['10 team seats','Up to 100 clients','Everything in Starter','AI review response bot','AI social planner','AI lead qualifier (SMS)','White-label branding','Priority support'],
      cta:'Start Free Trial',
    },
    {
      name:'Pro', price: annual?697:897, period:'mo',
      desc:'For established agencies managing 100+ clients at scale.',
      color:'#8b5cf6',
      seats:25, clients:500,
      features:['25 team seats','Up to 500 clients','Everything in Growth','Custom domain','API access','Dedicated account manager','Monthly strategy call','SLA guarantee'],
      cta:'Start Free Trial',
    },
    {
      name:'Enterprise', price:null,
      desc:'For agencies with 500+ clients or custom requirements.',
      color:'#111',
      seats:'Unlimited', clients:'Unlimited',
      features:['Unlimited seats & clients','Everything in Pro','Custom AI training on your brand','Custom feature development','On-premise option','SSO / SAML','99.9% uptime SLA','Slack support channel'],
      cta:'Contact Sales',
    },
  ]
  return (
    <section id="pricing" style={{ background:DARK, padding:'100px 24px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-100, left:'30%', width:600, height:600, borderRadius:'50%', background:`radial-gradient(circle, ${ACCENT}10 0%, transparent 70%)`, pointerEvents:'none' }}/>
      <div style={{ maxWidth:1200, margin:'0 auto', position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <SectionLabel>Simple Pricing</SectionLabel>
          <h2 style={{ fontSize:'clamp(32px,5vw,52px)', fontWeight:900, color:'#fff', margin:'16px 0 20px', letterSpacing:-1 }}>
            One tool. Unlimited leverage.
          </h2>
          <p style={{ fontSize:18, color:'rgba(255,255,255,.55)', marginBottom:32 }}>
            14-day free trial, no credit card required. Cancel anytime.
          </p>
          {/* Annual toggle */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:12, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:40, padding:'8px 16px' }}>
            <span style={{ fontSize:15, color: !annual?'#fff':'rgba(255,255,255,.4)', fontWeight: !annual?700:400 }}>Monthly</span>
            <div onClick={() => setAnnual(a=>!a)} style={{ width:44, height:24, borderRadius:12, background: annual?ACCENT:'rgba(255,255,255,.15)', cursor:'pointer', position:'relative', transition:'background .2s' }}>
              <div style={{ position:'absolute', top:3, left: annual?22:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,.3)' }}/>
            </div>
            <span style={{ fontSize:15, color: annual?'#fff':'rgba(255,255,255,.4)', fontWeight: annual?700:400 }}>Annual</span>
            {annual && <span style={{ fontSize:13, fontWeight:800, color:'#22c55e', background:'rgba(34,197,94,.15)', padding:'2px 8px', borderRadius:20 }}>Save 17%</span>}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:20, marginTop:40 }}>
          {plans.map(plan => (
            <div key={plan.name} style={{ background: plan.popular?'#fff':'rgba(255,255,255,.04)', borderRadius:20, border: plan.popular?`2px solid ${ACCENT}`:'1px solid rgba(255,255,255,.1)', padding:'28px 24px', position:'relative', transition:'transform .15s' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-4px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
              {plan.popular && <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', fontSize:13, fontWeight:800, color:'#fff', background:ACCENT, borderRadius:20, padding:'3px 14px', whiteSpace:'nowrap' }}>MOST POPULAR</div>}
              <div style={{ fontSize:15, fontWeight:700, color: plan.popular?'#6b7280':'rgba(255,255,255,.5)', marginBottom:8 }}>{plan.name}</div>
              <div style={{ marginBottom:12 }}>
                {plan.price ? (
                  <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                    <span style={{ fontSize:44, fontWeight:900, color: plan.popular?'#111':'#fff', letterSpacing:-2 }}>${plan.price}</span>
                    <span style={{ fontSize:16, color: plan.popular?'#6b7280':'rgba(255,255,255,.4)' }}>/mo</span>
                  </div>
                ) : (
                  <div style={{ fontSize:36, fontWeight:900, color:'#fff', letterSpacing:-1 }}>Custom</div>
                )}
              </div>
              <p style={{ fontSize:15, color: plan.popular?'#6b7280':'rgba(255,255,255,.45)', lineHeight:1.6, marginBottom:20 }}>{plan.desc}</p>
              <div style={{ display:'flex', gap:12, marginBottom:24 }}>
                {[`${plan.seats} seats`, `${plan.clients} clients`].map(badge => (
                  <span key={badge} style={{ fontSize:13, fontWeight:700, padding:'3px 10px', borderRadius:20, background: plan.popular?`${ACCENT}15`:'rgba(255,255,255,.08)', color: plan.popular?ACCENT:'rgba(255,255,255,.6)' }}>{badge}</span>
                ))}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:24 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display:'flex', gap:9, fontSize:15, color: plan.popular?'#374151':'rgba(255,255,255,.65)', alignItems:'flex-start' }}>
                    <Check size={14} color={plan.popular?ACCENT:'#22c55e'} strokeWidth={3} style={{ flexShrink:0, marginTop:1 }}/>
                    {f}
                  </div>
                ))}
              </div>
              <button onClick={() => {}} style={{ width:'100%', padding:'13px 0', borderRadius:12, border:'none', background: plan.popular?ACCENT: plan.name==='Enterprise'?'rgba(255,255,255,.1)':'rgba(255,255,255,.08)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', transition:'opacity .15s' }}
                onMouseEnter={e=>e.currentTarget.style.opacity='.85'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign:'center', marginTop:40, fontSize:15, color:'rgba(255,255,255,.35)' }}>
          All plans include: 99.9% uptime SLA · SOC 2 compliant data storage · GDPR ready · Cancel anytime
        </div>
      </div>
    </section>
  )
}

// ── Testimonials ──────────────────────────────────────────────────────────────
function Testimonials() {
  const testimonials = [
    { name:'Sarah Chen', role:'Founder, Apex Digital Agency', avatar:'SC', stars:5, text:'We onboarded 12 new clients last month without hiring anyone. The AI persona builder alone has saved us 6+ hours per client. Our proposals close at 40% higher rates because we walk in with a strategy already built.' },
    { name:'Marcus Rodriguez', role:'CEO, LocalBoost Marketing', avatar:'MR', stars:5, text:'Our clients think we built this platform ourselves. The white-label is flawless. We went from $18K MRR to $47K MRR in 4 months, same team size. This is the unfair advantage we needed.' },
    { name:'Jennifer Walsh', role:'Director, Walsh & Partners', avatar:'JW', stars:5, text:'The account access checklist alone is worth the price. We used to spend 3 weeks chasing clients for logins. Now they do it themselves in 20 minutes and we get real-time notifications when it\'s done.' },
  ]
  return (
    <section style={{ background:'#fff', padding:'100px 24px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:56 }}>
          <SectionLabel>Agency Stories</SectionLabel>
          <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:900, color:'#111', margin:'16px 0 0', letterSpacing:-.5 }}>
            Agencies are scaling faster than ever
          </h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:20 }}>
          {testimonials.map(t => (
            <div key={t.name} style={{ background:'#f9fafb', borderRadius:20, border:'1px solid #f3f4f6', padding:'28px 26px' }}>
              <div style={{ display:'flex', gap:3, marginBottom:16 }}>
                {[...Array(t.stars)].map((_,i) => <Star key={i} size={16} color="#f59e0b" fill="#f59e0b"/>)}
              </div>
              <p style={{ fontSize:15, color:'#374151', lineHeight:1.75, marginBottom:20, fontStyle:'italic' }}>"{t.text}"</p>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:ACCENT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:'#fff' }}>{t.avatar}</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#111' }}>{t.name}</div>
                  <div style={{ fontSize:14, color:'#9ca3af' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState(null)
  const faqs = [
    { q:'How does the white-label work exactly?', a:'You get a custom URL (like app.youragency.com or youragency.mooseai.com), your logo, and your brand colors throughout the entire platform. Your clients never see any Moose AI branding. You can even use your own custom domain on the Pro plan.' },
    { q:'Do my clients need to pay anything?', a:'No. You pay one flat monthly fee and use the platform for as many clients as your plan allows. Your clients fill out the onboarding form and interact with the platform through your white-labeled version at no cost to them.' },
    { q:'What AI model powers it?', a:"Claude by Anthropic — the same model that powers Claude.ai. It's trained to give highly specific, practical marketing advice rather than generic suggestions. All AI calls are included in your plan up to your monthly limit." },
    { q:'How long does client onboarding take?', a:'The onboarding form takes clients 20–30 minutes to complete. Once submitted, the AI persona and strategy brief are generated in about 30 seconds. Your team gets a notification and can start work immediately.' },
    { q:'Is client data secure?', a:'Yes. All data is stored on SOC 2 compliant infrastructure. Passwords and credentials are encrypted at rest. Your clients\' data is never used to train AI models. Each agency\'s data is completely isolated from other agencies.' },
    { q:'Can I try it before paying?', a:'Yes — 14-day free trial, no credit card required. You can onboard up to 3 real clients during the trial. If you love it (you will), just add your card to continue.' },
    { q:'What if my client doesn\'t finish the onboarding form?', a:'The form auto-saves at every step. Clients can leave and come back anytime using the same link. You can also see their progress in real time on your dashboard and send them a reminder if they get stuck.' },
    { q:"Can I cancel anytime?", a:"Yes. No contracts, no cancellation fees. If you cancel, your account stays active until the end of your billing period. You can export all your client data at any time." },
  ]
  return (
    <section id="faq" style={{ background:'#f4f4f5', padding:'100px 24px' }}>
      <div style={{ maxWidth:760, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:56 }}>
          <SectionLabel>FAQ</SectionLabel>
          <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:900, color:'#111', margin:'16px 0 0', letterSpacing:-.5 }}>
            Questions? We've got answers.
          </h2>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {faqs.map((faq,i) => (
            <div key={i} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <button onClick={() => setOpen(open===i?null:i)}
                style={{ width:'100%', padding:'20px 22px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', cursor:'pointer', textAlign:'left', gap:16 }}>
                <span style={{ fontSize:16, fontWeight:700, color:'#111', lineHeight:1.4 }}>{faq.q}</span>
                <ChevronDown size={18} color="#9ca3af" style={{ transform:open===i?'rotate(180deg)':'rotate(0)', transition:'transform .2s', flexShrink:0 }}/>
              </button>
              {open===i && (
                <div style={{ padding:'0 22px 20px', fontSize:15, color:'#4b5563', lineHeight:1.75, borderTop:'1px solid #f3f4f6' }}>
                  <div style={{ paddingTop:16 }}>{faq.a}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── CTA ───────────────────────────────────────────────────────────────────────
function CTA({ onLogin }) {
  return (
    <section style={{ background:DARK, padding:'100px 24px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at center, ${ACCENT}15 0%, transparent 60%)`, pointerEvents:'none' }}/>
      <div style={{ maxWidth:700, margin:'0 auto', textAlign:'center', position:'relative', zIndex:1 }}>
        <h2 style={{ fontSize:'clamp(36px,6vw,64px)', fontWeight:900, color:'#fff', margin:'0 0 20px', letterSpacing:-1.5, lineHeight:1.05 }}>
          Ready to 10x your agency?
        </h2>
        <p style={{ fontSize:18, color:'rgba(255,255,255,.55)', marginBottom:40, lineHeight:1.6 }}>
          Join the agencies already using Moose AI to deliver better results with smaller teams. 14-day free trial. No credit card. Cancel anytime.
        </p>
        <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
          <Btn variant="primary" size="lg" href="#pricing">
            Start Your Free Trial <ArrowRight size={18}/>
          </Btn>
          <Btn variant="ghost" size="lg" onClick={onLogin}>
            Sign Into Your Account
          </Btn>
        </div>
        <div style={{ marginTop:40, display:'flex', gap:24, justifyContent:'center', flexWrap:'wrap' }}>
          {['✓ 14-day free trial', '✓ No credit card', '✓ Cancel anytime', '✓ White-label ready on day 1'].map(t => (
            <span key={t} style={{ fontSize:15, color:'rgba(255,255,255,.4)', fontWeight:600 }}>{t}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background:'#0a0a0d', padding:'60px 24px 32px', borderTop:'1px solid rgba(255,255,255,.06)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:48, marginBottom:48 }}>
          <div>
            <img src="/moose-logo.svg" alt="Moose AI" style={{ height:28, filter:'brightness(0) invert(1)', marginBottom:16 }} />
            <p style={{ fontSize:15, color:'rgba(255,255,255,.35)', lineHeight:1.7, maxWidth:280 }}>The AI-powered agency platform for marketing agencies who want to scale without scaling their headcount.</p>
            <div style={{ display:'flex', gap:12, marginTop:20 }}>
              {['Twitter','LinkedIn','YouTube'].map(s => <a key={s} href="#" style={{ fontSize:14, color:'rgba(255,255,255,.3)', textDecoration:'none' }}>{s}</a>)}
            </div>
          </div>
          {[
            { label:'Product', links:['Features','Pricing','Changelog','Roadmap','API Docs'] },
            { label:'Company', links:['About','Blog','Careers','Press','Contact'] },
            { label:'Legal', links:['Privacy Policy','Terms of Service','Security','GDPR','Cookie Policy'] },
          ].map(col => (
            <div key={col.label}>
              <div style={{ fontSize:14, fontWeight:800, color:'rgba(255,255,255,.25)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:16 }}>{col.label}</div>
              {col.links.map(l => <a key={l} href="#" style={{ display:'block', fontSize:15, color:'rgba(255,255,255,.45)', textDecoration:'none', marginBottom:10 }}>{l}</a>)}
            </div>
          ))}
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,.06)', paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:15, color:'rgba(255,255,255,.2)' }}>© 2026 Moose AI Inc. All rights reserved.</span>
          <span style={{ fontSize:15, color:'rgba(255,255,255,.2)' }}>Powered by Claude AI</span>
        </div>
      </div>
    </footer>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MarketingSitePage() {
  const navigate = useNavigate()
  function goToLogin() { navigate('/login') }

  return (
    <div style={{ fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', overflowX:'hidden' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        html { scroll-behavior: smooth; }
      `}</style>
      <Nav onLogin={goToLogin} />
      <Hero onLogin={goToLogin} />
      <HowItWorks />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA onLogin={goToLogin} />
      <Footer />
    </div>
  )
}
