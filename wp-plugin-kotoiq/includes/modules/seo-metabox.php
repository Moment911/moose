<?php
/**
 * SEO Meta Box — Rank Math-style editor panel on every post/page.
 *
 * Adds:
 *   - Meta box in the post editor with SEO title, description, focus keyword
 *   - Live character counters and Google SERP preview
 *   - SEO score indicator in the admin columns
 *   - Saves to _kotoiq_title, _kotoiq_description, _kotoiq_focus_keyword
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

// ── Register meta box on all public post types ──────────────────────────
add_action('add_meta_boxes', function () {
    if (!koto_is_module_enabled('seo')) return;
    $post_types = get_post_types(['public' => true], 'names');
    foreach ($post_types as $pt) {
        add_meta_box(
            'kotoiq_seo_metabox',
            'KotoIQ SEO',
            'kotoiq_seo_metabox_render',
            $pt,
            'normal',
            'high'
        );
    }
});

function kotoiq_seo_metabox_render($post) {
    wp_nonce_field('kotoiq_seo_save', 'kotoiq_seo_nonce');

    $seo_title = get_post_meta($post->ID, '_kotoiq_title', true);
    $meta_desc = get_post_meta($post->ID, '_kotoiq_description', true);
    $focus_kw  = get_post_meta($post->ID, '_kotoiq_focus_keyword', true);
    $permalink = get_permalink($post->ID);
    $site_name = get_bloginfo('name');

    // Fall back to Yoast/Rank Math data for migration
    if (!$seo_title) $seo_title = get_post_meta($post->ID, '_yoast_wpseo_title', true) ?: get_post_meta($post->ID, 'rank_math_title', true);
    if (!$meta_desc) $meta_desc = get_post_meta($post->ID, '_yoast_wpseo_metadesc', true) ?: get_post_meta($post->ID, 'rank_math_description', true);
    if (!$focus_kw)  $focus_kw  = get_post_meta($post->ID, '_yoast_wpseo_focuskw', true) ?: get_post_meta($post->ID, 'rank_math_focus_keyword', true);

    $C = [
        'navy' => '#201b51', 'pink' => '#cb1c6b', 'cream' => '#faf9f6',
        'border' => '#e8e5df', 'muted' => '#6b6789', 'green' => '#16a34a',
        'amber' => '#f59e0b', 'red' => '#dc2626',
    ];
    ?>
    <style>
        #kotoiq_seo_metabox .inside { padding: 0 !important; margin: 0 !important; }
        .kiq-seo-wrap { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; background: <?php echo $C['cream']; ?>; padding: 20px; }
        .kiq-seo-field { margin-bottom: 16px; }
        .kiq-seo-label { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: <?php echo $C['navy']; ?>; }
        .kiq-seo-counter { font-size: 11px; font-weight: 500; font-family: 'JetBrains Mono', monospace; }
        .kiq-seo-input { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid <?php echo $C['border']; ?>; font-size: 14px; font-family: inherit; color: <?php echo $C['navy']; ?>; background: #fff; box-sizing: border-box; outline: none; transition: border-color 0.15s; }
        .kiq-seo-input:focus { border-color: <?php echo $C['pink']; ?>; }
        .kiq-seo-textarea { resize: vertical; min-height: 72px; line-height: 1.5; }
        .kiq-seo-hint { font-size: 12px; color: <?php echo $C['muted']; ?>; margin-top: 4px; }
        .kiq-seo-preview { background: #fff; border: 1px solid <?php echo $C['border']; ?>; border-radius: 10px; padding: 16px; margin-top: 16px; }
        .kiq-seo-preview-label { font-size: 11px; font-weight: 600; color: <?php echo $C['muted']; ?>; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
        .kiq-seo-preview-title { font-size: 18px; color: #1a0dab; font-family: Arial, sans-serif; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .kiq-seo-preview-url { font-size: 13px; color: #006621; font-family: Arial, sans-serif; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .kiq-seo-preview-desc { font-size: 13px; color: #545454; font-family: Arial, sans-serif; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .kiq-seo-score { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 50px; font-size: 13px; font-weight: 700; }
        .kiq-seo-tabs { display: flex; gap: 0; border-bottom: 1px solid <?php echo $C['border']; ?>; margin-bottom: 16px; background: #fff; margin: -20px -20px 20px; padding: 0 20px; }
        .kiq-seo-tab { padding: 12px 18px; font-size: 13px; font-weight: 600; color: <?php echo $C['muted']; ?>; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit; }
        .kiq-seo-tab.active { color: <?php echo $C['pink']; ?>; border-bottom-color: <?php echo $C['pink']; ?>; }
        .kiq-seo-tab:hover { color: <?php echo $C['navy']; ?>; }
        .kiq-seo-checklist { list-style: none; padding: 0; margin: 0; }
        .kiq-seo-checklist li { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; font-size: 13px; color: <?php echo $C['navy']; ?>; }
        .kiq-seo-check-pass { color: <?php echo $C['green']; ?>; }
        .kiq-seo-check-fail { color: <?php echo $C['red']; ?>; }
        .kiq-seo-check-warn { color: <?php echo $C['amber']; ?>; }
    </style>

    <div class="kiq-seo-wrap">
        <!-- Tabs -->
        <div class="kiq-seo-tabs">
            <button type="button" class="kiq-seo-tab active" onclick="kiqSeoTab(this,'general')">General</button>
            <button type="button" class="kiq-seo-tab" onclick="kiqSeoTab(this,'advanced')">Advanced</button>
            <button type="button" class="kiq-seo-tab" onclick="kiqSeoTab(this,'schema')">Schema</button>
        </div>

        <!-- General Tab -->
        <div id="kiq-tab-general">
            <!-- Focus Keyword -->
            <div class="kiq-seo-field">
                <div class="kiq-seo-label">
                    Focus Keyword
                    <span class="kiq-seo-counter" id="kiq-kw-counter"><?php echo strlen($focus_kw); ?> chars</span>
                </div>
                <input type="text" name="kotoiq_focus_keyword" class="kiq-seo-input"
                    value="<?php echo esc_attr($focus_kw); ?>"
                    placeholder="e.g. plumber fort lauderdale"
                    oninput="kiqSeoUpdate()" />
                <div class="kiq-seo-hint">The keyword you want this page to rank for in Google and AI answer engines.</div>
            </div>

            <!-- SEO Title -->
            <div class="kiq-seo-field">
                <div class="kiq-seo-label">
                    SEO Title
                    <span class="kiq-seo-counter" id="kiq-title-counter"><?php echo strlen($seo_title); ?>/60</span>
                </div>
                <input type="text" name="kotoiq_seo_title" class="kiq-seo-input"
                    value="<?php echo esc_attr($seo_title); ?>"
                    placeholder="<?php echo esc_attr($post->post_title . ' - ' . $site_name); ?>"
                    oninput="kiqSeoUpdate()" />
                <div class="kiq-seo-hint">Appears as the clickable headline in Google results. 50-60 characters is ideal.</div>
            </div>

            <!-- Meta Description -->
            <div class="kiq-seo-field">
                <div class="kiq-seo-label">
                    Meta Description
                    <span class="kiq-seo-counter" id="kiq-desc-counter"><?php echo strlen($meta_desc); ?>/160</span>
                </div>
                <textarea name="kotoiq_meta_description" class="kiq-seo-input kiq-seo-textarea"
                    placeholder="Write a compelling description that makes people want to click..."
                    oninput="kiqSeoUpdate()"><?php echo esc_textarea($meta_desc); ?></textarea>
                <div class="kiq-seo-hint">Shows below the title in search results. 120-160 characters. Include your focus keyword.</div>
            </div>

            <!-- Google Preview -->
            <div class="kiq-seo-preview">
                <div class="kiq-seo-preview-label">Google Search Preview</div>
                <div class="kiq-seo-preview-title" id="kiq-preview-title"><?php echo esc_html($seo_title ?: $post->post_title); ?></div>
                <div class="kiq-seo-preview-url"><?php echo esc_html($permalink); ?></div>
                <div class="kiq-seo-preview-desc" id="kiq-preview-desc"><?php echo esc_html($meta_desc ?: 'No description set. Google will pull text from the page.'); ?></div>
            </div>

            <!-- SEO Checklist -->
            <div style="margin-top: 20px;">
                <div class="kiq-seo-preview-label">SEO Checklist</div>
                <ul class="kiq-seo-checklist" id="kiq-checklist"></ul>
            </div>
        </div>

        <!-- Advanced Tab -->
        <div id="kiq-tab-advanced" style="display:none;">
            <div class="kiq-seo-field">
                <div class="kiq-seo-label">Canonical URL</div>
                <input type="text" name="kotoiq_canonical" class="kiq-seo-input"
                    value="<?php echo esc_attr(get_post_meta($post->ID, '_kotoiq_canonical', true)); ?>"
                    placeholder="<?php echo esc_attr($permalink); ?>" />
                <div class="kiq-seo-hint">Override the canonical URL. Leave blank to use the default permalink.</div>
            </div>
            <div class="kiq-seo-field">
                <div class="kiq-seo-label">Robots Meta</div>
                <select name="kotoiq_robots" class="kiq-seo-input" style="cursor:pointer;">
                    <?php
                    $robots = get_post_meta($post->ID, '_kotoiq_robots', true) ?: 'index,follow';
                    $opts = ['index,follow' => 'Index, Follow (default)', 'noindex,follow' => 'No Index, Follow', 'index,nofollow' => 'Index, No Follow', 'noindex,nofollow' => 'No Index, No Follow'];
                    foreach ($opts as $val => $label) {
                        echo '<option value="' . esc_attr($val) . '"' . selected($robots, $val, false) . '>' . esc_html($label) . '</option>';
                    }
                    ?>
                </select>
                <div class="kiq-seo-hint">Controls whether search engines index this page and follow its links.</div>
            </div>
        </div>

        <!-- Schema Tab -->
        <div id="kiq-tab-schema" style="display:none;">
            <div class="kiq-seo-field">
                <div class="kiq-seo-label">Schema Type</div>
                <select name="kotoiq_schema_type" class="kiq-seo-input" style="cursor:pointer;">
                    <?php
                    $schema_type = get_post_meta($post->ID, '_kotoiq_schema_type', true) ?: 'WebPage';
                    $schemas = ['WebPage','Article','BlogPosting','FAQPage','LocalBusiness','MedicalBusiness','Service','Product','Organization','Person','Event','HowTo','Recipe'];
                    foreach ($schemas as $s) {
                        echo '<option value="' . esc_attr($s) . '"' . selected($schema_type, $s, false) . '>' . esc_html($s) . '</option>';
                    }
                    ?>
                </select>
                <div class="kiq-seo-hint">The schema.org type for this page. Helps Google understand the content.</div>
            </div>
            <div class="kiq-seo-field">
                <div class="kiq-seo-label">Custom Schema JSON-LD</div>
                <textarea name="kotoiq_schema_custom" class="kiq-seo-input kiq-seo-textarea" rows="6"
                    placeholder='{"@type": "FAQPage", ...}'
                    style="font-family: 'JetBrains Mono', monospace; font-size: 12px;"><?php echo esc_textarea(get_post_meta($post->ID, '_kotoiq_schema_custom', true)); ?></textarea>
                <div class="kiq-seo-hint">Paste custom JSON-LD schema. Leave blank to auto-generate from the schema type above.</div>
            </div>
        </div>
    </div>

    <script>
    function kiqSeoTab(btn, tab) {
        document.querySelectorAll('.kiq-seo-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        ['general','advanced','schema'].forEach(t => {
            const el = document.getElementById('kiq-tab-' + t);
            if (el) el.style.display = t === tab ? '' : 'none';
        });
    }

    function kiqSeoUpdate() {
        const title = document.querySelector('[name="kotoiq_seo_title"]').value;
        const desc = document.querySelector('[name="kotoiq_meta_description"]').value;
        const kw = document.querySelector('[name="kotoiq_focus_keyword"]').value;
        const postTitle = <?php echo json_encode($post->post_title); ?>;
        const postContent = <?php echo json_encode(wp_strip_all_tags($post->post_content)); ?>.toLowerCase();
        const postSlug = <?php echo json_encode($post->post_name); ?>;

        // Counters
        const titleLen = title.length;
        const descLen = desc.length;
        document.getElementById('kiq-title-counter').textContent = titleLen + '/60';
        document.getElementById('kiq-title-counter').style.color = titleLen > 60 ? '<?php echo $C['amber']; ?>' : titleLen >= 30 ? '<?php echo $C['green']; ?>' : '<?php echo $C['muted']; ?>';
        document.getElementById('kiq-desc-counter').textContent = descLen + '/160';
        document.getElementById('kiq-desc-counter').style.color = descLen > 160 ? '<?php echo $C['amber']; ?>' : descLen >= 120 ? '<?php echo $C['green']; ?>' : '<?php echo $C['muted']; ?>';
        document.getElementById('kiq-kw-counter').textContent = kw.length + ' chars';

        // Preview
        document.getElementById('kiq-preview-title').textContent = title || postTitle;
        document.getElementById('kiq-preview-desc').textContent = desc || 'No description set. Google will pull text from the page.';

        // Checklist
        const kwLower = kw.toLowerCase();
        const titleLower = (title || postTitle).toLowerCase();
        const descLower = desc.toLowerCase();
        const checks = [];

        if (kw) {
            checks.push([titleLower.includes(kwLower), 'Focus keyword in SEO title', 'Add "' + kw + '" to your title']);
            checks.push([descLower.includes(kwLower), 'Focus keyword in meta description', 'Include "' + kw + '" in description']);
            checks.push([postSlug.toLowerCase().includes(kwLower.replace(/\s+/g,'-')), 'Focus keyword in URL', 'Include keyword in the slug']);
            checks.push([postContent.slice(0,200).includes(kwLower), 'Keyword at beginning of content', 'Mention keyword in first paragraph']);
            checks.push([postContent.includes(kwLower), 'Keyword found in content', 'Add keyword naturally to the text']);
        } else {
            checks.push([false, 'Set a focus keyword', 'Enter the keyword you want to rank for']);
        }
        checks.push([titleLen >= 30 && titleLen <= 60, 'SEO title length (' + titleLen + '/60)', titleLen < 30 ? 'Too short' : 'Too long']);
        checks.push([descLen >= 120 && descLen <= 160, 'Meta description length (' + descLen + '/160)', descLen < 120 ? 'Too short' : 'Too long']);

        const html = checks.map(function(c) {
            const icon = c[0] ? '<span class="kiq-seo-check-pass">&#10003;</span>' : '<span class="kiq-seo-check-fail">&#10007;</span>';
            return '<li>' + icon + ' <span>' + c[1] + (c[0] ? '' : ' — ' + c[2]) + '</span></li>';
        }).join('');
        document.getElementById('kiq-checklist').innerHTML = html;
    }

    // Run on load
    document.addEventListener('DOMContentLoaded', kiqSeoUpdate);
    </script>
    <?php
}

// ── Save meta box data ──────────────────────────────────────────────────
add_action('save_post', function ($post_id) {
    if (!isset($_POST['kotoiq_seo_nonce']) || !wp_verify_nonce($_POST['kotoiq_seo_nonce'], 'kotoiq_seo_save')) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (!current_user_can('edit_post', $post_id)) return;

    $fields = [
        'kotoiq_seo_title'        => '_kotoiq_title',
        'kotoiq_meta_description' => '_kotoiq_description',
        'kotoiq_focus_keyword'    => '_kotoiq_focus_keyword',
        'kotoiq_canonical'        => '_kotoiq_canonical',
        'kotoiq_robots'           => '_kotoiq_robots',
        'kotoiq_schema_type'      => '_kotoiq_schema_type',
        'kotoiq_schema_custom'    => '_kotoiq_schema_custom',
    ];

    foreach ($fields as $post_key => $meta_key) {
        if (isset($_POST[$post_key])) {
            $value = $post_key === 'kotoiq_schema_custom'
                ? wp_unslash($_POST[$post_key])  // Allow JSON
                : sanitize_text_field(wp_unslash($_POST[$post_key]));
            update_post_meta($post_id, $meta_key, $value);
        }
    }

    // Also write to Yoast/Rank Math fields for compatibility
    if (function_exists('kotoiq_seo_set_seo_meta')) {
        kotoiq_seo_set_seo_meta($post_id, [
            'seo_title'        => sanitize_text_field(wp_unslash($_POST['kotoiq_seo_title'] ?? '')),
            'meta_description' => sanitize_text_field(wp_unslash($_POST['kotoiq_meta_description'] ?? '')),
            'focus_keyword'    => sanitize_text_field(wp_unslash($_POST['kotoiq_focus_keyword'] ?? '')),
        ]);
    }
}, 10, 1);

// ── Output robots meta tag ──────────────────────────────────────────────
add_action('wp_head', function () {
    if (!koto_is_module_enabled('seo')) return;
    if (defined('WPSEO_VERSION') || defined('RANK_MATH_VERSION')) return;

    $post_id = get_queried_object_id();
    if (!$post_id) return;

    $robots = get_post_meta($post_id, '_kotoiq_robots', true);
    if ($robots && $robots !== 'index,follow') {
        echo '<meta name="robots" content="' . esc_attr($robots) . '" />' . "\n";
    }

    // Auto-generate schema from type
    $schema_custom = get_post_meta($post_id, '_kotoiq_schema_custom', true);
    $schema_type   = get_post_meta($post_id, '_kotoiq_schema_type', true) ?: 'WebPage';

    if ($schema_custom) {
        echo '<script type="application/ld+json">' . $schema_custom . '</script>' . "\n";
    } elseif ($schema_type) {
        $schema = [
            '@context' => 'https://schema.org',
            '@type'    => $schema_type,
            'name'     => get_the_title($post_id),
            'url'      => get_permalink($post_id),
        ];
        $desc = get_post_meta($post_id, '_kotoiq_description', true);
        if ($desc) $schema['description'] = $desc;
        $thumb = get_the_post_thumbnail_url($post_id, 'large');
        if ($thumb) $schema['image'] = $thumb;
        echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_SLASHES) . '</script>' . "\n";
    }
}, 2);

// ── Admin columns — show SEO score in posts/pages list ──────────────────
add_filter('manage_posts_columns', 'kotoiq_seo_admin_columns');
add_filter('manage_pages_columns', 'kotoiq_seo_admin_columns');
function kotoiq_seo_admin_columns($columns) {
    if (!koto_is_module_enabled('seo')) return $columns;
    $columns['kotoiq_seo'] = 'SEO';
    return $columns;
}

add_action('manage_posts_custom_column', 'kotoiq_seo_admin_column_content', 10, 2);
add_action('manage_pages_custom_column', 'kotoiq_seo_admin_column_content', 10, 2);
function kotoiq_seo_admin_column_content($column, $post_id) {
    if ($column !== 'kotoiq_seo') return;

    $title = get_post_meta($post_id, '_kotoiq_title', true);
    $desc  = get_post_meta($post_id, '_kotoiq_description', true);
    $kw    = get_post_meta($post_id, '_kotoiq_focus_keyword', true);

    $checks = 0;
    $total  = 3;
    if ($kw)    $checks++;
    if ($title) $checks++;
    if ($desc)  $checks++;

    $score = round(($checks / $total) * 100);
    $color = $score >= 80 ? '#16a34a' : ($score >= 40 ? '#f59e0b' : '#dc2626');

    echo '<div style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;background:' . $color . '15;color:' . $color . ';font-size:12px;font-weight:700;">';
    echo $score . '/100';
    echo '</div>';
    if (!$kw) echo '<div style="font-size:11px;color:#9ca3af;margin-top:2px;">No keyword</div>';
}
