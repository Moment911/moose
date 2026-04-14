"use client"
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CheckCircle, AlertCircle, TrendingUp, BarChart2, Target, Users, Globe, Star, Phone, Zap, ArrowRight } from 'lucide-react'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

const QUESTIONS = [
  {
    id: 'lead_source',
    question: 'Where do most of your customers come from?',
    options: [
      { label: 'Referrals / word of mouth', value: 'referral', score: 2 },
      { label: 'Google search (organic)', value: 'organic', score: 4 },
      { label: 'Paid ads (Google, Facebook)', value: 'paid', score: 3 },
      { label: 'I honestly have no idea', value: 'unknown', score: 0 },
    ],
    insight: { referral: 'Referrals are great but they don\'t scale. One bad quarter and your pipeline dries up.', organic: 'Strong SEO foundation — but are you ranking for the RIGHT keywords?', paid: 'You\'re investing in growth. The question is whether your ROI is where it should be.', unknown: 'If you can\'t track where customers come from, you can\'t optimize. This is priority #1.' },
  },
  {
    id: 'response_time',
    question: 'When a new lead contacts you, how quickly do they hear back?',
    options: [
      { label: 'Within 5 minutes', value: 'fast', score: 5 },
      { label: 'Within an hour', value: 'hour', score: 3 },
      { label: 'Same day, usually', value: 'sameday', score: 1 },
      { label: 'Whenever we get to it', value: 'slow', score: 0 },
    ],
    insight: { fast: 'You\'re in the top 1%. Harvard found 5-minute responders are 21x more likely to qualify a lead.', hour: 'Not bad, but your competitors who respond in 5 minutes are winning 21x more leads.', sameday: 'By the time you respond, they\'ve already called 3 competitors. Speed wins.', slow: 'The average business takes 47 hours to respond. By then, that lead hired someone else.' },
  },
  {
    id: 'website_age',
    question: 'When was your website last updated?',
    options: [
      { label: 'Within the last year', value: 'recent', score: 4 },
      { label: '1-3 years ago', value: 'aging', score: 2 },
      { label: 'I can\'t remember', value: 'old', score: 0 },
      { label: 'We don\'t have one', value: 'none', score: 0 },
    ],
    insight: { recent: 'Good — but is it converting visitors to leads, or just looking pretty?', aging: '75% of consumers judge credibility based on website design. Yours may be costing you customers.', old: 'If you can\'t remember, your customers definitely notice. 88% won\'t return after a bad website experience.', none: '97% of consumers discover local businesses online. Without a website, you\'re invisible to most of them.' },
  },
  {
    id: 'reviews',
    question: 'How many Google reviews does your business have?',
    options: [
      { label: '100+ reviews', value: 'strong', score: 5 },
      { label: '25-100 reviews', value: 'decent', score: 3 },
      { label: 'Under 25', value: 'low', score: 1 },
      { label: 'I don\'t know / very few', value: 'none', score: 0 },
    ],
    insight: { strong: 'Excellent social proof. But are you responding to ALL of them? Response rate matters as much as count.', decent: 'Solid foundation. But your competitors with 200+ reviews are getting preferred placement.', low: '91% of consumers read reviews before choosing a business. Under 25 looks thin.', none: 'Consumers need 10+ reviews before they trust a business. This is free marketing you\'re leaving on the table.' },
  },
  {
    id: 'tracking',
    question: 'Do you track your marketing ROI?',
    options: [
      { label: 'Yes — I know my cost per lead and ROI per channel', value: 'tracked', score: 5 },
      { label: 'Somewhat — I see some data but it\'s not clear', value: 'partial', score: 2 },
      { label: 'No — I spend money and hope it works', value: 'hope', score: 0 },
      { label: 'I don\'t spend on marketing', value: 'zero', score: 1 },
    ],
    insight: { tracked: 'You\'re ahead of 62% of SMBs who can\'t calculate their ROI. But are you optimizing based on that data?', partial: 'Partial visibility means partial optimization. You might be doubling down on the wrong channels.', hope: '62% of SMBs can\'t calculate their ad ROI. You can\'t improve what you don\'t measure.', zero: 'Every business markets — the question is whether it\'s intentional or accidental.' },
  },
  {
    id: 'crm',
    question: 'Do you use a CRM (customer relationship management tool)?',
    options: [
      { label: 'Yes — everything is tracked and automated', value: 'full', score: 5 },
      { label: 'Yes — but we barely use it', value: 'partial', score: 2 },
      { label: 'Spreadsheets / notes / memory', value: 'manual', score: 1 },
      { label: 'No system at all', value: 'none', score: 0 },
    ],
    insight: { full: 'Smart. Automation is the difference between chasing leads and leads chasing you.', partial: 'A CRM you don\'t use is like a gym membership you don\'t visit. The tool works, but only if you do.', manual: 'Spreadsheets can\'t auto-text a lead in 5 seconds. They can\'t send follow-ups while you sleep.', none: 'Businesses with a CRM see 35-50% more conversions. Not from more leads — from not losing the ones they have.' },
  },
  {
    id: 'budget',
    question: 'What do you spend monthly on marketing?',
    options: [
      { label: '$5,000+', value: 'high', score: 4 },
      { label: '$1,000-$5,000', value: 'mid', score: 3 },
      { label: 'Under $1,000', value: 'low', score: 2 },
      { label: '$0 — just word of mouth', value: 'zero', score: 0 },
    ],
    insight: { high: 'You\'re investing. But is every dollar working, or are some napping on the job?', mid: 'You\'re in the competitive range. A well-targeted $2K beats a scattered $10K.', low: 'Many of our most successful clients started under $1K by focusing on free channels first: GBP, reviews, SEO.', zero: 'Word of mouth is a compliment, not a strategy. It doesn\'t scale and one slow month proves it.' },
  },
  {
    id: 'competition',
    question: 'How do you feel about your competition?',
    options: [
      { label: 'We\'re the clear leader in our market', value: 'leader', score: 5 },
      { label: 'We hold our own', value: 'competitive', score: 3 },
      { label: 'They\'re outpacing us online', value: 'losing', score: 1 },
      { label: 'I don\'t know what they\'re doing', value: 'blind', score: 0 },
    ],
    insight: { leader: 'Leaders get complacent. Your competitors are working to take your spot right now.', competitive: 'Holding your own means you\'re not growing. In marketing, standing still is falling behind.', losing: 'They\'re not better — they\'re more visible. Visibility is a system, not luck.', blind: 'If you don\'t know what your competitors are doing, you can\'t outperform them. Knowledge is leverage.' },
  },
]

