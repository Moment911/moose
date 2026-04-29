"use client"

import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Phone, Utensils, Car, Scale, Wrench, Home,
  Droplet, Dumbbell, Plug, Workflow, Database, Link2, Check,
  ChefHat, Stethoscope, DollarSign, Package, Hammer, Bed,
  Truck, Smile, BarChart2, CalendarClock, Sun, Users,
  Mail, FileText, Camera, Sparkles, AlertCircle, Star,
} from 'lucide-react'
import { R, T, BLK, GRN, AMB, W, FH, FB } from '../lib/theme'
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from '../lib/contact'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import ScopeBand from '../components/public/ScopeBand'
import InlineSystemMock from '../components/public/InlineSystemMock'
import PartsOrderMock from '../components/public/PartsOrderMock'
import TrustStrip from '../components/public/TrustStrip'
import LeadMagnet from '../components/public/LeadMagnet'
import { usePageMeta } from '../lib/usePageMeta'

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
  @media (max-width: 900px) {
    .m-hero-h1 { font-size: 48px !important; }
    .m-sec-h2 { font-size: 36px !important; }
    .m-grid-3 { grid-template-columns: 1fr !important; }
    .m-grid-2 { grid-template-columns: 1fr !important; }
    .m-pad { padding: 72px 24px !important; }
    .mock-split { grid-template-columns: 1fr !important; }
    .mock-split > div:first-child { border-right: none !important; border-bottom: 1px solid ${HAIR} !important; }
  }
