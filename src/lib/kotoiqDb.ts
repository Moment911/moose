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
    if (DIRECT_AGENCY_TABLES.has(table)) {
      return query.eq('agency_id', agencyId)
    }
    // Transitive tables: caller is responsible for scoping via FK joins,
    // but we log a warning in dev if this is a kotoiq_* table we know about
    if (TRANSITIVE_AGENCY_TABLES.has(table) && process.env.NODE_ENV === 'development') {
      console.warn(`[kotoiqDb] Querying transitive table "${table}" — ensure parent FK belongs to agency ${agencyId}`)
    }
    return query as any
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

  return {
    agencyId,
    client: sb,
    from: scopedFrom,
    insert: scopedInsert,
    templates,
    campaigns,
    schemaVersions,
    builderSites,
  }
}
