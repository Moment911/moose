<?php
/**
 * Generic static-file XML server. Serves a pushed XML at
 * /kotoiq-sitemap.xml; falls back to WP core's built-in
 * /wp-sitemap.xml when the pushed file is missing or stale.
 *
 * Sub-paths supported:
 *   /kotoiq-sitemap.xml         → wp-content/uploads/kotoiq/sitemap.xml
 *   /kotoiq-sitemap-images.xml  → wp-content/uploads/kotoiq/sitemap-images.xml
 *   /kotoiq-sitemap-videos.xml  → wp-content/uploads/kotoiq/sitemap-videos.xml
 *   /kotoiq-sitemap-posts.xml   → wp-content/uploads/kotoiq/sitemap-posts.xml
 *   /kotoiq-sitemap-faq.xml     → wp-content/uploads/kotoiq/sitemap-faq.xml
 *
 * The pushed XML is composed externally (NOT by this plugin); this file
 * is purely a static-file serve layer with a 25-hour freshness gate.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

add_action('init', function () {
    add_rewrite_rule('^kotoiq-sitemap(?:-([a-z]+))?\.xml$', 'index.php?koto_sitemap_serve=$matches[1]&koto_sitemap=1', 'top');
});

add_filter('query_vars', function ($v) { $v[] = 'koto_sitemap_serve'; $v[] = 'koto_sitemap'; return $v; });

add_action('template_redirect', function () {
    if (!(int) get_query_var('koto_sitemap', 0)) return;
    $sub  = get_query_var('koto_sitemap_serve', '');
    $sub  = is_string($sub) && preg_match('/^[a-z]{1,16}$/', $sub) ? $sub : '';
    $name = $sub ? "sitemap-{$sub}.xml" : 'sitemap.xml';
    $path = WP_CONTENT_DIR . '/uploads/kotoiq/' . $name;
    $stale_threshold = 25 * HOUR_IN_SECONDS;
    if (!file_exists($path) || (time() - filemtime($path)) > $stale_threshold) {
        wp_redirect(home_url('/wp-sitemap.xml'), 302, 'KotoIQShim');
        exit;
    }
    status_header(200);
    header('Content-Type: application/xml; charset=UTF-8');
    header('X-Robots-Tag: noindex, follow');
    header('Cache-Control: public, max-age=3600');
    header('ETag: "' . hash_file('sha1', $path) . '"');
    readfile($path);
    exit;
});

add_action('kotoiq_shim_activate', function () { flush_rewrite_rules(); });
add_action('kotoiq_shim_deactivate', function () { flush_rewrite_rules(); });
