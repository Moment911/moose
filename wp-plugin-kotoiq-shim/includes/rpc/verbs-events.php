<?php
/**
 * Verb handlers — events.* group + internal emit helper.
 *
 * Provides:
 *   - kotoiq_shim_emit_event($type, $payload)   — INTERNAL helper, not a verb
 *   - kotoiq_shim_verb_events_log_tail($args)   — reads recent log entries
 *
 * The log is a rolling array of up to 500 events stored in a single
 * autoload=false wp_option. Other verb handlers (file.write, option.update,
 * option.delete, plugin.toggle) call kotoiq_shim_emit_event() so a verifier
 * can audit high-impact writes post-incident.
 *
 * This is a defensive plumbing primitive, NOT a high-volume telemetry
 * stream — bounded volume is intentional.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

if (!defined('KOTOIQ_SHIM_EVENTS_OPTION')) define('KOTOIQ_SHIM_EVENTS_OPTION', 'kotoiq_shim_events_log');
if (!defined('KOTOIQ_SHIM_EVENTS_MAX')) define('KOTOIQ_SHIM_EVENTS_MAX', 500);

function kotoiq_shim_emit_event($type, $payload) {
    if (!is_string($type) || $type === '') return;
    $log = get_option(KOTOIQ_SHIM_EVENTS_OPTION, []);
    if (!is_array($log)) $log = [];
    $log[] = ['ts' => time(), 'type' => $type, 'payload' => $payload];
    $max = (int) KOTOIQ_SHIM_EVENTS_MAX;
    if (count($log) > $max) $log = array_slice($log, -$max);
    update_option(KOTOIQ_SHIM_EVENTS_OPTION, $log, false);
}

function kotoiq_shim_verb_events_log_tail($args) {
    $count = isset($args['count']) ? (int) $args['count'] : 50;
    if ($count < 1) $count = 1;
    if ($count > 200) $count = 200;
    $log = get_option(KOTOIQ_SHIM_EVENTS_OPTION, []);
    if (!is_array($log)) $log = [];
    $total = count($log);
    $tail = ($total <= $count) ? $log : array_slice($log, -$count);
    $tail = array_reverse($tail);
    return rest_ensure_response(['events' => array_values($tail), 'total' => (int) $total]);
}
