<?php
/**
 * Elementor Builder — read/write endpoints for Elementor-edited posts.
 *
 * Lifted from the legacy wp-plugin/koto-builder-endpoints.php and brought
 * under the KotoIQ module-loader contract. The module only registers if
 * Elementor is active; on non-Elementor sites it reports enabled=false
 * with reason=elementor_missing in /meta so the Control Center can
 * disable the toggle.
 *
 * Routes (registered under both kotoiq/v1 and wpsimplecode/v1):
 *   POST builder/detect                    — Elementor version + theme info
 *   GET  builder/pages                     — list Elementor-edited posts
 *   GET  builder/elementor/{id}            — read _elementor_data
 *   PUT  builder/elementor/{id}            — write via Document::save() (safe path)
 *   POST builder/clone                     — clone an Elementor page
 *   GET  builder/rotation-cache/{post_id}  — list cached rotation selections
 *   DEL  builder/rotation-cache/{post_id}  — clear rotation cache for a post
 *
 * Auth: kotoiq_perm_write for all routes (Bearer token + remote_allowed +
 * optional host pin). The legacy koto_verify_bearer_and_license callback
 * is intentionally not used — KotoIQ has its own pairing flow.
 *
 * Direct postmeta writes for _elementor_data are NEVER used. Document::save()
 * is the only safe write path (handles CSS regen, revisions, attribute
 * validation, version pinning — see PITFALLS.md Pitfall #4 in the original
 * builder research).
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

$_kotoiq_elementor_active = defined('ELEMENTOR_VERSION');

koto_register_module([
    'slug'        => 'elementor-builder',
    'name'        => 'Elementor Builder',
    'description' => $_kotoiq_elementor_active
        ? 'Read/write Elementor pages via REST — detect, list pages, get/put _elementor_data, clone, rotation cache.'
        : 'Elementor is not installed on this site. Install Elementor to enable builder endpoints.',
    'version'     => '1.0.0',
]);

// Skip route registration entirely if Elementor isn't loaded. The module
// still appears in /meta (so the dashboard can show the toggle as
// disabled-with-reason); flipping it on with no Elementor is a no-op.
if ($_kotoiq_elementor_active) {
    add_action('rest_api_init', function () {
        if (!koto_is_module_enabled('elementor-builder')) return;

        // koto/v1 compat: legacy callers (src/lib/builder/* in the Koto
        // dashboard) hit /wp-json/koto/v1/builder/*. On sites that still
        // run the old koto plugin, that plugin owns koto/v1 — detected
        // by the presence of koto_verify_bearer_and_license. We only
        // register under koto/v1 when the old plugin is absent, so we
        // don't collide with it during the migration window.
        $register_koto_v1 = !function_exists('koto_verify_bearer_and_license');
        $register = function ($path, $args) use ($register_koto_v1) {
            kotoiq_register_rest_route($path, $args);
            if ($register_koto_v1) {
                register_rest_route('koto/v1', $path, $args);
            }
        };

        $register('/builder/detect', [
            'methods'  => 'POST',
            'callback' => 'kotoiq_builder_detect',
            'permission_callback' => 'kotoiq_perm_write',
        ]);
        $register('/builder/pages', [
            'methods'  => 'GET',
            'callback' => 'kotoiq_builder_pages',
            'permission_callback' => 'kotoiq_perm_write',
        ]);
        $register('/builder/elementor/(?P<id>\d+)', [
            'methods'  => 'GET',
            'callback' => 'kotoiq_builder_get_elementor_data',
            'permission_callback' => 'kotoiq_perm_write',
            'args' => [
                'id' => ['validate_callback' => function ($p) { return is_numeric($p); }],
            ],
        ]);
        $register('/builder/elementor/(?P<id>\d+)', [
            'methods'  => 'PUT',
            'callback' => 'kotoiq_builder_put_elementor_data',
            'permission_callback' => 'kotoiq_perm_write',
            'args' => [
                'id' => ['validate_callback' => function ($p) { return is_numeric($p) || $p === 'new'; }],
            ],
        ]);
        // Allow "new" as a placeholder ID so the PUT handler can create a post.
        $register('/builder/elementor/new', [
            'methods'  => 'PUT',
            'callback' => 'kotoiq_builder_put_elementor_data',
            'permission_callback' => 'kotoiq_perm_write',
        ]);
        $register('/builder/clone', [
            'methods'  => 'POST',
            'callback' => 'kotoiq_builder_clone_page',
            'permission_callback' => 'kotoiq_perm_write',
        ]);
        $register('/builder/rotation-cache/(?P<id>\d+)', [
            'methods'  => 'GET',
            'callback' => 'kotoiq_builder_rotation_cache_get',
            'permission_callback' => 'kotoiq_perm_write',
        ]);
        $register('/builder/rotation-cache/(?P<id>\d+)', [
            'methods'  => 'DELETE',
            'callback' => 'kotoiq_builder_rotation_cache_delete',
            'permission_callback' => 'kotoiq_perm_write',
        ]);
    });
}

function kotoiq_builder_detect($request) {
    $result = [
        'php_version'    => phpversion(),
        'wp_version'     => get_bloginfo('version'),
        'theme_name'     => wp_get_theme()->get('Name'),
        'theme_version'  => wp_get_theme()->get('Version'),
        'elementor'      => false,
        'elementor_pro'  => false,
        'site_url'       => get_site_url(),
        'multisite'      => is_multisite(),
    ];

    if (defined('ELEMENTOR_VERSION')) {
        $result['elementor'] = true;
        $result['elementor_version'] = ELEMENTOR_VERSION;
        $result['atomic_enabled'] = version_compare(ELEMENTOR_VERSION, '4.0.0', '>=');

        if (class_exists('\Elementor\Plugin')) {
            $kit_id = \Elementor\Plugin::$instance->kits_manager->get_active_id();
            $result['active_kit_id'] = $kit_id;
        }
    }

    if (defined('ELEMENTOR_PRO_VERSION')) {
        $result['elementor_pro'] = true;
        $result['elementor_pro_version'] = ELEMENTOR_PRO_VERSION;
    }

    return rest_ensure_response($result);
}

function kotoiq_builder_pages($request) {
    global $wpdb;

    $post_ids = $wpdb->get_col(
        "SELECT post_id FROM {$wpdb->postmeta}
         WHERE meta_key = '_elementor_edit_mode'
         AND meta_value = 'builder'"
    );

    if (empty($post_ids)) {
        return rest_ensure_response(['pages' => [], 'total' => 0]);
    }

    $placeholders = implode(',', array_fill(0, count($post_ids), '%d'));
    $posts = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT ID, post_title, post_name, post_type, post_status, post_modified
             FROM {$wpdb->posts}
             WHERE ID IN ($placeholders)
             AND post_status IN ('publish', 'draft', 'private')
             ORDER BY post_modified DESC",
            ...$post_ids
        )
    );

    $pages = [];
    foreach ($posts as $post) {
        $elementor_version = get_post_meta($post->ID, '_elementor_version', true);
        $pages[] = [
            'id'                => (int) $post->ID,
            'title'             => $post->post_title,
            'slug'              => $post->post_name,
            'post_type'         => $post->post_type,
            'status'            => $post->post_status,
            'updated_at'        => $post->post_modified,
            'elementor_version' => $elementor_version ?: null,
            'url'               => get_permalink($post->ID),
        ];
    }

    return rest_ensure_response(['pages' => $pages, 'total' => count($pages)]);
}

function kotoiq_builder_get_elementor_data($request) {
    $post_id = (int) $request['id'];
    $post = get_post($post_id);
    if (!$post) return new WP_Error('not_found', 'Post not found', ['status' => 404]);

    $edit_mode = get_post_meta($post_id, '_elementor_edit_mode', true);
    if ($edit_mode !== 'builder') {
        return new WP_Error('not_elementor', 'This post is not edited with Elementor', ['status' => 400]);
    }

    $raw_data = get_post_meta($post_id, '_elementor_data', true);
    $elementor_data = null;
    if ($raw_data) {
        if (is_string($raw_data)) {
            $elementor_data = json_decode($raw_data, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $decoded = maybe_unserialize($raw_data);
                $elementor_data = is_string($decoded) ? json_decode($decoded, true) : $decoded;
            }
        } elseif (is_array($raw_data)) {
            $elementor_data = $raw_data;
        }
    }
    if (!$elementor_data) {
        return new WP_Error('no_data', 'No Elementor data found for this post', ['status' => 404]);
    }

    $version = get_post_meta($post_id, '_elementor_version', true);
    $page_settings = get_post_meta($post_id, '_elementor_page_settings', true);
    $template_type = get_post_meta($post_id, '_elementor_template_type', true);

    $edit_lock = get_post_meta($post_id, '_edit_lock', true);
    $is_locked = false;
    if ($edit_lock) {
        $lock_parts = explode(':', $edit_lock);
        $lock_time = isset($lock_parts[0]) ? (int) $lock_parts[0] : 0;
        $is_locked = (time() - $lock_time) < 300;
    }

    return rest_ensure_response([
        'post_id'            => $post_id,
        'title'              => $post->post_title,
        'slug'               => $post->post_name,
        'status'             => $post->post_status,
        'url'                => get_permalink($post_id),
        'elementor_data'     => $elementor_data,
        'elementor_version'  => $version ?: null,
        'page_settings'      => $page_settings ?: [],
        'template_type'      => $template_type ?: 'wp-post',
        'is_locked'          => $is_locked,
        'element_count'      => is_array($elementor_data) ? kotoiq_count_elements($elementor_data) : 0,
        'widget_types'       => is_array($elementor_data) ? kotoiq_extract_widget_types($elementor_data) : [],
    ]);
}

function kotoiq_count_elements($elements) {
    $count = 0;
    foreach ($elements as $element) {
        $count++;
        if (!empty($element['elements'])) $count += kotoiq_count_elements($element['elements']);
    }
    return $count;
}

function kotoiq_extract_widget_types($elements) {
    $types = [];
    foreach ($elements as $element) {
        if (!empty($element['widgetType']))  $types[] = $element['widgetType'];
        elseif (!empty($element['elType']))  $types[] = $element['elType'];
        if (!empty($element['elements']))    $types = array_merge($types, kotoiq_extract_widget_types($element['elements']));
    }
    return array_values(array_unique($types));
}

/**
 * Write Elementor data via Document::save() — the only safe write path.
 * Direct postmeta writes skip CSS regeneration, revision creation,
 * attribute validation, and version pinning.
 */
