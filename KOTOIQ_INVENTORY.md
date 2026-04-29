# KotoIQ Codebase Inventory

Generated: 2026-04-29 (read-only reconnaissance pass)

---

## Section 1 — Repo Topology

### Language & Framework

| Dependency | Version |
|---|---|
| Next.js | 16.2.2 |
| React | 19.2.4 |
| TypeScript | ^5 |
| @supabase/supabase-js | ^2.101.1 |
| @anthropic-ai/sdk | ^0.82.0 |
| openai | ^6.33.0 |
| zod | ^4.3.6 |
| tailwindcss | ^4 |
| stripe | ^22.0.0 |
| playwright-core | 1.52.0 |

### Monorepo or Single App

Single app. No workspaces defined in package.json. The repo contains ancillary sub-projects (`chrome-extension/`, `desktop-app/`, `wp-plugin/`) but they are not npm workspaces — they are standalone directories.

### Directory Tree (depth 3, filtered)

```
moose/
├── _knowledge/          # Docs: modules, database, design
│   ├── database/
│   ├── design/
│   └── modules/
├── .planning/           # Phase planning docs
│   ├── codebase/
│   ├── phases/
│   └── research/
├── chrome-extension/    # Chrome extension (standalone)
├── desktop-app/         # Tauri desktop app (standalone)
├── eslint-rules/
├── public/
│   ├── geo/
│   ├── images/
│   └── logos/
├── scripts/
├── src/
│   ├── app/
│   │   ├── [[...slug]]/    # Catch-all SPA route
│   │   ├── api/
│   │   │   ├── kotoiq/     # KotoIQ API routes
│   │   │   ├── cron/       # Vercel cron jobs
│   │   │   ├── seo/        # SEO API routes
│   │   │   └── ...
│   │   ├── portal/
│   │   └── ...
│   ├── components/
│   │   ├── kotoiq/         # 80+ KotoIQ tab components
│   │   │   └── launch/     # Client profile launch page
│   │   ├── scout/
│   │   ├── trainer/
│   │   └── ...
│   ├── context/
│   ├── data/
│   ├── hooks/
│   ├── lib/
│   │   ├── kotoiq/         # Client profile seeder libs
│   │   ├── ads/            # Ads intelligence engine libs
│   │   ├── builder/        # Template builder / pipeline
│   │   └── ...             # 40+ engine files at lib root
│   ├── types/
│   └── views/
│       └── kotoiq/         # KotoIQShellPage, LaunchPage
├── supabase/
│   └── migrations/         # 21 kotoiq_* migration files
├── tests/
│   └── kotoiq/
├── wp-plugin/
├── package.json
├── vercel.json
└── next.config.ts
```

### Deployment Target

**Vercel** — inferred from:
- `vercel.json` (crons, function maxDuration configs)
- `.vercel/` directory with `project.json`
- `next.config.ts` (standard Next.js config)
- `NEXT_PUBLIC_APP_URL = https://hellokoto.com`

---

## Section 2 — Database Schema

### ORM / Query Layer

**Supabase JS client (`@supabase/supabase-js`)** with raw SQL migrations in `supabase/migrations/`. No Prisma, Drizzle, or ORM. Schema lives entirely in the migration SQL files.

An agency-scoped query helper exists at `src/lib/kotoiqDb.ts` (`getKotoIQDb(agencyId)`) that wraps the service-role client and auto-injects `agency_id` filters for tables listed in `DIRECT_AGENCY_TABLES`.

### Tables Starting with `kotoiq_`

Tables are listed by migration file. All columns, types, PKs, and FKs are from the SQL verbatim.

#### 20260607_kotoiq_sync_and_recs.sql — Core Sync & Recommendations

**kotoiq_sync_log** — Tracks data sync runs (GSC, GA4, Ads, enrichment)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | DEFAULT gen_random_uuid() |
| client_id | uuid NOT NULL | FK → clients(id) CASCADE |
| source | text NOT NULL | 'quick_scan', 'full_sync', 'deep_enrich', 'gsc', 'ga4', 'ads' |
| status | text | DEFAULT 'running' |
| records_synced | integer | DEFAULT 0 |
| error_message | text | |
| metadata | jsonb | DEFAULT '{}' |
| started_at | timestamptz | DEFAULT now() |
| completed_at | timestamptz | |

**kotoiq_recommendations** — AI-generated action items per client
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid NOT NULL | FK → clients(id) CASCADE |
| agency_id | uuid | FK → agencies(id) SET NULL |
| type | text | 'new_content', 'link_build', 'quick_win', 'schema_fix', 'gbp_action' |
| priority | text | DEFAULT 'medium' |
| title | text | |
| detail | text | |
| estimated_impact | text | |
| effort | text | |
| status | text | DEFAULT 'pending' |
| created_at | timestamptz | |

**kotoiq_competitors** — Competitor domain tracking per client
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid NOT NULL | FK → clients(id) CASCADE |
| domain | text NOT NULL | |
| overlap_score | numeric(5,2) | |
| common_keywords | integer | |
| competitor_da | numeric(5,2) | |
| created_at | timestamptz | |

**kotoiq_knowledge_graph_exports** — Wikidata-ready entity exports
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid NOT NULL | FK → clients(id) CASCADE |
| format | text | DEFAULT 'wikidata' |
| content | text | |
| entity_properties | jsonb | |
| related_entities | jsonb | |
| kp_likelihood | numeric(5,2) | |
| submitted_to_wikidata | boolean | DEFAULT false |
| wikidata_entry_id | text | |
| created_at | timestamptz | |

#### 20260501_kotoiq_topical_maps.sql — Topical Authority

**kotoiq_topical_maps** — Master topical map per client
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid NOT NULL | FK → clients(id) CASCADE |
| agency_id | uuid | FK → agencies(id) |
| name | text | DEFAULT 'Primary Topical Map' |
| central_entity | text | |
| source_context | text | |
| central_search_intent | text | |
| topical_coverage_score, vastness_score, depth_score, momentum_score, overall_authority_score | numeric(5,2) | |
| total_nodes, covered_nodes | integer | |
| status | text | DEFAULT 'draft' |
| created_at, updated_at, generated_at | timestamptz | |

**kotoiq_topical_nodes** — Individual nodes in topical map
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| map_id | uuid NOT NULL | FK → kotoiq_topical_maps(id) CASCADE |
| client_id | uuid NOT NULL | FK → clients(id) CASCADE |
| entity | text NOT NULL | |
| entity_type | text | service, location, concept, product, attribute |
| section | text | DEFAULT 'core' |
| attributes | jsonb | DEFAULT '[]' |
| parent_node_id | uuid | FK → kotoiq_topical_nodes(id) |
| status | text | DEFAULT 'gap' |
| existing_url, suggested_url, suggested_title | text | |
| priority, content_type, macro_context | text | |
| search_volume | integer | |
| difficulty_score, relevance_to_central | numeric(5,2) | |
| contextual_bridges, micro_contexts | jsonb | |
| created_at, updated_at | timestamptz | |

**kotoiq_topical_edges** — Edges in topical map graph (from migration line 80+)

#### 20260502_kotoiq_reviews_calendar.sql

**kotoiq_review_intelligence** — Aggregated review sentiment per client
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid NOT NULL | FK → clients(id) CASCADE |
| total_reviews | integer | |
| avg_rating | numeric(3,2) | |
| sentiment_by_topic, top_praise_topics, top_complaint_topics, competitor_reviews, unresponded_reviews | jsonb | |
| overall_score | numeric(5,2) | |
| scanned_at | timestamptz | |

**kotoiq_review_campaigns** — Review generation campaign tracking

**kotoiq_content_calendar** — Content planning and scheduling
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid NOT NULL | FK → clients(id) CASCADE |
| title | text NOT NULL | |
| target_keyword, content_type, status | text | |
| planned_date, published_date, refresh_date | date | |
| topical_node_id, brief_id | uuid | |
| published_url | text | |
| created_at, updated_at | timestamptz | |

**kotoiq_publishing_momentum** — VDM (Vastness/Depth/Momentum) scoring

#### 20260417_kotoiq_technical_tools.sql

**kotoiq_gsc_audits** — GSC deep audit results (summary, indexing issues, CTR anomalies, cannibalization)
**kotoiq_bing_audits** — Bing Webmaster audit results
**kotoiq_backlink_opportunities** — Discovered backlink targets with outreach templates

#### 20260418_kotoiq_seo_tools.sql

**kotoiq_plagiarism_checks** — Originality and AI detection scores
**kotoiq_on_page_audits** — On-page SEO audit with checks/grade
**kotoiq_grid_scans_pro** — Local rank grid scan data (lat/lng grid, SOLV%, dead zones)
**kotoiq_watermark_cleans** — AI watermark removal results

