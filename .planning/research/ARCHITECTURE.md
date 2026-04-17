# Architecture Research — KotoIQ M1: Elementor Template-Clone Publisher

**Domain:** Programmatic SEO publishing layer on top of an existing Next.js + Supabase + WordPress-plugin SaaS
**Researched:** 2026-04-17
**Confidence:** HIGH (existing codebase patterns are all verified in-tree; Elementor v4 JSON + Vercel Workflow DevKit verified against official sources dated within 6 months)

> **Scope note:** This document answers *how M1 plugs into Koto*, not *what M1 is*. The feature surface is covered in `.planning/research/FEATURES.md`. The stack is covered in `.planning/research/STACK.md`. This is the integration blueprint.

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT SITE (WordPress + Elementor Pro 4.0.2)         │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  `koto` WP Plugin  (PHP)                                         │      │
│   │                                                                  │      │
│   │  EXISTING endpoints:              NEW M1 endpoints:              │      │
│   │   • agency/test                    • builder/detect              │      │
│   │   • content (CRUD)                 • builder/pages               │      │
│   │   • generate/batch                 • builder/elementor/get       │      │
│   │   • rankings                       • builder/elementor/put       │      │
│   │   • sitemap/rebuild                • builder/theme/scan          │      │
│   │                                    • builder/indexnow            │      │
│   │                                    • builder/cwv                 │      │
│   │                                    • builder/attribution/number  │      │
│   └─────────────────────────────┬────────────────────────────────────┘      │
└─────────────────────────────────┼────────────────────────────────────────────┘
                                  │  HTTPS  (Bearer api_key, 30s timeout)
                                  │         (every hit logged to koto_wp_commands)
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         KOTO PLATFORM (Vercel, Next.js 16)                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  EXISTING: src/app/api/wp/route.ts   (proxyToPlugin + command queue)│    │
│  │                                                                    │    │
│  │  MODIFIED: add actions → {detect_builder, list_elementor_pages,    │    │
│  │    get_elementor_data, put_elementor_data, scan_theme}             │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐ │
│  │  NEW: /api/wp/       │  │  NEW: /api/wp/       │  │  NEW: /api/wp/    │ │
│  │   builder/template   │  │   builder/campaign   │  │   builder/publish │ │
│  │   (ingest, slots,    │  │   (variant rows,     │  │   (Workflow       │ │
│  │    schema pinning)   │  │    cadence, seeds)   │  │    orchestrator)  │ │
│  └──────────────────────┘  └──────────────────────┘  └───────────────────┘ │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐ │
│  │  NEW: /api/wp/       │  │  NEW: /api/wp/       │  │  NEW: /api/wp/    │ │
│  │   builder/cwv        │  │   builder/indexnow   │  │   builder/        │ │
│  │   (CrUX ingest +     │  │   (submission log)   │  │   attribution     │ │
│  │    PSI fallback)     │  │                      │  │   (Telnyx join)   │ │
│  └──────────────────────┘  └──────────────────────┘  └───────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  NEW LIB: src/lib/builder/                                         │    │
│  │   elementorAdapter.ts      — v4 atomic widget schema registry      │    │
│  │   slotDetector.ts          — identify wildcards in JSON tree       │    │
│  │   slotFiller.ts            — splice Claude output into JSON        │    │
│  │   variantGenerator.ts      — Claude Sonnet, schema-constrained     │    │
│  │   cruxClient.ts            — CrUX API + PSI fallback               │    │
│  │   indexnow.ts              — IndexNow + Google Indexing API        │    │
│  │   attributionLinker.ts     — Telnyx call → page match              │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────────────┐   ┌──────────────────────────────────────────┐   │
│  │  MODIFIED:           │   │  NEW: src/views/kotoiq/                  │   │
│  │   src/views/         │   │   TemplateIngestPage.jsx                 │   │
│  │   PageBuilderPage    │──▶│   SlotEditorPage.jsx                     │   │
│  │   .jsx               │   │   CampaignComposerPage.jsx               │   │
│  │   (HTML mode kept    │   │   PublishQueuePage.jsx                   │   │
│  │    as a tab; +       │   │   KotoIQDashboardPage.jsx (shell)        │   │
│  │    "Native Elementor"│   └──────────────────────────────────────────┘   │
│  │    mode as new tab)  │                                                  │
│  └──────────────────────┘                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                             SUPABASE (Postgres)                               │
│                                                                              │
│   EXISTING (reused):                  NEW M1 tables:                         │
│    • clients                          • kotoiq_builder_sites                 │
│    • agencies                         • kotoiq_templates                     │
│    • koto_wp_sites                    • kotoiq_template_slots                │
│    • koto_wp_commands  ◀── reused     • kotoiq_campaigns                     │
│      for sync plugin calls            • kotoiq_variants                      │
│    • koto_wp_pages     ◀── extended   • kotoiq_publishes                     │
│      (+ elementor_data_id,            • kotoiq_cwv_readings                  │
│         template_id, variant_id)      • kotoiq_indexnow_submissions          │
│    • koto_token_usage  ◀── reused     • kotoiq_call_attribution              │
│      (feature="builder_*")            • kotoiq_elementor_schema_versions     │
│    • koto_inbound_calls ◀── joined                                           │
│      (for call attribution)                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        DURABLE ORCHESTRATION LAYER                            │
│                                                                              │
│   NEW: Vercel Workflow DevKit (GA as of early 2026)                          │
│    • builder.publishCampaign    — fan out N variants → N publishes           │
│    • builder.cwvFirstRead       — 24h after publish, fetch CrUX              │
│    • builder.indexnowSubmit     — immediate, with retry                      │
│    • builder.rescan             — weekly per site (M2 reuse)                 │
│                                                                              │
│   EXISTING: koto_wp_commands stays the sync transport for each individual    │
│   plugin call. Workflow orchestrates; the command queue records.             │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 2. Component Inventory — New / Modified / Reused

### 2.1 WP Plugin (PHP) — all NEW endpoints

All additive; namespaced under `/wp-json/koto/v1/builder/*`. None of the existing routes change shape.

