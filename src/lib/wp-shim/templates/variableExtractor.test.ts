import { describe, expect, it } from 'vitest'

import { extractVariables, substituteVariables } from './variableExtractor'

// ─────────────────────────────────────────────────────────────────────────────
// variableExtractor.test — Phase 10 Plan 09 Task 1 (RED).
//
// Verifies the heuristic-mode variable extraction walks an Elementor JSON tree,
// surfaces text / image / link candidates with auto-generated names, dedups
// identical strings to the same variable, and round-trips via substituteVariables.
//
// Heuristic mode only (opts.useLLM=false / unset) — the LLM-assisted naming
// path is covered indirectly when the dashboard wires the option at call time
// (captureTemplate doesn't enable it by default in tests).
// ─────────────────────────────────────────────────────────────────────────────

// A representative Elementor tree fixture (mirrors the v4 atomic shape with
// stable element ids + nested settings + repeater rows). Includes:
//   - a heading ("Welcome to Acme Plumbing")
//   - a duplicate "Acme Plumbing" string in a button label
//   - an image URL (https + .jpg)
//   - a link URL (https://acmeplumbing.com/contact)
//   - a numeric setting (color hex — should be skipped)
//   - a short string ("y") — should be skipped (too short)
//   - a CSS selector (".acme") — should be skipped
const fixture = (): unknown[] => [
    {
        id: 'abc12345',
        elType: 'section',
        settings: { _css_classes: '.acme' },
        elements: [
            {
                id: 'def67890',
                elType: 'widget',
                widgetType: 'heading',
                settings: {
                    title: 'Welcome to Acme Plumbing',
                    align: 'left',
                    color: '#1a2a3a',
                    short: 'y',
                },
            },
            {
                id: 'ghi24680',
                elType: 'widget',
                widgetType: 'image',
                settings: {
                    image: { url: 'https://acmeplumbing.com/hero.jpg' },
                    caption: 'Trusted by Acme Plumbing',
                },
            },
            {
                id: 'jkl13579',
                elType: 'widget',
                widgetType: 'button',
                settings: {
                    text: 'Acme Plumbing',
                    link: { url: 'https://acmeplumbing.com/contact' },
                },
            },
        ],
    },
]

describe('extractVariables — heuristic mode', () => {
    it('returns ≥5 distinct variables for the fixture', async () => {
        const { variables } = await extractVariables(fixture())
        expect(variables.length).toBeGreaterThanOrEqual(5)
    })

    it('dedups identical strings to the SAME variable name', async () => {
        const { variables, tree } = await extractVariables(fixture())
        const acmeOccurrences = variables.filter((v) => v.value === 'Acme Plumbing')
        expect(acmeOccurrences.length).toBe(1)
        // Every "Acme Plumbing" string in the tree must reference the same name.
        const sweep = JSON.stringify(tree)
        const tokenCount = (sweep.match(/\{[a-z0-9_]+\}/g) || []).length
        // 5+ leaf strings get substituted; nothing left as raw "Acme Plumbing"
        expect(sweep).not.toContain('Acme Plumbing')
        expect(tokenCount).toBeGreaterThanOrEqual(5)
    })

    it('types image_url for jpg/png urls', async () => {
        const { variables } = await extractVariables(fixture())
        const image = variables.find((v) => String(v.value).includes('hero.jpg'))
        expect(image).toBeDefined()
        expect(image?.type).toBe('image_url')
    })

    it('types link_url for http/https URLs that are not images', async () => {
        const { variables } = await extractVariables(fixture())
        const link = variables.find((v) => String(v.value).includes('/contact'))
        expect(link).toBeDefined()
        expect(link?.type).toBe('link_url')
    })

    it('types text for plain string content', async () => {
        const { variables } = await extractVariables(fixture())
        const headline = variables.find((v) => v.value === 'Welcome to Acme Plumbing')
        expect(headline).toBeDefined()
        expect(headline?.type).toBe('text')
    })

    it('skips strings that are too short / look like CSS / hex colors', async () => {
        const { variables } = await extractVariables(fixture())
        const values = variables.map((v) => v.value)
        expect(values).not.toContain('y') // short
        expect(values).not.toContain('.acme') // CSS selector
        expect(values).not.toContain('#1a2a3a') // hex color
        expect(values).not.toContain('left') // single short word (likely a config value)
    })

    it('emits stable names: slug-ified from value + element type', async () => {
        const { variables } = await extractVariables(fixture())
        const headline = variables.find((v) => v.value === 'Welcome to Acme Plumbing')
        expect(headline?.name).toMatch(/^[a-z][a-z0-9_]*$/)
    })

    it('records the JSON path + element_id of each variable', async () => {
        const { variables } = await extractVariables(fixture())
        for (const v of variables) {
            expect(v.path).toMatch(/\.settings\./)
            // element_id is the 8-char Elementor id when known
            expect(v.element_id == null || /^[a-z0-9]{4,}$/.test(v.element_id)).toBe(true)
        }
    })

    it('does NOT mutate the source tree', async () => {
        const source = fixture()
        const snapshot = JSON.stringify(source)
        await extractVariables(source)
        expect(JSON.stringify(source)).toBe(snapshot)
    })
})

