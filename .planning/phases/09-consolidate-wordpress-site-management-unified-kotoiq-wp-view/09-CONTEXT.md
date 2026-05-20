# Phase 9: Consolidate WordPress Site Management — Unified /kotoiq-wp View

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Source:** Inline (auto-approve mode — no discuss-phase needed; full context captured here)

<domain>
## Phase Boundary

Today there are **three overlapping routes** that all manage KotoIQ-paired WordPress sites:

1. **`/control-center`** (`src/views/ControlCenterPage.jsx`) — fleet/admin view across the agency:
   - Table of every site (client + URL + status pills + version + modules + last-seen)
   - Per-site actions: ping, push update, open WP admin
   - Fleet actions: refresh all, bulk push updates
   - Stats strip: total sites, Koto-live, WPSC-paired, fully-managed, active-24h
   - Module-toggle chips per site
   - Outdated-version pills + push-update buttons (routes through `/api/kotoiq-manifest` or `/api/wpsc-manifest` based on `wpsc_plugin` column)

2. **`/wpsimplecode`** (`src/views/WPSimpleCodePage.jsx`) — legacy per-client view (3 tabs):
   - Clients-first left rail (collapsible)
   - Per-site sub-header: name + URL + version + status pills + Disconnect
   - 3 tabs: Search & Replace, Snippets, Access
   - AddSiteModal for pairing new sites

3. **`/kotoiq-sites`** (`src/views/KotoIQSitesPage.jsx`) — new per-client view (6 tabs):
   - Identical rail + sub-header
   - 6 tabs: Search & Replace, Snippets, Access, Builder (Elementor), Rotation, SEO
   - Same AddSiteModal pattern
   - Tabs render disabled-with-tooltip when a module is toggled off