#### 20260419_kotoiq_automation.sql

**kotoiq_pipeline_runs** — Autonomous content pipeline run tracking
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid NOT NULL | FK → clients(id) CASCADE |
| agency_id | uuid | FK → agencies(id) |
| keyword | text | |
| status | text | |
| human_score, topicality_score, plagiarism_score, on_page_score | numeric(5,2) | |
| brief_id | uuid | |
| content_html | text | |
| steps | jsonb | DEFAULT '[]' |
| auto_published | boolean | DEFAULT false |
| created_at, completed_at | timestamptz | |

**kotoiq_auto_setup_runs** — Voice onboarding auto-setup tracking

#### 20260420_kotoiq_strategy.sql

**kotoiq_strategic_plans** — Multi-week strategic plans (attack/defend/abandon priorities)
**kotoiq_knowledge_graph_exports** — (duplicate CREATE IF NOT EXISTS with 20260607)

#### 20260421_kotoiq_monitoring.sql

**kotoiq_competitor_watches** — Competitor monitoring configs
**kotoiq_competitor_url_snapshots** — Point-in-time competitor URL/ranking snapshots
**kotoiq_competitor_events** — Detected competitor movements (new content, ranking gains)
**kotoiq_integrations** — Slack/Teams/email notification integrations
**kotoiq_industry_benchmarks** — Per-industry median/avg metrics
**kotoiq_scorecards** — Competitive scorecard exports

#### 20260422_kotoiq_chat.sql

**kotoiq_chat_conversations** — "Ask KotoIQ" persistent conversations
**kotoiq_chat_messages** — Messages within conversations (role, content, data_used, suggested_actions)

#### 20260423_kotoiq_sitemap_scale.sql

**kotoiq_sitemap_crawls** — Sitemap crawl job tracking
**kotoiq_sitemap_urls** — Discovered URLs from sitemaps (with downstream processing status)
**kotoiq_processing_jobs** — Generic engine processing job tracking (engine, status, batch progress)

#### 20260424_kotoiq_unified_kpis.sql

**kotoiq_ai_visibility_snapshots** — AI Visibility Score time series
**kotoiq_quick_win_queue** — Prioritized action items from all tools

#### 20260425_kotoiq_portal_bulk.sql

**kotoiq_bulk_runs** — Agency-wide bulk operations (agency_id scoped)
**kotoiq_bulk_run_clients** — Per-client status within a bulk run
**kotoiq_portal_views** — Public client portal view analytics
- RLS enabled on all three. Policy: permissive `USING (true)`.

#### 20260426_kotoiq_bot.sql

**kotoiq_bot_conversations** — Conversational bot persistent conversations
**kotoiq_bot_messages** — Bot messages with action_intent, action_data, action_executed, action_result

#### 20260427_kotoiq_client_activity.sql

**kotoiq_client_activity** — Per-client audit log of bot-executed actions (revertible)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid | FK → clients(id) CASCADE |
| agency_id | uuid | FK → agencies(id) CASCADE |
| bot_conversation_id | uuid | FK → kotoiq_bot_conversations(id) SET NULL |
| intent | text NOT NULL | |
| action_api | text | |
| inputs | jsonb | |
| result | jsonb | |
| result_ref_table | text | |
| result_ref_id | uuid | |
| status | text | DEFAULT 'success' |
| reverted_at | timestamptz | |
| created_at | timestamptz | |

RLS enabled. Policy: agency can read own activity via JWT claim.

#### 20260428_kotoiq_ads_intelligence.sql — Ads Intelligence (star schema)

**Dimension tables:**
- **kotoiq_ads_campaigns** — platform, external_id, name, status, budget_usd. UNIQUE(client_id, platform, external_id)
- **kotoiq_ads_ad_groups** — campaign_id FK, external_id, name, status
- **kotoiq_ads_keywords** — ad_group_id FK, text, match_type, quality_score
- **kotoiq_ads_ads** — ad_group_id FK, type, payload jsonb

**Fact tables (daily grain):**
- **kotoiq_ads_fact_campaigns** — impressions, clicks, cost_micros, conversions, conversion_value
- **kotoiq_ads_fact_keywords** — same metrics per keyword
- **kotoiq_ads_fact_search_terms** — per search term with match_type_used
- **kotoiq_ads_fact_gsc** — query, page, country, device, impressions, clicks, position
- **kotoiq_ads_fact_ga4** — source, medium, campaign, landing_page, sessions, conversions, revenue

**Recommendation tables:**
- **kotoiq_ads_rec_negatives** — negative keyword recs with approval workflow
- **kotoiq_ads_rec_new_keywords** — new keyword recs with approval workflow
- **kotoiq_ads_rec_ad_copy** — AI-generated ad copy recs

**Operational:**
- **kotoiq_ads_alerts** — anomaly alerts
- **kotoiq_ads_llm_usage** — per-call LLM cost tracking for ads tasks
- **kotoiq_ads_settings** — per-client settings (monthly_llm_budget_usd)
- **kotoiq_ads_raw_uploads** — CSV upload tracking

#### 20260429_kotoiq_budget_forecasts.sql

**kotoiq_budget_forecasts** — Spend projections with pacing status

#### 20260429_kotoiq_behavior_analytics.sql

**kotoiq_behavior_sessions** — Hotjar/Clarity session data (rage clicks, dead clicks, scroll depth)
**kotoiq_behavior_heatmaps** — Heatmap snapshots (click, move, scroll types)

#### 20260505_kotoiq_builder.sql — Template Builder

**kotoiq_elementor_schema_versions** — Elementor version pinning per WP site
**kotoiq_builder_sites** — Builder config per WP site (IndexNow key, CrUX API key)
**kotoiq_templates** — Elementor page templates for cloning
**kotoiq_template_slots** — Fillable slots within templates (json_path, slot_kind, wildcard_key)
**kotoiq_campaigns** — Content campaigns that group variants
**kotoiq_variants** — Generated page variants from templates
**kotoiq_publishes** — Publication records (WP post ID, URL, status)
**kotoiq_cwv_readings** — Core Web Vitals measurements per publish
**kotoiq_indexnow_submissions** — IndexNow ping tracking
**kotoiq_call_attribution** — Phone call attribution to published variants

#### 20260507_kotoiq_client_profile.sql — Client Profile Seeder

**kotoiq_client_profile** — Authoritative client profile (hot columns + fields jsonb with provenance)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| agency_id | uuid NOT NULL | |
| client_id | uuid NOT NULL | FK → clients(id) CASCADE |
| business_name, website, primary_service, target_customer, service_area, phone, industry, city, state | text | Hot columns |
| founding_year | int | |
| fields | jsonb NOT NULL | Provenance-wrapped spillover fields |
| entity_graph_seed | jsonb NOT NULL | D-22 contract for downstream engines |
| completeness_score | numeric(4,3) | |
| margin_notes | jsonb | Claude proactive observations |
| sources | jsonb | Source registry |
| last_seeded_at, launched_at | timestamptz | |

**kotoiq_clarifications** — Gap-finder clarification queue
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| agency_id, client_id, profile_id | uuid | |
| question | text NOT NULL | |
| severity | text | 'low', 'medium', 'high' |
| status | text | 'open', 'asked_client', 'answered', 'skipped' |
| asked_channel | text | 'sms', 'email', 'portal', 'operator' |
| answer_text | text | |
| impact_unlocks | jsonb | |

#### 20260520_kotoiq_agency_integrations.sql

**koto_agency_integrations** — Encrypted API key / OAuth token storage
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| agency_id | uuid NOT NULL | FK → agencies(id) CASCADE |
| integration_kind | text NOT NULL | CHECK IN ('typeform', 'jotform', 'google_forms', 'gbp_agency_oauth', 'gbp_client_oauth', 'gbp_places_api') |
| scope_client_id | uuid | NULL for agency-wide |
| encrypted_payload | jsonb NOT NULL | AES-256-GCM or Vault |
| payload_version | int | DEFAULT 1 |
| label | text | |
| UNIQUE(agency_id, integration_kind, scope_client_id) | | |

#### 20260501_kotoiq_topical_maps.sql (continued) — Additional Tables

This large migration also creates the following tables beyond the topical map tables listed above:

