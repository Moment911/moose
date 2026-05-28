import { describe, it, expect } from 'vitest'
import { resolveMaster, type TopicCampaignMaster, type ResolveContext } from './tokenResolver'
import { htmlToMarkdown } from './mdTwinBuilder'

// Minimal master whose schema template emits a LocalBusiness node — the node
// enrichSchemaGraph hangs operator trust signals off of.
const master: TopicCampaignMaster = {
    topic: 'Roof Repair',
    hero: { headline_variants: ['Roof Repair in [koto_city]'], subheadline_variants: ['Fast service'] },
    sections: [{ heading_template: 'About', body_variants: ['Body copy.'] }],
    faqs: [],
    cta: { headline: 'Call now', body: 'Reach out today.' },
    meta: { title_template: 'Roof Repair [koto_city]', description_template: 'Desc' },
    schema_jsonld_template: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [{ '@type': 'LocalBusiness', name: 'Acme Roofing' }],
    }),
}

const baseCtx: ResolveContext = {
    location: { city: 'Austin', state: 'Texas', stateAbbr: 'TX' },
    companyName: 'Acme Roofing',
    pageUrl: 'https://acme.com/roof-repair-austin',
}

function graphOf(jsonLd: string | null) {
    expect(jsonLd).toBeTruthy()
    const parsed = JSON.parse(jsonLd as string)
    return parsed['@graph'] as any[]
}

describe('enrichSchemaGraph — business trust signals', () => {
    it('emits operator-provided LocalBusiness attributes onto the LocalBusiness node', () => {
        const ctx: ResolveContext = {
            ...baseCtx,
            eeat: {
                business: {
                    priceRange: '$$',
                    paymentAccepted: 'Visa, Mastercard, Cash',
                    numberOfEmployees: 12,
                    knowsLanguage: ['English', 'Spanish'],
                    knowsAbout: ['Metal roofing', 'Storm damage'],
                    award: ['GAF Master Elite', 'BBB A+'],
                    licenseNumber: 'TX-12345',
                    bookingUrl: 'https://acme.com/book',
                },
            },
        }
        const lb = graphOf(resolveMaster(master, ctx).jsonLd).find(e => e['@type'] === 'LocalBusiness')
        expect(lb.priceRange).toBe('$$')
        expect(lb.paymentAccepted).toBe('Visa, Mastercard, Cash')
        expect(lb.numberOfEmployees).toEqual({ '@type': 'QuantitativeValue', value: 12 })
        expect(lb.knowsLanguage).toEqual(['English', 'Spanish'])
        expect(lb.knowsAbout).toEqual(expect.arrayContaining(['Metal roofing', 'Storm damage']))
        expect(lb.award).toEqual(expect.arrayContaining(['GAF Master Elite', 'BBB A+']))
        expect(lb.identifier).toEqual([{ '@type': 'PropertyValue', name: 'License', value: 'TX-12345' }])
        expect(lb.potentialAction).toEqual({
            '@type': 'ReserveAction',
            target: { '@type': 'EntryPoint', urlTemplate: 'https://acme.com/book' },
        })
    })

    it('omits every business attribute when none are provided (no regression)', () => {
        const lb = graphOf(resolveMaster(master, baseCtx).jsonLd).find(e => e['@type'] === 'LocalBusiness')
        expect(lb.priceRange).toBeUndefined()
        expect(lb.paymentAccepted).toBeUndefined()
        expect(lb.numberOfEmployees).toBeUndefined()
        expect(lb.knowsLanguage).toBeUndefined()
        expect(lb.identifier).toBeUndefined()
        expect(lb.potentialAction).toBeUndefined()
    })

    it('drops a non-numeric team size rather than emitting an invalid value', () => {
        const ctx: ResolveContext = { ...baseCtx, eeat: { business: { priceRange: '$' } } }
        const lb = graphOf(resolveMaster(master, ctx).jsonLd).find(e => e['@type'] === 'LocalBusiness')
        expect(lb.priceRange).toBe('$')
        expect(lb.numberOfEmployees).toBeUndefined()
    })
})

describe('koto-business section — on-page render + .md twin (GEO visibility)', () => {
    const fullBiz = {
        priceRange: '$$',
        paymentAccepted: 'Visa, Cash',
        numberOfEmployees: 12,
        knowsLanguage: ['English', 'Spanish'],
        knowsAbout: ['Metal roofing', 'Storm damage'],
        award: ['GAF Master Elite', 'BBB A+'],
        licenseNumber: 'TX-12345',
        bookingUrl: 'https://acme.com/book',
    }

    it('renders the business trust facts as visible HTML in the page body', () => {
        const ctx: ResolveContext = { ...baseCtx, eeat: { business: fullBiz } }
        const { bodyHtml } = resolveMaster(master, ctx)
        expect(bodyHtml).toContain('class="koto-business"')
        expect(bodyHtml).toContain('About Acme Roofing') // heading uses companyName
        expect(bodyHtml).toContain('Metal roofing, Storm damage') // specialties
        expect(bodyHtml).toContain('English, Spanish') // languages
        expect(bodyHtml).toContain('GAF Master Elite, BBB A+') // accreditations
        expect(bodyHtml).toContain('TX-12345') // license
        expect(bodyHtml).toContain('12 professionals') // team size
        expect(bodyHtml).toContain('$$') // price range
        expect(bodyHtml).toContain('Visa, Cash') // payment
        expect(bodyHtml).toContain('https://acme.com/book') // booking link
    })

    it('survives into the markdown twin AI crawlers consume (schema strips, prose does not)', () => {
        const ctx: ResolveContext = { ...baseCtx, eeat: { business: fullBiz } }
        const md = htmlToMarkdown(resolveMaster(master, ctx).bodyHtml)
        // The facts must be in the markdown, NOT just the JSON-LD <script>.
        expect(md).toContain('Metal roofing, Storm damage')
        expect(md).toContain('English, Spanish')
        expect(md).toContain('TX-12345')
        expect(md).not.toContain('<section') // proves it was converted, not raw HTML
    })

    it('renders the section with only a booking URL and no fact rows', () => {
        const ctx: ResolveContext = { ...baseCtx, eeat: { business: { bookingUrl: 'https://acme.com/book' } } }
        const { bodyHtml } = resolveMaster(master, ctx)
        expect(bodyHtml).toContain('class="koto-business"')
        expect(bodyHtml).toContain('https://acme.com/book')
        expect(bodyHtml).not.toContain('koto-business-facts') // no <ul> when no rows
    })

    it('omits the section entirely when no business data is present (no regression)', () => {
        const { bodyHtml } = resolveMaster(master, baseCtx)
        expect(bodyHtml).not.toContain('koto-business')
    })

    it('omits the section when business object is present but every field is empty', () => {
        const ctx: ResolveContext = { ...baseCtx, eeat: { business: { knowsAbout: [], award: [] } } }
        const { bodyHtml } = resolveMaster(master, ctx)
        expect(bodyHtml).not.toContain('class="koto-business"')
    })
})
