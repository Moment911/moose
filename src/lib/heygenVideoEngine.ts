// ── HeyGen Video Voicemail Engine ────────────────────────────────────────────
// Generates personalized video voicemails using HeyGen AI avatars.

import { createClient } from '@supabase/supabase-js'
import { generateVideoScript } from './videoScriptGenerator'

const HEYGEN_API = 'https://api.heygen.com'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

function getHeaders(): Record<string, string> {
  return { 'X-Api-Key': process.env.HEYGEN_API_KEY || '', 'Content-Type': 'application/json' }
}

// Default avatars (seeded from real HeyGen API)
const DEFAULT_AVATARS = [
  { avatar_id: 'Abigail_expressive_2024112501', name: 'Abigail', gender: 'female', voice_id: 'f8c69e517f424cafaecde32dde57096b' },
  { avatar_id: 'Brandon_expressive2_public', name: 'Brandon', gender: 'male', voice_id: 'f38a635bee7a4d1f9b0a654a31d050d2' },
  { avatar_id: 'Annie_expressive10_public', name: 'Annie', gender: 'female', voice_id: 'cef3bc4e0a84424cafcde6f2cf466c97' },
]

// ── Create Video Voicemail ───────────────────────────────────────────────────

export async function createVideoVoicemail(
  lead: any,
  agencyId: string,
  options?: { avatarId?: string; voiceId?: string; customScript?: string; emailTo?: string }
): Promise<string | null> {
  const sb = getSupabase()

  // Get avatar
  let avatar = DEFAULT_AVATARS[0]
  if (options?.avatarId) {
    const { data: customAvatar } = await sb.from('koto_video_avatars').select('*').eq('heygen_avatar_id', options.avatarId).maybeSingle()
    if (customAvatar) avatar = { avatar_id: customAvatar.heygen_avatar_id, name: customAvatar.avatar_name, gender: customAvatar.avatar_gender || 'female', voice_id: customAvatar.heygen_voice_id }
  }

  // Generate script
  const script = options?.customScript || await generateVideoScript(lead)

  // Create DB record
  const { data: vmRecord } = await sb.from('koto_video_voicemails').insert({
    agency_id: agencyId,
    lead_id: lead.id || null,
    prospect_name: lead.prospect_name || lead.business_name || '',
    prospect_first_name: lead.prospect_first_name || lead.prospect_name?.split(' ')[0] || '',
    business_name: lead.business_name || lead.prospect_company || '',
    industry_name: lead.industry_name || '',
    city: lead.city || '',
    state: lead.state || '',
    pain_point: lead.prospect_pain_point || lead.pain_point || '',
    google_rating: lead.google_rating || null,
    review_count: lead.google_review_count || lead.review_count || null,
    video_script: script,
    avatar_id: avatar.avatar_id,
    avatar_name: avatar.name,
    voice_id: options?.voiceId || avatar.voice_id,
    email_to: options?.emailTo || lead.prospect_email || lead.email || '',
    status: 'generating',
  }).select('id').single()

  if (!vmRecord) return null

  // Submit to HeyGen
  try {
    const res = await fetch(`${HEYGEN_API}/v2/video/generate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: avatar.avatar_id,
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: options?.voiceId || avatar.voice_id,
            speed: 1.0,
          },
          background: {
            type: 'color',
            value: '#ffffff',
          },
        }],
        dimension: { width: 720, height: 720 },
        aspect_ratio: '1:1',
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const err = await res.text()
      await sb.from('koto_video_voicemails').update({ status: 'failed', error_message: err }).eq('id', vmRecord.id)
      return null
    }

    const data = await res.json()
    const videoId = data.data?.video_id

    if (videoId) {
      await sb.from('koto_video_voicemails').update({
        heygen_video_id: videoId,
        heygen_status: 'processing',
        status: 'processing',
      }).eq('id', vmRecord.id)
    }

    return vmRecord.id
  } catch (e: any) {
    await sb.from('koto_video_voicemails').update({ status: 'failed', error_message: e.message }).eq('id', vmRecord.id)
    return null
  }
}

// ── Check Video Status ───────────────────────────────────────────────────────

export async function checkVideoStatus(vmId: string): Promise<{ status: string; videoUrl?: string; thumbnailUrl?: string }> {
  const sb = getSupabase()
  const { data: vm } = await sb.from('koto_video_voicemails').select('heygen_video_id, heygen_status').eq('id', vmId).single()
  if (!vm?.heygen_video_id) return { status: 'unknown' }

  try {
    const res = await fetch(`${HEYGEN_API}/v1/video_status.get?video_id=${vm.heygen_video_id}`, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return { status: 'error' }
    const data = await res.json()
    const status = data.data?.status || 'processing'
    const videoUrl = data.data?.video_url
    const thumbnailUrl = data.data?.thumbnail_url

    if (status === 'completed' && videoUrl) {
      await sb.from('koto_video_voicemails').update({
        heygen_status: 'completed',
        heygen_video_url: videoUrl,
        heygen_thumbnail_url: thumbnailUrl,
        video_duration_seconds: data.data?.duration || null,
        status: 'ready',
      }).eq('id', vmId)
    } else if (status === 'failed') {
      await sb.from('koto_video_voicemails').update({
        heygen_status: 'failed',
        status: 'failed',
        error_message: data.data?.error || 'HeyGen rendering failed',
      }).eq('id', vmId)
    }

    return { status, videoUrl, thumbnailUrl }
  } catch {
    return { status: 'error' }
  }
}

// ── Send Video Email ─────────────────────────────────────────────────────────

export async function sendVideoEmail(vmId: string): Promise<boolean> {
  const sb = getSupabase()
  const { data: vm } = await sb.from('koto_video_voicemails').select('*').eq('id', vmId).single()

  if (!vm || !vm.email_to || !vm.heygen_video_url) return false

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const firstName = vm.prospect_first_name || 'there'
  const landingUrl = `https://hellokoto.com/v/${vmId}`
  const subject = `${firstName}, I made this quick video for you`

  const html = `
<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <p style="font-size:15px;color:#111;margin:0 0 16px;">Hey ${firstName},</p>
  <p style="font-size:15px;color:#333;margin:0 0 20px;">I tried reaching you about ${vm.business_name || 'your business'} and wanted to leave you a quick personal message instead.</p>
  <a href="${landingUrl}" style="display:block;text-decoration:none;margin:0 0 20px;">
    <div style="position:relative;border-radius:12px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);">
      ${vm.heygen_thumbnail_url ? `<img src="${vm.heygen_thumbnail_url}" alt="Video message" style="width:100%;display:block;" />` : '<div style="background:#F5F5F5;height:320px;display:flex;align-items:center;justify-content:center;font-size:48px;">&#9654;</div>'}
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:64px;height:64px;border-radius:50%;background:rgba(230,0,126,0.9);display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:24px;margin-left:4px;">&#9654;</span>
      </div>
    </div>
  </a>
  <a href="${landingUrl}" style="display:inline-block;padding:12px 28px;background:#E6007E;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Watch My Message</a>
  <p style="font-size:13px;color:#999;margin:20px 0 0;">This video was made just for you. Click to watch (15 seconds).</p>
</div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Koto <video@hellokoto.com>', to: [vm.email_to], subject, html }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return false
    const emailData = await res.json()

    await sb.from('koto_video_voicemails').update({
      email_sent: true,
      email_subject: subject,
      resend_message_id: emailData.id || null,
      email_sent_at: new Date().toISOString(),
      status: 'sent',
    }).eq('id', vmId)

    return true
  } catch { return false }
}

// ── List Avatars ─────────────────────────────────────────────────────────────

export async function listHeyGenAvatars(): Promise<any[]> {
  try {
    const res = await fetch(`${HEYGEN_API}/v2/avatars`, { headers: getHeaders(), signal: AbortSignal.timeout(10000) })
    if (!res.ok) return DEFAULT_AVATARS
    const data = await res.json()
    const avatars = data.data?.avatars || []
    return avatars.filter((a: any) => a.avatar_name?.includes('Upper Body') || a.avatar_id?.includes('expressive')).slice(0, 20)
  } catch { return DEFAULT_AVATARS }
}