**kotoiq_internal_links** — Internal link graph data (source_url, target_url, anchor_text, contextual_relevance)
**kotoiq_link_audit** — Internal link audit summary (orphan pages, broken links, equity concentration)
**kotoiq_content_inventory** — Crawled page inventory (url, word_count, freshness, position_change, trajectory, refresh_priority)
**kotoiq_brand_serp** — Brand SERP analysis (knowledge panel, PAA, sitelinks, negative results, brand_serp_score)
**kotoiq_backlink_profile** — Domain backlink profile (DA, referring domains, trust rank, toxic links, anchor distribution)
**kotoiq_eeat_audit** — E-E-A-T audit (experience/expertise/authority/trust scores + signals)
**kotoiq_semantic_analysis** — Semantic network analysis (N-grams, heading patterns, contextual flow)
**kotoiq_technical_deep** — Technical SEO audit (CWV, canonical issues, mobile mismatches, indexable URLs)
**kotoiq_schema_audit** — Schema markup audit (coverage, types, errors, generated schemas)
**kotoiq_query_clusters** — Query path clustering (cluster_name, queries, coverage, gap_queries)

#### Additional Tables Referenced in Code (not in kotoiq_* migrations)

These tables are referenced by `from('kotoiq_...')` calls in lib files but their CREATE TABLE was not found in any kotoiq-prefixed migration file:

- **kotoiq_keywords** — Unified keyword fact table (keyword, fingerprint, SC/Ads/KP metrics, category, intent, opportunity_score). Referenced heavily in route.ts and many engines.
- **kotoiq_snapshots** — Daily keyword position snapshots (keyword_fingerprint, sc_position, captured_at). Used for trend analysis.
- **kotoiq_content_briefs** — Generated content briefs (keyword, page_type, brief jsonb, status).
- **kotoiq_domain_enrichment** — Deep enrichment data per client domain.
- **kotoiq_gmb_grid** — GMB grid scan raw data.
- **kotoiq_gmb_images** — GMB image management (geo-tagged, generated).
- **kotoiq_spam_hits** — Spam/quality hit detection results.
- **kotoiq_aeo_audits** — AEO audit scores.
- **kotoiq_aeo_scores** — AEO scoring snapshots.
- **kotoiq_competitor_maps** — Competitor topical map extractions.
- **kotoiq_hyperlocal_content** — Hyperlocal content generation results.

Unknown — needs human confirmation: The exact migration that creates `kotoiq_keywords`, `kotoiq_snapshots`, `kotoiq_content_briefs`, and these other tables was not found. They may be created in an earlier migration not prefixed with kotoiq, or may need to be run manually.

### Tenancy Model

**Agency-based multi-tenancy.** Every table carries `client_id` (FK → clients) and most carry `agency_id` (FK → agencies). Tenancy is enforced at two layers:

1. **Application layer:** `src/lib/kotoiqDb.ts` auto-injects `.eq('agency_id', agencyId)` for tables in `DIRECT_AGENCY_TABLES`: kotoiq_builder_sites, kotoiq_templates, kotoiq_campaigns, kotoiq_client_profile, kotoiq_clarifications, koto_agency_integrations.
2. **RLS (partial):** Some tables have RLS enabled with permissive `USING (true)` policies (service-role bypass). `kotoiq_client_activity` has a real RLS policy checking JWT `agency_id` claim. Most tables rely on app-layer scoping only.
3. **Main route (`/api/kotoiq/route.ts`):** Does NOT use kotoiqDb — it uses a raw Supabase client (`sb()`) and passes `client_id` from the request body. Auth is not enforced on every action in this route (see Section 9).

Tables that do NOT have agency_id: kotoiq_gsc_audits, kotoiq_bing_audits, kotoiq_backlink_opportunities, kotoiq_plagiarism_checks, kotoiq_on_page_audits, kotoiq_grid_scans_pro, kotoiq_watermark_cleans, kotoiq_sitemap_crawls, kotoiq_sitemap_urls, kotoiq_processing_jobs, kotoiq_ai_visibility_snapshots, kotoiq_quick_win_queue, kotoiq_review_intelligence, kotoiq_review_campaigns, kotoiq_content_calendar, kotoiq_industry_benchmarks. These are scoped only by `client_id`.

---

## Section 3 — Feature Implementation Surface

The main KotoIQ API is a single monolithic route handler: **`src/app/api/kotoiq/route.ts`** (~5200 lines). It dispatches on `body.action` to ~130 distinct action handlers. The UI is split across **`src/views/KotoIQPage.jsx`** (Intel tabs) and **`src/views/kotoiq/KotoIQShellPage.jsx`** (Publish/Tune/Pipeline/Settings).

Tab groups in KotoIQPage sidebar (from line 1013):
- **AI**: ask
- **Overview**: dashboard, keywords, ranks, topical_authority
- **Ads Intelligence**: ads_overview, ads_search_terms, ads_wasted_spend, ads_anomalies, ads_intent_gaps, ads_ad_builder, ads_recommendations, ads_reports, budget_forecast
- **Behavior Analytics**: behavior
- **Intelligence**: strategy, scorecard, competitor_watch, competitors, competitor_map, aeo, aeo_multi, brand_serp, backlinks, backlink_opps, eeat, knowledge_graph, query_paths
- **Content**: autopilot, briefs, hyperlocal, topical_map, content_refresh, content_decay, semantic, context_aligner, passage_opt, plagiarism, watermark, calendar
- **Technical**: activity, audit, on_page, technical_deep, gsc_audit, bing_audit, schema, internal_links, sitemap_crawler, jobs
- **Local & Reviews**: gmb, gmb_images, rank_grid, reviews
- **Builder**: builder
- **Reports & Tools**: reports, roi, visitors, utm, upwork, bulk_ops, integrations, connect

### Located Features

Each entry maps to the 62-feature numbering where identifiable. Features are grouped by the engine file that implements them.

#### #1 — AI Command Center / Dashboard
- **Files:** `src/app/api/kotoiq/route.ts` (action: `dashboard`), `src/views/KotoIQPage.jsx` (tab: `dashboard`)
- **Entry:** `POST /api/kotoiq` with `action: 'dashboard'`
- **Tables read:** kotoiq_keywords, kotoiq_recommendations, kotoiq_sync_log, seo_connections
- **External APIs:** None (reads cached data)

#### #2 — AI Visibility Score
- **Files:** `src/lib/aiVisibilityEngine.ts`
- **Exported:** `calculateAIVisibility(...)`, `getAIVisibilityHistory(...)`
- **Actions:** `calculate_ai_visibility`, `get_ai_visibility_history`
- **Tables:** kotoiq_ai_visibility_snapshots (write), kotoiq_topical_maps, kotoiq_eeat_audit, kotoiq_brand_serp, kotoiq_aeo_audits (read)
- **External APIs:** None (aggregates existing scores)

#### #3 — Quick Win Queue
- **Files:** `src/lib/quickWinEngine.ts`
- **Exported:** `generateQuickWinQueue(...)`, `updateQuickWinStatus(...)`
- **Actions:** `generate_quick_win_queue`, `update_quick_win_status`
- **Tables:** kotoiq_quick_win_queue

#### #4 — Conversational Bot
- **Files:** `src/lib/conversationalBotEngine.ts`, `src/components/kotoiq/ConversationalBot.jsx`
- **Exported:** `runConversationalBot(s, ai, body)`, `getBotConversation(...)`, `listBotConversations(...)`
- **Actions:** `run_conversational_bot`, `get_bot_conversation`, `list_bot_conversations`
- **Intent taxonomy (hardcoded in SYSTEM_PROMPT):** generate_brief, run_on_page_audit, score_aeo, aeo_multi_engine, build_topical_map, check_plagiarism, analyze_competitor, geo_tag_image, crawl_sitemap, generate_strategic_plan, audit_eeat, find_backlinks, analyze_reviews, run_pipeline, analyze_backlinks, audit_schema, scan_internal_links, analyze_query_paths, analyze_semantic_network, audit_technical_deep, build_content_calendar, content_refresh_plan, run_rank_grid, gsc_audit, bing_audit, brand_serp_scan, generate_schema, knowledge_graph_export, hyperlocal_content, watermark_remove, upwork_checklist, passage_optimize, context_align, topical_authority, content_decay, ask_kotoiq, competitor_watch, bulk_operation, pick_client
- **Tables:** kotoiq_bot_conversations, kotoiq_bot_messages, kotoiq_client_activity
- **External APIs:** Anthropic (Claude Sonnet)

#### #5 — Ask KotoIQ (Chat)
- **Files:** `src/lib/askKotoIQEngine.ts`, `src/components/kotoiq/AskKotoIQTab.jsx`
- **Exported:** `askKotoIQ(s, ai, body)`, `listConversations(...)`, `getConversation(...)`, `deleteConversation(...)`
- **Actions:** `ask_kotoiq`, `list_chat_conversations`, `get_chat_conversation`, `delete_chat_conversation`
- **Tables:** kotoiq_chat_conversations, kotoiq_chat_messages, kotoiq_keywords, kotoiq_recommendations, kotoiq_topical_maps, kotoiq_strategic_plans, kotoiq_scorecards, kotoiq_snapshots, kotoiq_content_inventory, kotoiq_technical_deep, kotoiq_spam_hits, kotoiq_backlink_profile, kotoiq_content_calendar
- **External APIs:** Anthropic (Claude)

