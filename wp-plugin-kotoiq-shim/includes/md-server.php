<?php
/**
 * Static-file server for Markdown twins + the full-content LLM export.
 *
 * Serves, from wp-content/uploads/kotoiq/ (composed + pushed by the KotoIQ
 * dashboard at deploy time, see src/lib/wp-shim/mdTwinBuilder.ts):
 *
 *   /{slug}.md        → uploads/kotoiq/md/{slug}.md   (one page's Markdown twin)
 *   /llms-full.txt    → uploads/kotoiq/llms-full.txt  (every page's Markdown,
 *                                                       the companion to /llms.txt)
 *
 * AI crawlers (claudebot, GPTBot, Perplexity, etc.) extract content far more
 * reliably from Markdown than from styled HTML. Twins are served noindex,follow
 * so they don't compete with the canonical HTML page for indexing.
 *
 * Pure static-file serve layer — never generates content. 404 when a file is
 * missing (the site simply hasn't deployed that page's twin yet).
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

add_action('init', function () {
    // Full-content export at the site root.
    add_rewrite_rule('^llms-full\.txt$', 'index.php?koto_llms_full=1', 'top');
    // Per-page Markdown twin: /{slug}.md (slug is a single path segment).
    add_rewrite_rule('^([a-z0-9-]+)\.md$', 'index.php?koto_md_slug=$matches[1]', 'top');
});

add_filter('query_vars', function ($v) {
    $v[] = 'koto_llms_full';
    $v[] = 'koto_md_slug';
    return $v;
});

if (!function_exists('kotoiq_shim_serve_static')) {
    /**
     * Serve a static file with crawler-friendly headers, or 404 if missing.
     * @param string $path        absolute filesystem path
     * @param string $ctype       Content-Type header value
     * @param int    $stale_secs  if > 0, serve 410 once the file is older than this
     */
    function kotoiq_shim_serve_static($path, $ctype, $stale_secs = 0) {
        if (!file_exists($path)) {
            status_header(404);
            header('Content-Type: text/plain; charset=UTF-8');
            echo "not found\n";
            exit;
        }
        if ($stale_secs > 0 && (time() - filemtime($path)) > $stale_secs) {
            status_header(410);
            header('Content-Type: text/plain; charset=UTF-8');
            echo "expired\n";
            exit;
        }
        status_header(200);
        header('Content-Type: ' . $ctype);
        header('X-Robots-Tag: noindex, follow');
        header('Cache-Control: public, max-age=3600');
        header('ETag: "' . hash_file('sha1', $path) . '"');
        readfile($path);
        exit;
    }
}

add_action('template_redirect', function () {
    // /llms-full.txt — 30-day staleness gate (matches /llms.txt behaviour).
    if ((int) get_query_var('koto_llms_full', 0)) {
        $path = WP_CONTENT_DIR . '/uploads/kotoiq/llms-full.txt';
        kotoiq_shim_serve_static($path, 'text/plain; charset=UTF-8', 30 * DAY_IN_SECONDS);
    }

    // /{slug}.md — per-page Markdown twin. Sanitize the slug hard (only
    // [a-z0-9-]) so it can never escape the md/ directory.
    $slug = (string) get_query_var('koto_md_slug', '');
    if ($slug !== '') {
        $slug = preg_replace('/[^a-z0-9-]/', '', strtolower($slug));
        if ($slug === '') {
            status_header(404);
            header('Content-Type: text/plain; charset=UTF-8');
            echo "not found\n";
            exit;
        }
        $path = WP_CONTENT_DIR . '/uploads/kotoiq/md/' . $slug . '.md';
        kotoiq_shim_serve_static($path, 'text/markdown; charset=UTF-8');
    }
});

add_action('kotoiq_shim_activate', function () { flush_rewrite_rules(); });
add_action('kotoiq_shim_deactivate', function () { flush_rewrite_rules(); });
