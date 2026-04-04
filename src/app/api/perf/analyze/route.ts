import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const ai = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
})

// ── Inline deterministic rules (TS port of perfRules.js) ─────────────────────
const T = {
  WASTE_SPEND_MIN: 20, WASTE_TERM_SPEND_MIN: 8,
  LOW_QS_THRESHOLD: 5, LOST_IS_BUDGET_MIN: 20, LOST_IS_RANK_MIN: 25,
  LOW_ROAS_THRESHOLD: 1.5, HIGH_ROAS_THRESHOLD: 5.0,
  PAGE_SCORE_MIN: 60, PAGE_SCORE_GOOD: 75,
  HIGH_SPEND_CAMPAIGN: 500,
}

function ruleWastedKeywords(keywords: any[]) {
  const wasted = keywords.filter(k => (k.cost||0) >= T.WASTE_SPEND_MIN && (k.conversions||0) < 0.5 && k.status !== 'PAUSED')
  if (!wasted.length) return null
  const totalWaste = wasted.reduce((s,k) => s+(k.cost||0), 0)
  return { ruleId:'wasted_keywords', type:'keyword_pause', priority: totalWaste>200?'high':'medium',
    confidence:0.95, impactVal:Math.round(totalWaste),
    title:`${wasted.length} keywords spending $${Math.round(totalWaste)} with 0 conversions`,
    finding:`${wasted.length} active keywords have spent $${Math.round(totalWaste)} and generated 0 conversions in 30 days.`,
    evidence: wasted.sort((a,b)=>(b.cost||0)-(a.cost||0)).slice(0,8).map((k:any)=>`"${k.keyword}" — $${(k.cost||0).toFixed(0)} spent, ${k.clicks||0} clicks, QS=${k.quality_score||'?'}`),
    currentState:{keywords_count:wasted.length,total_wasted:Math.round(totalWaste)},
    recommendedChange:{action:'pause_or_review',keywords:wasted.slice(0,10).map((k:any)=>k.keyword)} }
}

function ruleWastedSearchTerms(searchTerms: any[]) {
  const wasted = searchTerms.filter(st => (st.cost||0) >= T.WASTE_TERM_SPEND_MIN && (st.conversions||0) < 0.5 && !st.is_negative)
  if (!wasted.length) return null
  const totalWaste = wasted.reduce((s,st) => s+(st.cost||0), 0)
  return { ruleId:'wasted_search_terms', type:'negative_keyword', priority:totalWaste>150?'high':'medium',
    confidence:0.93, impactVal:Math.round(totalWaste*0.9),
    title:`${wasted.length} irrelevant search terms burning $${Math.round(totalWaste)}`,
    finding:`${wasted.length} search terms triggered ads, spent $${Math.round(totalWaste)}, and converted 0 times. Add as negative keywords.`,
    evidence: wasted.sort((a,b)=>(b.cost||0)-(a.cost||0)).slice(0,10).map((s:any)=>`"${s.search_term}" — $${(s.cost||0).toFixed(0)}, ${s.clicks||0} clicks, 0 conv`),
    currentState:{terms_count:wasted.length,total_waste:Math.round(totalWaste)},
    recommendedChange:{action:'add_negatives',search_terms:wasted.slice(0,20).map((s:any)=>s.search_term)} }
}

function ruleBudgetConstrained(campaigns: any[]) {
  return campaigns
    .filter(c => (c.lost_is_budget||0) >= T.LOST_IS_BUDGET_MIN && (c.roas||0) >= T.LOW_ROAS_THRESHOLD && c.status==='ENABLED')
    .map(c => ({
      ruleId:'budget_'+c.id, type:'budget', confidence:0.88,
      priority:(c.lost_is_budget||0)>40?'high':'medium',
      impactVal: Math.round((c.cost||0)*(c.lost_is_budget||0)/100*(c.roas||1)),
      title:`"${c.name}" losing ${(c.lost_is_budget||0).toFixed(0)}% impressions to budget`,
      finding:`"${c.name}" achieves ${(c.roas||0).toFixed(2)}x ROAS but loses ${(c.lost_is_budget||0).toFixed(0)}% of possible impressions because the budget runs out. It's profitable and underfunded.`,
      evidence:[`ROAS: ${(c.roas||0).toFixed(2)}x`,`Budget: $${c.budget_amount||0}/day`,`Lost IS (budget): ${(c.lost_is_budget||0).toFixed(0)}%`,`Spend: $${(c.cost||0).toFixed(0)}`],
      currentState:{roas:c.roas,budget:c.budget_amount,lost_is_budget:c.lost_is_budget},
      recommendedChange:{action:'increase_budget',campaign:c.name,lost_is_pct:c.lost_is_budget}
    }))
}

