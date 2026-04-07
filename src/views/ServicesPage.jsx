"use client"
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Phone, PhoneIncoming, Star, Target, Brain,
  Globe, BarChart2, FileSignature, Zap, ArrowRight, Check,
  ChevronRight, Mail, Shield, TrendingUp, Users, Menu, X
} from 'lucide-react'
import { useState } from 'react'

const R = '#ea2729'
const T = '#5bc6d0'
const BLK = '#0f0f11'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

function Nav() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(15,15,17,.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/koto_logo.svg" alt="Koto" style={{ height: 26 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[
            { label: 'Platform', to: '/' },
            { label: 'Services', to: '/services' },
            { label: 'Contact', to: '/contact' },
          ].map(l => (
            <button key={l.label} onClick={() => navigate(l.to)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '8px 14px', borderRadius: 8, fontFamily: FH }}>
              {l.label}
            </button>
          ))}
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: `1px solid ${R}40`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '8px 20px', borderRadius: 10, fontFamily: FH, marginLeft: 8 }}>
            Log In
          </button>
          <button onClick={() => navigate('/signup')} style={{ background: R, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '8px 20px', borderRadius: 10, fontFamily: FH, boxShadow: `0 4px 14px ${R}40` }}>
            Get Demo
          </button>
        </div>
      </div>
    </nav>
  )
}

const SERVICES = [
  {
    icon: Sparkles, title: 'AI Page Builder', color: R,
    desc: 'Generate SEO-optimized landing pages for any service area in seconds. County and city drill-down, WordPress auto-publishing, and bulk generation.',
    features: ['One-click county/city pages', 'SEO-optimized content via GPT-4', 'Auto-publish to WordPress', 'White-label for any client'],
  },
  {
    icon: Phone, title: 'AI Voice Agent', color: T,
    desc: 'Outbound AI calling platform with real Retell voices. DNC compliance, timezone enforcement, voicemail detection, and live call transfers.',
    features: ['16 real AI voices', 'TCPA/DNC compliant', 'Smart timezone calling (8AM-9PM)', 'Live transfer to closers'],
  },
  {
    icon: PhoneIncoming, title: 'AI Answering Service', color: '#7c3aed',
    desc: '24/7 AI receptionist for your clients. 20 industry-specific intake templates, caller tracking, and instant email/SMS summaries.',
    features: ['20 intake templates', 'Medical, legal, HVAC, dental & more', 'Instant call summaries', 'Calendar booking integration'],
  },
  {
    icon: Star, title: 'Review Management', color: '#f59e0b',
    desc: 'Automated review collection via SMS and email. Campaign management, review monitoring, and response templates.',
    features: ['SMS & email drip campaigns', 'Google & Yelp monitoring', 'AI response drafts', 'White-label review pages'],
  },
  {
    icon: Target, title: 'Scout Lead Intelligence', color: T,
    desc: 'AI-powered prospect research. Find leads, score them, build prospect reports, and feed them directly into your voice agent campaigns.',
    features: ['Business research via AI', 'Lead scoring (0-100)', 'Prospect report generation', 'Pipeline CRM integration'],
  },
  {
    icon: Brain, title: 'CMO AI Agent', color: BLK,
    desc: 'Your always-on AI marketing strategist. Ask questions, get recommendations, and automate research across your entire client portfolio.',
    features: ['Natural language queries', 'Cross-client insights', 'Competitive analysis', 'Strategy recommendations'],
  },
]

export default function ServicesPage() {
  const navigate = useNavigate()

  return (
    <div style={{ background: '#fff', fontFamily: FB, color: BLK }}>
      <Nav />

      {/* Hero */}
      <section style={{ background: BLK, paddingTop: 120, paddingBottom: 80, textAlign: 'center' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: R, background: R + '15', border: `1px solid ${R}30`, borderRadius: 20, padding: '4px 14px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 24 }}>
            <Zap size={12} /> Platform Services
          </div>
          <h1 style={{ fontFamily: FH, fontSize: 48, fontWeight: 800, color: '#fff', margin: '0 0 20px', letterSpacing: '-.04em', lineHeight: 1.1 }}>
            What Koto Can Do<br />For Your Agency
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.5)', lineHeight: 1.7, maxWidth: 600, margin: '0 auto' }}>
            Six AI-powered tools that replace an entire marketing team. Each one built specifically for agencies who want to scale without hiring.
          </p>
        </div>
      </section>

      {/* Services */}
      {SERVICES.map((svc, i) => {
        const Icon = svc.icon
        const isGray = i % 2 === 1
        return (
          <section key={svc.title} style={{ background: isGray ? '#f9f9f8' : '#fff', padding: '80px 24px' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
              <div style={{ order: i % 2 === 1 ? 2 : 1 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: svc.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <Icon size={26} color={svc.color} />
                </div>
                <h2 style={{ fontFamily: FH, fontSize: 32, fontWeight: 800, color: BLK, margin: '0 0 16px', letterSpacing: '-.03em' }}>
                  {svc.title}
                </h2>
                <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.7, marginBottom: 24 }}>
                  {svc.desc}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {svc.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 6, background: '#16a34a15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={12} color="#16a34a" />
                      </div>
                      <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ order: i % 2 === 1 ? 1 : 2 }}>
                <div style={{
                  background: `linear-gradient(135deg, ${svc.color}08, ${svc.color}15)`,
                  border: `1px solid ${svc.color}20`,
                  borderRadius: 20, padding: 40, minHeight: 280,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={80} color={svc.color} style={{ opacity: 0.3 }} />
                </div>
              </div>
            </div>
          </section>
        )
      })}

      {/* CTA */}
      <section style={{ background: BLK, padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontFamily: FH, fontSize: 36, fontWeight: 800, color: '#fff', margin: '0 0 16px', letterSpacing: '-.03em' }}>
            Ready to scale your agency?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.5)', lineHeight: 1.7, marginBottom: 32 }}>
            Get started with Koto today. No contracts, cancel anytime.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => navigate('/signup')} style={{
              background: R, border: 'none', color: '#fff', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', padding: '14px 32px', borderRadius: 12, fontFamily: FH,
              boxShadow: `0 6px 24px ${R}40`, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              Get Demo <ArrowRight size={16} />
            </button>
            <button onClick={() => navigate('/contact')} style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,.2)', color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '14px 32px',
              borderRadius: 12, fontFamily: FH,
            }}>
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0a0a0a', padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/koto_logo.svg" alt="Koto" style={{ height: 20, opacity: 0.5 }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,.3)' }}>&copy; {new Date().getFullYear()} Koto</span>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[{ label: 'Privacy', to: '/privacy' }, { label: 'Terms', to: '/terms' }].map(l => (
              <button key={l.label} onClick={() => navigate(l.to)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.3)', fontSize: 13, cursor: 'pointer', fontFamily: FB }}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
