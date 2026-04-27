"use client"
import { ChevronRight, Check } from 'lucide-react'
import { T } from './tokens'

// The workhorse list-row from the reference app: full-width minus 24px
// h-margin, T.card fill, T.rMd radius, ~64px tall. Used as both quiz answer
// row AND main-app nav row — same component, different `variant`.
//
// Variants:
//   'quiz'     — selectable; left icon chip + label + optional subtitle.
//                Selected state flips chip to filled-black with white glyph.
//   'nav'      — non-selectable nav row; flat mono icon (no chip) +
//                label + chevron right.
//
// Usage:
//   <OptionListCard
//     variant="quiz"
//     icon={<Dumbbell size={14} />}
//     label="3-5 workouts per week"
//     subtitle="Solid base"
//     selected={value === '3-5'}
//     onClick={() => setValue('3-5')}
//   />
//
//   <OptionListCard
//     variant="nav"
//     icon={<Bell size={20} />}
//     label="Notifications"
//     onClick={() => navigate('/notifications')}
//   />

export default function OptionListCard({
  variant = 'quiz',
  icon,
  label,
  subtitle,
  selected = false,
  disabled = false,
  onClick,
  rightSlot,         // override the auto right-element if needed
}) {
  const isQuiz = variant === 'quiz'
  const isSelected = isQuiz && selected

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isQuiz ? isSelected : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: T.s3,
        width: '100%',
        minHeight: 64,
        padding: `${T.s3}px ${T.s4}px`,
        background: T.card,
        border: `1px solid ${isSelected ? T.ink : 'transparent'}`,
        borderRadius: T.rMd,
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        fontFamily: T.font,
        opacity: disabled ? 0.55 : 1,
        transition: 'border-color .15s ease, background .15s ease',
      }}
    >
      {/* Left slot — icon chip (quiz) or flat mono icon (nav) */}
      {icon ? (
        isQuiz ? (
          <span style={{
            flexShrink: 0,
            width: 36, height: 36, borderRadius: T.rPill,
            background: isSelected ? T.ink : T.iconChip,
            color: isSelected ? '#ffffff' : T.ink,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </span>
        ) : (
          <span style={{
            flexShrink: 0,
            width: 28, height: 28,
            color: T.ink,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </span>
        )
      ) : null}

      {/* Center — label + optional subtitle */}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: T.size.body,
          lineHeight: T.lh.body,
          fontWeight: T.weight.body,
          color: T.ink,
        }}>
          {label}
        </span>
        {subtitle ? (
          <span style={{
            fontSize: T.size.caption,
            lineHeight: T.lh.caption,
            fontWeight: T.weight.caption,
            color: T.ink3,
          }}>
            {subtitle}
          </span>
        ) : null}
      </span>

      {/* Right slot — chevron (nav), check (selected quiz), or override */}
      {rightSlot !== undefined ? (
        rightSlot
      ) : isQuiz && isSelected ? (
        <Check size={18} color={T.ink} strokeWidth={2.5} />
      ) : variant === 'nav' ? (
        <ChevronRight size={20} color={T.ink3} strokeWidth={2} />
      ) : null}
    </button>
  )
}
