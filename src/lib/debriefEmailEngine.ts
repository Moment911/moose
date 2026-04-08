// ── Daily Debrief Email Engine ────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { renderTemplate } from './emailSequenceEngine'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function generateDailyDebrief(agencyId: string, date: Date): Promise<string | null> {
  const sb = getSupabase()
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999)

  // Get today's calls
  const { data: calls } = await sb.from('koto_voice_calls')
    .select('*, koto_voice_leads(prospect_name, prospect_company, city, state, industry_sic_code, lead_score, prospect_pain_point)')
    .eq('agency_id', agencyId)
    .gte('created_at', dayStart.toISOString())
    .lte('created_at', dayEnd.toISOString())
    .order('created_at', { ascending: false })
    .limit(200)

  const totalCalls = calls?.length || 0
  if (totalCalls === 0) return null

  const appointments = (calls || []).filter(c => c.call_analysis?.call_successful || c.metadata?.appointment_set)
  const avgScore = totalCalls > 0 ? Math.round((calls || []).reduce((s, c) => {
    const lead = Array.isArray(c.koto_voice_leads) ? c.koto_voice_leads[0] : c.koto_voice_leads
    return s + (lead?.lead_score || 0)
  }, 0) / totalCalls) : 0

  const apptRate = totalCalls > 0 ? Math.round(appointments.length / totalCalls * 100) : 0

  // Get agency info
  const { data: agency } = await sb.from('agencies').select('name, owner_email').eq('id', agencyId).maybeSingle()
  if (!agency?.owner_email) return null

  // Build debrief content
  const apptDetails = appointments.slice(0, 5).map(a => {
    const lead = Array.isArray(a.koto_voice_leads) ? a.koto_voice_leads[0] : a.koto_voice_leads
    return {
      business_name: lead?.prospect_company || 'Unknown',
      owner_name: lead?.prospect_name || '',
      city: lead?.city || '', state: lead?.state || '',
      industry: lead?.industry_sic_code || '',
      lead_score: lead?.lead_score || 0,
      duration: `${Math.round((a.duration_seconds || 0) / 60)}m`,
      pain_point: lead?.prospect_pain_point || 'Not identified',
    }
  })

  // Build HTML
  const html = `<!DOCTYPE html><html><head><style>
body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;margin:0}
.c{max-width:680px;margin:0 auto;padding:24px}
.h{background:linear-gradient(135deg,#ea2729,#5bc6d0);padding:32px;border-radius:16px;margin-bottom:24px}
.h h1{margin:0;font-size:28px}.h p{margin:8px 0 0;opacity:0.8}
.sr{display:flex;gap:16px;margin-bottom:24px}
.sb{flex:1;background:#1a1a1a;border-radius:12px;padding:20px;text-align:center}
.sn{font-size:36px;font-weight:700;color:#ea2729}.sl{font-size:12px;color:#888;margin-top:4px}
.sec{background:#1a1a1a;border-radius:12px;padding:24px;margin-bottom:16px}
.sec h2{margin:0 0 16px;font-size:18px}
.ac{background:#0a0a0a;border-radius:8px;padding:16px;margin-bottom:12px;border-left:3px solid #22c55e}
.ft{text-align:center;color:#555;font-size:12px;padding-top:24px}
</style></head><body><div class="c">
<div class="h"><h1>Koto Daily Debrief</h1><p>${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
<div class="sr">
<div class="sb"><div class="sn">${totalCalls}</div><div class="sl">Calls Made</div></div>
<div class="sb"><div class="sn">${appointments.length}</div><div class="sl">Appointments</div></div>
<div class="sb"><div class="sn">${apptRate}%</div><div class="sl">Appt Rate</div></div>
<div class="sb"><div class="sn">${avgScore}</div><div class="sl">Avg Score</div></div>
</div>
${appointments.length > 0 ? `<div class="sec"><h2>Today's Appointments</h2>${apptDetails.map(a => `<div class="ac"><div style="font-weight:600;font-size:16px">${a.business_name}</div><div style="color:#888;font-size:13px;margin:4px 0">${a.city}, ${a.state} | Score: ${a.lead_score} | ${a.duration}</div><div style="color:#5bc6d0;font-size:13px;margin-top:8px">Pain: ${a.pain_point}</div></div>`).join('')}</div>` : ''}
<div class="ft"><p>Koto AI -- hellokoto.com</p></div>
</div></body></html>`

  // Send email
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Koto AI <debrief@hellokoto.com>',
        to: [agency.owner_email],
        subject: `Koto Debrief: ${appointments.length} appointments from ${totalCalls} calls`,
        html,
      }),
      signal: AbortSignal.timeout(10000),
    })
  }

  // Save to DB
  await sb.from('koto_debrief_emails').insert({
    agency_id: agencyId, sent_to: agency.owner_email, sent_at: new Date().toISOString(),
    date_covered: date.toISOString().split('T')[0],
    appointments_count: appointments.length, calls_count: totalCalls,
    email_html: html, status: 'sent',
  })

  return html
}
