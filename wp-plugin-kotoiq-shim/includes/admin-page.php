<?php
/**
 * Admin page — WP admin → KotoIQ Shim.
 *
 * OPERATIONS-ONLY PAGE. No business logic. Site owners manage all settings
 * (SEO, content, snippets, redirects, capabilities, templates, sitemap)
 * from the KotoIQ dashboard — this page only exposes the two operations
 * that physically must happen on the WP host:
 *
 *   1. Open / close the pairing window (alternative to wp-cli `wp option
 *      update kotoiq_shim_pairing_ready ...`).
 *   2. View pair status: paired? fingerprint? dashboard URL? plugin version?
 *
 * Per CONTEXT.md D-Pairing-user (USER-LOCKED) + D-Plugin-distribution: the
 * shim presents the minimum surface area required for the operator to do
 * their job. A hostile reader of this file MUST learn nothing about how
 * KotoIQ scores SEO, composes sitemaps, runs snippets, applies access
 * policies, or pushes templates.
 *
 * Plan 11 reference: this page replaces the wp-cli requirement called out
 * in includes/pairing.php for sites whose owners can't (or won't) SSH.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

const KOTOIQ_SHIM_ADMIN_SLUG  = 'kotoiq-shim';
const KOTOIQ_SHIM_NONCE_ACTION = 'kotoiq_shim_toggle_pairing';
const KOTOIQ_SHIM_NONCE_FIELD  = 'kotoiq_shim_nonce';

add_action('admin_menu', function () {
    add_menu_page(
        'KotoIQ Shim',
        'KotoIQ Shim',
        'manage_options',
        KOTOIQ_SHIM_ADMIN_SLUG,
        'kotoiq_shim_admin_render',
        'dashicons-admin-network',
        99
    );
});

/**
 * Handle the pairing-window form POST. Must be admin + valid nonce + capability.
 * Redirects back to the admin page with a status flag in the query string.
 */
add_action('admin_post_kotoiq_shim_toggle_pairing', function () {
    if (!current_user_can('manage_options')) {
        wp_die('Insufficient permissions', 'KotoIQ Shim', ['response' => 403]);
    }
    if (!isset($_POST[KOTOIQ_SHIM_NONCE_FIELD])) {
        wp_die('Missing nonce', 'KotoIQ Shim', ['response' => 400]);
    }
    $nonce = sanitize_text_field(wp_unslash($_POST[KOTOIQ_SHIM_NONCE_FIELD]));
    if (!wp_verify_nonce($nonce, KOTOIQ_SHIM_NONCE_ACTION)) {
        wp_die('Invalid nonce', 'KotoIQ Shim', ['response' => 400]);
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

/**
 * Render the admin page. Purely operational: status + pairing-window toggle.
 * NO business-logic management — that all lives in the dashboard.
 */
function kotoiq_shim_admin_render() {
    if (!current_user_can('manage_options')) {
        wp_die('Insufficient permissions', 'KotoIQ Shim', ['response' => 403]);
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
    <div class="wrap">
      <h1>KotoIQ Shim</h1>
      <p style="max-width:720px;color:#555;">
        Operations-only page. No business logic. Site owners manage SEO, content,
        snippets, redirects, capabilities, templates, and sitemap from the KotoIQ
        dashboard. This page only controls the pair handshake.
      </p>

      <?php if ($status_flag === 'opened') : ?>
        <div class="notice notice-success"><p>Pairing window opened. The dashboard has up to 10 minutes to complete the handshake.</p></div>
      <?php elseif ($status_flag === 'closed') : ?>
        <div class="notice notice-success"><p>Pairing window closed.</p></div>
      <?php endif; ?>

      <h2>Status</h2>
      <table class="form-table" role="presentation">
        <tbody>
          <tr>
            <th scope="row">Plugin version</th>
            <td><code><?php echo esc_html(KOTOIQ_SHIM_VERSION); ?></code></td>
          </tr>
          <tr>
            <th scope="row">Paired</th>
            <td>
              <?php if ($is_paired) : ?>
                <span style="color:#0d9e6e;font-weight:600;">Yes</span>
              <?php else : ?>
                <span style="color:#dc2626;font-weight:600;">No</span>
              <?php endif; ?>
            </td>
          </tr>
          <?php if ($is_paired) : ?>
          <tr>
            <th scope="row">Dashboard URL</th>
            <td>
              <?php if ($dashboard_url !== '') : ?>
                <code><?php echo esc_html($dashboard_url); ?></code>
              <?php else : ?>
                <em>(not recorded)</em>
              <?php endif; ?>
            </td>
          </tr>
          <tr>
            <th scope="row">Pairing fingerprint</th>
            <td>
              <code style="font-size:11px;"><?php echo esc_html($fingerprint ?: '(unavailable)'); ?></code>
              <p class="description">sha256 of the dashboard's public key. Compare with the value shown in the KotoIQ dashboard pair confirmation.</p>
            </td>
          </tr>
          <?php endif; ?>
          <tr>
            <th scope="row">Pairing window</th>
            <td>
              <?php if ($window_remain > 0) : ?>
                <span style="color:#0d9e6e;font-weight:600;">Open</span>
                — <?php echo (int) $window_remain; ?> seconds remaining.
              <?php else : ?>
                <span style="color:#555;">Closed</span>
              <?php endif; ?>
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Pairing window</h2>
      <p style="max-width:720px;">
        Opening the window lets the KotoIQ dashboard complete a one-time pair
        handshake. It auto-closes after 10 minutes. Only open this when an
        operator on the dashboard side is ready to click "Pair site".
      </p>

      <?php if (!$is_paired) : ?>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-top:12px;">
          <?php wp_nonce_field(KOTOIQ_SHIM_NONCE_ACTION, KOTOIQ_SHIM_NONCE_FIELD); ?>
          <input type="hidden" name="action" value="kotoiq_shim_toggle_pairing">
          <?php if ($window_remain > 0) : ?>
            <input type="hidden" name="shim_action" value="close_window">
            <?php submit_button('Close pairing window', 'secondary', 'submit', false); ?>
          <?php else : ?>
            <input type="hidden" name="shim_action" value="open_window">
            <?php submit_button('Open pairing window (10 minutes)', 'primary', 'submit', false); ?>
          <?php endif; ?>
        </form>
      <?php else : ?>
        <p><em>Site is already paired. To re-pair, run <code>/destruct</code> from the dashboard first, then return here to open a new window.</em></p>
      <?php endif; ?>
    </div>
    <?php
}
