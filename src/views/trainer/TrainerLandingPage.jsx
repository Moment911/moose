"use client"
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dumbbell, Utensils, TrendingUp, MessageCircle, BookOpen, Target,
  ArrowRight, Star, Check, Loader2, Sparkles, GraduationCap, Activity,
  Brain, ShieldCheck, ChefHat,
} from 'lucide-react'
import { PrimaryCTA, RingMetricTile, T } from '../../components/trainer/aesthetic'

const SPORTS = [
  'Baseball', 'Football', 'Basketball', 'Soccer', 'Track & Field',
  'Swimming', 'Wrestling', 'Volleyball', 'Tennis', 'Golf',
  'Hockey', 'Lacrosse', 'CrossFit', 'MMA', 'General Fitness',
]

const FEATURES = [
  {
    icon: MessageCircle,
    title: 'Your AI trainer. 24/7/365.',
    desc: "Talk to it any time -- 6am before the gym, 11pm when you can't sleep, halftime of your kid's game. It never clocks out. Tell it what's working, what hurts, what got in the way. Your plan adjusts in real time. No appointments. No waiting. It never sleeps.",
    color: '#0071e3',
  },
  {
    icon: Utensils,
    title: 'Your AI nutritionist.',
    desc: "Macros that hit your numbers with food you'll actually eat. Snap a photo of any meal and the AI logs calories and macros instantly. It learns what you like and builds around that -- not a generic template.",
    color: '#059669',
  },
  {
    icon: Target,
    title: 'Your AI sport expert.',
    desc: "PhD-level periodization for fifteen sports plus a general-fitness mode. It knows the difference between training for a baseball showcase and training for a 5K. Sport-specific, season-aware, position-aware.",
    color: '#0891b2',
  },
  {
    icon: Dumbbell,
    title: 'Workouts you actually log.',
    desc: "Tap to log every set, every rep, every session. The program watches what you did and adjusts next week. Missed a day? It adapts. Crushed it? It pushes harder. Your plan is alive.",
    color: '#7c3aed',
  },
  {
    icon: TrendingUp,
    title: 'Progress you can prove.',
    desc: "Body weight, lift volume, sprint times, velocity, exit velo, macro adherence -- all charted over time. Not just numbers. Trends. The kind of data that shows you exactly what's happening.",
    color: '#dc2626',
  },
  {
    icon: BookOpen,
    title: 'Built for every life stage.',
    desc: "Youth athletes chasing a roster spot. College students with no time. New parents with fifteen minutes. Single parents doing it alone. Executives who travel. Early retirees reclaiming their health. It meets you where you are.",
    color: '#d97706',
  },
]

const TESTIMONIAL_STATS = [
  { value: '24/7', label: 'Always on. Your AI coach never sleeps, never takes a day off, never cancels on you.', highlight: true },
  { value: '2 min', label: 'From first conversation to a complete personalized plan.' },
  { value: '15+', label: 'Sports with dedicated playbooks, periodization, and position-specific training.' },
  { value: '$0', label: 'To start. No credit card. No commitment. Just results.' },
]

const TESTIMONIALS = [
  { quote: "I play three sports and no one coach could program for all of them. This AI knows my soccer season, my track schedule, and my gym days  —  and adjusts the plan week by week so I'm not overtrained.", name: 'Jaylen M., 16', role: 'High school multi-sport athlete', avatar: '/images/trainer/man-running.jpg' },
  { quote: "Three kids, a full-time job, and twenty minutes for lunch. I told the AI my reality and it built workouts I could actually finish. Down twenty-two pounds in five months  —  no trainer required.", name: 'Renee D., 43', role: 'Working parent', avatar: '/images/trainer/woman-running.jpg' },
  { quote: 'After I retired I started feeling old fast. This built me strength and walking workouts that match what my body can do today, not twenty years ago. I feel better at sixty-four than I did at fifty-four.', name: 'Hank P., 64', role: 'Retiree', avatar: '/images/trainer/senior-couple.jpg' },
]

const FAQS = [
  {
    q: 'Do I need to be an athlete to use this?',
    a: "No. The AI builds plans for whoever you are, in whatever shape you're in. Youth athletes, college students, busy parents, traveling executives, retirees  —  same product, completely different plans. Tell it your reality and it programs for that.",
  },
  {
    q: 'How does the AI know my sport?',
    a: 'During the two-minute intake, you tell us your sport, position, level, and goals. The AI loads a sport-specific playbook (energy systems, common movement patterns, in-season vs off-season periodization) and writes your plan against that, not a generic template. If you don\'t play a sport, general-fitness mode covers strength, cardio, and mobility for everyday life.',
  },
  {
    q: 'Is my health data safe?',
    a: 'Your data lives in your account, encrypted at rest. We don\'t sell it, we don\'t share it, and we never train public models on it. Anyone you invite to view your plan (a parent helping their kid stay on track, for example) sees only what you share with them.',
  },
  {
    q: 'What sports are supported?',
    a: 'Today: baseball, football, basketball, soccer, track & field, swimming, wrestling, volleyball, tennis, golf, hockey, lacrosse, CrossFit, MMA, plus a general-fitness mode for anyone who just wants to get stronger, lose weight, or stay healthy. We add new sports based on what users ask for.',
  },
  {
    q: 'How much does it cost?',
    a: 'Free to start. You get the full intake, your baseline plan, your first fourteen days of workouts, and a ninety-day roadmap at no cost. Continued access is part of a paid plan we\'ll detail at the end of your trial.',
  },
  {
    q: 'Do you have a free trial?',
    a: 'The first fourteen days are free with no credit card. Cancel from your profile any time before then. After fourteen days you decide whether to stay on.',
  },
]

const NAV_HEIGHT = 60
const PAGE_MAX = 1180
const HERO_MAX = 1100

export default function TrainerLandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      fontFamily: T.font,
      WebkitFontSmoothing: 'antialiased',
      background: T.bg,
      color: T.ink,
      minHeight: '100vh',
    }}>
      <TopNav onSignIn={() => navigate('/login')} onStart={() => navigate('/start')} />

      <Hero onStart={() => navigate('/start')} />

      <SportsStrip />

      <TryItDemo />

      <FeaturesGrid />

      <HowItWorks />

      <LifestylePhotoStrip />

      <LivePlanBuilder />

      <InsideTheAi />

      <PhoneShowcase />

      <SocialProof />

      <FounderStory />

      <FaqList />

      <BottomCta onStart={() => navigate('/start')} />

      <FooterStrip />

      {/* Slow auto-scroll for the sports strip + details summary chrome reset.
          Inlined so this file stays self-contained. */}
      <style>{`
        @keyframes koto-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        details > summary { list-style: none; cursor: pointer; }
        details > summary::-webkit-details-marker { display: none; }
        details[open] summary .koto-faq-chev { transform: rotate(45deg); }
      `}</style>
    </div>
  )
}

