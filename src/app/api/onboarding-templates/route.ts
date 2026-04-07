import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function scrapeUrl(url: string) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    return {
      title: html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() || '',
      description: html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)?.[1] || '',
      ogImage: html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i)?.[1] || '',
      isWordPress: html.includes('wp-content') || html.includes('wp-includes'),
      h1: html.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1]?.replace(/<[^>]+>/g, '').trim() || '',
      url, scanned_at: new Date().toISOString(),
    }
  } catch (e: any) {
    return { error: e.message, url, scanned_at: new Date().toISOString() }
  }
}

const DEFAULT_QUESTIONS = [
  { section: 'business', section_label: 'Business Info', question_key: 'name', question_text: 'Business name', question_type: 'text', maps_to_column: 'name', required: true, order_index: 1 },
  { section: 'business', section_label: 'Business Info', question_key: 'industry', question_text: 'Industry', question_type: 'select', maps_to_column: 'industry', options: ['Plumbing','HVAC','Electrical','Roofing','Contractor','Landscaping','Cleaning','Auto Repair','Restaurant','Dental','Medical','Legal','Accounting','Real Estate','Insurance','Marketing','Technology','Retail','Other'], order_index: 2 },
  { section: 'business', section_label: 'Business Info', question_key: 'website', question_text: 'Website URL', question_type: 'url', maps_to_column: 'website', order_index: 3 },
  { section: 'business', section_label: 'Business Info', question_key: 'year_founded', question_text: 'Year founded', question_type: 'text', maps_to_column: 'year_founded', order_index: 4 },
  { section: 'business', section_label: 'Business Info', question_key: 'num_employees', question_text: 'Number of employees', question_type: 'select', maps_to_column: 'num_employees', options: ['1-5','6-20','21-50','51-200','200+'], order_index: 5 },
  { section: 'business', section_label: 'Business Info', question_key: 'service_area', question_text: 'Service area', question_type: 'text', maps_to_column: 'service_area', order_index: 6 },
  { section: 'owner', section_label: 'Owner Info', question_key: 'owner_name', question_text: 'Owner full name', question_type: 'text', maps_to_column: 'owner_name', required: true, order_index: 10 },
  { section: 'owner', section_label: 'Owner Info', question_key: 'owner_phone', question_text: 'Owner direct phone', question_type: 'phone', maps_to_column: 'owner_phone', order_index: 12 },
  { section: 'owner', section_label: 'Owner Info', question_key: 'owner_email', question_text: 'Owner email', question_type: 'email', maps_to_column: 'owner_email', order_index: 13 },
  { section: 'services', section_label: 'Services', question_key: 'primary_service', question_text: 'Primary service', question_type: 'text', maps_to_column: 'primary_service', required: true, order_index: 20 },
  { section: 'services', section_label: 'Services', question_key: 'target_customer', question_text: 'Describe your ideal customer', question_type: 'textarea', maps_to_column: 'target_customer', order_index: 22 },
  { section: 'services', section_label: 'Services', question_key: 'unique_selling_prop', question_text: 'What makes you different?', question_type: 'textarea', maps_to_column: 'unique_selling_prop', order_index: 24 },
  { section: 'marketing', section_label: 'Marketing', question_key: 'marketing_channels', question_text: 'Current marketing channels', question_type: 'multiselect', maps_to_column: 'marketing_channels', options: ['Google Ads','Facebook Ads','SEO','Email','Referrals','Direct Mail','None'], order_index: 30 },
  { section: 'marketing', section_label: 'Marketing', question_key: 'marketing_budget', question_text: 'Monthly marketing budget', question_type: 'select', maps_to_column: 'marketing_budget', options: ['Under $500','$500-$1K','$1K-$3K','$3K-$10K','$10K+'], order_index: 31 },
  { section: 'online', section_label: 'Online Presence', question_key: 'google_business_url', question_text: 'Google Business Profile URL', question_type: 'url', maps_to_column: 'google_business_url', order_index: 40 },
  { section: 'online', section_label: 'Online Presence', question_key: 'facebook_url', question_text: 'Facebook page URL', question_type: 'url', maps_to_column: 'facebook_url', order_index: 43 },
  { section: 'online', section_label: 'Online Presence', question_key: 'instagram_url', question_text: 'Instagram URL', question_type: 'url', maps_to_column: 'instagram_url', order_index: 44 },
  { section: 'brand', section_label: 'Brand', question_key: 'tagline', question_text: 'Tagline or slogan', question_type: 'text', maps_to_column: 'tagline', order_index: 50 },
  { section: 'brand', section_label: 'Brand', question_key: 'brand_voice', question_text: 'Brand voice', question_type: 'select', maps_to_column: 'brand_voice', options: ['Professional','Friendly','Casual','Authoritative','Empathetic','Humorous'], order_index: 52 },
]

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const action = p.get('action')
  const s = sb()

  if (action === 'get_template') {
    const { data: template } = await s.from('koto_onboarding_templates').select('*').eq('is_default', true).single()
    if (!template) return NextResponse.json({ template: null, questions: DEFAULT_QUESTIONS })
    const { data: questions } = await s.from('koto_onboarding_questions').select('*').eq('template_id', template.id).eq('active', true).order('order_index')
    return NextResponse.json({ template, questions: (questions?.length || 0) > 0 ? questions : DEFAULT_QUESTIONS })
  }

  if (action === 'get_client_form') {
    const token = p.get('token')
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
    const { data: client } = await s.from('clients').select('id, name, industry, onboarding_completed_at, onboarding_answers').eq('onboarding_token', token).single()
    if (!client) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    const { data: template } = await s.from('koto_onboarding_templates').select('id').eq('is_default', true).single()
    let questions: any[] = DEFAULT_QUESTIONS
    if (template) {
      const { data } = await s.from('koto_onboarding_questions').select('*').eq('template_id', template.id).eq('active', true).order('order_index')
      if (data && data.length > 0) questions = data
    }
    return NextResponse.json({ client: { id: client.id, name: client.name, completed: !!client.onboarding_completed_at, answers: client.onboarding_answers }, questions })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body
  const s = sb()

  if (action === 'seed_defaults') {
    const { data: template } = await s.from('koto_onboarding_templates').select('id').eq('is_default', true).single()
    if (!template) return NextResponse.json({ error: 'No default template' }, { status: 404 })
    const { count } = await s.from('koto_onboarding_questions').select('*', { count: 'exact', head: true }).eq('template_id', template.id)
    if ((count || 0) > 0) return NextResponse.json({ message: 'Already seeded', count })
    await s.from('koto_onboarding_questions').insert(DEFAULT_QUESTIONS.map(q => ({ ...q, template_id: template.id })))
    return NextResponse.json({ success: true, count: DEFAULT_QUESTIONS.length })
  }

  if (action === 'add_question') {
    const { template_id, ...q } = body
    if (!template_id) return NextResponse.json({ error: 'template_id required' }, { status: 400 })
    const { data, error } = await s.from('koto_onboarding_questions').insert({ template_id, ...q }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'update_question') {
    const { question_id, ...updates } = body
    if (!question_id) return NextResponse.json({ error: 'question_id required' }, { status: 400 })
    await s.from('koto_onboarding_questions').update(updates).eq('id', question_id)
    return NextResponse.json({ success: true })
  }

  if (action === 'delete_question') {
    await s.from('koto_onboarding_questions').update({ active: false }).eq('id', body.question_id)
    return NextResponse.json({ success: true })
  }

  if (action === 'submit_onboarding') {
    const { token, answers } = body
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
    const { data: client } = await s.from('clients').select('id, agency_id').eq('onboarding_token', token).single()
    if (!client) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

    const updates: Record<string, any> = { onboarding_answers: answers, onboarding_completed_at: new Date().toISOString() }
    for (const q of DEFAULT_QUESTIONS) {
      if (q.maps_to_column && answers[q.question_key]) {
        const v = answers[q.question_key]
        updates[q.maps_to_column] = Array.isArray(v) ? v.join(', ') : v
      }
    }
    await s.from('clients').update(updates).eq('id', client.id)

    // Background scan social URLs
    const urlKeys = ['website', 'google_business_url', 'facebook_url', 'instagram_url', 'linkedin_url']
    for (const key of urlKeys) {
      const url = updates[key]
      if (url && typeof url === 'string' && url.startsWith('http')) {
        const data = await scrapeUrl(url)
        const col = key === 'website' ? 'website_data' : `${key.replace('_url', '')}_data`
        await s.from('clients').update({ [col]: data, social_last_scanned_at: new Date().toISOString() }).eq('id', client.id)
      }
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'scan_social') {
    const { client_id, url, type } = body
    if (!client_id || !url) return NextResponse.json({ error: 'client_id and url required' }, { status: 400 })
    const data = await scrapeUrl(url)
    const col = type === 'website' ? 'website_data' : `${type}_data`
    await s.from('clients').update({ [col]: data, social_last_scanned_at: new Date().toISOString() }).eq('id', client_id)
    return NextResponse.json(data)
  }

  if (action === 'scan_all_social') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data: client } = await s.from('clients').select('website, google_business_url, facebook_url, instagram_url, linkedin_url, tiktok_url, youtube_url').eq('id', client_id).single()
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const results: Record<string, any> = {}
    const fields = [
      { key: 'website', col: 'website_data' }, { key: 'google_business_url', col: 'google_business_data' },
      { key: 'facebook_url', col: 'facebook_data' }, { key: 'instagram_url', col: 'instagram_data' },
      { key: 'linkedin_url', col: 'linkedin_data' }, { key: 'tiktok_url', col: 'tiktok_data' },
      { key: 'youtube_url', col: 'youtube_data' },
    ]
    for (const f of fields) {
      const url = (client as any)[f.key]
      if (url && typeof url === 'string' && url.startsWith('http')) {
        results[f.col] = await scrapeUrl(url)
      }
    }
    results.social_last_scanned_at = new Date().toISOString()
    await s.from('clients').update(results).eq('id', client_id)
    return NextResponse.json({ scanned: Object.keys(results).length - 1, results })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