| Endpoint | Method | Responsibility | Auth |
|----------|--------|----------------|------|
| `builder/detect` | POST | Return `{ elementor_version, pro_version, atomic_enabled, theme_name, php_version }` | Bearer api_key (same as existing routes) |
| `builder/pages` | GET | List pages/posts with `_elementor_edit_mode` set; returns `{ id, title, slug, post_type, updated_at, elementor_version }` | Bearer api_key |
| `builder/elementor/{id}` | GET | Return raw `_elementor_data` JSON + `_elementor_version` + `_elementor_page_settings` | Bearer api_key |
| `builder/elementor/{id}` | PUT | Accept new JSON, write to `_elementor_data`, bump `_elementor_css_time`, trigger `Elementor\Core\Files\CSS\Post` regen; optionally create new post if `id=new` | Bearer api_key |
| `builder/theme/scan` | POST | Walk active theme; return `{ design_tokens: { colors, fonts, spacing }, css_classes, global_classes, css_variables }` | Bearer api_key |
| `builder/indexnow` | POST | Submit URL(s) to IndexNow + Google Indexing API from inside the site (key file lives on the client domain); return submission IDs | Bearer api_key |
| `builder/cwv` | GET | Optional: return `web-vitals` library readings if an RUM snippet was installed. Fallback to CrUX+PSI from Koto side. | Bearer api_key |
| `builder/attribution/number` | POST/DELETE | Install/remove a per-page tracking phone number into a widget slot via `_elementor_data` patch | Bearer api_key |

Why PUT via `_elementor_data` and not the WP REST content body: Elementor v4 atomic widgets serialize the whole visual tree as a JSON blob in `_elementor_data`. Writing `post.content.rendered` does nothing — Elementor re-renders on publish from the meta blob. Per the Elementor Developer docs, this is the canonical source of truth.

### 2.2 Koto API Routes (Next.js App Router) — mixed

| Path | Status | Purpose |
|------|--------|---------|
| `src/app/api/wp/route.ts` | MODIFIED | Add actions: `detect_builder`, `list_elementor_pages`, `get_elementor_data`, `put_elementor_data`, `scan_theme`. Keeps existing action dispatch shape. |
| `src/app/api/wp/builder/template/route.ts` | NEW | Actions: `ingest` (pull JSON via existing proxy, store, auto-detect slots), `list`, `get`, `update_slots`, `clone`, `archive`. |
| `src/app/api/wp/builder/campaign/route.ts` | NEW | Actions: `create` (template + variants seed CSV/JSON), `list`, `get`, `update`, `preview_variant` (AI fill one row without publishing), `schedule`, `cancel`. |
| `src/app/api/wp/builder/publish/route.ts` | NEW | Action: `run` → kicks a Vercel Workflow run. Returns workflow run id; UI polls status. Also: `retry_variant`, `rollback_publish`. |
| `src/app/api/wp/builder/cwv/route.ts` | NEW | `fetch_first_read`, `refresh_field_data`, `list_readings`. Uses CrUX API (origin + URL) with PSI fallback for URLs without enough traffic for CrUX. |
| `src/app/api/wp/builder/indexnow/route.ts` | NEW | `submit`, `list_submissions`, `verify_key_file`. |
| `src/app/api/wp/builder/attribution/route.ts` | NEW | `assign_number`, `release_number`, `match_inbound_call` (join on Telnyx inbound + dynamic number map). |
| `src/app/api/wp/builder/schema/route.ts` | NEW | `list_versions`, `capture` (scrape one v4 Elementor page → infer widget schema), `promote` (mark a captured schema as the pinned adapter version for this site). |
| `src/app/api/kotoiq/route.ts` | NEW (thin) | UI shell aggregator: dashboard stats + cross-cutting lists. Reads only. |
| `src/app/api/cron/builder-*` | NEW | Vercel Cron endpoints that kick Workflow runs (nightly CWV refresh, daily attribution reconciliation). |

**Pattern consistency:** all new POST endpoints follow the existing `/api/wp/route.ts` shape: `{ action, agency_id, client_id, site_id, ...payload }`. No deviation — this is the DX the codebase has settled on across 131 other routes.

**Runtime:** default Node.js runtime (not Edge). `/api/wp/*` already calls Supabase service-role + outbound fetch to client WP sites with 30s timeout. Fluid Compute handles this natively; Edge compatibility is not worth pursuing (Anthropic SDK, Telnyx SDK, CrUX all happier on Node.js). Default 300s function timeout is plenty for a single template ingest or publish step; long fan-outs go to Workflow.

### 2.3 Shared Libraries (`src/lib/builder/`) — all NEW

```
src/lib/builder/
├── elementorAdapter.ts       # v4 atomic widget schema registry; version-pinned
├── elementorSchemaStore.ts   # load/save schema versions from Supabase
├── slotDetector.ts           # walk _elementor_data, find text/image/link wildcards
├── slotFiller.ts             # splice values back into the JSON tree at exact paths
├── templateAnalyzer.ts       # summarize template (sections, slots, est. tokens)
├── variantGenerator.ts       # Claude Sonnet w/ tool-use schema constraint
├── seedNormalizer.ts         # CSV/JSON seed → canonical variant rows
├── cruxClient.ts             # CrUX API (LCP p75, CLS p75, INP p75, FID p75)
├── psiClient.ts              # PageSpeed Insights fallback for low-traffic URLs
├── indexnow.ts               # IndexNow.org + Google Indexing API
├── attributionLinker.ts      # match Telnyx inbound call → published page
├── jsonPathUtils.ts          # stable ID-based deep-get/set for _elementor_data
└── workflowClient.ts         # kick/poll Vercel Workflow runs from API routes
```

Naming convention mirrors existing lib conventions (`src/lib/emailSequenceEngine.ts`, `src/lib/ghl.js`, `src/lib/clientIntelligenceEngine.ts`).

### 2.4 UI / Views

