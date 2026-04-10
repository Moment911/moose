import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '@/lib/apiAuth'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const DEFAULT_AGENCY = '00000000-0000-0000-0000-000000000099'
const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

function rangeStartDate(range: string | null): Date | null {
  if (!range || range === 'all') return null
  const now = new Date()
  if (range === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  const days = range === '90' ? 90 : 30
  return new Date(now.getTime() - days * 86400000)
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch { return fallback }
}

// ─────────────────────────────────────────────────────────────
// GET — build report
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'get_report'
    const s = sb()
    const agencyId = resolveAgencyId(req, searchParams) || DEFAULT_AGENCY

    if (action === 'get_report') {
      const clientId = searchParams.get('client_id') || ''
      const range = searchParams.get('range') || '30'
      if (!clientId) return Response.json({ error: 'Missing client_id' }, { status: 400 })

      const startDate = rangeStartDate(range)
      const startISO = startDate ? startDate.toISOString() : null

      // Run all queries in parallel; tolerate missing tables via try/catch wrappers
      const [client, voiceRows, inboundRows, visitorRows, engagementRow] = await Promise.all([
        safeQuery(async () => {
          const { data } = await s.from('clients').select('*').eq('id', clientId).maybeSingle()
          return data || null
        }, null as any),

        safeQuery(async () => {
          let q = s.from('koto_voice_calls').select('id, duration_seconds, appointment_set, sentiment, created_at').eq('client_id', clientId)
          if (startISO) q = q.gte('created_at', startISO)
          const { data } = await q.limit(10000)
          return data || []
        }, [] as any[]),

        safeQuery(async () => {
          let q = s.from('koto_inbound_calls').select('id, duration_seconds, urgency, created_at').eq('client_id', clientId)
          if (startISO) q = q.gte('created_at', startISO)
          const { data } = await q.limit(10000)
          return data || []
        }, [] as any[]),

        safeQuery(async () => {
          let q = s.from('koto_visitor_sessions')
            .select('id, identification_confidence, intent_score, submitted_form, started_at')
            .eq('client_id', clientId)
          if (startISO) q = q.gte('started_at', startISO)
          const { data } = await q.limit(10000)
          return data || []
        }, [] as any[]),

        safeQuery(async () => {
          const { data } = await s.from('koto_discovery_engagements')
            .select('id, status, readiness_score, readiness_label, updated_at, created_at')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)
          return (data && data[0]) || null
        }, null as any),
      ])

      // ── Voice metrics ────────────────────────────────────
      const totalCalls = voiceRows.length
      const answered = voiceRows.filter(c => (c.duration_seconds || 0) > 30).length
      const appointments = voiceRows.filter(c => c.appointment_set === true).length
      const durations = voiceRows.map(c => c.duration_seconds || 0)
      const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0

      const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
      for (const c of voiceRows) {
        const sent = String(c.sentiment || '').toLowerCase()
        if (sent.includes('positive')) sentimentCounts.positive++
        else if (sent.includes('negative')) sentimentCounts.negative++
        else sentimentCounts.neutral++
      }

      // ── Inbound metrics ──────────────────────────────────
      const totalInbound = inboundRows.length
      const inboundDurations = inboundRows.map(c => c.duration_seconds || 0)
      const avgInboundDuration = inboundDurations.length > 0
        ? Math.round(inboundDurations.reduce((a, b) => a + b, 0) / inboundDurations.length)
        : 0
      const urgencyCounts: Record<string, number> = { emergency: 0, urgent: 0, normal: 0 }
      for (const c of inboundRows) {
        const u = String(c.urgency || 'normal').toLowerCase()
        if (u === 'emergency') urgencyCounts.emergency++
        else if (u === 'urgent') urgencyCounts.urgent++
        else urgencyCounts.normal++
      }

      // ── Visitor metrics ──────────────────────────────────
      const totalVisits = visitorRows.length
      const identifiedCompanies = visitorRows.filter(v => (v.identification_confidence || 0) >= 40).length
      const hotVisitors = visitorRows.filter(v => (v.intent_score || 0) >= 70).length
      const formSubmissions = visitorRows.filter(v => v.submitted_form === true).length

      return Response.json({
        data: {
          client: client
            ? {
                id: client.id,
                name: client.name || client.business_name || 'Client',
                industry: client.industry || null,
                website: client.website || null,
                google_rating: client.google_rating ?? null,
                review_count: client.review_count ?? null,
              }
            : null,
          range,
          range_start: startISO,
          generated_at: new Date().toISOString(),
          voice: {
            total: totalCalls,
            answered,
            appointments,
            avg_duration_seconds: avgDuration,
            sentiment: sentimentCounts,
          },
          inbound: {
            total: totalInbound,
            avg_duration_seconds: avgInboundDuration,
            urgency: urgencyCounts,
          },
          website: {
            total_visits: totalVisits,
            identified_companies: identifiedCompanies,
            hot_visitors: hotVisitors,
            form_submissions: formSubmissions,
          },
          reputation: {
            google_rating: client?.google_rating ?? null,
            review_count: client?.review_count ?? null,
          },
          discovery: engagementRow
            ? {
                engagement_id: engagementRow.id,
                status: engagementRow.status,
                readiness_score: engagementRow.readiness_score,
                readiness_label: engagementRow.readiness_label,
                updated_at: engagementRow.updated_at,
              }
            : null,
        },
      })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST — AI insights
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { searchParams } = new URL(req.url)
    const action = body.action || searchParams.get('action') || ''

    if (action === 'generate_insights') {
      const report = body.report
      if (!report) return Response.json({ error: 'Missing report' }, { status: 400 })

      const apiKey = process.env.ANTHROPIC_API_KEY || ''
      if (!apiKey) {
        return Response.json({ data: { insights: [] } })
      }

      // Pull the client's welcome_statement (if any) so insights are grounded
      // in the client's own-words self-description from onboarding.
      let welcomeBlock = ''
      const clientId = body.client_id || report?.client_id || report?.client?.id
      if (clientId) {
        try {
          const sb = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          )
          const { data: clientRecord } = await sb
            .from('clients')
            .select('welcome_statement')
            .eq('id', clientId)
            .maybeSingle()
          if (clientRecord?.welcome_statement) {
            welcomeBlock = `The client described themselves as: "${String(clientRecord.welcome_statement).trim()}"\n\n`
          }
        } catch { /* best-effort */ }
      }

      const system = 'You are a senior marketing analyst. Based on client performance data, provide 3-5 specific actionable insights. Return JSON only: { "insights": [{"type": "positive|warning|opportunity", "text": "string"}] } — no preamble, no markdown fence.'
      const userMsg = `${welcomeBlock}Client performance data:\n${JSON.stringify(report, null, 2)}\n\nReturn the JSON now.`

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
            max_tokens: 600,
            temperature: 0,
            system,
            messages: [{ role: 'user', content: userMsg }],
          }),
          signal: AbortSignal.timeout(12000),
        })
        if (!res.ok) return Response.json({ data: { insights: [] } })
        const d = await res.json()
        const txt = (d.content || [])
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n')
          .trim()

        let parsed: any = null
        try {
          const cleaned = txt.replace(/```json|```/g, '').trim()
          parsed = JSON.parse(cleaned)
        } catch {
          const match = txt.match(/\{[\s\S]*\}/)
          if (match) {
            try { parsed = JSON.parse(match[0]) } catch { /* ignore */ }
          }
        }

        const insights = Array.isArray(parsed?.insights) ? parsed.insights : []
        return Response.json({ data: { insights } })
      } catch {
        return Response.json({ data: { insights: [] } })
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
