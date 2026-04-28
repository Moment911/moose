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
  'Hockey', 'Lacrosse', 'CrossFit', 'MMA',
  'Weight Loss', 'Muscle Gain', 'General Fitness', 'Active Aging',
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
    title: 'Knows what you need.',
    desc: "Losing weight? Building muscle? Training for a sport? Recovering from an injury? Staying active at 65? It builds a program around YOUR reality -- not a one-size-fits-all template.",
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
  { value: '24/7', title: 'Always on.', label: 'Your AI coach never sleeps, never takes a day off, never cancels on you.', highlight: true },
  { value: '2 min', title: 'Instant plan.', label: 'From first conversation to a complete personalized program.' },
  { value: '15+', title: 'Every sport.', label: 'Dedicated playbooks, periodization, and position-specific training.' },
  { value: '$0', title: 'Free to start.', label: 'No credit card. No commitment. Just results.' },
]

const TESTIMONIALS = [
  { quote: "I play three sports and no one coach could program for all of them. This AI knows my soccer season, my track schedule, and my gym days and adjusts the plan week by week so I'm not overtrained.", name: 'Darius K., 16', role: 'High school multi-sport athlete', avatar: '/images/trainer/youth-baseball.jpg' },
  { quote: "Three kids, a full-time job, and twenty minutes for lunch. I told the AI my reality and it built workouts I could actually finish. Down twenty-two pounds in five months -- no trainer required.", name: 'Renee D., 43', role: 'Working parent', avatar: '/images/trainer/woman-running.jpg' },
  { quote: 'After I retired I started feeling old fast. This built me strength and walking workouts that match what my body can do today, not twenty years ago. I feel better at sixty-four than I did at fifty-four.', name: 'Hank P., 64', role: 'Retiree', avatar: '/images/trainer/senior-stretching.jpg' },
]

