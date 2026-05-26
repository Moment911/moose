<?php
/**
 * SEO Sitemap — KotoIQ's own XML sitemap generator.
 *
 * Generates /kotoiq-sitemap.xml with all public posts, pages, and
 * custom post types. Supports image sitemaps and automatic ping
 * to Google and Bing when content changes.
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

// ── Rewrite rules for /kotoiq-sitemap.xml ───────────────────────────────
add_action('init', function () {
    if (!koto_is_module_enabled('seo')) return;
    // Don't register if Yoast or Rank Math handles sitemaps
    if (defined('WPSEO_VERSION') || defined('RANK_MATH_VERSION')) return;

    add_rewrite_rule('^kotoiq-sitemap\.xml$', 'index.php?kotoiq_sitemap=index', 'top');
    add_rewrite_rule('^kotoiq-sitemap-([a-z]+)-?(\d*)\.xml$', 'index.php?kotoiq_sitemap=$matches[1]&kotoiq_sitemap_page=$matches[2]', 'top');
});

add_filter('query_vars', function ($vars) {
    $vars[] = 'kotoiq_sitemap';
    $vars[] = 'kotoiq_sitemap_page';
    return $vars;
});

add_action('template_redirect', function () {
    $type = get_query_var('kotoiq_sitemap');
    if (!$type) return;
    if (!koto_is_module_enabled('seo')) return;

    header('Content-Type: application/xml; charset=UTF-8');
    header('X-Robots-Tag: noindex');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";

    if ($type === 'index') {
        kotoiq_sitemap_index();
    } elseif ($type === 'post') {
        kotoiq_sitemap_posts('post');
    } elseif ($type === 'page') {
        kotoiq_sitemap_posts('page');
    } else {
        kotoiq_sitemap_posts($type);
    }
    exit;
});

function kotoiq_sitemap_index() {
    $site_url = get_site_url();
    echo '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

    // Pages sitemap
    $page_count = wp_count_posts('page')->publish;
    if ($page_count > 0) {
        echo '  <sitemap>' . "\n";
        echo '    <loc>' . esc_url($site_url . '/kotoiq-sitemap-page.xml') . '</loc>' . "\n";
        echo '    <lastmod>' . kotoiq_sitemap_last_modified('page') . '</lastmod>' . "\n";
        echo '  </sitemap>' . "\n";
    }

    // Posts sitemap
    $post_count = wp_count_posts('post')->publish;
    if ($post_count > 0) {
        echo '  <sitemap>' . "\n";
        echo '    <loc>' . esc_url($site_url . '/kotoiq-sitemap-post.xml') . '</loc>' . "\n";
        echo '    <lastmod>' . kotoiq_sitemap_last_modified('post') . '</lastmod>' . "\n";
        echo '  </sitemap>' . "\n";
    }

    // Custom post types
    $cpts = get_post_types(['public' => true, '_builtin' => false], 'names');
    foreach ($cpts as $cpt) {
        $count = wp_count_posts($cpt)->publish;
        if ($count > 0) {
            echo '  <sitemap>' . "\n";
            echo '    <loc>' . esc_url($site_url . '/kotoiq-sitemap-' . $cpt . '.xml') . '</loc>' . "\n";
            echo '    <lastmod>' . kotoiq_sitemap_last_modified($cpt) . '</lastmod>' . "\n";
            echo '  </sitemap>' . "\n";
        }
    }

    echo '</sitemapindex>';
}

function kotoiq_sitemap_posts($post_type) {
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

    $posts = get_posts([
        'post_type'      => $post_type,
        'post_status'    => 'publish',
        'posts_per_page' => 2000,
        'orderby'        => 'modified',
        'order'          => 'DESC',
    ]);

    foreach ($posts as $post) {
        // Skip noindex pages
        $robots = get_post_meta($post->ID, '_kotoiq_robots', true);
        if ($robots && strpos($robots, 'noindex') !== false) continue;

        $permalink = get_permalink($post->ID);
        $modified  = get_post_modified_time('c', true, $post->ID);

        // Determine priority based on post type and depth
        $priority = '0.5';
        if ($post_type === 'page') {
            $priority = $post->post_parent ? '0.6' : '0.8';
            if ($post->post_name === 'home' || $post->ID == get_option('page_on_front')) $priority = '1.0';
        }

        echo '  <url>' . "\n";
        echo '    <loc>' . esc_url($permalink) . '</loc>' . "\n";
        echo '    <lastmod>' . $modified . '</lastmod>' . "\n";
        echo '    <changefreq>' . ($post_type === 'post' ? 'weekly' : 'monthly') . '</changefreq>' . "\n";
        echo '    <priority>' . $priority . '</priority>' . "\n";

        // Include featured image
        $thumb = get_the_post_thumbnail_url($post->ID, 'large');
        if ($thumb) {
            echo '    <image:image>' . "\n";
            echo '      <image:loc>' . esc_url($thumb) . '</image:loc>' . "\n";
            echo '      <image:title>' . esc_xml($post->post_title) . '</image:title>' . "\n";
            echo '    </image:image>' . "\n";
        }

        echo '  </url>' . "\n";
    }

    echo '</urlset>';
}

function kotoiq_sitemap_last_modified($post_type) {
    global $wpdb;
    $date = $wpdb->get_var($wpdb->prepare(
        "SELECT MAX(post_modified_gmt) FROM $wpdb->posts WHERE post_type = %s AND post_status = 'publish'",
        $post_type
    ));
    return $date ? date('c', strtotime($date)) : date('c');
}

// ── Auto-ping on content change ─────────────────────────────────────────
add_action('save_post', function ($post_id) {
    if (!koto_is_module_enabled('seo')) return;
    if (defined('WPSEO_VERSION') || defined('RANK_MATH_VERSION')) return;
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) return;
    if (get_post_status($post_id) !== 'publish') return;

    // Debounce — don't ping more than once per minute
    $last_ping = get_transient('kotoiq_sitemap_last_ping');
    if ($last_ping) return;
    set_transient('kotoiq_sitemap_last_ping', time(), 60);

    $sitemap_url = get_site_url() . '/kotoiq-sitemap.xml';
    wp_remote_get('https://www.google.com/ping?sitemap=' . urlencode($sitemap_url), ['timeout' => 5, 'blocking' => false]);
    wp_remote_get('https://www.bing.com/ping?sitemap=' . urlencode($sitemap_url), ['timeout' => 5, 'blocking' => false]);
}, 20, 1);

// ── Flush rewrite rules on activation ───────────────────────────────────
register_activation_hook(KOTOIQ_PLUGIN_FILE, function () {
    flush_rewrite_rules();
});

// ── Helper for XML escaping ─────────────────────────────────────────────
if (!function_exists('esc_xml')) {
    function esc_xml($text) {
        return htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
