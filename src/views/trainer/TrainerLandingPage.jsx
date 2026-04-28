"use client"
import { useNavigate } from 'react-router-dom'
import {
  Dumbbell, Utensils, TrendingUp, MessageCircle, BookOpen, Target,
  ArrowRight, Star,
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
    title: 'AI Coach Chat',
    desc: "Have a real conversation with your coach. It learns your sport, your goals, and your schedule, then builds a plan that fits your life.",
    color: '#0071e3',
  },
  {
    icon: Dumbbell,
    title: 'Custom Workouts',
    desc: 'Periodized training blocks for your sport. Log every set, every rep. The program adapts to what you actually do.',
    color: '#7c3aed',
  },
  {
    icon: Utensils,
    title: 'Meal Plans + Food Tracking',
    desc: "Macros that hit your numbers with food you'll actually eat. Snap a photo and the AI counts calories instantly.",
    color: '#059669',
  },
  {
    icon: TrendingUp,
    title: 'Progress Charts',
    desc: 'Body weight, lift volume, sprint times, sport-specific measurables. See the trends that matter, when they matter.',
    color: '#dc2626',
  },
  {
    icon: BookOpen,
    title: 'Learn Section',
    desc: 'Every training term explained in plain English. No jargon, no confusion. Built for athletes, not coaches.',
    color: '#d97706',
  },
  {
    icon: Target,
    title: 'ProPath Score',
    desc: 'Targeting college? See which programs fit your measurables and academics. Dream, target, and safety schools, ranked.',
    color: '#0891b2',
  },
]

const TESTIMONIAL_STATS = [
  { value: '6', label: 'Plan sections, generated in minutes' },
  { value: '15+', label: 'Sports, each with its own playbook' },
  { value: '100%', label: 'Personalized to your sport & goals' },
  { value: '24/7', label: 'AI coach in your pocket' },
]

// TODO: replace with real coach + athlete quotes once we have permission.
const TESTIMONIALS = [
  { quote: "I've coached high school baseball for fifteen years. Koto built a 90-day plan for one of my pitchers in three minutes that I would've billed at twelve hours.", name: 'Coach Mike R.', role: 'Pitching Coach, Texas' },
  { quote: 'My daughter plays club volleyball year-round. The AI built around her tournament schedule, not against it. She PR’d her vertical in six weeks.', name: 'Jen K.', role: 'Parent of D1-track athlete' },
  { quote: 'I run a small training studio. Koto is the first AI tool that doesn’t feel like a generic chatbot wearing a fitness costume.', name: 'Devon T.', role: 'Owner, Apex Performance' },
]

