# KotoIQ — AI-Powered Search Intelligence

## Purpose
Unified PPC/SEO/AEO command center. Cross-references Google Ads, Search Console, GA4, Keyword Planner, Moz, GBP, and competitor data with AI analysis to recommend what keywords to bid on, what pages to write, and where to win.

## Routes (planned)
- /seo — Dashboard + Keyword Explorer + Rank Tracker
- /page-builder — AI content briefs + competitor analysis
- /gmb — GBP health dashboard + review management + grid tracker

## Data Sources
- Google Ads API (keywords, bids, clicks, impressions, conversions, QS)
- Search Console API (organic rankings, impressions, clicks, CTR, position)
- GA4 API (conversions, sessions, engagement by landing page)
- Keyword Planner (via Ads API — search volume, CPC, competition)
- Moz API v2 (DA, PA, spam score, linking domains, anchor text)
- GBP API (reviews, posts, insights, profile data)
- PageSpeed + CrUX (Core Web Vitals)
- DataForSEO (SERP features, AI Overviews, local pack grid — PAID)
- Google NLP API (entity extraction)
- Google Trends (via pytrends)
- Competitor sitemap analysis
- Top-3 page reverse engineering

## Core Concept: Unified Keyword Framework (UKF)
Every keyword from every source merged into one record with:
- Ads data (CPC, clicks, conversions, QS)
- Organic data (SC position, impressions, CTR)
- Volume data (Keyword Planner monthly volume)
- GA4 data (conversions, revenue by landing page)
- Moz data (DA gap vs competitors)
- Trend data (direction, seasonality)

## Key AI Outputs
1. Opportunity Score (0-100) — which keywords to invest in
2. Rank Propensity (0-100) — can we realistically rank #1?
3. AEO Score (0-100) — can we win the AI Overview/featured snippet?
4. Bid Optimizer — increase/decrease/pause/add keywords
5. Content Briefs — what to write, how long, what schema, what entities
6. GMB Grid Map — local pack position at 25-49 geographic points

## Scoring Formulas
See full spec at: _knowledge/kotoiq-spec-v3.md

## Build Sequence
Session 1: Foundation (DB schema, API clients, UKF merge)
Session 2: AI Analysis Engine (scoring models, Claude integration)
Session 3: Additional Data Layers (CrUX, Trends, NLP, embeddings)
Session 4: GMB Intelligence (reviews, posts, grid tracker)
Session 5: Competitor Page Analysis (top-3 reverse engineering)
Session 6: UI — /seo (dashboard, keyword explorer)
Session 7: UI — /page-builder (AI briefs, export)
Session 8: UI — /gmb (health dashboard, grid map, reviews)
Session 9: Polish + Agency Mode (multi-client, PDF reports)
