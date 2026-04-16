/**
 * LLM Config Builder -- ported from backend/src/services/llmConfigBuilder.js.
 * Produces a tenant-ready LLM configuration + system prompt by merging:
 *   1. Platform defaults
 *   2. Industry overrides (temperature, compliance rules, emergency keywords)
 *   3. Tenant intake answers (companyName, services, etc.)
 *
 * Returned config is safe to store in koto_inbound_agents.llm_config jsonb,
 * and the rendered systemPromptTemplate is what Retell's LLM should receive.
 */
import { renderTemplate } from './template'

export type LLMConfig = {
  model: string
  temperature: number
  maxTokens: number
  systemPromptTemplate: string
  responseGuidelines?: {
    tone?: string
    style?: string
    length?: string
    greeting?: string
    avoid?: string[]
    include?: string[]
    [k: string]: any
  }
  knowledgeRetrieval?: {
    maxResults?: number
    confidenceThreshold?: number
    contextWindow?: number
    fallbackBehavior?: 'admit_uncertainty' | 'transfer_human' | 'take_message'
  }
  callHandling?: {
    maxCallDuration?: number
    transferTimeout?: number
    emergencyKeywords?: string[]
    endCallPhrases?: string[]
    holdMusic?: boolean
    emergencyTransferNumber?: string
    emergencyTransferImmediate?: boolean
  }
  complianceRules?: {
    recordCalls?: boolean
    dataRetention?: string
    privacyNotice?: boolean
    consentRequired?: boolean
    hipaaCompliant?: boolean
    prohibitedTopics?: string[]
    disclaimers?: string[]
  }
  emergencyKeywords?: string[]
  voiceId?: string
  [k: string]: any
}

export type Industry = {
  slug: string
  displayName: string
  defaultGreeting: string
  systemPromptTemplate: string
  topicBoundaries?: { allowed?: string[]; forbidden?: string[] } | null
  intakeSchema?: any
  llmOverrides?: Partial<LLMConfig> & Record<string, any>
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  model: 'claude-haiku-4-5-20251001',
  temperature: 0.1,
  maxTokens: 1000,
  systemPromptTemplate: [
    'You are a professional AI assistant for {{companyName}}, a {{industry}} business. You are answering their business phone line.',
    '',
    'CORE INSTRUCTIONS:',
    '- Be helpful, professional, and knowledgeable about {{industry}} services',
    '- Speak naturally and conversationally, avoid robotic responses',
    '- Keep responses concise but complete',
    '- Always confirm important details before taking action',
    "- If you're unsure about something, say so rather than guessing",
    '',
    'COMPANY CONTEXT:',
    '{{companyContext}}',
    '',
    'TOPIC BOUNDARIES:',
    '{{topicBoundaries}}',
    '',
    'CALL HANDLING:',
    "- Greet callers warmly and identify yourself as {{companyName}}'s AI assistant",
    '- Gather basic information: name, phone, reason for calling',
    '- For emergencies or urgent matters, transfer immediately to {{emergencyNumber}}',
    '- For general inquiries, provide helpful information or schedule callbacks',
    '- Always offer to connect them with a human representative',
    '',
    'KNOWLEDGE BASE:',
    "Use the company's knowledge base to answer specific questions about:",
    '- Services offered',
    '- Pricing and packages',
    '- Business hours and availability',
    '- Company policies and procedures',
    '- Contact information and locations',
    '',
    "If asked about something outside your knowledge or expertise, politely redirect: \"I'd be happy to connect you with one of our specialists who can help with that specific question.\"",
    '',
    'Remember: You represent {{companyName}} professionally. Every interaction should leave the caller with a positive impression.',
  ].join('\n'),
  responseGuidelines: {
    tone: 'professional yet approachable',
    style: 'conversational',
    length: 'concise but complete',
    avoid: ['technical jargon', 'overly formal language', 'assumptions'],
    include: ['confirmation of details', 'next steps', 'offer to transfer'],
  },
  knowledgeRetrieval: {
    maxResults: 5,
    confidenceThreshold: 0.7,
    contextWindow: 2000,
    fallbackBehavior: 'admit_uncertainty',
  },
  callHandling: {
    maxCallDuration: 900,
    transferTimeout: 30,
    emergencyKeywords: ['emergency', 'urgent', 'immediate', 'asap'],
    endCallPhrases: ['goodbye', 'thank you', "that's all"],
    holdMusic: true,
  },
  complianceRules: {
    recordCalls: true,
    dataRetention: '7 years',
    privacyNotice: true,
    consentRequired: false,
  },
}

function deepMerge<T extends Record<string, any>>(base: T, override: Record<string, any>): T {
  const merged: any = { ...base }
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      merged[k] = { ...(merged[k] || {}), ...v }
    } else {
      merged[k] = v
    }
  }
  return merged as T
}

function formatTopicBoundaries(boundaries?: Industry['topicBoundaries']): string {
  if (!boundaries || (!boundaries.allowed?.length && !boundaries.forbidden?.length)) {
    return 'Stay focused on company services and general business inquiries.'
  }
  const parts: string[] = []
  if (boundaries.allowed?.length) {
    parts.push(`TOPICS TO HELP WITH:\n- ${boundaries.allowed.join('\n- ')}`)
  }
  if (boundaries.forbidden?.length) {
    parts.push(`TOPICS TO AVOID:\n- ${boundaries.forbidden.join('\n- ')}\n- Politely redirect these to human specialists`)
  }
  return parts.join('\n\n')
}

