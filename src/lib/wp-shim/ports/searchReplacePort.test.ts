import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { serialize, unserialize } from 'php-serialize'

// ─────────────────────────────────────────────────────────────────────────────
// searchReplacePort.test — verifies serialized-PHP-safe walker, chunked
// applyBulkUpdate, and shim verb sequences. PHP-serialized fixtures generated
// via the `php-serialize` npm package (equivalent to PHP's serialize()).
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../shimRpc', () => ({
    shimRpc: vi.fn(),
    shimRpcBatch: vi.fn(),
}))

import { shimRpc } from '../shimRpc'
import {
    TEXT_COLUMNS_PER_TABLE,
    walkAndReplace,
    replaceInValue,
    listTextTables,
    scanForReplacements,
    applyBulkUpdate,
    type ScannedReplacement,
} from './searchReplacePort'

const SITE = 'https://wp.example.com'

beforeEach(() => {
    ;(shimRpc as ReturnType<typeof vi.fn>).mockReset()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('searchReplacePort — TEXT_COLUMNS_PER_TABLE', () => {
    it('does NOT include wp_users or usermeta (T-10-07-01)', () => {
        expect(TEXT_COLUMNS_PER_TABLE.users).toBeUndefined()
        expect(TEXT_COLUMNS_PER_TABLE.usermeta).toBeUndefined()
    })

    it('includes 6 supported tables (posts, postmeta, options, termmeta, terms, term_taxonomy)', () => {
        const keys = Object.keys(TEXT_COLUMNS_PER_TABLE).sort()
        expect(keys).toEqual([
            'options',
            'postmeta',
            'terms',
            'term_taxonomy',
            'termmeta',
            'posts',
        ].sort())
    })

    it('does not expose user_pass column anywhere', () => {
        const allCols = Object.values(TEXT_COLUMNS_PER_TABLE).flatMap((d) => d.text_cols)
        expect(allCols).not.toContain('user_pass')
        expect(allCols).not.toContain('user_email')
    })
})

describe('searchReplacePort — walkAndReplace', () => {
    it('replaces a string leaf', () => {
        const r = walkAndReplace('oldsite.com', /oldsite/g, 'newsite')
        expect(r).toBe('newsite.com')
    })

    it('replaces nested string leaves inside an array', () => {
        const r = walkAndReplace(['a', 'oldsite.com', 'b'], /oldsite/g, 'newsite')
        expect(r).toEqual(['a', 'newsite.com', 'b'])
    })

    it('replaces string keys and values in nested objects', () => {
        const r = walkAndReplace({ oldsite_key: 'oldsite_value', other: 5 }, /oldsite/g, 'newsite')
        expect(r).toEqual({ newsite_key: 'newsite_value', other: 5 })
    })

    it('leaves numbers/booleans/null untouched', () => {
        expect(walkAndReplace(5, /x/g, 'y')).toBe(5)
        expect(walkAndReplace(true, /x/g, 'y')).toBe(true)
        expect(walkAndReplace(null, /x/g, 'y')).toBe(null)
    })
})

describe('searchReplacePort — replaceInValue (serialized-PHP safety)', () => {
    it('plain string with match → returns changed string', () => {
        const matcher = /oldsite/g
        const r = replaceInValue('oldsite.com/path', matcher, 'newsite')
        expect(r.changed).toBe(true)
        expect(r.after).toBe('newsite.com/path')
        expect(r.is_serialized).toBe(false)
    })

    it('plain string without match → returns unchanged', () => {
        const matcher = /oldsite/g
        const r = replaceInValue('no-match-here', matcher, 'newsite')
        expect(r.changed).toBe(false)
        expect(r.after).toBe('no-match-here')
    })

    it('PHP-serialized string containing the pattern → unserialize, replace, reserialize', () => {
        const original = serialize('http://oldsite.com')
        // Original looks like: s:18:"http://oldsite.com";
        expect(original).toContain('s:18:')
        expect(original).toContain('oldsite.com')

        const matcher = /oldsite\.com/g
        const r = replaceInValue(original, matcher, 'newsite.example')
        expect(r.changed).toBe(true)
        expect(r.is_serialized).toBe(true)
        // The serialized length header must update to 22 (length of "http://newsite.example")
        expect(r.after).toContain('s:22:')
        expect(r.after).toContain('newsite.example')
        // round-trip — re-unserializing yields the replaced string
        expect(unserialize(r.after)).toBe('http://newsite.example')
    })

    it('PHP-serialized array with pattern in a nested string leaf', () => {
        const arr = { url: 'http://oldsite.com/page', id: 42 }
        const original = serialize(arr)
        expect(original).toContain('oldsite.com')

        const matcher = /oldsite\.com/g
        const r = replaceInValue(original, matcher, 'newsite.example')
        expect(r.changed).toBe(true)
        expect(r.is_serialized).toBe(true)
        // Verify the resulting serialized blob unserializes back to a valid object.
        const reser = unserialize(r.after) as Record<string, unknown>
        expect(reser.url).toBe('http://newsite.example/page')
        expect(reser.id).toBe(42)
    })

    it('serialized array WITHOUT the pattern → unchanged', () => {
        const arr = ['foo', 'bar', 'baz']
        const original = serialize(arr)
        const matcher = /oldsite/g
        const r = replaceInValue(original, matcher, 'newsite')
        expect(r.changed).toBe(false)
        expect(r.after).toBe(original)
    })

    it('case-insensitive matcher matches all variants', () => {
        const matcher = /oldsite/gi
        const r = replaceInValue('OldSite.com', matcher, 'newsite')
        expect(r.changed).toBe(true)
        expect(r.after).toBe('newsite.com')
    })

    it('case-sensitive matcher only matches exact case', () => {
        const matcher = /oldsite/g
        const r = replaceInValue('OldSite.com', matcher, 'newsite')
        expect(r.changed).toBe(false)
        expect(r.after).toBe('OldSite.com')
    })
})

describe('searchReplacePort — listTextTables', () => {
    it("calls querySelect with name='database.list_text_tables'", async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { rows: [], count: 0 },
            status: 200,
        })
        await listTextTables(SITE)
        const call = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(call[1]).toBe('query.select')
        expect(call[2].name).toBe('database.list_text_tables')
    })

    it('intersects DB-discovered tables with TEXT_COLUMNS_PER_TABLE allowlist', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                rows: [
                    { table: 'wp_posts', rows: 1234 },
                    { table: 'wp_postmeta', rows: 5678 },
                    { table: 'wp_users', rows: 12 }, // NOT in allowlist — must NOT appear
                    { table: 'wp_options', rows: 200 },
                ],
                count: 4,
            },
            status: 200,
        })
        const res = await listTextTables(SITE)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        const tables = res.data.map((d) => d.table)
        expect(tables).toContain('posts')
        expect(tables).toContain('postmeta')
        expect(tables).toContain('options')
        expect(tables).not.toContain('users')
        // posts should reflect DB row count from query.select
        const posts = res.data.find((d) => d.table === 'posts')
        expect(posts?.rows).toBe(1234)
        expect(posts?.is_text_in_db).toBe(true)
    })
})