| View | Status | Purpose |
|------|--------|---------|
| `src/views/PageBuilderPage.jsx` | MODIFIED | Add a top-level mode toggle: **"Wildcard HTML" (existing)** vs **"Elementor Native" (new)**. HTML mode stays intact; Elementor mode mounts new sub-components. The 43 wildcards + 11 modules become a shared pool available to both modes. |
| `src/views/kotoiq/KotoIQDashboardPage.jsx` | NEW | The consolidated `/kotoiq` shell. Tabs: Intel · Publish · Tune · Settings. M1 only lights up "Publish" + read-only "Intel". |
| `src/views/kotoiq/TemplateIngestPage.jsx` | NEW | Pick a site → list Elementor pages → pull one → render preview + auto-detected slots. |
| `src/views/kotoiq/SlotEditorPage.jsx` | NEW | Review auto-detected slots; rename, add, remove; assign wildcards; set tone/length/constraint per slot. |
| `src/views/kotoiq/CampaignComposerPage.jsx` | NEW | Pair a template with a seed dataset (cities × services × phones); preview N rows; schedule cadence. |
| `src/views/kotoiq/PublishQueuePage.jsx` | NEW | Live view of Workflow runs: pending / in-flight / published / failed; per-variant retry. |
| `src/views/seo/*` + `src/views/wordpress/*` | RECONSIDERED | Keep routes for backward URLs, but link into the new KotoIQ shell. No deletion in M1. |
| `src/components/builder/` | NEW | `ElementorTreeView.jsx`, `SlotInlineEditor.jsx`, `VariantTable.jsx`, `CwvBadge.jsx`, `AttributionBadge.jsx`. |

Route registration: all new pages added to `src/app/App.jsx` under authenticated `AppRoutes` block. Public pages — none in M1; attribution-target phone numbers surface on the client WP site, not Koto.

### 2.5 Database Tables — all NEW except where marked

Naming follows the existing `kotoiq_*` convention already established by `20260501_kotoiq_topical_maps.sql`. The `koto_wp_*` prefix is reserved for the generic plugin infrastructure; `kotoiq_*` is for the builder-layer semantics.

```sql
-- ── Template ingest ───────────────────────────────────────────────
create table kotoiq_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  site_id uuid references koto_wp_sites(id) on delete cascade,
  source_post_id int,                            -- wp_posts.ID on the client site
  source_title text,
  schema_version_id uuid references kotoiq_elementor_schema_versions(id),
  -- The *master* JSON — the canonical source for cloning.
  elementor_data jsonb not null,
  elementor_version text,                        -- e.g. '4.0.2'
  status text default 'draft',                   -- draft|ready|archived
  slot_count int default 0,
  token_estimate int default 0,
  ingested_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on kotoiq_templates (agency_id, client_id, status);

create table kotoiq_template_slots (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references kotoiq_templates(id) on delete cascade,
  -- Stable identifier within the template JSON tree. Uses the Elementor element
  -- `id` + the property path (e.g. "abc123:settings.title") so slot positions
  -- survive minor template edits.
  json_path text not null,
  slot_kind text not null,                       -- heading|paragraph|button_text|button_url|image_url|image_alt|link_url|repeater_row
  label text,                                    -- author-provided friendly name
  wildcard_key text,                             -- e.g. '{service}' — maps to shared wildcard pool
  constraints jsonb default '{}',                -- {max_chars, tone, banned_phrases, required_entities}
  created_at timestamptz default now(),
  unique(template_id, json_path)
);

-- ── Campaigns + variants ──────────────────────────────────────────
create table kotoiq_campaigns (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  site_id uuid references koto_wp_sites(id) on delete cascade,
  template_id uuid not null references kotoiq_templates(id) on delete cascade,
  name text not null,
  cadence text default 'burst',                  -- burst|daily|weekly
  cadence_config jsonb default '{}',             -- {per_day_cap: 5, start_at, timezone}
  status text default 'draft',                   -- draft|scheduled|running|paused|complete
  total_variants int default 0,
  published_variants int default 0,
  created_at timestamptz default now()
);

create table kotoiq_variants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references kotoiq_campaigns(id) on delete cascade,
  -- Input row — the hyperlocal seed for this variant.
  seed_row jsonb not null,                       -- {city, state, service, phone, ...}
  -- AI-generated slot fills. Keyed by slot_id.
  slot_fills jsonb default '{}',
  -- Materialized JSON ready to PUT to Elementor.
  rendered_elementor_data jsonb,
  target_slug text,
  target_title text,
  status text default 'pending',                 -- pending|generating|ready|publishing|published|failed
  ai_feature text default 'builder_variant_fill',-- feature tag for koto_token_usage
  error text,
  created_at timestamptz default now()
);
create index on kotoiq_variants (campaign_id, status);

-- ── Publishes ─────────────────────────────────────────────────────
create table kotoiq_publishes (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references kotoiq_variants(id) on delete cascade,
  site_id uuid references koto_wp_sites(id) on delete cascade,
  wp_post_id int,
  url text,
  workflow_run_id text,                          -- Vercel Workflow run id
  published_at timestamptz,
  indexnow_submitted_at timestamptz,
  first_cwv_read_at timestamptz,
  unpublished_at timestamptz,
  created_at timestamptz default now()
);
create index on kotoiq_publishes (site_id, published_at desc);

-- ── CWV readings ──────────────────────────────────────────────────
create table kotoiq_cwv_readings (
  id uuid primary key default gen_random_uuid(),
  publish_id uuid references kotoiq_publishes(id) on delete cascade,
  url text not null,
  source text not null,                          -- 'crux_origin'|'crux_url'|'psi_lab'
  lcp_p75_ms int, cls_p75 numeric(4,3), inp_p75_ms int, fid_p75_ms int,
  fetched_at timestamptz default now(),
  source_url text,                               -- per VerifiedDataSource standard
  raw jsonb                                      -- full API response
);
create index on kotoiq_cwv_readings (publish_id, fetched_at desc);

-- ── IndexNow + Google Indexing API log ────────────────────────────
create table kotoiq_indexnow_submissions (
  id uuid primary key default gen_random_uuid(),
  publish_id uuid references kotoiq_publishes(id) on delete cascade,
  engine text not null,                          -- 'indexnow'|'google_indexing'
  url text not null,
  status int,
  response jsonb,
  submitted_at timestamptz default now()
);

-- ── Call attribution (joins to existing koto_inbound_calls) ───────
create table kotoiq_call_attribution (
  id uuid primary key default gen_random_uuid(),
  publish_id uuid references kotoiq_publishes(id) on delete set null,
  variant_id uuid references kotoiq_variants(id) on delete set null,
  inbound_call_id uuid references koto_inbound_calls(id) on delete cascade,
  match_method text,                             -- 'dynamic_number'|'utm'|'referrer'|'heuristic'
  confidence numeric(3,2),                       -- 0-1
  matched_at timestamptz default now(),
  unique(inbound_call_id)
);

-- ── Schema version pinning (Elementor evolves; we don't) ──────────
create table kotoiq_elementor_schema_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references koto_wp_sites(id) on delete cascade,
  elementor_version text not null,               -- '4.0.2', '4.0.3', '4.1.0'
  captured_from_post_id int,                     -- sample page used to derive schema
  widget_schema jsonb not null,                  -- atomic widget → settings shape
  is_pinned boolean default false,               -- the version this site is locked to
  captured_at timestamptz default now(),
  notes text
);
create unique index on kotoiq_elementor_schema_versions (site_id, elementor_version);

-- ── Builder-scoped site config (lightweight; don't bloat koto_wp_sites) ──
create table kotoiq_builder_sites (
  site_id uuid primary key references koto_wp_sites(id) on delete cascade,
  agency_id uuid not null references agencies(id) on delete cascade,
  indexnow_key text,                             -- 32-char hex; served from /{key}.txt on the client site
  indexnow_key_verified_at timestamptz,
  google_indexing_service_account jsonb,         -- encrypted credentials
  crux_api_key text,                             -- shared-per-agency or per-site
  default_schema_version_id uuid references kotoiq_elementor_schema_versions(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Extensions to koto_wp_pages (MODIFIED, not new) ───────────────
alter table koto_wp_pages
  add column if not exists template_id uuid references kotoiq_templates(id) on delete set null,
  add column if not exists variant_id uuid references kotoiq_variants(id) on delete set null,
  add column if not exists publish_id uuid references kotoiq_publishes(id) on delete set null;
```

