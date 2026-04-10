import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '@/lib/apiAuth'
import { HELP_ARTICLES, MODULE_META, MODULE_ORDER, articlesByModule, getArticle } from '@/lib/helpContent'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_AGENCY = '00000000-0000-0000-0000-000000000099'

// ─────────────────────────────────────────────────────────────
// Search helpers — we search the in-memory HELP_ARTICLES array
// as a fallback even if the DB hasn't been seeded yet. This
// means the help center works out-of-the-box.
// ─────────────────────────────────────────────────────────────
function scoreArticleForQuery(article: typeof HELP_ARTICLES[number], q: string): number {
  const needle = q.toLowerCase().trim()
  if (!needle) return 0
  let score = 0
  if (article.title.toLowerCase().includes(needle)) score += 50
  if (article.summary.toLowerCase().includes(needle)) score += 20
  for (const k of article.keywords) {
    if (k.toLowerCase().includes(needle)) score += 15
  }
  if (article.content.toLowerCase().includes(needle)) score += 5
  // Also word-level — if each query word shows up somewhere, add a small bonus
  const words = needle.split(/\s+/).filter((w) => w.length > 2)
  for (const w of words) {
    if (article.title.toLowerCase().includes(w)) score += 5
    else if (article.content.toLowerCase().includes(w)) score += 1
  }
  return score
}

