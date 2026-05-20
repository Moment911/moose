<?php
/**
 * SEO Module — lifted from the standalone Koto SEO 2.0.0 plugin.
 *
 * Brings SEO endpoints under the KotoIQ module-loader contract. Same surface
 * the Koto agency platform (hellokoto.com) already calls, with the addition
 * of the kotoiq/v1 namespace alongside the existing koto/v1 + hlseo/v1
 * back-compat routes.
 *
 * What it does:
 *   • /agency/test — connection diagnostics + site inventory
 *   • /pages — list published pages with Yoast/Rank Math meta
 *   • /generate/batch — create city/location landing pages
 *   • /gsc/overview — GSC connection status
 *   • /blog/generate — publish AI-written blog posts
 *   • /automation/run-now — sitemap rebuild + search-engine ping
 *   • /sitemap/rebuild — rebuild sitemap + ping
 *   • /rankings — placeholder (rankings live on the Koto platform)
 *   • /locations/states + /locations/cities — geo helpers
 *   • /content/{list,get,create,update,delete,ai-generate}
 *   • /styles — site stylesheet/font/palette inventory for live preview
 *   • Auto-ping on publish_post → fires to {agency_url}/api/seo/wp-ping
 *
 * Auth: kotoiq_perm_write (Bearer + remote_allowed + host pin) OR a
 * legacy koto_api_key match — so sites that were paired with the
 * standalone Koto SEO 2.0.0 plugin keep working without re-pairing.
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

koto_register_module([
    'slug'        => 'seo',
    'name'        => 'SEO & Page Factory',
    'description' => 'Yoast/Rank Math integration, page sync, batch landing-page generation, blog publishing, sitemap rebuild, GSC overview, auto-ping on publish.',
    'version'     => '2.0.0',
]);

/**
 * Auth callback specific to the SEO module's koto/v1 + hlseo/v1 routes.
 *
 * Accepts EITHER the unified KotoIQ API key (wpsc_api_key, same as every
 * other module) OR the legacy koto_api_key — so a WordPress site that was
 * already paired with the standalone Koto SEO 2.0.0 plugin keeps working
 * after the KotoIQ swap without re-pairing.
 *
 * Local manage_options users always pass (matches kotoiq_perm_*).
 */
function kotoiq_seo_auth($request) {
    if (current_user_can('manage_options')) return true;

    // Try the new unified auth path first (Bearer + remote_allowed + host pin).
    $unified = kotoiq_check_admin_or_remote('write');
    if ($unified === true) return true;

    // Fallback: legacy koto_api_key match. Lets pre-migration koto-seo
    // pairings keep working until they're switched to the unified key.
    $legacy_key = get_option('koto_api_key', '');
    if ($legacy_key === '') return $unified; // no fallback available

    $auth = $request->get_header('Authorization') ?: $request->get_header('X-KOTO-Key') ?: $request->get_header('X-Koto-Key');
    $auth = trim(str_replace(['Bearer ', 'bearer '], '', (string) $auth));
    if ($auth !== '' && hash_equals($legacy_key, $auth)) return true;

    return $unified;
}

