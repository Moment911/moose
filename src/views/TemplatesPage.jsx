"use client";
"use client";
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Copy, Eye, Layout, Mail, Star, FileText, X } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'

const TEMPLATES = [
  {
    name: 'Welcome Email', desc: 'Warm welcome for new clients', category: 'Onboarding',
    preview: { header: '#231f20', hero: '#ea2729', body: true, cta: true, footer: true },
    blocks: [
      { type: 'header', data: { logoText: 'Moose', tagline: 'Welcome aboard!', bgColor: '#231f20', textColor: '#ffffff' } },
      { type: 'hero', data: { heading: 'Welcome to Moose!', subtext: "We're thrilled to have you as a client.", btnText: 'View Your Project', btnUrl: '#', bgColor: '#ea2729', textColor: '#ffffff', btnColor: '#ffffff' } },
      { type: 'text', data: { content: "Hi {{first_name}},\n\nThank you for choosing us. Here's what to expect next.", fontSize: 16, textColor: '#333', bgColor: '#fff', align: 'left', padding: 24 } },
      { type: 'button', data: { text: 'View Your Dashboard', url: '#', btnColor: '#ea2729', textColor: '#fff', bgColor: '#fff', align: 'center', padding: 24, borderRadius: 8 } },
      { type: 'footer', data: { text: '\u00a9 2026 Moose', links: 'Unsubscribe', bgColor: '#f5f5f5', textColor: '#999', padding: 24 } },
    ]
  },
  {
    name: 'Design Ready', desc: 'Notify client designs are ready for review', category: 'Notifications',
    preview: { header: '#231f20', body: true, cta: true, footer: true },
    blocks: [
      { type: 'header', data: { logoText: 'Moose', tagline: '', bgColor: '#231f20', textColor: '#ffffff' } },
      { type: 'heading', data: { content: 'Your Designs Are Ready!', fontSize: 28, textColor: '#1a1a1a', bgColor: '#fff', align: 'center', padding: 32, fontWeight: 700 } },
      { type: 'text', data: { content: "Great news! Your latest designs are ready for review. Click below to view and leave feedback.", fontSize: 16, textColor: '#555', bgColor: '#fff', align: 'left', padding: 24 } },
      { type: 'button', data: { text: 'Review Designs Now', url: '#', btnColor: '#ea2729', textColor: '#fff', bgColor: '#fff', align: 'center', padding: 32, borderRadius: 8 } },
      { type: 'footer', data: { text: '\u00a9 2026 Moose', links: 'Unsubscribe', bgColor: '#f5f5f5', textColor: '#999', padding: 24 } },
    ]
  },
  {
    name: 'Monthly Newsletter', desc: 'Multi-section newsletter template', category: 'Newsletter',
    preview: { header: '#231f20', hero: '#1a1a2e', body: true, cols: true, cta: true, footer: true },
    blocks: [
      { type: 'header', data: { logoText: 'Moose', tagline: 'Monthly Newsletter', bgColor: '#231f20', textColor: '#ffffff' } },
      { type: 'hero', data: { heading: "What We've Been Working On", subtext: 'A look at our latest projects and tips', btnText: 'Read More', btnUrl: '#', bgColor: '#1a1a2e', textColor: '#fff', btnColor: '#ea2729' } },
      { type: 'text', data: { content: 'Featured Project\n\nThis month we completed a full website redesign for Acme Corp.', fontSize: 16, textColor: '#333', bgColor: '#fff', align: 'left', padding: 24 } },
      { type: 'divider', data: { color: '#e5e7eb', thickness: 1, bgColor: '#fff', padding: 16 } },
      { type: 'twocol', data: { leftContent: 'Design Tip\n\nWhite space is breathing room for content.', rightContent: 'Quick Stat\n\n73% of users judge a company by their website.', bgColor: '#f9fafb', textColor: '#555', padding: 24 } },
      { type: 'button', data: { text: 'Visit Our Portfolio', url: '#', btnColor: '#ea2729', textColor: '#fff', bgColor: '#fff', align: 'center', padding: 24, borderRadius: 8 } },
      { type: 'footer', data: { text: '\u00a9 2026 Moose', links: 'Unsubscribe | View in browser', bgColor: '#f5f5f5', textColor: '#999', padding: 24 } },
    ]
  },
  {
    name: 'Feedback Request', desc: 'Ask clients for project feedback', category: 'Follow-up',
    preview: { body: true, cta: true, footer: true },
    blocks: [
      { type: 'text', data: { content: "Hi {{first_name}},\n\nI wanted to check in on the project. Do you have any additional feedback on the designs?\n\nBest,\nThe Moose Team", fontSize: 16, textColor: '#333', bgColor: '#fff', align: 'left', padding: 32 } },
      { type: 'button', data: { text: 'Leave Feedback', url: '#', btnColor: '#ea2729', textColor: '#fff', bgColor: '#fff', align: 'center', padding: 24, borderRadius: 8 } },
      { type: 'footer', data: { text: 'Moose', links: 'Unsubscribe', bgColor: '#f5f5f5', textColor: '#999', padding: 24 } },
    ]
  },
  {
    name: 'Project Complete', desc: 'Notify that project is finalized', category: 'Notifications',
    preview: { header: '#231f20', body: true, quote: true, cta: true, footer: true },
    blocks: [
      { type: 'header', data: { logoText: 'Moose', tagline: '', bgColor: '#231f20', textColor: '#ffffff' } },
      { type: 'heading', data: { content: 'Your Project is Complete!', fontSize: 28, textColor: '#1a1a1a', bgColor: '#fff', align: 'center', padding: 32, fontWeight: 700 } },
      { type: 'text', data: { content: "Hi {{first_name}},\n\nWe're excited to let you know that your project has been finalized. All deliverables are ready for download.", fontSize: 16, textColor: '#555', bgColor: '#fff', align: 'left', padding: 24 } },
      { type: 'quote', data: { text: '"Working with Moose was an incredible experience. The designs exceeded our expectations."', author: 'Happy Client', bgColor: '#f9fafb', textColor: '#374151', padding: 32 } },
      { type: 'button', data: { text: 'Download Files', url: '#', btnColor: '#ea2729', textColor: '#fff', bgColor: '#fff', align: 'center', padding: 24, borderRadius: 8 } },
      { type: 'footer', data: { text: '\u00a9 2026 Moose', links: 'Unsubscribe', bgColor: '#f5f5f5', textColor: '#999', padding: 24 } },
    ]
  },
  {
    name: 'Blank Canvas', desc: 'Start from scratch', category: 'Other',
    preview: {},
    blocks: []
  },
]

