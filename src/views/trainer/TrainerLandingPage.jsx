"use client"
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dumbbell, Utensils, TrendingUp, MessageCircle, BookOpen, Target,
  ChevronRight, Shield, Zap, Brain, Heart, Users, Award,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// /train — Public landing page for the AI athlete training platform.
// No auth required. Sells the product, shows features, CTA to sign up.
// ─────────────────────────────────────────────────────────────────────────────

const F = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', sans-serif"

const SPORTS = [
  'Baseball', 'Football', 'Basketball', 'Soccer', 'Track & Field',
  'Swimming', 'Wrestling', 'Volleyball', 'Tennis', 'Golf',
  'Hockey', 'Lacrosse', 'CrossFit', 'MMA', 'General Fitness',
]

const FEATURES = [
  {
    icon: MessageCircle,
    title: 'AI Coach Chat',
    desc: 'Have a real conversation with your AI coach. It learns your sport, your goals, and your schedule — then builds a plan that actually fits your life.',
    color: '#0071e3',
  },
  {
    icon: Dumbbell,
    title: 'Custom Workouts',
    desc: 'Periodized training blocks built for YOUR sport. Log every set, track every rep. The program adapts based on what you actually do.',
    color: '#7c3aed',
  },
  {
    icon: Utensils,
    title: 'Meal Plans + Food Tracking',
    desc: 'Meal plans that hit your macros with food you\'ll actually eat. Snap a photo of any meal and AI counts the calories instantly.',
    color: '#059669',
  },
  {
    icon: TrendingUp,
    title: 'Progress Charts',
    desc: 'Track everything over time — body weight, lift volume, speed, velocity, sport-specific measurables. See the trends that matter.',
    color: '#dc2626',
  },
  {
    icon: BookOpen,
    title: 'Learn Section',
    desc: 'Every training term explained in plain English. FAQ section answers the questions every athlete has. No jargon, no confusion.',
    color: '#d97706',
  },
  {
    icon: Target,
    title: 'ProPath Score',
    desc: 'For athletes targeting college — see which programs fit your measurables, academics, and preferences. Dream, target, and safety schools ranked.',
    color: '#0891b2',
  },
]

const TESTIMONIAL_STATS = [
  { value: '6', label: 'Plan sections generated in minutes' },
  { value: '21+', label: 'Training terms in the dictionary' },
  { value: '100%', label: 'Personalized to your sport & goals' },
  { value: '24/7', label: 'AI coach available anytime' },
]

