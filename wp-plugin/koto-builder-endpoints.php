<?php
/**
 * Koto Builder Endpoints — WP Plugin Extension
 *
 * Deploy: Add this file to the koto plugin on the WordPress site.
 * Include it from the main koto plugin file:
 *   require_once __DIR__ . '/koto-builder-endpoints.php';
 *
 * Registers REST endpoints under /wp-json/koto/v1/builder/*
 * Phase 1: ELEM-01 (detect), ELEM-02 (pages), ELEM-03 (elementor/{id} GET)
 * Phase 2: ELEM-04 (elementor/{id} PUT via Document::save()), ELEM-10 (CSS regen)
 *
 * Auth: Uses the same Bearer token + license key pattern as existing koto endpoints.
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {

    // ── ELEM-01: builder/detect ─────────────────────────────────────────
    // Returns Elementor version info, theme, PHP version
    register_rest_route('koto/v1', '/builder/detect', [
        'methods'  => 'POST',
        'callback' => 'koto_builder_detect',
        'permission_callback' => 'koto_verify_bearer_and_license',
    ]);

    // ── ELEM-02: builder/pages ──────────────────────────────────────────
    // Lists all pages/posts that have Elementor edit mode enabled
    register_rest_route('koto/v1', '/builder/pages', [
        'methods'  => 'GET',
        'callback' => 'koto_builder_pages',
        'permission_callback' => 'koto_verify_bearer_and_license',
    ]);

    // ── ELEM-03: builder/elementor/(?P<id>\d+) GET ──────────────────────
    // Returns raw _elementor_data JSON + version + page settings for one post
    register_rest_route('koto/v1', '/builder/elementor/(?P<id>\d+)', [
        'methods'  => 'GET',
        'callback' => 'koto_builder_get_elementor_data',
        'permission_callback' => 'koto_verify_bearer_and_license',
        'args' => [
            'id' => [
                'validate_callback' => function ($param) {
                    return is_numeric($param);
                },
            ],
        ],
    ]);

    // ── ELEM-04: builder/elementor/(?P<id>\d+) PUT ──────────────────────
    // Writes Elementor data via Document::save() — the ONLY safe write path
    register_rest_route('koto/v1', '/builder/elementor/(?P<id>\d+)', [
        'methods'  => 'PUT',
        'callback' => 'koto_builder_put_elementor_data',
        'permission_callback' => 'koto_verify_bearer_and_license',
        'args' => [
            'id' => [
                'validate_callback' => function ($param) {
                    return is_numeric($param) || $param === 'new';
                },
            ],
        ],
    ]);

    // ── Clone: builder/clone ────────────────────────────────────────────
    // Creates a new post by cloning an existing Elementor page
    register_rest_route('koto/v1', '/builder/clone', [
        'methods'  => 'POST',
        'callback' => 'koto_builder_clone_page',
        'permission_callback' => 'koto_verify_bearer_and_license',
    ]);
});

/**
 * ELEM-01: Detect builder version and environment
 */
function koto_builder_detect($request) {
    $result = [
        'php_version'    => phpversion(),
        'wp_version'     => get_bloginfo('version'),
        'theme_name'     => wp_get_theme()->get('Name'),
        'theme_version'  => wp_get_theme()->get('Version'),
        'elementor'      => false,
        'elementor_pro'  => false,
    ];

    // Check Elementor
    if (defined('ELEMENTOR_VERSION')) {
        $result['elementor'] = true;
        $result['elementor_version'] = ELEMENTOR_VERSION;

        // Check for atomic widgets (v4+)
        $result['atomic_enabled'] = version_compare(ELEMENTOR_VERSION, '4.0.0', '>=');

        // Check for global classes (v4 feature)
        if (class_exists('\Elementor\Plugin')) {
            $kit_id = \Elementor\Plugin::$instance->kits_manager->get_active_id();
            $result['active_kit_id'] = $kit_id;
        }
    }

    // Check Elementor Pro
    if (defined('ELEMENTOR_PRO_VERSION')) {
        $result['elementor_pro'] = true;
        $result['elementor_pro_version'] = ELEMENTOR_PRO_VERSION;
    }

    // Check for edit lock (useful for write operations later)
    $result['site_url'] = get_site_url();
    $result['multisite'] = is_multisite();

    return rest_ensure_response($result);
}

