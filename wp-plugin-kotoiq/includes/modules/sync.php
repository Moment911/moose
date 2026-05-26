<?php
/**
 * Sync Module — receives pushed changes from the KotoIQ platform.
 *
 * When an operator changes SEO meta, publishes content, or updates pages
 * from the KotoIQ dashboard at hellokoto.com, the platform pushes those
 * changes to the WordPress site in real time via this endpoint.
 *
 * Endpoints:
 *   POST /sync/push       — receive a batch of changes from the platform
 *   GET  /sync/status     — current sync health + last activity
 *   GET  /sync/log        — recent sync events (last 50)
 *
 * The sync log is stored in wp_options as a rolling JSON array (max 200 entries).
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

koto_register_module([
    'slug'        => 'sync',
    'name'        => 'Platform Sync',
    'description' => 'Receives real-time updates from the KotoIQ platform. SEO meta, content, and page changes push automatically.',
    'version'     => '1.0.0',
    'always_on'   => true,
]);

define('KOTOIQ_SYNC_LOG_OPTION', 'kotoiq_sync_log');
define('KOTOIQ_SYNC_LOG_MAX', 200);

add_action('rest_api_init', function () {
    $sync_routes = [
        ['/sync/push',   'POST', 'kotoiq_sync_push'],
        ['/sync/status', 'GET',  'kotoiq_sync_status'],
        ['/sync/log',    'GET',  'kotoiq_sync_log'],
    ];

    foreach ($sync_routes as [$path, $method, $callback]) {
        kotoiq_register_rest_route($path, [
            'methods'             => $method,
            'callback'            => $callback,
            'permission_callback' => $method === 'GET' ? 'kotoiq_perm_read' : 'kotoiq_perm_write',
        ]);
        // Also register under koto/v1 for legacy callers
        register_rest_route('koto/v1', $path, [
            'methods'             => $method,
            'callback'            => $callback,
            'permission_callback' => $method === 'GET' ? 'kotoiq_perm_read' : 'kotoiq_perm_write',
        ]);
    }
});

/**
 * POST /sync/push — receive a batch of changes.
 *
 * Body: { "changes": [ { "type": "seo_meta"|"content"|"publish"|"delete", "post_id": N, "data": {...} }, ... ] }
 *
 * Each change is applied in order. Results are returned per-change.
 */