Every new table carries `agency_id` (via the campaign/template root) — direct or transitive through foreign keys — so existing RLS policies and the app-level `.eq('agency_id', agencyId)` pattern in `src/lib/supabase.js` continue to apply.

### 2.6 What stays untouched (important to state explicitly)

- `koto_wp_commands` — keep as-is. Every plugin call logs here.
- `koto_wp_sites` — keep. Builder-specific config goes to `kotoiq_builder_sites`.
- `koto_wp_rankings` — keep. Rankings attribution joins via `koto_wp_pages.publish_id`.
- `koto_token_usage` — keep. Claude calls from `variantGenerator.ts` log here with `feature='builder_variant_fill'` etc.
- `koto_inbound_calls` — keep. Call attribution is a join table, not a column on calls.
- `src/app/api/wp/route.ts` — core `proxyToPlugin()` helper unchanged. We add actions to the dispatch, we don't rewrite the transport.
- Existing `PageBuilderPage.jsx` wildcard/HTML mode — preserved as a tab. "Additive, not a replacement" is a documented constraint in `PROJECT.md`.

---

## 3. Data Flow — Critical Paths

### 3.1 Template Ingest

```
 User (Koto UI)                Koto API                Plugin (PHP)          Supabase
     │                             │                        │                    │
     │ "Pull template from site"   │                        │                    │
     ├────────────────────────────▶│                        │                    │
     │                             │ POST /api/wp           │                    │
     │                             │   action=list_elementor_pages               │
     │                             ├───────────────────────▶│                    │
     │                             │                        │ SELECT posts WHERE │
     │                             │                        │   meta _elementor_edit_mode
     │                             │◀───────────────────────┤                    │
     │                             │ (logs to koto_wp_commands)                  │
     │                             │                        │                    │
     │◀────────────────────────────┤ pages list             │                    │
     │ user picks page             │                        │                    │
     ├────────────────────────────▶│                        │                    │
     │                             │ action=get_elementor_data                   │
     │                             ├───────────────────────▶│                    │
     │                             │                        │ get_post_meta()    │
     │                             │◀───────────────────────┤ _elementor_data    │
     │                             │                                             │
     │                             │ schemaCapture(data) ───────────────────────▶│
     │                             │   INSERT kotoiq_elementor_schema_versions  │
     │                             │ slotDetector(data) ────────────────────────▶│
     │                             │   INSERT kotoiq_templates + _slots         │
     │◀────────────────────────────┤ { template_id, slots, preview_url }        │
     │ Slot editor opens           │                                             │
```

**Key design decisions:**

- **Master template JSON lives in Koto** (`kotoiq_templates.elementor_data`). Not in WP. Three reasons:
  1. We need to clone it — having it on the client's WP side means pulling it every time.
  2. The "master" is a Koto concept (used for variants). The client's WP site just has published pages.
  3. We can audit history/diffs in Koto cleanly.
- **The original Elementor page in WP is left alone.** We never modify the source template. We create new posts for each variant. This matters: if the source gets broken by cloning, the client's live template stops working.
- **Schema version captured at ingest.** Before we read the first slot, we derive the widget-shape schema from the actual JSON and store it pinned to the site. Every subsequent ingest/publish uses the pinned schema. See §6.

### 3.2 Publish Loop (N variants)

```
 User clicks "Publish campaign"
           │
           ▼
 POST /api/wp/builder/publish {action: run, campaign_id}
           │
           │ creates a Vercel Workflow run:
           │   workflow: "builder.publishCampaign"
           │   input: { campaign_id, variants: [id1, id2, ...idN] }
           ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  Vercel Workflow — builder.publishCampaign                      │
 │                                                                 │
 │  for each variant (concurrency 3, respecting cadence):          │
 │    step "generate" ─── variantGenerator(variant) ──► Claude     │
 │       │                   │                          Sonnet     │
 │       │                   │         logs koto_token_usage       │
 │       │                   ▼                                     │
 │       │          variant.slot_fills = {...}                     │
 │       │          variant.rendered_elementor_data = splice(...)  │
 │       │                                                         │
 │    step "publish" ── /api/wp action=put_elementor_data          │
 │       │                 │                                       │
 │       │                 └──► plugin creates wp_post + sets meta │
 │       │                 └──► Elementor CSS regen triggered      │
 │       │                                                         │
 │    step "indexnow" ── /api/wp/builder/indexnow {submit url}     │
 │       │                                                         │
 │    step "scheduleCwv" ── workflow.sleep(24h) → cwvFirstRead     │
 │                                                                 │
 │  Each step is durable: crashes/deploys don't lose progress.     │
 │  Failed variants retry 3x then mark 'failed'.                   │
 │  Every sub-call to WP plugin still logs to koto_wp_commands.    │
 └─────────────────────────────────────────────────────────────────┘
           │
           ▼
   UI polls GET /api/wp/builder/publish { campaign_id }
   → returns published count, in-flight, failed
```

See §4 on why Workflow, not a naive loop inside a single Vercel Function.

### 3.3 Call Attribution (the revenue loop)

