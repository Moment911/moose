// Standalone call detail page. Deep-linked from the notification email + SMS.
// Server component that fetches the call + its agent/agency context, then hands
// off to a client wrapper that reuses the same panel from the Call Log tab.
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CallDetailPage from './CallDetailPage'

export const dynamic = 'force-dynamic'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

function normalize(row: any) {
  if (!row) return row
  const recording = row.recording_archive_url || row.recording_url || null
  return {
    ...row,
    date: row.created_at || row.date || null,
    duration: row.duration_seconds ?? row.duration ?? 0,
    caller_name: row.caller_name || row.caller_details?.caller_name || null,
    caller_number: row.caller_number || row.caller_phone || row.from_number || null,
    callback_number: row.caller_details?.callback_number || row.caller_number || row.caller_phone || null,
    ai_summary: row.ai_summary || row.summary || '',
    summary: row.summary || row.ai_summary || '',
    intake_data: row.caller_details || row.intake_data || {},
    caller_details: row.caller_details || row.intake_data || {},
    recording_url: recording,
    recording_archive_url: row.recording_archive_url || null,
    summary_audio_url: row.summary_audio_url || null,
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = sb()

  const [{ data: callRow }, { data: intakesData }] = await Promise.all([
    supabase.from('koto_inbound_calls').select('*').eq('id', id).maybeSingle(),
    supabase.from('koto_inbound_intakes').select('*').eq('call_id', id),
  ])
  if (!callRow) notFound()

  let agent: any = null
  if (callRow.agent_id) {
    const { data } = await supabase.from('koto_inbound_agents').select('id, name, business_name, department').eq('id', callRow.agent_id).maybeSingle()
    agent = data
  }

  return <CallDetailPage call={normalize(callRow)} intakes={intakesData || []} agent={agent} />
}
