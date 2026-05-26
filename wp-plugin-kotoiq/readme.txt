=== KotoIQ ===
Contributors: koto
Tags: agency, search and replace, code snippets, role management, elementor, remote control
Requires at least: 5.8
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 3.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

One plugin for KotoIQ-managed WordPress sites — search & replace, code snippets, access management, Elementor read/write, and content rotation.

== Description ==

KotoIQ is the single plugin agencies install on every WordPress site they manage. It replaces the separate WPSimpleCode + Koto Builder plugin pair with one module-loader-driven plugin where every feature can be toggled from the KotoIQ Control Center.

= Modules =

* **Search & Replace** — serialized-safe site-wide find/replace with chunked scanning and a 1-click undo journal.
* **Snippets** — PHP / HTML / JS / CSS snippet manager with per-snippet role gating and per-location execution (head, footer, admin, frontend, everywhere).
* **Access Management** — per-role permission matrix for PHP snippets, file editor, theme editor, plugin editor, conversion pixels, and access management itself. Runtime cap filter enforces denials even on roles WordPress would otherwise grant.
* **Elementor Builder** — REST endpoints to detect Elementor version, list edited pages, read `_elementor_data`, write via `Document::save()`, and clone pages. Page Factory clone flow writes RankMath SEO meta + body content with `[koto_rotate]` shortcodes. Conditionally registers — module is enabled-but-inactive on sites without Elementor.
* **Content Rotation** — `[koto_rotate]` shortcode that rotates between N content variants with per-post cache TTL.

= Module loader =

Every module registers via `koto_register_module()` and guards its routes with `koto_is_module_enabled()`. Toggle them on/off from the KotoIQ dashboard (or WP admin → KotoIQ → Settings → Modules). Disabled modules don't load REST routes or runtime hooks, but their stored data is preserved.

= REST API =

All endpoints register under both `/wp-json/kotoiq/v1/*` (canonical) and `/wp-json/wpsimplecode/v1/*` (back-compat with the legacy WPSimpleCode-paired Control Center proxy). Both namespaces resolve to the same handlers.

= Remote Control =

Off by default. Site owner opts in on **KotoIQ → Settings**: enable remote control, paste the KotoIQ Control Center host as the Allowed Host, copy the auto-generated API key, then pair the site from the dashboard.

== Installation ==

1. Upload `kotoiq` to `/wp-content/plugins/`, or install through the Plugins screen.
2. Activate the plugin.
3. Visit **KotoIQ → Settings** to view the auto-generated API key and (optionally) enable remote control.

If upgrading from WPSimpleCode 1.2.0: KotoIQ uses the same option keys (`wpsc_api_key`, `wpsc_remote_allowed`, etc.), so your existing Control Center pairing keeps working — deactivate WPSimpleCode (but don't Delete it) before activating KotoIQ to keep the API key and snippets intact.

== Frequently Asked Questions ==

= Is the PHP snippet runner safe? =

Snippet execution is gated by the `execute_php_snippets` capability, the per-snippet role list, and the manage_snippets cap on save. By default only administrators have these. We recommend using text-only snippets for any role that shouldn't run arbitrary code.

= Will search & replace break my site? =

Live mode writes an undo journal before changing anything. Preview mode (dry-run) shows you exactly what would change before you commit.

= Does this plugin call home? =

No outbound HTTP requests are made by default. Remote control is opt-in and only accepts requests from the host you configure.

= What happens if Elementor isn't installed? =

The Elementor Builder module appears in the modules list but doesn't register its REST routes. /meta still reports the module so the dashboard can show it as available-but-inactive.

== Changelog ==

= 2.0.0 =
* Initial release as KotoIQ — unified replacement for WPSimpleCode 1.2.0 + the legacy koto-builder-endpoints.php.
* All 5 modules under the module-loader contract.
* REST endpoints registered under both `kotoiq/v1` and `wpsimplecode/v1` for zero-touch Control Center compat.
* Self-update channel with sha256-verified downloads.
* Inherits `wpsc_*` option keys so existing WPSimpleCode-paired sites can deactivate-then-activate without re-pairing.
* Versioned 2.0.0 to sort above the WPSimpleCode 1.x line so Control Center stops offering 1.2.0 downgrades.

== Upgrade Notice ==

= 2.0.0 =
First release of KotoIQ. Replaces the WPSimpleCode + Koto Builder plugin pair.
