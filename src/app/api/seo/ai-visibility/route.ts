import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

// Test prompts that simulate what real users ask AI systems
function generateTestPrompts(businessName: string, industry: string, location: string, services: string[]) {
  const loc = location || 'my area'
  const svc = services[0] || industry || 'services'
  return [
    `What are the best ${svc} companies in ${loc}?`,
    `Who is the top ${industry} business in ${loc}?`,
    `Recommend a good ${svc} provider near ${loc}`,
    `I need ${svc} in ${loc} - who should I hire?`,
    `What is ${businessName} known for?`,
    `Is ${businessName} a reputable ${industry} company?`,
    `Compare ${businessName} to other ${industry} companies in ${loc}`,
    `Who does ${industry} best in ${loc}?`,
  ]
}

async function testClaudeVisibility(prompts: string[], businessName: string) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const results = []
  for (const prompt of prompts.slice(0, 6)) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const d = await res.json()
      const response = d.content?.[0]?.text || ''
      const mentioned = response.toLowerCase().includes(businessName.toLowerCase())
      const positively = mentioned && !response.toLowerCase().includes('not recommended') && !response.toLowerCase().includes('avoid')

      results.push({
        prompt,
        response: response.slice(0, 300),
        mentioned,
        positively,
        source: 'Claude (Anthropic)',
      })
    } catch { results.push({ prompt, response: '', mentioned: false, positively: false, source: 'Claude (Anthropic)', error: true }) }
  }
  return results
}

async function generateVisibilityReport(results: any[], businessName: string, industry: string, location: string) {
  if (!ANTHROPIC_KEY) return null
  const mentionRate = results.filter(r => r.mentioned).length / results.length * 100

  const prompt = `You are an AI visibility consultant. Analyze how well "${businessName}" (${industry} in ${location}) appears in AI assistant responses.

Test results (${results.length} prompts tested):
- Mentioned in ${results.filter(r=>r.mentioned).length} of ${results.length} responses (${Math.round(mentionRate)}%)
- Positive mentions: ${results.filter(r=>r.positively).length}

Prompts and responses:
${results.map(r=>`Q: ${r.prompt}\nMentioned: ${r.mentioned?'YES':'NO'}\nResponse snippet: ${r.response.slice(0,150)}`).join('\n\n')}

Return ONLY valid JSON:
{
  "visibility_score": 0-100,
  "grade": "A|B|C|D|F",
  "summary": "2 sentence assessment of their AI visibility",
  "why_appearing": "why they show up when they do",
  "why_missing": "why they don't show up more",
  "optimization_tips": [
    {"tip": "specific action", "impact": "high|medium|low", "effort": "easy|medium|hard"}
  ],
  "content_to_create": ["content type that would improve AI visibility"],
  "schema_recommendations": ["schema markup to add"],
  "next_steps": ["step 1", "step 2", "step 3"]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST', headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01'},
    body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:900, messages:[{role:'user',content:prompt}] })
  })
  if (!res.ok) return null
  const d = await res.json()
  try {
    let text = d.content?.[0]?.text?.trim()||'{}'
    text = text.replace(/^```json\n?/,'').replace(/\n?```$/,'').trim()
    const s=text.indexOf('{'),e=text.lastIndexOf('}')
    return JSON.parse(s>=0&&e>s?text.slice(s,e+1):text)
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const { business_name, industry, location, services = [], website } = await req.json()
    if (!business_name) return NextResponse.json({error:'business_name required'},{status:400})

    const prompts = generateTestPrompts(business_name, industry||'business', location||'', services)
    const claudeResults = await testClaudeVisibility(prompts, business_name)
    const report = await generateVisibilityReport(claudeResults, business_name, industry||'business', location||'')

    const mentionRate = claudeResults.filter(r=>r.mentioned).length / claudeResults.length * 100

    return NextResponse.json({
      business_name, industry, location, website,
      tested_at: new Date().toISOString(),
      engines_tested: ['Claude (Anthropic)'],
      total_prompts: claudeResults.length,
      mention_rate: Math.round(mentionRate),
      positive_rate: Math.round(claudeResults.filter(r=>r.positively).length / claudeResults.length * 100),
      results: claudeResults,
      report,
    })
  } catch(e:any) { return NextResponse.json({error:e.message},{status:500}) }
}
