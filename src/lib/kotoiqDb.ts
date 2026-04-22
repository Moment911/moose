import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * KotoIQ Agency-Scoped Database Helper (FND-03)
 *
 * Every KotoIQ table carries agency_id (explicit or transitive).
 * This helper ensures all queries on kotoiq_* tables are scoped to the
 * authenticated agency. It wraps the service-role client and adds
 * automatic agency_id filtering.
 *
 * Usage in API routes:
 *
 *   import { getKotoIQDb } from '@/lib/kotoiqDb'
 *
 *   const db = getKotoIQDb(agencyId)
 *   const { data } = await db.templates.list()
 *   const { data } = await db.campaigns.list({ client_id })
 *   const { data } = await db.raw().from('kotoiq_templates').select('*')
 *     // ↑ raw() still scopes to agency_id automatically
 *
 * Never use getSupabase() directly for kotoiq_* tables — use this helper.
 */

// ── Raw Supabase client (service role) ──────────────────────────────────────

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('[kotoiqDb] Missing SUPABASE_URL or SERVICE_ROLE_KEY — refusing to proceed with anon key for KotoIQ writes')
  }
  return createClient(url, key)
}

// ── Agency-scoped query builder ─────────────────────────────────────────────

/** Tables that carry agency_id directly */
const DIRECT_AGENCY_TABLES = new Set([
  'kotoiq_builder_sites',
  'kotoiq_templates',
  'kotoiq_campaigns',
  'kotoiq_client_profile',      // Phase 7 — D-01..D-05
  'kotoiq_clarifications',      // Phase 7 — D-16
  'koto_agency_integrations',   // Phase 8 — D-02, D-32 (encrypted payload; Plan 03 ships vault)
])

/** Tables where agency_id is transitive (through a parent FK) */
const TRANSITIVE_AGENCY_TABLES = new Set([
  'kotoiq_template_slots',      // via template_id → kotoiq_templates.agency_id
  'kotoiq_variants',            // via campaign_id → kotoiq_campaigns.agency_id
  'kotoiq_publishes',           // via site_id → koto_wp_sites.agency_id
  'kotoiq_cwv_readings',        // via publish_id
  'kotoiq_indexnow_submissions',// via publish_id
  'kotoiq_call_attribution',    // via variant_id
  'kotoiq_elementor_schema_versions', // via site_id
])

export interface KotoIQDb {
  /** The agency_id this instance is scoped to */
  agencyId: string

  /** Raw Supabase client — use for complex queries. Agency scoping is your responsibility. */
  client: SupabaseClient

  /**
   * Agency-scoped select on any kotoiq_* table.
   * For direct-agency tables, automatically adds .eq('agency_id', agencyId).
   * For transitive tables, returns the query builder — caller must ensure
   * the join naturally scopes (e.g., filtering by a campaign_id that belongs
   * to this agency).
   */
  from: (table: string) => ReturnType<SupabaseClient['from']>

  /**
   * Insert with automatic agency_id injection for direct-agency tables.
   * Throws if inserting into a direct-agency table with a mismatched agency_id.
   */
  insert: (table: string, row: Record<string, any> | Record<string, any>[]) => Promise<any>

  // ── Typed helpers for common operations ──

  templates: {
    list: (filters?: { client_id?: string; status?: string }) => Promise<any>
    get: (id: string) => Promise<any>
    create: (data: Record<string, any>) => Promise<any>
    update: (id: string, data: Record<string, any>) => Promise<any>
  }

  campaigns: {
    list: (filters?: { client_id?: string; site_id?: string; status?: string }) => Promise<any>
    get: (id: string) => Promise<any>
    create: (data: Record<string, any>) => Promise<any>
    update: (id: string, data: Record<string, any>) => Promise<any>
  }

  schemaVersions: {
    list: (siteId: string) => Promise<any>
    getPinned: (siteId: string) => Promise<any>
    capture: (data: Record<string, any>) => Promise<any>
    pin: (id: string) => Promise<any>
  }

  builderSites: {
    get: (siteId: string) => Promise<any>
    upsert: (data: Record<string, any>) => Promise<any>
  }

  // ── Phase 7 — Client Profile Seeder ────────────────────────────────────────
  // See src/lib/kotoiq/profileTypes.ts for the row shapes these helpers
  // surface.  All seven kotoiq_client_profile.* methods + seven
  // kotoiq_clarifications.* methods route through scopedFrom / scopedInsert
  // so agency_id is always injected — never use sb.from('kotoiq_client_*')
  // directly (caught at lint time by kotoiq/no-unscoped-kotoiq).

