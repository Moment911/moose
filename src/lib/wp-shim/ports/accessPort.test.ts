import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// accessPort.test — verifies FEATURE_CAP_MAP mirrors v3, applyAccessPolicy
// composes correct (add_caps, remove_caps) per role, and that the policy
// option write + per-role capability.apply sequence happens in the right order.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../shimRpc', () => ({
    shimRpc: vi.fn(),
    shimRpcBatch: vi.fn(),
}))

import { shimRpc } from '../shimRpc'
import {
    ACCESS_POLICY_OPTION,
    FEATURE_CAP_MAP,
    computeRoleCapDiff,
    getAccessPolicy,
    applyAccessPolicy,
    resetAccessPolicy,
} from './accessPort'

const SITE = 'https://wp.example.com'

beforeEach(() => {
    ;(shimRpc as ReturnType<typeof vi.fn>).mockReset()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('accessPort — FEATURE_CAP_MAP (v3 parity)', () => {
    it('maps php_snippets to the same 3 caps v3 used', () => {
        expect(FEATURE_CAP_MAP.php_snippets).toEqual([
            'execute_php_snippets',
            'create_text_snippets',
            'manage_snippets',
        ])
    })

    it('maps snippet_management to manage_snippets', () => {
        expect(FEATURE_CAP_MAP.snippet_management).toEqual(['manage_snippets'])
    })

    it('maps pixels to manage_pixels', () => {
        expect(FEATURE_CAP_MAP.pixels).toEqual(['manage_pixels'])
    })

    it('maps access_management to manage_access', () => {
        expect(FEATURE_CAP_MAP.access_management).toEqual(['manage_access'])
    })

    it('includes file_editor / theme_editor / plugin_editor for the deny path', () => {
        expect(FEATURE_CAP_MAP.file_editor).toEqual(['edit_files'])
        expect(FEATURE_CAP_MAP.theme_editor).toEqual(['edit_themes'])
        expect(FEATURE_CAP_MAP.plugin_editor).toEqual(['edit_plugins'])
    })

    it('uses kotoiq_shim_access_policy option name', () => {
        expect(ACCESS_POLICY_OPTION).toBe('kotoiq_shim_access_policy')
    })
})

describe('accessPort — computeRoleCapDiff', () => {
    it('php_snippets=full → adds all 3 snippet caps', () => {
        const { add_caps, remove_caps } = computeRoleCapDiff({ php_snippets: 'full' })
        expect(add_caps).toContain('execute_php_snippets')
        expect(add_caps).toContain('create_text_snippets')
        expect(add_caps).toContain('manage_snippets')
        expect(remove_caps).toEqual([])
    })

    it('php_snippets=text → adds text caps, removes execute_php_snippets', () => {
        const { add_caps, remove_caps } = computeRoleCapDiff({ php_snippets: 'text' })
        expect(add_caps).toContain('create_text_snippets')
        expect(add_caps).toContain('manage_snippets')
        expect(add_caps).not.toContain('execute_php_snippets')
        expect(remove_caps).toContain('execute_php_snippets')
    })

    it('php_snippets=none → removes all 3 snippet caps', () => {
        const { add_caps, remove_caps } = computeRoleCapDiff({ php_snippets: 'none' })
        expect(add_caps).toEqual([])
        expect(remove_caps).toEqual(expect.arrayContaining([
            'execute_php_snippets',
            'create_text_snippets',
            'manage_snippets',
        ]))
    })

    it('pixels=granted → adds manage_pixels', () => {
        const { add_caps } = computeRoleCapDiff({ pixels: 'granted' })
        expect(add_caps).toEqual(['manage_pixels'])
    })

    it('file_editor=denied → removes edit_files (never add — ALWAYS_DENIED)', () => {
        const { add_caps, remove_caps } = computeRoleCapDiff({ file_editor: 'denied' })
        expect(remove_caps).toContain('edit_files')
        expect(add_caps).not.toContain('edit_files')
    })

    it('file_editor=granted → strips edit_files from add_caps (ALWAYS_DENIED)', () => {
        const { add_caps } = computeRoleCapDiff({ file_editor: 'granted' })
        expect(add_caps).not.toContain('edit_files')
    })
})

describe('accessPort — getAccessPolicy', () => {
    it('calls option.get with the access-policy option name', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { value: { role_features: {}, global_disable_file_edit: false }, exists: true },
            status: 200,
        })
        await getAccessPolicy(SITE)
        const call = (shimRpc as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(call[1]).toBe('option.get')
        expect(call[2].name).toBe('kotoiq_shim_access_policy')
    })

    it('returns empty default when option missing', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: { value: null, exists: false },
            status: 200,
        })
        const res = await getAccessPolicy(SITE)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.role_features).toEqual({})
        expect(res.data.global_disable_file_edit).toBe(false)
    })

    it('normalizes stored policy, drops unknown feature keys', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: {
                value: {
                    role_features: {
                        editor: { php_snippets: 'text', pixels: 'granted', nope_unknown: 'granted' },
                        contributor: { snippet_management: 'denied' },
                    },
                    global_disable_file_edit: true,
                    applied_at: '2026-05-01',
                },
                exists: true,
            },
            status: 200,
        })
        const res = await getAccessPolicy(SITE)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.role_features.editor.php_snippets).toBe('text')
        expect(res.data.role_features.editor.pixels).toBe('granted')
        expect((res.data.role_features.editor as Record<string, unknown>).nope_unknown).toBeUndefined()
        expect(res.data.global_disable_file_edit).toBe(true)
    })
})

