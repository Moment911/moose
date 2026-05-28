import 'server-only'

// ── Markdown twin builder + pusher ──────────────────────────────────────────
//
// AI crawlers (Anthropic claudebot, OpenAI GPTBot, Perplexity, etc.) extract
// content far more reliably from clean Markdown than from styled HTML. For each
// deployed topic-campaign page we publish a Markdown "twin":
//
//   {origin}/{slug}.md            → that one page's content as Markdown
//   {origin}/llms-full.txt        → every page's Markdown concatenated (the
//                                     "full content" companion to /llms.txt)
//
// The shim plugin's md-server.php (v4.2.5+) serves both from
// wp-content/uploads/kotoiq/. This module is pure composition + a thin pusher
// over the file.write verb; it never fabricates content — the Markdown is a
// faithful conversion of the already-resolved page HTML (real-data-only, per
// _knowledge/data-integrity-standard.md).

import { fileWrite } from './verbs'

const ENTITIES: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&mdash;': '—',
    '&ndash;': '–', '&hellip;': '…', '&#x27;': "'", '&rsquo;': '’', '&lsquo;': '‘',
}

function decodeEntities(s: string): string {
    return s
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
}

function stripTags(s: string): string {
    return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

/**
 * Convert the resolved page HTML to readable Markdown. Dependency-free and
 * intentionally forgiving — the goal is faithful, crawlable text, not a perfect
 * DOM round-trip. Handles headings, paragraphs, lists, links, inline emphasis,
 * and tables; drops scripts/styles and any leftover tags.
 */
export function htmlToMarkdown(html: string): string {
    let s = String(html || '')

    // Drop non-content blocks entirely.
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')

    // Tables → Markdown rows (best-effort: header row gets a separator).
    s = s.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, inner: string) => {
        const rows: string[] = []
        let headerEmitted = false
        const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
        let tr: RegExpExecArray | null
        while ((tr = trRe.exec(inner)) !== null) {
            const cells: string[] = []
            let isHeader = false
            const cellRe = /<(t[hd])[^>]*>([\s\S]*?)<\/\1>/gi
            let c: RegExpExecArray | null
            while ((c = cellRe.exec(tr[1])) !== null) {
                if (c[1].toLowerCase() === 'th') isHeader = true
                cells.push(stripTags(c[2]))
            }
            if (cells.length === 0) continue
            rows.push(`| ${cells.join(' | ')} |`)
            if (isHeader && !headerEmitted) {
                rows.push(`| ${cells.map(() => '---').join(' | ')} |`)
                headerEmitted = true
            }
        }
        return rows.length ? `\n\n${rows.join('\n')}\n\n` : ''
    })

    // Headings.
    s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, t: string) => {
        return `\n\n${'#'.repeat(Number(lvl))} ${stripTags(t)}\n\n`
    })

    // List items → "- " bullets (ordered + unordered both render fine for LLMs).
    s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, t: string) => `\n- ${stripTags(t)}`)
    s = s.replace(/<\/(ul|ol)>/gi, '\n\n')

    // Links + inline emphasis (before generic tag strip).
    s = s.replace(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, t: string) => {
        const text = stripTags(t)
        return text ? `[${text}](${href})` : ''
    })
    s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, t: string) => `**${stripTags(t)}**`)
    s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, t: string) => `*${stripTags(t)}*`)

    // Block boundaries → paragraph breaks.
    s = s.replace(/<\/(p|div|section|article|header|footer|tr|h[1-6])>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')

    // Whatever tags remain are layout noise — drop them.
    s = s.replace(/<[^>]+>/g, '')

    // Decode entities, normalize whitespace, collapse blank-line runs.
    s = decodeEntities(s)
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()

    return s
}

export interface PageMarkdownInput {
    title: string
    metaDescription?: string
    url: string
    bodyHtml: string
}

/**
 * Compose the full Markdown twin for one page: H1 title, blockquote summary, a
 * canonical-URL line, then the converted body.
 */
export function buildPageMarkdown(input: PageMarkdownInput): string {
    const out: string[] = []
    out.push(`# ${stripTags(input.title)}`)
    out.push('')
    if (input.metaDescription) {
        out.push(`> ${stripTags(input.metaDescription)}`)
        out.push('')
    }
    out.push(`*Canonical URL: ${input.url}*`)
    out.push('')
    out.push('---')
    out.push('')
    out.push(htmlToMarkdown(input.bodyHtml))
    out.push('')
    return out.join('\n')
}

export interface LlmsFullInput {
    siteName: string
    siteUrl: string
    siteDescription?: string
    // Each page's already-built Markdown twin + its canonical URL.
    pages: Array<{ url: string; markdown: string }>
}

/**
 * Compose the site-wide /llms-full.txt — the "full content" companion to
 * /llms.txt. Concatenates every page's Markdown twin with `---` separators so
 * an LLM can ingest the entire authored answer surface in one fetch.
 */
export function buildLlmsFullTxt(input: LlmsFullInput): string {
    const out: string[] = []
    out.push(`# ${input.siteName} — Full Content`)
    out.push('')
    if (input.siteDescription) {
        out.push(`> ${input.siteDescription}`)
        out.push('')
    }
    out.push('> This file contains the full Markdown content of every KotoIQ-authored page on this site, for LLM ingestion. See /llms.txt for the link index.')
    out.push('')
    // Stable order for predictable diffs across deploys.
    const sorted = [...input.pages].sort((a, b) => a.url.localeCompare(b.url))
    for (const p of sorted) {
        out.push('---')
        out.push('')
        out.push(p.markdown.trim())
        out.push('')
    }
    return out.join('\n')
}

/** URL/file-safe slug for the .md filename. */
export function safeMdSlug(slug: string): string {
    return String(slug || '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120) || 'page'
}

/**
 * Push one page's Markdown twin to uploads/kotoiq/md/{slug}.md. Best-effort —
 * throws on failure so the caller can log-but-not-fail the deploy.
 */
export async function publishPageMarkdown(siteUrl: string, slug: string, content: string): Promise<{ ok: true; bytes_written: number }> {
    const b64 = Buffer.from(content, 'utf8').toString('base64')
    const res = await fileWrite(siteUrl, {
        path: `uploads/kotoiq/md/${safeMdSlug(slug)}.md`,
        content_base64: b64,
        mode: 'overwrite',
    })
    if (!res.ok) {
        const errorMsg = (res as any).error?.message || `HTTP ${(res as any).status}`
        throw new Error(`page .md write failed: ${errorMsg}`)
    }
    return { ok: true, bytes_written: res.data.bytes_written }
}

/** Push the site-wide llms-full.txt. Best-effort — throws on failure. */
export async function publishLlmsFullTxt(siteUrl: string, content: string): Promise<{ ok: true; bytes_written: number }> {
    const b64 = Buffer.from(content, 'utf8').toString('base64')
    const res = await fileWrite(siteUrl, {
        path: 'uploads/kotoiq/llms-full.txt',
        content_base64: b64,
        mode: 'overwrite',
    })
    if (!res.ok) {
        const errorMsg = (res as any).error?.message || `HTTP ${(res as any).status}`
        throw new Error(`llms-full.txt write failed: ${errorMsg}`)
    }
    return { ok: true, bytes_written: res.data.bytes_written }
}
