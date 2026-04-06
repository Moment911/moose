import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exec } from 'child_process'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

export const runtime = 'nodejs'

const execAsync = promisify(exec)

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function deepGet(obj: any, path: string): any {
  if (!obj) return undefined
  return path.split('.').reduce((cur, k) => (cur == null ? undefined : cur[k]), obj)
}

const SECTIONS = [
  { title: '1. Primary Contact', fields: [
    { key:'contact.first_name', label:'First Name' },
    { key:'contact.last_name',  label:'Last Name' },
    { key:'contact.title',      label:'Title' },
    { key:'contact.email',      label:'Email' },
    { key:'contact.phone',      label:'Primary Phone' },
    { key:'phone2',             label:'Secondary Phone' },
    { key:'contact_consent',    label:'Contact Preferences', array:true },
  ]},
  { title: '2. Business Information', fields: [
    { key:'business_name',        label:'Business Name' },
    { key:'legal_name',           label:'Legal Name' },
    { key:'industry',             label:'Industry' },
    { key:'business_type',        label:'Business Type' },
    { key:'year_founded',         label:'Year Founded' },
    { key:'num_employees',        label:'Employees' },
    { key:'annual_revenue',       label:'Annual Revenue' },
    { key:'website',              label:'Website' },
    { key:'address',              label:'Street Address' },
    { key:'suite',                label:'Suite / Unit' },
    { key:'city',                 label:'City' },
    { key:'state',                label:'State' },
    { key:'zip',                  label:'ZIP Code' },
    { key:'business_description', label:'Business Description', multiline:true },
  ]},
  { title: '3. Products & Services', fields: [
    { key:'products_services',     label:'Services Description', multiline:true },
    { key:'top_services',          label:'Top Services', array:true },
    { key:'service_pricing_model', label:'Pricing Model', array:true },
    { key:'avg_transaction',       label:'Avg Job Value' },
    { key:'avg_project_value',     label:'Avg Project Value' },
    { key:'client_ltv',            label:'Customer LTV' },
    { key:'seasonal_notes',        label:'Seasonal Notes', multiline:true },
  ]},
  { title: '4. Ideal Customers', fields: [
    { key:'customer_types',       label:'Customer Types', array:true },
    { key:'ideal_customer_desc',  label:'Ideal Customer', multiline:true },
    { key:'customer_age',         label:'Age Range', array:true },
    { key:'customer_gender',      label:'Gender Split' },
    { key:'customer_income',      label:'Income Level' },
    { key:'customer_pain_points', label:'Pain Points', multiline:true },
    { key:'customer_goals',       label:'Customer Goals', multiline:true },
    { key:'customer_lifestyle',   label:'Online Lifestyle', multiline:true },
  ]},
  { title: '5. Competition & Positioning', competitors:true, fields: [
    { key:'why_choose_you',    label:'Why Choose You', multiline:true },
    { key:'unique_value_prop', label:'Unique Value Proposition' },
  ]},
  { title: '6. Target Markets', fields: [
    { key:'growth_scope',      label:'Growth Scope' },
    { key:'primary_city',      label:'Primary City' },
    { key:'primary_state',     label:'State' },
    { key:'travel_distance',   label:'Travel / Service Radius' },
    { key:'target_cities',     label:'Target Cities', array:true },
    { key:'service_area_notes',label:'Geographic Notes', multiline:true },
  ]},
  { title: '7. Brand & Voice', fields: [
    { key:'logo_url',            label:'Logo Files' },
    { key:'brand_assets_url',    label:'Brand Assets Folder' },
    { key:'brand_primary_color', label:'Primary Color' },
    { key:'brand_accent_color',  label:'Accent Color' },
    { key:'brand_fonts',         label:'Brand Fonts' },
    { key:'brand_tagline',       label:'Tagline / Slogan' },
    { key:'brand_tone',          label:'Brand Tone', array:true },
    { key:'brand_dos',           label:"Brand DO's", multiline:true },
    { key:'brand_donts',         label:"Brand DON'Ts", multiline:true },
  ]},
  { title: '8. Social Profiles', fields: [
    { key:'facebook_url',   label:'Facebook' },
    { key:'instagram_url',  label:'Instagram' },
    { key:'google_biz_url', label:'Google Business' },
    { key:'yelp_url',       label:'Yelp' },
    { key:'linkedin_url',   label:'LinkedIn' },
    { key:'tiktok_url',     label:'TikTok' },
    { key:'youtube_url',    label:'YouTube' },
    { key:'twitter_url',    label:'Twitter / X' },
    { key:'pinterest_url',  label:'Pinterest' },
    { key:'nextdoor_url',   label:'Nextdoor' },
    { key:'houzz_url',      label:'Houzz' },
    { key:'angi_url',       label:'Angi' },
    { key:'bbb_url',        label:'BBB' },
    { key:'fb_followers',   label:'FB Followers' },
    { key:'ig_followers',   label:'IG Followers' },
    { key:'google_rating',  label:'Google Rating' },
    { key:'google_reviews', label:'Google Reviews' },
  ]},
  { title: '9. Website & Tech', fields: [
    { key:'hosting_provider',  label:'Hosting Provider' },
    { key:'hosting_url',       label:'Hosting Dashboard' },
    { key:'hosting_login',     label:'Hosting Username' },
    { key:'domain_registrar',  label:'Domain Registrar' },
    { key:'domain_expiry',     label:'Domain Expiry' },
    { key:'cms',               label:'CMS Platform' },
    { key:'cms_url',           label:'CMS Admin URL' },
    { key:'cms_username',      label:'CMS Username' },
    { key:'ga4_id',            label:'Google Analytics 4 ID' },
    { key:'gtm_id',            label:'Google Tag Manager ID' },
    { key:'fb_pixel',          label:'Facebook Pixel ID' },
    { key:'google_ads_id',     label:'Google Ads Customer ID' },
  ]},
  { title: '11. Marketing History', fields: [
    { key:'monthly_ad_budget',    label:'Monthly Ad Spend' },
    { key:'current_ad_platforms', label:'Ad Platforms', array:true },
    { key:'current_seo_agency',   label:'Current SEO Agency' },
    { key:'email_platform',       label:'Email Platform' },
    { key:'email_list_size',      label:'Email List Size' },
    { key:'what_worked',          label:'What Has Worked', multiline:true },
    { key:'what_didnt_work',      label:'What Has NOT Worked', multiline:true },
  ]},
  { title: '12. Goals & Budget', fields: [
    { key:'primary_goal',           label:'Primary Goals', array:true },
    { key:'secondary_goals',        label:'Secondary Goals', array:true },
    { key:'target_leads_per_month', label:'Target Leads / Month' },
    { key:'timeline',               label:'Results Timeline' },
    { key:'budget_for_agency',      label:'Agency Fee Budget' },
    { key:'success_metrics',        label:'Success KPIs', multiline:true },
    { key:'other_notes',            label:'Additional Notes', multiline:true },
  ]},
]

