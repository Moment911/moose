#!/usr/bin/env node
// scripts/check-env-leaks.mjs
//
// Build-time guard against accidentally shipping secrets to the browser.
//
// Next.js inlines any `process.env.NEXT_PUBLIC_*` reference into the
// client bundle. If a secret-sounding var (service role keys, API
// secrets, private keys) ever gets renamed with a NEXT_PUBLIC_ prefix,
// every visitor to the site would get it. This script runs before
// every build and fails hard if it spots one.
//
// What it checks:
//   1. Env files (.env, .env.local, .env.*) for NEXT_PUBLIC_ vars whose
//      names smell like secrets
//   2. All source files (src/**, app/**) for literal `NEXT_PUBLIC_<secret>`
//      strings — catches typos even when the env file is clean
//   3. Whether any client-bundled file (anything not under src/app/api
//      or src/lib marked 'server-only') references SUPABASE_SERVICE_ROLE_KEY
//
// Run via: npm run check-env-leaks  (also wired into prebuild)

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')

// Patterns that indicate a secret — if any of these appear after NEXT_PUBLIC_
// it's almost certainly a leak. Tuned to be strict but not paranoid (we
// don't flag NEXT_PUBLIC_*_KEY because anon keys legitimately need to be
// public — we only flag the ones that are never supposed to ship).
const SECRET_MARKERS = [
  'SERVICE_ROLE',
  'SERVICE_KEY',
  'PRIVATE_KEY',
  'SECRET',
  'WEBHOOK_SECRET',
  'ACCESS_TOKEN',
  'ADMIN_KEY',
  'ROOT_KEY',
]

// File extensions we actually scan for literal NEXT_PUBLIC_SECRET refs
const SOURCE_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])

// Directories we skip entirely
const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', '.vercel', 'dist', 'build',
  'out', 'coverage', '.turbo', '.obsidian',
])

const errors = []

async function walk(dir, visit) {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) }
  catch { return }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) await walk(full, visit)
    else await visit(full, e)
  }
}

// 1. Scan env files
async function scanEnvFiles() {
  const names = ['.env', '.env.local', '.env.development', '.env.production', '.env.test']
  for (const name of names) {
    const path = join(ROOT, name)
    try { await stat(path) } catch { continue }
    const content = await readFile(path, 'utf8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith('#')) continue
      const match = line.match(/^([A-Z0-9_]+)=/)
      if (!match) continue
      const name = match[1]
      if (!name.startsWith('NEXT_PUBLIC_')) continue
      const rest = name.slice('NEXT_PUBLIC_'.length)
      for (const marker of SECRET_MARKERS) {
        if (rest.includes(marker)) {
          errors.push(
            `${path}:${i + 1} — env var "${name}" has NEXT_PUBLIC_ prefix and ` +
            `looks like a secret (matched "${marker}"). This will ship to every ` +
            `browser that loads the site. Remove the NEXT_PUBLIC_ prefix.`
          )
        }
      }
    }
  }
}

