"use client";
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, X, ChevronRight, Check, Phone, MessageSquare,
  BarChart2, Zap, Users, Star, ArrowRight, Search,
  Globe, Shield, TrendingUp, Target, Cpu, Mail
} from 'lucide-react';

/* ─── Design tokens ─────────────────────────────────────────── */
const RED   = '#ea2729';
const BLACK = '#0a0a0a';
const WHITE = '#ffffff';
const GRAY  = '#6b7280';
const LIGHT = '#f5f5f5';

const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif";
const FB = "'Raleway','Helvetica Neue',sans-serif";

/* ─── Global styles injected once ───────────────────────────── */
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: ${BLACK}; color: ${WHITE}; font-family: ${FH}; }

  @keyframes marquee {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes marquee2 {
    0%   { transform: translateX(-50%); }
    100% { transform: translateX(0); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes countUp {
    from { opacity: 0; transform: scale(.8); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 0 0 ${RED}60; }
    50%       { box-shadow: 0 0 0 12px ${RED}00; }
  }

  .fade-in-section {
    opacity: 0;
    transform: translateY(32px);
    transition: opacity .65s ease, transform .65s ease;
  }
  .fade-in-section.visible {
    opacity: 1;
    transform: translateY(0);
  }
  .marquee-track { display: flex; width: max-content; }
  .marquee-inner { animation: marquee 28s linear infinite; }
  .marquee-inner2 { animation: marquee2 32s linear infinite; }
  .marquee-track:hover .marquee-inner,
  .marquee-track:hover .marquee-inner2 { animation-play-state: paused; }

  .pill-filter {
    cursor: pointer;
    padding: 8px 22px;
    border-radius: 100px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    border: 1.5px solid #d1d5db;
    background: transparent;
    color: #374151;
    transition: all .2s;
    font-family: ${FH};
  }
  .pill-filter:hover { border-color: ${RED}; color: ${RED}; }
  .pill-filter.active { background: ${RED}; color: ${WHITE}; border-color: ${RED}; }

  .tool-card {
    border: 1.5px solid #e5e7eb;
    border-radius: 16px;
    padding: 32px 28px;
    background: ${WHITE};
    transition: transform .25s, box-shadow .25s, border-color .25s;
    cursor: default;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .tool-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 48px rgba(0,0,0,.10);
    border-color: ${RED}40;
  }

  .pricing-card {
    border: 1.5px solid #e5e7eb;
    border-radius: 20px;
    padding: 40px 32px;
    background: ${WHITE};
    transition: transform .25s, box-shadow .25s;
    position: relative;
    overflow: hidden;
  }
  .pricing-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 24px 56px rgba(0,0,0,.12);
  }
  .pricing-card.popular {
    border-color: ${RED};
    box-shadow: 0 0 0 4px ${RED}18;
  }

  .feature-card {
    background: #f9fafb;
    border: 1.5px solid #e5e7eb;
    border-radius: 16px;
    padding: 32px 28px;
    transition: transform .22s, box-shadow .22s;
  }
  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 14px 36px rgba(0,0,0,.08);
  }

  .testimonial-card {
    background: ${WHITE};
    border: 1.5px solid #e5e7eb;
    border-radius: 16px;
    padding: 32px;
    transition: transform .22s, box-shadow .22s;
  }
  .testimonial-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 14px 36px rgba(0,0,0,.08);
  }

  .phase-card {
    border: 1.5px solid rgba(255,255,255,.1);
    border-radius: 16px;
    padding: 32px 28px;
    background: rgba(255,255,255,.04);
    transition: border-color .25s, background .25s;
  }
  .phase-card:hover {
    border-color: ${RED}60;
    background: rgba(234,39,41,.04);
  }

  .nav-link {
    color: rgba(255,255,255,.75);
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: .04em;
    transition: color .2s;
    cursor: pointer;
    background: none;
    border: none;
    font-family: ${FH};
    padding: 0;
  }
  .nav-link:hover { color: ${WHITE}; }

  .hamburger-menu {
    position: fixed;
    inset: 0;
    background: ${BLACK};
    z-index: 9000;
    display: flex;
    flex-direction: column;
    padding: 32px 24px;
    gap: 32px;
  }

  @media (max-width: 768px) {
    .hide-mobile { display: none !important; }
    .hero-headline { font-size: 44px !important; }
    .hero-stats { flex-wrap: wrap; gap: 24px !important; }
    .tools-grid { grid-template-columns: 1fr !important; }
    .pricing-grid { grid-template-columns: 1fr !important; }
    .phases-grid { grid-template-columns: 1fr 1fr !important; }
    .proof-grid { grid-template-columns: 1fr 1fr !important; }
    .testimonials-grid { grid-template-columns: 1fr !important; }
    .feature-cards-grid { grid-template-columns: 1fr !important; }
    .footer-grid { grid-template-columns: 1fr 1fr !important; }
    .voice-inner { flex-direction: column !important; }
    .section-pad { padding: 72px 24px !important; }
    .hero-pad { padding: 120px 24px 80px !important; }
  }
  @media (min-width: 769px) {
    .show-only-mobile { display: none !important; }
  }
