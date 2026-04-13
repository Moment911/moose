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
    const agency_id = await resolveAgencyId(req)
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
    const agency_id = await resolveAgencyId(req)
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

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