const FAQS = [
  {
    q: 'How does the AI know my sport?',
    a: 'During the 2-minute intake, you tell us your sport, position, level, and goals. The AI loads a sport-specific playbook (energy systems, common movement patterns, in-season vs off-season periodization) and writes your plan against that, not a generic template.',
  },
  {
    q: 'Is my health data safe?',
    a: "Your data lives in your account, encrypted at rest. We don’t sell it, we don’t share it, and we never train public models on it. Coaches you invite see only what you share with them.",
  },
  {
    q: 'Can I use it without a coach?',
    a: 'Yes. The default mode is athlete-first: you sign up, you get your plan, you train. If you have a coach, you can invite them and they get a read-only view plus a chat thread to leave notes.',
  },
  {
    q: 'What sports are supported?',
    a: 'Today: baseball, football, basketball, soccer, track & field, swimming, wrestling, volleyball, tennis, golf, hockey, lacrosse, CrossFit, MMA, and a general-fitness mode. We add a new sport every couple of weeks based on what athletes ask for.',
  },
  {
    q: 'How much does it cost?',
    a: 'Free to start. You get the full intake, your baseline plan, your first 14 days of workouts, and a 90-day roadmap at no cost. Continued access and unlimited coach chat are part of a paid plan we’ll detail at the end of your trial.',
  },
  {
    q: 'Do you have a free trial?',
    a: 'The first 14 days are free with no credit card. Cancel from your profile any time before then. After 14 days you decide whether to stay on.',
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

      <HowItWorks />

      <FeaturesGrid />

      <PhoneShowcase />

      <SocialProof />

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
  const trust = ['PhD-trained AI', 'Multi-sport', '$0 to start']
  return (
    <section style={{
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
      `}</style>
      <div className="koto-hero" style={{ display: 'contents' }} />

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
          Train smarter,
          <br />
          for any sport.
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
          Custom workouts, meal plans, and a personal AI coach that knows your sport
          inside-out. Built for athletes, parents, and the coaches who train them.
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

      {/* IMAGE PROMPT (Midjourney/DALL-E):
          "Editorial photo of a 19-year-old multi-sport athlete looking down at
           an iPhone showing a fitness app — soft morning gym light, faint
           parquet floor reflection, cool gray + warm tan color grade matching
           Apple Health aesthetic, shallow depth of field, photorealistic, no
           visible logos, 4:5 vertical aspect ratio. Phone screen will be
           composited later — leave it slightly blurred or as a glow."
          Replace this placeholder div with an <img> when generated. */}
      <div style={{
        position: 'relative',
        width: '100%', aspectRatio: '4 / 5',
        borderRadius: T.rXl,
        background: `linear-gradient(135deg, ${T.card} 0%, #e5e5ea 60%, #d8d8de 100%)`,
        overflow: 'hidden',
        boxShadow: T.shadowFloater,
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', color: T.ink3,
          fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.body,
          letterSpacing: '0.1px',
        }}>
          [hero portrait]
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
      n: '1', title: 'Tell us about you',
      body: 'Two minutes of pill-tap intake — sport, level, goals, schedule, dietary edges. No essays.',
      // IMAGE PROMPT (Midjourney/DALL-E):
      //   "Top-down editorial photo of a young athlete’s hands holding an iPhone,
      //    with a softly blurred fitness app intake screen on display. Warm-tan
      //    gradient backdrop, single soft light from upper-left, photorealistic,
      //    no logos, 1:1 square aspect ratio."
      tint: '#f1f1f6',
    },
    {
      n: '2', title: 'AI builds your plan',
      body: 'Six sections in under a minute: baseline, 90-day roadmap, 2-week block, playbook, meal plan, grocery list.',
      // IMAGE PROMPT (Midjourney/DALL-E):
      //   "Abstract editorial render of softly glowing geometric ‘cards’ stacked
      //    diagonally on a cool-gray surface, suggesting an AI assembling a
      //    personalized plan. One card has a faint warm-tan accent. Minimalist,
      //    photorealistic 3D, no text, 1:1 square aspect ratio."
      tint: '#f1f1f6',
    },
    {
      n: '3', title: 'Train, log, adjust',
      body: 'Tap to log sets and meals. The AI watches your trend lines and refines next week’s plan automatically.',
      // IMAGE PROMPT (Midjourney/DALL-E):
      //   "Editorial photo of an athlete mid-rep on a back-squat in a clean
      //    natural-light gym, side angle, slight motion blur on the bar,
      //    cool-gray walls + warm-tan floor color grade, photorealistic,
      //    no logos visible, 1:1 square aspect ratio."
      tint: '#f1f1f6',
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
                background: `linear-gradient(135deg, #fafafb 0%, ${step.tint} 100%)`,
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  color: T.ink4, fontFamily: T.font,
                  fontSize: T.size.caption, fontWeight: T.weight.body,
                  letterSpacing: '0.1px',
                }}>
                  [step {step.n} image]
                </div>
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
            Everything you need,
            <br />
            nothing you don&rsquo;t.
          </h2>
          <p style={{
            margin: `${T.s4}px auto 0`, maxWidth: 560,
            fontFamily: T.font,
            fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: T.ink3,
          }}>
            Six pillars, one calm interface. Each one earns its place.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: T.s4,
        }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: T.card,
                borderRadius: T.rLg,
                padding: T.s6,
                display: 'flex', flexDirection: 'column', gap: T.s3,
              }}
            >
              <div style={{
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
            Home, workouts, meals — same calm language across every screen.
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
            Coaches and parents,
            <br />
            in their words.
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: T.s4,
          marginBottom: T.s8,
        }}>
          {TESTIMONIAL_STATS.map((s) => (
            <div key={s.label} style={{
              background: T.card,
              borderRadius: T.rLg,
              padding: T.s5,
              display: 'flex', flexDirection: 'column', gap: T.s2,
            }}>
              <div style={{
                fontFamily: T.font,
                fontSize: T.size.caption, fontWeight: T.weight.body,
                color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.12em',
              }}>
                {s.label.split(',')[0]}
              </div>
              <div style={{
                fontFamily: T.font,
                fontSize: 44, fontWeight: T.weight.display,
                letterSpacing: '-0.025em', color: T.ink, lineHeight: 1,
              }}>
                {s.value}
              </div>
              <div style={{
                fontFamily: T.font,
                fontSize: T.size.caption, fontWeight: T.weight.body,
                color: T.ink3, lineHeight: 1.4,
              }}>
                {s.label}
              </div>
            </div>
          ))}
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
                fontFamily: T.font,
                fontSize: T.size.subtitle, fontWeight: T.weight.h1,
                color: T.ink,
              }}>
                {t.name}
                <span style={{ display: 'block', fontWeight: T.weight.body, color: T.ink3, fontSize: T.size.caption, marginTop: 2 }}>
                  {t.role}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
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
          Train smarter starting today.
        </h2>
        <p style={{
          margin: `${T.s5}px auto 0`, maxWidth: 520,
          fontFamily: T.font,
          fontSize: T.size.body, lineHeight: T.lh.body,
          fontWeight: T.weight.body, color: 'rgba(255,255,255,0.65)',
        }}>
          Free to start, no card required. Your AI coach is ready when you are.
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
        Koto Trainer is an AI coach, not a doctor or licensed professional.
        This is not medical advice. Always consult a physician before starting a new training program.
        <div style={{ marginTop: T.s3, color: T.ink3 }}>
          &copy; {new Date().getFullYear()} Koto, Inc.
        </div>
      </div>
    </footer>
  )
}
