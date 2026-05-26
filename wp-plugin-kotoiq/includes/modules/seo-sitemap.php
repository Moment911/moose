<?php
/**
 * SEO & AEO Sitemap Generator — KotoIQ's own sitemaps.
 *
 * Always generates regardless of other SEO plugins. Produces:
 *   /kotoiq-sitemap.xml          — master index
 *   /kotoiq-sitemap-pages.xml    — all published pages
 *   /kotoiq-sitemap-posts.xml    — all published posts
 *   /kotoiq-sitemap-images.xml   — image sitemap (all images in content)
 *   /kotoiq-sitemap-video.xml    — video sitemap (YouTube/Vimeo embeds)
 *   /kotoiq-sitemap-faq.xml      — AEO: FAQ schema pages for AI engines
 *   /kotoiq-sitemap-{cpt}.xml    — custom post types
 *
 * Also adds an admin page showing all sitemap links with one-click copy
 * and a REST endpoint so the Koto dashboard can display them.
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

// ── Rewrite rules — always register (no Yoast/RM check) ────────────────
add_action('init', function () {
    if (!koto_is_module_enabled('seo')) return;

    add_rewrite_rule('^kotoiq-sitemap\.xml$', 'index.php?kotoiq_sitemap=index', 'top');
    add_rewrite_rule('^kotoiq-sitemap-([a-z0-9_-]+)\.xml$', 'index.php?kotoiq_sitemap=$matches[1]', 'top');
});

add_filter('query_vars', function ($vars) {
    $vars[] = 'kotoiq_sitemap';
    return $vars;
});

add_action('template_redirect', function () {
    $type = get_query_var('kotoiq_sitemap');
    if (!$type) return;
    if (!koto_is_module_enabled('seo')) return;

    header('Content-Type: application/xml; charset=UTF-8');
    header('X-Robots-Tag: noindex');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";

    switch ($type) {
        case 'index':   kotoiq_sitemap_index(); break;
        case 'pages':   kotoiq_sitemap_posts('page'); break;
        case 'posts':   kotoiq_sitemap_posts('post'); break;
        case 'images':  kotoiq_sitemap_images(); break;
        case 'video':   kotoiq_sitemap_video(); break;
        case 'faq':     kotoiq_sitemap_faq(); break;
        default:        kotoiq_sitemap_posts($type); break;
    }
    exit;
});

// ── Master sitemap index ────────────────────────────────────────────────
function kotoiq_sitemap_index() {
    $site = get_site_url();
    $sitemaps = kotoiq_sitemap_list();
    echo '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach ($sitemaps as $sm) {
        echo "  <sitemap>\n";
        echo "    <loc>" . esc_url($sm['url']) . "</loc>\n";
        if ($sm['lastmod']) echo "    <lastmod>" . $sm['lastmod'] . "</lastmod>\n";
        echo "  </sitemap>\n";
    }
    echo '</sitemapindex>';
}

// ── Pages/Posts sitemap ─────────────────────────────────────────────────
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
        $robots = get_post_meta($post->ID, '_kotoiq_robots', true);
        if ($robots && strpos($robots, 'noindex') !== false) continue;

        $permalink = get_permalink($post->ID);
        $modified  = get_post_modified_time('c', true, $post->ID);

        // Priority: homepage=1.0, top-level pages=0.8, child pages=0.6, posts=0.5
        $priority = '0.5';
        if ($post_type === 'page') {
            if ($post->ID == get_option('page_on_front')) $priority = '1.0';
            elseif (!$post->post_parent) $priority = '0.8';
            else $priority = '0.6';
        }

        echo "  <url>\n";
        echo "    <loc>" . esc_url($permalink) . "</loc>\n";
        echo "    <lastmod>" . $modified . "</lastmod>\n";
        echo "    <changefreq>" . ($post_type === 'post' ? 'weekly' : 'monthly') . "</changefreq>\n";
        echo "    <priority>" . $priority . "</priority>\n";

        // Images in content
        $images = kotoiq_extract_images($post);
        foreach ($images as $img) {
            echo "    <image:image>\n";
            echo "      <image:loc>" . esc_url($img['src']) . "</image:loc>\n";
            if ($img['alt']) echo "      <image:title>" . kiq_esc_xml($img['alt']) . "</image:title>\n";
            echo "    </image:image>\n";
        }

        echo "  </url>\n";
    }
    echo '</urlset>';
}

// ── Image sitemap ───────────────────────────────────────────────────────
function kotoiq_sitemap_images() {
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

    $posts = get_posts([
        'post_type'      => ['post', 'page'],
        'post_status'    => 'publish',
        'posts_per_page' => 500,
        'orderby'        => 'modified',
        'order'          => 'DESC',
    ]);

    foreach ($posts as $post) {
        $images = kotoiq_extract_images($post);
        if (empty($images)) continue;

        echo "  <url>\n";
        echo "    <loc>" . esc_url(get_permalink($post->ID)) . "</loc>\n";
        foreach ($images as $img) {
            echo "    <image:image>\n";
            echo "      <image:loc>" . esc_url($img['src']) . "</image:loc>\n";
            if ($img['alt']) echo "      <image:title>" . kiq_esc_xml($img['alt']) . "</image:title>\n";
            if ($img['caption']) echo "      <image:caption>" . kiq_esc_xml($img['caption']) . "</image:caption>\n";
            echo "    </image:image>\n";
        }
        echo "  </url>\n";
    }
    echo '</urlset>';
}

// ── Video sitemap (YouTube/Vimeo embeds) ────────────────────────────────
function kotoiq_sitemap_video() {
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">' . "\n";

    $posts = get_posts([
        'post_type'      => ['post', 'page'],
        'post_status'    => 'publish',
        'posts_per_page' => 500,
    ]);

    foreach ($posts as $post) {
        $videos = kotoiq_extract_videos($post->post_content);
        if (empty($videos)) continue;

        echo "  <url>\n";
        echo "    <loc>" . esc_url(get_permalink($post->ID)) . "</loc>\n";
        foreach ($videos as $vid) {
            echo "    <video:video>\n";
            echo "      <video:thumbnail_loc>" . esc_url($vid['thumbnail']) . "</video:thumbnail_loc>\n";
            echo "      <video:title>" . kiq_esc_xml($post->post_title) . "</video:title>\n";
            $desc = get_post_meta($post->ID, '_kotoiq_description', true) ?: wp_trim_words(wp_strip_all_tags($post->post_content), 30);
            echo "      <video:description>" . kiq_esc_xml($desc) . "</video:description>\n";
            echo "      <video:player_loc>" . esc_url($vid['embed_url']) . "</video:player_loc>\n";
            echo "    </video:video>\n";
        }
        echo "  </url>\n";
    }
    echo '</urlset>';
}

// ── FAQ/AEO sitemap — pages with FAQ schema for AI answer engines ───────
function kotoiq_sitemap_faq() {
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

    $posts = get_posts([
        'post_type'      => ['post', 'page'],
        'post_status'    => 'publish',
        'posts_per_page' => 500,
    ]);

    foreach ($posts as $post) {
        // Check for FAQ schema in custom field or content
        $schema_type   = get_post_meta($post->ID, '_kotoiq_schema_type', true);
        $schema_custom = get_post_meta($post->ID, '_kotoiq_schema_custom', true);
        $has_faq = $schema_type === 'FAQPage'
            || (is_string($schema_custom) && stripos($schema_custom, 'FAQPage') !== false)
            || stripos($post->post_content, 'kotoiq-faq') !== false
            || stripos($post->post_content, 'FAQPage') !== false
            || stripos($post->post_content, 'itemtype="https://schema.org/FAQPage"') !== false;

        if (!$has_faq) continue;

        echo "  <url>\n";
        echo "    <loc>" . esc_url(get_permalink($post->ID)) . "</loc>\n";
        echo "    <lastmod>" . get_post_modified_time('c', true, $post->ID) . "</lastmod>\n";
        echo "    <changefreq>weekly</changefreq>\n";
        echo "    <priority>0.7</priority>\n";
        echo "  </url>\n";
    }
    echo '</urlset>';
}

// ── Build list of all sitemaps with URLs ─────────────────────────────────
function kotoiq_sitemap_list() {
    $site = get_site_url();
    $sitemaps = [];

    // Pages
    if (wp_count_posts('page')->publish > 0) {
        $sitemaps[] = [
            'name'    => 'Pages',
            'slug'    => 'pages',
            'url'     => $site . '/kotoiq-sitemap-pages.xml',
            'type'    => 'seo',
            'count'   => wp_count_posts('page')->publish,
            'lastmod' => kotoiq_sitemap_lastmod('page'),
        ];
    }

    // Posts
    if (wp_count_posts('post')->publish > 0) {
        $sitemaps[] = [
            'name'    => 'Posts',
            'slug'    => 'posts',
            'url'     => $site . '/kotoiq-sitemap-posts.xml',
            'type'    => 'seo',
            'count'   => wp_count_posts('post')->publish,
            'lastmod' => kotoiq_sitemap_lastmod('post'),
        ];
    }

    // Custom post types
    $cpts = get_post_types(['public' => true, '_builtin' => false], 'objects');
    foreach ($cpts as $cpt) {
        $count = wp_count_posts($cpt->name)->publish;
        if ($count > 0) {
            $sitemaps[] = [
                'name'    => $cpt->label,
                'slug'    => $cpt->name,
                'url'     => $site . '/kotoiq-sitemap-' . $cpt->name . '.xml',
                'type'    => 'seo',
                'count'   => $count,
                'lastmod' => kotoiq_sitemap_lastmod($cpt->name),
            ];
        }
    }

    // Image sitemap
    $sitemaps[] = [
        'name'    => 'Images',
        'slug'    => 'images',
        'url'     => $site . '/kotoiq-sitemap-images.xml',
        'type'    => 'seo',
        'count'   => null,
        'lastmod' => kotoiq_sitemap_lastmod('page'),
    ];

    // Video sitemap
    $sitemaps[] = [
        'name'    => 'Videos',
        'slug'    => 'video',
        'url'     => $site . '/kotoiq-sitemap-video.xml',
        'type'    => 'seo',
        'count'   => null,
        'lastmod' => null,
    ];

    // FAQ/AEO sitemap
    $sitemaps[] = [
        'name'    => 'FAQ (AEO)',
        'slug'    => 'faq',
        'url'     => $site . '/kotoiq-sitemap-faq.xml',
        'type'    => 'aeo',
        'count'   => null,
        'lastmod' => null,
    ];

    return $sitemaps;
}

function kotoiq_sitemap_lastmod($post_type) {
    global $wpdb;
    $date = $wpdb->get_var($wpdb->prepare(
        "SELECT MAX(post_modified_gmt) FROM $wpdb->posts WHERE post_type = %s AND post_status = 'publish'",
        $post_type
    ));
    return $date ? date('c', strtotime($date)) : null;
}

// ── Helper: extract images from post ────────────────────────────────────
function kotoiq_extract_images($post) {
    $images = [];

    // Featured image
    $thumb = get_the_post_thumbnail_url($post->ID, 'large');
    if ($thumb) {
        $images[] = ['src' => $thumb, 'alt' => $post->post_title, 'caption' => ''];
    }

    // Content images
    preg_match_all('/<img[^>]+>/i', $post->post_content, $matches);
    foreach ($matches[0] as $tag) {
        $src = ''; $alt = ''; $caption = '';
        if (preg_match('/src=["\']([^"\']+)/i', $tag, $m)) $src = $m[1];
        if (preg_match('/alt=["\']([^"\']*)/i', $tag, $m)) $alt = $m[1];
        if ($src && !in_array($src, array_column($images, 'src'))) {
            $images[] = ['src' => $src, 'alt' => $alt, 'caption' => $caption];
        }
    }

    return $images;
}

// ── Helper: extract video embeds ────────────────────────────────────────
function kotoiq_extract_videos($content) {
    $videos = [];

    // YouTube
    preg_match_all('/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]+)/i', $content, $yt);
    foreach (($yt[1] ?? []) as $id) {
        $videos[] = [
            'embed_url' => 'https://www.youtube.com/embed/' . $id,
            'thumbnail' => 'https://img.youtube.com/vi/' . $id . '/hqdefault.jpg',
        ];
    }

    // Vimeo
    preg_match_all('/vimeo\.com\/(?:video\/)?(\d+)/i', $content, $vm);
    foreach (($vm[1] ?? []) as $id) {
        $videos[] = [
            'embed_url' => 'https://player.vimeo.com/video/' . $id,
            'thumbnail' => 'https://vumbnail.com/' . $id . '.jpg',
        ];
    }

    return $videos;
}

// ── XML escape helper ───────────────────────────────────────────────────
if (!function_exists('kiq_esc_xml')) {
    function kiq_esc_xml($text) {
        return htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}

// ── REST endpoint: list all sitemaps ────────────────────────────────────
add_action('rest_api_init', function () {
    if (!koto_is_module_enabled('seo')) return;

    kotoiq_register_rest_route('/seo/sitemaps', [
        'methods'             => 'GET',
        'callback'            => function () {
            $sitemaps = kotoiq_sitemap_list();
            $index_url = get_site_url() . '/kotoiq-sitemap.xml';
            return rest_ensure_response([
                'index_url' => $index_url,
                'sitemaps'  => $sitemaps,
                'total'     => count($sitemaps),
            ]);
        },
        'permission_callback' => 'kotoiq_perm_read',
    ]);
});

// ── Admin page: Sitemaps ────────────────────────────────────────────────
add_action('admin_menu', function () {
    if (!koto_is_module_enabled('seo')) return;
    add_submenu_page('kotoiq', 'Sitemaps', 'Sitemaps', 'manage_options', 'kotoiq-sitemaps', 'kotoiq_admin_sitemaps_page');
});

function kotoiq_admin_sitemaps_page() {
    if (!current_user_can('manage_options')) wp_die('Forbidden');

    $sitemaps  = kotoiq_sitemap_list();
    $index_url = get_site_url() . '/kotoiq-sitemap.xml';
    $C_NAVY = '#201b51'; $C_PINK = '#cb1c6b'; $C_CREAM = '#faf9f6';
    $C_LINE = '#e8e5df'; $C_MUTED = '#6b6789'; $C_GREEN = '#16a34a';
    ?>
    <style>
        .kiq-sm-wrap { background: <?php echo $C_CREAM; ?>; margin: 20px -20px -10px -22px; padding: 32px 40px; font-family: 'DM Sans', -apple-system, sans-serif; min-height: calc(100vh - 100px); }
        @media (max-width: 782px) { .kiq-sm-wrap { margin: 10px -10px; padding: 16px; } }
        .kiq-sm-card { background: #fff; border: 1px solid <?php echo $C_LINE; ?>; border-radius: 16px; padding: 28px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(32,27,81,0.04); }
    </style>
    <div class="kiq-sm-wrap">
        <div style="display:flex;align-items:center;gap:14;margin-bottom:28px;">
            <div style="width:44px;height:44px;border-radius:12px;background:<?php echo $C_PINK; ?>12;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:22px;">🗺️</span>
            </div>
            <div>
                <h1 style="margin:0;font-size:24px;font-weight:700;color:<?php echo $C_NAVY; ?>;">KotoIQ Sitemaps</h1>
                <p style="margin:4px 0 0;font-size:15px;color:<?php echo $C_MUTED; ?>;">XML sitemaps for Google, Bing, and AI answer engines. Auto-updated on publish.</p>
            </div>
        </div>

        <!-- Master Index -->
        <div class="kiq-sm-card" style="border-left:4px solid <?php echo $C_PINK; ?>;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
                <div>
                    <div style="font-size:18px;font-weight:700;color:<?php echo $C_NAVY; ?>;margin-bottom:4px;">Master Sitemap Index</div>
                    <div style="font-size:14px;color:<?php echo $C_MUTED; ?>;">Submit this URL to Google Search Console and Bing Webmaster Tools</div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <code style="padding:10px 16px;background:<?php echo $C_CREAM; ?>;border:1px solid <?php echo $C_LINE; ?>;border-radius:10px;font-size:14px;color:<?php echo $C_NAVY; ?>;font-weight:600;"><?php echo esc_html($index_url); ?></code>
                    <a href="<?php echo esc_url($index_url); ?>" target="_blank" style="padding:10px 18px;border-radius:50px;background:<?php echo $C_PINK; ?>;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">Open ↗</a>
                </div>
            </div>
        </div>

        <!-- Individual Sitemaps -->
        <div class="kiq-sm-card">
            <div style="font-size:17px;font-weight:700;color:<?php echo $C_NAVY; ?>;margin-bottom:18px;">All Sitemaps</div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead>
                    <tr style="border-bottom:2px solid <?php echo $C_LINE; ?>;">
                        <th style="text-align:left;padding:12px 14px;color:<?php echo $C_MUTED; ?>;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Name</th>
                        <th style="text-align:left;padding:12px 14px;color:<?php echo $C_MUTED; ?>;font-size:12px;font-weight:600;text-transform:uppercase;">Type</th>
                        <th style="text-align:center;padding:12px 14px;color:<?php echo $C_MUTED; ?>;font-size:12px;font-weight:600;text-transform:uppercase;">Count</th>
                        <th style="text-align:left;padding:12px 14px;color:<?php echo $C_MUTED; ?>;font-size:12px;font-weight:600;text-transform:uppercase;">Last Modified</th>
                        <th style="text-align:right;padding:12px 14px;color:<?php echo $C_MUTED; ?>;font-size:12px;font-weight:600;text-transform:uppercase;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($sitemaps as $sm): ?>
                    <tr style="border-bottom:1px solid <?php echo $C_LINE; ?>;">
                        <td style="padding:14px;font-weight:600;color:<?php echo $C_NAVY; ?>;">
                            <?php echo esc_html($sm['name']); ?>
                            <?php if ($sm['type'] === 'aeo'): ?>
                                <span style="margin-left:6px;padding:2px 8px;border-radius:10px;background:<?php echo $C_PINK; ?>12;color:<?php echo $C_PINK; ?>;font-size:11px;font-weight:700;">AEO</span>
                            <?php endif; ?>
                        </td>
                        <td style="padding:14px;color:<?php echo $C_MUTED; ?>;">
                            <span style="padding:4px 10px;border-radius:6px;background:<?php echo $C_CREAM; ?>;font-size:12px;font-weight:600;"><?php echo esc_html(strtoupper($sm['type'])); ?></span>
                        </td>
                        <td style="padding:14px;text-align:center;font-weight:600;color:<?php echo $C_NAVY; ?>;"><?php echo $sm['count'] !== null ? $sm['count'] : '—'; ?></td>
                        <td style="padding:14px;color:<?php echo $C_MUTED; ?>;font-size:13px;"><?php echo $sm['lastmod'] ? date('M j, Y', strtotime($sm['lastmod'])) : '—'; ?></td>
                        <td style="padding:14px;text-align:right;">
                            <a href="<?php echo esc_url($sm['url']); ?>" target="_blank" style="padding:8px 16px;border-radius:50px;border:1.5px solid <?php echo $C_LINE; ?>;background:#fff;color:<?php echo $C_NAVY; ?>;text-decoration:none;font-size:13px;font-weight:600;">Open ↗</a>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <!-- Submission Guide -->
        <div class="kiq-sm-card" style="background:<?php echo $C_CREAM; ?>;border:none;">
            <div style="font-size:16px;font-weight:700;color:<?php echo $C_NAVY; ?>;margin-bottom:14px;">How to Submit</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div style="background:#fff;border-radius:12px;padding:18px;border:1px solid <?php echo $C_LINE; ?>;">
                    <div style="font-size:15px;font-weight:600;color:<?php echo $C_NAVY; ?>;margin-bottom:8px;">🔍 Google Search Console</div>
                    <ol style="margin:0;padding-left:20px;font-size:14px;color:<?php echo $C_MUTED; ?>;line-height:1.8;">
                        <li>Go to <a href="https://search.google.com/search-console" target="_blank" style="color:<?php echo $C_PINK; ?>;">search.google.com/search-console</a></li>
                        <li>Select your property</li>
                        <li>Go to Sitemaps in the left menu</li>
                        <li>Paste: <code style="background:<?php echo $C_CREAM; ?>;padding:2px 6px;border-radius:4px;"><?php echo esc_html($index_url); ?></code></li>
                        <li>Click Submit</li>
                    </ol>
                </div>
                <div style="background:#fff;border-radius:12px;padding:18px;border:1px solid <?php echo $C_LINE; ?>;">
                    <div style="font-size:15px;font-weight:600;color:<?php echo $C_NAVY; ?>;margin-bottom:8px;">🔎 Bing Webmaster Tools</div>
                    <ol style="margin:0;padding-left:20px;font-size:14px;color:<?php echo $C_MUTED; ?>;line-height:1.8;">
                        <li>Go to <a href="https://www.bing.com/webmasters" target="_blank" style="color:<?php echo $C_PINK; ?>;">bing.com/webmasters</a></li>
                        <li>Select your site</li>
                        <li>Go to Sitemaps</li>
                        <li>Click Submit sitemap</li>
                        <li>Paste the same URL</li>
                    </ol>
                </div>
            </div>
        </div>
    </div>
    <?php
}

// ── Auto-ping on content change ─────────────────────────────────────────
add_action('save_post', function ($post_id) {
    if (!koto_is_module_enabled('seo')) return;
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) return;
    if (get_post_status($post_id) !== 'publish') return;

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
