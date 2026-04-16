"use client"

import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Phone, MessageSquare, MessageCircle, Heart,
  Briefcase, ShoppingBag, ShoppingCart, Building2, Stethoscope,
  Plane, Home, GraduationCap, Car, Sparkles, Brain, Shield,
  DollarSign, Umbrella, Utensils, Truck, Hammer, Users, Bed,
  BookOpen, Smile, PawPrint, Sun, Pill, Store, HardHat, Scissors,
  Leaf, Activity, Music,
} from 'lucide-react'
import { R, T, BLK, GRN, AMB, W, FH, FB } from '../lib/theme'
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from '../lib/contact'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import ScopeBand from '../components/public/ScopeBand'
import AgentCallMock from '../components/public/AgentCallMock'

const INK    = BLK
const MUTED  = '#6b7280'
const FAINT  = '#9ca3af'
const HAIR   = '#e5e7eb'
const SURFACE= '#f9fafb'
const WASH   = '#fafbfc'

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: ${W}; color: ${INK}; font-family: ${FH}; -webkit-font-smoothing: antialiased; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes orbPulse { 0%,100% { transform: translate(0,0) scale(1); opacity: .9; } 50% { transform: translate(40px,-20px) scale(1.08); opacity: 1; } }
  .fade { animation: fadeUp .6s ease both; }
  .btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; cursor: pointer; font-family: ${FH}; font-weight: 700; transition: all .18s; border: 1px solid transparent; padding: 12px 22px; font-size: 14px; }
  .btn-primary { background: ${INK}; color: ${W}; }
  .btn-primary:hover { background: #000; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(17,17,17,.18); }
  .btn-secondary { background: ${W}; color: ${INK}; border-color: ${HAIR}; }
  .btn-secondary:hover { border-color: ${INK}; transform: translateY(-1px); }
  .card { background: ${W}; border: 1px solid ${HAIR}; border-radius: 14px; padding: 26px; transition: border-color .2s, transform .2s, box-shadow .2s; }
  .card:hover { border-color: ${INK}; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(17,17,17,.06); }
  @media (max-width: 900px) {
    .m-hero-h1 { font-size: 48px !important; }
    .m-sec-h2 { font-size: 36px !important; }
    .m-grid-3 { grid-template-columns: 1fr !important; }
    .m-grid-2 { grid-template-columns: 1fr !important; }
    .m-pad { padding: 72px 24px !important; }
  }
`

const MODELS = [
  { name: 'Claude', vendor: 'Anthropic', accent: R, strengths: 'Deep reasoning, long-context analysis, nuanced writing, tool use', best: 'Strategy, investigation, content briefs, complex multi-step workflows' },
  { name: 'GPT-4 / 4o', vendor: 'OpenAI', accent: GRN, strengths: 'Fast general-purpose chat, function calling, vision, broad knowledge', best: 'Customer-facing chat, image understanding, classification, drafting' },
  { name: 'Gemini', vendor: 'Google', accent: T, strengths: 'Native multimodal, large context, strong on tables, integrated search', best: 'Image/video/document parsing, sheet analysis, research with grounding' },
  { name: 'Mistral', vendor: 'Mistral', accent: AMB, strengths: 'Fast, cost-efficient open-weights, private deployment', best: 'High-volume routing, classification, summarization, private AI' },
  { name: 'Llama', vendor: 'Meta', accent: BLK, strengths: 'Open-weights, self-hostable, fine-tunable on your data', best: 'Regulated industries, air-gapped systems, custom fine-tunes' },
  { name: 'Specialist models', vendor: 'Perplexity · xAI · Cohere', accent: '#8b5cf6', strengths: 'Live search grounding, real-time data, specialized retrieval', best: 'Research agents, market intel, citation-heavy workflows' },
]

const PIPELINE = [
  { num: '01', title: 'Define the job', desc: 'We start with the real workflow. What decisions is the agent making? What data does it need? Where does a human stay in the loop? No generic chatbot boxes — we design for the specific outcome.' },
  { num: '02', title: 'Pick the right model(s)', desc: 'Not one model for everything. Deep reasoning to Claude Opus, fast chat to GPT-4o, vision to Gemini, cheap classification to Mistral. One agent, multiple models, each picked for what it does best.' },
  { num: '03', title: 'Ground in your data', desc: 'Agents are only useful when they know your world. We connect to your CRM, calendar, inventory, policies, historical tickets, pricing, and docs — so every answer is rooted in your reality.' },
  { num: '04', title: 'Give it real tools', desc: 'Agents need to do things, not just talk. They call APIs, update databases, send emails, book appointments, post to Slack. Every tool call is logged, rate-limited, and wrapped in your policies.' },
  { num: '05', title: 'Test against real cases', desc: 'Before launch we run the agent against real historical cases from your business — tickets, calls, emails. We measure accuracy, latency, and cost per run before it touches a single customer.' },
  { num: '06', title: 'Deploy and refine', desc: 'Every conversation and decision is logged. We monitor for drift, add test cases, tune prompts, and swap in better models when they arrive. Most agents get meaningful updates monthly.' },
]

const AGENTS = [
  { icon: Phone, title: 'Outbound Cold Call Agent', industry: 'Sales', accent: R, desc: 'Works a lead list, qualifies interest, handles objections, books meetings directly onto the calendar. Sounds human, scales infinitely.' },
  { icon: MessageSquare, title: 'AI Front Desk', industry: 'Inbound', accent: T, desc: 'Answers every inbound call 24/7, schedules appointments, handles FAQs, hands off cleanly to a human when it matters.' },
  { icon: Stethoscope, title: 'Verification of Benefits', industry: 'Healthcare', accent: GRN, desc: 'Calls insurance companies, navigates the IVR, runs the full 72-question verification, returns a structured benefits report.' },
  { icon: Briefcase, title: 'Legal Intake Concierge', industry: 'Law', accent: BLK, desc: 'Qualifies every inbound caller by matter type, runs conflict checks, books the consult with the right attorney.' },
  { icon: Home, title: 'Real Estate Showing Scheduler', industry: 'Real estate', accent: AMB, desc: 'Responds to property inquiries, qualifies buyers, schedules showings, sends neighborhood-specific intelligence.' },
  { icon: Car, title: 'Collision Estimator', industry: 'Auto body', accent: '#8b5cf6', desc: 'Customer submits photos, AI identifies damage and parts, returns an insurance-ready repair estimate in seconds.' },
  { icon: Building2, title: 'Property Management Assistant', industry: 'Property mgmt', accent: T, desc: 'Handles tenant maintenance requests, triages urgency, schedules vendors, files the paperwork.' },
  { icon: Heart, title: 'Patient Intake Assistant', industry: 'Clinical', accent: R, desc: 'Pre-visit intake by phone or text — medical history, insurance, reason for visit — all structured in your EMR.' },
  { icon: GraduationCap, title: 'Admissions Counselor Agent', industry: 'Education', accent: GRN, desc: 'Guides prospective students through program selection, answers questions, schedules tours, sends application links.' },
  { icon: Plane, title: 'Travel Concierge', industry: 'Travel', accent: AMB, desc: 'Plans trips end-to-end — flights, hotels, ground, dining — within each client\'s budget and taste.' },
  { icon: DollarSign, title: 'Mortgage Loan Officer Assistant', industry: 'Finance', accent: GRN, desc: 'Pre-qualifies borrowers, collects docs, explains loan products, and prepares the file before it reaches a human LO.' },
  { icon: Umbrella, title: 'Insurance Quote Bot', industry: 'Insurance', accent: T, desc: 'Walks prospects through a quote by phone or text, pulls carrier rates, binds coverage, and emails the policy.' },
  { icon: Smile, title: 'Dental Recall Coordinator', industry: 'Dental', accent: R, desc: 'Calls patients due for cleanings, confirms insurance, finds an opening that fits, and books the appointment.' },
  { icon: PawPrint, title: 'Veterinary Appointment Scheduler', industry: 'Veterinary', accent: AMB, desc: 'Handles pet intake by phone — species, age, symptoms, urgency — routes emergencies and schedules routine visits.' },
  { icon: Brain, title: 'Mental Health Triage Bot', industry: 'Behavioral health', accent: '#8b5cf6', desc: 'Gentle intake flow that screens for urgency, matches patient to the right therapist, and books the first session.' },
  { icon: Activity, title: 'Chiropractic Front Desk', industry: 'Chiropractic', accent: GRN, desc: 'Answers inbound calls, handles new-patient intake, verifies insurance, schedules adjustments — evenings and weekends included.' },
  { icon: Sparkles, title: 'Med Spa Booking Concierge', industry: 'Beauty / wellness', accent: R, desc: 'Books consultations, quotes package pricing, explains treatments, and recovers no-shows with auto-text follow-ups.' },
  { icon: HardHat, title: 'Roofing Storm-Lead Responder', industry: 'Home services', accent: AMB, desc: 'Calls inbound storm-damage leads within 60 seconds, qualifies the roof, schedules the inspection, sends insurance tips.' },
  { icon: Sun, title: 'Solar Consultation Bot', industry: 'Solar', accent: AMB, desc: 'Runs the energy-bill qualification, calculates rough savings, books the in-home design consultation, nurtures cold leads.' },
  { icon: Utensils, title: 'Restaurant Reservation Concierge', industry: 'Restaurant', accent: R, desc: 'Takes reservations by phone, handles waitlist, answers allergy questions, manages private events and catering inquiries.' },
  { icon: Bed, title: 'Hotel Pre-Arrival Concierge', industry: 'Hospitality', accent: T, desc: 'Upgrades rooms, books amenities, answers local questions, and handles early check-in requests before the guest arrives.' },
  { icon: ShoppingCart, title: 'E-commerce Returns Specialist', industry: 'Retail', accent: BLK, desc: 'Handles returns end-to-end: reason, photo review, refund vs exchange, label generation — all in a single conversation.' },
  { icon: Users, title: 'Recruiter Screening Agent', industry: 'Staffing / HR', accent: T, desc: 'Pre-screens every applicant by phone, scores fit against the job rubric, schedules interviews with the right recruiter.' },
  { icon: Heart, title: 'Nonprofit Donor Engagement', industry: 'Nonprofit', accent: R, desc: 'Thanks every donor personally, recovers lapsed givers, runs campaign outreach, and pre-qualifies major gift prospects.' },
  { icon: Activity, title: 'Senior Care Intake', industry: 'Home health', accent: GRN, desc: 'Gentle family-facing intake: level of care needed, insurance, schedule, concerns — structured into a care plan summary.' },
  { icon: Truck, title: 'Logistics Dispatch Bot', industry: 'Logistics', accent: AMB, desc: 'Takes freight bookings, quotes rates from live carrier data, dispatches loads, and keeps shippers updated in real time.' },
  { icon: Store, title: 'Franchise Lead Qualifier', industry: 'Franchise dev', accent: BLK, desc: 'Qualifies franchise candidates against net-worth and territory rules, books discovery calls, starts the FDD process.' },
  { icon: Car, title: 'Dealership Internet Sales Agent', industry: 'Auto sales', accent: R, desc: 'Responds to every internet lead within a minute, answers model questions, books test drives, and holds the vehicle.' },
  { icon: BookOpen, title: 'Tutoring Matching Agent', industry: 'Tutoring', accent: T, desc: 'Screens students\' needs, matches them to tutors by subject and learning style, schedules sessions, sends prep materials.' },
  { icon: Scissors, title: 'Salon Booking + Reminders', industry: 'Salon / spa', accent: '#8b5cf6', desc: 'Books color + cuts, confirms allergies, manages waitlists, and auto-fills cancellations from the priority list.' },
  { icon: Hammer, title: 'Construction Bid Assistant', industry: 'Construction', accent: AMB, desc: 'Takes RFQ calls, collects scope, measures from drawings, assembles pricing from historical jobs, drafts the bid.' },
  { icon: Leaf, title: 'Landscaping Estimator', industry: 'Landscaping', accent: GRN, desc: 'Measures properties from aerial imagery, quotes mowing / design / install, books the walkthrough, sends the estimate.' },
  { icon: Pill, title: 'Pharmacy Refill Bot', industry: 'Pharmacy', accent: R, desc: 'Patient calls for a refill — the bot checks authorization, insurance, pickup window, and alerts the pharmacist if there\'s a conflict.' },
  { icon: Music, title: 'Music School Enrollment', industry: 'Arts / education', accent: T, desc: 'Books trial lessons, matches students to instructors by instrument and style, handles recital RSVPs, collects tuition.' },
]

const CHATBOTS = [
  { icon: ShoppingBag, title: 'E-commerce Shopping Assistant', desc: 'Helps shoppers find products, compares SKUs against their needs, checks inventory, applies discounts, and completes checkout — inside the chat window.' },
  { icon: Briefcase, title: 'Internal Policy & HR Bot', desc: 'Employees ask anything from PTO balance to "what\'s the expense policy for client dinners" — grounded in your real policies and live HRIS.' },
  { icon: MessageCircle, title: 'Support Deflection Bot', desc: 'Handles Tier-1 support: password resets, billing questions, order status. Escalates cleanly with full context when a human is needed.' },
  { icon: Brain, title: 'Onboarding Coach', desc: 'Walks new users through setup step-by-step, remembers where they left off, nudges them back if they go quiet for a few days.' },
  { icon: Sparkles, title: 'Research & Competitive Intel', desc: 'Takes a question like "who else sells to mid-market dental groups in Florida?" and returns a sourced, structured brief in minutes.' },
  { icon: Shield, title: 'Compliance Q&A', desc: 'Employees paste in clauses, copy, or policy text — the bot flags risks, cites the relevant regulation, and suggests fixes.' },
  { icon: Stethoscope, title: 'Patient Education Bot', desc: 'Answers treatment, medication, and post-op questions in plain language, escalates anything clinical to a nurse, logs every interaction.' },
  { icon: Users, title: 'Sales Enablement Bot', desc: 'Reps ask "what\'s the latest pricing for enterprise with a two-year?" — the bot returns the answer grounded in live playbooks and approved slides.' },
  { icon: BookOpen, title: 'Knowledge Base Concierge', desc: 'Replaces a stale FAQ page. Retrieves from every internal doc, cites the source, and learns from every "not quite right" feedback loop.' },
  { icon: DollarSign, title: 'Finance & Billing Bot', desc: 'Clients ask about invoices, payment status, refund eligibility — the bot looks it up in your billing system and responds with the exact answer.' },
]

export default function AIAgentsMarketingPage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: W }}>
      <style>{CSS}</style>
      <PublicNav />
      <div style={{ height: 64 }} />

      {/* HERO */}
      <section className="m-pad" style={{ padding: '120px 40px 80px', position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 40, left: '10%', width: 500, height: 500, borderRadius: '50%', background: R + '28', filter: 'blur(100px)', animation: 'orbPulse 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 100, right: '8%', width: 460, height: 460, borderRadius: '50%', background: T + '26', filter: 'blur(100px)', animation: 'orbPulse 13s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div className="fade" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, border: `1px solid ${HAIR}`, background: WASH, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            AI Agent Development
          </div>
          <h1 className="m-hero-h1" style={{ fontSize: 76, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', lineHeight: 1.05, color: INK, maxWidth: 940, margin: '0 auto' }}>
            Purpose-built AI agents,<br />powered by every major model.
          </h1>
          <p style={{ fontSize: 20, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 680, margin: '24px auto 0' }}>
            We don't pick a model and hope for the best. We route every task to the AI best suited for it —
            Claude, GPT-4, Gemini, Mistral, Llama, and more — so each agent performs at the edge of what's possible.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/contact')}>Book a build session <ArrowRight size={14} /></button>
            <a href={CONTACT_PHONE_HREF} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              <Phone size={14} /> {CONTACT_PHONE}
            </a>
          </div>
        </div>
      </section>

      {/* WATCH THEM WORK — five live conversational agent demos */}
      <section className="m-pad" style={{ padding: '48px 40px 96px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Watch them work
            </div>
            <h2 className="m-sec-h2" style={{
              fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em',
              color: INK, lineHeight: 1.05, marginBottom: 18,
            }}>
              Five live agents, five real calls.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Auto-playing simulations of what each agent does on an actual call — real-looking
              transcript on the left, structured data capture on the right, outcome at the end.
              All numbers, names, and dialogue fabricated for the demo.
            </p>
          </div>

          {/* Mock 1: Cold Call Agent */}
          <div style={{ marginBottom: 28 }}>
            <AgentCallMock config={{
              icon: Phone, accent: R,
              title: 'Cold Call Agent — Coastal Air Solutions',
              callerName: 'Sarah Johnson · Facilities Mgr',
              callerMeta: 'Bayside Property Mgmt · Dallas TX',
              capturingLabel: 'Live CRM sync',
              turns: [
                { step: 1,  role: 'bot',    text: "Hi Sarah, this is Koto calling on behalf of Coastal Air Solutions. Do you have 60 seconds?" },
                { step: 3,  role: 'caller', text: "Oh — hi. I'm about to head into a meeting, honestly." },
                { step: 5,  role: 'bot',    text: "No problem, I'll be brief. We're offering free preventive-maintenance walk-throughs for property managers this month. Quick question — who handles your HVAC now?" },
                { step: 7,  role: 'caller', text: "We've got a guy we've used for years." },
                { step: 9,  role: 'bot',    text: "Totally get that. Most managers we speak with already have someone. Our walkthrough usually finds 15–30% cost savings on the rooftop units, and it's no-commitment. Want the 20-point report?" },
                { step: 11, role: 'caller', text: "What's involved?" },
                { step: 13, role: 'bot',    text: "Thirty-minute site visit, thermal imaging, refrigerant check, written cost-optimization report within 48 hours. Our tech Mike has openings Tuesday or Wednesday next week — which works?" },
                { step: 15, role: 'caller', text: "Tuesday at 2 would work." },
                { step: 17, role: 'bot',    text: "Perfect — booking Mike for Tuesday Oct 21 at 2 PM at your Bayside portfolio office. I'll email the confirmation and his bio, and he'll text 20 minutes before. Thanks Sarah!" },
              ],
              capture: [
                { step: 2,  label: 'Lead',        value: 'Sarah Johnson' },
                { step: 4,  label: 'Company',     value: 'Bayside Property Mgmt' },
                { step: 6,  label: 'Objection',   value: 'Existing vendor', pill: 'HANDLED', pillColor: AMB },
                { step: 10, label: 'Interest',    value: 'Asked about assessment details' },
                { step: 14, label: 'Intent',      value: 'Qualified', pill: 'HIGH', pillColor: GRN },
                { step: 16, label: 'Booked',      value: 'Tue Oct 21 · 2:00 PM' },
                { step: 18, label: 'Assigned',    value: 'Mike Reyes (Senior Tech)' },
                { step: 19, label: 'Lead score',  value: '82 / 100', pill: 'TOP 20%', pillColor: R },
              ],
              outcome: {
                step: 22,
                title: 'Call ended · Meeting booked',
                detail: 'CRM updated · calendar invite sent to Sarah · Mike alerted · follow-up email scheduled for day-of',
                accent: GRN,
              },
              footerLabel: 'Outbound Agent · Coastal Air Solutions',
              footerStats: [
                { label: 'Calls today', value: '427' },
                { label: 'Meetings booked', value: '38' },
                { label: 'Conn-to-meeting', value: '8.9%' },
              ],
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Outbound Cold Call.</strong> Qualifies, handles objections, books the meeting. Scales infinitely.
            </div>
          </div>

          {/* Mock 2: AI Front Desk — Dental emergency */}
          <div style={{ marginBottom: 28 }}>
            <AgentCallMock config={{
              icon: MessageSquare, accent: T,
              title: 'AI Front Desk — Hartwell Dental',
              callerName: 'Jessica Martinez · New patient',
              callerMeta: 'Inbound · +1 (305) 555-0137',
              capturingLabel: 'Inbound intake',
              turns: [
                { step: 1,  role: 'bot',    text: "Good afternoon, Hartwell Dental Group — this is our AI receptionist. How can I help?" },
                { step: 3,  role: 'caller', text: "Hi, I have a really bad toothache, I think I need to come in today." },
                { step: 5,  role: 'bot',    text: "I'm so sorry. Let me triage real quick — which tooth, and what's the pain level 1 to 10?" },
                { step: 7,  role: 'caller', text: "Upper right molar, probably an 8. There's some swelling." },
                { step: 9,  role: 'bot',    text: "Got it. Any fever, trouble breathing, or spreading swelling?" },
                { step: 11, role: 'caller', text: "No fever, swelling's just around the tooth." },
                { step: 13, role: 'bot',    text: "Okay — that needs to be seen today. Dr. Hartwell has an emergency slot at 4:15 PM. Can you make that?" },
                { step: 15, role: 'caller', text: "Yes please!" },
                { step: 17, role: 'bot',    text: "Booking now. Can I get your full name, date of birth, and insurance?" },
                { step: 19, role: 'caller', text: "Jessica Martinez, March 15 1988, Delta Dental PPO." },
                { step: 21, role: 'bot',    text: "Verified — you're in-network. You're booked for today 4:15 PM with Dr. Hartwell. Confirmation text + intake forms are on their way. If the pain worsens or swelling spreads, call 911 or come in immediately." },
              ],
              capture: [
                { step: 2,  label: 'Caller',      value: 'New patient' },
                { step: 6,  label: 'Tooth',       value: 'Upper right molar #3' },
                { step: 8,  label: 'Pain',        value: '8 / 10', pill: 'SEVERE', pillColor: R },
                { step: 10, label: 'Swelling',    value: 'Localized · no fever' },
                { step: 12, label: 'Triage',      value: 'Urgent · see today', pill: 'EMERGENCY', pillColor: R },
                { step: 16, label: 'Slot',        value: 'Today · 4:15 PM · Dr. Hartwell' },
                { step: 20, label: 'Patient',     value: 'Jessica Martinez · DOB 3/15/88' },
                { step: 22, label: 'Insurance',   value: 'Delta Dental PPO', pill: 'IN-NETWORK', pillColor: GRN },
              ],
              outcome: {
                step: 25,
                title: 'Booked · Confirmation sent',
                detail: 'Appointment in EMR · intake forms texted to patient · hygienist + operatory prepped · Dr. Hartwell alerted',
                accent: T,
              },
              footerLabel: 'Inbound Agent · Hartwell Dental',
              footerStats: [
                { label: 'Calls today', value: '94' },
                { label: 'Answered', value: '100%' },
                { label: 'Booked rate', value: '78%' },
              ],
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Inbound Front Desk.</strong> 24/7 intake with medical-grade triage and live insurance verification.
            </div>
          </div>

          {/* Mock 3: VOB Agent — Insurance verification */}
          <div style={{ marginBottom: 28 }}>
            <AgentCallMock config={{
              icon: Stethoscope, accent: GRN,
              title: 'VOB Agent — Thrive Behavioral Health',
              callerName: 'Calling Anthem BCBS',
              callerMeta: 'On behalf of patient Mark Chen',
              capturingLabel: 'Benefits being verified',
              totalSteps: 38,
              turns: [
                { step: 1,  role: 'bot',    text: "[Dialing Anthem BCBS provider services...]" },
                { step: 2,  role: 'caller', text: "[IVR] Thank you for calling Anthem. Press 1 for provider services." },
                { step: 3,  role: 'bot',    text: "[Pressed 1 · Entered TIN · Selected benefits verification]" },
                { step: 5,  role: 'caller', text: "[Hold music · 4:22 on hold]" },
                { step: 7,  role: 'caller', text: "Provider services, this is Linda. How can I help?" },
                { step: 9,  role: 'bot',    text: "Hi Linda. Calling to verify outpatient mental-health benefits for member ID EV4728192, DOB 6-12-1985, for CPT 90837." },
                { step: 11, role: 'caller', text: "One moment... okay, I have the member. Active PPO plan, effective 1-1-2026." },
                { step: 13, role: 'bot',    text: "Great — what's the individual deductible and how much has been met?" },
                { step: 15, role: 'caller', text: "Individual deductible is $2,500, family is $5,000. He's met $1,840 year-to-date." },
                { step: 17, role: 'bot',    text: "Copay for CPT 90837?" },
                { step: 19, role: 'caller', text: "$40 copay after deductible is met. 80/20 coinsurance until out-of-pocket max." },
                { step: 21, role: 'bot',    text: "Prior auth requirements, and is telehealth covered at parity?" },
                { step: 23, role: 'caller', text: "Prior auth required for more than 12 sessions per year. Telehealth is covered same as in-person." },
                { step: 25, role: 'bot',    text: "Thanks Linda. Can I get a reference number for this call?" },
                { step: 27, role: 'caller', text: "Sure — REF-884721. Anything else?" },
                { step: 29, role: 'bot',    text: "That's all, thank you. Have a great day." },
              ],
              capture: [
                { step: 4,  label: 'IVR',         value: 'Navigated', pill: 'AUTO', pillColor: T },
                { step: 6,  label: 'Hold',        value: '4m 22s' },
                { step: 10, label: 'Member',      value: 'Mark Chen · ID EV4728192' },
                { step: 12, label: 'Plan',        value: 'Anthem BCBS PPO', pill: 'ACTIVE', pillColor: GRN },
                { step: 16, label: 'Deductible',  value: '$2,500 ind · $1,840 met' },
                { step: 20, label: 'Copay',       value: '$40 after ded · 80/20 coins' },
                { step: 24, label: 'Prior auth',  value: 'Required >12 sessions' },
                { step: 24, label: 'Telehealth',  value: 'Covered at parity', pill: 'YES', pillColor: GRN },
                { step: 28, label: 'Reference',   value: 'REF-884721' },
              ],
              outcome: {
                step: 31,
                title: 'Benefits verified · report delivered',
                detail: 'Structured benefits summary filed in EMR · front desk + patient notified · first session pre-authorized',
                accent: GRN,
              },
              footerLabel: 'VOB Agent · Thrive Behavioral Health',
              footerStats: [
                { label: 'VOBs today', value: '47' },
                { label: 'Avg call', value: '11m 40s' },
                { label: 'Rep-refusal rate', value: '2.1%' },
              ],
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Healthcare VOB Agent.</strong> Calls the payer, waits on hold, interviews the rep, files the benefits report.
            </div>
          </div>

          {/* Mock 4: Virtual Onboarding (Alex) */}
          <div style={{ marginBottom: 28 }}>
            <AgentCallMock config={{
              icon: MessageCircle, accent: BLK,
              title: 'Virtual Onboarding · Alex',
              callerName: 'Dr. Elena Ramirez · New agency client',
              callerMeta: 'Coral Gables Dermatology · inbound',
              capturingLabel: 'Onboarding doc building',
              turns: [
                { step: 1,  role: 'bot',    text: "Hi Dr. Ramirez! I'm Alex — your dedicated onboarding assistant at Summit Marketing. I'll grab a few quick details so your team can hit the ground running. Sound good?" },
                { step: 3,  role: 'caller', text: "Sure, let's do it." },
                { step: 5,  role: 'bot',    text: "First — what's the primary service you want us focused on?" },
                { step: 7,  role: 'caller', text: "Cosmetic derm, mostly Botox and fillers. That's our highest margin work." },
                { step: 9,  role: 'bot',    text: "Who's your ideal patient?" },
                { step: 11, role: 'caller', text: "Women 35 to 55, household income over $100k, living within 15 miles of Coral Gables." },
                { step: 13, role: 'bot',    text: "What makes your practice different from the other injectors out there?" },
                { step: 15, role: 'caller', text: "We're board-certified, we use only Allergan products, and our lead injector has 12 years of experience." },
                { step: 17, role: 'bot',    text: "Monthly ad budget range?" },
                { step: 19, role: 'caller', text: "Eight to twelve thousand, depending on season." },
                { step: 21, role: 'bot',    text: "Any welcome-patient offer we can promote?" },
                { step: 23, role: 'caller', text: "Yes — $100 off first Botox treatment." },
                { step: 25, role: 'bot',    text: "Perfect, that's everything. Your team at Summit is going to receive a 20-page onboarding doc, a brand brief, and a 90-day growth plan within the hour. Talk soon!" },
              ],
              capture: [
                { step: 2,  label: 'Client',      value: 'Coral Gables Derm · Dr. Ramirez' },
                { step: 8,  label: 'Service',     value: 'Cosmetic derm · Botox + fillers' },
                { step: 12, label: 'Target',      value: 'W 35-55 · $100k+ HH · 15-mi radius' },
                { step: 16, label: 'USP',         value: 'Board-cert · Allergan · 12-yr injector' },
                { step: 20, label: 'Budget',      value: '$8-12k / mo' },
                { step: 24, label: 'Offer',       value: '$100 off first Botox' },
                { step: 25, label: 'Classifier',  value: 'Local B2C', pill: 'AUTO-TAGGED', pillColor: T },
                { step: 26, label: 'Doc status',  value: '100%', pill: 'READY', pillColor: GRN },
              ],
              outcome: {
                step: 28,
                title: '20-page doc generated · agency alerted',
                detail: 'Strategy doc + brand brief + 90-day plan emailed to Summit Marketing · client confirmation sent · phone number released',
                accent: BLK,
              },
              footerLabel: 'Onboarding Agent · Summit Marketing',
              footerStats: [
                { label: 'Calls this week', value: '23' },
                { label: 'Avg duration', value: '18m' },
                { label: 'Completion', value: '96%' },
              ],
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Virtual Onboarding (Alex).</strong> Every new client gets a dedicated number and finishes their own interview.
            </div>
          </div>

          {/* Mock 5: Legal Intake Concierge */}
          <div style={{ marginBottom: 28 }}>
            <AgentCallMock config={{
              icon: Briefcase, accent: AMB,
              title: 'Legal Intake Concierge · Morales & Associates',
              callerName: 'John Walsh · Inbound',
              callerMeta: '+1 (305) 555-0188 · Miami',
              capturingLabel: 'Case file building',
              turns: [
                { step: 1,  role: 'caller', text: "Hi, I was in a car accident last week and I need help." },
                { step: 3,  role: 'bot',    text: "I'm so sorry you're dealing with this. I'm the intake assistant at Morales & Associates. Can you walk me through what happened?" },
                { step: 5,  role: 'caller', text: "Last Tuesday on I-95 southbound, near the SW 8th Street exit — I was stopped and got rear-ended hard." },
                { step: 7,  role: 'bot',    text: "Was a police report filed, and did you go to the ER or a doctor?" },
                { step: 9,  role: 'caller', text: "Yes, police report was filed on-scene. I went to the ER that night and I've been seeing a chiropractor three times a week since." },
                { step: 11, role: 'bot',    text: "What injuries are you treating right now?" },
                { step: 13, role: 'caller', text: "Lower back pain, headaches, neck stiffness." },
                { step: 15, role: 'bot',    text: "Who are you insured with, and do you carry PIP?" },
                { step: 17, role: 'caller', text: "State Farm, full coverage including PIP." },
                { step: 19, role: 'bot',    text: "Thank you. Let me run a quick conflict check... [10 seconds] ... cleared. Attorney Morales has openings tomorrow at 10:30 AM by Zoom or 2 PM in-person. Which works better?" },
                { step: 21, role: 'caller', text: "Zoom tomorrow at 10:30 would be great." },
                { step: 23, role: 'bot',    text: "Booked. I'm texting you the Zoom link, a list of documents to bring, and a confidentiality acknowledgment. Attorney Morales will call you by phone first if the Zoom doesn't connect. Hang in there." },
              ],
              capture: [
                { step: 4,  label: 'Caller',        value: 'John Walsh' },
                { step: 6,  label: 'Case type',     value: 'Auto · rear-end', pill: 'STANDARD', pillColor: GRN },
                { step: 6,  label: 'Date/location', value: 'Oct 14 · I-95 S @ SW 8 St' },
                { step: 10, label: 'Police report', value: 'Filed on-scene' },
                { step: 10, label: 'Medical care',  value: 'ER same night · chiro 3×/wk' },
                { step: 14, label: 'Injuries',      value: 'L-back · headaches · neck' },
                { step: 18, label: 'Insurance',     value: 'State Farm · PIP confirmed' },
                { step: 20, label: 'Conflict',      value: 'Cleared', pill: 'OK', pillColor: GRN },
                { step: 22, label: 'Consult',       value: 'Tomorrow · 10:30 AM Zoom' },
                { step: 22, label: 'Attorney',      value: 'Morales (lead)' },
              ],
              outcome: {
                step: 26,
                title: 'Intake memo drafted · consult booked',
                detail: 'Case file created in CRM · Zoom link + document list texted to client · Attorney Morales briefed · statute-of-limitations tracker started',
                accent: AMB,
              },
              footerLabel: 'Intake Agent · Morales & Associates',
              footerStats: [
                { label: 'Intakes this week', value: '41' },
                { label: 'Avg qualify time', value: '4m 18s' },
                { label: 'Sign rate', value: '73%' },
              ],
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Legal Intake Concierge.</strong> Qualifies by case type, runs conflict check, books the right attorney, drafts the memo.
            </div>
          </div>
        </div>
      </section>

      {/* MODELS */}
      <section className="m-pad" style={{ padding: '96px 40px', background: SURFACE, borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Multi-model by design</div>
            <h2 className="m-sec-h2" style={{ fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: INK, lineHeight: 1.05, marginBottom: 18 }}>
              The right model for the right job.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Each foundation model has strengths. Our agents dispatch tasks to whichever wins for that
              specific sub-task — then reconcile the outputs into a single coherent response.
            </p>
          </div>
          <div className="m-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {MODELS.map(m => (
              <div key={m.name} className="card" style={{ background: W }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: m.accent + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Brain size={20} color={m.accent} />
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: MUTED, fontFamily: FB }}>{m.vendor}</div>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Strengths</div>
                  <div style={{ fontSize: 13, color: INK, fontFamily: FB, lineHeight: 1.55 }}>{m.strengths}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Best for</div>
                  <div style={{ fontSize: 13, color: MUTED, fontFamily: FB, lineHeight: 1.55 }}>{m.best}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCOPE BAND — "Gone are the days..." */}
      <ScopeBand />

      {/* PIPELINE */}
      <section className="m-pad" style={{ padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Development process</div>
            <h2 className="m-sec-h2" style={{ fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: INK, lineHeight: 1.05 }}>
              Six stages, every build.
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {PIPELINE.map((p, i) => (
              <div key={p.num} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 24, padding: '28px 0', borderBottom: i < PIPELINE.length - 1 ? `1px solid ${HAIR}` : 'none' }}>
                <div style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.04em', color: FAINT, lineHeight: 1 }}>{p.num}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginBottom: 6 }}>{p.title}</div>
                  <p style={{ fontSize: 15, color: MUTED, fontFamily: FB, lineHeight: 1.65 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AGENT EXAMPLES (10) */}
      <section className="m-pad" style={{ padding: '96px 40px', background: SURFACE, borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Agent examples</div>
            <h2 className="m-sec-h2" style={{ fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: INK, lineHeight: 1.05, marginBottom: 18 }}>
              Two dozen agents. Every industry.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              A sample of what we've built and what we can build. If your workflow isn't on the list,
              it doesn't mean we can't do it — it probably means we've never been asked yet.
            </p>
          </div>
          <div className="m-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
            {AGENTS.map(a => {
              const Icon = a.icon
              return (
                <div key={a.title} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: a.accent + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} color={a.accent} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: a.accent, background: a.accent + '12', padding: '4px 10px', borderRadius: 100, letterSpacing: '.06em', textTransform: 'uppercase' }}>{a.industry}</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginBottom: 8 }}>{a.title}</div>
                  <p style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>{a.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CHATBOT EXAMPLES */}
      <section className="m-pad" style={{ padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Chatbots</div>
            <h2 className="m-sec-h2" style={{ fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: INK, lineHeight: 1.05 }}>
              Bots that actually know your business.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6, marginTop: 18 }}>
              Not template bots. Each one is grounded in your real data, retrieves from your docs, and
              can call your APIs when it needs to do something real.
            </p>
          </div>
          <div className="m-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {CHATBOTS.map(c => {
              const Icon = c.icon
              return (
                <div key={c.title} className="card" style={{ background: SURFACE }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: T + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Icon size={20} color={T} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginBottom: 8 }}>{c.title}</div>
                  <p style={{ fontSize: 13, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>{c.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="m-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 960, margin: '0 auto', background: INK, borderRadius: 24, padding: '64px 48px', textAlign: 'center', color: W, position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', background: R + '30', filter: 'blur(70px)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', bottom: -100, left: -100, width: 280, height: 280, borderRadius: '50%', background: T + '30', filter: 'blur(70px)' }} />
          <div style={{ position: 'relative' }}>
            <h2 className="m-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: W, lineHeight: 1.05, marginBottom: 18 }}>
              Have an agent idea?<br />Let's build it.
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, maxWidth: 540, margin: '0 auto 32px' }}>
              Tell us the workflow. We'll show you the agent — prototype in a week, production in a month.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary" style={{ background: R, borderColor: R }} onClick={() => navigate('/contact')}>Book a build session <ArrowRight size={14} /></button>
              <a href={CONTACT_PHONE_HREF} style={{ color: W, textDecoration: 'none', fontFamily: FH, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px' }}>
                <Phone size={14} /> {CONTACT_PHONE}
              </a>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