`

const INTEGRATIONS = [
  'Salesforce', 'HubSpot', 'GoHighLevel', 'Monday', 'Asana', 'ClickUp',
  'Slack', 'Microsoft Teams', 'Gmail', 'Outlook', 'Twilio', 'Telnyx',
  'Stripe', 'QuickBooks', 'Xero', 'Shopify', 'WooCommerce', 'Square',
  'Airtable', 'Notion', 'Google Workspace', 'Zapier', 'Make',
  'Webhooks', 'REST APIs', 'GraphQL', 'SOAP', 'SFTP', 'JDBC / ODBC',
]

const SYSTEMS = [
  {
    industry: 'Catering', accent: R, icon: ChefHat, live: true,
    title: 'Catering Order Management Tool',
    scenario: 'Catering company running 40+ orders a day across drop-off, buffet, and plated service.',
    steps: [
      'Customer places an order online — menu, headcount, delivery window, dietary notes captured',
      'AI validates feasibility against kitchen capacity, staff on schedule, and driver routes',
      'Kitchen ticket auto-prints with prep order, pack list, and dietary callouts',
      'Driver gets a pre-loaded route with timing, access instructions, and customer phone',
      'Customer receives live ETA updates; last-minute changes route back to the kitchen automatically',
    ],
    metric: 'Live with a South Florida catering client · $0 order-entry labor',
  },
  {
    industry: 'Catering', accent: AMB, icon: Utensils,
    title: 'Wedding Quote Bot',
    scenario: 'New inquiry arrives via web form or email.',
    steps: [
      'Reads the inquiry, extracts event type, date, guest count, venue, dietary notes',
      'Pulls your current menu pricing and service fees from your catering platform',
      'Calculates line items: food, bar, staff, dietary accommodations, venue setup',
      'Generates a polished PDF quote with your branding',
      'Emails it to the customer and logs the deal in your CRM',
    ],
    metric: 'Quote ready in 3.2s · 64% booking rate',
  },
  {
    industry: 'Auto body', accent: BLK, icon: Car,
    title: 'Collision Photo Estimator',
    scenario: 'Customer texts photos of the damage.',
    steps: [
      'AI identifies the vehicle, affected panels, and severity of damage',
      'Looks up OEM vs aftermarket parts, labor hours, paint, and blending',
      'Pulls your shop\'s current labor rate and parts multiplier',
      'Writes an insurance-ready estimate with photos attached',
      'Sends the quote plus a scheduling link to the customer by text',
    ],
    metric: 'Estimate delivered in 90s · No humans involved',
  },
  {
    industry: 'Law firm', accent: T, icon: Scale,
    title: 'Intake Qualifier',
    scenario: 'Prospect calls the firm or fills out the web form.',
    steps: [
      'Matches the matter type against the firm\'s practice areas',
      'Runs an automated conflict check across the case management system',
      'Assigns severity, urgency, and estimated engagement value',
      'Schedules the consult with the attorney whose calendar + expertise fits',
      'Drafts the intake memo and drops it in the case folder before the consult',
    ],
    metric: 'Monday morning: 6 qualified consults on the calendar',
  },
  {
    industry: 'HVAC', accent: AMB, icon: Wrench,
    title: 'Dispatch Assistant',
    scenario: 'Service call comes in — dead AC at 2pm on the hottest day of the year.',
    steps: [
      'Triages urgency: is this life safety, no AC, or routine?',
      'Checks parts availability in the warehouse and every truck',
      'Matches job requirements against each tech\'s certifications',
      'Routes the nearest qualified tech and texts them the work order',
      'Sends the customer an ETA with a live map link',
    ],
    metric: 'Average dispatch time: 4 minutes',
  },
  {
    industry: 'Real estate', accent: GRN, icon: Home,
    title: 'Offer Analyzer',
    scenario: 'Buyer agent needs to write an offer on a listing tonight.',
    steps: [
      'Pulls comparable sales within a half-mile in the last 90 days',
      'Reads listing history — price cuts, days on market, prior contracts',
      'Analyzes public records for seller motivations: divorce, estate, relocation',
      'Proposes three offer strategies with risk profiles',
      'Drafts the offer letter, contract, and addenda ready for signature',
    ],
    metric: 'Offer ready to send in 8 minutes',
  },
  {
    industry: 'Pool service', accent: T, icon: Droplet,
    title: 'Text-to-Quote Bot',
    scenario: 'Customer texts "need weekly service" with a photo of their pool.',
    steps: [
      'AI measures the pool from the photo and estimates volume',
      'Asks for zip code and 2-3 follow-up questions by text',
      'Calculates monthly price including chemicals, equipment checks, and travel',
      'Sends the quote as a tap-to-pay link',
      'Auto-schedules the first visit in the tech\'s route',
    ],
    metric: 'From text to signed customer in 6 minutes',
  },
  {
    industry: 'Fitness', accent: R, icon: Dumbbell,
    title: 'Tour + Starter Plan Bot',
    scenario: 'Lead lands on the gym\'s booking page.',
    steps: [
      'Runs a 6-question goals quiz — strength, weight loss, mobility, etc.',
      'Matches the prospect to the trainer whose style fits',
      'Schedules the tour in the trainer\'s live calendar',
      'Generates a personalized 2-week starter workout plan',
      'Emails the plan + tour confirmation — prospect walks in already engaged',
    ],
    metric: 'Show-up rate doubled · Closing rate 48% higher',
  },
  {
    industry: 'Healthcare', accent: GRN, icon: Stethoscope,
    title: 'Prior Authorization Agent',
    scenario: 'Provider needs insurance approval for an MRI before scheduling.',
    steps: [
      'Pulls the patient\'s insurance, procedure code, diagnosis, and clinical notes from the EMR',
      'Selects the correct payer-specific prior-auth form and fills it end-to-end',
      'Submits electronically or via fax, then monitors status on a 15-minute polling loop',
      'Alerts the front desk the moment approval, denial, or pend-for-info comes back',
      'If denied, drafts the appeal letter with supporting citations ready for the provider to sign',
    ],
    metric: 'Cuts average turnaround 4 days to 36 hours',
  },
  {
    industry: 'Finance', accent: GRN, icon: DollarSign,
    title: 'Mortgage Pre-Qual Bot',
    scenario: 'Prospective buyer wants to know what they qualify for at 10pm on a Sunday.',
    steps: [
      'Collects income, assets, debts, credit range via a conversational flow',
      'Runs a soft-pull credit check (with consent) and pulls current loan programs',
      'Calculates max purchase price, monthly payment, cash-to-close, and DTI',
      'Delivers a personalized pre-qual letter the borrower can send with an offer',
      'Drops the lead + full file into the LO\'s queue, sorted by close-probability',
    ],
    metric: 'Pre-quals issued 24/7 · 3× weekend lead capture',
  },
  {
    industry: 'Retail', accent: BLK, icon: Package,
    title: 'Inventory Reorder System',
    scenario: 'Multi-location retailer running lean on dozens of SKUs.',
    steps: [
      'Watches sell-through velocity per SKU per location every hour',
      'Factors in lead time, seasonality, local events, weather forecasts',
      'Drafts purchase orders per supplier at the right quantity + timing',
      'Routes for manager approval with a one-click send-to-supplier',
      'Tracks shipments end-to-end and alerts on delays before shelves empty',
    ],
    metric: 'Stockouts down 71% · Working capital down 18%',
  },
  {
    industry: 'Construction', accent: AMB, icon: Hammer,
    title: 'Change Order Manager',
    scenario: 'Field super identifies a scope change mid-job and needs to document it now.',
    steps: [
      'Field super voice-records the scope change from the jobsite',
      'AI extracts labor, materials, duration impact, and writes the CO document',
      'Pulls current labor rates + material pricing and calculates the delta',
      'Routes for owner + architect signature via e-sign',
      'Updates the job schedule, budget, and billing system automatically',
    ],
    metric: 'COs processed same-day vs 10-day industry average',
  },
  {
    industry: 'Hospitality', accent: T, icon: Bed,
    title: 'Guest Pre-Arrival Concierge',
    scenario: 'Guest booked a 4-night stay two weeks from now.',
    steps: [
      'Pulls the reservation plus any loyalty + past-stay preferences',
      'Texts the guest 72 hours before arrival offering upgrades and amenities',
      'Handles upgrades, spa bookings, restaurant reservations, airport transfer',
      'Routes kitchen dietary notes, engineering requests, and VIP flags to staff',
      'Generates the pre-check-in folder so the front desk welcomes by name',
    ],
    metric: 'Ancillary revenue +$143/guest · 92% guest satisfaction',
  },
  {
    industry: 'Logistics', accent: AMB, icon: Truck,
    title: 'Fleet Dispatch + Routing',
    scenario: '18-truck last-mile fleet serving 200+ stops per day.',
    steps: [
      'Ingests the day\'s orders and time windows from your OMS',
      'Optimizes routes factoring in vehicle capacity, driver HOS, and live traffic',
      'Texts drivers their route with turn-by-turn and ETA per stop',
      'Reroutes mid-day when traffic, cancellations, or new orders come in',
      'Sends customers live ETAs and captures PODs on delivery',
    ],
    metric: 'Miles driven down 19% · On-time rate 96%',
  },
  {
    industry: 'Dental', accent: R, icon: Smile,
    title: 'Patient Reactivation Engine',
    scenario: 'Dental practice with 4,000 patients and a growing backlog of "due for recall".',
    steps: [
      'Scans your practice software nightly for patients 6+ months overdue',
      'Segments by insurance reset status, procedure history, and lifetime value',
      'Sends personalized text + email campaigns at the times each cohort actually responds',
      'Books directly into open slots on the hygienist\'s calendar',
      'Hands off any "I can\'t afford it right now" replies to the treatment coordinator',
    ],
    metric: '+184 reactivated patients/quarter · $47k quarterly revenue',
  },
  {
    industry: 'Agency ops', accent: T, icon: BarChart2,
    title: 'Client Reporting Platform',
    scenario: 'Marketing agency needs to send 35 monthly reports without a full-time analyst.',
    steps: [
      'Pulls data from all client marketing platforms on the 1st of every month',
      'Applies each client\'s custom dashboard template with their branding',
      'AI writes an executive summary: wins, losses, what we\'re doing this month',
      'Drops the PDF into the client\'s portal and emails the main contact',
      'Schedules the 30-min review call and preps the talking points',
    ],
    metric: 'Reports delivered by 9am on the 1st · Zero analyst hours',
  },
  {
    industry: 'Restaurant', accent: AMB, icon: CalendarClock,
    title: 'Staff Scheduling Engine',
    scenario: 'Restaurant group with 5 locations and 180 employees.',
    steps: [
      'Reads forecasted covers per hour from historical + weather + local events',
      'Balances labor targets, each employee\'s availability, and fair shift distribution',
      'Auto-drafts the next 2 weeks of schedules per location',
      'Lets employees swap shifts with manager-approval thresholds',
      'Pushes final schedules to the POS and time clock for payroll',
    ],
    metric: 'Labor % down 2.4 pts · Scheduling time 9 hrs/wk to 30 min',
  },
  {
    industry: 'Solar', accent: AMB, icon: Sun,
    title: 'Solar Proposal Generator',
    scenario: 'Homeowner uploads a recent electric bill on the website.',
    steps: [
      'AI reads the bill — usage profile, current rate, utility, seasonality',
      'Pulls satellite imagery to size the roof and estimate panel count',
      'Calculates system size, production, net-metering savings, and payback',
      'Generates a branded proposal with financing options (cash, loan, lease)',
      'Sends to the homeowner and books the in-home design appointment',
    ],
    metric: 'Proposal in 4 minutes · Close rate +22%',
  },
  {
    industry: 'HR / Staffing', accent: '#8b5cf6', icon: Users,
    title: 'Candidate Screening + Scheduling',
    scenario: 'Staffing firm sourcing for 40 open roles with 300+ applicants a week.',
    steps: [
      'Screens every applicant by phone against the job\'s fit rubric',
      'Scores on experience, availability, compensation fit, and soft skills',
      'Schedules qualified candidates directly into the right recruiter\'s calendar',
      'Sends rejected candidates a personalized other-opportunities email',
      'Keeps everything synced in the ATS — no manual data entry',
    ],
    metric: 'Time-to-first-interview: 5 days to 1 day',
  },
]

const PILLARS = [
  {
    icon: Workflow, title: 'We start with your workflow',
    desc: 'Not a checklist of features. We sit with you, map the real process — intake, pricing, approvals, edge cases — and design the system around it.',
  },
  {
    icon: Database, title: 'We connect to everything',
    desc: 'Your CRM, calendar, inventory, payment processor, phone system, email, file storage. If it has an API or a webhook, we can wire it in.',
  },
  {
    icon: Link2, title: 'We build the glue',
    desc: 'Most "integrations" are shallow. We build real workflows: conditional logic, approval chains, retry handling, audit logs, human-in-the-loop escape hatches.',
  },
  {
    icon: Plug, title: 'We own the reliability',
    desc: 'Every run logged, every API call retried, every failure alerted. When a vendor changes their API, we update ours — you never notice.',
  },
]

export default function CustomSystemsPage() {
  usePageMeta({
    title: 'Custom workflow automation & business systems | Koto',
    description: 'Custom systems built around your real workflow — catering order flows, collision estimators, law firm intake, HVAC dispatch, and more. Shipped in weeks, not quarters.',
  })
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: W }}>
      <style>{CSS}</style>
      <PublicNav />
      <div style={{ height: 64 }} />

      {/* HERO */}
      <section className="m-pad" style={{ padding: '120px 40px 80px', position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 40, left: '10%', width: 500, height: 500, borderRadius: '50%', background: T + '28', filter: 'blur(100px)', animation: 'orbPulse 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 100, right: '8%', width: 460, height: 460, borderRadius: '50%', background: R + '26', filter: 'blur(100px)', animation: 'orbPulse 13s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div className="fade" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, border: `1px solid ${HAIR}`, background: WASH, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            Custom Systems
          </div>
          <h1 className="m-hero-h1" style={{ fontSize: 84, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', lineHeight: 1.05, color: INK, maxWidth: 940, margin: '0 auto' }}>
            If you run it,<br />we can <span style={{ color: R }}>automate</span> it.
          </h1>
          <p style={{ fontSize: 20, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 680, margin: '24px auto 0' }}>
            Custom AI systems wired into the tools you already use — your CRM, calendar, inventory, phones,
            payments. Built around your actual workflow, not a generic template.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/contact')}>Book a build session <ArrowRight size={14} /></button>
            <a href={CONTACT_PHONE_HREF} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              <Phone size={14} /> {CONTACT_PHONE}
            </a>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <TrustStrip />

      {/* SCOPE BAND — "Gone are the days..." */}
      <ScopeBand />

      {/* PILLARS */}
      <section className="m-pad" style={{ padding: '96px 40px', background: SURFACE, borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>How it works</div>
            <h2 className="m-sec-h2" style={{ fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: INK, lineHeight: 1.05 }}>
              Four principles behind every build.
            </h2>
          </div>
          <div className="m-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
            {PILLARS.map(p => {
              const Icon = p.icon
              return (
                <div key={p.title} style={{ background: W, border: `1px solid ${HAIR}`, borderRadius: 16, padding: 28 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: R + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <Icon size={22} color={R} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, marginBottom: 10 }}>{p.title}</div>
                  <p style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.65 }}>{p.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* INTEGRATIONS STRIP */}
      <section className="m-pad" style={{ padding: '72px 40px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Integrates with anything</div>
          <h3 style={{ fontSize: 28, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, lineHeight: 1.1, marginBottom: 24 }}>
            If it has an API, we can wire it in.
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {INTEGRATIONS.map(name => (
              <span key={name} style={{
                fontSize: 13, fontWeight: 600, color: INK, fontFamily: FB,
                background: SURFACE, border: `1px solid ${HAIR}`,
                padding: '7px 14px', borderRadius: 100,
              }}>{name}</span>
            ))}
            <span style={{
              fontSize: 13, fontWeight: 800, color: R, fontFamily: FH,
              background: R + '12', border: `1px solid ${R}30`,
              padding: '7px 14px', borderRadius: 100,
            }}>+ Anything custom</span>
          </div>
        </div>
      </section>

      {/* FEATURED ANIMATED MOCKS — watch three systems fill in live */}
      <section className="m-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Watch it run
            </div>
            <h2 className="m-sec-h2" style={{
              fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em',
              color: INK, lineHeight: 1.05, marginBottom: 18,
            }}>
              Nine live builds, auto-playing.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Animated simulations of what three different Koto systems do on every run. Real-world shape,
              real-feeling numbers, fabricated for the demo.
            </p>
          </div>

          {/* Mock 1: Catering Order Intake */}
          <div style={{ marginBottom: 24 }}>
            <InlineSystemMock config={{
              browserUrl: 'savannah-catering.com / orders',
              leftIcon: Mail, leftEyebrow: 'Incoming order',
              source: { icon: Mail, label: 'orders@savannah-catering.com', sub: 'Online order · 12s ago', status: 'NEW' },
              fields: [
                { step: 1, label: 'Event type',    value: 'Corporate lunch (drop-off)' },
                { step: 2, label: 'Date',          value: 'Friday, Oct 17 · 12:00 PM delivery' },
                { step: 3, label: 'Headcount',     value: '48 guests' },
                { step: 4, label: 'Menu',          value: 'Mediterranean Build-Your-Own' },
                { step: 5, label: 'Delivery',      value: '333 Las Olas Blvd · floor 14' },
                { step: 6, label: 'Dietary notes', value: '3 vegetarian · 2 gluten-free' },
              ],
              rightIcon: ChefHat, rightEyebrow: 'Kitchen + driver dispatch',
              calculatingText: 'Checking kitchen capacity, prep time, driver routes...',
              outputTitle: 'Order #8247 — Kitchen Ticket',
              outputSub: '48 guests',
              lines: [
                { step: 10, label: 'Mediterranean BYO × 48',   amount: 816 },
                { step: 11, label: 'Staff delivery + setup (1 hr)', amount: 85 },
                { step: 12, label: 'Dietary accommodations',   amount: 42 },
                { step: 13, label: 'Delivery fee (downtown)',  amount: 45 },
              ],
              subtotal: 988, tax: 69, total: 1057,
              confirmText: 'Kitchen ticket printed · Driver Jorge routed · Customer notified',
              confirmHint: '2.8s end-to-end',
              footerLabel: 'Custom AI system · Savannah Catering Co.',
              footerStats: [
                { label: 'Orders today', value: '32' },
                { label: 'Avg handoff', value: '3.1s' },
                { label: 'On-time rate', value: '98%' },
              ],
              accent: R,
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Catering Order Management.</strong> Live with a South Florida catering client.
            </div>
          </div>

          {/* Mock 2: Collision Estimator */}
          <div style={{ marginBottom: 24 }}>
            <InlineSystemMock config={{
              browserUrl: 'coastal-bodyshop.com / estimate',
              leftIcon: Camera, leftEyebrow: 'Customer submission',
              source: { icon: Camera, label: 'Photos uploaded · 4 of 4', sub: '2019 Honda Accord EX-L · rear-end collision', status: 'ANALYZING' },
              fields: [
                { step: 1, label: 'Vehicle',       value: '2019 Honda Accord EX-L Sedan' },
                { step: 2, label: 'VIN',           value: '1HGCV1F34KA012347' },
                { step: 3, label: 'Mileage',       value: '47,820 mi' },
                { step: 4, label: 'Impact area',   value: 'Rear bumper · trunk lid · both quarter panels' },
                { step: 5, label: 'Severity',      value: 'Moderate · structural check needed' },
                { step: 6, label: 'Paint match',   value: 'Modern Steel Metallic (NH-797M)' },
              ],
              rightIcon: FileText, rightEyebrow: 'Auto-generated estimate',
              calculatingText: 'Pricing OEM parts, labor hours, paint + blending...',
              outputTitle: 'Estimate #RE-2471',
              outputSub: 'Insurance-ready',
              lines: [
                { step: 10, label: 'Rear bumper cover (OEM)',     amount: 624 },
                { step: 11, label: 'Trunk lid replacement',       amount: 1280 },
                { step: 12, label: 'Quarter panel repair (both)', amount: 1440 },
                { step: 13, label: 'Paint + blending (4 panels)', amount: 1150 },
                { step: 14, label: 'Labor · 18 hrs @ $62/hr',     amount: 1116 },
              ],
              subtotal: 5610, tax: 0, total: 5610,
              totalLabel: 'Estimate total',
              confirmText: 'Estimate PDF sent to customer + Allstate claim #4427891',
              confirmHint: '94s end-to-end',
              footerLabel: 'Custom AI system · Coastal Body Shop',
              footerStats: [
                { label: 'Estimates today', value: '14' },
                { label: 'Avg time', value: '92s' },
                { label: 'Conversion', value: '71%' },
              ],
              accent: BLK,
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Collision Photo Estimator.</strong> 4 photos in → insurance-ready quote in 90 seconds.
            </div>
          </div>

          {/* Mock 3: Mortgage Pre-Qual */}
          <div style={{ marginBottom: 24 }}>
            <InlineSystemMock config={{
              browserUrl: 'everstone-lending.com / pre-qual',
              leftIcon: DollarSign, leftEyebrow: 'Borrower profile',
              source: { icon: Users, label: 'Rachel K. + Daniel K.', sub: 'Coral Springs FL · first-time buyers', status: 'SOFT PULL' },
              fields: [
                { step: 1, label: 'Combined income',  value: '$214,000 / year (W-2 + K-1)' },
                { step: 2, label: 'Credit (soft)',    value: '742 / 758 · prime' },
                { step: 3, label: 'Liquid assets',    value: '$118,400 · 2 accounts' },
                { step: 4, label: 'Monthly debts',    value: '$1,820 (auto + student)' },
                { step: 5, label: 'Target price',     value: '$675,000' },
                { step: 6, label: 'Down payment',     value: '$135,000 (20%)' },
              ],
              rightIcon: FileText, rightEyebrow: 'Pre-qualification result',
              calculatingText: 'Running DTI, reserves, and program fit...',
              outputTitle: 'Pre-Qual Letter — Case #PQ-01847',
              outputSub: '30-yr conventional',
              lines: [
                { step: 10, label: 'Max purchase price',       amount: 742000 },
                { step: 11, label: 'Loan amount (at target)',  amount: 540000 },
                { step: 12, label: 'Est. P + I payment',       amount: 3501 },
                { step: 13, label: 'Est. taxes + insurance',   amount: 872 },
                { step: 14, label: 'All-in monthly payment',   amount: 4373 },
              ],
              confirmText: 'Pre-qual letter emailed · Routed to LO Jen Castillo · Close prob. 82%',
              confirmHint: '6.4s end-to-end',
              footerLabel: 'Custom AI system · Everstone Lending',
              footerStats: [
                { label: 'Pre-quals today', value: '27' },
                { label: 'Avg time', value: '5.9s' },
                { label: 'Weekend capture', value: '+3×' },
              ],
              accent: GRN,
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Mortgage Pre-Qual Bot.</strong> 24/7 pre-quals, pre-filed to the loan officer.
            </div>
          </div>

          {/* Mock 4: Law Firm Intake Qualifier */}
          <div style={{ marginBottom: 24 }}>
            <InlineSystemMock config={{
              browserUrl: 'morales-law.com / intake',
              leftIcon: Phone, leftEyebrow: 'Inbound call captured',
              source: { icon: Phone, label: '+1 (305) 555-0187 · Kevin J.', sub: 'Called 11:42 AM · 3 min conversation', status: 'NEW' },
              fields: [
                { step: 1, label: 'Case type',      value: 'Auto accident · rear-ended at light' },
                { step: 2, label: 'Date / location',value: 'Oct 11 · I-95 S @ SW 8 St exit, Miami' },
                { step: 3, label: 'Police report',  value: 'Filed · Case #FL-2026-847291' },
                { step: 4, label: 'Injuries',       value: 'Neck + lower back · ER visit Oct 11' },
                { step: 5, label: 'PIP / Ins',      value: 'GEICO · $10k PIP · $50k UM' },
                { step: 6, label: 'Conflict check', value: 'Cleared · no adverse parties on file' },
              ],
              rightIcon: Scale, rightEyebrow: 'Intake memo + scheduling',
              calculatingText: 'Running conflict check, matching attorney, estimating case value...',
              outputTitle: 'Intake Memo — Case KV-0447',
              outputSub: 'Priority: High',
              lines: [
                { step: 10, label: 'Statute of limitations',   prefix: '', amount: '2027-10-11 (2 yrs)' },
                { step: 11, label: 'Est. medical damages',                 amount: 18500 },
                { step: 12, label: 'Est. lost wages',                      amount: 4200 },
                { step: 13, label: 'Est. pain & suffering (3×)',           amount: 68100 },
                { step: 14, label: 'Attorney assigned',         prefix: '', amount: 'Attorney Morales' },
              ],
              confirmText: 'Consult booked · Tomorrow 10:30 AM Zoom · Client received confirmation text',
              confirmHint: '4.1s end-to-end',
              footerLabel: 'Custom AI system · Morales & Associates',
              footerStats: [
                { label: 'Intakes today', value: '19' },
                { label: 'Avg qualify time', value: '3.9s' },
                { label: 'Sign rate', value: '71%' },
              ],
              accent: BLK,
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Law Firm Intake Qualifier.</strong> Qualifies callers, runs conflict check, books the consult.
            </div>
          </div>

          {/* Mock 5: HVAC Dispatch */}
          <div style={{ marginBottom: 24 }}>
            <InlineSystemMock config={{
              browserUrl: 'coastal-hvac.com / dispatch',
              leftIcon: Phone, leftEyebrow: 'Service call',
              source: { icon: Phone, label: 'Mrs. Patel · 4420 NE 5th Ave, Boca Raton', sub: 'No AC · called 2:08 PM', status: 'URGENT' },
              fields: [
                { step: 1, label: 'Issue',         value: '3-ton Trane unit · no cold air · panel tripped' },
                { step: 2, label: 'Unit info',     value: '2019 install · Trane XR14 · warranty ends 2029' },
                { step: 3, label: 'Priority',     value: 'P1 · residential · 94°F outside' },
                { step: 4, label: 'Parts needed', value: 'Likely capacitor · truck has 3 in stock' },
                { step: 5, label: 'Tech match',   value: 'Marcus D. · EPA 608 Type II · 1.4 mi away' },
                { step: 6, label: 'ETA',          value: '28 minutes' },
              ],
              rightIcon: Wrench, rightEyebrow: 'Dispatched',
              calculatingText: 'Checking parts truck inventory, matching tech certifications, optimizing route...',
              outputTitle: 'Work Order #WO-4419',
              outputSub: 'Marcus D. · Truck 14',
              lines: [
                { step: 10, label: 'Diagnostic fee',                  amount: 89 },
                { step: 11, label: 'Capacitor (45+5 µF)',             amount: 165 },
                { step: 12, label: 'Labor (est. 45 min)',             amount: 145 },
                { step: 13, label: 'Service call travel',             amount: 0 },
                { step: 14, label: 'Warranty parts coverage',         prefix: '', amount: 'Yes (-$165)' },
              ],
              subtotal: 234, total: 234,
              totalLabel: 'Customer out-of-pocket',
              confirmText: 'Tech en route · Customer got SMS with live map + Marcus\'s photo + bio',
              confirmHint: '4.2s dispatch',
              footerLabel: 'Custom AI system · Coastal HVAC',
              footerStats: [
                { label: 'Calls today', value: '42' },
                { label: 'Avg dispatch', value: '4 min' },
                { label: 'Same-day fix', value: '94%' },
              ],
              accent: AMB,
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>HVAC Dispatch Assistant.</strong> Triage, parts, cert-matched tech, live-map dispatch.
            </div>
          </div>

          {/* Mock 6: Real Estate Offer Analyzer */}
          <div style={{ marginBottom: 24 }}>
            <InlineSystemMock config={{
              browserUrl: 'bayharborrealty.com / offer-builder',
              leftIcon: Home, leftEyebrow: 'Target property',
              source: { icon: Home, label: '1020 Cleveland Rd · Bay Harbor Islands', sub: '3/2.5 · 2,410 sq ft · canal-front', status: 'LIVE' },
              fields: [
                { step: 1, label: 'List price',       value: '$1,695,000 ($703/sf)' },
                { step: 2, label: 'Days on market',   value: '42 (1 price cut $1.795 → $1.695)' },
                { step: 3, label: 'Seller motivation',value: 'Estate sale · 2nd home · out-of-state rep' },
                { step: 4, label: '6 comps pulled',   value: '3 sold · 2 active · 1 pending · avg $688/sf' },
                { step: 5, label: 'Inspection flags', value: '40-yr inspection passed · no open permits' },
                { step: 6, label: 'Buyer position',   value: 'Pre-qual $1.8M · 20% down · 30-yr conv' },
              ],
              rightIcon: FileText, rightEyebrow: 'Offer strategy',
              calculatingText: 'Running comps, motivation analysis, and drafting strategy...',
              outputTitle: 'Strategy for 1020 Cleveland Rd',
              outputSub: '3 negotiation paths',
              lines: [
                { step: 10, label: 'Aggressive · $1.595M',    prefix: '', amount: '-5.9% · 65% land rate' },
                { step: 11, label: 'Market · $1.650M',        prefix: '', amount: '-2.6% · 85% land rate' },
                { step: 12, label: 'Strong · $1.690M',        prefix: '', amount: 'full-ask land rate 96%' },
                { step: 13, label: 'Recommended ask',         prefix: '', amount: '$1.640M net' },
                { step: 14, label: 'Key concession',          prefix: '', amount: '21-day inspection + cash-equivalent close' },
              ],
              confirmText: 'Offer letter + contract drafted · Ready for buyer signature',
              confirmHint: '5.8s end-to-end',
              footerLabel: 'Custom AI system · Bay Harbor Realty',
              footerStats: [
                { label: 'Offers drafted today', value: '11' },
                { label: 'Avg prep', value: '6 min' },
                { label: 'Acceptance rate', value: '62%' },
              ],
              accent: GRN,
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Real Estate Offer Analyzer.</strong> Comps, motivation, 3 strategies, offer letter drafted.
            </div>
          </div>

          {/* Mock 7: Hotel Pre-Arrival Concierge */}
          <div style={{ marginBottom: 24 }}>
            <InlineSystemMock config={{
              browserUrl: 'oceana-miami.com / arrivals',
              leftIcon: Bed, leftEyebrow: 'Upcoming reservation',
              source: { icon: Bed, label: 'Ms. Rachel Howard', sub: 'Arrives Oct 24 · 4 nights · King Ocean View', status: 'VIP' },
              fields: [
                { step: 1, label: 'Loyalty',       value: 'Platinum · 14th stay · prefers high floor' },
                { step: 2, label: 'Stay reason',   value: 'Anniversary (per past-stay note)' },
                { step: 3, label: 'Dietary',       value: 'Pescatarian · allergic to tree nuts' },
                { step: 4, label: 'Prior bookings',value: 'Always spa day + sunset dinner · bottle of Sancerre on arrival' },
                { step: 5, label: 'Upgrade pool',  value: '2 Oceanfront Suites open · $180/night upsell' },
                { step: 6, label: 'Contact',       value: 'Text sent 72 hrs before arrival · opened 4 min ago' },
              ],
              rightIcon: Sparkles, rightEyebrow: 'Pre-arrival plan',
              calculatingText: 'Curating upgrade, spa, dining, and amenities against preferences...',
              outputTitle: 'Pre-Arrival Package',
              outputSub: 'Ready for front desk',
              lines: [
                { step: 10, label: 'Upgrade · Oceanfront Suite',      amount: 720 },
                { step: 11, label: 'Spa · Couples signature massage', amount: 540 },
                { step: 12, label: 'Dining · sunset tasting menu',    amount: 280 },
                { step: 13, label: 'Welcome bottle · Sancerre 2021',  amount: 0 },
                { step: 14, label: 'Anniversary amenity · comp',      prefix: '', amount: 'rose petals + champagne' },
              ],
              subtotal: 1540, total: 1540,
              totalLabel: 'Ancillary revenue',
              confirmText: 'Upgrade + spa + dining confirmed · Anniversary note routed to front desk + engineering',
              confirmHint: '3.7s curated',
              footerLabel: 'Custom AI system · Oceana Miami Beach',
              footerStats: [
                { label: 'Guests today', value: '127' },
                { label: 'Upsell rate', value: '53%' },
                { label: 'Guest satisfaction', value: '94%' },
              ],
              accent: T,
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Hotel Pre-Arrival Concierge.</strong> Reads the guest, upgrades, books spa + dining, flags VIPs.
            </div>
          </div>

          {/* Mock 8: Solar Proposal Generator */}
          <div style={{ marginBottom: 24 }}>
            <InlineSystemMock config={{
              browserUrl: 'everstone-solar.com / quote',
              leftIcon: Mail, leftEyebrow: 'Homeowner inquiry',
              source: { icon: Sun, label: 'Tom + Linda Chen · Plantation, FL', sub: 'Uploaded 12-mo FPL bill · 2,650 sf home', status: 'NEW' },
              fields: [
                { step: 1, label: 'Avg usage',       value: '1,840 kWh/mo · $287/mo current bill' },
                { step: 2, label: 'Rate type',       value: 'FPL RS-1 · escalating 4.2%/yr' },
                { step: 3, label: 'Roof scan',       value: 'SE exposure · 1,240 sf usable · no shade' },
                { step: 4, label: 'System size',     value: '11.4 kW · 28 panels · SunPower X22' },
                { step: 5, label: 'Est. production', value: '1,980 kWh/mo · 108% offset' },
                { step: 6, label: 'Incentives',      value: '30% Federal ITC · FL sales tax exempt' },
              ],
              rightIcon: Sun, rightEyebrow: 'Proposal generated',
              calculatingText: 'Sizing system, running financing scenarios, drafting branded proposal...',
              outputTitle: 'Proposal #SP-2284',
              outputSub: '25-year savings',
              lines: [
                { step: 10, label: 'System cost',                        amount: 38400 },
                { step: 11, label: 'Federal ITC (30% credit)',  prefix: '-$', amount: 11520 },
                { step: 12, label: 'Net after incentives',               amount: 26880 },
                { step: 13, label: '25-yr lifetime savings',             amount: 118400 },
                { step: 14, label: 'Payback period',           prefix: '', amount: '6.8 years' },
              ],
              confirmText: 'Proposal emailed · Design consult booked for Saturday 10 AM · Reps notified',
              confirmHint: '4.3s end-to-end',
              footerLabel: 'Custom AI system · Everstone Solar',
              footerStats: [
                { label: 'Proposals today', value: '23' },
                { label: 'Avg time', value: '4 min' },
                { label: 'Consult booked', value: '58%' },
              ],
              accent: AMB,
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Solar Proposal Generator.</strong> Bill → roof → system size → financing → proposal sent.
            </div>
          </div>

          {/* Mock 9: Parts Ordering System — vendor bid matrix */}
          <div style={{ marginBottom: 24 }}>
            <PartsOrderMock config={{
              browserUrl: 'coastal-bodyshop.com / parts-ordering',
              jobTitle: 'Parts Request · Job #RE-2471',
              jobMeta: '2019 Honda Accord EX-L · rear-end collision · insurance-approved',
              jobTags: [
                { label: 'OEM REQUIRED', color: R },
                { label: 'ALLSTATE CLAIM', color: T },
                { label: '5-DAY ETA', color: AMB },
              ],
              vendors: [
                { id: 'honda-oem', name: 'Honda OEM Direct',  type: 'OEM factory' },
                { id: 'lkq',       name: 'LKQ Corporation',   type: 'OEM + aftermarket' },
                { id: 'iaa',       name: 'IAA Parts',         type: 'Aftermarket' },
                { id: 'carparts',  name: 'CarParts.com',      type: 'Aftermarket' },
              ],
              parts: [
                { name: 'Rear bumper cover',       partNumber: '04715-T2A-A90Z', qty: 1, appearStep: 1, winnerStep: 14, winnerIndex: 1,
                  bids: [
                    { step: 4,  price: 624.00, eta: '5 days',  note: 'Factory sealed', noteColor: GRN },
                    { step: 4,  price: 549.00, eta: '3 days',  note: 'OEM · in stock', noteColor: GRN },
                    { step: 5,  price: 398.00, eta: '2 days',  note: 'Fit risk · not OEM', noteColor: R },
                    { step: 5,  price: 412.00, eta: '4 days',  note: 'Color-match flag', noteColor: AMB },
                  ]},
                { name: 'Trunk lid assembly',      partNumber: '68500-T2A-A90ZZ', qty: 1, appearStep: 2, winnerStep: 15, winnerIndex: 0,
                  bids: [
                    { step: 6,  price: 1280.00, eta: '5 days', note: 'Factory sealed', noteColor: GRN },
                    { step: 6,  price: 1095.00, eta: '7 days', note: 'Warehouse WI', noteColor: AMB },
                    { step: 7,  price: null,    eta: '' },
                    { step: 7,  price: 989.00,  eta: '9 days', note: 'Backordered', noteColor: R },
                  ]},
                { name: 'Rear trim molding kit',   partNumber: '74890-T2A-A01', qty: 1, appearStep: 3, winnerStep: 16, winnerIndex: 1,
                  bids: [
                    { step: 8,  price: 168.00, eta: '5 days', note: 'OEM', noteColor: GRN },
                    { step: 8,  price: 124.00, eta: '3 days', note: 'OEM · in stock', noteColor: GRN },
                    { step: 9,  price: 78.00,  eta: '2 days', note: 'Aftermarket', noteColor: AMB },
                    { step: 9,  price: 82.00,  eta: '4 days', note: 'Aftermarket' },
                  ]},
                { name: 'Tail light assembly (L)', partNumber: '33550-T2A-A21', qty: 1, appearStep: 4, winnerStep: 17, winnerIndex: 0,
                  bids: [
                    { step: 10, price: 342.00, eta: '3 days', note: 'OEM · in stock', noteColor: GRN },
                    { step: 10, price: 389.00, eta: '5 days', note: 'Remfg OEM' },
                    { step: 11, price: 198.00, eta: '2 days', note: 'Non-DOT stamp', noteColor: R },
                    { step: 11, price: 215.00, eta: '4 days', note: 'DOT stamped', noteColor: AMB },
                  ]},
                { name: 'Paint · NH-797M clearcoat', partNumber: 'PPG-NH797M-1G', qty: 1, appearStep: 5, winnerStep: 18, winnerIndex: 3,
                  bids: [
                    { step: 12, price: 428.00, eta: '4 days', note: 'Sealed gallon' },
                    { step: 12, price: 398.00, eta: '3 days', note: 'Match guaranteed' },
                    { step: 13, price: 312.00, eta: '2 days', note: 'Budget tier', noteColor: AMB },
                    { step: 13, price: 284.00, eta: '1 day',  note: 'Local PPG distro', noteColor: GRN },
                  ]},
              ],
              poLines: [
                { step: 19, label: 'PO #',                       value: 'PO-RE-2471-04' },
                { step: 19, label: 'Vendors (multi-source)',     value: '3 suppliers' },
                { step: 20, label: 'Net-30 terms',               value: 'Approved for $18,500 limit' },
                { step: 20, label: 'Combined ETA',               value: 'Oct 21 · all items on-site' },
                { step: 21, label: 'Insurance-reviewed parts',   value: 'OEM on exterior panels' },
              ],
              poTotal: 2051.00,
              poTotalStep: 22,
              logistics: [
                { step: 19, icon: Truck,       label: 'Delivery schedule', value: '4 drops · Mon + Tue + Wed next week', color: T },
                { step: 20, icon: Package,     label: 'Receiving bay',     value: 'Bay 3 · Technician Marcus D. notified' },
                { step: 21, icon: AlertCircle, label: 'Insurance flag',    value: 'OEM-only memo attached to Allstate claim', color: AMB },
                { step: 22, icon: Star,        label: 'AI savings',        value: '$347 saved + 2.1 days faster vs manual', color: GRN },
              ],
              outcome: {
                step: 24,
                text: 'POs sent to 3 vendors · Customer notified · Repair scheduled Oct 22',
                hint: '8.2s end-to-end',
              },
              footerLabel: 'Parts AI · Coastal Body Shop',
              footerStats: [
                { label: 'Orders today',       value: '11' },
                { label: 'Avg procurement',    value: '9s' },
                { label: 'Savings vs manual',  value: '11.4%' },
              ],
              totalSteps: 30,
            }} />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: MUTED, fontFamily: FB }}>
              <strong style={{ color: INK }}>Parts Ordering System.</strong> 4 vendors queried, best OEM-compliant bid per line, multi-source PO placed in 8 seconds.
            </div>
          </div>
        </div>
      </section>

      {/* SYSTEM EXAMPLES — CATERING + 6 others */}
      <section className="m-pad" style={{ padding: '96px 40px', background: SURFACE, borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>System examples</div>
            <h2 className="m-sec-h2" style={{ fontSize: 52, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: INK, lineHeight: 1.05, marginBottom: 18 }}>
              Seventeen real systems we've built.
            </h2>
            <p style={{ fontSize: 17, color: MUTED, fontFamily: FB, lineHeight: 1.6 }}>
              Each one is tailored to the business — real workflow, real data, real outcomes.
              Here's how they come together.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {SYSTEMS.map((s, i) => {
              const Icon = s.icon
              return (
                <div key={s.title} className="mock-split" style={{
                  background: W, border: `1px solid ${HAIR}`, borderRadius: 18, overflow: 'hidden',
                  display: 'grid', gridTemplateColumns: '1fr 1.2fr',
                }}>
                  {/* Left: header */}
                  <div style={{ padding: '32px 32px', borderRight: `1px solid ${HAIR}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: s.accent + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={22} color={s.accent} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: s.accent, background: s.accent + '12', padding: '4px 10px', borderRadius: 100, letterSpacing: '.06em', textTransform: 'uppercase' }}>{s.industry}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.06em' }}>EXAMPLE {String(i + 1).padStart(2, '0')}</div>
                      {s.live && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '2px 8px', borderRadius: 100, background: GRN + '15',
                          fontSize: 10, fontWeight: 800, color: GRN, letterSpacing: '.06em',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: GRN }} />
                          LIVE WITH CLIENT
                        </div>
                      )}
                    </div>
                    <h3 style={{ fontSize: 26, fontWeight: 900, fontFamily: FH, letterSpacing: '-.025em', color: INK, lineHeight: 1.1, marginBottom: 14 }}>
                      {s.title}
                    </h3>
                    <p style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.55, marginBottom: 16, fontStyle: 'italic' }}>
                      {s.scenario}
                    </p>
                    <div style={{
                      display: 'inline-block', padding: '6px 12px',
                      background: GRN + '12', border: `1px solid ${GRN}30`,
                      borderRadius: 100, fontSize: 12, fontWeight: 700, color: GRN, fontFamily: FH,
                    }}>
                      {s.metric}
                    </div>
                  </div>
                  {/* Right: steps */}
                  <div style={{ padding: '32px 32px', background: WASH }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>How it runs</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {s.steps.map((step, j) => (
                        <div key={j} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: s.accent + '14', color: s.accent,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800, fontFamily: FH, flexShrink: 0,
                          }}>{j + 1}</div>
                          <div style={{ fontSize: 14, color: INK, fontFamily: FB, lineHeight: 1.55 }}>{step}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* LEAD MAGNET — 20-min automation audit */}
      <LeadMagnet
        magnet="automation-audit"
        magnet_title="20-minute automation audit"
        eyebrow="Free scoping session"
        headline="Book a 20-minute audit of your operation."
        sub="Walk us through one workflow that's eating your team's time. We'll diagram it, spec the automation, and quote a build — live, on the call, no follow-ups required."
        bullets={[
          'Live workflow diagramming — we draw it with you on Miro',
          'Build spec: data sources, integrations, AI routing, success metrics',
          'Live quote with fixed scope + timeline — no follow-up "proposal" stall',
          'Keep the diagram whether you build with us or not',
        ]}
        cta="Book the audit"
        success_title="Booking link incoming."
        success_sub="Check your inbox for a Calendly with three time slots in the next 48 hours."
        accent="ink"
        icon="calculator"
      />

      {/* CONTACT CTA */}
      <section className="m-pad" style={{ padding: '96px 40px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', background: INK, borderRadius: 24, padding: '64px 48px', textAlign: 'center', color: W, position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', background: R + '30', filter: 'blur(70px)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', bottom: -100, left: -100, width: 280, height: 280, borderRadius: '50%', background: T + '30', filter: 'blur(70px)' }} />
          <div style={{ position: 'relative' }}>
            <h2 className="m-sec-h2" style={{ fontSize: 48, fontWeight: 900, fontFamily: FH, letterSpacing: '-.035em', color: W, lineHeight: 1.05, marginBottom: 18 }}>
              Tell us what you do.<br />We'll show you what we'd build.
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, maxWidth: 540, margin: '0 auto 32px' }}>
              Usually a working prototype in a week. Full production system in four to eight weeks.
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
