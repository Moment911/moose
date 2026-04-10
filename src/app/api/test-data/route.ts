import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '@/lib/apiAuth'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const DEFAULT_AGENCY = '00000000-0000-0000-0000-000000000099'

// ─────────────────────────────────────────────────────────────
// Seed catalogs — every record gets source_meta.is_test=true
// ─────────────────────────────────────────────────────────────
const TEST_CLIENTS = [
  { name: 'Apex HVAC & Heating', industry: 'HVAC',          city: 'Denver, CO',     phone: '+13035550101', website: 'apex-hvac.example.com' },
  { name: 'Bright Smile Dental',  industry: 'Dental',        city: 'Austin, TX',     phone: '+15125550102', website: 'brightsmile.example.com' },
  { name: 'Coastal Roofing Co',   industry: 'Roofing',       city: 'Tampa, FL',      phone: '+18135550103', website: 'coastalroofs.example.com' },
  { name: 'DriveLine Auto Repair',industry: 'Auto Repair',   city: 'Phoenix, AZ',    phone: '+16025550104', website: 'driveline-auto.example.com' },
  { name: 'EverGreen Landscaping',industry: 'Landscaping',   city: 'Portland, OR',   phone: '+15035550105', website: 'evergreen-land.example.com' },
  { name: 'Foothill Plumbing',    industry: 'Plumbing',      city: 'Salt Lake City', phone: '+18015550106', website: 'foothillplumb.example.com' },
  { name: 'Greenleaf Med Spa',    industry: 'Med Spa',       city: 'Miami, FL',      phone: '+13055550107', website: 'greenleaf-spa.example.com' },
  { name: 'Horizon Real Estate',  industry: 'Real Estate',   city: 'Nashville, TN',  phone: '+16155550108', website: 'horizon-realty.example.com' },
]

const TEST_VOICE_LEADS = [
  { prospect_name: 'Sarah Mitchell',  business_name: 'Mitchell Family HVAC',  prospect_phone: '+13035550201', prospect_email: 'sarah@mitchellhvac.example.com', industry: 'HVAC' },
  { prospect_name: 'Carlos Rivera',   business_name: 'Rivera Roofing & Repair',prospect_phone: '+18135550202', prospect_email: 'carlos@riverarepair.example.com', industry: 'Roofing' },
  { prospect_name: 'Linda Park',      business_name: 'Park Dental Studio',     prospect_phone: '+15125550203', prospect_email: 'linda@parkdental.example.com',    industry: 'Dental' },
  { prospect_name: 'Tom Becker',      business_name: 'Becker Auto Body',       prospect_phone: '+16025550204', prospect_email: 'tom@beckerauto.example.com',     industry: 'Auto Repair' },
  { prospect_name: 'Renee Owens',     business_name: 'Owens Med Aesthetics',   prospect_phone: '+13055550205', prospect_email: 'renee@owensmed.example.com',     industry: 'Med Spa' },
]

const TEST_TAG = { is_test: true }

function nowMeta() {
  return { is_test: true, generated_at: new Date().toISOString() }
}

function pick<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return arr
  return arr.slice(0, n)
}

// ─────────────────────────────────────────────────────────────
// Discovery generator — creates engagements with sections seeded
// ─────────────────────────────────────────────────────────────
async function generateDiscovery(agencyId: string, count: number = 4) {
  const s = sb()
  // Pull the default sections shape from a freshly inserted row using the existing
  // discovery API would create circular dependency — instead we just write a minimal
  // sections array and rely on the discovery UI to fill it from the next compile.
  const minimalSections = [
    { id: 'section_01', title: '01 — Pre-Call Research', visible: true, fields: [] },
    { id: 'section_04', title: '04 — Foundation', visible: true, fields: [
      { id: '04a', question: 'Revenue sources ranked', answer: 'Sample test data: residential service 60%, commercial 25%, install 15%', source: 'preset', ai_questions: [] },
      { id: '04c', question: 'Team structure', answer: '12 employees, 4 office staff, 8 field techs', source: 'preset', ai_questions: [] },
    ]},
  ]

  const created: any[] = []
  for (const client of pick(TEST_CLIENTS, count)) {
    const { data, error } = await s.from('koto_discovery_engagements').insert({
      agency_id: agencyId,
      client_name: client.name,
      client_industry: client.industry,
      status: 'draft',
      sections: minimalSections,
      source_meta: nowMeta(),
    }).select('id').maybeSingle()
    if (error) continue
    if (data) {
      created.push(data)
      // Insert one domain per engagement
      await s.from('koto_discovery_domains').insert({
        engagement_id: data.id,
        agency_id: agencyId,
        url: client.website,
        domain_type: 'primary',
        scan_status: 'pending',
      })
    }
  }
  return { count: created.length }
}