`;

/* ─── Tiny helpers ──────────────────────────────────────────── */
function SectionLabel({ children, dark = false }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontSize: 11, fontWeight: 800, letterSpacing: '.12em',
      textTransform: 'uppercase', fontFamily: FH,
      color: dark ? 'rgba(255,255,255,.55)' : GRAY,
      marginBottom: 20,
    }}>
      <span style={{ color: RED, fontSize: 10 }}>◆</span>
      {children}
    </div>
  );
}

function RedBtn({ children, onClick, size = 'md', outline = false, style = {} }) {
  const pad = size === 'lg' ? '17px 38px' : size === 'sm' ? '10px 22px' : '13px 28px';
  const fs  = size === 'lg' ? 16 : 14;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: pad, fontSize: fs, fontWeight: 700,
        borderRadius: 8, cursor: 'pointer', fontFamily: FH,
        border: outline ? `2px solid ${RED}` : 'none',
        background: outline ? 'transparent' : RED,
        color: WHITE,
        transition: 'all .2s',
        letterSpacing: '.02em',
        ...style,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.opacity = '.85';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {children}
    </button>
  );
}

function WhiteOutlineBtn({ children, onClick, size = 'md', style = {} }) {
  const pad = size === 'lg' ? '17px 38px' : '13px 28px';
  const fs  = size === 'lg' ? 16 : 14;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: pad, fontSize: fs, fontWeight: 700,
        borderRadius: 8, cursor: 'pointer', fontFamily: FH,
        border: `2px solid rgba(255,255,255,.35)`,
        background: 'transparent', color: WHITE,
        transition: 'all .2s', letterSpacing: '.02em',
        ...style,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = WHITE;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,.35)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {children}
    </button>
  );
}

/* ─── IntersectionObserver hook ────────────────────────────── */
function useFadeIn() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('fade-in-section');
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─── Animated counter ─────────────────────────────────────── */
function AnimatedStat({ value, label, suffix = '', color = BLACK, labelColor = GRAY }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  // Parse numeric value once; stable across renders unless value prop changes
  const numeric = parseInt(value.replace(/\D/g, ''), 10) || 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        let current = 0;
        const step = Math.max(16, 1400 / numeric);
        const increment = Math.ceil(numeric / 60);
        const timer = setInterval(() => {
          current += increment;
          if (current >= numeric) { setCount(numeric); clearInterval(timer); }
          else setCount(current);
        }, step);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [numeric]);

  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 56, fontWeight: 900, fontFamily: FB, letterSpacing: '-.04em',
        color, lineHeight: 1,
      }}>
        {count}{suffix}
      </div>
      <div style={{ fontSize: 13, color: labelColor, marginTop: 6, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

/* ─── Marquee strip ─────────────────────────────────────────── */
function Marquee({ items, dark = true, reverse = false, speed = 28 }) {
  const text = items.join('  ●  ') + '  ●  ';
  const doubled = text + text;
  return (
    <div style={{
      background: dark ? '#111' : LIGHT,
      borderTop: dark ? '1px solid rgba(255,255,255,.07)' : '1px solid #e5e7eb',
      borderBottom: dark ? '1px solid rgba(255,255,255,.07)' : '1px solid #e5e7eb',
      padding: '14px 0', overflow: 'hidden', width: '100%',
    }}>
      <div className="marquee-track">
        <div
          className={reverse ? 'marquee-inner2' : 'marquee-inner'}
          style={{ animation: `${reverse ? 'marquee2' : 'marquee'} ${speed}s linear infinite` }}
        >
          <span style={{
            whiteSpace: 'nowrap', fontSize: 13, fontWeight: 800,
            letterSpacing: '.1em', textTransform: 'uppercase',
            color: dark ? 'rgba(255,255,255,.45)' : GRAY,
            fontFamily: FH,
          }}>
            {doubled}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Static module-level data (hoisted to avoid recreation on every render) ─ */
const TOOLS = [
  {
    num: '01', cat: 'Growth', title: 'AI Page Builder',
    desc: 'Generate full landing pages from a single prompt. SEO-optimized, mobile-ready, published in minutes.',
    tags: ['Auto-SEO', 'Templates', 'Live Deploy'],
    icon: <Globe size={22} color={RED} />,
  },
  {
    num: '02', cat: 'Voice', title: 'Cold Call Agent',
    desc: 'AI-powered outbound calling that books appointments 24/7. Sounds human, converts like a pro.',
    tags: ['Auto Dial', 'CRM Sync', 'Live Transcripts'],
    icon: <Phone size={22} color={RED} />,
  },
  {
    num: '03', cat: 'Voice', title: 'AI Answering Service',
    desc: 'Never miss an inbound call. Route, qualify, and respond to leads around the clock.',
    tags: ['IVR', 'Lead Capture', '24/7 Active'],
    icon: <MessageSquare size={22} color={RED} />,
  },
  {
    num: '04', cat: 'Intelligence', title: 'Review Management',
    desc: 'Monitor, respond to, and generate 5-star reviews across every platform automatically.',
    tags: ['Multi-Platform', 'Auto-Reply', 'Sentiment AI'],
    icon: <Star size={22} color={RED} />,
  },
  {
    num: '05', cat: 'SEO', title: 'Scout Leads',
    desc: 'Find and qualify your perfect prospects using AI-driven research and enrichment pipelines.',
    tags: ['Lead Scoring', 'Enrichment', 'Export'],
    icon: <Search size={22} color={RED} />,
  },
  {
    num: '06', cat: 'Intelligence', title: 'CMO Agent',
    desc: 'Your always-on fractional CMO. Strategy, campaigns, and competitive analysis on demand.',
    tags: ['Strategy', 'Campaigns', 'Analytics'],
    icon: <BarChart2 size={22} color={RED} />,
  },
];

const CATEGORIES = ['All', 'SEO', 'Voice', 'Growth', 'Intelligence'];

const HERO_TICKER = [
  'AI PAGE BUILDER', 'VOICE AGENT', 'ANSWERING SERVICE',
  'REVIEW MANAGEMENT', 'SCOUT LEADS', 'CMO AI',
];

const INDUSTRIES = [
  'Roofing', 'HVAC', 'Law Firms', 'Dental', 'Real Estate',
  'Med Spa', 'Auto Dealers', 'Restaurants', 'Insurance', 'Fitness',
  'Home Services', 'Financial Advisors', 'Contractors', 'Retail',
];

const HERO_STATS = [
  { num: '247+', label: 'Agencies Onboarded' },
  { num: '3x',   label: 'Avg. Revenue Growth' },
  { num: '24/7', label: 'AI Always Active' },
  { num: '318',  label: 'Leads Generated Daily' },
];

const VOICE_BULLETS = [
  { title: 'Human-Sounding AI Calls', desc: 'Hyper-realistic voice AI that qualifies prospects and books meetings without human intervention.' },
  { title: 'Unlimited Concurrent Calls', desc: 'Scale your outreach to hundreds of simultaneous calls. No hiring. No burnout.' },
  { title: 'Real-Time CRM Updates', desc: 'Every call is transcribed, scored, and synced directly to your CRM automatically.' },
  { title: 'Smart Follow-Up Sequences', desc: 'Automated multi-touch follow-up sequences triggered by call outcomes.' },
];

const VOICE_STATS = [
  { num: '89%', label: 'Answer Rate vs. Human Cold Call' },
  { num: '4.2x', label: 'More Appointments Booked' },
  { num: '67%', label: 'Reduction in Cost Per Lead' },
  { num: '∞', label: 'Calls Running Simultaneously' },
];

const ANSWER_FEATURES = [
  {
    icon: <Phone size={28} color={RED} />,
    title: 'Instant Call Routing',
    desc: 'Smart IVR that qualifies callers and routes them to the right team in seconds — or captures a lead if no one is available.',
  },
  {
    icon: <MessageSquare size={28} color={RED} />,
    title: 'Lead Capture & Nurture',
    desc: 'Every inbound call creates a qualified lead in your CRM with full context, transcript, and next-step triggers.',
  },
  {
    icon: <Zap size={28} color={RED} />,
    title: '24/7 FAQ Handling',
    desc: 'Train your AI on your services, pricing, and FAQs. It answers like your best rep — at any hour.',
  },
];

const PHASES = [
  {
    num: '01', title: 'Connect',
    desc: 'Link your CRM, phone system, and existing tools in minutes with our no-code integrations.',
    icon: <Zap size={26} color={RED} />,
  },
  {
    num: '02', title: 'Research',
    desc: 'Koto audits your market, competitors, and prospects to build a data-driven growth blueprint.',
    icon: <Search size={26} color={RED} />,
  },
  {
    num: '03', title: 'Generate',
    desc: 'AI creates pages, sequences, scripts, and campaigns tailored to your exact market and offer.',
    icon: <Cpu size={26} color={RED} />,
  },
  {
    num: '04', title: 'Deploy',
    desc: 'Launch your AI agents. They call, answer, build, review, and optimize — all without a break.',
    icon: <TrendingUp size={26} color={RED} />,
  },
];

const PROOF_STATS = [
  { value: '247', suffix: '+', label: 'Agencies Powered' },
  { value: '318', suffix: 'k', label: 'Leads Generated' },
  { value: '98',  suffix: '%', label: 'Client Retention' },
  { value: '4',   suffix: 'x', label: 'Avg. ROI Multiplier' },
];

const TESTIMONIALS = [
  {
    quote: "Koto completely transformed how we operate. We scaled from 12 to 47 clients in 6 months without hiring a single extra person.",
    name: "Marcus T.", role: "Founder, Apex Digital", stars: 5,
  },
  {
    quote: "The AI answering service alone pays for itself 10x over. We never miss a lead now — even at 2am on a Sunday.",
    name: "Sarah K.", role: "CEO, Momentum Marketing", stars: 5,
  },
  {
    quote: "The cold call agent booked 34 demos in the first week. My sales team thought I'd hired a full outbound team overnight.",
    name: "Derek L.", role: "VP Sales, Elevate Agency", stars: 5,
  },
];

const PRICING_PLANS = [
  {
    name: 'Starter', price: '$297', period: '/mo',
    desc: 'Perfect for solo operators and new agencies.',
    popular: false,
    features: [
      'AI Page Builder (5 pages/mo)',
      'Cold Call Agent (500 calls/mo)',
      'AI Answering Service',
      'Review Management',
      '1 User Seat',
      'Email Support',
    ],
    cta: 'Start Free Trial',
  },
  {
    name: 'Growth', price: '$597', period: '/mo',
    desc: 'For growing agencies ready to scale fast.',
    popular: true,
    features: [
      'AI Page Builder (Unlimited)',
      'Cold Call Agent (5,000 calls/mo)',
      'AI Answering Service (Unlimited)',
      'Review Management + Auto-Reply',
      'Scout Leads (500 leads/mo)',
      'CMO Agent',
      '5 User Seats',
      'Priority Support',
    ],
    cta: 'Start Free Trial',
  },
  {
    name: 'Agency', price: '$997', period: '/mo',
    desc: 'Full power for established agencies.',
    popular: false,
    features: [
      'Everything in Growth',
      'Cold Call Agent (Unlimited)',
      'Scout Leads (Unlimited)',
      'White-Label Option',
      'Custom AI Training',
      'Dedicated Account Manager',
      'Unlimited User Seats',
      'SLA Support',
    ],
    cta: 'Start Free Trial',
  },
];

const TRUST_BADGES = [
  { icon: <Shield size={16} />, text: 'No Credit Card Required' },
  { icon: <Check size={16} />, text: '14-Day Free Trial' },
  { icon: <Zap size={16} />, text: 'Setup in 10 Minutes' },
  { icon: <Users size={16} />, text: 'Cancel Anytime' },
];

const FOOTER_SOCIAL_ICONS = [Mail, Globe, MessageSquare];

const FOOTER_COLUMNS = [
  { title: 'Platform', links: ['AI Page Builder', 'Cold Call Agent', 'Answering Service', 'Review Management', 'Scout Leads', 'CMO Agent'] },
  { title: 'Company', links: ['About', 'Blog', 'Careers', 'Press', 'Contact'] },
  { title: 'Resources', links: ['Documentation', 'API', 'Case Studies', 'Webinars', 'Help Center'] },
  { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'GDPR'] },
];

const NAV_LINKS = ['platform', 'services', 'pricing', 'contact'];
const MOBILE_NAV_LINKS = ['Platform', 'Services', 'Pricing', 'Contact'];
const PHASE_STEPS = ['Connect', 'Research', 'Generate', 'Deploy'];

/* ════════════════════════════════════════════════════════════ */
export default function MarketingSitePage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filteredTools = activeFilter === 'All'
    ? TOOLS
    : TOOLS.filter(t => t.cat === activeFilter);

  /* section refs for fade-in */
  const defRef      = useFadeIn();
  const platformRef = useFadeIn();
  const voiceRef    = useFadeIn();
  const answerRef   = useFadeIn();
  const howRef      = useFadeIn();
  const proofRef    = useFadeIn();
  const pricingRef  = useFadeIn();

  return (
    <>
      {/* Inject global CSS */}
      <style>{GLOBAL_CSS}</style>

      {/* ── HAMBURGER MENU ── */}
      {menuOpen && (
        <div className="hamburger-menu">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <img src="/koto_logo.svg" alt="Koto" style={{ height: 32 }} />
            <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: WHITE }}>
              <X size={28} />
            </button>
          </div>
          {MOBILE_NAV_LINKS.map(l => (
            <button key={l} onClick={() => { setMenuOpen(false); document.getElementById(l.toLowerCase())?.scrollIntoView({ behavior: 'smooth' }); }}
              style={{ background: 'none', border: 'none', color: WHITE, fontSize: 28, fontWeight: 800, fontFamily: FB, letterSpacing: '-.02em', cursor: 'pointer', textAlign: 'left' }}>
              {l}
            </button>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
            <WhiteOutlineBtn onClick={() => { setMenuOpen(false); navigate('/login'); }}>Login</WhiteOutlineBtn>
            <RedBtn onClick={() => { setMenuOpen(false); navigate('/signup'); }}>Get Demo →</RedBtn>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* 1. NAV                                            */}
      {/* ══════════════════════════════════════════════════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 8000,
        background: BLACK,
        borderBottom: scrolled ? '1px solid rgba(255,255,255,.1)' : '1px solid transparent',
        transition: 'border-color .3s',
        padding: '0 48px',
        height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <img src="/koto_logo.svg" alt="Koto" style={{ height: 30, cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

        {/* Center links */}
        <div className="hide-mobile" style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
          {NAV_LINKS.map(id => (
            <button key={id} className="nav-link"
              onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}>
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>

        {/* Right CTAs */}
        <div className="hide-mobile" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="nav-link" onClick={() => navigate('/login')} style={{ color: WHITE }}>Login</button>
          <RedBtn onClick={() => navigate('/signup')} size="sm">Get Demo →</RedBtn>
        </div>

        {/* Mobile hamburger */}
        <button className="show-only-mobile" onClick={() => setMenuOpen(true)}
          style={{ background: 'none', border: 'none', color: WHITE, cursor: 'pointer' }}>
          <Menu size={26} />
        </button>
      </nav>

      {/* ══════════════════════════════════════════════════ */}
      {/* 2. HERO                                           */}
      {/* ══════════════════════════════════════════════════ */}
      <section style={{ background: BLACK, paddingTop: 0 }}>
        <div className="hero-pad" style={{
          maxWidth: 1100, margin: '0 auto',
          padding: '140px 48px 90px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', gap: 28,
        }}>
          {/* Label */}
          <SectionLabel dark>THE FUTURE OF AGENCY MANAGEMENT</SectionLabel>

          {/* Headline */}
          <h1 className="hero-headline" style={{
            fontSize: 78, fontWeight: 900, fontFamily: FB,
            letterSpacing: '-.045em', lineHeight: .95,
            color: WHITE, maxWidth: 780,
          }}>
            YOUR AGENCY<br />
            <span style={{ color: RED }}>NEEDS KOTO</span>
          </h1>

          {/* Sub */}
          <p style={{
            fontSize: 18, fontStyle: 'italic', color: 'rgba(255,255,255,.6)',
            fontFamily: FH, maxWidth: 520, lineHeight: 1.6,
          }}>
            <em>ko·to</em> — the intelligence layer for modern marketing agencies.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
            <RedBtn size="lg" onClick={() => navigate('/signup')}>
              Start Free Trial <ArrowRight size={17} />
            </RedBtn>
            <WhiteOutlineBtn size="lg" onClick={() => document.getElementById('platform')?.scrollIntoView({ behavior: 'smooth' })}>
              See it in action →
            </WhiteOutlineBtn>
          </div>

          {/* Stats */}
          <div className="hero-stats" style={{
            display: 'flex', gap: 48, marginTop: 48,
            borderTop: '1px solid rgba(255,255,255,.08)',
            paddingTop: 40, justifyContent: 'center', width: '100%',
          }}>
            {HERO_STATS.map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 44, fontWeight: 900, fontFamily: FB, letterSpacing: '-.04em', color: WHITE, lineHeight: 1 }}>
                  {s.num}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 6, letterSpacing: '.07em', textTransform: 'uppercase', fontWeight: 600 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Marquee ticker */}
        <Marquee items={HERO_TICKER} dark speed={22} />
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* 3. DEFINITION                                     */}
      {/* ══════════════════════════════════════════════════ */}
      <section ref={defRef} style={{ background: WHITE, padding: '96px 48px', textAlign: 'center' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ fontSize: 13, letterSpacing: '.18em', color: GRAY, textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>
            /ˈkōtō/
          </div>
          <h2 style={{ fontSize: 96, fontWeight: 900, fontFamily: FB, letterSpacing: '-.05em', color: BLACK, lineHeight: .9, marginBottom: 32 }}>
            KO·TO
          </h2>
          <div style={{
            fontSize: 15, color: GRAY, fontStyle: 'italic', marginBottom: 24, lineHeight: 1.7,
            borderLeft: `3px solid ${RED}`, paddingLeft: 20, textAlign: 'left', maxWidth: 480, margin: '0 auto 32px',
          }}>
            <em>noun.</em> An AI-powered command center that gives marketing agencies the tools,
            intelligence, and automation to scale faster than they ever thought possible.
          </div>
          <p style={{
            fontSize: 26, fontWeight: 900, fontFamily: FB, letterSpacing: '-.02em', color: BLACK, lineHeight: 1.3,
          }}>
            "Stop managing your agency.<br />
            <span style={{ color: RED }}>Let Koto run it for you.</span>"
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* 4. PLATFORM OVERVIEW                              */}
      {/* ══════════════════════════════════════════════════ */}
      <section ref={platformRef} id="platform" style={{ background: WHITE, padding: '96px 48px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ marginBottom: 52, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
            <SectionLabel>// THE TOOLS WE GIVE YOU</SectionLabel>
            <h2 style={{
              fontSize: 64, fontWeight: 900, fontFamily: FB, letterSpacing: '-.045em',
              color: BLACK, lineHeight: .95, marginBottom: 32,
            }}>
              YOUR AGENCY<br />ARSENAL
            </h2>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button key={c} className={`pill-filter${activeFilter === c ? ' active' : ''}`}
                  onClick={() => setActiveFilter(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Tool cards grid */}
          <div className="tools-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
          }}>
            {filteredTools.map(t => (
              <div key={t.num} className="tool-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: 13, fontWeight: 900, color: 'rgba(0,0,0,.18)',
                    fontFamily: FB, letterSpacing: '.04em',
                  }}>{t.num}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '.1em',
                    textTransform: 'uppercase', color: RED,
                    background: RED + '12', padding: '4px 10px', borderRadius: 100,
                    border: `1px solid ${RED}30`,
                  }}>{t.cat}</span>
                </div>
                <div style={{ color: RED }}>{t.icon}</div>
                <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: FB, letterSpacing: '-.02em', color: BLACK }}>
                  {t.title}
                </h3>
                <p style={{ fontSize: 14, color: GRAY, lineHeight: 1.65 }}>{t.desc}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {t.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
                      textTransform: 'uppercase', color: '#374151',
                      background: '#f3f4f6', padding: '4px 10px', borderRadius: 6,
                    }}>{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* 5. VOICE SPOTLIGHT                                */}
      {/* ══════════════════════════════════════════════════ */}
      <section ref={voiceRef} id="services" style={{ background: BLACK, padding: '96px 48px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <SectionLabel dark>// OUTBOUND INTELLIGENCE</SectionLabel>
          <h2 style={{
            fontSize: 64, fontWeight: 900, fontFamily: FB, letterSpacing: '-.045em',
            color: WHITE, lineHeight: .95, marginBottom: 56, maxWidth: 680,
          }}>
            YOUR AI SALES TEAM<br />
            <span style={{ color: RED }}>NEVER SLEEPS</span>
          </h2>

          <div className="voice-inner" style={{ display: 'flex', gap: 64, alignItems: 'flex-start' }}>
            {/* Left: bullets */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>
              {VOICE_BULLETS.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 36, background: RED, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Check size={18} color={WHITE} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: WHITE, fontFamily: FB, marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <RedBtn size="lg" onClick={() => navigate('/signup')}>
                  Activate Your AI Sales Team <ArrowRight size={17} />
                </RedBtn>
              </div>
            </div>

            {/* Right: stats */}
            <div style={{
              flex: '0 0 360px', background: 'rgba(255,255,255,.04)',
              border: '1.5px solid rgba(255,255,255,.1)', borderRadius: 20, padding: 40,
              display: 'flex', flexDirection: 'column', gap: 32,
            }}>
              {VOICE_STATS.map(s => (
                <div key={s.label} style={{ borderBottom: '1px solid rgba(255,255,255,.07)', paddingBottom: 24 }}>
                  <div style={{ fontSize: 48, fontWeight: 900, fontFamily: FB, letterSpacing: '-.04em', color: RED, lineHeight: 1 }}>{s.num}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginTop: 6, lineHeight: 1.4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* 6. ANSWERING SPOTLIGHT                            */}
      {/* ══════════════════════════════════════════════════ */}
      <section ref={answerRef} style={{ background: WHITE, paddingTop: '96px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 48px 64px' }}>
          <SectionLabel>// INBOUND INTELLIGENCE</SectionLabel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 24, marginBottom: 56 }}>
            <h2 style={{
              fontSize: 64, fontWeight: 900, fontFamily: FB, letterSpacing: '-.045em',
              color: BLACK, lineHeight: .95, maxWidth: 600,
            }}>
              NEVER MISS<br />
              <span style={{ color: RED }}>ANOTHER CALL</span>
            </h2>
            <p style={{ fontSize: 16, color: GRAY, lineHeight: 1.7, maxWidth: 360 }}>
              Your AI answering service is live 24/7 — greeting callers, capturing leads,
              routing to the right team, and handling FAQs without a single human touch.
            </p>
          </div>
        </div>

        {/* Industry pill marquee */}
        <Marquee items={INDUSTRIES} dark={false} reverse speed={36} />

        {/* Feature cards */}
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '64px 48px 96px' }}>
          <div className="feature-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
            {ANSWER_FEATURES.map((c, i) => (
              <div key={i} className="feature-card">
                <div style={{ marginBottom: 16 }}>{c.icon}</div>
                <h3 style={{ fontSize: 20, fontWeight: 800, fontFamily: FB, letterSpacing: '-.02em', color: BLACK, marginBottom: 10 }}>{c.title}</h3>
                <p style={{ fontSize: 14, color: GRAY, lineHeight: 1.65 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* 7. HOW IT WORKS                                   */}
      {/* ══════════════════════════════════════════════════ */}
      <section ref={howRef} style={{ background: BLACK, padding: '96px 48px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <SectionLabel dark>// FOUR PHASES TO SCALE</SectionLabel>
          <h2 style={{
            fontSize: 64, fontWeight: 900, fontFamily: FB, letterSpacing: '-.045em',
            color: WHITE, lineHeight: .95, marginBottom: 56,
          }}>
            HOW KOTO<br />
            <span style={{ color: RED }}>WORKS</span>
          </h2>

          <div className="phases-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
            {PHASES.map(p => (
              <div key={p.num} className="phase-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,.2)', fontFamily: FB, letterSpacing: '.04em' }}>{p.num}</span>
                  {p.icon}
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 900, fontFamily: FB, letterSpacing: '-.03em', color: WHITE, marginBottom: 12 }}>
                  {p.title}
                </h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', lineHeight: 1.65 }}>{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Connector line (desktop only) */}
          <div className="hide-mobile" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 32, gap: 0,
          }}>
            {PHASE_STEPS.map((step, i, arr) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: i === 0 ? RED : 'rgba(255,255,255,.2)',
                  boxShadow: i === 0 ? `0 0 0 3px ${RED}30` : 'none',
                }} />
                {i < arr.length - 1 && (
                  <div style={{ width: 240, height: 1, background: 'rgba(255,255,255,.1)' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* 8. PROOF                                          */}
      {/* ══════════════════════════════════════════════════ */}
      <section ref={proofRef} style={{ background: WHITE, padding: '96px 48px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <SectionLabel>// KOTO IN NUMBERS</SectionLabel>
          <h2 style={{
            fontSize: 64, fontWeight: 900, fontFamily: FB, letterSpacing: '-.045em',
            color: BLACK, lineHeight: .95, marginBottom: 64,
          }}>
            PROOF OF<br />PERFORMANCE
          </h2>

          {/* Animated stats */}
          <div className="proof-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 32,
            marginBottom: 80,
          }}>
            {PROOF_STATS.map(s => (
              <div key={s.label} style={{
                textAlign: 'center', padding: '32px 20px',
                borderRadius: 16, background: '#f9fafb',
                border: '1.5px solid #e5e7eb',
              }}>
                <AnimatedStat value={s.value} label={s.label} suffix={s.suffix} />
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="testimonial-card">
                <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
                  {[...Array(t.stars)].map((_, j) => <Star key={j} size={14} color={RED} fill={RED} />)}
                </div>
                <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, marginBottom: 20, fontStyle: 'italic' }}>
                  "{t.quote}"
                </p>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: BLACK }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* 9. PRICING                                        */}
      {/* ══════════════════════════════════════════════════ */}
      <section ref={pricingRef} id="pricing" style={{ background: WHITE, padding: '96px 48px', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <SectionLabel>// SIMPLE PRICING</SectionLabel>
            <h2 style={{
              fontSize: 64, fontWeight: 900, fontFamily: FB, letterSpacing: '-.045em',
              color: BLACK, lineHeight: .95, marginBottom: 16,
            }}>
              ONE PLATFORM.<br />THREE PLANS.
            </h2>
            <p style={{ fontSize: 16, color: GRAY }}>No contracts. Cancel anytime. All plans include a 14-day free trial.</p>
          </div>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, alignItems: 'start' }}>
            {PRICING_PLANS.map((plan, i) => (
              <div key={plan.name} className={`pricing-card${plan.popular ? ' popular' : ''}`}>
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                    background: RED, color: WHITE, fontSize: 11, fontWeight: 800,
                    letterSpacing: '.1em', textTransform: 'uppercase',
                    padding: '6px 20px', borderRadius: '0 0 10px 10px',
                  }}>
                    Most Popular
                  </div>
                )}
                <div style={{ paddingTop: plan.popular ? 16 : 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: GRAY, marginBottom: 8 }}>
                    {plan.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                    <span style={{ fontSize: 52, fontWeight: 900, fontFamily: FB, letterSpacing: '-.04em', color: BLACK }}>{plan.price}</span>
                    <span style={{ fontSize: 15, color: GRAY }}>{plan.period}</span>
                  </div>
                  <p style={{ fontSize: 14, color: GRAY, marginBottom: 28, lineHeight: 1.5 }}>{plan.desc}</p>

                  <RedBtn
                    onClick={() => navigate('/signup')}
                    style={{ width: '100%', justifyContent: 'center', marginBottom: 28 }}
                    outline={!plan.popular}
                  >
                    {plan.cta} <ChevronRight size={15} />
                  </RedBtn>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%',
                          background: plan.popular ? RED + '15' : '#f3f4f6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                        }}>
                          <Check size={11} color={plan.popular ? RED : GRAY} />
                        </div>
                        <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* 10. FINAL CTA                                     */}
      {/* ══════════════════════════════════════════════════ */}
      <section style={{ background: BLACK, padding: '112px 48px', textAlign: 'center' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <SectionLabel dark>// GET STARTED TODAY</SectionLabel>
          <h2 style={{
            fontSize: 68, fontWeight: 900, fontFamily: FB, letterSpacing: '-.045em',
            color: WHITE, lineHeight: .92, marginBottom: 24,
          }}>
            READY TO BUILD<br />YOUR AGENCY'S<br />
            <span style={{ color: RED }}>FUTURE?</span>
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,.55)', lineHeight: 1.7, marginBottom: 44, maxWidth: 480, margin: '0 auto 44px' }}>
            Join 247+ agencies already using Koto to automate growth, win more clients, and reclaim their time.
          </p>
          <RedBtn size="lg" onClick={() => navigate('/signup')} style={{ animation: 'pulse-red 2.5s ease-in-out infinite', marginBottom: 40 }}>
            Start Your Free Trial <ArrowRight size={18} />
          </RedBtn>

          {/* Trust badges */}
          <div style={{
            display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap',
            marginTop: 48, paddingTop: 40, borderTop: '1px solid rgba(255,255,255,.08)',
          }}>
            {TRUST_BADGES.map(b => (
              <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,.45)', fontSize: 13, fontWeight: 600 }}>
                {b.icon}{b.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* 11. FOOTER                                        */}
      {/* ══════════════════════════════════════════════════ */}
      <footer id="contact" style={{ background: '#080808', padding: '72px 48px 40px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div className="footer-grid" style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 40, marginBottom: 64,
          }}>
            {/* Brand */}
            <div>
              <img src="/koto_logo.svg" alt="Koto" style={{ height: 28, marginBottom: 16 }} />
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', lineHeight: 1.7, maxWidth: 260 }}>
                The intelligence layer for modern marketing agencies. Built to scale, designed to win.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                {FOOTER_SOCIAL_ICONS.map((Icon, i) => (
                  <button key={i} style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'rgba(255,255,255,.5)',
                    transition: 'all .2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = RED; e.currentTarget.style.borderColor = RED; e.currentTarget.style.color = WHITE; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'; e.currentTarget.style.color = 'rgba(255,255,255,.5)'; }}
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {FOOTER_COLUMNS.map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 16 }}>
                  {col.title}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map(l => (
                    <a key={l} href="#" style={{
                      fontSize: 13, color: 'rgba(255,255,255,.5)', textDecoration: 'none',
                      transition: 'color .2s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = WHITE}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.5)'}
                    >{l}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 28,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.25)' }}>
              © 2026 Koto Technologies, Inc. All rights reserved. · hellokoto.com
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse-red 2s ease-in-out infinite' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.25)' }}>All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