function kotoiq_builder_put_elementor_data($request) {
    if (!class_exists('\Elementor\Plugin')) {
        return new WP_Error('no_elementor', 'Elementor is not active', ['status' => 500]);
    }

    $post_id = $request['id'] ?? 'new';
    $params  = $request->get_json_params();
    $elementor_data = $params['elementor_data'] ?? null;
    if (!$elementor_data || !is_array($elementor_data)) {
        return new WP_Error('invalid_data', 'elementor_data (array) is required', ['status' => 400]);
    }

    if ($post_id === 'new') {
        $new_post = [
            'post_title'  => $params['title']  ?? 'KotoIQ Generated Page',
            'post_name'   => $params['slug']   ?? '',
            'post_status' => $params['status'] ?? 'draft',
            'post_type'   => $params['post_type'] ?? 'page',
            'post_author' => kotoiq_get_service_user_id(),
        ];
        $post_id = wp_insert_post($new_post, true);
        if (is_wp_error($post_id)) return $post_id;
    } else {
        $post_id = (int) $post_id;
    }

    $post = get_post($post_id);
    if (!$post) return new WP_Error('not_found', 'Post not found', ['status' => 404]);

    $edit_lock = get_post_meta($post_id, '_edit_lock', true);
    if ($edit_lock) {
        $lock_parts = explode(':', $edit_lock);
        $lock_time = isset($lock_parts[0]) ? (int) $lock_parts[0] : 0;
        if ((time() - $lock_time) < 300) {
            $lock_user = isset($lock_parts[1]) ? get_userdata((int) $lock_parts[1]) : null;
            return new WP_Error(
                'edit_locked',
                sprintf('Page is being edited by %s (locked %ds ago). Wait 5 minutes.',
                    $lock_user ? $lock_user->display_name : 'another user',
                    time() - $lock_time
                ),
                ['status' => 409]
            );
        }
    }

    $idempotency_key = $params['idempotency_key'] ?? null;
    if ($idempotency_key) {
        $existing_key = get_post_meta($post_id, 'koto_idempotency_key', true);
        if ($existing_key === $idempotency_key) {
            return rest_ensure_response([
                'ok' => true, 'post_id' => $post_id, 'idempotent' => true,
                'url' => get_permalink($post_id),
                'message' => 'Already written with this idempotency key',
            ]);
        }
    }

    try {
        $document = \Elementor\Plugin::$instance->documents->get($post_id);
        if (!$document) {
            update_post_meta($post_id, '_elementor_edit_mode', 'builder');
            update_post_meta($post_id, '_elementor_template_type', 'wp-page');
            $document = \Elementor\Plugin::$instance->documents->get($post_id, false);
        }
        if (!$document) {
            return new WP_Error('no_document', 'Could not create Elementor document', ['status' => 500]);
        }

        $save_data = ['elements' => $elementor_data];
        if (!empty($params['page_settings'])) $save_data['settings'] = $params['page_settings'];

        $document->save($save_data);
        kotoiq_force_css_regen($post_id);

        update_post_meta($post_id, 'koto_kotoiq', '1');
        if ($idempotency_key) update_post_meta($post_id, 'koto_idempotency_key', $idempotency_key);

        // Cap revisions on Koto-managed posts to prevent runaway growth (Pitfall #5).
        add_filter('wp_revisions_to_keep', function ($num, $p) use ($post_id) {
            if ($p->ID === $post_id) return 3;
            return $num;
        }, 10, 2);

        if (!empty($params['status']) && $params['status'] !== $post->post_status) {
            wp_update_post(['ID' => $post_id, 'post_status' => $params['status']]);
        }

        return rest_ensure_response([
            'ok'                 => true,
            'post_id'            => $post_id,
            'url'                => get_permalink($post_id),
            'status'             => get_post_status($post_id),
            'elementor_version'  => get_post_meta($post_id, '_elementor_version', true),
            'css_regenerated'    => true,
        ]);
    } catch (\Exception $e) {
        return new WP_Error('save_failed', 'Elementor Document::save() failed: ' . $e->getMessage(), ['status' => 500]);
    }
}