function buildHTML(data: any, client: any): string {
  const businessName = data.business_name || client?.name || 'Client'
  const contactName  = data.contact?.first_name
    ? `${data.contact.first_name} ${data.contact.last_name || ''}`.trim()
    : client?.name || ''
  const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
body{font-family:Arial,sans-serif;font-size:11pt;color:#111;margin:0;padding:0;}
.cover{background:#0a0a0a;padding:60px 50px;page-break-after:always;}
.logo{font-size:28pt;font-weight:900;color:#ea2729;letter-spacing:-2px;margin:0 0 4px;}
.sublogo{font-size:10pt;color:rgba(255,255,255,.4);margin:0 0 50px;}
.cover h1{font-size:28pt;font-weight:900;color:#ea2729;margin:0 0 8px;}
.cover .sub{font-size:14pt;color:rgba(255,255,255,.55);margin:0 0 40px;}
.meta{font-size:11pt;color:rgba(255,255,255,.45);border-top:1px solid rgba(255,255,255,.1);padding-top:18px;}
.meta strong{color:#fff;}
.section{padding:24px 50px;border-bottom:1px solid #f3f4f6;page-break-inside:avoid;}
.sec-title{font-size:14pt;font-weight:800;color:#0a0a0a;border-bottom:3px solid #ea2729;padding-bottom:6px;margin:0 0 14px;}
.field{display:grid;grid-template-columns:200px 1fr;gap:8px;padding:7px 0;border-bottom:1px solid #f9fafb;}
.fl{font-size:9pt;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;}
.fv{font-size:10.5pt;color:#111;line-height:1.6;}
.fv.empty{color:#d1d5db;font-style:italic;}
.tag{display:inline-block;background:#e0f7fa;color:#0e7490;border-radius:20px;padding:2px 10px;font-size:9pt;font-weight:600;margin:2px 3px 2px 0;}
.comp{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:10px;}
.comp-name{font-size:11pt;font-weight:800;margin:0 0 8px;}
.comp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.clabel{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;}
</style></head><body>
<div class="cover">
  <div class="logo">koto</div>
  <div class="sublogo">Agency Marketing Platform</div>
  <h1>${businessName}</h1>
  <div class="sub">Client Onboarding Profile</div>
  <div class="meta">
    <strong>Contact:</strong> ${contactName}<br>
    <strong>Generated:</strong> ${today}<br>
    <strong>Prepared by:</strong> Koto Agency
  </div>
</div>`

  for (const sec of SECTIONS as any[]) {
    const fields = sec.fields.map((f: any) => ({
      ...f,
      value: deepGet(data, f.key) ?? data[f.key],
    }))
    const comps = sec.competitors ? (data.competitors || []).filter((c: any) => c.name) : []
    const hasData = fields.some((f: any) => {
      const v = f.value
      return v && (Array.isArray(v) ? v.length > 0 : v.toString().trim())
    })
    if (!hasData && comps.length === 0) continue

    html += `\n<div class="section"><div class="sec-title">${sec.title}</div>`

    for (const f of fields) {
      const val   = f.value
      const empty = !val || (Array.isArray(val) ? val.length === 0 : val.toString().trim() === '')
      let display = ''
      if (empty) {
        display = `<span class="empty">Not provided</span>`
      } else if (f.array) {
        const arr = Array.isArray(val) ? val : val.toString().split(',')
        display = arr.map((v: string) => `<span class="tag">${v.toString().trim()}</span>`).join('')
      } else {
        display = val.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
      }
      html += `<div class="field"><div class="fl">${f.label}</div><div class="fv${empty?' empty':''}">${display}</div></div>`
    }

    if (comps.length > 0) {
      html += `<div style="margin:14px 0 10px;font-size:9pt;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Competitors (${comps.length})</div>`
      for (const comp of comps) {
        html += `<div class="comp">
  <div class="comp-name">${comp.name}${comp.url ? ` &mdash; <span style="color:#9ca3af;font-size:9pt;font-weight:400">${comp.url}</span>` : ''}</div>
  <div class="comp-grid">
    <div><div class="clabel" style="color:#16a34a">&#10003; What They Do Well</div><div style="font-size:10pt;line-height:1.6">${comp.strengths || '<i style="color:#d1d5db">Not filled in</i>'}</div></div>
    <div><div class="clabel" style="color:#ea2729">&#10007; Where They Fall Short</div><div style="font-size:10pt;line-height:1.6">${comp.weaknesses || '<i style="color:#d1d5db">Not filled in</i>'}</div></div>
  </div>
</div>`
      }
    }
    html += `</div>`
  }

  html += `</body></html>`
  return html
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get('client_id')
  const format    = (searchParams.get('format') || 'json') as 'json' | 'docx' | 'pdf'

  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const db = sb()
  const [{ data: client }, { data: profile }] = await Promise.all([
    db.from('clients').select('*').eq('id', client_id).single(),
    db.from('client_profiles').select('*').eq('client_id', client_id).single(),
  ])

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const data: any = { ...(profile || {}), ...(profile?.onboarding_form || {}) }

  if (format === 'json') {
    return NextResponse.json({ client, profile: data })
  }

  // Generate HTML then convert
  const html        = buildHTML(data, client)
  const businessName = (data.business_name || client.name || 'Client').replace(/[^a-zA-Z0-9]/g, '_')
  const tmpId       = `ob-${client_id}-${Date.now()}`
  const tmpHtml     = join(tmpdir(), `${tmpId}.html`)
  const tmpOut      = join(tmpdir(), `${tmpId}.${format}`)

  await writeFile(tmpHtml, html, 'utf-8')

  try {
    if (format === 'docx') {
      await execAsync(`pandoc "${tmpHtml}" -o "${tmpOut}" --from html`)
    } else {
      // PDF: try wkhtmltopdf, fall back to pandoc
      try {
        await execAsync(`wkhtmltopdf --quiet "${tmpHtml}" "${tmpOut}"`)
      } catch {
        await execAsync(`pandoc "${tmpHtml}" -o "${tmpOut}" --from html`)
      }
    }
  } catch (err: any) {
    try { await unlink(tmpHtml) } catch {}
    return NextResponse.json(
      { error: `Conversion failed: ${err.message}. Ensure pandoc is installed on the server.` },
      { status: 500 }
    )
  }

  let buf: Buffer
  try {
    buf = await readFile(tmpOut)
  } catch {
    return NextResponse.json({ error: 'Output file not created' }, { status: 500 })
  }
  try { await unlink(tmpHtml); await unlink(tmpOut) } catch {}

  const mime = format === 'docx'
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/pdf'

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${businessName}_Onboarding_Profile.${format}"`,
      'Content-Length': buf.length.toString(),
    },
  })
}
