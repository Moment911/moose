<?php
/**
 * Verb handlers — cron.* group.
 *
 * Provides:
 *   - kotoiq_shim_verb_cron_list       — pending wp-cron events
 *   - kotoiq_shim_verb_cron_trigger    — schedule a single event ~now
 *   - kotoiq_shim_verb_cron_unschedule — unschedule all events for a hook
 *
 * Hook names must match /^[a-z_]+$/ — generic primitives only. cron.trigger
 * does NOT execute hooks inline; it schedules via wp_schedule_single_event
 * so the WP-cron runner picks them up on the next request (stock semantics).
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

function kotoiq_shim_cron_validate_hook($hook) {
    if (!is_string($hook) || $hook === '' || strlen($hook) > 191) return false;
    return (bool) preg_match('/^[a-z_]+$/', $hook);
}

function kotoiq_shim_verb_cron_list($args) {
    unset($args);
    $cron = function_exists('_get_cron_array') ? _get_cron_array() : [];
    if (!is_array($cron)) $cron = [];
    $events = []; $now = time();
    foreach ($cron as $ts => $hooks) {
        if ($ts < $now || !is_array($hooks)) continue;
        foreach ($hooks as $hook => $entries) {
            if (!is_array($entries)) continue;
            foreach ($entries as $entry) {
                $events[] = [
                    'hook'     => (string) $hook,
                    'next_run' => (int) $ts,
                    'args'     => isset($entry['args']) && is_array($entry['args']) ? array_values($entry['args']) : [],
                    'schedule' => isset($entry['schedule']) && is_string($entry['schedule']) ? $entry['schedule'] : null,
                ];
                if (count($events) >= 100) break 3;
            }
        }
    }
    return rest_ensure_response(['events' => $events]);
}

function kotoiq_shim_verb_cron_trigger($args) {
    $hook = isset($args['hook']) ? (string) $args['hook'] : '';
    if (!kotoiq_shim_cron_validate_hook($hook)) return new WP_Error('bad_hook', 'hook must match /^[a-z_]+$/', ['status' => 400]);
    $raw = isset($args['args']) && is_array($args['args']) ? array_values($args['args']) : [];
    foreach ($raw as $a) if (!is_scalar($a) && $a !== null) return new WP_Error('bad_args', 'cron args must be scalars or null', ['status' => 400]);
    $when = time() + 1;
    if (wp_schedule_single_event($when, $hook, $raw) === false) return new WP_Error('schedule_failed', 'wp_schedule_single_event returned false', ['status' => 500]);
    return rest_ensure_response(['ok' => true, 'scheduled_at' => (int) $when, 'hook' => $hook, 'args' => $raw]);
}

function kotoiq_shim_verb_cron_unschedule($args) {
    $hook = isset($args['hook']) ? (string) $args['hook'] : '';
    if (!kotoiq_shim_cron_validate_hook($hook)) return new WP_Error('bad_hook', 'hook must match /^[a-z_]+$/', ['status' => 400]);
    $removed = 0;
    if (function_exists('wp_unschedule_hook')) {
        $maybe = wp_unschedule_hook($hook);
        if (is_int($maybe)) $removed = $maybe;
        elseif ($maybe === false) return new WP_Error('unschedule_failed', 'wp_unschedule_hook returned false', ['status' => 500]);
    } else {
        while (true) {
            $event = wp_get_scheduled_event($hook);
            if (!$event) break;
            wp_unschedule_event($event->timestamp, $hook, $event->args);
            $removed++;
            if ($removed > 500) break;
        }
    }
    return rest_ensure_response(['ok' => true, 'removed_count' => (int) $removed]);
}