// ─────────────────────────────────────────────────────────────
// Voice generator
// ─────────────────────────────────────────────────────────────
async function generateVoice(agencyId: string) {
  const s = sb()
  const created: any[] = []

  // Voice leads
  for (const lead of TEST_VOICE_LEADS) {
    try {
      const { data } = await s.from('koto_voice_leads').insert({
        agency_id: agencyId,
        prospect_name: lead.prospect_name,
        business_name: lead.business_name,
        prospect_phone: lead.prospect_phone,
        prospect_email: lead.prospect_email,
        industry: lead.industry,
        status: 'new',
        source_meta: nowMeta(),
      }).select('id').maybeSingle()
      if (data) created.push(data)
    } catch { /* skip if column missing */ }
  }

  // Sample completed calls (mix of outcomes)
  const sampleOutcomes = ['completed', 'voicemail', 'no_answer', 'completed', 'opted_in']
  for (let i = 0; i < TEST_VOICE_LEADS.length; i++) {
    const lead = TEST_VOICE_LEADS[i]
    try {
      await s.from('koto_voice_calls').insert({
        agency_id: agencyId,
        from_number: '+18885550000',
        to_number: lead.prospect_phone,
        status: sampleOutcomes[i % sampleOutcomes.length],
        duration_seconds: 40 + i * 23,
        sentiment: i % 2 === 0 ? 'Positive' : 'Neutral',
        retell_call_id: `test_call_${Date.now()}_${i}`,
        metadata: { prospect_name: lead.prospect_name, business_name: lead.business_name },
        source_meta: nowMeta(),
      })
    } catch { /* skip if column missing */ }
  }

  return { count: created.length }
}

// ─────────────────────────────────────────────────────────────
// Scout generator
// ─────────────────────────────────────────────────────────────
async function generateScout(agencyId: string) {
  const s = sb()
  let count = 0
  for (const client of TEST_CLIENTS) {
    try {
      const { data } = await s.from('koto_scout_leads').insert({
        agency_id: agencyId,
        company_name: client.name,
        industry: client.industry,
        city: client.city,
        phone: client.phone,
        website: client.website,
        status: 'new',
        score: 50 + Math.floor(Math.random() * 50),
        source_meta: nowMeta(),
      }).select('id').maybeSingle()
      if (data) count++
    } catch { /* skip if table missing */ }
  }
  return { count }
}

// ─────────────────────────────────────────────────────────────
// Opportunities generator
// ─────────────────────────────────────────────────────────────
async function generateOpportunities(agencyId: string) {
  const s = sb()
  let count = 0
  const sources = ['web_visitor', 'scout', 'voice_call', 'manual', 'inbound_call']
  const stages = ['new', 'engaged', 'qualified', 'proposal']
  for (let i = 0; i < TEST_CLIENTS.length; i++) {
    const client = TEST_CLIENTS[i]
    try {
      const { data } = await s.from('koto_opportunities').insert({
        agency_id: agencyId,
        source: sources[i % sources.length],
        stage: stages[i % stages.length],
        score: 40 + Math.floor(Math.random() * 60),
        hot: i % 3 === 0,
        company_name: client.name,
        contact_name: `Contact ${i + 1}`,
        contact_phone: client.phone,
        website: client.website,
        industry: client.industry,
        source_meta: nowMeta(),
      }).select('id').maybeSingle()
      if (data) count++
    } catch { /* skip if column missing */ }
  }
  return { count }
}

