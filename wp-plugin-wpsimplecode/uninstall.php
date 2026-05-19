<?php
/**
 * Uninstall WPSimpleCode — fired only when the user clicks "Delete" on the
 * plugin page, NOT on simple deactivation. Cleans up every option and meta
 * the plugin created. Snippet execution caps on roles are also removed.
 *
 * @package WPSimpleCode
 */

if (!defined('WP_UNINSTALL_PLUGIN')) exit;

$options = [
    'wpsc_api_key',
    'wpsc_remote_allowed',
    'wpsc_remote_host',
    'wpsc_access_policy',
    'wpsc_disable_file_edit_global',
    'wpsc_snippets',
];
foreach ($options as $opt) {
    delete_option($opt);
    delete_site_option($opt);
}

// Remove every wpsc_* custom capability we may have added
$wpsc_caps = [
    'koto_execute_php_snippets', // kept name for compatibility with policy mapping
    'koto_create_text_snippets',
    'koto_manage_snippets',
    'koto_manage_pixels',
    'koto_manage_access',
];
if (function_exists('wp_roles')) {
    foreach (wp_roles()->roles as $slug => $_) {
        $role = get_role($slug);
        if (!$role) continue;
        foreach ($wpsc_caps as $cap) $role->remove_cap($cap);
    }
}
