"use client";
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, X, ArrowRight, Check, Phone, MessageSquare,
  BarChart2, Zap, Star, Search, Globe, TrendingUp, Cpu,
  Database, Network, Sparkles, Target, FileText, MapPin,
  Eye, Layers, Activity, MessageCircle, Mail, Send, Loader,
  Car, Scale, Wrench, Home, Droplet, Dumbbell, Utensils,
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

  /* ── Mock screen animations ── */
  @keyframes pulseDot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: .5; transform: scale(1.15); }
  }
  @keyframes fillBar {
    from { width: 0%; }
  }
  @keyframes countFlash {
    0%   { opacity: 0; transform: translateY(6px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes rowSweep {
    0%, 92%, 100% { background: transparent; }
    40%, 70%      { background: ${R}08; }
  }
  @keyframes blink {
    0%, 50%   { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  @keyframes typingDot {
    0%, 60%, 100% { opacity: .3; transform: translateY(0); }
    30%           { opacity: 1; transform: translateY(-3px); }
  }
  @keyframes streamIn {
    from { clip-path: inset(0 100% 0 0); }
    to   { clip-path: inset(0 0    0 0); }
  }
  @keyframes cellFlash {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 transparent; }
    50%      { transform: scale(1.08); box-shadow: 0 0 0 2px currentColor; }
  }
  @keyframes ring {
    from { stroke-dashoffset: 283; }
    to   { stroke-dashoffset: var(--ring-target, 79); }
  }
  @keyframes drift {
    0%, 100% { transform: translate(0, 0); }
    50%      { transform: translate(-4px, -4px); }
  }
  @keyframes orbPulse {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: .85; }
    33%      { transform: translate(40px, -20px) scale(1.08); opacity: 1; }
    66%      { transform: translate(-30px, 30px) scale(.92); opacity: .75; }
  }
  @keyframes orbSlide {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(-50px, 40px) scale(1.12); }
  }
  @keyframes auroraSpin {
    0%   { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(360deg); }
  }

  .dot-1 { animation: typingDot 1.2s infinite; animation-delay: 0s; }
  .dot-2 { animation: typingDot 1.2s infinite; animation-delay: .15s; }
  .dot-3 { animation: typingDot 1.2s infinite; animation-delay: .3s; }

  .mock-row-1 { animation: rowSweep 5s infinite; animation-delay: 0s; }
  .mock-row-2 { animation: rowSweep 5s infinite; animation-delay: 1.2s; }
  .mock-row-3 { animation: rowSweep 5s infinite; animation-delay: 2.4s; }
  .mock-row-4 { animation: rowSweep 5s infinite; animation-delay: 3.6s; }

  .mock-screen {
    background: ${W}; border: 1px solid ${HAIR}; border-radius: 16px;
    overflow: hidden; position: relative; box-shadow: 0 24px 48px rgba(17,17,17,.08), 0 4px 12px rgba(17,17,17,.04);
  }
  .mock-header {
    display: flex; align-items: center; gap: 6px; padding: 12px 16px;
    border-bottom: 1px solid ${HAIR}; background: ${WASH};
  }
  .mock-dot { width: 9px; height: 9px; border-radius: 50%; }

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
    .hero { padding: 140px 24px 72px !important; }
    .nav-pad { padding: 0 24px !important; }
    .footer-pad { padding: 56px 24px 32px !important; }
    .split { flex-direction: column !important; }
    .stats-row { grid-template-columns: 1fr 1fr !important; gap: 24px !important; }
    .agent-card { grid-template-columns: 1fr !important; gap: 24px !important; padding: 28px !important; }
    .agent-card > div:last-child { border-left: none !important; border-top: 1px solid ${HAIR}; padding-left: 0 !important; padding-top: 24px !important; }
    .mock-grid { grid-template-columns: 1fr !important; }
    .mock-hero { grid-template-columns: 1fr !important; }
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
  { num: '645k',  label: 'Businesses analyzed' },
  { num: '4.2M',  label: 'Opportunities surfaced' },
  { num: '12+',   label: 'Live data sources' },
  { num: '<3s',   label: 'Avg response time' },
];

const PROOF_STATS = [
  { value: '645,000', label: 'Businesses analyzed' },
  { value: '4.2M',    label: 'Opportunities surfaced' },
  { value: '25+',     label: 'Specialized AI engines' },
  { value: '99.9%',   label: 'Target uptime' },
];

const ENTERPRISE_FEATURES = [
  { title: 'Bank-level encryption',   desc: 'All data encrypted in transit and at rest. Keys rotated on schedule.' },
  { title: 'Role-based access',        desc: 'Granular permissions per team member. SSO-ready for enterprise plans.' },
  { title: 'Full audit trail',         desc: 'Every AI action, edit, and export is logged and exportable for compliance.' },
  { title: 'Isolated client data',     desc: "Your clients' data never leaves your workspace. Zero cross-agency bleed." },
  { title: 'US-hosted infrastructure', desc: 'Data stays in US regions. Single-tenant isolation available on Agency plan.' },
  { title: 'GDPR & CCPA aware',        desc: 'Data subject requests handled with built-in tooling for export and deletion.' },
];

const PHASES = [
  { num: '01', title: 'Connect',  desc: 'Link your CRM, phone system, and existing tools in minutes. No-code integrations.',      icon: Zap },
  { num: '02', title: 'Research', desc: 'Koto audits your market, competitors, and prospects to build a data-driven blueprint.', icon: Search },
  { num: '03', title: 'Generate', desc: 'AI creates pages, sequences, scripts, and campaigns tailored to your exact market.',    icon: Cpu },
  { num: '04', title: 'Deploy',   desc: 'Launch AI agents that call, answer, build, review, and optimize — without a break.',   icon: TrendingUp },
];

/* ─── KotoIQ engine — the search intelligence system ─── */
const IQ_PIPELINE = [
  {
    num: '01', title: 'Ingest', icon: Database,
    headline: 'Live data from 12+ sources',
    desc: 'OAuth connections pull real-time data from Google Search Console, Analytics 4, Ads, and Business Profile. DataForSEO powers SERP scans, rank grids, and AI Overview detection. Moz supplies Domain Authority, backlinks, and spam scores. Your sitemap feeds every indexed page into the pipeline.',
    items: ['Search Console', 'Analytics 4', 'Google Ads', 'Business Profile', 'DataForSEO', 'Moz', 'Sitemap Crawl', 'SERP APIs'],
  },
  {
    num: '02', title: 'Analyze', icon: Network,
    headline: '25+ specialized engines run in parallel',
    desc: 'Each engine is a focused reasoning agent. Semantic agents score topical authority. Rank Grid Pro maps geo-spatial visibility cell by cell. Competitor Watch tracks share-of-voice shifts. Content Decay finds pages bleeding traffic. E-E-A-T scoring grades every page against Google quality guidelines.',
    items: ['AI Visibility', 'Quick Wins', 'Rank Grid Pro', 'Competitor Watch', 'Semantic Agents', 'Content Decay', 'E-E-A-T Scoring', 'Backlink Intel'],
  },
  {
    num: '03', title: 'Synthesize', icon: Sparkles,
    headline: 'The right AI model for the right job',
    desc: 'Fast structured lookups route to Claude Haiku. Deep reasoning and strategic analysis go to Claude Opus. Content generation and briefs use Claude Sonnet. For heavy research, the Multi-AI Blender runs parallel queries across models and reconciles the answers.',
    items: ['Claude Opus', 'Claude Sonnet', 'Claude Haiku', 'Multi-AI Blender', 'Cost-routed', 'Context-aware', 'Token-tracked', 'Grounded in data'],
  },
  {
    num: '04', title: 'Act', icon: Target,
    headline: 'Prioritized, client-ready actions',
    desc: 'The engine outputs a ranked Quick Win queue with traffic and revenue estimates. Content briefs come with page structure, entity coverage, and rotation-ready paragraphs. GMB posts draft themselves. Competitor intel arrives as a one-pager. Every recommendation cites the source data.',
    items: ['Quick Win Queue', 'Content Briefs', 'GMB Posts', 'Rank Reports', 'AI Visibility Score', 'Ask KotoIQ Chat', 'Client Portals', 'Full Audits'],
  },
];

const IQ_CAPABILITIES = [
  { title: 'AI Visibility Score',  desc: 'A 0–100 grade across semantic coverage, entity presence, E-E-A-T, and SERP feature capture.',        icon: Eye },
  { title: 'Quick Win Queue',      desc: 'Keywords ranked by effort vs. traffic uplift — prioritized so you work on what moves the needle.',   icon: Zap },
  { title: 'Rank Grid Pro',        desc: 'Geo-spatial ranking heatmaps for local SEO. See exactly where you rank at every grid cell.',         icon: MapPin },
  { title: 'Competitor Watch',     desc: 'Monitors competitor movements automatically and alerts you to share-of-voice shifts.',                icon: Activity },
  { title: 'Content Briefs',       desc: 'Claude-generated briefs with page structure, entity coverage, and rotation-ready variants.',          icon: FileText },
  { title: 'Ask KotoIQ',           desc: 'A conversational interface that answers strategic questions grounded in your live data.',            icon: MessageCircle },
  { title: 'Semantic Agents',      desc: 'Topical authority analysis across hundreds of entities and sub-topics per client.',                   icon: Layers },
  { title: 'Multi-AI Blender',     desc: 'Heavy research queries run across Opus, Sonnet, and Haiku in parallel, then reconcile.',              icon: Sparkles },
];

/* ─── Koto AI Agents — plain-English overviews + real use cases ─── */
const AGENTS = [
  {
    tag: 'Outbound', title: 'Cold Call Agent', icon: Phone, accent: R,
    headline: 'AI that dials, qualifies, and books — all day.',
    desc: 'Hand Koto a list of leads. It calls every one of them, handles the small talk, qualifies interest, answers questions, and books the ready ones straight onto your calendar. It never gets tired, never leaves early, and never skips a follow-up.',
    cases: [
      { title: 'Home services agency', scenario: 'A roofing agency has 2,000 storm-damage leads. Koto calls all of them in a week, qualifies interest, and books 68 inspections without a single human dial.' },
      { title: 'Law firm', scenario: 'Web leads that come in after 5pm used to sit until morning. Now Koto calls each one within 60 seconds — 40% more consults booked.' },
      { title: 'Insurance broker', scenario: 'Reactivating 5-year-old aged leads by hand used to be a slog. Koto works the whole list and recaptures 120 policies in one week.' },
    ],
  },
  {
    tag: 'Onboarding', title: 'Virtual Onboarding', icon: MessageCircle, accent: T,
    headline: 'New clients onboard themselves — by phone.',
    desc: 'Every new client gets their own phone number to call. Koto\'s onboarding agent interviews them, answers their questions, and fills out your onboarding document while they talk. No more chasing clients to finish a form.',
    cases: [
      { title: 'Dental marketing agency', scenario: 'You sign a new client on Tuesday. By Wednesday they\'ve spent 18 minutes on the phone with Koto — and you have a 20-page onboarding doc ready without anyone on your team lifting a finger.' },
      { title: 'Stalled form', scenario: 'A client started the web form and never finished. They call in later, Koto already knows which 6 questions are still missing and only asks those.' },
      { title: 'Non-tech clients', scenario: 'Contractors and restaurant owners would rather talk than type. They pick up the phone, Koto gathers everything, and the agency team gets the finished doc by email.' },
    ],
  },
  {
    tag: 'Discovery', title: 'Live Discovery Sessions', icon: Layers, accent: BLK,
    headline: 'An AI coach in the room for every discovery call.',
    desc: 'Start a live session and Koto listens in. It transcribes in real time, suggests the next question to ask, and builds the strategy document as the conversation unfolds. You walk out of the call with a finished discovery doc instead of a blank page.',
    cases: [
      { title: 'New account kickoff', scenario: 'On a Zoom kickoff with a new client, Koto quietly builds the 12-section strategy doc in the background. The moment the call ends, you send it.' },
      { title: 'Mid-call nudge', scenario: 'Halfway through discovery you realize you never asked about budget. Koto already flagged it in the sidebar — one click to bring it up.' },
      { title: 'Junior strategists', scenario: 'A newer team member runs the call. Koto\'s coaching prompts keep them on track, surfacing follow-ups they wouldn\'t have thought of.' },
    ],
  },
  {
    tag: 'Inbound', title: 'AI Front Desk', icon: MessageSquare, accent: AMB,
    headline: 'Your 24/7 receptionist that never misses a call.',
    desc: 'Koto answers every inbound call, sounds like a real front-desk person, schedules appointments, answers common questions, takes messages for urgent ones, and hands off cleanly to a human when needed. Your after-hours and overflow calls stop going to voicemail.',
    cases: [
      { title: 'Dental office after-hours', scenario: 'A patient with a cracked tooth calls at 9pm. Koto answers warmly, finds an opening Tuesday morning, and books it. No callback chain the next day — the appointment is already on the schedule.' },
      { title: 'Law firm intake', scenario: 'An inbound lead calls the firm. Koto qualifies the case type, captures the key facts, schedules the consult, and the attorney walks into Monday morning with six intake summaries ready to review.' },
      { title: 'HVAC overflow', scenario: 'A heat wave hits and every phone is ringing. Koto takes the overflow, schedules tune-ups, and books emergency service calls — zero busy signals, zero lost jobs.' },
    ],
  },
  {
    tag: 'Healthcare', title: 'Verification of Benefits (VOB)', icon: Activity, accent: GRN,
    headline: 'Koto calls the insurance company for you.',
    desc: 'Instead of your front desk spending hours on hold, Koto dials the insurance company, waits through the IVR, talks to the rep, and comes back with a verified benefits report — deductibles, copays, prior auth, the whole sheet — ready for intake.',
    cases: [
      { title: 'Physical therapy clinic', scenario: '40 new patients to verify today. Koto runs all 40 calls in parallel. By 11am the front desk has every deductible, copay, and prior-auth status in hand.' },
      { title: 'Behavioral health practice', scenario: 'Used to burn 20 hours a week on VOB. Now that time goes to patient care — Koto handles the calls and fills the intake sheet.' },
      { title: 'Dental office', scenario: 'A patient schedules same-day. Koto verifies coverage in the background and the front desk has the answer before the patient walks in.' },
    ],
  },
];

const VOICE_BULLETS = [
  { title: 'Human-sounding AI calls',   desc: 'Hyper-realistic voice AI that qualifies prospects and books meetings without a human in the loop.' },
  { title: 'Unlimited concurrent calls',desc: 'Scale to hundreds of simultaneous calls. No hiring, no burnout.' },
  { title: 'Real-time CRM updates',     desc: 'Every call transcribed, scored, and synced to your CRM automatically.' },
  { title: 'Smart follow-up sequences', desc: 'Automated multi-touch follow-up triggered by call outcomes.' },
];

const PRICING_PLANS = [
  {
    name: 'Starter', price: '$297', period: '/mo',
    desc: 'For solo operators and new agencies.',
    popular: false,
    features: ['3 team seats', 'Up to 25 clients', 'AI review responses', 'Scout lead intelligence', 'Client onboarding forms'],
  },
  {
    name: 'Growth', price: '$497', period: '/mo',
    desc: 'For growing agencies ready to scale fast.',
    popular: true,
    features: ['10 team seats', 'Up to 100 clients', 'Everything in Starter', 'Agency Autopilot (all 6 agents)', 'White-label platform', 'Social content AI'],
  },
  {
    name: 'Agency', price: '$997', period: '/mo',
    desc: 'Full power for established agencies.',
    popular: false,
    features: ['25 team seats', 'Up to 500 clients', 'Everything in Growth', 'Lead scoring AI', 'API access', 'Priority support'],
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
    { label: 'About', href: '/about' },
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
  { id: 'kotoiq',   label: 'KotoIQ' },
  { id: 'agents',   label: 'AI Agents' },
  { id: 'pricing',  label: 'Pricing' },
];

/* ─── Palette aliases available in module scope ─── */
const INK_C     = BLK;
const MUTED_C   = '#6b7280';
const FAINT_C   = '#9ca3af';
const HAIR_C    = '#e5e7eb';
const SURFACE_C = '#f9fafb';
const WASH_C    = '#fafbfc';

/* ─── Molecule / particle network — canvas-driven "constellation" backdrop ─── */
function ParticleNetwork({
  count = 42, maxDist = 140, speed = 0.35,
  color1 = '#E6007E', color2 = '#00C2CB',
  lineColor = '230, 0, 126', // RGB tuple used in rgba()
  style = {},
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect reduced motion
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0, height = 0;
    const particles = [];

    function resize() {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    function seed() {
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * speed,
          vy: (Math.random() - 0.5) * speed,
          r: 1.5 + Math.random() * 2.2,
          color: Math.random() > 0.5 ? color1 : color2,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    resize();
    seed();

    let rafId = 0;
    let lastT = performance.now();

    function tick(now) {
      const dt = Math.min(32, now - lastT);
      lastT = now;

      ctx.clearRect(0, 0, width, height);

      // Update
      if (!prefersReduced) {
        for (const p of particles) {
          p.x += p.vx * (dt / 16);
          p.y += p.vy * (dt / 16);
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          if (p.y > height + 20) p.y = -20;
          p.phase += 0.02;
        }
      }

      // Connections
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          const max2 = maxDist * maxDist;
          if (d2 < max2) {
            const alpha = (1 - Math.sqrt(d2) / maxDist) * 0.28;
            ctx.strokeStyle = `rgba(${lineColor}, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Nodes
      for (const p of particles) {
        const pulse = 0.75 + Math.sin(p.phase) * 0.25;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.55 * pulse;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        // Halo
        ctx.globalAlpha = 0.14 * pulse;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    const onResize = () => { resize(); seed(); };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, [count, maxDist, speed, color1, color2, lineColor]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', ...style,
      }}
    />
  );
}

/* ─── Demo chat — FULLY SANDBOXED, never hits real APIs or real data ─── */
const DEMO_SCENARIOS = [
  {
    triggers: ['traffic', 'down', 'drop', 'decline', 'decreas'],
    text: 'Organic traffic is down 12% this month on your **dental** sample client. The biggest losses: **dental implants** (-34%), **invisalign near me** (-22%), and **emergency dentist** (-18%). A competitor published fresh pillar content and pushed these pages out of the AI Overview citations. Refreshing those three pages would recover most of the loss — I can draft the content briefs for you.',
    sources: ['Search Console', 'Analytics 4', 'SERP Snapshot'],
  },
  {
    triggers: ['keyword', 'opportunit', 'quick win', 'low hanging', 'easy win'],
    text: 'Your top **quick wins** this week (sample client): **emergency dentist miami** (#11 → #4, est. +1,840 visits/mo), **dental implants cost** (#9 → #3, +2,110/mo), **invisalign near me** (#14 → #6, +1,220/mo). Combined estimated revenue lift: **+$12.4k/month** at current conversion rates.',
    sources: ['Search Console', 'Keyword Metrics', 'DataForSEO'],
  },
  {
    triggers: ['competit', 'compare', 'rival', 'vs '],
    text: 'Your top 3 competitors by share of voice (sample data): **BriteSmile** is up +14% this month — they just published 4 new service pages targeting your long-tail terms. **Miami Smile Studio** gained +6% on branded search. **Downtown Dental Clinic** dropped -3% after a site migration. BriteSmile is your priority threat.',
    sources: ['SERP Snapshot', 'Competitor Intelligence'],
  },
  {
    triggers: ['review', 'gmb', 'business profile', 'reputation', 'star'],
    text: 'Sample client Google Business Profile: **4.6 stars** across **47 reviews** (+3 this month). Sentiment dipped slightly — two new 3-star reviews mention wait times. I drafted reply copy for both. Your recent positive reviews cluster around "painless" and "thorough" — great signals to lean into on your landing pages.',
    sources: ['Business Profile', 'Review Sentiment'],
  },
  {
    triggers: ['local', 'grid', 'map', 'near me'],
    text: 'The 5-mile geo-grid for **"emergency dentist"** on the sample client averages **#4.2**. Strong coverage in Brickell (avg #2) and Coconut Grove (avg #3), but weak visibility north of 79th Street (avg #11). Three neighborhood landing pages would likely close the gap.',
    sources: ['Rank Grid', 'Local SERP'],
  },
  {
    triggers: ['ads', 'ppc', 'paid', 'cpc', 'adwords', 'google ads'],
    text: 'Sample client Google Ads last 30 days: **$4,217 spend**, **2.1% conversion rate**, **$47 cost-per-acquisition**. Your "emergency dentist" ad group is the star (3.8% CVR, $28 CPA). "Teeth whitening" is bleeding — zero conversions on $612 spend. I would pause that ad group and reallocate to the implant campaign.',
    sources: ['Google Ads', 'Conversion Tracking'],
  },
  {
    triggers: ['content', 'brief', 'write', 'blog', 'page'],
    text: 'Based on the sample client\'s keyword gaps, your next content priorities are: (1) a pillar page on **dental implant financing** (high commercial intent, competitors weak), (2) a comparison: **Invisalign vs. traditional braces for adults**, (3) a location page for **Coral Gables emergency dentistry**. I can generate full briefs with structure, entity coverage, and FAQ schema.',
    sources: ['Keyword Gaps', 'Content Decay', 'SERP Analysis'],
  },
  {
    triggers: ['score', 'visibility', 'ai visibility', 'rating'],
    text: 'Sample client **AI Visibility Score: 72/100 (grade B+)**, up +4 points this week. Sub-scores: Semantic coverage **78**, Entity presence **65**, E-E-A-T signals **71**, SERP features **74**. The biggest lift available is on **Entity presence** — adding structured data for your services and location would likely push the overall score to A.',
    sources: ['AI Visibility Engine', 'Semantic Agents'],
  },
];

const DEMO_FALLBACK = {
  text: "I'm in **demo mode** using sample data for a fictional dental client — I'm not connected to any real account here on the marketing site. Try asking me about **traffic drops**, **keyword opportunities**, **competitors**, **Google reviews**, **local rankings**, or **Google Ads performance**. Or start a free trial to get real answers on your own clients.",
  sources: ['Demo mode'],
};

const DEMO_SUGGESTIONS = [
  'Why is traffic down this month?',
  'What are my biggest keyword opportunities?',
  'How do I compare to competitors?',
  'How are my Google reviews doing?',
];

function matchDemoScenario(query) {
  const q = query.toLowerCase();
  for (const s of DEMO_SCENARIOS) {
    if (s.triggers.some(t => q.includes(t))) return s;
  }
  return DEMO_FALLBACK;
}

// Renders markdown-lite text with **bold** segments
function renderBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} style={{ color: INK_C }}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

/* ─── Custom-build examples — dummy industries / descriptions ─── */
const CUSTOM_EXAMPLES = [
  {
    title: 'Auto Collision Estimator', industry: 'Body shop', icon: Car, accent: BLK,
    desc: 'Customer snaps 4 photos of the damage. AI identifies parts, pulls labor times, and returns an insurance-ready estimate in 90 seconds.',
  },
  {
    title: 'Legal Intake Concierge', industry: 'Law firm', icon: Scale, accent: T,
    desc: 'Qualifies every inbound caller by matter type, runs the conflict check, and schedules the consult with the right attorney.',
  },
  {
    title: 'HVAC Dispatch Assistant', industry: 'HVAC', icon: Wrench, accent: AMB,
    desc: 'Triages service calls by urgency, checks parts inventory, and routes the nearest tech with the right certification.',
  },
  {
    title: 'Real Estate Offer Analyzer', industry: 'Real estate', icon: Home, accent: GRN,
    desc: 'Pulls comps, reads seller motivations from the listing, and drafts the offer strategy with three negotiation angles.',
  },
  {
    title: 'Pool Service Quoter', industry: 'Pool maintenance', icon: Droplet, accent: T,
    desc: 'Customer texts a pool photo and dimensions. AI returns a monthly service quote by text within seconds.',
  },
  {
    title: 'Gym Tour Scheduler', industry: 'Fitness', icon: Dumbbell, accent: R,
    desc: 'Matches prospects to trainers based on goals, books the tour, and sends a custom starter workout before they arrive.',
  },
];

/* ─── Catering Quoter — animated demo cycles every ~22s ─── */
const CATERING_FIELDS = [
  { step: 1, label: 'Event type',    value: 'Wedding reception' },
  { step: 2, label: 'Date',          value: 'June 14, 2026 · Saturday evening' },
  { step: 3, label: 'Guest count',   value: '180 guests' },
  { step: 4, label: 'Service style', value: 'Plated dinner · 3 courses' },
  { step: 5, label: 'Venue',         value: 'Rosewood Gardens, Miami FL' },
  { step: 6, label: 'Dietary notes', value: '12 vegetarian · 4 gluten-free · 2 vegan' },
];

const CATERING_LINES = [
  { step: 10, label: 'Plated dinner × 180 guests',     amount: 5940 },
  { step: 11, label: 'Open bar service (6 hours)',      amount: 2100 },
  { step: 12, label: 'Service staff (14 servers)',      amount: 1680 },
  { step: 13, label: 'Dietary accommodations',          amount: 340 },
  { step: 14, label: 'Venue setup + breakdown',         amount: 850 },
];

const CATERING_SUBTOTAL = CATERING_LINES.reduce((s, l) => s + l.amount, 0); // 10,910
const CATERING_TAX      = Math.round(CATERING_SUBTOTAL * 0.07);              // 764
const CATERING_TOTAL    = CATERING_SUBTOTAL + CATERING_TAX;                  // 11,674

function fmt(n) { return n.toLocaleString('en-US'); }

function CateringDemo() {
  const [step, setStep] = useState(0);
  const STEPS_TOTAL = 24; // 0..23 then loop

  useEffect(() => {
    const id = setInterval(() => {
      setStep(s => (s + 1) % STEPS_TOTAL);
    }, 650);
    return () => clearInterval(id);
  }, []);

  const show = (t) => step >= t && step < 23; // hide everything at step 23 (reset flash)
  const fade = (t) => ({
    opacity: show(t) ? 1 : 0,
    transform: show(t) ? 'translateY(0)' : 'translateY(6px)',
    transition: 'opacity .45s ease, transform .45s ease',
  });

  return (
    <div className="mock-screen" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="mock-header">
        <span className="mock-dot" style={{ background: '#ff5f57' }} />
        <span className="mock-dot" style={{ background: '#ffbd2e' }} />
        <span className="mock-dot" style={{ background: '#28c840' }} />
        <span style={{ marginLeft: 8, fontSize: 12, color: MUTED_C, fontFamily: FH, fontWeight: 600 }}>
          savannah-catering.com / inbox
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: GRN, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN, animation: 'pulseDot 2s infinite' }} />
          AI agent active
        </span>
      </div>

      <div className="catering-split" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 440,
      }}>
        {/* LEFT: intake */}
        <div style={{ padding: 24, borderRight: `1px solid ${HAIR_C}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Mail size={14} color={T} />
            <div style={{ fontSize: 11, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Incoming inquiry
            </div>
          </div>

          {/* Source card */}
          <div style={{
            padding: '10px 12px', background: SURFACE_C, borderRadius: 8,
            border: `1px solid ${HAIR_C}`, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: T + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Mail size={13} color={T} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: INK_C, fontFamily: FH, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                rachel@acme-events.com
              </div>
              <div style={{ fontSize: 11, color: MUTED_C, fontFamily: FB }}>Web form · 2 min ago</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: GRN, background: GRN + '14', padding: '3px 7px', borderRadius: 100 }}>NEW</span>
          </div>

          {/* Extracting indicator */}
          <div style={{
            ...fade(0), opacity: step < 1 ? 1 : 0,
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: MUTED_C, marginBottom: 10, fontFamily: FB,
          }}>
            <Loader size={12} color={T} style={{ animation: 'auroraSpin 1.5s linear infinite' }} />
            AI is reading the inquiry...
          </div>

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CATERING_FIELDS.map(f => (
              <div key={f.label} style={{
                display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, alignItems: 'baseline',
                ...fade(f.step),
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED_C, fontFamily: FH, letterSpacing: '.02em' }}>
                  {f.label}
                </div>
                <div style={{
                  fontSize: 13, color: INK_C, fontFamily: FB, fontWeight: 600,
                  padding: '6px 10px', background: SURFACE_C, borderRadius: 6,
                  border: `1px solid ${HAIR_C}`,
                }}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: quote */}
        <div style={{ padding: 24, background: WASH_C, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Sparkles size={14} color={R} />
            <div style={{ fontSize: 11, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Auto-generated quote
            </div>
          </div>

          {/* Calculating phase */}
          <div style={{
            display: step >= 7 && step < 9 ? 'flex' : 'none',
            alignItems: 'center', gap: 10, padding: '14px 16px',
            background: W, border: `1px solid ${HAIR_C}`, borderRadius: 10,
            fontSize: 13, color: MUTED_C, fontFamily: FB,
          }}>
            <Loader size={14} color={R} style={{ animation: 'auroraSpin 1.2s linear infinite' }} />
            Calculating menu, staff, and service costs...
          </div>

          {/* Quote body */}
          <div style={{ ...fade(9) }}>
            <div style={{
              background: W, border: `1px solid ${HAIR_C}`, borderRadius: 12,
              padding: '18px 20px',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingBottom: 10, borderBottom: `1px solid ${HAIR_C}`, marginBottom: 12,
              }}>
                <div style={{ fontSize: 14, fontWeight: 900, fontFamily: FH, color: INK_C }}>Wedding Quote #2847</div>
                <div style={{ fontSize: 11, color: MUTED_C, fontFamily: FB }}>180 guests</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CATERING_LINES.map(l => (
                  <div key={l.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    fontSize: 13, fontFamily: FB, ...fade(l.step),
                  }}>
                    <span style={{ color: INK_C }}>{l.label}</span>
                    <span style={{ fontWeight: 700, color: INK_C, fontFamily: FH }}>${fmt(l.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${HAIR_C}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED_C, ...fade(15) }}>
                  <span>Subtotal</span>
                  <span style={{ fontFamily: FH, fontWeight: 700 }}>${fmt(CATERING_SUBTOTAL)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED_C, ...fade(16) }}>
                  <span>Tax (7%)</span>
                  <span style={{ fontFamily: FH, fontWeight: 700 }}>${fmt(CATERING_TAX)}</span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  fontSize: 14, marginTop: 6, paddingTop: 10, borderTop: `1px solid ${HAIR_C}`,
                  ...fade(17),
                }}>
                  <span style={{ color: INK_C, fontWeight: 700 }}>Total</span>
                  <span style={{ fontFamily: FH, fontWeight: 900, fontSize: 22, letterSpacing: '-.02em', color: INK_C }}>
                    ${fmt(CATERING_TOTAL)}
                  </span>
                </div>
              </div>
            </div>

            {/* Sent confirmation */}
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 10,
              background: GRN + '10', border: `1px solid ${GRN}30`,
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: GRN, fontFamily: FH, fontWeight: 700,
              ...fade(19),
            }}>
              <Send size={13} />
              Quote emailed to rachel@acme-events.com
              <span style={{ marginLeft: 'auto', color: MUTED_C, fontWeight: 600, fontFamily: FB }}>3.2s end-to-end</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer status bar */}
      <div style={{
        padding: '10px 16px', borderTop: `1px solid ${HAIR_C}`, background: W,
        display: 'flex', alignItems: 'center', gap: 12,
        fontSize: 11, color: MUTED_C, fontFamily: FB,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
          Custom AI agent · Savannah Catering Co.
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          <span>Quotes this week: <strong style={{ color: INK_C }}>47</strong></span>
          <span>Avg response: <strong style={{ color: INK_C }}>3.1s</strong></span>
          <span>Booking rate: <strong style={{ color: GRN }}>64%</strong></span>
        </span>
      </div>
    </div>
  );
}

function ChatDemo() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    text: "I'm **KotoIQ** in demo mode — ask me anything and I'll show you what I can do using sample data for a fictional dental client. I'm not connected to any real data on this page.",
    sources: null,
    complete: true,
  }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  function ask(question) {
    if (!question.trim() || thinking) return;
    const q = question.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', text: q }]);
    setThinking(true);

    // Simulate network delay → streaming response (fully local, no fetch)
    window.setTimeout(() => {
      const scenario = matchDemoScenario(q);
      setThinking(false);
      setMessages(m => [...m, { role: 'assistant', text: '', sources: null, complete: false }]);

      const full = scenario.text;
      let i = 0;
      const stream = window.setInterval(() => {
        i += 3;
        setMessages(m => {
          const copy = [...m];
          copy[copy.length - 1] = { role: 'assistant', text: full.slice(0, i), sources: null, complete: false };
          return copy;
        });
        if (i >= full.length) {
          window.clearInterval(stream);
          setMessages(m => {
            const copy = [...m];
            copy[copy.length - 1] = { role: 'assistant', text: full, sources: scenario.sources, complete: true };
            return copy;
          });
        }
      }, 18);
    }, 900);
  }

  return (
    <div className="mock-screen">
      <div className="mock-header">
        <span className="mock-dot" style={{ background: '#ff5f57' }} />
        <span className="mock-dot" style={{ background: '#ffbd2e' }} />
        <span className="mock-dot" style={{ background: '#28c840' }} />
        <span style={{ marginLeft: 8, fontSize: 12, color: MUTED_C, fontFamily: FH, fontWeight: 600 }}>
          kotoiq.app/ask
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 800, letterSpacing: '.08em',
          color: R, background: R + '12', padding: '3px 8px', borderRadius: 100,
        }}>
          DEMO MODE
        </span>
      </div>

      <div style={{ padding: '20px 22px 16px' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            Ask KotoIQ
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK_C }}>
            Try a question — live demo
          </div>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          maxHeight: 320, overflowY: 'auto', paddingRight: 4,
        }}>
          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} style={{
                alignSelf: 'flex-end', maxWidth: '85%', padding: '9px 13px',
                background: INK_C, color: '#fff', borderRadius: '14px 14px 4px 14px',
                fontSize: 13, fontWeight: 600, fontFamily: FB, lineHeight: 1.45,
              }}>
                {m.text}
              </div>
            ) : (
              <div key={i} style={{
                alignSelf: 'flex-start', maxWidth: '92%', padding: '12px 14px',
                background: SURFACE_C, border: `1px solid ${HAIR_C}`,
                borderRadius: '14px 14px 14px 4px',
              }}>
                <div style={{ fontSize: 13, color: INK_C, lineHeight: 1.6, fontFamily: FB }}>
                  {renderBold(m.text)}
                  {!m.complete && (
                    <span style={{
                      display: 'inline-block', width: 2, height: 14, background: INK_C,
                      verticalAlign: 'middle', marginLeft: 2,
                      animation: 'blink 1s infinite',
                    }} />
                  )}
                </div>
                {m.sources && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${HAIR_C}` }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T, letterSpacing: '.04em', textTransform: 'uppercase' }}>Sources:</span>
                    {m.sources.map(s => (
                      <span key={s} style={{
                        fontSize: 10, fontWeight: 700, color: MUTED_C,
                        background: '#fff', border: `1px solid ${HAIR_C}`,
                        padding: '2px 7px', borderRadius: 100,
                      }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          ))}

          {thinking && (
            <div style={{
              alignSelf: 'flex-start', padding: '10px 14px', background: SURFACE_C,
              border: `1px solid ${HAIR_C}`, borderRadius: '14px 14px 14px 4px',
              display: 'flex', gap: 4,
            }}>
              <span className="dot-1" style={{ width: 6, height: 6, borderRadius: '50%', background: MUTED_C }} />
              <span className="dot-2" style={{ width: 6, height: 6, borderRadius: '50%', background: MUTED_C }} />
              <span className="dot-3" style={{ width: 6, height: 6, borderRadius: '50%', background: MUTED_C }} />
            </div>
          )}
        </div>

        {/* Suggestion chips — only show when no user messages yet */}
        {messages.filter(m => m.role === 'user').length === 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {DEMO_SUGGESTIONS.map(s => (
              <button key={s} onClick={() => ask(s)} style={{
                fontSize: 11, fontWeight: 600, color: MUTED_C, fontFamily: FB,
                background: '#fff', border: `1px solid ${HAIR_C}`,
                padding: '5px 10px', borderRadius: 100, cursor: 'pointer',
                transition: 'all .15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = INK_C; e.currentTarget.style.color = INK_C; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = HAIR_C; e.currentTarget.style.color = MUTED_C; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <form onSubmit={e => { e.preventDefault(); ask(input); }}
          style={{
            marginTop: 14, padding: '8px 12px', borderRadius: 10,
            border: `1px solid ${HAIR_C}`, background: '#fff',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
          <MessageCircle size={14} color={FAINT_C} />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about traffic, keywords, competitors..."
            disabled={thinking}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, fontFamily: FB, color: INK_C, padding: '4px 0',
            }}
          />
          <button type="submit" disabled={!input.trim() || thinking}
            style={{
              padding: '5px 10px', borderRadius: 6, border: 'none',
              background: (!input.trim() || thinking) ? HAIR_C : INK_C,
              color: (!input.trim() || thinking) ? FAINT_C : '#fff',
              fontSize: 11, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
              transition: 'all .15s', letterSpacing: '.02em',
            }}>
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}

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
      <section className="hero" style={{ background: W, padding: '180px 40px 100px', position: 'relative' }}>
        {/* Molecule network — drifting atoms connected by thin lines */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        }}>
          <ParticleNetwork
            count={52}
            maxDist={150}
            speed={0.35}
            color1={R}
            color2={T}
            lineColor="17, 17, 17"
          />
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
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
            letterSpacing: '-.035em', lineHeight: 1.05,
            color: INK, maxWidth: 900, margin: '0 auto',
            paddingTop: 4,
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

      {/* ══ INSIDE KOTOIQ ══ */}
      <section id="kotoiq" className="section" style={{ background: SURFACE, padding: '96px 40px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64, maxWidth: 760, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="eyebrow" style={{ color: R }}>Inside KotoIQ</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.1, marginBottom: 18,
            }}>
              <span style={{ display: 'block', fontSize: 56, fontWeight: 900, letterSpacing: '-.035em' }}>Not AI that generates.</span>
              <span style={{ display: 'block', fontSize: 56, fontWeight: 900, letterSpacing: '-.035em' }}>
                AI that <span style={{ color: R }}>investigates</span>.
              </span>
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              KotoIQ is the search intelligence engine behind every Koto recommendation. It pulls live data
              from 12+ sources, runs 25+ specialized analysis engines in parallel, and routes each task to
              the right AI model — so every recommendation is grounded in your real data, not guessed at.
            </p>
          </div>

          {/* Pipeline — 4 stages */}
          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 48 }}>
            {IQ_PIPELINE.map((stage, i) => {
              const Icon = stage.icon;
              return (
                <div key={stage.num} style={{
                  background: W, border: `1px solid ${HAIR}`, borderRadius: 16,
                  padding: '28px 24px', position: 'relative',
                }}>
                  {i < IQ_PIPELINE.length - 1 && (
                    <div className="hide-mobile" style={{
                      position: 'absolute', right: -12, top: 48, zIndex: 2,
                      width: 24, height: 24, borderRadius: '50%',
                      background: W, border: `1px solid ${HAIR}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: FAINT,
                    }}>
                      <ArrowRight size={12} />
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: R + '10', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={20} color={R} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.08em' }}>{stage.num}</span>
                  </div>
                  <h3 style={{ fontSize: 22, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginBottom: 6 }}>
                    {stage.title}
                  </h3>
                  <div style={{ fontSize: 13, fontWeight: 700, color: R, fontFamily: FH, marginBottom: 10 }}>
                    {stage.headline}
                  </div>
                  <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, fontFamily: FB, marginBottom: 16 }}>{stage.desc}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {stage.items.map(it => (
                      <span key={it} style={{
                        fontSize: 11, fontWeight: 600, color: MUTED,
                        background: SURFACE, border: `1px solid ${HAIR}`,
                        padding: '3px 8px', borderRadius: 6, fontFamily: FB,
                      }}>{it}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Capabilities grid */}
          <div style={{
            background: W, border: `1px solid ${HAIR}`, borderRadius: 20, padding: '40px 36px',
          }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                What you get
              </div>
              <h3 style={{ fontSize: 28, fontWeight: 900, fontFamily: FH, letterSpacing: '-.025em', color: INK }}>
                Eight intelligence products in one module.
              </h3>
            </div>
            <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              {IQ_CAPABILITIES.map(cap => {
                const Icon = cap.icon;
                return (
                  <div key={cap.title}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: T + '12', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 14,
                    }}>
                      <Icon size={18} color={T} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FH, color: INK, marginBottom: 6 }}>{cap.title}</div>
                    <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.55, fontFamily: FB }}>{cap.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══ SEE IT IN ACTION — ANIMATED MOCKS ══ */}
      <section className="section" style={{ background: W, padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="eyebrow" style={{ color: R }}>See it in action</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.02, marginBottom: 18,
            }}>
              Real data. Real insights.<br />Real fast.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              A look at what KotoIQ produces on a typical client — scored, prioritized, and ready to act on.
            </p>
          </div>

          {/* Hero row: AI Visibility Score + Quick Wins */}
          <div className="mock-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 20, marginBottom: 20 }}>

            {/* ─── MOCK 1: AI Visibility Score ─── */}
            <div className="mock-screen">
              <div className="mock-header">
                <span className="mock-dot" style={{ background: '#ff5f57' }} />
                <span className="mock-dot" style={{ background: '#ffbd2e' }} />
                <span className="mock-dot" style={{ background: '#28c840' }} />
                <span style={{ marginLeft: 8, fontSize: 12, color: MUTED, fontFamily: FH, fontWeight: 600 }}>
                  kotoiq.app/dashboard
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: FAINT, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN, animation: 'pulseDot 2s infinite' }} />
                  Live
                </span>
              </div>

              <div style={{ padding: '32px 32px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                      AI Visibility Score
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK }}>
                      Acme Dental · Miami FL
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100,
                    background: GRN + '12', fontSize: 11, fontWeight: 700, color: GRN,
                  }}>
                    <TrendingUp size={12} /> +4 pts this week
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                  {/* Radial ring */}
                  <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
                    <svg width="160" height="160" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke={HAIR} strokeWidth="7" />
                      <circle
                        cx="50" cy="50" r="45" fill="none" stroke={R} strokeWidth="7" strokeLinecap="round"
                        strokeDasharray="283" style={{
                          transformOrigin: '50% 50%', transform: 'rotate(-90deg)',
                          animation: 'ring 1.8s ease-out forwards', '--ring-target': '79',
                        }}
                      />
                    </svg>
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', animation: 'countFlash 1s ease-out .9s both',
                    }}>
                      <div style={{ fontSize: 44, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color: INK, lineHeight: 1 }}>72</div>
                      <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginTop: 2 }}>out of 100</div>
                      <div style={{
                        marginTop: 6, padding: '2px 10px', borderRadius: 100, background: R + '15',
                        color: R, fontSize: 12, fontWeight: 900, fontFamily: FH,
                      }}>B+</div>
                    </div>
                  </div>

                  {/* Sub-scores */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                      { label: 'Semantic coverage', value: 78, color: T },
                      { label: 'Entity presence',   value: 65, color: R },
                      { label: 'E-E-A-T signals',   value: 71, color: INK },
                      { label: 'SERP features',     value: 74, color: AMB },
                    ].map((s, i) => (
                      <div key={s.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{s.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: INK, fontFamily: FH }}>{s.value}</span>
                        </div>
                        <div style={{ height: 6, background: SURFACE, borderRadius: 100, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${s.value}%`, background: s.color, borderRadius: 100,
                            animation: `fillBar 1.2s cubic-bezier(.22,1,.36,1) ${.4 + i * .15}s both`,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── MOCK 2: Quick Wins ─── */}
            <div className="mock-screen">
              <div className="mock-header">
                <span className="mock-dot" style={{ background: '#ff5f57' }} />
                <span className="mock-dot" style={{ background: '#ffbd2e' }} />
                <span className="mock-dot" style={{ background: '#28c840' }} />
                <span style={{ marginLeft: 8, fontSize: 12, color: MUTED, fontFamily: FH, fontWeight: 600 }}>
                  kotoiq.app/quick-wins
                </span>
              </div>

              <div style={{ padding: '24px 24px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                      Quick Win Queue
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK }}>
                      24 keywords ranked by impact
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: GRN + '08', border: `1px solid ${GRN}20` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: GRN, letterSpacing: '.06em', textTransform: 'uppercase' }}>Est. traffic gain</div>
                    <div style={{ fontSize: 22, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginTop: 2 }}>+8,340<span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}> /mo</span></div>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: R + '08', border: `1px solid ${R}20` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: R, letterSpacing: '.06em', textTransform: 'uppercase' }}>Est. revenue lift</div>
                    <div style={{ fontSize: 22, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginTop: 2 }}>+$12.4k<span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}> /mo</span></div>
                  </div>
                </div>

                {/* Rows */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {[
                    { kw: 'emergency dentist miami',    from: 11, to: 4, traffic: '+1,840', cls: 'mock-row-1' },
                    { kw: 'invisalign near me',         from: 14, to: 6, traffic: '+1,220', cls: 'mock-row-2' },
                    { kw: 'dental implants cost',       from: 9,  to: 3, traffic: '+2,110', cls: 'mock-row-3' },
                    { kw: 'same day crown brickell',    from: 18, to: 7, traffic: '+  680', cls: 'mock-row-4' },
                  ].map((r, i) => (
                    <div key={r.kw} className={r.cls} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px',
                      borderRadius: 8, borderBottom: i < 3 ? `1px solid ${HAIR}` : 'none',
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: R, background: R + '12',
                        padding: '3px 8px', borderRadius: 100, letterSpacing: '.04em',
                      }}>HIGH</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: INK, fontFamily: FB }}>{r.kw}</span>
                      <span style={{ fontSize: 12, color: MUTED, fontFamily: 'monospace' }}>#{r.from} → <strong style={{ color: GRN }}>#{r.to}</strong></span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: GRN, fontFamily: FH, minWidth: 56, textAlign: 'right' }}>{r.traffic}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Second row: Rank Grid + Ask KotoIQ */}
          <div className="mock-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* ─── MOCK 3: Rank Grid Pro ─── */}
            <div className="mock-screen">
              <div className="mock-header">
                <span className="mock-dot" style={{ background: '#ff5f57' }} />
                <span className="mock-dot" style={{ background: '#ffbd2e' }} />
                <span className="mock-dot" style={{ background: '#28c840' }} />
                <span style={{ marginLeft: 8, fontSize: 12, color: MUTED, fontFamily: FH, fontWeight: 600 }}>
                  kotoiq.app/rank-grid
                </span>
              </div>

              <div style={{ padding: '24px' }}>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Rank Grid Pro
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK }}>
                    "emergency dentist" · 5 mile grid
                  </div>
                </div>

                {/* Grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 16,
                  position: 'relative',
                }}>
                  {(() => {
                    const grid = [
                      [8, 5, 3, 2, 4, 7, 12],
                      [6, 3, 1, 1, 2, 4, 9],
                      [4, 2, 1, 1, 1, 3, 6],
                      [7, 4, 2, 1, 2, 5, 11],
                      [12, 8, 5, 3, 4, 9, 18],
                    ];
                    return grid.flat().map((rank, idx) => {
                      const isCenter = idx === Math.floor(grid.length / 2) * 7 + 3;
                      const color = rank <= 3 ? GRN : rank <= 10 ? AMB : '#ef4444';
                      return (
                        <div key={idx} style={{
                          aspectRatio: '1', borderRadius: 6, background: color + '18',
                          border: `1px solid ${color}30`, color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 900, fontFamily: FH,
                          animation: isCenter ? 'none' : `cellFlash 6s infinite`, animationDelay: `${(idx * 0.15) % 4}s`,
                          position: 'relative',
                        }}>
                          {rank}
                          {isCenter && (
                            <div style={{
                              position: 'absolute', inset: -3, borderRadius: 8,
                              background: INK, color: W,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 900,
                            }}>
                              <MapPin size={14} color={W} />
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: MUTED, fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: GRN + '30', border: `1px solid ${GRN}` }} /> Top 3
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: AMB + '30', border: `1px solid ${AMB}` }} /> 4–10
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: '#ef444430', border: '1px solid #ef4444' }} /> 11+
                  </span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: INK }}>Avg rank: 4.2</span>
                </div>
              </div>
            </div>

            {/* ─── MOCK 4: Ask KotoIQ — INTERACTIVE DEMO ─── */}
            <ChatDemo />
          </div>
        </div>
      </section>

      {/* ══ AI AGENTS UNDER THE HOOD ══ */}
      <section id="agents" className="section" style={{ background: W, padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 760, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="eyebrow">AI agents under the hood</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.02, marginBottom: 18,
            }}>
              Specialized agents.<br />Built for the work that matters.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Koto ships with purpose-built AI agents for the conversations that move money — outbound
              sales, client onboarding, discovery, and healthcare verification. Each one is engineered
              for a specific job, not a general-purpose chatbot.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {AGENTS.map(a => {
              const Icon = a.icon;
              return (
                <div key={a.title} style={{
                  background: W, border: `1px solid ${HAIR}`, borderRadius: 18,
                  padding: '36px 36px', display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 48,
                  transition: 'border-color .2s, box-shadow .2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = INK; e.currentTarget.style.boxShadow = '0 12px 32px rgba(17,17,17,.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = HAIR; e.currentTarget.style.boxShadow = 'none'; }}
                  className="agent-card"
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: a.accent + '12', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={20} color={a.accent} />
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                        color: a.accent, background: a.accent + '12',
                        padding: '4px 10px', borderRadius: 100,
                      }}>{a.tag}</span>
                    </div>
                    <h3 style={{
                      fontSize: 28, fontWeight: 900, fontFamily: FH, letterSpacing: '-.025em',
                      color: INK, lineHeight: 1.08, marginBottom: 12,
                    }}>{a.title}</h3>
                    <div style={{ fontSize: 16, fontWeight: 700, color: INK, fontFamily: FH, marginBottom: 12 }}>
                      {a.headline}
                    </div>
                    <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, fontFamily: FB }}>{a.desc}</p>
                  </div>

                  <div style={{ borderLeft: `1px solid ${HAIR}`, paddingLeft: 36 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.08em',
                      textTransform: 'uppercase', marginBottom: 16,
                    }}>Real-world use cases</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {a.cases.map(c => (
                        <div key={c.title} style={{ display: 'flex', gap: 12 }}>
                          <div style={{
                            width: 3, borderRadius: 2, background: a.accent, flexShrink: 0, alignSelf: 'stretch',
                          }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: INK, fontFamily: FH, marginBottom: 4 }}>{c.title}</div>
                            <div style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.55 }}>{c.scenario}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ CUSTOM-BUILD ══ */}
      <section id="custom" className="section" style={{ background: W, padding: '96px 40px', borderTop: `1px solid ${HAIR}`, position: 'relative', overflow: 'hidden' }}>
        {/* Subtle animated gradient behind headline */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
          width: 720, height: 300, borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${T}18 0%, ${R}18 60%, transparent 80%)`,
          filter: 'blur(80px)', pointerEvents: 'none',
          animation: 'orbPulse 14s ease-in-out infinite',
        }} />

        <div style={{ maxWidth: 1160, margin: '0 auto', position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 760, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="eyebrow" style={{ color: R }}>Custom-built AI</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.1, marginBottom: 18,
            }}>
              <span style={{ display: 'block' }}>If you can describe it,</span>
              <span style={{ display: 'block' }}>we can <span style={{ color: R }}>build it</span>.</span>
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Every business has a workflow that shouldn't take a human — the intake, the quoting,
              the triage, the scheduling. Koto builds you a custom AI system that runs it end-to-end,
              tailored to your process.
            </p>
          </div>

          {/* Featured demo: Catering quoter */}
          <div style={{ marginBottom: 28 }}>
            <CateringDemo />
          </div>
          <div style={{
            textAlign: 'center', marginBottom: 64,
            fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto',
          }}>
            <strong style={{ color: INK, fontWeight: 700 }}>Example: a catering company's quote bot.</strong>{' '}
            Reads every new inquiry, extracts the event details, calculates pricing based on their real menu
            and service fees, and emails a polished quote before the customer closes the tab.
          </div>

          {/* Other examples grid */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              A few others we could build for you
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK }}>
              Any industry. Any workflow. Any complexity.
            </div>
          </div>

          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {CUSTOM_EXAMPLES.map(ex => {
              const Icon = ex.icon;
              return (
                <div key={ex.title} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: ex.accent + '12',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={20} color={ex.accent} />
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: ex.accent,
                      background: ex.accent + '12', padding: '4px 10px', borderRadius: 100,
                      letterSpacing: '.06em', textTransform: 'uppercase',
                    }}>{ex.industry}</span>
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginBottom: 8 }}>
                    {ex.title}
                  </h3>
                  <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, fontFamily: FB }}>{ex.desc}</p>
                </div>
              );
            })}
          </div>

          {/* CTA strip */}
          <div style={{
            marginTop: 48, padding: '24px 28px', borderRadius: 14,
            background: SURFACE, border: `1px solid ${HAIR}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, fontFamily: FH, color: INK, marginBottom: 2 }}>
                Got a workflow that should be automated?
              </div>
              <div style={{ fontSize: 14, color: MUTED, fontFamily: FB }}>
                Tell us what you do. We'll show you what an AI version looks like — usually within a week.
              </div>
            </div>
            <button className="btn btn-primary btn-md" onClick={() => navigate('/signup')}>
              Book a build session <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* Mobile stacking for catering split */}
      <style>{`
        @media (max-width: 900px) {
          .catering-split { grid-template-columns: 1fr !important; }
          .catering-split > div:first-child { border-right: none !important; border-bottom: 1px solid ${HAIR} !important; }
        }
      `}</style>

      {/* ══ BUILT FOR SCALE ══ */}
      <section className="section" style={{ background: SURFACE, padding: '96px 40px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="eyebrow">Built for scale</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.02, marginBottom: 18,
            }}>
              Enterprise infrastructure.<br />Agency-ready workflows.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Koto is engineered for agencies that run dozens to hundreds of clients — with the security,
              auditability, and performance your enterprise clients expect.
            </p>
          </div>

          {/* Big stats — live counter style */}
          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 48 }}>
            {PROOF_STATS.map((s, i) => (
              <div key={s.label} style={{
                background: W, border: `1px solid ${HAIR}`, borderRadius: 16,
                padding: '32px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 700, color: GRN, letterSpacing: '.04em',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN, animation: 'pulseDot 2s infinite' }} />
                  LIVE
                </div>
                <div style={{
                  fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.04em',
                  color: INK, lineHeight: 1, animation: `countFlash .8s ease-out ${0.1 + i * 0.1}s both`,
                }}>{s.value}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 14, letterSpacing: '.02em', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Enterprise feature grid */}
          <div style={{
            background: W, border: `1px solid ${HAIR}`, borderRadius: 20,
            padding: '40px 36px',
          }}>
            <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Security & compliance
                </div>
                <h3 style={{ fontSize: 28, fontWeight: 900, fontFamily: FH, letterSpacing: '-.025em', color: INK }}>
                  Engineered for the data you're trusted with.
                </h3>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['SOC-2 pending', 'GDPR-aware', 'CCPA-ready', 'US-hosted'].map(b => (
                  <span key={b} style={{
                    fontSize: 11, fontWeight: 700, color: MUTED,
                    background: SURFACE, border: `1px solid ${HAIR}`,
                    padding: '5px 10px', borderRadius: 100, letterSpacing: '.04em',
                  }}>{b}</span>
                ))}
              </div>
            </div>
            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {ENTERPRISE_FEATURES.map(f => (
                <div key={f.title} style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', background: GRN, marginTop: 8, flexShrink: 0,
                    boxShadow: `0 0 0 4px ${GRN}15`,
                  }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: INK, fontFamily: FH, marginBottom: 4 }}>{f.title}</div>
                    <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55, fontFamily: FB }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
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
              Replace the dozens of tools and hires that used to slow your agency down. One unified AI system, deployed in minutes.
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
