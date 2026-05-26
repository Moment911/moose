<?php
/**
 * Verb handlers — health.* group.
 *
 * Provides:
 *   - kotoiq_shim_verb_health_ping        (moved here from verb-table.php)
 *   - kotoiq_shim_verb_health_diagnostics
 *
 * Diagnostics returns enough for the dashboard to make pairing / sync /
 * compatibility decisions WITHOUT leaking secrets:
 *   - The stored pubkey itself is NOT returned.
 *   - Application Password values are NEVER returned — only availability bools.
 *   - The optional legacy bearer secret is never returned in any form.
 *
 * Caps response size: active_plugins is truncated to 200 entries to defend
 * against memory exhaustion on sites with hundreds of plugins.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

function kotoiq_shim_health_base() {
    return [
        'shim_version'      => KOTOIQ_SHIM_VERSION,
        'wp_version'        => get_bloginfo('version'),
        'php_version'       => phpversion(),
        'site_url'          => get_site_url(),
        'time'              => time(),
        'elementor_version' => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : null,
    ];
}

function kotoiq_shim_verb_health_ping($args) {
    unset($args);
    return rest_ensure_response(kotoiq_shim_health_base());
}

function kotoiq_shim_verb_health_diagnostics($args) {
    unset($args);
    $out = kotoiq_shim_health_base();
    if (!function_exists('get_plugins')) require_once ABSPATH . 'wp-admin/includes/plugin.php';
    $all = function_exists('get_plugins') ? get_plugins() : [];
    $active_files = (array) get_option('active_plugins', []);
    $active = [];
    foreach ($active_files as $file) {
        if (!is_string($file) || !isset($all[$file])) continue;
        $m = $all[$file];
        $active[] = ['file' => (string) $file, 'name' => isset($m['Name']) ? (string) $m['Name'] : '', 'version' => isset($m['Version']) ? (string) $m['Version'] : ''];
    }
    usort($active, function ($a, $b) { return strcasecmp((string) $a['name'], (string) $b['name']); });
    if (count($active) > 200) { $active = array_slice($active, 0, 200); $out['_truncated'] = true; }
    $out['active_plugins'] = $active;
    $app_pw = function_exists('wp_is_application_passwords_available') ? (bool) wp_is_application_passwords_available() : false;
    $out['app_passwords_available'] = $app_pw;
    $service_flag = false;
    if ($app_pw && function_exists('wp_is_application_passwords_available_for_user')) {
        $u = get_user_by('login', 'koto_service');
        if ($u instanceof WP_User) $service_flag = (bool) wp_is_application_passwords_available_for_user($u);
    }
    $out['app_passwords_enabled_for_service_user'] = $service_flag;
    $out['timezone'] = function_exists('wp_timezone_string') ? (string) wp_timezone_string() : (string) get_option('timezone_string', 'UTC');
    $counts = ['posts' => 0, 'pages' => 0, 'attachments' => 0];
    foreach (['post' => 'posts', 'page' => 'pages', 'attachment' => 'attachments'] as $t => $k) {
        $row = wp_count_posts($t); $sum = 0;
        if (is_object($row)) foreach (get_object_vars($row) as $n) if (is_numeric($n)) $sum += (int) $n;
        $counts[$k] = $sum;
    }
    $out['post_counts'] = $counts;
    $features = get_option(KOTOIQ_SHIM_OPT_FEATURES_ENABLED, []);
    if (!is_array($features)) $features = [];
    $out['kotoiq_shim_state'] = [
        'paired'                => ((string) get_option(KOTOIQ_SHIM_OPT_PUBKEY, '')) !== '',
        'dashboard_url'         => (string) get_option(KOTOIQ_SHIM_OPT_DASHBOARD_URL, ''),
        'pairing_window_open'   => ((int) get_option(KOTOIQ_SHIM_OPT_PAIRING_READY, 0)) > time(),
        'features_enabled'      => $features,
        'legacy_bearer_present' => ((string) get_option(KOTOIQ_SHIM_OPT_LEGACY_BEARER, '')) !== '',
    ];
    return rest_ensure_response($out);
}