```
Caller dials Telnyx number X  ──► Retell ──► call_ended webhook ──► /api/onboarding/voice
                                                                              │ (existing)
                                                                              ▼
                                                                      INSERT koto_inbound_calls
                                                                              │
                                                                              ▼
                                              POST-WEBHOOK HOOK (new, additive in existing route):
                                                 call attributionLinker.match(call)
                                                            │
                    ┌───────────────────────────────────────┼───────────────────────────────┐
                    ▼                                       ▼                               ▼
            dynamic number map                       UTM on referrer URL          plain referrer URL
   (koto_wp_pages.attribution_number_id             (if page has tagged           (fuzzy match slug →
    matches call's `to` number exactly)              phone click tracker)           publish_id)
                    │                                       │                               │
                    └───────────────────────┬───────────────┴───────────────────────────────┘
                                            ▼
                            INSERT kotoiq_call_attribution
                              { inbound_call_id, publish_id, match_method, confidence }
```

**Match priority:**
1. **Dynamic number** (confidence = 1.0) — a dedicated Telnyx number was installed in the page's phone slot at publish time.
2. **UTM** (confidence = 0.85) — page URL has `?utm_source=page_id=...` that the WP plugin's click-to-call handler forwarded via SMS or session cookie.
3. **Referrer** (confidence = 0.6) — Telnyx doesn't carry this; use session correlation if the caller had previously opened a chat/form on the page.
4. **Heuristic fallback** (confidence = 0.3) — nearest-neighbor geo + service match; explicitly flagged as low confidence.

Only #1 is reliable at M1 scale. The architecture supports the others so they can light up in M2 without schema changes.

---

## 4. Sync vs Async — The Key Architectural Decision

**Recommendation: hybrid. Extend `koto_wp_commands` for per-call sync; add Vercel Workflow DevKit for multi-step durable orchestration.**

### Why not just extend the existing queue?

`koto_wp_commands` is an *audit log* for plugin HTTP calls, not a work queue. It has no scheduler, no retry machinery, no concurrency control, no sleep/resume semantics. Shoehorning "wait 24h, then fetch CrUX for this page" into it would mean building a cron loop + state machine from scratch — exactly the problem Workflow DevKit already solves.

### Why not a traditional queue (SQS/BullMQ/pg-boss)?

- Adding Redis or a new external queue is new infrastructure, new ops surface, new failure mode.
- `pg-boss` on Supabase is tempting but still requires building the state machine.
- Workflow DevKit is *already on Vercel*, runs in the same Fluid Compute pool, and went GA in early 2026 after processing 100M+ runs in beta. Per the knowledge-update: it's a first-class Vercel product. Zero new infra.

### Why not Vercel Queues?

Queues are for at-least-once event streaming (public beta). Fine for firing "publish this variant" events, but they don't give you the durable state machine (publish → wait → CWV → tune) we need. Workflow is the right primitive; Queues would be a downstream optimization if we need fan-out shaping.

### The hybrid contract

| Concern | Transport |
|---------|-----------|
| Single plugin HTTP call (get/put/ping) | `proxyToPlugin()` in `src/app/api/wp/route.ts` → `koto_wp_commands` logs it. Unchanged. |
| Single Claude call (fill one variant) | Inline in Workflow step. Logs to `koto_token_usage`. |
| Multi-step orchestration (N variants → N publishes → N indexnow → N CWV-in-24h) | Vercel Workflow DevKit. |
| Short post-response work ("fire-and-forget" after publish, e.g. kick the indexnow call once the variant record is saved) | `waitUntil()` from Vercel Functions — already supported by Fluid Compute's graceful shutdown model. |
| Recurring (weekly rescan, daily attribution reconciliation) | Vercel Cron → endpoint that starts a Workflow run. |

### Workflow run lifecycle

```typescript
// src/workflows/publishCampaign.ts  (conceptual — implementation references
// the live docs at https://vercel.com/docs/workflows before coding)
export const publishCampaign = workflow(async ({ campaign_id, variant_ids }) => {
  for (const variantId of variant_ids) {
    const variant = await step.do('generate', async () =>
      variantGenerator.fill(variantId)
    )
    const publish = await step.do('publish', async () =>
      putElementorData(variant)
    )
    await step.do('indexnow', async () => submitIndexNow(publish.url))
    // Durable sleep — Workflow pauses the run; no idle compute.
    await step.sleep('24h')
    await step.do('cwvFirstRead', async () => fetchCrux(publish.url))
  }
})
```

**Durability guarantees we gain:**
- Deploy in the middle of a 500-variant campaign → no lost variants.
- One publish errors → that variant retries in isolation; the other 499 keep going.
- "Wait 24h then CWV" is a real durable sleep, not a setTimeout in memory.

---

## 5. Storage Boundaries

| Artifact | Where it lives | Why |
|----------|---------------|-----|
| **Master template JSON** | `kotoiq_templates.elementor_data` (Supabase) | We're the system of record; we clone from here. |
| **Slot definitions** | `kotoiq_template_slots` (Supabase) | Structured queries, constraint validation at generate time. |
| **Campaign seed rows** | `kotoiq_variants.seed_row` (jsonb) | Keep input + output together per row for reproducibility. |
| **Generated slot fills** | `kotoiq_variants.slot_fills` (jsonb) | Audit trail — we need to know what Claude wrote before it was spliced. |
| **Rendered variant JSON** | `kotoiq_variants.rendered_elementor_data` | Exactly what got PUT to WP. Re-publishable. |
| **Published page facts** | `kotoiq_publishes` + `koto_wp_pages.publish_id` | Dual: `kotoiq_publishes` is the canonical publish record; `koto_wp_pages` is the existing sync-from-WP cache. |
| **CWV readings** | `kotoiq_cwv_readings` | Time series; `VerifiedDataSource` stamped (source_url + fetched_at). |
| **IndexNow submissions** | `kotoiq_indexnow_submissions` | Audit + retry state. |
| **Call attribution** | `kotoiq_call_attribution` (join table) | Join `kotoiq_publishes` + `koto_inbound_calls`. Not a column on either — a true relation. |
| **Schema versions** | `kotoiq_elementor_schema_versions` | Versioned adapter; per-site pinning. |
| **Static assets (images for pages)** | Client WP media library via plugin upload endpoint | Don't centralize images in Koto — WP handles image optimization, and that's the domain the search engine sees. |
| **IndexNow key file** | Client WP site (`{site}/{key}.txt`) | Per IndexNow spec, the key file must be served from the domain submitting URLs. Plugin serves it. |
| **Elementor CSS** | Client WP site (generated by Elementor on publish) | Triggered server-side by our PUT; we don't duplicate. |

