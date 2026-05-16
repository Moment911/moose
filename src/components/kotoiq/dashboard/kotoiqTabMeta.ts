// ─────────────────────────────────────────────────────────────────────────
// KotoIQ Tab Meta — single source of truth for the unified header treatment.
//
// Every tab key here gets a brand-aligned page header rendered by
// KotoTabHeader.jsx — eyebrow + Bebas Neue title + DM Serif italic accent
// word + one-line rationale + optional right-slot actions. The treatment is
// applied centrally by KotoIQShell.jsx, so adding a tab here instantly
// upgrades its appearance with zero edits in the tab file itself.
//
// Migrated tabs that own their own bespoke hero header (AEO Visibility,
// Today, Auto-Fix Queue, Feature Directory, etc.) are intentionally NOT
// listed — the shell renders nothing for tabs missing from this map, so
// their existing headers stay untouched.
//
// Add a new entry as: `'tab_key': { eyebrow, title, accent?, rationale?, icon? }`
// `accent` renders inside the title in DM Serif Display italic pink — the
// editorial accent word treatment from the marketing brand.
// ─────────────────────────────────────────────────────────────────────────

import type { LucideIcon } from 'lucide-react'
import {
  BarChart2, Search, Award, Target, Shield, Eye, Globe, Map, Brain, Link2,
  GitBranch, Layers, FileText, Zap, RefreshCw, Calendar, Activity, Code,
  Sparkles, Settings, Sunrise, MessageCircle, DollarSign, Megaphone, Play,
  Mail, Wrench, Compass, Sliders,
} from 'lucide-react'

export interface KotoTabMeta {
  /** Pink uppercase eyebrow above the title — short structural tag (e.g. "INTEL · COMPETITORS") */
  eyebrow: string
  /** Main page title (Bebas Neue) — no quotes, no period */
  title: string
  /** Optional accent word — rendered inside the title in DM Serif italic pink. Marketing-brand treatment. */
  accent?: string
  /** One-line rationale shown below the title in muted DM Sans (DESIGN.md Pattern 1) */
  rationale?: string
  /** Lucide icon rendered next to the eyebrow */
  icon?: LucideIcon
  /** True when the tab renders its OWN hero — the shell skips header rendering for these.
   *  We still keep the entry here as a single source of truth for tab catalog tooling. */
  selfHeader?: boolean
}

