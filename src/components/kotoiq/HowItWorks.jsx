"use client"
import { useState } from 'react'
import { Info, ChevronDown, ChevronUp, BookOpen, Code } from 'lucide-react'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────
// HowItWorks — reusable expandable "How this tool works"
// Shows two explanations per tool: layman's + technical
// Drop this into any tab to explain how the analysis is done
// ─────────────────────────────────────────────────────────────

const EXPLANATIONS = {
  topical_map: {
    layman: `KotoIQ reads your website and your competitor sites, then builds a map of every topic you should cover to be seen as an authority in your industry. Think of it like a mind map — your central topic in the middle, with every related concept, product, location, and question branching out from it. We check which of those topics you already cover and which are gaps competitors are winning.`,
    technical: `Fetches client website + sitemap (up to 200 URLs). Passes the content to Claude with a semantic SEO framework prompt that identifies: central entity, source context, central search intent, core section nodes (entity + monetization), and outer section nodes (broader topical authority). Cross-references each node against existing kotoiq_keywords and crawled URLs to assign status (gap/partial/covered). Calculates topical_coverage_score, vastness_score, depth_score, and momentum_score. Stores nodes in kotoiq_topical_nodes with entity-attribute pairs, contextual bridges, and suggested content types.`,
    data_sources: ['Client website HTML', 'XML sitemaps', 'kotoiq_keywords (existing ranking data)', 'Competitor domains', 'Claude Sonnet 4 (semantic analysis)'],
    output_layman: `**Coverage Score (0-100):** Higher = you're closer to being a complete topical authority. 70+ is strong. Below 40 means big gaps.\n\n**Green nodes:** You already have content here — defend & refresh.\n\n**Amber nodes:** Partial coverage — expand these pages.\n\n**Red nodes:** Missing entirely — these are your content priorities.\n\n**Central Entity:** The single concept everything on your site should connect back to.\n\n**Next Action:** Click any red node → "Generate Brief" to auto-create the content plan for that topic.`,
    output_technical: `**topical_coverage_score:** covered_nodes / total_nodes × 100\n**vastness_score:** breadth of topics covered (nodes across distinct categories)\n**depth_score:** avg entity-attribute pairs per covered node\n**momentum_score:** publishing velocity (pages added last 30d)\n**Node status:** gap (no content) | partial (thin coverage) | covered (sufficient)\n**Contextual bridges:** pre-computed internal link suggestions between nodes with anchor text and weight 0-1.`,
  },
  topical_authority: {
    layman: `We give you one score — 0 to 100 — that answers: "Are we an authority on this topic?" It combines how many topics you cover, how well your existing pages are performing over time, how deep your content goes, and where you stand versus competitors. You get a grade A through F per topic cluster.`,
    technical: `Aggregates data from kotoiq_topical_nodes (coverage % per cluster), kotoiq_keywords (position distribution top3/top10/beyond), kotoiq_snapshots (30d/90d trajectory — improving/declining/stable ratio), kotoiq_backlink_profile (domain authority), kotoiq_content_inventory (avg word count per cluster). Sends aggregated metrics to Claude with a weighted scoring prompt: coverage × 0.30 + historical × 0.25 + depth × 0.20 + competitive × 0.25. Returns per-cluster scores with grades and specific strengths/gaps.`,
    data_sources: ['kotoiq_topical_maps + nodes', 'kotoiq_keywords', 'kotoiq_snapshots (90d history)', 'Moz Domain Authority', 'Claude Sonnet 4'],
  },
  briefs: {
    layman: `We don't just write content — we engineer it to rank #1. Before writing, 6 AI agents run in parallel: one finds gaps competitors missed, one maps the concepts Google expects, one identifies authority-signaling brands and terms, one crafts a featured-snippet-ready opening, one validates the title tag, and one aligns sentence structure. Then Claude writes with all that intelligence baked in. After writing, 6 more agents polish the output — strip filler, remove AI-sounding phrases, score topicality, extract knowledge graph data for schema.`,
    technical: `Pre-generation (parallel): runQueryGapAnalyzer(), runFrameAnalyzer(), runNamedEntitySuggester(), runLexicalRelationAnalyzer(), runSafeAnswerGenerator(), runTitleQueryAuditor(). Results injected as context into a Claude Sonnet 4 prompt (8000 max_tokens) that produces structured output with macro/micro content sections, contextual borders, entity-attribute pairs, and title alternatives. Post-generation (sequential): runContextlessWordRemover() → runMetadiscourseAuditor() → runSentenceFilterer() → runEntityInserter() (backfills missing must-include entities) → runTopicalityScorer() (with entity + frame coverage check) → runTripleGenerator() (for schema @graph markup).`,
    data_sources: ['clients table (business context)', 'kotoiq_keywords (target keyword metrics)', 'kotoiq_content_briefs (saved brief)', '12 semantic agents (Claude Sonnet 4)', 'Competitor top-3 page analysis'],
  },
  keywords: {
    layman: `Every keyword you could target — from Google Ads, Search Console, Analytics, and Keyword Planner — merged into one unified view. We score each one on three things: how big the opportunity is, how realistic it is for you to rank, and whether it's likely to win the featured snippet or AI Overview. You see which keywords to invest in, which to defend, and which to ignore.`,
    technical: `Unified Keyword Framework (UKF) merges data from Google Ads API (keywords, CPC, conversions, QS), Search Console API (position, CTR, clicks, impressions), GA4 API (sessions, conversions by landing page), Keyword Planner (search volume, competition), and Moz (DA gap). Computes three scores per keyword: Opportunity (volume 0.25 + CVR 0.30 + rank_gap 0.20 + paid_waste 0.15 + trend 0.10 × intent multiplier), Rank Propensity (DA gap + topical authority + content quality + CTR signal + position + local boost), and AEO Score (format 0.30 + direct_answer 0.25 + schema 0.20 + authority 0.15 + freshness 0.10). Categorizes into: organic_cannibal, striking_distance, quick_win, dark_matter, paid_only, defend, underperformer, monitor.`,
    data_sources: ['Google Ads API', 'Google Search Console API', 'GA4 API', 'Keyword Planner', 'Moz API v2', 'Historical snapshots (kotoiq_snapshots)'],
  },
  ranks: {
    layman: `We track where you rank in Google for every important keyword, every day. You see if you're moving up or down over time. We also track "striking distance" keywords — ones in position 4-15 where a small push gets you to the top of page 1.`,
    technical: `Uses DataForSEO SERP API (or Search Console as fallback) to track daily keyword positions. Stored in kotoiq_snapshots with date, position, clicks, impressions, CTR. Rank history tab queries last 90 days, computes position deltas, and groups movements into improved/declined/top3/top10 buckets. Local rank tracker handles geo-specific SERPs by passing coordinates to DataForSEO.`,
    data_sources: ['DataForSEO SERP API', 'Google Search Console', 'kotoiq_snapshots (daily history)'],
  },
  competitors: {
    layman: `We reverse-engineer what your competitors are doing right. We pull their top ranking keywords, find the ones they rank for that you don't, and show you which pages of theirs are driving their traffic. We also analyze their topical maps so you can see exactly what's on their site.`,
    technical: `Uses DataForSEO getDomainCompetitors and getDomainRankedKeywords endpoints. For each competitor, fetches top 500 ranking keywords, compares against client's ranked keywords (set intersection) to identify gaps. Pulls competitor sitemaps and extracts URLs (up to 200). Can run runCompetitorTopicalMapExtractor to infer their content strategy. Stores in kotoiq_keywords.competitor_domains for cross-referencing.`,
    data_sources: ['DataForSEO (ranked keywords, competitors)', 'Competitor sitemaps', 'Moz backlink data', 'Claude Sonnet 4 (topical map inference)'],
  },
  gmb: {
    layman: `Everything about your Google Business Profile in one place — your health score, what's missing, reviews that need responses, post ideas, and a heat map showing where you rank locally around your neighborhood.`,
    technical: `Pulls data from GBP API (pullFullGBPData): business info, categories, hours, photos, reviews, Q&A, posts, insights (views, searches, actions). Computes gmb_health_score weighted across completeness (categories, hours, photos, description, website), review volume + velocity + rating, response rate, Q&A activity, and post frequency. Review response AI uses Claude to draft on-brand replies. Post generator uses business context to produce GBP-optimized captions. Grid scans run at 25/49 geographic points via DataForSEO.`,
    data_sources: ['Google Business Profile API', 'DataForSEO Grid Scan', 'Claude Sonnet 4 (drafting)'],
  },
  gmb_images: {
    layman: `Upload or AI-generate an image for your Google Business Profile. We automatically stamp it with your business location (GPS coordinates, address, city), set a realistic date and camera, and add an SEO-optimized caption. Google weighs geo-tagged images more heavily for local search, so this gives every photo a local-relevance boost.`,
    technical: `Uses piexifjs to write EXIF metadata (GPS IFD: GPSLatitude/Longitude in DMS format, GPSDateStamp, GPSMapDatum=WGS-84; Zero-th IFD: Make, Model, Software="KotoIQ Geo-Tagger", Artist, Copyright). Coordinates resolved via Google Geocoding API from client address. For generation: uses OpenAI gpt-image-1 (1024×1024) with a Claude-enhanced prompt (adds location details, no people's faces, style hints). PNG→JPEG conversion happens client-side via Canvas before EXIF injection. Upload to GBP Media API via /accounts/{id}/locations/{id}/media with category (PROFILE/COVER/ADDITIONAL/LOGO).`,
    data_sources: ['OpenAI gpt-image-1', 'Google Geocoding API', 'Client GBP data (address, coords)', 'piexifjs (EXIF writer)', 'Supabase Storage + GBP Media API'],
  },
  aeo_multi: {
    layman: `It's not just Google anymore. We score your content for ranking across 5 AI search engines at once: Google AI Overview, Perplexity, ChatGPT Search, Claude, and Copilot. Each one values different things — Perplexity loves citations, ChatGPT wants structured data, Google likes schema. You see which engine you're best positioned for and exactly what to fix for the others.`,
    technical: `runMultiEngineAEO analyzes content against 5 engines' known ranking patterns. For each: format_match (direct answer, Q&A structure, lists), citation_likelihood (external sources cited, authoritative quotes), structural factors (schema markup, semantic HTML, passage eligibility), freshness, authority signals. Scores 0-100 per engine with eligibility tier (high/medium/low). Overall AEO score is weighted avg. Returns best_positioned_for array and prioritized recommendations.`,
    data_sources: ['Content text', 'Schema presence detection', 'Citation extraction', 'Claude Sonnet 4 (engine pattern analysis)'],
  },
  content_decay: {
    layman: `Not all content ages well. We look at your existing pages, their ranking history, and how stale they are, then predict which ones are about to lose rankings in 30, 60, and 90 days. You get a refresh queue ordered by urgency — fix the ones about to die first.`,
    technical: `runContentDecayPredictor takes URL, current position, 30/90/180-day historical positions from kotoiq_snapshots, last_updated age, word count, and competitor freshness average. Decay risk classified into low/medium/high/critical based on: trajectory slope, age gap vs competitor freshness, word count below threshold, SERP feature loss patterns. Predicts position at +30d/+60d/+90d and estimated click loss. Returns recommended_refresh_date and priority 1-5.`,
    data_sources: ['kotoiq_content_inventory', 'kotoiq_snapshots (historical positions)', 'kotoiq_keywords', 'Claude Sonnet 4 (decay pattern analysis)'],
  },
  semantic: {
    layman: `We analyze every page on your site to check if the language you use actually matches what Google expects for your topic. We look at word patterns (n-grams), how much is main content vs supporting content, and whether your headings flow logically. Pages that drift off-topic or use weak vocabulary get flagged.`,
    technical: `analyzeSemanticNetwork crawls up to 50 sitemap URLs, extracts headings, paragraphs, anchor texts. Computes site-wide 2-grams and 3-grams, top nouns/predicates/adjectives. Claude analyzes each page for macro_context vs micro_contexts, main vs supplementary content ratio (target ~70/30), contextual flow score, contextual consistency. Detects thin_content_pages (<300 words), context_dilution_pages (4+ unrelated topics), orphan_contexts (mentioned but unlinked).`,
    data_sources: ['Full sitemap crawl', 'HTML content extraction', 'Claude Sonnet 4 (semantic analysis)'],
  },
  internal_links: {
    layman: `We map every internal link on your site. We find: pages with zero internal links pointing to them (invisible to Google), pages with too many links (diluting signal), duplicate anchor text pointing to different URLs (confusing), and pages with high traffic that should be linked from your homepage. All fixable, big impact.`,
    technical: `scanInternalLinks fetches sitemap URLs (batch 10 parallel), extracts all internal <a> tags via regex, classifies anchor_type (exact/partial/branded/naked_url/generic/image) and position (header/nav/content/sidebar/footer). Flags: is_first_link (only first link passes PageRank). Audit computes: equity_concentration (Gini coefficient), orphan_pages (0 inbound links), over_linked_pages (>150 outbound), duplicate_anchor_issues (same anchor → different URLs), starved_pages (high SC impressions + <3 inbound). Cross-refs kotoiq_keywords for traffic weighting.`,
    data_sources: ['Full sitemap crawl', 'Page HTML (all internal anchors)', 'kotoiq_keywords (SC impression data)'],
  },
  brand_serp: {
    layman: `When someone Googles your business name, what do they see? We check every element: Knowledge Panel, site links, People Also Ask questions, reviews, local pack, negative results. If someone asks "Is [your business] a scam?" we flag it so you can fix it.`,
    technical: `scanBrandSERP fetches SERP via DataForSEO for brand query. Detects 11 feature flags (knowledge_panel, site_links, paa, reviews, local_pack, images, videos, news, social, jobs, ai_overview). Counts owned_results (organic positions from client domain). Claude analyzes PAA question sentiment (trust/neutral/negative) and flags negative results. brand_serp_score weighted: owned_results × 0.30 + kp_present × 0.20 + no_negative_results × 0.20 + feature_richness × 0.15 + paa_sentiment × 0.15.`,
    data_sources: ['DataForSEO SERP API', 'Brand name query', 'Claude Sonnet 4 (sentiment analysis)'],
  },
  backlinks: {
    layman: `We analyze every website linking to you — how trustworthy each one is, what anchor text they use, and whether any are toxic (spam sites that hurt you). We compare your link profile to your top competitors to see who has more and better links.`,
    technical: `Uses Moz API v2 /url_metrics (DA, spam_score, referring_domains, total_backlinks) and /links (500 backlinks with source DA, anchor text, spam score). Builds dr_distribution bins (0-10 through 90-100), anchor_distribution by type, toxic_links (spam_score > 7), high_quality_links (DA > 50), edu_gov_links counter. Estimates TrustRank from high-DA + edu/gov ratio. Competitor comparison calls Moz for each competitor domain.`,
    data_sources: ['Moz API v2 (url_metrics, links)', 'Competitor domains from kotoiq_keywords'],
  },
  backlink_opps: {
    layman: `Where can you get new backlinks? We find: sites linking to multiple competitors but not you (easy wins), mentions of your business name that aren't linked (just ask them to link), broken links on industry sites (offer a replacement), directories you're missing, resource pages, and guest post angles. Each comes with a ready-to-send outreach email.`,
    technical: `scanAndGenerateBacklinks aggregates competitor_domains from kotoiq_keywords, calls Moz /links for top 5 competitors (500 each), excludes client's existing referrers. Identifies: competitor_common (linking to 3+ competitors), unlinked_mention (DataForSEO SERP "brand name" -site:client.com), directory (SERP "{industry} directory submit"), resource_page (SERP inurl:resources), guest_post (Claude-generated angles). Enriches DA via Moz batch /url_metrics. Claude generates individualized outreach templates. Ranks by DA × 0.45 + relevance × 0.35 + ease × 0.20.`,
    data_sources: ['Moz backlink data (client + 5 competitors)', 'DataForSEO SERP queries', 'kotoiq_keywords (competitor_domains)', 'Claude Sonnet 4 (outreach email generation)'],
  },
  eeat: {
    layman: `E-E-A-T stands for Experience, Expertise, Authority, Trust — Google's criteria for evaluating content. We check if your pages show real expertise (credentials, author bios), trust signals (HTTPS, contact info, privacy policy), experience markers (case studies, original data), and authority (backlinks, citations). Each gets a score, you get a letter grade A-F.`,
    technical: `auditEEAT fetches target URL, runs rule-based checks for Trust (HTTPS, privacy policy, contact info, physical address, reviews). Sends content to Claude for Experience analysis (first-person language, case studies, original images), Expertise (author bios, credentials, technical vocabulary), Authority (external citations, awards, memberships). Weighted overall: Experience 0.25 + Expertise 0.30 + Authority 0.25 + Trust 0.20. Grades: A≥85, B≥70, C≥55, D≥40, F<40. Checks for author_has_knowledge_panel via Google Knowledge Graph API.`,
    data_sources: ['Target page HTML', 'Moz Domain Authority', 'Claude Sonnet 4 (signal analysis)', 'Google Knowledge Graph API (author entity check)'],
  },
  schema: {
    layman: `Schema markup is structured code that tells Google exactly what your page is about. We scan your whole site, see which pages have it, flag errors, and auto-generate the right schema for pages that are missing it (FAQ, service, product, how-to, local business). You get copy-paste JSON-LD for each page.`,
    technical: `auditSchema fetches sitemap (up to 100 URLs), batch 10 parallel. Extracts JSON-LD via regex from <script type="application/ld+json">, parses, detects @type field. Validates against schema.org requirements. Analyzes page content to detect eligible-but-missing types (FAQ pages without FAQPage, service pages without Service, etc.). Claude auto-generates JSON-LD for top 10 opportunities. Checks semantic HTML (proper main/article/aside/nav/section usage).`,
    data_sources: ['Full sitemap crawl', 'JSON-LD extraction + validation', 'Claude Sonnet 4 (schema generation)', 'Competitor schema comparison'],
  },
  on_page: {
    layman: `Everything that makes a page rank, checked in one scan: title tag, meta description, H1, heading structure, keyword placement, image alt text, internal links, load speed, mobile optimization, schema, social tags, URL structure. 17 checks total. You get pass/warning/fail badges and a prioritized fix list.`,
    technical: `analyzeOnPage fetches URL, runs 17 checks: title length 30-60 + keyword + position, meta desc 120-160 + CTA, single H1, heading hierarchy H1→H2→H3, word count >1000, keyword density 0.5-2.5%, Flesch readability score, image alt coverage, internal links 3-10, URL length + keyword, schema present, load time < 3s, viewport meta, OG + Twitter Cards, canonical, keyword placement map (title/H1/first100/meta/URL/alt). Overall 0-100 score. Claude generates prioritized critical_fixes and quick_wins.`,
    data_sources: ['Target page HTML + headers', 'Schema.org validation', 'Claude Sonnet 4 (fix prioritization)'],
  },
  technical_deep: {
    layman: `The technical foundation of your SEO — crawl budget, canonical tags, mobile setup, sitemap health, Core Web Vitals, index coverage. Google can only rank pages it can crawl. This tells you if you're wasting crawl budget, blocking bots, or have critical speed issues.`,
    technical: `auditTechnicalDeep: Phase 1 sitemap (fetches /sitemap.xml and /sitemap_index.xml, counts URLs, checks categorization). Phase 2 crawl (samples 50 URLs, records status codes, canonical tags, viewport meta, noindex, response time). Phase 3 CWV (PageSpeed Insights API for homepage — LCP/FID/CLS). Phase 4 scoring: crawl_waste_pct, url_value_ratio, canonical_score (100 - issue_pct), mobile_score, indexed_pct, cwv_grade.`,
    data_sources: ['Sitemap XML', 'Page crawl (50 sample URLs)', 'PageSpeed Insights API', 'Google API key'],
  },
  gsc_audit: {
    layman: `We connect to your Google Search Console and do a deep 90-day analysis: pages with impressions but missing from the index, queries where your click-through rate is abnormally low (leaving clicks on the table), keywords losing impressions over time, and pages cannibalizing each other's rankings.`,
    technical: `runGSCAudit pulls 90d SC data via fetchSearchConsoleData (by query, by page, by query+page). Compares to prior 90d window for trend delta. Detects: CTR anomalies (pos 3-10, <60% of expected CTR curve), striking_distance (pos 11-20, >50 impressions), impression_decay (≥20% drop vs prior window), cannibalization (2+ URLs ranking for same query with ≥100 combined impressions), indexing_issues (high impressions + zero clicks, deep rank >50). overall_health_score weighted: CTR + avg_position + growth + penalty_count.`,
    data_sources: ['Google Search Console API (90d window)', 'URL Inspection API', 'Claude Sonnet 4 (prioritized recommendations)'],
  },
  bing_audit: {
    layman: `Google isn't the only search engine. Bing powers ChatGPT Search and has 100M+ US users. This pulls your Bing Webmaster data, shows queries where Bing ranks you differently than Google, and finds Bing-specific opportunities you're missing.`,
    technical: `runBingAudit calls Bing Webmaster API: GetQueryStats (top queries with impressions/clicks), GetRankAndTrafficStats (rank distribution), GetCrawlStats (crawl health). Handles 401/403 gracefully for unverified sites. Cross-references Google SC data per query → flags bing_outranks_google and google_outranks_bing discrepancies. Detects Bing-specific striking distance and CTR anomalies using Bing's different CTR curves.`,
    data_sources: ['Bing Webmaster Tools API', 'Google Search Console (for comparison)', 'Claude Sonnet 4'],
  },
  query_paths: {
    layman: `Users don't search just one keyword — they search a sequence. They might start with "best plumber" then refine to "emergency plumber near me" then "24 hour plumber Boca Raton". We group your keywords into these journeys so you can create content that covers the whole search path, not just a single term.`,
    technical: `analyzeQueryPaths clusters keywords into topical/intent/sequential/correlative groups based on: topical similarity (same entity), intent correlation (transactional + commercial nearby), sequential paths (broad→specific query refinement), represented/representative relationships (seed → variations). Claude identifies the seed_query per cluster, members with relationship type, likely common_next_queries and common_prev_queries. Cross-references sc_top_page to mark covered/gap queries.`,
    data_sources: ['kotoiq_keywords (all client keywords)', 'kotoiq_snapshots (query trajectory)', 'Claude Sonnet 4 (cluster identification)'],
  },
  rank_grid: {
    layman: `Google shows different local results depending on where you physically are. This creates a grid of 25 or 49 points around your business and checks where you rank at each point. You see a color-coded heat map — green where you dominate, red where you're invisible. Dead zones become opportunities for hyperlocal landing pages.`,
    technical: `runRankGridPro wraps DataForSEO grid scan at 5×5 or 7×7 points centered on business coordinates with configurable radius. PRO features: identifies top 3 competitors at each point (not just client rank), Share of Local Voice (% of top 3 positions across all points), 5-color heatmap (1-3 green, 4-10 yellow, 11-20 orange, 21-50 red, >50 black), dead_zones (points where rank > 20), drift vs last scan (compare positions per point), top competitors with dominant zones. Saves history to kotoiq_grid_scans_pro.`,
    data_sources: ['DataForSEO Google Local SERP API', 'Business GPS coordinates', 'Grid of 25-49 geo points'],
  },
  reviews: {
    layman: `We pull all your Google reviews, analyze what customers praise and complain about, group complaints by topic (parking, pricing, staff, wait times), track whether you're responding fast enough, and draft on-brand responses to every review that needs one. We also track review velocity — are you getting more or fewer reviews over time?`,
    technical: `analyzeReviews pulls GBP reviews via pullFullGBPData. Calculates total_reviews, avg_rating, rating_distribution, review_velocity (last 3 months), velocity_trend. Claude analyzes sentiment by topic — groups praise/complaints into categories (service, pricing, staff, timeliness, communication). response_rate = reviews_with_responses / total. Flags unresponded reviews rating ≤ 3. overall_score weighted: avg_rating + velocity + response_rate + sentiment_positive_pct.`,
    data_sources: ['Google Business Profile API', 'Review text, ratings, dates', 'Claude Sonnet 4 (sentiment + topic clustering)'],
  },
  calendar: {
    layman: `A publishing schedule built from your SEO strategy. We pull high-priority gap topics, declining content that needs refresh, and seasonal opportunities, then lay them out across weeks. You see exactly what to publish when — and we track your publishing velocity versus competitors (Vastness × Depth × Momentum).`,
    technical: `buildContentCalendar pulls gap/partial nodes from kotoiq_topical_nodes, declining pages from kotoiq_content_inventory, and gap_queries from kotoiq_query_clusters. Prioritization: P1 high-volume gap core nodes, P2 declining needing refresh, P3 outer section gaps, P4 query cluster gaps. Spreads across weeks respecting momentum targets. calculateMomentum computes Vastness (unique topics covered / topical map size), Depth (avg word count), Momentum (pages per month), VDM overall = weighted avg. Compares to estimated competitor velocity.`,
    data_sources: ['kotoiq_topical_nodes', 'kotoiq_content_inventory', 'kotoiq_query_clusters', 'Competitor sitemap sizes', 'Claude Sonnet 4 (priority scheduling)'],
  },
  plagiarism: {
    layman: `Paste any content, we check if it's original or copied. We search the web for exact phrases to find duplicates, and we analyze writing patterns to detect if it was AI-generated (and how obviously). You get an originality score and an AI-detection score.`,
    technical: `checkPlagiarism splits content into 7-sentence chunks, extracts 9-word signature phrases, quoted SERP lookups via DataForSEO for each phrase. Flags chunks where phrases match external URLs. Claude runs AI-detection pass analyzing: perplexity consistency, GPT phrase patterns ("In today's fast-paced world"), em-dash overuse, generic sentence openers, lack of human quirks. Returns overall_originality_score and ai_generation_likelihood 0-100.`,
    data_sources: ['DataForSEO SERP API (phrase matching)', 'Content tokenization', 'Claude Sonnet 4 (AI pattern detection)'],
  },
  watermark: {
    layman: `OpenAI embeds invisible watermarks in ChatGPT output (zero-width Unicode characters). Plus, every AI model has tells — overused phrases like "In today's fast-paced world", too many em-dashes, perfect parallel structure. We detect both and rewrite flagged passages so your content reads human.`,
    technical: `removeAIWatermarks strips zero-width Unicode (\\u200b, \\u200c, \\u200d, \\u2060, \\ufeff). Detects 16+ overused ChatGPT phrases, em-dash overuse, "not X, but Y" patterns, excessive transition words (Moreover, Furthermore), triple-clause sentences, generic openers. Claude rewrites flagged sentences in natural voice. Returns human_score_before/after (calculated from pattern frequency + readability), cleaned_content, rewrite_diff showing each change.`,
    data_sources: ['Content text', 'Unicode scanner', 'Claude Sonnet 4 (humanization rewrite)'],
  },
  upwork: {
    layman: `Paste an Upwork job description, we tell you if it's worth bidding on. We identify red flags (too low budget, scope creep risk), green flags (specific requirements, realistic budget), must-haves, hidden requirements, and write you a custom cover letter that directly addresses the buyer's needs.`,
    technical: `analyzeUpworkJob sends job description to Claude with structured analysis prompt. Extracts: must_haves (explicit requirements), nice_to_haves, red_flags (low budget / vague scope / scope creep signals), green_flags (specific deliverables / reasonable budget), hidden_requirements (implied skills), actual_need (reading between the lines), difficulty_score, win_probability. Generates: cover letter, 3-5 clarifying questions, project estimate (hours + fixed price), pricing strategy.`,
    data_sources: ['Job description text', 'Claude Sonnet 4 (job analysis + proposal generation)'],
  },
  passage_opt: {
    layman: `Google pulls answers for featured snippets paragraph by paragraph. We score every paragraph on your page — is it self-contained? Does it directly answer a question? Is it 40-60 words? Then we optimize each one so any paragraph could become the snippet.`,
    technical: `runPassageRankingOptimizer splits content into paragraphs. Per paragraph: current_snippet_score (40-60 word length check, self-containment, direct answer detection, question-format match). Claude rewrites each paragraph into optimized snippet-ready form. Identifies best_passage_index (highest score) and snippet_type (paragraph/list/table/answer_box). Returns overall_snippet_readiness and optimization_suggestions.`,
    data_sources: ['Content text (paragraph-tokenized)', 'Target keyword', 'Claude Sonnet 4 (snippet optimization)'],
  },
  context_aligner: {
    layman: `Before you write content, we check if your planned outline actually matches how users search. If your H2s don't cover what users expect, the page won't rank — even if it's well-written. We compare your outline to what actually ranks and flag missing angles or off-topic sections.`,
    technical: `runContextVectorAligner compares planned_content_outline (H2s from brief) against competitor top-3 H2s (scraped from SERP). Claude analyzes: query intent match, concept coverage gaps, extraneous topics that dilute relevance. Returns alignment_score, vector_match (aligned/partial/misaligned), missing_contexts, extraneous_contexts, recommended_outline_adjustments (specific add/remove/replace at position X).`,
    data_sources: ['Planned outline', 'Competitor top-3 SERP pages', 'Claude Sonnet 4 (vector alignment)'],
  },
  competitor_map: {
    layman: `Give us a competitor URL and we reverse-engineer their whole SEO strategy: what's their central business topic, what content areas do they focus on, how deep do they go in each area, and what do they cover that you don't.`,
    technical: `runCompetitorTopicalMapExtractor fetches competitor sitemap (sitemap.xml → sitemap_index → children, up to 150 URLs). Groups URLs by path patterns and inferred topics. Claude analyzes URL structure + path hierarchy to infer: inferred_central_entity, inferred_source_context, core_section_topics (count + depth), outer_section_topics. Compares to client's topical map to produce coverage_vs_client (shared, competitor_advantage, client_advantage).`,
    data_sources: ['Competitor sitemap XML', 'URL pattern analysis', 'Claude Sonnet 4 (topic inference)', 'Client topical map (for comparison)'],
  },
  content_refresh: {
    layman: `Old content loses rankings unless you update it. We inventory every page, track its position history, flag which ones are declining, and recommend specific updates — what sections to rewrite, what information to add, what's outdated. Prioritized so urgent stuff comes first.`,
    technical: `buildContentInventory fetches sitemap (200 URLs), analyzes each page (title, word_count, published_at, last_modified, has_images, has_schema, has_faq, internal_links_in/out). Cross-refs kotoiq_keywords for SC data. Compares current position vs 30d/90d snapshots for trajectory (improving/declining/stable/new/dead). freshness_status: fresh <90d, aging 90-180d, stale 180-365d, critical >365d. refresh_priority based on (declining + stale). Claude generates specific refresh_recommendations for top 20 pages.`,
    data_sources: ['Full sitemap crawl', 'kotoiq_keywords', 'kotoiq_snapshots (trajectory)', 'Claude Sonnet 4 (refresh plans)'],
  },
  aeo: {
    layman: `Does your page qualify for the AI Overview box at the top of Google? We check the format (direct answer in first paragraph, 40-60 words), schema markup, author signals, freshness, and question-answer structure. You get a score and exactly what to fix to win that #0 position.`,
    technical: `AEO Score formula: format_match 0.30 + direct_answer 0.25 + schema_markup 0.20 + authority_signals 0.15 + freshness 0.10. analyzePageForKeyword extracts title, meta, headings, first paragraph, schema, images. Checks: does first paragraph directly answer query? Is it 40-60 words / 280-320 chars? Are H2s in question format? Is FAQPage/HowTo schema present? Author byline present? Last modified within 90 days?`,
    data_sources: ['Target page HTML', 'Schema detection', 'Claude Sonnet 4 (gap analysis)'],
  },
}

