import { describe, it, expect } from 'vitest'
import { resolveMaster, type TopicCampaignMaster, type ResolveContext } from './tokenResolver'

// Regression: the CTA rendered `Call us now at 9547587200">(954) 758-7200`.
// Root cause — the safety-net pass wrapped the BARE digits inside
// href="tel:9547587200" (phoneRegex matches unseparated digits), injecting a
// nested <a> that browsers untangle into visible `DIGITS">` text.
const baseCtx: ResolveContext = {
    location: { city: 'Apopka', state: 'Florida', stateAbbr: 'FL' },
    companyName: 'Unified Marketing',
    phone: '(954) 758-7200',
    pageUrl: 'https://unified.com/seo-apopka',
}

function masterWithCtaBody(body: string): TopicCampaignMaster {
    return {
        topic: 'SEO',
        hero: { headline_variants: ['SEO in [koto_city]'], subheadline_variants: ['Grow faster'] },
        sections: [{ heading_template: 'About', body_variants: [body] }],
        faqs: [],
        cta: { headline: 'Get started', body: 'Reach out today.' },
        meta: { title_template: 'SEO [koto_city]', description_template: 'Desc' },
    }
}

// Count well-formed tel anchors and detect the corruption signature.
function telAnchors(html: string) {
    return (html.match(/<a\b[^>]*href="tel:\d+"[^>]*>[^<]*<\/a>/g) || [])
}

describe('phone link resolution — no nested-anchor corruption', () => {
    it('renders a token anchor <a href="tel:[koto_phone]">[koto_phone]</a> as ONE clean link', () => {
        const html = resolveMaster(masterWithCtaBody('Call us now at <a href="tel:[koto_phone]">[koto_phone]</a> or fill out our form.'), baseCtx).bodyHtml
        expect(html).not.toMatch(/tel:\s*<a/)              // no nested anchor in href
        expect(html).toContain('<a href="tel:9547587200">(954) 758-7200</a>')
        // Exactly one tappable link for the number — not doubled/nested.
        expect(telAnchors(html).filter(a => a.includes('(954) 758-7200'))).toHaveLength(1)
    })

    it('leaves an already-correct literal tel anchor (bare-digit href) intact', () => {
        const html = resolveMaster(masterWithCtaBody('Call now at <a href="tel:9547587200">(954) 758-7200</a> today.'), baseCtx).bodyHtml
        expect(html).not.toMatch(/tel:\s*<a/)
        expect(telAnchors(html).filter(a => a.includes('(954) 758-7200'))).toHaveLength(1)
    })

    it('still auto-links a plain-text phone number (no anchor in source)', () => {
        const html = resolveMaster(masterWithCtaBody('Call us now at (954) 758-7200 or fill out our form.'), baseCtx).bodyHtml
        expect(html).toContain('<a href="tel:9547587200">(954) 758-7200</a>')
        expect(html).not.toMatch(/tel:\s*<a/)
    })
})
