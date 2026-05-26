<?php
/**
 * Verb handlers — webhook.* group.
 *
 * kotoiq_shim_verb_webhook_set registers (or unregisters via url=null) an
 * outbound webhook URL for a specific WP event. URL must be https://. The
 * allowed-event list is hardcoded; the emitter in runtime/webhook-emitter.php
 * reads the stored map and POSTs on each matching action.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

function kotoiq_shim_verb_webhook_set($args) {
    $event = isset($args['event']) ? (string) $args['event'] : '';
    if (!in_array($event, KOTOIQ_SHIM_WEBHOOK_ALLOWED_EVENTS, true)) return new WP_Error('event_denied', "event '$event' not in allowed list", ['status' => 400]);
    $url_raw = array_key_exists('url', $args) ? $args['url'] : '';
    $url = ($url_raw === null) ? null : (string) $url_raw;
    if ($url !== null && strpos($url, 'https://') !== 0) return new WP_Error('bad_url', 'url must start with https:// (or null to unregister)', ['status' => 400]);
    $map = get_option(KOTOIQ_SHIM_OPT_WEBHOOKS, []);
    if (!is_array($map)) $map = [];
    if ($url === null) unset($map[$event]); else $map[$event] = $url;
    update_option(KOTOIQ_SHIM_OPT_WEBHOOKS, $map, false);
    if (function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('webhook.set', ['event' => $event, 'url' => $url]);
    return rest_ensure_response(['ok' => true, 'event' => $event, 'url' => $url, 'all_webhooks' => $map]);
}