add_action('rest_api_init', function () {
    if (!koto_is_module_enabled('seo')) return;

    // koto/v1 + hlseo/v1 routes — what the existing Koto agency platform
    // calls. Registered with kotoiq_seo_auth so legacy koto_api_key pairings
    // keep working. kotoiq/v1 + wpsimplecode/v1 mirrors use the standard
    // kotoiq_perm_write.
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
        // Primary namespaces (KotoIQ-paired) + legacy koto/v1 (existing Koto SEO 2.0.0 callers).
        kotoiq_register_rest_route($path, $args);
        register_rest_route('koto/v1',  $path, $args);
    }

    // hlseo/v1 — even older callers. Only the agency-test surface, mapped
    // to a few aliases the legacy plugin exposed.
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
    $gsc_property = get_option('wpseo_ms', [])['siteurl'] ?? get_option('gsc_property_url', null);

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
        'seo_plugin'       => $yoast ? 'yoast' : ($rankmath ? 'rankmath' : 'none'),
        'gsc_connected'    => !empty($gsc_property),
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
        $yoast_title = get_post_meta($p->ID, '_yoast_wpseo_title', true);
        $yoast_desc  = get_post_meta($p->ID, '_yoast_wpseo_metadesc', true);
        $rm_title    = get_post_meta($p->ID, 'rank_math_title', true);
        $rm_desc     = get_post_meta($p->ID, 'rank_math_description', true);
        $focus_kw    = get_post_meta($p->ID, '_yoast_wpseo_focuskw', true) ?: get_post_meta($p->ID, 'rank_math_focus_keyword', true);
        $result[] = [
            'id'           => $p->ID,
            'title'        => $p->post_title,
            'url'          => get_permalink($p->ID),
            'slug'         => $p->post_name,
            'type'         => $p->post_type,
            'modified'     => $p->post_modified,
            'word_count'   => str_word_count(wp_strip_all_tags($p->post_content)),
            'seo_title'    => $yoast_title ?: $rm_title ?: '',
            'meta_desc'    => $yoast_desc  ?: $rm_desc  ?: '',
            'focus_kw'     => $focus_kw    ?: '',
            'has_seo_meta' => !empty($yoast_desc) || !empty($rm_desc),
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
            $content .= "\n\n<!-- AEO Schema -->\n<script type=\"application/ld+json\">" . wp_json_encode([
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

        if (is_wp_error($post_id)) $errors[] = ['city' => $city, 'error' => $post_id->get_error_message()];
        else $created[] = ['id' => $post_id, 'city' => $city, 'url' => get_permalink($post_id), 'title' => $title];
    }

    // Normalize to format expected by the Koto WP Control Center.
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
    $gsc = [
        'available'    => false,
        'note'         => 'Connect Google Search Console via Yoast SEO, Rank Math, or Google Site Kit to see data here.',
        'retrieved_at' => current_time('c'),
    ];
    if (class_exists('RankMath\\Google\\Api'))                  { $gsc['available'] = true; $gsc['source'] = 'rankmath'; }
    if (defined('WPSEO_VERSION') && get_option('wpseo_ms'))     { $gsc['available'] = true; $gsc['source'] = 'yoast';    }
    return rest_ensure_response($gsc);
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

    if ($meta) {
        if (defined('WPSEO_VERSION'))      update_post_meta($post_id, '_yoast_wpseo_metadesc', $meta);
        if (defined('RANK_MATH_VERSION'))  update_post_meta($post_id, 'rank_math_description', $meta);
    }
    if ($keyword) {
        if (defined('WPSEO_VERSION'))      update_post_meta($post_id, '_yoast_wpseo_focuskw', $keyword);
        if (defined('RANK_MATH_VERSION'))  update_post_meta($post_id, 'rank_math_focus_keyword', $keyword);
    }

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
    if (in_array('sitemap', $run_types, true)) $results['sitemap'] = kotoiq_seo_rebuild_sitemap();
    if (in_array('ping',    $run_types, true)) $results['ping']    = kotoiq_seo_ping_engines();
    update_option('koto_last_automation', current_time('mysql'));
    return rest_ensure_response(['success' => true, 'results' => $results, 'ran_at' => current_time('c')]);
}

function kotoiq_seo_sitemap_rebuild() {
    return rest_ensure_response(kotoiq_seo_rebuild_sitemap());
}

function kotoiq_seo_rankings() {
    return rest_ensure_response([
        'note'         => 'Rankings are tracked by the Koto platform. Connect GSC for keyword data.',
        'retrieved_at' => current_time('c'),
    ]);
}

// ─── Helpers (sitemap, ping, SEO meta) ────────────────────────────────────

function kotoiq_seo_rebuild_sitemap() {
    $pinged = false;
    if (function_exists('wpseo_get_value') || defined('WPSEO_VERSION')) {
        do_action('wpseo_rebuild_sitemap', true);
        $pinged = true;
    }
    if (defined('RANK_MATH_VERSION') && class_exists('RankMath\\Sitemap\\Sitemap')) {
        do_action('rank_math/sitemap/hit_index');
        $pinged = true;
    }
    $ping = kotoiq_seo_ping_engines();
    return ['success' => true, 'method' => $pinged ? 'seo_plugin' : 'native', 'ping' => $ping, 'time' => current_time('c')];
}

function kotoiq_seo_ping_engines() {
    $sitemap = get_site_url() . '/sitemap.xml';
    $results = [];
    foreach (['google' => 'https://www.google.com/ping?sitemap=', 'bing' => 'https://www.bing.com/ping?sitemap='] as $name => $base) {
        $r = wp_remote_get($base . urlencode($sitemap), ['timeout' => 8]);
        $results[$name] = is_wp_error($r) ? 'error' : wp_remote_retrieve_response_code($r);
    }
    return ['success' => true, 'results' => $results, 'sitemap' => $sitemap];
}

function kotoiq_seo_set_seo_meta($post_id, $data) {
    $meta_desc = $data['meta_description'] ?? '';
    $focus_kw  = $data['focus_keyword']    ?? '';
    if (defined('WPSEO_VERSION')) {
        if ($meta_desc) update_post_meta($post_id, '_yoast_wpseo_metadesc', $meta_desc);
        if ($focus_kw)  update_post_meta($post_id, '_yoast_wpseo_focuskw',  $focus_kw);
    }
    if (defined('RANK_MATH_VERSION')) {
        if ($meta_desc) update_post_meta($post_id, 'rank_math_description',   $meta_desc);
        if ($focus_kw)  update_post_meta($post_id, 'rank_math_focus_keyword', $focus_kw);
    }
}

function kotoiq_seo_get_seo_meta($post_id) {
    $yoast_desc = get_post_meta($post_id, '_yoast_wpseo_metadesc', true);
    $yoast_kw   = get_post_meta($post_id, '_yoast_wpseo_focuskw',  true);
    $rm_desc    = get_post_meta($post_id, 'rank_math_description',   true);
    $rm_kw      = get_post_meta($post_id, 'rank_math_focus_keyword', true);
    return [
        'meta_description' => $yoast_desc ?: $rm_desc ?: '',
        'focus_keyword'    => $yoast_kw   ?: $rm_kw   ?: '',
    ];
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
        'note'      => 'Could not fetch geo data from Koto. Verify agency URL is set in plugin settings.',
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
        'featured_image'  => get_the_post_thumbnail_url($post_id, 'large') ?: null,
    ]);
}

