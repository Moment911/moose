"use client";
import { useState } from 'react'
import { Pin, Send, ArrowRight, Check } from 'lucide-react'

export default function ClientOnboarding({ projectId, projectName, maxRounds, onComplete }) {
  const key = `mm_onboarded_${projectId}`
  const [step, setStep] = useState(0)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(key) === '1')

  if (dismissed) return null

  function finish() { localStorage.setItem(key, '1'); setDismissed(true); onComplete?.() }

  const steps = [
    // Step 1 — Welcome
    <div key={0} className="text-center">
      <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg width="24" height="24" viewBox="0 0 20 20" fill="none"><path d="M3 4h14M3 10h10M3 16h6" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to your design review!</h2>
      <p className="text-gray-500 mb-1">{projectName || 'Your project'}</p>
      <p className="text-sm text-gray-400 mb-8">Here's how to leave feedback in 3 easy steps</p>
      <button onClick={() => setStep(1)} className="bg-brand-500 text-white font-semibold px-8 py-3 rounded-xl hover:bg-brand-600 text-sm transition-colors">Get Started <ArrowRight size={14} className="inline ml-1" /></button>
    </div>,

    // Step 2 — How to comment
    <div key={1} className="text-center">
      <div className="w-20 h-20 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4 relative">
        <Pin size={32} className="text-brand-500" />
        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center animate-bounce">
          <span className="text-lg">👆</span>
        </div>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Place a comment pin</h2>
      <p className="text-sm text-gray-500 mb-2">Click the <span className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 px-2 py-0.5 rounded font-medium">📍 Pin</span> tool, then click anywhere on the design</p>
      <p className="text-sm text-gray-400 mb-8">A comment box will appear — type your feedback and press Enter</p>
      <div className="flex gap-3 justify-center">
        <button onClick={() => setStep(0)} className="text-sm text-gray-500 px-4 py-2">Back</button>
        <button onClick={() => setStep(2)} className="bg-brand-500 text-white font-semibold px-8 py-3 rounded-xl hover:bg-brand-600 text-sm">Next <ArrowRight size={14} className="inline ml-1" /></button>
      </div>
    </div>,

    // Step 3 — Submit
    <div key={2} className="text-center">
      <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Send size={32} className="text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Submit your feedback</h2>
      <p className="text-sm text-gray-500 mb-2">When you're done reviewing, click the <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded font-medium">Submit Changes</span> button</p>
      {maxRounds && <p className="text-sm text-gray-400 mb-2">You have <strong>{maxRounds}</strong> revision round{maxRounds !== 1 ? 's' : ''} included with your project</p>}
      <p className="text-xs text-gray-400 mb-8">Each submission counts as one round</p>
      <button onClick={finish} className="bg-green-500 text-white font-semibold px-8 py-3 rounded-xl hover:bg-green-600 text-sm">Let's go! <Check size={14} className="inline ml-1" /></button>
    </div>,
  ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        {/* Skip */}
        <button onClick={finish} className="absolute top-4 right-4 text-xs text-gray-400 hover:text-gray-600">Skip</button>

        {steps[step]}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {[0, 1, 2].map(i => <div key={i} className={`w-2 h-2 rounded-full transition-colors ${step >= i ? 'bg-brand-500' : 'bg-gray-200'}`} />)}
        </div>
      </div>
    </div>
  )
}
