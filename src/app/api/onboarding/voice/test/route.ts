import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'

// ─────────────────────────────────────────────────────────────
// Voice onboarding test simulator
//
// Fires fake webhook events against the real onboarding pipeline
// so the agency can end-to-end test the voice flow without making
// a real phone call. Every event routes through the SAME autosave
// + recipient update paths the real Retell webhook uses — so if
// the simulator populates a field, it shows up in ClientDetailPage,
// the live-call banner fires, and the notifications land.
//
// Actions:
//   simulate_call_started      — create an in_progress recipient row
//   simulate_answer            — autosave a field + update recipient
//   simulate_pin_verify        — test clients.onboarding_pin check
//   simulate_call_ended        — flip recipient status + fire notification
//   simulate_full_session      — runs all of the above in sequence
// ─────────────────────────────────────────────────────────────

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const TEST_ANSWERS: Record<string, string[]> = {
  welcome_statement: [
    "We're a supply chain consulting firm serving mid-market manufacturers in the Midwest. Our biggest challenge is generating consistent leads outside of referrals. We have a 3-6 month sales cycle and our average engagement is about $75,000.",
    "We run a family-owned HVAC company in Boca Raton. We've been in business 15 years, have 8 technicians, and our busy season is summer. Most leads come from Google and word of mouth.",
    "We're a B2B SaaS company selling project management software to construction companies. We have 2 sales reps, $1,200 average MRR per customer, and we're struggling with outbound.",
  ],
  owner_name: ['Frank Jones', 'Maria Rodriguez', 'David Chen', 'Sarah Mitchell'],
  primary_service: [
    'Supply chain optimization consulting',
    'Residential HVAC installation and repair',
    'Construction project management software',
    'Digital marketing for law firms',
  ],
  target_customer: [
    'Mid-market manufacturers with 50-200 employees in the Midwest who struggle with supply chain inefficiency',
    'Homeowners in South Florida with systems over 10 years old',
    'General contractors running projects over $500k',
  ],
  marketing_budget: ['$5,000 per month', 'About $3,000 a month mostly on Google Ads', '$8,500 monthly including agency fees'],
  crm_used: [
    'We use HubSpot but honestly barely touch it',
    'ServiceTitan for dispatch, nothing for marketing',
    'Salesforce, fully implemented with about 200 workflows',
  ],
  competitor_1: ['McKinsey Supply Chain Practice', 'Service Champions HVAC', 'Procore Technologies'],
  unique_selling_prop: [
    "We're the only firm that embeds a consultant on-site for the first 90 days",
    "Family owned, same-day service guarantee, and we've never missed a maintenance appointment in 15 years",
    'Built specifically for construction — not a generic PM tool adapted for construction',
  ],
  notes: [
    'We need more consistent lead flow and want to reduce dependence on referrals. Goal is 3 new enterprise clients per quarter.',
    'Fill slow season, get more 5-star reviews, and set up automated follow-up for leads that go cold.',
    'Improve close rate from 8% to 15% and expand into Texas and Florida markets.',
  ],
  city: ['Chicago', 'Boca Raton', 'Denver', 'Atlanta'],
  state: ['IL', 'FL', 'CO', 'GA'],
  num_employees: ['12 full-time consultants', '8 technicians plus 3 office staff', '23 people total'],
  year_founded: ['2008', '2009', '2015', '2018'],
  website: ['www.meridianscm.com', 'www.sunshineacservices.com', 'www.buildtrackpro.com'],
}

function getRandomAnswer(field: string): string {
  const options = TEST_ANSWERS[field]
  if (!options) return `Test answer for ${field} — ${new Date().toLocaleTimeString()}`
  return options[Math.floor(Math.random() * options.length)]
}

