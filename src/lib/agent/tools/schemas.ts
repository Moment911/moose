import 'server-only'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// KotoIQ Agent Layer — Tool Zod Schemas
//
// Input and output schemas for each of the 22 tool registry entries.
// Derived from actual engine function signatures (not guessed).
//
// Where an engine returns a complex/untyped object, output is z.unknown()
// with a TODO to tighten once we can generate types from the engine output.
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared ──────────────────────────────────────────────────────────────────

// Relaxed from z.string().uuid() — the Momenta Marketing founder agency
// (00000000-0000-0000-0000-000000000099) was assigned a memorable nil-pattern
// UUID at platform genesis.  It is the only non-RFC4122 UUID in the database;
// every row created since uses gen_random_uuid() and is fully compliant.
// Zod 4's .uuid() enforces RFC 4122 variant bits and rejects the founder ID.
// TODO: revert to .uuid() if Momenta is ever migrated to a standard UUID.
const clientId = z.string().min(1)
const agencyId = z.string().optional()

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT CAPTAIN (8 tools)
// ══════════════════════════════════════════════════════════════════════════════

// 1. predict_content_decay
export const PredictContentDecayInput = z.object({
  url: z.string(),
  keyword: z.string().optional(),
  current_position: z.number(),
  position_30d_ago: z.number().nullable().optional(),
  position_90d_ago: z.number().nullable().optional(),
  position_180d_ago: z.number().nullable().optional(),
  last_updated: z.string().nullable().optional(),
  word_count: z.number().nullable().optional(),
  competitor_freshness_days: z.number().nullable().optional(),
  current_clicks_monthly: z.number().nullable().optional(),
  search_volume: z.number().nullable().optional(),
  agencyId: z.string().optional(),
})
export const PredictContentDecayOutput = z.unknown() // TODO: ContentDecayResult

// 2. get_content_inventory
export const GetContentInventoryInput = z.object({
  client_id: clientId,
  freshness_status: z.string().optional(),
  trajectory: z.string().optional(),
  refresh_priority: z.string().optional(),
})
export const GetContentInventoryOutput = z.unknown() // TODO: inventory array

// 3. build_content_inventory
export const BuildContentInventoryInput = z.object({
  client_id: clientId,
  agency_id: agencyId,
  url_limit: z.number().optional(),
})
export const BuildContentInventoryOutput = z.unknown() // TODO: build result

// 4. analyze_on_page
export const AnalyzeOnPageInput = z.object({
  client_id: clientId.nullable().optional(),
  agency_id: agencyId.nullable(),
  url: z.string(),
  target_keyword: z.string(),
})
export const AnalyzeOnPageOutput = z.unknown() // TODO: OnPageResult

// 5. get_refresh_plan
export const GetRefreshPlanInput = z.object({
  client_id: clientId,
  urls: z.array(z.string()).optional(),
  top_n: z.number().optional(),
})
export const GetRefreshPlanOutput = z.unknown() // TODO: refresh plan result

// 6. generate_brief
export const GenerateBriefInput = z.object({
  client_id: clientId,
  agency_id: agencyId.nullable(),
  keyword: z.string(),
  target_url: z.string().nullable().optional(),
  page_type: z.string().nullable().optional(),
})
export const GenerateBriefOutput = z.unknown() // TODO: GenerateBriefOutput

// 7. run_autonomous_pipeline
export const RunAutonomousPipelineInput = z.object({
  client_id: clientId,
  agency_id: agencyId.nullable(),
  keyword: z.string(),
  auto_publish: z.boolean().optional(),
  target_url: z.string().nullable().optional(),
  page_type: z.string().nullable().optional(),
})
export const RunAutonomousPipelineOutput = z.unknown() // TODO: PipelineResult

// 8. get_pipeline_run
export const GetPipelineRunInput = z.object({
  run_id: z.string().min(1),
})
export const GetPipelineRunOutput = z.unknown() // TODO: pipeline run row

// ══════════════════════════════════════════════════════════════════════════════
// SEMANTIC CAPTAIN (7 tools)
// ══════════════════════════════════════════════════════════════════════════════

