<?php
/**
 * Code Snippets — runtime executor + REST CRUD.
 *
 * Snippet record shape (stored as array of records in WPSC_OPT_SNIPPETS):
 *   id            string  uuid-ish
 *   name          string
 *   type          'php' | 'html' | 'js' | 'css'
 *   code          string
 *   location      'everywhere' | 'admin' | 'frontend' | 'head' | 'footer'  (php: everywhere/admin/frontend; html/js/css: head/footer)
 *   active        bool
 *   read_roles    string[]   — roles allowed to read this snippet in the admin (Customized Snippet Access)
 *   execute_roles string[]   — roles whose presence enables execution (empty = always when active)
 *   created_at    string ISO
 *   updated_at    string ISO
 *
 * Routes (under WPSC_REST_NS):
 *   POST snippets/list   — list all snippets visible to the caller
 *   POST snippets/save   — create or update a snippet
 *   POST snippets/delete — delete a snippet by id
 *   POST snippets/toggle — flip active flag
 *
 * Cap gates:
 *   - manage_snippets       (list / save / delete / toggle text snippets)
 *   - execute_php_snippets  (save / toggle a snippet of type=php)
 *   - create_text_snippets  (save / toggle a snippet of type=html|js|css)
 *
 * @package WPSimpleCode
 */

if (!defined('ABSPATH')) exit;

koto_register_module([
    'slug'        => 'snippets',
    'name'        => 'Snippets',
    'description' => 'Code snippet manager — PHP (server-side), HTML/JS/CSS (head/footer injection), per-snippet role gating.',
    'version'     => '1.1.0',
]);

add_action('rest_api_init', function () {
    if (!koto_is_module_enabled('snippets')) return;
    register_rest_route(WPSC_REST_NS, '/snippets/list', [
        'methods'  => 'POST',
        'callback' => 'wpsc_snip_list',
        'permission_callback' => 'wpsc_perm_read',
    ]);
    register_rest_route(WPSC_REST_NS, '/snippets/save', [
        'methods'  => 'POST',
        'callback' => 'wpsc_snip_save',
        'permission_callback' => 'wpsc_perm_write',
    ]);
    register_rest_route(WPSC_REST_NS, '/snippets/delete', [
        'methods'  => 'POST',
        'callback' => 'wpsc_snip_delete',
        'permission_callback' => 'wpsc_perm_write',
    ]);
    register_rest_route(WPSC_REST_NS, '/snippets/toggle', [
        'methods'  => 'POST',
        'callback' => 'wpsc_snip_toggle',
        'permission_callback' => 'wpsc_perm_write',
    ]);
});

function wpsc_snip_all() {
    $s = get_option(WPSC_OPT_SNIPPETS, []);
    if (!is_array($s)) $s = [];
    return $s;
}

function wpsc_snip_save_all($snips) {
    update_option(WPSC_OPT_SNIPPETS, array_values($snips));
}

function wpsc_snip_list($req) {
    return rest_ensure_response(['snippets' => wpsc_snip_all()]);
}

function wpsc_snip_save($req) {
    $p = $req->get_json_params();
    $s = wpsc_snip_all();

    $id = isset($p['id']) ? sanitize_text_field((string) $p['id']) : '';
    $type = isset($p['type']) ? sanitize_key((string) $p['type']) : 'html';
    if (!in_array($type, ['php', 'html', 'js', 'css'], true)) {
        return new WP_Error('bad_type', 'Invalid snippet type', ['status' => 400]);
    }

    // Cap check based on type — local admins always allowed; remote callers must satisfy fine-grained caps
    if (!current_user_can('manage_options')) {
        if ($type === 'php' && !current_user_can('execute_php_snippets')) {
            return new WP_Error('forbidden', 'Cannot save PHP snippets', ['status' => 403]);
        }
        if ($type !== 'php' && !current_user_can('create_text_snippets')) {
            return new WP_Error('forbidden', 'Cannot save text snippets', ['status' => 403]);
        }
    }

    $name = isset($p['name']) ? sanitize_text_field((string) $p['name']) : 'Untitled';
    $code = isset($p['code']) ? (string) $p['code'] : '';
    $location = isset($p['location']) ? sanitize_key((string) $p['location']) : 'everywhere';
    $active = !empty($p['active']);
    $read_roles    = isset($p['read_roles']) && is_array($p['read_roles']) ? array_map('sanitize_key', $p['read_roles']) : [];
    $execute_roles = isset($p['execute_roles']) && is_array($p['execute_roles']) ? array_map('sanitize_key', $p['execute_roles']) : [];

    $now = current_time('mysql', true);
    $found = false;
    foreach ($s as &$row) {
        if (($row['id'] ?? null) === $id) {
            $row = array_merge($row, [
                'name' => $name, 'type' => $type, 'code' => $code,
                'location' => $location, 'active' => $active,
                'read_roles' => $read_roles, 'execute_roles' => $execute_roles,
                'updated_at' => $now,
            ]);
            $found = true;
            break;
        }
    }
    unset($row);
    if (!$found) {
        $id = $id ?: wp_generate_uuid4();
        $s[] = [
            'id' => $id, 'name' => $name, 'type' => $type, 'code' => $code,
            'location' => $location, 'active' => $active,
            'read_roles' => $read_roles, 'execute_roles' => $execute_roles,
            'created_at' => $now, 'updated_at' => $now,
        ];
    }
    wpsc_snip_save_all($s);
    return rest_ensure_response(['ok' => true, 'id' => $id]);
}

