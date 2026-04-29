import 'server-only'
import type { ToolEntry, CaptainName } from '../types'
import * as S from './schemas'

// Engine imports — Content Captain
import { runContentDecayPredictor } from '@/lib/kotoiqAdvancedAgents'
import { getContentInventory, buildContentInventory, getRefreshPlan } from '@/lib/contentRefreshEngine'
import { analyzeOnPage } from '@/lib/onPageEngine'
import { generateBrief } from '@/lib/contentBriefEngine'
import { runAutonomousPipeline, getPipelineRun } from '@/lib/autonomousPipeline'

// Engine imports — Semantic Captain
import { generateTopicalMap, getTopicalMap, updateTopicalNode, analyzeTopicalCoverage } from '@/lib/topicalMapEngine'
import { runTopicalAuthorityAuditor } from '@/lib/kotoiqAdvancedAgents'
import { analyzeQueryPaths } from '@/lib/queryPathEngine'
import { analyzeSemanticNetwork } from '@/lib/semanticAnalyzer'

// Engine imports — Authority Captain
import { scanBrandSERP, getBrandSERP } from '@/lib/brandSerpEngine'
import { auditEEAT } from '@/lib/eeatEngine'
import { auditSchema, generateSchemaForUrl } from '@/lib/schemaEngine'
import { exportKnowledgeGraph } from '@/lib/knowledgeGraphExporter'
import { analyzeBacklinks } from '@/lib/backlinkEngine'

// ─────────────────────────────────────────────────────────────────────────────
// KotoIQ Agent Layer — Tool Registry
//
// 22 entries wrapping existing engine functions via direct import.
// No LLM logic here — pure function dispatch.
//
// Cost estimates are conservative placeholders (marked TODO).
// ─────────────────────────────────────────────────────────────────────────────

// ── Cost estimate helpers ───────────────────────────────────────────────────

const LLM_COST = 0.05   // $0.05 per LLM-using tool (TODO: refine per tool)
const LLM_TOKENS = 5000  // est. tokens per LLM tool call
const HEAVY_COST = 0.15  // pipeline/blender tools
const HEAVY_TOKENS = 15000
const READ_COST = 0.00
const READ_TOKENS = 0

function entry(
  name: string,
  captain: CaptainName,
  description: string,
  inputSchema: any,
  outputSchema: any,
  invoke: ToolEntry['invoke'],
  opts: {
    approvalRequired?: boolean
    externalApis?: string[]
    writesToTables?: string[]
    costTier?: 'read' | 'llm' | 'heavy'
  } = {},
): ToolEntry {
  const tier = opts.costTier ?? 'llm'
  return {
    name,
    captain,
    description,
    inputSchema,
    outputSchema,
    invoke,
    estCostUsd: () => tier === 'read' ? READ_COST : tier === 'heavy' ? HEAVY_COST : LLM_COST,
    estTokens: () => tier === 'read' ? READ_TOKENS : tier === 'heavy' ? HEAVY_TOKENS : LLM_TOKENS,
    approvalRequired: opts.approvalRequired ?? false,
    externalApis: opts.externalApis ?? [],
    writesToTables: opts.writesToTables ?? [],
  }
}

// ── Registry ────────────────────────────────────────────────────────────────

