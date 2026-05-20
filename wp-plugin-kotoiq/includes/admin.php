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
    $remote_host    = (string) get_option(KOTOIQ_OPT_REMOTE_HOST, '');
    $snippets       = kotoiq_snip_all();
    $active_count   = count(array_filter($snippets, function ($s) { return !empty($s['active']); }));
    $policy         = get_option(KOTOIQ_OPT_ACCESS_POLICY, []);
    $managed_roles  = is_array($policy) ? count($policy) : 0;
    $modules        = function_exists('koto_modules_list') ? koto_modules_list() : [];
    $modules_by_slug = [];
    foreach ($modules as $m) $modules_by_slug[$m['slug']] = $m;
    $enabled_modules = count(array_filter($modules, function ($m) { return !empty($m['enabled']); }));

    $koto_logo    = KOTOIQ_PLUGIN_URL . 'assets/koto-logo.svg';
    $unified_logo = KOTOIQ_PLUGIN_URL . 'assets/unified-logo.svg';

    // Each module: detailed description of what it actually does, plus a
    // live stat pulled from the database where available.
    $module_specs = [
        'search-replace' => [
            'icon'  => 'search',
            'title' => 'Search & Replace',
            'what'  => 'Find any text or URL across every database table and rewrite it in place. Handles serialized PHP correctly (the bug that corrupts widgets and theme settings when other plugins try). Preview mode shows you the diff before anything writes; live mode keeps a row-level undo journal so a one-click restore is always available.',
            'stat'  => 'Endpoints: /wp-json/kotoiq/v1/search-replace/{tables,scan,restore}',
            'page'  => 'kotoiq-search-replace',
        ],
        'snippets' => [
            'icon'  => 'editor-code',
            'title' => 'Code Snippets',
            'what'  => 'Drop in PHP (server-side), HTML, JavaScript, or CSS without editing theme files. Choose where each runs — head, footer, admin only, frontend only, or everywhere. Per-snippet role gating means client editors can save text/JS but never execute PHP.',
            'stat'  => sprintf('%d total · %d active', count($snippets), $active_count),
            'page'  => 'kotoiq-snippets',
        ],
        'access' => [
            'icon'  => 'lock',
            'title' => 'Access Management',
            'what'  => 'Per-role permission matrix for PHP snippets, file/theme/plugin editors, conversion pixels, and access management itself. Denials apply at runtime — even an administrator can be denied edit_themes if you set it. Global kill-switch mirrors DISALLOW_FILE_EDIT without touching wp-config.php. Snapshot + revert any time.',
            'stat'  => sprintf('%d role%s under managed policy', $managed_roles, $managed_roles === 1 ? '' : 's'),
            'page'  => 'kotoiq-access',
        ],
        'elementor-builder' => [
            'icon'  => 'edit',
            'title' => 'Elementor Builder',
            'what'  => 'Read and write Elementor pages from the KotoIQ dashboard. Detects Elementor + Pro version, lists every builder-edited page, fetches the raw _elementor_data tree, and writes back through Elementor\'s own Document::save() (the only safe write path — handles CSS regen, revisions, and v4 atomic validation). Clone any page as a new draft for variant testing.',
            'stat'  => defined('ELEMENTOR_VERSION')
                ? ('Elementor ' . ELEMENTOR_VERSION . (defined('ELEMENTOR_PRO_VERSION') ? ' + Pro ' . ELEMENTOR_PRO_VERSION : ' (no Pro)'))
                : 'Inactive — install Elementor to enable',
            'page'  => null,
        ],
        'content-rotation' => [
            'icon'  => 'image-rotate',
            'title' => 'Content Rotation',
            'what'  => 'The [koto_rotate cache="7d"] shortcode picks one of N content variants per page-load and caches the selection per-post for a configurable TTL. Google sees the page "updating" each cache rollover. Pairs with the Page Factory clone flow — content variants land as rotating shortcodes inside the cloned Elementor page.',
            'stat'  => 'Shortcode: [koto_rotate cache="7d" section="intro"]',
            'page'  => null,
        ],
        'seo' => [
            'icon'  => 'chart-line',
            'title' => 'SEO & Page Factory',
            'what'  => 'Yoast and Rank Math integration. Lists every published page with its SEO meta, generates city/state landing pages in batches with optional JSON-LD schema, publishes AI-written blog posts with focus keywords + meta descriptions, rebuilds the sitemap and pings Google + Bing on demand, and auto-pings the Koto platform whenever you publish a new post.',
            'stat'  => (defined('WPSEO_VERSION') ? 'Yoast ' . WPSEO_VERSION : (defined('RANK_MATH_VERSION') ? 'Rank Math ' . RANK_MATH_VERSION : 'Yoast / Rank Math not detected'))
                . ' · last sync: ' . (get_option('koto_last_sync') ?: 'never'),
            'page'  => null,
        ],
    ];

    // Brand tokens (Unified Marketing: navy + pink on cream).
    $C_NAVY = '#201b51';
    $C_NAVY_DEEP = '#15113a';
    $C_PINK = '#cb1c6b';
    $C_CREAM = '#faf9f6';
    $C_LINE = '#e9e6dd';
    $C_MUTED = '#6b7280';
    ?>
    <style>
        .kotoiq-wrap { background: <?php echo $C_CREAM; ?>; margin: 20px -20px -10px -22px; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "DM Sans", "Segoe UI", Roboto, sans-serif; min-height: calc(100vh - 60px); }
        @media (max-width: 782px) { .kotoiq-wrap { margin: 10px -10px -10px -10px; } }
        .kotoiq-hero { padding: 40px 48px 36px; border-bottom: 1px solid <?php echo $C_LINE; ?>; background: linear-gradient(180deg, #fff 0%, <?php echo $C_CREAM; ?> 100%); }
        .kotoiq-hero-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
        .kotoiq-koto-logo { height: 38px; width: auto; }
        .kotoiq-unified-link { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: <?php echo $C_MUTED; ?>; font-size: 12px; }
        .kotoiq-unified-link:hover { color: <?php echo $C_PINK; ?>; }
        .kotoiq-unified-logo { height: 46px; width: auto; }
        .kotoiq-eyebrow { display: inline-block; padding: 4px 10px; background: <?php echo $C_PINK; ?>15; color: <?php echo $C_PINK; ?>; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 4px; margin-bottom: 12px; }
        .kotoiq-h1 { font-size: 36px; font-weight: 800; color: <?php echo $C_NAVY; ?>; margin: 0 0 8px; letter-spacing: -0.02em; line-height: 1.1; }
        .kotoiq-tagline { font-size: 16px; color: <?php echo $C_NAVY_DEEP; ?>; opacity: 0.7; margin: 0; max-width: 720px; line-height: 1.5; }
        .kotoiq-managed { display: flex; align-items: center; gap: 16px; margin-top: 24px; padding-top: 20px; border-top: 1px dashed <?php echo $C_LINE; ?>; }
        .kotoiq-managed-text { font-size: 13px; color: <?php echo $C_MUTED; ?>; }
        .kotoiq-managed-text strong { color: <?php echo $C_NAVY; ?>; font-weight: 700; }
        .kotoiq-managed-text a { color: <?php echo $C_PINK; ?>; text-decoration: none; font-weight: 600; }
        .kotoiq-managed-text a:hover { text-decoration: underline; }

        .kotoiq-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0; background: #fff; border-bottom: 1px solid <?php echo $C_LINE; ?>; }
        .kotoiq-stat { padding: 20px 24px; border-right: 1px solid <?php echo $C_LINE; ?>; }
        .kotoiq-stat:last-child { border-right: none; }
        .kotoiq-stat-num { font-size: 24px; font-weight: 800; color: <?php echo $C_NAVY; ?>; line-height: 1; }
        .kotoiq-stat-num.pink { color: <?php echo $C_PINK; ?>; }
        .kotoiq-stat-label { font-size: 11px; color: <?php echo $C_MUTED; ?>; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin-top: 6px; }
        .kotoiq-stat-sub { font-size: 12px; color: <?php echo $C_MUTED; ?>; margin-top: 4px; }

        .kotoiq-section { padding: 36px 48px; }
        .kotoiq-section-h { font-size: 11px; color: <?php echo $C_NAVY; ?>; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 800; margin: 0 0 18px; }
        .kotoiq-modules { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
        .kotoiq-mod { background: #fff; border: 1px solid <?php echo $C_LINE; ?>; border-radius: 10px; padding: 22px 24px; position: relative; transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease; }
        .kotoiq-mod:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(32, 27, 81, 0.06); border-color: <?php echo $C_NAVY; ?>30; }
        .kotoiq-mod-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .kotoiq-mod-icon { width: 32px; height: 32px; border-radius: 8px; background: <?php echo $C_NAVY; ?>; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .kotoiq-mod-icon .dashicons { color: #fff; font-size: 18px; width: 18px; height: 18px; }
        .kotoiq-mod-title { font-size: 16px; font-weight: 700; color: <?php echo $C_NAVY; ?>; margin: 0; line-height: 1.2; }
        .kotoiq-mod-status { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; margin-left: auto; }
        .kotoiq-mod-status.on { background: <?php echo $C_PINK; ?>15; color: <?php echo $C_PINK; ?>; }
        .kotoiq-mod-status.off { background: #f3f4f6; color: #9ca3af; }
        .kotoiq-mod-what { font-size: 13px; color: <?php echo $C_NAVY_DEEP; ?>; opacity: 0.78; line-height: 1.55; margin: 0 0 12px; }
        .kotoiq-mod-stat { font-size: 11px; color: <?php echo $C_MUTED; ?>; font-family: ui-monospace, "SF Mono", Menlo, monospace; background: <?php echo $C_CREAM; ?>; padding: 6px 10px; border-radius: 5px; border: 1px solid <?php echo $C_LINE; ?>; display: inline-block; max-width: 100%; overflow-wrap: anywhere; }
        .kotoiq-mod-action { margin-top: 14px; }
        .kotoiq-mod-action a { font-size: 12px; color: <?php echo $C_PINK; ?>; text-decoration: none; font-weight: 700; }
        .kotoiq-mod-action a:hover { text-decoration: underline; }

        .kotoiq-cta { background: <?php echo $C_NAVY; ?>; color: #fff; border-radius: 12px; padding: 28px 32px; display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 8px; }
        .kotoiq-cta-text h3 { font-size: 18px; font-weight: 700; margin: 0 0 4px; color: #fff; }
        .kotoiq-cta-text p { font-size: 13px; opacity: 0.75; margin: 0; max-width: 540px; }
        .kotoiq-cta-btn { background: <?php echo $C_PINK; ?>; color: #fff; padding: 11px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; white-space: nowrap; transition: background .12s ease; }
        .kotoiq-cta-btn:hover { background: #a8155a; color: #fff; }

        .kotoiq-foot { padding: 24px 48px 36px; border-top: 1px solid <?php echo $C_LINE; ?>; color: <?php echo $C_MUTED; ?>; font-size: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        .kotoiq-foot a { color: <?php echo $C_NAVY; ?>; text-decoration: none; }
        .kotoiq-foot a:hover { color: <?php echo $C_PINK; ?>; }
    </style>

    <div class="kotoiq-wrap">

        <!-- Hero -->
        <div class="kotoiq-hero">
            <div class="kotoiq-hero-row">
                <img src="<?php echo esc_url($koto_logo); ?>" alt="Koto" class="kotoiq-koto-logo"/>
                <a href="https://unifiedmktg.com" target="_blank" rel="noopener" class="kotoiq-unified-link" title="Managed by Unified Marketing">
                    <span>powered by</span>
                    <img src="<?php echo esc_url($unified_logo); ?>" alt="Unified Marketing" class="kotoiq-unified-logo"/>
                </a>
            </div>
            <span class="kotoiq-eyebrow">v<?php echo esc_html(KOTOIQ_VERSION); ?> · Agency-managed</span>
            <h1 class="kotoiq-h1">KotoIQ</h1>
            <p class="kotoiq-tagline">One plugin that gives your agency surgical control over this WordPress site — site-wide search &amp; replace with undo, role-aware code snippets, granular permission lockdown, Elementor read/write endpoints, and content rotation shortcodes. Drive every feature from the KotoIQ dashboard, or use the local admin pages on the left.</p>
            <div class="kotoiq-managed">
                <div class="kotoiq-managed-text">
                    Managed by <strong>Unified Marketing</strong> · <a href="https://unifiedmktg.com" target="_blank" rel="noopener">unifiedmktg.com</a> · Questions? Contact your account team.
                </div>
            </div>
        </div>

        <!-- Stats strip -->
        <div class="kotoiq-stats">
            <div class="kotoiq-stat">
                <div class="kotoiq-stat-num"><?php echo (int) $enabled_modules; ?><span style="font-size:14px;opacity:.4;">/<?php echo (int) count($modules); ?></span></div>
                <div class="kotoiq-stat-label">Modules enabled</div>
            </div>
            <div class="kotoiq-stat">
                <div class="kotoiq-stat-num pink"><?php echo (int) count($snippets); ?></div>
                <div class="kotoiq-stat-label">Snippets</div>
                <div class="kotoiq-stat-sub"><?php echo (int) $active_count; ?> active</div>
            </div>
            <div class="kotoiq-stat">
                <div class="kotoiq-stat-num"><?php echo (int) $managed_roles; ?></div>
                <div class="kotoiq-stat-label">Roles managed</div>
            </div>
            <div class="kotoiq-stat">
                <div class="kotoiq-stat-num <?php echo $remote_allowed ? 'pink' : ''; ?>"><?php echo $remote_allowed ? 'On' : 'Off'; ?></div>
                <div class="kotoiq-stat-label">Remote control</div>
                <?php if ($remote_allowed && $remote_host): ?>
                    <div class="kotoiq-stat-sub"><?php echo esc_html(parse_url($remote_host, PHP_URL_HOST) ?: $remote_host); ?></div>
                <?php endif; ?>
            </div>
        </div>

        <!-- What's inside -->
        <div class="kotoiq-section">
            <h2 class="kotoiq-section-h">What's inside</h2>
            <div class="kotoiq-modules">
                <?php foreach ($module_specs as $slug => $spec):
                    $m = $modules_by_slug[$slug] ?? null;
                    $enabled = $m && !empty($m['enabled']);
                ?>
                    <div class="kotoiq-mod">
                        <div class="kotoiq-mod-head">
                            <span class="kotoiq-mod-icon"><span class="dashicons dashicons-<?php echo esc_attr($spec['icon']); ?>"></span></span>
                            <h3 class="kotoiq-mod-title"><?php echo esc_html($spec['title']); ?></h3>
                            <span class="kotoiq-mod-status <?php echo $enabled ? 'on' : 'off'; ?>"><?php echo $enabled ? 'enabled' : 'off'; ?></span>
                        </div>
                        <p class="kotoiq-mod-what"><?php echo esc_html($spec['what']); ?></p>
                        <div class="kotoiq-mod-stat"><?php echo esc_html($spec['stat']); ?></div>
                        <?php if (!empty($spec['page'])): ?>
                            <div class="kotoiq-mod-action">
                                <a href="<?php echo esc_url(admin_url('admin.php?page=' . $spec['page'])); ?>">Open <?php echo esc_html($spec['title']); ?> →</a>
                            </div>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- CTA -->
        <div class="kotoiq-section" style="padding-top:0;">
            <div class="kotoiq-cta">
                <div class="kotoiq-cta-text">
                    <h3><?php echo $remote_allowed ? 'Connected to the KotoIQ dashboard' : 'Connect this site to the KotoIQ dashboard'; ?></h3>
                    <p><?php echo $remote_allowed
                        ? 'Your agency can drive every module from hellokoto.com. Toggle the connection off any time from Settings.'
                        : 'Enable remote control in Settings, paste your agency dashboard URL as the Allowed host, and copy the API key into the KotoIQ Control Center to pair this site.'; ?></p>
                </div>
                <a class="kotoiq-cta-btn" href="<?php echo esc_url(admin_url('admin.php?page=kotoiq-settings')); ?>">
                    <?php echo $remote_allowed ? 'Manage connection' : 'Open Settings →'; ?>
                </a>
            </div>
        </div>

        <!-- Footer -->
        <div class="kotoiq-foot">
            <div>KotoIQ v<?php echo esc_html(KOTOIQ_VERSION); ?> · Built for agencies · <a href="https://hellokoto.com" target="_blank" rel="noopener">hellokoto.com</a></div>
            <div>© <?php echo date('Y'); ?> Unified Marketing · <a href="https://unifiedmktg.com" target="_blank" rel="noopener">unifiedmktg.com</a></div>
        </div>
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
