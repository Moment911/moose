import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const TEST_CLIENT_ID = 'b83eb71f-ae1e-4b0b-9aca-953e988d0af3'
const TEST_AGENCY_ID = '00000000-0000-0000-0000-000000000099'

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const ai = new Anthropic()

  // Read client website first
  const { data: client } = await s.from('clients').select('name, website').eq('id', TEST_CLIENT_ID).single()
  console.log(`Client: ${client?.name} — ${client?.website}\n`)
  if (!client?.website) { console.error('No website — aborting'); return }

  // 1. Sitemap crawl → kotoiq_sitemap_urls
  console.log('── Step 1/4: Sitemap crawl ──')
  try {
    const { crawlSitemaps } = await import('../src/lib/sitemapCrawler')
    const r = await crawlSitemaps(s, { client_id: TEST_CLIENT_ID, website: client.website })
    console.log('  Status:', r.status, '| URLs saved:', r.urls_saved, '| Sitemaps:', r.sitemaps_processed)
  } catch (e: any) {
    console.error('  FAILED:', e.message)
  }
  console.log()

  // 2. Content inventory → kotoiq_content_inventory
  console.log('── Step 2/4: Build content inventory ──')
  try {
    const { buildContentInventory } = await import('../src/lib/contentRefreshEngine')
    const r = await buildContentInventory(s, ai, { client_id: TEST_CLIENT_ID, url_limit: 100 })
    const inv = r as any
    console.log('  Pages:', inv?.total_pages ?? inv?.inventory?.length ?? '?', '| Job:', inv?.job_id ?? 'none')
  } catch (e: any) {
    console.error('  FAILED:', e.message)
  }
  console.log()

  // 3 & 4 already seeded — skip unless forced
  console.log('── Steps 3-4 already seeded (topical map: 12 nodes, brand SERP: score 30) ──\n')

  // Row count summary
  console.log('── Row counts ──')
  const tables = [
    'kotoiq_sitemap_urls',
    'kotoiq_content_inventory',
    'kotoiq_topical_maps',
    'kotoiq_topical_nodes',
    'kotoiq_brand_serp',
  ]
  for (const t of tables) {
    const { count } = await s.from(t).select('*', { count: 'exact', head: true }).eq('client_id', TEST_CLIENT_ID)
    console.log(`  ${t}: ${count ?? 0} rows`)
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
