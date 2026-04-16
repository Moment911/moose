#!/usr/bin/env node
/**
 * build-desktop.mjs — Build KotoIQ Tauri artifacts + Chrome extension zip,
 *                     upload to Vercel Blob, and publish an updated manifest.
 *
 * Usage:
 *   node scripts/build-desktop.mjs --all
 *   node scripts/build-desktop.mjs --platform=macos_arm
 *   node scripts/build-desktop.mjs --platform=chrome-extension
 *   node scripts/build-desktop.mjs --all --dry-run
 *   node scripts/build-desktop.mjs --all --skip-build      # upload existing artifacts only
 *
 * Env:
 *   BLOB_READ_WRITE_TOKEN   Required for real uploads. Without it, always dry-runs.
 *
 * Notes:
 *   - Signing is NOT handled here. Build, sign, notarize, then re-run with
 *     --skip-build to upload the signed artifacts.
 *   - Linux builds require a Linux host or Docker/cross — see SHIPPING.md.
 */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile, stat, mkdir, readdir } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWriteStream } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const DESKTOP_APP = path.join(ROOT, 'desktop-app')
const TAURI_BUNDLE = path.join(DESKTOP_APP, 'src-tauri', 'target', 'release', 'bundle')
const CHROME_EXT_SRC = path.join(ROOT, 'chrome-extension')
const DIST_DIR = path.join(DESKTOP_APP, 'dist')
const MANIFEST_PATHNAME = 'kotoiq-downloads/latest/manifest.json'
const BLOB_PREFIX = 'kotoiq-downloads/latest/'

const PLATFORMS = {
  macos_arm: {
    script: 'build:mac-arm',
    bundlePaths: ['aarch64-apple-darwin/release/bundle/dmg'],
    pattern: /\.dmg$/,
    ext: 'dmg',
  },
  macos_intel: {
    script: 'build:mac-intel',
    bundlePaths: ['x86_64-apple-darwin/release/bundle/dmg'],
    pattern: /\.dmg$/,
    ext: 'dmg',
  },
  windows: {
    script: 'build:win',
    bundlePaths: ['x86_64-pc-windows-msvc/release/bundle/nsis', 'x86_64-pc-windows-msvc/release/bundle/msi'],
    pattern: /\.(exe|msi)$/,
    ext: 'exe',
  },
  linux_deb: {
    script: 'build:linux',
    bundlePaths: ['x86_64-unknown-linux-gnu/release/bundle/deb'],
    pattern: /\.deb$/,
    ext: 'deb',
  },
  linux_appimage: {
    script: 'build:linux-appimage',
    bundlePaths: ['x86_64-unknown-linux-gnu/release/bundle/appimage'],
    pattern: /\.AppImage$/,
    ext: 'AppImage',
  },
  'chrome-extension': {
    script: null, // handled separately
    ext: 'zip',
  },
}

// ---------- args ----------
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const val = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`))
  return a ? a.split('=')[1] : null
}

const DRY_RUN = flag('dry-run') || !process.env.BLOB_READ_WRITE_TOKEN
const SKIP_BUILD = flag('skip-build')
const ALL = flag('all')
const ONLY = val('platform')

// ---------- logging ----------
const log = {
  info: (...a) => console.log('\x1b[36m[build-desktop]\x1b[0m', ...a),
  ok: (...a) => console.log('\x1b[32m[build-desktop]\x1b[0m', ...a),
  warn: (...a) => console.log('\x1b[33m[build-desktop]\x1b[0m', ...a),
  err: (...a) => console.log('\x1b[31m[build-desktop]\x1b[0m', ...a),
  dry: (...a) => console.log('\x1b[35m[dry-run]\x1b[0m', ...a),
}

// ---------- helpers ----------
function run(cmd, cmdArgs, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
    p.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${cmdArgs.join(' ')} exited with code ${code}`))
    })
    p.on('error', reject)
  })
}

