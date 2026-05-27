<?php
/**
 * Admin page — WP admin → KotoIQ.
 *
 * OPERATIONS-ONLY PAGE. No business logic. Site owners manage all settings
 * (SEO, content, snippets, redirects, capabilities, templates, sitemap)
 * from the KotoIQ dashboard — this page only exposes the two operations
 * that physically must happen on the WP host:
 *
 *   1. Open / close the pairing window.
 *   2. View pair status: paired? fingerprint? dashboard URL? plugin version?
 *
 * Visual identity: Unified Marketing palette (navy + pink on cream),
 * matching www.unifiedmktg.com and the Koto dashboard. Self-contained
 * inline CSS — no enqueued stylesheet so the plugin's surface area stays
 * minimal and there's nothing third parties can inspect for branding cues.
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

const KOTOIQ_SHIM_ADMIN_SLUG   = 'kotoiq-shim';
const KOTOIQ_SHIM_NONCE_ACTION = 'kotoiq_shim_toggle_pairing';
const KOTOIQ_SHIM_NONCE_FIELD  = 'kotoiq_shim_nonce';

add_action('admin_menu', function () {
    add_menu_page(
        'KotoIQ',
        'KotoIQ',
        'manage_options',
        KOTOIQ_SHIM_ADMIN_SLUG,
        'kotoiq_shim_admin_render',
        'dashicons-admin-network',
        99
    );
});

add_action('admin_post_kotoiq_shim_toggle_pairing', function () {
    if (!current_user_can('manage_options')) {
        wp_die('Insufficient permissions', 'KotoIQ', ['response' => 403]);
    }
    if (!isset($_POST[KOTOIQ_SHIM_NONCE_FIELD])) {
        wp_die('Missing nonce', 'KotoIQ', ['response' => 400]);
    }
    $nonce = sanitize_text_field(wp_unslash($_POST[KOTOIQ_SHIM_NONCE_FIELD]));
    if (!wp_verify_nonce($nonce, KOTOIQ_SHIM_NONCE_ACTION)) {
        wp_die('Invalid nonce', 'KotoIQ', ['response' => 400]);
    }

    $action = isset($_POST['shim_action']) ? sanitize_key($_POST['shim_action']) : '';
    $flag = 'unknown';
    if ($action === 'open_window') {
        if (function_exists('kotoiq_shim_open_pairing_window')) {
            kotoiq_shim_open_pairing_window();
            $flag = 'opened';
        }
    } elseif ($action === 'close_window') {
        if (function_exists('kotoiq_shim_close_pairing_window')) {
            kotoiq_shim_close_pairing_window();
            $flag = 'closed';
        }
    }

    $redirect = add_query_arg(
        ['page' => KOTOIQ_SHIM_ADMIN_SLUG, 'shim_status' => $flag],
        admin_url('admin.php')
    );
    wp_safe_redirect($redirect);
    exit;
});

function kotoiq_shim_admin_render() {
    if (!current_user_can('manage_options')) {
        wp_die('Insufficient permissions', 'KotoIQ', ['response' => 403]);
    }

    $stored_pub_b64 = (string) get_option(KOTOIQ_SHIM_OPT_PUBKEY, '');
    $is_paired      = $stored_pub_b64 !== '';
    $fingerprint    = '';
    if ($is_paired) {
        $raw = base64_decode($stored_pub_b64, true);
        if ($raw !== false && strlen($raw) === 32) {
            $fingerprint = hash('sha256', $raw);
        }
    }
    $dashboard_url  = (string) get_option(KOTOIQ_SHIM_OPT_DASHBOARD_URL, '');
    $window_remain  = function_exists('kotoiq_shim_pairing_window_remaining')
        ? (int) kotoiq_shim_pairing_window_remaining()
        : 0;

    $status_flag = isset($_GET['shim_status']) ? sanitize_key($_GET['shim_status']) : '';
    ?>
    <style>
      /* Reset WP admin defaults so the page can have a custom branded look */
      .kotoiq-wrap { background: #faf9f6; margin: 0 -20px 0 -22px; padding: 32px 40px 60px; min-height: calc(100vh - 32px); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .kotoiq-wrap h1, .kotoiq-wrap h2, .kotoiq-wrap p, .kotoiq-wrap code, .kotoiq-wrap em, .kotoiq-wrap strong { color: #201b51; }
      .kotoiq-wrap .notice { background: #faf9f6; border-left-color: #cb1c6b; }
      .kotoiq-hdr { display: flex; align-items: center; gap: 18px; margin-bottom: 28px; }
      .kotoiq-logo { width: 44px; height: 44px; border-radius: 10px; background: #201b51; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; letter-spacing: -.02em; }
      .kotoiq-title { font-size: 28px; font-weight: 800; letter-spacing: -.025em; line-height: 1; margin: 0; }
      .kotoiq-sub { font-size: 13px; color: #6b7280; margin-top: 4px; font-weight: 500; }
      .kotoiq-card { background: #fff; border-radius: 14px; border: 1px solid #e9e6dd; padding: 26px 28px; margin-bottom: 18px; max-width: 760px; box-shadow: 0 1px 0 rgba(32, 27, 81, .02); }
      .kotoiq-card h2 { font-size: 16px; font-weight: 800; margin: 0 0 16px; letter-spacing: -.01em; }
      .kotoiq-row { display: flex; align-items: center; padding: 12px 0; border-top: 1px solid #f0ede4; gap: 14px; }
      .kotoiq-row:first-of-type { border-top: none; }
      .kotoiq-row-label { flex: 0 0 180px; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
      .kotoiq-row-value { flex: 1; font-size: 14px; word-break: break-all; min-width: 0; }
      .kotoiq-row-value code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: #faf9f6; padding: 3px 7px; border-radius: 5px; border: 1px solid #e9e6dd; }
      .kotoiq-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: 999px; font-size: 12px; font-weight: 700; line-height: 1.5; }
      .kotoiq-pill.green { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
      .kotoiq-pill.red { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
      .kotoiq-pill.amber { background: #fff8e6; color: #b45309; border: 1px solid #fde68a; }
      .kotoiq-pill.gray { background: #f3f4f6; color: #4b5563; border: 1px solid #e5e7eb; }
      .kotoiq-pill-dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; }
      .kotoiq-cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: 10px; background: #cb1c6b; color: #fff !important; font-size: 14px; font-weight: 800; text-decoration: none; border: none; cursor: pointer; box-shadow: 0 1px 0 rgba(203, 28, 107, .25); transition: background .12s ease; line-height: 1; }
      .kotoiq-cta-btn:hover { background: #b01861; color: #fff !important; }
      .kotoiq-cta-btn.secondary { background: #fff; color: #201b51 !important; border: 1.5px solid #e9e6dd; box-shadow: none; }
      .kotoiq-cta-btn.secondary:hover { border-color: #201b51; background: #faf9f6; color: #201b51 !important; }
      .kotoiq-description { font-size: 14px; color: #4b5563; line-height: 1.6; max-width: 580px; margin: 0 0 18px; }
      .kotoiq-description.muted { font-size: 13px; color: #6b7280; }
      .kotoiq-footer { margin-top: 28px; padding-top: 22px; border-top: 1px solid #e9e6dd; font-size: 12px; color: #6b7280; max-width: 760px; line-height: 1.6; }
      .kotoiq-footer a { color: #cb1c6b; text-decoration: none; font-weight: 700; }
      .kotoiq-footer a:hover { text-decoration: underline; }
      .kotoiq-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #201b51; color: #fff; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; vertical-align: middle; margin-left: 8px; }
    </style>

    <div class="kotoiq-wrap">
      <div class="kotoiq-hdr">
        <div class="kotoiq-logo">K</div>
        <div>
          <h1 class="kotoiq-title">KotoIQ <span class="kotoiq-badge">v<?php echo esc_html(KOTOIQ_SHIM_VERSION); ?></span></h1>
          <div class="kotoiq-sub">Generic WordPress dispatcher · all controls live in the dashboard</div>
        </div>
      </div>

      <?php if ($status_flag === 'opened') : ?>
        <div class="notice notice-success is-dismissible" style="margin: 0 0 18px; max-width: 760px;"><p><strong>Pairing window opened.</strong> The KotoIQ dashboard has up to 10 minutes to complete the handshake.</p></div>
      <?php elseif ($status_flag === 'closed') : ?>
        <div class="notice notice-success is-dismissible" style="margin: 0 0 18px; max-width: 760px;"><p>Pairing window closed.</p></div>
      <?php endif; ?>

      <div class="kotoiq-card">
        <h2>Status</h2>
        <div class="kotoiq-row">
          <div class="kotoiq-row-label">Connection</div>
          <div class="kotoiq-row-value">
            <?php if ($is_paired) : ?>
              <span class="kotoiq-pill green"><span class="kotoiq-pill-dot"></span>Paired</span>
            <?php elseif ($window_remain > 0) : ?>
              <span class="kotoiq-pill amber"><span class="kotoiq-pill-dot"></span>Ready to pair · <?php echo (int) ceil($window_remain / 60); ?> min remaining</span>
            <?php else : ?>
              <span class="kotoiq-pill gray"><span class="kotoiq-pill-dot"></span>Not paired</span>
            <?php endif; ?>
          </div>
        </div>
        <?php if ($is_paired) : ?>
          <div class="kotoiq-row">
            <div class="kotoiq-row-label">Dashboard</div>
            <div class="kotoiq-row-value">
              <?php if ($dashboard_url !== '') : ?>
                <code><?php echo esc_html($dashboard_url); ?></code>
              <?php else : ?>
                <em style="color:#9ca3af;">(not recorded)</em>
              <?php endif; ?>
            </div>
          </div>
          <div class="kotoiq-row">
            <div class="kotoiq-row-label">Fingerprint</div>
            <div class="kotoiq-row-value">
              <code><?php echo esc_html($fingerprint ?: '(unavailable)'); ?></code>
            </div>
          </div>
        <?php endif; ?>
        <div class="kotoiq-row">
          <div class="kotoiq-row-label">Plugin version</div>
          <div class="kotoiq-row-value"><code><?php echo esc_html(KOTOIQ_SHIM_VERSION); ?></code></div>
        </div>
      </div>

      <?php if (!$is_paired) : ?>
        <div class="kotoiq-card">
          <h2>Pair this site</h2>
          <p class="kotoiq-description">
            Open a 10-minute pairing window. The KotoIQ dashboard will generate the API key, sign an Ed25519 envelope, and complete the handshake automatically. You won't paste anything.
          </p>
          <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin: 8px 0 0;">
            <?php wp_nonce_field(KOTOIQ_SHIM_NONCE_ACTION, KOTOIQ_SHIM_NONCE_FIELD); ?>
            <input type="hidden" name="action" value="kotoiq_shim_toggle_pairing">
            <?php if ($window_remain > 0) : ?>
              <input type="hidden" name="shim_action" value="close_window">
              <button type="submit" class="kotoiq-cta-btn secondary">Close pairing window</button>
              <span style="margin-left: 14px; font-size: 13px; color: #6b7280;">Window auto-closes in <?php echo (int) $window_remain; ?> seconds.</span>
            <?php else : ?>
              <input type="hidden" name="shim_action" value="open_window">
              <button type="submit" class="kotoiq-cta-btn">Open pairing window (10 min)</button>
            <?php endif; ?>
          </form>
        </div>
      <?php else : ?>
        <div class="kotoiq-card">
          <h2>Disconnect</h2>
          <p class="kotoiq-description">
            This site is paired. To unpair (e.g. switching agencies), fire <code>/destruct</code> from the KotoIQ dashboard. That clears the stored key and pubkey on this site. You can then open a new pairing window to re-pair.
          </p>
        </div>
      <?php endif; ?>

      <div class="kotoiq-footer">
        Managed by <strong>Unified Marketing</strong> · <a href="https://www.unifiedmktg.com" target="_blank" rel="noopener noreferrer">unifiedmktg.com</a> · Questions? Contact your account team.
      </div>
    </div>
    <?php
}