function generateCallId(): string {
  return 'test_call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action } = body || {}
    const s = sb()

    // ── simulate_call_started ─────────────────────────────
    if (action === 'simulate_call_started') {
      const {
        client_id,
        agency_id,
        caller_name = 'Test Caller',
        caller_phone = '+15550000001',
        call_id: providedCallId,
      } = body
      if (!client_id || !agency_id) {
        return NextResponse.json({ error: 'client_id and agency_id required' }, { status: 400 })
      }

      const call_id = providedCallId || generateCallId()

      const { data: client } = await s
        .from('clients')
        .select('name, owner_name, onboarding_pin')
        .eq('id', client_id)
        .maybeSingle()

      const { data: recipient } = await s
        .from('koto_onboarding_recipients')
        .insert({
          agency_id,
          client_id,
          name: caller_name,
          email: `test_${Date.now()}@voice.koto`,
          status: 'in_progress',
          source: 'voice',
          call_id,
          phone: caller_phone,
          last_active_at: new Date().toISOString(),
          opened_at: new Date().toISOString(),
          role_label: 'Test Caller',
        })
        .select()
        .single()

      try {
        await createNotification(
          s,
          agency_id,
          'onboarding_call_started',
          '📞 [TEST] Voice onboarding call started',
          `${caller_name} simulated a call for ${client?.name || client_id}`,
          `/clients/${client_id}`,
          '📞',
          { client_id, call_id, is_test: true },
        )
      } catch { /* non-fatal */ }

      return NextResponse.json({
        ok: true,
        call_id,
        recipient_id: recipient?.id,
        client_name: client?.name,
        has_pin: !!client?.onboarding_pin,
        message: `Simulated call started for ${client?.name || client_id}`,
      })
    }

    // ── simulate_answer ───────────────────────────────────
    if (action === 'simulate_answer') {
      const { client_id, agency_id, call_id, field, answer, confidence = 85 } = body
      if (!client_id || !field) {
        return NextResponse.json({ error: 'client_id and field required' }, { status: 400 })
      }

      const resolvedAnswer = answer || getRandomAnswer(field)

      // Route through the real autosave so FIELD_MAP / vault /
      // audit all fire exactly like they would for a real call.
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
      const autosaveRes = await fetch(`${origin}/api/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'autosave',
          client_id,
          agency_id,
          form_data: { [field]: resolvedAnswer },
          saved_at: new Date().toISOString(),
        }),
      })
      const autosaveData = await autosaveRes.json().catch(() => ({}))

      // Also update the recipient row so ClientDetailPage shows
      // the field count climbing in real time.
      if (call_id) {
        const { data: existing } = await s
          .from('koto_onboarding_recipients')
          .select('id, answers, fields_captured, fields_completed')
          .eq('call_id', call_id)
          .maybeSingle()

        if (existing) {
          const nowIso = new Date().toISOString()
          const nextAnswers = {
            ...(existing.answers || {}),
            [field]: { answer: resolvedAnswer, confidence, call_id, answered_at: nowIso, source: 'test' },
          }
          const nextCaptured = { ...(existing.fields_captured || {}), [field]: true }
          await s
            .from('koto_onboarding_recipients')
            .update({
              answers: nextAnswers,
              fields_captured: nextCaptured,
              fields_completed: (existing.fields_completed || 0) + 1,
              last_active_at: nowIso,
            })
            .eq('id', existing.id)
        }
      }

      return NextResponse.json({
        ok: true,
        field,
        answer: resolvedAnswer,
        confidence,
        autosave_result: autosaveData,
      })
    }

    // ── simulate_pin_verify ───────────────────────────────
    // Tests clients.onboarding_pin directly for easier debugging.
    if (action === 'simulate_pin_verify') {
      const { client_id, pin } = body
      if (!client_id) {
        return NextResponse.json({ error: 'client_id required' }, { status: 400 })
      }

      const { data: client } = await s
        .from('clients')
        .select('name, onboarding_pin, onboarding_phone, onboarding_status, onboarding_phone_expires_at')
        .eq('id', client_id)
        .maybeSingle()

      if (!client) return NextResponse.json({ valid: false, reason: 'client_not_found' })
      if (!client.onboarding_pin) {
        return NextResponse.json({
          valid: false,
          reason: 'no_pin_set',
          message: 'No PIN assigned to this client — provision a phone number first.',
        })
      }
      if (client.onboarding_status === 'complete') {
        return NextResponse.json({ valid: false, reason: 'already_complete', client_name: client.name })
      }

      const valid = client.onboarding_pin === String(pin || '').trim()
      return NextResponse.json({
        valid,
        reason: valid ? 'pin_correct' : 'wrong_pin',
        client_name: client.name,
        stored_pin: client.onboarding_pin,
        entered_pin: pin,
        message: valid
          ? `✅ PIN correct for ${client.name}`
          : `❌ PIN mismatch. Stored: ${client.onboarding_pin}, Entered: ${pin}`,
      })
    }

    // ── simulate_call_ended ───────────────────────────────
    if (action === 'simulate_call_ended') {
      const { client_id, agency_id, call_id, fields_captured = 0 } = body
      if (!client_id || !agency_id) {
        return NextResponse.json({ error: 'client_id and agency_id required' }, { status: 400 })
      }

      const { data: client } = await s.from('clients').select('*').eq('id', client_id).maybeSingle()
      const PRIORITY_FIELDS = [
        'welcome_statement', 'owner_name', 'primary_service',
        'target_customer', 'notes', 'city',
      ]
      const answered = PRIORITY_FIELDS.filter((f) => client && (client as any)[f])
      const missing = PRIORITY_FIELDS.filter((f) => !client || !(client as any)[f])
      const completionPct = Math.round((answered.length / PRIORITY_FIELDS.length) * 100)

      if (call_id) {
        await s
          .from('koto_onboarding_recipients')
          .update({
            status: completionPct === 100 ? 'complete' : 'abandoned',
            completed_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
          })
          .eq('call_id', call_id)
      }

      try {
        if (completionPct === 100) {
          await createNotification(
            s, agency_id,
            'onboarding_call_complete',
            '✅ [TEST] Voice onboarding complete',
            `${client?.name || 'Test client'} — ${fields_captured} fields captured this session`,
            `/clients/${client_id}`, '✅',
            { client_id, call_id, completion_pct: completionPct, is_test: true },
          )
        } else {
          await createNotification(
            s, agency_id,
            'onboarding_call_partial',
            '📞 [TEST] Onboarding call ended — action needed',
            `${client?.name || 'Test client'} — ${completionPct}% complete. Missing: ${missing.join(', ')}`,
            `/clients/${client_id}`, '⚠️',
            { client_id, call_id, completion_pct: completionPct, missing_fields: missing, is_test: true },
          )
        }
      } catch { /* non-fatal */ }

      return NextResponse.json({
        ok: true,
        completion_pct: completionPct,
        answered_fields: answered,
        missing_fields: missing,
        notification_sent: true,
        message: completionPct === 100
          ? '✅ Onboarding complete — all priority fields captured'
          : `⚠️ ${completionPct}% complete — ${missing.length} priority fields still missing`,
      })
    }

    // ── simulate_full_session ─────────────────────────────
    if (action === 'simulate_full_session') {
      const { client_id, agency_id, speed = 'normal' } = body
      if (!client_id || !agency_id) {
        return NextResponse.json({ error: 'client_id and agency_id required' }, { status: 400 })
      }
      // Delay between steps so the ClientDetailPage live poll has
      // time to pick up each field as it lands.
      const delay = speed === 'fast' ? 200 : speed === 'slow' ? 1500 : 600

      const call_id = generateCallId()
      const events: any[] = []
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

      async function step(a: string, b: Record<string, any>, label: string) {
        await new Promise((r) => setTimeout(r, delay))
        try {
          const res = await fetch(`${origin}/api/onboarding/voice/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: a, ...b }),
          })
          const data = await res.json()
          events.push({ label, result: data, timestamp: new Date().toISOString() })
          return data
        } catch (e: any) {
          events.push({ label, error: e?.message, timestamp: new Date().toISOString() })
          return { error: e?.message }
        }
      }

      await step('simulate_call_started', { client_id, agency_id, call_id, caller_name: 'Test Caller (Auto)' }, '📞 Call started')

      const FIELDS_TO_TEST = [
        'welcome_statement', 'owner_name', 'primary_service',
        'target_customer', 'marketing_budget', 'crm_used', 'notes',
      ]
      for (const field of FIELDS_TO_TEST) {
        await step('simulate_answer', { client_id, agency_id, call_id, field }, `💾 Saved: ${field}`)
      }

      const endResult = await step('simulate_call_ended', { client_id, agency_id, call_id, fields_captured: FIELDS_TO_TEST.length }, '📴 Call ended')

      return NextResponse.json({
        ok: true,
        call_id,
        events,
        fields_captured: FIELDS_TO_TEST.length,
        completion_pct: endResult?.completion_pct || null,
        missing_fields: endResult?.missing_fields || [],
        summary: `Simulated ${FIELDS_TO_TEST.length} field answers in ${(FIELDS_TO_TEST.length * delay / 1000).toFixed(1)}s`,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Test simulation failed' }, { status: 500 })
  }
}
