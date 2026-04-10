import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// Discovery Simulator
//
// POST action: 'run'
//   Body: { agency_id, profile_id, client_id? }
//
// 1. If no client_id, create a test client (source_meta.is_test = true)
// 2. Create a discovery engagement via the normal create flow
// 3. Call Claude Sonnet to generate realistic answers for all 12 sections
// 4. Write those answers into the sections jsonb
// 5. Trigger run_research action internally
// 6. Calculate readiness score
// 7. Return { engagement_id, client_id, client_name, field_count, ... }
//
// This lets super-admins test the entire discovery document UX end-to-end
// with real AI-generated content — no manual data entry required.
// ─────────────────────────────────────────────────────────────

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type Profile = {
  id: string
  label: string
  emoji: string
  industry: string
  city: string
  state: string
  description: string
  welcome_statement: string
  classification: {
    business_model: 'b2b' | 'b2c' | 'both'
    geographic_scope: 'local' | 'regional' | 'national' | 'international'
    business_type: string
    sales_cycle: 'transactional' | 'consultative' | 'enterprise'
    has_sales_team: boolean
  }
}

const PROFILES: Profile[] = [
  {
    id: 'local_hvac',
    label: 'Local HVAC Company',
    emoji: '🔥',
    industry: 'HVAC / Heating & Cooling',
    city: 'Miami',
    state: 'FL',
    description: 'Family-owned HVAC, 15 years, 8 techs, service-van based',
    welcome_statement: `We're Sunshine HVAC, family-owned for 15 years serving Miami-Dade County. My dad started the business, I took over in 2018. We run 8 service vans, mostly residential repair and replacement, some light commercial. Our biggest problem is that summer we can't keep up with calls and winter we're starving. We tried Google Ads in 2022 but burned $8k with no traction. Most of our jobs come from Google reviews and neighbor referrals. We use ServiceTitan for dispatch but our marketing is basically nothing.`,
    classification: { business_model: 'b2c', geographic_scope: 'local', business_type: 'service_based', sales_cycle: 'transactional', has_sales_team: false },
  },
  {
    id: 'b2b_saas',
    label: 'B2B SaaS Startup',
    emoji: '💻',
    industry: 'SaaS / Software',
    city: 'Austin',
    state: 'TX',
    description: 'Seed-stage B2B SaaS, 22 employees, $4M ARR, Series A in 6 months',
    welcome_statement: `We're Beacon Analytics, a B2B data platform for mid-market retailers. We're 22 people, seed stage, doing about $4M ARR. Our CEO is raising Series A in 6 months. The problem is our pipeline has stalled — we were growing 15% MoM off outbound but everything tightened up in Q3. We need inbound to start working. We use HubSpot for CRM + email, we have a marketing manager but no dedicated growth person. Content is sporadic and SEO is basically zero.`,
    classification: { business_model: 'b2b', geographic_scope: 'national', business_type: 'saas', sales_cycle: 'enterprise', has_sales_team: true },
  },
  {
    id: 'medical_practice',
    label: 'Medical Practice',
    emoji: '🩺',
    industry: 'Medical / Healthcare',
    city: 'Denver',
    state: 'CO',
    description: 'Specialty medical practice, 4 providers, insurance + cash pay',
    welcome_statement: `Rocky Mountain Dermatology — 4 providers, been open 12 years in Denver. We're about 60% insurance 40% cash pay cosmetic. Patients love us but our website hasn't been updated since 2019 and we rely entirely on word-of-mouth and our insurance network. We want to grow the cash-pay cosmetic side (Botox, fillers, lasers) but don't know how to market it without looking sleazy. We use EPIC for patient records but that's not a marketing tool. No CRM.`,
    classification: { business_model: 'b2c', geographic_scope: 'local', business_type: 'service_based', sales_cycle: 'consultative', has_sales_team: false },
  },
  {
    id: 'national_franchise',
    label: 'National Franchise',
    emoji: '🏢',
    industry: 'Franchise / Multi-Location',
    city: 'Dallas',
    state: 'TX',
    description: 'National franchise with 47 locations across 12 states',
    welcome_statement: `We're the corporate marketing team for PaintPro Franchise — 47 locations across 12 states, most are owner-operators with 2-5 employees. Corporate runs national SEM and brand, but individual locations beg us for local marketing support and we can't scale it. Lead quality is inconsistent — some locations convert at 40%, others at 8%. We need a white-label solution that gives every franchisee the same marketing engine without us having to run it. Budget is flexible but we need ROI to justify it up the chain.`,
    classification: { business_model: 'b2c', geographic_scope: 'national', business_type: 'franchise', sales_cycle: 'transactional', has_sales_team: true },
  },
  {
    id: 'law_firm',
    label: 'Law Firm',
    emoji: '⚖️',
    industry: 'Legal / Law Firm',
    city: 'Chicago',
    state: 'IL',
    description: 'Personal injury law firm, 6 attorneys, high-value cases',
    welcome_statement: `Kaplan Injury Law — 6 attorneys, personal injury only, Chicago metro. Our average case value is $85k. We currently spend about $30k/month on Google Ads and SEO through a local agency that's been okay but not great. Intake conversion is our biggest problem — we get the leads but our front desk can't convert them fast enough. We lose 40% of leads to competitors who call back faster. We need help with speed-to-lead and a better CRM — currently using a homegrown Excel system.`,
    classification: { business_model: 'b2c', geographic_scope: 'regional', business_type: 'professional_services', sales_cycle: 'consultative', has_sales_team: true },
  },
  {
    id: 'ecommerce',
    label: 'E-Commerce Brand',
    emoji: '🛍️',
    industry: 'E-commerce / Retail',
    city: 'Los Angeles',
    state: 'CA',
    description: 'DTC fashion brand, Shopify, $2M/year, growth stalled',
    welcome_statement: `Lila & Co — DTC women's fashion, we launched in 2021 and hit $2M in year 2 almost entirely off Instagram and TikTok organic. Now growth has stalled. iOS updates killed our Meta ads ROAS and organic reach has tanked. We're on Shopify, using Klaviyo for email (100k list, average), and our content is getting stale. We need to diversify off paid social and build SEO + email as real channels. Our founder is burned out doing everything. We have 2 FT marketing people.`,
    classification: { business_model: 'b2c', geographic_scope: 'national', business_type: 'ecommerce', sales_cycle: 'transactional', has_sales_team: false },
  },
  {
    id: 'consulting_firm',
    label: 'Consulting Firm',
    emoji: '📊',
    industry: 'Consulting',
    city: 'New York',
    state: 'NY',
    description: 'Boutique management consulting firm, 18 consultants, Fortune 500 clients',
    welcome_statement: `Apex Advisory — boutique management consulting, 18 consultants, we work with Fortune 500 operations teams on supply chain transformation. Founded in 2015. Revenue is around $18M. Our pipeline is 80% referrals and repeat clients, but we have zero inbound and our brand is invisible. LinkedIn is our only marketing channel and it's ad-hoc. We don't have a marketing leader. We're trying to become the "go-to" firm for mid-market supply chain projects but no one outside our network has heard of us.`,
    classification: { business_model: 'b2b', geographic_scope: 'national', business_type: 'professional_services', sales_cycle: 'enterprise', has_sales_team: true },
  },
  {
    id: 'dental_practice',
    label: 'Dental Practice',
    emoji: '🦷',
    industry: 'Dental',
    city: 'Seattle',
    state: 'WA',
    description: 'Multi-location dental practice, 3 offices, insurance + cash',
    welcome_statement: `Evergreen Dental Group — 3 offices in the Seattle area, 12 dentists, mix of general dentistry and specialty (implants, cosmetic). Total revenue about $8M. Marketing is currently split: office managers do social media locally, and we have an agency running Google Ads. Results are mediocre. We want to grow the cash-pay specialty side — implants and Invisalign — which have 5x the margin. We use Dentrix for practice management but our patient marketing is basically email blasts to 8k contacts with a 12% open rate.`,
    classification: { business_model: 'b2c', geographic_scope: 'local', business_type: 'service_based', sales_cycle: 'consultative', has_sales_team: false },
  },
  // ── Discovery-specific profiles (stress-test the doc) ──
  {
    id: 'chaotic_startup',
    label: 'Chaotic Startup',
    emoji: '🧨',
    industry: 'Startup / Early Stage',
    city: 'Boulder',
    state: 'CO',
    description: 'Founder does everything, no CRM, high opportunity',
    welcome_statement: `Honestly we're a mess. I'm the founder, I do sales, delivery, marketing, everything. We're 18 months old, 4 employees, doing about $900k ARR. We use Google Sheets for "CRM", a free Mailchimp account for email, and I post on LinkedIn when I remember. We have no marketing person. No website analytics. No pipeline visibility. I know we could double if we fixed this but I can't think straight long enough to build a plan. I need an agency that will just take the wheel.`,
    classification: { business_model: 'b2b', geographic_scope: 'regional', business_type: 'consulting', sales_cycle: 'consultative', has_sales_team: false },
  },
  {
    id: 'over_agencied',
    label: 'Over-Agencied (Burned)',
    emoji: '😤',
    industry: 'Home Services',
    city: 'Phoenix',
    state: 'AZ',
    description: 'Has worked with 3 agencies, burned, skeptical, solid infrastructure',
    welcome_statement: `I'll be blunt — we've worked with 3 agencies in 4 years and every one of them promised the world and delivered mediocre results. So I'm skeptical of you too. We run a plumbing company, 18 trucks, $7M revenue. We have ServiceTitan dialed in, we have CallRail, GA4, and our own tracking setup. We know our numbers cold. What we don't have is an agency partner who actually understands our business and doesn't disappear after month 3. If you pitch me fluffy "brand awareness" I'll end the call.`,
    classification: { business_model: 'b2c', geographic_scope: 'local', business_type: 'service_based', sales_cycle: 'transactional', has_sales_team: true },
  },
  {
    id: 'franchise_location',
    label: 'Single Franchise Location',
    emoji: '🏪',
    industry: 'Franchise Location',
    city: 'Orlando',
    state: 'FL',
    description: 'One location of a national franchise with limited marketing autonomy',
    welcome_statement: `We own a single location of HomeGym Fitness — a national fitness franchise with 200+ locations. Corporate runs national brand campaigns and has strict rules about what local marketing we can do (no paid search on the brand name, specific approved creative, etc.). Our location is in Orlando, we've been open 3 years, 800 members, and corporate says our local marketing is underperforming but won't let us actually do anything interesting. We need to figure out what's actually allowed and execute well within those guardrails.`,
    classification: { business_model: 'b2c', geographic_scope: 'local', business_type: 'franchise', sales_cycle: 'transactional', has_sales_team: false },
  },
  {
    id: 'enterprise_migration',
    label: 'Enterprise Migration',
    emoji: '🏗️',
    industry: 'Enterprise / B2B',
    city: 'Atlanta',
    state: 'GA',
    description: 'Large company migrating away from legacy systems, complex tech stack',
    welcome_statement: `We're a 400-person industrial distributor, $140M revenue, 22 branches across the Southeast. We're in the middle of a 2-year digital transformation — migrating from a 90s-era ERP to NetSuite, replacing a custom CRM with Salesforce, and rebuilding our customer portal. Marketing has historically been trade publications and relationships. Our CEO wants a real digital engine but the team is drowning in the migration. We need a partner who can move slowly and carefully alongside our IT team — not disrupt what's already fragile.`,
    classification: { business_model: 'b2b', geographic_scope: 'regional', business_type: 'distribution', sales_cycle: 'enterprise', has_sales_team: true },
  },
]