async function findArtifact(platform) {
  const cfg = PLATFORMS[platform]
  if (!cfg.bundlePaths) return null
  for (const rel of cfg.bundlePaths) {
    const dir = path.join(TAURI_BUNDLE, '..', '..', '..', 'target', path.basename(rel))
    // Tauri actually nests under src-tauri/target/<triple>/release/bundle/<type>
    // We use the pattern rel directly under DESKTOP_APP/src-tauri/target/
    const actualDir = path.join(DESKTOP_APP, 'src-tauri', 'target', rel)
    if (!existsSync(actualDir)) continue
    const entries = await readdir(actualDir)
    const match = entries.find((e) => cfg.pattern.test(e))
    if (match) return path.join(actualDir, match)
  }
  return null
}

async function sha256(filepath) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256')
    const s = createReadStream(filepath)
    s.on('data', (d) => h.update(d))
    s.on('end', () => resolve(h.digest('hex')))
    s.on('error', reject)
  })
}

async function sizeMb(filepath) {
  const s = await stat(filepath)
  const mb = s.size / (1024 * 1024)
  // Use 2 decimals for <1MB, 1 decimal otherwise
  return mb < 1 ? Math.max(Math.round(mb * 100) / 100, 0.01) : Math.round(mb * 10) / 10
}

async function zipChromeExtension() {
  if (!existsSync(CHROME_EXT_SRC)) {
    log.warn(`chrome-extension/ not found at ${CHROME_EXT_SRC} — skipping`)
    return null
  }
  await mkdir(DIST_DIR, { recursive: true })
  const outPath = path.join(DIST_DIR, 'chrome-extension.zip')

  // Use system `zip` (available on macOS + Linux). On Windows CI we'd need PowerShell.
  if (process.platform === 'win32') {
    log.warn('Windows host — using PowerShell Compress-Archive')
    await run(
      'powershell',
      ['-NoProfile', '-Command', `Compress-Archive -Force -Path '${CHROME_EXT_SRC}\\*' -DestinationPath '${outPath}'`],
      ROOT,
    )
  } else {
    // zip from inside the chrome-extension dir so paths are relative
    await run('zip', ['-r', '-q', outPath, '.', '-x', '*.DS_Store', '-x', 'README.md'], CHROME_EXT_SRC)
  }

  log.ok(`Chrome extension zipped → ${outPath}`)
  return outPath
}