function searchArticlesLocal(q: string, limit = 10) {
  return HELP_ARTICLES
    .map((a) => ({ article: a, score: scoreArticleForQuery(a, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.article)
}

// ─────────────────────────────────────────────────────────────
// Module slug → article count
// ─────────────────────────────────────────────────────────────
function moduleCounts() {
  const counts: Record<string, number> = {}
  for (const a of HELP_ARTICLES) counts[a.module] = (counts[a.module] || 0) + 1
  return counts
}

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'list'

    // ── modules ────────────────────────────────────────
    if (action === 'modules') {
      const counts = moduleCounts()
      return Response.json({
        data: MODULE_ORDER.map((slug) => ({
          slug,
          label: MODULE_META[slug]?.label || slug,
          icon: MODULE_META[slug]?.icon || '',
          description: MODULE_META[slug]?.description || '',
          article_count: counts[slug] || 0,
        })),
      })
    }

    // ── list ───────────────────────────────────────────
    if (action === 'list') {
      const module = searchParams.get('module') || ''
      const articles = module ? articlesByModule(module) : HELP_ARTICLES
      return Response.json({
        data: articles.map((a) => ({
          slug: a.slug,
          module: a.module,
          section: a.section || null,
          title: a.title,
          summary: a.summary,
          order_in_module: a.order_in_module,
        })),
      })
    }

    // ── get ────────────────────────────────────────────
    if (action === 'get') {
      const slug = searchParams.get('slug') || ''
      if (!slug) return Response.json({ error: 'Missing slug' }, { status: 400 })
      const article = getArticle(slug)
      if (!article) return Response.json({ error: 'Not found' }, { status: 404 })
      return Response.json({ data: article })
    }

    // ── search ─────────────────────────────────────────
    if (action === 'search') {
      const q = (searchParams.get('q') || '').trim()
      if (q.length < 2) return Response.json({ data: [] })
      const results = searchArticlesLocal(q, 10)
      return Response.json({
        data: results.map((a) => ({
          slug: a.slug,
          module: a.module,
          title: a.title,
          summary: a.summary,
        })),
      })
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
    const agencyId = resolveAgencyId(req, searchParams, body) || DEFAULT_AGENCY

    // ── ask (AI help) ──────────────────────────────────
    if (action === 'ask') {
      const question = typeof body.question === 'string' ? body.question.trim() : ''
      const contextPage = typeof body.context_page === 'string' ? body.context_page : ''
      if (!question) return Response.json({ error: 'Missing question' }, { status: 400 })

      // 1. Find the top 3 relevant articles by keyword scoring
      const topArticles = searchArticlesLocal(question, 3)

      // 2. Also include page-specific module context
      const pageModule = moduleFromPath(contextPage)
      const pageArticles = pageModule ? articlesByModule(pageModule).slice(0, 3) : []

      // De-dupe
      const seen = new Set<string>()
      const contextArticles = [...topArticles, ...pageArticles].filter((a) => {
        if (seen.has(a.slug)) return false
        seen.add(a.slug)
        return true
      }).slice(0, 4)

      // 3. Build the system prompt
      const articleBlocks = contextArticles.map((a) => `## ${a.title}\nmodule: ${a.module}\n\n${a.content}`).join('\n\n---\n\n')
      const system = `You are the Koto Help Assistant. You only answer questions about Koto — a marketing agency operating system built at hellokoto.com. You have access to the following Koto documentation:

${articleBlocks}

Rules:
- Only answer questions about Koto features and how to use them
- If the question is about something not in Koto, say "That feature is not currently in Koto"
- Be specific and step-by-step when explaining how to do something
- Reference exact button names, locations, and menu items as they appear in the UI
- Keep answers concise — 2-4 short paragraphs or a numbered list
- If you're not sure, say so and direct them to hellokoto.com/help
- Never make up features or claim Koto can do something it cannot`

      const userMessage = `${question}\n\nCurrent page: ${contextPage || '(unknown)'}`

      const apiKey = process.env.ANTHROPIC_API_KEY || ''
      let answer = ''
      if (!apiKey) {
        answer = `I can't reach the AI backend right now (ANTHROPIC_API_KEY is not set), but here's what I can tell you from the docs:\n\n${contextArticles[0]?.summary || 'Try browsing the help articles for the topic you need.'}`
      } else {
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
              max_tokens: 800,
              temperature: 0,
              system,
              messages: [{ role: 'user', content: userMessage }],
            }),
            signal: AbortSignal.timeout(20000),
          })
          if (res.ok) {
            const d: any = await res.json()
            answer = (d.content || [])
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n')
              .trim()
          } else {
            const t = await res.text().catch(() => '')
            answer = `(AI error ${res.status}) ${t.slice(0, 150)}`
          }
        } catch (e: any) {
          answer = `(AI request failed: ${e?.message || 'unknown'})`
        }
      }

      // 4. Save to feedback table (fire and forget)
      try {
        await sb().from('koto_help_feedback').insert({
          agency_id: agencyId,
          question,
          answer,
          context_page: contextPage,
          was_helpful: null,
        })
      } catch { /* swallow */ }

      return Response.json({
        data: {
          answer,
          related_articles: contextArticles.slice(0, 3).map((a) => ({ slug: a.slug, title: a.title })),
        },
      })
    }

    // ── feedback (updates a prior ask row) ─────────────
    if (action === 'feedback') {
      const question = body.question || ''
      const answer = body.answer || ''
      const wasHelpful = typeof body.was_helpful === 'boolean' ? body.was_helpful : null
      if (!question || !answer) return Response.json({ error: 'Missing question/answer' }, { status: 400 })

      try {
        // Update the latest matching row for this agency
        const s = sb()
        const { data: existing } = await s
          .from('koto_help_feedback')
          .select('id')
          .eq('agency_id', agencyId)
          .eq('question', question)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existing?.id) {
          await s.from('koto_help_feedback').update({ was_helpful: wasHelpful }).eq('id', existing.id)
        } else {
          await s.from('koto_help_feedback').insert({
            agency_id: agencyId, question, answer, was_helpful: wasHelpful,
          })
        }
      } catch { /* swallow */ }

      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function moduleFromPath(path: string): string | null {
  if (!path) return null
  const p = path.toLowerCase()
  if (p.includes('/discovery')) return 'discovery'
  if (p.includes('/voice')) return 'voice'
  if (p.includes('/scout')) return 'scout'
  if (p.includes('/opportunities')) return 'opportunities'
  if (p.includes('/email-tracking')) return 'email_tracking'
  if (p.includes('/pixel')) return 'pixel'
  if (p.includes('/reviews')) return 'reviews'
  if (p.includes('/proposals')) return 'proposals'
  if (p.includes('/report')) return 'reports'
  if (p.includes('/agent')) return 'agent'
  if (p.includes('/clients')) return 'clients'
  if (p.includes('/vault')) return 'platform'
  if (p.includes('/desk')) return 'clients'
  return 'platform'
}
