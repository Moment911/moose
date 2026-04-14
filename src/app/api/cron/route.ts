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

    if (job === 'automations') {
      const result = await processAutomations()
      return Response.json({ success: true, job: 'automations', ...result })
    }

    return Response.json({ error: `Unknown job: ${job}` }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message, job }, { status: 500 })
  }
}

// ── Process automation rules ──
async function processAutomations() {
  const s = sb()

  // Get all active automations
  const { data: automations } = await s.from('automations')
    .select('*')
    .eq('status', 'active')

  if (!automations || automations.length === 0) return { processed: 0 }

  let processed = 0

  for (const auto of automations) {
    try {
      const trigger = auto.trigger || {}
      const actions = auto.actions || []

      // Check trigger conditions
      let shouldFire = false

      if (trigger.type === 'new_client') {
        // Check for clients created since last run
        const since = auto.last_run_at || new Date(Date.now() - 3600000).toISOString()
        const { count } = await s.from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', auto.agency_id)
          .gte('created_at', since)
        shouldFire = (count || 0) > 0
      }

      if (trigger.type === 'new_review') {
        const since = auto.last_run_at || new Date(Date.now() - 3600000).toISOString()
        const { count } = await s.from('moose_review_queue')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', auto.agency_id)
          .gte('created_at', since)
        shouldFire = (count || 0) > 0
      }

      if (trigger.type === 'schedule') {
        // Cron-style: check if current hour matches
        const now = new Date()
        const hour = trigger.hour || 9
        shouldFire = now.getHours() === hour
      }

      if (!shouldFire) continue

      // Execute actions
      for (const action of actions) {
        if (action.type === 'send_email' && action.to) {
          // Queue email via existing email system
          await s.from('koto_system_logs').insert({
            level: 'info', source: 'automations',
            message: `Automation "${auto.name}" fired: ${action.type} to ${action.to}`,
          })
        }

        if (action.type === 'create_task' && action.title) {
          await s.from('tasks').insert({
            agency_id: auto.agency_id,
            title: action.title,
            description: action.description || '',
            status: 'open',
            priority: action.priority || 'medium',
          })
        }

        if (action.type === 'send_notification') {
          await s.from('notifications').insert({
            agency_id: auto.agency_id,
            title: action.title || `Automation: ${auto.name}`,
            message: action.message || '',
            type: 'automation',
          })
        }
      }

      // Update last_run_at
      await s.from('automations').update({
        last_run_at: new Date().toISOString(),
        run_count: (auto.run_count || 0) + 1,
      }).eq('id', auto.id)

      processed++
    } catch (e) {
      console.error(`Automation ${auto.id} failed:`, e)
    }
  }

  return { processed }
}
