import { describe, it, expect } from 'vitest'
import { buildEeatContext } from './eeatContext'

// Mock just enough of the supabase client: .from('clients').select('*')
// .eq('id', id).single() → { data }.
function mockSupabase(clientRow: any) {
    const chain: any = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({ data: clientRow, error: null }),
    }
    return { from: () => chain }
}

describe('buildEeatContext — client trust-signal columns', () => {
    it('maps trust-signal columns into eeat.business / strategist / sameAs / results', async () => {
        const supabase = mockSupabase({
            price_range: '$$$',
            payment_methods: 'Visa, Cash',
            team_size: '20-30 people',
            languages_spoken: 'English, Spanish; Vietnamese',
            specialties: 'Roofing, Gutters',
            certifications: 'GAF Certified',
            awards: 'Best of Austin 2025',
            license_number: 'TX-999',
            booking_url: 'https://x.com/book',
            yelp_url: 'https://yelp.com/biz/x',
            bbb_url: 'https://bbb.org/x',
            author_name: 'Jane Doe',
            author_credentials: 'Master Roofer, 15 yrs',
            author_photo_url: 'https://x.com/jane.jpg',
            key_result: 'Reduced leaks 40%',
        })

        const eeat = await buildEeatContext(supabase, { client_id: 'c1' }, { withReviews: false })
        expect(eeat).toBeTruthy()
        const b = eeat!.business!
        expect(b.priceRange).toBe('$$$')
        expect(b.paymentAccepted).toBe('Visa, Cash')
        expect(b.numberOfEmployees).toBe(20) // first integer parsed from "20-30 people"
        expect(b.knowsLanguage).toEqual(['English', 'Spanish', 'Vietnamese'])
        expect(b.knowsAbout).toEqual(['Roofing', 'Gutters'])
        expect(b.award).toEqual(['GAF Certified', 'Best of Austin 2025'])
        expect(b.licenseNumber).toBe('TX-999')
        expect(b.bookingUrl).toBe('https://x.com/book')

        expect(eeat!.sameAs).toEqual(expect.arrayContaining(['https://yelp.com/biz/x', 'https://bbb.org/x']))
        expect(eeat!.strategist).toEqual({
            name: 'Jane Doe',
            title: 'Master Roofer, 15 yrs',
            photoUrl: 'https://x.com/jane.jpg',
        })
        expect(eeat!.results).toEqual([{ metric: 'Reduced leaks 40%' }])
    })

    it('operator campaign inputs win over client columns for strategist', async () => {
        const supabase = mockSupabase({ author_name: 'From Client' })
        const eeat = await buildEeatContext(
            supabase,
            { client_id: 'c1', eeat_inputs: { strategist: { name: 'From Inputs', title: 'CMO' } } },
            { withReviews: false },
        )
        expect(eeat!.strategist).toEqual({ name: 'From Inputs', title: 'CMO' })
    })

    it('returns undefined when there is no E-E-A-T data at all', async () => {
        const supabase = mockSupabase({ price_range: null, author_name: null })
        const eeat = await buildEeatContext(supabase, { client_id: 'c1' }, { withReviews: false })
        expect(eeat).toBeUndefined()
    })

    it('degrades cleanly when the client lookup throws (schema drift)', async () => {
        const supabase = {
            from: () => ({
                select: () => ({ eq: () => ({ single: async () => { throw new Error('column missing') } }) }),
            }),
        }
        const eeat = await buildEeatContext(
            supabase,
            { client_id: 'c1', eeat_inputs: { strategist: { name: 'Operator' } } },
            { withReviews: false },
        )
        // Client lookup failed, but operator inputs still produce a result.
        expect(eeat!.strategist).toEqual({ name: 'Operator' })
        expect(eeat!.business).toBeUndefined()
    })
})
