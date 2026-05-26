<?php
/**
 * SEO Module — KotoIQ's built-in SEO engine.
 *
 * KotoIQ handles all on-page SEO natively. No Yoast or Rank Math required.
 * Stores meta in its own fields (_kotoiq_title, _kotoiq_description,
 * _kotoiq_focus_keyword) and outputs them in <head>.
 *
 * If Yoast or Rank Math data already exists from a previous install, KotoIQ
 * reads it as a fallback so nothing is lost during migration.
 *
 * What it does:
 *   • Outputs <title>, <meta description>, and canonical in <head>
 *   • /agency/test — connection diagnostics + site inventory
 *   • /pages — list published pages with SEO meta
 *   • /generate/batch — create city/location landing pages with JSON-LD
 *   • /gsc/overview — GSC connection status
 *   • /blog/generate — publish AI-written blog posts with meta + focus keywords
 *   • /automation/run-now — sitemap rebuild + search-engine ping
 *   • /sitemap/rebuild — rebuild sitemap + ping Google & Bing
 *   • /rankings — placeholder (rankings live on the Koto platform)
 *   • /locations/states + /locations/cities — geo helpers
 *   • /content/{list,get,create,update,delete,ai-generate}
 *   • /styles — site stylesheet/font/palette inventory
 *   • Auto-ping on publish_post → fires to {agency_url}/api/seo/wp-ping
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

koto_register_module([
    'slug'        => 'seo',
    'name'        => 'SEO & Page Factory',
    'description' => 'Built-in SEO engine: meta titles, descriptions, focus keywords, JSON-LD schema, sitemap, page factory, blog publishing, and auto-ping.',
    'version'     => '3.0.0',
]);

// ─── <head> output — KotoIQ's own SEO meta ──────────────────────────────
add_action('wp_head', function () {
    if (!koto_is_module_enabled('seo')) return;
    if (is_admin()) return;

    // Don't output if Yoast or Rank Math is active (they handle <head>)
    if (defined('WPSEO_VERSION') || defined('RANK_MATH_VERSION')) return;

    $post_id = get_queried_object_id();
    if (!$post_id) return;

    $seo = kotoiq_seo_get_seo_meta($post_id);
    $title = $seo['seo_title'] ?: get_the_title($post_id);
    $desc  = $seo['meta_description'];

    if ($title) {
        // Remove default <title> and add ours
        echo '<meta name="kotoiq-seo" content="active" />' . "\n";
    }
    if ($desc) {
        echo '<meta name="description" content="' . esc_attr($desc) . '" />' . "\n";
    }

    // Canonical URL
    $canonical = get_permalink($post_id);
    if ($canonical) {
        echo '<link rel="canonical" href="' . esc_url($canonical) . '" />' . "\n";
    }

    // Open Graph basics
    if ($title) echo '<meta property="og:title" content="' . esc_attr($title) . '" />' . "\n";
    if ($desc)  echo '<meta property="og:description" content="' . esc_attr($desc) . '" />' . "\n";
    echo '<meta property="og:url" content="' . esc_url($canonical) . '" />' . "\n";
    echo '<meta property="og:type" content="article" />' . "\n";
    echo '<meta property="og:site_name" content="' . esc_attr(get_bloginfo('name')) . '" />' . "\n";

    $thumb = get_the_post_thumbnail_url($post_id, 'large');
    if ($thumb) echo '<meta property="og:image" content="' . esc_url($thumb) . '" />' . "\n";
}, 1);

// Override <title> when KotoIQ is the SEO engine
add_filter('document_title_parts', function ($title_parts) {
    if (!koto_is_module_enabled('seo')) return $title_parts;
    if (defined('WPSEO_VERSION') || defined('RANK_MATH_VERSION')) return $title_parts;

    $post_id = get_queried_object_id();
    if (!$post_id) return $title_parts;

    $kotoiq_title = get_post_meta($post_id, '_kotoiq_title', true);
    if ($kotoiq_title) {
        $title_parts['title'] = $kotoiq_title;
    }
    return $title_parts;
}, 15);

// ─── Auth callback ───────────────────────────────────────────────────────
function kotoiq_seo_auth($request) {
    if (current_user_can('manage_options')) return true;

    $unified = kotoiq_check_admin_or_remote('write');
    if ($unified === true) return true;

    // Fallback: legacy koto_api_key for pre-migration sites
    $legacy_key = get_option('koto_api_key', '');
    if ($legacy_key === '') return $unified;

    $auth = $request->get_header('Authorization') ?: $request->get_header('X-KOTO-Key') ?: $request->get_header('X-Koto-Key');
    $auth = trim(str_replace(['Bearer ', 'bearer '], '', (string) $auth));
    if ($auth !== '' && hash_equals($legacy_key, $auth)) return true;

    return $unified;
}

add_action('rest_api_init', function () {
    if (!koto_is_module_enabled('seo')) return;

    $seo_routes = [
        ['/agency/test',           'GET',    'kotoiq_seo_agency_test'],
        ['/pages',                 'GET',    'kotoiq_seo_pages'],
        ['/generate/batch',        'POST',   'kotoiq_seo_generate_batch'],
        ['/gsc/overview',          'GET',    'kotoiq_seo_gsc_overview'],
        ['/blog/generate',         'POST',   'kotoiq_seo_blog_generate'],
        ['/automation/run-now',    'POST',   'kotoiq_seo_automation_run'],
        ['/sitemap/rebuild',       'POST',   'kotoiq_seo_sitemap_rebuild'],
        ['/rankings',              'GET',    'kotoiq_seo_rankings'],
        ['/locations/states',      'GET',    'kotoiq_seo_locations_states'],
        ['/locations/cities',      'GET',    'kotoiq_seo_locations_cities'],
        ['/content/list',          'GET',    'kotoiq_seo_content_list'],
        ['/content/(?P<id>\d+)',   'GET',    'kotoiq_seo_content_get'],
        ['/content/create',        'POST',   'kotoiq_seo_content_create'],
        ['/content/(?P<id>\d+)',   'PUT',    'kotoiq_seo_content_update'],
        ['/content/(?P<id>\d+)',   'DELETE', 'kotoiq_seo_content_delete'],
        ['/content/ai-generate',   'POST',   'kotoiq_seo_content_ai_generate'],
        ['/styles',                'GET',    'kotoiq_seo_styles'],
    ];

    foreach ($seo_routes as [$path, $method, $callback]) {
        $args = ['methods' => $method, 'callback' => $callback, 'permission_callback' => 'kotoiq_seo_auth'];
        kotoiq_register_rest_route($path, $args);
        register_rest_route('koto/v1',  $path, $args);
    }

    // hlseo/v1 legacy aliases
    $hlseo_legacy = [
        ['/site/info',        'GET',  'kotoiq_seo_agency_test'],
        ['/stats',            'GET',  'kotoiq_seo_agency_test'],
        ['/agency/test',      'GET',  'kotoiq_seo_agency_test'],
        ['/sitemap/rebuild',  'POST', 'kotoiq_seo_sitemap_rebuild'],
        ['/locations/cities', 'GET',  'kotoiq_seo_locations_cities'],
    ];
    foreach ($hlseo_legacy as [$path, $method, $callback]) {
        register_rest_route('hlseo/v1', $path, [
            'methods' => $method,
            'callback' => $callback,
            'permission_callback' => 'kotoiq_seo_auth',
        ]);
    }
});

// ─── Auto-ping on post publish ────────────────────────────────────────────
add_action('publish_post', function ($post_id) {
    if (!koto_is_module_enabled('seo')) return;
    $api_key    = get_option('koto_api_key') ?: get_option(KOTOIQ_OPT_API_KEY);
    $agency_url = get_option('koto_agency_url');
    if (!$api_key || !$agency_url) return;
    wp_remote_post(trailingslashit($agency_url) . 'api/seo/wp-ping', [
        'headers'  => [
            'Content-Type'  => 'application/json',
            'X-Koto-Key'    => $api_key,
            'Authorization' => "Bearer $api_key",
        ],
        'body'     => wp_json_encode([
            'event'    => 'post_published',
            'post_id'  => $post_id,
            'site_url' => get_site_url(),
        ]),
        'timeout'  => 5,
        'blocking' => false,
    ]);
}, 10, 1);

// ─── REST callbacks ───────────────────────────────────────────────────────

function kotoiq_seo_agency_test() {
    global $wpdb;
    $post_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM $wpdb->posts WHERE post_status='publish' AND post_type='post'");
    $page_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM $wpdb->posts WHERE post_status='publish' AND post_type='page'");
    $yoast      = defined('WPSEO_VERSION') ? WPSEO_VERSION : null;
    $rankmath   = defined('RANK_MATH_VERSION') ? RANK_MATH_VERSION : null;

    // Determine which SEO engine is active
    $seo_engine = 'kotoiq'; // KotoIQ is the default
    if ($yoast)    $seo_engine = 'yoast';    // Yoast overrides if present
    if ($rankmath) $seo_engine = 'rankmath';  // Rank Math overrides if present

    update_option('koto_last_sync', current_time('mysql'));
    return rest_ensure_response([
        'status'           => 'connected',
        'site_url'         => get_site_url(),
        'site_name'        => get_bloginfo('name'),
        'tagline'          => get_bloginfo('description'),
        'wp_version'       => get_bloginfo('version'),
        'php_version'      => PHP_VERSION,
        'plugin_version'   => KOTOIQ_VERSION,
        'plugin'           => 'kotoiq',
        'posts_count'      => $post_count,
        'pages_count'      => $page_count,
        'yoast_version'    => $yoast,
        'rankmath_version' => $rankmath,
        'seo_plugin'       => $seo_engine,
        'seo_engine'       => $seo_engine,
        'gsc_connected'    => !empty(get_option('gsc_property_url', null)),
        'client_id'        => get_option('koto_client_id', null),
        'last_sync'        => get_option('koto_last_sync'),
        'active_plugins'   => array_values(array_map('dirname', get_option('active_plugins', []))),
        'theme'            => get_template(),
        'admin_email'      => get_option('admin_email'),
        'timezone'         => get_option('timezone_string') ?: get_option('gmt_offset'),
    ]);
}

function kotoiq_seo_pages($request) {
    $posts = get_posts([
        'post_type'      => ['post', 'page'],
        'post_status'    => 'publish',
        'posts_per_page' => 200,
        'orderby'        => 'modified',
        'order'          => 'DESC',
    ]);
    $result = [];
    foreach ($posts as $p) {
        $seo = kotoiq_seo_get_seo_meta($p->ID);
        $result[] = [
            'id'           => $p->ID,
            'title'        => $p->post_title,
            'url'          => get_permalink($p->ID),
            'slug'         => $p->post_name,
            'type'         => $p->post_type,
            'modified'     => $p->post_modified,
            'word_count'   => str_word_count(wp_strip_all_tags($p->post_content)),
            'seo_title'    => $seo['seo_title'],
            'meta_desc'    => $seo['meta_description'],
            'focus_kw'     => $seo['focus_keyword'],
            'has_seo_meta' => !empty($seo['meta_description']),
        ];
    }
    return rest_ensure_response(['pages' => $result, 'total' => count($result), 'retrieved_at' => current_time('c')]);
}

function kotoiq_seo_generate_batch($request) {
    $params   = $request->get_json_params();
    $pages    = $params['pages']    ?? [];
    $template = $params['template'] ?? '';
    $schema   = $params['schema']   ?? 'LocalBusiness';
    $aeo      = $params['aeo']      ?? false;
    $status   = $params['status']   ?? 'draft';

    if (empty($pages)) return new WP_REST_Response(['error' => 'No pages provided'], 400);

    $created = [];
    $errors  = [];
    foreach ($pages as $page) {
        $city    = sanitize_text_field($page['city'] ?? '');
        $state   = sanitize_text_field($page['state'] ?? '');
        $keyword = sanitize_text_field($page['keyword'] ?? '');
        $content = str_replace(['%city%', '%state%', '%keyword%', '%s'], [$city, $state, $keyword, $city], $template);

        if ($aeo) {
            $content .= "\n\n<!-- KotoIQ Schema -->\n<script type=\"application/ld+json\">" . wp_json_encode([
                '@context' => 'https://schema.org',
                '@type'    => $schema,
                'name'     => get_bloginfo('name'),
                'areaServed' => ['@type' => 'City', 'name' => $city],
            ]) . "</script>";
        }

        $title = str_replace(['%city%', '%state%', '%keyword%', '%s'], [$city, $state, $keyword, $city], $keyword ?: "$city $state Services");
        $post_id = wp_insert_post([
            'post_title'   => $title,
            'post_content' => $content,
            'post_status'  => $status,
            'post_type'    => 'page',
            'post_name'    => sanitize_title("$keyword-$city-$state"),
        ], true);

        if (is_wp_error($post_id)) {
            $errors[] = ['city' => $city, 'error' => $post_id->get_error_message()];
        } else {
            // Set KotoIQ SEO meta
            $meta_desc = "$keyword in $city, $state - " . get_bloginfo('name');
            kotoiq_seo_set_seo_meta($post_id, [
                'seo_title'        => $title,
                'meta_description' => $meta_desc,
                'focus_keyword'    => $keyword ?: "$city $state",
            ]);
            $created[] = ['id' => $post_id, 'city' => $city, 'url' => get_permalink($post_id), 'title' => $title];
        }
    }

    $shaped = array_map(function ($p) use ($status, $template) {
        return [
            'post_id'    => $p['id'],
            'title'      => $p['title'],
            'location'   => $p['city'],
            'url'        => $p['url'],
            'slug'       => sanitize_title($p['title']),
            'status'     => $status,
            'word_count' => str_word_count(strip_tags($template)),
            'seo_score'  => null,
        ];
    }, $created);

    update_option('koto_last_sync', current_time('mysql'));
    return rest_ensure_response([
        'success'       => count($errors) === 0,
        'pages'         => $shaped,
        'created'       => $created,
        'errors'        => $errors,
        'created_count' => count($created),
        'error_count'   => count($errors),
        'generated'     => count($created),
        'generated_at'  => current_time('c'),
    ]);
}

function kotoiq_seo_gsc_overview() {
    return rest_ensure_response([
        'available'    => false,
        'note'         => 'GSC data is synced through the KotoIQ platform. Connect Google Search Console in KotoIQ → Connect APIs.',
        'retrieved_at' => current_time('c'),
    ]);
}

function kotoiq_seo_blog_generate($request) {
    $params  = $request->get_json_params();
    $title   = sanitize_text_field($params['title']            ?? '');
    $content = wp_kses_post($params['content']                 ?? '');
    $meta    = sanitize_text_field($params['meta_description'] ?? '');
    $keyword = sanitize_text_field($params['focus_keyword']    ?? '');
    $status  = sanitize_text_field($params['status']           ?? 'draft');
    $tags    = array_map('sanitize_text_field', $params['tags'] ?? []);

    if (empty($title) || empty($content)) return new WP_REST_Response(['error' => 'title and content are required'], 400);

    $tag_ids = [];
    foreach ($tags as $tag) {
        $term = wp_insert_term($tag, 'post_tag');
        $tag_ids[] = is_wp_error($term) ? ($term->error_data['term_exists'] ?? null) : ($term['term_id'] ?? null);
    }
    $tag_ids = array_values(array_filter($tag_ids));

    $post_id = wp_insert_post([
        'post_title'   => $title,
        'post_content' => $content,
        'post_status'  => $status,
        'post_type'    => 'post',
        'tags_input'   => $tag_ids,
        'post_name'    => sanitize_title($title),
    ], true);
    if (is_wp_error($post_id)) return new WP_REST_Response(['error' => $post_id->get_error_message()], 500);

    // Set KotoIQ SEO meta
    kotoiq_seo_set_seo_meta($post_id, [
        'seo_title'        => $title,
        'meta_description' => $meta,
        'focus_keyword'    => $keyword,
    ]);

    update_option('koto_last_sync', current_time('mysql'));
    return rest_ensure_response([
        'success'      => true,
        'post_id'      => $post_id,
        'url'          => get_permalink($post_id),
        'title'        => $title,
        'status'       => $status,
        'generated_at' => current_time('c'),
    ]);
}

function kotoiq_seo_automation_run($request) {
    $params    = $request->get_json_params();
    $run_types = $params['run_types'] ?? ['sitemap', 'ping'];
    $results   = [];
    if (in_array('sitemap', $run_types, true)) $results['sitemap'] = kotoiq_seo_rebuild_sitemap_impl();
    if (in_array('ping',    $run_types, true)) $results['ping']    = kotoiq_seo_ping_engines();
    update_option('koto_last_automation', current_time('mysql'));
    return rest_ensure_response(['success' => true, 'results' => $results, 'ran_at' => current_time('c')]);
}

function kotoiq_seo_sitemap_rebuild() {
    return rest_ensure_response(kotoiq_seo_rebuild_sitemap_impl());
}

function kotoiq_seo_rankings() {
    return rest_ensure_response([
        'note'         => 'Rankings are tracked by the KotoIQ platform. Connect GSC in KotoIQ → Connect APIs.',
        'retrieved_at' => current_time('c'),
    ]);
}

// ─── SEO meta helpers — KotoIQ-native with legacy fallback ───────────────

function kotoiq_seo_set_seo_meta($post_id, $data) {
    $title    = $data['seo_title']        ?? '';
    $meta_desc = $data['meta_description'] ?? '';
    $focus_kw  = $data['focus_keyword']    ?? '';

    // Always write to KotoIQ's own fields
    if ($title)     update_post_meta($post_id, '_kotoiq_title',         $title);
    if ($meta_desc) update_post_meta($post_id, '_kotoiq_description',   $meta_desc);
    if ($focus_kw)  update_post_meta($post_id, '_kotoiq_focus_keyword', $focus_kw);

    // Also write to Yoast/Rank Math fields if they're active (for compatibility)
    if (defined('WPSEO_VERSION')) {
        if ($meta_desc) update_post_meta($post_id, '_yoast_wpseo_metadesc', $meta_desc);
        if ($focus_kw)  update_post_meta($post_id, '_yoast_wpseo_focuskw',  $focus_kw);
        if ($title)     update_post_meta($post_id, '_yoast_wpseo_title',    $title);
    }
    if (defined('RANK_MATH_VERSION')) {
        if ($meta_desc) update_post_meta($post_id, 'rank_math_description',   $meta_desc);
        if ($focus_kw)  update_post_meta($post_id, 'rank_math_focus_keyword', $focus_kw);
        if ($title)     update_post_meta($post_id, 'rank_math_title',         $title);
    }
}

function kotoiq_seo_get_seo_meta($post_id) {
    // KotoIQ's own fields first
    $kiq_title = get_post_meta($post_id, '_kotoiq_title',         true);
    $kiq_desc  = get_post_meta($post_id, '_kotoiq_description',   true);
    $kiq_kw    = get_post_meta($post_id, '_kotoiq_focus_keyword', true);

    // Fallback to Yoast/Rank Math if KotoIQ fields are empty (migration support)
    if (!$kiq_title) $kiq_title = get_post_meta($post_id, '_yoast_wpseo_title', true)
                               ?: get_post_meta($post_id, 'rank_math_title', true);
    if (!$kiq_desc)  $kiq_desc  = get_post_meta($post_id, '_yoast_wpseo_metadesc', true)
                               ?: get_post_meta($post_id, 'rank_math_description', true);
    if (!$kiq_kw)    $kiq_kw    = get_post_meta($post_id, '_yoast_wpseo_focuskw', true)
                               ?: get_post_meta($post_id, 'rank_math_focus_keyword', true);

    return [
        'seo_title'        => $kiq_title ?: '',
        'meta_description' => $kiq_desc  ?: '',
        'focus_keyword'    => $kiq_kw    ?: '',
    ];
}

// ─── Sitemap rebuild — native + fallback to SEO plugins ──────────────────

function kotoiq_seo_rebuild_sitemap_impl() {
    $pinged = false;

    // Try Yoast/Rank Math sitemaps first if they're active
    if (defined('WPSEO_VERSION')) {
        do_action('wpseo_rebuild_sitemap', true);
        $pinged = true;
    }
    if (defined('RANK_MATH_VERSION') && class_exists('RankMath\\Sitemap\\Sitemap')) {
        do_action('rank_math/sitemap/hit_index');
        $pinged = true;
    }

    // If no SEO plugin sitemap, use WordPress core sitemap (WP 5.5+)
    if (!$pinged) {
        // WordPress core generates sitemaps at /wp-sitemap.xml automatically
        // We just need to ping search engines
        $pinged = true;
    }

    $ping = kotoiq_seo_ping_engines();
    return ['success' => true, 'method' => 'kotoiq', 'ping' => $ping, 'time' => current_time('c')];
}

function kotoiq_seo_ping_engines() {
    $sitemap = get_site_url() . '/wp-sitemap.xml';
    // Also check for plugin-generated sitemaps
    if (defined('WPSEO_VERSION'))      $sitemap = get_site_url() . '/sitemap_index.xml';
    if (defined('RANK_MATH_VERSION'))  $sitemap = get_site_url() . '/sitemap_index.xml';

    $results = [];
    foreach (['google' => 'https://www.google.com/ping?sitemap=', 'bing' => 'https://www.bing.com/ping?sitemap='] as $name => $base) {
        $r = wp_remote_get($base . urlencode($sitemap), ['timeout' => 8]);
        $results[$name] = is_wp_error($r) ? 'error' : wp_remote_retrieve_response_code($r);
    }
    return ['success' => true, 'results' => $results, 'sitemap' => $sitemap];
}

// ─── Locations ────────────────────────────────────────────────────────────

function kotoiq_seo_locations_states() {
    return rest_ensure_response(['states' => [
        'AL'=>'Alabama','AK'=>'Alaska','AZ'=>'Arizona','AR'=>'Arkansas','CA'=>'California',
        'CO'=>'Colorado','CT'=>'Connecticut','DE'=>'Delaware','FL'=>'Florida','GA'=>'Georgia',
        'HI'=>'Hawaii','ID'=>'Idaho','IL'=>'Illinois','IN'=>'Indiana','IA'=>'Iowa',
        'KS'=>'Kansas','KY'=>'Kentucky','LA'=>'Louisiana','ME'=>'Maine','MD'=>'Maryland',
        'MA'=>'Massachusetts','MI'=>'Michigan','MN'=>'Minnesota','MS'=>'Mississippi','MO'=>'Missouri',
        'MT'=>'Montana','NE'=>'Nebraska','NV'=>'Nevada','NH'=>'New Hampshire','NJ'=>'New Jersey',
        'NM'=>'New Mexico','NY'=>'New York','NC'=>'North Carolina','ND'=>'North Dakota','OH'=>'Ohio',
        'OK'=>'Oklahoma','OR'=>'Oregon','PA'=>'Pennsylvania','RI'=>'Rhode Island','SC'=>'South Carolina',
        'SD'=>'South Dakota','TN'=>'Tennessee','TX'=>'Texas','UT'=>'Utah','VT'=>'Vermont',
        'VA'=>'Virginia','WA'=>'Washington','WV'=>'West Virginia','WI'=>'Wisconsin','WY'=>'Wyoming',
        'DC'=>'Washington D.C.',
    ]]);
}

function kotoiq_seo_locations_cities($request) {
    $state  = strtolower($request->get_param('state') ?? '');
    $county = $request->get_param('county') ?? '';
    if (!$state) return new WP_REST_Response(['error' => 'state parameter required'], 400);

    $agency_url = get_option('koto_agency_url', 'https://hellokoto.com');
    $geo_url    = trailingslashit($agency_url) . "geo/{$state}.json";
    $response   = wp_remote_get($geo_url, ['timeout' => 8]);

    if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
        $body = json_decode(wp_remote_retrieve_body($response), true);
        $cities = $body['cities'] ?? [];
        if ($county) {
            $cities = array_values(array_filter($cities, function ($c) use ($county) {
                return strcasecmp($c['c'] ?? '', $county) === 0;
            }));
        }
        $normalized = array_map(function ($c) use ($state) {
            return [
                'id'         => sanitize_title(($c['n'] ?? '') . '-' . strtolower($state)),
                'city'       => $c['n']   ?? '',
                'state'      => strtoupper($state),
                'county'     => $c['c']   ?? '',
                'zip'        => $c['z'][0] ?? '',
                'lat'        => $c['lat'] ?? null,
                'lng'        => $c['lng'] ?? null,
                'population' => null,
            ];
        }, $cities);
        return rest_ensure_response([
            'locations' => $normalized,
            'cities'    => $normalized,
            'state'     => strtoupper($state),
            'total'     => count($normalized),
        ]);
    }

    return rest_ensure_response([
        'locations' => [],
        'cities'    => [],
        'state'     => strtoupper($state),
        'total'     => 0,
        'note'      => 'Could not fetch geo data. Verify agency URL is set in plugin settings.',
    ]);
}

// ─── Content management ───────────────────────────────────────────────────

function kotoiq_seo_content_list($request) {
    $type  = sanitize_text_field($request->get_param('type') ?? 'page');
    $posts = get_posts([
        'post_type'      => in_array($type, ['page', 'post'], true) ? $type : 'page',
        'post_status'    => ['publish', 'draft', 'pending'],
        'posts_per_page' => 200,
        'orderby'        => 'modified',
        'order'          => 'DESC',
    ]);
    $result = [];
    foreach ($posts as $p) {
        $seo = kotoiq_seo_get_seo_meta($p->ID);
        $result[] = [
            'post_id'         => $p->ID,
            'title'           => $p->post_title,
            'slug'            => $p->post_name,
            'url'             => get_permalink($p->ID),
            'status'          => $p->post_status,
            'post_type'       => $p->post_type,
            'modified'        => $p->post_modified,
            'word_count'      => str_word_count(wp_strip_all_tags($p->post_content)),
            'meta_description'=> $seo['meta_description'],
            'focus_keyword'   => $seo['focus_keyword'],
            'has_seo_meta'    => !empty($seo['meta_description']),
            'excerpt'         => wp_trim_words(wp_strip_all_tags($p->post_content), 20),
        ];
    }
    return rest_ensure_response(['posts' => $result, 'total' => count($result)]);
}

function kotoiq_seo_content_get($request) {
    $post_id = (int) $request->get_param('id');
    $post    = get_post($post_id);
    if (!$post) return new WP_REST_Response(['error' => 'Post not found'], 404);

    $seo = kotoiq_seo_get_seo_meta($post_id);
    return rest_ensure_response([
        'post_id'         => $post->ID,
        'title'           => $post->post_title,
        'content'         => $post->post_content,
        'content_html'    => apply_filters('the_content', $post->post_content),
        'slug'            => $post->post_name,
        'url'             => get_permalink($post_id),
        'status'          => $post->post_status,
        'post_type'       => $post->post_type,
        'modified'        => $post->post_modified,
        'word_count'      => str_word_count(wp_strip_all_tags($post->post_content)),
        'meta_description'=> $seo['meta_description'],
        'focus_keyword'   => $seo['focus_keyword'],
        'seo_title'       => $seo['seo_title'],
    ]);
}

function kotoiq_seo_content_create($request) {
    $params = $request->get_json_params();
    $post_id = wp_insert_post([
        'post_title'   => sanitize_text_field($params['title'] ?? ''),
        'post_content' => wp_kses_post($params['content'] ?? ''),
        'post_status'  => sanitize_text_field($params['status'] ?? 'draft'),
        'post_type'    => in_array($params['type'] ?? 'page', ['page', 'post'], true) ? $params['type'] : 'page',
        'post_name'    => sanitize_title($params['slug'] ?? $params['title'] ?? ''),
    ], true);
    if (is_wp_error($post_id)) return new WP_REST_Response(['error' => $post_id->get_error_message()], 500);
    kotoiq_seo_set_seo_meta($post_id, $params);
    return rest_ensure_response(['success' => true, 'post_id' => $post_id, 'url' => get_permalink($post_id)]);
}

function kotoiq_seo_content_update($request) {
    $post_id = (int) $request->get_param('id');
    $params  = $request->get_json_params();
    $update  = ['ID' => $post_id];
    if (isset($params['title']))   $update['post_title']   = sanitize_text_field($params['title']);
    if (isset($params['content'])) $update['post_content'] = wp_kses_post($params['content']);
    if (isset($params['status']))  $update['post_status']  = sanitize_text_field($params['status']);
    if (isset($params['slug']))    $update['post_name']    = sanitize_title($params['slug']);
    $result = wp_update_post($update, true);
    if (is_wp_error($result)) return new WP_REST_Response(['error' => $result->get_error_message()], 500);
    kotoiq_seo_set_seo_meta($post_id, $params);
    return rest_ensure_response(['success' => true, 'post_id' => $post_id, 'url' => get_permalink($post_id)]);
}

function kotoiq_seo_content_delete($request) {
    $post_id = (int) $request->get_param('id');
    $result = wp_delete_post($post_id, true);
    return rest_ensure_response(['success' => (bool) $result, 'post_id' => $post_id]);
}

function kotoiq_seo_content_ai_generate($request) {
    return new WP_REST_Response(['error' => 'AI generation runs on the KotoIQ platform, not the plugin. Use PageIQ Writer in KotoIQ.'], 400);
}

function kotoiq_seo_styles() {
    $theme_dir = get_template_directory();
    $theme_url = get_template_directory_uri();
    $stylesheets = [];
    foreach (glob($theme_dir . '/*.css') as $css) {
        $stylesheets[] = $theme_url . '/' . basename($css);
    }
    return rest_ensure_response([
        'theme'       => get_template(),
        'theme_name'  => wp_get_theme()->get('Name'),
        'stylesheets' => $stylesheets,
        'site_url'    => get_site_url(),
    ]);
}
