=== KotoIQ Shim ===
Contributors: koto
Tags: rpc
Requires at least: 5.8
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 4.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Generic authenticated RPC shim for the KotoIQ dashboard. No business logic.

=== NOT FOR WP.ORG ===

This plugin is distributed self-hosted only via the KotoIQ self-update channel.
It is NOT intended for publication on the WordPress.org plugin directory.
Per project policy (D-Plugin-distribution USER-LOCKED), publishing to the
public directory would expose the integration to competitors.

== Description ==

A minimal WordPress plugin that exposes a single authenticated RPC endpoint
(`/wp-json/kotoiq-shim/v1/rpc`) accepting Ed25519-signed envelopes from the
KotoIQ dashboard. All business logic lives server-side in the dashboard;
this plugin is generic plumbing.

== Installation ==

1. Install via the KotoIQ dashboard's "Connect site" flow.
2. Open the pairing window in WP admin → KotoIQ Shim → Settings (Plan 11).
3. Complete pairing from the dashboard.

== Changelog ==

= 4.0.0 =
* Initial release — thin RPC shim. Verb handlers wired in subsequent updates.
