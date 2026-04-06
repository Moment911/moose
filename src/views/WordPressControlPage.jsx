"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Globe, Plus, Plug, RefreshCw, Loader2, CheckCircle, XCircle,
  FileText, BarChart2, Zap, Trash2, ExternalLink, ChevronRight,
  Clock, AlertCircle, Settings, MapPin, X, Sparkles, Eye, Edit3,
  Save, Send, Code2, List, Image, Bold, Italic, Link2, AlignLeft,
  Monitor, Smartphone, SplitSquareHorizontal, PenSquare, Search,
  ArrowLeft, Copy, MoreVertical, Tag, Type
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ClientSearchSelect from '../components/ClientSearchSelect'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const PURP  = '#7c3aed'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

const PAGE_TYPES   = ['service','location','industry','faq','blog','landing']
const SCHEMA_TYPES = ['LocalBusiness','ProfessionalService','MedicalBusiness',
  'HomeAndConstructionBusiness','FoodEstablishment','HealthAndBeautyBusiness',
  'AutoDealer','LegalService','RealEstateAgent','FinancialService']
const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],
  ['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
  ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],
  ['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],
  ['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],
  ['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],
  ['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
]

function StatusDot({ connected }) {
  return <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%',
    background: connected ? GREEN : '#d1d5db', flexShrink:0 }} />
}

// ── Rich text editor toolbar ─────────────────────────────────────────────────
function EditorToolbar({ onFormat }) {
  const tools = [
    { icon:Bold,      cmd:'bold',           label:'Bold'          },
    { icon:Italic,    cmd:'italic',         label:'Italic'        },
    { icon:Link2,     cmd:'createLink',     label:'Insert Link'   },
    { icon:Type,      cmd:'h2',             label:'Heading 2'     },
    { icon:AlignLeft, cmd:'p',              label:'Paragraph'     },
    { icon:List,      cmd:'insertUnorderedList', label:'Bullet list' },
    { icon:Code2,     cmd:'code',           label:'Code'          },
  ]
  return (
    <div style={{ display:'flex', gap:2, padding:'6px 10px', background:'#f9fafb',
      borderBottom:'1px solid #e5e7eb', flexWrap:'wrap' }}>
      {tools.map(t => {
        const Icon = t.icon
        return (
          <button key={t.cmd} title={t.label} onMouseDown={e => { e.preventDefault(); onFormat(t.cmd) }}
            style={{ padding:'5px 7px', borderRadius:6, border:'none', background:'transparent',
              color:'#374151', cursor:'pointer', display:'flex', alignItems:'center' }}>
            <Icon size={14}/>
          </button>
        )
      })}
    </div>
  )
}

// ── Preview pane — renders page inside an iframe with site styles ────────────
function PreviewPane({ content, title, siteStyles, previewMode }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    if (!iframeRef.current) return
    const doc = iframeRef.current.contentDocument
    if (!doc) return

    const styleLinks = (siteStyles?.stylesheets || [])
      .filter(s => !s.includes('fonts.googleapis'))
      .map(s => `<link rel="stylesheet" href="${s}">`)
      .join('\n')

    const fontLinks = (siteStyles?.google_fonts || [])
      .map(s => `<link rel="stylesheet" href="${s}">`)
      .join('\n')

    const customCss = siteStyles?.custom_css || ''
    const siteUrl   = siteStyles?.site_url || ''

    doc.open()
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${siteUrl}/">
  ${fontLinks}
  ${styleLinks}
  <style>
    /* Koto preview overlay */
    body { margin: 0; }
    * { box-sizing: border-box; }
    ${customCss}
  </style>
</head>
<body class="${siteStyles?.body_classes || ''}">
  <div class="entry-content page-content post-content">
    <h1>${title || 'Untitled'}</h1>
    ${content || '<p><em>No content yet — start writing above.</em></p>'}
  </div>
</body>
</html>`)
    doc.close()
  }, [content, title, siteStyles])

  const mobileStyle = previewMode === 'mobile'
    ? { width: 390, margin: '0 auto', border: '8px solid #111', borderRadius: 40, overflow: 'hidden', height: 680 }
    : {}

  return (
    <div style={{ flex:1, background:'#f2f2f0', display:'flex', alignItems:'flex-start',
      justifyContent:'center', padding: previewMode === 'mobile' ? 20 : 0, overflowY:'auto' }}>
      <div style={{ width:'100%', height:'100%', ...mobileStyle }}>
        <iframe ref={iframeRef} style={{ width:'100%', height: previewMode === 'mobile' ? 680 : '100%',
          border:'none', background:'#fff' }} title="Page Preview" />
      </div>
    </div>
  )
}

// ── In-app page/post editor ──────────────────────────────────────────────────
function ContentEditor({ site, post, onSave, onBack, agencyId }) {
  const [title,       setTitle]       = useState(post?.title || '')
  const [content,     setContent]     = useState(post?.content || '')
  const [metaDesc,    setMetaDesc]    = useState(post?.meta_description || '')
  const [focusKw,     setFocusKw]     = useState(post?.focus_keyword || '')
  const [slug,        setSlug]        = useState(post?.slug || '')
  const [status,      setStatus]      = useState(post?.status || 'draft')
  const [postType,    setPostType]    = useState(post?.post_type || 'page')
  const [previewMode, setPreviewMode] = useState('desktop')
  const [view,        setView]        = useState('split')  // split | edit | preview
  const [saving,      setSaving]      = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [siteStyles,  setSiteStyles]  = useState(null)
  const [aiPrompt,    setAiPrompt]    = useState('')
  const [showAI,      setShowAI]      = useState(false)
  const editorRef = useRef(null)

  // Fetch site styles for preview
  useEffect(() => {
    fetchStyles()
  }, [site])

  async function fetchStyles() {
    try {
      const res  = await fetch('/api/wp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'get_styles', site_id:site.id, agency_id:agencyId }),
      })
      const data = await res.json()
      if (data.ok) setSiteStyles(data.data)
    } catch {}
  }

  function handleFormat(cmd) {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    if (cmd === 'h2') {
      document.execCommand('formatBlock', false, 'h2')
    } else if (cmd === 'p') {
      document.execCommand('formatBlock', false, 'p')
    } else if (cmd === 'code') {
      document.execCommand('formatBlock', false, 'pre')
    } else if (cmd === 'createLink') {
      const url = prompt('Enter URL:')
      if (url) document.execCommand('createLink', false, url)
    } else {
      document.execCommand(cmd, false, null)
    }
    setContent(editor.innerHTML)
  }

  async function aiGenerate() {
    if (!title && !aiPrompt) { toast.error('Enter a title or describe what you want'); return }
    setGenerating(true)
    try {
      // Call Koto AI (via the platform's own AI) to generate content
      const res  = await fetch('/api/seo/analyze', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:     'generate_content',
          agency_id:  agencyId,
          site_id:    site.id,
          title:      title || aiPrompt,
          keyword:    focusKw,
          prompt:     aiPrompt,
          post_type:  postType,
          word_count: 800,
        }),
      })
      const data = await res.json()
      if (data.content) {
        if (editorRef.current) {
          editorRef.current.innerHTML = data.content
        }
        setContent(data.content)
        if (data.title && !title) setTitle(data.title)
        if (data.meta_description) setMetaDesc(data.meta_description)
        toast.success('AI content generated ✓')
      } else {
        // Fallback — generate basic structure
        const basic = `<h2>About ${title}</h2>
<p>We provide professional ${title?.toLowerCase()} services to clients throughout ${site.site_name?.split(' ')[0] || 'the area'}.</p>
<h2>Why Choose Us</h2>
<ul><li>Experienced team with proven results</li><li>Transparent pricing with no hidden fees</li><li>Fast response times and reliable service</li></ul>
<h2>Get Started</h2>
<p>Contact us today to learn how we can help with your ${focusKw || title?.toLowerCase()} needs.</p>`
        if (editorRef.current) editorRef.current.innerHTML = basic
        setContent(basic)
        toast.success('Basic template generated')
      }
    } catch (e) {
      toast.error('Generation failed: ' + e.message)
    }
    setGenerating(false)
    setShowAI(false)
  }

  async function save(publishStatus) {
    if (!title) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const res  = await fetch('/api/wp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:           post?.post_id ? 'save_content' : 'save_content',
          site_id:          site.id,
          agency_id:        agencyId,
          post_id:          post?.post_id || null,
          title,
          content:          editorRef.current?.innerHTML || content,
          meta_description: metaDesc,
          focus_keyword:    focusKw,
          slug:             slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          post_type:        postType,
          status:           publishStatus || status,
        }),
      })
      const data = await res.json()
      if (!data.ok) { toast.error(data.error || 'Save failed'); setSaving(false); return }
      toast.success(publishStatus === 'publish' ? '🎉 Published live!' : '💾 Saved as draft')
      onSave(data.data)
    } catch (e) { toast.error(e.message) }
    setSaving(false)
  }

  const editorContent = (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Title */}
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #e5e7eb' }}>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder={postType === 'post' ? 'Blog post title…' : 'Page title…'}
          style={{ width:'100%', fontFamily:FH, fontSize:22, fontWeight:800, color:BLK,
            border:'none', outline:'none', background:'transparent' }}/>
      </div>
      {/* Toolbar */}
      <EditorToolbar onFormat={handleFormat} />
      {/* Body */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={e => setContent(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: content }}
        style={{ flex:1, padding:'20px', outline:'none', overflowY:'auto',
          fontFamily:FB, fontSize:15, lineHeight:1.8, color:'#374151',
          minHeight:300 }}
      />
      {/* SEO panel */}
      <div style={{ borderTop:'1px solid #e5e7eb', padding:'14px 20px', background:'#fafafa' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase',
          letterSpacing:'.06em', marginBottom:10 }}>SEO Settings</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>
              Focus Keyword
            </label>
            <input value={focusKw} onChange={e => setFocusKw(e.target.value)}
              placeholder="plumber miami fl"
              style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #e5e7eb',
                fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>
              URL Slug
            </label>
            <input value={slug} onChange={e => setSlug(e.target.value)}
              placeholder="auto-generated from title"
              style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #e5e7eb',
                fontSize:13, fontFamily:'monospace', outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>
              Meta Description
              <span style={{ fontWeight:400, color: metaDesc.length > 160 ? RED : '#9ca3af' }}>
                {' '}({metaDesc.length}/160)
              </span>
            </label>
            <textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} rows={2}
              placeholder="Write a compelling description for search results…"
              style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #e5e7eb',
                fontSize:13, fontFamily:FB, outline:'none', resize:'vertical', boxSizing:'border-box' }}/>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Editor header */}
      <div style={{ background:BLK, padding:'10px 18px', display:'flex',
        alignItems:'center', gap:10, flexShrink:0 }}>
        <button onClick={onBack}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:7,
            border:'1px solid rgba(255,255,255,.15)', background:'transparent', color:'rgba(255,255,255,.6)',
            cursor:'pointer', fontSize:12, fontWeight:600 }}>
          <ArrowLeft size={12}/> All Content
        </button>

        <div style={{ flex:1, fontFamily:FH, fontSize:13, fontWeight:700, color:'rgba(255,255,255,.7)' }}>
          {post?.post_id ? `Editing: ${post.title}` : `New ${postType}`}
        </div>

        {/* View toggle */}
        <div style={{ display:'flex', background:'rgba(255,255,255,.08)', borderRadius:8, padding:2 }}>
          {[
            { key:'edit',    icon:Edit3,              label:'Edit'    },
            { key:'split',   icon:SplitSquareHorizontal, label:'Split' },
            { key:'preview', icon:Eye,                label:'Preview' },
          ].map(v => {
            const Icon = v.icon
            return (
              <button key={v.key} onClick={() => setView(v.key)} title={v.label}
                style={{ padding:'5px 8px', borderRadius:6, border:'none',
                  background: view === v.key ? 'rgba(255,255,255,.2)' : 'transparent',
                  color: view === v.key ? '#fff' : 'rgba(255,255,255,.4)', cursor:'pointer' }}>
                <Icon size={13}/>
              </button>
            )
          })}
        </div>

        {/* Preview device toggle (only when preview shown) */}
        {view !== 'edit' && (
          <div style={{ display:'flex', background:'rgba(255,255,255,.08)', borderRadius:8, padding:2 }}>
            {[
              { key:'desktop',  icon:Monitor },
              { key:'mobile',   icon:Smartphone },
            ].map(d => {
              const Icon = d.icon
              return (
                <button key={d.key} onClick={() => setPreviewMode(d.key)} title={d.key}
                  style={{ padding:'5px 8px', borderRadius:6, border:'none',
                    background: previewMode === d.key ? 'rgba(255,255,255,.2)' : 'transparent',
                    color: previewMode === d.key ? '#fff' : 'rgba(255,255,255,.4)', cursor:'pointer' }}>
                  <Icon size={13}/>
                </button>
              )
            })}
          </div>
        )}

        {/* Type + status */}
        <select value={postType} onChange={e => setPostType(e.target.value)}
          style={{ padding:'5px 8px', borderRadius:7, border:'1px solid rgba(255,255,255,.15)',
            background:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.7)', fontSize:12, cursor:'pointer' }}>
          <option value="page">Page</option>
          <option value="post">Post</option>
        </select>

        {/* AI button */}
        <button onClick={() => setShowAI(s => !s)}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:7,
            border:'1px solid rgba(234,39,41,.4)', background:'rgba(234,39,41,.15)',
            color:'#fca5a5', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          <Sparkles size={12}/> AI Write
        </button>

        {/* Save actions */}
        <button onClick={() => save('draft')} disabled={saving}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:7,
            border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)',
            color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          {saving ? <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }}/> : <Save size={11}/>}
          Save Draft
        </button>
        <button onClick={() => save('publish')} disabled={saving}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:7,
            border:'none', background:RED, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          <Send size={11}/> Publish
        </button>
      </div>

      {/* AI panel */}
      {showAI && (
        <div style={{ background:'#18181b', padding:'12px 18px', borderBottom:'1px solid #27272a',
          display:'flex', gap:10, alignItems:'center', flexShrink:0 }}>
          <Sparkles size={14} color={RED}/>
          <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && aiGenerate()}
            placeholder={`Describe the ${postType} you want to generate, or press enter to use the title above…`}
            style={{ flex:1, padding:'7px 12px', borderRadius:8, border:'1px solid #3f3f46',
              background:'#27272a', color:'#fff', fontSize:13, fontFamily:FB, outline:'none' }}/>
          <button onClick={aiGenerate} disabled={generating}
            style={{ padding:'7px 14px', borderRadius:8, border:'none', background:RED,
              color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {generating ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }}/> : 'Generate'}
          </button>
          <button onClick={() => setShowAI(false)}
            style={{ background:'none', border:'none', cursor:'pointer', color:'#52525b' }}>
            <X size={14}/>
          </button>
        </div>
      )}

      {/* Main editor area */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Edit pane */}
        {(view === 'edit' || view === 'split') && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden',
            borderRight: view === 'split' ? '1px solid #e5e7eb' : 'none' }}>
            {editorContent}
          </div>
        )}

        {/* Preview pane */}
        {(view === 'preview' || view === 'split') && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'8px 14px', background:'#f9fafb', borderBottom:'1px solid #e5e7eb',
              display:'flex', alignItems:'center', gap:8 }}>
              <Eye size={12} color='#9ca3af'/>
              <span style={{ fontSize:11, fontWeight:600, color:'#9ca3af' }}>
                LIVE PREVIEW — {siteStyles ? `${siteStyles.theme_name} theme` : 'Loading styles…'}
              </span>
              {post?.url && (
                <a href={post.url} target="_blank" rel="noreferrer"
                  style={{ marginLeft:'auto', fontSize:11, color:TEAL, display:'flex', alignItems:'center', gap:3 }}>
                  View live <ExternalLink size={10}/>
                </a>
              )}
            </div>
            <PreviewPane
              content={editorRef.current?.innerHTML || content}
              title={title}
              siteStyles={siteStyles}
              previewMode={previewMode}
            />
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Content list view ────────────────────────────────────────────────────────
function ContentList({ site, agencyId, onEdit, onCreate }) {
  const [posts,      setPosts]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('all')  // all|page|post
  const [search,     setSearch]     = useState('')
  const [deleting,   setDeleting]   = useState(null)

  useEffect(() => { if (site) load() }, [site])

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch('/api/wp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'list_content', site_id:site.id, agency_id:agencyId }),
      })
      const data = await res.json()
      setPosts(data.data?.posts || [])
    } catch { setPosts([]) }
    setLoading(false)
  }

  async function deletePost(post) {
    if (!confirm(`Delete "${post.title}"? This is permanent.`)) return
    setDeleting(post.post_id)
    const res = await fetch('/api/wp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'delete_content', site_id:site.id, agency_id:agencyId, post_id:post.post_id }),
    })
    const data = await res.json()
    if (data.ok) { setPosts(p => p.filter(x => x.post_id !== post.post_id)); toast.success('Deleted') }
    else toast.error('Delete failed')
    setDeleting(null)
  }

  const filtered = posts.filter(p => {
    if (filter !== 'all' && p.post_type !== filter) return false
    if (search && !p.title?.toLowerCase().includes(search.toLowerCase()) &&
        !p.focus_keyword?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Toolbar */}
      <div style={{ padding:'12px 18px', background:'#fff', borderBottom:'1px solid #e5e7eb',
        display:'flex', gap:10, alignItems:'center', flexShrink:0 }}>
        <div style={{ position:'relative', flex:1, maxWidth:320 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search pages and posts…"
            style={{ width:'100%', padding:'7px 12px 7px 30px', borderRadius:9, border:'1.5px solid #e5e7eb',
              fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
        </div>
        <div style={{ display:'flex', background:'#f3f4f6', borderRadius:8, padding:2 }}>
          {['all','page','post'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'5px 12px', borderRadius:6, border:'none', fontSize:12, fontWeight:700,
                background: filter === f ? '#fff' : 'transparent',
                color: filter === f ? BLK : '#9ca3af', cursor:'pointer',
                boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
              {f === 'all' ? 'All' : f === 'page' ? 'Pages' : 'Posts'}
            </button>
          ))}
        </div>
        <button onClick={load}
          style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#6b7280' }}>
          <RefreshCw size={12}/>
        </button>
        <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
          <button onClick={() => onCreate('page')}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:9,
              border:'1px solid #e5e7eb', background:'#fff', color:BLK, fontSize:12, fontWeight:700, cursor:'pointer' }}>
            <Plus size={12}/> New Page
          </button>
          <button onClick={() => onCreate('post')}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:9,
              border:'none', background:RED, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            <Plus size={12}/> New Post
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'48px' }}>
            <Loader2 size={24} color={TEAL} style={{ animation:'spin 1s linear infinite' }}/>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'48px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB }}>
            {search ? 'No matches' : 'No content yet — create your first page or post above'}
          </div>
        ) : (
          <div style={{ background:'#fff' }}>
            {/* Header row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 100px 90px 60px',
              gap:12, padding:'9px 18px', borderBottom:'1px solid #f3f4f6',
              fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.06em' }}>
              <span>Title</span><span>Type</span><span>Keyword</span><span>Status</span><span>Words</span>
            </div>
            {filtered.map(p => (
              <div key={p.post_id}
                style={{ display:'grid', gridTemplateColumns:'1fr 90px 100px 90px 60px',
                  gap:12, padding:'12px 18px', borderBottom:'1px solid #f9fafb',
                  alignItems:'center', cursor:'pointer' }}
                onClick={() => onEdit(p)}>
                <div>
                  <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{p.title}</div>
                  <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace', marginTop:2 }}>/{p.slug}</div>
                  {p.excerpt && <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, marginTop:3 }}>{p.excerpt}</div>}
                </div>
                <div>
                  <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                    background: p.post_type === 'page' ? '#eff6ff' : '#fdf4ff',
                    color: p.post_type === 'page' ? '#3b82f6' : PURP }}>
                    {p.post_type}
                  </span>
                </div>
                <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {p.focus_keyword || '—'}
                </div>
                <div>
                  <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                    background: p.status === 'publish' ? '#f0fdf4' : '#fffbeb',
                    color: p.status === 'publish' ? GREEN : AMBER }}>
                    {p.status === 'publish' ? 'Live' : 'Draft'}
                  </span>
                </div>
                <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FH }}>{p.word_count || 0}</div>
                {/* Actions on hover handled via click */}
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function WordPressControlPage() {
  const { agencyId } = useAuth()

  const [sites,       setSites]       = useState([])
  const [selected,    setSelected]    = useState(null)
  const [siteData,    setSiteData]    = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [siteLoading, setSiteLoading] = useState(false)
  const [tab,         setTab]         = useState('content')
  const [showConnect, setShowConnect] = useState(false)
  const [connecting,  setConnecting]  = useState(false)
  const [running,     setRunning]     = useState(null)
  const [editingPost, setEditingPost] = useState(null)  // null = list, object = editing
  const [isNewPost,   setIsNewPost]   = useState(false)

  // Connect form
  const [connectForm, setConnectForm] = useState({ site_url:'', api_key:'', site_name:'', client_id:'' })

  // Generation config
  const [genConfig, setGenConfig] = useState({
    keyword_template:'', topic:'', page_type:'service',
    schema_type:'LocalBusiness', aeo_enabled:true,
    additional_keywords:'', state:'', selected_locations:[],
  })
  const [locations,  setLocations]  = useState([])
  const [locLoading, setLocLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genResult,  setGenResult]  = useState(null)

  useEffect(() => { if (agencyId) loadSites() }, [agencyId])

  async function loadSites() {
    setLoading(true)
    const res  = await fetch(`/api/wp?agency_id=${agencyId}`)
    const data = await res.json()
    setSites(data.sites || [])
    if (data.sites?.length && !selected) selectSite(data.sites[0])
    setLoading(false)
  }

  async function selectSite(site) {
    setSelected(site)
    setEditingPost(null)
    setSiteLoading(true)
    const res  = await fetch(`/api/wp?site_id=${site.id}`)
    const data = await res.json()
    setSiteData(data)
    setSiteLoading(false)
  }

  async function connectSite() {
    if (!connectForm.site_url || !connectForm.api_key) { toast.error('URL and API key required'); return }
    setConnecting(true)
    const res  = await fetch('/api/wp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'connect', agency_id:agencyId, ...connectForm }),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); setConnecting(false); return }
    toast[data.connected ? 'success' : 'error'](
      data.connected ? `✓ Connected to ${data.site?.site_name}` : 'Could not reach plugin — saved anyway'
    )
    setShowConnect(false)
    setConnectForm({ site_url:'', api_key:'', site_name:'', client_id:'' })
    await loadSites()
    if (data.site) selectSite(data.site)
    setConnecting(false)
  }

  async function runAction(action) {
    if (!selected) return
    setRunning(action)
    const res  = await fetch('/api/wp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action, agency_id:agencyId, site_id:selected.id }),
    })
    const data = await res.json()
    if (data.error) toast.error(data.error)
    else toast.success(`${action.replace(/_/g,' ')} completed ✓`)
    await selectSite(selected)
    setRunning(null)
  }

  async function loadLocations() {
    if (!selected || !genConfig.state) return
    setLocLoading(true)
    const res  = await fetch('/api/wp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'get_locations', site_id:selected.id, agency_id:agencyId, state:genConfig.state }),
    })
    const data = await res.json()
    const locs = data?.data?.locations || data?.data?.cities || data?.locations || []
    setLocations(Array.isArray(locs) ? locs : [])
    setLocLoading(false)
  }

  async function generatePages() {
    if (!genConfig.keyword_template || !genConfig.topic) { toast.error('Keyword template and topic required'); return }
    if (!genConfig.selected_locations.length) { toast.error('Select at least one location'); return }
    setGenerating(true)
    setGenResult(null)
    const res  = await fetch('/api/wp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        action:              'generate_pages',
        agency_id:           agencyId,
        site_id:             selected.id,
        keyword_template:    genConfig.keyword_template,
        topic:               genConfig.topic,
        location_ids:        genConfig.selected_locations,
        page_type:           genConfig.page_type,
        schema_type:         genConfig.schema_type,
        aeo_enabled:         genConfig.aeo_enabled,
        additional_keywords: genConfig.additional_keywords.split(',').map(k=>k.trim()).filter(Boolean),
      }),
    })
    const data = await res.json()
    setGenResult(data)
    const count = data.data?.pages?.length || data.data?.generated || 0
    if (data.error) toast.error(data.error)
    else toast.success(`${count} pages generated ✓`)
    await selectSite(selected)
    setGenerating(false)
  }

  async function deleteSite(id) {
    if (!confirm('Disconnect this WordPress site?')) return
    await fetch('/api/wp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'delete', site_id:id, agency_id:agencyId }),
    })
    setSites(s => s.filter(x => x.id !== id))
    if (selected?.id === id) { setSelected(null); setSiteData(null) }
    toast.success('Site disconnected')
  }

  const QUICK_ACTIONS = [
    { key:'sync_rankings',   label:'Sync Rankings',   icon:BarChart2,  color:TEAL,  desc:'Pull GSC keyword data' },
    { key:'sync_pages',      label:'Sync Pages',      icon:FileText,   color:PURP,  desc:'Import all pages' },
    { key:'rebuild_sitemap', label:'Rebuild Sitemap', icon:Globe,      color:AMBER, desc:'Regenerate XML sitemap' },
    { key:'run_automation',  label:'Run Automation',  icon:Zap,        color:RED,   desc:'Execute automation queue' },
    { key:'ping',            label:'Test Connection', icon:Plug,       color:GREEN, desc:'Verify plugin responds' },
  ]

  // If editing a post, show full-screen editor
  if (editingPost !== null) {
    return (
      <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
        <Sidebar/>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <ContentEditor
            site={selected}
            post={isNewPost ? null : editingPost}
            agencyId={agencyId}
            onBack={() => { setEditingPost(null); setIsNewPost(false) }}
            onSave={savedPost => {
              setEditingPost({ ...editingPost, ...savedPost })
              setIsNewPost(false)
              // Reload site data to reflect changes
              selectSite(selected)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* ── Left: sites list ──────────────────────────────────────────── */}
        <div style={{ width:240, background:'#fff', borderRight:'1px solid #e5e7eb',
          display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid #f3f4f6' }}>
            <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK,
              marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              <Globe size={13} color={RED}/> WordPress Sites
            </div>
            <button onClick={() => setShowConnect(true)}
              style={{ width:'100%', padding:'7px', borderRadius:8, border:'none',
                background:RED, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
              <Plus size={11}/> Connect Site
            </button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'8px 10px' }}>
            {loading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:'20px 0' }}>
                <Loader2 size={16} color={TEAL} style={{ animation:'spin 1s linear infinite' }}/>
              </div>
            ) : sites.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 12px', color:'#9ca3af',
                fontFamily:FB, fontSize:13, lineHeight:1.6 }}>
                No sites yet.<br/>
                <button onClick={() => setShowConnect(true)}
                  style={{ color:RED, background:'none', border:'none', cursor:'pointer',
                    fontSize:12, fontWeight:700, marginTop:4 }}>
                  Connect your first site →
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {sites.map(site => (
                  <div key={site.id} onClick={() => selectSite(site)}
                    style={{ background: selected?.id === site.id ? RED+'10' : '#fff',
                      borderRadius:10, border:`1.5px solid ${selected?.id === site.id ? RED+'40' : '#f3f4f6'}`,
                      padding:'10px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
                    <StatusDot connected={site.connected}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {site.site_name}
                      </div>
                      <div style={{ fontSize:10, color:'#9ca3af', fontFamily:FB,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {site.site_url?.replace(/^https?:\/\//, '')}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteSite(site.id) }}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#d1d5db',
                        padding:2, flexShrink:0 }}>
                      <Trash2 size={11}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Plugin setup hint */}
          <div style={{ padding:'10px 12px', borderTop:'1px solid #f3f4f6', background:'#fafafa' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', marginBottom:5,
              textTransform:'uppercase', letterSpacing:'.05em' }}>Plugin Setup</div>
            {['Install koto-seo.zip on WP','Koto SEO → Settings','Enter agency URL + API key'].map((s,i) => (
              <div key={i} style={{ display:'flex', gap:5, marginBottom:3, alignItems:'flex-start' }}>
                <div style={{ width:14, height:14, borderRadius:'50%', background:RED+'15',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                  <span style={{ fontSize:8, fontWeight:800, color:RED }}>{i+1}</span>
                </div>
                <span style={{ fontSize:10, color:'#6b7280', fontFamily:FB }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: site content ───────────────────────────────────────── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {!selected ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              flexDirection:'column', gap:12, color:'#d1d5db' }}>
              <Globe size={40} color="#e5e7eb"/>
              <div style={{ fontFamily:FH, fontSize:14, fontWeight:700 }}>Select a site to get started</div>
            </div>
          ) : (
            <>
              {/* Site header */}
              <div style={{ background:BLK, padding:'12px 20px', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <StatusDot connected={selected.connected}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:'#fff' }}>
                      {selected.site_name}
                    </div>
                    <a href={selected.site_url} target="_blank" rel="noreferrer"
                      style={{ fontSize:11, color:'rgba(255,255,255,.35)', display:'flex',
                        alignItems:'center', gap:4, textDecoration:'none' }}>
                      {selected.site_url} <ExternalLink size={9}/>
                    </a>
                  </div>
                  <div style={{ fontFamily:FH, fontSize:18, fontWeight:900, color:TEAL }}>
                    {selected.pages_generated || 0}
                    <span style={{ fontSize:10, color:'rgba(255,255,255,.3)', fontWeight:400,
                      display:'block', textAlign:'right' }}>pages</span>
                  </div>
                </div>
                {/* Tabs */}
                <div style={{ display:'flex', gap:1 }}>
                  {[
                    { key:'content',  label:'Pages & Posts', icon:PenSquare  },
                    { key:'generate', label:'Bulk Generate',  icon:Sparkles  },
                    { key:'actions',  label:'Quick Actions',  icon:Zap       },
                    { key:'rankings', label:'Rankings',        icon:BarChart2, badge:siteData?.rankings?.length },
                    { key:'log',      label:'Command Log',     icon:Clock     },
                  ].map(t => {
                    const Icon = t.icon
                    const active = tab === t.key
                    return (
                      <button key={t.key} onClick={() => setTab(t.key)}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px',
                          borderRadius:'7px 7px 0 0', border:'none', cursor:'pointer', fontSize:11, fontWeight:700,
                          background: active ? '#f2f2f0' : 'transparent',
                          color: active ? BLK : 'rgba(255,255,255,.4)' }}>
                        <Icon size={11}/> {t.label}
                        {t.badge > 0 && (
                          <span style={{ fontSize:9, fontWeight:800, padding:'1px 5px',
                            borderRadius:10, background:TEAL, color:'#fff', marginLeft:2 }}>
                            {t.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>

                {/* ── CONTENT TAB ─────────────────────────────────────── */}
                {tab === 'content' && (
                  <ContentList
                    site={selected}
                    agencyId={agencyId}
                    onEdit={post => { setEditingPost(post); setIsNewPost(false) }}
                    onCreate={type => {
                      setEditingPost({ post_type: type, title:'', content:'', status:'draft' })
                      setIsNewPost(true)
                    }}
                  />
                )}

                {/* ── BULK GENERATE TAB ────────────────────────────────── */}
                {tab === 'generate' && (
                  <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:20 }}>
                      {/* Config */}
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                        <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:16 }}>
                          Bulk Page Generation
                        </div>
                        {[
                          { label:'Keyword Template', hint:'use %s for city', key:'keyword_template', placeholder:'plumber in %s' },
                          { label:'Topic / Service',  hint:'',                key:'topic',             placeholder:'Emergency Plumbing Services' },
                        ].map(f => (
                          <div key={f.key} style={{ marginBottom:12 }}>
                            <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:BLK,
                              display:'block', marginBottom:5 }}>
                              {f.label} {f.hint && <span style={{ color:'#9ca3af', fontWeight:400 }}>({f.hint})</span>}
                            </label>
                            <input value={genConfig[f.key]} placeholder={f.placeholder}
                              onChange={e => setGenConfig(p => ({...p, [f.key]:e.target.value}))}
                              style={{ width:'100%', padding:'8px 11px', borderRadius:9,
                                border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB,
                                outline:'none', boxSizing:'border-box' }}/>
                          </div>
                        ))}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                          {[
                            { label:'Page Type', key:'page_type', options:PAGE_TYPES },
                            { label:'Schema',    key:'schema_type', options:SCHEMA_TYPES },
                          ].map(f => (
                            <div key={f.key}>
                              <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:BLK,
                                display:'block', marginBottom:5 }}>{f.label}</label>
                              <select value={genConfig[f.key]}
                                onChange={e => setGenConfig(p => ({...p, [f.key]:e.target.value}))}
                                style={{ width:'100%', padding:'8px 10px', borderRadius:9,
                                  border:'1.5px solid #e5e7eb', fontSize:12, cursor:'pointer', outline:'none' }}>
                                {f.options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                        {/* AEO */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'10px 14px', background:'#f9fafb', borderRadius:10, marginBottom:12 }}>
                          <div>
                            <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK }}>AEO Optimization</div>
                            <div style={{ fontSize:11, color:'#6b7280' }}>FAQ blocks + speakable schema</div>
                          </div>
                          <button onClick={() => setGenConfig(p => ({...p, aeo_enabled:!p.aeo_enabled}))}
                            style={{ padding:'4px 12px', borderRadius:20, border:'none', fontSize:11, fontWeight:800,
                              background: genConfig.aeo_enabled ? GREEN : '#e5e7eb',
                              color: genConfig.aeo_enabled ? '#fff' : '#9ca3af', cursor:'pointer' }}>
                            {genConfig.aeo_enabled ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        {/* Locations */}
                        <div style={{ marginBottom:14 }}>
                          <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:BLK,
                            display:'block', marginBottom:5 }}>
                            Target Locations ({genConfig.selected_locations.length} selected)
                          </label>
                          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                            <select value={genConfig.state}
                              onChange={e => setGenConfig(p => ({...p, state:e.target.value, selected_locations:[]}))}
                              style={{ flex:1, padding:'7px 9px', borderRadius:9, border:'1.5px solid #e5e7eb',
                                fontSize:12, cursor:'pointer', outline:'none' }}>
                              <option value="">Select state…</option>
                              {US_STATES.map(([a,n]) => <option key={a} value={a}>{n}</option>)}
                            </select>
                            <button onClick={loadLocations} disabled={!genConfig.state || locLoading}
                              style={{ padding:'7px 12px', borderRadius:9, border:'none',
                                background:TEAL+'20', color:TEAL, fontWeight:700, fontSize:12, cursor:'pointer' }}>
                              {locLoading ? <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }}/> : <MapPin size={11}/>}
                            </button>
                          </div>
                          {locations.length > 0 && (
                            <div>
                              <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                                <button onClick={() => setGenConfig(p => ({...p, selected_locations:locations.slice(0,50).map(l => l.id)}))}
                                  style={{ flex:1, padding:'4px', borderRadius:7, border:'1px solid #e5e7eb',
                                    background:'#fff', fontSize:11, cursor:'pointer' }}>
                                  Top 50
                                </button>
                                <button onClick={() => setGenConfig(p => ({...p, selected_locations:[]}))}
                                  style={{ flex:1, padding:'4px', borderRadius:7, border:'1px solid #e5e7eb',
                                    background:'#fff', fontSize:11, cursor:'pointer' }}>
                                  Clear
                                </button>
                              </div>
                              <div style={{ maxHeight:160, overflowY:'auto', borderRadius:9,
                                border:'1px solid #e5e7eb', background:'#fafafa' }}>
                                {locations.slice(0,100).map(loc => {
                                  const sel = genConfig.selected_locations.includes(loc.city + "_" + (loc.state_code || loc.state || genConfig.state))
                                  return (
                                    <div key={loc.city + "_" + (loc.state_code || loc.state || genConfig.state)} onClick={() => setGenConfig(p => ({
                                      ...p, selected_locations: sel
                                        ? p.selected_locations.filter(x => x !== loc.city + "_" + (loc.state_code || loc.state || genConfig.state))
                                        : [...p.selected_locations, loc.city + "_" + (loc.state_code || loc.state || genConfig.state)]
                                    }))}
                                      style={{ display:'flex', alignItems:'center', gap:8,
                                        padding:'6px 10px', cursor:'pointer',
                                        background: sel ? RED+'10' : 'transparent' }}>
                                      <div style={{ width:13, height:13, borderRadius:3,
                                        border:`2px solid ${sel ? RED : '#d1d5db'}`,
                                        background: sel ? RED : 'transparent',
                                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                                        {sel && <span style={{ color:'#fff', fontSize:8, fontWeight:900 }}>✓</span>}
                                      </div>
                                      <span style={{ fontSize:12, color:'#374151' }}>
                                        {loc.city}, {loc.state}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        <button onClick={generatePages} disabled={generating}
                          style={{ width:'100%', padding:'12px', borderRadius:11, border:'none',
                            background:RED, color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                          {generating
                            ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/>
                            : <Sparkles size={14}/>}
                          {generating ? 'Generating…' : `Generate ${genConfig.selected_locations.length || 0} Pages`}
                        </button>
                      </div>

                      {/* Results */}
                      <div>
                        {genResult ? (
                          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                            <div style={{ padding:'14px 18px', borderBottom:'1px solid #f3f4f6',
                              background: genResult.ok ? GREEN+'10' : RED+'10',
                              display:'flex', alignItems:'center', gap:8 }}>
                              {genResult.ok
                                ? <CheckCircle size={16} color={GREEN}/>
                                : <XCircle size={16} color={RED}/>}
                              <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>
                                {genResult.ok
                                  ? `${genResult.data?.pages?.length || 0} Pages Generated`
                                  : 'Generation Failed'}
                              </div>
                            </div>
                            <div style={{ padding:'14px 18px', maxHeight:500, overflowY:'auto' }}>
                              {(genResult.data?.pages || []).map((p, i) => (
                                <div key={i} style={{ display:'flex', alignItems:'center', gap:10,
                                  padding:'8px 0', borderBottom:'1px solid #f9fafb' }}>
                                  <CheckCircle size={12} color={GREEN} style={{ flexShrink:0 }}/>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontFamily:FH, fontSize:13, fontWeight:600 }}>{p.title}</div>
                                    <div style={{ fontSize:11, color:'#9ca3af' }}>{p.keyword} · {p.location}</div>
                                  </div>
                                  {p.url && (
                                    <a href={p.url} target="_blank" rel="noreferrer"
                                      style={{ color:TEAL, flexShrink:0 }}>
                                      <ExternalLink size={12}/>
                                    </a>
                                  )}
                                  <button onClick={() => {
                                    setEditingPost(p)
                                    setIsNewPost(false)
                                  }}
                                    style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:6,
                                      border:'1px solid #e5e7eb', background:'#fff', color:'#374151',
                                      cursor:'pointer' }}>
                                    Edit
                                  </button>
                                </div>
                              ))}
                              {!genResult.data?.pages?.length && (
                                <pre style={{ fontSize:12, color:'#374151', fontFamily:'monospace',
                                  whiteSpace:'pre-wrap' }}>
                                  {JSON.stringify(genResult.data, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb',
                            padding:'48px 24px', textAlign:'center' }}>
                            <Sparkles size={36} color="#e5e7eb" style={{ margin:'0 auto 12px', display:'block' }}/>
                            <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:'#d1d5db' }}>
                              Configure and generate pages
                            </div>
                            <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB, lineHeight:1.7,
                              maxWidth:300, margin:'8px auto 0' }}>
                              Set a keyword template like <strong>"plumber in %s"</strong>, pick locations,
                              configure schema + AEO, then generate all at once.
                              Each generated page can be edited in the Pages & Posts editor above.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── QUICK ACTIONS TAB ──────────────────────────────── */}
                {tab === 'actions' && (
                  <div style={{ flex:1, overflowY:'auto', padding:'20px', maxWidth:600 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      {QUICK_ACTIONS.map(a => {
                        const Icon = a.icon
                        const isRunning = running === a.key
                        return (
                          <button key={a.key} onClick={() => runAction(a.key)} disabled={!!running}
                            style={{ display:'flex', gap:12, padding:'14px 16px', background:'#fff',
                              borderRadius:13, border:'1px solid #e5e7eb', cursor:'pointer',
                              alignItems:'flex-start', opacity: !!running && !isRunning ? .5 : 1 }}>
                            <div style={{ width:38, height:38, borderRadius:10,
                              background:a.color+'15', display:'flex', alignItems:'center',
                              justifyContent:'center', flexShrink:0 }}>
                              {isRunning
                                ? <Loader2 size={17} color={a.color} style={{ animation:'spin 1s linear infinite' }}/>
                                : <Icon size={17} color={a.color}/>}
                            </div>
                            <div style={{ textAlign:'left' }}>
                              <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{a.label}</div>
                              <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>{a.desc}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── RANKINGS TAB ──────────────────────────────────── */}
                {tab === 'rankings' && (
                  <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
                    {(siteData?.rankings || []).length === 0 ? (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb',
                        padding:'48px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB }}>
                        No rankings yet — run Sync Rankings from Quick Actions
                      </div>
                    ) : (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 70px 80px 80px 70px',
                          gap:12, padding:'10px 18px', borderBottom:'1px solid #f3f4f6',
                          fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FH }}>
                          <span>Keyword</span><span>Pos</span><span>Clicks</span><span>Impressions</span><span>CTR</span>
                        </div>
                        {siteData.rankings.map(r => (
                          <div key={r.id} style={{ display:'grid', gridTemplateColumns:'1fr 70px 80px 80px 70px',
                            gap:12, padding:'11px 18px', borderBottom:'1px solid #f9fafb', alignItems:'center' }}>
                            <div style={{ fontFamily:FB, fontSize:13, color:'#374151' }}>{r.keyword}</div>
                            <div style={{ fontFamily:FH, fontSize:15, fontWeight:800,
                              color: r.position <= 3 ? GREEN : r.position <= 10 ? TEAL : AMBER }}>
                              #{r.position}
                            </div>
                            <div style={{ fontFamily:FH, fontSize:13, color:TEAL }}>{r.clicks?.toLocaleString()}</div>
                            <div style={{ fontSize:12, color:'#6b7280' }}>{r.impressions?.toLocaleString()}</div>
                            <div style={{ fontSize:12, color:'#6b7280' }}>{r.ctr ? `${(r.ctr*100).toFixed(1)}%` : '—'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── COMMAND LOG TAB ───────────────────────────────── */}
                {tab === 'log' && (
                  <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
                    {(siteData?.commands || []).length === 0 ? (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb',
                        padding:'40px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB }}>
                        No commands logged yet
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {siteData.commands.map(cmd => (
                          <div key={cmd.id} style={{ background:'#fff', borderRadius:12,
                            border:'1px solid #e5e7eb', padding:'12px 16px',
                            display:'flex', alignItems:'center', gap:12 }}>
                            <div style={{ width:32, height:32, borderRadius:9, flexShrink:0,
                              background: cmd.status==='success' ? GREEN+'15' : cmd.status==='error' ? RED+'15' : AMBER+'15',
                              display:'flex', alignItems:'center', justifyContent:'center' }}>
                              {cmd.status==='success'
                                ? <CheckCircle size={14} color={GREEN}/>
                                : cmd.status==='error'
                                ? <XCircle size={14} color={RED}/>
                                : <Clock size={14} color={AMBER}/>}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{cmd.command}</div>
                              {cmd.error && <div style={{ fontSize:11, color:RED, fontFamily:FB }}>{cmd.error}</div>}
                              <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>
                                {new Date(cmd.created_at).toLocaleString()}
                                {cmd.duration_ms && ` · ${cmd.duration_ms}ms`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </div>

      {/* Connect site modal */}
      {showConnect && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:9999,
          display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:'#fff', borderRadius:18, padding:'24px 28px',
            width:'100%', maxWidth:460, boxShadow:'0 24px 80px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK }}>Connect WordPress Site</div>
              <button onClick={() => setShowConnect(false)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>
                <X size={16}/>
              </button>
            </div>
            {[
              { key:'site_url',  label:'WordPress Site URL *', placeholder:'https://clientsite.com',  type:'url'      },
              { key:'api_key',   label:'Plugin API Key *',     placeholder:'From WP → Koto SEO → Settings', type:'password' },
              { key:'site_name', label:'Nickname (optional)',  placeholder:'Auto-detected from site', type:'text'     },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:12 }}>
                <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK,
                  display:'block', marginBottom:5 }}>{f.label}</label>
                <input type={f.type} value={connectForm[f.key]}
                  onChange={e => setConnectForm(p => ({...p, [f.key]:e.target.value}))}
                  placeholder={f.placeholder}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb',
                    fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
              </div>
            ))}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK,
                display:'block', marginBottom:5 }}>Link to Client</label>
              <ClientSearchSelect value={connectForm.client_id}
                onChange={id => setConnectForm(p => ({...p, client_id:id}))}/>
            </div>
            <button onClick={connectSite} disabled={connecting}
              style={{ width:'100%', padding:'12px', borderRadius:10, border:'none',
                background:RED, color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {connecting
                ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/>
                : <Plug size={14}/>}
              {connecting ? 'Testing connection…' : 'Connect Site'}
            </button>
            <div style={{ marginTop:10, padding:'8px 12px', background:'#f9fafb', borderRadius:8,
              fontSize:11, color:'#6b7280', fontFamily:FB }}>
              The API key is generated in WordPress under <strong>Koto SEO → Settings</strong>.
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