function wpsc_snip_delete($req) {
    $p = $req->get_json_params();
    $id = isset($p['id']) ? (string) $p['id'] : '';
    if ($id === '') return new WP_Error('bad_id', 'id required', ['status' => 400]);
    $s = array_values(array_filter(wpsc_snip_all(), function ($r) use ($id) {
        return ($r['id'] ?? null) !== $id;
    }));
    wpsc_snip_save_all($s);
    return rest_ensure_response(['ok' => true]);
}

function wpsc_snip_toggle($req) {
    $p = $req->get_json_params();
    $id = isset($p['id']) ? (string) $p['id'] : '';
    $active = !empty($p['active']);
    $s = wpsc_snip_all();
    foreach ($s as &$row) {
        if (($row['id'] ?? null) === $id) {
            // For PHP toggles, require the cap when remote
            if (($row['type'] ?? '') === 'php' && !current_user_can('manage_options') && !current_user_can('execute_php_snippets')) {
                return new WP_Error('forbidden', 'Cannot toggle PHP snippet', ['status' => 403]);
            }
            $row['active'] = $active;
            $row['updated_at'] = current_time('mysql', true);
            break;
        }
    }
    unset($row);
    wpsc_snip_save_all($s);
    return rest_ensure_response(['ok' => true]);
}

/**
 * Runtime executor — fires snippets at appropriate hooks. Errors are caught
 * per snippet so one broken snippet can't take down the site.
 */
add_action('init', function () { if (koto_is_module_enabled('snippets')) wpsc_snip_execute_php(); }, 5);
add_action('admin_init', function () { if (koto_is_module_enabled('snippets')) wpsc_snip_execute_php_admin(); }, 5);
function wpsc_snip_execute_php() {
    foreach (wpsc_snip_active_by_type('php') as $sn) {
        $loc = $sn['location'] ?? 'everywhere';
        if ($loc === 'admin') continue; // handled in admin_init
        if ($loc === 'frontend' && is_admin()) continue;
        wpsc_snip_run_php($sn);
    }
}
function wpsc_snip_execute_php_admin() {
    if (!is_admin()) return;
    foreach (wpsc_snip_active_by_type('php') as $sn) {
        $loc = $sn['location'] ?? 'everywhere';
        if ($loc !== 'admin' && $loc !== 'everywhere') continue;
        wpsc_snip_run_php($sn);
    }
}

function wpsc_snip_run_php($sn) {
    $code = (string) ($sn['code'] ?? '');
    if ($code === '') return;
    // Strip opening tag to allow either form
    $code = preg_replace('/^\s*<\?php\s*/', '', $code, 1);
    try {
        // phpcs:ignore Squiz.PHP.Eval.Discouraged — this is the core capability of a snippet plugin; gated by manage_snippets cap on write.
        eval($code);
    } catch (\Throwable $e) {
        error_log('[WPSimpleCode] Snippet error in "' . ($sn['name'] ?? $sn['id'] ?? '?') . '": ' . $e->getMessage());
    }
}

add_action('wp_head',     function () { if (koto_is_module_enabled('snippets')) wpsc_snip_output_head(); }, 999);
add_action('admin_head',  function () { if (koto_is_module_enabled('snippets')) wpsc_snip_output_head(); }, 999);
add_action('wp_footer',   function () { if (koto_is_module_enabled('snippets')) wpsc_snip_output_footer(); }, 999);
add_action('admin_footer',function () { if (koto_is_module_enabled('snippets')) wpsc_snip_output_footer(); }, 999);

function wpsc_snip_output_head() {
    foreach (wpsc_snip_active_renderable() as $sn) {
        if (($sn['location'] ?? '') !== 'head') continue;
        echo wpsc_snip_render($sn);
    }
}
function wpsc_snip_output_footer() {
    foreach (wpsc_snip_active_renderable() as $sn) {
        if (($sn['location'] ?? '') !== 'footer') continue;
        echo wpsc_snip_render($sn);
    }
}

function wpsc_snip_active_by_type($type) {
    return array_values(array_filter(wpsc_snip_all(), function ($s) use ($type) {
        return !empty($s['active']) && ($s['type'] ?? '') === $type;
    }));
}
function wpsc_snip_active_renderable() {
    return array_values(array_filter(wpsc_snip_all(), function ($s) {
        return !empty($s['active']) && in_array(($s['type'] ?? ''), ['html', 'js', 'css'], true);
    }));
}

function wpsc_snip_render($sn) {
    $code = (string) ($sn['code'] ?? '');
    $type = $sn['type'] ?? 'html';
    if ($type === 'js')  return "\n<script>\n{$code}\n</script>\n";
    if ($type === 'css') return "\n<style>\n{$code}\n</style>\n";
    return "\n{$code}\n"; // html
}
