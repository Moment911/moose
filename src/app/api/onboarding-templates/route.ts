import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { trackPlatformCost, PLATFORM_RATES } from '@/lib/tokenTracker'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function scrapeUrl(url: string, type?: string) {
  const ts = new Date().toISOString()
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(10000), redirect: 'follow',
    })
    const html = await res.text()

    // Extract all meta tags
    const getMeta = (name: string) => html.match(new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))?.[1] || ''
    const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() || ''
    const description = getMeta('description') || getMeta('og:description')
    const ogImage = getMeta('og:image')
    const ogTitle = getMeta('og:title')
    const ogType = getMeta('og:type')

    const base: any = { title: ogTitle || title, description, ogImage, url, scanned_at: ts }

    // Platform-specific extraction
    if (type === 'facebook' || url.includes('facebook.com')) {
      const likes = html.match(/(\d[\d,]*)\s*(?:likes?|people like)/i)?.[1]?.replace(/,/g, '') || ''
      const followers = html.match(/(\d[\d,]*)\s*(?:followers?|people follow)/i)?.[1]?.replace(/,/g, '') || ''
      const category = getMeta('og:type') || html.match(/<span[^>]*>([^<]*)<\/span>\s*·\s*(?:Business|Company|Service)/i)?.[1] || ''
      return { ...base, platform: 'facebook', likes, followers, category, page_name: ogTitle || title }
    }
    if (type === 'instagram' || url.includes('instagram.com')) {
      const followers = html.match(/(\d[\d,.]*[KkMm]?)\s*[Ff]ollowers/)?.[1] || getMeta('og:description')?.match(/(\d[\d,.]*[KkMm]?)\s*Followers/)?.[1] || ''
      const following = html.match(/(\d[\d,.]*[KkMm]?)\s*[Ff]ollowing/)?.[1] || ''
      const posts = html.match(/(\d[\d,.]*[KkMm]?)\s*[Pp]osts/)?.[1] || ''
      const bio = description.split(' Followers')[0]?.split(' - ').pop() || description
      return { ...base, platform: 'instagram', followers, following, posts, bio, username: url.split('instagram.com/')[1]?.split('/')[0]?.split('?')[0] || '' }
    }
    if (type === 'linkedin' || url.includes('linkedin.com')) {
      const followers = html.match(/(\d[\d,]*)\s*followers/i)?.[1]?.replace(/,/g, '') || ''
      const employees = html.match(/(\d[\d,]*(?:-\d[\d,]*)?)\s*employees/i)?.[1] || ''
      const industry = html.match(/Industry[:\s]*([^<\n]+)/i)?.[1]?.trim() || ''
      return { ...base, platform: 'linkedin', followers, employees, industry, company_name: ogTitle || title }
    }
    if (type === 'tiktok' || url.includes('tiktok.com')) {
      const followers = html.match(/(\d[\d,.]*[KkMm]?)\s*Followers/)?.[1] || ''
      const likes = html.match(/(\d[\d,.]*[KkMm]?)\s*Likes/)?.[1] || ''
      const following = html.match(/(\d[\d,.]*[KkMm]?)\s*Following/)?.[1] || ''
      return { ...base, platform: 'tiktok', followers, likes, following, username: url.split('tiktok.com/@')[1]?.split('/')[0]?.split('?')[0] || '' }
    }
    if (type === 'youtube' || url.includes('youtube.com')) {
      const subscribers = html.match(/(\d[\d,.]*[KkMm]?)\s*subscribers/i)?.[1] || ''
      const videos = html.match(/(\d[\d,]*)\s*videos/i)?.[1] || ''
      const channelName = getMeta('og:title') || title.replace(' - YouTube', '')
      return { ...base, platform: 'youtube', subscribers, videos, channel_name: channelName }
    }
    if (type === 'pinterest' || url.includes('pinterest.com')) {
      const followers = html.match(/(\d[\d,.]*[KkMm]?)\s*followers/i)?.[1] || ''
      const pins = html.match(/(\d[\d,]*)\s*[Pp]ins/)?.[1] || ''
      return { ...base, platform: 'pinterest', followers, pins }
    }
    if (type === 'twitter' || url.includes('twitter.com') || url.includes('x.com')) {
      const followers = html.match(/(\d[\d,.]*[KkMm]?)\s*Followers/)?.[1] || ''
      const following = html.match(/(\d[\d,.]*[KkMm]?)\s*Following/)?.[1] || ''
      return { ...base, platform: 'x', followers, following, username: url.split(/twitter\.com\/|x\.com\//)[1]?.split('/')[0]?.split('?')[0] || '' }
    }

    // Website (default)
    const isWordPress = html.includes('wp-content') || html.includes('wp-includes')
    const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1]?.replace(/<[^>]+>/g, '').trim() || ''
    const phone = html.match(/(?:tel:|href="tel:)([^"]+)/i)?.[1] || html.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || ''
    const email = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || ''
    return { ...base, platform: 'website', isWordPress, h1, phone, email }
  } catch (e: any) {
    return { error: e.message, url, scanned_at: ts }
  }
}