function buildCompanyContext(intake: Record<string, any>): string {
  const lines: string[] = []
  if (intake.companyName) lines.push(`Company: ${intake.companyName}`)
  if (intake.servicesOffered) {
    const s = Array.isArray(intake.servicesOffered) ? intake.servicesOffered.join(', ') : intake.servicesOffered
    lines.push(`Services: ${s}`)
  } else if (intake.services) {
    lines.push(`Services: ${intake.services}`)
  }
  if (intake.serviceArea) lines.push(`Service Area: ${intake.serviceArea}`)
  if (intake.hours) lines.push(`Hours: ${intake.hours}`)
  if (intake.specialties) lines.push(`Specialties: ${intake.specialties}`)
  if (intake.websiteUrl) lines.push(`Website: ${intake.websiteUrl}`)
  return lines.join('\n') || 'No additional company context provided.'
}

export function validateConfig(config: LLMConfig): LLMConfig {
  const required: (keyof LLMConfig)[] = ['model', 'temperature', 'systemPromptTemplate']
  for (const field of required) {
    if (config[field] === undefined || config[field] === null || config[field] === '') {
      throw new Error(`Missing required LLM config field: ${field}`)
    }
  }
  config.temperature = Math.max(0, Math.min(1, config.temperature))
  if (config.maxTokens != null) {
    config.maxTokens = Math.max(100, Math.min(4000, config.maxTokens))
  }
  return config
}

/**
 * Build a full LLM config for an industry + tenant intake.
 * Stores industry-rendered template in `systemPromptTemplate` (with {{companyName}}
 * etc. substituted); the final agent-build step will substitute the runtime
 * variables ({{companyKnowledge}}, {{hoursDescription}}, {{routingDescription}}).
 */
export function buildLLMConfig(industry: Industry, intake: Record<string, any> = {}): LLMConfig {
  let config: LLMConfig = JSON.parse(JSON.stringify(DEFAULT_LLM_CONFIG))

  if (industry.llmOverrides) {
    config = deepMerge(config, industry.llmOverrides)
  }

  // Use industry's systemPromptTemplate if provided; otherwise keep default.
  if (industry.systemPromptTemplate) {
    config.systemPromptTemplate = industry.systemPromptTemplate
  }

  // Substitute industry + intake statics into the template (runtime vars left).
  const vars: Record<string, any> = {
    ...intake,
    industry: industry.displayName.toLowerCase(),
    topicBoundaries: formatTopicBoundaries(industry.topicBoundaries),
    companyContext: buildCompanyContext(intake),
    emergencyNumber: intake.emergencyNumber || intake.mainPhone || '[emergency number not set]',
    additionalRestrictions: intake.additionalRestrictions || '',
    allowedTopics: Array.isArray(intake.allowedTopics) ? intake.allowedTopics.join(', ') : (intake.allowedTopics || (industry.topicBoundaries?.allowed || []).join(', ')),
    roleDescription: intake.roleDescription || `Answer calls professionally on behalf of ${intake.companyName || 'this business'}.`,
  }

  // We render TWICE: once here for industry/intake-static variables, and again
  // at agent-build time for runtime variables ({{companyKnowledge}}, {{hoursDescription}},
  // {{routingDescription}}, {{practiceAreas}}). Keep unresolved ones as-is instead
  // of "[not provided]" -- allow the second pass to fill them.
  const preserveUnresolved = (tpl: string, v: Record<string, any>) =>
    tpl.replace(/\{\{\s*([^}|]+?)(?:\s*\|\s*([^}]+?))?\s*\}\}/g, (match, key: string, fallback?: string) => {
      const path = key.trim().split('.')
      let val: any = v
      for (const p of path) {
        val = val?.[p]
        if (val === undefined) break
      }
      if (val === undefined || val === null || val === '') return match // leave for pass 2
      if (Array.isArray(val)) return val.join(', ')
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    })

  config.systemPromptTemplate = preserveUnresolved(config.systemPromptTemplate, vars)

  if (!config.responseGuidelines) config.responseGuidelines = {}
  if (!config.responseGuidelines.greeting) {
    config.responseGuidelines.greeting = renderTemplate(industry.defaultGreeting, vars)
  }

  return validateConfig(config)
}

/**
 * Final agent-build rendering: substitute runtime variables into the stored
 * systemPromptTemplate just before shipping to Retell.
 */
export function renderAgentPrompt(
  storedTemplate: string,
  runtimeVars: {
    companyKnowledge?: string
    hoursDescription?: string
    routingDescription?: string
    [k: string]: any
  }
): string {
  return renderTemplate(storedTemplate, runtimeVars)
}

/**
 * Available models for the LLM model dropdown in the dashboard.
 * Kept small + current -- matches Koto's canonical Claude set.
 */
export const AVAILABLE_LLM_MODELS = [
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    costPer1kTokens: 0.25,
    maxTokens: 4000,
    recommended: true,
    description: 'Fast, cost-efficient -- ideal for real-time phone agents',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    costPer1kTokens: 3.0,
    maxTokens: 4000,
    description: 'Balanced reasoning + speed. Use for nuanced intake.',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'Anthropic',
    costPer1kTokens: 15.0,
    maxTokens: 4000,
    description: 'Highest reasoning -- only for complex, high-stakes calls.',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    costPer1kTokens: 5.0,
    maxTokens: 4000,
    description: 'OpenAI option for Retell-native integration.',
  },
] as const

export function estimateCostPerCall(config: LLMConfig, avgTokensPerCall = 500): number {
  const model = AVAILABLE_LLM_MODELS.find(m => m.id === config.model)
  const costPer1k = model?.costPer1kTokens ?? 1.0
  return (avgTokensPerCall / 1000) * costPer1k
}
