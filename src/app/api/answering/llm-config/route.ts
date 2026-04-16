/**
 * GET  /api/answering/llm-config?agent_id=...
 *   Returns the agent's stored llm_config + industry metadata. If the agent
 *   has no llm_config yet, returns a freshly-built default from the industry.
 *
 * PUT  /api/answering/llm-config  { agent_id, llm_config }
 *   Validates and saves the LLM config onto koto_inbound_agents.llm_config
 *   jsonb. Does NOT push to Retell -- that's a separate "rebuild agent" step.
 *
 * POST /api/answering/llm-config  { agent_id, llm_config?, variables? }
 *   action=preview: render the system prompt with the given runtime variables
 *   without saving anything. Used by the dashboard preview pane.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildLLMConfig, renderAgentPrompt, validateConfig, LLMConfig, AVAILABLE_LLM_MODELS, estimateCostPerCall } from '@/lib/answering/llmConfigBuilder'
import { getIndustryBySlug } from '@/lib/answering/industries'
import { describeHours } from '@/lib/answering/hours'
import { describeRouting } from '@/lib/answering/routingDescription'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function getAgentWithConfig(agentId: string) {
  const supabase = sb()
  const { data: agent } = await supabase
    .from('koto_inbound_agents')
    .select('id, name, industry_slug, industry, sic_code, llm_config, topic_boundaries, business_hours, timezone, intake_questions, business_name:name')
    .eq('id', agentId)
    .maybeSingle()
  if (!agent) return { agent: null, targets: [] }
  const { data: targets } = await supabase
    .from('koto_inbound_routing_targets')
    .select('id, label, phone_number, email, priority, conditions')
    .eq('agent_id', agentId)
    .order('priority', { ascending: true })
  return { agent, targets: targets || [] }
}

function intakeFromAgent(agent: any) {
  return {
    companyName: agent.name || agent.business_name || 'this company',
    servicesOffered: agent.intake_questions
      ? (agent.intake_questions as any[]).map(q => q.text).join('; ')
      : undefined,
  }
}

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agent_id')
  if (!agentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

  const { agent } = await getAgentWithConfig(agentId)
  if (!agent) return NextResponse.json({ error: 'agent_not_found' }, { status: 404 })

  const industrySlug = agent.industry_slug || agent.industry || 'generic'
  const industry = getIndustryBySlug(industrySlug) || getIndustryBySlug('generic')!

  let llmConfig: LLMConfig
  if (agent.llm_config && Object.keys(agent.llm_config).length > 0) {
    llmConfig = agent.llm_config as LLMConfig
  } else {
    llmConfig = buildLLMConfig(industry, intakeFromAgent(agent))
  }

  return NextResponse.json({
    llmConfig,
    industry: {
      slug: industry.slug,
      displayName: industry.displayName,
      topicBoundaries: industry.topicBoundaries,
    },
    models: AVAILABLE_LLM_MODELS,
    estimatedCostPerCall: estimateCostPerCall(llmConfig),
  })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { agent_id, llm_config, industry_slug } = body
  if (!agent_id || !llm_config) {
    return NextResponse.json({ error: 'agent_id and llm_config required' }, { status: 400 })
  }

  let validated: LLMConfig
  try {
    validated = validateConfig(llm_config)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'invalid_config' }, { status: 400 })
  }

  const supabase = sb()
  const update: Record<string, any> = { llm_config: validated, updated_at: new Date().toISOString() }
  if (industry_slug) update.industry_slug = industry_slug

  const { data, error } = await supabase
    .from('koto_inbound_agents')
    .update(update)
    .eq('id', agent_id)
    .select('id, name, industry_slug, llm_config')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, agent: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { action, agent_id, llm_config, variables } = body

  if (action === 'preview' && agent_id) {
    const { agent, targets } = await getAgentWithConfig(agent_id)
    if (!agent) return NextResponse.json({ error: 'agent_not_found' }, { status: 404 })

    const industrySlug = agent.industry_slug || agent.industry || 'generic'
    const industry = getIndustryBySlug(industrySlug) || getIndustryBySlug('generic')!

    const cfg: LLMConfig = llm_config
      ? validateConfig(llm_config)
      : (agent.llm_config && Object.keys(agent.llm_config).length > 0
          ? agent.llm_config as LLMConfig
          : buildLLMConfig(industry, intakeFromAgent(agent)))

    const runtimeVars = {
      companyName: agent.name,
      companyKnowledge: variables?.companyKnowledge || '(company knowledge chunks will be injected at call time)',
      hoursDescription: describeHours(agent.business_hours, agent.timezone),
      routingDescription: describeRouting(targets as any),
      ...(variables || {}),
    }

    const systemPrompt = renderAgentPrompt(cfg.systemPromptTemplate, runtimeVars)
    const greeting = cfg.responseGuidelines?.greeting
      ? renderAgentPrompt(cfg.responseGuidelines.greeting, runtimeVars)
      : renderAgentPrompt(industry.defaultGreeting, runtimeVars)

    return NextResponse.json({
      systemPrompt,
      greeting,
      llmConfig: cfg,
      variables: runtimeVars,
      estimatedCostPerCall: estimateCostPerCall(cfg),
    })
  }

  if (action === 'rebuild_from_industry' && agent_id) {
    const { agent } = await getAgentWithConfig(agent_id)
    if (!agent) return NextResponse.json({ error: 'agent_not_found' }, { status: 404 })
    const industrySlug = body.industry_slug || agent.industry_slug || agent.industry || 'generic'
    const industry = getIndustryBySlug(industrySlug) || getIndustryBySlug('generic')!
    const fresh = buildLLMConfig(industry, { ...intakeFromAgent(agent), ...(body.intake || {}) })

    const supabase = sb()
    await supabase
      .from('koto_inbound_agents')
      .update({
        industry_slug: industrySlug,
        llm_config: fresh,
        topic_boundaries: industry.topicBoundaries || { allowed: [], forbidden: [] },
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent_id)
    return NextResponse.json({ success: true, llmConfig: fresh, industry: { slug: industrySlug, displayName: industry.displayName } })
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
}