async function scanGoogleBusiness(query: string, placeId?: string) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_KEY
  if (!key) return { error: 'Google Places API key not configured' }
  try {
    let place: any = null
    // Track Places calls. Each fetch = 1 request = $0.017. The
    // findplacefromtext + details combination is two units.
    let placesCalls = 0
    if (placeId) {
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,formatted_phone_number,formatted_address,website,opening_hours,business_status,photos,types,reviews&key=${key}`)
      placesCalls++
      const data = await res.json()
      place = data.result
    } else if (query) {
      const searchRes = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${key}`)
      placesCalls++
      const searchData = await searchRes.json()
      const pid = searchData.candidates?.[0]?.place_id
      if (pid) {
        const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${pid}&fields=name,rating,user_ratings_total,formatted_phone_number,formatted_address,website,opening_hours,business_status,photos,types,reviews&key=${key}`)
        placesCalls++
        const data = await res.json()
        place = data.result
      }
    }
    if (placesCalls > 0) {
      void trackPlatformCost({
        cost_type: 'google_places',
        amount: placesCalls * PLATFORM_RATES.google_places,
        unit_count: placesCalls,
        description: 'onboarding template GBP scan',
        metadata: { feature: 'onboarding_template', query: query || null, place_id: placeId || null },
      })
    }
    if (!place) return { error: 'Business not found on Google' }
    return {
      platform: 'google',
      name: place.name,
      rating: place.rating,
      review_count: place.user_ratings_total,
      phone: place.formatted_phone_number,
      address: place.formatted_address,
      website: place.website,
      business_status: place.business_status,
      hours: place.opening_hours?.weekday_text || [],
      photo_count: place.photos?.length || 0,
      types: place.types || [],
      reviews: (place.reviews || []).slice(0, 5).map((r: any) => ({
        author: r.author_name, rating: r.rating, text: r.text,
        time: r.relative_time_description,
      })),
      scanned_at: new Date().toISOString(),
    }
  } catch (e: any) {
    return { error: e.message }
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
    const { client_id, url, type, query, place_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    let data: any
    if (type === 'google' || type === 'google_business') {
      data = await scanGoogleBusiness(query || '', place_id)
    } else if (url) {
      data = await scrapeUrl(url, type)
    } else {
      return NextResponse.json({ error: 'url or query required' }, { status: 400 })
    }

    const col = type === 'website' ? 'website_data' : type === 'google' || type === 'google_business' ? 'google_business_data' : `${type}_data`
    const updates: Record<string, any> = { [col]: data, social_last_scanned_at: new Date().toISOString() }
    if (type === 'google' || type === 'google_business') {
      if (data.rating) updates.review_rating = String(data.rating)
      if (data.review_count) updates.review_count = String(data.review_count)
      if (data.phone) updates.phone = data.phone
    }
    await s.from('clients').update(updates).eq('id', client_id)
    return NextResponse.json(data)
  }

  if (action === 'scan_all_social') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    const { data: client } = await s.from('clients')
      .select('name, website, google_business_url, google_place_id, facebook_url, instagram_url, linkedin_url, tiktok_url, youtube_url')
      .eq('id', client_id).single()
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const results: Record<string, any> = {}

    // Google Business — use Places API
    if (client.google_place_id || client.google_business_url || client.name) {
      const gbData = await scanGoogleBusiness(client.name || '', client.google_place_id || undefined)
      if (!gbData.error) {
        results.google_business_data = gbData
        if (gbData.rating) results.review_rating = String(gbData.rating)
        if (gbData.review_count) results.review_count = String(gbData.review_count)
      }
    }

    // All other platforms — enhanced scraper
    const platforms = [
      { key: 'website', col: 'website_data', type: 'website' },
      { key: 'facebook_url', col: 'facebook_data', type: 'facebook' },
      { key: 'instagram_url', col: 'instagram_data', type: 'instagram' },
      { key: 'linkedin_url', col: 'linkedin_data', type: 'linkedin' },
      { key: 'tiktok_url', col: 'tiktok_data', type: 'tiktok' },
      { key: 'youtube_url', col: 'youtube_data', type: 'youtube' },
    ]
    for (const p of platforms) {
      const url = (client as any)[p.key]
      if (url && typeof url === 'string' && url.startsWith('http')) {
        results[p.col] = await scrapeUrl(url, p.type)
      }
    }

    results.social_last_scanned_at = new Date().toISOString()
    await s.from('clients').update(results).eq('id', client_id)
    return NextResponse.json({ scanned: Object.keys(results).length - 1, results })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
