import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// verbs.test — proves the typed wrappers pass the correct verb name + args
// through to shimRpc and surface its discriminated-union response unchanged.
//
// Two cross-cutting tests at the bottom assert the defense-in-depth runtime
// guards in optionUpdate (deny-list) and fileWrite (path confinement).
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../shimRpc', () => ({
    shimRpc: vi.fn(),
    shimRpcBatch: vi.fn(),
}))

import { shimRpc } from '../shimRpc'
import {
    capabilityApply,
    cronList,
    cronTrigger,
    cronUnschedule,
    databaseUpdateBulk,
    eventsLogTail,
    fileDelete,
    fileExists,
    fileRead,
    fileWrite,
    healthDiagnostics,
    healthPing,
    metaDelete,
    metaUpdate,
    optionDelete,
    optionGet,
    optionListByPrefix,
    optionUpdate,
    pluginList,
    pluginToggle,
    postGetMetaBulk,
    querySelect,
    snippetsList,
    snippetsSave,
    taxonomyList,
    transientDeletePrefix,
    webhookSet,
} from './index'

const SITE = 'https://wp.example.com'

beforeEach(() => {
    ;(shimRpc as ReturnType<typeof vi.fn>).mockReset()
    ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        data: {},
        status: 200,
    })
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('verbs/index — wrapper contracts', () => {
    it('healthPing passes verb=health.ping with empty args', async () => {
        await healthPing(SITE)
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'health.ping', {})
    })

    it('healthDiagnostics passes verb=health.diagnostics', async () => {
        await healthDiagnostics(SITE)
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'health.diagnostics', {})
    })

    it('postGetMetaBulk passes verb=post.get_meta_bulk with posts payload', async () => {
        await postGetMetaBulk(SITE, { posts: [{ post_id: 7, keys: ['_x'] }] })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'post.get_meta_bulk', {
            posts: [{ post_id: 7, keys: ['_x'] }],
        })
    })

    it('metaUpdate passes verb=meta.update', async () => {
        await metaUpdate(SITE, { updates: [{ post_id: 7, key: '_x', value: 'y' }] })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'meta.update', {
            updates: [{ post_id: 7, key: '_x', value: 'y' }],
        })
    })

    it('metaDelete passes verb=meta.delete', async () => {
        await metaDelete(SITE, { post_id: 7, key: '_x' })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'meta.delete', {
            post_id: 7,
            key: '_x',
        })
    })

    it('optionGet passes verb=option.get', async () => {
        await optionGet(SITE, { name: 'kotoiq_shim_features_enabled' })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'option.get', {
            name: 'kotoiq_shim_features_enabled',
        })
    })

    it('optionUpdate passes verb=option.update with safe option name', async () => {
        await optionUpdate(SITE, { name: 'kotoiq_shim_features_enabled', value: { foo: true } })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'option.update', {
            name: 'kotoiq_shim_features_enabled',
            value: { foo: true },
        })
    })

    it('optionDelete passes verb=option.delete', async () => {
        await optionDelete(SITE, { name: 'kotoiq_shim_features_enabled' })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'option.delete', {
            name: 'kotoiq_shim_features_enabled',
        })
    })

    it('optionListByPrefix passes verb=option.list_by_prefix', async () => {
        await optionListByPrefix(SITE, { prefix: 'kotoiq_shim', limit: 50 })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'option.list_by_prefix', {
            prefix: 'kotoiq_shim',
            limit: 50,
        })
    })

    it('fileRead passes verb=file.read', async () => {
        await fileRead(SITE, { path: 'uploads/kotoiq/sitemap.xml' })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'file.read', {
            path: 'uploads/kotoiq/sitemap.xml',
        })
    })

    it('fileExists passes verb=file.exists', async () => {
        await fileExists(SITE, { path: 'themes/foo/style.css' })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'file.exists', {
            path: 'themes/foo/style.css',
        })
    })

    it('fileWrite passes verb=file.write under kotoiq uploads root', async () => {
        await fileWrite(SITE, {
            path: 'uploads/kotoiq/sitemap.xml',
            content_base64: btoa('<?xml ?>'),
        })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'file.write', {
            path: 'uploads/kotoiq/sitemap.xml',
            content_base64: btoa('<?xml ?>'),
        })
    })

    it('fileDelete passes verb=file.delete under kotoiq uploads root', async () => {
        await fileDelete(SITE, { path: 'uploads/kotoiq/sitemap.xml' })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'file.delete', {
            path: 'uploads/kotoiq/sitemap.xml',
        })
    })

    it('cronList passes verb=cron.list with no args', async () => {
        await cronList(SITE)
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'cron.list', {})
    })

    it('cronTrigger passes verb=cron.trigger', async () => {
        await cronTrigger(SITE, { hook: 'kotoiq_shim_sync', args: [1] })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'cron.trigger', {
            hook: 'kotoiq_shim_sync',
            args: [1],
        })
    })

    it('cronUnschedule passes verb=cron.unschedule', async () => {
        await cronUnschedule(SITE, { hook: 'kotoiq_shim_sync' })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'cron.unschedule', {
            hook: 'kotoiq_shim_sync',
        })
    })

    it('pluginList passes verb=plugin.list', async () => {
        await pluginList(SITE)
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'plugin.list', {})
    })

    it('pluginToggle passes verb=plugin.toggle', async () => {
        await pluginToggle(SITE, { plugin_file: 'akismet/akismet.php', enable: true })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'plugin.toggle', {
            plugin_file: 'akismet/akismet.php',
            enable: true,
        })
    })

    it('taxonomyList passes verb=taxonomy.list with no args', async () => {
        await taxonomyList(SITE)
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'taxonomy.list', {})
    })

    it('eventsLogTail passes verb=events.log_tail', async () => {
        await eventsLogTail(SITE, { count: 25 })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'events.log_tail', { count: 25 })
    })
})

