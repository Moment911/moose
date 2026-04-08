import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createVideoVoicemail, checkVideoStatus, sendVideoEmail, listHeyGenAvatars } from '@/lib/heygenVideoEngine'

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

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
