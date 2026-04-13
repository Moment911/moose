"use client"
import { useState, useEffect } from 'react'
import { X, MousePointer2, Pin, ArrowUpRight, Circle, Square, PenLine, ZoomIn, MessageSquare, CheckCircle, GripVertical, Upload, Eye } from 'lucide-react'

const STEPS = [
  {
    title: 'Welcome to KotoProof',
    description: 'KotoProof is your design review and annotation tool. Upload files, leave feedback, track revisions, and get client approvals — all in one place.',
    icon: Eye,
    color: '#E6007E',
  },
  {
    title: 'Navigate Files',
    description: 'Use the thumbnail sidebar on the left to switch between files. Drag thumbnails to reorder them. Click a file name to rename it.',
    icon: GripVertical,
    color: '#00C2CB',
  },
  {
    title: 'Select Tool (V)',
    description: 'The default mode. Click and drag to scroll around the design. Click on existing annotations to select them.',
    icon: MousePointer2,
    color: '#6b7280',
  },
  {
    title: 'Comment Pin (C)',
    description: 'Click anywhere on the design to drop a pin and leave a comment. This is the most common way to give feedback.',
    icon: Pin,
    color: '#E6007E',
  },
  {
    title: 'Draw Shapes (A, O, R, F)',
    description: 'Use Arrow, Circle, Rectangle, or Freehand tools to draw directly on the design. Great for highlighting specific areas.',
    icon: ArrowUpRight,
    color: '#f59e0b',
  },
  {
    title: 'Zoom Controls (+/-)',
    description: 'Use the zoom bar or press + and - keys to zoom in and out. Press 0 to reset to 100%. Scroll to pan around.',
    icon: ZoomIn,
    color: '#7c3aed',
  },
  {
    title: 'Comments & Replies',
    description: 'The right sidebar shows all annotations. Click a comment to jump to it on the canvas. Reply to comments with @mentions to tag team members.',
    icon: MessageSquare,
    color: '#00C2CB',
  },
  {
    title: 'Approve Files',
    description: 'When you\'re happy with a file, click the green Approve button in the top bar. You can also set status: Needs Review, Changes Requested, Approved, or Final.',
    icon: CheckCircle,
    color: '#16a34a',
  },
  {
    title: 'Upload Versions',
    description: 'Upload a new version of any file from the project page. Use the Compare button to see changes side-by-side or with a slider overlay.',
    icon: Upload,
    color: '#7c3aed',
  },
]

const TOOLTIPS = {
  'select': 'Select mode (V) — click to select annotations, drag to scroll',
  'pin': 'Comment pin (C) — click on the design to leave a comment',
  'arrow': 'Arrow (A) — draw an arrow to point at something',
  'circle': 'Circle (O) — draw a circle to highlight an area',
  'rect': 'Rectangle (R) — draw a box around something',
  'freehand': 'Freehand (F) — draw freely on the design',
  'hotspot': 'Link hotspot (H) — create a clickable link area',
  'approve': 'Approve stamp (G) — stamp the design as approved',
}

export function KotoProofOnboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('koto_proof_tutorial_seen')
    if (seen) setDismissed(true)
  }, [])

  function finish() {
    localStorage.setItem('koto_proof_tutorial_seen', '1')
    setDismissed(true)
    if (onComplete) onComplete()
  }

  if (dismissed) return null

  const s = STEPS[step]
  const Icon = s.icon
  const isLast = step === STEPS.length - 1

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={finish}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 0, maxWidth: 480, width: '90%', boxShadow: '0 30px 80px rgba(0,0,0,.3)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        {/* Progress bar */}
        <div style={{ height: 4, background: '#f3f4f6' }}>
          <div style={{ height: 4, background: '#E6007E', width: `${((step + 1) / STEPS.length) * 100}%`, transition: 'width .3s ease', borderRadius: 2 }} />
        </div>

        <div style={{ padding: '32px 32px 24px' }}>
          {/* Icon */}
          <div style={{ width: 56, height: 56, borderRadius: 16, background: s.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Icon size={28} color={s.color} />
          </div>

          {/* Content */}
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 8, letterSpacing: '-.02em' }}>{s.title}</div>
          <div style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.7 }}>{s.description}</div>

          {/* Step counter */}
          <div style={{ display: 'flex', gap: 6, marginTop: 20 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, background: i === step ? '#E6007E' : i < step ? '#E6007E40' : '#e5e7eb', transition: 'all .3s', cursor: 'pointer' }} onClick={() => setStep(i)} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 32px 24px', gap: 12 }}>
          <button onClick={finish} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Skip Tutorial
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Back
              </button>
            )}
            <button onClick={() => isLast ? finish() : setStep(step + 1)} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#E6007E', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Tooltip component for tool buttons
export function ToolTooltip({ tool, children }) {
  const [show, setShow] = useState(false)
  const tip = TOOLTIPS[tool]
  if (!tip) return children

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          marginTop: 8, padding: '8px 12px', background: '#111', color: '#fff',
          fontSize: 12, fontWeight: 600, borderRadius: 8, whiteSpace: 'nowrap',
          zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,.3)', pointerEvents: 'none',
        }}>
          {tip}
          <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 8, height: 8, background: '#111' }} />
        </div>
      )}
    </div>
  )
}

// Help panel — accessible from a ? button
export function KotoProofHelp({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, maxWidth: 560, width: '90%', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>KotoProof Help</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ padding: '20px 28px' }}>
          {/* Keyboard shortcuts */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Keyboard Shortcuts</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['V', 'Select / Scroll'],
                ['C', 'Comment Pin'],
                ['A', 'Arrow'],
                ['O', 'Circle'],
                ['R', 'Rectangle'],
                ['F', 'Freehand'],
                ['G', 'Approve Stamp'],
                ['H', 'Link Hotspot'],
                ['+', 'Zoom In'],
                ['-', 'Zoom Out'],
                ['0', 'Reset Zoom'],
                ['Esc', 'Deselect / Cancel'],
                ['Ctrl+Z', 'Undo Last'],
                ['Enter', 'Submit Comment'],
              ].map(([key, desc]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                  <kbd style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, padding: '3px 8px', background: '#f3f4f6', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#374151', border: '1px solid #e5e7eb', fontFamily: 'monospace' }}>{key}</kbd>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* How-to sections */}
          {[
            { title: 'Leaving Feedback', steps: ['Select a tool from the toolbar (Pin is most common)', 'Click on the design where you want to comment', 'Type your feedback and press Enter or click Add Comment', 'Your comment appears in the right sidebar'] },
            { title: 'Replying to Comments', steps: ['Click any comment in the right sidebar', 'Click the Reply button', 'Type @ to mention a team member', 'Press Enter to submit your reply'] },
            { title: 'Managing Files', steps: ['Use the left thumbnail panel to switch between files', 'Drag thumbnails to reorder files', 'Click Prev/Next arrows in the top bar to navigate', 'Upload new versions from the project page'] },
            { title: 'Approving Designs', steps: ['Review all annotations and comments', 'Click the green Approve button in the top bar', 'Or use the status dropdown on the project page', 'Approved files show a green badge'] },
            { title: 'Comparing Versions', steps: ['Upload a new version of a file on the project page', 'Click the Compare button on the file card', 'Choose Side-by-Side or Slider mode', 'Drag the slider to compare pixel-by-pixel'] },
          ].map(section => (
            <div key={section.title} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>{section.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {section.steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#E6007E15', color: '#E6007E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