#### #6 — Topical Map Builder
- **Files:** `src/lib/topicalMapEngine.ts`, `src/components/kotoiq/TopicalMapTab.jsx`
- **Exported:** `generateTopicalMap(...)`, `getTopicalMap(...)`, `updateTopicalNode(...)`, `analyzeTopicalCoverage(...)`
- **Actions:** `generate_topical_map`, `get_topical_map`, `update_topical_node`, `analyze_topical_coverage`
- **Tables:** kotoiq_topical_maps, kotoiq_topical_nodes, kotoiq_keywords, kotoiq_snapshots

#### #7 — Semantic Network Analyzer
- **Files:** `src/lib/semanticAnalyzer.ts`, `src/components/kotoiq/SemanticTab.jsx`
- **Exported:** `analyzeSemanticNetwork(...)`, `getSemanticAnalysis(...)`
- **External APIs:** Anthropic, plus Multi-AI Blender (Claude + GPT-4o + Gemini)

#### #8 — Content Refresh Engine
- **Files:** `src/lib/contentRefreshEngine.ts`, `src/components/kotoiq/ContentRefreshTab.jsx`
- **Exported:** `buildContentInventory(s, ai, body)`, `getContentInventory(s, body)`, `getRefreshPlan(s, ai, body)`
- **Tables:** kotoiq_content_inventory, kotoiq_keywords, kotoiq_snapshots, kotoiq_processing_jobs

#### #9 — Content Calendar
- **Files:** `src/lib/contentCalendarEngine.ts`, `src/components/kotoiq/ContentCalendarTab.jsx`
- **Exported:** `buildContentCalendar(...)`, `getContentCalendar(...)`, `updateCalendarItem(...)`, `calculateMomentum(...)`, `getMomentum(...)`
- **Tables:** kotoiq_content_calendar, kotoiq_publishing_momentum, kotoiq_topical_nodes, kotoiq_content_inventory

#### #10 — Content Brief / PageIQ Writer
- **Files:** `src/app/api/kotoiq/route.ts` (actions: `generate_brief`, `write_full_page`, `list_briefs`, `get_brief`, `update_brief`)
- **Tables:** kotoiq_content_briefs, kotoiq_keywords
- **External APIs:** Multi-AI Blender (Claude + GPT-4o + Gemini) for brief generation

#### #11 — On-Page SEO Analyzer
- **Files:** `src/lib/onPageEngine.ts`, `src/components/kotoiq/OnPageTab.jsx`
- **Exported:** `analyzeOnPage(...)`, `getOnPageHistory(...)`
- **Actions:** `analyze_on_page`, `get_on_page_history`
- **Tables:** kotoiq_on_page_audits
- **External APIs:** Anthropic (Claude), Playwright for page rendering

#### #12 — E-E-A-T Auditor
- **Files:** `src/lib/eeatEngine.ts`, `src/components/kotoiq/EEATTab.jsx`
- **Exported:** `auditEEAT(...)`, `getEEATAudit(...)`
- **Tables:** kotoiq_eeat_audit

#### #13 — Schema Markup Engine
- **Files:** `src/lib/schemaEngine.ts`, `src/components/kotoiq/SchemaTab.jsx`
- **Exported:** `auditSchema(...)`, `getSchemaAudit(...)`, `generateSchemaForUrl(...)`
- **Tables:** kotoiq_schema_audit, kotoiq_processing_jobs

#### #14 — Internal Link Engine
- **Files:** `src/lib/internalLinkEngine.ts`, `src/components/kotoiq/InternalLinksTab.jsx`
- **Exported:** `scanInternalLinks(...)`, `getInternalLinkAudit(...)`, `getLinkSuggestions(...)`
- **Tables:** kotoiq_internal_links, kotoiq_link_audit, kotoiq_processing_jobs, kotoiq_keywords

#### #15 — Brand SERP Engine
- **Files:** `src/lib/brandSerpEngine.ts`, `src/components/kotoiq/BrandSerpTab.jsx`
- **Exported:** `scanBrandSERP(...)`, `getBrandSERP(...)`, `getBrandDefenseStrategy(...)`
- **Tables:** kotoiq_brand_serp

#### #16 — Backlink Engine
- **Files:** `src/lib/backlinkEngine.ts`, `src/components/kotoiq/BacklinksTab.jsx`
- **Exported:** `analyzeBacklinks(...)`, `getBacklinkProfile(...)`
- **Tables:** kotoiq_backlink_profile

#### #17 — Backlink Opportunity Engine
- **Files:** `src/lib/backlinkOpportunityEngine.ts`, `src/components/kotoiq/BacklinkOpportunitiesTab.jsx`
- **Exported:** `scanAndGenerateBacklinks(...)`, `getBacklinkOpportunities(...)`
- **Tables:** kotoiq_backlink_opportunities

#### #18 — Technical Deep Audit
- **Files:** `src/lib/technicalSeoEngine.ts`, `src/components/kotoiq/TechnicalDeepTab.jsx`
- **Exported:** `auditTechnicalDeep(...)`, `getTechnicalDeep(...)`
- **Tables:** kotoiq_technical_deep

#### #19 — Query Path Engine
- **Files:** `src/lib/queryPathEngine.ts`, `src/components/kotoiq/QueryPathTab.jsx`
- **Exported:** `analyzeQueryPaths(...)`, `getQueryClusters(...)`
- **Tables:** kotoiq_query_clusters, kotoiq_keywords, kotoiq_snapshots

#### #20 — Review Intelligence
- **Files:** `src/lib/reviewIntelEngine.ts`, `src/components/kotoiq/ReviewsTab.jsx`
- **Exported:** `analyzeReviews(...)`, `getReviewIntelligence(...)`, `createReviewCampaign(...)`, `getReviewCampaigns(...)`
- **Tables:** kotoiq_review_intelligence, kotoiq_review_campaigns

#### #21 — GSC Deep Audit
- **Files:** `src/lib/gscAuditEngine.ts`, `src/components/kotoiq/GSCAuditTab.jsx`
- **Exported:** `runGSCAudit(...)`, `getGSCAudit(...)`
- **Tables:** kotoiq_gsc_audits

#### #22 — Bing Audit
- **Files:** `src/lib/bingAuditEngine.ts`, `src/components/kotoiq/BingAuditTab.jsx`
- **Exported:** `runBingAudit(...)`, `getBingAudit(...)`
- **Tables:** kotoiq_bing_audits

#### #23 — Plagiarism Checker
- **Files:** `src/lib/plagiarismEngine.ts`, `src/components/kotoiq/PlagiarismTab.jsx`
- **Exported:** `checkPlagiarism(...)`, `getPlagiarismHistory(...)`
- **Tables:** kotoiq_plagiarism_checks

#### #24 — AI Watermark Remover
- **Files:** `src/lib/watermarkRemover.ts`, `src/components/kotoiq/WatermarkRemoverTab.jsx`
- **Exported:** `removeAIWatermarks(...)`
- **Tables:** kotoiq_watermark_cleans

#### #25 — Rank Grid Pro
- **Files:** `src/lib/rankGridProEngine.ts`, `src/components/kotoiq/RankGridProTab.jsx`
- **Exported:** `runRankGridPro(...)`, `getGridScanHistory(...)`, `compareGridScans(...)`
- **Tables:** kotoiq_grid_scans_pro
- **External APIs:** DataForSEO (grid scan)

#### #26 — GMB Image Engine
- **Files:** `src/lib/gmbImageEngine.ts`, `src/components/kotoiq/GMBImagesTab.jsx`
- **Exported:** `generateGMBImage(...)`, `generateImageCaption(...)`, `uploadImageToStorage(...)`, `uploadImageToGBP(...)`
- **Tables:** kotoiq_gmb_images
- **External APIs:** Anthropic (Claude), Google Business Profile API

#### #27 — Image Geo Tagger
- **Files:** `src/lib/imageGeoTagger.ts`
- **Exported:** `geoTagImage(...)`
- **Action:** `geo_tag_image`

#### #28 — Competitor Watch
- **Files:** `src/lib/competitorWatchEngine.ts`, `src/components/kotoiq/CompetitorWatchTab.jsx`
- **Exported:** `setupCompetitorWatch(...)`, `runCompetitorWatchCheck(...)`, `getCompetitorEvents(...)`
- **Tables:** kotoiq_competitor_watches, kotoiq_competitor_url_snapshots, kotoiq_competitor_events, kotoiq_keywords
- **Cron:** `/api/cron/competitor-watch` (daily at 06:00)