function getGrade(score, max) {
  const pct = (score / max) * 100
  if (pct >= 80) return { grade: 'A', label: 'Strong Foundation', color: GRN, desc: 'Your marketing has a solid base. A professional audit could help you optimize and scale what\'s already working.' }
  if (pct >= 60) return { grade: 'B', label: 'Room to Grow', color: T, desc: 'You have some pieces in place, but there are clear gaps costing you customers. A free audit will show you exactly where.' }
  if (pct >= 40) return { grade: 'C', label: 'Significant Gaps', color: AMB, desc: 'Your marketing has major blind spots. Every month without addressing them, your competitors pull further ahead.' }
  if (pct >= 20) return { grade: 'D', label: 'Critical Issues', color: '#f97316', desc: 'Your marketing infrastructure needs immediate attention. The good news: the biggest improvements are often the easiest fixes.' }
  return { grade: 'F', label: 'Needs Urgent Help', color: R, desc: 'Your business is essentially invisible online. But that also means you have the most to gain from getting it right.' }
}

export default function MarketingQuizPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0) // 0=intro, 1-8=questions, 9=results
  const [answers, setAnswers] = useState({})
  const [showInsight, setShowInsight] = useState(false)

  const maxScore = QUESTIONS.reduce((sum, q) => sum + Math.max(...q.options.map(o => o.score)), 0)
  const currentScore = Object.values(answers).reduce((sum, a) => sum + (a?.score || 0), 0)
  const currentQ = QUESTIONS[step - 1]

  function selectAnswer(option) {
    setAnswers(prev => ({ ...prev, [currentQ.id]: option }))
    setShowInsight(true)
    setTimeout(() => {
      setShowInsight(false)
      if (step < QUESTIONS.length) setStep(step + 1)
      else setStep(QUESTIONS.length + 1) // results
    }, 3500)
  }

  const grade = getGrade(currentScore, maxScore)

  // ── Intro ──────────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div style={{ minHeight: '100vh', background: BLK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FB }}>
        <div style={{ maxWidth: 520, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T, textTransform: 'uppercase', letterSpacing: '.15em', marginBottom: 12, fontFamily: FH }}>Free Marketing Diagnostic</div>
          <h1 style={{ fontFamily: FH, fontSize: 36, fontWeight: 900, color: '#fff', margin: '0 0 16px', letterSpacing: '-.03em', lineHeight: 1.1 }}>
            How Healthy Is Your<br /><span style={{ color: T }}>Marketing?</span>
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, marginBottom: 32 }}>
            8 quick questions. 2 minutes. Get a personalized score with specific recommendations for your business.
          </p>
          <button onClick={() => setStep(1)}
            style={{ padding: '16px 40px', borderRadius: 12, border: 'none', background: R, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: FH, letterSpacing: '.02em', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Start Quiz <ArrowRight size={18} />
          </button>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 16 }}>No email required. See results instantly.</p>
        </div>
      </div>
    )
  }

  // ── Results ────────────────────────────────────────────────────────────
  if (step > QUESTIONS.length) {
    const insights = QUESTIONS.map(q => ({ question: q.question, answer: answers[q.id]?.label, insight: q.insight[answers[q.id]?.value] }))
    return (
      <div style={{ minHeight: '100vh', background: GRY, fontFamily: FB }}>
        <div style={{ background: BLK, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T, textTransform: 'uppercase', letterSpacing: '.15em', marginBottom: 12, fontFamily: FH }}>Your Marketing Score</div>
          <div style={{ width: 120, height: 120, borderRadius: '50%', border: `4px solid ${grade.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: grade.color + '15' }}>
            <span style={{ fontFamily: FH, fontSize: 52, fontWeight: 900, color: grade.color }}>{grade.grade}</span>
          </div>
          <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{grade.label}</div>
          <div style={{ fontSize: 14, color: T, fontWeight: 700, fontFamily: FH }}>{currentScore} / {maxScore} points</div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', marginTop: 12, maxWidth: 480, margin: '12px auto 0', lineHeight: 1.6 }}>{grade.desc}</p>
        </div>

        <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
          <h2 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 20 }}>Your Personalized Breakdown</h2>
          {insights.map((item, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Q{i + 1}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 4 }}>{item.question}</div>
              <div style={{ fontSize: 13, color: T, fontWeight: 700, marginBottom: 8 }}>You said: {item.answer}</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, padding: '10px 14px', background: '#f9fafb', borderRadius: 8, borderLeft: `3px solid ${T}` }}>{item.insight}</div>
            </div>
          ))}

          <div style={{ background: R, borderRadius: 14, padding: '28px 24px', marginTop: 24, textAlign: 'center' }}>
            <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Want to Know Exactly What to Fix?</div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.8)', marginBottom: 20, lineHeight: 1.6 }}>
              Get a free, no-obligation audit where we analyze your specific business and build a custom action plan.
            </p>
            <button onClick={() => navigate('/intel')}
              style={{ padding: '14px 32px', borderRadius: 10, border: '2px solid #fff', background: 'transparent', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: FH }}>
              Run Free KotoIntel Scan
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Question ───────────────────────────────────────────────────────────
  const progress = (step / QUESTIONS.length) * 100
  const selected = answers[currentQ.id]

  return (
    <div style={{ minHeight: '100vh', background: BLK, display: 'flex', flexDirection: 'column', fontFamily: FB }}>
      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,.1)' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: T, transition: 'width .4s ease', borderRadius: 2 }} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ maxWidth: 560, width: '100%' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12, fontFamily: FH }}>
            Question {step} of {QUESTIONS.length}
          </div>
          <h2 style={{ fontFamily: FH, fontSize: 26, fontWeight: 900, color: '#fff', margin: '0 0 28px', lineHeight: 1.2, letterSpacing: '-.02em' }}>
            {currentQ.question}
          </h2>

          {showInsight && selected ? (
            <div style={{ padding: '24px 28px', borderRadius: 14, background: T + '12', border: `1.5px solid ${T}30` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Zap size={16} color={T} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T, textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: FH }}>Insight</span>
              </div>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,.85)', lineHeight: 1.6, margin: 0 }}>
                {currentQ.insight[selected.value]}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options.map((opt, i) => (
                <button key={i} onClick={() => selectAnswer(opt)}
                  style={{
                    padding: '16px 20px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,.12)',
                    background: 'rgba(255,255,255,.04)', color: '#fff', fontSize: 15, fontWeight: 600,
                    cursor: 'pointer', textAlign: 'left', transition: 'all .15s', fontFamily: FB,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T; e.currentTarget.style.background = T + '12' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)'; e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}>
                  {opt.label}
                  <ChevronRight size={16} style={{ opacity: 0.4 }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