export default function TrainerLandingPage() {
  const navigate = useNavigate()
  const [hoveredSport, setHoveredSport] = useState(null)

  return (
    <div style={{ fontFamily: F, WebkitFontSmoothing: 'antialiased', background: '#fff' }}>
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 1200, margin: '0 auto', width: '100%',
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.02em' }}>
          Koto <span style={{ color: '#dc2626' }}>Trainer</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => navigate('/login')} style={{
            padding: '8px 16px', background: 'transparent', border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#424245',
            cursor: 'pointer', fontFamily: F,
          }}>
            Sign in
          </button>
          <button onClick={() => navigate('/start')} style={{
            padding: '8px 20px', background: '#0a0a0a', border: 'none',
            borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#fff',
            cursor: 'pointer', fontFamily: F,
          }}>
            Get started free
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        padding: '80px 24px 60px', textAlign: 'center',
        maxWidth: 900, margin: '0 auto',
      }}>
        <div style={{
          display: 'inline-flex', padding: '6px 16px', background: '#dc262610',
          borderRadius: 999, fontSize: 13, fontWeight: 600, color: '#dc2626',
          marginBottom: 20,
        }}>
          AI-powered training for every sport
        </div>
        <h1 style={{
          margin: '0 0 20px', fontSize: 'clamp(36px, 6vw, 64px)',
          fontWeight: 800, color: '#0a0a0a', lineHeight: 1.1,
          letterSpacing: '-0.03em',
        }}>
          Your personal AI coach.
          <br />
          <span style={{ color: '#dc2626' }}>Any sport. Any level.</span>
        </h1>
        <p style={{
          margin: '0 auto 32px', maxWidth: 600,
          fontSize: 18, color: '#6b7280', lineHeight: 1.6,
        }}>
          Custom workout plans, meal programs, progress tracking, and an AI coach
          that actually knows your sport — built for athletes from middle school to pro.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/start')} style={{
            padding: '14px 32px', background: '#dc2626', border: 'none',
            borderRadius: 12, fontSize: 16, fontWeight: 700, color: '#fff',
            cursor: 'pointer', fontFamily: F,
            boxShadow: '0 4px 16px rgba(220,38,38,0.3)',
          }}>
            Start training free
          </button>
          <button onClick={() => {
            document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
          }} style={{
            padding: '14px 32px', background: '#fff', border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 12, fontSize: 16, fontWeight: 600, color: '#424245',
            cursor: 'pointer', fontFamily: F,
          }}>
            See how it works
          </button>
        </div>
      </section>

      {/* ── Sports strip ─────────────────────────────────────────────────── */}
      <section style={{
        padding: '20px 24px 40px', textAlign: 'center',
        maxWidth: 900, margin: '0 auto',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
          Built for every sport
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {SPORTS.map((sport) => (
            <span
              key={sport}
              onMouseEnter={() => setHoveredSport(sport)}
              onMouseLeave={() => setHoveredSport(null)}
              style={{
                padding: '8px 16px', borderRadius: 999,
                background: hoveredSport === sport ? '#0a0a0a' : '#f5f5f7',
                color: hoveredSport === sport ? '#fff' : '#424245',
                fontSize: 14, fontWeight: 600, cursor: 'default',
                transition: 'all .15s',
              }}
            >
              {sport}
            </span>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section style={{
        padding: '60px 24px', background: '#0a0a0a', color: '#fff',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>
            How it works
          </h2>
          <p style={{ margin: '0 0 40px', fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>
            Three steps. Two minutes. One complete plan.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {[
              { num: '1', title: 'Chat with your AI coach', desc: 'Answer a few questions about your sport, goals, schedule, and experience. Click pill buttons or type freely — takes about 2 minutes.' },
              { num: '2', title: 'Get your full plan', desc: 'AI generates 6 sections: baseline assessment, 90-day roadmap, 2-week workout block, coaching playbook, meal plan, and grocery list.' },
              { num: '3', title: 'Train, track, improve', desc: 'Log workouts, snap food photos, track measurables. Your AI coach adapts the plan based on your actual progress.' },
            ].map((step) => (
              <div key={step.num} style={{ padding: 24, background: 'rgba(255,255,255,0.05)', borderRadius: 16, textAlign: 'left' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 999, background: '#dc2626',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, marginBottom: 16,
                }}>
                  {step.num}
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '80px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 32, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.02em' }}>
            Everything you need to train smarter
          </h2>
          <p style={{ margin: 0, fontSize: 16, color: '#6b7280' }}>
            Not a generic app. A complete training system built around YOU.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              padding: 24, borderRadius: 16,
              border: '1px solid rgba(0,0,0,0.06)',
              background: '#fff',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: f.color + '12', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}>
                <f.icon size={22} color={f.color} strokeWidth={1.75} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#0a0a0a' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <section style={{ padding: '40px 24px', background: '#f5f5f7' }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24,
          textAlign: 'center',
        }}>
          {TESTIMONIAL_STATS.map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Safety section ───────────────────────────────────────────────── */}
      <section style={{ padding: '60px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.02em' }}>
            Built with safety first
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { icon: Shield, title: 'Not medical advice', desc: 'We\'re AI coaches, not doctors. We always tell you to see a physician for injuries, pain, or health concerns.' },
            { icon: Heart, title: 'Crisis response', desc: 'If anyone expresses self-harm or danger, we immediately provide 911 and 988 crisis resources.' },
            { icon: Brain, title: 'Plain English', desc: 'Every scientific term is explained simply. No jargon — we speak like a teammate, not a textbook.' },
          ].map((s) => (
            <div key={s.title} style={{
              padding: '20px 24px', borderRadius: 12,
              background: '#f9fafb', border: '1px solid rgba(0,0,0,0.04)',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <s.icon size={20} color="#059669" strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0a0a0a', marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section style={{
        padding: '80px 24px', background: '#0a0a0a', textAlign: 'center',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
          Ready to train smarter?
        </h2>
        <p style={{ margin: '0 0 32px', fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>
          Free to start. No credit card. Your AI coach is waiting.
        </p>
        <button onClick={() => navigate('/start')} style={{
          padding: '16px 40px', background: '#dc2626', border: 'none',
          borderRadius: 12, fontSize: 18, fontWeight: 700, color: '#fff',
          cursor: 'pointer', fontFamily: F,
          boxShadow: '0 4px 24px rgba(220,38,38,0.4)',
        }}>
          Get started free <ChevronRight size={18} style={{ verticalAlign: -3, marginLeft: 4 }} />
        </button>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{
        padding: '24px', textAlign: 'center', fontSize: 12, color: '#9ca3af',
        borderTop: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div>
          I am an AI coach, not a doctor or licensed professional. This is not medical advice.
          Always consult with a physician or qualified professional before starting any program.
        </div>
        <div style={{ marginTop: 8, color: '#d1d5db' }}>
          Koto Trainer &middot; Powered by AI
        </div>
      </footer>
    </div>
  )
}
