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

function parseJson(text: string): any {
  if (!text) return null
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) { try { return JSON.parse(match[0]) } catch { /* ignore */ } }
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// GET — fetch stored audit
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'get_audit'
    const id = searchParams.get('id') || searchParams.get('engagement_id') || ''
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

    const s = sb()

    if (action === 'get_audit') {
      const { data: eng } = await s
        .from('koto_discovery_engagements')
        .select('id, client_name, client_industry, status, audit_data, audit_generated_at, compiled_at')
        .eq('id', id)
        .maybeSingle()

      if (!eng) return Response.json({ error: 'Not found' }, { status: 404 })
      return Response.json({ data: eng })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('discovery/audit GET error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST — generate audit
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { searchParams } = new URL(req.url)
    const action = body.action || searchParams.get('action') || ''
    const s = sb()

    if (action !== 'generate_audit') {
      return Response.json({ error: 'Unknown action' }, { status: 400 })
    }

    const agencyId = resolveAgencyId(req, searchParams, body) || '00000000-0000-0000-0000-000000000099'
    const engagementId = body.engagement_id || body.id
    if (!engagementId) return Response.json({ error: 'Missing engagement_id' }, { status: 400 })

    // Load the full engagement + domains
    const [{ data: eng }, { data: domains }] = await Promise.all([
      s.from('koto_discovery_engagements').select('*').eq('id', engagementId).maybeSingle(),
      s.from('koto_discovery_domains').select('*').eq('engagement_id', engagementId),
    ])

    if (!eng) return Response.json({ error: 'Engagement not found' }, { status: 404 })

    // Build a comprehensive digest of every answered field
    const answeredSections: string[] = []
    for (const sec of eng.sections || []) {
      if (sec.visible === false) continue
      const lines: string[] = []
      for (const f of sec.fields || []) {
        if (f.never_share) continue
        if ((f.answer || '').trim()) lines.push(`  Q: ${f.question}\n  A: ${f.answer}`)
      }
      if (lines.length > 0) {
        answeredSections.push(`### ${sec.title}${sec.subtitle ? ` — ${sec.subtitle}` : ''}\n${lines.join('\n')}`)
      }
    }

    const intelCardsText = (Array.isArray(eng.intel_cards) ? eng.intel_cards : [])
      .map((c: any) => `- [${c.category || 'intel'}] ${c.title}: ${c.body}`)
      .join('\n') || '(none)'

    const domainsText = (domains || [])
      .map((d: any) => {
        const cats = (d.tech_stack?.categories || [])
          .map((c: any) => `  ${c.name}: ${(c.tools || []).map((t: any) => `${t.name} (${t.confidence})`).join(', ')}`)
          .join('\n')
        return `Domain: ${d.url} (${d.domain_type})\n${cats || '  (no tech detected)'}`
      })
      .join('\n\n') || '(no domains scanned)'

    const interviewFlagsText = (Array.isArray(eng.interview_flags) ? eng.interview_flags : [])
      .map((f: any) => `- [${f.type}] ${f.note} (from ${f.section_title || 'unknown'})`)
      .join('\n') || '(none)'

    const system = `You are a senior marketing strategist, operations consultant, and technology architect with 25 years of experience across hundreds of businesses in every industry. You have just completed a deep discovery session with a client. Based on everything learned in this discovery, produce a comprehensive strategic audit and implementation plan.

Return valid JSON only with this exact structure:
{
  "executive_summary": "4-5 paragraphs, direct and strategic",
  "business_health_score": {
    "overall": 0-100,
    "breakdown": [{ "category": "string", "score": 0-100, "rationale": "string" }]
  },
  "critical_findings": [{
    "severity": "critical|high|medium",
    "category": "string",
    "finding": "string",
    "impact": "string",
    "evidence": "string"
  }],
  "opportunities": [{
    "priority": "immediate|short_term|long_term",
    "title": "string",
    "description": "string",
    "estimated_impact": "string",
    "estimated_effort": "low|medium|high",
    "revenue_potential": "string",
    "implementation_steps": ["string"]
  }],
  "technology_audit": [{
    "category": "string",
    "current_state": "string",
    "gaps": ["string"],
    "recommendations": [{
      "tool": "string",
      "reason": "string",
      "priority": "replace|add|optimize|remove",
      "estimated_cost": "string",
      "implementation_notes": "string"
    }]
  }],
  "lead_generation_plan": {
    "current_state_assessment": "string",
    "recommended_channels": [{
      "channel": "string",
      "current_usage": "none|underutilized|active|strong",
      "recommended_action": "string",
      "expected_result": "string",
      "timeline": "string",
      "monthly_budget_range": "string"
    }],
    "funnel_analysis": {
      "top_of_funnel": "string",
      "middle_of_funnel": "string",
      "bottom_of_funnel": "string",
      "retention": "string"
    },
    "quick_wins": [{ "action": "string", "timeline": "string", "expected_result": "string" }]
  },
  "crm_and_automation_plan": {
    "platform_recommendation": "string",
    "rationale": "string",
    "implementation_phases": [{
      "phase": 1,
      "title": "string",
      "duration": "string",
      "actions": ["string"],
      "deliverables": ["string"]
    }],
    "automations_to_build": [{
      "name": "string",
      "trigger": "string",
      "sequence": ["string"],
      "expected_impact": "string"
    }]
  },
  "content_and_seo_plan": {
    "current_assessment": "string",
    "keyword_opportunities": ["string"],
    "content_priorities": ["string"],
    "local_seo_actions": ["string"],
    "recommendations": ["string"]
  },
  "ninety_day_roadmap": [{
    "week_range": "string",
    "focus": "string",
    "actions": ["string"],
    "owner": "string",
    "success_metric": "string"
  }],
  "investment_summary": {
    "recommended_monthly_retainer_range": "string",
    "one_time_setup_costs": "string",
    "roi_projection": "string",
    "payback_period": "string",
    "first_90_day_priorities": ["string"]
  }
}

Be specific, evidence-based, and actionable. Ground every finding and recommendation in the discovery data provided. Do not hedge. Return ONLY the JSON object, no markdown fences, no preamble.`

    const userPrompt = `CLIENT: ${eng.client_name}
INDUSTRY: ${eng.client_industry || 'unknown'}
EXECUTIVE SUMMARY (previously compiled):
${eng.executive_summary || '(not yet compiled)'}

═══ PRE-CALL INTEL ═══
${intelCardsText}

═══ DISCOVERY ANSWERS ═══
${answeredSections.join('\n\n').slice(0, 50_000)}

═══ DOMAINS & TECH STACK ═══
${domainsText.slice(0, 10_000)}

═══ INTERVIEW FLAGS ═══
${interviewFlagsText}

Produce the full strategic audit JSON now.`

    const apiKey = process.env.ANTHROPIC_API_KEY || ''
    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    let raw = ''
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
          max_tokens: 8000,
          system,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: AbortSignal.timeout(120000), // audit is the main deliverable — give it time
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        return Response.json({ error: `Claude API ${res.status}: ${errText.slice(0, 300)}` }, { status: 500 })
      }
      const d = await res.json()
      raw = (d.content || [])
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n')
        .trim()
    } catch (e: any) {
      return Response.json({ error: `Claude request failed: ${e?.message || e}` }, { status: 500 })
    }

    const audit = parseJson(raw)
    if (!audit || typeof audit !== 'object') {
      return Response.json({
        error: 'Failed to parse audit JSON',
        raw_preview: raw.slice(0, 500),
      }, { status: 500 })
    }

    const now = new Date().toISOString()
    await s.from('koto_discovery_engagements').update({
      audit_data: audit,
      audit_generated_at: now,
    }).eq('id', engagementId)

    return Response.json({ data: { audit_data: audit, audit_generated_at: now } })
  } catch (error: any) {
    console.error('discovery/audit POST error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