describe('accessPort — applyAccessPolicy', () => {
    it('writes the policy FIRST, then issues capability.apply per role', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            // option.update for policy
            .mockResolvedValueOnce({ ok: true, data: { ok: true, changed: true }, status: 200 })
            // capability.apply for editor
            .mockResolvedValueOnce({
                ok: true,
                data: { ok: true, role: 'editor', added: ['manage_snippets'], removed: [], errors: [] },
                status: 200,
            })
        const res = await applyAccessPolicy(SITE, {
            role_features: {
                editor: { snippet_management: 'granted' },
            },
            global_disable_file_edit: false,
        })
        expect(res.ok).toBe(true)
        if (!res.ok) return

        const calls = (shimRpc as ReturnType<typeof vi.fn>).mock.calls
        expect(calls[0][1]).toBe('option.update')
        expect(calls[0][2].name).toBe('kotoiq_shim_access_policy')
        expect(calls[1][1]).toBe('capability.apply')
        expect(calls[1][2].role_slug).toBe('editor')
        expect(calls[1][2].add_caps).toContain('manage_snippets')
        expect(res.data.policy_written).toBe(true)
    })

    it('skips administrator role with role_protected error', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            data: { ok: true, changed: true },
            status: 200,
        })
        const res = await applyAccessPolicy(SITE, {
            role_features: {
                administrator: { php_snippets: 'full' },
            },
            global_disable_file_edit: false,
        })
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.errors).toEqual([
            { role_slug: 'administrator', code: 'role_protected', message: expect.any(String) },
        ])
        // Only the policy write should have happened, no capability.apply.
        const calls = (shimRpc as ReturnType<typeof vi.fn>).mock.calls
        expect(calls).toHaveLength(1)
        expect(calls[0][1]).toBe('option.update')
    })

    it('aggregates per-role capability.apply errors without short-circuiting', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            // option.update OK
            .mockResolvedValueOnce({ ok: true, data: { ok: true, changed: true }, status: 200 })
            // capability.apply for editor: FAILS
            .mockResolvedValueOnce({
                ok: false,
                error: { code: 'unknown_role', message: 'role editor missing' },
                status: 404,
            })
            // capability.apply for contributor: OK
            .mockResolvedValueOnce({
                ok: true,
                data: { ok: true, role: 'contributor', added: ['manage_snippets'], removed: [], errors: [] },
                status: 200,
            })
        const res = await applyAccessPolicy(SITE, {
            role_features: {
                editor: { snippet_management: 'granted' },
                contributor: { snippet_management: 'granted' },
            },
            global_disable_file_edit: false,
        })
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.errors).toHaveLength(1)
        expect(res.data.errors[0].role_slug).toBe('editor')
        expect(res.data.applied_roles).toHaveLength(2)
    })

    it('returns ok=false when initial policy write fails', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: false,
            error: { code: 'option_blocked', message: 'protected' },
            status: 400,
        })
        const res = await applyAccessPolicy(SITE, {
            role_features: { editor: { snippet_management: 'granted' } },
            global_disable_file_edit: false,
        })
        expect(res.ok).toBe(false)
        if (res.ok) return
        expect(res.error.code).toBe('option_blocked')
    })
})

describe('accessPort — resetAccessPolicy', () => {
    it('reads policy, removes managed caps per non-admin role, writes empty policy', async () => {
        ;(shimRpc as ReturnType<typeof vi.fn>)
            // getAccessPolicy → option.get
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    value: {
                        role_features: {
                            editor: { php_snippets: 'full' },
                            administrator: { php_snippets: 'full' },
                            contributor: { pixels: 'granted' },
                        },
                        global_disable_file_edit: false,
                    },
                    exists: true,
                },
                status: 200,
            })
            // capability.apply for editor
            .mockResolvedValueOnce({
                ok: true,
                data: { ok: true, role: 'editor', added: [], removed: ['manage_snippets'], errors: [] },
                status: 200,
            })
            // capability.apply for contributor
            .mockResolvedValueOnce({
                ok: true,
                data: { ok: true, role: 'contributor', added: [], removed: ['manage_pixels'], errors: [] },
                status: 200,
            })
            // option.update for empty policy
            .mockResolvedValueOnce({
                ok: true,
                data: { ok: true, changed: true },
                status: 200,
            })
        const res = await resetAccessPolicy(SITE)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.data.reset_roles).toContain('editor')
        expect(res.data.reset_roles).toContain('contributor')
        expect(res.data.reset_roles).not.toContain('administrator')

        // verify last call writes an empty policy
        const calls = (shimRpc as ReturnType<typeof vi.fn>).mock.calls
        const lastCall = calls[calls.length - 1]
        expect(lastCall[1]).toBe('option.update')
        expect(lastCall[2].name).toBe('kotoiq_shim_access_policy')
        expect((lastCall[2].value as { role_features: Record<string, unknown> }).role_features).toEqual({})
    })
})
