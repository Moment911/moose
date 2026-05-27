import { NextResponse } from 'next/server'

/**
 * @deprecated Phase 10 Plan 12 — v3 sunset.
 *
 * Legacy WPSimpleCode self-update manifest — now returns a SUNSET NOTICE.
 *
 * GET /api/wpsc-manifest
 *
 * Per CONTEXT.md D-Cutover-side-by-side (USER-LOCKED): after the 60-day
 * v4-promoted overlap window, the entire v3-era plugin family (WPSimpleCode
 * 1.x + KotoIQ 2.x + KotoIQ 3.x) is deactivated fleet-wide
 * (scripts/cutover/sunset-v3.cjs). This endpoint stays live indefinitely
 * so any legacy site that somehow still polls for updates sees a clear
 * "no upgrade available" deprecation signal.
 *
 * Successor manifest: /api/kotoiq-shim-manifest (v4 thin shim).
 *
 * See:
 *   .planning/phases/10-kotoiq-wp-plugin-thin-shim-pivot-move-all-business-logic-out/SUNSET-PLAYBOOK.md
 *   src/app/api/kotoiq-shim-manifest/route.ts (the successor)
 */

const SUNSET_MANIFEST = {
  plugin: 'wpsimplecode',
  deprecated: true,
  sunset_date: '2026-07-26',
  successor_manifest: '/api/kotoiq-shim-manifest',
  message:
    'The WPSimpleCode / KotoIQ v2.x / KotoIQ v3.x self-update channel has been ' +
    'sunset. Legacy plugins do not receive further updates. Migrate to ' +
    'kotoiq-shim v4 — see /api/kotoiq-shim-manifest for the successor manifest.',
}

export async function GET() {
  return NextResponse.json(SUNSET_MANIFEST, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
