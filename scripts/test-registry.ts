import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { invokeTool } from '../src/lib/agent/tools/invoker'
import { getToolNames } from '../src/lib/agent/tools/registry'

const TEST_CLIENT_ID = 'b83eb71f-ae1e-4b0b-9aca-953e988d0af3'
const TEST_AGENCY_ID = '00000000-0000-0000-0000-000000000099'

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const ai = new Anthropic()
  const ctx = { run_id: 'test-run', client_id: TEST_CLIENT_ID, agency_id: TEST_AGENCY_ID }

  console.log(`Registry has ${getToolNames().length} tools: ${getToolNames().join(', ')}\n`)

  // Test 1: get_topical_map (read-only)
  const r1 = await invokeTool({ s, ai, tool_name: 'get_topical_map', input: { client_id: TEST_CLIENT_ID }, runContext: ctx })
  console.log('get_topical_map:', JSON.stringify(r1.output, null, 2).slice(0, 200), `(${r1.duration_ms}ms)\n`)

  // Test 2: get_content_inventory (read-only)
  const r2 = await invokeTool({ s, ai, tool_name: 'get_content_inventory', input: { client_id: TEST_CLIENT_ID }, runContext: ctx })
  const inv = r2.output as any
  console.log('get_content_inventory:', inv?.inventory?.length ?? 0, 'pages,', `summary: ${JSON.stringify(inv?.summary || {}).slice(0, 200)}`, `(${r2.duration_ms}ms)\n`)

  // Test 3: get_brand_serp (read-only)
  const r3 = await invokeTool({ s, ai, tool_name: 'get_brand_serp', input: { client_id: TEST_CLIENT_ID }, runContext: ctx })
  console.log('get_brand_serp:', JSON.stringify(r3.output, null, 2).slice(0, 200), `(${r3.duration_ms}ms)\n`)
}

main().catch(console.error)