function ruleLowQS(keywords: any[]) {
  const lowQS = keywords.filter(k => k.quality_score && k.quality_score <= T.LOW_QS_THRESHOLD && (k.impressions||0)>100 && k.status==='ENABLED')
  if (!lowQS.length) return null
  const totalCPCPremium = lowQS.reduce((s,k) => s+((k.avg_cpc||0)*0.3*(k.clicks||0)), 0)
  return { ruleId:'low_qs', type:'bid', priority:lowQS.length>5?'high':'medium',
    confidence:0.85, impactVal:Math.round(totalCPCPremium),
    title:`${lowQS.length} keywords with quality score ≤ ${T.LOW_QS_THRESHOLD}`,
    finding:`${lowQS.length} keywords have QS ≤ ${T.LOW_QS_THRESHOLD}. Low QS forces Google to charge ~30% more per click and show ads less often. Estimated extra cost: $${Math.round(totalCPCPremium)}.`,
    evidence:lowQS.slice(0,8).map((k:any)=>`"${k.keyword}" — QS=${k.quality_score}, $${(k.avg_cpc||0).toFixed(2)} CPC`),
    currentState:{count:lowQS.length,est_premium:Math.round(totalCPCPremium)},
    recommendedChange:{action:'improve_ad_relevance_landing_pages',keywords:lowQS.slice(0,5).map((k:any)=>k.keyword)} }
}

function ruleLowROAS(campaigns: any[]) {
  return campaigns
    .filter(c => (c.roas||0)>0 && (c.roas||0)<T.LOW_ROAS_THRESHOLD && (c.cost||0)>100 && c.status==='ENABLED')
    .map(c => ({
      ruleId:'low_roas_'+c.id, type:'bid', priority:(c.cost||0)>T.HIGH_SPEND_CAMPAIGN?'high':'medium',
      confidence:0.82, impactVal:Math.round((c.cost||0)*(T.LOW_ROAS_THRESHOLD-(c.roas||0))),
      title:`"${c.name}" ROAS ${(c.roas||0).toFixed(2)}x — below breakeven`,
      finding:`"${c.name}" spent $${(c.cost||0).toFixed(0)} and returned ${(c.roas||0).toFixed(2)}x ROAS. Below ${T.LOW_ROAS_THRESHOLD}x is typically unprofitable.`,
      evidence:[`ROAS: ${(c.roas||0).toFixed(2)}x`,`Spend: $${(c.cost||0).toFixed(0)}`,`CPA: $${(c.cpa||0).toFixed(0)}`,`Bidding: ${c.bidding_strategy||'unknown'}`],
      currentState:{roas:c.roas,spend:c.cost,cpa:c.cpa},
      recommendedChange:{action:'review_bidding_and_targeting',campaign:c.name}
    }))
}

function ruleLostISRank(campaigns: any[]) {
  return campaigns
    .filter(c => (c.lost_is_rank||0)>=T.LOST_IS_RANK_MIN && (c.cost||0)>100 && c.status==='ENABLED')
    .map(c => ({
      ruleId:'lost_is_rank_'+c.id, type:'bid', priority:(c.lost_is_rank||0)>40?'high':'medium',
      confidence:0.83, impactVal:Math.round((c.cost||0)*(c.lost_is_rank||0)/100),
      title:`"${c.name}" losing ${(c.lost_is_rank||0).toFixed(0)}% impressions to ad rank`,
      finding:`"${c.name}" is losing ${(c.lost_is_rank||0).toFixed(0)}% of possible impressions because competitors outrank the ads. This is a quality score or bid issue, not a budget constraint.`,
      evidence:[`Lost IS (rank): ${(c.lost_is_rank||0).toFixed(0)}%`,`Impression share: ${(c.impression_share||0).toFixed(0)}%`,`Bidding: ${c.bidding_strategy||'unknown'}`],
      currentState:{lost_is_rank:c.lost_is_rank,impression_share:c.impression_share},
      recommendedChange:{action:'improve_quality_score_or_bids',campaign:c.name}
    }))
}