async function callClaudeJson(opts: { system: string; user: string; maxTokens: number; timeoutMs?: number }): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: opts.maxTokens,
        temperature: 0.7,
        system: opts.system,
        messages: [{ role: 'user', content: opts.user }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60000),
    })
    if (!res.ok) return null
    const d = await res.json()
    const text = (d.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim()
    const cleaned = text.replace(/```json|```/g, '').trim()
    try { return JSON.parse(cleaned) } catch { return null }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action, agency_id, profile_id } = body || {}

    if (!agency_id) {
      return NextResponse.json({ error: 'Missing agency_id' }, { status: 400 })
    }

    if (action === 'profiles') {
      return NextResponse.json({
        profiles: PROFILES.map((p) => ({
          id: p.id,
          label: p.label,
          emoji: p.emoji,
          industry: p.industry,
          city: p.city,
          state: p.state,
          description: p.description,
          business_model: p.classification.business_model,
          geographic_scope: p.classification.geographic_scope,
          business_type: p.classification.business_type,
        })),
      })
    }

    if (action === 'run') {
      const profile = PROFILES.find((p) => p.id === profile_id) || PROFILES[0]
      const sb = getSupabase()

      // ── 1. Create (or reuse) a test client record ──────────────────────
      let clientId: string | null = body.client_id || null
      let clientName: string = profile.label

      if (!clientId) {
        const businessName = `${profile.label} (Sim ${Math.floor(Math.random() * 9000 + 1000)})`
        clientName = businessName
        const { data: inserted, error: insErr } = await sb
          .from('clients')
          .insert({
            agency_id,
            name: businessName,
            industry: profile.industry,
            city: profile.city,
            state: profile.state,
            welcome_statement: profile.welcome_statement,
            business_classification: profile.classification,
            source_meta: { source: 'discovery_simulator', is_test: true, is_simulation: true, profile_id: profile.id },
          })
          .select('id, name')
          .maybeSingle()
        if (insErr || !inserted) {
          return NextResponse.json({ error: insErr?.message || 'Failed to create test client' }, { status: 500 })
        }
        clientId = inserted.id
        clientName = inserted.name || businessName
      } else {
        const { data: existing } = await sb.from('clients').select('name').eq('id', clientId).maybeSingle()
        if (existing?.name) clientName = existing.name
      }

      // ── 2. Create a discovery engagement via the normal create action ──
      // We call the create action inline rather than forwarding to /api/discovery
      // because routes inside the same Next function can't self-invoke reliably.
      // Duplicate just enough of the create flow to get an engagement row back.
      // The full create action lives in src/app/api/discovery/route.ts.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
      const createRes = await fetch(`${appUrl}/api/discovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          agency_id,
          client_name: clientName,
          client_id: clientId,
          client_industry: profile.industry,
          domains: [],
        }),
      }).then((r) => r.json()).catch(() => null)

      const engagement = createRes?.data
      if (!engagement?.id) {
        return NextResponse.json({ error: createRes?.error || 'Failed to create engagement' }, { status: 500 })
      }

      // ── 3. Generate realistic answers via Claude Sonnet ─────────────────
      const systemPrompt = `You are simulating a completed discovery call with a real marketing agency client. Generate realistic, specific, detailed answers for every section of a discovery document. Include real numbers, actual platform names, honest challenges, and believable context. Make it feel like a real client — not perfect, with some gaps and some wins. Leave 2-4 fields empty across the document to simulate realistic data gaps. Return JSON only, no commentary.`

      const userPrompt = `Business profile:
Name: ${clientName}
Industry: ${profile.industry}
Location: ${profile.city}, ${profile.state}
Description: ${profile.description}

Welcome statement (client's own words):
"${profile.welcome_statement}"

Classification: ${profile.classification.business_model.toUpperCase()} · ${profile.classification.geographic_scope} · ${profile.classification.business_type} · ${profile.classification.sales_cycle} sales cycle · ${profile.classification.has_sales_team ? 'has sales team' : 'no dedicated sales team'}

Generate realistic discovery call answers for ALL 12 sections below. Every field should have a specific, non-generic answer (3-5 sentences where appropriate, a number or short phrase where that fits). Include some gaps (empty string "") and some red flags and some genuine opportunities.

Return JSON matching this exact structure (every key must be present, empty string is OK):

{
  "section_01": { "01_welcome": "", "01a": "", "01b": "", "01c": "", "01d": "", "01e": "" },
  "section_02": { "02a": "", "02b": "" },
  "section_03": { "03a": "", "03b": "", "03c": "", "03d": "", "03e": "", "03f": "" },
  "section_04": { "04a": "", "04b": "", "04c": "", "04d": "", "04e": "", "04f": "" },
  "section_05": { "05a": "", "05b": "", "05c": "", "05d": "", "05e": "", "05f": "", "05g": "", "05h": "" },
  "section_06": { "06a": "", "06b": "", "06c": "", "06d": "", "06e": "", "06f": "", "06g": "" },
  "section_07": { "07a": "", "07b": "", "07c": "", "07d": "", "07e": "", "07f": "", "07g": "", "07h": "" },
  "section_08": { "08a": "", "08b": "", "08c": "", "08d": "", "08e": "", "08f": "", "08g": "", "08h": "", "08i": "", "08j": "" },
  "section_09": { "09a": "", "09b": "", "09c": "", "09d": "", "09e": "", "09f": "", "09g": "", "09h": "", "09i": "" },
  "section_10": { "10a": "", "10b": "", "10c": "", "10d": "", "10e": "", "10f": "", "10g": "", "10h": "", "10i": "", "10j": "" },
  "section_11": { "11a": "", "11b": "", "11c": "", "11d": "", "11e": "", "11f": "", "11g": "", "11h": "", "11i": "", "11j": "", "11k": "" },
  "section_12": { "12a": "", "12b": "", "12c": "", "12d": "", "12e": "", "12f": "" }
}

Section titles and what each maps to (use these to generate relevant content):
- section_01: Pre-Call Research — fill 01a-01d with background/entities/revenue/observations; leave 01_welcome as "" (already pre-filled from welcome statement); 01e is corrections from the call.
- section_02: Technology Intelligence (02a: missing domains, 02b: platform admins)
- section_03: Digital Footprint (who owns social, active platforms, dormant, paid social, organic lead gen, review system)
- section_04: Foundation (revenue sources ranked, brand/domain relationships, team, weekly volume, prior digital manager, other revenue)
- section_05: Audience and Pipeline (ICP, lead sources, post-submit flow, lead-to-call %, call-to-client %, lost leads, reactivation, upsell path)
- section_06: Platform Audit — CRM (CRM age, use, workflows count, incidents, contact structure, integrations, confidence 1-10)
- section_07: Strategic Vision — GHL Opportunities (lead pipeline, pre-call nurture, ecomm pipeline, missed call text-back, review gen, long-term nurture, AI bot, unified dashboard)
- section_08: Email Marketing (platform, open %, CTR %, frequency, segmentation, welcome sequence, campaign results, CRM-connected, list hygiene, behavioral triggers)
- section_09: SMS Marketing (using SMS?, platform, A2P status, TCPA consent, reminders, missed-call text-back, 5-min follow-up, international contacts, missed moments)
- section_10: Direction and Scope (top 3 goals, biggest fix, 90-day success, what didn't work before, engagement type, budget, comms prefs, decision makers, anything else, internal post-call notes)
- section_11: Paid Ads (running?, platforms+spend, who manages, objectives, ROAS/CPL, landing pages, audiences, conversion tracking, creative refresh, attribution, budget feel)
- section_12: Objections and Concerns (objections, past bad experience, timeline pressure, approval chain, pricing sensitivity, risk factors)`

      const generated = await callClaudeJson({
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 4000,
        timeoutMs: 60000,
      })

      if (!generated || typeof generated !== 'object') {
        return NextResponse.json({
          error: 'AI generation failed — engagement created but no answers were populated',
          engagement_id: engagement.id,
          client_id: clientId,
        }, { status: 500 })
      }

      // ── 4. Write the generated answers into the sections jsonb ──────────
      const sections = Array.isArray(engagement.sections) ? engagement.sections : []
      let fieldCount = 0
      let sectionsPopulated = 0

      for (const sec of sections) {
        const secAnswers = generated[sec.id]
        if (!secAnswers || typeof secAnswers !== 'object') continue
        let sectionHasAnswers = false
        for (const field of (sec.fields || [])) {
          const v = secAnswers[field.id]
          if (typeof v === 'string' && v.trim()) {
            field.answer = v.trim()
            field.source = 'simulator'
            fieldCount += 1
            sectionHasAnswers = true
          }
        }
        if (sectionHasAnswers) sectionsPopulated += 1
      }

      await sb
        .from('koto_discovery_engagements')
        .update({ sections, status: 'research_complete' })
        .eq('id', engagement.id)

      // ── 5. Kick off research (fire-and-forget) — fills 01a-01d with real AI
      // research on top of what the simulator generated. Best-effort, non-fatal.
      fetch(`${appUrl}/api/discovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_research', id: engagement.id, agency_id }),
      }).catch(() => {})

      // ── 6. Calculate readiness score ────────────────────────────────────
      let readinessScore: number | null = null
      let readinessLabel: string | null = null
      try {
        const readinessRes = await fetch(`${appUrl}/api/discovery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'calculate_readiness', id: engagement.id, agency_id }),
        }).then((r) => r.json())
        readinessScore = readinessRes?.data?.score ?? null
        readinessLabel = readinessRes?.data?.label ?? null
      } catch { /* non-fatal */ }

      return NextResponse.json({
        ok: true,
        engagement_id: engagement.id,
        client_id: clientId,
        client_name: clientName,
        profile_id: profile.id,
        profile_label: profile.label,
        field_count: fieldCount,
        sections_populated: sectionsPopulated,
        readiness_score: readinessScore,
        readiness_label: readinessLabel,
        discovery_url: `/discovery?id=${engagement.id}`,
        generated_data: generated,
      })
    }

    if (action === 'delete') {
      const sb = getSupabase()
      const { engagement_id, client_id } = body
      if (engagement_id) {
        await sb.from('koto_discovery_engagements').delete().eq('id', engagement_id).eq('agency_id', agency_id)
      }
      if (client_id) {
        await sb.from('clients')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', client_id)
          .eq('agency_id', agency_id)
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
