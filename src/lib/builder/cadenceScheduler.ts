/**
 * Cadence Scheduler (ORCH-02)
 *
 * Given a campaign's cadence config, produces a publish schedule —
 * an ordered array of { variant_id, scheduled_at } respecting the
 * campaign's cadence type (burst | drip | weekly).
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface CadenceConfig {
  per_day_cap?: number
  start_at?: string   // ISO datetime or HH:mm time string
  timezone?: string   // IANA timezone, e.g. 'America/New_York'
}

export interface CampaignForScheduling {
  id: string
  cadence: 'burst' | 'drip' | 'weekly'
  cadence_config: CadenceConfig | null
}

export interface ScheduledVariant {
  variant_id: string
  scheduled_at: Date
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_PER_DAY_CAP = 10
const DEFAULT_TIMEZONE = 'America/New_York'

// ── Scheduler ───────────────────────────────────────────────────────────────

/**
 * Build a publish schedule for a set of variant IDs given a campaign config.
 *
 * @param campaign  - Campaign with cadence + cadence_config
 * @param variantIds - Ordered list of variant IDs to schedule
 * @returns Array of { variant_id, scheduled_at } in chronological order
 */
export function getPublishSchedule(
  campaign: CampaignForScheduling,
  variantIds: string[]
): ScheduledVariant[] {
  if (!variantIds.length) return []

  const config = campaign.cadence_config || {}
  const startAt = resolveStartTime(config.start_at, config.timezone)

  switch (campaign.cadence) {
    case 'burst':
      return scheduleBurst(variantIds, startAt)
    case 'drip':
      return scheduleDrip(variantIds, startAt, config.per_day_cap)
    case 'weekly':
      return scheduleWeekly(variantIds, startAt, config.per_day_cap)
    default:
      // Fallback to burst if cadence is unknown
      return scheduleBurst(variantIds, startAt)
  }
}

// ── Strategy implementations ────────────────────────────────────────────────

/**
 * Burst: all variants publish at the same time (now or start_at).
 */
function scheduleBurst(variantIds: string[], startAt: Date): ScheduledVariant[] {
  return variantIds.map(variant_id => ({
    variant_id,
    scheduled_at: startAt,
  }))
}

/**
 * Drip: spread variants across days, capped at `per_day_cap` per day.
 * Each day's batch publishes at the `start_at` time.
 */
function scheduleDrip(
  variantIds: string[],
  startAt: Date,
  perDayCap?: number
): ScheduledVariant[] {
  const cap = perDayCap || DEFAULT_PER_DAY_CAP
  const schedule: ScheduledVariant[] = []
  let dayOffset = 0

  for (let i = 0; i < variantIds.length; i++) {
    if (i > 0 && i % cap === 0) {
      dayOffset++
    }
    const scheduledAt = new Date(startAt)
    scheduledAt.setDate(scheduledAt.getDate() + dayOffset)

    schedule.push({
      variant_id: variantIds[i],
      scheduled_at: scheduledAt,
    })
  }

  return schedule
}

/**
 * Weekly: one batch per week, capped at `per_day_cap` per batch.
 * If there are more variants than the cap, they spill into the next week.
 */
function scheduleWeekly(
  variantIds: string[],
  startAt: Date,
  perBatchCap?: number
): ScheduledVariant[] {
  const cap = perBatchCap || DEFAULT_PER_DAY_CAP
  const schedule: ScheduledVariant[] = []
  let weekOffset = 0

  for (let i = 0; i < variantIds.length; i++) {
    if (i > 0 && i % cap === 0) {
      weekOffset++
    }
    const scheduledAt = new Date(startAt)
    scheduledAt.setDate(scheduledAt.getDate() + weekOffset * 7)

    schedule.push({
      variant_id: variantIds[i],
      scheduled_at: scheduledAt,
    })
  }

  return schedule
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve start time from campaign config.
 * If start_at is provided, parse it. Otherwise use now.
 */
function resolveStartTime(startAt?: string, _timezone?: string): Date {
  if (!startAt) return new Date()

  // Try parsing as full ISO date
  const parsed = new Date(startAt)
  if (!isNaN(parsed.getTime())) return parsed

  // Try parsing as HH:mm time — use today's date
  const timeMatch = startAt.match(/^(\d{1,2}):(\d{2})$/)
  if (timeMatch) {
    const now = new Date()
    now.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0)
    // If the time has already passed today, start tomorrow
    if (now.getTime() < Date.now()) {
      now.setDate(now.getDate() + 1)
    }
    return now
  }

  // Fallback: now
  return new Date()
}
