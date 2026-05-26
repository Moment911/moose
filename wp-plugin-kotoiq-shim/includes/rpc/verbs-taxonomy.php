<?php
/**
 * Verb handlers — taxonomy.* group.
 *
 * Provides:
 *   - kotoiq_shim_verb_taxonomy_list — registered-taxonomy enumeration
 *
 * Thin convenience verb. Downstream callers may also use /wp/v2/taxonomies
 * via wpFetch; this is kept for completeness so dashboard code paths can
 * stay verb-only when desired.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

function kotoiq_shim_verb_taxonomy_list($args) {
    unset($args);
    $merged = array_merge((array) get_taxonomies(['public' => true], 'objects'), (array) get_taxonomies(['public' => false], 'objects'));
    $out = []; $seen = [];
    foreach ($merged as $tax) {
        if (!is_object($tax) || !isset($tax->name)) continue;
        $slug = (string) $tax->name;
        if (isset($seen[$slug])) continue;
        $seen[$slug] = true;
        $label = '';
        if (isset($tax->label)) $label = (string) $tax->label;
        elseif (isset($tax->labels) && is_object($tax->labels) && isset($tax->labels->name)) $label = (string) $tax->labels->name;
        $out[] = [
            'slug'         => $slug,
            'label'        => $label,
            'public'       => isset($tax->public) ? (bool) $tax->public : false,
            'hierarchical' => isset($tax->hierarchical) ? (bool) $tax->hierarchical : false,
            'rest_base'    => isset($tax->rest_base) && is_string($tax->rest_base) ? $tax->rest_base : '',
        ];
    }
    return rest_ensure_response(['taxonomies' => $out]);
}
