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

    const agencyId = resolveAgencyId(req, searchParams, body) || '00000000-0000-0000-0000-000000000099'
    const engagementId = body.engagement_id || body.id
    if (!engagementId) return Response.json({ error: 'Missing engagement_id' }, { status: 400 })

    // ─── create_proposal_from_audit ──────────────────
    if (action === 'create_proposal_from_audit') {
      const { data: eng } = await s
        .from('koto_discovery_engagements')
        .select('id, client_name, client_id, audit_data')
        .eq('id', engagementId)
        .maybeSingle()

      if (!eng) return Response.json({ error: 'Engagement not found' }, { status: 404 })
      if (!eng.audit_data) return Response.json({ error: 'No audit data. Generate the audit first.' }, { status: 400 })

      const a = eng.audit_data as any
      const title = `Strategic Marketing & Operations Plan — ${eng.client_name}`

      // Build intro + executive summary from audit
      const intro = `This proposal outlines the strategic marketing and operations plan for ${eng.client_name}, developed from a comprehensive discovery session covering technology, lead generation, CRM, content, paid advertising, and operational workflows.`

      // Build a formatted executive summary including investment + opportunities
      const executiveSummaryParts: string[] = []
      if (a.executive_summary) executiveSummaryParts.push(a.executive_summary)

      if (Array.isArray(a.opportunities) && a.opportunities.length > 0) {
        executiveSummaryParts.push('\n\n## Scope & Services\n')
        for (const opp of a.opportunities.slice(0, 8)) {
          executiveSummaryParts.push(`\n### ${opp.title}\n${opp.description || ''}`)
          if (opp.estimated_impact) executiveSummaryParts.push(`\n**Expected impact:** ${opp.estimated_impact}`)
          if (opp.revenue_potential) executiveSummaryParts.push(`\n**Revenue potential:** ${opp.revenue_potential}`)
        }
      }

      if (Array.isArray(a.technology_audit) && a.technology_audit.length > 0) {
        executiveSummaryParts.push('\n\n## Technology Recommendations\n')
        for (const cat of a.technology_audit.slice(0, 6)) {
          const replaces = (cat.recommendations || []).filter((r: any) => r.priority === 'replace').slice(0, 3)
          const adds = (cat.recommendations || []).filter((r: any) => r.priority === 'add').slice(0, 3)
          if (replaces.length || adds.length) {
            executiveSummaryParts.push(`\n### ${cat.category}`)
            if (replaces.length) {
              executiveSummaryParts.push(`\n**Replace:** ${replaces.map((r: any) => r.tool).join(', ')}`)
            }
            if (adds.length) {
              executiveSummaryParts.push(`\n**Add:** ${adds.map((r: any) => r.tool).join(', ')}`)
            }
          }
        }
      }

      if (Array.isArray(a.ninety_day_roadmap) && a.ninety_day_roadmap.length > 0) {
        executiveSummaryParts.push('\n\n## 90-Day Roadmap\n')
        for (const wk of a.ninety_day_roadmap.slice(0, 6)) {
          executiveSummaryParts.push(`\n**${wk.week_range || 'TBD'} — ${wk.focus || 'Focus TBD'}:** ${wk.success_metric || ''}`)
        }
      }

      if (a.investment_summary) {
        const inv = a.investment_summary
        executiveSummaryParts.push('\n\n## Investment\n')
        if (inv.recommended_monthly_retainer_range) {
          executiveSummaryParts.push(`\n**Monthly retainer:** ${inv.recommended_monthly_retainer_range}`)
        }
        if (inv.one_time_setup_costs) {
          executiveSummaryParts.push(`\n**One-time setup:** ${inv.one_time_setup_costs}`)
        }
        if (inv.roi_projection) {
          executiveSummaryParts.push(`\n**Projected ROI:** ${inv.roi_projection}`)
        }
        if (inv.payback_period) {
          executiveSummaryParts.push(`\n**Payback period:** ${inv.payback_period}`)
        }
      }

      const executiveSummary = executiveSummaryParts.join('')

      const now = new Date().toISOString()
      const { data: newProposal, error: propErr } = await s
        .from('proposals')
        .insert({
          agency_id: agencyId,
          client_id: eng.client_id || null,
          title,
          status: 'draft',
          type: 'proposal',
          intro,
          executive_summary: executiveSummary,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single()

      if (propErr || !newProposal) {
        return Response.json({
          error: `Failed to create proposal: ${propErr?.message || 'unknown'}`,
        }, { status: 500 })
      }

      // Create proposal_sections from opportunities (each opportunity = one service section)
      if (Array.isArray(a.opportunities) && a.opportunities.length > 0) {
        try {
          const sectionRows = a.opportunities.slice(0, 10).map((opp: any, idx: number) => ({
            proposal_id: newProposal.id,
            sort_order: idx,
            title: opp.title || `Opportunity ${idx + 1}`,
            body: [
              opp.description || '',
              opp.estimated_impact ? `\n\nExpected Impact: ${opp.estimated_impact}` : '',
              opp.revenue_potential ? `\n\nRevenue Potential: ${opp.revenue_potential}` : '',
              Array.isArray(opp.implementation_steps) && opp.implementation_steps.length > 0
                ? `\n\nImplementation:\n${opp.implementation_steps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`
                : '',
            ].join(''),
          }))
          await s.from('proposal_sections').insert(sectionRows)
        } catch { /* non-fatal */ }
      }

      return Response.json({ data: { proposal_id: newProposal.id } })
    }

    if (action !== 'generate_audit') {
      return Response.json({ error: 'Unknown action' }, { status: 400 })
    }

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

    // Pull the canonical welcome statement + business classification from
    // the client record (if linked) and prepend them to the user prompt as
    // the highest-signal context. The classification steers the audit so
    // recommendations are tailored to B2B vs B2C, local vs national, etc.
    let welcomeStatement = ''
    let classification: any = null
    if (eng.client_id) {
      try {
        const { data: clientRecord } = await s
          .from('clients')
          .select('welcome_statement, business_classification')
          .eq('id', eng.client_id)
          .maybeSingle()
        if (clientRecord?.welcome_statement) {
          welcomeStatement = String(clientRecord.welcome_statement).trim()
        }
        if (clientRecord?.business_classification && typeof clientRecord.business_classification === 'object') {
          classification = clientRecord.business_classification
        }
      } catch { /* best-effort */ }
    }
    const classificationBlock = classification
      ? `BUSINESS CLASSIFICATION (drives which recommendations apply):\n` +
        `  Model: ${String(classification.business_model || 'unknown').toUpperCase()}\n` +
        `  Geographic scope: ${classification.geographic_scope || 'unknown'}\n` +
        `  Type: ${String(classification.business_type || 'unknown').replace(/_/g, ' ')}\n` +
        `  Sales cycle: ${classification.sales_cycle || 'unknown'}\n` +
        (classification.has_sales_team ? `  Has a sales team: yes\n` : '') +
        (classification.reasoning ? `  Reasoning: ${classification.reasoning}\n` : '') +
        `IMPORTANT: tailor every recommendation to this business type. B2B vs B2C, local vs national, and consultative vs transactional should all shape the channel mix, tactics, and timeline.\n\n`
      : ''
    const welcomeBlock = welcomeStatement
      ? `CLIENT IN THEIR OWN WORDS:\n"${welcomeStatement}"\n\n`
      : ''

    const userPrompt = `${classificationBlock}${welcomeBlock}CLIENT: ${eng.client_name}
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

    // Webhook: discovery.audit_generated — fire and forget
    try {
      const { data: webhooks } = await s
        .from('koto_agency_webhooks')
        .select('id, url, secret, name')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .contains('events', ['discovery.audit_generated'])
      if (webhooks && webhooks.length > 0) {
        const body = JSON.stringify({
          event: 'discovery.audit_generated',
          timestamp: now,
          engagement_id: engagementId,
          client_name: eng.client_name,
          health_score: audit?.business_health_score?.overall ?? null,
        })
        await Promise.allSettled(webhooks.map((wh: any) =>
          fetch(wh.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(wh.secret ? { 'X-Koto-Signature': wh.secret } : {}),
            },
            body,
            signal: AbortSignal.timeout(5000),
          }).then(async (r) => {
            try {
              await s.from('koto_system_logs').insert({
                level: r.ok ? 'info' : 'warn',
                service: 'webhook',
                action: 'discovery.audit_generated',
                message: `Webhook fired to ${wh.url} — ${r.status}`,
                metadata: { webhook_name: wh.name, webhook_id: wh.id, status: r.status, agency_id: agencyId },
              })
            } catch { /* non-fatal */ }
          }).catch(() => {})
        ))
      }
    } catch { /* non-fatal */ }

    return Response.json({ data: { audit_data: audit, audit_generated_at: now } })
  } catch (error: any) {
    console.error('discovery/audit POST error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
