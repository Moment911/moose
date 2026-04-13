import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '../../../lib/apiAuth'
import { buildFrontDeskPrompt, buildFrontDeskPromptForClient, type FrontDeskConfig } from '../../../lib/frontDeskPromptBuilder'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'list'
    const agency_id = resolveAgencyId(req, searchParams)
    if (!agency_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const sb = getSupabase()

    if (action === 'list') {
      const { data, error } = await sb.from('koto_front_desk_configs').select('*').eq('agency_id', agency_id).order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ configs: data || [] })
    }

    if (action === 'get') {
      const client_id = searchParams.get('client_id')
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
      const { data } = await sb.from('koto_front_desk_configs').select('*').eq('client_id', client_id).eq('agency_id', agency_id).maybeSingle()
      return NextResponse.json({ config: data || null })
    }

    if (action === 'preview_prompt') {
      const client_id = searchParams.get('client_id')
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
      const { data } = await sb.from('koto_front_desk_configs').select('*').eq('client_id', client_id).eq('agency_id', agency_id).maybeSingle()
      if (!data) return NextResponse.json({ error: 'No config found' }, { status: 404 })

      const config: FrontDeskConfig = {
        company_name: data.company_name,
        industry: data.industry,
        address: data.address,
        phone: data.phone,
        website: data.website,
        timezone: data.timezone || 'America/New_York',
        business_hours: data.business_hours || {},
        services: data.services || [],
        insurance_accepted: data.insurance_accepted || [],
        scheduling_link: data.scheduling_link,
        scheduling_department_name: data.scheduling_department_name,
        scheduling_department_phone: data.scheduling_department_phone,
        staff_directory: data.staff_directory || [],
        custom_greeting: data.custom_greeting,
        custom_instructions: data.custom_instructions,
        hipaa_mode: data.hipaa_mode ?? false,
        emergency_keywords: data.emergency_keywords || [],
        voicemail_enabled: data.voicemail_enabled ?? true,
        transfer_enabled: data.transfer_enabled ?? true,
        sms_enabled: data.sms_enabled ?? true,
      }

      const prompt = buildFrontDeskPrompt(config)
      return NextResponse.json({ prompt })
    }

    // ── Get call log for a client ──
    if (action === 'get_calls') {
      const client_id = searchParams.get('client_id')
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
      const outcome = searchParams.get('outcome')
      const date_from = searchParams.get('date_from')
      const date_to = searchParams.get('date_to')

      let query = sb.from('koto_front_desk_calls')
        .select('id, config_id, retell_call_id, caller_phone, caller_name, direction, duration_seconds, outcome, transfer_to, transfer_accepted, sentiment, ai_summary, voicemail, voicemail_url, links_sent, ghl_synced, created_at')
        .eq('client_id', client_id)
        .eq('agency_id', agency_id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (outcome) query = query.eq('outcome', outcome)
      if (date_from) query = query.gte('created_at', date_from)
      if (date_to) query = query.lte('created_at', date_to)

      const { data, error } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ calls: data || [] })
    }

    // ── Get single call with full details ──
    if (action === 'get_call') {
      const call_id = searchParams.get('call_id')
      if (!call_id) return NextResponse.json({ error: 'Missing call_id' }, { status: 400 })
      const { data, error } = await sb.from('koto_front_desk_calls').select('*').eq('id', call_id).eq('agency_id', agency_id).maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data) return NextResponse.json({ error: 'Call not found' }, { status: 404 })
      return NextResponse.json({ call: data })
    }

    // ── Client-facing: get own config ──
    if (action === 'client_get') {
      const client_id = searchParams.get('client_id')
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
      const { data } = await sb.from('koto_front_desk_configs').select('*').eq('client_id', client_id).maybeSingle()
      if (!data) return NextResponse.json({ config: null })
      return NextResponse.json({ config: data, editable: data.allow_client_editing ?? false })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── POST ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body
    const agency_id = resolveAgencyId(req, undefined, body)
    if (!agency_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const sb = getSupabase()

    // ── Upsert config ──
    if (action === 'save') {
      const { client_id, ...fields } = body
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })

      const { data: existing } = await sb.from('koto_front_desk_configs').select('id').eq('client_id', client_id).eq('agency_id', agency_id).maybeSingle()

      const payload = {
        agency_id, client_id,
        company_name: fields.company_name,
        industry: fields.industry,
        address: fields.address,
        phone: fields.phone,
        website: fields.website,
        timezone: fields.timezone || 'America/New_York',
        business_hours: fields.business_hours || {},
        services: fields.services || [],
        insurance_accepted: fields.insurance_accepted || [],
        scheduling_link: fields.scheduling_link,
        scheduling_department_name: fields.scheduling_department_name,
        scheduling_department_phone: fields.scheduling_department_phone,
        staff_directory: fields.staff_directory || [],
        custom_greeting: fields.custom_greeting,
        custom_instructions: fields.custom_instructions,
        hipaa_mode: fields.hipaa_mode ?? false,
        emergency_keywords: fields.emergency_keywords || ['emergency', 'urgent'],
        voicemail_enabled: fields.voicemail_enabled ?? true,
        transfer_enabled: fields.transfer_enabled ?? true,
        sms_enabled: fields.sms_enabled ?? true,
        recording_enabled: fields.recording_enabled ?? true,
        allow_client_editing: fields.allow_client_editing ?? false,
        sendable_links: fields.sendable_links || [],
        voice_id: fields.voice_id,
        voice_name: fields.voice_name || 'Nicole',
        status: fields.status || 'draft',
        voicemail_greeting: fields.voicemail_greeting,
        voicemail_max_seconds: fields.voicemail_max_seconds ?? 120,
        transfer_timeout_seconds: fields.transfer_timeout_seconds ?? 30,
        transfer_announce_template: fields.transfer_announce_template ?? 'You have an incoming call from {caller}. Press 1 to connect.',
      }

      let result
      if (existing) {
        result = await sb.from('koto_front_desk_configs').update(payload).eq('id', existing.id).select().single()
      } else {
        result = await sb.from('koto_front_desk_configs').insert(payload).select().single()
      }

      if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
      return NextResponse.json({ config: result.data })
    }

    // ── Activate (set status to active) ──
    if (action === 'activate') {
      const { client_id } = body
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
      const { error } = await sb.from('koto_front_desk_configs').update({ status: 'active' }).eq('client_id', client_id).eq('agency_id', agency_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Pause ──
    if (action === 'pause') {
      const { client_id } = body
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
      const { error } = await sb.from('koto_front_desk_configs').update({ status: 'paused' }).eq('client_id', client_id).eq('agency_id', agency_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Delete ──
    if (action === 'delete') {
      const { client_id } = body
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
      const { error } = await sb.from('koto_front_desk_configs').delete().eq('client_id', client_id).eq('agency_id', agency_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Seed TSAWC test data ──
    if (action === 'seed_tsawc') {
      const { client_id } = body
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })

      const tsawcConfig = {
        agency_id,
        client_id,
        company_name: 'The Spine and Wellness Center',
        industry: 'Chiropractic / Healthcare',
        address: '5675 Coral Ridge Dr, Coral Springs, FL 33076',
        phone: '(954) 341-2256',
        website: 'https://www.tsawc.com',
        timezone: 'America/New_York',
        business_hours: {
          monday: { open: '09:00', close: '19:00' },
          tuesday: { open: '09:00', close: '19:00' },
          wednesday: { open: '15:00', close: '19:00' },
          thursday: { open: '09:00', close: '19:00' },
          friday: { open: '09:00', close: '12:00' },
          saturday: null,
          sunday: null,
        },
        services: [
          'Chiropractic Adjustments',
          'Physical Therapy',
          'Massage Therapy',
          'Stretching Therapy',
          'Acupuncture',
          'Red Light Therapy (SPECTRA S10)',
          'Acoustic Shockwave Therapy',
          'Cryotherapy Sub Zero',
          'Cold Laser Therapy',
          'Exercise with Oxygen Therapy',
          'PEMF Therapy',
          'BrainTap Therapy',
          'Graston Technique',
          'Cupping Therapy',
          'Sports Injury Rehabilitation',
          'NuOla Medical Weight Loss',
          'Back Pain Treatment',
          'Neck Pain Treatment',
          'Headache Treatment',
          'Car Accident Injury Treatment',
          'Herniated Disc Treatment',
          'Whiplash Treatment',
          'Posture Correction',
        ],
        insurance_accepted: [
          'Most major medical insurance plans',
        ],
        scheduling_link: 'https://www.tsawc.com/contact-us/',
        scheduling_department_name: 'Rachel',
        scheduling_department_phone: '(954) 341-2256',
        staff_directory: [
          { name: 'Dr. Jared Cohen', role: 'Chiropractor / Owner' },
          { name: 'Rachel', role: 'Scheduling Department' },
        ],
        custom_greeting: '{greeting}, it\'s a great day at The Spine and Wellness Center! How can I help you?',
        custom_instructions: 'This practice has been serving the Coral Springs and Parkland community since 2005. They specialize in back pain, neck pain, sciatica, sports injuries, and car accident injuries. Same-day appointments are available. If a caller mentions a car accident, emphasize that they should be seen as soon as possible and offer a same-day appointment.',
        hipaa_mode: true,
        emergency_keywords: ['emergency', 'urgent', 'severe pain', 'can\'t move', 'accident', 'numbness', 'tingling'],
        voicemail_enabled: true,
        transfer_enabled: true,
        sms_enabled: true,
        recording_enabled: true,
        voice_name: 'Nicole',
        status: 'active',
      }

      const { data: existing } = await sb.from('koto_front_desk_configs').select('id').eq('client_id', client_id).eq('agency_id', agency_id).maybeSingle()
      let result
      if (existing) {
        result = await sb.from('koto_front_desk_configs').update(tsawcConfig).eq('id', existing.id).select().single()
      } else {
        result = await sb.from('koto_front_desk_configs').insert(tsawcConfig).select().single()
      }

      if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
      return NextResponse.json({ config: result.data, seeded: true })
    }

    // ── AI Scan: scrape website + GMB and auto-populate fields ──
    if (action === 'ai_scan') {
      const { client_id, website, business_name } = body
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
      if (!website && !business_name) return NextResponse.json({ error: 'Need website or business_name to scan' }, { status: 400 })

      const results: Record<string, any> = {}

      // 1. Scrape the website
      let websiteText = ''
      if (website) {
        try {
          const url = website.startsWith('http') ? website : `https://${website}`
          const pages = [url, `${url}/services`, `${url}/about`, `${url}/contact`, `${url}/insurance`]
          const fetches = await Promise.allSettled(pages.map(async (p) => {
            const r = await fetch(p, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'KotoBot/1.0' } })
            if (!r.ok) return ''
            const html = await r.text()
            // Strip HTML tags, scripts, styles
            return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
          }))
          websiteText = fetches.filter(f => f.status === 'fulfilled').map(f => (f as any).value).filter(Boolean).join('\n\n---PAGE---\n\n').slice(0, 30000)
        } catch {}
      }

      // 2. Google Places lookup
      let placesData: any = null
      const PLACES_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_API_KEY || ''
      if (PLACES_KEY && (business_name || website)) {
        try {
          const query = business_name || website.replace(/https?:\/\/(www\.)?/, '').replace(/\/$/, '')
          const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': PLACES_KEY, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.regularOpeningHours,places.types,places.internationalPhoneNumber,places.websiteUri' },
            body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
            signal: AbortSignal.timeout(8000),
          })
          const pd = await placesRes.json()
          placesData = pd.places?.[0] || null
        } catch {}
      }

      // 3. Build GMB hours if available
      if (placesData?.regularOpeningHours?.periods) {
        const dayMap: Record<number, string> = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' }
        const hours: Record<string, any> = {}
        for (const p of placesData.regularOpeningHours.periods) {
          const day = dayMap[p.open?.day]
          if (day) {
            const openH = String(p.open.hour || 0).padStart(2, '0')
            const openM = String(p.open.minute || 0).padStart(2, '0')
            const closeH = String(p.close?.hour || 17).padStart(2, '0')
            const closeM = String(p.close?.minute || 0).padStart(2, '0')
            hours[day] = { open: `${openH}:${openM}`, close: `${closeH}:${closeM}` }
          }
        }
        // Fill in closed days
        for (const d of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
          if (!hours[d]) hours[d] = null
        }
        results.business_hours = hours
      }

      if (placesData?.formattedAddress) results.address = placesData.formattedAddress
      if (placesData?.internationalPhoneNumber) results.phone = placesData.internationalPhoneNumber
      if (placesData?.displayName?.text) results.company_name = placesData.displayName.text

      // 4. Use Claude to extract structured data from website text
      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
      if (ANTHROPIC_KEY && websiteText.length > 100) {
        try {
          const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 2000,
              messages: [{ role: 'user', content: `Extract structured business information from this website content. Return ONLY valid JSON with these fields (omit any field you can't find):

{
  "company_name": "exact business name",
  "industry": "brief industry description",
  "address": "full address",
  "phone": "phone number",
  "services": ["service 1", "service 2", ...],
  "insurance_accepted": ["insurance 1", ...],
  "scheduling_link": "URL for online scheduling if found",
  "staff_names": [{"name": "Name", "role": "Role"}],
  "business_description": "2-3 sentence description of what this business does",
  "custom_instructions": "any special notes a receptionist should know (specialties, same-day appointments, etc.)"
}

Website content:
${websiteText.slice(0, 20000)}` }],
            }),
            signal: AbortSignal.timeout(30000),
          })
          const aiData = await aiRes.json()
          const text = aiData.content?.[0]?.text || ''
          // Extract JSON from response
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (parsed.company_name && !results.company_name) results.company_name = parsed.company_name
            if (parsed.industry) results.industry = parsed.industry
            if (parsed.address && !results.address) results.address = parsed.address
            if (parsed.phone && !results.phone) results.phone = parsed.phone
            if (parsed.services?.length) results.services = parsed.services
            if (parsed.insurance_accepted?.length) results.insurance_accepted = parsed.insurance_accepted
            if (parsed.scheduling_link) results.scheduling_link = parsed.scheduling_link
            if (parsed.staff_names?.length) results.staff_directory = parsed.staff_names
            if (parsed.custom_instructions) results.custom_instructions = parsed.custom_instructions
            if (parsed.business_description) {
              results.custom_instructions = [parsed.business_description, parsed.custom_instructions].filter(Boolean).join('\n\n')
            }
          }
        } catch {}
      }

      // 5. Save to config if it exists, or return for preview
      const { data: existing } = await sb.from('koto_front_desk_configs').select('id').eq('client_id', client_id).eq('agency_id', agency_id).maybeSingle()
      if (existing && Object.keys(results).length > 0) {
        await sb.from('koto_front_desk_configs').update({ ...results, website: website || undefined }).eq('id', existing.id)
      }

      return NextResponse.json({
        scanned: true,
        fields_found: Object.keys(results),
        results,
        sources: { website: !!websiteText, gmb: !!placesData },
      })
    }

    // ── Log a call ──
    if (action === 'log_call') {
      const {
        client_id, config_id, retell_call_id, caller_phone, caller_name,
        direction, duration_seconds, outcome, transfer_to, transfer_accepted,
        sentiment, transcript, ai_summary, recording_url,
        voicemail, voicemail_url, voicemail_transcript,
        links_sent, ghl_synced,
      } = body
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })

      const { data, error } = await sb.from('koto_front_desk_calls').insert({
        agency_id, client_id, config_id, retell_call_id, caller_phone, caller_name,
        direction: direction || 'inbound',
        duration_seconds: duration_seconds || 0,
        outcome: outcome || 'answered',
        transfer_to, transfer_accepted,
        sentiment: sentiment || 'neutral',
        transcript, ai_summary, recording_url,
        voicemail: voicemail ?? false,
        voicemail_url, voicemail_transcript,
        links_sent: links_sent || [],
        ghl_synced: ghl_synced ?? false,
      }).select().single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Increment counters on the config
      if (config_id) {
        const increments: Record<string, any> = { total_calls: 1 }
        // We use raw rpc or manual increment; supabase-js doesn't have .increment()
        // so we fetch current values and update
        const { data: cfg } = await sb.from('koto_front_desk_configs').select('total_calls, total_appointments, total_transfers').eq('id', config_id).maybeSingle()
        if (cfg) {
          const updates: Record<string, any> = { total_calls: (cfg.total_calls || 0) + 1 }
          if (outcome === 'appointment') updates.total_appointments = (cfg.total_appointments || 0) + 1
          if (outcome === 'transferred') updates.total_transfers = (cfg.total_transfers || 0) + 1
          await sb.from('koto_front_desk_configs').update(updates).eq('id', config_id)
        }
      }

      return NextResponse.json({ call: data })
    }

    // ── Update voicemail / transfer settings ──
    if (action === 'update_voicemail_settings') {
      const { client_id, voicemail_greeting, voicemail_max_seconds, transfer_timeout_seconds, transfer_announce_template } = body
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })

      const update: Record<string, any> = {}
      if (voicemail_greeting !== undefined) update.voicemail_greeting = voicemail_greeting
      if (voicemail_max_seconds !== undefined) update.voicemail_max_seconds = voicemail_max_seconds
      if (transfer_timeout_seconds !== undefined) update.transfer_timeout_seconds = transfer_timeout_seconds
      if (transfer_announce_template !== undefined) update.transfer_announce_template = transfer_announce_template

      const { error } = await sb.from('koto_front_desk_configs').update(update).eq('client_id', client_id).eq('agency_id', agency_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Client-facing: save editable fields only ──
    if (action === 'client_save') {
      const { client_id, ...fields } = body
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })

      const { data: existing } = await sb.from('koto_front_desk_configs').select('id, allow_client_editing').eq('client_id', client_id).maybeSingle()
      if (!existing) return NextResponse.json({ error: 'No front desk config found' }, { status: 404 })
      if (!existing.allow_client_editing) return NextResponse.json({ error: 'Editing is not enabled for this account. Contact your agency to request changes.' }, { status: 403 })

      // Clients can only edit safe fields — not status, HIPAA, recording, or agency settings
      const update: Record<string, any> = {}
      const safe = ['company_name', 'address', 'phone', 'website', 'business_hours', 'services', 'insurance_accepted', 'scheduling_link', 'scheduling_department_name', 'scheduling_department_phone', 'staff_directory', 'custom_greeting']
      for (const k of safe) { if (fields[k] !== undefined) update[k] = fields[k] }

      const { error } = await sb.from('koto_front_desk_configs').update(update).eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Provision a Retell phone number + agent ──
    if (action === 'provision_number') {
      const { client_id, area_code = '954' } = body
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })

      const RETELL_KEY = process.env.RETELL_API_KEY || ''
      if (!RETELL_KEY) return NextResponse.json({ error: 'RETELL_API_KEY not configured' }, { status: 500 })
      const retellHeaders = { 'Authorization': `Bearer ${RETELL_KEY}`, 'Content-Type': 'application/json' }

      // Fetch the config for this client
      const { data: cfg } = await sb.from('koto_front_desk_configs').select('*').eq('client_id', client_id).eq('agency_id', agency_id).maybeSingle()
      if (!cfg) return NextResponse.json({ error: 'No front desk config found for this client' }, { status: 404 })

      // 1. Build the prompt
      const prompt = await buildFrontDeskPromptForClient(client_id)
      if (!prompt) return NextResponse.json({ error: 'Could not build prompt for client' }, { status: 500 })

      // 2. Create the Retell agent
      const agentRes = await fetch('https://api.retellai.com/create-agent', {
        method: 'POST',
        headers: retellHeaders,
        body: JSON.stringify({
          response_engine: { type: 'retell-llm', llm_id: '' },
          agent_name: `Front Desk - ${cfg.company_name || client_id}`,
          voice_id: cfg.voice_id || '11labs-Nicole',
          enable_backchannel: true,
          begin_message: cfg.custom_greeting
            ? cfg.custom_greeting.replace(/\{greeting\}/gi, 'Hello').replace(/\{company\}/gi, cfg.company_name || 'our office')
            : `Hello, it's a great day at ${cfg.company_name || 'our office'}! How can I help you?`,
          general_prompt: prompt,
          ...(cfg.scheduling_department_phone ? {
            transfer_list: { scheduling: { transfer_to: cfg.scheduling_department_phone, description: 'Transfer to scheduling department' } }
          } : {}),
        }),
      })
      if (!agentRes.ok) {
        const err = await agentRes.text()
        return NextResponse.json({ error: `Failed to create Retell agent: ${err}` }, { status: 500 })
      }
      const agentData = await agentRes.json()
      const agent_id = agentData.agent_id

      // 3. Provision the phone number
      const phoneRes = await fetch('https://api.retellai.com/create-phone-number', {
        method: 'POST',
        headers: retellHeaders,
        body: JSON.stringify({ area_code }),
      })
      if (!phoneRes.ok) {
        const err = await phoneRes.text()
        return NextResponse.json({ error: `Failed to provision phone number: ${err}` }, { status: 500 })
      }
      const phoneData = await phoneRes.json()
      const phone_number = phoneData.phone_number

      // 4. Link the phone number to the agent
      const linkRes = await fetch(`https://api.retellai.com/update-phone-number/${phone_number}`, {
        method: 'PATCH',
        headers: retellHeaders,
        body: JSON.stringify({ agent_id }),
      })
      if (!linkRes.ok) {
        const err = await linkRes.text()
        return NextResponse.json({ error: `Failed to link phone to agent: ${err}` }, { status: 500 })
      }

      // 5. Save to config
      const { error: updateErr } = await sb.from('koto_front_desk_configs')
        .update({ retell_agent_id: agent_id, retell_phone_number: phone_number })
        .eq('client_id', client_id).eq('agency_id', agency_id)
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

      return NextResponse.json({ phone_number, agent_id })
    }

    // ── Release a Retell phone number ──
    if (action === 'release_number') {
      const { client_id } = body
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })

      const RETELL_KEY = process.env.RETELL_API_KEY || ''
      if (!RETELL_KEY) return NextResponse.json({ error: 'RETELL_API_KEY not configured' }, { status: 500 })
      const retellHeaders = { 'Authorization': `Bearer ${RETELL_KEY}`, 'Content-Type': 'application/json' }

      const { data: cfg } = await sb.from('koto_front_desk_configs').select('retell_phone_number, retell_agent_id').eq('client_id', client_id).eq('agency_id', agency_id).maybeSingle()
      if (!cfg?.retell_phone_number) return NextResponse.json({ error: 'No phone number provisioned for this client' }, { status: 404 })

      // Delete the phone number from Retell
      const delRes = await fetch(`https://api.retellai.com/delete-phone-number/${cfg.retell_phone_number}`, {
        method: 'DELETE',
        headers: retellHeaders,
      })
      if (!delRes.ok) {
        const err = await delRes.text()
        return NextResponse.json({ error: `Failed to release phone number: ${err}` }, { status: 500 })
      }

      // Clear from config
      const { error: updateErr } = await sb.from('koto_front_desk_configs')
        .update({ retell_phone_number: null, retell_agent_id: null })
        .eq('client_id', client_id).eq('agency_id', agency_id)
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

      return NextResponse.json({ ok: true })
    }

    // ── Update / re-sync Retell agent config ──
    if (action === 'update_agent') {
      const { client_id } = body
      if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })

      const RETELL_KEY = process.env.RETELL_API_KEY || ''
      if (!RETELL_KEY) return NextResponse.json({ error: 'RETELL_API_KEY not configured' }, { status: 500 })
      const retellHeaders = { 'Authorization': `Bearer ${RETELL_KEY}`, 'Content-Type': 'application/json' }

      const { data: cfg } = await sb.from('koto_front_desk_configs').select('*').eq('client_id', client_id).eq('agency_id', agency_id).maybeSingle()
      if (!cfg?.retell_agent_id) return NextResponse.json({ error: 'No Retell agent found for this client' }, { status: 404 })

      const prompt = await buildFrontDeskPromptForClient(client_id)
      if (!prompt) return NextResponse.json({ error: 'Could not build prompt for client' }, { status: 500 })

      const patchRes = await fetch(`https://api.retellai.com/update-agent/${cfg.retell_agent_id}`, {
        method: 'PATCH',
        headers: retellHeaders,
        body: JSON.stringify({
          voice_id: cfg.voice_id || '11labs-Nicole',
          enable_backchannel: true,
          begin_message: cfg.custom_greeting
            ? cfg.custom_greeting.replace(/\{greeting\}/gi, 'Hello').replace(/\{company\}/gi, cfg.company_name || 'our office')
            : `Hello, it's a great day at ${cfg.company_name || 'our office'}! How can I help you?`,
          general_prompt: prompt,
          ...(cfg.scheduling_department_phone ? {
            transfer_list: { scheduling: { transfer_to: cfg.scheduling_department_phone, description: 'Transfer to scheduling department' } }
          } : {}),
        }),
      })
      if (!patchRes.ok) {
        const err = await patchRes.text()
        return NextResponse.json({ error: `Failed to update Retell agent: ${err}` }, { status: 500 })
      }

      return NextResponse.json({ ok: true, agent_id: cfg.retell_agent_id })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
