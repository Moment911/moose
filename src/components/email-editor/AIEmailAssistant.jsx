"use client";
import { useState } from 'react'
import { Sparkles, X, Loader2, ArrowRight, Check, RefreshCw } from 'lucide-react'
import { generateEmailContent } from '../../lib/ai'
import toast from 'react-hot-toast'

const QUESTIONS = [
  { key: 'topic', label: 'What is this email about?', placeholder: 'e.g., New website launch, Monthly newsletter, Project update...', type: 'text' },
  { key: 'audience', label: 'Who is the audience?', placeholder: 'e.g., Existing clients, New leads, VIP customers...', type: 'text' },
  { key: 'tone', label: 'What tone should we use?', type: 'single', options: ['Professional', 'Friendly & Casual', 'Urgent', 'Inspirational', 'Educational', 'Promotional'] },
  { key: 'cta', label: 'What action should readers take?', placeholder: 'e.g., Visit our website, Schedule a call, Download guide...', type: 'text' },
  { key: 'sections', label: 'What sections do you want?', type: 'multi', options: ['Hero banner', 'Introduction', 'Features/Benefits', 'Testimonial', 'CTA button', 'Social links', 'Footer'] },
]

export default function AIEmailAssistant({ open, onClose, onApply }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  function handleAnswer(key, value) {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  function toggleOption(key, option) {
    const current = answers[key] || []
    const arr = Array.isArray(current) ? current : []
    const updated = arr.includes(option) ? arr.filter(o => o !== option) : [...arr, option]
    setAnswers(prev => ({ ...prev, [key]: updated }))
  }

  function isAnswered(q) {
    const val = answers[q.key]
    if (!val) return false
    if (Array.isArray(val)) return val.length > 0
    if (typeof val === 'string') return val.trim().length > 0
    return true
  }

  function nextStep() {
    const q = QUESTIONS[step]
    if (!isAnswered(q)) {
      toast.error('Please answer this question')
      return
    }
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1)
    } else {
      handleGenerate()
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const sectionsStr = Array.isArray(answers.sections) ? answers.sections.join(', ') : (answers.sections || '')
      const toneStr = answers.tone || 'Professional'
      const raw = await generateEmailContent(answers.topic, answers.audience, toneStr, answers.cta, sectionsStr)

      // Parse JSON - handle markdown fences and surrounding text
      let cleaned = raw.trim()
      // Remove markdown code fences
      const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
      if (fenceMatch) {
        cleaned = fenceMatch[1].trim()
      }
      // Try to extract JSON object if there's surrounding text
      if (!cleaned.startsWith('{')) {
        const jsonStart = cleaned.indexOf('{')
        if (jsonStart >= 0) {
          cleaned = cleaned.slice(jsonStart)
        }
      }
      if (!cleaned.endsWith('}')) {
        const jsonEnd = cleaned.lastIndexOf('}')
        if (jsonEnd >= 0) {
          cleaned = cleaned.slice(0, jsonEnd + 1)
        }
      }

      const parsed = JSON.parse(cleaned)

      if (!parsed.blocks || !Array.isArray(parsed.blocks)) {
        throw new Error('AI response missing blocks array')
      }

      setResult(parsed)
    } catch (e) {
      console.error('AI generation error:', e)
      const msg = e.message || 'Unknown error'
      if (msg.includes('API key') || msg.includes('401') || msg.includes('not set')) {
        setError('Anthropic API key is missing or invalid. Add NEXT_PUBLIC_ANTHROPIC_API_KEY to your .env.local file.')
      } else if (msg.includes('JSON') || msg.includes('Unexpected token')) {
        setError('AI returned invalid format. Please try again.')
      } else {
        setError(msg)
      }
      toast.error('Failed to generate email')
    }
    setGenerating(false)
  }

  function handleApply() {
    if (!result) return
    const blocks = result.blocks.map((b, i) => ({
      id: 'ai' + Date.now() + i,
      type: b.type,
      data: { ...b.data }
    }))
    onApply(blocks, result.subject, result.preview)
    toast.success('AI email loaded into editor!')
    handleClose()
  }

  function handleClose() {
    reset()
    onClose()
  }

  function reset() {
    setStep(0)
    setAnswers({})
    setResult(null)
    setError(null)
    setGenerating(false)
  }

  if (!open) return null

  const q = QUESTIONS[step]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0" style={{ background: '#231f20' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-400" />
            <span className="text-sm font-semibold text-white">AI Email Designer</span>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-auto">
          {/* Generating state */}
          {generating && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-brand-500 mb-4" />
              <p className="text-sm font-medium text-gray-700">Writing your email...</p>
              <p className="text-sm text-gray-400 mt-1">This takes about 10-15 seconds</p>
            </div>
          )}

          {/* Error state */}
          {error && !generating && (
            <div className="p-8 text-center">
              <p className="text-sm text-red-500 mb-3">{error}</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setError(null); handleGenerate() }} className="btn-primary text-sm"><RefreshCw size={12} /> Retry</button>
                <button onClick={reset} className="btn-secondary text-sm">Start Over</button>
              </div>
            </div>
          )}

          {/* Result preview */}
          {result && !generating && !error && (
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Subject Line</p>
                <p className="text-sm font-semibold text-gray-900">{result.subject}</p>
                {result.preview && <p className="text-sm text-gray-400 mt-1">Preview: {result.preview}</p>}
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden mb-4" style={{ maxHeight: 400 }}>
                <div className="overflow-auto" style={{ maxHeight: 400 }}>
                  {(result.blocks || []).map((b, i) => {
                    const d = b.data || {}
                    return (
                      <div key={i}>
                        {b.type === 'header' && <div style={{ background: d.bgColor, padding: '24px 32px', textAlign: 'center' }}><h1 style={{ margin: 0, color: d.textColor, fontSize: 22, fontWeight: 700 }}>{d.logoText}</h1>{d.tagline && <p style={{ margin: '6px 0 0', color: d.textColor, opacity: 0.7, fontSize:13 }}>{d.tagline}</p>}</div>}
                        {b.type === 'heading' && <div style={{ background: d.bgColor || '#fff', padding: `${d.padding || 24}px 32px`, textAlign: d.align || 'center' }}><h2 style={{ margin: 0, color: d.textColor || '#1a1a1a', fontSize: d.fontSize || 28, fontWeight: 700 }}>{d.content}</h2></div>}
                        {b.type === 'text' && <div style={{ background: d.bgColor || '#fff', padding: `${d.padding || 24}px 32px`, textAlign: d.align || 'left' }}><p style={{ margin: 0, color: d.textColor || '#333', fontSize: d.fontSize || 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.content}</p></div>}
                        {b.type === 'button' && <div style={{ background: d.bgColor || '#fff', padding: `${d.padding || 24}px 32px`, textAlign: d.align || 'center' }}><span style={{ display: 'inline-block', background: d.btnColor || '#ea2729', color: d.textColor || '#fff', padding: '12px 28px', borderRadius: d.borderRadius || 8, fontWeight: 600, fontSize: 14 }}>{d.text}</span></div>}
                        {b.type === 'hero' && <div style={{ background: d.bgColor || '#231f20', padding: '40px 32px', textAlign: 'center' }}><h1 style={{ margin: 0, color: d.textColor || '#fff', fontSize: 28, fontWeight: 800 }}>{d.heading}</h1>{d.subtext && <p style={{ margin: '12px 0', color: d.textColor || '#fff', opacity: 0.8, fontSize: 14 }}>{d.subtext}</p>}{d.btnText && <span style={{ display: 'inline-block', background: d.btnColor || '#ea2729', color: '#fff', padding: '12px 28px', borderRadius: 8, fontWeight: 600, fontSize: 14, marginTop: 8 }}>{d.btnText}</span>}</div>}
                        {b.type === 'quote' && <div style={{ background: d.bgColor || '#f9fafb', padding: `${d.padding || 24}px 32px` }}><div style={{ borderLeft: '4px solid #ea2729', paddingLeft: 16 }}><p style={{ margin: 0, fontStyle: 'italic', color: d.textColor || '#374151', fontSize: 16 }}>{d.text}</p>{d.author && <p style={{ margin: '8px 0 0', color: d.textColor || '#374151', opacity: 0.6, fontSize: 13 }}>&mdash; {d.author}</p>}</div></div>}
                        {b.type === 'list' && <div style={{ background: d.bgColor || '#fff', padding: `${d.padding || 24}px 32px` }}><ul style={{ margin: 0, paddingLeft: 20 }}>{(d.items || []).map((item, j) => <li key={j} style={{ color: d.textColor || '#333', fontSize: 14, lineHeight: 1.8 }}>{item}</li>)}</ul></div>}
                        {b.type === 'divider' && <div style={{ background: d.bgColor || '#fff', padding: '16px 32px' }}><hr style={{ border: 'none', borderTop: '1px solid #e5e7eb' }} /></div>}
                        {b.type === 'spacer' && <div style={{ height: d.height || 24 }} />}
                        {b.type === 'twocol' && <div style={{ background: d.bgColor || '#fff', padding: `${d.padding || 24}px 32px`, display: 'flex', gap: 16 }}><div style={{ flex: 1, color: d.textColor || '#333', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.leftContent}</div><div style={{ flex: 1, color: d.textColor || '#333', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.rightContent}</div></div>}
                        {b.type === 'footer' && <div style={{ background: d.bgColor || '#f5f5f5', padding: `${d.padding || 24}px 32px`, textAlign: 'center' }}><p style={{ margin: 0, color: d.textColor || '#999', fontSize:13 }}>{d.text}</p>{d.links && <p style={{ margin: '6px 0 0', color: d.textColor || '#999', fontSize:13 }}>{d.links}</p>}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleApply} className="btn-primary text-sm flex-1 justify-center"><Check size={14} /> Open in Editor</button>
                <button onClick={() => { setResult(null); setError(null); handleGenerate() }} className="btn-secondary text-sm"><RefreshCw size={12} /> Regenerate</button>
                <button onClick={reset} className="btn-secondary text-sm">Start Over</button>
              </div>
            </div>
          )}

          {/* Questions flow */}
          {!generating && !result && !error && (
            <div className="p-6">
              {/* Progress */}
              <div className="flex items-center gap-1 mb-6">
                {QUESTIONS.map((_, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-brand-500' : 'bg-gray-200'}`} />
                ))}
              </div>

              <p className="text-sm text-gray-400 mb-1">Question {step + 1} of {QUESTIONS.length}</p>
              <h3 className="text-base font-semibold text-gray-900 mb-4">{q.label}</h3>

              {q.type === 'text' && (
                <input className="input text-sm w-full" placeholder={q.placeholder} value={answers[q.key] || ''}
                  onChange={e => handleAnswer(q.key, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') nextStep() }} autoFocus />
              )}

              {q.type === 'single' && (
                <div className="flex flex-wrap gap-2">
                  {q.options.map(opt => {
                    const selected = answers[q.key] === opt
                    return (
                      <button key={opt} onClick={() => handleAnswer(q.key, opt)}
                        className={`text-sm px-4 py-2.5 rounded-xl border transition-all ${selected ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-700 border-gray-200 hover:border-brand-300'}`}>
                        {selected && <Check size={12} className="inline mr-1" />}{opt}
                      </button>
                    )
                  })}
                </div>
              )}

              {q.type === 'multi' && (
                <div className="flex flex-wrap gap-2">
                  {q.options.map(opt => {
                    const arr = Array.isArray(answers[q.key]) ? answers[q.key] : []
                    const selected = arr.includes(opt)
                    return (
                      <button key={opt} onClick={() => toggleOption(q.key, opt)}
                        className={`text-sm px-4 py-2.5 rounded-xl border transition-all ${selected ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-700 border-gray-200 hover:border-brand-300'}`}>
                        {selected && <Check size={12} className="inline mr-1" />}{opt}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center justify-between mt-6">
                <button onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0}
                  className="text-sm text-gray-400 hover:text-gray-700 disabled:opacity-30">Back</button>
                <button onClick={nextStep} className="btn-primary text-sm">
                  {step < QUESTIONS.length - 1 ? <>Next <ArrowRight size={12} /></> : <><Sparkles size={12} /> Generate Email</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
