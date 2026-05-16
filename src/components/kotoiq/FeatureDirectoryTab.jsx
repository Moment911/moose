"use client"
import { useMemo, useState } from 'react'
import { Search, Compass, ArrowUpRight, Users, Filter, X } from 'lucide-react'

// ─── Koto Design tokens (DESIGN.md) ─────────────────────────
const DISPLAY = "'Bebas Neue', 'Arial Narrow', sans-serif"
const BODY    = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
const INK     = 'var(--koto-navy)'
const DIM     = 'var(--koto-dim)'
const MID     = 'var(--koto-muted)'
const HAIR    = 'var(--koto-line)'
const SUBHAIR = 'var(--koto-line)'
const SOFT    = 'var(--koto-off)'
const PINK    = '#cb1c6b'
const PINK_LIGHT = 'rgba(203, 28, 107, 0.07)'
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)'

// ─── Feature catalog: what / when / who, keyed by nav item key ──
// Falls back to the nav item's own `desc` when a key is missing here.
// `who` is an array drawn from: 'Agency', 'Client', 'Admin'.
const FEATURE_META = {
  // ── AI ──
  ask: {
    what: 'Conversational interface that answers questions about this client\'s SEO, traffic, competitors, and recommendations.',
    when: 'When you want a quick read across data instead of clicking through tabs — "why did traffic drop last week?", "who is winning AEO?"',
    who: ['Agency'],
  },

  // ── Overview ──
  today: {
    what: 'Daily action center — cadence checklist (initial / daily / weekly / monthly) plus an animated alert feed of competitor moves.',
    when: 'Open every morning. The one tab to look at if you only have 60 seconds.',
    who: ['Agency'],
  },
  dashboard: {
    what: 'Keyword overview, top quick-win opportunities, traffic, and AI visibility score in one snapshot.',
    when: 'When you want the high-level picture of this client\'s SEO state.',
    who: ['Agency', 'Client'],
  },
  competitor_pulse: {
    what: 'Unified timeline of every competitor move detected by every engine — pages, pricing, ads, YouTube, newsletters, tech stack.',
    when: 'Daily landing page for monitoring competitive activity across all channels.',
    who: ['Agency'],
  },
  keywords: {
    what: 'Every discovered and tracked keyword with volume, difficulty, intent, and current rank.',
    when: 'When researching opportunities or pruning weak terms.',
    who: ['Agency'],
  },
  ranks: {
    what: 'Live Google ranking positions pulled from Search Console — trend lines, movers, and SERP feature gains.',
    when: 'Tracking whether SEO work is moving the needle.',
    who: ['Agency', 'Client'],
  },
  topical_authority: {
    what: 'Domain authority score plus topical-relevance breakdown — which subject areas Google trusts this site for.',
    when: 'Choosing what content to invest in. High-authority topics convert better.',
    who: ['Agency'],
  },

  // ── Ads Intelligence ──
  ads_overview: { what: 'Google Ads spend, CTR, conversions, and CPA at a glance.', when: 'Daily ad-account check.', who: ['Agency'] },
  ads_search_terms: { what: 'Search terms actually triggering ads — including the long-tail Google hides in the UI.', when: 'Mining negative keywords and new exact-match additions.', who: ['Agency'] },
  ads_wasted_spend: { what: 'Spend on terms that never convert — quantified, ranked, and ready to negative.', when: 'Monthly cleanup. Big winning bucket for cost cuts.', who: ['Agency'] },
  ads_anomalies: { what: 'Sudden spend, CPC, or volume changes that look unusual against the trailing baseline.', when: 'Catching a runaway campaign before the month ends.', who: ['Agency'] },
  ads_intent_gaps: { what: 'Search queries with conversion intent that ads don\'t currently cover.', when: 'Expanding paid coverage into high-intent gaps.', who: ['Agency'] },
  ads_ad_builder: { what: 'AI-assisted RSA copy generation with headline + description variants.', when: 'Launching a new campaign or testing fresh creative.', who: ['Agency'] },
  ads_recommendations: { what: 'Concrete next-action recommendations across structure, bids, copy, and budget.', when: 'Weekly ads review meeting.', who: ['Agency'] },
  ads_reports: { what: 'Exportable ad reports for client meetings.', when: 'Monthly reporting cycle.', who: ['Agency', 'Client'] },
  budget_forecast: { what: 'Projects budget burn and forecasted conversions for the rest of the month.', when: 'Mid-month pacing check.', who: ['Agency'] },

  // ── Behavior Analytics ──
  behavior: {
    what: 'Hotjar / Clarity-style session insights — rage clicks, dead clicks, scroll depth, and friction points.',
    when: 'Diagnosing why a page with good traffic doesn\'t convert.',
    who: ['Agency'],
  },

  // ── Competitor Intel ──
  competitor_pages: { what: 'Daily snapshots of every tracked competitor page plus a Claude-powered noise filter that surfaces the meaningful changes only.', when: 'Catching launches, repositioning, or pricing changes early.', who: ['Agency'] },
  pricing_tracker: { what: 'Tier-level price and promo timeline for each competitor — detects increases, intro offers, and packaging changes.', when: 'Pricing strategy reviews or whenever a competitor moves.', who: ['Agency'] },
  competitor_ads: { what: 'Meta Ads Library creatives currently running for each competitor.', when: 'Reverse-engineering what hooks are working in the category.', who: ['Agency'] },
  competitor_youtube: { what: 'Competitor YouTube channels — recent uploads, view counts, and posting cadence.', when: 'Spotting which competitors invested in video and what\'s landing.', who: ['Agency'] },
  newsletter_intel: { what: 'Captures and classifies every email each competitor sends — promotional, onboarding, retention.', when: 'Studying the customer journey end to end.', who: ['Agency'] },
  tech_stack: { what: 'Detected CMS, ESP, analytics, chat, ad pixels, and other front-end tech per competitor.', when: 'Sales discovery or competitive teardown.', who: ['Agency'] },
  competitor_watch: { what: 'Legacy alerts feed — superseded by Pulse but kept for historical alerts.', when: 'Reviewing older alert history.', who: ['Agency'] },
  competitors: { what: 'List of tracked competitors with edit/add/remove controls.', when: 'Setting up or maintaining the competitor set.', who: ['Agency'] },
  competitor_map: { what: 'Geographic map of competitor locations and service-area overlap.', when: 'Local-business strategy and territory analysis.', who: ['Agency'] },
  scorecard: { what: 'Side-by-side score comparison of this client against tracked competitors across SEO dimensions.', when: 'Quarterly business reviews.', who: ['Agency', 'Client'] },

  // ── AI Search ──
  aeo_visibility: {
    what: 'Share-of-Voice tracker across 5 LLM engines (ChatGPT, Perplexity, Claude, Gemini, Copilot) — Profound-style continuous scan.',
    when: 'Tracking whether you show up in answer-engine results for the prompts your buyers ask.',
    who: ['Agency', 'Client'],
  },
  aeo: { what: 'Research mode for AEO — probe specific prompts on demand and inspect the citations the LLMs returned.', when: 'Ad-hoc visibility checks.', who: ['Agency'] },
  aeo_multi: { what: 'Multi-engine composite AEO score across all 5 LLMs.', when: 'Single-number summary for reports.', who: ['Agency', 'Client'] },
  brand_serp: { what: 'What the Google SERP for the brand name itself looks like — knowledge panel, sitelinks, reputation surface.', when: 'Reputation audits and rebrand checks.', who: ['Agency'] },

  // ── Authority ──
  backlinks: { what: 'All inbound links pointing to this domain with authority and anchor-text breakdown.', when: 'Link audit or disavow review.', who: ['Agency'] },
  backlink_opps: { what: 'Sites that link to your competitors but not to you — the easiest link wins.', when: 'Building a monthly outreach list.', who: ['Agency'] },
  eeat: { what: 'Experience / Expertise / Authoritativeness / Trust signal audit — what Google\'s reviewers look at.', when: 'YMYL pages or post-update recoveries.', who: ['Agency'] },
  knowledge_graph: { what: 'Entity / knowledge-panel presence and the connections Google has made for this brand.', when: 'Entity SEO and Wikipedia-adjacent work.', who: ['Agency'] },
  query_paths: { what: 'How users get from a query to a conversion across pages and sessions.', when: 'Mapping intent journeys for content planning.', who: ['Agency'] },

  // ── Strategy ──
  strategy: {
    what: 'Long-range strategic plan — pillars, sprints, and bets — generated from this client\'s data and updated as it changes.',
    when: 'Quarterly planning or onboarding a new client.',
    who: ['Agency', 'Client'],
  },

  // ── Content ──
  autopilot: { what: 'Closed-loop content loop — discover gaps, brief, generate, publish, monitor, refresh.', when: 'When you\'re ready to let the system run with human approval gates.', who: ['Agency'] },
  briefs: { what: 'PageIQ — generates a full content brief plus a multi-variant page draft from a target keyword.', when: 'Every new service or location page.', who: ['Agency'] },
  hyperlocal: { what: 'Generates location-specific content variants tailored to city, neighborhood, and ZIP signals.', when: 'Local SEO at scale.', who: ['Agency'] },
  topical_map: { what: 'Visual map of topic clusters and the pages covering each — exposes gaps and orphans.', when: 'Content strategy and internal-linking planning.', who: ['Agency'] },
  content_refresh: { what: 'Content-health scorecard with prioritized refresh queue for decaying pages.', when: 'Monthly content maintenance.', who: ['Agency'] },
  content_decay: { what: 'Predicts which pages will lose traffic over the next 30/60/90 days based on rank slope.', when: 'Pre-empting decay before it costs sessions.', who: ['Agency'] },
  semantic: { what: 'KotoIQ\'s semantic agent network — runs deep topic-coverage analysis.', when: 'Deep audit of a single page or cluster.', who: ['Agency'] },
  context_aligner: { what: 'Aligns page content to the actual SERP\'s dominant intent and entities.', when: 'Re-writing a page that ranks but doesn\'t convert.', who: ['Agency'] },
  passage_opt: { what: 'Per-passage optimization — picks the snippet most likely to win featured-snippet or AI-citation.', when: 'Optimizing high-intent pages for SERP features.', who: ['Agency'] },
  plagiarism: { what: 'Detects duplicated or near-duplicated content across the site and the open web.', when: 'Pre-publish QA on AI-assisted content.', who: ['Agency'] },
  watermark: { what: 'Removes invisible AI watermarks from text — useful when re-using AI-generated drafts.', when: 'Polishing AI-assisted content.', who: ['Agency'] },
  calendar: { what: 'Editorial calendar with scheduled briefs, drafts, and published dates.', when: 'Content production planning.', who: ['Agency'] },

  // ── Technical ──
  activity: { what: 'Audit trail of every action taken in KotoIQ for this client.', when: 'Investigations and compliance.', who: ['Agency', 'Admin'] },
  audit: { what: 'Standard SEO audit — meta, headings, internal links, broken links, schema, performance.', when: 'New-client onboarding or quarterly health check.', who: ['Agency'] },
  on_page: { what: 'Page-level on-page audit with concrete edit recommendations.', when: 'Polishing a target page before pushing for rank.', who: ['Agency'] },
  technical_deep: { what: 'Deep technical crawl — render diff, JS-rendering issues, crawl traps, redirect chains.', when: 'When something looks structurally broken.', who: ['Agency'] },
  gsc_audit: { what: 'Deep audit of Google Search Console data — query gaps, impression vs click anomalies.', when: 'Mining GSC for opportunities the dashboard misses.', who: ['Agency'] },
  bing_audit: { what: 'Bing-specific SEO audit. Different signals matter on Bing.', when: 'Clients where Bing is a meaningful traffic source.', who: ['Agency'] },
  schema: { what: 'Schema.org markup audit and validator across the site.', when: 'Implementing rich results or troubleshooting lost ones.', who: ['Agency'] },
  internal_links: { what: 'Internal-link graph — hub pages, orphans, and recommended new links.', when: 'Boosting a target page without external links.', who: ['Agency'] },
  sitemap_crawler: { what: 'Crawls XML sitemaps and validates every URL.', when: 'Migrations or large-site indexing investigations.', who: ['Agency'] },
  jobs: { what: 'Background job queue — running, queued, completed, and failed tasks.', when: 'Debugging a stuck audit or scan.', who: ['Agency', 'Admin'] },

  // ── Local & Reviews ──
  gmb: { what: 'Google Business Profile health, posts, Q&A, and category configuration.', when: 'Weekly local-SEO check.', who: ['Agency'] },
  gmb_images: { what: 'GBP image audit — geo-tag, alt text, and freshness.', when: 'Local image-pack optimization.', who: ['Agency'] },
  rank_grid: { what: 'Rank Grid Pro — geographic grid of ranks across a service area, like a heat map.', when: 'Local-pack and service-area-business clients.', who: ['Agency'] },
  reviews: { what: 'Aggregated reviews across Google, Yelp, Facebook with sentiment and reply prompts.', when: 'Reputation management.', who: ['Agency', 'Client'] },

  // ── Builder ──
  builder: { what: 'Template builder — defines the page templates AutoPilot uses for generation.', when: 'Initial setup, then occasional template tuning.', who: ['Agency'] },

  // ── Agent ──
  agent_queue: { what: 'KotoIQ agent task queue — pending agent runs and their outputs.', when: 'When you\'ve dispatched async agent work.', who: ['Agency'] },
  agent_goals: { what: 'Long-running agent goals with milestones and progress.', when: 'Multi-week initiatives owned by the AI agents.', who: ['Agency'] },

  // ── Reports & Tools ──
  reports: { what: 'Generates and stores client-ready SEO reports.', when: 'Monthly reporting cycle.', who: ['Agency', 'Client'] },
  roi: { what: 'Revenue and ROI projections from SEO and Ads — under different growth scenarios.', when: 'Selling work and proving impact.', who: ['Agency', 'Client'] },
  visitors: { what: 'Reverse-IP / visitor-intelligence stream — companies and contexts hitting the site.', when: 'B2B clients who care about anonymous traffic.', who: ['Agency'] },
  utm: { what: 'UTM builder — generates tracked campaign URLs and saves them.', when: 'Launching any external campaign.', who: ['Agency'] },
  upwork: { what: 'Upwork proposal helper — auto-drafts proposals tuned to a job post.', when: 'Internal agency growth.', who: ['Agency'] },
  bulk_ops: { what: 'Batch operations across keywords, pages, or competitors.', when: 'When the regular UI is too click-heavy for the job.', who: ['Agency'] },
  integrations: { what: 'Typeform / Jotform / Google Forms form ingestion into KotoIQ.', when: 'Wiring lead-gen forms into the platform.', who: ['Agency'] },
  connect: { what: 'Connect Google, Meta, LinkedIn, Hotjar, Clarity, GBP, GSC OAuth integrations.', when: 'Onboarding a new client.', who: ['Agency', 'Admin'] },
}

