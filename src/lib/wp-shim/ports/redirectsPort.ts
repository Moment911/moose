// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 07 — redirectsPort — dashboard-side replacement of v3's
// modules/seo-redirects.php.
//
// What v3 did vs what we do here:
//
//   v3 lifecycle (full path):
//     1. Operator manages rules via /wp-json/kotoiq/v1/seo/redirects (CRUD)
//        — stored in wp_options under `kotoiq_seo_redirects`.
//     2. Operator views 404s via /wp-json/kotoiq/v1/seo/404-log (read-only).
//     3. AT REQUEST TIME, the PHP plugin's template_redirect hook reads the
//        rules option and performs the redirect via wp_redirect().
//     4. 404 logging: PHP plugin's same template_redirect hook detects is_404()
//        and appends to kotoiq_seo_404_log option.
//     5. Auto-redirect on slug change: post_updated hook compares old/new
//        post_name and inserts a 301 rule.
//
//   v4 redirectsPort (this file):
//     • CRUD on the rules option — STORED at `kotoiq_shim_redirects`.
//     • CRUD on the 404 log option — STORED at `kotoiq_shim_404_log`.
//     • Rule ENFORCEMENT runtime moved OUT of the v4 plugin (would be
//       IP-leaky: rule names + regex evaluator would reveal the rotation /
//       page-factory pattern). The dashboard manages the OPTION; the
//       operational story for which plugin enforces is documented in
//       Plan 10-11 cutover and Plan 10-12 sunset.
//
//   Enforcement options during the 60-day side-by-side cutover:
//     a. Keep v3 wpsimplecode/ installed alongside v4 kotoiq-shim/. v3 still
//        owns the template_redirect hook and enforces against its own option
//        key `kotoiq_seo_redirects`. We could write to BOTH option keys
//        (kotoiq_seo_redirects + kotoiq_shim_redirects) to preserve runtime.
//     b. Install a generic 3rd-party redirects plugin (Redirection from
//        wp.org) and have it read from the kotoiq_shim_redirects option (or
//        sync rules into it via a UI integration).
//     c. Site is not currently using redirects — no runtime needed.
//
//   The dashboard side just persists rules. Enforcement decisions are per-site.
//
// NOTE: Auto-redirect on slug change (v3's post_updated hook) is NOT carried
// in v4 — would require the plugin to detect slug changes and write to a
// dashboard-mediated rule list. The operator can opt into a webhook-driven
// equivalent in Plan 10-12 sunset playbook (webhook on save_post → dashboard
// inserts a redirect via this port).
// ─────────────────────────────────────────────────────────────────────────────

import { optionGet, optionUpdate, optionDelete } from '../verbs'
import type { OptionUpdateResponse } from '../verbs'
import type { ShimRpcResponse } from '../types'

export const REDIRECTS_OPTION = 'kotoiq_shim_redirects'
export const FOUR_OH_FOUR_OPTION = 'kotoiq_shim_404_log'

export type RedirectMatchType = 'exact' | 'regex'
export type RedirectStatusCode = 301 | 302 | 307

export interface RedirectRule {
    id: string
    from: string
    to: string
    type: RedirectMatchType
    status_code: RedirectStatusCode
    note?: string
    created_at: string
    updated_at?: string
    disabled?: boolean
}

export interface FourOhFourEntry {
    url: string
    referrer?: string
    ua?: string
    ip?: string
    time: string
    count?: number
}

function generateId(): string {
    // Browser + Node 18+ both have crypto.randomUUID; fall back if unavailable.
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
        return 'r_' + globalThis.crypto.randomUUID()
    }
    return 'r_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function asArray<T>(v: unknown): T[] {
    return Array.isArray(v) ? (v as T[]) : []
}

function normalizeStatusCode(n: unknown): RedirectStatusCode {
    const x = typeof n === 'number' ? n : parseInt(String(n ?? 301), 10)
    if (x === 302 || x === 307) return x
    return 301
}

function normalizeRule(raw: unknown, fallbackId?: string): RedirectRule | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const from = typeof r.from === 'string' ? r.from : ''
    const to = typeof r.to === 'string' ? r.to : ''
    if (!from || !to) return null
    return {
        id: typeof r.id === 'string' && r.id ? r.id : fallbackId ?? generateId(),
        from,
        to,
        type: r.type === 'regex' ? 'regex' : 'exact',
        status_code: normalizeStatusCode(r.status_code ?? r.type),
        note: typeof r.note === 'string' ? r.note : undefined,
        created_at: typeof r.created_at === 'string' ? r.created_at : new Date().toISOString(),
        updated_at: typeof r.updated_at === 'string' ? r.updated_at : undefined,
        disabled: r.disabled === true,
    }
}

