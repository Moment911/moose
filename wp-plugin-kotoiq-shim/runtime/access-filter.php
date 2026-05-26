<?php
/**
 * Runtime — access policy filter.
 *
 * Reads a policy structure from a single wp_option (kotoiq_shim_access_policy)
 * and applies deny rules to the WP `user_has_cap` filter at every cap check.
 *
 * Policy shape (dashboard-authored, written via option.update):
 *   { "denies": [ { "role_slug": "editor", "cap": "delete_published_posts" }, ... ] }
 *
 * Malformed or missing policy = pass-through (no rules applied). This is a
 * generic primitive — the plugin source reveals that "we read a policy
 * structure from an option and selectively deny caps". The policy contents
 * live in the option, written by the dashboard.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

if (!defined('KOTOIQ_SHIM_OPT_ACCESS_POLICY')) define('KOTOIQ_SHIM_OPT_ACCESS_POLICY', 'kotoiq_shim_access_policy');

add_filter('user_has_cap', function ($allcaps, $caps, $args, $user) {
    $policy = get_option(KOTOIQ_SHIM_OPT_ACCESS_POLICY, []);
    if (!is_array($policy) || empty($policy['denies']) || !is_array($policy['denies'])) return $allcaps;
    if (!is_object($user) || empty($user->ID)) return $allcaps;
    $user_roles = isset($user->roles) && is_array($user->roles) ? $user->roles : [];
    foreach ($policy['denies'] as $deny) {
        if (!is_array($deny)) continue;
        $r = isset($deny['role_slug']) ? (string) $deny['role_slug'] : '';
        $c = isset($deny['cap']) ? (string) $deny['cap'] : '';
        if ($r === '' || $c === '' || !in_array($r, $user_roles, true)) continue;
        foreach ((array) $caps as $needed) if ((string) $needed === $c) $allcaps[$c] = false;
    }
    return $allcaps;
}, 10, 4);
