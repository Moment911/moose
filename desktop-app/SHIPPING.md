# Shipping KotoIQ Desktop Binaries

This document explains how KotoIQ desktop releases flow from your machine to
customers' computers. It covers the manifest, the build script, signing TODOs,
and rollback.

## The Shape of a Release

Every release is a single `manifest.json` file in Vercel Blob at the well-known
key `kotoiq-downloads/latest/manifest.json`, plus one artifact per platform
stored alongside it. The manifest looks like:

```json
{
  "version": "1.0.0",
  "released_at": "2026-04-16T12:00:00Z",
  "platforms": {
    "macos_arm":        { "url": "https://...dmg",      "size_mb": 10.2, "sha256": "...", "filename": "KotoIQ.dmg" },
    "macos_intel":      { "url": "https://...dmg",      "size_mb": 10.4, "sha256": "...", "filename": "KotoIQ.dmg" },
    "windows":          { "url": "https://...exe",      "size_mb": 8.1,  "sha256": "...", "filename": "KotoIQ-setup.exe" },
    "linux_deb":        { "url": "https://....deb",     "size_mb": 12.0, "sha256": "...", "filename": "kotoiq.deb" },
    "linux_appimage":   { "url": "https://....AppImage","size_mb": 15.2, "sha256": "...", "filename": "KotoIQ.AppImage" },
    "chrome-extension": { "url": "https://....zip",     "size_mb": 0.02, "sha256": "...", "filename": "chrome-extension.zip" }
  }
}
```

`src/app/api/desktop/manifest/route.ts` reads this file server-side using
`BLOB_READ_WRITE_TOKEN` and returns a **URL-stripped** public version
(`{ available, filename, size_mb, sha256 }` per platform) — the raw Blob
URLs never reach the client. The per-platform route
`src/app/api/desktop/download/[platform]/route.ts` resolves the private
URL server-side, fetches the blob with the token, and streams the bytes
back to the browser with a `Content-Disposition: attachment` header.

### Privacy Model

All artifacts are stored as private — downloads are only reachable through
the API route, which holds the read-write token. The `/api/desktop/manifest`
response intentionally omits every `url` field so the browser cannot ever
bypass the proxy.

**SDK quirk:** `@vercel/blob` v1.1.1 still requires `access: 'public'` at the
`put()` call site (the SDK throws otherwise) and has no signed-URL helper.
We compensate by treating the returned URL as a secret — never exposing it
client-side, and fetching it server-side with `Authorization: Bearer
${BLOB_READ_WRITE_TOKEN}`. When the SDK ships private access + signed URLs
(roadmap item), swap the proxy stream in `download/[platform]/route.ts`
for a short-lived signed URL and re-enable the 302 redirect.

Missing platforms in the manifest → the route returns 404 with "This platform
is not yet available — join the waitlist at /downloads."

## Cutting a Release

From the repo root:

```bash
# All platforms (the common case)
node scripts/build-desktop.mjs --all

# Just one platform
node scripts/build-desktop.mjs --platform=macos_arm

# Re-upload without rebuilding (e.g., after signing out-of-band)
node scripts/build-desktop.mjs --platform=macos_arm --skip-build

# Dry-run — no uploads, just prints what it would do
node scripts/build-desktop.mjs --all --dry-run
```

The script:

1. Reads the current version from `desktop-app/package.json`.
2. Runs `npm run build:<target>` inside `desktop-app/` for each requested
   platform (unless `--skip-build`).
3. Finds the resulting artifact in `desktop-app/src-tauri/target/<triple>/release/bundle/`.
4. Computes size + SHA-256.
5. Uploads to Vercel Blob at `kotoiq-downloads/latest/<version>/<filename>`
   with `access: 'public'` (SDK-enforced — see Privacy Model above) and
   `allowOverwrite: true`. The resulting URL is treated as a secret and only
   referenced by server-side routes holding the read-write token.