// ─────────────────────────────────────────────────────────────
// Clients generator
// ─────────────────────────────────────────────────────────────
async function generateClients(agencyId: string) {
  const s = sb()
  let count = 0
  for (const client of TEST_CLIENTS) {
    try {
      const { data } = await s.from('clients').insert({
        agency_id: agencyId,
        name: client.name,
        industry: client.industry,
        website: client.website,
        phone: client.phone,
        source_meta: nowMeta(),
      }).select('id').maybeSingle()
      if (data) count++
    } catch { /* skip if column missing */ }
  }
  return { count }
}

// ─────────────────────────────────────────────────────────────
// Counters
// ─────────────────────────────────────────────────────────────
async function countTestDataPerModule(agencyId: string) {
  const s = sb()
  async function safeCount(table: string) {
    try {
      const { count } = await s.from(table).select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('source_meta->>is_test', 'true')
      return count || 0
    } catch { return 0 }
  }
  const [discovery, voice_leads, voice_calls, scout, opportunities, clients, vault] = await Promise.all([
    safeCount('koto_discovery_engagements'),
    safeCount('koto_voice_leads'),
    safeCount('koto_voice_calls'),
    safeCount('koto_scout_leads'),
    safeCount('koto_opportunities'),
    safeCount('clients'),
    safeCount('koto_data_vault'),
  ])
  return { discovery, voice_leads, voice_calls, scout, opportunities, clients, vault }
}

// ─────────────────────────────────────────────────────────────
// Clear actions
// ─────────────────────────────────────────────────────────────
async function clearTestRowsForTable(agencyId: string, table: string): Promise<number> {
  const s = sb()
  try {
    // Defense in depth for the clients table. If this filter is ever
    // widened or refactored, a literal DELETE FROM clients wipes real
    // agency data — so we take an extra roundtrip:
    //   1. SELECT the ids of rows that would be affected
    //   2. Log them
    //   3. DELETE only those specific ids (by id, not by filter reuse)
    // Other tables use the straight filter-based delete.
    if (table === 'clients') {
      const { data: testRows, error: selErr } = await s
        .from('clients')
        .select('id, name, source_meta')
        .eq('agency_id', agencyId)
        .eq('source_meta->>is_test', 'true')

      if (selErr) {
        // eslint-disable-next-line no-console
        console.error('[clearTestRowsForTable] select failed for clients:', selErr.message)
        return 0
      }

      const rows = testRows || []
      // eslint-disable-next-line no-console
      console.log(
        `[clearTestRowsForTable] clients: about to delete ${rows.length} test rows for agency ${agencyId}`,
        rows.map((r: any) => ({ id: r.id, name: r.name })),
      )

      // Hard guard — if the select returned 0 or if something weird
      // slipped through (e.g. a row without is_test:true in source_meta),
      // bail out before the delete.
      if (rows.length === 0) return 0
      const safeIds = rows
        .filter((r: any) => r?.source_meta?.is_test === true)
        .map((r: any) => r.id)
      if (safeIds.length !== rows.length) {
        // eslint-disable-next-line no-console
        console.error(
          `[clearTestRowsForTable] ABORT — ${rows.length - safeIds.length} row(s) matched the filter but failed the is_test post-check. Nothing deleted.`,
        )
        return 0
      }
      // Circuit breaker — refuse to bulk-delete more than 50 clients in one call.
      if (safeIds.length > 50) {
        // eslint-disable-next-line no-console
        console.error(
          `[clearTestRowsForTable] ABORT — would delete ${safeIds.length} clients (> 50 limit). Nothing deleted.`,
        )
        return 0
      }

      const { count, error: delErr } = await s
        .from('clients')
        .delete({ count: 'exact' })
        .in('id', safeIds)
      if (delErr) {
        // eslint-disable-next-line no-console
        console.error('[clearTestRowsForTable] delete failed for clients:', delErr.message)
        return 0
      }
      return count || 0
    }

    // Non-clients tables: straightforward filter-based delete with
    // the same is_test guard.
    // Pre-count for the log so we can see in Vercel logs what was deleted.
    try {
      const { count: previewCount } = await s
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('source_meta->>is_test', 'true')
      // eslint-disable-next-line no-console
      console.log(`[clearTestRowsForTable] ${table}: about to delete ${previewCount || 0} test rows`)
    } catch { /* preview failure is non-fatal */ }

    const { count, error } = await s.from(table)
      .delete({ count: 'exact' })
      .eq('agency_id', agencyId)
      .eq('source_meta->>is_test', 'true')
    if (error) return 0
    return count || 0
  } catch { return 0 }
}

