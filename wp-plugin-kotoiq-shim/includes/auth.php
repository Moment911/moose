<?php
/**
 * Auth — signed-envelope verification for /wp-json/kotoiq-shim/v1/rpc.
 *
 * Trust model:
 *   • Dashboard signs each request with its Ed25519 private key (never
 *     leaves Vercel).
 *   • Plugin verifies the signature against the public key stored at
 *     pair time (KOTOIQ_SHIM_OPT_PUBKEY, base64 of raw 32 bytes).
 *   • Each payload includes iat / exp (60s TTL) and a nonce. Replay
 *     attempts within the 90s nonce-cache window are rejected.
 *   • Tampering: signature covers the full payload bytes — any byte
 *     flip invalidates.
 *
 * Legacy fallback: kotoiq_shim_legacy_bearer_check() runs ONLY when
 * KOTOIQ_SHIM_OPT_LEGACY_BEARER is non-empty. That option stays empty
 * by default; Plan 11 may seed it for sites that can't run libsodium.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

/**
 * Permission callback for /rpc. Verifies the signed envelope, decodes
 * the payload, stashes it on the request, and returns true. Any failure
 * returns a WP_Error so REST returns the matching HTTP status.
 */
function kotoiq_shim_auth_check($req) {
    $body = $req->get_json_params();
    $payload_b64   = isset($body['payload'])   ? (string) $body['payload']   : '';
    $signature_b64 = isset($body['signature']) ? (string) $body['signature'] : '';

    if ($payload_b64 === '' || $signature_b64 === '') {
        // Optional cutover-window fallback. Returns WP_Error unless the
        // site has opted into a legacy bearer secret.
        return kotoiq_shim_legacy_bearer_check($req);
    }

    $payload_raw   = kotoiq_shim_b64url_decode($payload_b64);
    $signature_raw = kotoiq_shim_b64url_decode($signature_b64);

    if ($payload_raw === false || $signature_raw === false) {
        return new WP_Error('bad_envelope', 'Payload or signature is not valid base64url', ['status' => 401]);
    }

    $pubkey = kotoiq_shim_pubkey();
    if ($pubkey === '') {
        return new WP_Error('not_paired', 'Site has not been paired with a dashboard', ['status' => 401]);
    }
    if (strlen($pubkey) !== 32) {
        return new WP_Error('bad_pubkey_stored', 'Stored pubkey is not the expected 32 bytes', ['status' => 500]);
    }

    if (!function_exists('sodium_crypto_sign_verify_detached')) {
        return new WP_Error('no_sodium', 'libsodium is not available on this host', ['status' => 500]);
    }
    if (!sodium_crypto_sign_verify_detached($signature_raw, $payload_raw, $pubkey)) {
        return new WP_Error('bad_sig', 'Invalid signature', ['status' => 401]);
    }

    $decoded = json_decode($payload_raw, true);
    if (!is_array($decoded) || !isset($decoded['verb'], $decoded['exp'], $decoded['nonce'])) {
        return new WP_Error('bad_payload', 'Payload missing required claims', ['status' => 401]);
    }

    $exp = (int) $decoded['exp'];
    if ($exp < time()) {
        return new WP_Error('expired', 'Token expired', ['status' => 401]);
    }

    // Replay protection — store seen nonces for 90 seconds.
    $nonce = (string) $decoded['nonce'];
    if ($nonce === '') {
        return new WP_Error('bad_nonce', 'Nonce required', ['status' => 401]);
    }
    $nonce_key = 'kotoiq_shim_nonce_' . hash('sha256', $nonce);
    if (get_transient($nonce_key)) {
        return new WP_Error('replay', 'Nonce already used', ['status' => 401]);
    }
    set_transient($nonce_key, 1, 90);

    // Record successful dashboard contact for the admin-page "last seen"
    // indicator. Single local option write — no outbound HTTP, no telemetry.
    // Throttled to once per minute via the `kotoiq_shim_last_seen` option
    // value itself (skip write if updated within the last 60 seconds) so a
    // bursty deploy doesn't hammer the options table.
    $last_seen = (int) get_option(KOTOIQ_SHIM_OPT_LAST_SEEN, 0);
    $now = time();
    if ($now - $last_seen > 60) {
        update_option(KOTOIQ_SHIM_OPT_LAST_SEEN, $now, false);
    }

    // Stash the decoded payload for the dispatcher.
    $req->set_param('_verified_payload', $decoded);
    return true;
}

/**
 * Legacy bearer fallback — only honored if KOTOIQ_SHIM_OPT_LEGACY_BEARER
 * is non-empty. Plan 11 may seed this per-site for hosts that can't run
 * libsodium. Otherwise returns the "missing envelope" error so callers
 * see the same shape as the primary path.
 */
function kotoiq_shim_legacy_bearer_check($req) {
    $secret = (string) get_option(KOTOIQ_SHIM_OPT_LEGACY_BEARER, '');
    if ($secret === '') {
        return new WP_Error('missing_envelope', 'Signed envelope required', ['status' => 401]);
    }
    $auth = '';
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) { $auth = (string) $v; break; }
        }
    }
    if ($auth === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth = (string) $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (stripos($auth, 'Bearer ') !== 0) {
        return new WP_Error('missing_envelope', 'Signed envelope or Bearer fallback required', ['status' => 401]);
    }
    $presented = trim(substr($auth, 7));
    if (!hash_equals($secret, $presented)) {
        return new WP_Error('bad_bearer', 'Invalid legacy bearer secret', ['status' => 401]);
    }
    // Bearer fallback: no verified payload — callers MUST send the verb in
    // a raw `verb` field on the body when using this path.
    $body = $req->get_json_params();
    if (!isset($body['verb'])) {
        return new WP_Error('bad_payload', 'Verb required on legacy bearer path', ['status' => 400]);
    }
    $req->set_param('_verified_payload', [
        'verb'  => (string) $body['verb'],
        'args'  => isset($body['args']) && is_array($body['args']) ? $body['args'] : [],
        'iat'   => time(),
        'exp'   => time() + 60,
        'nonce' => 'legacy-' . wp_generate_password(12, false),
    ]);
    return true;
}

/**
 * base64url decode — strtr `-_` to `+/` then pad to multiple of 4.
 * PHP's base64_decode is strict mode false by default; we keep that to
 * tolerate stray whitespace from header transport.
 */
function kotoiq_shim_b64url_decode($s) {
    $s = strtr((string) $s, '-_', '+/');
    $pad = strlen($s) % 4;
    if ($pad) $s .= str_repeat('=', 4 - $pad);
    $out = base64_decode($s);
    return $out === false ? false : $out;
}

/**
 * Load the dashboard pubkey from options. Stored as base64 of the raw
 * 32-byte Ed25519 public key (NOT the PEM-wrapped form). Pairing extracts
 * the raw bytes before storage.
 */
function kotoiq_shim_pubkey() {
    $stored = (string) get_option(KOTOIQ_SHIM_OPT_PUBKEY, '');
    if ($stored === '') return '';
    $raw = base64_decode($stored, true);
    return $raw === false ? '' : $raw;
}