function kotoiq_seo_content_create($request) {
    $params  = $request->get_json_params();
    $title   = sanitize_text_field($params['title']     ?? '');
    $content = wp_kses_post($params['content']          ?? '');
    $type    = sanitize_text_field($params['post_type'] ?? 'page');
    $status  = sanitize_text_field($params['status']    ?? 'draft');
    $slug    = sanitize_title($params['slug'] ?? $title);

    if (!$title) return new WP_REST_Response(['error' => 'title required'], 400);

    $post_id = wp_insert_post([
        'post_title'   => $title,
        'post_content' => $content,
        'post_status'  => in_array($status, ['publish', 'draft', 'pending'], true) ? $status : 'draft',
        'post_type'    => in_array($type, ['page', 'post'], true) ? $type : 'page',
        'post_name'    => $slug,
    ], true);
    if (is_wp_error($post_id)) return new WP_REST_Response(['error' => $post_id->get_error_message()], 500);

    kotoiq_seo_set_seo_meta($post_id, $params);
    return rest_ensure_response([
        'success'    => true,
        'post_id'    => $post_id,
        'url'        => get_permalink($post_id),
        'slug'       => get_post_field('post_name', $post_id),
        'status'     => $status,
        'created_at' => current_time('c'),
    ]);
}

function kotoiq_seo_content_update($request) {
    $post_id = (int) $request->get_param('id');
    $params  = $request->get_json_params();
    if (!get_post($post_id)) return new WP_REST_Response(['error' => 'Post not found'], 404);

    $update = ['ID' => $post_id];
    if (isset($params['title']))   $update['post_title']   = sanitize_text_field($params['title']);
    if (isset($params['content'])) $update['post_content'] = wp_kses_post($params['content']);
    if (isset($params['status']))  $update['post_status']  = sanitize_text_field($params['status']);
    if (isset($params['slug']))    $update['post_name']    = sanitize_title($params['slug']);

    $result = wp_update_post($update, true);
    if (is_wp_error($result)) return new WP_REST_Response(['error' => $result->get_error_message()], 500);

    kotoiq_seo_set_seo_meta($post_id, $params);
    return rest_ensure_response([
        'success'    => true,
        'post_id'    => $post_id,
        'url'        => get_permalink($post_id),
        'slug'       => get_post_field('post_name', $post_id),
        'updated_at' => current_time('c'),
    ]);
}

