<?php
/**
 * Search & Replace — REST routes + serialized-safe engine.
 *
 * Routes (under WPSC_REST_NS):
 *   POST search-replace/tables   — list tables with text columns + row counts
 *   POST search-replace/scan     — chunked scan (preview OR apply with undo journal)
 *   POST search-replace/restore  — accept undo journal entries and write before_values back
 *
 * @package WPSimpleCode
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
    register_rest_route(WPSC_REST_NS, '/search-replace/tables', [
        'methods'  => 'POST',
        'callback' => 'wpsc_sr_list_tables',
        'permission_callback' => 'wpsc_perm_read',
    ]);
    register_rest_route(WPSC_REST_NS, '/search-replace/scan', [
        'methods'  => 'POST',
        'callback' => 'wpsc_sr_scan',
        'permission_callback' => 'wpsc_perm_write',
    ]);
    register_rest_route(WPSC_REST_NS, '/search-replace/restore', [
        'methods'  => 'POST',
        'callback' => 'wpsc_sr_restore',
        'permission_callback' => 'wpsc_perm_write',
    ]);
});

function wpsc_sr_list_tables($req) {
    global $wpdb;
    $prefix = $wpdb->prefix;

    // SHOW TABLES + SHOW KEYS + SHOW COLUMNS — these only require permission on
    // the table itself, unlike INFORMATION_SCHEMA which many managed hosts
    // restrict for the WP DB user (saw this on LiteSpeed-backed hosts).
    $like   = $wpdb->esc_like($prefix) . '%';
    $tables = $wpdb->get_col($wpdb->prepare("SHOW TABLES LIKE %s", $like));

    $out = [];
    foreach ((array) $tables as $tname) {
        if (!is_string($tname) || strpos($tname, $prefix) !== 0) continue;
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $tname)) continue;

        $key_rows = $wpdb->get_results("SHOW KEYS FROM `{$tname}` WHERE Key_name = 'PRIMARY'", ARRAY_A);
        if (empty($key_rows) || empty($key_rows[0]['Column_name'])) continue;
        $pk = $key_rows[0]['Column_name'];

        $col_rows = $wpdb->get_results("SHOW COLUMNS FROM `{$tname}`", ARRAY_A);
        if (empty($col_rows)) continue;
        $text_cols = [];
        foreach ($col_rows as $c) {
            $type = isset($c['Type']) ? strtolower((string) $c['Type']) : '';
            if (preg_match('/^(text|longtext|mediumtext|tinytext|varchar|char)/', $type)) {
                $text_cols[] = $c['Field'];
            }
        }
        if (empty($text_cols)) continue;

        $rows_count = 0;
        $status = $wpdb->get_row($wpdb->prepare("SHOW TABLE STATUS LIKE %s", $tname), ARRAY_A);
        if ($status && isset($status['Rows'])) $rows_count = (int) $status['Rows'];

        $out[] = [
            'name'        => $tname,
            'rows'        => $rows_count,
            'primary_key' => $pk,
            'columns'     => $text_cols,
            'is_core'     => in_array(str_replace($prefix, '', $tname), [
                'posts','postmeta','options','terms','termmeta',
                'term_relationships','term_taxonomy','comments','commentmeta',
                'users','usermeta','links',
            ], true),
        ];
    }
    return rest_ensure_response(['tables' => $out, 'prefix' => $prefix]);
}

function wpsc_sr_scan($req) {
    global $wpdb;
    $p = $req->get_json_params();
    $table   = isset($p['table']) ? (string) $p['table'] : '';
    $pk      = isset($p['primary_key']) ? (string) $p['primary_key'] : '';
    $cols    = (isset($p['columns']) && is_array($p['columns'])) ? $p['columns'] : [];
    $search  = isset($p['search']) ? (string) $p['search'] : '';
    $replace = isset($p['replace']) ? (string) $p['replace'] : '';
    $options = (isset($p['options']) && is_array($p['options'])) ? $p['options'] : [];
    $dry_run = !empty($p['dry_run']);
    $offset  = max(0, (int) ($p['offset'] ?? 0));
    $limit   = min(500, max(1, (int) ($p['limit'] ?? 100)));
    $sample_cap = max(0, (int) ($p['sample_cap'] ?? 25));

    if ($table === '' || empty($cols) || $pk === '' || $search === '') {
        return new WP_Error('bad_params', 'table, primary_key, columns, search required', ['status' => 400]);
    }
    if (strpos($table, $wpdb->prefix) !== 0) {
        return new WP_Error('bad_table', 'Table outside wpdb prefix', ['status' => 400]);
    }
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $pk)) {
        return new WP_Error('bad_pk', 'Invalid primary key name', ['status' => 400]);
    }
    foreach ($cols as $c) {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $c)) {
            return new WP_Error('bad_col', "Invalid column name: $c", ['status' => 400]);
        }
    }

    $col_list = '`' . implode('`,`', $cols) . '`';
    $sql = $wpdb->prepare(
        "SELECT `$pk` AS __pk__, $col_list FROM `$table` ORDER BY `$pk` ASC LIMIT %d OFFSET %d",
        $limit, $offset
    );
    $rows = $wpdb->get_results($sql, ARRAY_A);
    if ($rows === null) {
        return new WP_Error('query_failed', $wpdb->last_error, ['status' => 500]);
    }

    $rows_scanned = count($rows);
    $matches = 0; $replacements = 0; $rows_changed = 0;
    $changes = []; $sample = [];

    foreach ($rows as $row) {
        $pk_val = (string) $row['__pk__'];
        $row_had_change = false;

        foreach ($cols as $col) {
            $orig = $row[$col] ?? null;
            if ($orig === null || $orig === '') continue;

            $new = wpsc_sr_replace_value($orig, $search, $replace, $options);
            if ($new === $orig) continue;

            $count_in_field = wpsc_sr_count_matches($orig, $search, $options);
            $matches      += $count_in_field;
            $replacements += $count_in_field;
            $row_had_change = true;

            $changes[] = [
                'pk'     => $pk_val,
                'column' => $col,
                'before' => is_string($orig) ? $orig : maybe_serialize($orig),
                'after'  => is_string($new)  ? $new  : maybe_serialize($new),
                'count'  => $count_in_field,
            ];

            if (count($sample) < $sample_cap) {
                $sample[] = [
                    'pk'     => $pk_val,
                    'column' => $col,
                    'before' => wpsc_sr_truncate($orig, 400),
                    'after'  => wpsc_sr_truncate($new, 400),
                ];
            }
            if (!$dry_run) {
                $wpdb->update($table, [$col => $new], [$pk => $pk_val]);
            }
        }
        if ($row_had_change) $rows_changed++;
    }

    return rest_ensure_response([
        'scanned'      => $rows_scanned,
        'matches'      => $matches,
        'replacements' => $replacements,
        'rows_changed' => $rows_changed,
        'changes'      => $dry_run ? [] : $changes,
        'sample'       => $sample,
        'has_more'     => $rows_scanned === $limit,
        'next_offset'  => $offset + $rows_scanned,
    ]);
}

function wpsc_sr_restore($req) {
    global $wpdb;
    $p = $req->get_json_params();
    $changes = (isset($p['changes']) && is_array($p['changes'])) ? $p['changes'] : [];
    $restored = 0;
    $errors = [];
    foreach ($changes as $c) {
        $table  = isset($c['table']) ? (string) $c['table'] : '';
        $pk_col = isset($c['pk_column']) ? (string) $c['pk_column'] : '';
        $pk_val = $c['pk_value'] ?? null;
        $col    = isset($c['column']) ? (string) $c['column'] : '';
        $before = $c['before_value'] ?? null;
        if ($table === '' || $pk_col === '' || $pk_val === null || $col === '' || $before === null) {
            $errors[] = 'missing fields'; continue;
        }
        if (strpos($table, $wpdb->prefix) !== 0) { $errors[] = "$table outside wpdb prefix"; continue; }
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $pk_col) || !preg_match('/^[a-zA-Z0-9_]+$/', $col)) {
            $errors[] = 'invalid identifier'; continue;
        }
        $r = $wpdb->update($table, [$col => $before], [$pk_col => $pk_val]);
        if ($r === false) $errors[] = $wpdb->last_error ?: 'update failed'; else $restored++;
    }
    return rest_ensure_response(['restored' => $restored, 'errors' => $errors]);
}

/**
 * Serialized-safe recursive replacement. Critical: PHP serialize() stores byte
 * lengths in s:N:"..." headers; a naive str_replace shrinks/grows the body but
 * leaves the N wrong → corruption. We unserialize first, walk, re-serialize.
 */
