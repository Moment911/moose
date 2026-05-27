<?php
/**
 * Static-file server for the emerging llms.txt standard.
 *
 * Serves the pushed plaintext file at:
 *   /llms.txt → wp-content/uploads/kotoiq/llms.txt
 *
 * The file is composed externally by the KotoIQ dashboard (see
 * src/lib/wp-shim/llmsTxtBuilder.ts) and pushed via the file.write verb
 * at the end of every topic-campaign deploy / re-deploy. This module is
 * purely a static-file serve layer.
 *
 * Falls back to a 404 (not redirect) if the file is missing — letting
 * crawlers know the site hasn't opted into llms.txt yet. We don't fake
 * a redirect to /sitemap.xml because llms.txt and sitemap.xml are
 * different surfaces (sitemap = "everything crawl-worthy", llms.txt =
 * "what we want LLMs to cite preferentially").
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

add_action('init', function () {
    add_rewrite_rule('^llms\.txt$', 'index.php?koto_llms=1', 'top');
});

add_filter('query_vars', function ($v) { $v[] = 'koto_llms'; return $v; });

add_action('template_redirect', function () {
    if (!(int) get_query_var('koto_llms', 0)) return;
    $path = WP_CONTENT_DIR . '/uploads/kotoiq/llms.txt';
    if (!file_exists($path)) {
        status_header(404);
        header('Content-Type: text/plain; charset=UTF-8');
        echo "llms.txt not configured for this site\n";
        exit;
    }
    // 25-hour staleness check — if the dashboard stops pushing, eventually
    // serve a 410 so crawlers stop hitting an outdated map. Caller can
    // always re-push via Re-deploy all.
    $stale_threshold = 25 * HOUR_IN_SECONDS * 30; // 30 days — llms.txt is high-level + slow-moving
    if ((time() - filemtime($path)) > $stale_threshold) {
        status_header(410);
        header('Content-Type: text/plain; charset=UTF-8');
        echo "llms.txt expired (last updated > 30 days ago)\n";
        exit;
    }
    status_header(200);
    header('Content-Type: text/plain; charset=UTF-8');
    header('X-Robots-Tag: noindex, follow');
    header('Cache-Control: public, max-age=3600');
    header('ETag: "' . hash_file('sha1', $path) . '"');
    readfile($path);
    exit;
});

add_action('kotoiq_shim_activate', function () { flush_rewrite_rules(); });
add_action('kotoiq_shim_deactivate', function () { flush_rewrite_rules(); });
