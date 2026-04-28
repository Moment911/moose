import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/trainer/food-search?q=chicken+breast
// GET /api/trainer/food-search?id=12345          (food detail by FatSecret ID)
// GET /api/trainer/food-search?barcode=049000006346  (barcode lookup)
//
// Proxies FatSecret Platform API with OAuth 2.0 client_credentials.
// Token is cached in-memory for 23 hours (expires in 24h).
//
// Env vars: FATSECRET_CLIENT_ID, FATSECRET_CLIENT_SECRET
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token'
const API_URL = 'https://platform.fatsecret.com/rest/server.api'

// In-memory token cache
let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken

  const clientId = process.env.FATSECRET_CLIENT_ID || process.env.FATSECRET_CONSUMER_KEY
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET || process.env.FATSECRET_CONSUMER_SECRET
  if (!clientId || !clientSecret) throw new Error('FATSECRET credentials required (FATSECRET_CLIENT_ID/FATSECRET_CLIENT_SECRET or FATSECRET_CONSUMER_KEY/FATSECRET_CONSUMER_SECRET)')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&scope=basic`,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`FatSecret token error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = data.access_token
  // Cache for 23 hours (token lasts 24h)
  tokenExpiresAt = Date.now() + (data.expires_in - 3600) * 1000
  return cachedToken
}

async function fatSecretCall(params: Record<string, string>): Promise<unknown> {
  const token = await getToken()
  const query = new URLSearchParams({ ...params, format: 'json' })
  const res = await fetch(`${API_URL}?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    // If IP not whitelisted, return helpful error
    if (text.includes('Invalid IP')) {
      throw new Error('FatSecret IP not whitelisted. Add server IP at platform.fatsecret.com → My Apps → IP Addresses.')
    }
    throw new Error(`FatSecret API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

type FoodServing = {
  serving_id: string
  serving_description: string
  metric_serving_amount?: string
  metric_serving_unit?: string
  calories: string
  protein: string
  fat: string
  carbohydrate: string
  fiber?: string
  sugar?: string
  sodium?: string
}

type NormalizedFood = {
  id: string
  name: string
  brand?: string
  type: string // 'Generic' | 'Brand'
  description: string
  servings: Array<{
    id: string
    description: string
    kcal: number
    protein_g: number
    fat_g: number
    carb_g: number
    fiber_g: number
  }>
}

function normalizeFood(food: Record<string, unknown>): NormalizedFood {
  const servingsRaw = food.servings as { serving: FoodServing | FoodServing[] } | undefined
  let servingArr: FoodServing[] = []
  if (servingsRaw?.serving) {
    servingArr = Array.isArray(servingsRaw.serving) ? servingsRaw.serving : [servingsRaw.serving]
  }

  return {
    id: String(food.food_id ?? ''),
    name: String(food.food_name ?? ''),
    brand: food.brand_name ? String(food.brand_name) : undefined,
    type: String(food.food_type ?? 'Generic'),
    description: String(food.food_description ?? ''),
    servings: servingArr.map((s) => ({
      id: s.serving_id,
      description: s.serving_description,
      kcal: Math.round(Number(s.calories) || 0),
      protein_g: Math.round(Number(s.protein) || 0),
      fat_g: Math.round(Number(s.fat) || 0),
      carb_g: Math.round(Number(s.carbohydrate) || 0),
      fiber_g: Math.round(Number(s.fiber) || 0),
    })),
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  const id = req.nextUrl.searchParams.get('id')
  const barcode = req.nextUrl.searchParams.get('barcode')

  if (!q && !id && !barcode) {
    return NextResponse.json({ error: 'Provide ?q=search, ?id=food_id, or ?barcode=upc' }, { status: 400 })
  }

  try {
    // Food detail by ID
    if (id) {
      const data = (await fatSecretCall({ method: 'food.get.v4', food_id: id })) as { food?: Record<string, unknown> }
      if (!data.food) return NextResponse.json({ food: null })
      return NextResponse.json({ food: normalizeFood(data.food) })
    }

    // Barcode lookup
    if (barcode) {
      const data = (await fatSecretCall({ method: 'food.find_id_for_barcode', barcode })) as { food_id?: { value: string } }
      if (!data.food_id?.value) return NextResponse.json({ food: null, reason: 'barcode_not_found' })
      // Now fetch the full food detail
      const detail = (await fatSecretCall({ method: 'food.get.v4', food_id: data.food_id.value })) as { food?: Record<string, unknown> }
      if (!detail.food) return NextResponse.json({ food: null })
      return NextResponse.json({ food: normalizeFood(detail.food) })
    }

    // Search
    const data = (await fatSecretCall({
      method: 'foods.search',
      search_expression: q!,
      max_results: '15',
    })) as { foods?: { food?: Array<Record<string, unknown>> | Record<string, unknown> } }

    const rawFoods = data.foods?.food
    const foods = Array.isArray(rawFoods) ? rawFoods : rawFoods ? [rawFoods] : []

    const results = foods.map((f) => ({
      id: String(f.food_id ?? ''),
      name: String(f.food_name ?? ''),
      brand: f.brand_name ? String(f.brand_name) : undefined,
      type: String(f.food_type ?? 'Generic'),
      description: String(f.food_description ?? ''),
    }))

    return NextResponse.json({ foods: results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[food-search] error:', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