describe('substituteVariables', () => {
    it('replaces every {var} token with the corresponding string value', async () => {
        const { tree, variables } = await extractVariables(fixture())
        const values: Record<string, string> = {}
        for (const v of variables) {
            values[v.name] = `[[${v.name}]]`
        }
        const out = substituteVariables(tree, values)
        const flat = JSON.stringify(out)
        for (const v of variables) {
            expect(flat).toContain(`[[${v.name}]]`)
        }
        expect(flat).not.toMatch(/\{[a-z0-9_]+\}/)
    })

    it('wraps Array values with [koto_rotate] shortcode (rotation)', () => {
        const tree = [{ id: 'x', settings: { title: '{hero}' } }]
        const out = substituteVariables(tree, { hero: ['A', 'B', 'C'] }) as Array<{
            settings: { title: string }
        }>
        const s = out[0].settings.title
        expect(s).toContain('[koto_rotate')
        expect(s).toContain('A|||KOTO_VARIANT|||B|||KOTO_VARIANT|||C')
        expect(s).toContain('section="hero"')
        expect(s).toContain('[/koto_rotate]')
    })

    it('respects rotationCacheDuration option', () => {
        const tree = [{ id: 'x', settings: { title: '{hero}' } }]
        const out = substituteVariables(
            tree,
            { hero: ['A', 'B'] },
            { rotationCacheDuration: '24h' },
        ) as Array<{ settings: { title: string } }>
        expect(out[0].settings.title).toContain('cache="24h"')
    })

    it('substitutes empty string for missing variables', () => {
        const tree = [{ id: 'x', settings: { title: '{missing}' } }]
        const out = substituteVariables(tree, {}) as Array<{ settings: { title: string } }>
        expect(out[0].settings.title).toBe('')
    })

    it('deep clones — does not mutate source tree', () => {
        const tree = [{ id: 'x', settings: { title: '{hero}' } }]
        const snapshot = JSON.stringify(tree)
        substituteVariables(tree, { hero: 'Substituted' })
        expect(JSON.stringify(tree)).toBe(snapshot)
    })

    it('round-trips: extract → substitute(originals) reconstructs source byte-for-byte', async () => {
        const source = fixture()
        const { tree, variables } = await extractVariables(source)
        const originals: Record<string, string> = {}
        for (const v of variables) originals[v.name] = String(v.value)
        const reconstructed = substituteVariables(tree, originals)
        expect(JSON.stringify(reconstructed)).toBe(JSON.stringify(source))
    })

    it('handles strings containing the variable token mixed with literal text', () => {
        const tree = [{ id: 'x', settings: { title: 'Hello {name}, welcome!' } }]
        const out = substituteVariables(tree, { name: 'Adam' }) as Array<{
            settings: { title: string }
        }>
        expect(out[0].settings.title).toBe('Hello Adam, welcome!')
    })

    it('handles multiple variables in one string', () => {
        const tree = [{ id: 'x', settings: { title: '{greeting} {name}!' } }]
        const out = substituteVariables(tree, {
            greeting: 'Hi',
            name: 'Adam',
        }) as Array<{ settings: { title: string } }>
        expect(out[0].settings.title).toBe('Hi Adam!')
    })
})
