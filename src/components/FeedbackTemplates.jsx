"use client";
import { useState } from 'react'
import { FileText, X, ChevronDown, ChevronRight } from 'lucide-react'

const CATEGORIES = [
  { name: 'General Design', templates: [
    'The layout feels too cluttered in this section',
    'Love the overall design direction!',
    "This doesn't match our brand guidelines",
    'Can we make this section more prominent?',
    'The spacing here feels off',
    'This looks great, no changes needed',
  ]},
  { name: 'Typography', templates: [
    'The font is hard to read at this size',
    'Can we try a different font here?',
    'This heading is too small',
    'Love the typography choice!',
    'Can we make this text bolder?',
  ]},
  { name: 'Colors', templates: [
    "This color doesn't match our brand colors",
    'Can we try a darker shade here?',
    'The contrast is hard to read',
    'These colors work great together!',
  ]},
  { name: 'Content', templates: [
    "The copy needs to be updated \u2014 I'll send new text",
    'Can we add/remove this section?',
    "This image isn't right, I'll send a replacement",
    'The content order should be changed',
    'Please add a call-to-action button here',
  ]},
  { name: 'Functionality', templates: [
    "This button doesn't work as expected",
    'The mobile version needs attention',
    'Navigation is confusing',
    'The form fields need different labels',
  ]},
]

export default function FeedbackTemplates({ onSelect, onClose }) {
  const [expanded, setExpanded] = useState(CATEGORIES[0].name)

  return (
    <div className="border-t border-gray-100">
      <div className="px-4 py-2.5 flex items-center justify-between bg-gray-50">
        <span className="text-sm font-semibold text-gray-600 flex items-center gap-1"><FileText size={12} /> Feedback Templates</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {CATEGORIES.map(cat => (
          <div key={cat.name}>
            <button onClick={() => setExpanded(expanded === cat.name ? null : cat.name)}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              {expanded === cat.name ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              {cat.name}
              <span className="text-[13px] text-gray-400 ml-auto">{cat.templates.length}</span>
            </button>
            {expanded === cat.name && (
              <div className="pb-1">
                {cat.templates.map((t, i) => (
                  <button key={i} onClick={() => onSelect(t)}
                    className="w-full text-left px-6 py-1.5 text-[13px] text-gray-600 hover:bg-brand-50 hover:text-brand-700 transition-colors leading-relaxed">
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
