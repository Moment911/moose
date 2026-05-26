<?php
/**
 * Runtime — generic webhook emitter.
 *
 * Reads URL map from a single wp_option (kotoiq_shim_webhooks) and POSTs
 * non-sensitive event metadata to the dashboard-registered URL on each
 * matching WP action. URL must be https://; failures are logged to the
 * events audit log (no retry — fire-and-forget).
 *
 * Generic primitive — the plugin source reveals "we POST WP events to a URL
 * stored in an option". Which events matter to KotoIQ is configured
 * dashboard-side via webhook.set.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

if (!defined('KOTOIQ_SHIM_OPT_WEBHOOKS')) define('KOTOIQ_SHIM_OPT_WEBHOOKS', 'kotoiq_shim_webhooks');
if (!defined('KOTOIQ_SHIM_WEBHOOK_ALLOWED_EVENTS')) define('KOTOIQ_SHIM_WEBHOOK_ALLOWED_EVENTS', ['save_post', 'publish_post', 'delete_post', 'trashed_post', 'wp_login', 'wp_logout', 'shim_health_check_failed']);

function kotoiq_shim_emit_webhook($event, $payload) {
    $map = get_option(KOTOIQ_SHIM_OPT_WEBHOOKS, []);
    if (!is_array($map) || empty($map[$event])) return;
    $url = (string) $map[$event];
    if (strpos($url, 'https://') !== 0) return;
    $res = wp_remote_post($url, ['timeout' => 5, 'blocking' => false, 'headers' => ['Content-Type' => 'application/json', 'X-Koto-Shim-Event' => $event], 'body' => wp_json_encode(['event' => $event, 'payload' => $payload, 'site_url' => home_url(), 'time' => time()])]);
    if (is_wp_error($res) && function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('webhook.error', ['event' => $event, 'msg' => $res->get_error_message()]);
}

add_action('save_post', function ($post_id, $post) { if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) return; kotoiq_shim_emit_webhook('save_post', ['post_id' => (int) $post_id, 'post_type' => isset($post->post_type) ? (string) $post->post_type : '', 'post_status' => isset($post->post_status) ? (string) $post->post_status : '']); }, 10, 2);
add_action('publish_post', function ($post_id, $post) { kotoiq_shim_emit_webhook('publish_post', ['post_id' => (int) $post_id, 'post_type' => isset($post->post_type) ? (string) $post->post_type : '']); }, 10, 2);
add_action('deleted_post', function ($post_id) { kotoiq_shim_emit_webhook('delete_post', ['post_id' => (int) $post_id]); }, 10);
add_action('trashed_post', function ($post_id) { kotoiq_shim_emit_webhook('trashed_post', ['post_id' => (int) $post_id]); }, 10);
add_action('wp_login', function ($user_login, $user) { kotoiq_shim_emit_webhook('wp_login', ['user_login' => (string) $user_login, 'user_id' => isset($user->ID) ? (int) $user->ID : 0]); }, 10, 2);
add_action('wp_logout', function ($user_id) { kotoiq_shim_emit_webhook('wp_logout', ['user_id' => (int) $user_id]); });