// 2. Scan source files for literal NEXT_PUBLIC_<SECRET> references
//
// Exemptions:
//   - String literals (not process.env dereferences) are allowed. These
//     show up in setup-page tutorials and documentation where we want to
//     *display* the env var name to the user.
//   - Lines with the comment `// env-leak-check: legacy-fallback` are
//     allowed. Use this sparingly for staged migrations where code reads
//     both the new and old env var name so a deploy doesn't break before
//     the Vercel dashboard is updated.
async function scanSources() {
  const re = new RegExp(`NEXT_PUBLIC_[A-Z0-9_]*(${SECRET_MARKERS.join('|')})[A-Z0-9_]*`, 'g')
  const EXEMPT_MARKER = 'env-leak-check: legacy-fallback'

  await walk(join(ROOT, 'src'), async (path) => {
    const ext = path.slice(path.lastIndexOf('.'))
    if (!SOURCE_EXTS.has(ext)) return
    const content = await readFile(path, 'utf8')
    const lines = content.split('\n')
    const matches = [...content.matchAll(re)]
    for (const m of matches) {
      const before = content.slice(0, m.index)
      const lineNum = before.split('\n').length
      const line = lines[lineNum - 1] || ''

      // Exempt if not actually a process.env reference — just a string literal
      // or an object key in documentation/tutorials.
      const isProcessEnv = /process\.env\.[A-Z0-9_]*NEXT_PUBLIC_/.test(line)
      if (!isProcessEnv) continue

      // Exempt if the line or the line above carries the legacy-fallback marker
      const prev = lines[lineNum - 2] || ''
      if (line.includes(EXEMPT_MARKER) || prev.includes(EXEMPT_MARKER)) continue

      errors.push(
        `${relative(ROOT, path)}:${lineNum} — references "${m[0]}" in source code. ` +
        `Any NEXT_PUBLIC_ env var that sounds like a secret will be inlined ` +
        `into the browser bundle at build time. If this is a documented ` +
        `staged migration, add \`// ${EXEMPT_MARKER}\` on the same line.`
      )
    }
  })
}

// 3. Flag client-bundled files that reference SUPABASE_SERVICE_ROLE_KEY
async function scanServiceRoleInClientCode() {
  // Anything under src/app/api is a Route Handler (server-only)
  // Anything under src/lib is library code — it's safe only if none of it
  // is imported from client code. We rely on the lib/supabaseAdmin.ts
  // 'server-only' import added in a separate commit to enforce that at
  // build time. Here we only need to make sure 'use client' files and
  // views/components/hooks don't directly reference the env var.
  const CLIENT_ROOTS = ['src/views', 'src/components', 'src/hooks', 'src/app/App.jsx']
  const target = 'SUPABASE_SERVICE_ROLE_KEY'

  async function scanDir(d) {
    await walk(join(ROOT, d), async (path) => {
      const ext = path.slice(path.lastIndexOf('.'))
      if (!SOURCE_EXTS.has(ext)) return
      const content = await readFile(path, 'utf8')
      if (content.includes(target)) {
        errors.push(
          `${relative(ROOT, path)} — client-side file references ` +
          `SUPABASE_SERVICE_ROLE_KEY. Move this code to a Route Handler ` +
          `under src/app/api/** or import it via src/lib/supabaseAdmin.ts ` +
          `(which is marked 'server-only' and will fail the build if pulled ` +
          `into the client bundle).`
        )
      }
    })
  }
  for (const d of CLIENT_ROOTS) await scanDir(d)

  // Also scan 'use client' files anywhere under src (catches server components
  // that got flipped to client components without someone noticing).
  await walk(join(ROOT, 'src'), async (path) => {
    const ext = path.slice(path.lastIndexOf('.'))
    if (!SOURCE_EXTS.has(ext)) return
    // Skip api routes and lib — those are handled separately
    if (path.includes('/src/app/api/')) return
    if (path.includes('/src/lib/')) return
    const content = await readFile(path, 'utf8')
    const head = content.slice(0, 200)
    if (!/['"]use client['"]/.test(head)) return
    if (content.includes(target)) {
      errors.push(
        `${relative(ROOT, path)} — 'use client' file references ` +
        `SUPABASE_SERVICE_ROLE_KEY. This will not leak the value ` +
        `(Next.js replaces non-NEXT_PUBLIC env with undefined in the ` +
        `client bundle) but the code is broken — remove the reference ` +
        `and call a Route Handler instead.`
      )
    }
  })
}

async function main() {
  await scanEnvFiles()
  await scanSources()
  await scanServiceRoleInClientCode()

  if (errors.length > 0) {
    console.error('\n🚨 env-leak-check failed:\n')
    for (const e of errors) console.error('  • ' + e)
    console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'} found. Build blocked.\n`)
    process.exit(1)
  }

  console.log('✓ env-leak-check passed — no secrets at risk of leaking to the client bundle')
}

main().catch((err) => {
  console.error('env-leak-check crashed:', err)
  process.exit(1)
})