/**
 * ELEM-02: List all Elementor-edited pages
 */
function koto_builder_pages($request) {
    global $wpdb;

    // Find all posts where _elementor_edit_mode is set (= 'builder')
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

    return rest_ensure_response([
        'pages' => $pages,
        'total' => count($pages),
    ]);
}

/**
 * ELEM-03: Get raw Elementor data for a single post
 */
function koto_builder_get_elementor_data($request) {
    $post_id = (int) $request['id'];
    $post = get_post($post_id);

    if (!$post) {
        return new WP_Error('not_found', 'Post not found', ['status' => 404]);
    }

    // Check this is actually an Elementor-edited post
    $edit_mode = get_post_meta($post_id, '_elementor_edit_mode', true);
    if ($edit_mode !== 'builder') {
        return new WP_Error(
            'not_elementor',
            'This post is not edited with Elementor',
            ['status' => 400]
        );
    }

    // Get raw _elementor_data (stored as serialized JSON string)
    $raw_data = get_post_meta($post_id, '_elementor_data', true);
    $elementor_data = null;

    if ($raw_data) {
        // _elementor_data is stored as a JSON string in postmeta
        if (is_string($raw_data)) {
            $elementor_data = json_decode($raw_data, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                // Sometimes it's double-encoded
                $decoded = maybe_unserialize($raw_data);
                if (is_string($decoded)) {
                    $elementor_data = json_decode($decoded, true);
                } else {
                    $elementor_data = $decoded;
                }
            }
        } elseif (is_array($raw_data)) {
            $elementor_data = $raw_data;
        }
    }

    if (!$elementor_data) {
        return new WP_Error(
            'no_data',
            'No Elementor data found for this post',
            ['status' => 404]
        );
    }

    // Gather metadata
    $version = get_post_meta($post_id, '_elementor_version', true);
    $page_settings = get_post_meta($post_id, '_elementor_page_settings', true);
    $template_type = get_post_meta($post_id, '_elementor_template_type', true);
    $css_print_method = get_post_meta($post_id, '_elementor_css', true);

    // Check edit lock
    $edit_lock = get_post_meta($post_id, '_edit_lock', true);
    $is_locked = false;
    if ($edit_lock) {
        $lock_parts = explode(':', $edit_lock);
        $lock_time = isset($lock_parts[0]) ? (int) $lock_parts[0] : 0;
        // Consider locked if edited within last 5 minutes
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
        'element_count'      => is_array($elementor_data) ? koto_count_elements($elementor_data) : 0,
        'widget_types'       => is_array($elementor_data) ? koto_extract_widget_types($elementor_data) : [],
    ]);
}

/**
 * Recursively count elements in Elementor data tree
 */
function koto_count_elements($elements) {
    $count = 0;
    foreach ($elements as $element) {
        $count++;
        if (!empty($element['elements'])) {
            $count += koto_count_elements($element['elements']);
        }
    }
    return $count;
}

/**
 * Recursively extract unique widget types from Elementor data tree
 */
