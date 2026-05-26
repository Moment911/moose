<?php
/**
 * Runtime — generic snippet executor.
 *
 * Reads snippets from a single wp_option (kotoiq_shim_snippets) and executes
 * each at the appropriate WP hook. Snippet record:
 *   { id, kind, scope, code, active }
 *   kind  ∈ 'php' | 'html_head' | 'html_footer' | 'js_head' | 'js_footer' | 'css'
 *   scope ∈ 'frontend' | 'admin' | 'both'
 *
 * Generic primitive — identical pattern to public plugins like Code Snippets
 * or WPCode. The plugin source reveals "we eval PHP snippets stored in an
 * option"; the snippet contents are dashboard-authored.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

if (!defined('KOTOIQ_SHIM_OPT_SNIPPETS')) define('KOTOIQ_SHIM_OPT_SNIPPETS', 'kotoiq_shim_snippets');

function kotoiq_shim_load_snippets() {
    static $cache = null;
    if ($cache !== null) return $cache;
    $s = get_option(KOTOIQ_SHIM_OPT_SNIPPETS, []);
    $cache = is_array($s) ? $s : [];
    return $cache;
}

function kotoiq_shim_run_snippet($s) {
    if (!is_array($s) || empty($s['active'])) return;
    $kind = isset($s['kind']) ? (string) $s['kind'] : '';
    $code = isset($s['code']) ? (string) $s['code'] : '';
    if ($code === '') return;
    if ($kind === 'php') {
        try { eval($code); }
        catch (\Throwable $e) { if (function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('snippet.error', ['id' => isset($s['id']) ? (string) $s['id'] : '', 'msg' => $e->getMessage()]); }
        return;
    }
    if ($kind === 'css') echo "<style>\n" . $code . "\n</style>\n";
    elseif ($kind === 'js_head' || $kind === 'js_footer') echo "<script>\n" . $code . "\n</script>\n";
    else echo $code . "\n"; // html_head, html_footer
}

function kotoiq_shim_run_snippets_at($kinds, $scopes) {
    foreach (kotoiq_shim_load_snippets() as $s) {
        if (!is_array($s)) continue;
        if (!in_array(isset($s['kind']) ? (string) $s['kind'] : '', $kinds, true)) continue;
        if (!in_array(isset($s['scope']) ? (string) $s['scope'] : '', $scopes, true)) continue;
        kotoiq_shim_run_snippet($s);
    }
}

add_action('init', function () { kotoiq_shim_run_snippets_at(['php'], is_admin() ? ['admin', 'both'] : ['frontend', 'both']); });
add_action('wp_head', function () { kotoiq_shim_run_snippets_at(['html_head', 'css', 'js_head'], ['frontend', 'both']); });
add_action('wp_footer', function () { kotoiq_shim_run_snippets_at(['html_footer', 'js_footer'], ['frontend', 'both']); });
add_action('admin_head', function () { kotoiq_shim_run_snippets_at(['html_head', 'css', 'js_head'], ['admin', 'both']); });