// 9. generate_topical_map
export const GenerateTopicalMapInput = z.object({
  client_id: clientId,
  agency_id: agencyId,
  url_limit: z.number().optional(),
})
export const GenerateTopicalMapOutput = z.unknown()

// 10. get_topical_map
export const GetTopicalMapInput = z.object({
  client_id: clientId,
})
export const GetTopicalMapOutput = z.unknown()

// 11. analyze_topical_coverage
export const AnalyzeTopicalCoverageInput = z.object({
  client_id: clientId,
})
export const AnalyzeTopicalCoverageOutput = z.unknown()

// 12. audit_topical_authority
export const AuditTopicalAuthorityInput = z.object({
  central_entity: z.string().optional(),
  source_context: z.string().optional(),
  topical_nodes: z.array(z.object({
    entity: z.string(),
    section: z.string(),
    status: z.string(),
    priority: z.number().optional(),
    macro_context: z.string().optional(),
    existing_url: z.string().nullable().optional(),
    search_volume: z.number().nullable().optional(),
  })),
  keywords: z.array(z.object({
    keyword: z.string(),
    current_position: z.number().nullable().optional(),
    position_30d_ago: z.number().nullable().optional(),
  })).optional(),
  agencyId: z.string().optional(),
})
export const AuditTopicalAuthorityOutput = z.unknown() // TODO: TopicalAuthorityResult

// 13. analyze_query_paths
export const AnalyzeQueryPathsInput = z.object({
  client_id: clientId,
  agency_id: agencyId,
})
export const AnalyzeQueryPathsOutput = z.unknown()

// 14. analyze_semantic_network
export const AnalyzeSemanticNetworkInput = z.object({
  client_id: clientId,
  url_limit: z.number().optional(),
})
export const AnalyzeSemanticNetworkOutput = z.unknown()

// 15. update_topical_node
export const UpdateTopicalNodeInput = z.object({
  node_id: z.string().min(1),
  status: z.string().optional(),
  existing_url: z.string().optional(),
  priority: z.string().optional(),
  content_type: z.string().optional(),
  suggested_title: z.string().optional(),
  suggested_url: z.string().optional(),
  search_volume: z.number().optional(),
})
export const UpdateTopicalNodeOutput = z.unknown()

// ══════════════════════════════════════════════════════════════════════════════
// AUTHORITY CAPTAIN (7 tools)
// ══════════════════════════════════════════════════════════════════════════════

// 16. brand_serp_scan
export const BrandSerpScanInput = z.object({
  client_id: clientId,
  agency_id: agencyId,
})
export const BrandSerpScanOutput = z.unknown()

// 17. get_brand_serp
export const GetBrandSerpInput = z.object({
  client_id: clientId,
})
export const GetBrandSerpOutput = z.unknown()

// 18. audit_eeat
export const AuditEeatInput = z.object({
  client_id: clientId,
  url: z.string().nullable().optional(),
  agency_id: agencyId,
})
export const AuditEeatOutput = z.unknown()

// 19. audit_schema
export const AuditSchemaInput = z.object({
  client_id: clientId,
  agency_id: agencyId,
  url_limit: z.number().optional(),
})
export const AuditSchemaOutput = z.unknown()

// 20. generate_schema
export const GenerateSchemaInput = z.object({
  client_id: clientId,
  url: z.string(),
  schema_type: z.string(),
  agency_id: agencyId,
})
export const GenerateSchemaOutput = z.unknown()

// 21. knowledge_graph_export
export const KnowledgeGraphExportInput = z.object({
  client_id: clientId,
  agency_id: agencyId,
  export_format: z.enum(['wikidata', 'json_ld', 'rdf_turtle']).optional(),
})
export const KnowledgeGraphExportOutput = z.unknown()

// 22. analyze_backlinks
export const AnalyzeBacklinksInput = z.object({
  client_id: clientId,
  agency_id: agencyId,
})
export const AnalyzeBacklinksOutput = z.unknown()
