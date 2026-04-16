// ─────────────────────────────────────────────────────────────
// GMB Image Engine — AI generation + GBP upload
// Pairs with imageGeoTagger.ts to produce geo-tagged GMB images
// ─────────────────────────────────────────────────────────────

import OpenAI from 'openai'
import { logTokenUsage } from '@/lib/tokenTracker'

type AI = any
type SB = any

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

// ── AI image generation for GMB ─────────────────────────────────────────────
export async function generateGMBImage(
  ai: AI,
  params: {
    prompt: string
    businessName: string
    primaryService?: string
    city?: string
    style?: 'photo' | 'illustration' | 'flat'
    agencyId?: string
  }
) {
  const style = params.style || 'photo'

  // Step 1: Use Claude to enhance the prompt with business context
  let enhancedPrompt = params.prompt
  try {
    const enhancePrompt = `Enhance this image generation prompt for a local business's Google Business Profile. Keep it under 200 words, specific, visually descriptive.

BUSINESS: ${params.businessName}
SERVICE: ${params.primaryService || 'local business'}
${params.city ? `LOCATION: ${params.city}` : ''}
STYLE: ${style}

USER PROMPT: ${params.prompt}

Rules:
- Do NOT include people's faces (privacy)
- Include realistic local details (lighting, weather, setting)
- Specify composition, angle, and mood
- Make it feel authentic — not stock photography
- For "photo" style: natural lighting, realistic textures, shallow DOF
- For "illustration": clean vector style, on-brand colors
- For "flat": minimalist flat design

Return ONLY the enhanced prompt, no preamble.`

    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: enhancePrompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_gmb_image_enhance',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId: params.agencyId,
    })
    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    if (raw.trim()) enhancedPrompt = raw.trim()
  } catch {
    // Fallback to user's raw prompt
  }

  // Step 2: Generate image via OpenAI
  const imgRes = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: enhancedPrompt,
    size: '1024x1024',
    quality: 'medium',
    n: 1,
  })

  const b64 = imgRes.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI returned no image data')

  // gpt-image-1 returns PNG by default — we need JPEG for EXIF
  // Convert PNG to JPEG using sharp-less approach: return as-is, caller converts
  return {
    imageBase64: `data:image/png;base64,${b64}`,
    enhancedPrompt,
    originalPrompt: params.prompt,
  }
}

// ── Convert PNG base64 → JPEG base64 (server-side via node:canvas-less approach) ──
// Since we don't want a heavy dependency, we'll do the conversion client-side using Canvas.
// This helper exists for the API to flag that conversion is needed.
export function requiresJpegConversion(dataUrl: string): boolean {
  return dataUrl.startsWith('data:image/png') || dataUrl.startsWith('data:image/webp')
}

// ── Generate SEO-optimized caption + alt text ───────────────────────────────
export async function generateImageCaption(
  ai: AI,
  params: {
    businessName: string
    service?: string
    city?: string
    keywords?: string[]
    imageDescription?: string
    agencyId?: string
  }
) {
  const prompt = `Generate SEO-optimized caption and alt text for a Google Business Profile image.

BUSINESS: ${params.businessName}
SERVICE: ${params.service || 'local business'}
${params.city ? `CITY: ${params.city}` : ''}
${params.keywords?.length ? `TARGET KEYWORDS: ${params.keywords.join(', ')}` : ''}
${params.imageDescription ? `IMAGE DESCRIPTION: ${params.imageDescription}` : ''}

Return ONLY valid JSON:
{
  "caption": "SEO caption for GBP post (50-100 chars, includes keyword naturally)",
  "alt_text": "Descriptive alt text for accessibility + image SEO (under 125 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3"] // 3-5 image-specific keywords
}`

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })
  void logTokenUsage({
    feature: 'kotoiq_gmb_image_caption',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: params.agencyId,
  })

  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return { caption: params.businessName, alt_text: params.businessName, keywords: params.keywords || [] }
  }
}

// ── Upload image to Supabase Storage → return public URL ────────────────────
export async function uploadImageToStorage(s: SB, params: {
  clientId: string
  dataUrl: string           // data:image/jpeg;base64,...
  filename?: string
}) {
  const match = params.dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error('Invalid data URL')
  const mimeType = match[1]
  const base64 = match[2]
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const filename = params.filename || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const path = `${params.clientId}/${filename}`
  const buffer = Buffer.from(base64, 'base64')

  const { error } = await s.storage.from('gmb-images').upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = s.storage.from('gmb-images').getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

// ── Upload image to Google Business Profile ─────────────────────────────────
export async function uploadImageToGBP(params: {
  accessToken: string
  accountId: string
  locationId: string
  sourceUrl: string
  category?: 'PROFILE' | 'COVER' | 'ADDITIONAL' | 'LOGO'
  description?: string
}) {
  const category = params.category || 'ADDITIONAL'

  const body: any = {
    mediaFormat: 'PHOTO',
    locationAssociation: { category },
    sourceUrl: params.sourceUrl,
  }
  if (params.description) body.description = params.description

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${params.accountId}/locations/${params.locationId}/media`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    }
  )

  const data = await res.json()
  if (!res.ok) throw new Error(`GBP upload failed: ${data.error?.message || 'unknown error'}`)
  return data
}
