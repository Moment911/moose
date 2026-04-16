# KotoIQ Semantic SEO Intelligence — Technical Specification

## 1. System Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router), React 18, Lucide icons |
| Backend | Next.js API Routes (single POST endpoint) |
| Database | Supabase (PostgreSQL + RLS) |
| AI Engine | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| SEO Data | DataForSEO (SERP, rankings, competitors) |
| Search Console | Google Search Console API via OAuth |
| Analytics | Google Analytics 4 Data API |
| Paid Search | Google Ads API (keywords, campaigns) |
| Local SEO | Google Business Profile API, Google Maps |
| Domain Authority | Moz API |
| Page Speed | Google PageSpeed Insights API |

### API Pattern

Single POST endpoint: `/api/kotoiq` with action-based dispatch.

```
POST /api/kotoiq
Content-Type: application/json
{ "action": "sync", "client_id": "...", "agency_id": "...", ... }
```

All actions authenticated via Supabase service role key. Token usage logged to `koto_token_usage` for every Claude call.

### Engine Files (16 TypeScript modules in `/src/lib/`)

| File | Purpose |
|------|---------|
| `semanticAgents.ts` | Agents 1-4: Query Gap, Frame Semantics, Semantic Role Labeler, Named Entity Suggester |
| `semanticPostProcessors.ts` | Agents 5-8: Contextless Word Remover, Topicality Scorer, Sentence Filterer, Safe Answer Generator |
| `semanticAgentsTier2.ts` | Agents 9-13: Lexical Relations, Topic Clusterer, Title Auditor, Key-Fact Summarizer, Bridge Topic Suggester |
| `semanticAgentsTier3.ts` | Agents 14-21: Comment Generator, Sentiment Optimizer, Entity Inserter, Metadiscourse Auditor, N-gram Extractor, Triple Generator, Spam Hit Detector, Quality Update Auditor |
| `seoService.ts` | Google Search Console + GA4 OAuth + data fetching |
| `perfMarketing.ts` | Google Ads API integration |
| `dataforseo.ts` | DataForSEO SERP, rankings, competitors, domain intersection |
| `brandSerpEngine.ts` | Brand SERP scanning and defense strategies |
| `backlinkEngine.ts` | Backlink analysis and profile building |
| `eeatEngine.ts` | E-E-A-T audit engine |
| `schemaEngine.ts` | Schema.org audit and generation |
| `internalLinkEngine.ts` | Internal link scanning, audit, suggestions |
| `topicalMapEngine.ts` | Topical map generation and coverage analysis |
| `contentRefreshEngine.ts` | Content inventory and refresh prioritization |
| `semanticAnalyzer.ts` | Semantic network analysis |
| `technicalSeoEngine.ts` | Technical SEO deep audit |
| `queryPathEngine.ts` | Query path and session analysis |
| `reviewIntelEngine.ts` | Review intelligence and campaign management |
| `contentCalendarEngine.ts` | Content calendar and publishing momentum |
| `domainEnrichment.ts` | Domain metadata enrichment |
| `tokenTracker.ts` | Claude API token usage logging |

### UI Components (13 React tab components in `/src/components/kotoiq/`)

| Component | Tab |
|-----------|-----|
| `SemanticTab.jsx` | Semantic Analysis |
| `TopicalMapTab.jsx` | Topical Map |
| `ContentRefreshTab.jsx` | Content Refresh |
| `BrandSerpTab.jsx` | Brand SERP |
| `BacklinksTab.jsx` | Backlinks |
| `EEATTab.jsx` | E-E-A-T Audit |
| `SchemaTab.jsx` | Schema Markup |
| `InternalLinksTab.jsx` | Internal Links |
| `TechnicalDeepTab.jsx` | Technical SEO |
| `QueryPathTab.jsx` | Query Paths |
| `ReviewsTab.jsx` | Review Intelligence |
| `ContentCalendarTab.jsx` | Content Calendar |
| `SemanticAgentsInfo.jsx` | Agent pipeline info panel |

---

## 2. Database Schema

### Core Keyword Tracking

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `kotoiq_keywords` | Unified Keyword File (UKF) — merged data from all sources | `client_id`, `keyword`, `fingerprint`, `intent`, `category`, `kp_monthly_volume`, `kp_cpc_cents`, `sc_clicks`, `sc_impressions`, `sc_ctr`, `sc_avg_position`, `sc_top_page`, `ads_clicks`, `ads_impressions`, `ads_conversions`, `ads_cost_cents`, `moz_da`, `moz_pa`, `opportunity_score`, `rank_propensity`, `quality_threshold`, `aeo_score` |
| `kotoiq_snapshots` | Historical rank snapshots per keyword | `keyword_id`, `position`, `clicks`, `impressions`, `snapshot_date` |
| `kotoiq_sync_log` | Audit trail of data syncs | `client_id`, `source`, `keywords_synced`, `started_at`, `completed_at` |
| `kotoiq_recommendations` | AI-generated action items | `client_id`, `keyword`, `recommendation`, `priority`, `status` |
| `kotoiq_content_briefs` | Full content briefs for page writing | `client_id`, `target_keyword`, `title_tag`, `meta_description`, `h1`, `outline` (jsonb), `faq_questions` (jsonb), `target_entities` (jsonb), `schema_types` (jsonb), `target_word_count`, `target_url` |

