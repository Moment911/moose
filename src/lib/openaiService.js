// OpenAI / GPT-4o service - optional, gracefully falls back if no key
const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY

export async function callChatGPT(prompt, options = {}) {
  if (!API_KEY) {
    // No OpenAI key - return null so callers can fall back to Claude
    console.warn('VITE_OPENAI_API_KEY not set - GPT analysis skipped')
    return null
  }
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: options.model || 'gpt-4o',
        max_tokens: options.maxTokens || 2000,
        temperature: 0.7,
        messages: [
          { role: 'system', content: options.system || 'You are a senior SEO and digital marketing expert. Provide analysis in valid JSON format.' },
          { role: 'user', content: prompt },
        ],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch { return null }
}
