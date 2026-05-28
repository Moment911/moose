# Session Log

## May 28, 2026 — AI Pages "spectacular" build (#3–#6)

Continued the topic-campaign SEO/AEO build. Pattern throughout: lib helper →
route action → toolbar button in TopicCampaignPanel.jsx. All real-data-only
(see _knowledge/modules + [[ai-pages-eeat-architecture]] memory). Typecheck clean;
NOT verified live (dashboard behind Supabase auth — Adam must verify in browser).

### #5 SERP rank tracking over time
- New table koto_topic_campaign_rank_history (one row per city per check_citations run)
- checkCitationsAction persists organic_rank + AI-citation state each run
- get_rank_history action; getPerformance attaches rank_history per city
- RankTrend component (inverted sparkline) in the Performance expanded row

### #3 Auto-freshness (opt-in, redeploy-only — ZERO Claude tokens)
- koto_topic_campaigns.auto_refresh + refresh_threshold_key + last_auto_refresh_at
- redeployCampaign refactored → exported redeployCampaignCore (reused by cron)
- Cron /api/kotoiq-shim-cron/freshness-refresh (05:30 UTC, vercel.json) re-deploys
  opted-in campaigns past their dataIntegrity.ts staleness window (Census+reviews,
  no Claude). Competitor refresh stays the manual Regenerate (token-conscious).
- set_auto_refresh action + panel toggle + threshold picker

### #4 Per-page .md + llms-full.txt (AI crawlers prefer Markdown)
- mdTwinBuilder.ts: htmlToMarkdown + buildPageMarkdown + buildLlmsFullTxt + pushers
- deploy/redeploy push {slug}.md and persist resolved_markdown (deploys col);
  site-wide /llms-full.txt rebuilt from all published deploys
- Shim md-server.php serves /{slug}.md + /llms-full.txt → plugin bumped to v4.2.5
- Panel: .md link per deploy row + /llms-full.txt link in the AI-crawler card

### #6 Pillar/hub auto-architecture
- hubBuilder.ts: buildHubPage (CollectionPage + BreadcrumbList + ItemList), links
  all city pages grouped by state + sibling clusters (other campaigns' hubs)
- deploy_hub action (create/update one hub page; stores hub_post_id/url/slug)
- City pages get a BreadcrumbList (Home > Hub > City) via tokenResolver ctx.hub
  (schema-only) once a hub exists + the campaign is re-deployed
- Panel: Build/Rebuild hub button + Hub link

## April 10-11, 2026

### Voice Onboarding
- Retell "Koto Onboarding 2" agent conducting interviews
- PIN verification via koto_onboarding_phone_pool
- Dynamic prompt per client state (fresh/partial/nearly_complete)
- save_flag bug fixed (was not in Retell LLM tools array) — commit 71e11fc
- Switched from Telnyx BYOC to native Retell number buying — commit fd39d1a
- Auto-provision on client creation wired to createClient_() — commit 70b5d86
- Bulk provision tool in /test-data

### Discovery Module
- Live session with Web Speech API
- AI Coach panel (Section Coach + Full Analysis)
- N/A detection, auto-fill, section completion bars

### Onboarding Form
- Pre-populates from both dedicated columns and onboarding_answers jsonb
- 26 adaptive questions, B2B/B2C/local/national classification
- 12 fields auto-populate from prior answers
- Multi-recipient support
- Access guide at /access-guide

### KotoProof
- FileReviewPage: HTML/PDF/image/video with annotation canvas
- Tall page support: height/width controls, scrollable canvas, zoom
- ProofListPage at /proof
- ColorPicker import bug fixed
- ProjectPage.jsx deleted (duplicate of KotoProofPage.jsx)

### Enterprise
- Client health scores 0-100 (A-F grade) in clients list
- AI Proposal builder (3-pane, Claude Sonnet streaming)
- Public proposal viewer /koto-proposal/:id
- Completion email with 5-page PDF
- White-label foundation (custom domain, DNS verify)

### Fixes
- send_link email URL: /onboard/:clientId (was /onboarding/:token) — commit 3a97f67
- Onboarding dashboard: invisible header, wrong copy link, wrong profile route
- Proposal left panel: pick() helper resolves across both data sources

### Token Reporting
- koto_token_usage table
- logTokenUsage() in every Claude API call
- /token-usage dashboard with cost by feature, model, daily chart
