// ─────────────────────────────────────────────────────────────
// /api/webhooks/vercel
//
// Receives Vercel deployment webhooks and logs each event to
// koto_events so the realtime activity feed + BuildImpact table
// can show deployment activity alongside AI cost data.
//
// Register this URL in Vercel → Settings → Webhooks → Add Webhook
//   URL:   https://hellokoto.com/api/webhooks/vercel
//   Events: deployment.created, deployment.succeeded, deployment.error
//
// Events:
//   - deployment.created    → logs 'deployment_created'
//   - deployment.succeeded  → logs 'deployment' (the "final" deploy event)
//   - deployment.error      → logs 'deployment_error' + fires notification
//   - deployment.canceled   → logs 'deployment_canceled'
//
// Idempotency: dedupe by metadata.event_key = `vercel_${deployment_id}_${event_type}`
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 10

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

const KOTO_AGENCY = '00000000-0000-0000-0000-000000000099'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, payload } = body
    if (!type || !payload) {
      return NextResponse.json({ ok: false, error: 'missing type or payload' }, { status: 400 })
    }

    const sb = getSupabase()
    const deployment = payload.deployment || payload
    const deploymentId = deployment?.id || deployment?.uid
    if (!deploymentId) {
      console.warn('[vercel webhook] no deployment id in payload')
      return NextResponse.json({ ok: true, skipped: true })
    }

    const commitMessage = deployment?.meta?.githubCommitMessage?.split('\n')[0]?.slice(0, 80) || 'deployment'
    const commitSha = deployment?.meta?.githubCommitSha || null
    const branch = deployment?.meta?.githubCommitRef || null
    const url = deployment?.url || null

    let title: string
    let description: string
    let eventType: string
    let fireNotification = false

    switch (type) {
      case 'deployment.created':
        eventType = 'deployment_created'
        title = `⏳ Deploy started: ${commitMessage}`
        description = `${branch || 'main'} · ${deployment?.creator?.username || 'system'}`
        break
      case 'deployment.succeeded':
      case 'deployment-ready':
        eventType = 'deployment'
        title = `🚀 Deploy succeeded: ${commitMessage}`
        description = `${branch || 'main'} · live at ${url || 'unknown'}`
        fireNotification = true
        break
      case 'deployment.error':
      case 'deployment-error':
        eventType = 'deployment_error'
        title = `❌ Deploy failed: ${commitMessage}`
        description = `${branch || 'main'} · ${deployment?.errorMessage || 'check vercel dashboard'}`
        fireNotification = true
        break
      case 'deployment.canceled':
      case 'deployment-canceled':
        eventType = 'deployment_canceled'
        title = `⚠️ Deploy canceled: ${commitMessage}`
        description = `${branch || 'main'}`
        break
      default:
        console.log('[vercel webhook] unhandled type:', type)
        return NextResponse.json({ ok: true, handled: false, type })
    }

    const eventKey = `vercel_${deploymentId}_${eventType}`

    // Dedupe against existing rows
    const { data: existing } = await sb
      .from('koto_events')
      .select('id')
      .eq('metadata->>event_key', eventKey)
      .maybeSingle()
    if (existing?.id) {
      return NextResponse.json({ ok: true, already_logged: true })
    }

    const { error: insErr } = await sb.from('koto_events').insert({
      event_type: eventType,
      title,
      description,
      timestamp: new Date().toISOString(),
      metadata: {
        event_key: eventKey,
        source: 'vercel',
        webhook_type: type,
        deployment_id: deploymentId,
        commit_sha: commitSha,
        commit_message: deployment?.meta?.githubCommitMessage || null,
        branch,
        url,
        creator: deployment?.creator?.username || null,
        error_message: deployment?.errorMessage || null,
      },
    })
    if (insErr) {
      console.warn('[vercel webhook] insert failed:', insErr.message)
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
    }

    // Fire a notification for succeed/error so the bell rings
    if (fireNotification) {
      try {
        await sb.from('koto_notifications').insert({
          agency_id: KOTO_AGENCY,
          type: eventType,
          title: eventType === 'deployment' ? '🚀 Koto deployed' : '❌ Deploy failed',
          body: commitMessage,
          icon: eventType === 'deployment' ? '🚀' : '❌',
          link: url ? `https://${url}` : null,
          metadata: { deployment_id: deploymentId, commit_sha: commitSha },
        })
      } catch (e: any) {
        // Non-fatal — notifications table may not exist on every install
        console.warn('[vercel webhook] notification insert failed:', e?.message)
      }
    }

    return NextResponse.json({ ok: true, logged: eventType })
  } catch (e: any) {
    console.error('[vercel webhook] fatal:', e)
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 })
  }
}
