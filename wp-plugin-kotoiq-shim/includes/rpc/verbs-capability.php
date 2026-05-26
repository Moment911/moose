<?php
/**
 * Verb handlers — capability.* group.
 *
 * kotoiq_shim_verb_capability_apply grants/revokes caps on a role.
 * PROTECTED_ROLES (administrator) cannot be modified — would otherwise let
 * the dashboard self-escalate. ALWAYS_DENIED_CAPS (manage_options,
 * install_plugins, edit_themes, edit_plugins, edit_files, unfiltered_html,
 * create_users) cannot be granted via this verb. Removal of any cap is
 * always allowed (safer than granting). Every apply emits an audit event.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

if (!defined('KOTOIQ_SHIM_PROTECTED_ROLES')) define('KOTOIQ_SHIM_PROTECTED_ROLES', ['administrator']);
if (!defined('KOTOIQ_SHIM_ALWAYS_DENIED_CAPS')) define('KOTOIQ_SHIM_ALWAYS_DENIED_CAPS', ['manage_options', 'install_plugins', 'edit_themes', 'edit_plugins', 'edit_files', 'unfiltered_html', 'create_users']);

function kotoiq_shim_verb_capability_apply($args) {
    $r_slug = isset($args['role_slug']) ? (string) $args['role_slug'] : '';
    if (!preg_match('/^[a-z][a-z0-9_]*$/', $r_slug) || strlen($r_slug) > 60) return new WP_Error('bad_role', 'role_slug must match /^[a-z][a-z0-9_]*$/', ['status' => 400]);
    if (in_array($r_slug, KOTOIQ_SHIM_PROTECTED_ROLES, true)) return new WP_Error('protected_role', "role '$r_slug' is protected (administrator cannot be modified via this verb)", ['status' => 403]);
    $role = get_role($r_slug);
    if (!$role) return new WP_Error('role_not_found', "role '$r_slug' does not exist", ['status' => 404]);
    $add = isset($args['add_caps']) && is_array($args['add_caps']) ? $args['add_caps'] : [];
    $rem = isset($args['remove_caps']) && is_array($args['remove_caps']) ? $args['remove_caps'] : [];
    $added = []; $removed = []; $errors = [];
    foreach ($add as $c) {
        $c = (string) $c;
        if (!preg_match('/^[a-z][a-z0-9_]*$/', $c)) { $errors[] = ['cap' => $c, 'code' => 'bad_cap']; continue; }
        if (in_array($c, KOTOIQ_SHIM_ALWAYS_DENIED_CAPS, true)) { $errors[] = ['cap' => $c, 'code' => 'denied_cap', 'message' => "cap '$c' cannot be granted (administrator-only: manage_options, install_plugins, etc.)"]; continue; }
        $role->add_cap($c); $added[] = $c;
    }
    foreach ($rem as $c) {
        $c = (string) $c;
        if (!preg_match('/^[a-z][a-z0-9_]*$/', $c)) { $errors[] = ['cap' => $c, 'code' => 'bad_cap']; continue; }
        $role->remove_cap($c); $removed[] = $c;
    }
    if (function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('capability.apply', ['role' => $r_slug, 'added' => $added, 'removed' => $removed]);
    return rest_ensure_response(['ok' => true, 'role' => $r_slug, 'added' => $added, 'removed' => $removed, 'errors' => $errors]);
}