async function clearTestData(agencyId: string) {
  const tables = [
    'koto_discovery_domains',
    'koto_discovery_engagements',
    'koto_voice_calls',
    'koto_voice_leads',
    'koto_scout_leads',
    'koto_opportunities',
    'clients',
    'koto_data_vault',
  ]
  const results: Record<string, number> = {}
  for (const t of tables) {
    results[t] = await clearTestRowsForTable(agencyId, t)
  }
  return results
}

const MODULE_TABLES: Record<string, string[]> = {
  discovery: ['koto_discovery_domains', 'koto_discovery_engagements'],
  voice: ['koto_voice_calls', 'koto_voice_leads'],
  scout: ['koto_scout_leads'],
  opportunities: ['koto_opportunities'],
  clients: ['clients'],
  vault: ['koto_data_vault'],
}

async function clearModule(agencyId: string, module: string) {
  const tables = MODULE_TABLES[module] || []
  const results: Record<string, number> = {}
  for (const t of tables) {
    results[t] = await clearTestRowsForTable(agencyId, t)
  }
  return results
}

// Factory reset — wipes EVERYTHING, including non-test data, for an agency.
// Super-admin only — gated in the route handler.
async function factoryReset(agencyId: string) {
  const s = sb()
  const tables = [
    'koto_discovery_domains',
    'koto_discovery_share_tokens',
    'koto_discovery_comments',
    'koto_discovery_engagements',
    'koto_voice_calls',
    'koto_voice_leads',
    'koto_scout_leads',
    'koto_opportunities',
    'koto_data_vault',
    'koto_data_vault_snapshots',
  ]
  const results: Record<string, number> = {}
  for (const t of tables) {
    try {
      const { count, error } = await s.from(t)
        .delete({ count: 'exact' })
        .eq('agency_id', agencyId)
      results[t] = error ? 0 : (count || 0)
    } catch { results[t] = 0 }
  }
  return results
}

// ─────────────────────────────────────────────────────────────
// GET — counts only
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'counts'
    const agencyId = resolveAgencyId(req, searchParams) || DEFAULT_AGENCY

    if (action === 'counts') {
      const counts = await countTestDataPerModule(agencyId)
      return Response.json({ data: counts })
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { searchParams } = new URL(req.url)
    const action = body.action || searchParams.get('action') || ''
    const agencyId = resolveAgencyId(req, searchParams, body) || DEFAULT_AGENCY
    const isSuperAdmin = req.headers.get('x-koto-admin') === 'true'

    if (action === 'generate_all') {
      const [discovery, voice, scout, opps, clients] = await Promise.all([
        generateDiscovery(agencyId, 4),
        generateVoice(agencyId),
        generateScout(agencyId),
        generateOpportunities(agencyId),
        generateClients(agencyId),
      ])
      return Response.json({ data: { discovery, voice, scout, opportunities: opps, clients } })
    }

    if (action === 'generate_discovery') {
      return Response.json({ data: await generateDiscovery(agencyId, body.count || 4) })
    }
    if (action === 'generate_voice') {
      return Response.json({ data: await generateVoice(agencyId) })
    }
    if (action === 'generate_scout') {
      return Response.json({ data: await generateScout(agencyId) })
    }
    if (action === 'generate_opportunities') {
      return Response.json({ data: await generateOpportunities(agencyId) })
    }
    if (action === 'generate_clients') {
      return Response.json({ data: await generateClients(agencyId) })
    }

    if (action === 'clear_test_data') {
      return Response.json({ data: await clearTestData(agencyId) })
    }

    if (action === 'clear_module') {
      const module = body.module || ''
      if (!module) return Response.json({ error: 'Missing module' }, { status: 400 })
      return Response.json({ data: await clearModule(agencyId, module) })
    }

    if (action === 'factory_reset') {
      if (!isSuperAdmin) {
        return Response.json({ error: 'Super admin only' }, { status: 403 })
      }
      return Response.json({ data: await factoryReset(agencyId) })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
