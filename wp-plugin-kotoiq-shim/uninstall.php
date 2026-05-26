<?php
/**
 * Uninstall hook — fires when an admin deletes the plugin from
 * Plugins → Installed Plugins → Delete. WordPress loads this file in
 * isolation (no other plugin files are guaranteed to be loaded), so we
 * use literal option keys instead of the KOTOIQ_SHIM_OPT_* constants.
 *
 * Cleanup scope:
 *   • Delete shim-only options (kotoiq_shim_*).
 *   • Drop the kotoiq_service custom role.
 *
 * Intentionally NOT cleaned up:
 *   • The koto_service WP user — kept for audit trail. Site owner can
 *     delete manually if desired.
 *   • Any options owned by the legacy v3.x plugin — those belong to a
 *     separate side-by-side install (D-Cutover-side-by-side USER-LOCKED).
 *     Touching them would break v3 rollback.
 *
 * @package KotoIQShim
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Shim-only options. Literal strings — constants may not be loaded.
delete_option('kotoiq_shim_pubkey');
delete_option('kotoiq_shim_pairing_ready');
delete_option('kotoiq_shim_dashboard_url');
delete_option('kotoiq_shim_features_enabled');
delete_option('kotoiq_shim_legacy_bearer');

// Drop the custom service role. The koto_service USER is intentionally
// preserved (audit trail). Site owner can delete via Users → Delete.
if (function_exists('get_role') && function_exists('remove_role')) {
    if (get_role('kotoiq_service')) {
        remove_role('kotoiq_service');
    }
}
