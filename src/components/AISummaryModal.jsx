import { useState } from 'react'
import { X, Wand2, Copy, Send, Loader2 } from 'lucide-react'
import { callClaude } from '../lib/ai'
import { sendEmailSummary } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function AISummaryModal({ projectName, annotations, files, onClose }) {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const fileMap = {}
      annotations.forEach(a => {
        const fname = files?.find(f => f.id === a.file_id)?.name || 'Unknown file'
        if (!fileMap[fname]) fileMap[fname] = []
        fileMap[fname].push(a)
      })

      const context = Object.entries(fileMap).map(([fname, anns]) =>
        `File: ${fname}\n${anns.map(a => `  - [${a.type}] ${a.author || 'Client'}: "${a.text || 'no text'}" (${a.resolved ? 'resolved' : 'open'})`).join('\n')}`
      ).join('\n\n')

      const prompt = `Analyze these client feedback annotations for the project "${projectName}" and provide:

1. **Executive Summary** - A 2-3 sentence overview of all feedback
2. **Prioritized Action List** - Numbered list of changes needed, most critical first
3. **Feedback by Theme** - Group into categories:
   - Typography & Fonts
   - Layout & Spacing
   - Content & Copy
   - Colors & Visual Style
   - Functionality & UX
4. **Complexity Estimates** - For each action item, tag as: Quick Fix (< 30min), Moderate (1-2 hrs), Major Change (3+ hrs)
5. **Recommended Order** - Suggest which changes to tackle first and why

Here are all the annotations:

${context}`

      const text = await callClaude('You are a senior project manager at a design agency. Analyze client feedback and create actionable summaries. Use markdown formatting with headers, bold text, and bullet points.', prompt, 3000)
      setResult(text); setLoaded(true)
    } catch (e) {
      setResult(`Error: ${e.message}. Make sure VITE_ANTHROPIC_API_KEY is set.`)
      setLoaded(true)
    }
    setLoading(false)
  }

  function renderMarkdown(text) {
    return text
      .replace(/### (.*)/g, '<h3 class="font-bold text-sm mt-4 mb-2 text-gray-900">$1</h3>')
      .replace(/## (.*)/g, '<h2 class="font-bold text-base mt-4 mb-2 text-gray-900">$1</h2>')
      .replace(/# (.*)/g, '<h1 class="font-bold text-lg mt-4 mb-2 text-gray-900">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*)/gm, '<li class="ml-4 list-disc text-sm leading-relaxed text-gray-700">$1</li>')
      .replace(/^(\d+)\. (.*)/gm, '<li class="ml-4 list-decimal text-sm leading-relaxed text-gray-700">$2</li>')
      .replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>')
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><Wand2 size={18} className="text-momenta-500" /><h2 className="font-semibold text-gray-900">AI Feedback Summary</h2></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!loaded && !loading && (
            <div className="text-center py-12">
              <Wand2 size={40} className="text-momenta-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Summarize with AI</h3>
              <p className="text-sm text-gray-500 mb-6">Claude will analyze {annotations.length} annotation{annotations.length !== 1 ? 's' : ''} and create a prioritized action plan.</p>
              <button onClick={generate} className="bg-gradient-to-r from-momenta-500 to-brand-500 text-white font-medium px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto">
                <Wand2 size={15} /> Generate Summary
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-16">
              <Loader2 size={32} className="text-momenta-500 mx-auto mb-4 animate-spin" />
              <p className="text-sm text-gray-500">Analyzing feedback...</p>
            </div>
          )}

          {loaded && result && (
            <div className="prose-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(result) }} />
          )}
        </div>

        {loaded && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button onClick={() => { navigator.clipboard.writeText(result); toast.success('Copied!') }}
              className="btn-secondary text-xs"><Copy size={13} /> Copy to Clipboard</button>
            <button onClick={async () => {
              await sendEmailSummary({ type: 'ai_summary', project_name: projectName, summary: result })
              toast.success('Emailed!')
            }} className="btn-secondary text-xs"><Send size={13} /> Email to Myself</button>
            <button onClick={onClose} className="btn-primary text-xs">Done</button>
          </div>
        )}
      </div>
    </div>
  )
}
