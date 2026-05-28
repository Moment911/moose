<?php
/**
 * IndexNow — instant URL submission to Bing / Yandex / Seznam (and Google is
 * evaluating it). Two responsibilities, both fully self-contained in the plugin
 * (no dashboard key-sync needed):
 *
 *   1. Serve the verification key file at the site root:
 *        /{key}.txt → the key (search engines fetch this to confirm ownership)
 *   2. Auto-submit URLs to IndexNow whenever a post/page is published or
 *      updated — including the pages the KotoIQ dashboard deploys via REST,
 *      since those trigger transition_post_status here.
 *
 * The key is generated once and stored in the kotoiq_indexnow_key option.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

add_action('init', function () {
    // Serve /{32-hex}.txt as the IndexNow verification key.
    add_rewrite_rule('^([a-f0-9]{32})\.txt$', 'index.php?koto_indexnow_key=$matches[1]', 'top');
    // Generate the key once.
    if (!get_option('kotoiq_indexnow_key')) {
        update_option('kotoiq_indexnow_key', bin2hex(random_bytes(16)), false);
    }
});

add_filter('query_vars', function ($v) { $v[] = 'koto_indexnow_key'; return $v; });

add_action('template_redirect', function () {
    $requested = (string) get_query_var('koto_indexnow_key', '');
    if ($requested === '') return;
    $stored = (string) get_option('kotoiq_indexnow_key', '');
    if ($stored === '' || !hash_equals($stored, $requested)) {
        status_header(404);
        header('Content-Type: text/plain; charset=UTF-8');
        echo "not found\n";
        exit;
    }
    status_header(200);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: public, max-age=86400');
    echo $stored;
    exit;
});

// Auto-submit to IndexNow on publish/update of a public post or page.
add_action('transition_post_status', function ($new_status, $old_status, $post) {
    if ($new_status !== 'publish') return;
    if (!isset($post->post_type) || !in_array($post->post_type, ['post', 'page'], true)) return;
    if (wp_is_post_revision($post) || wp_is_post_autosave($post)) return;

    $key = (string) get_option('kotoiq_indexnow_key', '');
    if ($key === '') return;
    $url = get_permalink($post);
    if (!$url) return;
    $host = wp_parse_url($url, PHP_URL_HOST);
    if (!$host) return;

    $payload = wp_json_encode([
        'host'        => $host,
        'key'         => $key,
        'keyLocation' => home_url('/' . $key . '.txt'),
        'urlList'     => [$url],
    ]);

    // Fire-and-forget — never block the publish request on IndexNow.
    wp_remote_post('https://api.indexnow.org/indexnow', [
        'headers'  => ['Content-Type' => 'application/json; charset=utf-8'],
        'body'     => $payload,
        'timeout'  => 5,
        'blocking' => false,
    ]);
}, 10, 3);

add_action('kotoiq_shim_activate', function () { flush_rewrite_rules(); });
add_action('kotoiq_shim_deactivate', function () { flush_rewrite_rules(); });
