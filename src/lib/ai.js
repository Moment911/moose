const API_KEY = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-20250514'
const HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true'
}

async function apiCall(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: HEADERS, body: JSON.stringify({ model: MODEL, ...body })
  })
  if (!res.ok) {
    let errMsg = `API error ${res.status}`
    try {
      const errData = await res.json()
      errMsg = errData.error?.message || errMsg
      // Content filter or invalid request - simplify and retry once
      if (res.status === 400) {
        console.warn('Claude 400 error, retrying with simplified prompt:', errMsg)
        const simplified = { ...body }
        simplified.system = 'You are a helpful professional business assistant for a marketing agency. Provide helpful, professional responses.'
        if (simplified.messages?.length) {
          const lastMsg = simplified.messages[simplified.messages.length - 1]
          if (lastMsg.content?.length > 600) {
            simplified.messages = [{ ...lastMsg, content: lastMsg.content.slice(0, 600) }]
          }
        }
        const retry = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers: HEADERS, body: JSON.stringify({ model: MODEL, ...simplified })
        })
        if (retry.ok) {
          const retryData = await retry.json()
          return retryData.content?.[0]?.text || ''
        }
      }
    } catch {}
    throw new Error(errMsg)
  }
  const data = await res.json()
  return data.content?.[0]?.text || ''
}

export async function callClaude(systemPrompt, userMessage, maxTokens = 2000) {
  if (!API_KEY) throw new Error('NEXT_PUBLIC_ANTHROPIC_API_KEY not set')
  return apiCall({
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  })
}

export async function streamClaude(systemPrompt, messages, maxTokens = 2000, onChunk) {
  if (!API_KEY) throw new Error('NEXT_PUBLIC_ANTHROPIC_API_KEY not set')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, stream: true, system: systemPrompt, messages }),
  })
  if (!res.ok) {
    // Fallback to non-streaming on error
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()
    if (lastUserMsg) {
      const result = await callClaude(systemPrompt, lastUserMsg.content, maxTokens)
      onChunk?.(result)
      return result
    }
    throw new Error(`Claude API error: ${res.status}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6)
      if (raw === '[DONE]') break
      try {
        const parsed = JSON.parse(raw)
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          full += parsed.delta.text
          onChunk?.(full)
        }
      } catch {}
    }
  }
  return full
}

// Generate email content using Claude
export async function generateEmailContent(topic, audience, tone, cta, sections) {
  const prompt = `Generate a professional marketing email with these specifications:
- Topic: ${topic}
- Target audience: ${audience}
- Tone: ${tone}
- Call to action: ${cta}
- Sections to include: ${sections}

Return ONLY a valid JSON object (no markdown, no code fences) with this structure:
{
  "subject": "Email subject line",
  "preview": "Preview text for inbox",
  "blocks": [
    {"type": "header", "data": {"logoText": "Koto", "tagline": "", "bgColor": "#231f20", "textColor": "#ffffff"}},
    {"type": "heading", "data": {"content": "Main Headline", "fontSize": 32, "textColor": "#1a1a1a", "bgColor": "#ffffff", "align": "center", "padding": 32, "fontWeight": 700}},
    {"type": "text", "data": {"content": "Body text here...", "fontSize": 16, "textColor": "#333333", "bgColor": "#ffffff", "align": "left", "padding": 24}},
    {"type": "button", "data": {"text": "CTA Text", "url": "#", "btnColor": "#ea2729", "textColor": "#ffffff", "bgColor": "#ffffff", "align": "center", "padding": 24, "borderRadius": 8}},
    {"type": "footer", "data": {"text": "© 2026 Koto", "links": "Unsubscribe | View in browser", "bgColor": "#f5f5f5", "textColor": "#999999", "padding": 24}}
  ]
}

Available block types: header, footer, text, heading, image, button, divider, spacer, quote, list, hero, twocol.
Generate 5-10 blocks for a well-structured email.`

  return callClaude('You are a professional email copywriter for a marketing agency. Return only valid JSON, no markdown fences.', prompt, 3000)
}

// Generate AI subject lines
export async function generateSubjectLines(campaignName, emailContent) {
  const context = emailContent ? `\n\nEmail content preview: ${emailContent.slice(0, 500)}` : ''
  return callClaude(
    'You are an email marketing expert specializing in subject lines for a professional marketing agency.',
    `Generate 5 compelling email subject lines for a campaign called "${campaignName}".${context}\n\nReturn ONLY the 5 subject lines, one per line. No numbers, no bullets, no quotes.`,
    300
  )
}

// Generate SCOUT business leads (safe prompt)
export async function generateScoutLeads(searchTerms, location, count = 18) {
  const prompt = `Generate ${count} realistic sample business listings for "${searchTerms || 'local businesses'}"${location ? ` in ${location}` : ''}. This is for a marketing agency prospecting tool demo.

Each object needs: business_name, industry, website (example.com format), phone (format: (XXX) 555-XXXX), email (info@domain.com format), city, state (2 letter), zip_code, google_rating (1.0-5.0), google_review_count (integer), agency_likelihood_score (0-100, higher means more likely to need marketing help), opportunities (array of 2-4 strings like "No website analytics", "Inactive social media", "Low review response rate", "No digital advertising"), tech_stack (object: analytics, cms, crm, pixel, chat, email_tool - each boolean), social_media (object: facebook_active, instagram_active, gmb_optimized - each boolean, facebook_followers integer, last_post_days integer).

Return ONLY a valid JSON array.`

  return callClaude('You generate sample business directory data for a marketing agency CRM demo. Return only valid JSON arrays, no markdown.', prompt, 4000)
}
