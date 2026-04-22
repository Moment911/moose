// ─────────────────────────────────────────────────────────────────────────────
// Position-by-position recruiting benchmarks: D1 / D2 / D3 / JUCO.
//
// Realistic ranges for recruitable players — not elite ceiling, not bottom
// of the roster.  Benchmarks for a rising senior (post-junior-year summer).
// Younger kids project down; seniors project up.
//
// Sources: PBR, Perfect Game, D1Baseball scouting reports, coach interviews.
// Power 4 / SEC level is well above these D1 numbers (top 10% of D1).
// ─────────────────────────────────────────────────────────────────────────────

export type DivisionRange = {
  D1: [number, number]
  D2: [number, number]
  D3: [number, number]
  JUCO: [number, number]
}

export type PositionBenchmark = {
  position: string
  label: string
  metrics: {
    metric: string
    label: string
    units: string
    ranges: DivisionRange
    lowerIsBetter?: boolean  // for 60 time, pop time
  }[]
  notes: string[]
}

export const BENCHMARKS: PositionBenchmark[] = [
  {
    position: 'RHP',
    label: 'Right-Handed Pitcher',
    metrics: [
      { metric: 'fastball_peak', label: 'FB Peak', units: 'mph', ranges: { D1: [90, 94], D2: [86, 90], D3: [82, 86], JUCO: [85, 92] } },
      { metric: 'fastball_sit', label: 'FB Sitting', units: 'mph', ranges: { D1: [88, 92], D2: [84, 88], D3: [80, 84], JUCO: [83, 89] } },
      { metric: 'spin_rate', label: 'Spin Rate (FB)', units: 'rpm', ranges: { D1: [2200, 2600], D2: [2100, 2400], D3: [2000, 2300], JUCO: [2100, 2500] } },
      { metric: 'strike_pct', label: 'Strike %', units: '%', ranges: { D1: [62, 70], D2: [60, 68], D3: [58, 66], JUCO: [60, 68] } },
      { metric: 'height_inches', label: 'Height', units: 'in', ranges: { D1: [73, 78], D2: [72, 76], D3: [71, 76], JUCO: [72, 77] } },
    ],
    notes: [
      'Secondary pitch with 75+ with shape is expected at D1 level',
      'Command matters as much as velocity — a 90 mph pitcher with 65%+ strike rate recruits better than 93 at 55%',
    ],
  },
  {
    position: 'LHP',
    label: 'Left-Handed Pitcher',
    metrics: [
      { metric: 'fastball_peak', label: 'FB Peak', units: 'mph', ranges: { D1: [87, 91], D2: [83, 87], D3: [79, 83], JUCO: [82, 89] } },
      { metric: 'fastball_sit', label: 'FB Sitting', units: 'mph', ranges: { D1: [85, 89], D2: [81, 85], D3: [77, 81], JUCO: [80, 86] } },
      { metric: 'spin_rate', label: 'Spin Rate (FB)', units: 'rpm', ranges: { D1: [2200, 2600], D2: [2100, 2400], D3: [2000, 2300], JUCO: [2100, 2500] } },
    ],
    notes: [
      'LHP gets recruited 2-3 mph lower than RHP across all divisions — lefties are scarce',
      'A 6\'2" LHP at 84-86 with command is a D1 prospect',
    ],
  },
  {
    position: 'C',
    label: 'Catcher',
    metrics: [
      { metric: 'pop_time', label: 'Pop Time (to 2B)', units: 'sec', ranges: { D1: [1.90, 1.95], D2: [2.00, 2.05], D3: [2.05, 2.15], JUCO: [1.98, 2.05] }, lowerIsBetter: true },
      { metric: 'exit_velo', label: 'Exit Velo', units: 'mph', ranges: { D1: [92, 100], D2: [88, 92], D3: [82, 88], JUCO: [88, 95] } },
      { metric: 'sixty_time', label: '60-Yard Dash', units: 'sec', ranges: { D1: [7.0, 7.1], D2: [7.2, 7.3], D3: [7.4, 7.5], JUCO: [7.1, 7.2] }, lowerIsBetter: true },
      { metric: 'arm_velo', label: 'Arm Strength', units: 'mph', ranges: { D1: [82, 88], D2: [78, 82], D3: [74, 78], JUCO: [80, 85] } },
    ],
    notes: [
      'Defensive catchers with elite pop times get recruited with lighter bats',
      'Bat-first catchers get recruited with softer defense',
      'Game-calling ability is invisible in measurables but heavily valued',
    ],
  },
  {
    position: 'MI',
    label: 'Middle Infield (SS/2B)',
    metrics: [
      { metric: 'sixty_time', label: '60-Yard Dash', units: 'sec', ranges: { D1: [6.7, 6.8], D2: [6.9, 7.0], D3: [7.1, 7.2], JUCO: [6.8, 6.9] }, lowerIsBetter: true },
      { metric: 'exit_velo', label: 'Exit Velo', units: 'mph', ranges: { D1: [93, 100], D2: [88, 93], D3: [82, 88], JUCO: [88, 95] } },
      { metric: 'if_velo', label: 'IF Throw Velo', units: 'mph', ranges: { D1: [85, 92], D2: [80, 85], D3: [75, 80], JUCO: [82, 88] } },
      { metric: 'bat_speed', label: 'Bat Speed', units: 'mph', ranges: { D1: [72, 80], D2: [68, 74], D3: [64, 70], JUCO: [68, 76] } },
    ],
    notes: [
      'Speed + defense is the floor — bat is the differentiator at D1',
      'Plus defenders at SS get recruited with lighter bats',
    ],
  },
  {
    position: 'CI',
    label: 'Corner Infield (1B/3B)',
    metrics: [
      { metric: 'exit_velo', label: 'Exit Velo', units: 'mph', ranges: { D1: [95, 103], D2: [90, 95], D3: [85, 90], JUCO: [90, 98] } },
      { metric: 'sixty_time', label: '60-Yard Dash', units: 'sec', ranges: { D1: [7.0, 7.1], D2: [7.2, 7.3], D3: [7.4, 7.5], JUCO: [7.1, 7.2] }, lowerIsBetter: true },
      { metric: 'if_velo', label: 'IF Throw Velo (3B)', units: 'mph', ranges: { D1: [85, 92], D2: [80, 85], D3: [75, 80], JUCO: [82, 88] } },
    ],
    notes: [
      'Corner bats are bat-first positions — exit velo and power are everything',
      '1B is the hardest position to recruit for — need elite bat to justify the spot',
    ],
  },
  {
    position: 'OF',
    label: 'Outfield',
    metrics: [
      { metric: 'sixty_time', label: '60-Yard Dash', units: 'sec', ranges: { D1: [6.7, 6.9], D2: [7.0, 7.2], D3: [7.2, 7.4], JUCO: [6.8, 7.0] }, lowerIsBetter: true },
      { metric: 'exit_velo', label: 'Exit Velo', units: 'mph', ranges: { D1: [92, 100], D2: [88, 93], D3: [82, 88], JUCO: [90, 97] } },
      { metric: 'of_velo', label: 'OF Throw Velo', units: 'mph', ranges: { D1: [88, 95], D2: [82, 88], D3: [76, 82], JUCO: [85, 92] } },
    ],
    notes: [
      'CF is speed-first — 6.7 or better 60 time is the D1 floor',
      'Corner OF needs plus bat to make up for less defensive premium',
      'OF arm strength is a real differentiator — coaches notice 90+ OF velo',
    ],
  },
]

