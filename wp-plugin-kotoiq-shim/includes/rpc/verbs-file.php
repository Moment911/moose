<?php
/**
 * Verb handlers — file.* group.
 *
 * Provides:
 *   - kotoiq_shim_verb_file_read   (read confined to wp-content/**)
 *   - kotoiq_shim_verb_file_exists (read confined to wp-content/**)
 *   - kotoiq_shim_verb_file_write  (write confined to wp-content/uploads/kotoiq/**)
 *   - kotoiq_shim_verb_file_delete (delete confined to wp-content/uploads/kotoiq/**)
 *
 * Path confinement (per 10-RESEARCH.md §Risks & Unknowns):
 *   • Input paths are RELATIVE strings rooted at wp-content/.
 *   • Path is joined with the allowed root then canonicalised via realpath().
 *   • If the canonical path does not start with the allowed root, 403.
 *   • Symlinks escaping the root return false from realpath() during reads,
 *     or resolve to an outside path and are rejected by the prefix check.
 *
 * The file is `require_once`d by kotoiq-shim.php so function_exists() guards
 * are omitted; the loader contract prevents double-declaration.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

function kotoiq_shim_file_clean_path($raw) {
    if (!is_string($raw) || $raw === '' || strlen($raw) > 512) return new WP_Error('bad_path', 'path must be a 1-512 char string', ['status' => 400]);
    if (strpos($raw, "\0") !== false || strpos($raw, '\\') !== false || strpos($raw, '://') !== false) return new WP_Error('bad_path', 'illegal path syntax', ['status' => 400]);
    $clean = ltrim($raw, '/');
    foreach (explode('/', $clean) as $p) if ($p === '..') return new WP_Error('forbidden', 'path traversal not allowed', ['status' => 403]);
    return $clean;
}

function kotoiq_shim_file_resolve_read($relative) {
    $root = realpath(WP_CONTENT_DIR);
    if (!is_string($root) || $root === '') return new WP_Error('host_misconfigured', 'wp-content not canonicalisable', ['status' => 500]);
    $resolved = realpath($root . DIRECTORY_SEPARATOR . $relative);
    if (!is_string($resolved) || $resolved === '') return new WP_Error('not_found', 'path does not exist', ['status' => 404]);
    if ($resolved !== $root && strpos($resolved, $root . DIRECTORY_SEPARATOR) !== 0) return new WP_Error('forbidden', 'path escapes wp-content', ['status' => 403]);
    return $resolved;
}

function kotoiq_shim_file_resolve_write($relative) {
    $uploads = wp_upload_dir();
    if (empty($uploads['basedir']) || !is_string($uploads['basedir'])) return new WP_Error('host_misconfigured', 'uploads dir unavailable', ['status' => 500]);
    $root_abs = $uploads['basedir'] . DIRECTORY_SEPARATOR . 'kotoiq';
    if (!is_dir($root_abs)) wp_mkdir_p($root_abs);
    $root = realpath($root_abs);
    if (!is_string($root) || $root === '') return new WP_Error('host_misconfigured', 'kotoiq uploads dir uncreatable', ['status' => 500]);
    if (strpos($relative, 'uploads/kotoiq/') !== 0) return new WP_Error('forbidden', 'writes confined to wp-content/uploads/kotoiq/', ['status' => 403]);
    $sub = substr($relative, strlen('uploads/kotoiq/'));
    if ($sub === '' || substr($sub, -1) === '/') return new WP_Error('bad_path', 'file name required', ['status' => 400]);
    $base = basename($sub);
    if ($base === '' || $base === '.' || $base === '..') return new WP_Error('bad_path', 'invalid basename', ['status' => 400]);
    $sub_dir = dirname($sub);
    $abs_dir = ($sub_dir === '.' || $sub_dir === '') ? $root : $root . DIRECTORY_SEPARATOR . $sub_dir;
    if (!is_dir($abs_dir)) wp_mkdir_p($abs_dir);
    $dir = realpath($abs_dir);
    if (!is_string($dir) || $dir === '') return new WP_Error('host_misconfigured', 'target dir uncanonical', ['status' => 500]);
    if ($dir !== $root && strpos($dir, $root . DIRECTORY_SEPARATOR) !== 0) return new WP_Error('forbidden', 'directory escapes kotoiq root', ['status' => 403]);
    return $dir . DIRECTORY_SEPARATOR . $base;
}

function kotoiq_shim_verb_file_read($args) {
    $clean = kotoiq_shim_file_clean_path(isset($args['path']) ? (string) $args['path'] : '');
    if (is_wp_error($clean)) return $clean;
    $resolved = kotoiq_shim_file_resolve_read($clean);
    if (is_wp_error($resolved)) return $resolved;
    if (!is_file($resolved) || !is_readable($resolved)) return new WP_Error('not_readable', 'target not readable', ['status' => 404]);
    $size = filesize($resolved);
    if ($size === false) return new WP_Error('stat_failed', 'cannot stat', ['status' => 500]);
    if ($size > 8 * 1024 * 1024) return new WP_Error('too_large', 'file exceeds 8 MiB read cap', ['status' => 413]);
    $content = file_get_contents($resolved);
    if ($content === false) return new WP_Error('read_failed', 'cannot read', ['status' => 500]);
    $mime = function_exists('wp_check_filetype') ? wp_check_filetype($resolved) : ['type' => null];
    return rest_ensure_response(['content_base64' => base64_encode($content), 'size' => (int) $size, 'mtime' => (int) filemtime($resolved), 'mime' => isset($mime['type']) ? (string) $mime['type'] : '']);
}

function kotoiq_shim_verb_file_exists($args) {
    $clean = kotoiq_shim_file_clean_path(isset($args['path']) ? (string) $args['path'] : '');
    if (is_wp_error($clean)) return $clean;
    $resolved = kotoiq_shim_file_resolve_read($clean);
    if (is_wp_error($resolved)) {
        if ($resolved->get_error_code() === 'not_found') return rest_ensure_response(['exists' => false]);
        return $resolved;
    }
    if (!is_file($resolved)) return rest_ensure_response(['exists' => false]);
    return rest_ensure_response(['exists' => true, 'size' => (int) filesize($resolved), 'mtime' => (int) filemtime($resolved)]);
}

function kotoiq_shim_verb_file_write($args) {
    $clean = kotoiq_shim_file_clean_path(isset($args['path']) ? (string) $args['path'] : '');
    if (is_wp_error($clean)) return $clean;
    $target = kotoiq_shim_file_resolve_write($clean);
    if (is_wp_error($target)) return $target;
    $b64 = isset($args['content_base64']) ? (string) $args['content_base64'] : '';
    if ($b64 === '') return new WP_Error('bad_args', 'content_base64 required', ['status' => 400]);
    $content = base64_decode($b64, true);
    if ($content === false) return new WP_Error('bad_args', 'content_base64 not base64', ['status' => 400]);
    if (strlen($content) > 8 * 1024 * 1024) return new WP_Error('too_large', 'content exceeds 8 MiB write cap', ['status' => 413]);
    $mode = isset($args['mode']) ? (string) $args['mode'] : 'overwrite';
    if ($mode !== 'overwrite' && $mode !== 'append') return new WP_Error('bad_mode', "mode must be 'overwrite' or 'append'", ['status' => 400]);
    $bytes = file_put_contents($target, $content, $mode === 'append' ? FILE_APPEND : 0);
    if ($bytes === false) return new WP_Error('write_failed', 'cannot write', ['status' => 500]);
    if (function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('file_written', ['path' => $clean, 'mode' => $mode, 'bytes' => (int) $bytes]);
    return rest_ensure_response(['ok' => true, 'bytes_written' => (int) $bytes, 'mtime' => (int) filemtime($target)]);
}

function kotoiq_shim_verb_file_delete($args) {
    $clean = kotoiq_shim_file_clean_path(isset($args['path']) ? (string) $args['path'] : '');
    if (is_wp_error($clean)) return $clean;
    $target = kotoiq_shim_file_resolve_write($clean);
    if (is_wp_error($target)) return $target;
    if (!file_exists($target)) return rest_ensure_response(['ok' => true, 'deleted' => false]);
    $deleted = (bool) @unlink($target);
    if (function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('file_deleted', ['path' => $clean, 'deleted' => $deleted]);
    return rest_ensure_response(['ok' => true, 'deleted' => $deleted]);
}
