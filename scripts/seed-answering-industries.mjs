#!/usr/bin/env node
/**
 * Seed koto_inbound_industries with the four builtin templates
 * (HVAC, Legal, Medical, Generic). Safe to re-run -- upserts by slug.
 *
 * Usage:
 *   APP_URL=https://hellokoto.com node scripts/seed-answering-industries.mjs
 *   # or hit the local dev server:
 *   APP_URL=http://localhost:3000 node scripts/seed-answering-industries.mjs
 */
const APP_URL = process.env.APP_URL || 'http://localhost:3000'

async function main() {
  const res = await fetch(`${APP_URL}/api/answering/industries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'seed_all' }),
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('Seed failed:', data)
    process.exit(1)
  }
  console.log(`Seeded ${data.seeded} industries at ${APP_URL}`)
  console.log('Run this once, then all answering-service agents can pick industry templates from the dashboard.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
