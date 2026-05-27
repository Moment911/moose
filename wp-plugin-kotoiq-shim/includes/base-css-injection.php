<?php
/**
 * Base CSS injection — per-post stylesheet via post meta, echoed in wp_head.
 *
 * Why: KSES strips <style> tags from post_content for users without
 * unfiltered_html (which the kotoiq_service role intentionally lacks). When
 * the dashboard writes a <style> block into post content, KSES removes the
 * <style> tag but leaves the CSS rules as visible text — pages render with
 * a wall of unstyled CSS at the top. Storing the CSS in post meta sidesteps
 * KSES entirely (meta is never filtered).
 *
 * Pattern mirrors includes/schema-injection.php exactly. Different meta key,
 * different sanitizer, different wrap tag.
 *
 * The dashboard writes to _kotoiq_base_css via POST /wp/v2/{pages,posts}
 * meta:{ _kotoiq_base_css: '<css>' }. Only meta keys registered with
 * show_in_rest:true are writable via REST.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

const KOTOIQ_SHIM_BASE_CSS_META_KEY = '_kotoiq_base_css';

add_action('init', function () {
    foreach (['page', 'post'] as $post_type) {
        register_post_meta($post_type, KOTOIQ_SHIM_BASE_CSS_META_KEY, [
            'type'              => 'string',
            'single'            => true,
            'show_in_rest'      => true,
            'sanitize_callback' => 'kotoiq_shim_sanitize_base_css',
            'auth_callback'     => function () {
                return current_user_can('edit_posts');
            },
        ]);
    }
});

/**
 * Sanitize the CSS string. We are NOT trying to validate CSS syntax — that
 * would be brittle and most CSS parsers are huge. We strip the only thing
 * that could break out of a <style> block: literal "</style" sequences.
 * Anything else stays as-is.
 *
 * 64KB cap mirrors the practical size of even the largest hand-tuned base
 * stylesheet for a single landing page. Larger means runaway/malformed.
 */
function kotoiq_shim_sanitize_base_css($value) {
    $value = is_string($value) ? trim($value) : '';
    if ($value === '') return '';
    if (strlen($value) > 64 * 1024) {
        $value = substr($value, 0, 64 * 1024);
    }
    return str_ireplace('</style', '<\\/style', $value);
}

/**
 * Echo the stored CSS in wp_head when viewing a singular post/page.
 * Priority 10 so it lands BEFORE theme stylesheets (which run at default 10
 * or higher via wp_enqueue_scripts). This lets the theme's own rules cascade
 * over ours where they overlap — KotoIQ rules are scoped to .koto-* classes
 * so the overlap is usually nil anyway.
 */
add_action('wp_head', function () {
    if (!is_singular()) return;
    $post_id = (int) get_queried_object_id();
    if ($post_id <= 0) return;
    $css = (string) get_post_meta($post_id, KOTOIQ_SHIM_BASE_CSS_META_KEY, true);
    if ($css === '') return;
    echo "\n<!-- KotoIQ base CSS -->\n<style>{$css}</style>\n";
}, 10);
