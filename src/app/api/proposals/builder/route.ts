// ─────────────────────────────────────────────────────────────
// /api/proposals/builder
//
// AI-powered proposal builder driven by onboarding data.
// Loads the full client + agency, asks Claude Sonnet for a
// structured proposal, renders a PDF via pdfkit, persists to
// koto_proposals, and returns the saved row.
//
// Lives at /builder rather than /api/proposals so it doesn't
// collide with the older module-driven /api/proposals route
// (different table, different shape).
//
// Actions:
//   - generate       { client_id, agency_id, services?, monthly_budget?, tone?, focus_area? }
//   - get            ?id=
//   - list           ?client_id= | ?agency_id=
//   - update         { id, ...fields }
//   - mark_viewed    { id }
//   - mark_accepted  { id }
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import PDFDocument from 'pdfkit'
import { logTokenUsage } from '@/lib/tokenTracker'
import { recordDocument } from '@/lib/scout/touchOpportunity'
import { enrichProposalWithSEOData } from '@/lib/proposalDataEnricher'

export const maxDuration = 120

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const client_id = searchParams.get('client_id')
    const agency_id = searchParams.get('agency_id')
    const sb = getSupabase()

    if (id) {
      const { data, error } = await sb.from('koto_proposals').select('*').eq('id', id).maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ proposal: data })
    }

    let q = sb.from('koto_proposals').select('*').order('created_at', { ascending: false })
    if (client_id) q = q.eq('client_id', client_id)
    if (agency_id) q = q.eq('agency_id', agency_id)
    const { data, error } = await q.limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ proposals: data || [] })
  } catch (e: any) {
    console.error('[proposals/builder GET fatal]', e)
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body
    const sb = getSupabase()

    if (action === 'generate') {
      const { client_id, agency_id, services, monthly_budget, tone, focus_area, proposal_type } = body
      if (!client_id || !agency_id) {
        return NextResponse.json({ error: 'client_id and agency_id required' }, { status: 400 })
      }

      const { data: client, error: clientErr } = await sb
        .from('clients')
        .select('*')
        .eq('id', client_id)
        .maybeSingle()
      if (clientErr || !client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }

      const { data: agency } = await sb
        .from('agencies')
        .select('*')
        .eq('id', agency_id)
        .maybeSingle()
      const agencyName = agency?.brand_name || agency?.name || 'Your Agency'
      const primaryColor = agency?.primary_color || agency?.brand_color || '#00C2CB'

      if (!ANTHROPIC_KEY) {
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
      }

      const c = client as any
      // Resolver — checks dedicated columns first, then the
      // onboarding_answers jsonb (which the web form populates with
      // different key names than the voice agent does).
      const answers = c.onboarding_answers || {}
      const pick = (...keys: string[]): string => {
        for (const k of keys) {
          const direct = c[k]
          if (direct !== null && direct !== undefined && String(direct).trim() !== '') {
            return Array.isArray(direct) ? direct.filter(Boolean).join(', ') : String(direct)
          }
          const jsonb = answers[k]
          if (jsonb !== null && jsonb !== undefined && String(jsonb).trim() !== '') {
            return Array.isArray(jsonb) ? jsonb.filter(Boolean).join(', ') : String(jsonb)
          }
        }
        return ''
      }

      const clientNameStr = c.name || 'N/A'
      const industryStr = pick('industry') || 'N/A'
      const locationStr = [pick('city', 'primary_city'), pick('state')].filter(Boolean).join(', ') || 'N/A'
      const descriptionStr = pick('welcome_statement', 'business_description') || 'N/A'
      const primaryServiceStr = pick('primary_service', 'products_services', 'top_services') || 'N/A'
      const idealCustomerStr = pick('target_customer', 'ideal_customer_desc', 'customer_types') || 'N/A'
      const painPointsStr = pick('customer_pain_points')
      const budgetStr = pick('marketing_budget', 'monthly_ad_budget', 'budget_for_agency') || 'N/A'
      const channelsStr = pick('marketing_channels', 'current_ad_platforms') || 'N/A'
      const crmStr = pick('crm_used', 'b2b_crm') || 'N/A'
      const goalsStr = pick('notes', 'primary_goal', 'growth_scope') || 'N/A'
      const competitorsStr = [pick('competitor_1'), pick('competitor_2'), pick('competitor_3')].filter(Boolean).join(', ') || 'N/A'
      const uvpStr = pick('unique_selling_prop', 'unique_value_prop', 'why_choose_you') || 'N/A'
      const brandVoiceStr = pick('brand_voice', 'brand_tone')

      // ── Inject live KotoIQ SEO intelligence if this client has any. ──
      // Powers both the default proposal (as bonus specifics) and the
      // "SEO Intelligence Proposal" type which is fully data-driven.
      const seoEnrichment = await enrichProposalWithSEOData(sb, client_id)
      const isSeoIntelProposal = proposal_type === 'seo_intelligence'

      const seoContextBlock = seoEnrichment.has_kotoiq_data ? `

LIVE SEO INTELLIGENCE (from KotoIQ scans — use these specific numbers, keywords, and competitor names in the proposal):
- Domain authority: ${seoEnrichment.domain_authority} (competitor avg: ${seoEnrichment.competitor_avg_da ?? 'unknown'})
- Topical authority score: ${seoEnrichment.topical_authority_score}/100 (competitor avg: ${seoEnrichment.competitor_avg_authority_score ?? 'unknown'}, gap to close: ${seoEnrichment.authority_gap ?? 'unknown'})
- Tracked keywords: ${seoEnrichment.total_keywords_tracked}
- Wasted ad spend on organic cannibals: $${seoEnrichment.wasted_ad_spend_monthly.toLocaleString()}/mo
- Decay-risk pages: ${seoEnrichment.decay_risk_pages} (losing ~${seoEnrichment.decay_traffic_loss_estimate.toLocaleString()} clicks/mo)
- Pages missing structured data: ${seoEnrichment.missing_schema_count}
- Broken backlinks recoverable: ${seoEnrichment.broken_backlinks_count}
- Total opportunity value (competitor keywords client doesn't own): $${seoEnrichment.total_opportunity_value.toLocaleString()}/mo

Top competitors:
${JSON.stringify(seoEnrichment.specifics.top_competitors, null, 2)}

Top commercial keyword gaps (transactional intent, not currently ranking):
${JSON.stringify(seoEnrichment.specifics.top_commercial_gaps, null, 2)}

Pages currently decaying:
${JSON.stringify(seoEnrichment.specifics.declining_urls, null, 2)}

Quick wins available:
${JSON.stringify(seoEnrichment.quick_wins, null, 2)}

Narrative bullets to reference verbatim where relevant:
${seoEnrichment.narrative_bullets.map((b) => '- ' + b).join('\n')}

MANDATE: the situation analysis and strategy sections MUST reference specific keywords, specific competitor domains, and specific URLs from the data above. Do NOT speak in generic terms when live data is available.` : ''

      const proposalInstruction = isSeoIntelProposal && seoEnrichment.has_kotoiq_data ? `

This is an SEO INTELLIGENCE PROPOSAL. Build the entire proposal around the LIVE SEO INTELLIGENCE data above. Every recommendation, strategy item, and ROI projection must cite specific numbers from the intel. The executive summary must open with the single most compelling data point (e.g. "$X/mo in wasted ad spend" or "Competitor Y owns $Z/mo in keyword value you don't"). Strategy items should each map to one of: attacking competitor keyword gaps, defending decaying pages, fixing wasted ad spend, adding schema to eligible pages, reclaiming broken backlinks. Services should be concrete SEO workstreams (Topical Authority Build, Content Decay Triage, Schema Deployment, Competitor Keyword Capture, etc.).` : ''

      const userPrompt = `Generate a marketing proposal for:
Client: ${clientNameStr}
Industry: ${industryStr}
Location: ${locationStr}
Business description: ${descriptionStr}
Primary service: ${primaryServiceStr}
Ideal customer: ${idealCustomerStr}
${painPointsStr ? `Customer pain points: ${painPointsStr}` : ''}
Current marketing budget: ${budgetStr}
Current channels: ${channelsStr}
CRM: ${crmStr}
Goals: ${goalsStr}
Competitors: ${competitorsStr}
Unique value: ${uvpStr}
${brandVoiceStr ? `Brand voice: ${brandVoiceStr}` : ''}
Agency: ${agencyName}
Proposed monthly investment: ${monthly_budget || 'TBD'}
${tone ? `Tone: ${tone}` : ''}
${focus_area ? `Primary focus area: ${focus_area}` : ''}
${Array.isArray(services) && services.length ? `Services to emphasize: ${services.join(', ')}` : ''}${seoContextBlock}${proposalInstruction}

Generate a complete proposal with these sections:
1. Executive Summary (2-3 paragraphs, specific to their business)
2. Situation Analysis (what we found, what's working, what's not)
3. Recommended Strategy (3-4 specific recommendations with rationale)
4. Proposed Services (specific services with what each includes)
5. Investment & ROI (pricing tiers, expected outcomes, timeline)
6. Why ${agencyName} (specific reasons this client should choose us)
7. Next Steps (clear 3-step call to action)

Return ONLY valid JSON (no markdown fences, no preamble) with this exact shape:
{
  "executive_summary": "string",
  "situation_analysis": "string",
  "strategy": [{ "title": "string", "description": "string", "rationale": "string" }],
  "services": [{ "name": "string", "description": "string", "deliverables": ["string"], "price_range": "string" }],
  "investment": { "starter": 0, "growth": 0, "accelerator": 0 },
  "roi_projections": [{ "metric": "string", "current": "string", "projected_90_days": "string", "projected_6_months": "string" }],
  "why_us": "string",
  "next_steps": ["string", "string", "string"],
  "proposal_headline": "string",
  "tagline": "string"
}`

      let proposalContent: any = null
      try {
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 4000,
            temperature: 0.7,
            system: 'You are a senior marketing strategist writing a proposal for a marketing agency. Write in a professional but approachable tone. Be specific — use the client\'s actual business details, not generic placeholders. Return ONLY valid JSON, no markdown.',
            messages: [{ role: 'user', content: userPrompt }],
          }),
          signal: AbortSignal.timeout(90000),
        })
        if (!claudeRes.ok) {
          const errText = await claudeRes.text()
          console.warn('[proposals/builder generate] Claude error:', claudeRes.status, errText.slice(0, 200))
          return NextResponse.json({ error: 'Claude generation failed', detail: errText.slice(0, 200) }, { status: 502 })
        }
        const claudeData = await claudeRes.json()
        const text = (claudeData.content || []).filter((cc: any) => cc.type === 'text').map((cc: any) => cc.text).join('').trim()
        const cleaned = text.replace(/```json\s*|```\s*$/g, '').trim()
        proposalContent = JSON.parse(cleaned)
        // Fire-and-forget token accounting
        void logTokenUsage({
          feature: 'proposal_generation',
          model: 'claude-sonnet-4-5-20250929',
          inputTokens: claudeData.usage?.input_tokens || 0,
          outputTokens: claudeData.usage?.output_tokens || 0,
          agencyId: agency_id,
          metadata: { client_id },
        })
      } catch (e: any) {
        console.warn('[proposals/builder generate] parse failed:', e?.message)
        return NextResponse.json({ error: 'Failed to parse proposal JSON', detail: e?.message }, { status: 500 })
      }

      let pdfBuffer: Buffer
      try {
        pdfBuffer = await renderProposalPdf({
          content: proposalContent,
          client,
          agencyName,
          primaryColor,
        })
      } catch (e: any) {
        console.warn('[proposals/builder generate] PDF failed:', e?.message)
        pdfBuffer = Buffer.from([])
      }

      // Persist the SEO intelligence snapshot alongside the proposal content
      // so the viewer can render the "data-backed" sidebar without re-fetching.
      if (seoEnrichment.has_kotoiq_data) {
        proposalContent.seo_intelligence = {
          proposal_type: isSeoIntelProposal ? 'seo_intelligence' : 'standard',
          wasted_ad_spend_monthly: seoEnrichment.wasted_ad_spend_monthly,
          topical_authority_score: seoEnrichment.topical_authority_score,
          authority_gap: seoEnrichment.authority_gap,
          decay_risk_pages: seoEnrichment.decay_risk_pages,
          decay_traffic_loss_estimate: seoEnrichment.decay_traffic_loss_estimate,
          missing_schema_count: seoEnrichment.missing_schema_count,
          broken_backlinks_count: seoEnrichment.broken_backlinks_count,
          total_opportunity_value: seoEnrichment.total_opportunity_value,
          top_competitors: seoEnrichment.specifics.top_competitors,
          top_commercial_gaps: seoEnrichment.specifics.top_commercial_gaps,
          declining_urls: seoEnrichment.specifics.declining_urls,
          quick_wins: seoEnrichment.quick_wins,
          generated_at: new Date().toISOString(),
        }
      }

      const { data: saved, error: saveErr } = await sb
        .from('koto_proposals')
        .insert({
          agency_id,
          client_id,
          status: 'draft',
          content: proposalContent,
          monthly_investment: monthly_budget || null,
          services: services || null,
        })
        .select()
        .single()

      if (saveErr) {
        console.warn('[proposals/builder generate] save failed:', saveErr.message)
        return NextResponse.json({ error: saveErr.message }, { status: 500 })
      }

      let pdfUrl: string | null = null
      if (pdfBuffer.length > 0) {
        try {
          const path = `proposals/${saved.id}.pdf`
          const upload = await sb.storage.from('review-files').upload(path, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          })
          if (!upload.error) {
            const { data: urlData } = sb.storage.from('review-files').getPublicUrl(path)
            pdfUrl = urlData.publicUrl
            await sb.from('koto_proposals').update({ pdf_url: pdfUrl }).eq('id', saved.id)
          }
        } catch (e: any) {
          console.warn('[proposals/builder generate] storage upload failed:', e?.message)
        }
      }

      return NextResponse.json({
        proposal_id: saved.id,
        pdf_url: pdfUrl,
        content: proposalContent,
        seo_intelligence_used: seoEnrichment.has_kotoiq_data,
        proposal_type: isSeoIntelProposal ? 'seo_intelligence' : 'standard',
        seo_summary: seoEnrichment.has_kotoiq_data ? {
          wasted_ad_spend_monthly: seoEnrichment.wasted_ad_spend_monthly,
          topical_authority_score: seoEnrichment.topical_authority_score,
          authority_gap: seoEnrichment.authority_gap,
          decay_risk_pages: seoEnrichment.decay_risk_pages,
          missing_schema_count: seoEnrichment.missing_schema_count,
          total_opportunity_value: seoEnrichment.total_opportunity_value,
          quick_win_count: seoEnrichment.quick_wins.length,
        } : null,
      })
    }

    if (action === 'update') {
      const { id, ...rest } = body
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      delete (rest as any).action
      ;(rest as any).updated_at = new Date().toISOString()
      const { data, error } = await sb.from('koto_proposals').update(rest).eq('id', id).select().maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ proposal: data })
    }

    if (action === 'mark_viewed') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      await sb.from('koto_proposals').update({
        viewed_at: new Date().toISOString(),
        status: 'viewed',
      }).eq('id', id).is('viewed_at', null)
      return NextResponse.json({ ok: true })
    }

    if (action === 'mark_accepted') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const acceptedAt = new Date().toISOString()
      const { data: proposal } = await sb.from('koto_proposals').update({
        accepted_at: acceptedAt,
        status: 'accepted',
      }).eq('id', id).select('id, agency_id, client_id, title, total_value').maybeSingle()

      if (proposal?.agency_id) {
        try {
          await sb.from('koto_notifications').insert({
            agency_id: proposal.agency_id,
            type: 'proposal_accepted',
            title: '🎉 Proposal accepted!',
            body: `A client just accepted your proposal`,
            link: `/clients/${proposal.client_id}`,
            icon: '🎉',
            metadata: { proposal_id: id, client_id: proposal.client_id },
          })
        } catch { /* non-fatal */ }

        // Scout: proposal_accepted activity + document status upgrade.
        // Resolves opportunity via (agency_id, client_id). Skips silently
        // if no linked opportunity.
        if (proposal.client_id) {
          try {
            const { data: opp } = await sb
              .from('koto_opportunities')
              .select('id')
              .eq('agency_id', proposal.agency_id)
              .eq('client_id', proposal.client_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (opp?.id) {
              await recordDocument({
                opportunityId: opp.id,
                documentType: 'proposal',
                documentId: (proposal as any).id,
                title: (proposal as any).title || null,
                status: 'accepted',
                totalValue: (proposal as any).total_value ?? null,
                acceptedAt,
              })
            }
          } catch { /* non-fatal */ }
        }
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[proposals/builder POST fatal]', e)
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// PDF rendering
// ─────────────────────────────────────────────────────────────

async function renderProposalPdf(opts: {
  content: any
  client: any
  agencyName: string
  primaryColor: string
}): Promise<Buffer> {
  const { content, client, agencyName, primaryColor } = opts
  const clientName = client?.name || 'Client'
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 60, bottom: 80, left: 60, right: 60 },
    bufferPages: true,
    info: {
      Title: `${clientName} — Marketing Proposal`,
      Author: agencyName,
      Subject: 'Marketing Proposal',
    },
  })

  const chunks: Buffer[] = []
  doc.on('data', (cc: Buffer) => chunks.push(cc))
  const finished = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  // ── Cover ──
  doc.rect(0, 0, doc.page.width, 220).fill(primaryColor)
  doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
    .text(agencyName.toUpperCase(), 60, 60, { characterSpacing: 1.5 })
  doc.fontSize(40).font('Helvetica-Bold').text('Marketing', 60, 100)
  doc.fontSize(40).font('Helvetica').text('Proposal', 60, 140)

  doc.fillColor('#111111').fontSize(28).font('Helvetica-Bold')
    .text(clientName, 60, 280)

  if (content.proposal_headline) {
    doc.moveDown(0.5)
    doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Oblique')
      .text(content.proposal_headline, 60, undefined, { width: doc.page.width - 120 })
  }

  doc.moveDown(2)
  doc.fillColor('#6b7280').fontSize(11).font('Helvetica').text(`Prepared on ${today}`, 60)
  doc.text(`By ${agencyName}`, 60)

  // ── Executive Summary ──
  doc.addPage()
  pageHeader(doc, 'Executive Summary', primaryColor)
  paragraph(doc, content.executive_summary)

  // ── Situation Analysis ──
  doc.addPage()
  pageHeader(doc, 'Situation Analysis', primaryColor)
  paragraph(doc, content.situation_analysis)

  // ── Strategy ──
  doc.addPage()
  pageHeader(doc, 'Recommended Strategy', primaryColor)
  ;(content.strategy || []).forEach((s: any, i: number) => {
    doc.fillColor(primaryColor).fontSize(13).font('Helvetica-Bold')
      .text(`${i + 1}. ${s.title || ''}`)
    doc.moveDown(0.2)
    doc.fillColor('#374151').fontSize(11).font('Helvetica')
      .text(s.description || '', { lineGap: 3 })
    if (s.rationale) {
      doc.moveDown(0.3)
      doc.fillColor('#6b7280').fontSize(10).font('Helvetica-Oblique')
        .text(`Rationale: ${s.rationale}`, { lineGap: 2 })
    }
    doc.moveDown(0.8)
  })

  // ── Services ──
  doc.addPage()
  pageHeader(doc, 'Proposed Services', primaryColor)
  ;(content.services || []).forEach((svc: any) => {
    doc.fillColor('#111111').fontSize(13).font('Helvetica-Bold').text(svc.name || '')
    doc.moveDown(0.2)
    doc.fillColor('#374151').fontSize(11).font('Helvetica').text(svc.description || '')
    if (Array.isArray(svc.deliverables) && svc.deliverables.length > 0) {
      doc.moveDown(0.3)
      svc.deliverables.forEach((d: string) => {
        doc.fillColor('#374151').fontSize(10).text(`  • ${d}`)
      })
    }
    if (svc.price_range) {
      doc.moveDown(0.2)
      doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text(svc.price_range)
    }
    doc.moveDown(0.8)
  })

  // ── Investment & ROI ──
  doc.addPage()
  pageHeader(doc, 'Investment & ROI', primaryColor)

  if (content.investment) {
    const tiers = [
      { label: 'Starter', value: content.investment.starter || 0 },
      { label: 'Growth', value: content.investment.growth || 0 },
      { label: 'Accelerator', value: content.investment.accelerator || 0 },
    ]
    const startX = 60
    const tierWidth = (doc.page.width - 120 - 20) / 3
    const yStart = doc.y
    tiers.forEach((tier, i) => {
      const x = startX + i * (tierWidth + 10)
      doc.roundedRect(x, yStart, tierWidth, 90, 10).fillColor('#f9fafb').fill()
      doc.fillColor('#6b7280').fontSize(10).font('Helvetica-Bold')
        .text(tier.label.toUpperCase(), x + 14, yStart + 16, { characterSpacing: 1, width: tierWidth - 28 })
      doc.fillColor(primaryColor).fontSize(22).font('Helvetica-Bold')
        .text(`$${Number(tier.value).toLocaleString()}`, x + 14, yStart + 32, { width: tierWidth - 28 })
      doc.fillColor('#9ca3af').fontSize(9).font('Helvetica')
        .text('/ month', x + 14, yStart + 60, { width: tierWidth - 28 })
    })
    doc.y = yStart + 110
  }

  if (Array.isArray(content.roi_projections) && content.roi_projections.length > 0) {
    doc.moveDown(0.5)
    doc.fillColor('#111111').fontSize(13).font('Helvetica-Bold').text('Projected Outcomes')
    doc.moveDown(0.3)
    content.roi_projections.forEach((roi: any) => {
      doc.fillColor('#374151').fontSize(10).font('Helvetica')
        .text(`${roi.metric}: ${roi.current} → ${roi.projected_90_days} (90d) → ${roi.projected_6_months} (6mo)`, { lineGap: 4 })
    })
  }

  // ── Why us ──
  doc.addPage()
  pageHeader(doc, `Why ${agencyName}`, primaryColor)
  paragraph(doc, content.why_us)

  // ── Next Steps ──
  doc.addPage()
  pageHeader(doc, 'Next Steps', primaryColor)
  ;(content.next_steps || []).forEach((step: string, i: number) => {
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
      .text(`${i + 1}.`, { continued: true })
    doc.fillColor('#111111').font('Helvetica').text(`  ${step}`)
    doc.moveDown(0.5)
  })

  // ── Footer on every page ──
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)
    const footerY = doc.page.height - 50
    doc.fillColor('#9ca3af').fontSize(8).font('Helvetica')
      .text(`${agencyName}  ·  Proposal for ${clientName}`, 60, footerY, { width: doc.page.width - 120, align: 'left' })
    doc.text(`Page ${i + 1} of ${range.count}`, 60, footerY, { width: doc.page.width - 120, align: 'right' })
  }

  doc.end()
  return finished
}

function pageHeader(doc: PDFKit.PDFDocument, title: string, color: string) {
  doc.rect(0, 0, doc.page.width, 8).fill(color)
  doc.fillColor('#111111').fontSize(24).font('Helvetica-Bold').text(title, 60, 50)
  doc.moveDown(1.5)
}

function paragraph(doc: PDFKit.PDFDocument, text: string) {
  if (!text) return
  doc.fillColor('#374151').fontSize(11).font('Helvetica')
    .text(text, { lineGap: 4, align: 'left' })
}
