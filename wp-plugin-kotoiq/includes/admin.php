<?php
/**
 * Admin — top-level menu + admin pages.
 *
 * Pages:
 *   - Dashboard         (status + module summary)
 *   - Search & Replace  (placeholder — main UI is the remote dashboard)
 *   - Snippets          (CRUD)
 *   - Access            (permission matrix)
 *   - Settings          (API key, remote control, modules)
 *
 * Pages are intentionally minimal — the KotoIQ dashboard at hellokoto.com
 * provides the full remote UI. Each page works standalone for site owners
 * who aren't on the dashboard.
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

add_action('admin_menu', function () {
    add_menu_page(
        'KotoIQ',
        'KotoIQ',
        'manage_options',
        'kotoiq',
        'kotoiq_admin_dashboard_page',
        'dashicons-chart-area',
        59
    );
    add_submenu_page('kotoiq', 'Dashboard',        'Dashboard',        'manage_options', 'kotoiq',                  'kotoiq_admin_dashboard_page');
    add_submenu_page('kotoiq', 'Search & Replace', 'Search & Replace', 'manage_options', 'kotoiq-search-replace',   'kotoiq_admin_sr_page');
    add_submenu_page('kotoiq', 'Snippets',         'Snippets',         'manage_options', 'kotoiq-snippets',         'kotoiq_admin_snippets_page');
    add_submenu_page('kotoiq', 'Access',           'Access',           'manage_options', 'kotoiq-access',           'kotoiq_admin_access_page');
    add_submenu_page('kotoiq', 'Settings',         'Settings',         'manage_options', 'kotoiq-settings',         'kotoiq_admin_settings_page');
});

add_action('admin_post_kotoiq_regen_key', function () {
    if (!current_user_can('manage_options')) wp_die('forbidden');
    check_admin_referer('kotoiq_regen_key');
    update_option(KOTOIQ_OPT_API_KEY, wp_generate_password(40, false, false));
    wp_redirect(add_query_arg('regenerated', 1, admin_url('admin.php?page=kotoiq-settings')));
    exit;
});

add_action('admin_post_kotoiq_save_settings', function () {
    if (!current_user_can('manage_options')) wp_die('forbidden');
    check_admin_referer('kotoiq_save_settings');
    update_option(KOTOIQ_OPT_REMOTE_ALLOWED, !empty($_POST['remote_allowed']));
    $host = isset($_POST['remote_host']) ? sanitize_text_field(wp_unslash((string) $_POST['remote_host'])) : '';
    update_option(KOTOIQ_OPT_REMOTE_HOST, $host);
    update_option(KOTOIQ_OPT_DISABLE_FILE_EDIT, !empty($_POST['disable_file_edit']));

    if (function_exists('koto_modules_list')) {
        $posted = isset($_POST['modules']) && is_array($_POST['modules']) ? $_POST['modules'] : [];
        $next   = [];
        foreach (koto_modules_list() as $m) {
            $next[$m['slug']] = !empty($posted[$m['slug']]) || !empty($m['always_on']);
        }
        update_option(KOTO_MODULES_OPTION, $next);
    }

    wp_redirect(add_query_arg('saved', 1, admin_url('admin.php?page=kotoiq-settings')));
    exit;
});

function kotoiq_admin_dashboard_page() {
    if (!current_user_can('manage_options')) wp_die('forbidden');
    $remote_allowed = (bool) get_option(KOTOIQ_OPT_REMOTE_ALLOWED, false);
    $snippets = kotoiq_snip_all();
    $active_count = count(array_filter($snippets, function ($s) { return !empty($s['active']); }));
    $policy = get_option(KOTOIQ_OPT_ACCESS_POLICY, []);
    $managed_roles = is_array($policy) ? count($policy) : 0;
    $modules = function_exists('koto_modules_list') ? koto_modules_list() : [];
    $enabled_modules = count(array_filter($modules, function ($m) { return !empty($m['enabled']); }));
    ?>
    <div class="wrap">
        <h1>KotoIQ</h1>
        <p>Agency control plugin. Site-wide search &amp; replace, role-aware code snippets, granular access management, Elementor read/write endpoints, and content rotation shortcodes.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:20px;">
            <?php kotoiq_admin_card('Search & Replace', 'Find &amp; replace text across your entire site, serialized-safe, with 1-click undo.', 'kotoiq-search-replace'); ?>
            <?php kotoiq_admin_card('Snippets', sprintf('%d total, %d active', count($snippets), $active_count), 'kotoiq-snippets'); ?>
            <?php kotoiq_admin_card('Access', sprintf('%d role(s) under managed policy', $managed_roles), 'kotoiq-access'); ?>
            <?php kotoiq_admin_card('Settings', sprintf('%d/%d modules enabled · Remote: %s', $enabled_modules, count($modules), $remote_allowed ? 'ON' : 'off'), 'kotoiq-settings'); ?>
        </div>
    </div>
    <?php
}

function kotoiq_admin_card($title, $desc, $slug) {
    $url = admin_url('admin.php?page=' . $slug);
    ?>
    <div style="background:#fff;border:1px solid #c3c4c7;border-radius:6px;padding:16px;">
        <h2 style="margin:0 0 8px;font-size:14px;"><?php echo esc_html($title); ?></h2>
        <p style="margin:0 0 12px;color:#50575e;font-size:13px;"><?php echo wp_kses_post($desc); ?></p>
        <a class="button button-secondary" href="<?php echo esc_url($url); ?>">Open</a>
    </div>
    <?php
}

function kotoiq_admin_sr_page() {
    if (!current_user_can('manage_options')) wp_die('forbidden');
    ?>
    <div class="wrap">
        <h1>Search &amp; Replace</h1>
        <p>The full search &amp; replace UI lives on the KotoIQ dashboard. Endpoints under <code>/wp-json/kotoiq/v1/search-replace/*</code> (also available under <code>/wp-json/wpsimplecode/v1/*</code> for back-compat).</p>
        <p><strong>Engine status:</strong> serialized-safe walker enabled. Undo journal stored remotely.</p>
        <p><a class="button" href="<?php echo esc_url(admin_url('admin.php?page=kotoiq-settings')); ?>">View API endpoint &amp; key →</a></p>
    </div>
    <?php
}

function kotoiq_admin_snippets_page() {
    if (!current_user_can('manage_options')) wp_die('forbidden');
    $snippets = kotoiq_snip_all();

    if (!empty($_POST['kotoiq_snip_action'])) {
        check_admin_referer('kotoiq_snip_save');
        $type = sanitize_key($_POST['type'] ?? 'html');
        if (!in_array($type, ['php','html','js','css'], true)) $type = 'html';
        $payload = [
            'id'       => sanitize_text_field($_POST['id'] ?? ''),
            'name'     => sanitize_text_field(wp_unslash($_POST['name'] ?? 'Untitled')),
            'type'     => $type,
            'code'     => (string) wp_unslash($_POST['code'] ?? ''),
            'location' => sanitize_key($_POST['location'] ?? 'everywhere'),
            'active'   => !empty($_POST['active']),
        ];
        $now = current_time('mysql', true);
        $found = false;
        foreach ($snippets as &$row) {
            if (($row['id'] ?? null) === $payload['id']) {
                $row = array_merge($row, $payload, ['updated_at' => $now]);
                $found = true; break;
            }
        }
        unset($row);
        if (!$found) {
            $payload['id'] = wp_generate_uuid4();
            $payload['created_at'] = $now;
            $payload['updated_at'] = $now;
            $snippets[] = $payload;
        }
        kotoiq_snip_save_all($snippets);
        echo '<div class="notice notice-success is-dismissible"><p>Snippet saved.</p></div>';
    }
    if (!empty($_GET['delete'])) {
        check_admin_referer('kotoiq_snip_delete');
        $id = sanitize_text_field($_GET['delete']);
        $snippets = array_values(array_filter($snippets, function ($s) use ($id) { return ($s['id'] ?? null) !== $id; }));
        kotoiq_snip_save_all($snippets);
        echo '<div class="notice notice-success is-dismissible"><p>Snippet deleted.</p></div>';
    }
    ?>
    <div class="wrap">
        <h1>Snippets</h1>
        <p>Create PHP, HTML, JS, or CSS snippets. PHP snippets execute server-side; html/js/css render in the page <code>&lt;head&gt;</code> or <code>&lt;footer&gt;</code>.</p>

        <h2 style="margin-top:24px;">All snippets</h2>
        <?php if (empty($snippets)): ?>
            <p><em>No snippets yet.</em></p>
        <?php else: ?>
            <table class="wp-list-table widefat striped">
                <thead><tr><th>Name</th><th>Type</th><th>Location</th><th>Status</th><th>Updated</th><th></th></tr></thead>
                <tbody>
                <?php foreach ($snippets as $s):
                    $del_url = wp_nonce_url(add_query_arg('delete', $s['id']), 'kotoiq_snip_delete');
                ?>
                    <tr>
                        <td><strong><?php echo esc_html($s['name']); ?></strong></td>
                        <td><code><?php echo esc_html($s['type']); ?></code></td>
                        <td><?php echo esc_html($s['location'] ?? ''); ?></td>
                        <td><?php echo !empty($s['active']) ? '<span style="color:#46b450;">● Active</span>' : '<span style="color:#a7aaad;">○ Inactive</span>'; ?></td>
                        <td><?php echo esc_html($s['updated_at'] ?? ''); ?></td>
                        <td><a class="button button-link-delete" href="<?php echo esc_url($del_url); ?>" onclick="return confirm('Delete snippet?')">Delete</a></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>

        <h2 style="margin-top:32px;">Add new snippet</h2>
        <form method="post">
            <?php wp_nonce_field('kotoiq_snip_save'); ?>
            <input type="hidden" name="kotoiq_snip_action" value="save"/>
            <input type="hidden" name="id" value=""/>
            <table class="form-table" role="presentation">
                <tr><th><label for="snip-name">Name</label></th><td><input id="snip-name" type="text" name="name" class="regular-text" required/></td></tr>
                <tr><th><label for="snip-type">Type</label></th><td>
                    <select id="snip-type" name="type">
                        <option value="html">HTML</option>
                        <option value="js">JavaScript</option>
                        <option value="css">CSS</option>
                        <option value="php">PHP (runs server-side)</option>
                    </select>
                </td></tr>
                <tr><th><label for="snip-location">Location</label></th><td>
                    <select id="snip-location" name="location">
                        <option value="everywhere">Everywhere (PHP)</option>
                        <option value="admin">Admin only (PHP)</option>
                        <option value="frontend">Frontend only (PHP)</option>
                        <option value="head">&lt;head&gt; (html/js/css)</option>
                        <option value="footer">Footer (html/js/css)</option>
                    </select>
                </td></tr>
                <tr><th><label for="snip-code">Code</label></th><td><textarea id="snip-code" name="code" rows="14" class="large-text code" style="font-family:Menlo,Monaco,monospace;"></textarea></td></tr>
                <tr><th><label for="snip-active">Active</label></th><td><label><input id="snip-active" type="checkbox" name="active" value="1"/> Run this snippet</label></td></tr>
            </table>
            <p><button type="submit" class="button button-primary">Save snippet</button></p>
        </form>
    </div>
    <?php
}

function kotoiq_admin_access_page() {
    if (!current_user_can('manage_options')) wp_die('forbidden');
    if (!empty($_POST['kotoiq_apply_policy'])) {
        check_admin_referer('kotoiq_apply_policy');
        $raw = $_POST['policy'] ?? [];
        $policy = [];
        if (is_array($raw)) {
            foreach ($raw as $role => $features) {
                if (!is_array($features)) continue;
                $policy[sanitize_key($role)] = kotoiq_am_sanitize_features(array_map('sanitize_text_field', $features));
            }
        }
        update_option(KOTOIQ_OPT_ACCESS_POLICY, $policy);
        foreach ($policy as $role_slug => $features) {
            $role = get_role($role_slug);
            if (!$role) continue;
            foreach (kotoiq_am_features_to_caps($features) as $cap => $grant) {
                if ($grant) $role->add_cap($cap); else $role->remove_cap($cap);
            }
        }
        echo '<div class="notice notice-success is-dismissible"><p>Policy applied.</p></div>';
    }

    $policy = get_option(KOTOIQ_OPT_ACCESS_POLICY, []);
    if (!is_array($policy)) $policy = [];
    $roles = wp_roles()->roles;

    $features = [
        'php_snippets'       => ['label' => 'PHP Snippets',       'levels' => ['full' => 'Full PHP', 'text' => 'Text-only', 'none' => 'None']],
        'snippet_management' => ['label' => 'Snippet Management', 'levels' => ['granted' => 'Granted', 'denied' => 'Denied']],
        'file_editor'        => ['label' => 'File Editor',        'levels' => ['granted' => 'Granted', 'denied' => 'Denied']],
        'theme_editor'       => ['label' => 'Theme Editor',       'levels' => ['granted' => 'Granted', 'denied' => 'Denied']],
        'plugin_editor'      => ['label' => 'Plugin Editor',      'levels' => ['granted' => 'Granted', 'denied' => 'Denied']],
        'pixels'             => ['label' => 'Conversion Pixels',  'levels' => ['granted' => 'Granted', 'denied' => 'Denied']],
        'access_management'  => ['label' => 'Access Management',  'levels' => ['granted' => 'Granted', 'denied' => 'Denied']],
    ];
    ?>
    <div class="wrap">
        <h1>Access</h1>
        <p>Per-role permission matrix. Denials apply even to roles WordPress would otherwise grant by default.</p>
        <form method="post">
            <?php wp_nonce_field('kotoiq_apply_policy'); ?>
            <input type="hidden" name="kotoiq_apply_policy" value="1"/>
            <table class="wp-list-table widefat striped" style="margin-top:16px;">
                <thead>
                    <tr><th style="width:160px;">Role</th>
                    <?php foreach ($features as $fkey => $f): ?>
                        <th><?php echo esc_html($f['label']); ?></th>
                    <?php endforeach; ?>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($roles as $slug => $r): ?>
                    <tr>
                        <td><strong><?php echo esc_html($r['name'] ?? $slug); ?></strong><br><code><?php echo esc_html($slug); ?></code></td>
                        <?php foreach ($features as $fkey => $f):
                            $current = $policy[$slug][$fkey] ?? '';
                        ?>
                            <td>
                                <select name="policy[<?php echo esc_attr($slug); ?>][<?php echo esc_attr($fkey); ?>]">
                                    <option value="">(unset)</option>
                                    <?php foreach ($f['levels'] as $lv => $lvLabel): ?>
                                        <option value="<?php echo esc_attr($lv); ?>" <?php selected($current, $lv); ?>><?php echo esc_html($lvLabel); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </td>
                        <?php endforeach; ?>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            <p style="margin-top:16px;"><button class="button button-primary" type="submit">Apply policy</button></p>
        </form>
    </div>
    <?php
}

function kotoiq_admin_settings_page() {
    if (!current_user_can('manage_options')) wp_die('forbidden');
    $api_key = (string) get_option(KOTOIQ_OPT_API_KEY, '');
    $remote_allowed = (bool) get_option(KOTOIQ_OPT_REMOTE_ALLOWED, false);
    $remote_host = (string) get_option(KOTOIQ_OPT_REMOTE_HOST, '');
    $disable_file_edit = (bool) get_option(KOTOIQ_OPT_DISABLE_FILE_EDIT, false);
    ?>
    <div class="wrap">
        <h1>KotoIQ Settings</h1>

        <?php if (!empty($_GET['saved'])): ?><div class="notice notice-success is-dismissible"><p>Settings saved.</p></div><?php endif; ?>
        <?php if (!empty($_GET['regenerated'])): ?><div class="notice notice-success is-dismissible"><p>API key regenerated.</p></div><?php endif; ?>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="kotoiq_save_settings"/>
            <?php wp_nonce_field('kotoiq_save_settings'); ?>
            <h2>Remote Control</h2>
            <table class="form-table" role="presentation">
                <tr><th>Enable remote control</th><td>
                    <label><input type="checkbox" name="remote_allowed" value="1" <?php checked($remote_allowed); ?>/> Allow the KotoIQ dashboard to drive this site via the REST API.</label>
                </td></tr>
                <tr><th><label for="remote-host">Allowed host (optional)</label></th><td>
                    <input id="remote-host" type="text" name="remote_host" class="regular-text" value="<?php echo esc_attr($remote_host); ?>" placeholder="https://hellokoto.com"/>
                    <p class="description">If set, only requests whose Origin/Referer/X-KotoIQ-Source header contains this string are accepted.</p>
                </td></tr>
                <tr><th>API key</th><td>
                    <code style="background:#f6f7f7;padding:6px 10px;border-radius:4px;display:inline-block;"><?php echo esc_html($api_key); ?></code>
                </td></tr>
            </table>

            <h2>Modules</h2>
            <p class="description" style="margin-bottom:10px;">Enable or disable individual feature modules. Disabled modules don't load their REST endpoints, admin pages, or runtime hooks — but settings and stored data are preserved across re-enables.</p>
            <table class="wp-list-table widefat striped" style="margin-bottom:24px;">
                <thead><tr><th style="width:80px;">Enabled</th><th>Module</th><th>Version</th><th>Description</th></tr></thead>
                <tbody>
                <?php if (function_exists('koto_modules_list')): foreach (koto_modules_list() as $m): ?>
                    <tr>
                        <td>
                            <label>
                                <input type="checkbox" name="modules[<?php echo esc_attr($m['slug']); ?>]" value="1" <?php checked($m['enabled']); ?> <?php disabled($m['always_on']); ?>/>
                                <?php if ($m['always_on']) echo '<span style="color:#9ca3af;font-size:11px;">always on</span>'; ?>
                            </label>
                        </td>
                        <td><strong><?php echo esc_html($m['name']); ?></strong><br><code style="font-size:11px;color:#6b7280;"><?php echo esc_html($m['slug']); ?></code></td>
                        <td><code><?php echo esc_html($m['version']); ?></code></td>
                        <td><?php echo esc_html($m['description']); ?></td>
                    </tr>
                <?php endforeach; endif; ?>
                </tbody>
            </table>

            <h2>Global Lockdowns</h2>
            <table class="form-table" role="presentation">
                <tr><th>Disable file editor globally</th><td>
                    <label><input type="checkbox" name="disable_file_edit" value="1" <?php checked($disable_file_edit); ?>/> Hide and deny <code>edit_themes</code>, <code>edit_plugins</code>, and <code>edit_files</code> for every user (mirrors <code>DISALLOW_FILE_EDIT</code> without touching <code>wp-config.php</code>).</label>
                </td></tr>
            </table>

            <p><button class="button button-primary" type="submit">Save</button></p>
        </form>

        <hr style="margin:32px 0;"/>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" onsubmit="return confirm('Regenerate API key? Existing remote integrations will need to be updated.')">
            <input type="hidden" name="action" value="kotoiq_regen_key"/>
            <?php wp_nonce_field('kotoiq_regen_key'); ?>
            <p><button class="button" type="submit">Regenerate API key</button></p>
        </form>

        <h2>REST endpoints</h2>
        <p>All endpoints live under <code><?php echo esc_url(rest_url(KOTOIQ_REST_NS)); ?>/</code> (and <code><?php echo esc_url(rest_url(KOTOIQ_REST_NS_LEGACY)); ?>/</code> for back-compat).</p>
        <ul style="list-style:disc;padding-left:20px;">
            <li><code>GET /meta</code> — plugin metadata (no auth)</li>
            <li><code>POST /search-replace/{tables,scan,restore}</code></li>
            <li><code>POST /access/{roles,apply,snapshot,revert}</code></li>
            <li><code>POST /snippets/{list,save,delete,toggle}</code></li>
            <li><code>POST /modules/{list,toggle}</code></li>
            <li><code>POST /builder/detect</code> · <code>GET /builder/pages</code> · <code>GET|PUT /builder/elementor/{id}</code> · <code>POST /builder/clone</code></li>
            <li><code>GET|DELETE /builder/rotation-cache/{post_id}</code></li>
            <li><code>POST /self-update</code> · <code>POST /self-update/info</code></li>
        </ul>
    </div>
    <?php
}
