import { NextResponse } from 'next/server'

/**
 * @deprecated Phase 10 Plan 12 — v3 sunset.
 *
 * KotoIQ v3 self-update manifest — now returns a SUNSET NOTICE.
 *
 * GET /api/kotoiq-manifest
 *
 * Per CONTEXT.md D-Cutover-side-by-side (USER-LOCKED): after the 60-day
 * v4-promoted overlap window, the v3 plugin is deactivated fleet-wide
 * (scripts/cutover/sunset-v3.cjs). This endpoint stays live indefinitely
 * so any v3 site that somehow still polls for updates sees a clear
 * "no upgrade available" deprecation signal rather than a stale version
 * number that could trigger a downgrade or accidental reinstall.
 *
 * Successor manifest: /api/kotoiq-shim-manifest (v4 thin shim).
 *
 * The deprecated:true payload + HTTP 200 + Cache-Control: no-store is the
 * intended shape: v3 plugin self-update.php aborts cleanly when
 * `latest_version` is absent / unparseable, so the absence of
 * version + download_url + sha256 fields is what makes this a graceful
 * deprecation rather than a "broken manifest" error in v3's logs.
 *
 * See:
 *   .planning/phases/10-kotoiq-wp-plugin-thin-shim-pivot-move-all-business-logic-out/SUNSET-PLAYBOOK.md
 *   src/app/api/kotoiq-shim-manifest/route.ts (the successor)
 */

const SUNSET_MANIFEST = {
  plugin: 'kotoiq',
  deprecated: true,
  // Sunset date: 60 days after the first pilot site is v4-promoted (per Plan
  // 10-11 cutover playbook). Operators update this string when the pilot
  // promotion is confirmed.
  sunset_date: '2026-07-26',
  successor_manifest: '/api/kotoiq-shim-manifest',
  message:
    'The KotoIQ v3 self-update channel has been sunset. v3 plugins do not ' +
    'receive further updates. Migrate to kotoiq-shim v4 — see ' +
    '/api/kotoiq-shim-manifest for the successor manifest.',
}

export async function GET() {
  return NextResponse.json(SUNSET_MANIFEST, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
