<?php
/**
 * Koto Builder Endpoints — WP Plugin Extension
 *
 * Deploy: Add this file to the koto plugin on the WordPress site.
 * Include it from the main koto plugin file:
 *   require_once __DIR__ . '/koto-builder-endpoints.php';
 *
 * Registers three read-only REST endpoints under /wp-json/koto/v1/builder/*
 * for ELEM-01 (detect), ELEM-02 (pages), ELEM-03 (elementor/{id}).
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
