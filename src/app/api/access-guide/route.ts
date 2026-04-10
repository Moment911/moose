import { NextRequest, NextResponse } from 'next/server'

/**
 * Access Guide AI lookup
 *
 * Single POST endpoint. Client sends { query } describing whatever
 * platform/tool they use ("I use Wix", "My email is through Constant
 * Contact", "I advertise on Pinterest") and Claude returns exact
 * step-by-step instructions for how to grant the agency access.
 *
 * This endpoint powers both:
 *   - the public /access-guide page (AI assistant at the top)
 *   - the inline AI widget on the onboarding form's access section
 *
 * The AI handles the long tail of platforms so the app doesn't need
 * to ship hard-coded instructions for every possible tool.
 */

const DEFAULT_AGENCY_EMAIL = 'access@momentamarketing.com'
const DEFAULT_AGENCY_NAME = 'Momenta Marketing'
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json().catch(() => ({}))
    const action: string = body.action || 'get_instructions'
    const query: string = String(body.query || '').trim()
    const agencyEmail: string = body.agency_email || DEFAULT_AGENCY_EMAIL
    const agencyName: string = body.agency_name || DEFAULT_AGENCY_NAME

    if (action !== 'get_instructions') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        platform: 'Unknown',
        instructions: 'AI lookup is not configured. Please contact your agency directly for access instructions.',
        invite_email: agencyEmail,
        access_level: null,
        notes: null,
      })
    }

    const system = `You are a marketing agency access setup expert. When someone tells you what platform or tool they use, you provide exact step-by-step instructions for how to grant access to a marketing agency.

Rules:
- Always be specific. Use numbered steps with exact menu paths (e.g. "Settings → Users → Add User").
- Always reference ${agencyEmail} as the email to invite.
- Specify the exact access level needed and briefly why.
- Keep instructions concise — 5-10 numbered steps max per platform.
- If the query mentions multiple platforms, pick the most specific one and mention that the others need separate instructions.
- If you do not recognize the platform, return the JSON with platform: "Unknown" and ask them to contact their agency.
- Return ONLY valid JSON, no preamble, no markdown fences.`

    const userMsg = `The client says: "${query}"
Our agency: ${agencyName}
Our agency access email: ${agencyEmail}

Identify the platform(s) mentioned and provide exact access grant instructions.

Return JSON only with this exact shape:
{
  "platform": "Platform Name (e.g. Wix, Mailchimp, Google Ads)",
  "instructions": "Numbered step-by-step instructions as a single string with newlines",
  "invite_email": "${agencyEmail}",
  "access_level": "Admin / Manager / Editor / etc",
  "notes": "Any important caveats or things to watch out for, or null"
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 700,
        temperature: 0.2,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      return NextResponse.json({
        platform: 'Unknown',
        instructions: `We couldn't reach the AI lookup service. Please email ${agencyEmail} and we'll send you platform-specific instructions.`,
        invite_email: agencyEmail,
        access_level: null,
        notes: null,
      })
    }

    const data: any = await res.json()
    const text: string = (data.content || [])
      .filter((c: any) => c?.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .trim()

    const cleaned = text.replace(/```json|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({
        platform: 'Unknown',
        instructions: `We couldn't parse the AI response. Please email ${agencyEmail} directly and describe your platform — we'll send you exact steps.`,
        invite_email: agencyEmail,
        access_level: null,
        notes: null,
      })
    }

    try {
      const parsed = JSON.parse(match[0])
      return NextResponse.json({
        platform: parsed.platform || 'Unknown',
        instructions: parsed.instructions || '',
        invite_email: parsed.invite_email || agencyEmail,
        access_level: parsed.access_level || null,
        notes: parsed.notes || null,
      })
    } catch {
      return NextResponse.json({
        platform: 'Unknown',
        instructions: text,
        invite_email: agencyEmail,
        access_level: null,
        notes: null,
      })
    }
  } catch (e: any) {
    return NextResponse.json({
      platform: 'Unknown',
      instructions: 'An unexpected error occurred. Please contact your agency directly.',
      invite_email: DEFAULT_AGENCY_EMAIL,
      error: e?.message || 'failed',
    })
  }
}
