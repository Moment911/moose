import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// LLM Rules Loader — reads admin overrides from koto_llm_rules table.
//
// Usage in prompt builders:
//   const override = await getLLMRule('coach_voice')
//   const voice = override || COACH_VOICE  // DB wins, code is fallback
//
// Cached in-memory for 60 seconds to avoid DB reads on every chat turn.
// ─────────────────────────────────────────────────────────────────────────────

let cache: Record<string, string> = {}
let cacheTime = 0
const CACHE_TTL = 60_000 // 60 seconds

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function loadAll(): Promise<Record<string, string>> {
  if (Date.now() - cacheTime < CACHE_TTL && Object.keys(cache).length > 0) {
    return cache
  }
  try {
    const sb = getDb()
    const { data } = await sb.from('koto_llm_rules').select('section_key, content')
    const rules: Record<string, string> = {}
    for (const row of (data || [])) {
      if (row.content && row.content.trim()) {
        rules[row.section_key] = row.content
      }
    }
    cache = rules
    cacheTime = Date.now()
    return rules
  } catch {
    return cache // Return stale cache on error
  }
}

export async function getLLMRule(sectionKey: string): Promise<string | null> {
  const rules = await loadAll()
  return rules[sectionKey] || null
}

export async function getAllLLMRules(): Promise<Record<string, string>> {
  return loadAll()
}

// Force cache refresh (call after admin saves)
export function invalidateLLMRulesCache(): void {
  cacheTime = 0
}