function TopNav({ onSignIn, onStart }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: `1px solid ${T.border}`,
      height: NAV_HEIGHT,
      display: 'flex', alignItems: 'center',
    }}>
      <div style={{
        maxWidth: PAGE_MAX, margin: '0 auto', width: '100%',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontFamily: T.font,
          fontSize: 22, fontWeight: T.weight.display, color: T.ink,
          letterSpacing: '-0.02em',
        }}>
          Koto
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: T.s4 }}>
          <button
            type="button"
            onClick={onSignIn}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: T.font, fontSize: 15, fontWeight: T.weight.button,
              color: T.ink2, padding: '8px 4px',
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onStart}
            style={{
              background: T.ink, color: '#fff', border: 'none', cursor: 'pointer',
              padding: '10px 18px', borderRadius: T.rPill,
              fontFamily: T.font, fontSize: 14, fontWeight: T.weight.button,
              letterSpacing: '0.1px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            Get started
            <ArrowRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </nav>
  )
}

function Hero({ onStart }) {
  const trust = ['PhD-trained AI', 'Built for every level', '$0 to start']
  return (
    <section className="koto-hero" style={{
      maxWidth: HERO_MAX, margin: '0 auto',
      padding: '64px 24px 48px',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: 48,
      alignItems: 'center',
    }}>
      <style>{`
        @media (min-width: 960px) {
          .koto-hero { grid-template-columns: 1.05fr 0.95fr !important; padding: 96px 24px 80px !important; gap: 64px !important; }
          .koto-hero-h1 { font-size: 72px !important; line-height: 1.02 !important; }
          .koto-hero-sub { font-size: 19px !important; }
        }
        @keyframes koto-float {
          0%,100% { transform: translateY(0) rotate(-3.5deg); }
          50%     { transform: translateY(-10px) rotate(-3.5deg); }
        }
        @keyframes koto-glow {
          0%,100% { opacity: 0.55; transform: scale(1); }
          50%     { opacity: 0.9;  transform: scale(1.05); }
        }
        .koto-hero-phone { animation: koto-float 7s ease-in-out infinite; }
        .koto-hero-glow { animation: koto-glow 7s ease-in-out infinite; }
      `}</style>

      <div>
        <h1
          className="koto-hero-h1"
          style={{
            margin: 0,
            fontFamily: T.font,
            fontSize: 'clamp(40px, 9vw, 64px)',
            lineHeight: 1.04,
            letterSpacing: '-0.035em',
            fontWeight: T.weight.display,
            color: T.ink,
          }}
        >
          Your AI trainer,
          <br />
          nutritionist, and
          <br />
          sport expert.
        </h1>
        <p
          className="koto-hero-sub"
          style={{
            margin: `${T.s5}px 0 0`,
            maxWidth: 520,
            fontFamily: T.font,
            fontSize: 17,
            lineHeight: 1.5,
            fontWeight: T.weight.body,
            color: T.ink3,
          }}
        >
          Talk to it daily. Tell it what&rsquo;s working, what&rsquo;s sore, what you ate, how you slept.
          It refines your workouts, adjusts your diet, and keeps you focused  —  like having a
          world-class trainer, nutritionist, and accountability partner in your pocket 24/7.
        </p>

        <div style={{ marginTop: T.s7, maxWidth: 320 }}>
          <PrimaryCTA pinned={false} onClick={onStart}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Get started, it&rsquo;s free
              <ArrowRight size={16} strokeWidth={2.25} />
            </span>
          </PrimaryCTA>
        </div>

        <div style={{
          marginTop: T.s5,
          display: 'flex', flexWrap: 'wrap', gap: T.s3, alignItems: 'center',
        }}>
          {trust.map((t) => (
            <span
              key={t}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                background: T.card, color: T.ink2,
                borderRadius: T.rPill,
                fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.button,
                letterSpacing: '0.1px',
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: T.rPill, background: T.ink,
              }} />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Hero phone  —  tilted, gently floating, with a soft warm glow behind.
          Reuses PhoneFrame + PhoneScreenHome so the mockup matches the
          showcase band lower on the page. */}
      <div style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 480,
      }}>
        <div className="koto-hero-glow" aria-hidden style={{
          position: 'absolute', inset: 0, margin: 'auto',
          width: '78%', height: '60%',
          background: 'radial-gradient(closest-side, rgba(216,154,106,0.28), transparent 70%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }} />
        <div className="koto-hero-phone" style={{ position: 'relative', maxWidth: 280, width: '100%' }}>
          <PhoneFrame>
            <PhoneScreenHome />
          </PhoneFrame>
        </div>
      </div>
    </section>
  )
}

