"use client";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, X, ArrowRight, Check, Phone, MessageSquare,
  BarChart2, Zap, Star, Search, Globe, TrendingUp, Cpu,
} from 'lucide-react';
import { R, T, BLK, GRY, GRN, AMB, W, FH, FB } from '../lib/theme';

/* ─── Palette aliases for readability ─── */
const INK      = BLK;                // #111111 — near-black text
const MUTED    = '#6b7280';          // secondary text
const FAINT    = '#9ca3af';          // tertiary text
const HAIR     = '#e5e7eb';          // borders
const SURFACE  = '#f9fafb';          // subtle surfaces
const WASH     = '#fafbfc';          // ultralight

/* ─── Global CSS ─── */
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: ${W}; color: ${INK}; font-family: ${FH}; -webkit-font-smoothing: antialiased; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .fade { animation: fadeUp .6s ease both; }
  .fade-1 { animation-delay: .05s; }
  .fade-2 { animation-delay: .12s; }
  .fade-3 { animation-delay: .2s; }

  .nav-link {
    color: ${MUTED}; text-decoration: none; font-size: 14px; font-weight: 600;
    background: none; border: none; cursor: pointer; font-family: ${FH}; padding: 0;
    transition: color .15s;
  }
  .nav-link:hover { color: ${INK}; }

  .btn {
    display: inline-flex; align-items: center; gap: 8px;
    border-radius: 10px; cursor: pointer; font-family: ${FH};
    font-weight: 700; letter-spacing: -.005em; transition: all .18s;
    border: 1px solid transparent; white-space: nowrap;
  }
  .btn-primary { background: ${INK}; color: ${W}; }
  .btn-primary:hover { background: #000; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(17,17,17,.18); }
  .btn-secondary { background: ${W}; color: ${INK}; border-color: ${HAIR}; }
  .btn-secondary:hover { border-color: ${INK}; transform: translateY(-1px); }
  .btn-pink { background: ${R}; color: ${W}; }
  .btn-pink:hover { background: #c90070; transform: translateY(-1px); box-shadow: 0 10px 28px ${R}33; }

  .btn-md { padding: 11px 20px; font-size: 14px; }
  .btn-lg { padding: 15px 28px; font-size: 15px; }
  .btn-sm { padding: 8px 16px; font-size: 13px; }

  .pill-filter {
    cursor: pointer; padding: 8px 16px; border-radius: 100px; font-size: 13px;
    font-weight: 700; letter-spacing: -.005em; border: 1px solid ${HAIR};
    background: ${W}; color: ${MUTED}; transition: all .15s; font-family: ${FH};
  }
  .pill-filter:hover { border-color: ${INK}; color: ${INK}; }
  .pill-filter.active { background: ${INK}; color: ${W}; border-color: ${INK}; }

  .card {
    background: ${W}; border: 1px solid ${HAIR}; border-radius: 14px;
    padding: 28px; transition: border-color .2s, transform .2s, box-shadow .2s;
  }
  .card:hover { border-color: ${INK}; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(17,17,17,.06); }

  .eyebrow {
    display: inline-block; font-size: 12px; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase; color: ${T};
    font-family: ${FH}; margin-bottom: 18px;
  }

  @media (max-width: 900px) {
    .hide-mobile { display: none !important; }
    .grid-3 { grid-template-columns: 1fr !important; }
    .grid-4 { grid-template-columns: 1fr 1fr !important; }
    .grid-2 { grid-template-columns: 1fr !important; }
    .hero-h1 { font-size: 52px !important; }
    .sec-h2 { font-size: 40px !important; }
    .section { padding: 72px 24px !important; }
    .hero { padding: 120px 24px 72px !important; }
    .nav-pad { padding: 0 24px !important; }
    .footer-pad { padding: 56px 24px 32px !important; }
    .split { flex-direction: column !important; }
    .stats-row { grid-template-columns: 1fr 1fr !important; gap: 24px !important; }
  }
  @media (min-width: 901px) {
    .show-mobile { display: none !important; }
  }
`;

/* ─── Content ─── */
const TOOLS = [
  { num: '01', cat: 'Growth',       title: 'AI Page Builder',     desc: 'Generate full landing pages from a single prompt. SEO-ready and live in minutes.',           icon: Globe },
  { num: '02', cat: 'Voice',        title: 'Cold Call Agent',     desc: 'AI-powered outbound that books appointments 24/7. Sounds human, converts like a pro.',      icon: Phone },
  { num: '03', cat: 'Voice',        title: 'AI Answering Service',desc: 'Never miss an inbound call. Route, qualify, and respond to leads around the clock.',        icon: MessageSquare },
  { num: '04', cat: 'Intelligence', title: 'Review Management',   desc: 'Monitor, respond to, and generate 5-star reviews across every platform automatically.',      icon: Star },
  { num: '05', cat: 'SEO',          title: 'Scout Leads',         desc: 'Find and qualify perfect prospects with AI-driven research and enrichment pipelines.',       icon: Search },
  { num: '06', cat: 'Intelligence', title: 'CMO Agent',           desc: 'Your always-on fractional CMO. Strategy, campaigns, and competitive analysis on demand.',    icon: BarChart2 },
];

const CATEGORIES = ['All', 'SEO', 'Voice', 'Growth', 'Intelligence'];

const HERO_STATS = [
  { num: '247+', label: 'Agencies' },
  { num: '3×',   label: 'Avg revenue growth' },
  { num: '24/7', label: 'AI always active' },
  { num: '318',  label: 'Leads / day' },
];

const PROOF_STATS = [
  { value: '247+', label: 'Agencies powered' },
  { value: '318k', label: 'Leads generated' },
  { value: '98%',  label: 'Client retention' },
  { value: '4×',   label: 'Avg ROI multiplier' },
];

const PHASES = [
  { num: '01', title: 'Connect',  desc: 'Link your CRM, phone system, and existing tools in minutes. No-code integrations.',      icon: Zap },
  { num: '02', title: 'Research', desc: 'Koto audits your market, competitors, and prospects to build a data-driven blueprint.', icon: Search },
  { num: '03', title: 'Generate', desc: 'AI creates pages, sequences, scripts, and campaigns tailored to your exact market.',    icon: Cpu },
  { num: '04', title: 'Deploy',   desc: 'Launch AI agents that call, answer, build, review, and optimize — without a break.',   icon: TrendingUp },
];

const VOICE_BULLETS = [
  { title: 'Human-sounding AI calls',   desc: 'Hyper-realistic voice AI that qualifies prospects and books meetings without a human in the loop.' },
  { title: 'Unlimited concurrent calls',desc: 'Scale to hundreds of simultaneous calls. No hiring, no burnout.' },
  { title: 'Real-time CRM updates',     desc: 'Every call transcribed, scored, and synced to your CRM automatically.' },
  { title: 'Smart follow-up sequences', desc: 'Automated multi-touch follow-up triggered by call outcomes.' },
];

const TESTIMONIALS = [
  { quote: "Koto transformed how we operate. We scaled from 12 to 47 clients in six months without hiring anyone.",           name: 'Marcus T.', role: 'Founder, Apex Digital' },
  { quote: "The answering service alone pays for itself 10× over. We never miss a lead — even at 2am on a Sunday.",            name: 'Sarah K.',  role: 'CEO, Momentum Marketing' },
  { quote: "The cold call agent booked 34 demos in the first week. My team thought I'd hired a full outbound crew overnight.", name: 'Derek L.',  role: 'VP Sales, Elevate Agency' },
];

const PRICING_PLANS = [
  {
    name: 'Starter', price: '$297', period: '/mo',
    desc: 'For solo operators and new agencies.',
    popular: false,
    features: ['AI Page Builder (5 pages/mo)', 'Cold Call Agent (500 calls/mo)', 'AI Answering Service', 'Review Management', '1 User Seat', 'Email Support'],
  },
  {
    name: 'Growth', price: '$597', period: '/mo',
    desc: 'For growing agencies ready to scale fast.',
    popular: true,
    features: ['AI Page Builder (Unlimited)', 'Cold Call Agent (5,000 calls/mo)', 'AI Answering Service (Unlimited)', 'Review Management + Auto-Reply', 'Scout Leads (500 / mo)', 'CMO Agent', '5 User Seats', 'Priority Support'],
  },
  {
    name: 'Agency', price: '$997', period: '/mo',
    desc: 'Full power for established agencies.',
    popular: false,
    features: ['Everything in Growth', 'Cold Call Agent (Unlimited)', 'Scout Leads (Unlimited)', 'White-Label Option', 'Custom AI Training', 'Dedicated Account Manager', 'Unlimited Seats', 'SLA Support'],
  },
];

const FOOTER_COLUMNS = [
  { title: 'Platform',  links: [
    { label: 'AI Page Builder', href: '#platform' },
    { label: 'Cold Call Agent', href: '#platform' },
    { label: 'Answering Service', href: '#platform' },
    { label: 'Review Management', href: '#platform' },
    { label: 'Scout Leads', href: '#platform' },
    { label: 'CMO Agent', href: '#platform' },
  ] },
  { title: 'Company',   links: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Contact', href: '#contact' },
  ] },
  { title: 'Resources', links: [
    { label: 'Documentation', href: '#' },
    { label: 'API', href: '#' },
    { label: 'Case Studies', href: '#' },
    { label: 'Help Center', href: '#' },
  ] },
  { title: 'Legal',     links: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/privacy#cookies' },
    { label: 'CCPA', href: '/privacy#california' },
  ] },
];

const NAV_LINKS = [
  { id: 'platform', label: 'Platform' },
  { id: 'how',      label: 'How it works' },
  { id: 'pricing',  label: 'Pricing' },
  { id: 'contact',  label: 'Contact' },
];

/* ─── Page ─── */
export default function MarketingSitePage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filteredTools = activeFilter === 'All' ? TOOLS : TOOLS.filter(t => t.cat === activeFilter);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* ══ MOBILE MENU ══ */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: W, zIndex: 9000,
          display: 'flex', flexDirection: 'column', padding: '24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
            <img src="/koto_logo.svg" alt="Koto" style={{ height: 28 }} />
            <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK }}>
              <X size={24} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {NAV_LINKS.map(l => (
              <button key={l.id} onClick={() => { setMenuOpen(false); scrollTo(l.id); }}
                style={{ background: 'none', border: 'none', color: INK, fontSize: 28, fontWeight: 800, fontFamily: FH, letterSpacing: '-.02em', cursor: 'pointer', textAlign: 'left' }}>
                {l.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
            <button className="btn btn-secondary btn-md" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setMenuOpen(false); navigate('/login'); }}>Log in</button>
            <button className="btn btn-primary btn-md" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setMenuOpen(false); navigate('/signup'); }}>Get started</button>
          </div>
        </div>
      )}

      {/* ══ NAV ══ */}
      <nav className="nav-pad" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 8000,
        background: scrolled ? 'rgba(255,255,255,.85)' : W,
        backdropFilter: scrolled ? 'saturate(180%) blur(14px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'saturate(180%) blur(14px)' : 'none',
        borderBottom: scrolled ? `1px solid ${HAIR}` : '1px solid transparent',
        transition: 'all .2s',
        padding: '0 40px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img src="/koto_logo.svg" alt="Koto" style={{ height: 26, cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

        <div className="hide-mobile" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {NAV_LINKS.map(l => (
            <button key={l.id} className="nav-link" onClick={() => scrollTo(l.id)}>{l.label}</button>
          ))}
        </div>

        <div className="hide-mobile" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="nav-link" onClick={() => navigate('/login')}>Log in</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/signup')}>
            Get started <ArrowRight size={14} />
          </button>
        </div>

        <button className="show-mobile" onClick={() => setMenuOpen(true)}
          style={{ background: 'none', border: 'none', color: INK, cursor: 'pointer' }}>
          <Menu size={24} />
        </button>
      </nav>

      {/* ══ HERO ══ */}
      <section className="hero" style={{ background: W, padding: '160px 40px 100px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <div className="fade" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 100, border: `1px solid ${HAIR}`,
            background: WASH, fontSize: 12, fontWeight: 600, color: MUTED,
            marginBottom: 28,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            The intelligence layer for modern agencies
          </div>

          <h1 className="hero-h1 fade fade-1" style={{
            fontSize: 84, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.045em', lineHeight: .98,
            color: INK, maxWidth: 900, margin: '0 auto',
          }}>
            The operating system<br />for marketing agencies.
          </h1>

          <p className="fade fade-2" style={{
            fontSize: 20, color: MUTED, fontFamily: FB,
            lineHeight: 1.55, maxWidth: 620, margin: '24px auto 0',
          }}>
            AI agents that call, answer, qualify, publish, and optimize — so you can scale
            without hiring. Built for the modern agency operator.
          </p>

          <div className="fade fade-3" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 36 }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/signup')}>
              Start free trial <ArrowRight size={16} />
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => scrollTo('platform')}>
              See how it works
            </button>
          </div>

          <div className="fade fade-3" style={{ fontSize: 13, color: FAINT, marginTop: 18 }}>
            No credit card required · 14-day free trial · Set up in 10 minutes
          </div>

          {/* Hero stats */}
          <div className="stats-row" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 48,
            marginTop: 80, paddingTop: 40, borderTop: `1px solid ${HAIR}`,
            maxWidth: 820, marginLeft: 'auto', marginRight: 'auto',
          }}>
            {HERO_STATS.map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 38, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 8, letterSpacing: '.02em', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PLATFORM ══ */}
      <section id="platform" className="section" style={{ background: W, padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div className="eyebrow">The Platform</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 24 }}>
              <h2 className="sec-h2" style={{
                fontSize: 56, fontWeight: 900, fontFamily: FH,
                letterSpacing: '-.035em', color: INK, lineHeight: 1.02, maxWidth: 720,
              }}>
                Six AI agents.<br />One command center.
              </h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIES.map(c => (
                  <button key={c} className={`pill-filter${activeFilter === c ? ' active' : ''}`} onClick={() => setActiveFilter(c)}>{c}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {filteredTools.map(t => {
              const Icon = t.icon;
              return (
                <div key={t.num} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: R + '10', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={20} color={R} />
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
                      textTransform: 'uppercase', color: T,
                      background: T + '12', padding: '4px 10px', borderRadius: 100,
                    }}>{t.cat}</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.06em', marginBottom: 6 }}>{t.num}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginBottom: 8 }}>
                    {t.title}
                  </h3>
                  <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, fontFamily: FB }}>{t.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ VOICE SPOTLIGHT ══ */}
      <section id="services" className="section" style={{ background: SURFACE, padding: '96px 40px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div className="split" style={{ display: 'flex', gap: 64, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div className="eyebrow" style={{ color: R }}>Outbound + Inbound Voice</div>
              <h2 className="sec-h2" style={{
                fontSize: 52, fontWeight: 900, fontFamily: FH,
                letterSpacing: '-.035em', color: INK, lineHeight: 1.02, marginBottom: 24,
              }}>
                Your AI sales team<br />never sleeps.
              </h2>
              <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6, marginBottom: 36, maxWidth: 480 }}>
                Outbound cold calls and inbound answering handled by AI agents that sound human,
                book meetings, and sync every detail to your CRM automatically.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 36 }}>
                {VOICE_BULLETS.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 8, background: INK, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={14} color={W} strokeWidth={3} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: INK, fontFamily: FH, marginBottom: 2 }}>{item.title}</div>
                      <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.55, fontFamily: FB }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn btn-primary btn-lg" onClick={() => navigate('/signup')}>
                Activate voice agents <ArrowRight size={16} />
              </button>
            </div>

            {/* Stat card */}
            <div style={{
              flex: '0 0 380px', background: W, border: `1px solid ${HAIR}`,
              borderRadius: 18, padding: 36,
              display: 'flex', flexDirection: 'column', gap: 28,
            }}>
              {[
                { num: '89%',  label: 'Answer rate vs. human cold call' },
                { num: '4.2×', label: 'More appointments booked' },
                { num: '67%',  label: 'Reduction in cost per lead' },
                { num: '∞',    label: 'Simultaneous calls' },
              ].map((s, i, arr) => (
                <div key={s.label} style={{
                  paddingBottom: i < arr.length - 1 ? 24 : 0,
                  borderBottom: i < arr.length - 1 ? `1px solid ${HAIR}` : 'none',
                }}>
                  <div style={{ fontSize: 44, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: R, lineHeight: 1 }}>{s.num}</div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 6, fontFamily: FB, lineHeight: 1.4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section id="how" className="section" style={{ background: W, padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="eyebrow">How it works</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.02, marginBottom: 18,
            }}>
              Four phases. No slowdowns.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, maxWidth: 540, margin: '0 auto', lineHeight: 1.6 }}>
              From connect to deploy, Koto replaces the dozens of tools and hires that used to slow your agency down.
            </p>
          </div>

          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            {PHASES.map(p => {
              const Icon = p.icon;
              return (
                <div key={p.num} className="card" style={{ padding: '28px 24px' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: T + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                  }}>
                    <Icon size={20} color={T} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.08em', marginBottom: 6 }}>STEP {p.num}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginBottom: 8 }}>
                    {p.title}
                  </h3>
                  <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, fontFamily: FB }}>{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ PROOF ══ */}
      <section className="section" style={{ background: SURFACE, padding: '96px 40px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="eyebrow">Proof</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.02,
            }}>
              Built by operators.<br />Loved by agencies.
            </h2>
          </div>

          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 48 }}>
            {PROOF_STATS.map(s => (
              <div key={s.label} style={{
                background: W, border: `1px solid ${HAIR}`, borderRadius: 14,
                padding: '28px 24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 44, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: INK, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 10, letterSpacing: '.02em', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="card" style={{ background: W }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
                  {[0,1,2,3,4].map(k => <Star key={k} size={14} color={AMB} fill={AMB} />)}
                </div>
                <p style={{ fontSize: 15, color: INK, lineHeight: 1.65, marginBottom: 20, fontFamily: FB }}>
                  "{t.quote}"
                </p>
                <div style={{ paddingTop: 16, borderTop: `1px solid ${HAIR}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: INK, fontFamily: FH }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 2, fontFamily: FB }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING ══ */}
      <section id="pricing" className="section" style={{ background: W, padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="eyebrow">Pricing</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.02, marginBottom: 14,
            }}>
              Simple plans. No surprises.
            </h2>
            <p style={{ fontSize: 16, color: MUTED, fontFamily: FB }}>No contracts. Cancel anytime. 14-day free trial on every plan.</p>
          </div>

          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, alignItems: 'stretch' }}>
            {PRICING_PLANS.map(plan => (
              <div key={plan.name} style={{
                position: 'relative',
                background: W,
                border: plan.popular ? `2px solid ${INK}` : `1px solid ${HAIR}`,
                borderRadius: 16, padding: '36px 28px',
                display: 'flex', flexDirection: 'column',
              }}>
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: -12, left: 28,
                    background: INK, color: W, fontSize: 11, fontWeight: 800,
                    letterSpacing: '.06em', textTransform: 'uppercase',
                    padding: '5px 12px', borderRadius: 100,
                  }}>
                    Most popular
                  </div>
                )}

                <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, letterSpacing: '.04em', marginBottom: 10 }}>
                  {plan.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                  <span style={{ fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: INK, lineHeight: 1 }}>{plan.price}</span>
                  <span style={{ fontSize: 15, color: MUTED, fontFamily: FB }}>{plan.period}</span>
                </div>
                <p style={{ fontSize: 14, color: MUTED, marginBottom: 24, fontFamily: FB, lineHeight: 1.5 }}>{plan.desc}</p>

                <button
                  onClick={() => navigate('/signup')}
                  className={`btn btn-md ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%', justifyContent: 'center', marginBottom: 28 }}
                >
                  Start free trial
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <Check size={15} color={GRN} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 13, color: INK, lineHeight: 1.45, fontFamily: FB }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section className="section" style={{ background: W, padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{
          maxWidth: 960, margin: '0 auto',
          background: INK, borderRadius: 24, padding: '72px 48px',
          textAlign: 'center', color: W, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -80, right: -80, width: 280, height: 280,
            borderRadius: '50%', background: R + '30', filter: 'blur(60px)',
          }} />
          <div style={{
            position: 'absolute', bottom: -80, left: -80, width: 240, height: 240,
            borderRadius: '50%', background: T + '30', filter: 'blur(60px)',
          }} />
          <div style={{ position: 'relative' }}>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: W, lineHeight: 1.02, marginBottom: 20,
            }}>
              Ready to run your<br />agency on autopilot?
            </h2>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,.7)', fontFamily: FB, maxWidth: 500, margin: '0 auto 36px', lineHeight: 1.55 }}>
              Join 247+ agencies using Koto to automate growth and reclaim their time.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-pink btn-lg" onClick={() => navigate('/signup')}>
                Start free trial <ArrowRight size={16} />
              </button>
              <button className="btn btn-lg" onClick={() => scrollTo('pricing')}
                style={{ background: 'transparent', color: W, border: '1px solid rgba(255,255,255,.3)' }}>
                See pricing
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginTop: 20 }}>
              No credit card required · Cancel anytime
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer id="contact" className="footer-pad" style={{ background: W, borderTop: `1px solid ${HAIR}`, padding: '72px 40px 40px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div className="grid-4" style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 40, marginBottom: 56,
          }}>
            <div>
              <img src="/koto_logo.svg" alt="Koto" style={{ height: 26, marginBottom: 14 }} />
              <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, maxWidth: 280, fontFamily: FB }}>
                The intelligence layer for modern marketing agencies. Built to scale, designed to win.
              </p>
            </div>
            {FOOTER_COLUMNS.map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: INK, marginBottom: 14 }}>
                  {col.title}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map(l => (
                    <a key={l.label} href={l.href} style={{
                      fontSize: 14, color: MUTED, textDecoration: 'none',
                      transition: 'color .15s', fontFamily: FB,
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = INK}
                      onMouseLeave={e => e.currentTarget.style.color = MUTED}
                    >{l.label}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            borderTop: `1px solid ${HAIR}`, paddingTop: 24,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ fontSize: 13, color: FAINT, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <span>© 2026 Koto Technologies, Inc.</span>
              <a href="/privacy" style={{ color: FAINT, textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = INK}
                onMouseLeave={e => e.currentTarget.style.color = FAINT}>Privacy</a>
              <a href="/terms" style={{ color: FAINT, textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = INK}
                onMouseLeave={e => e.currentTarget.style.color = FAINT}>Terms</a>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
              <span style={{ fontSize: 13, color: FAINT }}>All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
