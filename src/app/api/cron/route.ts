import { NextRequest } from 'next/server'
import { processSequenceQueue } from '@/lib/emailSequenceEngine'
import { runDecayUpdate } from '@/lib/leadDecayEngine'
import { updateTimingIntelligence } from '@/lib/predictiveDialing'
import { generateDailyDebrief } from '@/lib/debriefEmailEngine'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const job = searchParams.get('job') || ''
  const secret = searchParams.get('secret') || ''

  // Verify cron secret (skip in dev)
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (job === 'sequence_queue') {
      const result = await processSequenceQueue()
      return Response.json({ success: true, job: 'sequence_queue', ...result })
    }

    if (job === 'decay_update') {
      const s = sb()
      const { data: agencies } = await s.from('agencies').select('id').is('deleted_at', null).limit(50)
      const results: any[] = []
      for (const agency of agencies || []) {
        const counts = await runDecayUpdate(agency.id)
        results.push({ agency_id: agency.id, ...counts })
      }
      return Response.json({ success: true, job: 'decay_update', agencies: results.length, results })
    }

    if (job === 'debrief_emails') {
      const s = sb()
      const { data: agencies } = await s.from('agencies').select('id').is('deleted_at', null).limit(50)
      let sent = 0
      for (const agency of agencies || []) {
        const html = await generateDailyDebrief(agency.id, new Date())
        if (html) sent++
      }
      return Response.json({ success: true, job: 'debrief_emails', sent })
    }

    if (job === 'timing_update') {
      return Response.json({ success: true, job: 'timing_update', message: 'Timing updates happen on each call via webhook' })
    }

    if (job === 'score_leads') {
      return Response.json({ success: true, job: 'score_leads', message: 'Lead scoring runs on campaign start' })
    }

    return Response.json({ error: `Unknown job: ${job}` }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message, job }, { status: 500 })
  }
}
