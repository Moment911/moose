import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/trainer/food-search?q=chicken+breast
// GET /api/trainer/food-search?id=12345          (food detail by FatSecret ID)
// GET /api/trainer/food-search?barcode=049000006346  (barcode lookup)
//
// Proxies FatSecret Platform API with OAuth 1.0 HMAC-SHA1.
// No IP whitelisting required — credentials are signed per-request.
//
// Env vars: FATSECRET_CLIENT_ID + FATSECRET_CLIENT_SECRET
//       or: FATSECRET_CONSUMER_KEY + FATSECRET_CONSUMER_SECRET
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const API_URL = 'https://platform.fatsecret.com/rest/server.api'

// ── OAuth 1.0 HMAC-SHA1 signing ────────────────────────────────────────────

function getCredentials() {
  const key = process.env.FATSECRET_CLIENT_ID || process.env.FATSECRET_CONSUMER_KEY
  const secret = process.env.FATSECRET_CLIENT_SECRET || process.env.FATSECRET_CONSUMER_SECRET
  if (!key || !secret) throw new Error('FATSECRET credentials not configured')
  return { key, secret }
}

function nonce(): string {
  return crypto.randomBytes(16).toString('hex')
}

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

function buildOAuth1Params(
  method: string,
  url: string,
  apiParams: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  }

  // Merge all params (API + OAuth) for signature base
  const allParams = { ...apiParams, ...oauthParams }
  const sortedKeys = Object.keys(allParams).sort()
  const paramString = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join('&')

  // Signature base string: METHOD&url&params
  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join('&')

  // Signing key: consumerSecret& (no token secret for 2-legged OAuth)
  const signingKey = `${percentEncode(consumerSecret)}&`
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64')

  // Build final query string with all params + signature
  const finalParams = { ...allParams, oauth_signature: signature }
  return new URLSearchParams(finalParams).toString()
}

async function fatSecretCall(params: Record<string, string>): Promise<unknown> {
  const { key, secret } = getCredentials()
  const apiParams = { ...params, format: 'json' }
  const queryString = buildOAuth1Params('GET', API_URL, apiParams, key, secret)

  const res = await fetch(`${API_URL}?${queryString}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`FatSecret API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

// ── Types ──────────────────────────────────────────────────────────────────

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
  type: string
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

// ── Route handler ──────────────────────────────────────────────────────────

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
