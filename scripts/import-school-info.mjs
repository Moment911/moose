import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const data = JSON.parse(readFileSync(join(__dirname, 'recruiting-data-school-info.json'), 'utf-8'))
console.log(`Importing school info for ${data.length} programs...`)

let updated = 0, skipped = 0
for (const d of data) {
  const { data: prog } = await sb.from('koto_recruiting_programs')
    .select('id')
    .eq('school_name', d.school)
    .eq('sport', 'baseball')
    .maybeSingle()
  
  if (!prog) { skipped++; continue }

  const update = {}
  if (d.logo_url) update.logo_url = d.logo_url
  if (d.website) update.website = d.website
  if (d.enrollment) update.enrollment = d.enrollment
  if (d.tuition_in_state) update.tuition_in_state = d.tuition_in_state
  if (d.tuition_out_of_state) update.tuition_out_of_state = d.tuition_out_of_state
  if (d.espn_id) update.espn_id = d.espn_id
  if (d.notable) update.notable = d.notable
  update.updated_at = new Date().toISOString()

  const { error } = await sb.from('koto_recruiting_programs').update(update).eq('id', prog.id)
  if (error) { console.error(`  ${d.school}: ${error.message}`); continue }
  updated++
  process.stdout.write('.')
}
console.log(`\nDone. Updated ${updated}, skipped ${skipped} (not found in DB).`)
