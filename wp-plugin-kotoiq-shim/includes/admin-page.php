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
 * Visual identity: Unified Marketing design system from unifiedmktg.com —
 * Bebas Neue + DM Sans + DM Serif Display, navy + pink on cream warm.
 * Self-contained inline CSS + Google Fonts CDN load so the plugin's
 * surface area stays minimal.
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">

    <style>
      /* ============================================================
         Unified Marketing design tokens — matches unifiedmktg.com
         ============================================================ */
      .kotoiq-wrap {
        --navy: #201b51;
        --navy-deep: #15113a;
        --pink: #cb1c6b;
        --pink-deep: #a8155a;
        --warm: #faf9f6;
        --off: #f5f3ee;
        --line: rgba(32, 27, 81, .12);
        --muted: #6b6789;
        --live: #16a34a;

        background: var(--warm);
        margin: 0 -20px 0 -22px;
        padding: 0 0 60px;
        min-height: calc(100vh - 32px);
        font-family: 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        color: var(--navy);
        font-size: 16px;
        line-height: 1.55;
        -webkit-font-smoothing: antialiased;
      }
      .kotoiq-wrap *, .kotoiq-wrap *::before, .kotoiq-wrap *::after { box-sizing: border-box; }
      .kotoiq-wrap h1, .kotoiq-wrap h2, .kotoiq-wrap h3, .kotoiq-wrap p { color: var(--navy); }

      /* Override WP notice colors */
      .kotoiq-wrap .notice { background: #fff; border-left: 4px solid var(--pink); border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 0 0 24px; }
      .kotoiq-wrap .notice p { margin: 0; font-family: 'DM Sans', sans-serif; }

      .kotoiq-container { max-width: 1100px; padding: 48px 40px 20px; margin: 0 auto; }
      @media (max-width: 768px) { .kotoiq-container { padding: 32px 20px 20px; } }

      /* ===== HEADER (Bebas display title) ===== */
      .kotoiq-header { margin-bottom: 36px; }
      .kotoiq-eyebrow {
        font-size: 13px;
        letter-spacing: .28em;
        text-transform: uppercase;
        color: var(--pink);
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .kotoiq-eyebrow::before { content: "◆"; font-size: 10px; }
      .kotoiq-title {
        font-family: 'Bebas Neue', sans-serif;
        font-size: clamp(48px, 7vw, 88px);
        line-height: .9;
        letter-spacing: -.01em;
        color: var(--navy);
        margin: 0 0 14px;
      }
      .kotoiq-title .accent {
        font-family: 'DM Serif Display', serif;
        font-style: italic;
        color: var(--pink);
        font-weight: 400;
      }
      .kotoiq-tagline {
        font-size: 18px;
        color: var(--muted);
        max-width: 620px;
        font-weight: 400;
        line-height: 1.55;
      }

      /* ===== LIVE TICKER (mirrors site hero-ticker) ===== */
      .kotoiq-ticker {
        display: inline-flex;
        align-items: center;
        gap: 14px;
        margin-top: 22px;
        padding: 12px 22px 12px 16px;
        border: 1.5px solid rgba(203, 28, 107, .25);
        border-radius: 50px;
        background: linear-gradient(90deg, rgba(203, 28, 107, .06), rgba(32, 27, 81, .04));
        font-size: 14px;
        letter-spacing: .02em;
        font-weight: 500;
        box-shadow: 0 4px 24px rgba(203, 28, 107, .08);
        flex-wrap: wrap;
      }
      .kotoiq-ticker-dot {
        width: 10px; height: 10px; border-radius: 50%;
        background: var(--live);
        animation: kotoiq-pulse-dot 1.5s ease-in-out infinite;
      }
      .kotoiq-ticker-dot.amber { background: #d97706; }
      .kotoiq-ticker-dot.gray { background: #9ca3af; animation: none; }
      @keyframes kotoiq-pulse-dot {
        0%, 100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, .6); transform: scale(1); }
        50% { box-shadow: 0 0 0 8px rgba(22, 163, 74, 0); transform: scale(1.15); }
      }
      .kotoiq-ticker-live {
        font-weight: 800;
        letter-spacing: .18em;
        font-size: 10px;
        color: var(--live);
        background: rgba(22, 163, 74, .12);
        padding: 3px 9px;
        border-radius: 50px;
      }
      .kotoiq-ticker-live.amber { color: #b45309; background: rgba(245, 158, 11, .12); }
      .kotoiq-ticker-live.gray { color: #6b7280; background: rgba(107, 114, 128, .12); }
      .kotoiq-ticker-brand {
        font-family: 'Bebas Neue', sans-serif;
        letter-spacing: .06em;
        color: var(--pink);
        font-weight: 700;
        font-size: 18px;
      }
      .kotoiq-ticker-divider { width: 1px; height: 18px; background: var(--line); }
      .kotoiq-ticker-text { color: var(--muted); font-size: 13px; }

      /* ===== CARDS ===== */
      .kotoiq-card {
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 32px 36px;
        margin-bottom: 22px;
        box-shadow: 0 1px 0 rgba(32, 27, 81, .02);
      }
      .kotoiq-card-title {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 24px;
        letter-spacing: .04em;
        color: var(--navy);
        margin: 0 0 18px;
        text-transform: uppercase;
      }
      .kotoiq-card-desc {
        font-size: 15px;
        color: var(--muted);
        line-height: 1.6;
        max-width: 580px;
        margin: 0 0 24px;
      }
      .kotoiq-card-desc strong { color: var(--navy); font-weight: 600; }

      /* ===== DATA ROWS ===== */
      .kotoiq-row {
        display: flex;
        align-items: center;
        padding: 14px 0;
        border-top: 1px solid rgba(32, 27, 81, .06);
        gap: 18px;
      }
      .kotoiq-row:first-of-type { border-top: none; padding-top: 0; }
      .kotoiq-row:last-of-type { padding-bottom: 0; }
      .kotoiq-row-label {
        flex: 0 0 180px;
        font-size: 11px;
        color: var(--muted);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .12em;
      }
      .kotoiq-row-value {
        flex: 1;
        font-size: 15px;
        word-break: break-all;
        min-width: 0;
      }
      .kotoiq-row-value code {
        font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
        font-size: 12px;
        background: var(--off);
        padding: 4px 9px;
        border-radius: 6px;
        border: 1px solid var(--line);
        color: var(--navy);
      }
      .kotoiq-row-value em { color: #9ca3af; font-style: normal; font-size: 13px; }

      /* ===== STATUS PILLS ===== */
      .kotoiq-pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 5px 13px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.5;
        letter-spacing: .04em;
        font-family: 'DM Sans', sans-serif;
      }
      .kotoiq-pill.green { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
      .kotoiq-pill.amber { background: #fff8e6; color: #b45309; border: 1px solid #fde68a; }
      .kotoiq-pill.gray  { background: var(--off); color: var(--muted); border: 1px solid var(--line); }
      .kotoiq-pill-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }

      /* ===== PRIMARY CTA (pulses pink like the site) ===== */
      .kotoiq-cta {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: var(--pink);
        color: var(--warm) !important;
        padding: 18px 36px;
        border-radius: 50px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: .12em;
        text-transform: uppercase;
        border: none;
        cursor: pointer;
        text-decoration: none;
        transition: background .2s, transform .2s, box-shadow .2s;
        box-shadow: 0 4px 20px rgba(203, 28, 107, .25);
        animation: kotoiq-pulse-pink 2.4s ease-in-out infinite;
        font-family: 'DM Sans', sans-serif;
      }
      .kotoiq-cta:hover {
        background: var(--pink-deep);
        transform: translateY(-2px);
        box-shadow: 0 8px 28px rgba(203, 28, 107, .4);
        color: var(--warm) !important;
      }
      @keyframes kotoiq-pulse-pink {
        0%, 100% { box-shadow: 0 4px 20px rgba(203, 28, 107, .25), 0 0 0 0 rgba(203, 28, 107, .5); }
        50% { box-shadow: 0 4px 20px rgba(203, 28, 107, .25), 0 0 0 12px rgba(203, 28, 107, 0); }
      }
      .kotoiq-cta.secondary {
        background: transparent;
        color: var(--navy) !important;
        border: 2px solid var(--navy);
        box-shadow: none;
        animation: none;
      }
      .kotoiq-cta.secondary:hover {
        background: var(--navy);
        color: var(--warm) !important;
        transform: translateY(-2px);
      }

      .kotoiq-cta-row { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
      .kotoiq-cta-meta { font-size: 13px; color: var(--muted); font-weight: 500; }

      /* ===== FOOTER ===== */
      .kotoiq-footer {
        margin-top: 36px;
        padding-top: 28px;
        border-top: 1px solid var(--line);
        font-size: 13px;
        color: var(--muted);
        max-width: 760px;
        font-family: 'DM Sans', sans-serif;
        line-height: 1.7;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .kotoiq-footer a {
        color: var(--pink);
        text-decoration: none;
        font-weight: 600;
      }
      .kotoiq-footer a:hover { text-decoration: underline; }
      .kotoiq-footer-divider { color: var(--line); }

      /* ===== HIDE WP DEFAULT TITLE ===== */
      .kotoiq-wrap-host > h1:first-child { display: none; }
    </style>

    <div class="kotoiq-wrap">
      <div class="kotoiq-container">

        <!-- HERO HEADER -->
        <header class="kotoiq-header">
          <div class="kotoiq-eyebrow">Marketing Intelligence Engine</div>
          <h1 class="kotoiq-title">Koto<span class="accent">IQ</span></h1>
          <p class="kotoiq-tagline">
            This site is connected to the KotoIQ dashboard. Every control —
            SEO, content, snippets, redirects, capabilities, templates,
            sitemap — lives in the dashboard. This page only handles
            the pair handshake.
          </p>

          <!-- LIVE TICKER -->
          <div class="kotoiq-ticker">
            <?php if ($is_paired) : ?>
              <div class="kotoiq-ticker-dot"></div>
              <span class="kotoiq-ticker-live">LIVE</span>
              <span class="kotoiq-ticker-brand">KotoIQ v<?php echo esc_html(KOTOIQ_SHIM_VERSION); ?></span>
              <div class="kotoiq-ticker-divider"></div>
              <span class="kotoiq-ticker-text">paired with <?php echo esc_html($dashboard_url ? parse_url($dashboard_url, PHP_URL_HOST) : 'dashboard'); ?></span>
            <?php elseif ($window_remain > 0) : ?>
              <div class="kotoiq-ticker-dot amber"></div>
              <span class="kotoiq-ticker-live amber">READY</span>
              <span class="kotoiq-ticker-brand">KotoIQ v<?php echo esc_html(KOTOIQ_SHIM_VERSION); ?></span>
              <div class="kotoiq-ticker-divider"></div>
              <span class="kotoiq-ticker-text">pairing window open · <?php echo (int) ceil($window_remain / 60); ?> min left</span>
            <?php else : ?>
              <div class="kotoiq-ticker-dot gray"></div>
              <span class="kotoiq-ticker-live gray">IDLE</span>
              <span class="kotoiq-ticker-brand">KotoIQ v<?php echo esc_html(KOTOIQ_SHIM_VERSION); ?></span>
              <div class="kotoiq-ticker-divider"></div>
              <span class="kotoiq-ticker-text">not paired</span>
            <?php endif; ?>
          </div>
        </header>

        <?php if ($status_flag === 'opened') : ?>
          <div class="notice"><p><strong>Pairing window opened.</strong> The dashboard has 10 minutes to complete the handshake.</p></div>
        <?php elseif ($status_flag === 'closed') : ?>
          <div class="notice"><p>Pairing window closed.</p></div>
        <?php endif; ?>

        <!-- STATUS CARD -->
        <section class="kotoiq-card">
          <h2 class="kotoiq-card-title">Connection</h2>
          <div class="kotoiq-row">
            <div class="kotoiq-row-label">Status</div>
            <div class="kotoiq-row-value">
              <?php if ($is_paired) : ?>
                <span class="kotoiq-pill green"><span class="kotoiq-pill-dot"></span>Paired</span>
              <?php elseif ($window_remain > 0) : ?>
                <span class="kotoiq-pill amber"><span class="kotoiq-pill-dot"></span>Ready to pair</span>
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
                  <em>(not recorded)</em>
                <?php endif; ?>
              </div>
            </div>
            <div class="kotoiq-row">
              <div class="kotoiq-row-label">Fingerprint</div>
              <div class="kotoiq-row-value"><code><?php echo esc_html($fingerprint ?: '(unavailable)'); ?></code></div>
            </div>
          <?php endif; ?>
          <div class="kotoiq-row">
            <div class="kotoiq-row-label">Plugin version</div>
            <div class="kotoiq-row-value"><code><?php echo esc_html(KOTOIQ_SHIM_VERSION); ?></code></div>
          </div>
        </section>

        <!-- ACTION CARD -->
        <?php if (!$is_paired) : ?>
          <section class="kotoiq-card">
            <h2 class="kotoiq-card-title">Pair this site</h2>
            <p class="kotoiq-card-desc">
              Open a 10-minute pairing window. The KotoIQ dashboard will
              generate the API key, sign an Ed25519 envelope, and complete
              the handshake automatically. <strong>You won't paste anything.</strong>
            </p>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="kotoiq-cta-row">
              <?php wp_nonce_field(KOTOIQ_SHIM_NONCE_ACTION, KOTOIQ_SHIM_NONCE_FIELD); ?>
              <input type="hidden" name="action" value="kotoiq_shim_toggle_pairing">
              <?php if ($window_remain > 0) : ?>
                <input type="hidden" name="shim_action" value="close_window">
                <button type="submit" class="kotoiq-cta secondary">Close pairing window</button>
                <span class="kotoiq-cta-meta">Auto-closes in <?php echo (int) $window_remain; ?>s</span>
              <?php else : ?>
                <input type="hidden" name="shim_action" value="open_window">
                <button type="submit" class="kotoiq-cta">Open pairing window</button>
                <span class="kotoiq-cta-meta">10-minute window · one-time handshake</span>
              <?php endif; ?>
            </form>
          </section>
        <?php else : ?>
          <section class="kotoiq-card">
            <h2 class="kotoiq-card-title">Disconnect</h2>
            <p class="kotoiq-card-desc">
              This site is paired and operational. To unpair (switching
              agencies, decommissioning), fire <code>/destruct</code>
              from the KotoIQ dashboard. The stored key + pubkey on this
              site will be cleared. Re-pair anytime by opening a new
              window here.
            </p>
          </section>
        <?php endif; ?>

        <!-- FOOTER -->
        <footer class="kotoiq-footer">
          <span>Managed by <strong style="color: var(--navy); font-weight: 700;">Unified Marketing</strong></span>
          <span class="kotoiq-footer-divider">·</span>
          <a href="https://www.unifiedmktg.com" target="_blank" rel="noopener noreferrer">unifiedmktg.com</a>
          <span class="kotoiq-footer-divider">·</span>
          <span>Questions? Contact your account team.</span>
        </footer>

      </div>
    </div>
    <?php
}
