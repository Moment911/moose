import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createVideoVoicemail, checkVideoStatus, sendVideoEmail, listHeyGenAvatars } from '@/lib/heygenVideoEngine'

const HEYGEN_API = 'https://api.heygen.com'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'list'
    const agencyId = searchParams.get('agency_id') || ''
    const s = sb()

    if (action === 'list') {
      const { data } = await s.from('koto_video_voicemails').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(50)
      return Response.json({ data: data || [] })
    }

    if (action === 'get') {
      const id = searchParams.get('id') || ''
      const { data } = await s.from('koto_video_voicemails').select('*').eq('id', id).single()
      return Response.json({ data })
    }

    if (action === 'check_status') {
      const id = searchParams.get('id') || ''
      const result = await checkVideoStatus(id)
      return Response.json(result)
    }

    if (action === 'get_avatars') {
      const avatars = await listHeyGenAvatars()
      return Response.json({ data: avatars })
    }

    if (action === 'get_all_avatars') {
      // Return ALL avatars with pagination
      const page = parseInt(searchParams.get('page') || '0')
      const gender = searchParams.get('gender') || ''
      const search = searchParams.get('search') || ''
      const perPage = 24

      try {
        const res = await fetch(`${HEYGEN_API}/v2/avatars`, {
          headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY || '' },
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) return Response.json({ data: [], total: 0 })
        const raw = await res.json()
        let avatars = raw.data?.avatars || []

        // Filter
        if (gender) avatars = avatars.filter((a: any) => a.gender === gender)
        if (search) {
          const q = search.toLowerCase()
          avatars = avatars.filter((a: any) => a.avatar_name?.toLowerCase().includes(q))
        }

        const total = avatars.length
        const sliced = avatars.slice(page * perPage, (page + 1) * perPage)

        return Response.json({
          data: sliced.map((a: any) => ({
            avatar_id: a.avatar_id, avatar_name: a.avatar_name, gender: a.gender,
            preview_image_url: a.preview_image_url, preview_video_url: a.preview_video_url,
          })),
          total,
          page,
          pages: Math.ceil(total / perPage),
        })
      } catch { return Response.json({ data: [], total: 0 }) }
    }

    if (action === 'get_stats') {
      const [{ count: total }, { count: sent }, { count: opened }, { count: played }] = await Promise.all([
        s.from('koto_video_voicemails').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId),
        s.from('koto_video_voicemails').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('email_sent', true),
        s.from('koto_video_voicemails').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('email_opened', true),
        s.from('koto_video_voicemails').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('video_played', true),
      ])
      return Response.json({ total: total || 0, sent: sent || 0, opened: opened || 0, played: played || 0 })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action

    if (action === 'create') {
      const { lead, agency_id, avatar_id, voice_id, custom_script, email_to } = body
      if (!lead && !body.lead_id) return Response.json({ error: 'lead or lead_id required' }, { status: 400 })

      let leadData = lead
      if (body.lead_id && !lead) {
        const s = sb()
        const { data } = await s.from('koto_voice_leads').select('*').eq('id', body.lead_id).single()
        leadData = data
      }

      const vmId = await createVideoVoicemail(leadData, agency_id, { avatarId: avatar_id, voiceId: voice_id, customScript: custom_script, emailTo: email_to })
      return Response.json({ success: !!vmId, vm_id: vmId })
    }

    if (action === 'send_email') {
      const sent = await sendVideoEmail(body.vm_id)
      return Response.json({ success: sent })
    }

    if (action === 'check_and_send') {
      // Check status, if ready send email
      const status = await checkVideoStatus(body.vm_id)
      if (status.status === 'completed') {
        const sent = await sendVideoEmail(body.vm_id)
        return Response.json({ success: true, video_ready: true, email_sent: sent })
      }
      return Response.json({ success: true, video_ready: false, status: status.status })
    }

    if (action === 'set_default_avatar') {
      const { agency_id, avatar_id, avatar_name } = body
      const s = sb()
      await s.from('koto_video_avatars').update({ is_default: false }).eq('agency_id', agency_id).eq('is_default', true)
      const { data: ex } = await s.from('koto_video_avatars').select('id').eq('heygen_avatar_id', avatar_id).eq('agency_id', agency_id).maybeSingle()
      if (ex) { await s.from('koto_video_avatars').update({ is_default: true }).eq('id', ex.id) }
      else { await s.from('koto_video_avatars').insert({ agency_id, avatar_name: avatar_name || 'Avatar', heygen_avatar_id: avatar_id, heygen_voice_id: '', is_default: true }) }
      return Response.json({ success: true })
    }

    if (action === 'generate_script') {
      const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
      if (!apiKey) return Response.json({ script: 'AI not configured' })
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 300,
            messages: [{ role: 'user', content: `Write a 15-20 second video voicemail script based on this:\n\n${body.prompt}\n\nRules: Under 60 words. Casual warm tone. End with CTA to check email. Sound natural. Return ONLY the script.` }],
          }),
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return Response.json({ script: 'Generation failed' })
        const data = await res.json()
        return Response.json({ script: data.content?.[0]?.text?.trim() || 'Could not generate' })
      } catch { return Response.json({ script: 'Generation failed' }) }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