function koto_extract_widget_types($elements) {
    $types = [];
    foreach ($elements as $element) {
        if (!empty($element['widgetType'])) {
            $types[] = $element['widgetType'];
        } elseif (!empty($element['elType'])) {
            $types[] = $element['elType'];
        }
        if (!empty($element['elements'])) {
            $types = array_merge($types, koto_extract_widget_types($element['elements']));
        }
    }
    return array_values(array_unique($types));
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: Write Endpoints (ELEM-04, ELEM-10)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ELEM-04: Write Elementor data via Document::save()
 *
 * This is the ONLY safe way to write _elementor_data. Direct postmeta
 * writes skip CSS regeneration, revision creation, attribute validation,
 * and version pinning — all of which cause silent corruption in v4.
 *
 * See: .planning/research/PITFALLS.md Pitfall #4
 */
function koto_builder_put_elementor_data($request) {
    $post_id = $request['id'];
    $params = $request->get_json_params();

    // Validate Elementor is active
    if (!class_exists('\Elementor\Plugin')) {
        return new WP_Error('no_elementor', 'Elementor is not active', ['status' => 500]);
    }

    $elementor_data = $params['elementor_data'] ?? null;
    if (!$elementor_data || !is_array($elementor_data)) {
        return new WP_Error('invalid_data', 'elementor_data (array) is required', ['status' => 400]);
    }

    // Handle "new" post creation
    if ($post_id === 'new') {
        $new_post = [
            'post_title'  => $params['title'] ?? 'Koto Generated Page',
            'post_name'   => $params['slug'] ?? '',
            'post_status' => $params['status'] ?? 'draft',
            'post_type'   => $params['post_type'] ?? 'page',
            'post_author' => koto_get_service_user_id(),
        ];
        $post_id = wp_insert_post($new_post, true);
        if (is_wp_error($post_id)) {
            return $post_id;
        }
    } else {
        $post_id = (int) $post_id;
    }

    // Verify post exists
    $post = get_post($post_id);
    if (!$post) {
        return new WP_Error('not_found', 'Post not found', ['status' => 404]);
    }

    // Check edit lock — refuse if someone has the page open in Elementor editor
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

    // Idempotency check
    $idempotency_key = $params['idempotency_key'] ?? null;
    if ($idempotency_key) {
        $existing_key = get_post_meta($post_id, 'koto_idempotency_key', true);
        if ($existing_key === $idempotency_key) {
            // Already written with this key — return success without re-writing
            return rest_ensure_response([
                'ok'          => true,
                'post_id'     => $post_id,
                'idempotent'  => true,
                'url'         => get_permalink($post_id),
                'message'     => 'Already written with this idempotency key',
            ]);
        }
    }

    // ── Invoke Elementor's Document::save() ─────────────────────────────
    // This is the canonical save path. It handles:
    // - _elementor_data postmeta
    // - _elementor_version
    // - _elementor_edit_mode = 'builder'
    // - Revision creation
    // - v4 atomic attribute validation
    // - CSS file regeneration

    try {
        $document = \Elementor\Plugin::$instance->documents->get($post_id);

        if (!$document) {
            // First time — set up as Elementor page
            update_post_meta($post_id, '_elementor_edit_mode', 'builder');
            update_post_meta($post_id, '_elementor_template_type', 'wp-page');
            $document = \Elementor\Plugin::$instance->documents->get($post_id, false);
        }

        if (!$document) {
            return new WP_Error('no_document', 'Could not create Elementor document', ['status' => 500]);
        }

        // Build save data — Document::save() expects this shape
        $save_data = [
            'elements' => $elementor_data,
        ];

        // Include page settings if provided
        if (!empty($params['page_settings'])) {
            $save_data['settings'] = $params['page_settings'];
        }

        // Save via Elementor's own API
        $document->save($save_data);

        // ── ELEM-10: CSS Regeneration ───────────────────────────────────
        // Document::save() should trigger this, but we force it as a safety net
        koto_force_css_regen($post_id);

        // Tag as Koto-managed
        update_post_meta($post_id, 'koto_kotoiq', '1');
        if ($idempotency_key) {
            update_post_meta($post_id, 'koto_idempotency_key', $idempotency_key);
        }

        // Cap revisions on Koto-managed posts (Pitfall #5)
        add_filter('wp_revisions_to_keep', function ($num, $p) use ($post_id) {
            if ($p->ID === $post_id) return 3;
            return $num;
        }, 10, 2);

        // Update post status if requested
        if (!empty($params['status']) && $params['status'] !== $post->post_status) {
            wp_update_post([
                'ID'          => $post_id,
                'post_status' => $params['status'],
            ]);
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
        return new WP_Error(
            'save_failed',
            'Elementor Document::save() failed: ' . $e->getMessage(),
            ['status' => 500]
        );
    }
}

/**
 * Clone an existing Elementor page as a new draft.
 * Used for template-based variant creation.
 */
function koto_builder_clone_page($request) {
    $params = $request->get_json_params();
    $source_id = (int) ($params['source_post_id'] ?? 0);

    if (!$source_id) {
        return new WP_Error('missing_source', 'source_post_id required', ['status' => 400]);
    }

    $source = get_post($source_id);
    if (!$source) {
        return new WP_Error('not_found', 'Source post not found', ['status' => 404]);
    }

    // Create the clone
    $new_post = [
        'post_title'  => $params['title'] ?? $source->post_title . ' (Koto Clone)',
        'post_name'   => $params['slug'] ?? '',
        'post_status' => $params['status'] ?? 'draft',
        'post_type'   => $source->post_type,
        'post_author' => koto_get_service_user_id(),
    ];

    $new_id = wp_insert_post($new_post, true);
    if (is_wp_error($new_id)) return $new_id;

    // Copy all Elementor meta
    $elementor_metas = [
        '_elementor_data',
        '_elementor_version',
        '_elementor_edit_mode',
        '_elementor_template_type',
        '_elementor_page_settings',
    ];

    foreach ($elementor_metas as $meta_key) {
        $value = get_post_meta($source_id, $meta_key, true);
        if ($value) {
            update_post_meta($new_id, $meta_key, $value);
        }
    }

    // If custom elementor_data was provided, use that instead
    if (!empty($params['elementor_data'])) {
        $json = wp_json_encode($params['elementor_data']);
        update_post_meta($new_id, '_elementor_data', wp_slash($json));
    }

    // Tag as Koto-managed
    update_post_meta($new_id, 'koto_kotoiq', '1');
    if (!empty($params['idempotency_key'])) {
        update_post_meta($new_id, 'koto_idempotency_key', $params['idempotency_key']);
    }

    // Force CSS regen on the clone
    koto_force_css_regen($new_id);

    return rest_ensure_response([
        'ok'        => true,
        'post_id'   => $new_id,
        'source_id' => $source_id,
        'url'       => get_permalink($new_id),
        'status'    => get_post_status($new_id),
    ]);
}

/**
 * ELEM-10: Force Elementor CSS regeneration for a post.
 * Wrapped in class_exists/method_exists guards for version safety.
 */
function koto_force_css_regen($post_id) {
    // v4+ approach: Post CSS file
    if (class_exists('\Elementor\Core\Files\CSS\Post')) {
        $css_file = new \Elementor\Core\Files\CSS\Post($post_id);
        if (method_exists($css_file, 'update')) {
            $css_file->update();
        }
    }

    // Global cache clear (catches any edge cases)
    if (class_exists('\Elementor\Plugin')) {
        $instance = \Elementor\Plugin::$instance;

        // files_manager->clear_cache() — works on v3 and v4
        if (isset($instance->files_manager) && method_exists($instance->files_manager, 'clear_cache')) {
            $instance->files_manager->clear_cache();
        }
    }
}

/**
 * Get or create a dedicated koto_service user for audit trail.
 * Falls back to current user if creation fails.
 */
function koto_get_service_user_id() {
    $service_user = get_user_by('login', 'koto_service');
    if ($service_user) return $service_user->ID;

    // Try to create — won't fail if user already exists
    $user_id = wp_insert_user([
        'user_login' => 'koto_service',
        'user_pass'  => wp_generate_password(32),
        'role'       => 'editor',
        'display_name' => 'Koto Platform',
    ]);

    if (!is_wp_error($user_id)) return $user_id;

    // Fallback to current user
    return get_current_user_id() ?: 1;
}