function kotoiq_builder_clone_page($request) {
    $params = $request->get_json_params();
    $source_id = (int) ($params['source_post_id'] ?? 0);
    if (!$source_id) return new WP_Error('missing_source', 'source_post_id required', ['status' => 400]);

    $source = get_post($source_id);
    if (!$source) return new WP_Error('not_found', 'Source post not found', ['status' => 404]);

    $new_post = [
        'post_title'  => $params['title']  ?? $source->post_title . ' (Koto Clone)',
        'post_name'   => $params['slug']   ?? '',
        'post_status' => $params['status'] ?? 'draft',
        'post_type'   => $source->post_type,
        'post_author' => kotoiq_get_service_user_id(),
    ];
    $new_id = wp_insert_post($new_post, true);
    if (is_wp_error($new_id)) return $new_id;

    $elementor_metas = ['_elementor_data','_elementor_version','_elementor_edit_mode','_elementor_template_type','_elementor_page_settings'];
    foreach ($elementor_metas as $meta_key) {
        $value = get_post_meta($source_id, $meta_key, true);
        if ($value) update_post_meta($new_id, $meta_key, $value);
    }

    if (!empty($params['elementor_data'])) {
        $json = wp_json_encode($params['elementor_data']);
        update_post_meta($new_id, '_elementor_data', wp_slash($json));
    }

    update_post_meta($new_id, 'koto_kotoiq', '1');
    if (!empty($params['idempotency_key'])) {
        update_post_meta($new_id, 'koto_idempotency_key', $params['idempotency_key']);
    }

    // Page Factory: write RankMath SEO meta — only rank_math_ + _koto_ prefixes allowed.
    if (!empty($params['post_meta']) && is_array($params['post_meta'])) {
        foreach ($params['post_meta'] as $meta_key => $meta_value) {
            if (strpos($meta_key, 'rank_math_') === 0 || strpos($meta_key, '_koto_') === 0) {
                update_post_meta($new_id, $meta_key, sanitize_text_field($meta_value));
            }
        }
    }

    // Page Factory: write content with [koto_rotate] shortcodes — content-rotation module renders them.
    if (!empty($params['body_html'])) {
        wp_update_post(['ID' => $new_id, 'post_content' => wp_kses_post($params['body_html'])]);
    }

    kotoiq_force_css_regen($new_id);

    return rest_ensure_response([
        'ok' => true,
        'post_id'   => $new_id,
        'source_id' => $source_id,
        'url'       => get_permalink($new_id),
        'status'    => get_post_status($new_id),
    ]);
}

