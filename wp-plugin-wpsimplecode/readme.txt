=== WPSimpleCode ===
Contributors: koto
Tags: search and replace, code snippets, role management, file editor, security
Requires at least: 5.8
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Site-wide search & replace (serialized-safe with 1-click undo), role-aware code snippet manager (PHP / text-only), and granular permission lockdown for file editor, theme editor, plugin editor, and tracking pixels.

== Description ==

WPSimpleCode bundles three site-administration tools under a single plugin and a single permissions model — designed for agencies, freelancers, and site owners who need surgical control over what each user role can do.

= Search & Replace =

* **Serialized-PHP safe** — handles `wp_options`, `wp_postmeta`, widget data and any other serialized fields without corrupting the byte-length prefixes (the bug that breaks naive `REPLACE()` queries).
* **Database Table Picker** — lists every table in your `$wpdb->prefix` namespace with text columns and row counts. Pick any subset.
* **Preview Mode** — dry-run scan returns sample diffs and totals without writing anything.
* **Large Sites Supported** — 200-row chunks paginated per table, scans 200,000+ row tables without timing out.
* **1-Click Undo** — every applied change writes a `before_value` row to an undo journal stored in `wp_options`. Restore any job from the history with one click.
* **Replace Image Sources** — works on `post_content` (Gutenberg block markup included), `postmeta`, and attachment GUIDs.
* **Case-Sensitive & Regex** — optional toggles.

= Code Snippets =

* **Three snippet types** — PHP (full-execution), HTML (output in head/footer/everywhere), and JS/CSS.
* **Per-role execute access** — restrict who can create or execute PHP snippets. Roles can be limited to text-only snippets.
* **Per-snippet read/execute roles** — Customized Snippet Access. Each snippet stores its own allowed-roles list, independent of the role default.
* **Safe activate/deactivate** — snippets execute via filter hook only when active. Errors are caught and logged.

= Access Management =

* **Permission Matrix** — per-role grants for: PHP Snippets, Snippet Management, Text-Only Snippet Access, File Editor, Theme Editor, Plugin Editor, Conversion Pixels, Access Management itself.
* **Runtime cap filter** — enforces denial even for caps WordPress would otherwise grant by default (e.g. an administrator can be denied `edit_themes`).
* **Global file-editor kill switch** — single toggle that mirrors `DISALLOW_FILE_EDIT` without touching `wp-config.php`.
* **Snapshot + revert** — capture the current role/capability state at any time and revert to it.

= Remote Control (Optional) =

WPSimpleCode can be controlled from a remote dashboard. This is **off by default** and must be explicitly enabled on the Settings page along with an API key (auto-generated on activation) and an allowed host URL. With remote control enabled, the plugin accepts authenticated REST requests under `/wp-json/wpsimplecode/v1/*` from the configured host.

== Installation ==

1. Upload `wpsimplecode` to `/wp-content/plugins/`, or install through the Plugins screen.
2. Activate the plugin.
3. Visit **WPSimpleCode → Settings** to view the auto-generated API key and (optionally) enable remote control.

== Frequently Asked Questions ==

= Is the PHP snippet runner safe? =

Snippet execution is gated by the `koto_execute_php_snippets` capability and the per-snippet role list. By default only administrators have this capability. We recommend keeping it that way and using text-only snippets for any role that shouldn't run arbitrary code.

= Will search & replace break my site? =

Search & replace always writes an undo journal before changing anything in live mode. You can restore any job to its prior state with one click. We still recommend running Preview first.

= Does this plugin call home? =

No outbound HTTP requests are made by default. Remote control is opt-in.

== Screenshots ==

1. Search & Replace with table picker and sample diffs.
2. Snippet manager with type / role / status.
3. Access Management permission matrix.
4. Settings page with API key for remote control.

== Changelog ==

= 1.0.0 =
* Initial release.
* Search & Replace with undo journal.
* Code snippet manager (PHP / HTML / JS / CSS).
* Access Management permission matrix.
* Optional remote control under `/wp-json/wpsimplecode/v1/*`.

== Upgrade Notice ==

= 1.0.0 =
First release.