### Topical Authority

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `kotoiq_topical_maps` | Top-level topical map per client | `client_id`, `name`, `status`, `node_count`, `edge_count` |
| `kotoiq_topical_nodes` | Individual topic nodes in the map | `map_id`, `keyword`, `role` (pillar/cluster/support/faq), `status`, `url`, `content_score` |
| `kotoiq_topical_edges` | Relationships between topic nodes | `map_id`, `source_node_id`, `target_node_id`, `relationship_type`, `strength` |

### Content & Links

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `kotoiq_content_inventory` | Crawled pages with metadata | `client_id`, `url`, `title`, `word_count`, `last_modified`, `status` |
| `kotoiq_internal_links` | Internal link graph | `client_id`, `source_url`, `target_url`, `anchor_text`, `context` |
| `kotoiq_link_audit` | Internal link audit results | `client_id`, `orphan_pages`, `suggestions` (jsonb), `audit_date` |

### Brand & Authority

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `kotoiq_brand_serp` | Brand SERP analysis results | `client_id`, `brand_query`, `results` (jsonb), `owned_pct`, `scan_date` |
| `kotoiq_backlink_profile` | Backlink analysis data | `client_id`, `domain`, `total_backlinks`, `referring_domains`, `da_score`, `profile_data` (jsonb) |
| `kotoiq_eeat_audit` | E-E-A-T audit results | `client_id`, `url`, `experience_score`, `expertise_score`, `authority_score`, `trust_score`, `overall_eeat_score`, `grade` |

### Semantic & Technical

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `kotoiq_semantic_analysis` | Semantic network analysis results | `client_id`, `analysis_data` (jsonb), `analyzed_at` |
| `kotoiq_technical_deep` | Technical SEO audit data | `client_id`, `url`, `cwv_data` (jsonb), `issues` (jsonb), `score` |
| `kotoiq_schema_audit` | Schema.org audit results | `client_id`, `url`, `schemas_found` (jsonb), `missing_schemas`, `score` |
| `kotoiq_query_clusters` | Query path/session clustering | `client_id`, `clusters` (jsonb), `analyzed_at` |

### Reviews & Calendar

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `kotoiq_review_intelligence` | Review sentiment analysis | `client_id`, `aspects` (jsonb), `overall_themes` (jsonb), `analyzed_at` |
| `kotoiq_review_campaigns` | Review request campaigns | `client_id`, `name`, `status`, `sent_count`, `response_count` |
| `kotoiq_content_calendar` | Planned content items | `client_id`, `keyword`, `content_type`, `status`, `publish_date`, `assigned_to` |
| `kotoiq_publishing_momentum` | Publishing velocity tracking | `client_id`, `period`, `pages_published`, `momentum_score`, `calculated_at` |

---

## 3. Semantic Agent Pipeline — Full Page Writer (`write_full_page`)

