-- KotoIQ Topical Map Builder + Internal Link Intelligence + Content Refresh + Brand SERP
-- Covers Features 1-10 from the semantic SEO build plan

-- ═══════════════════════════════════════════════════════════════════════════
-- FEATURE 1: Topical Map Builder
-- ═══════════════════════════════════════════════════════════════════════════

-- Master topical map per client
CREATE TABLE IF NOT EXISTS kotoiq_topical_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id),
  name text NOT NULL DEFAULT 'Primary Topical Map',

  -- Core identity (from Koray's framework)
  central_entity text,               -- e.g. "plumbing", "personal injury law"
  source_context text,               -- how the brand monetizes (e.g. "residential plumbing services")
  central_search_intent text,        -- unification of entity + context (e.g. "hiring a plumber")

  -- Scoring
  topical_coverage_score numeric(5,2) DEFAULT 0,   -- 0-100
  vastness_score numeric(5,2) DEFAULT 0,           -- breadth of topics
  depth_score numeric(5,2) DEFAULT 0,              -- depth per topic
  momentum_score numeric(5,2) DEFAULT 0,           -- publishing velocity
  overall_authority_score numeric(5,2) DEFAULT 0,   -- combined

  -- Metadata
  total_nodes integer DEFAULT 0,
  covered_nodes integer DEFAULT 0,
  competitor_avg_coverage numeric(5,2),

  status text DEFAULT 'draft',  -- draft, active, archived
  generated_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Individual nodes in the topical map
CREATE TABLE IF NOT EXISTS kotoiq_topical_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES kotoiq_topical_maps(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Node identity
  entity text NOT NULL,                -- e.g. "water heater repair"
  entity_type text,                    -- service, location, concept, product, attribute
  section text DEFAULT 'core',         -- core | outer (from Koray's framework)

  -- Entity-Attribute pairs
  attributes jsonb DEFAULT '[]',       -- [{name, value, covered: bool}]
  parent_node_id uuid REFERENCES kotoiq_topical_nodes(id),

  -- Coverage state
  status text DEFAULT 'gap',           -- gap, partial, covered, excess
  existing_url text,                   -- URL that covers this node (if any)
  existing_word_count integer,
  existing_position numeric(5,2),      -- SC avg position for this entity

  -- Scoring
  priority text DEFAULT 'medium',      -- critical, high, medium, low
  search_volume integer,
  difficulty_score numeric(5,2),       -- quality threshold (NOT keyword difficulty)
  relevance_to_central numeric(5,2),   -- how close to central entity (semantic distance)

  -- Content mapping
  suggested_url text,
  suggested_title text,
  content_type text,                   -- pillar, cluster, support, faq, comparison
  macro_context text,                  -- what the page's main focus should be
  micro_contexts jsonb DEFAULT '[]',   -- supporting contexts / supplementary content

  -- Connections
  contextual_bridges jsonb DEFAULT '[]', -- [{target_node_id, anchor_text, bridge_type}]

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Edges connecting topical map nodes (for visualization + internal link planning)
CREATE TABLE IF NOT EXISTS kotoiq_topical_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES kotoiq_topical_maps(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES kotoiq_topical_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES kotoiq_topical_nodes(id) ON DELETE CASCADE,

  edge_type text DEFAULT 'contextual',  -- contextual, hierarchical, sibling, bridge
  anchor_text text,
  weight numeric(3,2) DEFAULT 1.0,      -- link importance 0-1
  exists_in_content boolean DEFAULT false, -- is this link actually on the site?

  created_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- FEATURE 2: Internal Link Intelligence
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_internal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  source_url text NOT NULL,
  target_url text NOT NULL,
  anchor_text text,
  anchor_type text,           -- exact, partial, branded, naked_url, generic, image
  position text,              -- header, nav, content, sidebar, footer
  is_first_link boolean,      -- first link on page to this target (PageRank relevant)

  -- Analysis
  contextual_relevance numeric(5,2),  -- 0-100 relevance of link in context
  link_equity_estimate numeric(5,2),  -- estimated PageRank pass

  scanned_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_link_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  total_pages integer,
  total_internal_links integer,
  avg_links_per_page numeric(5,1),
  orphan_pages jsonb DEFAULT '[]',           -- pages with 0 internal links pointing to them
  over_linked_pages jsonb DEFAULT '[]',      -- pages with >150 links
  duplicate_anchor_issues jsonb DEFAULT '[]', -- same anchor pointing to different URLs
  broken_links jsonb DEFAULT '[]',

  -- PageRank distribution
  equity_concentration numeric(5,2),  -- how concentrated link equity is (Gini coefficient)
  top_equity_pages jsonb DEFAULT '[]',
  starved_pages jsonb DEFAULT '[]',   -- high-value pages with low internal links

  -- Breadcrumb analysis
  breadcrumb_coverage numeric(5,2),   -- % of pages with breadcrumbs
  breadcrumb_issues jsonb DEFAULT '[]',

  quality_node_suggestions jsonb DEFAULT '[]', -- pages to link from homepage

  overall_score numeric(5,2),
  scanned_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- FEATURE 3: Content Refresh Engine
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_content_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  url text NOT NULL,
  title text,
  word_count integer,
  published_at timestamptz,
  last_modified timestamptz,

  -- Search Console data (latest)
  sc_position numeric(5,2),
  sc_clicks integer,
  sc_impressions integer,
  sc_ctr numeric(8,6),

  -- Historical trajectory
  position_30d_ago numeric(5,2),
  position_90d_ago numeric(5,2),
  clicks_30d_ago integer,
  trajectory text,           -- improving, stable, declining, new, dead

  -- Freshness
  days_since_update integer,
  freshness_status text,     -- fresh, aging, stale, critical
  refresh_priority text,     -- urgent, soon, scheduled, ok
  refresh_due_at timestamptz,

  -- Quality signals
  thin_content boolean DEFAULT false,
  unique_sentence_ratio numeric(5,2),
  has_images boolean,
  has_schema boolean,
  has_faq boolean,
  internal_links_in integer,   -- links pointing TO this page
  internal_links_out integer,  -- links FROM this page

  -- AI recommendations
  refresh_recommendations jsonb DEFAULT '[]',

  topical_node_id uuid REFERENCES kotoiq_topical_nodes(id),
  scanned_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- FEATURE 4: Brand SERP Manager
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_brand_serp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  brand_query text NOT NULL,          -- the brand name as searched

  -- SERP features detected
  has_knowledge_panel boolean DEFAULT false,
  has_site_links boolean DEFAULT false,
  has_paa boolean DEFAULT false,
  has_reviews boolean DEFAULT false,
  has_local_pack boolean DEFAULT false,
  has_images boolean DEFAULT false,
  has_videos boolean DEFAULT false,
  has_news boolean DEFAULT false,
  has_social boolean DEFAULT false,
  has_jobs boolean DEFAULT false,
  has_ai_overview boolean DEFAULT false,

  -- Sentiment
  paa_questions jsonb DEFAULT '[]',    -- [{question, sentiment: trust|neutral|negative}]
  negative_results jsonb DEFAULT '[]', -- [{url, title, position, sentiment}]

  -- Knowledge Panel
  kp_description text,
  kp_source text,                     -- wikipedia, google, other
  kp_attributes jsonb DEFAULT '[]',   -- [{name, value, correct: bool}]

  -- Ownership
  owned_results integer DEFAULT 0,     -- results from client's domain
  total_results integer DEFAULT 10,
  brand_serp_score numeric(5,2),       -- 0-100 overall brand SERP health

  scanned_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- FEATURE 5: Backlink Intelligence
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_backlink_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Overview metrics
  total_backlinks integer DEFAULT 0,
  total_referring_domains integer DEFAULT 0,
  domain_authority numeric(5,2),
  spam_score numeric(5,2),

  -- DR distribution (bins: 0-10, 10-20, ... 90-100)
  dr_distribution jsonb DEFAULT '{}', -- {"0-10": 45, "10-20": 30, ...}

  -- Anchor text analysis
  anchor_distribution jsonb DEFAULT '{}', -- {exact: 10%, partial: 20%, branded: 40%, ...}
  top_anchors jsonb DEFAULT '[]',

  -- Quality analysis
  toxic_links jsonb DEFAULT '[]',
  high_quality_links jsonb DEFAULT '[]', -- DA 50+

  -- Trust signals
  edu_gov_links integer DEFAULT 0,
  trust_rank_estimate numeric(5,2),

  -- Opportunities
  unlinked_mentions jsonb DEFAULT '[]',
  competitor_common_links jsonb DEFAULT '[]',   -- links competitors have that client doesn't
  broken_link_opportunities jsonb DEFAULT '[]',

  -- Comparison vs competitors
  competitor_comparison jsonb DEFAULT '[]', -- [{domain, da, backlinks, referring_domains}]

  overall_score numeric(5,2),
  scanned_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- FEATURE 6: E-E-A-T Scorer
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_eeat_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  url text,  -- null = site-wide, specific URL = page-level

  -- Experience (E1)
  experience_score numeric(5,2),
  experience_signals jsonb DEFAULT '[]', -- [{signal, found: bool, detail}]

  -- Expertise (E2)
  expertise_score numeric(5,2),
  expertise_signals jsonb DEFAULT '[]',

  -- Authority (A)
  authority_score numeric(5,2),
  authority_signals jsonb DEFAULT '[]',

  -- Trust (T)
  trust_score numeric(5,2),
  trust_signals jsonb DEFAULT '[]',

  -- Overall
  overall_eeat_score numeric(5,2),
  grade text,  -- A, B, C, D, F

  -- Author entity
  author_name text,
  author_has_knowledge_panel boolean,
  author_entity_signals jsonb DEFAULT '[]',

  recommendations jsonb DEFAULT '[]',
  scanned_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- FEATURE 7: Semantic Content Network Analyzer
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_semantic_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Macro semantics (site-wide)
  site_ngrams jsonb DEFAULT '[]',          -- top N-grams across entire site
  top_nouns jsonb DEFAULT '[]',
  top_predicates jsonb DEFAULT '[]',
  top_adjectives jsonb DEFAULT '[]',
  heading_patterns jsonb DEFAULT '[]',     -- common heading formats
  paragraph_openers jsonb DEFAULT '[]',    -- first words of paragraphs

  -- Content network health
  main_vs_supplementary_ratio numeric(5,2),  -- should be ~70/30
  contextual_flow_score numeric(5,2),
  contextual_consistency_score numeric(5,2),

  -- Per-page analysis (top pages)
  page_analyses jsonb DEFAULT '[]',  -- [{url, macro_context, micro_contexts, main_pct, supp_pct, ...}]

  -- Issues
  thin_content_pages jsonb DEFAULT '[]',
  context_dilution_pages jsonb DEFAULT '[]',  -- pages trying to cover too many topics
  orphan_contexts jsonb DEFAULT '[]',         -- topics mentioned but not linked

  overall_score numeric(5,2),
  scanned_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- FEATURE 8: Technical SEO Deep
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_technical_deep (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Crawl budget
  total_urls integer,
  indexable_urls integer,
  crawl_waste_pct numeric(5,2),        -- % of URLs that shouldn't be crawled
  url_value_ratio numeric(5,2),        -- valuable URLs / total URLs

  -- Canonical
  canonical_issues jsonb DEFAULT '[]', -- [{url, issue_type, detail}]
  canonical_score numeric(5,2),

  -- Mobile-first
  mobile_mismatches jsonb DEFAULT '[]',
  mobile_score numeric(5,2),

  -- Sitemap
  sitemap_url text,
  sitemap_urls_count integer,
  sitemap_categorized boolean,
  sitemap_issues jsonb DEFAULT '[]',

  -- Index coverage
  indexed_pct numeric(5,2),
  not_indexed_reasons jsonb DEFAULT '{}',
  status_code_distribution jsonb DEFAULT '{}', -- {200: 95, 301: 3, 404: 2}

  -- Core Web Vitals
  cwv_lcp numeric(8,2),
  cwv_fid numeric(8,2),
  cwv_cls numeric(8,4),
  cwv_grade text,

  overall_score numeric(5,2),
  scanned_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- FEATURE 9: Schema Intelligence
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_schema_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  total_pages_with_schema integer DEFAULT 0,
  total_pages_without integer DEFAULT 0,
  coverage_pct numeric(5,2),

  -- Schema types found
  schema_types jsonb DEFAULT '{}',       -- {"LocalBusiness": 5, "Article": 12, ...}
  schema_errors jsonb DEFAULT '[]',      -- [{url, type, error}]

  -- Rich result eligibility
  eligible_not_implemented jsonb DEFAULT '[]', -- [{url, type, potential_ctr_lift}]

  -- Competitor comparison
  competitor_schemas jsonb DEFAULT '[]',  -- [{domain, types: [...]}]
  missing_vs_competitors jsonb DEFAULT '[]',

  -- Semantic HTML
  semantic_html_score numeric(5,2),
  semantic_issues jsonb DEFAULT '[]',   -- [{url, issue}]

  -- Auto-generated schemas (ready to copy)
  generated_schemas jsonb DEFAULT '[]', -- [{url, type, json_ld}]

  overall_score numeric(5,2),
  scanned_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- FEATURE 10: Search Session / Query Path Analyzer
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_query_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  cluster_name text NOT NULL,
  cluster_type text,          -- correlative, sequential, topical, intent

  -- Queries in this cluster
  queries jsonb DEFAULT '[]', -- [{keyword, volume, position, relationship: "seed|correlative|sequential"}]
  seed_query text,            -- the representative query

  -- User behavior signals
  avg_session_depth numeric(5,2),   -- avg pages per session for this cluster
  common_next_queries jsonb DEFAULT '[]',  -- what users search after
  common_prev_queries jsonb DEFAULT '[]',  -- what users searched before

  -- Content coverage
  covered_queries integer DEFAULT 0,
  total_queries integer DEFAULT 0,
  coverage_pct numeric(5,2),
  gap_queries jsonb DEFAULT '[]',    -- queries in cluster with no content

  -- Topical map link
  topical_node_id uuid REFERENCES kotoiq_topical_nodes(id),

  created_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_topical_maps_client ON kotoiq_topical_maps(client_id);
CREATE INDEX IF NOT EXISTS idx_topical_nodes_map ON kotoiq_topical_nodes(map_id);
CREATE INDEX IF NOT EXISTS idx_topical_nodes_client ON kotoiq_topical_nodes(client_id);
CREATE INDEX IF NOT EXISTS idx_topical_edges_map ON kotoiq_topical_edges(map_id);
CREATE INDEX IF NOT EXISTS idx_internal_links_client ON kotoiq_internal_links(client_id);
CREATE INDEX IF NOT EXISTS idx_content_inventory_client ON kotoiq_content_inventory(client_id);
CREATE INDEX IF NOT EXISTS idx_brand_serp_client ON kotoiq_brand_serp(client_id);
CREATE INDEX IF NOT EXISTS idx_backlink_profile_client ON kotoiq_backlink_profile(client_id);
CREATE INDEX IF NOT EXISTS idx_eeat_audit_client ON kotoiq_eeat_audit(client_id);
CREATE INDEX IF NOT EXISTS idx_semantic_analysis_client ON kotoiq_semantic_analysis(client_id);
CREATE INDEX IF NOT EXISTS idx_technical_deep_client ON kotoiq_technical_deep(client_id);
CREATE INDEX IF NOT EXISTS idx_schema_audit_client ON kotoiq_schema_audit(client_id);
CREATE INDEX IF NOT EXISTS idx_query_clusters_client ON kotoiq_query_clusters(client_id);