#### #29 — Competitor Topical Map Extractor
- **Files:** `src/lib/kotoiqAdvancedAgents.ts` (runCompetitorTopicalMapExtractor)
- **Action:** `extract_competitor_topical_map`

#### #30 — Scorecard
- **Files:** `src/lib/scorecardEngine.ts`, `src/components/kotoiq/ScorecardTab.jsx`
- **Exported:** `generateScorecard(...)`
- **Tables:** kotoiq_scorecards, kotoiq_competitors, kotoiq_topical_maps, kotoiq_eeat_audit, kotoiq_schema_audit, kotoiq_backlink_profile, kotoiq_brand_serp, kotoiq_content_inventory, kotoiq_grid_scans_pro, kotoiq_technical_deep, kotoiq_aeo_audits

#### #31 — Strategic Plan Engine
- **Files:** `src/lib/strategyEngine.ts`, `src/components/kotoiq/StrategyTab.jsx`
- **Exported:** `generateStrategicPlan(...)`, `getLatestStrategicPlan(...)`
- **Tables:** kotoiq_strategic_plans

#### #32 — Industry Benchmarks
- **Files:** `src/lib/industryBenchmarkEngine.ts`
- **Exported:** `calculateIndustryBenchmarks(...)`, `getBenchmarkForClient(...)`
- **Tables:** kotoiq_industry_benchmarks
- **Cron:** `/api/cron/industry-benchmarks` (weekly, Sunday 02:00)

#### #33 — Slack/Teams Integration
- **Files:** `src/lib/slackTeamsIntegration.ts`
- **Exported:** `setupSlackIntegration(...)`, `setupTeamsIntegration(...)`, `sendDailyDigest(...)`
- **Tables:** kotoiq_integrations
- **Cron:** `/api/cron/daily-digest` (daily at 09:00)

#### #34 — Knowledge Graph Exporter
- **Files:** `src/lib/knowledgeGraphExporter.ts`, `src/components/kotoiq/KnowledgeGraphTab.jsx`
- **Exported:** `exportKnowledgeGraph(...)`
- **Tables:** kotoiq_knowledge_graph_exports, kotoiq_review_intelligence, kotoiq_schema_audit, kotoiq_backlink_profile, kotoiq_topical_maps, kotoiq_brand_serp

#### #35 — Triple-to-Schema Integration
- **Files:** `src/lib/tripleSchemaIntegration.ts`
- **Exported:** `convertTriplesToSchema(...)`, `autoInjectSchemaFromPage(...)`
- **Tables:** kotoiq_schema_audit

#### #36 — Hyperlocal Content Engine
- **Files:** `src/lib/hyperlocalContentEngine.ts`, `src/components/kotoiq/HyperlocalTab.jsx`
- **Exported:** `generateHyperlocalFromGrid(...)`
- **Tables:** kotoiq_grid_scans_pro, kotoiq_content_briefs, kotoiq_content_calendar

#### #37 — Sitemap Crawler
- **Files:** `src/lib/sitemapCrawler.ts`, `src/components/kotoiq/SitemapCrawlerTab.jsx`
- **Exported:** `crawlSitemaps(...)`, `getSitemapUrls(...)`, `getLatestCrawl(...)`
- **Tables:** kotoiq_sitemap_crawls, kotoiq_sitemap_urls

#### #38 — Upwork Checklist Tool
- **Files:** `src/lib/upworkChecklistEngine.ts`, `src/components/kotoiq/UpworkChecklistTab.jsx`
- **Exported:** `analyzeUpworkJob(...)`, `generateProposalPackage(...)`

#### #39 — Client Portal
- **Files:** `src/lib/portalEngine.ts`, `src/app/portal/`
- **Exported:** `getPortalData(...)`, `checkPortalRateLimit(...)`, `logPortalView(...)`
- **Tables:** kotoiq_portal_views, kotoiq_ai_visibility_snapshots, kotoiq_keywords, kotoiq_topical_maps, kotoiq_eeat_audit, kotoiq_content_calendar, kotoiq_scorecards, kotoiq_quick_win_queue

#### #40 — Bulk Operations
- **Files:** `src/lib/bulkOperationsEngine.ts`, `src/components/kotoiq/BulkOperationsTab.jsx`
- **Exported:** `runBulkOperation(...)`, `getBulkOperationStatus(...)`
- **Tables:** kotoiq_bulk_runs, kotoiq_bulk_run_clients

#### #41 — Topical Authority Auditor
- **Files:** `src/lib/kotoiqAdvancedAgents.ts`
- **Exported:** `runTopicalAuthorityAuditor(ai, params)` (line 151)
- **Action:** `audit_topical_authority`, `get_topical_authority`

#### #42 — Context Vector Aligner
- **Files:** `src/lib/kotoiqAdvancedAgents.ts`
- **Exported:** `runContextVectorAligner(ai, params)` (line 254)
- **Action:** `align_context_vectors`

#### #43 — Multi-Engine AEO Scorer
- **Files:** `src/lib/kotoiqAdvancedAgents.ts`, `src/components/kotoiq/AEOMultiEngineTab.jsx`
- **Exported:** `runMultiEngineAEO(ai, params)` (line 331)
- **Action:** `score_multi_engine_aeo`

#### #44 — Content Decay Predictor
- **Files:** `src/lib/kotoiqAdvancedAgents.ts`, `src/components/kotoiq/ContentDecayTab.jsx`
- **Exported:** `runContentDecayPredictor(ai, params)` (line 411)
- **Action:** `predict_content_decay`

#### #45 — Passage Ranking Optimizer
- **Files:** `src/lib/kotoiqAdvancedAgents.ts`, `src/components/kotoiq/PassageOptimizerTab.jsx`
- **Exported:** `runPassageRankingOptimizer(ai, params)` (line 568)
- **Action:** `optimize_passages`