Based on the [SemanticsX semantic SEO methodology](https://www.semanticsx.com/semantic-seo/ai-agents), the page writer orchestrates 12 of the 21 agents in a specific execution order:

```
INPUT: brief_id -> loads kotoiq_content_briefs row + client data

PRE-GENERATION (Wave 1 — parallel via Promise.all):
├── runQueryGapAnalyzer(keyword, industry, business)
│   -> context_signifiers[], competitor_gaps[], recommended_h2_order[]
├── runFrameAnalyzer(keyword)
│   -> frame_elements[] with importance + coverage status
├── runNamedEntitySuggester(keyword, industry, business, location)
│   -> entities[] with priority (must_include/recommended/nice_to_have)
└── runLexicalRelationAnalyzer(keyword, industry)
    -> hypernyms[], hyponyms[], meronyms[], co_hyponyms[], holonyms[]

PRE-GENERATION (Wave 2 — parallel via Promise.all):
├── runSafeAnswerGenerator(keyword, business, industry, location)
│   -> featured_snippet_answer (40-60 words), paa_answers[], h2_answer_pairs[]
└── runTitleQueryAuditor(title, keyword)
    -> score, improved_titles[] (conjunctive/entity_attribute/hypernym_hyponym)

GENERATION (Claude Sonnet, max_tokens: 8000):
└── Single prompt with injected intelligence:
    - Query gap signifiers as MUST-ADDRESS items
    - Frame elements as REQUIRED COVERAGE checklist
    - Must-include entities as REQUIRED MENTIONS
    - Lexical terms (hypernyms/hyponyms/meronyms) as COVERAGE REQUIREMENTS
    - Safe answer as REQUIRED OPENING PARAGRAPH
    - Title alternatives from audit
    Output parsed into: TITLE, META, H1, CONTENT (HTML), FAQ_HTML, PLAIN_TEXT

POST-GENERATION (sequential — each step modifies content):
1. runContextlessWordRemover(plainText, keyword, target_entities)
   -> strips filler, increases semantic density
2. runMetadiscourseAuditor(plainText)
   -> removes "In conclusion", "It's important to note", etc.
3. runSentenceFilterer(plainText, keyword)
   -> classifies every sentence, flags filler/redundant
4. runEntityInserter(plainText, missing_entities, keyword)
   -> naturally inserts must-include entities the generator missed
5. runTopicalityScorer(plainText, keyword, required_entities, frame_elements)
   -> scores 0-100 across 5 dimensions with gap analysis
6. runTripleGenerator(plainText, keyword, business_name)
   -> extracts S-P-O triples for schema.org markup

OUTPUT JSON:
{
  title, meta, h1, content_html, faq_html, plain_text, word_count,
  brief_id, topicality_score, title_audit, knowledge_graph_triples,
  schema_suggestions, sentence_quality, metadiscourse_removed,
  entities_inserted, semantic_agents_used (boolean map of all 12 agents)
}
```

---

## 4. All 21 Agents — Technical Reference

### Agent 1: Query Gap Analyzer

- **Function:** `runQueryGapAnalyzer(ai, params)`
- **File:** `src/lib/semanticAgents.ts`
- **Input:** `{ keyword, industry, business_name, existing_keywords?, competitor_pages?, agencyId? }`
- **Output:** `QueryGapResult { primary_angle, context_signifiers[], competitor_gaps[], recommended_h2_order[], commercial_opportunities[], query_network[] }`
- **Prompt strategy:** Maps the full query network around the keyword, identifies context signifiers (minimum semantic footprint), measures semantic distance of competitors, and finds high-value commercial intent gaps with low competitive density.
- **Integration:** Pre-generation Wave 1 in `write_full_page`; standalone via `run_semantic_agents` action.

### Agent 2: Frame Semantics Analyzer

- **Function:** `runFrameAnalyzer(ai, params)`
- **File:** `src/lib/semanticAgents.ts`
- **Input:** `{ keyword, page_content?, competitor_contents?, agencyId? }`
- **Output:** `FrameResult { frame_name, frame_elements[]{element, importance, covered_by_competitors, your_coverage}, missing_critical[], competitive_advantage_elements[] }`
- **Prompt strategy:** Identifies the primary semantic frame for the keyword, classifies elements as critical/important/supporting, maps entity-attribute pairs within each element, and traces relevance propagation paths between elements.
- **Integration:** Pre-generation Wave 1; standalone via `run_semantic_agents` action.

### Agent 3: Semantic Role Labeler

- **Function:** `runSemanticRoleLabeler(ai, params)`
- **File:** `src/lib/semanticAgents.ts`
- **Input:** `{ keyword, sentences[], primary_entity, agencyId? }`
- **Output:** `RoleLabelResult { optimized_sentences[]{original, optimized, reason, weight_shift}, predicate_suggestions[]{current, suggested, context_impact} }`
- **Prompt strategy:** Performs agent-patient analysis on each sentence, ensures the primary entity occupies the agent (subject) position for maximum semantic weight, and replaces weak predicates (is, has, offers) with domain-specific verbs (eliminates, certifies, prevents).
- **Integration:** Standalone via `run_semantic_role_optimization` action; used in content polish workflows.

### Agent 4: Named Entity Suggester

- **Function:** `runNamedEntitySuggester(ai, params)`
- **File:** `src/lib/semanticAgents.ts`
- **Input:** `{ keyword, industry, location?, business_name, existing_entities?, agencyId? }`
- **Output:** `EntityResult { entities[]{name, type, priority, context}, missing_critical[] }`
- **Prompt strategy:** Identifies entity co-occurrence expectations for the topic, classifies entities by type (brand/organization/certification/technical_term/industry_standard) and priority (must_include/recommended/nice_to_have), with contextual placement guidance.
- **Integration:** Pre-generation Wave 1; entity list feeds into Entity Inserter (Agent 16) post-generation.

### Agent 5: Contextless Word Remover

- **Function:** `runContextlessWordRemover(ai, params)`
- **File:** `src/lib/semanticPostProcessors.ts`
- **Input:** `{ content, keyword, target_entities[] }`
- **Output:** `CleanedContentResult { cleaned_content, removed_count, removals[]{original_phrase, action, reason}, density_improvement_pct }`
- **Prompt strategy:** Targets six categories: filler adjectives, generic predicates, stop-word-heavy phrases, redundant qualifiers, hedging language, and empty discourse markers. Preserves domain terminology and named entities.
- **Integration:** Post-generation Step 1 in `write_full_page`; standalone via `run_content_polish` action.

### Agent 6: Topicality Scorer

- **Function:** `runTopicalityScorer(ai, params)`
- **File:** `src/lib/semanticPostProcessors.ts`
- **Input:** `{ content, keyword, competitor_outlines?, required_entities?, frame_elements? }`
- **Output:** `TopicalityResult { overall_score, entity_coverage, frame_coverage, contextual_completeness, heading_quality, information_gain, gaps[], excess[], grade }`
- **Prompt strategy:** Scores across five dimensions (0-100 each). Cross-references against entity and frame element lists from pre-generation agents. Grades A (90-100) through F (0-39).
- **Integration:** Post-generation Step 5 in `write_full_page`.

### Agent 7: Sentence Filterer (Algorithmic Authorship)

- **Function:** `runSentenceFilterer(ai, params)`
- **File:** `src/lib/semanticPostProcessors.ts`
- **Input:** `{ content, keyword }`
- **Output:** `FilterResult { sentences[]{text, category, score, suggestion?}, filler_count, filler_pct, informative_pct, quality_score }`
- **Prompt strategy:** Classifies every sentence into five categories: informative (8-10), contextual (5-7), transitional (4-6), filler (0-3), redundant (0-2). Quality score = (informative + contextual * 0.7) / total * 100.
- **Integration:** Post-generation Step 3 in `write_full_page`.

### Agent 8: Safe Answer Generator

- **Function:** `runSafeAnswerGenerator(ai, params)`
- **File:** `src/lib/semanticPostProcessors.ts`
- **Input:** `{ keyword, business_name, industry, location?, business_context? }`
- **Output:** `SafeAnswerResult { featured_snippet_answer, word_count, paa_answers[]{question, answer, word_count}, h2_answer_pairs[]{heading, direct_answer} }`
- **Prompt strategy:** Generates a 40-60 word declarative answer using the "is-answer" pattern (Entity + verb + definition). No hedging, no first person. Also generates PAA answers (30-50 words each) and H2-answer pairs for passage-level indexing.
- **Integration:** Pre-generation Wave 2 in `write_full_page`; standalone via `generate_safe_answer` action.

### Agent 9: Lexical Relation Analyzer

- **Function:** `runLexicalRelationAnalyzer(ai, params)`
- **File:** `src/lib/semanticAgentsTier2.ts`
- **Input:** `{ keyword, industry?, agencyId? }`
- **Output:** `LexicalRelationResult { keyword, hypernyms[], hyponyms[], meronyms[], co_hyponyms[], holonyms[], related_entities[]{term, relation, must_include} }`
- **Prompt strategy:** Maps the full lexical taxonomy — hypernyms (broader), hyponyms (narrower), meronyms (parts), holonyms (wholes), co-hyponyms (siblings). Targets 5-10 terms per category. Flags must-include related entities.
- **Integration:** Pre-generation Wave 1 in `write_full_page`; standalone via `analyze_lexical_relations` action.

### Agent 10: Topic Clusterer

- **Function:** `runTopicClusterer(ai, params)`
- **File:** `src/lib/semanticAgentsTier2.ts`
- **Input:** `{ keywords[]{keyword, volume?, position?, intent?}, business_context?, agencyId? }`
- **Output:** `TopicClusterResult { clusters[]{name, pillar_keyword, pillar_type, cluster_keywords[], internal_link_strategy, publishing_order}, orphan_keywords[] }`
- **Prompt strategy:** Groups keywords by semantic meaning (not just shared words), assigns page roles (pillar/cluster/support/faq), suggests URL structures, defines internal linking strategies, and sets publishing order for topical momentum.
- **Integration:** Standalone via `cluster_topics` action; feeds into topical map generation.

### Agent 11: Title-Query Coverage Ratio Auditor

- **Function:** `runTitleQueryAuditor(ai, params)`
- **File:** `src/lib/semanticAgentsTier2.ts`
- **Input:** `{ title, target_keyword, page_type?, agencyId? }`
- **Output:** `TitleAuditResult { score, issues[]{issue, severity}, improved_titles[]{title, method, rationale}, term_weight_analysis[]{term, weight, position_optimal} }`
- **Prompt strategy:** Evaluates macro-context signal, query type match, term weight distribution (heavy/medium/light position), conditional synonymy, and entity-attribute coverage. Generates 2-3 alternatives using conjunctive, entity_attribute, and hypernym_hyponym methods.
- **Integration:** Pre-generation Wave 2 in `write_full_page`; standalone via `audit_title` action.

### Agent 12: Key-Fact Summarizer

- **Function:** `runKeyFactSummarizer(ai, params)`
- **File:** `src/lib/semanticAgentsTier2.ts`
- **Input:** `{ content, keyword, purpose: 'competitor_analysis' | 'self_audit' | 'meta_description', agencyId? }`
- **Output:** `KeyFactResult { key_facts[]{fact, importance, category}, missing_facts[], suggested_meta_description, fact_density_score, competitor_advantages? }`
- **Prompt strategy:** Extracts and ranks facts by importance (critical/important/supporting) and category (pricing, process, comparison, etc.). Scores fact density 0-100. Generates meta description from top facts. Purpose-specific analysis modes.
- **Integration:** Standalone via `summarize_key_facts` action; used in content refresh analysis.

### Agent 13: Bridge Topic Suggester

- **Function:** `runBridgeTopicSuggester(ai, params)`
- **File:** `src/lib/semanticAgentsTier2.ts`
- **Input:** `{ topic_a, topic_b, business_context?, existing_pages?, agencyId? }`
- **Output:** `BridgeTopicResult { bridge_topics[]{topic, connects, content_type, suggested_title, priority, rationale}, cluster_strengthening_effect }`
- **Prompt strategy:** Identifies semantic neighborhood connections between two topic domains. Evaluates contextual vector continuity and internal link gravity. Suggests bridge content types (blog/guide/faq/comparison) with priority ranking.
- **Integration:** Standalone via `suggest_bridge_topics` action; feeds into topical map edge creation.

### Agent 14: Comment Generator (Aspect-Based Review Analysis)

- **Function:** `runCommentGenerator(ai, params)`
- **File:** `src/lib/semanticAgentsTier3.ts`
- **Input:** `{ reviews[]{text, rating, author?}, business_name, product_or_service?, agencyId? }`
- **Output:** `CommentGeneratorResult { aspects[]{aspect, sentiment, mention_count, summary, sample_quotes[]}, overall_themes, suggested_response_topics[] }`
- **Prompt strategy:** Performs aspect-based sentiment analysis across all reviews. Identifies distinct aspects (response time, pricing, quality), classifies sentiment, counts mentions, and extracts representative quotes.
- **Integration:** Standalone via `generate_comment_analysis` action; feeds Review Intelligence tab.

### Agent 15: Sentiment Optimizer

- **Function:** `runSentimentOptimizer(ai, params)`
- **File:** `src/lib/semanticAgentsTier3.ts`
- **Input:** `{ content, target_sentiment: 'balanced' | 'positive' | 'authentic', business_context?, agencyId? }`
- **Output:** `SentimentOptimizerResult { optimized_content, sentiment_flow[]{section, sentiment, score}, authenticity_score, changes_made[] }`
- **Prompt strategy:** Ensures sentiment flows realistically (not uniformly positive). Three modes: balanced (60/25/15 positive/neutral/constructive), positive (with micro-authenticity), authentic (maximum believability). Scores authenticity 0-100.
- **Integration:** Standalone via `optimize_sentiment` action.

### Agent 16: Named Entity Inserter

- **Function:** `runEntityInserter(ai, params)`
- **File:** `src/lib/semanticAgentsTier3.ts`
- **Input:** `{ content, entities_to_insert[]{name, type, context}, keyword, agencyId? }`
- **Output:** `EntityInserterResult { enhanced_content, insertions[]{entity, location, sentence}, entities_inserted, entities_skipped[]{entity, reason} }`
- **Prompt strategy:** Prefers appositional insertion (clarifying phrases) over new sentences. Inserts near semantically related existing terms. Skips entities that cannot be naturally integrated, with documented reasons.
- **Integration:** Post-generation Step 4 in `write_full_page`; standalone via `insert_entities` action.

### Agent 17: Metadiscourse Markers Auditor

- **Function:** `runMetadiscourseAuditor(ai, params)`
- **File:** `src/lib/semanticAgentsTier3.ts`
- **Input:** `{ content, agencyId? }`
- **Output:** `MetadiscourseResult { markers_found[]{text, position, category, suggestion}, total_found, density_pct, quality_impact_score, cleaned_content }`
- **Prompt strategy:** Detects five categories: hedges ("It is important to note"), transition fillers ("In conclusion"), filler phrases ("In today's digital age"), meta commentary ("In this article we will"), and boosters ("Undoubtedly"). Quality impact = 100 - (density * 10).
- **Integration:** Post-generation Step 2 in `write_full_page`; standalone via `audit_metadiscourse` action.

### Agent 18: N-gram / Skip-gram Extractor

- **Function:** `runNgramExtractor(ai, params)`
- **File:** `src/lib/semanticAgentsTier3.ts`
- **Input:** `{ content, competitor_contents?, keyword, agencyId? }`
- **Output:** `NgramResult { bigrams[], trigrams[], skip_grams[], missing_phrases[], over_represented[], phrase_diversity_score }`
- **Prompt strategy:** Hybrid approach — programmatic extraction of bigrams/trigrams with competitor frequency comparison, then Claude analyzes skip-grams (non-adjacent co-occurring words), identifies missing phrases, flags over-represented terms, and scores phrase diversity 0-100.
- **Integration:** Standalone via `extract_ngrams` action.

### Agent 19: Triple Generator

- **Function:** `runTripleGenerator(ai, params)`
- **File:** `src/lib/semanticAgentsTier3.ts`
- **Input:** `{ content, keyword, business_name?, agencyId? }`
- **Output:** `TripleResult { triples[]{subject, predicate, object, confidence}, entity_connections[]{entity_a, relationship, entity_b}, schema_suggestions[]{triple, schema_type, property} }`
- **Prompt strategy:** Extracts entity triples (factual relationships), attribute triples (properties), and hierarchical triples (is-a, part-of). Maps entity connections. Suggests schema.org type and property for each triple. Confidence 0-1 based on explicitness.
- **Integration:** Post-generation Step 6 in `write_full_page`; standalone via `generate_triples` action.

### Agent 20: Spam Hit Detector

- **Function:** `runSpamHitDetector(ai, params)`
- **File:** `src/lib/semanticAgentsTier3.ts`
- **Input:** `{ traffic_data[]{date, clicks, impressions, position}, domain, agencyId? }`
- **Output:** `SpamHitResult { detected_events[]{date_range, type, confidence, traffic_change_pct, description}, risk_factors[], recovery_recommendations[], overall_health }`
- **Prompt strategy:** Cross-references traffic patterns (>20% week-over-week drops) against known Google update signatures: core updates (gradual 2-3 week shift), spam updates (sudden sharp drop), helpful content (slow 2-4 week decline), link spam (moderate 1-2 week drop), and product reviews (page-specific).
- **Integration:** Standalone via `detect_spam_hits` action.

### Agent 21: Quality Update Auditor

- **Function:** `runQualityUpdateAuditor(ai, params)`
- **File:** `src/lib/semanticAgentsTier3.ts`
- **Input:** `{ url, content?, keyword?, agencyId? }`
- **Output:** `QualityAuditResult { overall_score, grade, criteria[]{criterion, category, score, finding, recommendation}, critical_issues[], strengths[] }`
- **Prompt strategy:** Evaluates against 10 Google Helpful Content Update criteria across four categories: Helpfulness (written for people, leaves reader satisfied, has genuine purpose), Expertise (first-hand knowledge, written by someone knowledgeable), User-First (no false promises, no excessive automation), Content Quality (substantial value, original analysis, natural keyword usage). Fetches page content if not provided.
- **Integration:** Standalone via `audit_quality_update` action.

---

## 5. Scoring Models

### Opportunity Score (0-100)

Measures how valuable a keyword opportunity is for the client.

```
Formula:
  raw = (
    0.25 * normVolume          +   // volume / 5000, capped at 1
    0.30 * normCVR             +   // (ads_conv / ads_clicks) / 0.15, or 0.5 if <10 clicks
    0.20 * normRankGap         +   // (position - 3) / 47, 0 if top-3
    0.15 * paidWaste           +   // ads_cost / 50000 if ranking top-5 AND paying for clicks
    0.10 * normTrend               // 0.5 placeholder (historical data TBD)
  ) * intentMultiplier

Intent multipliers:
  transactional: 1.3, visit_in_place: 1.25, commercial: 1.1,
  answer_seeking: 0.9, informational: 0.8, navigational: 0.6

Output: min(raw * 100, 100) rounded to 2 decimals
```

### Rank Propensity (0-100)

Predicts how likely the client is to rank for a keyword.

```
Formula:
  raw = (
    0.25 * daGap               +   // 1 - ((competitor_avg_da - client_da) / 50), min 0
    0.20 * positionScore       +   // top-3: 1.0, top-10: 0.8, top-20: 0.5, else: 0.2
    0.15 * ctrSignal           +   // (actual_CTR / expected_CTR) / 1.5, capped at 1
    0.15 * 0.5                 +   // topical authority placeholder
    0.10 * 0.5                 +   // content quality placeholder
    0.10 * 0.5                 +   // CWV placeholder
    0.05 * 0.5                     // page age placeholder
  ) + localBoost                   // +0.15 if keyword contains "near me", "local", etc.

Output: min(raw * 100, 100) rounded to 2 decimals
```

### Quality Threshold (0-100, replaces Keyword Difficulty)

Measures how high the content quality bar is set by current ranking pages.

```
Formula:
  raw = (
    0.30 * contentQuality      +   // (comp_avg_word_count / 3000) * 0.7 + has_schema * 0.3
    0.20 * querySpecificity    +   // 1 - (query_word_count / 8), capped at 1
    0.25 * positionFactor      +   // 0.2 if top-3, 0.4 if 4-10, 0.6 if 11-20, 1.0 if not ranking
    0.25 * topicalCoverage         // 1 - (related_keywords_count / 10), capped at 1
  )

Output: raw * 100, rounded
```

### AEO Score (0-100, AI Engine Optimization)

Measures how well a page is optimized for AI Overviews and Featured Snippets.

```
Dimensions:
  FORMAT MATCH (30%):
    - First paragraph 20-60 words: +15-30%
    - Question headings (H2/H3 with ?): +15-30% (3+ = full)
    - Lists/tables present: +20%
    - Words-per-section ratio 100-300: +10-20%

  DIRECT ANSWER (25%):
    - Keyword in first 100 words: +40%
    - Keyword in H1: +20%
    - Keyword in title: +20%
    - First paragraph 30-60 words: +10-20%

  SCHEMA MARKUP (20%):
    - FAQPage schema: +35%
    - HowTo schema: +25%
    - Article/BlogPosting: +20%
    - Any schema present: +20%

  AUTHORITY SIGNALS (15%):
    - Author/Person schema: +30%
    - DA >= 50: +40%, >= 30: +25%, >= 15: +10%
    - Internal links >= 10: +30%, >= 5: +15%

  FRESHNESS (10%):
    - Modified <= 90 days: 100%, <= 180: 70%, <= 365: 40%, older: 10%

Output: sum of all dimension scores, rounded
```

### Topicality Score (0-100)

Scored by Agent 6 (Topicality Scorer) across five dimensions:

```
Dimensions (each 0-100, averaged for overall):
  1. Entity Coverage — named entities present vs expected
  2. Frame Coverage — semantic frame elements addressed
  3. Contextual Completeness — full scope of query intent covered
  4. Heading Quality — semantic richness and logical hierarchy of H2/H3s
  5. Information Gain — unique insights beyond competitor content

Grades: A (90-100), B (75-89), C (60-74), D (40-59), F (0-39)
```

### E-E-A-T Score (0-100)

Weighted composite from four signal-based audits:

```
Formula:
  overall = (
    experience_score  * 0.25 +    // first-hand experience signals found / total checked
    expertise_score   * 0.30 +    // expertise signals found / total checked
    authority_score   * 0.25 +    // authority signals found / total checked
    trust_score       * 0.20      // trust signals found / total checked
  )

Each dimension: (signals_found / signals_checked) * 100
Grades: A >= 90, B >= 75, C >= 60, D >= 40, F < 40
```

---

## 6. API Actions Reference

### Data Sync & Keywords

| Action | Required Params | Returns |
|--------|----------------|---------|
| `sync` | `client_id`, `agency_id` | `{ keywords[], synced_sources, total }` |
| `quick_scan` | `client_id`, `agency_id`, `keyword` | `{ keyword_data, serp_data }` |
| `keywords` | `client_id` | `{ keywords[] }` |
| `dashboard` | `client_id` | `{ summary, keywords[], recommendations[] }` |
| `recommendations` | `client_id` | `{ recommendations[] }` |
| `update_recommendation` | `id`, `status` | `{ updated }` |
| `sync_history` | `client_id` | `{ history[] }` |
| `enrich_volume` | `client_id` | `{ enriched_count }` |
| `deep_enrich` | `client_id`, `agency_id` | `{ enrichment_data }` |
| `get_enrichment` | `client_id` | `{ enrichment, enriched_at }` |
| `rank_history` | `client_id`, `keyword?` | `{ snapshots[] }` |
| `portfolio` | `agency_id` | `{ clients[] with keyword summaries }` |

### Content Generation

| Action | Required Params | Returns |
|--------|----------------|---------|
| `generate_brief` | `client_id`, `keyword` | `{ brief }` |
| `list_briefs` | `client_id` | `{ briefs[] }` |
| `get_brief` | `brief_id` | `{ brief }` |
| `update_brief` | `brief_id`, `updates` | `{ updated }` |
| `write_full_page` | `brief_id` | `{ title, meta, h1, content_html, plain_text, topicality_score, ... }` |
| `generate_schema` | `client_id`, `brief_id?` | `{ schemas[], html, schema_count }` |
| `export_report` | `client_id` | `{ report_data }` |

### Semantic Agents (Standalone)

| Action | Required Params | Returns |
|--------|----------------|---------|
| `run_semantic_agents` | `keyword`, `industry`, `business_name` | `{ query_gap, frame_analysis, entities }` |
| `run_content_polish` | `content`, `keyword` | `{ cleaned, removed_count, density_improvement }` |
| `run_semantic_role_optimization` | `keyword`, `sentences[]`, `primary_entity` | `{ optimized_sentences[], predicate_suggestions[] }` |
| `generate_safe_answer` | `keyword`, `business_name`, `industry` | `{ featured_snippet_answer, paa_answers[], h2_answer_pairs[] }` |
| `analyze_lexical_relations` | `keyword` | `{ hypernyms[], hyponyms[], meronyms[], ... }` |
| `cluster_topics` | `keywords[]` | `{ clusters[], orphan_keywords[] }` |
| `audit_title` | `title`, `target_keyword` | `{ score, issues[], improved_titles[] }` |
| `summarize_key_facts` | `content`, `keyword`, `purpose` | `{ key_facts[], missing_facts[], fact_density_score }` |
| `suggest_bridge_topics` | `topic_a`, `topic_b` | `{ bridge_topics[] }` |
| `generate_comment_analysis` | `reviews[]`, `business_name` | `{ aspects[], overall_themes }` |
| `optimize_sentiment` | `content`, `target_sentiment` | `{ optimized_content, authenticity_score }` |
| `insert_entities` | `content`, `entities_to_insert[]`, `keyword` | `{ enhanced_content, entities_inserted }` |
| `audit_metadiscourse` | `content` | `{ markers_found[], cleaned_content }` |
| `extract_ngrams` | `content`, `keyword` | `{ bigrams[], trigrams[], skip_grams[] }` |
| `generate_triples` | `content`, `keyword` | `{ triples[], schema_suggestions[] }` |
| `detect_spam_hits` | `traffic_data[]`, `domain` | `{ detected_events[], overall_health }` |
| `audit_quality_update` | `url` | `{ overall_score, grade, criteria[] }` |

### SEO Intelligence Tabs

| Action | Required Params | Returns |
|--------|----------------|---------|
| `gmb_health` | `client_id` | `{ gbp_data, completeness_score }` |
| `draft_review_response` | `client_id`, `review` | `{ response }` |
| `batch_review_responses` | `client_id` | `{ responses[] }` |
| `generate_gbp_posts` | `client_id` | `{ posts[] }` |
| `analyze_competitors` | `client_id`, `domain` | `{ competitors[] }` |
| `roi_projections` | `client_id` | `{ projections }` |
| `aeo_deep_analysis` | `client_id`, `keyword` | `{ aeo_score, analysis, recommendations }` |
| `scan_brand_serp` | `client_id`, `brand_query` | `{ results, owned_pct }` |
| `get_brand_serp` | `client_id` | `{ brand_serp_data }` |
| `brand_defense_strategy` | `client_id` | `{ strategy }` |
| `analyze_backlinks` | `client_id`, `domain` | `{ profile }` |
| `get_backlink_profile` | `client_id` | `{ profile_data }` |
| `scan_internal_links` | `client_id`, `domain` | `{ link_graph }` |
| `get_link_audit` | `client_id` | `{ audit_data }` |
| `get_link_suggestions` | `client_id`, `url` | `{ suggestions[] }` |
| `audit_eeat` | `client_id`, `url` | `{ eeat_scores }` |
| `get_eeat_audit` | `client_id` | `{ audit_data }` |
| `audit_schema` | `client_id`, `url` | `{ schemas, score }` |
| `get_schema_audit` | `client_id` | `{ audit_data }` |
| `generate_schema_for_url` | `url`, `client_id` | `{ schema_json }` |
| `generate_topical_map` | `client_id`, `keywords[]` | `{ map }` |
| `get_topical_map` | `client_id` | `{ map, nodes[], edges[] }` |
| `update_topical_node` | `node_id`, `updates` | `{ updated }` |
| `analyze_topical_coverage` | `client_id` | `{ coverage_analysis }` |
| `build_content_inventory` | `client_id` | `{ inventory }` |
| `get_content_inventory` | `client_id` | `{ pages[] }` |
| `get_refresh_plan` | `client_id` | `{ plan[] }` |
| `analyze_semantic_network` | `client_id` | `{ network }` |
| `get_semantic_analysis` | `client_id` | `{ analysis }` |
| `audit_technical_deep` | `client_id`, `url` | `{ technical_data }` |
| `get_technical_deep` | `client_id` | `{ audit_data }` |
| `analyze_query_paths` | `client_id` | `{ query_paths }` |
| `get_query_clusters` | `client_id` | `{ clusters }` |
| `analyze_reviews` | `client_id` | `{ review_intel }` |
| `get_review_intelligence` | `client_id` | `{ intelligence }` |
| `create_review_campaign` | `client_id`, `name` | `{ campaign }` |
| `get_review_campaigns` | `client_id` | `{ campaigns[] }` |
| `build_content_calendar` | `client_id` | `{ calendar }` |
| `get_content_calendar` | `client_id` | `{ items[] }` |
| `update_calendar_item` | `item_id`, `updates` | `{ updated }` |
| `calculate_momentum` | `client_id` | `{ momentum_score }` |
| `get_momentum` | `client_id` | `{ momentum_data }` |

### Client Management

| Action | Required Params | Returns |
|--------|----------------|---------|
| `create_client` | `name`, `agency_id` | `{ client }` |
| `update_client` | `client_id`, `updates` | `{ updated }` |

---

## 7. Data Flow Diagram

```
                          EXTERNAL DATA SOURCES
  ┌──────────────┬──────────────┬──────────────┬──────────────┐
  │  Google SC   │  Google GA4  │  Google Ads  │ Google GBP   │
  │  (rankings,  │  (traffic,   │  (keywords,  │ (reviews,    │
  │   clicks,    │   sessions)  │   CPC, CVR)  │  categories) │
  │   CTR)       │              │              │              │
  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┘
         │              │              │              │
         └──────────────┴──────┬───────┴──────────────┘
                               │
                        ┌──────▼──────┐     ┌──────────────┐
                        │    SYNC     │◄────│  DataForSEO  │
                        │  (action)   │     │  (SERP, DA,  │
                        │             │◄────│  competitors)│
                        └──────┬──────┘     └──────────────┘
                               │                    │
                               │            ┌───────▼──────┐
                               │            │   Moz API    │
                               │            │   (DA, PA)   │
                               │            └───────┬──────┘
                               │                    │
                        ┌──────▼────────────────────▼──────┐
                        │                                   │
                        │   UNIFIED KEYWORD FILE (UKF)      │
                        │   kotoiq_keywords table            │
                        │                                   │
                        │   Per keyword:                    │
                        │   SC data + GA4 + Ads + KP +      │
                        │   Moz + DataForSEO + intent       │
                        │                                   │
                        └──────────────┬───────────────────┘
                                       │
                        ┌──────────────▼───────────────────┐
                        │         SCORING ENGINE            │
                        │                                   │
                        │  ┌─────────────┐ ┌─────────────┐ │
                        │  │ Opportunity │ │    Rank      │ │
                        │  │   Score     │ │ Propensity   │ │
                        │  └─────────────┘ └─────────────┘ │
                        │  ┌─────────────┐ ┌─────────────┐ │
                        │  │  Quality    │ │    AEO       │ │
                        │  │ Threshold   │ │   Score      │ │
                        │  └─────────────┘ └─────────────┘ │
                        │  ┌─────────────┐                 │
                        │  │  Category   │                 │
                        │  │ Classifier  │                 │
                        │  └─────────────┘                 │
                        └──────────────┬───────────────────┘
                                       │
                        ┌──────────────▼───────────────────┐
                        │      AI ANALYSIS LAYER            │
                        │                                   │
                        │  Claude Sonnet (21 Agents)        │
                        │                                   │
                        │  ┌─────────────────────────────┐ │
                        │  │ PRE-GEN: Query Gap, Frame,  │ │
                        │  │ Entities, Lexical, Answer,  │ │
                        │  │ Title Audit                 │ │
                        │  └─────────────┬───────────────┘ │
                        │                │                  │
                        │  ┌─────────────▼───────────────┐ │
                        │  │ GENERATION: Claude 8K       │ │
                        │  │ (intelligence-injected)     │ │
                        │  └─────────────┬───────────────┘ │
                        │                │                  │
                        │  ┌─────────────▼───────────────┐ │
                        │  │ POST-GEN: Clean, Audit,     │ │
                        │  │ Filter, Insert, Score,      │ │
                        │  │ Extract Triples             │ │
                        │  └─────────────────────────────┘ │
                        └──────────────┬───────────────────┘
                                       │
                        ┌──────────────▼───────────────────┐
                        │           OUTPUT                  │
                        │                                   │
                        │  ┌───────────┐ ┌───────────────┐ │
                        │  │  Content  │ │  Topicality   │ │
                        │  │  HTML +   │ │  Score +      │ │
                        │  │  Text     │ │  Grade        │ │
                        │  └───────────┘ └───────────────┘ │
                        │  ┌───────────┐ ┌───────────────┐ │
                        │  │  Schema   │ │  Agent        │ │
                        │  │  Triples  │ │  Metadata     │ │
                        │  └───────────┘ └───────────────┘ │
                        └──────────────────────────────────┘
```

---

For more on the semantic SEO methodology powering these agents, see the [SemanticsX framework documentation](https://www.semanticsx.com/semantic-seo/ai-agents).