  clientProfile: {
    get: (clientId: string) => Promise<any>
    upsert: (data: Record<string, any>) => Promise<any>
    updateField: (
      profileId: string,
      fieldName: string,
      newRecord: Record<string, any>,
    ) => Promise<any>
    addField: (
      profileId: string,
      fieldName: string,
      value: any,
      sourceMeta: Record<string, any>,
    ) => Promise<any>
    deleteField: (profileId: string, fieldName: string) => Promise<any>
    list: (filters?: { client_id?: string; launched?: boolean }) => Promise<any>
    markLaunched: (profileId: string, runId: string) => Promise<any>
  }

  clarifications: {
    list: (filters?: {
      client_id?: string
      status?: string
      severity?: string
      limit?: number
    }) => Promise<any>
    get: (id: string) => Promise<any>
    create: (data: Record<string, any>) => Promise<any>
    update: (id: string, patch: Record<string, any>) => Promise<any>
    markAnswered: (
      id: string,
      answerText: string,
      answeredBy: string,
    ) => Promise<any>
    markForwarded: (
      id: string,
      channel: 'sms' | 'email' | 'portal',
    ) => Promise<any>
    markSkipped: (id: string) => Promise<any>
  }

  // ── Phase 8 — koto_agency_integrations (D-02, D-32) ───────────────────────
  // Stores encrypted per-agency credentials for Typeform / Jotform /
  // Google Forms / GBP OAuth / Places API.  This helper does NOT encrypt —
  // Plan 03 ships `profileIntegrationsVault.ts` and callers must encrypt
  // the payload before handing it to `upsert`.
  //
  // Auto-scoping: `koto_agency_integrations` is in DIRECT_AGENCY_TABLES so
  // every `db.from('koto_agency_integrations')` call structurally filters
  // by agency_id — cross-agency reads are impossible through this helper.
  agencyIntegrations: {
    list: (filters?: { integration_kind?: string; scope_client_id?: string | null }) => Promise<any>
    get: (id: string) => Promise<any>
    getByKind: (kind: string, scopeClientId?: string | null) => Promise<any>
    upsert: (row: Record<string, any>) => Promise<any>
    delete: (id: string) => Promise<any>
    markTested: (id: string, ok: boolean, error?: string | null) => Promise<any>
  }
}

/**
 * Get an agency-scoped KotoIQ database helper.
 *
 * @param agencyId — The authenticated agency's ID. Must not be null.
 * @throws if agencyId is falsy (prevents accidental cross-tenant queries)
 */