export const TOOL_REGISTRY: Record<string, ToolEntry> = {

  // ═══ Content Captain (8 tools) ═══════════════════════════════════════════

  predict_content_decay: entry(
    'predict_content_decay', 'content',
    'Predict content decay for a URL: 30/60/90 day position forecast based on historical trends',
    S.PredictContentDecayInput, S.PredictContentDecayOutput,
    async ({ ai, input }) => runContentDecayPredictor(ai, input as any),
    { externalApis: ['anthropic'], costTier: 'llm' },
  ),

  get_content_inventory: entry(
    'get_content_inventory', 'content',
    'Read the content inventory for a client — URLs, freshness, trajectory, refresh priority',
    S.GetContentInventoryInput, S.GetContentInventoryOutput,
    async ({ s, input }) => getContentInventory(s, input as any),
    { costTier: 'read' },
  ),

  build_content_inventory: entry(
    'build_content_inventory', 'content',
    'Crawl and build a content inventory for a client site — discovers URLs, measures freshness, flags decay',
    S.BuildContentInventoryInput, S.BuildContentInventoryOutput,
    async ({ s, ai, input }) => buildContentInventory(s, ai, input as any),
    { externalApis: ['anthropic'], writesToTables: ['kotoiq_content_inventory', 'kotoiq_processing_jobs'], costTier: 'heavy' },
  ),

  analyze_on_page: entry(
    'analyze_on_page', 'content',
    'Run an on-page SEO audit on a URL: checks title, meta, headings, content quality, keyword placement',
    S.AnalyzeOnPageInput, S.AnalyzeOnPageOutput,
    async ({ s, ai, input }) => analyzeOnPage(s, ai, input as any),
    { externalApis: ['anthropic'], writesToTables: ['kotoiq_on_page_audits'], costTier: 'llm' },
  ),

  get_refresh_plan: entry(
    'get_refresh_plan', 'content',
    'Generate an AI-powered refresh plan for specific URLs or top-N decaying content',
    S.GetRefreshPlanInput, S.GetRefreshPlanOutput,
    async ({ s, ai, input }) => getRefreshPlan(s, ai, input as any),
    { externalApis: ['anthropic'], costTier: 'llm' },
  ),

  generate_brief: entry(
    'generate_brief', 'content',
    'Generate a comprehensive SEO content brief for a keyword using Multi-AI Blender (Claude + GPT-4o + Gemini)',
    S.GenerateBriefInput, S.GenerateBriefOutput,
    async ({ s, ai, input }) => generateBrief(s, ai, input as any),
    { externalApis: ['anthropic', 'openai', 'gemini'], writesToTables: ['kotoiq_content_briefs'], costTier: 'heavy' },
  ),

  run_autonomous_pipeline: entry(
    'run_autonomous_pipeline', 'content',
    'Run the full autonomous content pipeline: brief → write → plagiarism → watermark → on-page → schema → score → optional publish',
    S.RunAutonomousPipelineInput, S.RunAutonomousPipelineOutput,
    async ({ s, ai, input }) => runAutonomousPipeline(s, ai, input as any),
    { approvalRequired: true, externalApis: ['anthropic'], writesToTables: ['kotoiq_pipeline_runs', 'kotoiq_content_briefs'], costTier: 'heavy' },
  ),

  get_pipeline_run: entry(
    'get_pipeline_run', 'content',
    'Read the status and results of an autonomous pipeline run',
    S.GetPipelineRunInput, S.GetPipelineRunOutput,
    async ({ s, input }) => getPipelineRun(s, input as any),
    { costTier: 'read' },
  ),

  // ═══ Semantic Captain (7 tools) ══════════════════════════════════════════

  generate_topical_map: entry(
    'generate_topical_map', 'semantic',
    'Generate a topical authority map for a client — identifies entities, gaps, and content architecture',
    S.GenerateTopicalMapInput, S.GenerateTopicalMapOutput,
    async ({ s, ai, input }) => generateTopicalMap(s, ai, input as any),
    { externalApis: ['anthropic'], writesToTables: ['kotoiq_topical_maps', 'kotoiq_topical_nodes'], costTier: 'heavy' },
  ),

  get_topical_map: entry(
    'get_topical_map', 'semantic',
    'Read the latest topical map for a client including all nodes and their coverage status',
    S.GetTopicalMapInput, S.GetTopicalMapOutput,
    async ({ s, input }) => getTopicalMap(s, input as any),
    { costTier: 'read' },
  ),

  analyze_topical_coverage: entry(
    'analyze_topical_coverage', 'semantic',
    'Analyze how well a client\'s content covers their topical map — finds gaps, overlaps, and priorities',
    S.AnalyzeTopicalCoverageInput, S.AnalyzeTopicalCoverageOutput,
    async ({ s, ai, input }) => analyzeTopicalCoverage(s, ai, input as any),
    { externalApis: ['anthropic'], costTier: 'llm' },
  ),

  audit_topical_authority: entry(
    'audit_topical_authority', 'semantic',
    'Score cluster-level topical authority: coverage, depth, freshness, competitive position',
    S.AuditTopicalAuthorityInput, S.AuditTopicalAuthorityOutput,
    async ({ ai, input }) => runTopicalAuthorityAuditor(ai, input as any),
    { externalApis: ['anthropic'], costTier: 'llm' },
  ),

  analyze_query_paths: entry(
    'analyze_query_paths', 'semantic',
    'Cluster user queries into journey paths — discovers query sequences and content gaps',
    S.AnalyzeQueryPathsInput, S.AnalyzeQueryPathsOutput,
    async ({ s, ai, input }) => analyzeQueryPaths(s, ai, input as any),
    { externalApis: ['anthropic'], writesToTables: ['kotoiq_query_clusters'], costTier: 'llm' },
  ),

  analyze_semantic_network: entry(
    'analyze_semantic_network', 'semantic',
    'Analyze site-wide semantic structure: N-grams, heading patterns, contextual flow, thin content detection',
    S.AnalyzeSemanticNetworkInput, S.AnalyzeSemanticNetworkOutput,
    async ({ s, ai, input }) => analyzeSemanticNetwork(s, ai, input as any),
    { externalApis: ['anthropic', 'openai', 'gemini'], costTier: 'heavy' },
  ),

  update_topical_node: entry(
    'update_topical_node', 'semantic',
    'Update a topical map node — change status, assign URL, set priority or content type',
    S.UpdateTopicalNodeInput, S.UpdateTopicalNodeOutput,
    async ({ s, input }) => updateTopicalNode(s, input as any),
    { approvalRequired: true, writesToTables: ['kotoiq_topical_nodes'] },
  ),

  // ═══ Authority Captain (7 tools) ═════════════════════════════════════════

  brand_serp_scan: entry(
    'brand_serp_scan', 'authority',
    'Scan the brand SERP: knowledge panel, sitelinks, PAA, negative results, owned properties',
    S.BrandSerpScanInput, S.BrandSerpScanOutput,
    async ({ s, ai, input }) => scanBrandSERP(s, ai, input as any),
    { externalApis: ['anthropic', 'dataforseo'], writesToTables: ['kotoiq_brand_serp'], costTier: 'llm' },
  ),

  get_brand_serp: entry(
    'get_brand_serp', 'authority',
    'Read the latest brand SERP analysis for a client',
    S.GetBrandSerpInput, S.GetBrandSerpOutput,
    async ({ s, input }) => getBrandSERP(s, input as any),
    { costTier: 'read' },
  ),

  audit_eeat: entry(
    'audit_eeat', 'authority',
    'Audit E-E-A-T signals: experience, expertise, authority, trust — per page or site-wide',
    S.AuditEeatInput, S.AuditEeatOutput,
    async ({ s, ai, input }) => auditEEAT(s, ai, input as any),
    { externalApis: ['anthropic'], writesToTables: ['kotoiq_eeat_audit'], costTier: 'llm' },
  ),

  audit_schema: entry(
    'audit_schema', 'authority',
    'Audit schema markup coverage: types present, errors, missing vs competitors, eligible but not implemented',
    S.AuditSchemaInput, S.AuditSchemaOutput,
    async ({ s, ai, input }) => auditSchema(s, ai, input as any),
    { externalApis: ['anthropic'], writesToTables: ['kotoiq_schema_audit'], costTier: 'llm' },
  ),

  generate_schema: entry(
    'generate_schema', 'authority',
    'Generate JSON-LD schema markup for a specific URL and schema type (e.g., LocalBusiness, FAQPage, Service)',
    S.GenerateSchemaInput, S.GenerateSchemaOutput,
    async ({ s, ai, input }) => generateSchemaForUrl(s, ai, input as any),
    { approvalRequired: true, externalApis: ['anthropic'], writesToTables: ['kotoiq_schema_audit'], costTier: 'llm' },
  ),

  knowledge_graph_export: entry(
    'knowledge_graph_export', 'authority',
    'Export entity data as a Wikidata-ready submission package, JSON-LD, or RDF Turtle',
    S.KnowledgeGraphExportInput, S.KnowledgeGraphExportOutput,
    async ({ s, ai, input }) => exportKnowledgeGraph(s, ai, input as any),
    { approvalRequired: true, externalApis: ['anthropic'], writesToTables: ['kotoiq_knowledge_graph_exports'], costTier: 'llm' },
  ),

  analyze_backlinks: entry(
    'analyze_backlinks', 'authority',
    'Analyze the backlink profile: DA, referring domains, toxic links, anchor distribution, competitor comparison',
    S.AnalyzeBacklinksInput, S.AnalyzeBacklinksOutput,
    async ({ s, ai, input }) => analyzeBacklinks(s, ai, input as any),
    { externalApis: ['anthropic', 'moz'], writesToTables: ['kotoiq_backlink_profile'], costTier: 'llm' },
  ),
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getToolsByCaptain(captain: CaptainName): ToolEntry[] {
  return Object.values(TOOL_REGISTRY).filter(t => t.captain === captain)
}

export function getToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY)
}

export function getTool(name: string): ToolEntry | undefined {
  return TOOL_REGISTRY[name]
}
