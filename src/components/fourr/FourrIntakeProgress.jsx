import { Check } from 'lucide-react'
import {
  GOLD, CREAM, TEXT_BODY, TEXT_MUTED,
  CARD_BG, CARD_BORDER,
  FONT_HEADING,
} from '../../lib/fourr/fourrTheme'

// ─────────────────────────────────────────────────────────────────────────────
// FourrIntakeProgress — shows field extraction progress during chat.
//
// Displays as a horizontal progress bar on mobile, with category breakdown
// on wider screens.
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'chief_complaint', label: 'Chief Complaint', count: 6 },
  { key: 'demographics', label: 'Demographics', count: 2 },
  { key: 'medical_history', label: 'Medical History', count: 3 },
  { key: 'previous_treatment', label: 'Previous Treatment', count: 3 },
  { key: 'lifestyle', label: 'Lifestyle', count: 4 },
  { key: 'goals_safety', label: 'Goals & Safety', count: 2 },
  { key: 'context', label: 'Your Story', count: 1 },
]

const TOTAL = CATEGORIES.reduce((s, c) => s + c.count, 0)

export default function FourrIntakeProgress({ extractedCount, totalRequired }) {
  const percent = totalRequired > 0
    ? Math.round((extractedCount / totalRequired) * 100)
    : 0

  return (
    <div style={{
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      borderRadius: 12,
      padding: '14px 18px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: GOLD,
          textTransform: 'uppercase',
          letterSpacing: '.08em',
        }}>
          Assessment Progress
        </span>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: CREAM,
        }}>
          {extractedCount} / {totalRequired}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4,
        borderRadius: 2,
        background: CARD_BORDER,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${percent}%`,
          background: GOLD,
          borderRadius: 2,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {percent === 100 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 8,
          fontSize: 12,
          color: GOLD,
          fontWeight: 700,
        }}>
          <Check size={14} /> All fields captured
        </div>
      )}
    </div>
  )
}