export default function HowItWorks({ tool, compact = false }) {
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState('layman') // 'layman' | 'technical'

  const info = EXPLANATIONS[tool]
  if (!info) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0f9ff 0%, #fefce8 100%)',
      border: '1px solid #e0e7ef',
      borderRadius: 12,
      padding: expanded ? '16px 20px' : '10px 16px',
      marginBottom: 16,
      transition: 'padding .15s',
    }}>
      <button onClick={() => setExpanded(!expanded)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        color: BLK, fontFamily: FH, fontSize: 13, fontWeight: 700,
      }}>
        <Info size={15} color={T} />
        <span>How this works</span>
        {!expanded && info.layman && <span style={{ fontSize: 12, fontWeight: 500, color: '#1f2937', marginLeft: 4 }}>— click to learn</span>}
        <div style={{ marginLeft: 'auto' }}>
          {expanded ? <ChevronUp size={16} color="#374151" /> : <ChevronDown size={16} color="#374151" />}
        </div>
      </button>

      {expanded && (
        <div style={{ marginTop: 14 }}>
          {/* Toggle */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: '#fff', borderRadius: 8, padding: 3, border: '1px solid #e5e7eb', width: 'fit-content' }}>
            <button onClick={() => setView('layman')} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: view === 'layman' ? BLK : 'transparent',
              color: view === 'layman' ? '#fff' : '#1f2937',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, fontFamily: FH,
            }}>
              <BookOpen size={12} /> Plain English
            </button>
            <button onClick={() => setView('technical')} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: view === 'technical' ? BLK : 'transparent',
              color: view === 'technical' ? '#fff' : '#1f2937',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, fontFamily: FH,
            }}>
              <Code size={12} /> Technical
            </button>
          </div>

          {/* Explanation */}
          <div style={{
            fontSize: 13, lineHeight: 1.65, color: '#111827',
            fontFamily: FB,
            padding: '12px 14px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb',
          }}>
            {info[view]}
          </div>

          {/* Data sources */}
          {info.data_sources && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: FH }}>
                Data Sources Used
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {info.data_sources.map((ds, i) => (
                  <span key={i} style={{
                    fontSize: 11, fontWeight: 600, color: T, background: T + '14',
                    padding: '3px 9px', borderRadius: 6, border: `1px solid ${T}30`,
                  }}>
                    {ds}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