#### #46–#50 — Autonomous Pipeline
- **Files:** `src/lib/autonomousPipeline.ts` (#50), `src/lib/builder/pipelineOrchestrator.ts` (#46 7-stage), `src/app/api/kotoiq/pipeline/route.ts`
- **Exported:**
  - `runAutonomousPipeline(s, ai, body: PipelineInput): Promise<PipelineResult>` (autonomousPipeline.ts:82)
  - `runFullPipeline(config: PipelineConfig): Promise<string>` (pipelineOrchestrator.ts)
- **Actions:** `run_autonomous_pipeline`, `get_pipeline_runs`, `get_pipeline_run` (main route); `start`, `status`, `stop`, `list` (pipeline route)
- **Tables:** kotoiq_pipeline_runs, kotoiq_content_briefs
- **External APIs:** Anthropic (Claude)
- **How invoked:** HTTP POST to `/api/kotoiq` or `/api/kotoiq/pipeline`

#### #51 — Processing Jobs
- **Files:** `src/components/kotoiq/ProcessingJobsTab.jsx`
- **Actions:** `create_processing_job`, `get_processing_jobs`
- **Tables:** kotoiq_processing_jobs

#### #52 — Multi-AI Blender
- **Files:** `src/lib/multiAiBlender.ts`
- **Exported:** `blendThreeAIs(input: BlendInput): Promise<BlendResult>`
- **See Section 4 for details.**

#### #53 — Semantic Agents (originally "12 Semantic Agents" — actual count: 32)
- See Section 4 for full list.

#### Ads Intelligence Features (#54–#62 approximate)

**#54 — Ads Overview / Sync**
- **Files:** `src/lib/ads/ingestGoogleAds.ts`, `src/lib/ads/ingestGSC.ts`, `src/lib/ads/ingestGA4.ts`, `src/lib/ads/ingestCSV.ts`, `src/lib/ads/ingestMetaAds.ts`, `src/lib/ads/ingestLinkedInAds.ts`
- **Actions:** `ads_sync_google`, `ads_sync_gsc`, `ads_sync_ga4`, `ads_sync_all`, `ads_upload_csv`, `ads_sync_meta`, `ads_sync_linkedin`
- **Tables:** kotoiq_ads_campaigns, kotoiq_ads_ad_groups, kotoiq_ads_keywords, kotoiq_ads_fact_*, kotoiq_ads_raw_uploads
- **External APIs:** Google Ads API, Google Search Console API, GA4 API, Meta Marketing API, LinkedIn Ads API

**#55 — Wasted Spend Analyzer**
- **Files:** `src/lib/ads/wastedSpend.ts`
- **Exported:** `analyzeWastedSpend(...)`, `getWastedSpendResults(...)`
- **External APIs:** LLM via `adsLLM.run()` (see Section 4)

**#56 — Anomaly Detector**
- **Files:** `src/lib/ads/anomalyDetector.ts`
- **Exported:** `analyzeAnomalies(...)`, `getAnomalies(...)`
- **Tables:** kotoiq_ads_alerts, kotoiq_ads_fact_campaigns, kotoiq_ads_campaigns

**#57 — Intent Gaps**
- **Files:** `src/lib/ads/intentGaps.ts`
- **Exported:** `analyzeIntentGaps(...)`, `getIntentGapResults(...)`

**#58 — Ad Copy Generator**
- **Files:** `src/lib/ads/adCopyEngine.ts`
- **Exported:** `generateAdCopy(...)`, `getAdCopy(...)`, `approveRecommendation(...)`, `bulkApproveRecommendations(...)`
- **Tables:** kotoiq_ads_rec_ad_copy, kotoiq_ads_settings

**#59 — Ads Recommendations**
- **Actions:** `ads_get_recommendations`, `ads_approve_rec`, `ads_bulk_approve`
- **Tables:** kotoiq_ads_rec_negatives, kotoiq_ads_rec_new_keywords, kotoiq_ads_rec_ad_copy

**#60 — Budget Forecasting**
- **Files:** `src/lib/ads/budgetForecasting.ts`
- **Exported:** `generateForecast(...)`, `getForecast(...)`, `getDailySpendTrend(...)`
- **Tables:** kotoiq_budget_forecasts

**#61 — Behavior Analytics**
- **Files:** `src/lib/ads/ingestHotjar.ts`, `src/lib/ads/ingestClarity.ts`
- **Exported:** `ingestHotjar(...)`, `ingestClarity(...)`
- **Tables:** kotoiq_behavior_sessions, kotoiq_behavior_heatmaps
- **External APIs:** Hotjar API, Microsoft Clarity API

**Additional located features:**
- **Content Variant Generator** — action `generate_content_variant` in main route
- **Client Activity Log** — actions `log_client_activity`, `list_client_activity`, `revert_client_activity`
- **Voice Onboarding Auto-Setup** — `src/lib/voiceOnboardingAutoSetup.ts`, action `trigger_auto_setup`
- **Integrations** — `src/components/kotoiq/IntegrationsTab.jsx`, `src/app/api/kotoiq/integrations/route.ts`
- **Client Profile Seeder** — `src/app/api/kotoiq/profile/route.ts` + all files in `src/lib/kotoiq/`
- **MissionControl** — `src/components/kotoiq/MissionControl.jsx`
- **MasterReport** — `src/components/kotoiq/MasterReport.jsx`
- **HowItWorks** — `src/components/kotoiq/HowItWorks.jsx`
- **Attribution Linker** — `src/lib/builder/attributionLinker.ts`
- **Cadence Scheduler** — `src/lib/builder/cadenceScheduler.ts`
- **Publish Orchestrator** — `src/lib/builder/publishOrchestrator.ts`
- **Refresh Pipeline** — `src/lib/builder/refreshPipeline.ts`
- **Variant Generator** — `src/lib/builder/variantGenerator.ts`
- **Slot Filler** — `src/lib/builder/slotFiller.ts`
- **Preflight Gate** — `src/lib/builder/preflightGate.ts`
- **CrUX Client** — `src/lib/builder/cruxClient.ts`
- **IndexNow** — `src/lib/builder/indexnow.ts`
- **KPI Rollup** — `src/lib/builder/kpiRollup.ts`
- **Rescan Engine** — `src/lib/builder/rescanEngine.ts`
- **Elementor Adapter** — `src/lib/builder/elementorAdapter.ts`
- **Auto-Detect Relevant Connections** — `src/lib/ads/autoDetectRelevantConnections.ts`
- **Auto-Trigger Sync** — `src/lib/ads/autoTriggerSync.ts`

### Features Not Located in Code

The 62-feature map was not provided in the codebase. Based on common SEO platform features, the following could not be specifically mapped to code — needs human confirmation of the feature numbering:

- Exact feature numbering is unknown — the codebase does not contain a canonical 62-feature list. The mapping above is best-effort from tab names, engine files, and action handlers.
- "AEO Research" (single-engine) exists as action `aeo_deep_analysis` / `aeo_research` in the main route but no dedicated engine file was found — it's inline in route.ts.
- Domain enrichment (`deep_enrich` action) — large inline handler (~300 lines) in route.ts using DataForSEO, Playwright, Anthropic.

---

## Section 4 — LLM and AI Plumbing

### Central LLM Clients

There is **no single central LLM router** for the whole platform. Instead there are two patterns:

1. **Direct Anthropic SDK usage** — The main route (`/api/kotoiq/route.ts` line 74) creates a single `new Anthropic()` instance used by ~30 inline action handlers. Model is typically hardcoded as `claude-sonnet-4-20250514` per action.

2. **Ads LLM Router** (`src/lib/ads/llmRouter.ts`) — Task-specific multi-provider router for Ads Intelligence only. Supports:
   - **Anthropic** (Claude Sonnet 4.6)
   - **OpenAI** (GPT-4o, GPT-4o-mini)
   - **Google Gemini** (Gemini 2.5 Flash)

   Routing table maps each `AdsTask` to a primary + fallback provider. Zod validation on input/output. Budget enforcement. Per-call cost logging to `kotoiq_ads_llm_usage`.

### Model Selection

**Hardcoded per feature.** Most features use `claude-sonnet-4-20250514`. The Ads router uses task-specific routing (Gemini Flash for bulk classification, Claude for reasoning, GPT-4o for TikTok copy). There is no config-driven or runtime-routable model selection outside the Ads domain.

### #52 — Multi-AI Blender

**File:** `src/lib/multiAiBlender.ts`

```typescript
export async function blendThreeAIs(input: BlendInput): Promise<BlendResult>
```

**Flow (5-line summary):**
1. Fan out identical prompt to Claude Sonnet, GPT-4o, and Gemini Flash in parallel via `Promise.allSettled`.
2. Tolerate per-provider failures — continue if 2+ succeed.
3. If only 1 survives, return it verbatim (no synthesis).
4. If 2+ survive, ask Claude Sonnet to synthesize a unified best-of answer.
5. Log token usage for each arm + synthesis to `koto_token_usage`.

Kill-switch: `BLENDED_AI_ENABLED=false` env var → Claude-only fallback.

Models: `claude-sonnet-4-6-20250627` (arm + synthesis), `gpt-4o`, `gemini-2.0-flash`.

Used by: `generate_brief`, `aeo_deep_analysis`, `analyzeSemanticNetwork` (and potentially others that import `blendThreeAIs`).

### #53 — Semantic Agents

There are **32 agents** across 5 files (not 12 as the feature name suggests):

**Tier 1** — `src/lib/semanticAgents.ts` (4 agents):
1. `runQueryGapAnalyzer(ai, params)` — Query network mapping + competitor gaps
2. `runFrameAnalyzer(ai, params)` — Conceptual frame coverage
3. `runSemanticRoleLabeler(ai, params)` — Sentence-level optimization
4. `runNamedEntitySuggester(ai, params)` — Topical authority signals

**Tier 2** — `src/lib/semanticAgentsTier2.ts` (5 agents):
5. `runLexicalRelationAnalyzer(ai, params)` — Hyponym/hypernym/meronym mapping
6. `runTopicClusterer(ai, params)` — Pillar/cluster/support page architecture
7. `runTitleQueryAuditor(ai, params)` — Title tag optimization
8. `runKeyFactSummarizer(ai, params)` — Extract & score semantic facts
9. `runBridgeTopicSuggester(ai, params)` — Contextual bridges between topics

**Tier 3** — `src/lib/semanticAgentsTier3.ts` (8 agents):
10. `runCommentGenerator(ai, params)` — Aspect-based review analysis
11. `runSentimentOptimizer(ai, params)` — Authentic sentiment flow
12. `runEntityInserter(ai, params)` — Entity insertion into drafts
13. `runMetadiscourseAuditor(ai, params)` — Filler detection
14. `runNgramExtractor(ai, params)` — Phrase pattern analysis
15. `runTripleGenerator(ai, params)` — Knowledge graph triples
16. `runSpamHitDetector(ai, params)` — Google update impact analysis
17. `runQualityUpdateAuditor(ai, params)` — HCU compliance audit

**Advanced Wave 1** — `src/lib/kotoiqAdvancedAgents.ts` (6 agents):
18. `runTopicalAuthorityAuditor(ai, params)` — Cluster-level authority score
19. `runContextVectorAligner(ai, params)` — Intent-to-outline alignment
20. `runMultiEngineAEO(ai, params)` — 5-engine citation eligibility
21. `runContentDecayPredictor(ai, params)` — 30/60/90 day position forecast
22. `runCompetitorTopicalMapExtractor(ai, params)` — Infer rival site maps
23. `runPassageRankingOptimizer(ai, params)` — Per-paragraph snippet scoring

**Advanced Wave 2** — `src/lib/kotoiqAdvancedAgents2.ts` (5 agents):
24. `runSerpIntentClassifier(ai, params)` — SERP composition intent classification
25. `runQueryDocumentAlignmentScorer(ai, params)` — Query-network alignment
26. `runTopicalBordersDetector(ai, params)` — Topic drift detection
27. `runCornerstoneContentIdentifier(ai, params)` — Pillar/cornerstone identification
28. `runLinkPropositionValueScorer(ai, params)` — Internal link topical scoring

**Post-Processors** — `src/lib/semanticPostProcessors.ts` (4 agents):
29. `runContextlessWordRemover`
30. `runTopicalityScorer`
31. `runSentenceFilterer`
32. `runSafeAnswerGenerator`

All agents use Claude Sonnet (`claude-sonnet-4-20250514`) via direct Anthropic SDK. They are invoked via the main route actions: `run_semantic_agents`, `run_content_polish`, `run_semantic_role_optimization`, `generate_safe_answer`, plus individual actions for the advanced agents.

### #4 — Conversational Bot Intent Classification

**File:** `src/lib/conversationalBotEngine.ts`

Intent classification is done **entirely via LLM system prompt** — there is no separate classifier model or intent taxonomy in a config/enum. The `SYSTEM_PROMPT` constant (line 48, ~120 lines) contains the full intent list (39 intents) and decision logic. Claude Sonnet parses the user message and emits a structured `<ACTION>` block with the matched intent.

---

## Section 5 — Job and Run Tracking

### Job Queue

**No external job queue** (no BullMQ, Celery, Temporal, Inngest, Trigger.dev). All "jobs" are:

1. **In-memory Maps** — `pipelineOrchestrator.ts` uses `const activeRuns = new Map<string, PipelineRun>()` (line 74). Runs are lost on cold start.
2. **Database-backed status rows** — `kotoiq_pipeline_runs`, `kotoiq_processing_jobs`, `kotoiq_auto_setup_runs` persist progress. The orchestrator writes to DB in try/catch (tolerates table not existing).
3. **Vercel Crons** — 8 cron jobs defined in `vercel.json`:
   - `/api/cron/competitor-watch` — daily 06:00
   - `/api/cron/daily-digest` — daily 09:00
   - `/api/cron/industry-benchmarks` — weekly Sunday 02:00
   - `/api/cron/answering-digest` — weekly Monday 14:00
   - `/api/cron/scout-persona` — daily 03:00
   - `/api/perf/cron` — daily 04:00
   - `/api/agent/cron` — daily 11:00
   - `/api/digest` — weekly Monday 09:00

### #55 — Processing Jobs

**Table:** `kotoiq_processing_jobs` (from `20260423_kotoiq_sitemap_scale.sql`)

```sql
CREATE TABLE kotoiq_processing_jobs (
  id uuid PK,
  client_id uuid NOT NULL FK → clients(id),
  engine text NOT NULL,  -- content_refresh | internal_links | on_page | schema | ...
  status text DEFAULT 'queued',  -- queued | running | paused | complete | failed
  total_urls integer DEFAULT 0,
  processed_urls integer DEFAULT 0,
  failed_urls integer DEFAULT 0,
  batch_size integer DEFAULT 50,
  concurrency integer DEFAULT 10,
  current_offset integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  errors jsonb DEFAULT '[]',
  started_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz
);
```

Data comes from engines that process sitemap URLs in batches. Created by `contentRefreshEngine`, `schemaEngine`, `internalLinkEngine`.

### #50 — Autonomous Pipeline

**File:** `src/lib/autonomousPipeline.ts`

```typescript
export async function runAutonomousPipeline(
  s: SupabaseClient,
  ai: Anthropic,
  body: PipelineInput
): Promise<PipelineResult>
```

```typescript
// Lines 82-120 (first 38 lines of function):
export async function runAutonomousPipeline(
  s: SupabaseClient,
  ai: Anthropic,
  body: PipelineInput
): Promise<PipelineResult> {
  const { client_id, agency_id, keyword, auto_publish, target_url, page_type } = body

  if (!client_id || !keyword) {
    throw new Error('client_id and keyword are required')
  }

  let run_id: string | null = null
  try {
    const { data: runRow } = await s.from('kotoiq_pipeline_runs').insert({
      client_id,
      agency_id: agency_id || null,
      keyword,
      status: 'running',
      steps: [],
    }).select('id').single()
    run_id = runRow?.id || null
  } catch { /* table may not exist yet */ }

  const steps: PipelineStep[] = []

  const persistStep = async (step: PipelineStep) => {
    steps.push(step)
    if (!run_id) return
    try {
      await s.from('kotoiq_pipeline_runs').update({ steps }).eq('id', run_id)
    } catch { /* non-blocking */ }
  }

  const startStep = (name: string): PipelineStep => ({
    step: name,
    status: 'running',
    duration_ms: 0,
  })

// ... [~580 lines elided] ...

// Lines 685-720 (final helpers):
export async function getPipelineRuns(
  s: SupabaseClient,
  body: { client_id?: string; agency_id?: string; limit?: number }
) {
  // ...reads kotoiq_pipeline_runs...
}

export async function getPipelineRun(
  s: SupabaseClient,
  body: { run_id: string }
) {
  // ...reads single kotoiq_pipeline_runs row...
}
```

The 8 pipeline steps (in order): generate_brief → write_full_page → plagiarism_check → watermark_removal → on_page_audit → schema_generation → human_score_calculation → optional_publish.

### 7-Stage Pipeline Orchestrator

**File:** `src/lib/builder/pipelineOrchestrator.ts`

A separate, higher-level orchestrator that chains stages: Profile → Ingest → Graph → Plan → Generate → Ship → Measure. Uses internal HTTP calls to `/api/kotoiq` actions. In-memory run tracking (`Map<string, PipelineRun>`) with durable writes to `kotoiq_pipeline_runs`.

### Other "Run" Concepts

| Table/Class | File | Description |
|---|---|---|
| `kotoiq_pipeline_runs` | autonomousPipeline.ts, pipelineOrchestrator.ts | Content pipeline runs |
| `kotoiq_auto_setup_runs` | voiceOnboardingAutoSetup.ts | Voice onboarding auto-setup runs |
| `kotoiq_processing_jobs` | contentRefreshEngine.ts, schemaEngine.ts, internalLinkEngine.ts | Batch URL processing jobs |
| `kotoiq_bulk_runs` | bulkOperationsEngine.ts | Agency-wide bulk operations |
| `kotoiq_sync_log` | route.ts (sync/quick_scan actions) | Data sync runs |
| `PipelineRun` (in-memory) | pipelineOrchestrator.ts:74 | Ephemeral run tracking |

---

## Section 6 — Data Contracts

### Shared Type Definitions

**Zod schemas exist** for the Ads Intelligence domain only:

- **`src/lib/ads/llmSchemas.ts`** — Zod schemas for all 11 LLM task input/output types (ClassifySearchTermInput, SearchTermClassificationSchema, RecommendNegativesInput, NegativesResponseSchema, GoogleRSAInput, MetaAdInput, LinkedInAdInput, TikTokAdInput, ExplainAnomalyInput, WeeklySummaryInput, etc.)

**TypeScript types exist** for the Client Profile domain:

- **`src/lib/kotoiq/profileTypes.ts`** — `ProvenanceRecord`, `CanonicalFieldName`, `EntityGraphSeed`, `EntityGraphNode`, `EntityGraphEdge`, `ClientProfile`, `Clarification`, `ClarificationSeverity`, `ClarificationStatus`, `ClarificationChannel`, `NarrationEvent`

**Pipeline types:**

- **`src/lib/builder/pipelineOrchestrator.ts`** — `PipelineConfig`, `StepResult`, `StageProgress`, `PipelineRun`, `PipelineResults`
- **`src/lib/autonomousPipeline.ts`** — `PipelineInput`, `PipelineResult`, `PipelineStep` (not exported)

**Multi-AI Blender types:**

- **`src/lib/multiAiBlender.ts`** — `BlendInput`, `BlendResult`, `ProviderOutput`

**Ads Router types:**

- **`src/lib/ads/llmRouter.ts`** — `AdsTask`, `AdsLLMRunArgs`, `AdsLLMResult`, `TaskConfig`, `ProviderTarget`

**For the remaining ~40 engine files:** Types are defined locally within each file (inline interfaces). There are no shared Zod schemas, Pydantic models, or centralized type contracts for the SEO engine outputs. Each engine defines its own return shape as a local TypeScript interface.

**`src/types/`** contains only `pdf-parse.d.ts` (ambient module declaration).

---

## Section 7 — Auth, Tenancy, and Cost

### How a feature knows the tenant

**Two patterns coexist:**

1. **Main route (`/api/kotoiq/route.ts`):** Reads `client_id` and `agency_id` directly from `body` (the POST JSON payload). There is no `verifySession()` call in the main route handler. Any authenticated or unauthenticated caller that can reach the endpoint can pass any `client_id`.

2. **Profile route (`/api/kotoiq/profile/route.ts`):** Uses `verifySession(req)` from `src/lib/apiAuth.ts`. `agencyId` comes from the session JWT — never from the request body. Cross-agency client access returns 404.

3. **Pipeline route (`/api/kotoiq/pipeline/route.ts`):** Uses `verifySession(req)` and reads `agencyId` from session.

4. **Integrations route (`/api/kotoiq/integrations/route.ts`):** Uses `verifySession(req)`, `agencyId` from session.

**Pattern summary:** Newer routes (profile, pipeline, integrations) enforce auth via `verifySession`. The main monolithic route does not — it trusts `body.agency_id` / `body.client_id`.

### Per-client cost / quota tracking

1. **Platform-wide token tracking:** `src/lib/tokenTracker.ts` — `logTokenUsage()` writes to `koto_token_usage` table. Called from most LLM-using features. Tracks: feature, model, input_tokens, output_tokens, agencyId.

2. **Ads-specific LLM cost tracking:** `src/lib/ads/llmRouter.ts` — writes to `kotoiq_ads_llm_usage` table per call. Includes cost_usd, latency_ms, success flag, prompt_version. Also has budget enforcement via `kotoiq_ads_settings.monthly_llm_budget_usd`.

3. **Profile seeder cost budget:** `src/lib/kotoiq/profileCostBudget.ts` — `checkBudget()`, `applyOverride()`, `checkRateLimit()`. Used by profile route to enforce cost limits per operation.

4. **No per-client cost tracking for DataForSEO or Moz.** DataForSEO has a shared balance check (`getBalance` in `src/lib/dataforseo.ts`) but no per-client attribution.

### API key storage

All API keys are stored as **environment variables** (set in Vercel). No secrets manager or KMS. The one exception: `koto_agency_integrations` stores **encrypted** per-agency API keys (Typeform, Jotform, Google Forms, GBP OAuth tokens) using AES-256-GCM in a jsonb column, with the master key (`KOTO_AGENCY_INTEGRATIONS_KEK`) in an env var.

---

## Section 8 — One End-to-End Trace

**Feature traced: On-Page SEO Analyzer (#11)**

1. **UI entry:** `src/components/kotoiq/OnPageTab.jsx` — user enters a URL and optional target keyword, clicks "Run Audit" button.

2. **Network call:** `POST /api/kotoiq` with `{ action: 'analyze_on_page', client_id, url, target_keyword }`

3. **Server handler:** `src/app/api/kotoiq/route.ts` line ~3583 — matches `action === 'analyze_on_page'`.

4. **Function invoked:** `analyzeOnPage(s, ai, body)` from `src/lib/onPageEngine.ts` (line 257).

5. **Inside `analyzeOnPage`:**
   - Fetches the target URL HTML via Playwright (`playwright-core`).
   - Extracts title, meta description, headings, images, links, word count.
   - Sends structured analysis prompt to Claude Sonnet via Anthropic SDK.
   - Claude returns JSON with checks array, keyword_placement, critical_fixes, quick_wins, overall_score, grade.
   - Logs token usage via `logTokenUsage()` → writes to `koto_token_usage`.

6. **Database writes:** Inserts result into `kotoiq_on_page_audits` (id, client_id, url, target_keyword, overall_score, grade, checks jsonb, critical_fixes jsonb, quick_wins jsonb, scanned_at).

7. **Response:** Returns `{ success: true, audit: { ...all fields... } }` as JSON to the UI.

8. **UI update:** OnPageTab receives the response, renders score badge, check list, keyword placement map, and action items.

---

## Section 9 — Open Questions and Surprises

1. **No auth on main route.** `src/app/api/kotoiq/route.ts` (the 5200-line monolith handling ~130 actions) does NOT call `verifySession()`. It reads `client_id` and `agency_id` from the request body with no validation. Any caller with the endpoint URL can access any client's data. This is a significant security gap versus the newer profile/pipeline/integrations routes which enforce session auth.

2. **Missing migrations for some core tables.** `kotoiq_keywords`, `kotoiq_snapshots`, `kotoiq_content_briefs`, `kotoiq_domain_enrichment`, `kotoiq_gmb_grid`, `kotoiq_gmb_images`, `kotoiq_spam_hits`, `kotoiq_aeo_audits`, `kotoiq_aeo_scores`, `kotoiq_competitor_maps`, `kotoiq_hyperlocal_content` — heavily used in code but no `CREATE TABLE` was found in any kotoiq-prefixed migration file. Note: many tables initially suspected missing (content_inventory, brand_serp, backlink_profile, eeat_audit, schema_audit, internal_links, link_audit, query_clusters, technical_deep, semantic_analysis) were found in the large `20260501_kotoiq_topical_maps.sql` migration. The remaining missing tables may be created in non-kotoiq migrations or were created manually in Supabase.

3. **In-memory pipeline tracking.** `pipelineOrchestrator.ts` line 74: `const activeRuns = new Map<string, PipelineRun>()`. On Vercel (serverless), this Map is lost between cold starts. The DB-backed fallback exists but is wrapped in try/catch that silently swallows failures if the migration hasn't been applied.

4. **Deferred migrations.** Multiple migration files note they are "NOT yet applied to live Supabase" (see `20260512_kotoiq_pipeline_runs_rls.sql` header). The pipeline_runs RLS migration, agency_integrations table, and possibly others are in a deferred backlog.

5. **32 semantic agents, not 12.** The feature map references "12 Semantic Agents" but the codebase has 32 across 5 files (`semanticAgents.ts`, `semanticAgentsTier2.ts`, `semanticAgentsTier3.ts`, `kotoiqAdvancedAgents.ts`, `kotoiqAdvancedAgents2.ts`) plus 4 post-processors.

6. **Two separate pipeline systems.** `autonomousPipeline.ts` (per-keyword, 8 steps) and `pipelineOrchestrator.ts` (7-stage, multi-keyword) are independent implementations with overlapping responsibility. Both write to `kotoiq_pipeline_runs` but with different schemas. The relationship between them is unclear.

7. **`kotoiq_knowledge_graph_exports` created twice.** Both `20260420_kotoiq_strategy.sql` and `20260607_kotoiq_sync_and_recs.sql` contain `CREATE TABLE IF NOT EXISTS kotoiq_knowledge_graph_exports`. Harmless (IF NOT EXISTS) but indicates potential migration ordering confusion.

8. **No canonical 62-feature list in the codebase.** The 62-feature number and the 12-domain grouping are referenced in the task but no file in the repo enumerates them. Feature numbering in this inventory is best-effort.

9. **Ads LLM router is isolated.** `src/lib/ads/llmRouter.ts` has a sophisticated multi-provider routing system (Gemini/Claude/GPT-4o) with Zod validation and budget enforcement, but it is only used by the Ads Intelligence features. The rest of the platform (40+ engines) uses direct Anthropic SDK calls with no validation, no fallback, and no budget enforcement.

10. **Content brief generation uses Multi-AI Blender** (`blendThreeAIs`) but most other features use Claude-only. The blender is used by: `generate_brief`, `aeo_deep_analysis`, `analyzeSemanticNetwork`. Inconsistent — human should decide if all features should use blending or if it should be opt-in.

11. **`src/components/kotoiq/SemanticAgentsInfo.jsx`** exists as a component but it appears to be informational UI only (lists the agents), not a functional entry point.

12. **`vercel.json` maxDuration for `/api/kotoiq` is 300s** — the single monolithic route handler can run up to 5 minutes per request. Some actions (like `deep_enrich` at ~300 lines of inline code) are heavy and could benefit from decomposition.

13. **OAuth routes for LinkedIn and Meta ads** exist at `src/app/api/seo/linkedin-exchange/` and `src/app/api/seo/meta-exchange/` (untracked files in git status) — these appear to be new work-in-progress for multi-platform ads token exchange.

---

*End of inventory. File: `/Users/adamsegall-mini/gsd-workspaces/scout-voice/moose/KOTOIQ_INVENTORY.md`*
