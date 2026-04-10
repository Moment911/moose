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

// ─────────────────────────────────────────────────────────────
// GET — fetch saved responses
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'get_responses'
    const s = sb()
    const agencyId = resolveAgencyId(req, searchParams) || DEFAULT_AGENCY

    if (action === 'get_responses') {
      const clientId = searchParams.get('client_id')
      let q = s.from('koto_review_responses')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(500)
      if (clientId) q = q.eq('client_id', clientId)
      const { data } = await q
      return Response.json({ data: data || [] })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { searchParams } = new URL(req.url)
    const action = body.action || searchParams.get('action') || ''
    const s = sb()
    const agencyId = resolveAgencyId(req, searchParams, body) || DEFAULT_AGENCY

    // ── generate_response ─────────────────────────────
    if (action === 'generate_response') {
      const {
        review_text = '',
        rating = 5,
        reviewer_name = '',
        business_name = '',
        industry = '',
        tone = 'professional',
      } = body

      if (!review_text) return Response.json({ error: 'Missing review_text' }, { status: 400 })

      const apiKey = process.env.ANTHROPIC_API_KEY || ''
      if (!apiKey) {
        return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
      }

      const system = `You are writing a Google review response for a local business. Write a genuine response that references something specific from the review. Rules: Never use 'thank you for your feedback' or 'we appreciate your review'. For negative reviews be empathetic and offer to resolve offline. Keep under 150 words. Sound like a real person, not a corporate template. Do not mention the business name (looks spammy in Google). Return JSON only: { "response_text": string }`

      const userMsg = `Business type: ${industry || 'local business'}
Rating: ${rating}/5 stars
Reviewer: ${reviewer_name || 'Anonymous'}
Review: ${review_text}
Tone: ${tone}`

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
            max_tokens: 300,
            temperature: 0.4,
            system,
            messages: [{ role: 'user', content: userMsg }],
          }),
          signal: AbortSignal.timeout(12000),
        })
        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          return Response.json({ error: `Claude ${res.status}: ${errText.slice(0, 200)}` }, { status: 500 })
        }
        const d = await res.json()
        const txt = (d.content || [])
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n')
          .trim()

        // Try to parse strict JSON, fall back to extracting a JSON object
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

        const responseText = (parsed?.response_text || '').toString().trim()
          || txt.replace(/^["']|["']$/g, '').trim()

        return Response.json({ data: { response_text: responseText } })
      } catch (e: any) {
        return Response.json({ error: `Request failed: ${e?.message || e}` }, { status: 500 })
      }
    }

    // ── save_response ─────────────────────────────────
    if (action === 'save_response') {
      const {
        client_id = null,
        review_id = null,
        review_text = '',
        reviewer_name = '',
        rating = null,
        response_text = '',
        tone = 'professional',
      } = body

      if (!response_text) return Response.json({ error: 'Missing response_text' }, { status: 400 })

      const { data, error } = await s.from('koto_review_responses').insert({
        agency_id: agencyId,
        client_id,
        review_id: review_id ? String(review_id) : null,
        review_text,
        reviewer_name,
        rating,
        response_text,
        tone,
      }).select('*').maybeSingle()

      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ data })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