export default function TemplatesPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [preview, setPreview] = useState(null)

  const categories = ['all', ...new Set(TEMPLATES.map(t => t.category))]
  const filtered = filter === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.category === filter)

  function useTemplate(tpl) {
    // Store template in sessionStorage so CampaignBuilderPage can load it
    sessionStorage.setItem('emailTemplate', JSON.stringify(tpl.blocks))
    navigate('/marketing/campaigns/new')
    toast.success(`"${tpl.name}" template selected`)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FC' }}>
        <div className="px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/marketing')} className="text-gray-700 hover:text-gray-700"><ChevronLeft size={18} /></button>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-gray-900">Email Templates</h1>
              <p className="text-sm text-gray-700 mt-0.5">Pre-built templates to kickstart your campaigns</p>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 mb-6">
            {categories.map(c => (
              <button key={c} onClick={() => setFilter(c)}
                className={`text-sm px-3 py-1.5 rounded-lg capitalize font-medium transition-colors ${filter === c ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:text-gray-700 border border-gray-200'}`}>{c}</button>
            ))}
          </div>

          {/* Template grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((tpl, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all group" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {/* Mini preview */}
                <div className="h-48 bg-gray-50 p-4 border-b border-gray-100 overflow-hidden">
                  <div className="mx-auto bg-white rounded-lg shadow-sm overflow-hidden" style={{ width: '100%', maxWidth: 240 }}>
                    {tpl.preview.header && <div style={{ background: tpl.preview.header, padding: '8px 12px', textAlign: 'center' }}><p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 700 }}>Moose</p></div>}
                    {tpl.preview.hero && <div style={{ background: tpl.preview.hero, padding: '12px', textAlign: 'center' }}><p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 700 }}>Headline Here</p></div>}
                    {tpl.preview.body && <div style={{ padding: '8px 12px' }}><div className="h-1.5 bg-gray-200 rounded-full mb-1.5 w-full" /><div className="h-1.5 bg-gray-200 rounded-full mb-1.5 w-4/5" /><div className="h-1.5 bg-gray-200 rounded-full w-3/5" /></div>}
                    {tpl.preview.quote && <div style={{ padding: '6px 12px', borderLeft: '3px solid #ea2729', margin: '4px 12px', background: '#f9fafb' }}><div className="h-1 bg-gray-200 rounded-full w-full" /></div>}
                    {tpl.preview.cols && <div style={{ padding: '6px 12px', display: 'flex', gap: 8 }}><div className="flex-1"><div className="h-1 bg-gray-200 rounded-full mb-1" /><div className="h-1 bg-gray-200 rounded-full w-4/5" /></div><div className="flex-1"><div className="h-1 bg-gray-200 rounded-full mb-1" /><div className="h-1 bg-gray-200 rounded-full w-4/5" /></div></div>}
                    {tpl.preview.cta && <div style={{ padding: '6px 12px', textAlign: 'center' }}><span style={{ display: 'inline-block', background: '#ea2729', color: '#fff', fontSize: 12, padding: '3px 12px', borderRadius: 4 }}>Button</span></div>}
                    {tpl.preview.footer && <div style={{ background: '#f5f5f5', padding: '4px 12px', textAlign: 'center' }}><div className="h-1 bg-gray-300 rounded-full w-1/3 mx-auto" /></div>}
                    {Object.keys(tpl.preview).length === 0 && <div className="h-full flex items-center justify-center text-gray-600 text-sm py-8">Blank</div>}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">{tpl.name}</h3>
                    <span className="text-[12px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{tpl.category}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">{tpl.desc}</p>
                  <p className="text-[13px] text-gray-700 mb-3">{tpl.blocks.length} blocks</p>
                  <div className="flex gap-2">
                    <button onClick={() => useTemplate(tpl)} className="btn-primary text-sm flex-1 justify-center"><Layout size={12} /> Use Template</button>
                    {tpl.blocks.length > 0 && <button onClick={() => setPreview(tpl)} className="btn-secondary text-sm"><Eye size={12} /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preview modal */}
        {preview && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
                <h3 className="font-semibold text-gray-900">{preview.name}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => { useTemplate(preview); setPreview(null) }} className="btn-primary text-sm">Use Template</button>
                  <button onClick={() => setPreview(null)} className="text-gray-700"><X size={18} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 bg-gray-100">
                <div className="mx-auto bg-white rounded-lg overflow-hidden" style={{ maxWidth: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                  {preview.blocks.map((b, i) => {
                    const d = b.data
                    return (
                      <div key={i}>
                        {b.type === 'header' && <div style={{ background: d.bgColor, padding: '24px 32px', textAlign: 'center' }}><h1 style={{ margin: 0, color: d.textColor, fontSize: 22, fontWeight: 700 }}>{d.logoText}</h1>{d.tagline && <p style={{ margin: '6px 0 0', color: d.textColor, opacity: 0.7, fontSize: 15 }}>{d.tagline}</p>}</div>}
                        {b.type === 'hero' && <div style={{ background: d.bgColor, padding: '40px 32px', textAlign: 'center' }}><h1 style={{ margin: 0, color: d.textColor, fontSize: 28, fontWeight: 800 }}>{d.heading}</h1>{d.subtext && <p style={{ margin: '12px 0', color: d.textColor, opacity: 0.8, fontSize: 15 }}>{d.subtext}</p>}{d.btnText && <span style={{ display: 'inline-block', background: d.btnColor, color: '#fff', padding: '12px 28px', borderRadius: 8, fontWeight: 700, fontSize: 15, marginTop: 8 }}>{d.btnText}</span>}</div>}
                        {b.type === 'heading' && <div style={{ background: d.bgColor, padding: `${d.padding}px 32px`, textAlign: d.align }}><h2 style={{ margin: 0, color: d.textColor, fontSize: d.fontSize, fontWeight: 700 }}>{d.content}</h2></div>}
                        {b.type === 'text' && <div style={{ background: d.bgColor, padding: `${d.padding}px 32px`, textAlign: d.align }}><p style={{ margin: 0, color: d.textColor, fontSize: d.fontSize, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.content}</p></div>}
                        {b.type === 'button' && <div style={{ background: d.bgColor, padding: `${d.padding}px 32px`, textAlign: d.align }}><span style={{ display: 'inline-block', background: d.btnColor, color: d.textColor, padding: '12px 28px', borderRadius: d.borderRadius, fontWeight: 700, fontSize: 15 }}>{d.text}</span></div>}
                        {b.type === 'quote' && <div style={{ background: d.bgColor, padding: `${d.padding}px 32px` }}><div style={{ borderLeft: '4px solid #ea2729', paddingLeft: 16 }}><p style={{ margin: 0, fontStyle: 'italic', color: d.textColor, fontSize: 16 }}>{d.text}</p>{d.author && <p style={{ margin: '8px 0 0', color: d.textColor, opacity: 0.6, fontSize: 15 }}>&mdash; {d.author}</p>}</div></div>}
                        {b.type === 'divider' && <div style={{ padding: '16px 32px' }}><hr style={{ border: 'none', borderTop: '1px solid #e5e7eb' }} /></div>}
                        {b.type === 'twocol' && <div style={{ background: d.bgColor, padding: `${d.padding}px 32px`, display: 'flex', gap: 16 }}><div style={{ flex: 1, color: d.textColor, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.leftContent}</div><div style={{ flex: 1, color: d.textColor, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.rightContent}</div></div>}
                        {b.type === 'footer' && <div style={{ background: d.bgColor, padding: `${d.padding}px 32px`, textAlign: 'center' }}><p style={{ margin: 0, color: d.textColor, fontSize: 13 }}>{d.text}</p>{d.links && <p style={{ margin: '6px 0 0', color: d.textColor, fontSize: 13 }}>{d.links}</p>}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