**Nothing that changes in the real world is recalled from memory or hardcoded** — per `_knowledge/data-integrity-standard.md`. CWV comes from CrUX API, timestamp-wrapped. Geography comes from Census API (already in `src/lib/geoLookup.ts`). Seed rows must originate from a verified source (GSC export, GBP, manual agency upload with confirmation) and carry provenance.

---

## 6. Schema Versioning Strategy

Elementor v4 is new. v4.0.3, v4.1, v5 will ship. Our adapter must be version-pinned and survive plugin updates without breaking every published page.

### Three-layer strategy

**Layer 1 — Capture, don't assume.** `kotoiq_elementor_schema_versions` stores, per site, the exact widget shape observed. When a user ingests their first template, we walk the JSON and infer:
- Every `widgetType` seen (`e-heading`, `e-button`, `e-div-block`, ...)
- Every property path inside `settings` for each widget type
- Variable/class references

This becomes the site's *pinned schema*.

**Layer 2 — Adapter reads schema, not hardcoded widget list.** `elementorAdapter.ts` takes a schema version as input. Slot detection, validation, and filling are all parameterized by the schema. No code path has "if widgetType === 'e-heading'" as a literal constant.

**Layer 3 — Version drift detection.** On every ingest, we diff the detected schema against the pinned one. Three outcomes:
- **No change** → proceed.
- **Additive change** (new widget type the adapter hasn't seen) → flag in UI; proceed with what we know; schedule a schema update job.
- **Breaking change** (widget property renamed/removed) → block publish; require manual re-pin via the UI: "Elementor updated — review changes before publishing new variants."

This decouples our release cadence from Elementor's. When v4.1 ships, one client upgrades, we capture the new schema, pin them to v4.1 — clients on v4.0.2 stay on v4.0.2 with zero disruption.

---

## 7. Multi-Tenant / Agency Isolation

Every new table gets `agency_id` (explicit or transitive).

| Table | agency_id source |
|-------|------------------|
| `kotoiq_templates` | explicit column |
| `kotoiq_template_slots` | transitive via `template_id` |
| `kotoiq_campaigns` | explicit column |
| `kotoiq_variants` | transitive via `campaign_id` |
| `kotoiq_publishes` | transitive via `site_id` → `koto_wp_sites.agency_id` |
| `kotoiq_cwv_readings` | transitive via `publish_id` |
| `kotoiq_indexnow_submissions` | transitive via `publish_id` |
| `kotoiq_call_attribution` | transitive via `inbound_call_id` → `koto_inbound_agents.agency_id` |
| `kotoiq_elementor_schema_versions` | transitive via `site_id` |
| `kotoiq_builder_sites` | explicit column |

**Enforcement points (matching existing codebase patterns):**

1. **App-level filter** in every Supabase query: `.eq('agency_id', agencyId)` or `.in('template_id', agency_template_ids)`. Already the pattern in `src/lib/supabase.js`.
2. **API route auth** via `resolveAgencyId(req, searchParams)` in every new route handler. Same helper used in `/api/wp/route.ts`.
3. **RLS policies** on every new table mirroring the shape of existing `koto_wp_sites` policies.
4. **Workflow runs** tagged with `agency_id` at creation — Workflow DevKit supports metadata per run for later audit.
5. **Plugin commands** already carry `agency_id` in `koto_wp_commands` — unchanged.

**Impersonation:** existing pattern (sessionStorage-backed) in `useAuth.jsx` continues to work because all new APIs consume the same `resolveAgencyId()` helper.

---

## 8. Phase Build Order

Ordered for *unblock next step*. Components with no cross-dependencies can parallelize within a phase.

### Phase 1 — Read Path (no write risk)

Unblocks: everything else. Proves the plugin can talk to v4 Elementor JSON at all.

1. `koto` plugin: `builder/detect`, `builder/pages`, `builder/elementor/{id}` endpoints.
2. Koto API: extend `/api/wp/route.ts` with `detect_builder`, `list_elementor_pages`, `get_elementor_data` actions.
3. `src/lib/builder/jsonPathUtils.ts`, `elementorAdapter.ts` (read-only), `slotDetector.ts` (detection only, no fill).
4. Migration: `kotoiq_elementor_schema_versions`, `kotoiq_builder_sites`, `kotoiq_templates`, `kotoiq_template_slots`.
5. `src/views/kotoiq/TemplateIngestPage.jsx` + a debug viewer inside it.
6. **Gate:** "I can pull any Elementor v4 page from momentamktg.com and see its slots correctly identified." If this breaks, fix the adapter before anything else.

*Can parallelize:* theme/token scan endpoint (`builder/theme/scan`) and `scan_theme` API action — useful for M2 but not blocking M1 publish.

### Phase 2 — Schema Registry + Slot Editor

7. Auto-detection rules per widget type (heading → text slot, button → text + URL slots, image → URL + alt slots, link → URL slot, repeater → row-level slots).
8. `src/views/kotoiq/SlotEditorPage.jsx` — accept/override auto-detections, assign wildcards from the shared pool.
9. Pin schema version; version drift alarm.
10. **Gate:** "Slots are stable across re-ingests of the same template; adapter versioned."

### Phase 3 — Single-Page Write Round-Trip

Highest-risk phase. Prove we can write Elementor JSON back without breaking anything.

11. Plugin: `builder/elementor/{id}` PUT endpoint. Handle both "update existing post" and "create new post with template's data" (`id=new`).
12. Plugin: trigger Elementor CSS regen — verify with a visual diff on the client's site.
13. Koto API: `put_elementor_data` action; `src/lib/builder/slotFiller.ts` (fills one variant without AI, using seed data directly).
14. Migration: `kotoiq_campaigns`, `kotoiq_variants`, `kotoiq_publishes`.
15. "Preview variant" flow that publishes a *draft* post (not live) so we can verify round-trip.
16. **Gate:** "I can clone one Elementor page, fill slots with seed data, publish as a draft, open it in the WP editor, and it looks identical to the master." If visual diff fails, do not proceed.

### Phase 4 — AI Generation (schema-constrained)

17. `src/lib/builder/variantGenerator.ts` — Claude Sonnet 4.6, tool-use for structured output (one tool per slot_kind; Claude must return `{slot_id, value}` arrays). Logs to `koto_token_usage` with `feature='builder_variant_fill'`.
18. Constraint enforcement: max_chars per slot, banned phrases, required entity (city must appear once in intro, etc.).
19. Preview-one-variant UI: show Claude's fills side-by-side with seed data before publish.
20. **Gate:** "10 variants generated from one template produce 10 materially different pages, each with the seed data accurately placed and no AI hallucinations in regulated slots (phone number, address, license number)."

### Phase 5 — Workflow + Batch Publish

21. Vercel Workflow setup (`src/workflows/publishCampaign.ts`). Follow live docs at https://vercel.com/docs/workflows.
22. `src/app/api/wp/builder/publish/route.ts`: kick run, poll status.
23. Cadence controls (burst vs drip) — implemented as per-step sleep in Workflow.
24. `src/views/kotoiq/PublishQueuePage.jsx` live status.
25. **Gate:** "50 variants publish reliably over a 6-hour drip cadence; a deploy mid-run does not lose any variant."

### Phase 6 — Closed Loop

Parallelizable sub-tracks:

**6a. IndexNow + Google Indexing API**
26. Plugin: `builder/indexnow` + key file serving.
27. `src/lib/builder/indexnow.ts`, log to `kotoiq_indexnow_submissions`.
28. Auto-submit on publish (Workflow step).

**6b. CWV first read**
29. `src/lib/builder/cruxClient.ts` + `psiClient.ts`.
30. Workflow step `cwvFirstRead` at 24h, 7d, 30d.
31. `koto_wp_pages` join for dashboard display.

**6c. Call attribution**
32. Per-page dynamic number assignment (reuse existing Telnyx provisioning patterns from `/api/onboarding/telnyx-provision`).
33. Plugin: `builder/attribution/number` — inject number into a designated phone slot.
34. Post-webhook hook in `/api/onboarding/voice` (or the answering-service inbound hook) that calls `attributionLinker.match(call)`.
35. Migration: `kotoiq_call_attribution`.

**6d. KotoIQ shell**
36. `src/views/kotoiq/KotoIQDashboardPage.jsx` aggregates the above.
37. Redirect shims from `/wordpress` and `/seo` routes.

**Gate:** "20 live pages on momentamktg.com, each with CWV readings, IndexNow confirmations, and at least simulated call attributions wired. Dashboard shows dollar attribution per page."

---

## 9. Architectural Patterns (use these; document in AGENTS.md as they solidify)

### Pattern: Action-based route dispatch (REUSE)

Every `/api/wp/*` route follows `{ action: '...', agency_id, client_id, site_id, ...payload }`. The existing `/api/wp/route.ts` is the template. New routes don't invent URL schemes.

**Why:** 131 existing routes use this shape. Frontend hooks are trained on it. Breaking consistency costs more than it saves.

### Pattern: Command-queue-as-audit-log (REUSE + EXTEND)

Every plugin HTTP call logs to `koto_wp_commands` with request/response/duration. New builder endpoints automatically get this via `proxyToPlugin()`. Do not bypass.

**Trade-off:** extra INSERT per call. Worth it — debugging WP plugin misbehavior across 50 client sites is miserable without this.

### Pattern: JSON blob + structured mirror (NEW)

`kotoiq_templates.elementor_data` is a jsonb blob (source of truth). `kotoiq_template_slots` is a structured table that points into the blob via stable paths.

**Why not normalize the blob?** Elementor's JSON is deeply recursive and the shape evolves. Normalizing = writing migrations every Elementor version. Keep the blob canonical; extract only the parts we need to index.

### Pattern: Schema-constrained AI generation (NEW)

`variantGenerator.ts` uses Anthropic tool-use. The tool schema is derived from `kotoiq_template_slots` for the active template. Claude cannot return free-form JSON — it must call `fill_slot(slot_id, value)` N times, and values are validated against slot constraints before splice.

**Why:** free-form generation loses the mapping between output and slot. Tool-use makes the slot/value binding explicit and validatable.

### Pattern: Workflow for durable, command queue for ephemeral (NEW)

Anything that needs to survive a deploy or span > 30 seconds → Workflow. Anything that's "fire this one HTTP call and record it" → stays in `/api/wp/route.ts` + command queue.

### Pattern: Provenance-stamped external data (REUSE)

CWV readings, CrUX responses, IndexNow responses — all carry `source_url` + `fetched_at`, per `_knowledge/data-integrity-standard.md`. Reuse `createVerifiedData()` from `src/lib/dataIntegrity.ts`.

---

## 10. Anti-Patterns — Do NOT Do These

### Anti-pattern: Rebuild Elementor's editor inside Koto.

Already captured in `PROJECT.md`. The "template + slot + clone" architecture is the whole design premise. A WYSIWYG inside Koto is a year of scope for marginal value. If the feeling arises that "we should just render the Elementor preview inside Koto," stop.

### Anti-pattern: Loop through 500 variants inside one Vercel Function.

Max execution on Fluid Compute is 300s by default (configurable higher but has limits). A single variant may take 8-15s end-to-end (Claude call + plugin PUT + CSS regen). 500 × 10s = 83 minutes. Use Workflow.

### Anti-pattern: Write to `post.post_content` instead of `_elementor_data`.

Elementor v4 re-renders from `_elementor_data` on publish. Writing the rendered HTML to `post_content` works for one render and then gets blown away. PUT the meta blob.

### Anti-pattern: Hardcode the widget schema in TypeScript.

Elementor v4 will evolve. Hardcoding `widgetType === 'e-heading'` in a switch statement means every minor version update requires a code release. Load the schema from `kotoiq_elementor_schema_versions`.

### Anti-pattern: Use the same post for all variants.

Every variant must be a new `wp_posts` row. If we PUT over the template's own post id, the template is destroyed and every existing variant that references its shape loses ground truth.

### Anti-pattern: Generate all variants, then publish all at once.

Google's scaled-content-abuse policy flags bursts of near-identical pages. Even though our pages are genuinely differentiated, burst publishing is suspicious. Default cadence: drip (5-20/day/site). Burst mode is an opt-in flag for established domains only.

### Anti-pattern: Skip IndexNow because "Google will find it anyway."

IndexNow gets new pages indexed in hours instead of weeks. The difference is visible in GSC within the first week. This is table-stakes for the "closed loop" thesis — it's what differentiates a ship-and-forget tool from a measurable one.

### Anti-pattern: Store the master JSON in WordPress only.

If we only keep the master on the client's WP site, every "generate a campaign" requires pulling it first, plus we can't diff template versions, plus the client could edit the master and break all downstream variants silently. Koto is the system of record for templates.

### Anti-pattern: Store generated variant JSON only in Workflow state.

Workflow state is ephemeral by design — once the run completes, it ages out. We need `kotoiq_variants.rendered_elementor_data` persisted so we can re-publish, diff, or unpublish later.

---

## 11. Scaling Considerations

| Scale | Bottleneck | Fix |
|-------|-----------|-----|
| 1 client, 20 pages (M1 pilot) | None realistic. | — |
| 10 clients × 100 pages | Claude API rate limits on bursts. | Cadence-throttle Workflow; per-agency concurrency cap. |
| 50 clients × 500 pages each | Supabase connection count if many Workflow steps run in parallel. | Connection pooling via PgBouncer (already configured on Supabase); batch writes. |
| 100+ clients, daily re-tune | CWV polling hits PSI quota (25k/day free). | Upgrade to paid CrUX BigQuery export; batch daily origin-level queries instead of per-URL. |
| Any scale | Elementor CSS regen on writes — slow on WP host. | Regen is triggered synchronously inside the plugin but runs async via WP cron. Don't block the PUT response on CSS compilation. |

**First bottleneck we'll actually hit:** client WP hosting quality. Shared hosting with a PHP worker cap will bottleneck at ~5-10 concurrent PUTs per site. Per-site concurrency in the Workflow must respect this (configurable in `kotoiq_builder_sites.publish_concurrency`, default 3).

---

## 12. Integration Points — File-by-File

| Where | What changes |
|-------|-------------|
| `src/app/api/wp/route.ts` | Add new action branches. Reuse `proxyToPlugin()`. |
| `src/app/api/wp/builder/*/route.ts` | New route files. Shape mirrors existing WP route. |
| `src/app/App.jsx` | Register new `/kotoiq/*` routes under authenticated `AppRoutes`. |
| `src/views/PageBuilderPage.jsx` | Add mode toggle; preserve HTML wildcard logic untouched. |
| `src/views/kotoiq/*.jsx` | All new. Import from existing `Sidebar.jsx`, `useAuth()`, `useClient()`. |
| `src/lib/builder/*` | All new. No existing lib touched. |
| `src/workflows/*.ts` | New directory. Workflow definitions live here. |
| `supabase/migrations/20260XXX_kotoiq_builder.sql` | New migration. All tables prefixed `kotoiq_`. |
| `_knowledge/modules/kotoiq-builder.md` | New module doc following the existing `_knowledge/modules/` pattern. |
| `CODEBASE.md` | Add KotoIQ Builder to the module map. |
| `AGENTS.md` | Add: "When writing to Elementor, always PUT `_elementor_data` meta, never `post.content`. Follow schema pinning strategy in `.planning/research/ARCHITECTURE.md`." |

---

## 13. Recommendation Summary

1. **Sync vs async: hybrid.** Keep `koto_wp_commands` as the audit log for every plugin call (unchanged). Add Vercel Workflow DevKit for multi-step durable orchestration (publish campaigns, CWV delayed reads, weekly re-tune). Use `waitUntil()` for fire-and-forget post-response work. Do **not** build a new queue.
2. **Storage: Koto is source of truth for templates; WP is source of truth for published pages.** Mirror published-page facts in `koto_wp_pages` (already the pattern). Don't centralize images — keep them in WP media.
3. **Components: mostly new, one modification.** Existing `/api/wp/route.ts` gains actions but keeps its dispatch. Existing `PageBuilderPage.jsx` gains a mode toggle. Everything else is additive under `kotoiq_*` tables and `src/app/api/wp/builder/*` + `src/lib/builder/*` + `src/views/kotoiq/*`.
4. **Schema versioning: capture from live JSON, pin per site, diff on ingest.** The adapter reads the schema; no hardcoded widget lists.
5. **Agency isolation: every new table carries agency_id** (explicit or transitive). Enforced at app, API, RLS, and Workflow metadata layers.
6. **Build order: read → schema → write-one → AI → workflow-batch → closed loop.** Each phase has a hard gate. No phase proceeds until its gate passes on momentamktg.com.

---

## Sources

- Existing codebase: `src/app/api/wp/route.ts`, `supabase/migrations/20260404_moose_wp_sites.sql`, `supabase/migrations/20260501_kotoiq_topical_maps.sql`, `src/views/PageBuilderPage.jsx`, `_knowledge/modules/*`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/INTEGRATIONS.md`, `.planning/PROJECT.md`. Confidence: HIGH.
- [Elementor Data Structure — Official Developer Docs](https://developers.elementor.com/docs/data-structure/) — atomic widget JSON shape, `_elementor_data` meta key, widget/element types. Confidence: HIGH.
- [Elementor Widget Element — Official Developer Docs](https://developers.elementor.com/docs/data-structure/widget-element/). Confidence: HIGH.
- [Elementor Editor 4.0 Developers Update](https://developers.elementor.com/elementor-editor-4-0-developers-update/) — atomic foundation, scalable architecture. Confidence: HIGH.
- [Vercel Workflow — Official Docs](https://vercel.com/docs/workflows). Confidence: HIGH.
- [Vercel Workflow Development Kit — Blog](https://vercel.com/blog/introducing-workflow) — durable execution model. Confidence: HIGH.
- [A New Programming Model for Durable Execution — Vercel Blog](https://vercel.com/blog/a-new-programming-model-for-durable-execution) — Workflow beta → GA, step durability, sleep semantics. Confidence: HIGH.
- Vercel knowledge update (loaded in subagent context, 2026-02-27) — Fluid Compute as default runtime, Node.js 24 LTS, 300s default timeout, `waitUntil`, Vercel Queues in public beta, Sandbox/Workflow/AI Gateway GA. Confidence: HIGH.
- `_knowledge/data-integrity-standard.md` — VerifiedDataSource pattern for all external data (CWV, CrUX, IndexNow responses). Confidence: HIGH.

---
*Architecture research for: KotoIQ M1 — Elementor Template-Clone Publisher*
*Researched: 2026-04-17*
