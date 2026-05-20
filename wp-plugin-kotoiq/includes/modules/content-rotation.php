<?php
/**
 * Content Rotation — [koto_rotate] shortcode that picks one of N variants per
 * page-load, caches the selection per post for a configurable TTL. Google
 * sees the page "updating" each time the cache rolls over and a different
 * variant renders.
 *
 *   [koto_rotate cache="7d" section="intro"]
 *     variant 1 HTML|||KOTO_VARIANT|||variant 2|||KOTO_VARIANT|||variant 3
 *   [/koto_rotate]
 *
 * Attributes:
 *   cache    — 7d / 24h / 30d / 1h / 0  (default 7d). `0` or `none` = no cache.
 *   section  — sub-key for cache-key uniqueness when a post has multiple rotators
 *   pin      — force a specific 1-indexed variant (for testing); bypasses cache
 *
 * Cache key: `koto_rotate_{post_id}_{section}` stored as a WP transient. The
 * elementor-builder module's /builder/rotation-cache/{id} endpoints can list
 * and clear these transients remotely.
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

koto_register_module([
    'slug'        => 'content-rotation',
    'name'        => 'Content Rotation',
    'description' => '[koto_rotate] shortcode — variant-rotating content with per-post cached selection. Pairs with the Page Factory clone flow.',
    'version'     => '1.0.0',
]);

// Guard against double-registration if the legacy koto plugin is also active
// on this site during a transition window. First plugin to load wins.
if (!shortcode_exists('koto_rotate')) {
    add_shortcode('koto_rotate', 'kotoiq_rotate_shortcode');
}

function kotoiq_rotate_shortcode($atts, $content = '') {
    if (!koto_is_module_enabled('content-rotation')) {
        // Module disabled — return first variant unprocessed, or empty string.
        $parts = explode('|||KOTO_VARIANT|||', (string) $content);
        return isset($parts[0]) ? do_shortcode(trim($parts[0])) : '';
    }

    $atts = shortcode_atts([
        'cache'   => '7d',
        'section' => '',
        'pin'     => '',
    ], $atts, 'koto_rotate');

    if (empty($content)) return '';

    $variants = explode('|||KOTO_VARIANT|||', $content);
    $variants = array_map('trim', $variants);
    $variants = array_filter($variants, function ($v) { return !empty($v); });
    $variants = array_values($variants);

    if (empty($variants)) return '';
    if (count($variants) === 1) return do_shortcode($variants[0]);

    if (!empty($atts['pin'])) {
        $pin_index = max(0, (int) $atts['pin'] - 1);
        return do_shortcode($variants[$pin_index % count($variants)]);
    }

    $post_id = get_the_ID();
    $section = sanitize_key($atts['section'] ?: 'default');
    $cache_key = "koto_rotate_{$post_id}_{$section}";

    $cached_index = get_transient($cache_key);
    if ($cached_index !== false && isset($variants[(int) $cached_index])) {
        return do_shortcode($variants[(int) $cached_index]);
    }

    $chosen_index = array_rand($variants);
    $cache_seconds = kotoiq_rotate_parse_cache_duration($atts['cache']);
    if ($cache_seconds > 0) {
        set_transient($cache_key, $chosen_index, $cache_seconds);
    }

    return do_shortcode($variants[$chosen_index]);
}

function kotoiq_rotate_parse_cache_duration($str) {
    $str = trim(strtolower($str));
    if ($str === '0' || $str === 'none') return 0;

    if (preg_match('/^(\d+)d$/', $str, $m)) return (int) $m[1] * DAY_IN_SECONDS;
    if (preg_match('/^(\d+)h$/', $str, $m)) return (int) $m[1] * HOUR_IN_SECONDS;
    if (preg_match('/^(\d+)m$/', $str, $m)) return (int) $m[1] * MINUTE_IN_SECONDS;
    if (preg_match('/^(\d+)$/',  $str, $m)) return (int) $m[1];

    return 7 * DAY_IN_SECONDS;
}