export const KOTOIQ_TAB_META: Record<string, KotoTabMeta> = {
  // ── Overview ───────────────────────────────────────────────
  dashboard: {
    eyebrow: 'OVERVIEW · DASHBOARD',
    title: 'Where this client',
    accent: 'stands',
    rationale: 'High-level SEO snapshot — keyword reach, top quick-win opportunities, traffic, and AI visibility in one view.',
    icon: BarChart2,
  },
  keywords: {
    eyebrow: 'OVERVIEW · KEYWORDS',
    title: 'Every keyword we',
    accent: 'track',
    rationale: 'All discovered and tracked terms with volume, difficulty, intent, and current rank.',
    icon: Search,
  },
  topical_authority: {
    eyebrow: 'OVERVIEW · AUTHORITY',
    title: 'What this domain',
    accent: 'owns',
    rationale: 'Domain authority score plus topical-relevance breakdown — which subjects Google trusts this site for.',
    icon: Award,
  },

  // ── Competitor Intel ───────────────────────────────────────
  competitor_watch: {
    eyebrow: 'INTEL · ALERTS',
    title: 'Recent competitor',
    accent: 'moves',
    rationale: 'Legacy alerts feed — superseded by Pulse, kept for historical activity.',
    icon: Eye,
  },
  competitors: {
    eyebrow: 'INTEL · COMPETITORS',
    title: 'Who we’re',
    accent: 'tracking',
    rationale: 'Add, edit, and remove the competitor set the platform watches across every channel.',
    icon: Globe,
  },
  competitor_map: {
    eyebrow: 'INTEL · GEOGRAPHIC',
    title: 'Where competitors',
    accent: 'operate',
    rationale: 'Geographic map of competitor locations and service-area overlap. Useful for local strategy.',
    icon: Map,
  },
  scorecard: {
    eyebrow: 'INTEL · SCORECARD',
    title: 'Side-by-side',
    accent: 'rankings',
    rationale: 'Score comparison of this client against every tracked competitor across the SEO dimensions that matter.',
    icon: Shield,
  },

  // ── AI Search ──────────────────────────────────────────────
  aeo: {
    eyebrow: 'AEO · RESEARCH',
    title: 'Probe AI engines',
    accent: 'on demand',
    rationale: 'Ad-hoc visibility checks — pick a prompt, see the citations each engine returned. Pairs with AEO Visibility for continuous tracking.',
    icon: Brain,
  },
  multi_engine_aeo: {
    eyebrow: 'AEO · MULTI-ENGINE',
    title: 'Composite AI',
    accent: 'score',
    rationale: 'A single-number summary across all 5 LLM engines — what to drop into reports.',
    icon: Sparkles,
  },
  brand_serp: {
    eyebrow: 'AEO · BRAND SERP',
    title: 'How the brand',
    accent: 'shows up',
    rationale: 'What the Google SERP looks like for the brand name itself — knowledge panel, sitelinks, reputation surface.',
    icon: Search,
  },

  // ── Strategy & Authority ───────────────────────────────────
  strategy: {
    eyebrow: 'STRATEGY · PLAN',
    title: 'The long-range',
    accent: 'play',
    rationale: 'Pillars, sprints, and bets — generated from this client’s data and updated as it changes.',
    icon: Target,
  },
  backlinks: {
    eyebrow: 'AUTHORITY · BACKLINKS',
    title: 'Every link',
    accent: 'pointing here',
    rationale: 'Inbound link inventory with authority, anchor text, and freshness — disavow candidates flagged.',
    icon: Link2,
  },
  backlink_opportunities: {
    eyebrow: 'AUTHORITY · OPPORTUNITIES',
    title: 'Links competitors',
    accent: 'have',
    rationale: 'Sites that link to your competitors but not to you — the easiest outreach wins of the month.',
    icon: GitBranch,
  },
  eeat: {
    eyebrow: 'AUTHORITY · E-E-A-T',
    title: 'Trust signals',
    accent: 'audited',
    rationale: 'Experience, Expertise, Authoritativeness, Trust — what Google reviewers check on YMYL pages.',
    icon: Shield,
  },
  knowledge_graph: {
    eyebrow: 'AUTHORITY · ENTITY',
    title: 'How Google',
    accent: 'sees this brand',
    rationale: 'Entity and knowledge-panel presence plus the connections Google has made for this brand.',
    icon: Layers,
  },
  query_paths: {
    eyebrow: 'INTENT · JOURNEYS',
    title: 'How users get',
    accent: 'from query to convert',
    rationale: 'Trace intent journeys across pages and sessions — input for content planning and internal-linking.',
    icon: GitBranch,
  },

  // ── Content ────────────────────────────────────────────────
  autonomous_pipeline: {
    eyebrow: 'CONTENT · AUTO-PILOT',
    title: 'The closed-loop',
    accent: 'engine',
    rationale: 'Discover gaps, brief, generate, publish, monitor, refresh — with human approval gates at each handoff.',
    icon: Zap,
  },
  page_factory: {
    eyebrow: 'CONTENT · FACTORY',
    title: 'Scan, generate,',
    accent: 'publish at scale',
    rationale: 'Gap intelligence, style profiles, and bulk page generation tracking — wired to your WordPress.',
    icon: Layers,
  },
  briefs: {
    eyebrow: 'CONTENT · WRITER',
    title: 'PageIQ',
    accent: 'briefs & drafts',
    rationale: 'Full content brief plus multi-variant page draft from any target keyword.',
    icon: FileText,
  },
  hyperlocal: {
    eyebrow: 'CONTENT · HYPERLOCAL',
    title: 'Location-specific',
    accent: 'variants',
    rationale: 'Generates city / neighborhood / ZIP content variants tailored to local signals.',
    icon: Map,
  },
  topical_map: {
    eyebrow: 'CONTENT · MAP',
    title: 'Cluster',
    accent: 'coverage',
    rationale: 'Visual map of topic clusters and the pages covering each — exposes gaps and orphans.',
    icon: Map,
  },
  content_refresh: {
    eyebrow: 'CONTENT · HEALTH',
    title: 'What’s',
    accent: 'decaying',
    rationale: 'Content-health scorecard with prioritized refresh queue for declining pages.',
    icon: RefreshCw,
  },
  semantic: {
    eyebrow: 'CONTENT · SEMANTIC',
    title: 'Deep topic',
    accent: 'coverage',
    rationale: 'KotoIQ’s semantic agent network running deep topic-coverage analysis on a target page or cluster.',
    icon: Brain,
  },
  content_calendar: {
    eyebrow: 'CONTENT · CALENDAR',
    title: 'Editorial',
    accent: 'schedule',
    rationale: 'Briefs, drafts, and published dates in one timeline. Production planning.',
    icon: Calendar,
  },

  // ── Technical ──────────────────────────────────────────────
  activity: {
    eyebrow: 'TECH · ACTIVITY',
    title: 'Every action',
    accent: 'logged',
    rationale: 'Audit trail of platform actions for this client. Investigations and compliance.',
    icon: Activity,
  },
  gsc_audit: {
    eyebrow: 'TECH · SEO AUDIT',
    title: 'Standard',
    accent: 'health check',
    rationale: 'Meta, headings, internal links, broken links, schema, performance — the full crawl.',
    icon: Search,
  },
  technical_deep: {
    eyebrow: 'TECH · DEEP CRAWL',
    title: 'Render diff &',
    accent: 'JS-rendering',
    rationale: 'Crawl traps, redirect chains, mobile mismatches, canonical issues — when something’s structurally broken.',
    icon: Code,
  },
  schema: {
    eyebrow: 'TECH · SCHEMA',
    title: 'Rich result',
    accent: 'markup',
    rationale: 'Schema.org audit and validator across every page on the site.',
    icon: Code,
  },
  internal_links: {
    eyebrow: 'TECH · INTERNAL LINKS',
    title: 'The link',
    accent: 'graph',
    rationale: 'Hub pages, orphans, and recommended new internal links — boost a target without external work.',
    icon: Link2,
  },
  sitemap: {
    eyebrow: 'TECH · SITEMAP',
    title: 'Crawl every',
    accent: 'URL',
    rationale: 'Validates every URL in your XML sitemap. Migrations and large-site indexing investigations.',
    icon: Map,
  },

  // ── Local & Reviews (legacy) ───────────────────────────────
  gbp: {
    eyebrow: 'LOCAL · GBP',
    title: 'Google Business',
    accent: 'Profile health',
    rationale: 'Posts, Q&A, category configuration, and image-pack signals. Weekly local-SEO check.',
    icon: Globe,
  },

  // ── Reports & Tools ────────────────────────────────────────
  roi: {
    eyebrow: 'REPORTS · ROI',
    title: 'Revenue',
    accent: 'projections',
    rationale: 'Forecasted impact of SEO and Ads work under different growth scenarios — selling and proving impact.',
    icon: BarChart2,
  },
  bulk_ops: {
    eyebrow: 'TOOLS · BULK OPS',
    title: 'Batch',
    accent: 'operations',
    rationale: 'When the regular UI is too click-heavy for the job. Bulk apply across keywords, pages, or competitors.',
    icon: Layers,
  },
  connect: {
    eyebrow: 'TOOLS · CONNECT',
    title: 'OAuth',
    accent: 'integrations',
    rationale: 'Google, Meta, LinkedIn, Hotjar, Clarity, GBP, GSC — link the platforms that power every other tab.',
    icon: Settings,
  },

  // ── Style Editor ───────────────────────────────────────────
  style_editor: {
    eyebrow: 'BRAND · STYLE EDITOR',
    title: 'Tune the whole',
    accent: 'product',
    rationale: 'Edit fonts, colors, spacing, and the page header treatment in realtime. Changes write to CSS variables that drive every tab. Copy back to theme.ts when you’re happy.',
    icon: Sliders,
  },

  // ── Bespoke-header tabs (selfHeader: true) ─────────────────
  // These render their own hero header — the shell skips. Entries
  // here document them in one place so this file is the canonical
  // tab catalog for tooling like Feature Directory.
  today:              { eyebrow: 'OVERVIEW · TODAY',           title: 'Today',                   icon: Sunrise,        selfHeader: true },
  competitor_pulse:   { eyebrow: 'INTEL · PULSE',              title: 'Competitor Pulse',        icon: Activity,       selfHeader: true },
  ask:                { eyebrow: 'AI · ATLAS BRAIN',           title: 'Ask KotoIQ',              icon: MessageCircle,  selfHeader: true },
  aeo_visibility:     { eyebrow: 'AEO · ANSWER ENGINE',        title: 'AEO Visibility',          icon: Sparkles,       selfHeader: true },
  competitor_pages:   { eyebrow: 'INTEL · PAGES',              title: 'Competitor Pages',        icon: FileText,       selfHeader: true },
  pricing_tracker:    { eyebrow: 'INTEL · PRICING',            title: 'Pricing Tracker',         icon: DollarSign,     selfHeader: true },
  competitor_ads:     { eyebrow: 'INTEL · ADS',                title: 'Competitor Ads',          icon: Megaphone,      selfHeader: true },
  competitor_youtube: { eyebrow: 'INTEL · YOUTUBE',            title: 'YouTube',                 icon: Play,           selfHeader: true },
  newsletter_intel:   { eyebrow: 'INTEL · NEWSLETTER',         title: 'Newsletter Intel',        icon: Mail,           selfHeader: true },
  tech_stack:         { eyebrow: 'INTEL · TECH STACK',         title: 'Tech Stack',              icon: Layers,         selfHeader: true },
  autofix_queue:      { eyebrow: 'CONTENT · AUTO-FIX',         title: 'Auto-Fix Queue',          icon: Wrench,         selfHeader: true },
  feature_directory:  { eyebrow: 'TOOLS · DIRECTORY',          title: 'Feature Directory',       icon: Compass,        selfHeader: true },
}

// Tabs whose own bespoke hero header is canonical — derived from KOTOIQ_TAB_META
// so the meta file stays the single source of truth.
export const KOTOIQ_TABS_WITH_OWN_HEADER = new Set(
  Object.entries(KOTOIQ_TAB_META)
    .filter(([, meta]) => meta.selfHeader === true)
    .map(([key]) => key),
)
