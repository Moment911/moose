import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '@/lib/apiAuth'
import { DEFAULT_CLASSIFICATION, getAdaptiveQuestions } from '@/lib/onboardingQuestions'

/**
 * Onboarding Form Simulator
 *
 * Super-admin dev tool. Given a preset business profile (or custom
 * welcome statement), runs the full onboarding flow end-to-end:
 *   1. Calls the classifier to detect B2B/B2C, local/national, etc.
 *   2. Generates a complete realistic form fill via Claude Sonnet
 *   3. Creates a test client row tagged source_meta.is_test=true + is_simulation=true
 *   4. Calls the normal autosave path so every field lands through the real
 *      FIELD_MAP (identical to a real client filling out the form)
 *   5. Returns client_id, classification, generated_data, and the list of
 *      adaptive questions that would show for this classification
 *
 * The frontend uses the returned client_id to:
 *   - Link to /clients/:id (see the client detail page)
 *   - Link to /onboard/:id (see the pre-filled onboarding form)
 *   - Soft-delete the simulated client when done
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

const DEFAULT_AGENCY = '00000000-0000-0000-0000-000000000099'
const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

function getOrigin(req: NextRequest): string {
  return (
    req.headers.get('origin') ||
    req.headers.get('x-forwarded-host')?.replace(/^/, 'https://') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://hellokoto.com'
  )
}

export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json().catch(() => ({}))
    const { searchParams } = new URL(req.url)
    const action = body.action || searchParams.get('action') || 'run'
    const agencyId = resolveAgencyId(req, searchParams, body) || DEFAULT_AGENCY

    if (action !== 'run') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const profileId: string = body.profile_id || 'custom'
    const welcomeStatement: string = String(body.welcome_statement || '').trim()
    if (!welcomeStatement || welcomeStatement.length < 30) {
      return NextResponse.json({ error: 'welcome_statement must be at least 30 characters' }, { status: 400 })
    }

    const origin = getOrigin(req)
    const apiKey = process.env.ANTHROPIC_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    // ─── Step 1: classify ────────────────────────────────
    let classification: any = DEFAULT_CLASSIFICATION
    try {
      const classifyRes = await fetch(`${origin}/api/onboarding/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ welcome_statement: welcomeStatement }),
      })
      const classifyJson = await classifyRes.json().catch(() => ({}))
      if (classifyJson?.classification) {
        classification = classifyJson.classification
      }
    } catch { /* fall back to default */ }

    // ─── Step 2: generate complete realistic form fill ───
    const generationSystem = 'You are filling out a marketing agency onboarding form as a realistic business. Generate believable, specific, detailed answers for every field. Be realistic — include specific numbers, real-sounding names, actual challenges, and concrete details. Return ONLY valid JSON, no preamble, no markdown fences, no prose.'

    const generationUser = `Business description: "${welcomeStatement}"

Classification:
${JSON.stringify(classification, null, 2)}

Generate realistic answers for ALL of these fields. Be specific and concrete — no placeholders, no "Example Co" names, no "123 Main St" addresses. Pick a plausible real-sounding business name + location that matches the description.

Return JSON only with EXACTLY these keys:
{
  "business_name": "string",
  "email": "string (realistic business email)",
  "phone": "string (realistic phone formatted as (XXX) XXX-XXXX)",
  "website": "string (url)",
  "industry": "string",
  "city": "string",
  "state": "string (2 letter)",
  "address": "string",
  "zip": "string",
  "owner_name": "string (realistic full name)",
  "owner_title": "string",
  "owner_email": "string",
  "owner_phone": "string",
  "num_employees": "string",
  "year_founded": "string",
  "primary_service": "string",
  "secondary_services": "string",
  "target_customer": "string (detailed 2-3 sentence paragraph)",
  "avg_deal_size": "string",
  "marketing_budget": "string",
  "marketing_channels": "string",
  "crm_used": "string",
  "competitor_1": "string",
  "competitor_2": "string",
  "competitor_3": "string",
  "unique_selling_prop": "string",
  "brand_voice": "string",
  "referral_sources": "string",
  "review_platforms": "string",
  "google_business_url": "string",
  "facebook_url": "string",
  "instagram_url": "string",
  "notes": "string (detailed goals and challenges, 3-5 sentences)",
  "tagline": "string",
  "service_area": "string",
  "target_industries": "string (only if b2b)",
  "decision_maker_titles": "string (only if b2b)",
  "avg_contract_value": "string (only if b2b)",
  "sales_cycle_length": "string (only if b2b)",
  "sales_team_size": "string (only if b2b)",
  "b2b_lead_sources": "string (only if b2b)",
  "num_locations": "string (only if national or regional)",
  "top_markets": "string (only if national or regional)"
}

Omit keys that don't apply to this classification. Set welcome_statement to: ${JSON.stringify(welcomeStatement)}`

    let generatedData: Record<string, any> = {}
    try {
      const genRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 3000,
          temperature: 0.7,
          system: generationSystem,
          messages: [{ role: 'user', content: generationUser }],
        }),
        signal: AbortSignal.timeout(45000),
      })
      if (!genRes.ok) {
        const errText = await genRes.text().catch(() => '')
        return NextResponse.json({ error: `Claude ${genRes.status}: ${errText.slice(0, 300)}` }, { status: 500 })
      }
      const genData: any = await genRes.json()
      const text: string = (genData.content || [])
        .filter((c: any) => c?.type === 'text')
        .map((c: any) => c.text)
        .join('')
        .trim()
      const cleaned = text.replace(/```json|```/g, '').trim()
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (!match) {
        return NextResponse.json({ error: 'Could not parse JSON from Claude response' }, { status: 500 })
      }
      generatedData = JSON.parse(match[0])
    } catch (e: any) {
      return NextResponse.json({ error: `Generation failed: ${e?.message || 'unknown'}` }, { status: 500 })
    }

    // Ensure welcome_statement is in the payload (Claude sometimes omits it)
    generatedData.welcome_statement = welcomeStatement

    // ─── Step 3: create a test client row ────────────────
    const s = sb()
    const simulationMeta = {
      is_test: true,
      is_simulation: true,
      profile_id: profileId,
      generated_at: new Date().toISOString(),
    }

    const { data: newClient, error: insErr } = await s
      .from('clients')
      .insert({
        agency_id: agencyId,
        name: generatedData.business_name || 'Simulated Client',
        email: generatedData.email || null,
        phone: generatedData.phone || null,
        website: generatedData.website || null,
        industry: generatedData.industry || null,
        city: generatedData.city || null,
        state: generatedData.state || null,
        status: 'prospect',
        business_classification: classification,
        source_meta: simulationMeta,
      })
      .select('id, agency_id')
      .maybeSingle()

    if (insErr || !newClient) {
      return NextResponse.json({ error: `Insert failed: ${insErr?.message || 'no row returned'}` }, { status: 500 })
    }

    const clientId = newClient.id

    // ─── Step 4: route everything through the normal autosave path ───
    // This exercises FIELD_MAP + jsonb spillover + trigger exactly like a
    // real client would on their last keystroke. Guarantees the simulated
    // data flows through the same plumbing as production onboarding.
    try {
      await fetch(`${origin}/api/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'autosave',
          client_id: clientId,
          agency_id: agencyId,
          form_data: generatedData,
          classification,
          saved_at: new Date().toISOString(),
        }),
      })
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[simulator] autosave passthrough failed:', e?.message || e)
    }

    // ─── Step 5: return everything the UI needs ──────────
    const adaptiveQuestions = getAdaptiveQuestions(classification)

    return NextResponse.json({
      data: {
        client_id: clientId,
        classification,
        generated_data: generatedData,
        adaptive_questions: adaptiveQuestions,
        onboarding_url: `${origin}/onboard/${clientId}`,
        client_detail_url: `${origin}/clients/${clientId}`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
