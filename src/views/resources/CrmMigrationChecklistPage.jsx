"use client"

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Printer, Phone } from 'lucide-react'
import { R, T, BLK, GRN, W, FH, FB } from '../../lib/theme'
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from '../../lib/contact'
import PublicNav from '../../components/public/PublicNav'
import PublicFooter from '../../components/public/PublicFooter'

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
  .fade { animation: fadeUp .6s ease both; }
  .btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; cursor: pointer; font-family: ${FH}; font-weight: 700; transition: all .18s; border: 1px solid transparent; padding: 12px 22px; font-size: 14px; text-decoration: none; }
  .btn-primary { background: ${INK}; color: ${W}; }
  .btn-primary:hover { background: #000; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(17,17,17,.18); }
  .btn-secondary { background: ${W}; color: ${INK}; border-color: ${HAIR}; }
  .btn-secondary:hover { border-color: ${INK}; transform: translateY(-1px); }
  @media print {
    .no-print { display: none !important; }
    body { background: ${W} !important; }
    .print-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; page-break-inside: avoid; }
  }
  @media (max-width: 900px) {
    .rc-hero-h1 { font-size: 40px !important; }
    .rc-sec-h2  { font-size: 28px !important; }
    .rc-pad     { padding: 56px 20px !important; }
  }