async function uploadToBlob(filepath, blobPathname, contentType) {
  if (DRY_RUN) {
    const size = await sizeMb(filepath)
    log.dry(`Would upload ${filepath} (${size} MB) → blob:${blobPathname}`)
    return { url: `https://example.blob.vercel-storage.com/${blobPathname}`, dryRun: true }
  }

  // Dynamic import so the script can run in dry-run without the package
  const { put } = await import('@vercel/blob')
  const buf = await readFile(filepath)
  const result = await put(blobPathname, buf, {
    access: 'public',
    contentType,
    allowOverwrite: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  log.ok(`Uploaded → ${result.url}`)
  return { url: result.url, dryRun: false }
}

function contentTypeFor(platform) {
  switch (platform) {
    case 'macos_arm':
    case 'macos_intel':
      return 'application/x-apple-diskimage'
    case 'windows':
      return 'application/vnd.microsoft.portable-executable'
    case 'linux_deb':
      return 'application/vnd.debian.binary-package'
    case 'linux_appimage':
      return 'application/vnd.appimage'
    case 'chrome-extension':
      return 'application/zip'
    default:
      return 'application/octet-stream'
  }
}

async function buildPlatform(platform) {
  const cfg = PLATFORMS[platform]
  if (!cfg) throw new Error(`Unknown platform: ${platform}`)

  if (platform === 'chrome-extension') {
    return zipChromeExtension()
  }

  if (!SKIP_BUILD) {
    log.info(`Building ${platform} via \`npm run ${cfg.script}\`…`)
    try {
      await run('npm', ['run', cfg.script], DESKTOP_APP)
    } catch (err) {
      log.err(`Build failed for ${platform}: ${err.message}`)
      return null
    }
  } else {
    log.info(`--skip-build set: looking for existing ${platform} artifact…`)
  }

  const artifact = await findArtifact(platform)
  if (!artifact) {
    log.warn(`No artifact found for ${platform} under ${TAURI_BUNDLE}`)
    return null
  }
  log.ok(`Found ${platform} artifact: ${artifact}`)
  return artifact
}

async function readDesktopVersion() {
  const pkg = JSON.parse(await readFile(path.join(DESKTOP_APP, 'package.json'), 'utf8'))
  return pkg.version
}

async function main() {
  const version = await readDesktopVersion()
  log.info(`KotoIQ Desktop v${version}`)
  if (DRY_RUN) log.warn('DRY RUN — no Blob uploads will occur (set BLOB_READ_WRITE_TOKEN to enable)')

  // Determine which platforms to process
  let targets
  if (ALL) {
    targets = Object.keys(PLATFORMS)
  } else if (ONLY) {
    if (!PLATFORMS[ONLY]) {
      log.err(`Unknown platform: ${ONLY}. Valid: ${Object.keys(PLATFORMS).join(', ')}`)
      process.exit(1)
    }
    targets = [ONLY]
  } else {
    log.err('Pass --all or --platform=<name>')
    process.exit(1)
  }

  // Try to load existing manifest so we can merge (preserves platforms we didn't rebuild)
  let manifest = { version, released_at: new Date().toISOString(), platforms: {} }
  if (!DRY_RUN) {
    try {
      const { list } = await import('@vercel/blob')
      const { blobs } = await list({
        prefix: BLOB_PREFIX,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        limit: 100,
      })
      const found = blobs.find((b) => b.pathname === MANIFEST_PATHNAME)
      if (found) {
        const res = await fetch(found.url)
        if (res.ok) {
          const prior = await res.json()
          manifest.platforms = { ...(prior.platforms || {}) }
          log.info('Merged with existing manifest')
        }
      }
    } catch (err) {
      log.warn(`Could not load existing manifest: ${err.message}`)
    }
  }

  // Build + upload each target
  for (const platform of targets) {
    log.info(`── ${platform} ──`)
    const artifact = await buildPlatform(platform)
    if (!artifact) continue

    const filename = path.basename(artifact)
    const blobPathname = `${BLOB_PREFIX}${version}/${filename}`
    const hash = await sha256(artifact)
    const size = await sizeMb(artifact)

    const up = await uploadToBlob(artifact, blobPathname, contentTypeFor(platform))
    manifest.platforms[platform] = {
      url: up.url,
      size_mb: size,
      sha256: hash,
      filename,
    }
  }

  // Write + upload manifest
  manifest.version = version
  manifest.released_at = new Date().toISOString()
  const manifestJson = JSON.stringify(manifest, null, 2)
  await mkdir(DIST_DIR, { recursive: true })
  const localManifestPath = path.join(DIST_DIR, 'manifest.json')
  await writeFile(localManifestPath, manifestJson)
  log.info(`Local manifest written → ${localManifestPath}`)

  if (DRY_RUN) {
    log.dry(`Would upload manifest → blob:${MANIFEST_PATHNAME}`)
  } else {
    const { put } = await import('@vercel/blob')
    const result = await put(MANIFEST_PATHNAME, manifestJson, {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    log.ok(`Manifest uploaded → ${result.url}`)
  }

  // Summary
  log.info('────────────────────────────────────────')
  log.info('Platforms published in manifest:')
  for (const [k, v] of Object.entries(manifest.platforms)) {
    log.info(`  ${k.padEnd(18)} → ${v.url}`)
    log.info(`  ${' '.repeat(18)}   /api/desktop/download/${k}`)
  }
  log.info('────────────────────────────────────────')
  if (DRY_RUN) {
    log.warn('DRY RUN complete. To actually upload, set BLOB_READ_WRITE_TOKEN and re-run.')
  } else {
    log.ok('Release complete.')
  }
}

main().catch((err) => {
  log.err(err?.stack || err?.message || String(err))
  process.exit(1)
})
