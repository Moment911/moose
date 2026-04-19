// NOT server-only — pure function, runs anywhere (client or server). Plan 7
// operator UI may render a live entity-graph preview from the in-memory
// profile fields jsonb without an HTTP roundtrip; matching the precedent
// established by profileDiscrepancy.ts (Plan 3).

import type {
  ClientProfile,
  EntityGraphSeed,
  EntityGraphNode,
  EntityGraphEdge,
  ProvenanceRecord,
} from './profileTypes'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 4 — D-22 entity graph serializer + legacy-shape projector.
//
// Two pure functions:
//
//   profileToEntityGraphSeed(profile) → EntityGraphSeed (8 keys, D-22 contract)
//     Read by Stage 2 (entity graph) + Stage 4 (content generation). The
//     downstream engines (hyperlocalContentEngine, semanticAgents*, eeatEngine,
//     knowledgeGraphExporter) destructure these by name, so the 8-key shape
//     MUST stay stable.
//
//   profileToLegacyClientShape(profile) → 8-field plain object
//     The exact `.select('id, name, website, primary_service, industry,
//     target_customer, city, state')` shape that hyperlocalContentEngine.ts:147
//     reads. Lets Plan 4 stage 0 hand a ClientProfile to a stage that hasn't
//     been migrated to the new shape yet.
//
// Source mapping per RESEARCH §1 "Downstream consumer mapping table":
//   client_node          ← business_name + website
//   service_nodes        ← primary_service + fields.services list
//   audience_nodes       ← target_customer
//   competitor_nodes     ← fields.competitors + fields.competitor_mentions
//   service_area_nodes   ← service_area + fields.service_areas
//   differentiator_edges ← unique_selling_prop + fields.differentiators
//   trust_anchor_nodes   ← founding_year + fields.trust_anchors
//   confidence_by_node   ← flat id → confidence map for halo rendering
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(rec: any): string[] {
  if (!rec) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = Array.isArray(rec) ? rec : [rec]
  return v
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((x: any) =>
      typeof x === 'string' ? x : String(x?.value ?? x ?? ''),
    )
    .filter(Boolean)
}

/**
 * Returns the winning-record value (operator_edit wins ties, then descending
 * confidence). Mirrors the sort already applied in `kotoiqDb.updateField` —
 * defensive re-sort here protects direct callers that bypass the helper.
 */
function winningValue(records: ProvenanceRecord[] | undefined): string | null {
  if (!records || records.length === 0) return null
  const sorted = [...records].sort((a, b) => {
    if (a.source_type === 'operator_edit' && b.source_type !== 'operator_edit') return -1
    if (b.source_type === 'operator_edit' && a.source_type !== 'operator_edit') return 1
    return (b.confidence || 0) - (a.confidence || 0)
  })
  const v = sorted[0].value
  if (Array.isArray(v)) return v.join(', ')
  if (v === null || v === undefined) return null
  return String(v)
}

function winningConfidence(records: ProvenanceRecord[] | undefined): number {
  if (!records || records.length === 0) return 0
  return Math.max(...records.map((r) => r.confidence || 0))
}

function winningSourceRefs(records: ProvenanceRecord[] | undefined): string[] {
  if (!records) return []
  return records
    .map((r) => r.source_ref || r.source_url || '')
    .filter(Boolean)
}

