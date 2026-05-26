<?php
/**
 * Verb handlers — post.* + meta.* group.
 *
 * Provides:
 *   - kotoiq_shim_verb_post_get_meta_bulk — batch meta read
 *   - kotoiq_shim_verb_meta_update        — batch meta write (null value = delete)
 *   - kotoiq_shim_verb_meta_delete        — single-key delete
 *
 * Batch caps: post.get_meta_bulk 100 posts × 50 keys, meta.update 100 entries.
 * meta.update is non-atomic by design (Pitfall 4 in 10-RESEARCH.md §RPC
 * Verb Design): individual entries can fail without aborting the batch;
 * callers receive applied count + per-failure errors array.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

function kotoiq_shim_verb_post_get_meta_bulk($args) {
    $posts = isset($args['posts']) && is_array($args['posts']) ? $args['posts'] : null;
    if ($posts === null) return new WP_Error('bad_args', 'posts must be an array', ['status' => 400]);
    if (count($posts) > 100) return new WP_Error('too_many', 'posts capped at 100 per call', ['status' => 400]);
    $results = []; $errors = [];
    foreach ($posts as $entry) {
        if (!is_array($entry)) continue;
        $post_id = isset($entry['post_id']) ? (int) $entry['post_id'] : 0;
        $keys = isset($entry['keys']) && is_array($entry['keys']) ? $entry['keys'] : [];
        if ($post_id <= 0) { $errors[] = ['post_id' => $post_id, 'code' => 'bad_post_id', 'message' => 'post_id must be > 0']; continue; }
        if (count($keys) > 50) { $errors[] = ['post_id' => $post_id, 'code' => 'too_many_keys', 'message' => 'keys capped at 50 per post']; continue; }
        if (!get_post($post_id)) { $errors[] = ['post_id' => $post_id, 'code' => 'not_found', 'message' => 'post does not exist']; continue; }
        $row = [];
        foreach ($keys as $key) {
            if (!is_string($key) || $key === '' || strlen($key) > 255) { $errors[] = ['post_id' => $post_id, 'code' => 'bad_key', 'message' => 'meta key must be a 1-255 char string']; continue; }
            $row[$key] = get_post_meta($post_id, $key, true);
        }
        $results[(string) $post_id] = $row;
    }
    return rest_ensure_response(['results' => $results, 'errors' => $errors]);
}

function kotoiq_shim_verb_meta_update($args) {
    $updates = isset($args['updates']) && is_array($args['updates']) ? $args['updates'] : null;
    if ($updates === null) return new WP_Error('bad_args', 'updates must be an array', ['status' => 400]);
    if (count($updates) > 100) return new WP_Error('too_many', 'updates capped at 100 per call', ['status' => 400]);
    $applied = 0; $errors = [];
    foreach ($updates as $u) {
        if (!is_array($u)) { $errors[] = ['post_id' => 0, 'key' => '', 'code' => 'bad_entry', 'message' => 'entry must be an object']; continue; }
        $post_id = isset($u['post_id']) ? (int) $u['post_id'] : 0;
        $key = isset($u['key']) ? (string) $u['key'] : '';
        $value = array_key_exists('value', $u) ? $u['value'] : null;
        if ($post_id <= 0) { $errors[] = ['post_id' => $post_id, 'key' => $key, 'code' => 'bad_post_id', 'message' => 'post_id must be > 0']; continue; }
        if ($key === '' || strlen($key) > 255) { $errors[] = ['post_id' => $post_id, 'key' => $key, 'code' => 'bad_key', 'message' => 'key length must be 1-255']; continue; }
        if (!get_post($post_id)) { $errors[] = ['post_id' => $post_id, 'key' => $key, 'code' => 'not_found', 'message' => 'post does not exist']; continue; }
        if ($value === null) {
            if (delete_post_meta($post_id, $key) === false) $errors[] = ['post_id' => $post_id, 'key' => $key, 'code' => 'delete_failed', 'message' => 'delete_post_meta returned false'];
            else $applied++;
            continue;
        }
        try { update_post_meta($post_id, $key, $value); $applied++; }
        catch (\Throwable $e) { $errors[] = ['post_id' => $post_id, 'key' => $key, 'code' => 'exception', 'message' => $e->getMessage()]; }
    }
    return rest_ensure_response(['applied' => $applied, 'errors' => $errors]);
}

function kotoiq_shim_verb_meta_delete($args) {
    $post_id = isset($args['post_id']) ? (int) $args['post_id'] : 0;
    $key = isset($args['key']) ? (string) $args['key'] : '';
    if ($post_id <= 0) return new WP_Error('bad_post_id', 'post_id must be > 0', ['status' => 400]);
    if ($key === '' || strlen($key) > 255) return new WP_Error('bad_key', 'key length must be 1-255', ['status' => 400]);
    return rest_ensure_response(['ok' => true, 'deleted' => (bool) delete_post_meta($post_id, $key)]);
}