function wpsc_sr_replace_value($value, $from, $to, $options) {
    if (is_string($value) && is_serialized($value)) {
        $unser = @unserialize($value, ['allowed_classes' => false]);
        if ($unser !== false || $value === 'b:0;') {
            return serialize(wpsc_sr_replace_value($unser, $from, $to, $options));
        }
    }
    if (is_array($value)) {
        $out = [];
        foreach ($value as $k => $v) {
            $newK = is_string($k) ? wpsc_sr_replace_string($k, $from, $to, $options) : $k;
            $out[$newK] = wpsc_sr_replace_value($v, $from, $to, $options);
        }
        return $out;
    }
    if (is_object($value)) return $value;
    if (is_string($value)) return wpsc_sr_replace_string($value, $from, $to, $options);
    return $value;
}

function wpsc_sr_replace_string($str, $from, $to, $options) {
    if ($str === '' || !is_string($str)) return $str;
    if (!empty($options['regex'])) {
        $flags = !empty($options['case_sensitive']) ? '' : 'i';
        $pattern = '/' . str_replace('/', '\/', $from) . '/' . $flags . 'u';
        $r = @preg_replace($pattern, $to, $str);
        return $r === null ? $str : $r;
    }
    if (!empty($options['case_sensitive'])) return str_replace($from, $to, $str);
    return str_ireplace($from, $to, $str);
}

function wpsc_sr_count_matches($value, $needle, $options) {
    if ($value === null || $needle === '') return 0;
    $haystack = is_string($value) ? $value : maybe_serialize($value);
    if (!empty($options['regex'])) {
        $flags = !empty($options['case_sensitive']) ? '' : 'i';
        $pattern = '/' . str_replace('/', '\/', $needle) . '/' . $flags . 'u';
        $n = @preg_match_all($pattern, $haystack, $m);
        return is_int($n) ? $n : 0;
    }
    if (!empty($options['case_sensitive'])) return substr_count($haystack, $needle);
    return substr_count(strtolower($haystack), strtolower($needle));
}

function wpsc_sr_truncate($value, $max = 400) {
    $s = is_string($value) ? $value : maybe_serialize($value);
    if (strlen($s) <= $max) return $s;
    return substr($s, 0, $max) . '…';
}