function ruleWeakPages(pages: any[]) {
  if (!pages.length) return null
  const weak   = pages.filter(p => p.ai_score && p.ai_score < T.PAGE_SCORE_MIN)
  const strong = pages.filter(p => p.ai_score && p.ai_score >= T.PAGE_SCORE_GOOD)
  if (!weak.length || !strong.length) return null
  return { ruleId:'weak_landing_pages', type:'landing_page', priority:weak.length>2?'high':'medium',
    confidence:0.78, impactVal:weak.length*60,
    title:`${weak.length} weak landing pages vs ${strong.length} stronger alternatives`,
    finding:`${weak.length} pages score below ${T.PAGE_SCORE_MIN}/100 for paid traffic suitability while ${strong.length} pages score above ${T.PAGE_SCORE_GOOD}. Routing traffic to stronger pages should improve conv rate and quality score.`,
    evidence:[...weak.slice(0,3).map((p:any)=>`Weak: ${p.url} (score ${p.ai_score})`), ...strong.slice(0,3).map((p:any)=>`Better: ${p.url} (score ${p.ai_score}, ${p.has_cta?'has CTA':'no CTA'})`)],
    currentState:{weak_pages:weak.length,strong_pages:strong.length},
    recommendedChange:{action:'switch_landing_pages',from:weak.slice(0,3).map((p:any)=>p.url),to:strong.slice(0,3).map((p:any)=>p.url)} }
}

function ruleAnomalies(snapshots: any[]) {
  const findings = []
  if (snapshots.length < 14) return findings
  const sorted = [...snapshots].sort((a,b) => new Date(a.snapshot_date).getTime()-new Date(b.snapshot_date).getTime())
  const recent = sorted.slice(-7), prev = sorted.slice(-14,-7)
  const avg = (arr:any[], key:string) => arr.reduce((s,d)=>s+(d[key]||0),0)/(arr.length||1)
  const checks = [
    {key:'ads_roas',label:'ROAS',dir:'down',threshold:25,sev:'high'},
    {key:'ads_spend',label:'Ad spend',dir:'up',threshold:35,sev:'medium'},
    {key:'ads_cpa',label:'CPA',dir:'up',threshold:30,sev:'high'},
  ]
  for (const c of checks) {
    const rAvg = avg(recent,c.key), pAvg = avg(prev,c.key)
    if (!pAvg) continue
    const pct = ((rAvg-pAvg)/pAvg)*100
    const hit = c.dir==='down'?pct<=-c.threshold:pct>=c.threshold
    if (hit) findings.push({
      ruleId:'anomaly_'+c.key, type:'bid', priority:c.sev==='high'?'high':'medium',
      confidence:0.90, impactVal:Math.round(Math.abs(rAvg-pAvg)*30),
      title:`${c.label} ${c.dir==='down'?'dropped':'spiked'} ${Math.abs(pct).toFixed(0)}% vs prior week`,
      finding:`${c.label} changed ${pct.toFixed(1)}% vs previous 7-day period. Recent avg: ${rAvg.toFixed(2)}, Prior avg: ${pAvg.toFixed(2)}.`,
      evidence:[`Prior 7d avg: ${pAvg.toFixed(2)}`,`Recent 7d avg: ${rAvg.toFixed(2)}`,`Change: ${pct.toFixed(1)}%`],
      currentState:{metric:c.key,recent:rAvg,prev:pAvg,pct_change:pct},
      recommendedChange:{action:'investigate',metric:c.label}
    })
  }
  return findings
}

function runRules(data: any) {
  const { campaigns=[], keywords=[], searchTerms=[], pages=[], snapshots=[] } = data
  const all: any[] = [
    ruleWastedKeywords(keywords), ruleWastedSearchTerms(searchTerms),
    ruleLowQS(keywords), ruleWeakPages(pages),
    ...ruleBudgetConstrained(campaigns), ...ruleLowROAS(campaigns),
    ...ruleLostISRank(campaigns), ...ruleAnomalies(snapshots),
  ].flat().filter(Boolean)
  const priOrder: Record<string,number> = {high:0,medium:1,low:2}
  return all
    .sort((a,b) => (priOrder[a.priority]||1)-(priOrder[b.priority]||1)||(b.impactVal||0)-(a.impactVal||0))
    .slice(0,12)
}

