import 'server-only' // fails the build if this module is ever imported from a client component
// ── Industry LLM Engine ──────────────────────────────────────────────────────
// Generates industry-specific AI configurations, Q&A banks, and learning loops.

import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export interface IndustryLLMConfig {
  sic_code: string
  industry_name: string
  system_prompt_prefix: string
  discovery_questions: string[]
  objection_handlers: Record<string, string>
  closing_scripts: string[]
  vocabulary: string[]
  avoid_words: string[]
  tone: string
  pace: string
  key_metrics: Record<string, string>
  benchmark_talking_points: string[]
}

export async function getIndustryConfig(sicCode: string): Promise<IndustryLLMConfig | null> {
  const supabase = getSupabase()

  // Check for existing config
  const { data: config } = await supabase
    .from('koto_industry_llm_configs')
    .select('*')
    .eq('industry_sic_code', sicCode)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (config) return config.config_data as IndustryLLMConfig

  // Fall back to industry intelligence
  const { data: intel } = await supabase
    .from('koto_industry_intelligence')
    .select('*')
    .eq('industry_sic_code', sicCode)
    .maybeSingle()

  if (!intel) return null

  return {
    sic_code: sicCode,
    industry_name: intel.industry_name || 'Unknown',
    system_prompt_prefix: `You are calling ${intel.industry_name} businesses.`,
    discovery_questions: intel.best_discovery_questions || [],
    objection_handlers: {},
    closing_scripts: intel.best_closing_lines || [],
    vocabulary: intel.industry_terminology || [],
    avoid_words: [],
    tone: 'professional',
    pace: 'normal',
    key_metrics: {},
    benchmark_talking_points: [],
  }
}

export async function generateIndustryLLMConfig(
  sicCode: string,
  industryName: string
): Promise<IndustryLLMConfig> {
  const supabase = getSupabase()
  const apiKey = process.env.ANTHROPIC_API_KEY || ''

  // Get existing intelligence
  const { data: intel } = await supabase
    .from('koto_industry_intelligence')
    .select('*')
    .eq('industry_sic_code', sicCode)
    .maybeSingle()

  // Get existing Q&A pairs for this industry
  const { data: qaData } = await supabase
    .from('koto_qa_intelligence')
    .select('question_text, question_type, appointment_rate_when_asked')
    .eq('industry_sic_code', sicCode)
    .order('appointment_rate_when_asked', { ascending: false })
    .limit(20)

  const topQuestions = (qaData || []).map((q: any) => q.question_text)

  let config: IndustryLLMConfig = {
    sic_code: sicCode,
    industry_name: industryName,
    system_prompt_prefix: `You are an expert at calling ${industryName} businesses. You understand their challenges, speak their language, and know exactly what motivates them.`,
    discovery_questions: topQuestions.slice(0, 7),
    objection_handlers: {},
    closing_scripts: [],
    vocabulary: intel?.industry_terminology || [],
    avoid_words: [],
    tone: 'consultative',
    pace: 'normal',
    key_metrics: {},
    benchmark_talking_points: [],
  }

  // Use Claude to enhance if API key available
  if (apiKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{ role: 'user', content: `For the ${industryName} industry (SIC ${sicCode}), provide a JSON object with: vocabulary (10 industry terms), avoid_words (5 words to never say), tone (one word), benchmark_talking_points (3 stats agents should reference), closing_scripts (2 meeting ask scripts). Return ONLY valid JSON.` }],
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const data = await res.json()
        const text = data.content?.[0]?.text || ''
        try {
          const parsed = JSON.parse(text)
          if (parsed.vocabulary) config.vocabulary = parsed.vocabulary
          if (parsed.avoid_words) config.avoid_words = parsed.avoid_words
          if (parsed.tone) config.tone = parsed.tone
          if (parsed.benchmark_talking_points) config.benchmark_talking_points = parsed.benchmark_talking_points
          if (parsed.closing_scripts) config.closing_scripts = parsed.closing_scripts
        } catch { /* use defaults */ }
      }
    } catch { /* use defaults */ }
  }

  // Save config
  await supabase.from('koto_industry_llm_configs').insert({
    industry_sic_code: sicCode,
    industry_name: industryName,
    config_data: config,
    is_active: true,
    version: 1,
    generated_by: apiKey ? 'claude' : 'template',
  })

  return config
}

export async function generateIndustryQABank(
  sicCode: string,
  industryName: string
): Promise<number> {
  const supabase = getSupabase()
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey) return 0

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: `Generate 10 Q&A pairs for cold-calling ${industryName} businesses. Each pair: a discovery/objection question and the best response. Return JSON array: [{question, answer, type}] where type is discovery/objection/closing. Questions should be natural spoken language.` }],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) return 0
    const data = await res.json()
    const text = data.content?.[0]?.text || ''

    let pairs: any[] = []
    try { pairs = JSON.parse(text) } catch { return 0 }
    if (!Array.isArray(pairs)) return 0

    let inserted = 0
    for (const pair of pairs) {
      if (!pair.question || !pair.answer) continue
      const norm = pair.question.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()

      const { data: existing } = await supabase
        .from('koto_qa_intelligence')
        .select('id')
        .eq('question_normalized', norm)
        .maybeSingle()

      if (!existing) {
        await supabase.from('koto_qa_intelligence').insert({
          question_text: pair.question,
          question_normalized: norm,
          question_type: pair.type || 'discovery',
          question_source: 'ai_generated',
          industry_sic_code: sicCode,
          industry_name: industryName,
          times_asked: 0,
          total_calls_with_question: 0,
        })

        // Also add the answer
        const { data: qRow } = await supabase
          .from('koto_qa_intelligence')
          .select('id')
          .eq('question_normalized', norm)
          .single()

        if (qRow) {
          await supabase.from('koto_answer_intelligence').insert({
            question_id: qRow.id,
            answer_text: pair.answer,
            answer_normalized: pair.answer.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(),
            answer_source: 'ai_generated',
            answer_type: 'neutral',
            effectiveness_score: 65,
          })
        }
        inserted++
      }
    }

    // Log learning
    await supabase.from('koto_industry_learning_log').insert({
      industry_sic_code: sicCode,
      event_type: 'qa_bank_generated',
      details: { pairs_generated: pairs.length, pairs_inserted: inserted },
    })

    return inserted
  } catch { return 0 }
}

export async function refreshIndustryFromCalls(sicCode: string, minCalls = 10): Promise<void> {
  const supabase = getSupabase()

  const { count } = await supabase
    .from('koto_call_qa_instances')
    .select('*', { count: 'exact', head: true })
    .eq('industry_sic_code', sicCode)

  if (!count || count < minCalls) return

  // Get top-performing questions for this industry
  const { data: topQs } = await supabase
    .from('koto_qa_intelligence')
    .select('question_text, appointment_rate_when_asked, times_asked')
    .eq('industry_sic_code', sicCode)
    .gte('times_asked', 3)
    .order('appointment_rate_when_asked', { ascending: false })
    .limit(10)

  if (!topQs?.length) return

  // Update industry intelligence with best questions
  await supabase.from('koto_industry_intelligence').update({
    best_discovery_questions: topQs.map((q: any) => q.question_text),
    call_transcripts_analyzed: count,
  }).eq('industry_sic_code', sicCode)

  // Log
  await supabase.from('koto_industry_learning_log').insert({
    industry_sic_code: sicCode,
    event_type: 'refresh_from_calls',
    details: { calls_analyzed: count, top_questions: topQs.length },
  })
}
