<?php
/**
 * RPC dispatcher — one endpoint, verb-in-body.
 *
 * POST /wp-json/kotoiq-shim/v1/rpc
 *   Body: { payload: <base64url>, signature: <base64url> }
 *   Inner payload (after sig-verify): { verb, args, iat, exp, nonce }
 *
 * The verb table is loaded lazily from includes/rpc/verb-table.php — that
 * file is the single PHP-side mirror of src/lib/wp-shim/verbList.ts.
 *
 * Per-verb-per-IP rate limiting: TODO Plan 11 — currently relies on the
 * 60s exp + nonce store to bound replay, and on host-level rate limits
 * for raw flooding.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

if (!function_exists('kotoiq_shim_verb_not_yet_implemented')) {
    /**
     * Stub handler used by verb-table.php entries that have not yet been
     * wired to a real handler. Returns 501. Plans 10-05 / 10-06 replace
     * each remaining stub mapping with a real handler.
     */
    function kotoiq_shim_verb_not_yet_implemented($args) {
        unset($args);
        return new WP_Error(
            'not_implemented',
            'Verb stub — implemented in a later plan',
            ['status' => 501]
        );
    }
}

add_action('rest_api_init', function () {
    register_rest_route(KOTOIQ_SHIM_REST_NS, '/rpc', [
        'methods'             => 'POST',
        'callback'            => 'kotoiq_shim_dispatch',
        'permission_callback' => 'kotoiq_shim_auth_check',
    ]);
});

/**
 * Dispatch a verified payload to its verb handler.
 * Auth already happened in kotoiq_shim_auth_check; the verified payload
 * is on the request as `_verified_payload`.
 */
function kotoiq_shim_dispatch($req) {
    $payload = $req->get_param('_verified_payload');
    if (!is_array($payload) || !isset($payload['verb'])) {
        return new WP_Error('bad_dispatch', 'Verified payload missing', ['status' => 500]);
    }

    $verb = (string) $payload['verb'];
    $args = isset($payload['args']) && is_array($payload['args']) ? $payload['args'] : [];

    $verbs = require KOTOIQ_SHIM_DIR . 'includes/rpc/verb-table.php';

    if (!isset($verbs[$verb]) || !is_callable($verbs[$verb])) {
        return new WP_Error('unknown_verb', "Unknown verb: $verb", ['status' => 400]);
    }

    // Optional per-verb feature flag — dashboard can disable a verb
    // remotely without uninstalling. Only an explicit `false` disables;
    // an absent entry means enabled.
    $features = get_option(KOTOIQ_SHIM_OPT_FEATURES_ENABLED, []);
    if (is_array($features) && array_key_exists($verb, $features) && $features[$verb] === false) {
        return new WP_Error('feature_disabled', "Verb disabled: $verb", ['status' => 403]);
    }

    try {
        return call_user_func($verbs[$verb], $args);
    } catch (\Throwable $e) {
        return new WP_Error('handler_exception', $e->getMessage(), ['status' => 500]);
    }
}
