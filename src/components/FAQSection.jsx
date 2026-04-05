"use client";
import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'

export default function FAQSection({ items, title = 'Frequently Asked Questions', compact = false }) {
  const [openIdx, setOpenIdx] = useState(null)

  if (!items?.length) return null

  return (
    <div className={compact ? '' : 'mt-6'}>
      <h3 className={`flex items-center gap-2 mb-3 ${compact ? 'text-sm font-semibold text-gray-500 uppercase tracking-wide' : 'text-sm font-semibold text-gray-900'}`}>
        <HelpCircle size={compact ? 12 : 14} className={compact ? 'text-gray-400' : 'text-brand-500'} />
        {title}
      </h3>
      <div className={compact ? 'space-y-0.5' : 'card divide-y divide-gray-100 overflow-hidden'}>
        {items.map((item, i) => (
          <div key={i} className={compact ? '' : ''}>
            <button onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className={`w-full flex items-center justify-between gap-3 text-left transition-colors ${
                compact ? 'px-3 py-2 rounded-lg hover:bg-gray-100 text-sm' : 'px-5 py-3.5 hover:bg-gray-50 text-sm'
              }`}>
              <span className={`font-medium ${compact ? 'text-gray-600' : 'text-gray-800'}`}>{item.question}</span>
              <ChevronDown size={compact ? 12 : 14} className={`text-gray-400 flex-shrink-0 transition-transform ${openIdx === i ? 'rotate-180' : ''}`} />
            </button>
            {openIdx === i && (
              <div className={`${compact ? 'px-3 pb-2' : 'px-5 pb-4'}`}>
                <p className={`${compact ? 'text-[13px]' : 'text-sm'} text-gray-500 leading-relaxed`}>{item.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export const ADMIN_FAQ = [
  { question: 'How do I create a new client and project?', answer: 'Click the "+" icon next to "Clients" in the sidebar to add a client. Then expand the client and click "New project" to create a project. You can set the project type, client email, and number of revision rounds.' },
  { question: 'How do review rounds work?', answer: 'Each project has a configurable number of review rounds (default: 2). Clients leave comments on your designs, then submit their feedback as a round. You can see round status on each project card and in the Rounds tab.' },
  { question: 'What are the access level options?', answer: 'Public: anyone with the link can view and comment. Password: requires a password you set. Private: only accessible when logged into the admin dashboard.' },
  { question: 'How do I share a design for review?', answer: 'Go to your project, click "Access" to set it to Public or Password, then copy the review link. Send that link to your client via email or the built-in invite system.' },
  { question: 'How do Design Canvas and Email Designer work?', answer: 'From any project page, click "New Canvas" for a freehand drawing/design tool with multi-page support, or "New Email" for a drag-and-drop email HTML builder. Both save automatically and can be exported.' },
  { question: 'How do I manage team access?', answer: 'In any project, go to the "Team" tab to add members by email with roles (Admin, Staff, Client, Viewer). You can change roles, resend invites, or remove access at any time.' },
  { question: 'How do approval stamps work?', answer: 'Select the green checkmark tool (G key) in the annotation toolbar and click on areas of the design to mark them as approved. These show in the sidebar under the Approved filter.' },
]

export const CLIENT_FAQ = [
  { question: 'How do I leave feedback?', answer: 'Enter your name in the sidebar, select a tool (pin, circle, arrow, or box), then click on the design where you want to comment. Type your note and press Enter to save.' },
  { question: 'What tools are available?', answer: 'Pin: place a comment marker. Circle: highlight an area. Arrow: point to something. Box: draw a rectangle around a region. All annotations can have text comments attached.' },
  { question: 'How do I submit my changes?', answer: 'After adding all your comments, click the red "SUBMIT CHANGES" button at the bottom of the sidebar. This sends your feedback to the design team as a completed revision round.' },
  { question: 'How many revision rounds do I get?', answer: 'Your project has a set number of revision rounds (shown in the top bar). Each time you submit feedback counts as one round. Contact Koto if you need additional revisions.' },
  { question: 'Can I edit a comment after placing it?', answer: 'Yes! Click on any annotation you placed to open the edit bubble. You can change the text, then click Send to update it.' },
]
