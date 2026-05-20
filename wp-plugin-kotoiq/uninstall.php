<?php
/**
 * Uninstall KotoIQ — fires only when the user clicks "Delete" on the
 * plugin page, NOT on simple deactivation. Cleans every option the plugin
 * created (including the wpsc_* keys we kept for back-compat with sites
 * that upgraded from WPSimpleCode).
 *
 * @package KotoIQ
 */

if (!defined('WP_UNINSTALL_PLUGIN')) exit;

$options = [
    // Inherited from WPSimpleCode — same keys, same data.
    'wpsc_api_key',
    'wpsc_remote_allowed',
    'wpsc_remote_host',
    'wpsc_access_policy',
    'wpsc_disable_file_edit_global',
    'wpsc_snippets',
    // KotoIQ + module-loader.
    'koto_modules_enabled',
    // SEO module — inherited from the standalone Koto SEO 2.0.0 plugin.
    'koto_api_key',
    'koto_agency_url',
    'koto_client_id',
    'koto_site_id',
    'koto_last_sync',
    'koto_last_automation',
];
foreach ($options as $opt) {
    delete_option($opt);
    delete_site_option($opt);
}

// Strip every custom capability we may have added via the access module.
$kotoiq_caps = [
    'execute_php_snippets',
    'create_text_snippets',
    'manage_snippets',
    'manage_pixels',
    'manage_access',
];
if (function_exists('wp_roles')) {
    foreach (wp_roles()->roles as $slug => $_) {
        $role = get_role($slug);
        if (!$role) continue;
        foreach ($kotoiq_caps as $cap) $role->remove_cap($cap);
    }
}

// Clear all koto_rotate transients (content-rotation module).
global $wpdb;
$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_koto_rotate_%' OR option_name LIKE '_transient_timeout_koto_rotate_%'");
