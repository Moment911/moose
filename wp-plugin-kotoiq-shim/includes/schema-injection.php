<?php
/**
 * Schema injection — JSON-LD via post meta, echoed in wp_head.
 *
 * Why: KSES strips <script> from post_content for users without
 * unfiltered_html (which the kotoiq_service role intentionally lacks).
 * Storing schema in post meta sidesteps that — meta is never KSES'd.
 *
 * The dashboard writes to _kotoiq_schema_jsonld via POST /wp/v2/{pages,posts}
 * meta:{ _kotoiq_schema_jsonld: '<json>' }. WP only allows REST writes to
 * meta keys registered with show_in_rest:true — which is what register_post_meta
 * below does.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

const KOTOIQ_SHIM_SCHEMA_META_KEY = '_kotoiq_schema_jsonld';

/**
 * Register the meta key for both 'page' and 'post' post types so the
 * dashboard can write it via the REST API. auth_callback gates writes
 * on edit_posts cap (kotoiq_service has this).
 *
 * `single: true` because we want one schema string per post, not an array.
 */
add_action('init', function () {
    foreach (['page', 'post'] as $post_type) {
        register_post_meta($post_type, KOTOIQ_SHIM_SCHEMA_META_KEY, [
            'type'              => 'string',
            'single'            => true,
            'show_in_rest'      => true,
            'sanitize_callback' => 'kotoiq_shim_sanitize_jsonld',
            'auth_callback'     => function () {
                return current_user_can('edit_posts');
            },
        ]);
    }
});

/**
 * Sanitize the JSON-LD string. We accept any valid JSON object/array; if it
 * does not parse, we store an empty string so wp_head doesn't echo garbage.
 *
 * Bytes-only sanitization — no esc_html / wp_kses, because the value will
 * be wrapped in a <script type="application/ld+json"> block where < > "
 * are LEGAL inside JSON. We only protect against script-tag injection by
 * killing any literal "</script" sequence.
 */
function kotoiq_shim_sanitize_jsonld($value) {
    $value = is_string($value) ? trim($value) : '';
    if ($value === '') return '';
    $decoded = json_decode($value, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return '';
    }
    // Re-encode to normalize + strip any literal </script close that would
    // break out of the script block.
    $clean = json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($clean === false) return '';
    return str_ireplace('</script', '<\\/script', $clean);
}

/**
 * Echo the stored JSON-LD in wp_head when viewing a singular post/page.
 * Late priority (99) so it lands after most SEO plugin output.
 */
add_action('wp_head', function () {
    if (!is_singular()) return;
    $post_id = (int) get_queried_object_id();
    if ($post_id <= 0) return;
    $jsonld = (string) get_post_meta($post_id, KOTOIQ_SHIM_SCHEMA_META_KEY, true);
    if ($jsonld === '') return;
    // Already sanitized + json-encoded at write time; safe to echo directly.
    echo "\n<!-- KotoIQ schema -->\n<script type=\"application/ld+json\">{$jsonld}</script>\n";
}, 99);