function kotoiq_seo_content_delete($request) {
    $post_id = (int) $request->get_param('id');
    $result  = wp_delete_post($post_id, true); // force = skip trash
    return rest_ensure_response(['success' => (bool) $result, 'post_id' => $post_id]);
}

function kotoiq_seo_content_ai_generate($request) {
    // The Koto platform does the AI generation and POSTs the result here to save.
    $params  = $request->get_json_params();
    $title   = sanitize_text_field($params['title']     ?? '');
    $content = wp_kses_post($params['content']          ?? '');
    $type    = sanitize_text_field($params['post_type'] ?? 'page');
    $status  = sanitize_text_field($params['status']    ?? 'draft');

    if (!$title || !$content) return new WP_REST_Response(['error' => 'title and content required'], 400);

    $post_id = wp_insert_post([
        'post_title'   => $title,
        'post_content' => $content,
        'post_status'  => $status,
        'post_type'    => $type,
        'post_name'    => sanitize_title($params['slug'] ?? $title),
    ], true);
    if (is_wp_error($post_id)) return new WP_REST_Response(['error' => $post_id->get_error_message()], 500);

    kotoiq_seo_set_seo_meta($post_id, $params);
    return rest_ensure_response([
        'success' => true,
        'post_id' => $post_id,
        'url'     => get_permalink($post_id),
        'slug'    => get_post_field('post_name', $post_id),
        'status'  => $status,
    ]);
}

function kotoiq_seo_styles($request) {
    global $wp_styles;
    $theme_dir  = get_stylesheet_directory_uri();
    $theme_css  = $theme_dir . '/style.css';
    $custom_css = wp_get_custom_css();

    $stylesheets = [];
    if (is_a($wp_styles, 'WP_Styles')) {
        foreach ($wp_styles->done as $handle) {
            if (isset($wp_styles->registered[$handle])) {
                $src = $wp_styles->registered[$handle]->src;
                if ($src && strpos($src, 'http') === 0)        $stylesheets[] = $src;
                elseif ($src)                                  $stylesheets[] = site_url($src);
            }
        }
    }

    $theme_json_file = get_stylesheet_directory() . '/theme.json';
    $theme_palette   = [];
    if (file_exists($theme_json_file)) {
        $theme_json    = json_decode(file_get_contents($theme_json_file), true);
        $theme_palette = $theme_json['settings']['color']['palette'] ?? [];
    }

    $google_fonts = array_filter($stylesheets, function ($s) { return strpos($s, 'fonts.googleapis.com') !== false; });

    return rest_ensure_response([
        'theme_name'     => get_template(),
        'stylesheet_uri' => $theme_css,
        'stylesheets'    => array_values(array_unique($stylesheets)),
        'google_fonts'   => array_values($google_fonts),
        'custom_css'     => $custom_css ?: '',
        'site_url'       => get_site_url(),
        'theme_palette'  => $theme_palette,
        'body_classes'   => implode(' ', get_body_class()),
    ]);
}