6. Loads the existing manifest (if any), merges the new entries in, bumps
   `released_at`, and re-uploads the manifest.

Without `BLOB_READ_WRITE_TOKEN`, the script runs as a dry-run and only logs
what it *would* upload. This lets you test the pipeline before Blob is
provisioned.

## Environment Variables

Required for real uploads:

- `BLOB_READ_WRITE_TOKEN` — Vercel Blob token. Get this by creating a Blob
  store from the Vercel dashboard (Storage → Create → Blob), then copying the
  token into your shell or `.env.local`.

Required for signing (Phase 2 — **not yet wired**):

- `APPLE_CERTIFICATE` — Developer ID Application certificate (base64 .p12)
- `APPLE_CERTIFICATE_PASSWORD` — unlock password for the .p12
- `APPLE_SIGNING_IDENTITY` — e.g. `"Developer ID Application: Koto, Inc. (TEAMID)"`
- `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` — for `xcrun notarytool`
- `WINDOWS_CERTIFICATE` — Authenticode .pfx (base64)
- `WINDOWS_CERTIFICATE_PASSWORD` — unlock password

When those are in place, set them before running the build and Tauri will
sign + notarize automatically (via `tauri.conf.json` → `bundle.macOS.signingIdentity`
and `bundle.windows.certificateThumbprint`).

## What Builds Today

| Platform           | Buildable on macOS host today? | Notes |
|--------------------|--------------------------------|-------|
| `macos_arm`        | Yes (once Rust is installed)   | Needs `rustup target add aarch64-apple-darwin` |
| `macos_intel`      | Yes (once Rust is installed)   | Needs `rustup target add x86_64-apple-darwin` |
| `windows`          | No                             | Requires Windows host or GitHub Actions `windows-latest` |
| `linux_deb`        | No                             | Tauri's .deb bundler shells out to `dpkg-deb` + needs glibc/gtk headers. Cross-compile from macOS is a rabbit hole — use a Linux host, a Docker image like `tauri-apps/tauri:2-ubuntu-22.04`, or GitHub Actions `ubuntu-latest`. |
| `linux_appimage`   | No                             | Same reason as `.deb`. |
| `chrome-extension` | Yes (zero dependencies)        | Just zips `chrome-extension/`. Works anywhere. |

**Right now, Rust is not installed on this machine**, so the only artifact the
script can actually produce is `chrome-extension.zip`. To enable Tauri builds:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

## Recommended: GitHub Actions for Cross-Platform

For a real release pipeline, use a GitHub Actions workflow with a matrix over
`macos-latest`, `windows-latest`, `ubuntu-latest`. Each runner builds its
native target, uploads the artifact to Blob, and the final job merges the
manifest. See `tauri-apps/tauri-action` for the canonical template.

## Rollback

To roll back a bad release:

1. **Fast path (same version):** Find the previous artifact in the Blob
   dashboard at `kotoiq-downloads/latest/<previous-version>/`, copy its URL,
   and paste it into the `platforms` block of the manifest. Re-upload the
   manifest.
2. **Full rollback:** Delete `kotoiq-downloads/latest/manifest.json` from the
   Blob dashboard and re-upload an older manifest (keep a local copy of
   `desktop-app/dist/manifest.json` from the previous release).

The `/api/desktop/manifest` endpoint has a 60-second CDN cache, so rollbacks
propagate within a minute.

## Tauri Auto-Updater (Deferred)

`tauri.conf.json` already lists `https://hellokoto.com/api/desktop/update/{{target}}/{{current_version}}`
as the updater endpoint. Implementing that route is a separate phase —
it serves a signed manifest the Tauri runtime polls. See the Tauri docs
for the exact JSON shape.

## Blob Paths (for reference)

- Manifest:   `kotoiq-downloads/latest/manifest.json`
- Artifacts:  `kotoiq-downloads/latest/<version>/<filename>`

Artifacts are versioned so old downloads keep working if they happen to
resolve the URL before the manifest flips.
