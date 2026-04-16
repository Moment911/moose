"use client";
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Check, Phone, MessageSquare,
  BarChart2, Zap, Star, Search, Globe, TrendingUp, Cpu,
  Database, Network, Sparkles, Target, FileText, MapPin,
  Eye, Layers, Activity, MessageCircle, Mail, Send, Loader,
  Car, Scale, Wrench, Home, Droplet, Dumbbell,
} from 'lucide-react';
import { R, T, BLK, GRY, GRN, AMB, W, FH, FB } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from '../lib/contact';
import PublicNav from '../components/public/PublicNav'
import TrustStrip from '../components/public/TrustStrip';
import LeadMagnet from '../components/public/LeadMagnet';
import { usePageMeta } from '../lib/usePageMeta';
import PublicFooter from '../components/public/PublicFooter';
import ScopeBand from '../components/public/ScopeBand';

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
  { num: '1 week',  label: 'Prototype turnaround' },
  { num: '14',      label: 'Foundation models we use' },
  { num: '24',      label: 'Agents already built' },
  { num: '<3s',     label: 'Avg agent response' },
];

const PROOF_STATS = [
  { value: '1 week',   label: 'Prototype turnaround' },
  { value: '4–8 wks',  label: 'Production deploys' },
  { value: '24+',      label: 'Agent types shipped' },
  { value: '99.9%',    label: 'Target uptime' },
];