const ALL_ROLES = ['Agency', 'Client', 'Admin']

export default function FeatureDirectoryTab({ navGroups = [], onSwitchTab = () => {} }) {
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')

  // Flatten nav into [{ key, label, Icon, group, navDesc, meta }]
  const features = useMemo(() => {
    const out = []
    for (const section of navGroups) {
      for (const item of section.items) {
        const [key, label, Icon, navDesc] = item
        out.push({
          key,
          label,
          Icon,
          group: section.group,
          navDesc: navDesc || '',
          meta: FEATURE_META[key] || null,
        })
      }
    }
    return out
  }, [navGroups])

  const groups = useMemo(() => {
    const seen = new Set()
    return features.map(f => f.group).filter(g => (seen.has(g) ? false : (seen.add(g), true)))
  }, [features])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return features.filter(f => {
      if (groupFilter !== 'all' && f.group !== groupFilter) return false
      if (roleFilter !== 'all') {
        const who = f.meta?.who || ['Agency']
        if (!who.includes(roleFilter)) return false
      }
      if (!q) return true
      const hay = [
        f.label,
        f.group,
        f.key,
        f.navDesc,
        f.meta?.what,
        f.meta?.when,
        (f.meta?.who || []).join(' '),
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [features, query, groupFilter, roleFilter])

  // Group filtered features by section for rendering
  const grouped = useMemo(() => {
    const map = new Map()
    for (const f of filtered) {
      if (!map.has(f.group)) map.set(f.group, [])
      map.get(f.group).push(f)
    }
    return Array.from(map.entries())
  }, [filtered])

  return (
    <div style={{ fontFamily: BODY, color: INK, paddingBottom: 60 }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Compass size={20} color={PINK} />
          <h1 style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 400, letterSpacing: '-0.01em', color: INK, margin: 0, lineHeight: 1.1 }}>
            Feature Directory
          </h1>
        </div>
        <div style={{ fontSize: 13, color: DIM, maxWidth: 720, lineHeight: 1.5 }}>
          Every KotoIQ tool — what it does, when to use it, and who it’s for. Search or filter to find the right tab fast.
        </div>
      </div>

      {/* ── Toolbar: search + filters ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        marginBottom: 16, padding: '12px 14px',
        background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 12,
        boxShadow: CARD_SHADOW,
      }}>
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 240 }}>
          <Search size={14} color={MID} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search features… (e.g. competitors, ads, decay)"
            style={{
              width: '100%', padding: '10px 36px 10px 34px',
              borderRadius: 8, border: `1px solid ${HAIR}`,
              fontSize: 13, fontFamily: BODY, color: INK,
              outline: 'none', background: SOFT,
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', padding: 4, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={14} color={MID} />
            </button>
          )}
        </div>

        <FilterSelect
          icon={<Filter size={13} color={MID} />}
          label="Group"
          value={groupFilter}
          onChange={setGroupFilter}
          options={[['all', 'All groups'], ...groups.map(g => [g, g])]}
        />

        <FilterSelect
          icon={<Users size={13} color={MID} />}
          label="Role"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[['all', 'All roles'], ...ALL_ROLES.map(r => [r, r])]}
        />

        <div style={{ marginLeft: 'auto', fontSize: 12, color: MID }}>
          {filtered.length} of {features.length} features
        </div>
      </div>

      {/* ── Results ── */}
      {grouped.length === 0 && (
        <div style={{
          padding: '40px 20px', textAlign: 'center', color: DIM, fontSize: 13,
          background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 12,
        }}>
          No features match that filter. Try clearing search or switching to <span style={{ color: INK, fontWeight: 600 }}>All groups</span>.
        </div>
      )}

      {grouped.map(([group, items]) => (
        <section key={group} style={{ marginBottom: 26 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${SUBHAIR}`,
          }}>
            <h2 style={{
              fontFamily: DISPLAY, fontSize: 22, fontWeight: 400, color: INK,
              margin: 0, letterSpacing: '-0.005em',
            }}>
              {group}
            </h2>
            <div style={{ fontSize: 11, color: MID, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {items.length} {items.length === 1 ? 'tool' : 'tools'}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 12,
          }}>
            {items.map(f => (
              <FeatureCard key={`${group}:${f.key}`} feature={f} onOpen={() => onSwitchTab(f.key)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
function FeatureCard({ feature, onOpen }) {
  const { label, Icon, navDesc, meta } = feature
  const what = meta?.what || navDesc || 'No description yet.'
  const when = meta?.when
  const who  = meta?.who || ['Agency']

  return (
    <button
      onClick={onOpen}
      style={{
        textAlign: 'left', cursor: 'pointer',
        background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 12,
        padding: '16px 16px 14px', boxShadow: CARD_SHADOW,
        display: 'flex', flexDirection: 'column', gap: 10,
        fontFamily: BODY, color: INK,
        transition: 'border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = PINK
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = HAIR
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: PINK_LIGHT, color: PINK,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {Icon ? <Icon size={16} /> : <Compass size={16} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK, lineHeight: 1.25 }}>
            {label}
          </div>
        </div>
        <ArrowUpRight size={14} color={MID} style={{ flexShrink: 0, marginTop: 2 }} />
      </div>

      <div style={{ fontSize: 12.5, color: DIM, lineHeight: 1.5 }}>
        {what}
      </div>

      {when && (
        <div style={{ fontSize: 11.5, color: MID, lineHeight: 1.5, paddingTop: 6, borderTop: `1px solid ${SUBHAIR}` }}>
          <span style={{ color: INK, fontWeight: 600 }}>When: </span>{when}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        {who.map(role => (
          <span key={role} style={{
            fontSize: 10.5, fontWeight: 600,
            padding: '3px 7px', borderRadius: 999,
            background: SOFT, color: DIM,
            border: `1px solid ${HAIR}`,
            letterSpacing: '0.02em',
          }}>
            {role}
          </span>
        ))}
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
function FilterSelect({ icon, label, value, onChange, options }) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 10px', borderRadius: 8,
      background: SOFT, border: `1px solid ${HAIR}`,
      fontSize: 12, color: DIM, cursor: 'pointer',
    }}>
      {icon}
      <span style={{ color: MID, fontWeight: 500 }}>{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          border: 'none', background: 'transparent', outline: 'none',
          fontFamily: BODY, fontSize: 12, fontWeight: 600, color: INK,
          cursor: 'pointer', paddingRight: 4,
        }}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  )
}