function kotoiq_sync_push($request) {
    $params  = $request->get_json_params();
    $changes = $params['changes'] ?? [];
    $source  = sanitize_text_field($params['source'] ?? 'kotoiq-platform');

    if (empty($changes)) {
        return new WP_REST_Response(['error' => 'No changes provided'], 400);
    }

    $results = [];
    $applied = 0;
    $failed  = 0;

    foreach ($changes as $i => $change) {
        $type    = $change['type']    ?? '';
        $post_id = (int) ($change['post_id'] ?? 0);
        $data    = $change['data']    ?? [];

        $result = ['index' => $i, 'type' => $type, 'post_id' => $post_id];

        switch ($type) {
            case 'seo_meta':
                if (!$post_id || !get_post($post_id)) {
                    $result['status'] = 'error';
                    $result['error']  = 'Post not found';
                    $failed++;
                    break;
                }
                // Update KotoIQ SEO fields
                if (!empty($data['seo_title']))        update_post_meta($post_id, '_kotoiq_title',         sanitize_text_field($data['seo_title']));
                if (!empty($data['meta_description'])) update_post_meta($post_id, '_kotoiq_description',   sanitize_text_field($data['meta_description']));
                if (!empty($data['focus_keyword']))    update_post_meta($post_id, '_kotoiq_focus_keyword', sanitize_text_field($data['focus_keyword']));

                // Schema fields (FAQ schema from AI optimizer)
                if (!empty($data['schema_type']))      update_post_meta($post_id, '_kotoiq_schema_type',   sanitize_text_field($data['schema_type']));
                if (!empty($data['schema_custom']))    update_post_meta($post_id, '_kotoiq_schema_custom', wp_unslash($data['schema_custom']));

                // Also write to Yoast/Rank Math if present (compatibility)
                if (function_exists('kotoiq_seo_set_seo_meta')) {
                    kotoiq_seo_set_seo_meta($post_id, $data);
                }

                $result['status'] = 'applied';
                $result['fields_updated'] = array_keys(array_filter($data));
                $applied++;
                break;

            case 'content':
                if (!$post_id || !get_post($post_id)) {
                    $result['status'] = 'error';
                    $result['error']  = 'Post not found';
                    $failed++;
                    break;
                }
                $update = ['ID' => $post_id];
                if (isset($data['title']))   $update['post_title']   = sanitize_text_field($data['title']);
                if (isset($data['content'])) $update['post_content'] = wp_kses_post($data['content']);
                if (isset($data['status']))  $update['post_status']  = sanitize_text_field($data['status']);
                if (isset($data['slug']))    $update['post_name']    = sanitize_title($data['slug']);

                $r = wp_update_post($update, true);
                if (is_wp_error($r)) {
                    $result['status'] = 'error';
                    $result['error']  = $r->get_error_message();
                    $failed++;
                } else {
                    // Also update SEO meta if provided
                    if (!empty($data['meta_description']) || !empty($data['focus_keyword']) || !empty($data['seo_title'])) {
                        if (function_exists('kotoiq_seo_set_seo_meta')) {
                            kotoiq_seo_set_seo_meta($post_id, $data);
                        }
                    }
                    $result['status'] = 'applied';
                    $result['url']    = get_permalink($post_id);
                    $applied++;
                }
                break;

            case 'create':
                $new_post = [
                    'post_title'   => sanitize_text_field($data['title'] ?? ''),
                    'post_content' => wp_kses_post($data['content'] ?? ''),
                    'post_status'  => sanitize_text_field($data['status'] ?? 'draft'),
                    'post_type'    => in_array($data['type'] ?? 'page', ['page', 'post'], true) ? $data['type'] : 'page',
                ];
                if (!empty($data['slug'])) $new_post['post_name'] = sanitize_title($data['slug']);

                $new_id = wp_insert_post($new_post, true);
                if (is_wp_error($new_id)) {
                    $result['status'] = 'error';
                    $result['error']  = $new_id->get_error_message();
                    $failed++;
                } else {
                    if (function_exists('kotoiq_seo_set_seo_meta')) {
                        kotoiq_seo_set_seo_meta($new_id, $data);
                    }
                    $result['status']  = 'applied';
                    $result['post_id'] = $new_id;
                    $result['url']     = get_permalink($new_id);
                    $applied++;
                }
                break;

            case 'publish':
                if (!$post_id || !get_post($post_id)) {
                    $result['status'] = 'error';
                    $result['error']  = 'Post not found';
                    $failed++;
                    break;
                }
                wp_update_post(['ID' => $post_id, 'post_status' => 'publish']);
                $result['status'] = 'applied';
                $result['url']    = get_permalink($post_id);
                $applied++;
                break;

            case 'delete':
                if (!$post_id) {
                    $result['status'] = 'error';
                    $result['error']  = 'No post_id';
                    $failed++;
                    break;
                }
                $deleted = wp_trash_post($post_id); // trash, not permanent delete
                $result['status'] = $deleted ? 'applied' : 'error';
                if ($deleted) $applied++; else $failed++;
                break;

            default:
                $result['status'] = 'error';
                $result['error']  = "Unknown change type: $type";
                $failed++;
        }

        $results[] = $result;
    }

    // Log the sync event
    kotoiq_sync_log_event([
        'action'   => 'push',
        'source'   => $source,
        'total'    => count($changes),
        'applied'  => $applied,
        'failed'   => $failed,
        'types'    => array_count_values(array_column($changes, 'type')),
        'time'     => current_time('c'),
    ]);

    update_option('koto_last_sync', current_time('mysql'));

    return rest_ensure_response([
        'success' => $failed === 0,
        'applied' => $applied,
        'failed'  => $failed,
        'total'   => count($changes),
        'results' => $results,
        'synced_at' => current_time('c'),
    ]);
}

/**
 * GET /sync/status — health check + last activity.
 */
function kotoiq_sync_status() {
    $log = get_option(KOTOIQ_SYNC_LOG_OPTION, []);
    $last = !empty($log) ? $log[0] : null;

    return rest_ensure_response([
        'status'        => 'connected',
        'last_sync'     => get_option('koto_last_sync', null),
        'last_push'     => $last ? $last['time'] : null,
        'total_pushes'  => count($log),
        'site_url'      => get_site_url(),
        'plugin_version'=> KOTOIQ_VERSION,
        'seo_engine'    => 'kotoiq',
        'checked_at'    => current_time('c'),
    ]);
}

/**
 * GET /sync/log — recent sync events.
 */
function kotoiq_sync_log() {
    $log = get_option(KOTOIQ_SYNC_LOG_OPTION, []);
    return rest_ensure_response([
        'events'      => array_slice($log, 0, 50),
        'total'       => count($log),
        'retrieved_at'=> current_time('c'),
    ]);
}

/**
 * Append an event to the sync log (rolling, max KOTOIQ_SYNC_LOG_MAX).
 */
function kotoiq_sync_log_event($event) {
    $log = get_option(KOTOIQ_SYNC_LOG_OPTION, []);
    if (!is_array($log)) $log = [];
    array_unshift($log, $event);
    $log = array_slice($log, 0, KOTOIQ_SYNC_LOG_MAX);
    update_option(KOTOIQ_SYNC_LOG_OPTION, $log, false);
}
