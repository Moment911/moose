<?php
/**
 * [koto_rotate] — generic variant-picker shortcode. Splits its body on a
 * delimiter, picks one variant at render time, caches the selection via WP
 * transients. Useful for any A/B content presentation.
 *
 * Attributes:
 *   cache   — duration ("7d" / "24h" / "1h" / "0"); default 7d.
 *   section — sub-key disambiguation when one post has multiple rotators.
 *   pin     — force a specific 1-indexed variant (bypasses cache).
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

// Side-by-side guard: first plugin to register wins. If a coexisting plugin
// already owns this shortcode tag, defer to it rather than double-registering.
if (!shortcode_exists('koto_rotate')) {
    add_shortcode('koto_rotate', 'kotoiq_shim_rotate_shortcode');
}

function kotoiq_shim_rotate_shortcode($atts, $content = '') {
    $atts = shortcode_atts(['cache' => '7d', 'section' => '', 'pin' => ''], $atts, 'koto_rotate');
    if (empty($content)) return '';
    $variants = array_values(array_filter(array_map('trim', explode('|||KOTO_VARIANT|||', (string) $content)), function ($v) { return $v !== ''; }));
    if (empty($variants)) return '';
    if (count($variants) === 1) return do_shortcode($variants[0]);
    if ($atts['pin'] !== '') return do_shortcode($variants[max(0, (int) $atts['pin'] - 1) % count($variants)]);
    $post_id = (int) get_the_ID();
    $section = sanitize_key($atts['section'] !== '' ? $atts['section'] : 'default');
    $key = "koto_rotate_{$post_id}_{$section}";
    $cached = get_transient($key);
    if ($cached !== false && isset($variants[(int) $cached])) return do_shortcode($variants[(int) $cached]);
    $idx = array_rand($variants);
    $secs = kotoiq_shim_rotate_parse_cache_duration($atts['cache']);
    if ($secs > 0) set_transient($key, $idx, $secs);
    return do_shortcode($variants[$idx]);
}

function kotoiq_shim_rotate_parse_cache_duration($str) {
    $s = trim(strtolower((string) $str));
    if ($s === '0' || $s === 'none') return 0;
    if (preg_match('/^(\d+)d$/', $s, $m)) return (int) $m[1] * DAY_IN_SECONDS;
    if (preg_match('/^(\d+)h$/', $s, $m)) return (int) $m[1] * HOUR_IN_SECONDS;
    if (preg_match('/^(\d+)m$/', $s, $m)) return (int) $m[1] * MINUTE_IN_SECONDS;
    if (preg_match('/^(\d+)$/', $s, $m)) return (int) $m[1];
    return 7 * DAY_IN_SECONDS;
}