describe('searchReplacePort — scanForReplacements', () => {
    it('finds a plain string match in posts.post_content', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            // First fetchRowsForTable call for posts
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    rows: [
                        { ID: 1, post_title: 'Hello', post_content: 'Visit oldsite.com today', post_excerpt: '' },
                        { ID: 2, post_title: 'Other', post_content: 'No match here', post_excerpt: '' },
                    ],
                    count: 2,
                },
                status: 200,
            })
        const res = await scanForReplacements(SITE, {
            tables: ['posts'],
            find: 'oldsite.com',
            replace: 'newsite.example',
        })
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.replacements).toHaveLength(1)
        expect(res.data.replacements[0].table).toBe('posts')
        expect(res.data.replacements[0].pk_val).toBe(1)
        expect(res.data.replacements[0].column).toBe('post_content')
        expect(res.data.replacements[0].before).toBe('Visit oldsite.com today')
        expect(res.data.replacements[0].after).toBe('Visit newsite.example today')
    })

    it('finds a match inside a PHP-serialized option_value', async () => {
        const serializedValue = serialize({ home: 'http://oldsite.com', siteurl: 'http://oldsite.com' })
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            data: {
                rows: [{ option_id: 42, option_value: serializedValue }],
                count: 1,
            },
            status: 200,
        })
        const res = await scanForReplacements(SITE, {
            tables: ['options'],
            find: 'oldsite.com',
            replace: 'newsite.example',
        })
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.replacements).toHaveLength(1)
        expect(res.data.replacements[0].is_serialized).toBe(true)
        // Round-trip — unserializing the after value yields the replaced object
        const after = unserialize(res.data.replacements[0].after) as Record<string, unknown>
        expect(after.home).toBe('http://newsite.example')
        expect(after.siteurl).toBe('http://newsite.example')
    })

    it('sample_max cap returns truncated=true when reached', async () => {
        const rows = Array.from({ length: 6 }, (_, i) => ({
            ID: i + 1,
            post_title: 'oldsite.com',
            post_content: '',
            post_excerpt: '',
        }))
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            data: { rows, count: rows.length },
            status: 200,
        })
        const res = await scanForReplacements(SITE, {
            tables: ['posts'],
            find: 'oldsite',
            replace: 'newsite',
            sample_max: 3,
        })
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.replacements).toHaveLength(3)
        expect(res.data.truncated).toBe(true)
    })

    it('case_sensitive=true narrows matches', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            data: {
                rows: [
                    { ID: 1, post_title: 'OldSite.com', post_content: '', post_excerpt: '' },
                    { ID: 2, post_title: 'oldsite.com', post_content: '', post_excerpt: '' },
                ],
                count: 2,
            },
            status: 200,
        })
        const res = await scanForReplacements(SITE, {
            tables: ['posts'],
            find: 'oldsite',
            replace: 'newsite',
            case_sensitive: true,
        })
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.replacements).toHaveLength(1)
        expect(res.data.replacements[0].pk_val).toBe(2)
    })
})

