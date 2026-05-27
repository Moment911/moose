-- 20260527_seed_wpsc_modules_v4_backfill.sql
-- Backfill wpsc_modules for v4-paired sites that paired BEFORE the
-- credentialsVault fix (commit seeding wpsc_modules on every v4 pair).
--
-- Without this, the panels (ContentRotation, ElementorBuilder, SEO,
-- SearchReplace, Access, Snippets) see wpsc_modules=[] and show
-- "module disabled" even though every v4 verb is always available.
--
-- Idempotent: only touches rows where wpsc_modules is empty or null.
-- Keep the slug list in sync with V4_SYNTHETIC_MODULES in
-- src/lib/wp-shim/credentialsVault.ts.
--
-- Apply manually via Supabase SQL Editor.

update koto_wp_sites
set wpsc_modules = '[
    {"slug": "content-rotation",  "name": "Content Rotation",   "enabled": true},
    {"slug": "elementor-builder", "name": "Elementor Builder",  "enabled": true},
    {"slug": "seo",               "name": "SEO",                "enabled": true},
    {"slug": "search-replace",    "name": "Search & Replace",   "enabled": true},
    {"slug": "access",            "name": "Access Management",  "enabled": true},
    {"slug": "snippets",          "name": "Snippets",           "enabled": true}
]'::jsonb
where shim_version = 'v4'
  and (wpsc_modules is null or jsonb_array_length(wpsc_modules) = 0);
