import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '../../../lib/apiAuth'
import { buildFrontDeskPrompt, type FrontDeskConfig } from '../../../lib/frontDeskPromptBuilder'

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

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
