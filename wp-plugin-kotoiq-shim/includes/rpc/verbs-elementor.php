<?php
/**
 * Verb handlers — elementor.* group (host-bound verbs).
 *
 * The only two verbs in the shim that cannot move to the dashboard: they call
 * \Elementor\Plugin::$instance->documents->get($id)->save([...]), which is a
 * PHP class method on the host site. Everything else (template composition,
 * variable substitution, content choice) stays in the dashboard.
 *
 * Generic primitives — the verb signatures expose "save Elementor data" and
 * "clone a post with optional meta + body overrides". Nothing in this file
 * reveals what the dashboard does with those primitives.
 *
 * The clone meta-prefix allowlist is dashboard-supplied (NOT hardcoded). v3
 * baked specific SEO-plugin prefixes into this file; v4 receives the prefix
 * list from the dashboard and writes only matching keys.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

function kotoiq_shim_elementor_guard() {
    return (!defined('ELEMENTOR_VERSION') || !class_exists('\\Elementor\\Plugin')) ? new WP_Error('elementor_not_active', 'Elementor plugin is not active on this site', ['status' => 503]) : null;
}

function kotoiq_shim_get_service_user_id() {
    $u = get_user_by('login', 'koto_service');
    if ($u) return (int) $u->ID;
    $id = wp_insert_user(['user_login' => 'koto_service', 'user_pass' => wp_generate_password(32), 'role' => 'editor', 'display_name' => 'KotoIQ Platform']);
    return is_wp_error($id) ? (int) (get_current_user_id() ?: 1) : (int) $id;
}

function kotoiq_shim_force_css_regen($post_id) {
    if (class_exists('\\Elementor\\Core\\Files\\CSS\\Post')) { $css = new \Elementor\Core\Files\CSS\Post((int) $post_id); if (method_exists($css, 'update')) $css->update(); }
    if (class_exists('\\Elementor\\Plugin')) { $i = \Elementor\Plugin::$instance; if (isset($i->files_manager) && method_exists($i->files_manager, 'clear_cache')) $i->files_manager->clear_cache(); }
}

function kotoiq_shim_count_elements($els) {
    if (!is_array($els)) return 0;
    $n = 0;
    foreach ($els as $e) { $n++; if (!empty($e['elements'])) $n += kotoiq_shim_count_elements($e['elements']); }
    return $n;
}

function kotoiq_shim_verb_elementor_save($args) {
    if (($g = kotoiq_shim_elementor_guard()) instanceof WP_Error) return $g;
    $pid_in = isset($args['post_id']) ? $args['post_id'] : null;
    if ($pid_in !== 'new' && !(is_int($pid_in) || (is_string($pid_in) && ctype_digit($pid_in)))) return new WP_Error('bad_post_id', 'post_id must be int or "new"', ['status' => 400]);
    $data = isset($args['elementor_data']) ? $args['elementor_data'] : null;
    if (!is_array($data)) return new WP_Error('bad_data', 'elementor_data must be an array (not a JSON string)', ['status' => 400]);
    $idk = isset($args['idempotency_key']) ? (string) $args['idempotency_key'] : '';
    if ($idk !== '' && !preg_match('/^[A-Za-z0-9_-]{1,64}$/', $idk)) return new WP_Error('bad_idempotency_key', 'idempotency_key must match /^[A-Za-z0-9_-]{1,64}$/', ['status' => 400]);
    if ($pid_in === 'new') {
        $title = isset($args['title']) ? (string) $args['title'] : '';
        if ($title === '') return new WP_Error('missing_title', 'title is required when post_id="new"', ['status' => 400]);
        $new = wp_insert_post(['post_title' => $title, 'post_name' => isset($args['slug']) ? (string) $args['slug'] : '', 'post_status' => isset($args['status']) ? (string) $args['status'] : 'draft', 'post_type' => isset($args['post_type']) ? (string) $args['post_type'] : 'page', 'post_author' => kotoiq_shim_get_service_user_id()], true);
        if (is_wp_error($new)) return $new;
        $post_id = (int) $new;
    } else { $post_id = (int) $pid_in; }
    $post = get_post($post_id);
    if (!$post) return new WP_Error('not_found', 'Post not found', ['status' => 404]);
    $lock = get_post_meta($post_id, '_edit_lock', true);
    if ($lock) { $lt = (int) (explode(':', $lock)[0] ?? 0); if ((time() - $lt) < 300) return new WP_Error('edit_locked', 'Page is locked for editing', ['status' => 409]); }
    if ($idk !== '' && get_post_meta($post_id, 'koto_idempotency_key', true) === $idk) return rest_ensure_response(['ok' => true, 'idempotent' => true, 'post_id' => $post_id, 'url' => get_permalink($post_id), 'status' => get_post_status($post_id), 'elementor_version' => get_post_meta($post_id, '_elementor_version', true) ?: null, 'css_regenerated' => false, 'element_count' => kotoiq_shim_count_elements($data)]);
    try {
        $doc = \Elementor\Plugin::$instance->documents->get($post_id);
        if (!$doc) { update_post_meta($post_id, '_elementor_edit_mode', 'builder'); update_post_meta($post_id, '_elementor_template_type', 'wp-page'); $doc = \Elementor\Plugin::$instance->documents->get($post_id, false); }
        if (!$doc) return new WP_Error('no_document', 'Could not create Elementor document', ['status' => 500]);
        $save = ['elements' => $data];
        if (!empty($args['page_settings']) && is_array($args['page_settings'])) $save['settings'] = $args['page_settings'];
        $doc->save($save);
        kotoiq_shim_force_css_regen($post_id);
        update_post_meta($post_id, 'koto_kotoiq', '1');
        if ($idk !== '') update_post_meta($post_id, 'koto_idempotency_key', $idk);
        add_filter('wp_revisions_to_keep', function ($n, $p) use ($post_id) { return ($p && $p->ID === $post_id) ? 3 : $n; }, 10, 2);
        if (!empty($args['status']) && $args['status'] !== $post->post_status) wp_update_post(['ID' => $post_id, 'post_status' => (string) $args['status']]);
        if (function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('elementor.saved', ['post_id' => $post_id, 'idempotency_key' => $idk ?: null, 'element_count' => kotoiq_shim_count_elements($data)]);
        return rest_ensure_response(['ok' => true, 'post_id' => $post_id, 'url' => get_permalink($post_id), 'status' => get_post_status($post_id), 'elementor_version' => get_post_meta($post_id, '_elementor_version', true) ?: null, 'css_regenerated' => true, 'element_count' => kotoiq_shim_count_elements($data)]);
    } catch (\Throwable $e) { return new WP_Error('save_failed', 'Elementor save failed: ' . $e->getMessage(), ['status' => 500]); }
}

function kotoiq_shim_verb_elementor_clone($args) {
    if (($g = kotoiq_shim_elementor_guard()) instanceof WP_Error) return $g;
    $src_id = isset($args['source_post_id']) ? (int) $args['source_post_id'] : 0;
    if ($src_id <= 0) return new WP_Error('bad_source_post_id', 'source_post_id must be a positive int', ['status' => 400]);
    $src = get_post($src_id);
    if (!$src) return new WP_Error('not_found', 'Source post not found', ['status' => 404]);
    $pm = isset($args['post_meta']) && is_array($args['post_meta']) ? $args['post_meta'] : [];
    $allow = isset($args['meta_prefix_allowlist']) && is_array($args['meta_prefix_allowlist']) ? $args['meta_prefix_allowlist'] : [];
    if (!empty($pm)) {
        if (empty($allow)) return new WP_Error('missing_meta_prefix_allowlist', 'meta_prefix_allowlist required when post_meta is non-empty', ['status' => 400]);
        foreach ($allow as $pfx) { if (!is_string($pfx) || !preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*_$/', $pfx)) return new WP_Error('bad_prefix', 'each allowlist prefix must match /^[a-zA-Z_][a-zA-Z0-9_]*_$/', ['status' => 400]); }
    }
    $idk = isset($args['idempotency_key']) ? (string) $args['idempotency_key'] : '';
    if ($idk !== '' && !preg_match('/^[A-Za-z0-9_-]{1,64}$/', $idk)) return new WP_Error('bad_idempotency_key', 'idempotency_key must match /^[A-Za-z0-9_-]{1,64}$/', ['status' => 400]);
    $new_id = wp_insert_post(['post_title' => isset($args['title']) ? (string) $args['title'] : ($src->post_title . ' (Clone)'), 'post_name' => isset($args['slug']) ? (string) $args['slug'] : '', 'post_status' => isset($args['status']) ? (string) $args['status'] : 'draft', 'post_type' => $src->post_type, 'post_author' => kotoiq_shim_get_service_user_id()], true);
    if (is_wp_error($new_id)) return $new_id;
    $new_id = (int) $new_id;
    foreach (['_elementor_data', '_elementor_version', '_elementor_edit_mode', '_elementor_template_type', '_elementor_page_settings'] as $k) { $v = get_post_meta($src_id, $k, true); if ($v !== '' && $v !== null) update_post_meta($new_id, $k, $v); }
    if (!empty($args['elementor_data']) && is_array($args['elementor_data'])) update_post_meta($new_id, '_elementor_data', wp_slash(wp_json_encode($args['elementor_data'])));
    update_post_meta($new_id, 'koto_kotoiq', '1');
    if ($idk !== '') update_post_meta($new_id, 'koto_idempotency_key', $idk);
    foreach ($pm as $mk => $mv) { foreach ($allow as $pfx) { if (strpos((string) $mk, $pfx) === 0) { update_post_meta($new_id, (string) $mk, sanitize_text_field((string) $mv)); break; } } }
    if (!empty($args['body_html'])) wp_update_post(['ID' => $new_id, 'post_content' => wp_kses_post((string) $args['body_html'])]);
    kotoiq_shim_force_css_regen($new_id);
    if (function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('elementor.cloned', ['source_id' => $src_id, 'new_id' => $new_id, 'idempotency_key' => $idk ?: null]);
    return rest_ensure_response(['ok' => true, 'post_id' => $new_id, 'source_id' => $src_id, 'url' => get_permalink($new_id), 'status' => get_post_status($new_id)]);
}