/**
 * List all redirect rules for a site. Returns an empty array if the option
 * has never been written.
 */
export async function listRedirects(
    siteUrl: string,
): Promise<
    | { ok: true; data: RedirectRule[]; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const res = await optionGet(siteUrl, { name: REDIRECTS_OPTION })
    if (!res.ok) return res
    const rules = asArray<unknown>(res.data?.value)
        .map((r) => normalizeRule(r))
        .filter((r): r is RedirectRule => r !== null)
    return { ok: true, data: rules, status: res.status }
}

/**
 * Add a new redirect rule. ID + timestamps generated dashboard-side. Returns
 * the persisted rule on success.
 */
export async function addRedirect(
    siteUrl: string,
    rule: Omit<RedirectRule, 'id' | 'created_at' | 'updated_at'>,
): Promise<
    | { ok: true; data: RedirectRule; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const listed = await listRedirects(siteUrl)
    if (!listed.ok) return listed
    const now = new Date().toISOString()
    const newRule: RedirectRule = {
        id: generateId(),
        from: rule.from,
        to: rule.to,
        type: rule.type,
        status_code: rule.status_code,
        note: rule.note,
        disabled: rule.disabled === true,
        created_at: now,
    }
    const next = [...listed.data, newRule]
    const writeRes = await optionUpdate(siteUrl, {
        name: REDIRECTS_OPTION,
        value: next,
        autoload: true,
    })
    if (!writeRes.ok) return writeRes
    return { ok: true, data: newRule, status: writeRes.status }
}

/**
 * Remove a redirect rule by id. Idempotent — non-existent id is not an error.
 */
export async function removeRedirect(
    siteUrl: string,
    ruleId: string,
): Promise<ShimRpcResponse<OptionUpdateResponse>> {
    const listed = await listRedirects(siteUrl)
    if (!listed.ok) return listed
    const next = listed.data.filter((r) => r.id !== ruleId)
    return optionUpdate(siteUrl, {
        name: REDIRECTS_OPTION,
        value: next,
        autoload: true,
    })
}

/**
 * Update an existing redirect rule by id. Returns ok=false if no rule matched.
 */
export async function updateRedirect(
    siteUrl: string,
    ruleId: string,
    patch: Partial<Omit<RedirectRule, 'id' | 'created_at'>>,
): Promise<
    | { ok: true; data: RedirectRule; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const listed = await listRedirects(siteUrl)
    if (!listed.ok) return listed
    const idx = listed.data.findIndex((r) => r.id === ruleId)
    if (idx === -1) {
        return { ok: false, error: { code: 'rule_not_found', message: ruleId }, status: 404 }
    }
    const merged: RedirectRule = {
        ...listed.data[idx],
        ...patch,
        id: listed.data[idx].id,
        created_at: listed.data[idx].created_at,
        updated_at: new Date().toISOString(),
    }
    const next = [...listed.data]
    next[idx] = merged
    const writeRes = await optionUpdate(siteUrl, {
        name: REDIRECTS_OPTION,
        value: next,
        autoload: true,
    })
    if (!writeRes.ok) return writeRes
    return { ok: true, data: merged, status: writeRes.status }
}

/**
 * Read the 404 log for a site. v3 stored newest-first up to 500 entries.
 */
export async function listFourOhFours(
    siteUrl: string,
): Promise<
    | { ok: true; data: FourOhFourEntry[]; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const res = await optionGet(siteUrl, { name: FOUR_OH_FOUR_OPTION })
    if (!res.ok) return res
    const entries = asArray<unknown>(res.data?.value)
        .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
        .map((e) => ({
            url: typeof e.url === 'string' ? e.url : '',
            referrer: typeof e.referrer === 'string' ? e.referrer : undefined,
            ua: typeof e.ua === 'string' ? e.ua : undefined,
            ip: typeof e.ip === 'string' ? e.ip : undefined,
            time: typeof e.time === 'string' ? e.time : '',
            count: typeof e.count === 'number' ? e.count : undefined,
        }))
        .filter((e) => e.url)
    return { ok: true, data: entries, status: res.status }
}

/**
 * Clear the 404 log entirely. v3 wrote an empty array; v4 deletes the option
 * (option.delete is idempotent — works whether the option exists or not).
 */
export async function clearFourOhFourLog(
    siteUrl: string,
): Promise<ShimRpcResponse<{ ok: true; deleted: boolean }>> {
    return optionDelete(siteUrl, { name: FOUR_OH_FOUR_OPTION })
}