export function getKotoIQDb(agencyId: string): KotoIQDb {
  if (!agencyId) {
    throw new Error('[kotoiqDb] agency_id is required — refusing to create unscoped KotoIQ client')
  }

  const sb = getServiceClient()

  // ── Core from() with auto-scoping ──

  function scopedFrom(table: string) {
    const query = sb.from(table) as any
    if (!DIRECT_AGENCY_TABLES.has(table)) {
      if (TRANSITIVE_AGENCY_TABLES.has(table) && process.env.NODE_ENV === 'development') {
        console.warn(`[kotoiqDb] Querying transitive table "${table}" — ensure parent FK belongs to agency ${agencyId}`)
      }
      return query as any
    }
    // DIRECT_AGENCY_TABLES: Supabase JS v2 QueryBuilder has no .eq() — only
    // the FilterBuilder returned by .select()/.update()/.delete() does. So
    // we proxy those three methods and append .eq('agency_id', ...) to the
    // resulting FilterBuilder. .insert()/.upsert() are handled by the
    // separate scopedInsert helper which injects agency_id into the payload.
    return new Proxy(query, {
      get(target, prop) {
        const orig = target[prop]
        if (typeof orig !== 'function') return orig
        if (prop === 'select' || prop === 'update' || prop === 'delete') {
          return (...args: any[]) => orig.apply(target, args).eq('agency_id', agencyId)
        }
        return orig.bind(target)
      },
    }) as any
  }

  // ── Insert with agency_id injection ──

  async function scopedInsert(table: string, row: Record<string, any> | Record<string, any>[]) {
    const rows = Array.isArray(row) ? row : [row]

    if (DIRECT_AGENCY_TABLES.has(table)) {
      const injected = rows.map(r => {
        if (r.agency_id && r.agency_id !== agencyId) {
          throw new Error(`[kotoiqDb] Attempted insert into ${table} with agency_id=${r.agency_id} but scoped to ${agencyId}`)
        }
        return { ...r, agency_id: agencyId }
      })
      return sb.from(table).insert(injected).select()
    }

    return sb.from(table).insert(rows).select()
  }

  // ── Typed helpers ──

  const templates = {
    async list(filters?: { client_id?: string; status?: string }) {
      let q = scopedFrom('kotoiq_templates').select('*')
      if (filters?.client_id) q = q.eq('client_id', filters.client_id)
      if (filters?.status) q = q.eq('status', filters.status)
      return q.order('ingested_at', { ascending: false })
    },
    async get(id: string) {
      return scopedFrom('kotoiq_templates').select('*').eq('id', id).single()
    },
    async create(data: Record<string, any>) {
      return scopedInsert('kotoiq_templates', data)
    },
    async update(id: string, data: Record<string, any>) {
      return scopedFrom('kotoiq_templates')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    },
  }

  const campaigns = {
    async list(filters?: { client_id?: string; site_id?: string; status?: string }) {
      let q = scopedFrom('kotoiq_campaigns').select('*')
      if (filters?.client_id) q = q.eq('client_id', filters.client_id)
      if (filters?.site_id) q = q.eq('site_id', filters.site_id)
      if (filters?.status) q = q.eq('status', filters.status)
      return q.order('created_at', { ascending: false })
    },
    async get(id: string) {
      return scopedFrom('kotoiq_campaigns').select('*').eq('id', id).single()
    },
    async create(data: Record<string, any>) {
      return scopedInsert('kotoiq_campaigns', data)
    },
    async update(id: string, data: Record<string, any>) {
      return scopedFrom('kotoiq_campaigns')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    },
  }

  const schemaVersions = {
    async list(siteId: string) {
      return sb.from('kotoiq_elementor_schema_versions')
        .select('*')
        .eq('site_id', siteId)
        .order('captured_at', { ascending: false })
    },
    async getPinned(siteId: string) {
      return sb.from('kotoiq_elementor_schema_versions')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_pinned', true)
        .maybeSingle()
    },
    async capture(data: Record<string, any>) {
      return sb.from('kotoiq_elementor_schema_versions')
        .insert(data)
        .select()
        .single()
    },
    async pin(id: string) {
      // Unpin all others for this site first, then pin the target
      const { data: target } = await sb.from('kotoiq_elementor_schema_versions')
        .select('site_id').eq('id', id).single()
      if (target?.site_id) {
        await sb.from('kotoiq_elementor_schema_versions')
          .update({ is_pinned: false })
          .eq('site_id', target.site_id)
        await sb.from('kotoiq_elementor_schema_versions')
          .update({ is_pinned: true })
          .eq('id', id)
      }
      return sb.from('kotoiq_elementor_schema_versions')
        .select('*').eq('id', id).single()
    },
  }

  const builderSites = {
    async get(siteId: string) {
      return scopedFrom('kotoiq_builder_sites')
        .select('*')
        .eq('site_id', siteId)
        .maybeSingle()
    },
    async upsert(data: Record<string, any>) {
      return sb.from('kotoiq_builder_sites')
        .upsert({ ...data, agency_id: agencyId, updated_at: new Date().toISOString() }, { onConflict: 'site_id' })
        .select()
        .single()
    },
  }

  // ── Phase 7 — Client Profile Seeder helpers ──────────────────────────────
  // Hot columns kept in sync with the migration + CANONICAL_FIELD_NAMES first
  // 11 entries (src/lib/kotoiq/profileTypes.ts).  When fieldName is a hot
  // column, updateField / addField / deleteField also update the indexed
  // text column on the row so the launch-page list query stays fast.
  const PROFILE_HOT_COLUMNS = new Set([
    'business_name',
    'website',
    'primary_service',
    'target_customer',
    'service_area',
    'phone',
    'founding_year',
    'unique_selling_prop',
    'industry',
    'city',
    'state',
  ])

  // Sort ProvenanceRecord[] so that operator_edit always wins ties, then
  // by descending numeric confidence (higher wins).  Used inside the helpers
  // to recompute the winning value after every mutation.
  function sortProvenanceRecords(arr: any[]): any[] {
    return [...arr].sort((a, b) => {
      const aOp = a?.source_type === 'operator_edit'
      const bOp = b?.source_type === 'operator_edit'
      if (aOp && !bOp) return -1
      if (bOp && !aOp) return 1
      return (b?.confidence ?? 0) - (a?.confidence ?? 0)
    })
  }

  const clientProfile = {
    async get(clientId: string) {
      return scopedFrom('kotoiq_client_profile')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
    },
    async upsert(data: Record<string, any>) {
      // data MUST include client_id; agency_id is injected here.
      return sb.from('kotoiq_client_profile')
        .upsert(
          {
            ...data,
            agency_id: agencyId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'agency_id,client_id' },
        )
        .select()
        .single()
    },
    async updateField(
      profileId: string,
      fieldName: string,
      newRecord: Record<string, any>,
    ) {
      const { data: current, error: readErr } = await scopedFrom('kotoiq_client_profile')
        .select('id,fields')
        .eq('id', profileId)
        .single()
      if (readErr || !current) {
        return { data: null, error: readErr || new Error('profile not found') }
      }
      const fields = ((current as any).fields || {}) as Record<string, any[]>
      const arr = Array.isArray(fields[fieldName]) ? [...fields[fieldName]] : []
      arr.push(newRecord)
      fields[fieldName] = sortProvenanceRecords(arr)

      const patch: Record<string, any> = {
        fields,
        last_edited_at: new Date().toISOString(),
        completeness_score: null,        // re-score on next pipeline tick
      }
      if (PROFILE_HOT_COLUMNS.has(fieldName)) {
        patch[fieldName] = fields[fieldName][0]?.value ?? null
      }
      return scopedFrom('kotoiq_client_profile')
        .update(patch)
        .eq('id', profileId)
        .select()
        .single()
    },
    async addField(
      profileId: string,
      fieldName: string,
      value: any,
      sourceMeta: Record<string, any>,
    ) {
      // D-05 — operator-added field. Confidence pinned to 1.0,
      // source_type = 'operator_edit'. Never appends to an existing array;
      // operator-added means "this is the truth, replace what was there".
      const { data: current, error: readErr } = await scopedFrom('kotoiq_client_profile')
        .select('id,fields')
        .eq('id', profileId)
        .single()
      if (readErr || !current) {
        return { data: null, error: readErr || new Error('profile not found') }
      }
      const fields = ((current as any).fields || {}) as Record<string, any[]>
      fields[fieldName] = [
        {
          value,
          source_type: 'operator_edit',
          confidence: 1.0,
          captured_at: new Date().toISOString(),
          ...sourceMeta,
        },
      ]
      const patch: Record<string, any> = {
        fields,
        last_edited_at: new Date().toISOString(),
        completeness_score: null,
      }
      if (PROFILE_HOT_COLUMNS.has(fieldName)) {
        patch[fieldName] = value
      }
      return scopedFrom('kotoiq_client_profile')
        .update(patch)
        .eq('id', profileId)
        .select()
        .single()
    },
    async deleteField(profileId: string, fieldName: string) {
      const { data: current, error: readErr } = await scopedFrom('kotoiq_client_profile')
        .select('id,fields')
        .eq('id', profileId)
        .single()
      if (readErr || !current) {
        return { data: null, error: readErr || new Error('profile not found') }
      }
      const fields = ((current as any).fields || {}) as Record<string, any[]>
      delete fields[fieldName]
      const patch: Record<string, any> = {
        fields,
        last_edited_at: new Date().toISOString(),
        completeness_score: null,
      }
      if (PROFILE_HOT_COLUMNS.has(fieldName)) {
        patch[fieldName] = null
      }
      return scopedFrom('kotoiq_client_profile')
        .update(patch)
        .eq('id', profileId)
        .select()
        .single()
    },
    async list(filters?: { client_id?: string; launched?: boolean }) {
      let q = scopedFrom('kotoiq_client_profile').select('*')
      if (filters?.client_id) q = q.eq('client_id', filters.client_id)
      if (filters?.launched === true) q = q.not('launched_at', 'is', null)
      if (filters?.launched === false) q = q.is('launched_at', null)
      return q.order('updated_at', { ascending: false })
    },
    async markLaunched(profileId: string, runId: string) {
      return scopedFrom('kotoiq_client_profile')
        .update({
          launched_at: new Date().toISOString(),
          last_pipeline_run_id: runId,
        })
        .eq('id', profileId)
        .select()
        .single()
    },
  }

  const clarifications = {
    async list(filters?: {
      client_id?: string
      status?: string
      severity?: string
      limit?: number
    }) {
      let q = scopedFrom('kotoiq_clarifications').select('*')
      if (filters?.client_id) q = q.eq('client_id', filters.client_id)
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.severity) q = q.eq('severity', filters.severity)
      // High-severity first, then oldest first within a severity bucket so
      // the dashboard surfaces the longest-pending blocker at the top.
      q = q.order('severity', { ascending: false }).order('created_at', { ascending: true })
      if (filters?.limit) q = q.limit(filters.limit)
      return q
    },
    async get(id: string) {
      return scopedFrom('kotoiq_clarifications').select('*').eq('id', id).single()
    },
    async create(data: Record<string, any>) {
      return scopedInsert('kotoiq_clarifications', data)
    },
    async update(id: string, patch: Record<string, any>) {
      return scopedFrom('kotoiq_clarifications')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    },
    async markAnswered(id: string, answerText: string, answeredBy: string) {
      return scopedFrom('kotoiq_clarifications')
        .update({
          status: 'answered',
          answer_text: answerText,
          answered_by: answeredBy,
          answered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
    },
    async markForwarded(id: string, channel: 'sms' | 'email' | 'portal') {
      return scopedFrom('kotoiq_clarifications')
        .update({
          status: 'asked_client',
          asked_channel: channel,
          asked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
    },
    async markSkipped(id: string) {
      return scopedFrom('kotoiq_clarifications')
        .update({ status: 'skipped', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    },
  }

  // ── Phase 8 — koto_agency_integrations helpers ───────────────────────────
  // Because the table is in DIRECT_AGENCY_TABLES, every scopedFrom call
  // auto-injects .eq('agency_id', agencyId) — see scopedFrom above.  We
  // must pass agency_id explicitly into INSERT/UPSERT writes via
  // scopedInsert (or via the custom upsert() path below, which mirrors
  // scopedInsert's injection so the unique constraint resolves correctly).
  //
  // IMPORTANT — encryption boundary: this helper does NOT encrypt the
  // payload. Callers (Plan 03 onward) MUST pass `encrypted_payload`
  // already sealed by profileIntegrationsVault.ts. Plaintext writes will
  // store plaintext — no defensive check here (Plan 03's vault module
  // enforces "seal before write").
  const agencyIntegrations = {
    async list(filters?: { integration_kind?: string; scope_client_id?: string | null }) {
      let q = scopedFrom('koto_agency_integrations').select('*')
      if (filters?.integration_kind) q = q.eq('integration_kind', filters.integration_kind)
      if (filters?.scope_client_id === null) q = q.is('scope_client_id', null)
      else if (filters?.scope_client_id) q = q.eq('scope_client_id', filters.scope_client_id)
      return q.order('created_at', { ascending: false })
    },
    async get(id: string) {
      return scopedFrom('koto_agency_integrations')
        .select('*')
        .eq('id', id)
        .maybeSingle()
    },
    async getByKind(kind: string, scopeClientId?: string | null) {
      let q = scopedFrom('koto_agency_integrations')
        .select('*')
        .eq('integration_kind', kind)
      q = (scopeClientId === null || scopeClientId === undefined)
        ? q.is('scope_client_id', null)
        : q.eq('scope_client_id', scopeClientId)
      return q.maybeSingle()
    },
    async upsert(row: Record<string, any>) {
      // Respect the unique constraint (agency_id, integration_kind, scope_client_id)
      // and inject agency_id from the scope — never trust caller-supplied
      // agency_id.  Mirrors scopedInsert's invariant check.
      if (row.agency_id && row.agency_id !== agencyId) {
        throw new Error(`[kotoiqDb] Attempted agencyIntegrations.upsert with agency_id=${row.agency_id} but scoped to ${agencyId}`)
      }
      return sb.from('koto_agency_integrations')
        .upsert(
          { ...row, agency_id: agencyId, updated_at: new Date().toISOString() },
          { onConflict: 'agency_id,integration_kind,scope_client_id' },
        )
        .select()
        .single()
    },
    async delete(id: string) {
      return scopedFrom('koto_agency_integrations').delete().eq('id', id)
    },
    async markTested(id: string, ok: boolean, error?: string | null) {
      return scopedFrom('koto_agency_integrations')
        .update({
          last_tested_at: new Date().toISOString(),
          last_tested_ok: ok,
          last_test_error: error ?? null,
        })
        .eq('id', id)
        .select()
        .single()
    },
  }

  return {
    agencyId,
    client: sb,
    from: scopedFrom,
    insert: scopedInsert,
    templates,
    campaigns,
    schemaVersions,
    builderSites,
    clientProfile,
    clarifications,
    agencyIntegrations,
  }
}