const ENTERPRISE_FEATURES = [
  { title: 'Bank-level encryption',   desc: 'All data encrypted in transit and at rest. Keys rotated on schedule.' },
  { title: 'Role-based access',        desc: 'Granular permissions per team member. SSO-ready for enterprise plans.' },
  { title: 'Full audit trail',         desc: 'Every AI action, edit, and export is logged and exportable for compliance.' },
  { title: 'Isolated data per tenant', desc: "Your data never leaves your workspace. Zero cross-tenant bleed." },
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
    headline: 'Live data from every place your clients show up',
    desc: 'KotoIQ pulls real-time data straight from the channels your clients rank and advertise on — search, analytics, paid media, local listings, reviews, backlinks, and the live web. Your sitemap and every indexed page feed the pipeline automatically.',
    items: ['Search rankings', 'Website analytics', 'Paid media', 'Local listings', 'Reviews', 'Backlinks', 'Sitemap + pages', 'Live web'],
  },
  {
    num: '02', title: 'Analyze', icon: Network,
    headline: '25+ specialized engines running in parallel',
    desc: 'Each engine is a focused reasoning agent. One scores topical authority. One maps geo-spatial visibility cell by cell. One tracks competitor share-of-voice shifts. One finds pages bleeding traffic. One grades every page against modern search-quality guidelines.',
    items: ['AI Visibility', 'Quick Wins', 'Rank Grid', 'Competitor Watch', 'Semantic Analysis', 'Content Decay', 'Quality Scoring', 'Backlink Intel'],
  },
  {
    num: '03', title: 'Synthesize', icon: Sparkles,
    headline: 'The right model for the right job',
    desc: 'Every sub-task gets routed to the AI best suited for it — fast lookups to lightweight models, deep reasoning to the heavy ones, content generation to the most creative. For big research questions, parallel queries run across multiple models and reconcile into one answer.',
    items: ['Deep reasoning', 'Fast chat', 'Vision + tables', 'Multi-model blend', 'Cost-routed', 'Context-aware', 'Grounded in data', 'Cited sources'],
  },
  {
    num: '04', title: 'Act', icon: Target,
    headline: 'Prioritized, client-ready actions',
    desc: 'The engine outputs a ranked Quick Win queue with traffic and revenue estimates. Content briefs arrive with page structure and entity coverage. Business profile posts draft themselves. Competitor intel becomes a one-pager. Every recommendation cites the data it came from.',
    items: ['Quick Win Queue', 'Content Briefs', 'Profile Posts', 'Rank Reports', 'Visibility Score', 'Ask KotoIQ', 'Client Portals', 'Full Audits'],
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
/* All numbers, names, and data are fabricated for demo purposes. */
const DEMO_SCENARIOS = [
  {
    triggers: ['traffic', 'down', 'drop', 'decline', 'decreas', 'lost'],
    text: 'Organic traffic is down 12.4% MoM for **Hartwell Dental Group** (sample client). The pages bleeding the most: **dental implants** (-34%, 4,120 → 2,720 sessions), **invisalign near me** (-22%, 3,180 → 2,480), and **emergency dentist** (-18%, 5,640 → 4,625). A competitor published fresh pillar content on Sept 14th and pushed these three pages out of the AI answer citations. Refreshing them would recover an estimated 4,400 sessions/mo — I can draft the content briefs right now.',
    sources: ['Search data', 'Website analytics', 'Live SERP'],
  },
  {
    triggers: ['keyword', 'opportunit', 'quick win', 'low hanging', 'easy win'],
    text: 'Top **quick wins** this week for Hartwell Dental: **emergency dentist miami** (#11 → #4, est. +1,840 visits/mo, $42 avg value), **dental implants cost** (#9 → #3, +2,110/mo, $78 avg), **invisalign near me** (#14 → #6, +1,220/mo, $95 avg), **teeth whitening brickell** (#18 → #7, +640/mo, $34 avg). Combined lift at current 3.8% conversion: **+$12.4k revenue/mo**. ETA per fix: 3–5 hours of editorial work per page.',
    sources: ['Search data', 'Keyword metrics', 'Opportunity engine'],
  },
  {
    triggers: ['competit', 'compare', 'rival', 'vs '],
    text: 'Top 3 competitors by share of voice in Miami-Dade dental: **BriteSmile Dental** +14% this month — they shipped 4 new service pages targeting your long-tail implant terms on Sept 14. **Miami Smile Studio** +6% on branded "miami smile" searches, likely from a local press mention. **Downtown Dental Clinic** -3% after a site migration on Aug 28. BriteSmile is your priority — I flagged three pages where you should out-write them first.',
    sources: ['Live SERP', 'Competitor intelligence'],
  },
  {
    triggers: ['review', 'gmb', 'business profile', 'reputation', 'star', 'rating'],
    text: 'Hartwell Dental local listing: **4.6 stars** across **247 reviews** (+12 this month). Sentiment dropped 4 points on wait-time mentions — two recent 3-star reviews both cite waiting 45+ minutes past appointment time. I drafted reply copy for both. Positive reviews cluster around three themes: "painless", "thorough cleanings", and "Dr. Hartwell\'s explanations" — great proof points to weave into your landing page copy.',
    sources: ['Local listing', 'Review sentiment'],
  },
  {
    triggers: ['local', 'grid', 'map', 'near me', 'geo'],
    text: '5-mile geo-grid for **"emergency dentist"** around Hartwell Dental averages **#4.2**. Strong coverage in Brickell (avg #2.1, top-3 in 11/12 cells) and Coconut Grove (avg #3.4). Weak visibility north of 79th St (avg #11.8) and in Key Biscayne (avg #9.2). Three neighborhood-specific landing pages (Midtown, Wynwood, Key Biscayne) would close most of the gap within 60 days.',
    sources: ['Rank grid', 'Local SERP'],
  },
  {
    triggers: ['ads', 'ppc', 'paid', 'cpc', 'adwords', 'google ads', 'spend'],
    text: 'Hartwell paid media, last 30 days: **$4,217 spend**, **2.1% CVR**, **$47 CPA**, 89 bookings. Your **"emergency dentist"** ad group is carrying the account — 3.8% CVR, $28 CPA, 42 bookings. **"Teeth whitening"** is bleeding — $612 spend, 0 conversions, 1.1% CTR. Recommendation: pause whitening immediately, shift the $612 to the implants RLSA campaign (currently 4.2% CVR, starved at 30% impression share).',
    sources: ['Paid media', 'Conversion tracking'],
  },
  {
    triggers: ['content', 'brief', 'write', 'blog', 'page', 'idea'],
    text: 'Based on your keyword gaps vs BriteSmile + Miami Smile Studio, next content priorities for Hartwell: (1) **pillar page: dental implant financing** — $180 avg CPC, commercial intent, competitors weak on YMYL signals. (2) **comparison: Invisalign vs traditional braces for working adults** — targets 2,900 monthly searches you don\'t rank for. (3) **location page: Coral Gables emergency dentistry** — closes your #9.2 avg rank gap. I can generate full briefs with H2/H3 structure, entity coverage, FAQ schema, and internal link plan.',
    sources: ['Keyword gaps', 'Content decay', 'SERP analysis'],
  },
  {
    triggers: ['score', 'visibility', 'ai visibility', 'grade', 'health'],
    text: 'Hartwell Dental **AI Visibility Score: 72/100 (grade B+)**, up +4 points this week. Sub-scores: **Semantic coverage 78**, **Entity presence 65**, **E-E-A-T signals 71**, **SERP features 74**. The biggest lift available is **Entity presence** — you\'re missing Dentist and LocalBusiness schema on 14 pages, and your Dr. Hartwell author bio isn\'t connected via sameAs. Fixing both would push the overall score to A in about two weeks.',
    sources: ['AI Visibility Engine', 'Semantic Agents'],
  },
  {
    triggers: ['backlink', 'link', 'authority', 'domain authority', 'da ', 'da:', 'backlinks'],
    text: 'Hartwell domain metrics: **DA 34** (+2 this quarter), 412 referring domains, 1,847 total backlinks. Last 30 days: 14 new links, 2 toxic/spam (flagged for disavow). Biggest gain: a mention in a Miami Herald piece on Sept 8th (DA 91). Easiest link opportunities: 6 competitors have local chamber + Miami Dade dental association links you don\'t — I can draft the outreach.',
    sources: ['Backlink intel', 'Toxic link monitor'],
  },
  {
    triggers: ['report', 'client', 'monthly', 'weekly', 'summary'],
    text: 'Hartwell monthly snapshot (Sept): **+4.1% organic sessions**, **+8 new patient bookings from SEO**, **$47 paid CPA**, **4.6★ reviews (+12)**. Top wins: recovered #3 for "dental implants miami", published 2 new service pages, disavowed 2 toxic backlinks. Open items: wait-time reviews, pause whitening ad group, publish implant financing pillar. Full deck ready in your client portal.',
    sources: ['Monthly rollup', 'Client portal'],
  },
  {
    triggers: ['patient', 'booking', 'lead', 'conversion', 'form'],
    text: 'Sample restaurant client **Acme Kitchen** (different industry, same platform): 142 online reservations last week via the site booking widget, up 18% WoW. Most common party size: 4 (38% of bookings). Peak: Saturday 7–9pm, 84% fill rate. Drop-off point: the allergy/dietary question — 23% of abandoned bookings happen there. Recommendation: move allergies to post-confirmation.',
    sources: ['Booking analytics', 'Form funnel'],
  },
  {
    triggers: ['law', 'attorney', 'legal', 'case'],
    text: 'Sample law firm client **Morales & Associates** (PI): 38 qualified intakes last month from organic, up 22% MoM. "Car accident lawyer miami" is now #2 (was #6). Average case value per qualified lead: $8,400. Biggest gap: you don\'t rank for "slip and fall lawyer coral gables" (4,100 monthly searches, all competitors are weak). Priority build: a pillar page + 3 supporting posts.',
    sources: ['Search data', 'CRM pipeline'],
  },
];

const DEMO_FALLBACK = {
  text: "I'm in **demo mode** using sample data for a fictional dental client — I'm not connected to any real account here on the marketing site. Try asking me about **traffic drops**, **keyword opportunities**, **competitors**, **Google reviews**, **local rankings**, or **Google Ads performance**. Or book a build session and we'll wire this up against your real data.",
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
  usePageMeta({
    title: 'Custom AI agents, chatbots & platforms built in weeks | Koto',
    description: 'Koto builds custom AI agents, chatbots, CRMs, and full platforms for any business in any industry. Founder-led, 10 engineers shipping every week. Book a 20-min build session.',
  });
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');

  // Scroll-to-section after landing from another page with /#hash
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  }, []);

  const filteredTools = activeFilter === 'All' ? TOOLS : TOOLS.filter(t => t.cat === activeFilter);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <PublicNav />

      {/* ══ HERO ══ */}
      <section className="hero" style={{ background: W, padding: '180px 40px 100px', position: 'relative' }}>
        {/* Background: animated color + molecule network stacked */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        }}>
          {/* Color layer — bigger, bolder, more motion */}
          <div style={{
            position: 'absolute', top: -60, left: '4%', width: 620, height: 620,
            borderRadius: '50%', background: R + '3a', filter: 'blur(90px)',
            animation: 'orbPulse 9s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', top: 60, right: '2%', width: 580, height: 580,
            borderRadius: '50%', background: T + '38', filter: 'blur(90px)',
            animation: 'orbPulse 11s ease-in-out infinite reverse',
          }} />
          <div style={{
            position: 'absolute', top: '40%', left: '50%', width: 900, height: 500,
            borderRadius: '50%',
            background: `radial-gradient(ellipse at center, ${R}32 0%, ${T}2e 45%, transparent 75%)`,
            filter: 'blur(70px)', transform: 'translate(-50%, -50%)',
            animation: 'orbSlide 13s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', top: '55%', left: '20%', width: 320, height: 320,
            borderRadius: '50%', background: AMB + '2e', filter: 'blur(80px)',
            animation: 'orbPulse 15s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', top: '60%', right: '16%', width: 300, height: 300,
            borderRadius: '50%', background: GRN + '28', filter: 'blur(80px)',
            animation: 'orbPulse 17s ease-in-out infinite reverse',
          }} />
          <div style={{
            position: 'absolute', top: '48%', left: '50%', width: 760, height: 760,
            borderRadius: '50%', opacity: .5,
            background: `conic-gradient(from 0deg, ${R}00, ${R}30, ${T}30, ${AMB}22, ${R}00)`,
            filter: 'blur(60px)', transform: 'translate(-50%, -50%)',
            animation: 'auroraSpin 24s linear infinite',
          }} />

          {/* Molecule layer — drifts on top of the color */}
          <ParticleNetwork
            count={56}
            maxDist={150}
            speed={0.38}
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
            Custom AI built in weeks — not quarters
          </div>

          <h1 className="hero-h1 fade fade-1" style={{
            fontSize: 84, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.05,
            color: INK, maxWidth: 960, margin: '0 auto',
            paddingTop: 4,
          }}>
            If you can think it,<br />we build it.{' '}
            <span style={{
              color: R,
              fontSize: 'inherit', fontWeight: 'inherit', fontFamily: 'inherit',
              fontStyle: 'normal', letterSpacing: 'inherit', lineHeight: 'inherit',
              display: 'inline',
            }}>Fast.</span>
          </h1>

          <p className="fade fade-2" style={{
            fontSize: 20, color: MUTED, fontFamily: FB,
            lineHeight: 1.55, maxWidth: 700, margin: '24px auto 0',
          }}>
            Custom AI agents, chatbots, CRMs, and full platforms — built by a team that ran a
            marketing agency for 20 years. Replace 40-person phone teams. Ship in weeks.
            Not another generic tool you'll outgrow in six months.
          </p>

          <div className="fade fade-3" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 36 }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/contact')}>
              Book a 20-min build session <ArrowRight size={16} />
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => scrollTo('platform')}>
              See what we build
            </button>
          </div>

          <div className="fade fade-3" style={{ fontSize: 13, color: FAINT, marginTop: 18 }}>
            Founder-led · 10 engineers shipping every week · Built for any industry
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

      {/* ══ TRUST ══ */}
      <TrustStrip />

      {/* ══ PLATFORM ══ */}
      <section id="platform" className="section" style={{ background: W, padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="eyebrow">What we build</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.02, marginBottom: 18,
            }}>
              Four things. Any industry.<br />Zero templates.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Every Koto build is custom. We don't ship you a generic tool — we design and ship a
              system that matches your exact workflow.
            </p>
          </div>

          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
            {[
              { icon: Phone, title: 'AI Voice Agents',   tag: 'Inbound + outbound', desc: 'Cold-call agents that qualify leads and book meetings. Front-desk agents that answer every inbound call 24/7. Specialist agents for industries like healthcare VOB. Sound human, scale infinitely.', href: '/ai-agents', accent: R },
              { icon: MessageCircle, title: 'Custom Chatbots', tag: 'Grounded in your data', desc: 'Conversational AI that actually knows your business — retrieves from your real docs, policies, and pricing. Interactive demos for six industries live on our Chatbots page.', href: '/chatbots', accent: T },
              { icon: Cpu, title: 'Custom AI Systems', tag: 'End-to-end workflows', desc: 'Intake, quoting, triage, scheduling, estimating, reporting — any workflow that shouldn\'t take a human. 17 real system walkthroughs on the Custom Systems page.', href: '/custom-systems', accent: AMB },
              { icon: Network, title: 'Deep Integrations', tag: 'CRM, calendar, any API', desc: 'Koto wires into Salesforce, HubSpot, GoHighLevel, Twilio, Stripe, QuickBooks — plus anything with an API or webhook. If it exists, we can connect it.', href: '/custom-systems', accent: GRN },
            ].map(c => {
              const Icon = c.icon
              return (
                <div key={c.title} className="card" style={{ cursor: 'pointer' }}
                  onClick={() => navigate(c.href)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: c.accent + '14', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={24} color={c.accent} />
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
                      textTransform: 'uppercase', color: c.accent,
                      background: c.accent + '12', padding: '4px 10px', borderRadius: 100,
                    }}>{c.tag}</span>
                  </div>
                  <h3 style={{ fontSize: 24, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginBottom: 10 }}>
                    {c.title}
                  </h3>
                  <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, fontFamily: FB, marginBottom: 14 }}>{c.desc}</p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: INK, fontFamily: FH }}>
                    Explore <ArrowRight size={13} />
                  </div>
                </div>
              )
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

      {/* KotoIQ + animated mocks moved to /koto-ai */}
      {/* ══ CHATBOTS PREVIEW — links to /chatbots ══ */}
      <section className="section" style={{ padding: '96px 40px', background: SURFACE, borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="eyebrow" style={{ color: T }}>Try them yourself</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.02, marginBottom: 18,
            }}>
              Six live chatbot demos.<br />Six different industries.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Each bot knows its business — real menus, real pricing, real policies. Click in, ask anything,
              see how fast we could build one for you.
            </p>
          </div>

          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
            {[
              { label: 'Dental Practice',  hint: 'Appointments, insurance, emergencies', color: R },
              { label: 'Real Estate',      hint: 'Property search, neighborhoods, mortgage', color: T },
              { label: 'Restaurant',       hint: 'Reservations, menu, allergies, events', color: AMB },
              { label: 'Auto Dealer',      hint: 'Inventory, financing, trade-in, test drives', color: '#8b5cf6' },
              { label: 'Law Firm',         hint: 'Intake, fees, case types, documents', color: BLK },
              { label: 'SaaS Support',     hint: 'Plans, integrations, billing, passwords', color: GRN },
            ].map(b => (
              <a key={b.label} href="/chatbots" onClick={e => { e.preventDefault(); navigate('/chatbots') }} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 22px', background: W, border: `1px solid ${HAIR}`,
                borderRadius: 14, textDecoration: 'none', cursor: 'pointer',
                transition: 'all .2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = INK; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(17,17,17,.06)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = HAIR; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', background: b.color,
                    boxShadow: `0 0 0 3px ${b.color}22`,
                  }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: INK, fontFamily: FH }}>{b.label}</div>
                    <div style={{ fontSize: 12, color: MUTED, fontFamily: FB, marginTop: 2 }}>{b.hint}</div>
                  </div>
                </div>
                <ArrowRight size={16} color={FAINT} />
              </a>
            ))}
          </div>

          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-primary btn-md" onClick={() => navigate('/chatbots')}>
              Open the chatbot demos <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ══ AI AGENTS UNDER THE HOOD ══ */}
      <section id="agents" className="section" style={{ background: W, padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 760, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="eyebrow">A few agents we've already built</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.02, marginBottom: 18,
            }}>
              Purpose-built agents.<br />Across every industry.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Five of the two-dozen agents we've shipped — each one designed for the specific
              conversation it handles, not a generic chatbot with a wig on.{' '}
              <a href="/ai-agents" style={{ color: R, fontWeight: 700, textDecoration: 'none' }}>
                See all 24 →
              </a>
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

      {/* ══ LEAD MAGNET — high-level "see the playbook" capture ══ */}
      <LeadMagnet
        magnet="koto-playbook"
        magnet_title="The Koto build playbook"
        eyebrow="Free playbook"
        headline="See how we build in weeks, not quarters."
        sub="The one-page playbook we follow on every engagement: scoping, tech stack, build cadence, integration, launch. Written plainly. Steal whatever's useful."
        bullets={[
          'The 5-day scoping framework we run on kickoff',
          'Our opinionated tech stack — what we use and why',
          'Build cadence — how we ship production code every week',
          'How we hand off so you own the code, not a black box',
        ]}
        cta="Email me the playbook"
        success_title="Playbook sent."
        success_sub="Check your inbox. We also included a 20-min invite if you want to walk through your specific build live."
        accent="pink"
        icon="download"
      />

      {/* ══ SCOPE BAND — "Gone are the days of picking a tool..." ══ */}
      <ScopeBand />

      {/* ══ CUSTOM-BUILD ══ */}
      <section id="custom" className="section" style={{ background: W, padding: '120px 40px 96px', borderTop: `1px solid ${HAIR}`, position: 'relative' }}>
        {/* Isolated gradient wrapper so overflow:hidden can't clip the headline ascenders */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)',
            width: 720, height: 300, borderRadius: '50%',
            background: `radial-gradient(ellipse at center, ${T}18 0%, ${R}18 60%, transparent 80%)`,
            filter: 'blur(80px)',
            animation: 'orbPulse 14s ease-in-out infinite',
          }} />
        </div>

        <div style={{ maxWidth: 1160, margin: '0 auto', position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 760, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="eyebrow" style={{ color: R }}>Custom-built AI</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.02, marginBottom: 18,
            }}>
              If you can describe it,<br />we can{' '}
              <span style={{
                color: R,
                fontSize: 'inherit', fontWeight: 'inherit', fontFamily: 'inherit',
                fontStyle: 'normal', letterSpacing: 'inherit', lineHeight: 'inherit',
                display: 'inline',
              }}>build it</span>
              <span style={{ color: INK }}>.</span>
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

      {/* ══ CONTACT BAND — large phone number, pitched at custom AI + systems ══ */}
      <section className="section" style={{ padding: '72px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          background: `linear-gradient(135deg, ${R}10, ${T}10)`,
          border: `1px solid ${HAIR}`, borderRadius: 24,
          padding: '56px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{
            position: 'absolute', top: -60, right: -60, width: 240, height: 240,
            borderRadius: '50%', background: R + '22', filter: 'blur(60px)',
          }} />
          <div aria-hidden="true" style={{
            position: 'absolute', bottom: -60, left: -60, width: 220, height: 220,
            borderRadius: '50%', background: T + '22', filter: 'blur(60px)',
          }} />

          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Contact us
            </div>
            <h2 className="sec-h2" style={{
              fontSize: 48, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', lineHeight: 1.05, color: INK, marginBottom: 16,
            }}>
              Learn more about our custom<br />AI agents and systems.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 520, margin: '0 auto 32px' }}>
              Tell us what you want to automate. We'll show you the working version — usually a prototype within a week.
            </p>

            <a href={CONTACT_PHONE_HREF} style={{
              display: 'block', fontSize: 68, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.045em', color: INK, lineHeight: 1, marginBottom: 24,
              textDecoration: 'none',
            }} className="home-contact-phone">
              {CONTACT_PHONE}
            </a>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/contact')}>
                Book a build session <ArrowRight size={16} />
              </button>
              <a href={CONTACT_PHONE_HREF} className="btn btn-secondary btn-lg" style={{ textDecoration: 'none' }}>
                <Phone size={16} /> Call now
              </a>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 700px) {
            .home-contact-phone { font-size: 42px !important; letter-spacing: -.03em !important; }
          }
        `}</style>
      </section>

      {/* ══ BUILT FOR SCALE ══ */}
      <section className="section" style={{ background: SURFACE, padding: '96px 40px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="eyebrow">Built for scale</div>
            <h2 className="sec-h2" style={{
              fontSize: 56, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.035em', color: INK, lineHeight: 1.02, marginBottom: 18,
            }}>
              Enterprise infrastructure.<br />Shipped at startup speed.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Koto is engineered for the businesses that want AI that actually works — with the security,
              auditability, and performance your customers, clients, and regulators expect.
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
              Have an idea?<br />We'll build it.
            </h2>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,.7)', fontFamily: FB, maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.55 }}>
              Custom AI agents, chatbots, and systems for any business — designed, built, and deployed fast. Tell us what you need.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-pink btn-lg" onClick={() => navigate('/contact')}>
                Book a build session <ArrowRight size={16} />
              </button>
              <a href={CONTACT_PHONE_HREF} className="btn btn-lg" style={{ background: 'transparent', color: W, border: '1px solid rgba(255,255,255,.3)', textDecoration: 'none' }}>
                <Phone size={16} /> {CONTACT_PHONE}
              </a>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginTop: 20 }}>
              Prototype in a week · Production in weeks, not quarters
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </>
  );
}
