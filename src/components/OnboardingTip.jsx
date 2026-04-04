"use client";
import { useState } from 'react'
import { X, Lightbulb } from 'lucide-react'

export default function OnboardingTip({ id, children }) {
  const key = `mm_tip_${id}`
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(key) === '1')

  if (dismissed) return null

  function dismiss() { localStorage.setItem(key, '1'); setDismissed(true) }

  return (
    <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
      <Lightbulb size={16} strokeWidth={1.5} className="text-brand-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-brand-800 flex-1">{children}</p>
      <button onClick={dismiss} className="text-brand-400 hover:text-brand-600 flex-shrink-0"><X size={14} /></button>
    </div>
  )
}
