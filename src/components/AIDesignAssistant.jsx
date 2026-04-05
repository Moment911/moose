"use client";
import { useState, useRef, useEffect } from 'react'
import { Wand2, X, Send, Copy, Loader2 } from 'lucide-react'
import { streamClaude, callClaude } from '../lib/ai'
import toast from 'react-hot-toast'

const SUGGESTED_PROMPTS = [
  'Summarize client feedback',
  'Suggest a color palette',
  'Write hero section copy',
  'Recommend layout changes',
  'Prioritize revisions',
  'Generate marketing headlines',
]

export default function AIDesignAssistant({ projectName, projectType, annotations, open, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight) }, [messages])

  const systemPrompt = `You are a senior design consultant for Koto, a creative design agency. You're helping with a ${projectType || 'design'} project called "${projectName || 'Untitled'}".

Current client feedback/annotations:
${(annotations || []).slice(0, 30).map(a => `- [${a.type}] ${a.author || 'Client'}: "${a.text || 'no text'}" (${a.resolved ? 'resolved' : 'open'})`).join('\n') || 'No annotations yet.'}

Be concise, actionable, and professional. Format responses with markdown headers, bullet points, and bold text for emphasis. When suggesting design changes, be specific about what to change and why.`

  async function handleSend(text) {
    const msg = text || input.trim()
    if (!msg) return
    setInput('')
    const newMsgs = [...messages, { role: 'user', content: msg }]
    setMessages(newMsgs)
    setLoading(true)

    try {
      const apiMsgs = newMsgs.map(m => ({ role: m.role, content: m.content }))
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      await streamClaude(systemPrompt, apiMsgs, 2000, (partial) => {
        setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: partial }])
      })
    } catch (e) {
      // Fallback to non-streaming
      try {
        const result = await callClaude(systemPrompt, msg)
        setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: result }])
      } catch (e2) {
        setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: `Error: ${e2.message}. Make sure NEXT_PUBLIC_ANTHROPIC_API_KEY is set in your environment.` }])
      }
    }
    setLoading(false)
  }

  function copyMessage(content) {
    navigator.clipboard.writeText(content)
    toast.success('Copied to clipboard')
  }

  function renderMarkdown(text) {
    return text
      .replace(/### (.*)/g, '<h3 class="font-bold text-sm mt-3 mb-1">$1</h3>')
      .replace(/## (.*)/g, '<h2 class="font-bold text-base mt-3 mb-1">$1</h2>')
      .replace(/# (.*)/g, '<h1 class="font-bold text-lg mt-3 mb-2">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*)/gm, '<li class="ml-4 list-disc text-sm leading-relaxed">$1</li>')
      .replace(/^(\d+)\. (.*)/gm, '<li class="ml-4 list-decimal text-sm leading-relaxed">$2</li>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>')
  }

  if (!open) return null

  return (
    <div className="fixed right-4 bottom-4 w-96 h-[560px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0" style={{ background: '#231f20' }}>
        <div className="flex items-center gap-2">
          <Wand2 size={16} className="text-brand-400" />
          <span className="text-sm font-semibold text-white">AI Design Assistant</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Wand2 size={32} className="text-brand-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">Ask me anything about your design project</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {SUGGESTED_PROMPTS.map(p => (
                <button key={p} onClick={() => handleSend(p)}
                  className="text-sm px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors border border-brand-200">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
              m.role === 'user' ? 'bg-brand-500 text-white text-sm' : 'bg-gray-100 text-gray-800'
            }`}>
              {m.role === 'user' ? (
                <p className="text-sm">{m.content}</p>
              ) : m.content ? (
                <div className="relative group">
                  <div className="text-sm leading-relaxed prose-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                  <button onClick={() => copyMessage(m.content)}
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 p-1 transition-opacity"><Copy size={10} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={12} className="animate-spin" /> Thinking...</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Suggested prompts after conversation starts */}
      {messages.length > 0 && !loading && (
        <div className="px-4 py-2 flex gap-1.5 overflow-x-auto flex-shrink-0 border-t border-gray-50">
          {SUGGESTED_PROMPTS.slice(0, 3).map(p => (
            <button key={p} onClick={() => handleSend(p)} className="text-[13px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors whitespace-nowrap">{p}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
        <div className="flex gap-2">
          <input className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            placeholder="Ask about design, copy, colors..." value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} disabled={loading} />
          <button onClick={() => handleSend()} disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 disabled:opacity-40 transition-colors flex-shrink-0">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
