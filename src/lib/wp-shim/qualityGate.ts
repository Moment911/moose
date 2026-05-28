import 'server-only'

// ── Pre-publish quality gate ────────────────────────────────────────────────
//
// Local, rule-based content QA on the master BEFORE deploying across hundreds
// of city pages — where thin/duplicate/keyword-stuffed content is the #1 risk
// to the whole network. No external API. Produces a 0-100 score + findings.

import type { TopicCampaignMaster } from './tokenResolver'

export interface QualityFinding { level: 'fail' | 'warn' | 'info'; msg: string }
export interface QualityReport { score: number; findings: QualityFinding[]; wordCount: number }

const strip = (s: string) => String(s || '').replace(/\[koto_[a-z_]+\]/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const wc = (s: string) => { const t = strip(s); return t ? t.split(/\s+/).length : 0 }

export function checkQuality(master: TopicCampaignMaster, topic: string): QualityReport {
    const findings: QualityFinding[] = []

    // Representative single-page word count (first variant of each block).
    const parts: string[] = [
        master.hero?.subheadline_variants?.[0] || '',
        ...(master.sections || []).map(s => s.body_variants?.[0] || ''),
        ...(master.faqs || []).map(f => f.answer_variants?.[0] || ''),
        master.cta?.body || '',
        master.direct_answer_template || '',
    ]
    const wordCount = parts.reduce((n, p) => n + wc(p), 0)

    if (wordCount < 600) findings.push({ level: 'fail', msg: `Thin content — ~${wordCount} words per page (aim for 800+).` })
    else if (wordCount < 800) findings.push({ level: 'warn', msg: `Borderline length — ~${wordCount} words (800+ is safer).` })

    // Rotation coverage — low variant counts mean near-identical pages across
    // cities (duplicate-content risk Google penalizes at scale).
    const thinVariants = (master.sections || []).filter(s => (s.body_variants?.length || 0) < 2).length
        + (master.faqs || []).filter(f => (f.answer_variants?.length || 0) < 2).length
    if (thinVariants > 0) findings.push({ level: 'warn', msg: `${thinVariants} block(s) have <2 rotation variants — cities will look near-duplicate.` })

    // Localization — every section should reference [koto_city] so pages aren't generic.
    const nonLocalized = (master.sections || []).filter(s => !/\[koto_city/.test(s.body_variants?.[0] || '')).length
    if (nonLocalized > 0) findings.push({ level: 'warn', msg: `${nonLocalized} section(s) don't use a [koto_city] token — content reads generic.` })

    // Keyword stuffing — topic noun-phrase density across the body.
    const topicWord = String(topic || '').trim().split(/\s+/)[0]?.toLowerCase()
    if (topicWord && wordCount > 0) {
        const body = parts.map(strip).join(' ').toLowerCase()
        const occ = (body.match(new RegExp(`\\b${topicWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length
        const density = occ / wordCount
        if (density > 0.045) findings.push({ level: 'warn', msg: `Possible keyword stuffing — "${topicWord}" is ${(density * 100).toFixed(1)}% of words (keep under ~4%).` })
    }

    // Structure completeness — AEO surfaces.
    if (!master.direct_answer_template) findings.push({ level: 'warn', msg: 'No direct-answer block — misses AI answer-card extraction.' })
    if ((master.faqs?.length || 0) < 4) findings.push({ level: 'warn', msg: `Only ${master.faqs?.length || 0} FAQs — 4+ improves AEO coverage.` })
    if (!master.howto) findings.push({ level: 'info', msg: 'No HowTo block — consider adding for how-to answer surfaces.' })
    if (!master.comparison) findings.push({ level: 'info', msg: 'No comparison table — consider adding (local vs. national).' })
    if (!master.schema_jsonld_template) findings.push({ level: 'fail', msg: 'No JSON-LD schema template on the master.' })

    const penalty = findings.reduce((n, f) => n + (f.level === 'fail' ? 25 : f.level === 'warn' ? 8 : 2), 0)
    const score = Math.max(0, 100 - penalty)
    return { score, findings, wordCount }
}
