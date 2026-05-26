<?php
/**
 * Verb handlers — query.* group.
 *
 * kotoiq_shim_verb_query_select runs a hardcoded named query via
 * $wpdb->prepare with positional placeholders. No raw SQL accepted ever.
 * Adding a new named query requires editing this file (code review gate).
 *
 * Whitelist row: name => [sql_tpl, [[param,'s'|'d',xform], ...]] where the
 * limit row's xform is '<max>:<default>'. xform values: '' (raw), 'like'
 * (esc_like+%), 'tlike' (_transient_+esc_like+%), anything else = default
 * literal used when caller omits the param.
 *
 * Special name '__list_queries__' → returns array of registered keys.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

function kotoiq_shim_query_whitelist() {
    global $wpdb;
    static $W = null;
    if ($W !== null) return $W;
    $px = $wpdb->prefix;
    $W = [
        'posts.list_by_meta' => ["SELECT p.ID, p.post_title, p.post_modified, p.post_status, p.post_type FROM {$wpdb->posts} p INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID WHERE pm.meta_key = %s AND pm.meta_value = %s LIMIT %d", [['meta_key','s',''],['meta_value','s',''],['limit','d','5000:100']]],
        'posts.list_by_meta_key_prefix' => ["SELECT pm.post_id, pm.meta_key, pm.meta_value FROM {$wpdb->postmeta} pm WHERE pm.meta_key LIKE %s LIMIT %d", [['key_prefix','s','like'],['limit','d','5000:100']]],
        'options.list_by_prefix' => ["SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE %s LIMIT %d", [['prefix','s','like'],['limit','d','500:100']]],
        'transients.list_by_prefix' => ["SELECT option_name AS name, option_value AS value FROM {$wpdb->options} WHERE option_name LIKE %s LIMIT %d", [['prefix','s','tlike'],['limit','d','500:100']]],
        'database.list_text_tables' => ["SELECT TABLE_NAME AS table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_NAME LIKE %s LIMIT %d", [['table_like','s',"$px%"],['limit','d','100:100']]],
        'postmeta.list_by_key' => ["SELECT post_id, meta_value FROM {$wpdb->postmeta} WHERE meta_key = %s LIMIT %d", [['meta_key','s',''],['limit','d','5000:100']]],
        'posts.list_by_post_type' => ["SELECT ID, post_title, post_modified, post_status FROM {$wpdb->posts} WHERE post_type = %s AND post_status = %s ORDER BY post_modified DESC LIMIT %d", [['post_type','s',''],['status','s','publish'],['limit','d','1000:100']]],
    ];
    return $W;
}

function kotoiq_shim_verb_query_select($args) {
    global $wpdb;
    $name = isset($args['name']) ? (string) $args['name'] : '';
    if ($name === '__list_queries__') return rest_ensure_response(['queries' => array_keys(kotoiq_shim_query_whitelist())]);
    $W = kotoiq_shim_query_whitelist();
    if (!isset($W[$name])) return new WP_Error('unknown_query', "unknown named query: $name", ['status' => 400]);
    list($sql_tpl, $defs) = $W[$name];
    $in = isset($args['params']) && is_array($args['params']) ? $args['params'] : [];
    $ordered = [];
    foreach ($defs as $d) {
        list($p, $type, $xf) = $d;
        if ($p === 'limit') { list($mx, $dv) = explode(':', $xf); $lim = isset($in['limit']) ? (int) $in['limit'] : (int) $dv; $ordered[] = max(1, min((int) $mx, $lim)); continue; }
        $raw = array_key_exists($p, $in) ? $in[$p] : ($xf === '' || $xf === 'like' || $xf === 'tlike' ? null : $xf);
        if ($raw === null) return new WP_Error('missing_param', "missing param: $p", ['status' => 400]);
        $v = ($type === 'd') ? (int) $raw : (string) $raw;
        if ($xf === 'like') $v = $wpdb->esc_like($v) . '%'; elseif ($xf === 'tlike') $v = '_transient_' . $wpdb->esc_like($v) . '%';
        $ordered[] = $v;
    }
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.NotPrepared -- whitelist + prepare
    $sql = call_user_func_array([$wpdb, 'prepare'], array_merge([$sql_tpl], $ordered));
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- whitelisted named query
    $rows = $wpdb->get_results($sql, ARRAY_A);
    if (!is_array($rows)) $rows = [];
    return rest_ensure_response(['rows' => $rows, 'count' => count($rows)]);
}
