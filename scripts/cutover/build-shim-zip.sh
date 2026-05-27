#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Phase 10 Plan 11 — build-shim-zip.sh
#
# Build a distributable zip of the KotoIQ Shim (v4) WP plugin, compute its
# sha256, and print the values + upload + env-var setup instructions.
#
# This is the FIRST step of the cutover playbook. The resulting zip is what
# the shim's self-update endpoint (includes/self-update.php) installs after
# verifying the sha256 against the dashboard manifest (/api/kotoiq-shim-manifest).
#
# Distribution: per CONTEXT.md D-Plugin-distribution (USER-LOCKED), self-hosted
# only — uploaded to https://hellokoto.com/downloads/kotoiq-shim-<version>.zip.
# This script does NOT upload (uploads use existing infra); it just prepares
# the artifact + prints the exact CLI calls the operator needs to run.
#
# Usage:
#   bash scripts/cutover/build-shim-zip.sh
#   bash scripts/cutover/build-shim-zip.sh --no-upload-instructions  # CI mode
#
# Exit codes:
#   0 — zip built, sha256 printed
#   1 — version parse failed / zip command missing / source dir missing
#
# Zero external deps (bash + zip + shasum/sha256sum + grep + awk).
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PRINT_INSTRUCTIONS=true
for arg in "$@"; do
  case "$arg" in
    --no-upload-instructions) PRINT_INSTRUCTIONS=false ;;
    --help|-h)
      echo "Usage: bash scripts/cutover/build-shim-zip.sh [--no-upload-instructions]"
      exit 0
      ;;
  esac
done

# ─── locate repo root + plugin dir ──────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLUGIN_DIR="$REPO_ROOT/wp-plugin-kotoiq-shim"
BUILD_DIR="$REPO_ROOT/build"

if [[ ! -d "$PLUGIN_DIR" ]]; then
  echo "[build-shim-zip] ERROR: plugin dir not found at $PLUGIN_DIR" >&2
  exit 1
fi

PLUGIN_HEADER="$PLUGIN_DIR/kotoiq-shim.php"
if [[ ! -f "$PLUGIN_HEADER" ]]; then
  echo "[build-shim-zip] ERROR: plugin header not found at $PLUGIN_HEADER" >&2
  exit 1
fi

# ─── parse Version: from plugin header ──────────────────────────────────────
# Match " * Version:           4.0.0" → "4.0.0".
VERSION=$(grep -m1 -Eo 'Version:[[:space:]]*[0-9]+(\.[0-9]+)+' "$PLUGIN_HEADER" \
  | awk -F'[[:space:]]+' '{print $NF}')

if [[ -z "${VERSION:-}" ]]; then
  echo "[build-shim-zip] ERROR: failed to parse Version: from $PLUGIN_HEADER" >&2
  exit 1
fi

ZIP_NAME="kotoiq-shim-${VERSION}.zip"
ZIP_PATH="$BUILD_DIR/$ZIP_NAME"

mkdir -p "$BUILD_DIR"
# Idempotent: remove any prior build of this version so we never inherit
# stale files (zip -u would append on top of a previous archive).
rm -f "$ZIP_PATH"

# ─── locate zip binary ──────────────────────────────────────────────────────
if ! command -v zip >/dev/null 2>&1; then
  echo "[build-shim-zip] ERROR: 'zip' command not found in PATH" >&2
  exit 1
fi

# ─── build the zip ──────────────────────────────────────────────────────────
# Run from the plugin dir's PARENT so the archive contains a top-level
# kotoiq-shim/ folder (matches what Plugin_Upgrader::install expects).
# Strip macOS resource forks (.DS_Store, ._*) and dev junk (.git, node_modules).
PARENT_DIR="$(dirname "$PLUGIN_DIR")"
PLUGIN_BASENAME="$(basename "$PLUGIN_DIR")"

pushd "$PARENT_DIR" >/dev/null
zip -rq "$ZIP_PATH" "$PLUGIN_BASENAME" \
  -x "$PLUGIN_BASENAME/.git*" \
  -x "$PLUGIN_BASENAME/.DS_Store" \
  -x "$PLUGIN_BASENAME/**/.DS_Store" \
  -x "$PLUGIN_BASENAME/._*" \
  -x "$PLUGIN_BASENAME/**/._*" \
  -x "$PLUGIN_BASENAME/node_modules/*" \
  -x "$PLUGIN_BASENAME/build/*"
popd >/dev/null

# ─── compute sha256 ─────────────────────────────────────────────────────────
SHA256=""
if command -v shasum >/dev/null 2>&1; then
  SHA256=$(shasum -a 256 "$ZIP_PATH" | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
  SHA256=$(sha256sum "$ZIP_PATH" | awk '{print $1}')
else
  echo "[build-shim-zip] ERROR: neither 'shasum' nor 'sha256sum' available" >&2
  exit 1
fi

ZIP_SIZE_BYTES=$(wc -c < "$ZIP_PATH" | tr -d ' ')

# ─── machine-readable output (always printed first; CI can parse) ──────────
echo ""
echo "version=${VERSION}"
echo "zip_path=${ZIP_PATH}"
echo "sha256=${SHA256}"
echo "size_bytes=${ZIP_SIZE_BYTES}"

# ─── human-readable upload instructions (suppressed with --no-upload-instructions) ─
if [[ "$PRINT_INSTRUCTIONS" == "true" ]]; then
  cat <<EOF

────────────────────────────────────────────────────────────────────────────
Build complete: ${ZIP_NAME} (${ZIP_SIZE_BYTES} bytes)
sha256: ${SHA256}

NEXT STEPS — operator runs these manually (out of script scope):

1. Upload the zip to the download host so the shim's self-update can fetch it:
   scp '${ZIP_PATH}' user@hellokoto.com:/var/www/hellokoto/public/downloads/${ZIP_NAME}
   (or whatever your existing /downloads upload flow uses)

   Verify with: curl -I https://hellokoto.com/downloads/${ZIP_NAME}
   Expected: HTTP/2 200

2. Set the Vercel env vars so /api/kotoiq-shim-manifest returns the right sha256:
   vercel env add KOTOIQ_SHIM_DIST_SHA256 production
   # paste: ${SHA256}
   vercel env add KOTOIQ_SHIM_DIST_SHA256 preview
   vercel env add KOTOIQ_SHIM_DIST_SHA256 development

   vercel env add KOTOIQ_SHIM_DIST_VERSION production
   # paste: ${VERSION}
   vercel env add KOTOIQ_SHIM_DIST_VERSION preview
   vercel env add KOTOIQ_SHIM_DIST_VERSION development

3. Redeploy so the manifest endpoint picks up the new envs:
   vercel --prod

4. Verify the manifest endpoint:
   curl -s https://hellokoto.com/api/kotoiq-shim-manifest | jq
   Expected: { "sha256": "${SHA256}", "version": "${VERSION}", ... }
────────────────────────────────────────────────────────────────────────────
EOF
fi

exit 0