describe('verbs/index — response passthrough', () => {
    it('happy path returns the shimRpc ok=true envelope unchanged', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            data: { applied: 3, errors: [] },
            status: 200,
        })
        const out = await metaUpdate(SITE, { updates: [] })
        expect(out).toEqual({ ok: true, data: { applied: 3, errors: [] }, status: 200 })
    })

    it('error path returns the shimRpc ok=false envelope unchanged', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: false,
            error: { code: 'not_paired', message: 'Site has not been paired' },
            status: 401,
        })
        const out = await healthDiagnostics(SITE)
        expect(out).toEqual({
            ok: false,
            error: { code: 'not_paired', message: 'Site has not been paired' },
            status: 401,
        })
    })
})

describe('verbs/index — runtime guards (defense in depth)', () => {
    it('optionUpdate({name: "siteurl"}) throws BEFORE calling shimRpc', async () => {
        await expect(optionUpdate(SITE, { name: 'siteurl', value: 'http://evil' })).rejects.toThrow(
            /deny.?list|protected|siteurl/i,
        )
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('optionUpdate({name: "admin_email"}) throws BEFORE calling shimRpc', async () => {
        await expect(optionUpdate(SITE, { name: 'admin_email', value: 'evil@x' })).rejects.toThrow(
            /deny.?list|protected|admin_email/i,
        )
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('optionUpdate({name: "_transient_foo"}) throws BEFORE calling shimRpc', async () => {
        await expect(optionUpdate(SITE, { name: '_transient_foo', value: 1 })).rejects.toThrow(
            /transient/i,
        )
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('optionDelete({name: "home"}) throws BEFORE calling shimRpc', async () => {
        await expect(optionDelete(SITE, { name: 'home' })).rejects.toThrow(/deny.?list|protected|home/i)
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('fileWrite outside uploads/kotoiq/ throws BEFORE calling shimRpc', async () => {
        await expect(
            fileWrite(SITE, { path: 'themes/foo.php', content_base64: 'aGk=' }),
        ).rejects.toThrow(/uploads\/kotoiq/i)
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('fileWrite with .. traversal throws BEFORE calling shimRpc', async () => {
        await expect(
            fileWrite(SITE, {
                path: 'uploads/kotoiq/../themes/foo.php',
                content_base64: 'aGk=',
            }),
        ).rejects.toThrow(/traversal|\.\./)
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('fileDelete outside uploads/kotoiq/ throws BEFORE calling shimRpc', async () => {
        await expect(fileDelete(SITE, { path: 'themes/foo.php' })).rejects.toThrow(
            /uploads\/kotoiq/i,
        )
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('fileWrite under uploads/kotoiq/ DOES call shimRpc (happy path)', async () => {
        await fileWrite(SITE, {
            path: 'uploads/kotoiq/sitemap.xml',
            content_base64: btoa('<urlset/>'),
        })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'file.write', {
            path: 'uploads/kotoiq/sitemap.xml',
            content_base64: btoa('<urlset/>'),
        })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Plan 10-05 — hardened verb wrappers + runtime guards
// ─────────────────────────────────────────────────────────────────────────────

describe('verbs/index — Plan 10-05 hardened wrapper contracts', () => {
    it('querySelect passes verb=query.select with named query', async () => {
        await querySelect(SITE, { name: 'posts.list_by_meta', params: { meta_key: '_x', meta_value: 'y' } })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'query.select', {
            name: 'posts.list_by_meta',
            params: { meta_key: '_x', meta_value: 'y' },
        })
    })

    it('querySelect allows __list_queries__ introspection', async () => {
        await querySelect(SITE, { name: '__list_queries__' })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'query.select', { name: '__list_queries__' })
    })

    it('capabilityApply passes verb=capability.apply', async () => {
        await capabilityApply(SITE, { role_slug: 'editor', add_caps: ['publish_posts'] })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'capability.apply', {
            role_slug: 'editor',
            add_caps: ['publish_posts'],
        })
    })

    it('transientDeletePrefix passes verb=transient.delete_prefix', async () => {
        await transientDeletePrefix(SITE, { prefix: 'koto_rotate' })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'transient.delete_prefix', {
            prefix: 'koto_rotate',
        })
    })

    it('databaseUpdateBulk passes verb=database.update_bulk', async () => {
        await databaseUpdateBulk(SITE, {
            updates: [{ table: 'wp_posts', pk_col: 'ID', pk_val: 1, column: 'post_content', value: 'x' }],
        })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'database.update_bulk', {
            updates: [{ table: 'wp_posts', pk_col: 'ID', pk_val: 1, column: 'post_content', value: 'x' }],
        })
    })

    it('webhookSet passes verb=webhook.set with https URL', async () => {
        await webhookSet(SITE, { event: 'save_post', url: 'https://hellokoto.com/wp-events' })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'webhook.set', {
            event: 'save_post',
            url: 'https://hellokoto.com/wp-events',
        })
    })

    it('webhookSet passes verb=webhook.set with null url (unregister)', async () => {
        await webhookSet(SITE, { event: 'save_post', url: null })
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'webhook.set', { event: 'save_post', url: null })
    })

    it('snippetsList routes to option.get against kotoiq_shim_snippets', async () => {
        await snippetsList(SITE)
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'option.get', { name: 'kotoiq_shim_snippets' })
    })

    it('snippetsSave routes to option.update against kotoiq_shim_snippets', async () => {
        await snippetsSave(SITE, [
            { id: 's1', kind: 'php', scope: 'frontend', code: '// noop', active: true },
        ])
        expect(shimRpc).toHaveBeenCalledWith(SITE, 'option.update', {
            name: 'kotoiq_shim_snippets',
            value: [{ id: 's1', kind: 'php', scope: 'frontend', code: '// noop', active: true }],
            autoload: false,
        })
    })
})

describe('verbs/index — Plan 10-05 runtime guards', () => {
    it('querySelect rejects an unknown named query BEFORE shimRpc', async () => {
        await expect(querySelect(SITE, { name: 'wp_users.list_passwords' })).rejects.toThrow(
            /unknown.*query|whitelist/i,
        )
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('querySelect rejects empty name BEFORE shimRpc', async () => {
        await expect(querySelect(SITE, { name: '' })).rejects.toThrow(/non-empty/i)
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('capabilityApply rejects role_slug=administrator BEFORE shimRpc', async () => {
        await expect(
            capabilityApply(SITE, { role_slug: 'administrator', remove_caps: ['edit_posts'] }),
        ).rejects.toThrow(/protected|administrator/i)
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('capabilityApply rejects add_caps=manage_options BEFORE shimRpc', async () => {
        await expect(
            capabilityApply(SITE, { role_slug: 'editor', add_caps: ['manage_options'] }),
        ).rejects.toThrow(/manage_options|ALWAYS_DENIED|denied/i)
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('capabilityApply rejects add_caps=install_plugins BEFORE shimRpc', async () => {
        await expect(
            capabilityApply(SITE, { role_slug: 'shop_manager', add_caps: ['install_plugins'] }),
        ).rejects.toThrow(/install_plugins|ALWAYS_DENIED|denied/i)
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('transientDeletePrefix rejects empty prefix BEFORE shimRpc', async () => {
        await expect(transientDeletePrefix(SITE, { prefix: '' })).rejects.toThrow(
            /empty|every transient/i,
        )
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('transientDeletePrefix rejects prefix with wildcard char BEFORE shimRpc', async () => {
        await expect(transientDeletePrefix(SITE, { prefix: 'koto%' })).rejects.toThrow(/regex|prefix/i)
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('databaseUpdateBulk rejects updates.length > 200 BEFORE shimRpc', async () => {
        const updates = Array.from({ length: 201 }, (_, i) => ({
            table: 'wp_posts',
            pk_col: 'ID',
            pk_val: i + 1,
            column: 'post_content',
            value: 'x',
        }))
        await expect(databaseUpdateBulk(SITE, { updates })).rejects.toThrow(/200|capped/i)
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('webhookSet rejects an unrecognised event BEFORE shimRpc', async () => {
        await expect(
            webhookSet(SITE, { event: 'siteurl', url: 'https://hellokoto.com/x' }),
        ).rejects.toThrow(/allowed-events|allowed|event/i)
        expect(shimRpc).not.toHaveBeenCalled()
    })

    it('webhookSet rejects http:// URLs BEFORE shimRpc', async () => {
        await expect(
            webhookSet(SITE, { event: 'save_post', url: 'http://hellokoto.com/x' }),
        ).rejects.toThrow(/https/i)
        expect(shimRpc).not.toHaveBeenCalled()
    })
})