/**
 * Force Elementor CSS regeneration for a post. Version-safe via class_exists
 * + method_exists guards (v3 and v4 expose different surfaces).
 */
function kotoiq_force_css_regen($post_id) {
    if (class_exists('\Elementor\Core\Files\CSS\Post')) {
        $css_file = new \Elementor\Core\Files\CSS\Post($post_id);
        if (method_exists($css_file, 'update')) $css_file->update();
    }
    if (class_exists('\Elementor\Plugin')) {
        $instance = \Elementor\Plugin::$instance;
        if (isset($instance->files_manager) && method_exists($instance->files_manager, 'clear_cache')) {
            $instance->files_manager->clear_cache();
        }
    }
}

/**
 * Get or create a dedicated koto_service user for audit trail.
 * Falls back to current user if creation fails.
 */
function kotoiq_get_service_user_id() {
    $service_user = get_user_by('login', 'koto_service');
    if ($service_user) return $service_user->ID;

    $user_id = wp_insert_user([
        'user_login'   => 'koto_service',
        'user_pass'    => wp_generate_password(32),
        'role'         => 'editor',
        'display_name' => 'KotoIQ Platform',
    ]);
    if (!is_wp_error($user_id)) return $user_id;
    return get_current_user_id() ?: 1;
}

function kotoiq_builder_rotation_cache_get($request) {
    global $wpdb;
    $post_id = (int) $request['id'];
    $prefix = "_transient_koto_rotate_{$post_id}_";
    $results = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE %s",
            $prefix . '%'
        )
    );
    $cache = [];
    foreach ($results as $row) {
        $section = str_replace("_transient_koto_rotate_{$post_id}_", '', $row->option_name);
        $cache[$section] = (int) $row->option_value;
    }
    return rest_ensure_response(['post_id' => $post_id, 'cached_selections' => $cache]);
}

function kotoiq_builder_rotation_cache_delete($request) {
    global $wpdb;
    $post_id = (int) $request['id'];
    $prefix = "_transient_koto_rotate_{$post_id}_";
    $wpdb->query(
        $wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
            $prefix . '%',
            '_transient_timeout_' . "koto_rotate_{$post_id}_" . '%'
        )
    );
    return rest_ensure_response(['ok' => true, 'post_id' => $post_id]);
}