function kebab(s: string): string {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function profileToEntityGraphSeed(profile: ClientProfile): EntityGraphSeed {
  const fields = profile.fields || {}

  // ── client_node ────────────────────────────────────────────────────────────
  const clientName =
    profile.business_name || winningValue(fields.business_name) || 'Unknown'
  const clientUrl =
    profile.website || winningValue(fields.website) || undefined
  const client_node: EntityGraphNode & { url?: string } = {
    id: profile.client_id,
    label: clientName,
    confidence: winningConfidence(fields.business_name),
    source_refs: winningSourceRefs(fields.business_name),
    url: clientUrl,
  }

  // ── service_nodes ──────────────────────────────────────────────────────────
  const services: EntityGraphNode[] = []
  const ps = winningValue(fields.primary_service) || profile.primary_service
  if (ps) {
    services.push({
      id: `svc-${kebab(ps)}`,
      label: ps,
      confidence: winningConfidence(fields.primary_service),
      source_refs: winningSourceRefs(fields.primary_service),
    })
  }
  for (const s of asArray(fields.services)) {
    services.push({
      id: `svc-${kebab(s)}`,
      label: s,
      confidence: 0.7,
      source_refs: [],
    })
  }

  // ── audience_nodes ─────────────────────────────────────────────────────────
  const audience: EntityGraphNode[] = []
  const tc = winningValue(fields.target_customer) || profile.target_customer
  if (tc) {
    audience.push({
      id: `aud-${kebab(tc).slice(0, 40)}`,
      label: tc,
      confidence: winningConfidence(fields.target_customer),
      source_refs: winningSourceRefs(fields.target_customer),
    })
  }

  // ── competitor_nodes ──────────────────────────────────────────────────────
  const compNames = new Set<string>()
  for (const r of fields.competitors || []) {
    const vs = Array.isArray(r.value) ? r.value : [r.value]
    for (const v of vs) if (v) compNames.add(String(v).trim())
  }
  for (const r of fields.competitor_mentions || []) {
    const vs = Array.isArray(r.value) ? r.value : [r.value]
    for (const v of vs) if (v) compNames.add(String(v).trim())
  }
  const competitors: EntityGraphNode[] = Array.from(compNames).map((name) => ({
    id: `cmp-${kebab(name)}`,
    label: name,
    confidence: 0.7,
    source_refs: [],
  }))

  // ── service_area_nodes ─────────────────────────────────────────────────────
  const areas = new Set<string>()
  const sa = winningValue(fields.service_area) || profile.service_area
  if (sa) areas.add(String(sa).trim())
  for (const r of fields.service_areas || []) {
    const vs = Array.isArray(r.value) ? r.value : [r.value]
    for (const v of vs) if (v) areas.add(String(v).trim())
  }
  const serviceAreas: EntityGraphNode[] = Array.from(areas).map((name) => ({
    id: `area-${kebab(name)}`,
    label: name,
    confidence: 0.8,
    source_refs: [],
  }))

  // ── differentiator_edges ───────────────────────────────────────────────────
  const diffs: EntityGraphEdge[] = []
  const usp =
    winningValue(fields.unique_selling_prop) || profile.unique_selling_prop
  if (usp) {
    diffs.push({
      from: client_node.id,
      to: `diff-${kebab(usp).slice(0, 40)}`,
      kind: 'differentiator',
      confidence: winningConfidence(fields.unique_selling_prop),
      source_refs: winningSourceRefs(fields.unique_selling_prop),
    })
  }
  for (const r of fields.differentiators || []) {
    const vs = Array.isArray(r.value) ? r.value : [r.value]
    for (const v of vs) {
      if (!v) continue
      diffs.push({
        from: client_node.id,
        to: `diff-${kebab(String(v)).slice(0, 40)}`,
        kind: 'differentiator',
        confidence: r.confidence || 0.7,
        source_refs: [r.source_ref || r.source_url || ''].filter(Boolean),
      })
    }
  }

  // ── trust_anchor_nodes ────────────────────────────────────────────────────
  const trust: EntityGraphNode[] = []
  const fy = winningValue(fields.founding_year) || profile.founding_year
  if (fy) {
    trust.push({
      id: `trust-founded-${fy}`,
      label: `Founded ${fy}`,
      confidence: winningConfidence(fields.founding_year),
      source_refs: winningSourceRefs(fields.founding_year),
    })
  }
  for (const r of fields.trust_anchors || []) {
    const vs = Array.isArray(r.value) ? r.value : [r.value]
    for (const v of vs) {
      if (!v) continue
      trust.push({
        id: `trust-${kebab(String(v)).slice(0, 40)}`,
        label: String(v),
        confidence: r.confidence || 0.7,
        source_refs: [r.source_ref || r.source_url || ''].filter(Boolean),
      })
    }
  }

  // ── confidence_by_node ────────────────────────────────────────────────────
  const confidence_by_node: Record<string, number> = {
    [client_node.id]: client_node.confidence,
  }
  for (const n of [
    ...services,
    ...audience,
    ...competitors,
    ...serviceAreas,
    ...trust,
  ]) {
    confidence_by_node[n.id] = n.confidence
  }

  return {
    client_node,
    service_nodes: services,
    audience_nodes: audience,
    competitor_nodes: competitors,
    service_area_nodes: serviceAreas,
    differentiator_edges: diffs,
    trust_anchor_nodes: trust,
    confidence_by_node,
  }
}

/**
 * Legacy-reader bridge: returns the exact 8-field shape
 * `hyperlocalContentEngine.ts:147` expects from `clients.select(...)`.
 */
export function profileToLegacyClientShape(profile: ClientProfile): {
  id: string
  name: string | null
  website: string | null
  primary_service: string | null
  industry: string | null
  target_customer: string | null
  city: string | null
  state: string | null
} {
  return {
    id: profile.client_id,
    name: profile.business_name,
    website: profile.website,
    primary_service: profile.primary_service,
    industry: profile.industry,
    target_customer: profile.target_customer,
    city: profile.city,
    state: profile.state,
  }
}
