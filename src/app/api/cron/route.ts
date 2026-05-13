import { NextRequest } from 'next/server'
import { processSequenceQueue } from '@/lib/emailSequenceEngine'
import { runDecayUpdate } from '@/lib/leadDecayEngine'
import { updateTimingIntelligence } from '@/lib/predictiveDialing'
import { generateDailyDebrief } from '@/lib/debriefEmailEngine'
import { generateMonthlyRecap } from '@/lib/monthlyRecapEngine'
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

    if (job === 'intel_scheduled_scans') {
      // Find all reports with a schedule that's due
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
      const dueRes = await fetch(`${APP_URL}/api/intel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_due_scans' }),
      }).then(r => r.json())
      let ran = 0
      for (const report of dueRes.due || []) {
        try {
          await fetch(`${APP_URL}/api/intel`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'rescan', report_id: report.id }),
          })
          ran++
        } catch { /* skip failed */ }
      }
      return Response.json({ success: true, job: 'intel_scheduled_scans', ran })
    }

    if (job === 'monthly_recap') {
      const s = sb()
      const { data: agencies } = await s.from('agencies').select('id').is('deleted_at', null).limit(50)
      let sent = 0
      for (const agency of agencies || []) {
        const { data: clients } = await s.from('clients').select('id').eq('agency_id', agency.id).is('deleted_at', null).limit(100)
        for (const client of clients || []) {
          const result = await generateMonthlyRecap(client.id, agency.id)
          if (result.sent) sent++
        }
      }
      return Response.json({ success: true, job: 'monthly_recap', sent })
    }

    if (job === 'check_gsc_indexation') {
      const result = await checkGSCIndexation()
      return Response.json({ success: true, job: 'check_gsc_indexation', ...result })
    }

    return Response.json({ error: `Unknown job: ${job}` }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message, job }, { status: 500 })
  }
}

// ── GSC Publish Watch — check indexation status for published pages ──
async function checkGSCIndexation() {
  const s = sb()

  // Get all pending watches (pages published but not yet indexed)
  const { data: watches } = await s.from('kotoiq_publish_watches')
    .select('*')
    .in('status', ['pending', 'submitted'])
    .limit(50)

  if (!watches?.length) return { checked: 0, indexed: 0, message: 'No pending watches' }

  // Group watches by client to share GSC connections
  const byClient: Record<string, typeof watches> = {}
  for (const w of watches) {
    if (!byClient[w.client_id]) byClient[w.client_id] = []
    byClient[w.client_id].push(w)
  }

  let checked = 0, indexed = 0

  for (const [clientId, clientWatches] of Object.entries(byClient)) {
    // Find GSC connection for this client
    const { data: conn } = await s.from('seo_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('provider', 'search_console')
      .limit(1)
      .maybeSingle()

    if (!conn?.access_token) {
      // No GSC connection - mark watches as no_gsc
      await s.from('kotoiq_publish_watches')
        .update({ status: 'no_gsc', checked_at: new Date().toISOString() })
        .in('id', clientWatches.map(w => w.id))
      continue
    }

    // Refresh token if needed
    let accessToken = conn.access_token
    if (conn.refresh_token && conn.expires_at && new Date(conn.expires_at) < new Date()) {
      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: conn.refresh_token,
            client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
          }),
        })
        const tokenData = await tokenRes.json()
        if (tokenData.access_token) {
          accessToken = tokenData.access_token
          await s.from('seo_connections').update({
            access_token: accessToken,
            expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
          }).eq('id', conn.id)
        }
      } catch { /* use existing token */ }
    }

    const siteUrl = conn.site_url

    for (const watch of clientWatches) {
      try {
        // Use GSC URL Inspection API
        const inspectRes = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ inspectionUrl: watch.url, siteUrl }),
          signal: AbortSignal.timeout(10000),
        })

        checked++

        if (!inspectRes.ok) {
          await s.from('kotoiq_publish_watches').update({
            checked_at: new Date().toISOString(),
            metadata: { ...(watch.metadata || {}), last_error: `GSC API ${inspectRes.status}` },
          }).eq('id', watch.id)
          continue
        }

        const result = await inspectRes.json()
        const verdict = result.inspectionResult?.indexStatusResult?.verdict
        const coverageState = result.inspectionResult?.indexStatusResult?.coverageState

        const isIndexed = verdict === 'PASS' || coverageState === 'Submitted and indexed'
        const isSubmitted = coverageState === 'Discovered - currently not indexed' || coverageState === 'Crawled - currently not indexed'

        const newStatus = isIndexed ? 'indexed' : isSubmitted ? 'submitted' : 'pending'

        await s.from('kotoiq_publish_watches').update({
          status: newStatus,
          checked_at: new Date().toISOString(),
          indexed_at: isIndexed ? new Date().toISOString() : watch.indexed_at,
          metadata: {
            ...(watch.metadata || {}),
            verdict,
            coverage_state: coverageState,
            last_crawl: result.inspectionResult?.indexStatusResult?.lastCrawlTime,
          },
        }).eq('id', watch.id)

        if (isIndexed) indexed++
      } catch (e: any) {
        await s.from('kotoiq_publish_watches').update({
          checked_at: new Date().toISOString(),
          metadata: { ...(watch.metadata || {}), last_error: e.message },
        }).eq('id', watch.id)
      }
    }
  }

  return { checked, indexed }
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