/**
 * Given an athlete's metric, return which division band they fall into.
 */
export function assessMetric(
  position: string,
  metric: string,
  value: number,
): { division: string; percentile: string; label: string } | null {
  const pos = BENCHMARKS.find((b) => b.position === position)
  if (!pos) return null
  const m = pos.metrics.find((met) => met.metric === metric)
  if (!m) return null

  const { ranges, lowerIsBetter } = m

  for (const div of ['D1', 'D2', 'D3', 'JUCO'] as const) {
    const [low, high] = ranges[div]
    if (lowerIsBetter) {
      if (value <= high) {
        if (value <= low) return { division: div, percentile: 'top', label: `Top-end ${div}` }
        return { division: div, percentile: 'mid', label: `Solid ${div}` }
      }
    } else {
      if (value >= low) {
        if (value >= high) return { division: div, percentile: 'top', label: `Top-end ${div}` }
        return { division: div, percentile: 'mid', label: `Solid ${div}` }
      }
    }
  }

  return { division: 'developmental', percentile: 'below', label: 'Below current recruiting thresholds — keep developing' }
}

/**
 * Three-band model: given all metrics for an athlete, classify each program.
 */
export function classifyFit(
  athleteMetrics: Record<string, number>,
  position: string,
  programDivision: string,
): 'stretch' | 'target' | 'safety' {
  const pos = BENCHMARKS.find((b) => b.position === position)
  if (!pos) return 'target'

  let aboveCount = 0
  let belowCount = 0
  let total = 0

  for (const m of pos.metrics) {
    const val = athleteMetrics[m.metric]
    if (val === undefined) continue
    total++

    const range = m.ranges[programDivision as keyof DivisionRange]
    if (!range) continue
    const [low, high] = range

    if (m.lowerIsBetter) {
      if (val <= low) aboveCount++
      else if (val > high) belowCount++
    } else {
      if (val >= high) aboveCount++
      else if (val < low) belowCount++
    }
  }

  if (total === 0) return 'target'
  const abovePct = aboveCount / total
  const belowPct = belowCount / total

  if (belowPct > 0.5) return 'stretch'
  if (abovePct > 0.5) return 'safety'
  return 'target'
}
