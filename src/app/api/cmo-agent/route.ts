import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '@/lib/apiAuth'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_AGENCY = '00000000-0000-0000-0000-000000000099'

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch { return fallback }
}

async function loadAgencyContext(agencyId: string) {
  const s = sb()
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()

  const [
    clientsCount,
    voiceCallsToday,
    voiceCallsWeek,
    appointmentsWeek,
    discoveryRecent,
    hotOppsCount,
    unreadNotifs,
    totalReviews,
  ] = await Promise.all([
    safe(async () => {
      const { count } = await s.from('clients').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId)
      return count || 0
    }, 0),
    safe(async () => {
      const { count } = await s.from('koto_voice_calls').select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId).gte('created_at', startOfToday)
      return count || 0
    }, 0),
    safe(async () => {
      const { count } = await s.from('koto_voice_calls').select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId).gte('created_at', weekAgo)
      return count || 0
    }, 0),
    safe(async () => {
      const { count } = await s.from('koto_voice_calls').select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId).eq('appointment_set', true).gte('created_at', weekAgo)
      return count || 0
    }, 0),
    safe(async () => {
      const { data } = await s.from('koto_discovery_engagements')
        .select('id, client_name, status, readiness_score, readiness_label, updated_at')
        .eq('agency_id', agencyId)
        .order('updated_at', { ascending: false })
        .limit(3)
      return data || []
    }, [] as any[]),
    safe(async () => {
      const { count } = await s.from('koto_opportunities').select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId).gte('intent_score', 70)
      return count || 0
    }, 0),
    safe(async () => {
      const { count } = await s.from('koto_notifications').select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId).eq('is_read', false)
      return count || 0
    }, 0),
    safe(async () => {
      const { data } = await s.from('clients').select('review_count').eq('agency_id', agencyId)
      return (data || []).reduce((a: number, r: any) => a + (r.review_count || 0), 0)
    }, 0),
  ])

  return {
    clientsCount,
    voiceCallsToday,
    voiceCallsWeek,
    appointmentsWeek,
    discoveryRecent,
    hotOppsCount,
    unreadNotifs,
    totalReviews,
  }
}

function buildSystemPrompt(ctx: Awaited<ReturnType<typeof loadAgencyContext>>): string {
  const discoveryList = ctx.discoveryRecent.length > 0
    ? ctx.discoveryRecent.map((e: any) =>
        `  - ${e.client_name} (${e.status}${e.readiness_label ? `, ${e.readiness_label} ${e.readiness_score || ''}` : ''})`
      ).join('\n')
    : '  (none)'

  return `You are the AI CMO for this marketing agency. You have real-time access to their platform data and act as a senior strategic advisor. You know their clients, their pipeline, their voice call performance, and their discovery engagements.

Current agency snapshot:
- Clients: ${ctx.clientsCount}
- Voice calls today: ${ctx.voiceCallsToday} | This week: ${ctx.voiceCallsWeek}
- Appointments this week: ${ctx.appointmentsWeek}
- Hot pipeline opportunities (intent 70+): ${ctx.hotOppsCount}
- Unread alerts: ${ctx.unreadNotifs}
- Total Google reviews across clients: ${ctx.totalReviews}
- Active discovery engagements:
${discoveryList}

Your personality: Direct, strategic, no fluff. You give specific recommendations based on actual data. You ask good follow-up questions. You can help with: reviewing performance, prioritizing tasks, drafting communications, analyzing trends, building strategies, and answering any business question. You always ground your answers in the actual agency data you have access to.

If asked about a specific client or engagement you don't have details on, say so and ask for more context. Never make up data.

When you finish your response, if there are 2-4 concrete next actions the user could take, append them in a JSON block at the very end like this:
\`\`\`json
{"suggested_actions": ["Call Apex HVAC to confirm next steps", "Review the Coastal Roofing discovery"]}
\`\`\`
Otherwise omit the JSON block entirely.`
}

// ─────────────────────────────────────────────────────────────
// POST — chat
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { searchParams } = new URL(req.url)
    const action = body.action || searchParams.get('action') || ''
    const agencyId = resolveAgencyId(req, searchParams, body) || DEFAULT_AGENCY

    if (action !== 'chat') {
      return Response.json({ error: 'Unknown action' }, { status: 400 })
    }

    const message = typeof body.message === 'string' ? body.message : ''
    const history = Array.isArray(body.conversation_history) ? body.conversation_history : []

    const ctx = await loadAgencyContext(agencyId)
    const system = buildSystemPrompt(ctx)

    // Build the Claude messages array
    const claudeMessages: any[] = history
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m: any) => ({ role: m.role, content: m.content }))

    if (message === '__init__') {
      // First load — prime with an instruction for a contextual greeting
      claudeMessages.push({
        role: 'user',
        content: `[Open the conversation with a short, direct greeting that references the current agency snapshot above. Mention 1-2 things that stand out from the data. Ask the user what they want to work on. Keep it under 4 sentences.]`,
      })
    } else if (message) {
      claudeMessages.push({ role: 'user', content: message })
    }

    if (claudeMessages.length === 0) {
      return Response.json({ data: { message: "How can I help?", suggested_actions: [] } })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || ''
    if (!apiKey) {
      return Response.json({
        data: {
          message: "I'm not connected to the AI backend right now — check that ANTHROPIC_API_KEY is set in the environment.",
          suggested_actions: [],
        },
      })
    }

    let finalText = ''
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1000,
          temperature: 0.7,
          system,
          messages: claudeMessages,
        }),
        signal: AbortSignal.timeout(30000),
      })
      if (res.ok) {
        const d = await res.json()
        finalText = (d.content || [])
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n')
          .trim()
      } else {
        const errText = await res.text().catch(() => '')
        finalText = `(AI error ${res.status}) ${errText.slice(0, 200)}`
      }
    } catch (e: any) {
      finalText = `(AI request failed: ${e?.message || 'unknown'})`
    }

    // Strip the trailing JSON block if present and extract suggested_actions
    let suggestedActions: string[] = []
    let displayText = finalText
    const jsonBlockMatch = finalText.match(/```json\s*([\s\S]*?)\s*```\s*$/m)
    if (jsonBlockMatch) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1])
        if (Array.isArray(parsed?.suggested_actions)) {
          suggestedActions = parsed.suggested_actions.map((s: any) => String(s)).slice(0, 4)
        }
        displayText = finalText.replace(/```json\s*[\s\S]*?\s*```\s*$/m, '').trim()
      } catch { /* ignore */ }
    }

    return Response.json({
      data: {
        message: displayText,
        suggested_actions: suggestedActions,
      },
    })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