describe('searchReplacePort — applyBulkUpdate', () => {
    it('chunks 250 replacements into 3 batches (100 + 100 + 50)', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { applied: 100, errors: [] },
            status: 200,
        })
        const reps: ScannedReplacement[] = Array.from({ length: 250 }, (_, i) => ({
            table: 'posts',
            pk_col: 'ID',
            pk_val: i + 1,
            column: 'post_title',
            before: 'oldsite.com',
            after: 'newsite.com',
            is_serialized: false,
        }))
        const res = await applyBulkUpdate(SITE, reps)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.chunks).toBe(3)
        const calls = (shimRpc as ReturnType<typeof vi.fn>).mock.calls.filter(
            (c) => c[1] === 'database.update_bulk',
        )
        expect(calls).toHaveLength(3)
        expect((calls[0][2].updates as unknown[]).length).toBe(100)
        expect((calls[1][2].updates as unknown[]).length).toBe(100)
        expect((calls[2][2].updates as unknown[]).length).toBe(50)
    })

    it('aggregates errors across chunks without short-circuiting', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            // First chunk: succeeds with a per-row error
            .mockResolvedValueOnce({
                ok: true,
                data: { applied: 99, errors: [{ table: 'posts', code: 'unknown_table', message: 'x' }] },
                status: 200,
            })
            // Second chunk: top-level failure
            .mockResolvedValueOnce({
                ok: false,
                error: { code: 'too_many', message: 'rate limit' },
                status: 429,
            })
        const reps: ScannedReplacement[] = Array.from({ length: 150 }, (_, i) => ({
            table: 'posts',
            pk_col: 'ID',
            pk_val: i + 1,
            column: 'post_title',
            before: 'a',
            after: 'b',
            is_serialized: false,
        }))
        const res = await applyBulkUpdate(SITE, reps)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.chunks).toBe(2)
        expect(res.data.applied).toBe(99)
        expect(res.data.errors).toEqual([
            { chunk: 0, code: 'unknown_table', message: 'x' },
            { chunk: 1, code: 'too_many', message: 'rate limit' },
        ])
    })

    it('uses verb=database.update_bulk', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { applied: 1, errors: [] },
            status: 200,
        })
        await applyBulkUpdate(SITE, [
            {
                table: 'posts',
                pk_col: 'ID',
                pk_val: 1,
                column: 'post_title',
                before: 'a',
                after: 'b',
                is_serialized: false,
            },
        ])
        const call = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(call[1]).toBe('database.update_bulk')
        expect(call[2].updates).toEqual([
            { table: 'posts', pk_col: 'ID', pk_val: 1, column: 'post_title', value: 'b' },
        ])
    })
})
