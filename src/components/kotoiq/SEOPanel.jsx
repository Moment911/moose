"use client"
import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Loader2, RefreshCw, Globe, AlertTriangle, ExternalLink, CheckCircle, XCircle, Edit2, Save, X, Sparkles, BarChart2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB, DESIGN } from '../../lib/theme'
import { analyzeSEO } from '../../lib/seoAnalyzer'

/**
 * SEOPanel — KotoIQ's built-in SEO engine with inline editing.
 *
 * View SEO meta for every page, edit titles/descriptions/keywords inline,
 * and auto-push changes to the WordPress site via the sync endpoint.
 */

// ── Inline editor for a single page's SEO meta ──────────────────────────
// ── SEO Score ring (mini) ────────────────────────────────────────────────
function MiniScoreRing({ score, size = 32 }) {
  const color = score >= 80 ? GRN : score >= 60 ? AMB : score >= 40 ? '#f97316' : '#DC2626'
  const radius = size / 2 - 3
  const circ = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} stroke={DESIGN.colors.border} strokeWidth="3" fill="none" />
        <circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth="3" fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color, fontFamily: FB }}>{score}</div>
    </div>
  )
}

// ── Analysis section for a page ─────────────────────────────────────────
function AnalysisSection({ title: sectionTitle, checks, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const passed = checks.filter(c => c.status === 'pass').length
  const failed = checks.filter(c => c.status === 'fail').length
  const warns = checks.filter(c => c.status === 'warn').length
  return (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 0',
        border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FB, textAlign: 'left',
      }}>
        <ChevronDown size={12} color={DESIGN.colors.textMuted} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 150ms' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: DESIGN.colors.navy, flex: 1 }}>{sectionTitle}</span>
        {failed > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: '#DC262612', padding: '2px 8px', borderRadius: 10 }}>{failed} Error{failed > 1 ? 's' : ''}</span>}
        {warns > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: AMB, background: AMB + '12', padding: '2px 8px', borderRadius: 10 }}>{warns} Warning{warns > 1 ? 's' : ''}</span>}
        {failed === 0 && warns === 0 && <span style={{ fontSize: 11, fontWeight: 600, color: GRN, background: GRN + '12', padding: '2px 8px', borderRadius: 10 }}>All passed</span>}
      </button>
      {open && (
        <div style={{ paddingLeft: 4, paddingBottom: 8 }}>
          {checks.map((check, i) => (
            <div key={check.id + i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', fontSize: 13, fontFamily: FB }}>
              {check.status === 'pass' ? <CheckCircle size={14} color={GRN} style={{ marginTop: 2, flexShrink: 0 }} /> :
               check.status === 'warn' ? <AlertTriangle size={14} color={AMB} style={{ marginTop: 2, flexShrink: 0 }} /> :
               <XCircle size={14} color="#DC2626" style={{ marginTop: 2, flexShrink: 0 }} />}
              <div>
                <div style={{ color: check.status === 'pass' ? DESIGN.colors.textSecondary : DESIGN.colors.navy, lineHeight: 1.4 }}>{check.label}</div>
                {check.suggestion && <div style={{ fontSize: 12, color: DESIGN.colors.textMuted, marginTop: 2 }}>{check.suggestion}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PageEditor({ page, siteId, onSaved, siteDiag, allPages, companyProfile }) {
  const [editing, setEditing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [saving, setSaving] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [title, setTitle] = useState(page.seo_title || '')
  const [desc, setDesc] = useState(page.meta_desc || '')
  const [kw, setKw] = useState(page.focus_kw || '')
  const [faqSchema, setFaqSchema] = useState(null)
  const [contentFixing, setContentFixing] = useState(false) // 'auto' | 'checklist' | false
  const [checklist, setChecklist] = useState(null)
  const [autoFixResult, setAutoFixResult] = useState(null)

  // Fetch content and run content fix (auto or checklist mode)
  const runContentFix = async (mode) => {
    setContentFixing(mode)
    try {
      const cr = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kotoiq_seo_content_get', site_id: siteId, post_id: page.id }),
      })
      const cd = await cr.json()
      const content = cd?.data?.content || cd?.data?.content_html || ''

      const res = await fetch('/api/wp/seo-content-fix', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          site_id: siteId,
          post_id: page.id,
          page_title: page.title,
          page_url: page.url,
          page_slug: page.slug,
          page_content: content,
          page_type: page.type,
          word_count: page.word_count,
          focus_keyword: kw || page.focus_kw,
          seo_title: title || page.seo_title,
          meta_description: desc || page.meta_desc,
          business_name: companyProfile?.business_name || siteDiag?.site_name,
          industry: companyProfile?.industry,
          location: companyProfile?.location,
          target_customer: companyProfile?.target_customer,
          services: companyProfile?.services,
          unique_value: companyProfile?.unique_value,
          company_summary: companyProfile?.summary,
        }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setContentFixing(false); return }

      if (mode === 'checklist') {
        setChecklist(data)
        toast.success(`Checklist ready: ${data.fixes?.length || 0} fixes identified`)
      } else {
        setAutoFixResult(data)
        if (data.pushed) {
          toast.success(`Content optimized and pushed to WordPress! Estimated score: ${data.estimated_score}/100`)
          if (onSaved) onSaved()
        } else {
          toast.success(`Content optimized. Estimated score: ${data.estimated_score}/100`)
        }
      }
    } catch (e) { toast.error('Content fix failed: ' + e.message) }
    setContentFixing(false)
  }

  // Quick score on mount — uses available data without fetching content.
  // Gives an instant score for every row in the table.
  const [quickScore, setQuickScore] = useState(null)
  useEffect(() => {
    const siteUrl = page.url ? (() => { try { return new URL(page.url).origin } catch { return '' } })() : ''
    const result = analyzeSEO({
      title: page.title,
      url: page.url,
      slug: page.slug,
      content: '',  // no content yet — checks that need content will fail, which is accurate
      seo_title: page.seo_title || page.title || '',
      meta_desc: page.meta_desc || '',
      focus_kw: page.focus_kw || '',
      word_count: page.word_count || 0,
      type: page.type,
    }, siteUrl)
    setQuickScore(result.score)
  }, [page.seo_title, page.meta_desc, page.focus_kw, page.word_count])

  // Re-score whenever the user edits fields (live feedback while typing)
  useEffect(() => {
    if (!editing) return
    const siteUrl = page.url ? (() => { try { return new URL(page.url).origin } catch { return '' } })() : ''
    const result = analyzeSEO({
      title: page.title, url: page.url, slug: page.slug, content: '',
      seo_title: title || page.title || '',
      meta_desc: desc || '',
      focus_kw: kw || '',
      word_count: page.word_count || 0,
      type: page.type,
    }, siteUrl)
    setQuickScore(result.score)
    if (analysis) setAnalysis(null) // clear deep analysis when fields change
  }, [title, desc, kw, editing])

  // AI writes everything: keyword, title, description, FAQ schema
  const aiOptimize = async () => {
    setAiGenerating(true)
    try {
      // Fetch full page content
      const contentRes = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kotoiq_seo_content_get', site_id: siteId, post_id: page.id }),
      })
      const contentData = await contentRes.json()
      const pageContent = contentData?.data?.content || contentData?.data?.content_html || ''

      // Call AI optimizer with full business context
      const res = await fetch('/api/wp/seo-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_title: page.title,
          page_url: page.url,
          page_content: pageContent,
          page_type: page.type,
          business_name: companyProfile?.business_name || siteDiag?.site_name || '',
          tagline: siteDiag?.tagline || '',
          site_url: siteDiag?.site_url || '',
          industry: companyProfile?.industry || '',
          location: companyProfile?.location || '',
          target_customer: companyProfile?.target_customer || '',
          unique_value: companyProfile?.unique_value || '',
          services: companyProfile?.services || '',
          company_summary: companyProfile?.summary || '',
          all_pages: (allPages || []).map(p => ({ title: p.title, url: p.url })),
        }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setAiGenerating(false); return }

      // Fill fields with AI results
      setKw(data.focus_keyword || '')
      setTitle(data.seo_title || '')
      setDesc(data.meta_description || '')
      setFaqSchema(data.faq_schema || null)
      setAiResult(data)
      setEditing(true)
      toast.success('AI generated SEO + AEO optimization. Review and save.')
    } catch (e) {
      toast.error('AI optimization failed: ' + e.message)
    }
    setAiGenerating(false)
  }

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      // Fetch full page content for analysis
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kotoiq_seo_content_get', site_id: siteId, post_id: page.id }),
      })
      const data = await res.json()
      const content = data?.data?.content || data?.data?.content_html || ''
      const siteUrl = page.url ? new URL(page.url).origin : ''

      const result = analyzeSEO({
        title: page.title,
        url: page.url,
        slug: page.slug,
        content,
        seo_title: title || page.seo_title || page.title,
        meta_desc: desc || page.meta_desc || '',
        focus_kw: kw || page.focus_kw || '',
        word_count: page.word_count || 0,
        type: page.type,
      }, siteUrl)

      setAnalysis(result)
    } catch (e) {
      toast.error('Analysis failed: ' + e.message)
    }
    setAnalyzing(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      // Push SEO meta update to the WP site via sync
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_push',
          site_id: siteId,
          changes: [{
            type: 'seo_meta',
            post_id: page.id,
            data: {
              seo_title: title,
              meta_description: desc,
              focus_keyword: kw,
            },
          }],
        }),
      })
      const data = await res.json()
      if (data.ok !== false && data.applied > 0) {
        toast.success(`SEO meta updated for "${page.title}"`)
        setEditing(false)
        if (onSaved) onSaved()
      } else {
        toast.error(data.error || 'Failed to push update')
      }
    } catch (e) {
      toast.error(e.message)
    }
    setSaving(false)
  }

  const cancel = () => {
    setTitle(page.seo_title || '')
    setDesc(page.meta_desc || '')
    setKw(page.focus_kw || '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <>
        <tr style={{ borderTop: `1px solid ${DESIGN.colors.borderLight}` }}
          onMouseEnter={e => e.currentTarget.style.background = DESIGN.colors.warmGray}
          onMouseLeave={e => e.currentTarget.style.background = analysis ? DESIGN.colors.warmGray : 'transparent'}>
          <td style={td()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MiniScoreRing score={analysis ? analysis.score : (quickScore ?? 0)} />
              <div>
                <div style={{ fontFamily: FB, fontWeight: 600, color: DESIGN.colors.navy, fontSize: 13 }}>{page.title || '(untitled)'}</div>
                {page.meta_desc && <div style={{ fontSize: 12, color: DESIGN.colors.textSecondary, marginTop: 3, lineHeight: 1.4, maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.meta_desc}</div>}
                <a href={page.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: DESIGN.colors.pink, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
                  view <ExternalLink size={9} />
                </a>
              </div>
            </div>
          </td>
          <td style={td()}><Pill>{page.type}</Pill></td>
          <td style={td()}>{page.focus_kw ? <code style={{ fontSize: 12, color: DESIGN.colors.pink, fontFamily: DESIGN.fonts.mono }}>{page.focus_kw}</code> : <span style={{ color: DESIGN.colors.textMuted }}>—</span>}</td>
          <td style={{ ...td(), textAlign: 'center' }}>
            {page.has_seo_meta ? <CheckCircle size={14} color={GRN} /> : <XCircle size={14} color={DESIGN.colors.border} />}
          </td>
          <td style={{ ...td(), textAlign: 'right', color: DESIGN.colors.textMuted }}>{page.word_count}</td>
          <td style={{ ...td(), textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <button onClick={aiOptimize} disabled={aiGenerating || !!contentFixing} title="AI writes SEO title, description, keyword" style={{
                padding: '5px 9px', borderRadius: 6, border: 'none',
                background: DESIGN.colors.pink, color: '#fff', cursor: aiGenerating ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 600, fontFamily: FB, opacity: aiGenerating ? 0.6 : 1,
              }}>
                {aiGenerating ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={10} />}
                Meta
              </button>
              <button onClick={() => runContentFix('auto')} disabled={!!contentFixing || aiGenerating} title="AI rewrites page content to maximize SEO score, then pushes to WordPress" style={{
                padding: '5px 9px', borderRadius: 6, border: 'none',
                background: DESIGN.colors.navy, color: '#fff', cursor: contentFixing ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 600, fontFamily: FB, opacity: contentFixing === 'auto' ? 0.6 : 1,
              }}>
                {contentFixing === 'auto' ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={10} />}
                Fix
              </button>
              <button onClick={() => runContentFix('checklist')} disabled={!!contentFixing || aiGenerating} title="AI generates a manual checklist of what to fix" style={{
                padding: '5px 9px', borderRadius: 6, border: `1px solid ${DESIGN.colors.border}`,
                background: '#fff', cursor: contentFixing ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 600, color: DESIGN.colors.navy, fontFamily: FB,
                opacity: contentFixing === 'checklist' ? 0.6 : 1,
              }}>
                {contentFixing === 'checklist' ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <BarChart2 size={10} />}
                Audit
              </button>
              <button onClick={() => setEditing(true)} title="Edit SEO meta manually" style={{
                padding: '5px 9px', borderRadius: 6, border: `1px solid ${DESIGN.colors.border}`,
                background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 600, color: DESIGN.colors.navy, fontFamily: FB,
              }}>
                <Edit2 size={10} />
              </button>
            </div>
          </td>
        </tr>
        {/* Analysis results row */}
        {analysis && (
          <tr style={{ background: DESIGN.colors.warmGray }}>
            <td colSpan={6} style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 200, flex: 1 }}>
                  <AnalysisSection title="Basic SEO" checks={analysis.sections.basicSeo} defaultOpen={true} />
                </div>
                <div style={{ minWidth: 200, flex: 1 }}>
                  <AnalysisSection title="Additional" checks={analysis.sections.additional} defaultOpen={false} />
                </div>
                <div style={{ minWidth: 200, flex: 1 }}>
                  <AnalysisSection title="Title Readability" checks={analysis.sections.titleReadability} defaultOpen={false} />
                  <AnalysisSection title="Content Readability" checks={analysis.sections.contentReadability} defaultOpen={false} />
                </div>
              </div>
            </td>
          </tr>
        )}
        {/* Checklist results */}
        {checklist && (
          <tr style={{ background: '#fff' }}>
            <td colSpan={6} style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: DESIGN.colors.navy, fontFamily: FB }}>SEO Fix Checklist</div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, background: `${DESIGN.colors.pink}12`, color: DESIGN.colors.pink, fontSize: 12, fontWeight: 600 }}>
                    {checklist.score_before}/100 → {checklist.score_after}/100
                  </span>
                </div>
                <button onClick={() => setChecklist(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: DESIGN.colors.textMuted }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(checklist.fixes || []).map((fix, i) => (
                  <div key={i} style={{
                    padding: '12px 14px', borderRadius: 10,
                    background: fix.status === 'pass' ? `${GRN}08` : fix.status === 'warn' ? `${AMB}08` : '#DC262608',
                    border: `1px solid ${fix.status === 'pass' ? GRN + '20' : fix.status === 'warn' ? AMB + '20' : '#DC262620'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: fix.status === 'pass' ? 0 : 6 }}>
                      {fix.status === 'pass' ? <CheckCircle size={14} color={GRN} /> : fix.status === 'warn' ? <AlertTriangle size={14} color={AMB} /> : <XCircle size={14} color="#DC2626" />}
                      <span style={{ fontSize: 13, fontWeight: 600, color: DESIGN.colors.navy, flex: 1, fontFamily: FB }}>{fix.check}</span>
                      {fix.impact && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: fix.impact === 'high' ? '#DC262612' : fix.impact === 'medium' ? AMB + '12' : DESIGN.colors.warmGray, color: fix.impact === 'high' ? '#DC2626' : fix.impact === 'medium' ? AMB : DESIGN.colors.textMuted }}>{fix.impact}</span>}
                    </div>
                    {fix.status !== 'pass' && (
                      <div style={{ paddingLeft: 22 }}>
                        {fix.current && <div style={{ fontSize: 12, color: DESIGN.colors.textMuted, marginBottom: 3, fontFamily: FB }}>Current: {fix.current}</div>}
                        <div style={{ fontSize: 13, color: DESIGN.colors.navy, fontFamily: FB, lineHeight: 1.5 }}>Fix: {fix.fix}</div>
                        {fix.location && <div style={{ fontSize: 11, color: DESIGN.colors.textMuted, marginTop: 3 }}>Location: {fix.location}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </td>
          </tr>
        )}
        {/* Auto-fix results */}
        {autoFixResult && (
          <tr style={{ background: `${GRN}06` }}>
            <td colSpan={6} style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} color={GRN} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: DESIGN.colors.navy, fontFamily: FB }}>
                    Content Optimized {autoFixResult.pushed ? '& Pushed to WordPress' : ''}
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, background: `${GRN}12`, color: GRN, fontSize: 12, fontWeight: 700 }}>
                    Est. {autoFixResult.estimated_score}/100
                  </span>
                </div>
                <button onClick={() => setAutoFixResult(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: DESIGN.colors.textMuted }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: DESIGN.colors.navy, marginBottom: 8, fontFamily: FB }}>Changes made:</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: DESIGN.colors.textSecondary, fontFamily: FB, lineHeight: 1.6 }}>
                {(autoFixResult.changes_made || []).map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </td>
          </tr>
        )}
      </>
    )
  }

  // Editing mode — expanded row with input fields
  return (
    <>
      <tr style={{ borderTop: `1px solid ${DESIGN.colors.pink}40`, background: `${DESIGN.colors.pink}06` }}>
        <td colSpan={6} style={{ padding: '16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: FB, fontWeight: 700, color: DESIGN.colors.navy, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MiniScoreRing score={quickScore ?? 0} size={36} />
              <div>
                <div>Editing SEO for: {page.title}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: DESIGN.colors.textMuted, marginTop: 2 }}>Score updates as you type</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={aiOptimize} disabled={aiGenerating || saving} style={{
                padding: '6px 14px', borderRadius: 50, border: `1px solid ${DESIGN.colors.pink}40`,
                background: `${DESIGN.colors.pink}08`, color: DESIGN.colors.pink, fontSize: 12, fontWeight: 600,
                fontFamily: FB, cursor: aiGenerating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                opacity: aiGenerating ? 0.6 : 1,
              }}>
                {aiGenerating ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
                {aiGenerating ? 'Generating...' : 'AI Optimize'}
              </button>
              <button onClick={cancel} disabled={saving} style={{
                padding: '6px 14px', borderRadius: 50, border: `1px solid ${DESIGN.colors.border}`,
                background: '#fff', color: DESIGN.colors.navy, fontSize: 12, fontWeight: 600,
                fontFamily: FB, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <X size={12} /> Cancel
              </button>
              <button onClick={save} disabled={saving} style={{
                padding: '6px 14px', borderRadius: 50, border: 'none',
                background: DESIGN.colors.pink, color: '#fff', fontSize: 12, fontWeight: 600,
                fontFamily: FB, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
                {saving ? 'Pushing...' : 'Save & Push to Site'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>SEO Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder={page.title}
                style={inp()} />
              <div style={{ fontSize: 11, color: title.length > 60 ? AMB : DESIGN.colors.textMuted, marginTop: 3 }}>
                {title.length}/60 characters {title.length > 60 ? '(too long)' : ''}
              </div>
            </div>
            <div>
              <label style={lbl}>Focus Keyword</label>
              <input value={kw} onChange={e => setKw(e.target.value)} placeholder="e.g. plumber fort lauderdale"
                style={inp()} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={lbl}>Meta Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Write a compelling description for search results..."
              rows={3} style={{ ...inp(), resize: 'vertical', lineHeight: 1.5 }} />
            <div style={{ fontSize: 11, color: desc.length > 160 ? AMB : DESIGN.colors.textMuted, marginTop: 3 }}>
              {desc.length}/160 characters {desc.length > 160 ? '(too long for Google snippet)' : ''}
            </div>
          </div>

          {/* AI results: FAQ schema + secondary keywords */}
          {aiResult && (
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* FAQ Schema for AEO */}
              {aiResult.faq_schema && aiResult.faq_schema.length > 0 && (
                <div style={{ padding: '14px 16px', background: DESIGN.colors.warmGray, borderRadius: 10, gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: DESIGN.colors.navy, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} color={DESIGN.colors.pink} /> AEO FAQ Schema (for AI answer engines)
                  </div>
                  {aiResult.faq_schema.map((faq, i) => (
                    <div key={i} style={{ marginBottom: 10, padding: '10px 12px', background: '#fff', borderRadius: 8, border: `1px solid ${DESIGN.colors.border}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: DESIGN.colors.navy, marginBottom: 4 }}>Q: {faq.question}</div>
                      <div style={{ fontSize: 13, color: DESIGN.colors.textSecondary, lineHeight: 1.5 }}>A: {faq.answer}</div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: DESIGN.colors.textMuted, marginTop: 6 }}>
                    This FAQ schema helps ChatGPT, Gemini, and Perplexity cite your page as an answer source.
                  </div>
                </div>
              )}
              {/* Secondary keywords */}
              {aiResult.secondary_keywords && (
                <div style={{ padding: '14px 16px', background: DESIGN.colors.warmGray, borderRadius: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: DESIGN.colors.navy, marginBottom: 8 }}>Related Keywords (LSI)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {aiResult.secondary_keywords.map((k, i) => (
                      <span key={i} style={{ padding: '4px 10px', borderRadius: 20, background: '#fff', border: `1px solid ${DESIGN.colors.border}`, fontSize: 12, color: DESIGN.colors.navy, fontWeight: 500 }}>{k}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* AI reasoning */}
              {aiResult.reasoning && (
                <div style={{ padding: '14px 16px', background: DESIGN.colors.warmGray, borderRadius: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: DESIGN.colors.navy, marginBottom: 6 }}>AI Strategy</div>
                  <div style={{ fontSize: 13, color: DESIGN.colors.textSecondary, lineHeight: 1.5 }}>{aiResult.reasoning}</div>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          <div style={{ marginTop: 14, padding: '14px 16px', background: '#fff', borderRadius: 10, border: `1px solid ${DESIGN.colors.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: DESIGN.colors.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Google Preview</div>
            <div style={{ fontSize: 18, color: '#1a0dab', fontFamily: 'Arial, sans-serif', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title || page.title}
            </div>
            <div style={{ fontSize: 13, color: '#006621', fontFamily: 'Arial, sans-serif', marginBottom: 2 }}>
              {page.url}
            </div>
            <div style={{ fontSize: 13, color: '#545454', fontFamily: 'Arial, sans-serif', lineHeight: 1.5 }}>
              {desc || 'No meta description set. Google will pull text from the page automatically.'}
            </div>
          </div>
        </td>
      </tr>
    </>
  )
}

// ── Company Profile Section ─────────────────────────────────────────────
function CompanyProfile({ siteId, profile, onSave }) {
  const [open, setOpen] = useState(!profile?.summary)
  const [editing, setEditing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [form, setForm] = useState({
    business_name: profile?.business_name || '',
    industry: profile?.industry || '',
    location: profile?.location || '',
    target_customer: profile?.target_customer || '',
    unique_value: profile?.unique_value || '',
    services: profile?.services || '',
    summary: profile?.summary || '',
  })

  const scanAllPages = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/wp/seo-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_business', site_id: siteId }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setScanning(false); return }
      const next = { ...form, ...data }
      setForm(next)
      onSave(next)
      toast.success('AI scanned all pages and built a company profile')
    } catch (e) { toast.error(e.message) }
    setScanning(false)
  }

  const save = () => {
    onSave(form)
    setEditing(false)
    toast.success('Company profile saved')
  }

  return (
    <div style={card()}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', padding: 0,
      }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${DESIGN.colors.navy}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={16} color={DESIGN.colors.navy} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FB, fontWeight: 700, color: DESIGN.colors.navy, fontSize: 15 }}>Company Profile</div>
          <div style={{ fontSize: 13, color: DESIGN.colors.textSecondary, fontFamily: FB, marginTop: 2 }}>
            {form.summary ? 'AI uses this context for all SEO and AEO optimization' : 'Tell the AI about this business so it writes better SEO'}
          </div>
        </div>
        <ChevronDown size={14} color={DESIGN.colors.textMuted} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 150ms' }} />
      </button>

      {open && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${DESIGN.colors.borderLight}` }}>
          {/* AI scan button */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={scanAllPages} disabled={scanning} style={{
              ...primaryBtn(), background: DESIGN.colors.navy,
              opacity: scanning ? 0.6 : 1, cursor: scanning ? 'wait' : 'pointer',
            }}>
              {scanning ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
              {scanning ? 'Scanning all pages...' : 'AI: Scan Site & Build Profile'}
            </button>
            <button onClick={() => setEditing(!editing)} style={miniBtn()}>
              <Edit2 size={12} /> {editing ? 'Close' : 'Edit Manually'}
            </button>
          </div>

          {/* AI-generated summary */}
          {form.summary && !editing && (
            <div style={{ padding: '14px 16px', background: DESIGN.colors.warmGray, borderRadius: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DESIGN.colors.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>AI Business Summary</div>
              <div style={{ fontSize: 14, color: DESIGN.colors.navy, lineHeight: 1.6, fontFamily: FB }}>{form.summary}</div>
            </div>
          )}

          {/* Quick info pills (when not editing) */}
          {!editing && (form.industry || form.location || form.target_customer) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {form.industry && <span style={{ padding: '4px 12px', borderRadius: 20, background: `${DESIGN.colors.pink}10`, color: DESIGN.colors.pink, fontSize: 12, fontWeight: 600 }}>{form.industry}</span>}
              {form.location && <span style={{ padding: '4px 12px', borderRadius: 20, background: `${DESIGN.colors.navy}10`, color: DESIGN.colors.navy, fontSize: 12, fontWeight: 600 }}>{form.location}</span>}
              {form.target_customer && <span style={{ padding: '4px 12px', borderRadius: 20, background: `${GRN}10`, color: GRN, fontSize: 12, fontWeight: 600 }}>{form.target_customer}</span>}
            </div>
          )}

          {/* Edit form */}
          {editing && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Business Name</label>
                <input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} placeholder="e.g. 4R Method" style={inp()} />
              </div>
              <div>
                <label style={lbl}>Industry</label>
                <input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="e.g. Functional Medicine" style={inp()} />
              </div>
              <div>
                <label style={lbl}>Location / Service Area</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Fort Lauderdale, FL" style={inp()} />
              </div>
              <div>
                <label style={lbl}>Target Customer</label>
                <input value={form.target_customer} onChange={e => setForm({ ...form, target_customer: e.target.value })} placeholder="e.g. Adults with chronic health issues" style={inp()} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Key Services (comma-separated)</label>
                <input value={form.services} onChange={e => setForm({ ...form, services: e.target.value })} placeholder="e.g. IV therapy, hormone optimization, weight management" style={inp()} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>What Makes Them Different</label>
                <input value={form.unique_value} onChange={e => setForm({ ...form, unique_value: e.target.value })} placeholder="e.g. Doctor-led, personalized protocols, root cause approach" style={inp()} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Business Summary (AI uses this for every optimization)</label>
                <textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} rows={3} placeholder="AI will generate this when you scan, or write your own..." style={{ ...inp(), resize: 'vertical', lineHeight: 1.5 }} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                <button onClick={save} style={primaryBtn()}>
                  <Save size={12} /> Save Profile
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SEOPanel({ site }) {
  const [diag, setDiag] = useState(null)
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [batchProgress, setBatchProgress] = useState(null)
  // Company profile — persisted in localStorage per site
  const [companyProfile, setCompanyProfile] = useState(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem('kiq_seo_profile_' + site?.id) || '{}') } catch { return {} }
  })
  const saveProfile = (p) => {
    setCompanyProfile(p)
    if (typeof window !== 'undefined') localStorage.setItem('kiq_seo_profile_' + site?.id, JSON.stringify(p))
  }

  const moduleEntry = (site?.wpsc_modules || []).find(m => m?.slug === 'seo')
  const moduleEnabled = moduleEntry ? moduleEntry.enabled !== false : false

  useEffect(() => { if (site?.id && moduleEnabled) load() }, [site?.id, moduleEnabled])

  async function load() {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/wp', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'kotoiq_seo_agency_test', site_id: site.id }) }),
        fetch('/api/wp', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'kotoiq_seo_pages', site_id: site.id }) }),
      ])
      const d1 = await r1.json()
      const d2 = await r2.json()
      if (d1.ok) setDiag(d1.data); else toast.error(d1.error || d1.data?.error || 'Diagnostics failed')
      if (d2.ok) setPages(d2.data?.pages || [])
    } catch (e) { toast.error(e.message) }
    setLoading(false)
  }

  async function rebuildSitemap() {
    setBusy(true)
    try {
      const r = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kotoiq_seo_sitemap_rebuild', site_id: site.id }),
      })
      const d = await r.json()
      if (d.ok) toast.success(`Sitemap rebuilt + pinged ${Object.keys(d.data?.ping?.results || {}).length} engine(s)`)
      else toast.error(d.error || d.data?.error || 'Sitemap rebuild failed')
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  if (!moduleEnabled) {
    return (
      <div style={card()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <AlertTriangle size={16} color={AMB} />
          <div style={{ fontFamily: FB, fontWeight: 700, color: DESIGN.colors.navy, fontSize: 15 }}>SEO module is disabled</div>
        </div>
        <div style={{ fontSize: 14, color: DESIGN.colors.textSecondary, fontFamily: FB }}>
          Enable it from the Control Center modules table to activate SEO meta management, page factory, sitemap rebuild, and auto-ping on publish.
        </div>
      </div>
    )
  }

  const seoPlugin = diag?.seo_engine === 'kotoiq' ? 'KotoIQ (built-in)'
    : diag?.seo_plugin === 'yoast' ? `Yoast ${diag?.yoast_version} (legacy)`
    : diag?.seo_plugin === 'rankmath' ? `Rank Math ${diag?.rankmath_version} (legacy)`
    : 'KotoIQ'

  const pagesWithMeta = pages.filter(p => p.has_seo_meta).length
  const totalPages = pages.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Company Profile — context for all AI optimizations */}
      <CompanyProfile siteId={site.id} profile={companyProfile} onSave={saveProfile} />

      {/* Connection + diagnostics */}
      <div style={card()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={iconWrap}><TrendingUp size={16} color={R} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FB, fontWeight: 700, color: DESIGN.colors.navy, fontSize: 16 }}>SEO & Page Factory</div>
            <div style={{ fontSize: 13, color: DESIGN.colors.textSecondary, fontFamily: FB, marginTop: 2 }}>
              {moduleEntry?.version && <code style={{ marginRight: 6 }}>v{moduleEntry.version}</code>}
              Built-in SEO engine. Edit meta titles, descriptions, and keywords below.
            </div>
          </div>
          <button onClick={load} disabled={loading} style={miniBtn()}>
            {loading ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />} Refresh
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          <Stat label="SEO engine" value={seoPlugin} />
          <Stat label="GSC connected" value={diag?.gsc_connected ? 'Yes' : 'No'} color={diag?.gsc_connected ? GRN : DESIGN.colors.textMuted} />
          <Stat label="Pages indexed" value={totalPages} />
          <Stat label="With meta" value={`${pagesWithMeta}/${totalPages}`} color={pagesWithMeta === totalPages && totalPages > 0 ? GRN : AMB} />
          <Stat label="Last sync" value={diag?.last_sync?.slice(0, 10) || 'never'} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button onClick={async () => {
            const noMeta = pages.filter(p => !p.has_seo_meta)
            const targets = noMeta.length > 0 ? noMeta : pages.slice(0, 10)
            if (!confirm(`AI Optimize ${targets.length} page${targets.length === 1 ? '' : 's'}${noMeta.length > 0 ? ' (all pages missing meta)' : ''}?\n\nThis generates SEO titles, descriptions, keywords, and AEO FAQ schema for each page, then pushes to WordPress.\n\nEstimated cost: ~$${(targets.length * 0.01).toFixed(2)}`)) return
            setBusy(true)
            let done = 0
            setBatchProgress({ current: 0, total: targets.length, currentPage: '' })
            for (const p of targets) {
              setBatchProgress({ current: done, total: targets.length, currentPage: p.title })
              try {
                const cr = await fetch('/api/wp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'kotoiq_seo_content_get', site_id: site.id, post_id: p.id }) })
                const cd = await cr.json()
                const content = cd?.data?.content || ''
                const ar = await fetch('/api/wp/seo-optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_title: p.title, page_url: p.url, page_content: content, page_type: p.type, business_name: companyProfile?.business_name || diag?.site_name, tagline: diag?.tagline, site_url: diag?.site_url, industry: companyProfile?.industry, location: companyProfile?.location, target_customer: companyProfile?.target_customer, unique_value: companyProfile?.unique_value, services: companyProfile?.services, company_summary: companyProfile?.summary, all_pages: pages.map(x => ({ title: x.title, url: x.url })) }) })
                const ai = await ar.json()
                if (ai.focus_keyword) {
                  await fetch('/api/wp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync_push', site_id: site.id, changes: [{ type: 'seo_meta', post_id: p.id, data: { seo_title: ai.seo_title, meta_description: ai.meta_description, focus_keyword: ai.focus_keyword } }] }) })
                  done++
                  setBatchProgress({ current: done, total: targets.length, currentPage: p.title })
                }
              } catch {}
            }
            setBatchProgress(null)
            toast.success(`AI optimized ${done} pages. Refreshing...`)
            await load()
            setBusy(false)
          }} disabled={busy} style={{ ...primaryBtn(), background: DESIGN.colors.navy }}>
            {busy ? <Loader2 size={11} className="spin" /> : <Sparkles size={11} />} AI Optimize All Pages
          </button>
          <button onClick={rebuildSitemap} disabled={busy} style={primaryBtn()}>
            {busy ? <Loader2 size={11} className="spin" /> : <Globe size={11} />} Rebuild sitemap & ping
          </button>
          {diag?.site_url && (<>
            <a href={`${diag.site_url}/kotoiq-sitemap.xml`} target="_blank" rel="noreferrer" style={{ ...miniBtn(), textDecoration: 'none' }}>
              <ExternalLink size={11} /> KotoIQ Sitemap
            </a>
            <a href={`${diag.site_url}/wp-sitemap.xml`} target="_blank" rel="noreferrer" style={{ ...miniBtn(), textDecoration: 'none' }}>
              <ExternalLink size={11} /> WP Sitemap
            </a>
          </>)}
        </div>
      </div>

      {/* Batch progress banner */}
      {batchProgress && (
        <div style={{ background: DESIGN.colors.navy, borderRadius: 14, padding: '18px 22px', color: '#fff', fontFamily: FB }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                AI Optimizing: {batchProgress.current} / {batchProgress.total} pages
              </div>
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {batchProgress.current < batchProgress.total ? `Working on: ${batchProgress.currentPage}` : 'Finishing up...'}
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: FB }}>
              {Math.round((batchProgress.current / batchProgress.total) * 100)}%
            </div>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: DESIGN.colors.pink, borderRadius: 3,
              width: `${(batchProgress.current / batchProgress.total) * 100}%`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}

      {/* Pages with SEO meta — editable */}
      <div style={card({ padding: 0, overflow: 'hidden' })}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${DESIGN.colors.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontFamily: FB, fontWeight: 700, color: DESIGN.colors.navy, fontSize: 14 }}>SEO Meta</span>
            <span style={{ fontSize: 12, color: DESIGN.colors.textMuted, marginLeft: 8 }}>Click Edit to update any page's SEO. Changes push to WordPress instantly.</span>
          </div>
          <span style={{ fontSize: 12, color: DESIGN.colors.textMuted, fontWeight: 600 }}>{pagesWithMeta}/{totalPages} have meta</span>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: DESIGN.colors.textMuted, fontSize: 13 }}><Loader2 size={14} className="spin" /> Loading...</div>
        ) : pages.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: DESIGN.colors.textMuted, fontSize: 14, fontFamily: FB }}>No published pages yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FB }}>
              <thead>
                <tr style={{ background: DESIGN.colors.warmGray }}>
                  <th style={th()}>Title</th>
                  <th style={th({ width: 60 })}>Type</th>
                  <th style={th()}>Focus keyword</th>
                  <th style={th({ textAlign: 'center', width: 50 })}>Meta</th>
                  <th style={th({ textAlign: 'right', width: 60 })}>Words</th>
                  <th style={th({ textAlign: 'center', width: 70 })}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pages.slice(0, 50).map(p => (
                  <PageEditor key={p.id} page={p} siteId={site.id} onSaved={load} siteDiag={diag} allPages={pages} companyProfile={companyProfile} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages.length > 50 && (
          <div style={{ padding: '10px 18px', borderTop: `1px solid ${DESIGN.colors.borderLight}`, fontSize: 12, color: DESIGN.colors.textMuted, fontFamily: FB, textAlign: 'center' }}>
            Showing first 50 of {pages.length} pages.
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}

const Pill = ({ children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontFamily: FB, fontWeight: 600, color: DESIGN.colors.textMuted, background: DESIGN.colors.warmGray, textTransform: 'uppercase', letterSpacing: '.04em' }}>{children}</span>
)
const Stat = ({ label, value, color = DESIGN.colors.navy }) => (
  <div style={{ background: DESIGN.colors.warmGray, border: `1px solid ${DESIGN.colors.border}`, borderRadius: 10, padding: '12px 14px' }}>
    <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: FB, lineHeight: 1.2 }}>{value}</div>
    <div style={{ fontSize: 11, color: DESIGN.colors.textMuted, fontFamily: FB, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, fontWeight: 600 }}>{label}</div>
  </div>
)
const card = (x = {}) => ({ background: '#fff', borderRadius: 14, border: `1px solid ${DESIGN.colors.border}`, padding: 20, ...x })
const iconWrap = { width: 34, height: 34, borderRadius: 10, background: `${R}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const miniBtn = (x = {}) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 50, border: `1px solid ${DESIGN.colors.border}`, background: '#fff', color: DESIGN.colors.navy, fontFamily: FB, fontSize: 12, fontWeight: 600, cursor: 'pointer' })
const primaryBtn = () => ({ padding: '10px 18px', borderRadius: 50, border: 'none', background: DESIGN.colors.pink, color: '#fff', fontFamily: FB, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 })
const th = (x = {}) => ({ textAlign: 'left', padding: '12px 14px', fontFamily: FB, fontSize: 11, fontWeight: 600, color: DESIGN.colors.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap', ...x })
const td = (x = {}) => ({ padding: '12px 14px', verticalAlign: 'top', ...x })
const lbl = { fontSize: 12, fontWeight: 600, color: DESIGN.colors.navy, fontFamily: FB, marginBottom: 5, display: 'block' }
const inp = () => ({ width: '100%', padding: '10px 13px', borderRadius: 10, border: `1px solid ${DESIGN.colors.border}`, fontSize: 14, fontFamily: FB, color: DESIGN.colors.navy, background: '#fff', outline: 'none', boxSizing: 'border-box' })