// ── Claude explains proven findings ──────────────────────────────────────────
async function claudeExplain(findings: any[], clientName: string) {
  if (!findings.length) return findings

  const prompt = `You are a Google Ads expert advisor. The following findings were PROVEN by deterministic analysis (math, not guesses). For each finding, write:
1. A specific, actionable recommendation (2-3 sentences, reference exact numbers from the finding)
2. An estimated impact string (e.g. "Save $420/mo" or "+18% ROAS")
3. The specific action the account manager should take this week

Client: ${clientName || 'this client'}

FINDINGS (DO NOT CHANGE priority, confidence, type, or impactVal — these are mathematically proven):
${findings.map((f,i) => `
FINDING ${i+1}: ${f.title}
Proof: ${f.finding}
Evidence: ${f.evidence?.join(' | ')}
Current state: ${JSON.stringify(f.currentState)}
Recommended change direction: ${JSON.stringify(f.recommendedChange)}
`).join('\n')}

Return a JSON array with one object per finding IN THE SAME ORDER:
[{
  "description": "specific 2-3 sentence recommendation referencing exact numbers",
  "est_impact": "Save $X/mo or +X% metric",
  "action_this_week": "one specific thing to do this week"
}]
Only return the JSON array. No markdown.`

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role:'user', content:prompt }],
    system: 'You are a Google Ads expert. Add human-readable explanations to pre-proven findings. Return only raw JSON array.',
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  const clean = raw.replace(/```json|```/g,'').trim()
  const s = clean.indexOf('['), e = clean.lastIndexOf(']')
  if (s === -1) return findings

  let explanations: any[] = []
  try { explanations = JSON.parse(clean.slice(s,e+1)) } catch { return findings }

  return findings.map((f, i) => ({
    ...f,
    description:      explanations[i]?.description || f.finding,
    est_impact:       explanations[i]?.est_impact   || `~$${f.impactVal||0} impact`,
    action_this_week: explanations[i]?.action_this_week || '',
  }))
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { clientId, agencyId } = await req.json()
  if (!clientId) return NextResponse.json({ error:'No clientId' }, { status:400 })

  // Load all data
  const [
    {data:campaigns},{data:keywords},{data:searchTerms},{data:pages},{data:snapshots},{data:client}
  ] = await Promise.all([
    supabase.from('perf_campaigns').select('*').eq('client_id', clientId),
    supabase.from('perf_keywords').select('*').eq('client_id', clientId).order('cost',{ascending:false}).limit(200),
    supabase.from('perf_search_terms').select('*').eq('client_id', clientId).order('cost',{ascending:false}).limit(500),
    supabase.from('perf_pages').select('*').eq('client_id', clientId).order('ai_score',{ascending:false}).limit(50),
    supabase.from('perf_snapshots').select('*').eq('client_id', clientId).order('snapshot_date',{ascending:false}).limit(30),
    supabase.from('clients').select('name').eq('id', clientId).single(),
  ])

  if (!campaigns?.length && !keywords?.length) {
    return NextResponse.json({ error:'No data — run sync first', recs:0 })
  }

  // Step 1: Deterministic rules — math proves findings
  const findings = runRules({ campaigns, keywords, searchTerms, pages, snapshots })

  if (!findings.length) {
    return NextResponse.json({ recs:0, message:'No issues detected — account looks healthy', generated_at:new Date().toISOString() })
  }

  // Step 2: Claude adds human-readable explanations only
  const explained = await claudeExplain(findings, client?.name || '')

  // Step 3: Save with full provenance
  const toSave = explained.map(f => ({
    client_id:        clientId,
    agency_id:        agencyId,
    type:             f.type,
    priority:         f.priority,
    title:            f.title,
    description:      f.description || f.finding,
    current_state:    f.currentState || {},
    recommended:      { ...f.recommendedChange, action_this_week: f.action_this_week },
    est_impact:       f.est_impact || '',
    est_impact_val:   f.impactVal || 0,
    confidence:       f.confidence || 0.8,
    data_sources:     ['ads','ga4','gsc'].filter(Boolean),
    status:           'pending',
    updated_at:       new Date().toISOString(),
  }))

  // Clear old pending recs for this client, insert fresh
  await supabase.from('perf_recommendations').delete()
    .eq('client_id', clientId).eq('status', 'pending')
  await supabase.from('perf_recommendations').insert(toSave)

  // Save alerts for anomalies
  const anomalies = explained.filter(f => f.ruleId?.startsWith('anomaly_'))
  if (anomalies.length) {
    await supabase.from('perf_alerts').insert(
      anomalies.map(a => ({
        client_id: clientId, agency_id: agencyId,
        alert_type: a.ruleId, severity: a.priority === 'high' ? 'critical' : 'warning',
        title: a.title, detail: a.description,
        metric_name: a.currentState?.metric, metric_value: a.currentState?.recent,
        metric_prev: a.currentState?.prev, pct_change: a.currentState?.pct_change,
      }))
    )
  }

  return NextResponse.json({
    recs:       toSave.length,
    high:       toSave.filter(r=>r.priority==='high').length,
    medium:     toSave.filter(r=>r.priority==='medium').length,
    est_total_impact: toSave.reduce((s,r)=>s+(r.est_impact_val||0),0),
    rules_fired: findings.map(f => f.ruleId),
    generated_at: new Date().toISOString(),
  })
}