function SportsStrip() {
  const doubled = [...SPORTS, ...SPORTS]
  return (
    <section style={{
      padding: `${T.s7}px 0 ${T.s8}px`,
      background: T.bg,
      overflow: 'hidden',
    }}>
      <div style={{
        textAlign: 'center',
        fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.button,
        textTransform: 'uppercase', letterSpacing: '0.12em', color: T.ink3,
        marginBottom: T.s5,
      }}>
        Built for every sport
      </div>
      <div style={{
        display: 'flex', width: '100%',
        maskImage: 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)',
      }}>
        <div style={{
          display: 'flex', gap: T.s3,
          animation: 'koto-marquee 50s linear infinite',
          paddingLeft: T.s3,
        }}>
          {doubled.map((sport, i) => (
            <span
              key={`${sport}-${i}`}
              style={{
                flexShrink: 0,
                padding: '10px 18px',
                background: T.card,
                color: T.ink2,
                borderRadius: T.rPill,
                fontFamily: T.font, fontSize: T.size.subtitle, fontWeight: T.weight.button,
                letterSpacing: '0.1px',
                whiteSpace: 'nowrap',
              }}
            >
              {sport}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      n: '1', title: 'Talk to your AI coach',
      body: 'Have a real conversation. Tell it your sport, your goals, your schedule, your injuries. It asks smart follow-ups and builds your profile in about two minutes  —  just tap pill buttons or type freely.',
      img: '/images/trainer/woman-yoga-laptop.jpg',
    },
    {
      n: '2', title: 'Get your complete program',
      body: 'Six custom sections built for you: baseline assessment, 90-day roadmap, periodized workout block, coaching playbook, meal plan with grocery list. All in under a minute.',
      img: '/images/trainer/woman-sitting.jpg',
    },
    {
      n: '3', title: 'Train daily with your AI',
      body: 'This is the part that matters. Log your workouts. Snap photos of meals. Check in daily. Your AI coach watches your trends, adjusts your plan, answers your questions 24/7, and keeps you accountable  —  like having a trainer in your pocket.',
      img: '/images/trainer/couple-running.jpg',
    },
  ]
  return (
    <section style={{ padding: `${T.s8}px 24px`, background: T.bg }}>
      <div style={{ maxWidth: PAGE_MAX, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: T.s8 }}>
          <h2 style={{
            margin: 0,
            fontFamily: T.font,
            fontSize: 'clamp(32px, 5.5vw, 48px)',
            lineHeight: 1.08,
            letterSpacing: '-0.025em',
            fontWeight: T.weight.display,
            color: T.ink,
          }}>
            How it works.
          </h2>
          <p style={{
            margin: `${T.s4}px auto 0`, maxWidth: 540,
            fontFamily: T.font,
            fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: T.ink3,
          }}>
            Three steps. About two minutes. One complete program.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: T.s5,
        }}>
          {steps.map((step) => (
            <div
              key={step.n}
              style={{
                background: T.card,
                borderRadius: T.rXl,
                padding: T.s6,
                display: 'flex', flexDirection: 'column', gap: T.s4,
              }}
            >
              <div style={{
                width: '100%', aspectRatio: '1 / 1',
                borderRadius: T.rLg,
                overflow: 'hidden',
                background: '#fafafb',
              }}>
                <img
                  src={step.img}
                  alt={step.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: T.rPill,
                background: T.ink, color: '#fff',
                fontFamily: T.font, fontSize: T.size.subtitle,
                fontWeight: T.weight.display, letterSpacing: 0,
              }}>
                {step.n}
              </div>
              <h3 style={{
                margin: 0,
                fontFamily: T.font,
                fontSize: T.size.h2, lineHeight: T.lh.h2, letterSpacing: T.track.h2,
                fontWeight: T.weight.display, color: T.ink,
              }}>
                {step.title}
              </h3>
              <p style={{
                margin: 0,
                fontFamily: T.font,
                fontSize: T.size.subtitle, lineHeight: T.lh.body,
                fontWeight: T.weight.body, color: T.ink3,
              }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// LivePlanBuilder  —  interactive demo of the actual product moment.
// Click "Build my plan" → six section pills tick on in sequence with
// approximate per-phase delays that mirror the real cascade
// (baseline ~15s → roadmap ~20s → workout ~90s parallel with playbook
// ~120s and food→meals ~140s). For the demo we compress to ~6s total
// so the user gets the dopamine without waiting. Replays on click.
function LivePlanBuilder() {
  const PHASES = [
    { key: 'baseline',  label: 'Baseline',         color: '#dc2626', delay: 250 },
    { key: 'roadmap',   label: '90-day roadmap',   color: '#2563eb', delay: 700 },
    { key: 'workout',   label: 'Workout block',    color: '#7c3aed', delay: 1700 },
    { key: 'playbook',  label: 'Coaching playbook',color: '#059669', delay: 2400 },
    { key: 'foodprefs', label: 'Food preferences', color: '#d97706', delay: 3400 },
    { key: 'meals',     label: '2-week meal plan + grocery', color: '#0891b2', delay: 4500 },
  ]
  const [done, setDone] = useState([])
  const [running, setRunning] = useState(false)
  const timersRef = useRef([])

  const start = () => {
    timersRef.current.forEach(clearTimeout)
    setDone([])
    setRunning(true)
    timersRef.current = PHASES.map((p) => setTimeout(() => {
      setDone((prev) => prev.includes(p.key) ? prev : [...prev, p.key])
    }, p.delay))
    timersRef.current.push(setTimeout(() => setRunning(false), PHASES[PHASES.length - 1].delay + 400))
  }

  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])

  const allDone = done.length === PHASES.length

  return (
    <section style={{ padding: `${T.s8}px 24px`, background: T.bg }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: T.s7 }}>
          <span style={{
            display: 'inline-block',
            padding: '4px 10px', borderRadius: T.rPill,
            background: T.card,
            fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.button,
            color: T.ink2, letterSpacing: '0.1px', marginBottom: T.s4,
          }}>
            Live demo
          </span>
          <h2 style={{
            margin: 0,
            fontFamily: T.font,
            fontSize: 'clamp(32px, 5.5vw, 48px)',
            lineHeight: 1.08, letterSpacing: '-0.025em',
            fontWeight: T.weight.display, color: T.ink,
          }}>
            Watch your plan
            <br />
            build itself.
          </h2>
          <p style={{
            margin: `${T.s4}px auto 0`, maxWidth: 540,
            fontFamily: T.font,
            fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: T.ink3,
          }}>
            Six sections, generated in parallel by a stack of AI specialists.
            In the real product this takes about two minutes  —  here we&rsquo;ve
            sped it up so you can see the shape.
          </p>
        </div>

        <div style={{
          background: '#0a0a0a',
          borderRadius: T.rXl,
          padding: T.s7,
          boxShadow: '0 30px 80px rgba(0,0,0,0.18)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: T.s5 }}>
            <span style={{ fontFamily: T.font, fontSize: T.size.body, fontWeight: T.weight.display, color: '#fff' }}>
              Your plan
            </span>
            <span style={{
              padding: '5px 14px', borderRadius: T.rPill,
              background: allDone ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.08)',
              color: allDone ? '#10b981' : 'rgba(255,255,255,0.6)',
              fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.button,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {done.length}/{PHASES.length} {allDone ? 'ready' : 'building'}
            </span>
          </div>

          <div style={{ display: 'grid', gap: T.s2 }}>
            {PHASES.map((p) => {
              const isDone = done.includes(p.key)
              const isNext = !isDone && running && done.length === PHASES.indexOf(p)
              return (
                <div key={p.key} style={{
                  display: 'flex', alignItems: 'center', gap: T.s3,
                  padding: '12px 14px',
                  background: isDone ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isDone ? p.color + '40' : 'rgba(255,255,255,0.06)'}`,
                  borderLeft: `3px solid ${isDone ? p.color : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: T.rMd,
                  transition: 'background .35s ease, border-color .35s ease',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: T.rPill, flexShrink: 0,
                    background: isDone ? p.color : 'rgba(255,255,255,0.08)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background .35s ease',
                  }}>
                    {isDone ? (
                      <Check size={14} color="#fff" strokeWidth={3} />
                    ) : isNext ? (
                      <Loader2 size={12} color="#fff" style={{ animation: 'koto-spin 0.9s linear infinite' }} />
                    ) : null}
                  </div>
                  <span style={{
                    fontFamily: T.font,
                    fontSize: T.size.body, lineHeight: 1.3,
                    fontWeight: T.weight.body,
                    color: isDone ? '#fff' : 'rgba(255,255,255,0.55)',
                    transition: 'color .35s ease',
                  }}>
                    {p.label}
                  </span>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: T.s5, display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={start}
              disabled={running}
              style={{
                padding: '12px 22px',
                borderRadius: T.rPill,
                border: 'none',
                background: running ? 'rgba(255,255,255,0.1)' : '#fff',
                color: running ? 'rgba(255,255,255,0.55)' : T.ink,
                fontFamily: T.font,
                fontSize: T.size.subtitle,
                fontWeight: T.weight.button,
                cursor: running ? 'default' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                letterSpacing: '0.1px',
                transition: 'transform .12s ease, background .15s ease',
              }}
            >
              {running ? <Loader2 size={14} style={{ animation: 'koto-spin 0.9s linear infinite' }} /> : <Sparkles size={14} />}
              {running ? 'Building…' : allDone ? 'Replay' : 'Build my plan'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes koto-spin { to { transform: rotate(360deg) } }`}</style>
    </section>
  )
}

function FeaturesGrid() {
  return (
    <section id="features" style={{ padding: `${T.s8}px 24px`, background: T.bg }}>
      <div style={{ maxWidth: PAGE_MAX, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: T.s8 }}>
          <h2 style={{
            margin: 0,
            fontFamily: T.font,
            fontSize: 'clamp(32px, 5.5vw, 48px)',
            lineHeight: 1.08,
            letterSpacing: '-0.025em',
            fontWeight: T.weight.display, color: T.ink,
          }}>
            A trainer that never sleeps.
            <br />
            A nutritionist that never judges.
          </h2>
          <p style={{
            margin: `${T.s4}px auto 0`, maxWidth: 620,
            fontFamily: T.font,
            fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: T.ink3,
          }}>
            Talk to your AI coach whenever you want -- morning, midnight, mid-workout. It's always ready, always current on your data, and always in your corner.
          </p>
        </div>

        <style>{`
          .koto-feature-card {
            transition: transform .25s ease, box-shadow .25s ease;
          }
          .koto-feature-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 32px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);
          }
          .koto-feature-icon {
            transition: transform .25s ease;
          }
          .koto-feature-card:hover .koto-feature-icon {
            transform: scale(1.08) rotate(-3deg);
          }
        `}</style>
        <div className="koto-features-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: T.s4,
        }}>
          <style>{`@media(min-width:900px){.koto-features-grid{grid-template-columns:repeat(3,1fr)!important;}}`}</style>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="koto-feature-card"
              style={{
                background: T.card,
                borderRadius: T.rLg,
                padding: T.s6,
                display: 'flex', flexDirection: 'column', gap: T.s3,
              }}
            >
              <div className="koto-feature-icon" style={{
                width: 48, height: 48, borderRadius: T.rSm,
                background: f.color + '18',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <f.icon size={22} color={f.color} strokeWidth={2} />
              </div>
              <h3 style={{
                margin: 0,
                fontFamily: T.font,
                fontSize: T.size.h2, lineHeight: T.lh.h2, letterSpacing: T.track.h2,
                fontWeight: T.weight.display, color: T.ink,
              }}>
                {f.title}
              </h3>
              <p style={{
                margin: 0,
                fontFamily: T.font,
                fontSize: T.size.subtitle, lineHeight: T.lh.body,
                fontWeight: T.weight.body, color: T.ink2,
              }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// InsideTheAi  —  credentials block. The actual differentiator: Koto's AI
// is modeled after a specific stack of expert personas, not a generic LLM
// "fitness assistant." Calling it out by name turns "trust the AI" from
// hand-wavy into specific.
function InsideTheAi() {
  const SPECIALISTS = [
    { Icon: Brain,          title: 'Biomechanics PhD',         body: 'Movement analysis, form correction, injury-risk detection. Knows why something hurts before you do.' },
    { Icon: ChefHat,        title: 'Nutrition PhD',            body: 'Macros, fueling windows, real-food portions. Builds meals around your numbers and your life, not a template.' },
    { Icon: Dumbbell,       title: 'Strength & Conditioning PhD', body: 'Periodization, peaking, in-season vs off-season. Plans the block, then writes the sessions.' },
    { Icon: Activity,       title: 'Exercise Physiology PhD',  body: 'Recovery, sleep debt, soreness curves. Knows when to push and when to back off.' },
    { Icon: GraduationCap,  title: 'Sports Psychology PhD',    body: 'Focus under pressure, motivation when you stall, the mental side most programs skip entirely.' },
    { Icon: Target,         title: 'Retired pro athlete + 20-year coaching staff', body: 'Real competition experience across multiple sports. Not theory  —  the kind of knowledge you only get from decades on the field, in the gym, and in the locker room.' },
  ]
  return (
    <section style={{ padding: `${T.s8}px 24px`, background: T.card }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: T.s8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: T.rPill,
            background: T.bg,
            fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.button,
            color: T.ink2, letterSpacing: '0.1px', marginBottom: T.s4,
          }}>
            <ShieldCheck size={12} strokeWidth={2.25} />
            Inside the AI
          </span>
          <h2 style={{
            margin: 0,
            fontFamily: T.font,
            fontSize: 'clamp(32px, 5.5vw, 48px)',
            lineHeight: 1.08, letterSpacing: '-0.025em',
            fontWeight: T.weight.display, color: T.ink,
          }}>
            Modeled after a stack
            <br />
            of real specialists.
          </h2>
          <p style={{
            margin: `${T.s4}px auto 0`, maxWidth: 600,
            fontFamily: T.font,
            fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: T.ink3,
          }}>
            Most fitness AI is a generic chatbot wearing a tank top. Koto&rsquo;s
            AI was modeled after a real team  —  five PhDs, a retired pro
            athlete, and a twenty-year coaching staff across multiple
            sports  —  so the answers sound like the people who&rsquo;d
            actually know.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: T.s4,
        }}>
          {SPECIALISTS.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="koto-feature-card"
              style={{
                background: T.bg,
                borderRadius: T.rLg,
                padding: T.s6,
                display: 'flex', flexDirection: 'column', gap: T.s3,
              }}
            >
              <div className="koto-feature-icon" style={{
                width: 44, height: 44, borderRadius: T.rSm,
                background: T.ink,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} color="#fff" strokeWidth={2} />
              </div>
              <h3 style={{
                margin: 0,
                fontFamily: T.font,
                fontSize: T.size.h2, lineHeight: T.lh.h2, letterSpacing: T.track.h2,
                fontWeight: T.weight.display, color: T.ink,
              }}>
                {title}
              </h3>
              <p style={{
                margin: 0,
                fontFamily: T.font,
                fontSize: T.size.subtitle, lineHeight: T.lh.body,
                fontWeight: T.weight.body, color: T.ink3,
              }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PhoneShowcase() {
  return (
    <section style={{
      padding: `${T.s8}px 24px`,
      background: T.card,
    }}>
      <div style={{ maxWidth: PAGE_MAX, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: T.s8 }}>
          <h2 style={{
            margin: 0,
            fontFamily: T.font,
            fontSize: 'clamp(32px, 5.5vw, 48px)',
            lineHeight: 1.08,
            letterSpacing: '-0.025em',
            fontWeight: T.weight.display, color: T.ink,
          }}>
            See your plan come together.
          </h2>
          <p style={{
            margin: `${T.s4}px auto 0`, maxWidth: 560,
            fontFamily: T.font,
            fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: T.ink3,
          }}>
            Home, workouts, meals  —  same calm language across every screen.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: T.s6,
          alignItems: 'end',
          justifyItems: 'center',
        }}>
          <PhoneFrame translateY={28}>
            <PhoneScreenHome />
          </PhoneFrame>
          <PhoneFrame translateY={0}>
            <PhoneScreenWorkout />
          </PhoneFrame>
          <PhoneFrame translateY={28}>
            <PhoneScreenMeals />
          </PhoneFrame>
        </div>
      </div>
    </section>
  )
}

function PhoneFrame({ children, translateY = 0 }) {
  return (
    <div style={{
      width: '100%', maxWidth: 280,
      aspectRatio: '9 / 19.5',
      transform: `translateY(${translateY}px)`,
      borderRadius: 40,
      padding: 8,
      background: '#0a0a0a',
      boxShadow: '0 30px 60px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.08)',
      position: 'relative',
    }}>
      <div style={{
        width: '100%', height: '100%',
        background: T.bg,
        borderRadius: 32,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          width: 92, height: 22, borderRadius: T.rPill,
          background: '#0a0a0a', zIndex: 2,
        }} />
        {children}
      </div>
    </div>
  )
}

function PhoneScreenHome() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const today = 2
  return (
    <div style={{
      padding: '40px 16px 16px',
      display: 'flex', flexDirection: 'column', gap: T.s3,
      height: '100%',
    }}>
      <div style={{
        fontFamily: T.font, fontSize: 11, fontWeight: T.weight.body,
        color: T.ink3, letterSpacing: '0.1px',
      }}>
        FRI, OCT 24
      </div>
      <div style={{
        fontFamily: T.font, fontSize: 22, fontWeight: T.weight.display,
        letterSpacing: '-0.02em', color: T.ink, lineHeight: 1.1,
      }}>
        Today
      </div>

      {/* DateStrip */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {days.map((d, i) => (
          <div
            key={i}
            style={{
              width: 28, height: 36, borderRadius: T.rPill,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 2,
              background: i === today ? T.ink : 'transparent',
              color: i === today ? '#fff' : T.ink3,
              fontFamily: T.font, fontSize: 10, fontWeight: T.weight.button,
            }}
          >
            <span style={{ opacity: 0.7 }}>{d}</span>
            <span style={{ fontSize: 12, fontWeight: T.weight.display }}>{20 + i}</span>
          </div>
        ))}
      </div>

      {/* Calorie ring tile (real component, scaled) */}
      <div style={{ transform: 'scale(0.78)', transformOrigin: 'top left', width: '128%', marginTop: -6, marginBottom: -16 }}>
        <RingMetricTile label="Calories" value={1820} unit="kcal" pct={0.78} />
      </div>

      {/* Macro chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {[
          { label: 'Protein', v: '142g', pct: 0.65, c: T.accent },
          { label: 'Carbs', v: '210g', pct: 0.55, c: T.accentBlue },
          { label: 'Fat', v: '52g', pct: 0.42, c: T.accentRed },
        ].map((m) => (
          <div key={m.label} style={{
            background: T.cardElev,
            borderRadius: T.rSm,
            padding: '8px 8px',
            boxShadow: T.shadowFloater,
          }}>
            <div style={{ fontFamily: T.font, fontSize: 8, fontWeight: T.weight.body, color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.1px' }}>
              {m.label}
            </div>
            <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: T.weight.display, color: T.ink, marginTop: 2 }}>
              {m.v}
            </div>
            <div style={{ height: 3, background: T.divider, borderRadius: T.rPill, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ width: `${m.pct * 100}%`, height: '100%', background: m.c, borderRadius: T.rPill }} />
            </div>
          </div>
        ))}
      </div>

      {/* Today's workout card */}
      <div style={{
        marginTop: 'auto',
        background: T.card, borderRadius: T.rMd, padding: 10,
      }}>
        <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: T.weight.body, color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.1px' }}>
          TODAY&rsquo;S WORKOUT
        </div>
        <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: T.weight.display, color: T.ink, marginTop: 2 }}>
          Lower Body Power, Block 2
        </div>
        <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: T.weight.body, color: T.ink3, marginTop: 2 }}>
          5 exercises &middot; 45 min
        </div>
      </div>
    </div>
  )
}

function PhoneScreenWorkout() {
  const sets = [
    { name: 'Trap Bar Deadlift', s: '4x5 @ 225' },
    { name: 'Box Jump', s: '4x3' },
    { name: 'RDL', s: '3x8 @ 155' },
    { name: 'Bulgarian Split Squat', s: '3x10' },
    { name: 'Cossack Squat', s: '3x8' },
  ]
  return (
    <div style={{
      padding: '40px 16px 16px',
      display: 'flex', flexDirection: 'column', gap: T.s3,
      height: '100%',
    }}>
      <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: T.weight.body, color: T.ink3, letterSpacing: '0.1px' }}>
        WEEK 2 &middot; DAY 3
      </div>
      <div style={{
        fontFamily: T.font, fontSize: 20, fontWeight: T.weight.display,
        letterSpacing: '-0.02em', color: T.ink, lineHeight: 1.1,
      }}>
        Lower Body Power
      </div>

      <div style={{
        display: 'flex', gap: 6, marginTop: 2,
      }}>
        <span style={{ padding: '4px 10px', background: T.ink, color: '#fff', borderRadius: T.rPill, fontFamily: T.font, fontSize: 10, fontWeight: T.weight.button }}>
          In progress
        </span>
        <span style={{ padding: '4px 10px', background: T.card, color: T.ink2, borderRadius: T.rPill, fontFamily: T.font, fontSize: 10, fontWeight: T.weight.button }}>
          45 min
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {sets.map((set, i) => (
          <div key={set.name} style={{
            background: T.card, borderRadius: T.rSm,
            padding: '10px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: T.rPill,
              background: i < 2 ? T.ink : T.cardElev,
              color: i < 2 ? '#fff' : T.ink3,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.font, fontSize: 10, fontWeight: T.weight.display,
              border: i < 2 ? 'none' : `1px solid ${T.border}`,
            }}>
              {i < 2 ? '✓' : i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.font, fontSize: 12, fontWeight: T.weight.h1, color: T.ink, lineHeight: 1.2 }}>
                {set.name}
              </div>
              <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: T.weight.body, color: T.ink3, marginTop: 1 }}>
                {set.s}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div style={{
          background: T.ink, color: '#fff',
          borderRadius: T.rPill,
          padding: '10px 16px',
          fontFamily: T.font, fontSize: 12, fontWeight: T.weight.button,
          textAlign: 'center', letterSpacing: '0.1px',
        }}>
          Log next set
        </div>
      </div>
    </div>
  )
}

function PhoneScreenMeals() {
  const meals = [
    { tag: 'Breakfast', name: 'Oats, banana, peanut butter', kcal: 520 },
    { tag: 'Lunch', name: 'Chicken, rice, broccoli', kcal: 680 },
    { tag: 'Snack', name: 'Greek yogurt + berries', kcal: 240 },
    { tag: 'Dinner', name: 'Salmon, sweet potato, salad', kcal: 720 },
  ]
  return (
    <div style={{
      padding: '40px 16px 16px',
      display: 'flex', flexDirection: 'column', gap: T.s3,
      height: '100%',
    }}>
      <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: T.weight.body, color: T.ink3, letterSpacing: '0.1px' }}>
        MEAL PLAN
      </div>
      <div style={{
        fontFamily: T.font, fontSize: 20, fontWeight: T.weight.display,
        letterSpacing: '-0.02em', color: T.ink, lineHeight: 1.1,
      }}>
        Today&rsquo;s plate
      </div>

      <div style={{
        background: T.card, borderRadius: T.rMd, padding: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: T.weight.body, color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.1px' }}>
            Daily target
          </div>
          <div style={{ fontFamily: T.font, fontSize: 20, fontWeight: T.weight.display, color: T.ink, marginTop: 2 }}>
            2,160 <span style={{ fontSize: 11, fontWeight: T.weight.body, color: T.ink3 }}>kcal</span>
          </div>
        </div>
        <div style={{
          padding: '6px 10px', background: T.ink, color: '#fff',
          borderRadius: T.rPill,
          fontFamily: T.font, fontSize: 10, fontWeight: T.weight.button,
        }}>
          On track
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {meals.map((m) => (
          <div key={m.name} style={{
            background: T.cardElev, borderRadius: T.rSm,
            padding: '10px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: T.shadowFloater,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: T.rSm,
              background: T.card,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>
              <Utensils size={14} color={T.ink} strokeWidth={2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: T.weight.body, color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.1px' }}>
                {m.tag}
              </div>
              <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: T.weight.h1, color: T.ink, lineHeight: 1.2, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.name}
              </div>
            </div>
            <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: T.weight.display, color: T.ink }}>
              {m.kcal}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SocialProof() {
  return (
    <section style={{ padding: `${T.s8}px 24px`, background: T.bg }}>
      <div style={{ maxWidth: PAGE_MAX, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: T.s7 }}>
          <h2 style={{
            margin: 0,
            fontFamily: T.font,
            fontSize: 'clamp(32px, 5.5vw, 48px)',
            lineHeight: 1.08,
            letterSpacing: '-0.025em',
            fontWeight: T.weight.display, color: T.ink,
          }}>
            Real people.
            <br />
            Real results.
          </h2>
        </div>

        <div style={{
          background: T.ink, borderRadius: T.rXl, padding: `${T.s7}px ${T.s6}px`,
          marginBottom: T.s8,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: T.s5,
          }}>
            {TESTIMONIAL_STATS.map((s) => (
              <div key={s.label} style={{
                padding: T.s4,
                borderLeft: s.highlight ? `3px solid ${T.accent}` : '3px solid rgba(255,255,255,0.08)',
                paddingLeft: T.s5,
              }}>
                <div style={{
                  fontFamily: T.font,
                  fontSize: s.highlight ? 52 : 40, fontWeight: T.weight.display,
                  letterSpacing: '-0.03em', color: s.highlight ? T.accent : '#fff', lineHeight: 1,
                  marginBottom: T.s2,
                }}>
                  <CountUpStat value={s.value} />
                </div>
                <div style={{
                  fontFamily: T.font,
                  fontSize: T.size.subtitle, fontWeight: T.weight.body,
                  color: 'rgba(255,255,255,0.55)', lineHeight: 1.45,
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TODO: replace with real testimonials once we have permission. */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: T.s4,
        }}>
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} style={{
              margin: 0,
              background: T.card,
              borderRadius: T.rLg,
              padding: T.s6,
              display: 'flex', flexDirection: 'column', gap: T.s4,
            }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} color={T.star} fill={T.star} strokeWidth={0} />
                ))}
              </div>
              <blockquote style={{
                margin: 0,
                fontFamily: T.font,
                fontSize: T.size.body, lineHeight: 1.5,
                fontWeight: T.weight.body, color: T.ink2,
              }}>
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption style={{
                display: 'flex', alignItems: 'center', gap: T.s3,
                fontFamily: T.font,
              }}>
                <img
                  src={t.avatar}
                  alt={t.name}
                  width={44} height={44}
                  style={{ borderRadius: T.rPill, flexShrink: 0, objectFit: 'cover' }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'block',
                    fontSize: T.size.subtitle, fontWeight: T.weight.h1,
                    color: T.ink,
                  }}>
                    {t.name}
                  </span>
                  <span style={{
                    display: 'block', fontWeight: T.weight.body, color: T.ink3,
                    fontSize: T.size.caption, marginTop: 2,
                  }}>
                    {t.role}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

// CountUpStat  —  animates a numeric stat from 0 → target when scrolled
// into view via IntersectionObserver. Preserves any non-numeric trailing
// (e.g. "+", "%", "/7") so values like "15+" or "100%" display correctly.
// Skips animation when prefers-reduced-motion is set  —  accessibility +
// signals you respect users who don't want bouncy chrome.
function CountUpStat({ value, duration = 1200 }) {
  const ref = useRef(null)
  const [display, setDisplay] = useState(value)
  const startedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || startedRef.current) return

    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) { setDisplay(value); return }

    const m = String(value).match(/^(\d+(?:\.\d+)?)(.*)$/)
    if (!m) { setDisplay(value); return }
    const target = parseFloat(m[1])
    const suffix = m[2]
    const isInt = !m[1].includes('.')

    setDisplay(`0${suffix}`)

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || startedRef.current) continue
        startedRef.current = true
        const startTs = performance.now()
        const tick = (now) => {
          const t = Math.min(1, (now - startTs) / duration)
          // ease-out cubic
          const eased = 1 - Math.pow(1 - t, 3)
          const v = target * eased
          setDisplay((isInt ? Math.round(v) : v.toFixed(1)) + suffix)
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        io.disconnect()
      }
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [value, duration])

  return <span ref={ref}>{display}</span>
}

function FaqList() {
  return (
    <section style={{ padding: `${T.s8}px 24px`, background: T.bg }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: T.s7 }}>
          <h2 style={{
            margin: 0,
            fontFamily: T.font,
            fontSize: 'clamp(32px, 5.5vw, 48px)',
            lineHeight: 1.08,
            letterSpacing: '-0.025em',
            fontWeight: T.weight.display, color: T.ink,
          }}>
            Common questions.
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: T.s2 }}>
          {FAQS.map((item) => (
            <details key={item.q} style={{
              background: T.card,
              borderRadius: T.rLg,
              padding: `${T.s4}px ${T.s5}px`,
            }}>
              <summary style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: T.s4,
                fontFamily: T.font,
                fontSize: T.size.body, lineHeight: 1.35,
                fontWeight: T.weight.h1, color: T.ink,
                padding: '6px 0',
              }}>
                <span>{item.q}</span>
                <span className="koto-faq-chev" style={{
                  flexShrink: 0,
                  width: 24, height: 24, borderRadius: T.rPill,
                  background: T.cardElev,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: T.font, fontSize: 18, fontWeight: T.weight.h1, color: T.ink2,
                  lineHeight: 1, transition: 'transform .15s ease',
                }}>
                  +
                </span>
              </summary>
              <p style={{
                margin: `${T.s3}px 0 ${T.s2}px`,
                fontFamily: T.font,
                fontSize: T.size.subtitle, lineHeight: 1.6,
                fontWeight: T.weight.body, color: T.ink3,
              }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function BottomCta({ onStart }) {
  return (
    <section style={{
      padding: `${T.s8}px 24px ${T.s8 + 16}px`,
      background: T.ink,
      color: '#fff',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{
          margin: 0,
          fontFamily: T.font,
          fontSize: 'clamp(36px, 6.5vw, 56px)',
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          fontWeight: T.weight.display, color: '#fff',
        }}>
          The most transformative AI trainer ever built.
        </h2>
        <p style={{
          margin: `${T.s5}px auto 0`, maxWidth: 560,
          fontFamily: T.font,
          fontSize: T.size.body, lineHeight: T.lh.body,
          fontWeight: T.weight.body, color: 'rgba(255,255,255,0.65)',
        }}>
          Five PhDs. A pro athlete. Twenty years of coaching. All in your pocket, 24/7.
          Free to start, no credit card. Two minutes to your first plan.
        </p>

        <div style={{ marginTop: T.s7, display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onStart}
            style={{
              minHeight: 58,
              padding: '0 28px',
              background: '#fff',
              color: T.ink,
              border: 'none',
              borderRadius: T.rPill,
              fontFamily: T.font,
              fontSize: T.size.body,
              fontWeight: T.weight.button,
              letterSpacing: '0.1px',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            }}
          >
            Get started, it&rsquo;s free
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </section>
  )
}

// ── Try It Demo — live AI chat on the landing page ──────────────────────────

function TryItDemo() {
  const [coach, setCoach] = useState(null) // null = picker, 'male' | 'female'
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, streamingText])

  async function streamTurn(turnMessages) {
    setStreaming(true)
    setStreamingText('')
    try {
      const res = await fetch('/api/trainer/demo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: turnMessages }),
      })
      if (!res.ok) { setStreaming(false); return }
      const reader = res.body?.getReader()
      if (!reader) { setStreaming(false); return }
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            if (event.type === 'text_delta' && event.text) {
              fullText += event.text
              setStreamingText(fullText)
            }
          } catch { /* skip */ }
        }
      }
      if (fullText) setMessages((prev) => [...prev, { role: 'assistant', content: fullText }])
    } catch { /* network error */ }
    setStreamingText('')
    setStreaming(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handlePickCoach(gender) {
    setCoach(gender)
    // Fire greeting
    streamTurn([])
  }

  function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    const userMsg = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    streamTurn(next)
  }

  const QUICK = ['I play basketball', 'I want to lose 20 lbs', 'I need to get faster', 'I have a bad knee']

  const coachName = coach === 'female' ? 'Coach Maya' : 'Coach Alex'
  const coachInitial = coach === 'female' ? 'M' : 'A'

  return (
    <section style={{ padding: `${T.s8}px 24px`, background: T.card }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: T.s6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: T.rPill,
            background: T.bg,
            fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.button,
            color: T.ink2, letterSpacing: '0.1px', marginBottom: T.s4,
          }}>
            <MessageCircle size={12} strokeWidth={2.25} />
            Live demo
          </span>
          <h2 style={{
            margin: 0, fontFamily: T.font,
            fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1.08,
            letterSpacing: '-0.025em', fontWeight: T.weight.display, color: T.ink,
          }}>
            Try your AI coach.
            <br />
            <span style={{ color: T.accent }}>Right now.</span>
          </h2>
          <p style={{
            margin: `${T.s3}px auto 0`, maxWidth: 460,
            fontFamily: T.font, fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: T.ink3,
          }}>
            No sign-up. No email. Just pick your coach and start talking.
          </p>
        </div>

        {/* Coach picker */}
        {!coach && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.s4,
            maxWidth: 400, margin: '0 auto',
          }}>
            {[
              { gender: 'male', label: 'Coach Alex', initial: 'A', color: '#5aa0ff', desc: 'Calm, direct, data-driven' },
              { gender: 'female', label: 'Coach Maya', initial: 'M', color: T.accent, desc: 'Warm, motivating, detail-oriented' },
            ].map((c) => (
              <button key={c.gender} type="button" onClick={() => handlePickCoach(c.gender)} style={{
                padding: T.s5, background: T.bg,
                border: `1.5px solid ${T.border}`,
                borderRadius: T.rLg, cursor: 'pointer', textAlign: 'center',
                transition: 'all .15s',
                boxShadow: T.shadowFloater,
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.color; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 999, margin: '0 auto 10px',
                  background: `linear-gradient(135deg, ${c.color}, ${c.color}99)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: T.font,
                }}>{c.initial}</div>
                <div style={{ fontFamily: T.font, fontSize: 16, fontWeight: T.weight.button, color: T.ink }}>{c.label}</div>
                <div style={{ fontFamily: T.font, fontSize: 13, color: T.ink3, marginTop: 4 }}>{c.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* Chat window */}
        {coach && (
          <div style={{
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: T.rXl, overflow: 'hidden',
            boxShadow: T.shadowModal,
          }}>
            {/* Chat header */}
            <div style={{
              padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', gap: 10,
              background: T.bg,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 999, flexShrink: 0,
                background: coach === 'female' ? `linear-gradient(135deg, ${T.accent}, ${T.accent}99)` : 'linear-gradient(135deg, #5aa0ff, #5aa0ff99)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: T.font,
              }}>{coachInitial}</div>
              <div>
                <div style={{ fontFamily: T.font, fontSize: 15, fontWeight: T.weight.button, color: T.ink }}>{coachName}</div>
                <div style={{ fontFamily: T.font, fontSize: 12, color: T.ink3 }}>AI Coach  ·  Online now</div>
              </div>
              <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: 999, background: '#34c759' }} />
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{
              minHeight: 280, maxHeight: 400, overflowY: 'auto',
              padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10,
              background: T.card,
            }}>
              {messages.map((m, i) => {
                const isUser = m.role === 'user'
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '80%', padding: '10px 14px',
                      borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: isUser ? T.ink : T.bg,
                      color: isUser ? '#fff' : T.ink,
                      border: isUser ? 'none' : `1px solid ${T.border}`,
                      fontFamily: T.font, fontSize: 14, lineHeight: 1.55,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {m.content}
                    </div>
                  </div>
                )
              })}
              {streaming && streamingText && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px',
                    borderRadius: '14px 14px 14px 4px',
                    background: T.bg, border: `1px solid ${T.border}`,
                    color: T.ink,
                    fontFamily: T.font, fontSize: 14, lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {streamingText}
                  </div>
                </div>
              )}
              {streaming && !streamingText && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.ink3, fontSize: 13, fontFamily: T.font }}>
                  <Loader2 size={14} style={{ animation: 'koto-marquee-spin 1s linear infinite' }} />
                  {coachName} is typing...
                  <style>{'@keyframes koto-marquee-spin{to{transform:rotate(360deg)}}'}</style>
                </div>
              )}

              {/* Quick prompts */}
              {messages.length <= 1 && !streaming && messages.some((m) => m.role === 'assistant') && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {QUICK.map((q) => (
                    <button key={q} type="button" onClick={() => {
                      setInput('')
                      const next = [...messages, { role: 'user', content: q }]
                      setMessages(next)
                      streamTurn(next)
                    }} style={{
                      padding: '8px 14px', background: T.bg,
                      border: `1px solid ${T.border}`,
                      borderRadius: 20, color: T.ink2,
                      fontFamily: T.font, fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', transition: 'all .12s',
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.ink }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.ink2 }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{
              padding: '12px 16px', borderTop: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', gap: 8,
              background: T.bg,
            }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                placeholder="Ask your coach anything..."
                disabled={streaming}
                style={{
                  flex: 1, padding: '10px 14px', fontSize: 14,
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10, color: T.ink,
                  fontFamily: T.font, outline: 'none',
                }}
              />
              <button type="button" onClick={handleSend} disabled={!input.trim() || streaming} style={{
                width: 38, height: 38, borderRadius: 10,
                background: input.trim() && !streaming ? T.ink : T.card,
                border: 'none', color: input.trim() && !streaming ? '#fff' : T.ink4,
                cursor: input.trim() && !streaming ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ArrowRight size={16} strokeWidth={2.25} />
              </button>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{
          marginTop: T.s4, textAlign: 'center',
          fontFamily: T.font, fontSize: 11, color: T.ink4,
        }}>
          This is a live AI demo. Not medical advice. Always consult a professional.
        </div>
      </div>
    </section>
  )
}

function FounderStory() {
  return (
    <section style={{ padding: `${T.s8}px 24px`, background: T.bg }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: T.s7 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: T.rPill,
            background: T.card,
            fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.button,
            color: T.ink2, letterSpacing: '0.1px', marginBottom: T.s4,
          }}>
            Our story
          </span>
          <h2 style={{
            margin: 0, fontFamily: T.font,
            fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1.08,
            letterSpacing: '-0.025em', fontWeight: T.weight.display, color: T.ink,
          }}>
            Built by a family.
            <br />
            For every family.
          </h2>
        </div>

        <div style={{
          background: T.card, borderRadius: T.rXl, padding: T.s7,
          fontFamily: T.font, fontSize: T.size.body, lineHeight: 1.7,
          fontWeight: T.weight.body, color: T.ink2,
        }}>
          <p style={{ margin: `0 0 ${T.s5}px` }}>
            Koto Trainer started with two kids and a problem.
          </p>
          <p style={{ margin: `0 0 ${T.s5}px` }}>
            <strong style={{ color: T.ink, fontWeight: T.weight.h1 }}>She</strong> wanted
            to get healthier but didn't want to work out with a trainer. Didn't want to listen to
            mom and dad either. She wanted someone who would just <em>meet her where she was</em> and
            guide her without judgment  --  on her schedule, in her language, without the awkwardness of
            a stranger watching her sweat.
          </p>
          <p style={{ margin: `0 0 ${T.s5}px` }}>
            <strong style={{ color: T.ink, fontWeight: T.weight.h1 }}>He</strong> is a high
            school varsity baseball player who wanted a coach in his pocket 24/7  --  someone who could
            help him throw harder, hit farther, eat right, sleep right, and train smart enough to play
            in college and beyond. Not just a workout app. A real training partner who knows his
            velocity, his schedule, and his goals.
          </p>
          <p style={{ margin: `0 0 ${T.s5}px` }}>
            <strong style={{ color: T.ink, fontWeight: T.weight.h1 }}>The expert</strong> is a
            world-renowned bariatric surgeon and weight loss specialist  --  a close family friend
            who has spent her career helping people transform their health. She knew exactly what
            kind of guidance works and what doesn't. She brought the clinical rigor, the nutrition
            science, and the deep understanding of how real people actually change their bodies
            and their lives.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: T.ink, fontWeight: T.weight.h1 }}>Dad</strong> is the one
            who said yes. A builder at heart who supports his kids' wildest ideas and turns them into
            reality. He brought the team, the technology, and the belief that if his kids needed this,
            millions of other people do too.
          </p>
        </div>

        <p style={{
          margin: `${T.s6}px auto 0`, textAlign: 'center', maxWidth: 600,
          fontFamily: T.font, fontSize: T.size.subtitle, lineHeight: 1.5,
          fontWeight: T.weight.body, color: T.ink3,
        }}>
          That's why Koto works for a sixteen-year-old athlete, a busy parent, a college
          student, an executive on the road, and a retiree getting back in shape. It was
          built by all of them.
        </p>
      </div>
    </section>
  )
}

function LifestylePhotoStrip() {
  const photos = [
    { src: '/images/trainer/couple-running.jpg', alt: 'Couple running on coastal trail' },
    { src: '/images/trainer/woman-sitting.jpg', alt: 'Athlete stretching outdoors' },
    { src: '/images/trainer/woman-yoga-laptop.jpg', alt: 'Woman training at home with laptop' },
    { src: '/images/trainer/woman-running.jpg', alt: 'Woman running with earbuds' },
  ]
  return (
    <section className="koto-photos" style={{ padding: `${T.s6}px 0`, overflow: 'hidden' }}>
      <style>{`
        .koto-photos .koto-photo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
        @media (max-width: 640px) { .koto-photos .koto-photo-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
      <div className="koto-photo-grid" style={{ maxWidth: PAGE_MAX + 100, margin: '0 auto' }}>
        {photos.map((p) => (
          <div key={p.src} style={{
            aspectRatio: '4 / 3',
            overflow: 'hidden',
            borderRadius: T.rMd,
          }}>
            <img
              src={p.src}
              alt={p.alt}
              loading="lazy"
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover',
                display: 'block',
                filter: 'brightness(0.95) contrast(1.05)',
              }}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function FooterStrip() {
  const links = ['About', 'Pricing', 'Privacy', 'Contact']
  return (
    <footer style={{
      padding: `${T.s7}px 24px ${T.s7}px`,
      background: T.bg,
      borderTop: `1px solid ${T.border}`,
    }}>
      <div style={{
        maxWidth: PAGE_MAX, margin: '0 auto',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        gap: T.s5,
      }}>
        <div style={{
          fontFamily: T.font,
          fontSize: T.size.h2, fontWeight: T.weight.display, color: T.ink,
          letterSpacing: '-0.02em',
        }}>
          Koto
        </div>

        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: T.s5 }}>
          {links.map((l) => (
            <a
              key={l}
              href="#"
              style={{
                fontFamily: T.font,
                fontSize: T.size.subtitle, fontWeight: T.weight.button,
                color: T.ink2, textDecoration: 'none',
              }}
            >
              {l}
            </a>
          ))}
        </nav>

        <div style={{ display: 'flex', gap: T.s3 }}>
          {['X', 'IG', 'YT'].map((s) => (
            <a
              key={s}
              href="#"
              aria-label={s}
              style={{
                width: 36, height: 36, borderRadius: T.rPill,
                background: T.card,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.button,
                color: T.ink2, textDecoration: 'none',
              }}
            >
              {s}
            </a>
          ))}
        </div>
      </div>

      <div style={{
        maxWidth: PAGE_MAX, margin: `${T.s6}px auto 0`,
        fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.body,
        color: T.ink4, lineHeight: 1.5,
      }}>
        Koto Trainer is AI, not a doctor or licensed medical professional.
        This is not medical advice. Always consult a physician before starting a new training program.
        <div style={{ marginTop: T.s3, color: T.ink3 }}>
          &copy; {new Date().getFullYear()} Koto, Inc.
        </div>
      </div>
    </footer>
  )
}