`

/* Checklist content. Written so each section stands on its own — a working
   consultant-grade playbook, not a glorified blog post. */
const SECTIONS = [
  {
    num: '01',
    title: 'Pre-migration audit (before you pick a platform)',
    intro: 'Most CRM migrations fail before they start because teams skip this step. You need a complete inventory of what you have today — tools, data, workflows, users — before you decide what replaces it.',
    items: [
      'Every tool that touches a customer: CRM, email, SMS, phone, calendar, forms, chat, billing, support',
      'Every user who logs into any of those tools, their role, and their actual workflow (shadow them for 30 min each)',
      'Every integration: what talks to what, in which direction, how often, via which mechanism (API, Zapier, manual export)',
      'Every report the business currently runs — who reads it, when, and what decision it drives',
      'Every custom field, property, tag, and list on the existing CRM — mark each one as "critical", "useful", or "dead weight"',
      'Sample of 100 contacts: manually walk the data from first touch to current state — this surfaces dirty data before you migrate it',
      'Current user count × current per-seat cost × 12 = annual CRM cost (use this as your migration ROI baseline)',
    ],
  },
  {
    num: '02',
    title: 'Data model design (this is where builds succeed or fail)',
    intro: 'Generic CRMs are generic because they pick a schema that works for nobody in particular. A custom build gets this right by designing the data model around your actual pipeline. Do this on paper first.',
    items: [
      'Map your real pipeline stages (not the templated "New → Contacted → Qualified → Closed" — what do your reps actually call these?)',
      'Define what triggers a stage change (not a manual click — an event)',
      'List every custom object you need: Deals, Accounts, Projects, Subscriptions, Tickets, Matters, Jobs, Appointments — only include what you actually use',
      'For each object, list the 5-10 fields that drive decisions, not the 40 fields marketing might one day want',
      'Identify the primary key for de-duplication (email? phone? domain?) — this is the #1 cause of dirty migrations',
      'Decide: which fields are human-entered, which are system-computed, which come from enrichment?',
      'Draw the relationships: 1:1, 1:many, many:many. If you can\'t draw it on one page, the model is wrong',
    ],
  },
  {
    num: '03',
    title: 'Integration topology',
    intro: 'The CRM is a hub, not an endpoint. Decide what writes to it, what reads from it, and what syncs both ways — before any migration happens.',
    items: [
      'Authoritative source per data type: which system holds the truth for email opt-in? For invoicing? For appointments?',
      'Real-time vs. batch: which sync paths need sub-second latency (forms → CRM) vs. nightly (QuickBooks → CRM)?',
      'Webhook strategy: for every event that fires from the CRM (deal stage change, new contact), which downstream systems need to know?',
      'Failure handling: if an integration dies at 2am, what happens — do orders get dropped, or does the queue recover?',
      'Dedupe logic: if HubSpot and your billing system each create a contact for the same person, which one wins?',
      'Rate limits: list every API you\'re integrating with and their documented limits (Salesforce, Google, Twilio all have traps here)',
      'Audit trail: every write into the CRM must log who (human or system), when, and from where — non-negotiable for compliance',
    ],
  },
  {
    num: '04',
    title: 'Permissions + security',
    intro: 'The moment you have more than 5 users, bad permissions start costing you — and the cleanup is painful. Design roles before you load any data.',
    items: [
      'Roles first, users second: define 3-6 roles (Owner, Admin, Sales Rep, Support Agent, Read-only, Integration User) and their permission scope',
      'Field-level permissions: can a rep see another rep\'s pipeline? Can support see deal value? Write these rules down',
      'Row-level security: does every row need an "owner" field that restricts visibility? For multi-tenant / multi-location businesses, yes',
      'SSO: if you have 10+ users or any compliance requirement, use SSO from day one. Google Workspace or Microsoft Entra, both work',
      'Audit log retention: 90 days minimum, 2 years if you\'re in a regulated industry',
      'Export + delete rules: every record must have a path to being exported (GDPR/CCPA) or permanently deleted',
      'API keys: one key per integration, named, rotatable, with scoped permissions — never use a shared admin token',
    ],
  },
  {
    num: '05',
    title: 'Migration mechanics (the actual data move)',
    intro: 'This is where most migrations go wrong. The rule: never migrate dirty data. Clean, dedupe, and normalize before the move.',
    items: [
      'Export every source system to CSV or JSON — keep the raw exports as your rollback point',
      'Run a dedupe pass: email is the usual key; falling back to phone + last name catches the edge cases',
      'Normalize: phone numbers to E.164, emails to lowercase, dates to ISO 8601, currency amounts to cents',
      'Tag every migrated record with its origin (which system, which export date) — this saves you in audits later',
      'Run the migration into a staging environment first, not production',
      'Have 3 power users spot-check 50 random records each before you flip production',
      'Plan the cutover window: ideally Friday evening, with the old system read-only for 48 hours as a safety net',
    ],
  },
  {
    num: '06',
    title: 'Training + rollout',
    intro: 'The tool doesn\'t produce value — the team using it does. A great CRM with an untrained team produces worse results than a mediocre CRM everyone knows.',
    items: [
      'Role-based training: each role gets a 30-minute walkthrough tuned to their actual workflow (not a generic platform tour)',
      'Record every training session and store it in the CRM\'s help area — new hires in month 6 will thank you',
      'Pilot group: first 5 users go live 2 weeks before everyone else. They\'ll find the bugs and become internal advocates',
      'Office hours: daily 30-min drop-in for the first 2 weeks, weekly for the next 4 — answer questions in real-time',
      'Celebrate early wins publicly: post the first closed deal, the first auto-booked meeting, the first big time-save',
      'Measure adoption: daily active users, fields updated per rep, report usage — these are the leading indicators',
      'Change management: anyone who actively resists after 30 days gets a 1:1 — sometimes it\'s legitimate friction, sometimes it\'s culture',
    ],
  },
  {
    num: '07',
    title: '30-60-90 day success metrics',
    intro: 'A migration isn\'t "done" at cutover — it\'s done when the metrics prove the business is better off. Agree on these BEFORE the build.',
    items: [
      'Day 30: 100% of users logging in weekly, 0 critical data errors, 0 broken integrations',
      'Day 60: pipeline velocity (days in each stage) measurable and trending in the right direction',
      'Day 90: eliminate one shadow tool — a spreadsheet, a Google Doc, a secondary CRM someone was still using',
      'Ongoing: contacts per rep, response time, deal close rate — all trending up, or you have a CRM fit problem, not a CRM adoption problem',
      'Cost check: actual year-one cost vs. annual baseline — should be 30-70% lower with better capability',
    ],
  },
]

export default function CrmMigrationChecklistPage() {
  const navigate = useNavigate()

  // Tiny SEO-friendly title update for the static resource page
  useEffect(() => {
    const prev = document.title
    document.title = 'CRM Migration Checklist — Koto'
    return () => { document.title = prev }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: W }}>
      <style>{CSS}</style>
      <div className="no-print">
        <PublicNav />
        <div style={{ height: 64 }} />
      </div>

      {/* HERO */}
      <section className="rc-pad" style={{ padding: '96px 40px 48px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div className="fade" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 100, border: `1px solid ${HAIR}`,
            background: WASH, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 24,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            Free resource · Updated 2026
          </div>
          <h1 className="rc-hero-h1 fade" style={{
            fontSize: 56, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.08, color: INK,
          }}>
            The CRM Migration Checklist.
          </h1>
          <p style={{ fontSize: 19, color: MUTED, fontFamily: FB, lineHeight: 1.6, marginTop: 18, maxWidth: 640 }}>
            The 47-item checklist we run every client through before we touch a single record. Use it
            to audit your current CRM, design a replacement, migrate cleanly, and prove ROI in 90 days.
          </p>

          <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
            <button onClick={() => window.print()} className="btn btn-primary">
              <Printer size={14} /> Print or save as PDF
            </button>
            <button onClick={() => navigate('/services/crm')} className="btn btn-secondary">
              Back to Custom CRM
            </button>
          </div>
        </div>
      </section>

      {/* CHECKLIST BODY */}
      <section className="rc-pad" style={{ padding: '48px 40px 96px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {SECTIONS.map(s => (
            <div key={s.num} className="print-card" style={{
              background: W, border: `1px solid ${HAIR}`, borderRadius: 14,
              padding: '32px 30px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: R, letterSpacing: '.1em', fontFamily: FH, marginBottom: 10 }}>
                {s.num}
              </div>
              <h2 className="rc-sec-h2" style={{ fontSize: 28, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, lineHeight: 1.15, marginBottom: 12 }}>
                {s.title}
              </h2>
              <p style={{ fontSize: 15, color: MUTED, fontFamily: FB, lineHeight: 1.65, marginBottom: 20 }}>
                {s.intro}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {s.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 5, border: `1.5px solid ${HAIR}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      marginTop: 2, background: W,
                    }}>
                      <Check size={12} color={FAINT} />
                    </div>
                    <div style={{ fontSize: 14, color: INK, fontFamily: FB, lineHeight: 1.6 }}>
                      {item}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rc-pad no-print" style={{ padding: '72px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{
          maxWidth: 780, margin: '0 auto', background: INK, borderRadius: 20,
          padding: '44px 40px', color: W, position: 'relative', overflow: 'hidden', textAlign: 'center',
        }}>
          <div aria-hidden="true" style={{
            position: 'absolute', top: -80, right: -80, width: 240, height: 240,
            borderRadius: '50%', background: R + '30', filter: 'blur(60px)',
          }} />
          <div aria-hidden="true" style={{
            position: 'absolute', bottom: -80, left: -80, width: 220, height: 220,
            borderRadius: '50%', background: T + '30', filter: 'blur(60px)',
          }} />
          <div style={{ position: 'relative' }}>
            <h2 style={{ fontSize: 32, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: W, lineHeight: 1.1, marginBottom: 14 }}>
              Don't want to run this yourself?
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, marginBottom: 24, maxWidth: 540, margin: '0 auto 24px' }}>
              Book a 20-minute scoping call. We'll walk the checklist with you live and quote your build.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ background: R, borderColor: R }} onClick={() => navigate('/contact')}>
                Book a 20-min call <ArrowRight size={14} />
              </button>
              <a href={CONTACT_PHONE_HREF} className="btn" style={{
                background: 'transparent', color: W, border: '1px solid rgba(255,255,255,.3)',
              }}>
                <Phone size={14} /> {CONTACT_PHONE}
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="no-print">
        <PublicFooter />
      </div>
    </div>
  )
}