Phase 9 collapses these into **ONE route** with a strategic, easy-to-use layout that handles:
- **Fleet ops** (today's `/control-center` capabilities)
- **Per-client deep dives** (today's `/kotoiq-sites` 6-tab capabilities)
- **Onboarding** (`AddSiteModal` for pairing new sites)

Old routes redirect to the new one during a transition window; `/wpsimplecode` is retired entirely.

</domain>

<decisions>
## Implementation Decisions (locked)

### Route
- **New canonical route:** `/kotoiq-wp` (mounted in `src/app/App.jsx`)
- **Redirect routes** (during transition window):
  - `/control-center` → `/kotoiq-wp?view=fleet`
  - `/kotoiq-sites` → `/kotoiq-wp?view=client`
- **Retire entirely:** `/wpsimplecode` route deleted, file `src/views/WPSimpleCodePage.jsx` deleted. Sidebar link removed.

### Information Architecture
- **Two-view toggle** at top of the page: **Fleet** (default) and **Client**
- **Fleet view** is the current Control Center table — re-styled with Unified brand
- **Client view** is the current KotoIQSitesPage rail + 6-tab pattern — re-styled with Unified brand
- Clicking a site row in Fleet view auto-switches to Client view with that site pre-selected
- Query param `?view=fleet|client` + `?site=<id>` deep-link to either state
- View toggle persists via `localStorage.kotoiq_wp_view`

### Brand (Unified Marketing palette)
- **Navy primary:** `#201b51`
- **Pink accent:** `#cb1c6b`
- **Cream background:** `#faf9f6`
- **Lines/borders:** `#e9e6dd` (cream-tinted neutral, not pure gray)
- **Muted text:** `#6b7280`
- **Pull from existing tokens:** `R` (pink), `BLK` (navy), and add cream + line constants inline (matches `src/views/KotoIQSitesPage.jsx` precedent)
- Match the hero/card/CTA patterns established in `wp-plugin-kotoiq/includes/admin.php` — same gradient hero, same stat strip, same module cards, same CTA banner.

### Sidebar
- Add **new** NavLink: `KotoIQ WP` → `/kotoiq-wp` (with `Globe` or `Code2` icon, `NEW` badge in pink)
- Remove `WPSimpleCode` NavLink (line 477 of `src/components/Sidebar.jsx`)
- Remove `Control Center` NavLink (line 478) — its function lives at `/kotoiq-wp?view=fleet`
- Keep `KotoIQ Sites` NavLink temporarily — it now redirects, harmless until the next cleanup

### Components to extract
The new page is large enough to warrant component extraction (vs. one 700-line view file):
- `src/views/KotoIQWPPage.jsx` — top-level page with view toggle, breadcrumb, AddSiteModal
- `src/components/kotoiq-wp/FleetView.jsx` — extracted from ControlCenterPage's table + stats + bulk push
- `src/components/kotoiq-wp/ClientView.jsx` — extracted from KotoIQSitesPage's rail + tabs (reuses existing panel components verbatim)
- `src/components/kotoiq-wp/ViewToggle.jsx` — segmented control (Fleet | Client)
- `src/components/kotoiq-wp/SitesTable.jsx` — reusable table fragment used by FleetView (extracted from ControlCenterPage)
- `src/components/kotoiq-wp/StatsStrip.jsx` — fleet stats strip (extracted from ControlCenterPage)
- Re-use existing panel components untouched:
  - `src/components/kotoiq/SearchReplacePanel.jsx`
  - `src/components/kotoiq/SnippetsPanel.jsx`
  - `src/components/kotoiq/AccessManagementPanel.jsx`
  - `src/components/kotoiq/ElementorBuilderPanel.jsx`
  - `src/components/kotoiq/ContentRotationPanel.jsx`
  - `src/components/kotoiq/SEOPanel.jsx`
  - `src/components/kotoiq/WPSCConnectionGate.jsx`

### Strategic UX choices
- **Default to Fleet view** on first visit — agency users almost always need "what's the state of my fleet?" first.
- **One-click drill-down**: clicking any site row in Fleet view switches to Client view + pre-selects that site.
- **Sticky context bar** at the top in Client view: shows agency name → client name → site URL → current tab. Lets users orient at a glance.
- **Search/filter bar** at the top of Fleet view (carried over from ControlCenterPage).
- **Bulk-update button** in Fleet view header (carried over).
- **Disconnect** button shown in Client view sub-header for the selected site.
- **AddSiteModal** accessible from either view via a single "+ Connect a site" button.

### Claude's Discretion
- Exact pixel widths for rail / tabs / table columns — pick reasonable defaults matching existing screens.
- Whether to animate the view toggle transition (small fade is fine; skip if it adds complexity).
- Whether to add a per-row "open Client view" icon button OR rely on click-anywhere-on-row (recommend the latter — fewer clicks).
- Mobile/responsive behavior — defer to Phase 10; this phase targets desktop ≥1024px.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing UI files (the three pages being consolidated)
- `src/views/ControlCenterPage.jsx` — fleet view source-of-truth
- `src/views/KotoIQSitesPage.jsx` — client view source-of-truth (6 tabs + rail)
- `src/views/WPSimpleCodePage.jsx` — legacy 3-tab view (to be deleted)

### Existing panel components (reused, untouched)
- `src/components/kotoiq/SearchReplacePanel.jsx`
- `src/components/kotoiq/SnippetsPanel.jsx`
- `src/components/kotoiq/AccessManagementPanel.jsx`
- `src/components/kotoiq/ElementorBuilderPanel.jsx`
- `src/components/kotoiq/ContentRotationPanel.jsx`
- `src/components/kotoiq/SEOPanel.jsx`
- `src/components/kotoiq/WPSCConnectionGate.jsx`

### Brand palette + layout precedent
- `wp-plugin-kotoiq/includes/admin.php` (lines ~125-185) — Unified Marketing brand tokens + hero/stats/modules CSS
- `src/styles/koto-tokens.ts` — design tokens (navy, pink, cream)
- `src/lib/theme.ts` — `R`, `T`, `BLK`, `GRY`, `GRN`, `AMB`, `FH`, `FB` exports

### Routing + sidebar
- `src/app/App.jsx` (~line 412) — `/wpsimplecode` + `/kotoiq-sites` + `/control-center` route entries
- `src/components/Sidebar.jsx` (~line 477) — NavLink entries to remove/add

### Proxy + DB
- `src/app/api/wp/route.ts` — every `wpsc_*` + `kotoiq_*` action the panels call (no changes expected; new page reuses the same actions)
- DB column `koto_wp_sites.wpsc_plugin` ('kotoiq' | 'wpsimplecode') — used by isOutdated() manifest routing

</canonical_refs>

<specifics>
## Specific Examples

- View toggle visual: navy-pill segmented control, pink underline on active, similar to the existing tab styling in KotoIQSitesPage but at page-header level instead of per-site level.
- Stats strip cards: cream `#faf9f6` background, navy headline number, pink accent for "active" / "outdated" metrics — copy the pattern from `wp-plugin-kotoiq/includes/admin.php`.
- Empty state in Client view (no site selected): mirror current KotoIQSitesPage empty state but say "Pick a client to manage their WordPress integration, or [switch to Fleet view] to see everything at once."
- Outdated badge in Fleet table row: pink pill `→ v{manifest.latest_version}` (already implemented in ControlCenterPage — port verbatim).

</specifics>

<deferred>
## Deferred Ideas (out of scope)

- Mobile/responsive layout — handled in a follow-up phase
- Sites grouped/filtered by client folder/tag — current schema doesn't support tags
- Activity log / audit trail per site — separate phase
- Per-site "site health" score — separate phase
- Bulk delete / bulk unpair — risky, intentionally not added
- Inline site rename — defer to a settings sub-panel

</deferred>

---

*Phase: 09-consolidate-wordpress-site-management-unified-kotoiq-wp-view*
*Context gathered: 2026-05-20 (inline, auto-approve mode)*
