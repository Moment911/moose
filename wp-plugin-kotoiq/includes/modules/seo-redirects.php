<?php
/**
 * SEO Redirects & 404 Monitor — Rank Math Pro-style redirect manager.
 *
 * Features:
 *   - 301/302/307 redirect rules stored in wp_options
 *   - 404 error logging with URL, referrer, user agent, timestamp
 *   - REST endpoints for managing redirects from KotoIQ dashboard
 *   - Auto-redirect on slug change
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

define('KOTOIQ_REDIRECTS_OPTION', 'kotoiq_seo_redirects');
define('KOTOIQ_404_LOG_OPTION', 'kotoiq_seo_404_log');
define('KOTOIQ_404_LOG_MAX', 500);

// ── Handle redirects on template_redirect ───────────────────────────────
add_action('template_redirect', function () {
    if (!koto_is_module_enabled('seo')) return;
    if (is_admin()) return;

    $request_uri = $_SERVER['REQUEST_URI'] ?? '';
    $path = parse_url($request_uri, PHP_URL_PATH);
    if (!$path) return;

    $redirects = get_option(KOTOIQ_REDIRECTS_OPTION, []);
    if (!is_array($redirects)) return;

    foreach ($redirects as $rule) {
        if (empty($rule['from']) || empty($rule['to']) || !empty($rule['disabled'])) continue;

        $from = '/' . ltrim($rule['from'], '/');
        $type = (int) ($rule['type'] ?? 301);

        // Exact match
        if ($path === $from || rtrim($path, '/') === rtrim($from, '/')) {
            wp_redirect($rule['to'], $type);
            exit;
        }

        // Regex match (if from starts with ^)
        if (substr($rule['from'], 0, 1) === '^') {
            if (preg_match('#' . $rule['from'] . '#', $path, $matches)) {
                $target = preg_replace('#' . $rule['from'] . '#', $rule['to'], $path);
                wp_redirect($target, $type);
                exit;
            }
        }
    }

    // Log 404s
    if (is_404()) {
        kotoiq_log_404($request_uri);
    }
}, 1);

function kotoiq_log_404($url) {
    $log = get_option(KOTOIQ_404_LOG_OPTION, []);
    if (!is_array($log)) $log = [];

    array_unshift($log, [
        'url'       => $url,
        'referrer'  => $_SERVER['HTTP_REFERER'] ?? '',
        'ua'        => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200),
        'ip'        => substr($_SERVER['REMOTE_ADDR'] ?? '', 0, 45),
        'time'      => current_time('c'),
    ]);

    $log = array_slice($log, 0, KOTOIQ_404_LOG_MAX);
    update_option(KOTOIQ_404_LOG_OPTION, $log, false);
}

// ── Auto-redirect on slug change ────────────────────────────────────────
add_action('post_updated', function ($post_id, $post_after, $post_before) {
    if (!koto_is_module_enabled('seo')) return;
    if ($post_before->post_name === $post_after->post_name) return;
    if ($post_after->post_status !== 'publish') return;

    $old_url = '/' . $post_before->post_name;
    $new_url = get_permalink($post_id);

    $redirects = get_option(KOTOIQ_REDIRECTS_OPTION, []);
    if (!is_array($redirects)) $redirects = [];

    // Check if redirect already exists
    foreach ($redirects as $r) {
        if (rtrim($r['from'], '/') === rtrim($old_url, '/')) return;
    }

    $redirects[] = [
        'from'    => $old_url,
        'to'      => $new_url,
        'type'    => 301,
        'note'    => 'Auto-created: slug changed from "' . $post_before->post_name . '" to "' . $post_after->post_name . '"',
        'created' => current_time('c'),
        'auto'    => true,
    ];

    update_option(KOTOIQ_REDIRECTS_OPTION, $redirects);
}, 10, 3);

// ── REST endpoints ──────────────────────────────────────────────────────
add_action('rest_api_init', function () {
    if (!koto_is_module_enabled('seo')) return;

    $routes = [
        ['/seo/redirects',     'GET',    'kotoiq_seo_redirects_list'],
        ['/seo/redirects',     'POST',   'kotoiq_seo_redirects_save'],
        ['/seo/redirects/add', 'POST',   'kotoiq_seo_redirects_add'],
        ['/seo/404-log',       'GET',    'kotoiq_seo_404_log_list'],
        ['/seo/404-log/clear', 'POST',   'kotoiq_seo_404_log_clear'],
    ];

    foreach ($routes as [$path, $method, $callback]) {
        kotoiq_register_rest_route($path, [
            'methods'             => $method,
            'callback'            => $callback,
            'permission_callback' => $method === 'GET' ? 'kotoiq_perm_read' : 'kotoiq_perm_write',
        ]);
    }
});

function kotoiq_seo_redirects_list() {
    return rest_ensure_response([
        'redirects' => get_option(KOTOIQ_REDIRECTS_OPTION, []),
        'total'     => count(get_option(KOTOIQ_REDIRECTS_OPTION, [])),
    ]);
}

function kotoiq_seo_redirects_save($request) {
    $params = $request->get_json_params();
    $redirects = $params['redirects'] ?? [];
    update_option(KOTOIQ_REDIRECTS_OPTION, $redirects);
    return rest_ensure_response(['ok' => true, 'total' => count($redirects)]);
}

function kotoiq_seo_redirects_add($request) {
    $params = $request->get_json_params();
    $from = sanitize_text_field($params['from'] ?? '');
    $to   = esc_url_raw($params['to'] ?? '');
    $type = (int) ($params['type'] ?? 301);
    $note = sanitize_text_field($params['note'] ?? '');

    if (!$from || !$to) return new WP_REST_Response(['error' => 'from and to are required'], 400);

    $redirects = get_option(KOTOIQ_REDIRECTS_OPTION, []);
    if (!is_array($redirects)) $redirects = [];

    $redirects[] = [
        'from'    => $from,
        'to'      => $to,
        'type'    => in_array($type, [301, 302, 307]) ? $type : 301,
        'note'    => $note,
        'created' => current_time('c'),
    ];

    update_option(KOTOIQ_REDIRECTS_OPTION, $redirects);
    return rest_ensure_response(['ok' => true, 'total' => count($redirects)]);
}

function kotoiq_seo_404_log_list() {
    $log = get_option(KOTOIQ_404_LOG_OPTION, []);
    return rest_ensure_response([
        'errors'  => array_slice($log, 0, 100),
        'total'   => count($log),
    ]);
}

function kotoiq_seo_404_log_clear() {
    update_option(KOTOIQ_404_LOG_OPTION, []);
    return rest_ensure_response(['ok' => true]);
}