const FAQS = [
  {
    q: 'Do I need to be an athlete to use this?',
    a: "No. The AI builds plans for whoever you are, in whatever shape you're in. Youth athletes, college students, busy parents, traveling executives, retirees  —  same product, completely different plans. Tell it your reality and it programs for that.",
  },
  {
    q: 'How does it know what I need?',
    a: 'You have a short conversation and tell it about yourself -- your goals, your schedule, your body, your life. If you play a sport, it loads a sport-specific program. If you want to lose weight, it builds around that. If you just want to feel better and have more energy, it programs for that too. It adapts to you.',
  },
  {
    q: 'Is my health data safe?',
    a: 'Your data lives in your account, encrypted at rest. We don\'t sell it, we don\'t share it, and we never train public models on it. Anyone you invite to view your plan (a parent helping their kid stay on track, for example) sees only what you share with them.',
  },
  {
    q: 'What sports and goals are supported?',
    a: 'Any sport and any goal. Baseball, football, basketball, soccer, track, swimming, wrestling, volleyball, tennis, golf, hockey, lacrosse, CrossFit, MMA -- plus weight loss, muscle gain, general fitness, active aging, and anything else you tell it. It builds around what YOU need, not a fixed list.',
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

  useEffect(() => {
    document.title = 'Koto Trainer — Your AI Trainer, Nutritionist, and Coach. 24/7.'
  }, [])

  return (
    <div style={{
      fontFamily: T.font,
      WebkitFontSmoothing: 'antialiased',
      background: T.bg,
      color: T.ink,
      minHeight: '100vh',
    }}>
      <TopNav onSignIn={() => {}} onStart={() => {}} />

      <Hero onStart={() => {}} />

      <PhoneShowcase />

      <SportsStrip />

      <TryItDemo />

      <LivePlanBuilder />

      <FeaturesGrid />

      <HowItWorks />

      <LifestylePhotoStrip />

      <InsideTheAi />

      <SocialProof />

      <FounderStory />

      <IntegrationsStrip />

      <FaqList />

      <BottomCta onStart={() => {}} />

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
          Your AI trainer.
          <br />
          Your AI nutritionist.
          <br />
          Always on.
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
          Tell it who you are, what you want, and what your life actually looks like.
          It builds your workouts, plans your meals, tracks your progress, and
          checks in with you daily  —  24 hours a day, 7 days a week, 365 days a year.
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
        Built for every body
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
      n: '1', title: 'Tell it about you',
      body: 'Have a real conversation. Tell it what you do, what you want, and what your life looks like. It asks smart follow-ups and builds your profile in about two minutes  —  tap answers or type freely.',
      img: '/images/trainer/woman-yoga-laptop.jpg',
    },
    {
      n: '2', title: 'Get your complete program',
      body: 'Six custom sections built for you: baseline assessment, 90-day roadmap, periodized workout block, coaching playbook, meal plan with grocery list. All in under a minute.',
      img: '/images/trainer/woman-sitting.jpg',
    },
    {
      n: '3', title: 'Train daily with your AI',
      body: 'This is where it gets real. Log your workouts. Snap photos of meals. Check in daily. Your AI watches your trends, adjusts your plan, answers your questions anytime, and keeps you honest  —  365 days a year.',
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
  const PERSONAS = [
    {
      id: 'mom', tab: 'Busy Mom', name: 'Jaylen', age: 29, desc: 'Mom of 2, works full time. Runs kids to soccer and cheer. Wants to lose 15 lbs and feel like herself again.',
      sections: [
        { label: 'Baseline', color: '#dc2626', content: 'Jaylen is 5\'6" and 158 lbs. She wants to lose about 15 lbs. She has not trained consistently before, so the AI starts her easy -- about 1,680 calories a day with plenty of protein (126 grams, which is roughly a chicken breast at every meal). The big focus: keep it simple, keep it short, and make it fit her actual schedule.' },
        { label: '90-Day Roadmap', color: '#2563eb', content: 'Month 1: Just build the habit. Three 20-minute workouts a week at home with no equipment needed. Month 2: Turn it up slightly. Four times a week, 25 minutes, add some light dumbbells. Month 3: Now she is rolling. Thirty-minute sessions, lifting a bit heavier each week to keep the body changing.' },
        { label: 'Workout Block', color: '#7c3aed', content: 'Three days a week, all under 25 minutes. Day 1 works legs and core -- squats holding a weight, push-ups, a resistance band exercise, and a plank. Day 2 is back and shoulders. Day 3 is lunges, chest press, arm work, and carrying heavy things for grip strength. Simple moves she can do in her living room.' },
        { label: 'Playbook', color: '#059669', content: 'Only have 15 minutes before carpool? The AI gives her a mini workout: squats, push-ups, and a plank -- done. Too exhausted to exercise? Walk for 20 minutes instead. On Sunday, she cooks two proteins and two carbs in bulk -- that handles most of the week. Keep protein bars in the car for emergency snacks.' },
        { label: 'Meal Plan', color: '#d97706', content: 'Breakfast: yogurt with granola and berries -- about 380 calories. Lunch: a turkey wrap with an apple -- 520 calories. Afternoon snack: a protein bar -- 200 calories. Dinner: chicken stir-fry with rice -- 580 calories. That adds up to about 1,680 calories for the day with enough protein to keep her full and losing weight steadily.' },
        { label: 'Grocery List', color: '#0891b2', content: 'Everything she needs for the week: 3 lbs of chicken, 2 lbs of ground turkey, yogurt, eggs, rice, wraps, broccoli, peppers, spinach, apples, berries, bananas, protein bars, and almonds. Total comes to about $85 a week for the whole family.' },
      ],
    },
    {
      id: 'baseball', tab: 'HS Baseball', name: 'Marcus', age: 16, desc: 'Varsity pitcher, junior year. Throws 78 mph, wants to hit 85+ and get recruited to play college ball.',
      sections: [
        { label: 'Baseline', color: '#dc2626', content: 'Marcus is 5\'10" and 162 lbs. He wants to gain about 10 lbs of muscle and throw 5 to 7 mph harder. He has been training for 2 years. The AI sets him at 2,800 calories a day -- he needs to eat more to grow. 162 grams of protein. The big priorities: building the muscles that help him throw harder (hips, core, back side of his body) and keeping his arm healthy.' },
        { label: '90-Day Roadmap', color: '#2563eb', content: 'Month 1: Build the foundation. Fix how he moves, strengthen his shoulder blades, loosen his hips. Four days a week. Month 2: Start building muscle size. Focus on the twisting power that drives the ball. Ramp up his long-distance throwing program. Month 3: Get strong for showcases. Peak his strength numbers and test his velocity.' },
        { label: 'Workout Block', color: '#7c3aed', content: 'Three days in the gym. Day 1 is heavy pulling and jumping -- deadlifts, box jumps, hamstring work, band exercises for shoulder health. Day 2 is upper body -- bench press, rows, a twisting exercise with a barbell, and rear shoulder work. Day 3 is squats, single-leg work, medicine ball throws for power, and core.' },
        { label: 'Playbook', color: '#059669', content: 'During the season: drop to 3 gym days and never do heavy leg work the day before he pitches. Every single day: shoulder band exercises, stretching, and push-ups for shoulder blade health. Throw long toss twice a week, up to about 150 feet. If his arm hurts at all -- stop throwing and see a doctor. No exceptions.' },
        { label: 'Meal Plan', color: '#d97706', content: 'Breakfast: 3 eggs, toast, and a banana -- 520 calories. Lunch: chicken with rice and broccoli -- 680 calories. Before practice: a peanut butter sandwich -- 350 calories. Dinner: steak, sweet potato, and a salad -- 750 calories. Before bed: a protein shake with milk -- 500 calories. That is nearly 2,800 calories to fuel his growth.' },
        { label: 'Grocery List', color: '#0891b2', content: '4 lbs of chicken, 2 lbs of steak, 2 dozen eggs, a gallon of whole milk, protein powder, 5 lbs of rice, sweet potatoes, broccoli, bananas, bread, peanut butter, and oats. About $110 a week -- he is eating like he wants to grow, because he does.' },
      ],
    },
    {
      id: 'exec', tab: 'Exec on the Go', name: 'David', age: 44, desc: 'VP of sales. Travels 3 days a week, hotel gyms only. Wants to lose the gut and have energy for 12-hour days.',
      sections: [
        { label: 'Baseline', color: '#dc2626', content: 'David is 5\'11" and 215 lbs. He wants to lose about 25 lbs while keeping the muscle he has. He has worked out on and off for 3 years but can never stay consistent because of travel. The AI puts him at 1,900 calories a day with 170 grams of protein. The focus: workouts that work in any hotel gym, a meal strategy for airports and client dinners, and better sleep.' },
        { label: '90-Day Roadmap', color: '#2563eb', content: 'Month 1: Just get consistent again. Three workouts a week, all designed to work with whatever equipment the hotel has. Fix the sleep schedule. Month 2: Push the fat loss. Four workouts a week, start tracking calories, walk 8,000 steps a day. Month 3: Lock in the habits. Keep training, check body composition, build a routine that survives any travel schedule.' },
        { label: 'Workout Block', color: '#7c3aed', content: 'Hotel days: squats with dumbbells, push-ups, dumbbell rows, planks, and a combo curl-and-press -- all doable in a tiny gym. Home days: barbell squats, bench press, deadlift, and pull-ups for heavier work. Every session is 35 to 40 minutes max because his time is money.' },
        { label: 'Playbook', color: '#059669', content: 'Travel rules from the AI: always pack resistance bands. Ask for a room near the gym. Schedule the workout before your first meeting -- not after, because after never happens. At the airport: grilled chicken salad, skip the bread basket. Client dinner: order protein and vegetables, limit yourself to one drink. Red-eye flight night: skip the gym, walk 30 minutes instead.' },
        { label: 'Meal Plan', color: '#d97706', content: 'Breakfast: egg white omelette with avocado toast -- 420 calories. Lunch: grilled chicken salad with light dressing -- 480 calories. Afternoon: protein shake -- 200 calories. Dinner: salmon with asparagus and rice -- 600 calories. Evening: Greek yogurt -- 200 calories. That totals about 1,900 calories with enough protein to hold onto muscle while the fat comes off.' },
        { label: 'Grocery List', color: '#0891b2', content: '2 lbs of salmon, 3 lbs of chicken breast, egg whites, avocados, salad greens, asparagus, rice, Greek yogurt, protein powder, and almonds. For travel: a bag of beef jerky, protein bars, and mixed nuts that live in his laptop bag. About $95 a week.' },
      ],
    },
    {
      id: 'soccer', tab: 'Club Soccer', name: 'Sofia', age: 14, desc: 'Travel soccer midfielder. Fast but runs out of gas in the second half. Wants to last the full 90 and not get pushed around.',
      sections: [
        { label: 'Baseline', color: '#dc2626', content: 'Sofia is 5\'3" and 108 lbs. She is fast but fades hard after halftime and gets outmuscled by bigger players. She wants to build endurance and add about 5 lbs of lean muscle without slowing down. The AI puts her at 2,100 calories a day with 108 grams of protein. The focus: building her engine so she can run all game, and strengthening her legs so she does not get pushed off the ball.' },
        { label: '90-Day Roadmap', color: '#2563eb', content: 'Month 1: Build the engine. Bodyweight circuits at home plus two steady-pace runs a week. Month 2: Add power and speed. Jumping exercises, short sprint intervals, and light weight training. Month 3: Game ready. Agility drills that mimic real game movements and conditioning that simulates playing a full match.' },
        { label: 'Workout Block', color: '#7c3aed', content: 'Four days a week. Day 1: squats, side lunges, single-leg balance exercises, and a plank. Day 2: a 20-minute steady run plus a core circuit. Day 3: box jumps, push-ups, band walks to strengthen her hips, and a side plank variation. Day 4: sprint intervals -- 8 rounds of 30 seconds hard, 30 seconds rest.' },
        { label: 'Playbook', color: '#059669', content: 'Before a game: eat a big carb-heavy meal 3 hours before kickoff. At halftime: a banana and water, not a sugary sports drink. Why does she fade in the second half? It is not mental toughness -- it is her aerobic engine. Train the engine and the legs will follow. If she has two practices plus a game that week, skip the gym entirely and just stretch.' },
        { label: 'Meal Plan', color: '#d97706', content: 'Breakfast: oatmeal with a banana and peanut butter -- 450 calories. Lunch: turkey sandwich with fruit and a yogurt -- 560 calories. Before practice: a granola bar and an apple -- 250 calories. Dinner: pasta with chicken and marinara sauce plus a side salad -- 640 calories. Night snack: string cheese and crackers -- 200 calories. About 2,100 calories total.' },
        { label: 'Grocery List', color: '#0891b2', content: '2 lbs of chicken, turkey deli meat, whole wheat bread, pasta, marinara sauce, oats, bananas, apples, peanut butter, Greek yogurt, string cheese, granola bars, and mixed fruit. About $70 a week -- simple food a 14-year-old will actually eat.' },
      ],
    },
    {
      id: 'retiree', tab: 'Active Retiree', name: 'Frank', age: 62, desc: 'Retired teacher. Knees bother him. Wants to stay active, stay independent, and walk 5 miles without pain.',
      sections: [
        { label: 'Baseline', color: '#dc2626', content: 'Frank is 5\'9" and 195 lbs. He wants to lose about 20 lbs, move without pain, and protect his joints. He has not exercised regularly in years. The AI puts him at 1,750 calories a day with 130 grams of protein -- enough to lose weight slowly while keeping his muscles. The focus: exercises that are easy on the joints, improving his balance so he stays steady on his feet, and building up his walking distance gradually.' },
        { label: '90-Day Roadmap', color: '#2563eb', content: 'Month 1: Just move every day. Walk for 15 minutes, do some exercises using a chair for support, and stretch. Month 2: Build on it. Walk 30 minutes, add resistance bands and light dumbbells. Month 3: Thrive. Walking 45 to 60 minutes, full body strength training 3 times a week, and a daily flexibility routine.' },
        { label: 'Workout Block', color: '#7c3aed', content: 'Three days a week, all gentle on the joints. Day 1: wall sits, squats using a chair for support, rowing with a band, and calf raises. Day 2: a 25-minute walk plus 10 minutes of stretching. Day 3: step-ups onto a low step, band chest press, a balance exercise on hands and knees, and a side plank. Everything is low-impact -- no jumping, no jarring.' },
        { label: 'Playbook', color: '#059669', content: 'If the knees hurt: switch to swimming or a stationary bike instead of walking. Never push through joint pain -- pain is your body giving you information, not a sign of weakness. Morning stiffness: do 5 minutes of gentle stretching before getting out of bed. Track daily steps and add 500 more per week until reaching 8,000 a day.' },
        { label: 'Meal Plan', color: '#d97706', content: 'Breakfast: 2 eggs with whole wheat toast and fruit -- 380 calories. Lunch: tuna salad with crackers and an apple -- 480 calories. Afternoon: cottage cheese with berries -- 200 calories. Dinner: baked chicken with roasted vegetables and quinoa -- 690 calories. Simple, filling meals with plenty of protein to keep his muscles as he loses weight.' },
        { label: 'Grocery List', color: '#0891b2', content: '2 lbs of chicken thighs, canned tuna, a dozen eggs, cottage cheese, whole wheat bread, quinoa, frozen mixed vegetables, broccoli, sweet potatoes, berries, apples, and olive oil. About $65 a week -- straightforward ingredients he already knows how to cook.' },
      ],
    },
    {
      id: 'college', tab: 'College Student', name: 'Tyler', age: 20, desc: 'Engineering major, tight budget, dorm room and campus gym. Wants to put on 15 lbs of muscle and actually look like he lifts.',
      sections: [
        { label: 'Baseline', color: '#dc2626', content: 'Tyler is 5\'8" and 145 lbs. He is skinny and wants to gain 15 lbs of muscle. He has been going to the gym for about 6 months but is not sure he is doing the right exercises. The AI puts him at 2,600 calories a day -- he needs to eat a LOT more than he thinks. 145 grams of protein. The focus: learning the big lifts that build the most muscle, eating enough food on a college budget, and adding a little more weight to the bar every single week.' },
        { label: '90-Day Roadmap', color: '#2563eb', content: 'Month 1: Learn the basics. Three full-body workouts a week, focusing on doing the exercises correctly. Month 2: Split it up. Four days a week, upper body one day and lower body the next, adding weight to the bar every session. Month 3: Push hard. Four days a week with heavier weights, test how strong he has gotten, measure the gains.' },
        { label: 'Workout Block', color: '#7c3aed', content: 'Upper body day: bench press, overhead press, barbell rows, dips, and a band exercise for his rear shoulders. Lower body day: squats, a hip hinge exercise for his hamstrings, leg press, calf raises, and ab wheel rollouts. He does each day twice a week and tries to lift a little heavier each time.' },
        { label: 'Playbook', color: '#059669', content: 'Dining hall strategy: get double protein at every meal -- two chicken breasts, not one. Always grab a glass of milk. Dorm room snacks: peanut butter, oats, bananas, and protein powder -- cheap and calorie-dense. Skip the alcohol -- it is empty calories that destroy your recovery. Sleep 8 hours a night -- muscles grow while you sleep, not while you lift.' },
        { label: 'Meal Plan', color: '#d97706', content: 'Breakfast at the dining hall: oatmeal, eggs, and a glass of milk -- 650 calories. Lunch: chicken, rice, veggies, and another milk -- 720 calories. Afternoon snack in the dorm: a peanut butter banana shake -- 450 calories. Dinner: beef, pasta, bread, and a salad -- 780 calories. That is about 2,600 calories -- enough to actually grow.' },
        { label: 'Grocery List', color: '#0891b2', content: 'Most of his meals come from the dining hall, so his grocery list is small: a tub of protein powder, peanut butter, oats, bananas, a gallon of whole milk, a loaf of bread, a dozen eggs, mixed nuts, and Greek yogurt. About $35 a week on top of his meal plan.' },
      ],
    },
  ]

  const [activePersona, setActivePersona] = useState(0)
  const [expanded, setExpanded] = useState('baseline')
  const persona = PERSONAS[activePersona]

  return (
    <section style={{ padding: `${T.s8}px 24px`, background: T.bg }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: T.s7 }}>
          <span style={{
            display: 'inline-block', padding: '4px 10px', borderRadius: T.rPill,
            background: T.card, fontFamily: T.font, fontSize: T.size.caption,
            fontWeight: T.weight.button, color: T.ink2, letterSpacing: '0.1px', marginBottom: T.s4,
          }}>
            Real examples
          </span>
          <h2 style={{
            margin: 0, fontFamily: T.font,
            fontSize: 'clamp(32px, 5.5vw, 48px)', lineHeight: 1.08,
            letterSpacing: '-0.025em', fontWeight: T.weight.display, color: T.ink,
          }}>
            Every person gets
            <br />
            a different plan.
          </h2>
          <p style={{
            margin: `${T.s4}px auto 0`, maxWidth: 580,
            fontFamily: T.font, fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: T.ink3,
          }}>
            A busy mom, a high school pitcher, and a retired teacher walk into the
            same app  --  and get completely different programs. Tap any persona
            below to see the full plan the AI built for them.
          </p>
        </div>

        {/* Persona tabs */}
        <div style={{
          fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.button,
          color: T.ink3, textAlign: 'center', marginBottom: T.s3,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Tap a persona to see their plan
        </div>
        <div className="koto-persona-tabs" style={{
          display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          paddingBottom: T.s3, marginBottom: T.s5, justifyContent: 'center',
        }}>
          <style>{'.koto-persona-tabs::-webkit-scrollbar{display:none}'}</style>
          {PERSONAS.map((p, i) => {
            const active = i === activePersona
            return (
              <button key={p.id} type="button"
                onClick={() => { setActivePersona(i); setExpanded(null) }}
                style={{
                  flexShrink: 0, padding: '10px 18px',
                  background: active ? T.ink : T.card,
                  color: active ? '#fff' : T.ink2,
                  border: 'none', borderRadius: T.rPill,
                  fontFamily: T.font, fontSize: T.size.subtitle, fontWeight: T.weight.button,
                  cursor: 'pointer', transition: 'all .15s',
                  whiteSpace: 'nowrap',
                }}>
                {p.tab}
              </button>
            )
          })}
        </div>

        {/* Persona card */}
        <div style={{
          background: '#0a0a0a', borderRadius: T.rXl, padding: T.s6,
          boxShadow: '0 30px 80px rgba(0,0,0,0.18)',
        }}>
          {/* Header */}
          <div style={{ marginBottom: T.s5 }}>
            <div style={{ fontFamily: T.font, fontSize: T.size.h1, fontWeight: T.weight.display, color: '#fff', lineHeight: 1.15 }}>
              {persona.name}'s Plan
            </div>
            <div style={{ fontFamily: T.font, fontSize: T.size.subtitle, color: 'rgba(255,255,255,0.5)', marginTop: T.s1, lineHeight: 1.4 }}>
              {persona.age} &middot; {persona.desc}
            </div>
          </div>

          {/* Sections */}
          <div style={{ display: 'grid', gap: 6 }}>
            {persona.sections.map((s, i) => {
              const isExp = expanded === s.label
              return (
                <div key={s.label}>
                  <button type="button"
                    onClick={() => setExpanded(isExp ? null : s.label)}
                    style={{
                      width: '100%', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: T.s3,
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isExp ? s.color + '40' : 'rgba(255,255,255,0.06)'}`,
                      borderLeft: `3px solid ${s.color}`,
                      borderRadius: isExp ? `${T.rMd}px ${T.rMd}px 0 0` : T.rMd,
                      cursor: 'pointer',
                    }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: T.rPill, flexShrink: 0,
                      background: s.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={14} color="#fff" strokeWidth={3} />
                    </div>
                    <span style={{
                      flex: 1, fontFamily: T.font, fontSize: T.size.subtitle, lineHeight: 1.3,
                      fontWeight: T.weight.body, color: '#fff',
                    }}>
                      {s.label}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                      {isExp ? '\u25B2' : '\u25BC'}
                    </span>
                  </button>
                  {isExp && (
                    <div style={{
                      padding: '14px 16px', background: 'rgba(255,255,255,0.03)',
                      borderLeft: `3px solid ${s.color}`,
                      border: `1px solid ${s.color}30`, borderTop: 'none',
                      borderRadius: `0 0 ${T.rMd}px ${T.rMd}px`,
                      fontFamily: T.font, fontSize: T.size.subtitle, lineHeight: 1.65,
                      color: 'rgba(255,255,255,0.7)', fontWeight: T.weight.body,
                    }}>
                      {s.content}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <p style={{
          margin: `${T.s5}px auto 0`, textAlign: 'center', maxWidth: 520,
          fontFamily: T.font, fontSize: T.size.subtitle, lineHeight: 1.5,
          fontWeight: T.weight.body, color: T.ink3,
        }}>
          Your plan would be completely different  --  built around who you are,
          what you do, and where you want to go.
        </p>
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
            It never sleeps.
            <br />
            It never judges.
          </h2>
          <p style={{
            margin: `${T.s4}px auto 0`, maxWidth: 620,
            fontFamily: T.font,
            fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: T.ink3,
          }}>
            Talk to it whenever you want -- morning, midnight, between meetings, after the kids go to bed. It is always ready, always current on your data, and always in your corner.
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
    { Icon: Brain,          title: 'AI Biomechanics Expert',    body: 'Trained on movement science, form analysis, and injury-risk patterns. Spots mechanical issues and corrects them before they become problems.' },
    { Icon: ChefHat,        title: 'AI Nutrition Expert',       body: 'Trained on sport-science nutrition research. Calculates your macros, builds meals around food you actually like, and adjusts as your body changes.' },
    { Icon: Dumbbell,       title: 'AI Strength & Conditioning Expert', body: 'Trained on periodization science and programming methodology. Designs your training blocks, manages volume, and peaks you for your season.' },
    { Icon: Activity,       title: 'AI Exercise Physiology Expert', body: 'Trained on recovery science, sleep research, and fatigue management. Knows when to push harder and when to back off based on your data.' },
    { Icon: GraduationCap,  title: 'AI Sports Psychology Expert', body: 'Trained on performance psychology and motivation research. Handles the mental side that most programs completely ignore.' },
    { Icon: Target,         title: 'AI Real-World Experience Model', body: 'Not just textbook knowledge. This model is trained on decades of real-world coaching, competition, and results across every sport and goal. It knows what actually works because it has seen what works.' },
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
            Six AI experts.
            <br />
            One conversation.
          </h2>
          <p style={{
            margin: `${T.s4}px auto 0`, maxWidth: 640,
            fontFamily: T.font,
            fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: T.ink3,
          }}>
            Most fitness AI is one generic model pretending to know everything.
            Koto runs six specialized AI expert models  --  each trained on
            PhD-level research in its domain  --  plus a real-world experience
            model that adapts to your sport, your goal, or your lifestyle.
            When you ask a question, the right expert answers.
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
    <section style={{ padding: `${T.s7}px 24px ${T.s8}px`, background: T.bg }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: T.s6 }}>
          <h2 style={{
            margin: 0, fontFamily: T.font,
            fontSize: 'clamp(32px, 5.5vw, 48px)', lineHeight: 1.08,
            letterSpacing: '-0.025em', fontWeight: T.weight.display, color: T.ink,
          }}>
            Your entire training life in your pocket.
          </h2>
          <p style={{
            margin: `${T.s4}px auto 0`, maxWidth: 520,
            fontFamily: T.font, fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: T.ink3,
          }}>
            Workouts, meals, progress, and your AI coach  --  all in one place. Swipe through to see what a day looks like.
          </p>
        </div>

        <PhoneCarousel />
      </div>
    </section>
  )
}

function PhoneCarousel() {
  const SCREENS = [
    { key: 'home', label: 'Home', Component: PhoneScreenHome },
    { key: 'coach', label: 'Coach', Component: PhoneScreenCoach },
    { key: 'workout', label: 'Workout', Component: PhoneScreenWorkout },
    { key: 'meals', label: 'Meals', Component: PhoneScreenMeals },
  ]
  const [active, setActive] = useState(0)
  const [fading, setFading] = useState(false)

  // Auto-cycle every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setActive((prev) => (prev + 1) % SCREENS.length)
        setFading(false)
      }, 300)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const ActiveScreen = SCREENS[active].Component

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: T.s5 }}>
      {/* Phone */}
      <div style={{
        width: '100%', maxWidth: 320,
        aspectRatio: '9 / 19.5',
        borderRadius: 44,
        padding: 10,
        background: '#0a0a0a',
        boxShadow: '0 30px 60px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.08)',
        position: 'relative',
        margin: '0 auto',
      }}>
        <style>{`
          @keyframes koto-screen-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        `}</style>
        <div style={{
          width: '100%', height: '100%',
          background: T.bg,
          borderRadius: 34,
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Notch */}
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            width: 100, height: 24, borderRadius: T.rPill,
            background: '#0a0a0a', zIndex: 2,
          }} />
          {/* Screen content */}
          <div
            key={active}
            style={{
              height: '100%', overflow: 'hidden',
              opacity: fading ? 0 : 1,
              transform: fading ? 'translateX(-20px)' : 'translateX(0)',
              transition: 'opacity .3s ease, transform .3s ease',
              animation: fading ? 'none' : 'koto-screen-in .4s ease',
            }}
          >
            <ActiveScreen />
          </div>
        </div>
      </div>

      {/* Screen selector dots + labels */}
      <div style={{ display: 'flex', gap: T.s4, justifyContent: 'center' }}>
        {SCREENS.map((s, i) => {
          const isActive = i === active
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => { setFading(true); setTimeout(() => { setActive(i); setFading(false) }, 300) }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '8px 16px',
              }}
            >
              <div style={{
                width: isActive ? 28 : 8, height: 8, borderRadius: T.rPill,
                background: isActive ? T.ink : T.divider,
                transition: 'all .3s ease',
              }} />
              <span style={{
                fontFamily: T.font, fontSize: 12, fontWeight: T.weight.button,
                color: isActive ? T.ink : T.ink3,
                transition: 'color .3s ease',
              }}>
                {s.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PhoneFrame({ children, translateY = 0, scrollAnim = false }) {
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
      {scrollAnim && (
        <style>{`
          @keyframes koto-phone-scroll {
            0%, 15% { transform: translateY(0); }
            35%, 55% { transform: translateY(-15%); }
            75%, 90% { transform: translateY(-30%); }
            100% { transform: translateY(0); }
          }
        `}</style>
      )}
      <div style={{
        width: '100%', height: '100%',
        background: T.bg,
        borderRadius: 32,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          width: 92, height: 22, borderRadius: T.rPill,
          background: '#0a0a0a', zIndex: 2,
        }} />
        <div style={{
          height: '100%',
          ...(scrollAnim ? { animation: 'koto-phone-scroll 12s ease-in-out infinite' } : {}),
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function PhoneScreenHome() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const today = 4
  const streak = [true, true, false, true, true, false, false]
  return (
    <div style={{ padding: '44px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: '160%' }}>
      <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: T.weight.button, color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        FRI, OCT 24
      </div>
      <div style={{ fontFamily: T.font, fontSize: 24, fontWeight: T.weight.display, letterSpacing: '-0.02em', color: T.ink, lineHeight: 1.1 }}>
        Good morning, Jaylen
      </div>

      {/* Week streak */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
        {days.map((d, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 999,
              background: streak[i] ? T.ink : T.card,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: streak[i] ? '#fff' : T.ink3,
              border: i === today ? `2px solid ${T.accent}` : 'none',
            }}>
              {streak[i] ? '\u2713' : d}
            </div>
            <span style={{ fontSize: 9, color: T.ink3, fontFamily: T.font }}>{20 + i}</span>
          </div>
        ))}
      </div>

      {/* Calorie + macros */}
      <div style={{ background: T.card, borderRadius: T.rSm, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: T.font, fontSize: 10, fontWeight: T.weight.button, color: T.ink3, textTransform: 'uppercase' }}>Today</span>
          <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: T.weight.button, color: T.accent }}>1,820 / 2,160 kcal</span>
        </div>
        <div style={{ height: 5, background: T.divider, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: '84%', height: '100%', background: T.accent, borderRadius: 999 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {[{ l: 'P', v: '142g', c: T.accent }, { l: 'C', v: '210g', c: T.accentBlue }, { l: 'F', v: '52g', c: T.accentRed }].map((m) => (
            <span key={m.l} style={{ fontFamily: T.font, fontSize: 11, fontWeight: T.weight.button, color: m.c }}>{m.l} {m.v}</span>
          ))}
        </div>
      </div>

      {/* Today's workout */}
      <div style={{ background: T.ink, borderRadius: T.rSm, padding: 12, color: '#fff' }}>
        <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: T.weight.button, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          TODAY&rsquo;S WORKOUT
        </div>
        <div style={{ fontFamily: T.font, fontSize: 14, fontWeight: T.weight.display, marginTop: 3 }}>
          Lower Body Power
        </div>
        <div style={{ fontFamily: T.font, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
          5 exercises &middot; 45 min &middot; Block 2
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{ flex: 1, height: 3, borderRadius: 999, background: n <= 2 ? T.accent : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>
      </div>

      {/* Chat with coach CTA */}
      <div style={{ background: T.card, borderRadius: T.rSm, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 999, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>K</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.font, fontSize: 12, fontWeight: T.weight.h1, color: T.ink }}>Chat with your coach</div>
          <div style={{ fontFamily: T.font, fontSize: 10, color: T.ink3, marginTop: 1 }}>Ask anything &middot; Available 24/7</div>
        </div>
        <div style={{ width: 8, height: 8, borderRadius: 999, background: '#34c759', flexShrink: 0 }} />
      </div>

      {/* Progress snapshot */}
      <div style={{ background: T.card, borderRadius: T.rSm, padding: 12 }}>
        <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: T.weight.button, color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          THIS WEEK
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 18, fontWeight: T.weight.display, color: T.ink }}>4/5</div>
            <div style={{ fontFamily: T.font, fontSize: 9, color: T.ink3 }}>Workouts logged</div>
          </div>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 18, fontWeight: T.weight.display, color: T.ink }}>92%</div>
            <div style={{ fontFamily: T.font, fontSize: 9, color: T.ink3 }}>Calorie adherence</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhoneScreenCoach() {
  return (
    <div style={{ padding: '44px 0 0', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '130%' }}>
      {/* Header */}
      <div style={{ padding: '0 16px 10px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>K</div>
        <div>
          <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: T.weight.h1, color: T.ink }}>AI Coach</div>
          <div style={{ fontFamily: T.font, fontSize: 9, color: T.ink3 }}>Online now</div>
        </div>
        <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: 999, background: '#34c759' }} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 8, background: T.card }}>
        {/* Coach message */}
        <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: '12px 12px 12px 4px', background: T.bg, border: `1px solid ${T.border}`, fontFamily: T.font, fontSize: 11, lineHeight: 1.5, color: T.ink }}>
          Good morning Jaylen! Yesterday&rsquo;s lower body session looked solid  --  you hit all 5 sets on the deadlift. How&rsquo;s your body feeling today?
        </div>

        {/* User message */}
        <div style={{ maxWidth: '80%', padding: '8px 12px', borderRadius: '12px 12px 4px 12px', background: T.ink, fontFamily: T.font, fontSize: 11, lineHeight: 1.5, color: '#fff', alignSelf: 'flex-end' }}>
          Legs are a little sore but good. What should I eat before practice?
        </div>

        {/* Coach response */}
        <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: '12px 12px 12px 4px', background: T.bg, border: `1px solid ${T.border}`, fontFamily: T.font, fontSize: 11, lineHeight: 1.5, color: T.ink }}>
          For a 4pm practice, eat 2-3 hours before: chicken + rice + veggies. Then a banana 30 min before. Post-practice: protein shake within 30 min. Your body needs fuel, not fasting.
        </div>

        {/* Quick prompts */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {['Log my weight', 'Adjust workout', 'What should I eat?'].map((q) => (
            <span key={q} style={{
              padding: '5px 10px', background: T.bg, border: `1px solid ${T.border}`,
              borderRadius: 16, fontFamily: T.font, fontSize: 9, color: T.ink2,
            }}>{q}</span>
          ))}
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 6, alignItems: 'center', background: T.bg }}>
        <div style={{ flex: 1, padding: '7px 10px', background: T.card, borderRadius: 8, fontFamily: T.font, fontSize: 10, color: T.ink3 }}>
          Ask your coach...
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowRight size={12} color="#fff" />
        </div>
      </div>
    </div>
  )
}

function PhoneScreenWorkout() {
  const sets = [
    { name: 'Trap Bar Deadlift', s: '4x5 @ 225 lbs', cue: 'Drive through heels, chest up', done: true },
    { name: 'Box Jump', s: '4x3 @ 24"', cue: 'Land soft, reset each rep', done: true },
    { name: 'RDL', s: '3x8 @ 155 lbs', cue: 'Hinge at hips, bar stays close', done: false, current: true },
    { name: 'Bulgarian Split Squat', s: '3x10 each leg', cue: 'Front knee tracks over toe', done: false },
    { name: 'Cossack Squat', s: '3x8 each side', cue: 'Stay controlled, full depth', done: false },
  ]
  return (
    <div style={{
      padding: '44px 16px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      minHeight: '160%',
    }}>
      <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: T.weight.button, color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        WEEK 2 &middot; DAY 3
      </div>
      <div style={{
        fontFamily: T.font, fontSize: 22, fontWeight: T.weight.display,
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
            background: set.current ? T.bg : T.card, borderRadius: T.rSm,
            padding: '10px 12px',
            display: 'flex', alignItems: 'flex-start', gap: 10,
            border: set.current ? `1.5px solid ${T.accent}` : 'none',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 999, flexShrink: 0, marginTop: 1,
              background: set.done ? T.ink : T.cardElev,
              color: set.done ? '#fff' : T.ink3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.font, fontSize: 9, fontWeight: T.weight.display,
              border: set.done ? 'none' : `1px solid ${T.border}`,
            }}>
              {set.done ? '\u2713' : i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.font, fontSize: 12, fontWeight: T.weight.h1, color: T.ink, lineHeight: 1.2 }}>
                {set.name}
              </div>
              <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: T.weight.button, color: T.ink3, marginTop: 2 }}>
                {set.s}
              </div>
              <div style={{ fontFamily: T.font, fontSize: 9, fontStyle: 'italic', color: T.ink4, marginTop: 2 }}>
                {set.cue}
              </div>
              {set.current && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <div style={{ padding: '4px 8px', background: T.card, borderRadius: 6, fontFamily: T.font, fontSize: 10, color: T.ink3, textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: T.weight.display, color: T.ink }}>155</div>
                    lbs
                  </div>
                  <div style={{ fontSize: 12, color: T.ink3, alignSelf: 'center' }}>&times;</div>
                  <div style={{ padding: '4px 8px', background: T.card, borderRadius: 6, fontFamily: T.font, fontSize: 10, color: T.ink3, textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: T.weight.display, color: T.ink }}>8</div>
                    reps
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{
          background: T.ink, color: '#fff',
          borderRadius: T.rPill,
          padding: '10px 16px',
          fontFamily: T.font, fontSize: 12, fontWeight: T.weight.button,
          textAlign: 'center', letterSpacing: '0.1px',
        }}>
          Log set 1 of 3
        </div>
      </div>
    </div>
  )
}

function PhoneScreenMeals() {
  const meals = [
    { tag: 'Breakfast', name: 'Oats, banana, peanut butter', kcal: 520, p: '24g', logged: true },
    { tag: 'Lunch', name: 'Chicken breast, jasmine rice, broccoli', kcal: 680, p: '48g', logged: true },
    { tag: 'Snack', name: 'Greek yogurt + mixed berries + honey', kcal: 240, p: '18g', logged: false },
    { tag: 'Dinner', name: 'Grilled salmon, sweet potato, side salad', kcal: 720, p: '52g', logged: false },
  ]
  return (
    <div style={{
      padding: '44px 16px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      minHeight: '160%',
    }}>
      <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: T.weight.button, color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        MEAL PLAN
      </div>
      <div style={{
        fontFamily: T.font, fontSize: 22, fontWeight: T.weight.display,
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
            borderLeft: m.logged ? `3px solid ${T.accent}` : '3px solid transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 999, flexShrink: 0,
                background: m.logged ? T.ink : T.card,
                border: m.logged ? 'none' : `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: m.logged ? '#fff' : T.ink3,
              }}>
                {m.logged ? '\u2713' : ''}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: T.weight.button, color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {m.tag}
                </div>
                <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: T.weight.h1, color: T.ink, lineHeight: 1.3, marginTop: 1 }}>
                  {m.name}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: T.weight.display, color: T.ink }}>{m.kcal}</div>
                <div style={{ fontFamily: T.font, fontSize: 9, color: T.accent }}>{m.p} protein</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Snap photo CTA */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <div style={{
          flex: 1, background: T.ink, color: '#fff', borderRadius: T.rPill,
          padding: '9px 14px', fontFamily: T.font, fontSize: 11, fontWeight: T.weight.button,
          textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          Snap a photo to log
        </div>
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

        {/* Hero stat: 24/7 */}
        <div style={{
          background: T.ink, borderRadius: T.rXl,
          padding: `${T.s8}px ${T.s6}px`,
          marginBottom: T.s8, textAlign: 'center',
        }}>
          <div style={{
            fontFamily: T.font,
            fontSize: 'clamp(80px, 15vw, 120px)', fontWeight: T.weight.display,
            letterSpacing: '-0.04em', color: '#fff', lineHeight: 1,
            marginBottom: T.s3,
          }}>
            24/7
          </div>
          <div style={{
            fontFamily: T.font,
            fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: T.weight.display,
            color: '#fff', lineHeight: 1.2, marginBottom: T.s4,
          }}>
            Your AI coach never sleeps.
          </div>
          <p style={{
            margin: `0 auto ${T.s7}px`, maxWidth: 480,
            fontFamily: T.font, fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: 'rgba(255,255,255,0.5)',
          }}>
            6am before the gym. 11pm after the kids are in bed. Halftime of a
            game. It is always on, always current on your data, and always
            ready to help. No appointments. No waitlists. No cancellations.
          </p>

          {/* Secondary stats */}
          <div className="koto-stats-row" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: T.s4, borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: T.s6,
          }}>
            <style>{`@media(max-width:640px){.koto-stats-row{grid-template-columns:1fr!important;}}`}</style>
            {[
              { val: 'Minutes', title: 'From conversation to complete plan', desc: 'Tell it about you. It builds your entire program while you watch.' },
              { val: 'Any', title: 'Sport, goal, or lifestyle', desc: 'Athletes, parents, students, executives, retirees. It builds for whoever you are.' },
              { val: '$0', title: 'Free to start, no card required', desc: 'Your first plan, your first 14 days, your first real results. On us.' },
            ].map((s) => (
              <div key={s.val} style={{ textAlign: 'center', padding: `0 ${T.s3}px` }}>
                <div style={{
                  fontFamily: T.font, fontSize: 36, fontWeight: T.weight.display,
                  letterSpacing: '-0.03em', color: '#fff', lineHeight: 1, marginBottom: T.s2,
                }}>
                  {s.val}
                </div>
                <div style={{
                  fontFamily: T.font, fontSize: T.size.subtitle, fontWeight: T.weight.h1,
                  color: 'rgba(255,255,255,0.85)', lineHeight: 1.3, marginBottom: T.s1,
                }}>
                  {s.title}
                </div>
                <div style={{
                  fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.body,
                  color: 'rgba(255,255,255,0.4)', lineHeight: 1.4,
                }}>
                  {s.desc}
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

function IntegrationsStrip() {
  const integrations = [
    { name: 'Apple Watch', icon: '\u2328' },
    { name: 'Whoop', icon: '\u26A1' },
    { name: 'Oura Ring', icon: '\u25CB' },
    { name: 'Garmin', icon: '\u25B2' },
    { name: 'Google Fit', icon: '\u2B22' },
  ]
  return (
    <section style={{ padding: `${T.s7}px 24px`, background: T.card }}>
      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.button,
          color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: T.s5,
        }}>
          Connects with the tools you already wear
        </div>
        <div style={{
          display: 'flex', justifyContent: 'center', gap: T.s6, flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {integrations.map((ig) => (
            <div key={ig.name} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: T.s2,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: T.rMd,
                background: T.bg, border: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: T.font, fontSize: 14, fontWeight: T.weight.display, color: T.ink,
                boxShadow: T.shadowFloater,
              }}>
                {ig.name.split(' ').map(w => w[0]).join('')}
              </div>
              <span style={{
                fontFamily: T.font, fontSize: T.size.caption, fontWeight: T.weight.body, color: T.ink2,
              }}>
                {ig.name}
              </span>
            </div>
          ))}
        </div>
        <p style={{
          margin: `${T.s5}px auto 0`, maxWidth: 500,
          fontFamily: T.font, fontSize: T.size.subtitle, lineHeight: T.lh.body,
          fontWeight: T.weight.body, color: T.ink3,
        }}>
          Your sleep, heart rate, recovery score, and activity data flow
          straight into your AI coach -- so your plan adjusts based on
          what your body is actually doing, not just what you told it.
        </p>
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
          Six AI experts. Your sport, your goal, your life. All in your pocket, 24/7.
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
            fontSize: 'clamp(32px, 5.5vw, 48px)', lineHeight: 1.08,
            letterSpacing: '-0.025em', fontWeight: T.weight.display, color: T.ink,
          }}>
            Have a conversation
            <br />
            with your AI. Right now.
          </h2>
          <p style={{
            margin: `${T.s3}px auto 0`, maxWidth: 500,
            fontFamily: T.font, fontSize: T.size.body, lineHeight: T.lh.body,
            fontWeight: T.weight.body, color: T.ink3,
          }}>
            This is real. Pick a coach, tell them what you want to accomplish, and
            watch the AI respond in real time. No sign-up. No email. Just talk.
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
            fontSize: 'clamp(32px, 5.5vw, 48px)', lineHeight: 1.08,
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
            who has spent his career helping people transform their health. He knew exactly what
            kind of guidance works and what doesn't. He brought the clinical rigor, the nutrition
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
          That is why Koto works for a sixteen-year-old athlete, a busy parent, a college
          student, an executive on the road, and a retiree getting back in shape. It was
          built by all of them.
        </p>
      </div>
    </section>
  )
}

function LifestylePhotoStrip() {
  const photos = [
    { src: '/images/trainer/youth-baseball.jpg', alt: 'Youth baseball player throwing' },
    { src: '/images/trainer/woman-sitting.jpg', alt: 'Athlete stretching outdoors' },
    { src: '/images/trainer/man-phone.jpg', alt: 'Man exercising with phone' },
    { src: '/images/trainer/senior-stretching.jpg', alt: 'Senior couple stretching together' },
    { src: '/images/trainer/golfer.jpg', alt: 'Golfer on the course' },
    { src: '/images/trainer/man-home-workout.jpg', alt: 'Man working out at home' },
    { src: '/images/trainer/couple-running.jpg', alt: 'Couple running on coastal trail' },
    { src: '/images/trainer/woman-yoga-laptop.jpg', alt: 'Woman training at home with laptop' },
  ]
  return (
    <section className="koto-photos" style={{ padding: `${T.s6}px 0`, overflow: 'hidden' }}>
      <style>{`
        .koto-photos .koto-photo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
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
