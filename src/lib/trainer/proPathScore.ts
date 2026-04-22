// ─────────────────────────────────────────────────────────────────────────────
// ProPath Score — AI-powered program matching for baseball recruits.
//
// Takes a trainee's profile (from intake) and scores every program in the
// database on how good a fit it is.  Factors: division competitiveness vs
// athlete level, academic match, geographic preference, position need,
// scholarship availability.
//
// This is what NCSA charges $3,000+ for.
// ─────────────────────────────────────────────────────────────────────────────

export type TraineeProfile = {
  age?: number
  sex?: string
  height_cm?: number
  current_weight_kg?: number
  primary_goal?: string
  training_experience_years?: number
  training_days_per_week?: number
  equipment_access?: string
  gpa?: number
  test_score?: string
  position?: string
  throwing_hand?: string
  batting_hand?: string
  velocity?: number
  state?: string
  preferred_states?: string[]
  preferred_division?: string[]
  about_you?: string
}

export type ProgramForScoring = {
  id: string
  school_name: string
  division: string
  conference: string
  state: string
  city: string
  scholarship_available: boolean
  enrollment?: number
  tuition_in_state?: number
  tuition_out_of_state?: number
  roster_size?: number
  apr_score?: number
  graduation_rate?: number
  mlb_draft_picks_5yr?: number
  notable?: string
}

export type ProPathResult = {
  program_id: string
  school_name: string
  division: string
  conference: string
  state: string
  score: number          // 0-100
  grade: string          // A, B, C, D
  reasons: string[]      // why this program scored well/poorly
  category: 'dream' | 'target' | 'safety' | 'long_shot'
}

// Division competitiveness tiers (rough velocity/stat thresholds)
const DIVISION_THRESHOLDS = {
  D1_POWER: { minVelo: 88, label: 'Power 5 D1' },
  D1_MID: { minVelo: 84, label: 'Mid-Major D1' },
  D2: { minVelo: 80, label: 'D2' },
  D3: { minVelo: 76, label: 'D3' },
  JUCO: { minVelo: 78, label: 'JUCO' },
}

const POWER_CONFERENCES = ['SEC', 'ACC', 'Big 12', 'Big Ten']

function cmToInches(cm: number): number { return cm / 2.54 }
function kgToLbs(kg: number): number { return kg * 2.20462 }

export function scorePrograms(
  profile: TraineeProfile,
  programs: ProgramForScoring[],
): ProPathResult[] {
  const results: ProPathResult[] = []

  for (const prog of programs) {
    let score = 50 // baseline
    const reasons: string[] = []

    // ── Division fit (biggest factor) ────────────────────────────────────
    const isPower = POWER_CONFERENCES.includes(prog.conference)
    const velo = profile.velocity || 0

    if (prog.division === 'D1' && isPower) {
      if (velo >= 88) { score += 20; reasons.push('Velocity fits Power 5 level') }
      else if (velo >= 84) { score += 5; reasons.push('Velocity competitive for mid-major, stretch for Power 5') }
      else if (velo > 0) { score -= 15; reasons.push('Velocity below typical Power 5 range') }
    } else if (prog.division === 'D1') {
      if (velo >= 84) { score += 15; reasons.push('Velocity fits mid-major D1') }
      else if (velo >= 80) { score += 5; reasons.push('Velocity on the edge for D1') }
      else if (velo > 0) { score -= 10; reasons.push('Velocity below typical D1 range') }
    } else if (prog.division === 'D2') {
      if (velo >= 80 && velo < 88) { score += 15; reasons.push('Velocity sweet spot for D2') }
      else if (velo >= 88) { score += 5; reasons.push('Could play at a higher level') }
      else if (velo > 0) { score -= 5 }
    } else if (prog.division === 'D3') {
      if (velo >= 76 && velo < 86) { score += 15; reasons.push('Velocity fits D3 level') }
      else if (velo >= 86) { score += 5; reasons.push('Could play at a higher level') }
    } else if (prog.division === 'JUCO') {
      if (velo >= 78) { score += 10; reasons.push('JUCO is a great development path') }
      score += 5 // JUCO is always accessible
      reasons.push('JUCO offers immediate playing time + transfer opportunity')
    }

    // ── Division preference ──────────────────────────────────────────────
    if (profile.preferred_division && profile.preferred_division.length > 0) {
      if (profile.preferred_division.includes(prog.division)) {
        score += 10
        reasons.push(`Matches your preferred division (${prog.division})`)
      }
    }

    // ── Geographic fit ───────────────────────────────────────────────────
    if (profile.state && prog.state === profile.state) {
      score += 8
      reasons.push('In-state (lower tuition, closer to home)')
    }
    if (profile.preferred_states && profile.preferred_states.includes(prog.state)) {
      score += 5
      reasons.push('In your preferred region')
    }

    // ── Academic fit ─────────────────────────────────────────────────────
    if (profile.gpa) {
      if (prog.division === 'D3' && profile.gpa >= 3.5) {
        score += 10
        reasons.push('Strong academics for D3 (academics-first programs)')
      } else if (prog.division === 'D1' && profile.gpa >= 3.0) {
        score += 5
        reasons.push('GPA meets D1 academic standards')
      } else if (profile.gpa < 2.5 && prog.division === 'D1') {
        score -= 10
        reasons.push('GPA may be below D1 eligibility threshold')
      }
    }

    // ── Scholarship availability ─────────────────────────────────────────
    if (prog.scholarship_available) {
      score += 3
    } else {
      reasons.push('No athletic scholarships (D3) — merit/need-based aid only')
    }

    // ── Pro development track ────────────────────────────────────────────
    if (prog.mlb_draft_picks_5yr && prog.mlb_draft_picks_5yr > 5) {
      score += 5
      reasons.push(`${prog.mlb_draft_picks_5yr} MLB draft picks in last 5 years`)
    }

    // ── Age factor (younger = more development runway) ───────────────────
    if (profile.age && profile.age <= 15) {
      // Freshman/sophomore — JUCO and D2 get a boost as development paths
      if (prog.division === 'JUCO' || prog.division === 'D2') {
        score += 3
        reasons.push('Good development option — you have time to grow')
      }
    }

    // ── Size factor ──────────────────────────────────────────────────────
    if (profile.height_cm && profile.current_weight_kg) {
      const heightIn = cmToInches(profile.height_cm)
      const weightLbs = kgToLbs(profile.current_weight_kg)
      if (prog.division === 'D1' && isPower && heightIn < 70 && weightLbs < 170) {
        score -= 5
        reasons.push('Size is undersized for Power 5 — but skill and speed can overcome')
      }
    }

    // Clamp score
    score = Math.max(0, Math.min(100, Math.round(score)))

    // Grade
    const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D'

    // Category
    const category = score >= 80 ? 'target' as const
      : score >= 65 ? 'target' as const
      : score >= 50 ? 'safety' as const
      : 'long_shot' as const

    // Override: if velocity is way above division threshold, it's a safety
    if (prog.division === 'D2' && velo >= 88) {
      results.push({ program_id: prog.id, school_name: prog.school_name, division: prog.division, conference: prog.conference, state: prog.state, score, grade, reasons, category: 'safety' })
      continue
    }
    if (prog.division === 'D1' && isPower && velo >= 92) {
      results.push({ program_id: prog.id, school_name: prog.school_name, division: prog.division, conference: prog.conference, state: prog.state, score, grade, reasons, category: 'dream' })
      continue
    }

    results.push({
      program_id: prog.id,
      school_name: prog.school_name,
      division: prog.division,
      conference: prog.conference,
      state: prog.state,
      score,
      grade,
      reasons,
      category,
    })
  }

  return results.sort((a, b) => b.score - a.score)
}

// ── Recruiting timeline by grade ─────────────────────────────────────────────

export type TimelineItem = {
  grade: string
  title: string
  items: string[]
}

export const RECRUITING_TIMELINE: TimelineItem[] = [
  {
    grade: 'Freshman (9th)',
    title: 'Build Your Foundation',
    items: [
      'Focus on skill development — mechanics, strength, speed',
      'Start building your highlight video (even early clips)',
      'Research colleges that interest you — make a list of 30-40 schools',
      'Get your GPA right from day one — colleges look at all 4 years',
      'Attend local showcases and travel ball tournaments',
      'Create an email account specifically for recruiting',
      'Start following college coaches on Twitter/social media',
    ],
  },
  {
    grade: 'Sophomore (10th)',
    title: 'Get on the Radar',
    items: [
      'Send your first round of introductory emails to coaches (use our templates)',
      'Attend college camps — especially at schools you like',
      'Update your highlight video with current footage',
      'Register with the NCAA Eligibility Center (clearinghouse)',
      'Take the PSAT — start thinking about SAT/ACT prep',
      'Attend Perfect Game, PBR, or other national showcases',
      'Build relationships with travel ball coaches who have college connections',
      'Keep your grades up — minimum 2.3 GPA for D1/D2 eligibility',
    ],
  },
  {
    grade: 'Junior (11th)',
    title: 'Peak Recruiting Year',
    items: [
      'This is your most important recruiting year — coaches are actively evaluating',
      'Send follow-up emails with updated stats and video to your target schools',
      'Take the SAT/ACT (aim for 1000+ SAT or 20+ ACT for D1)',
      'Attend camps at your top 5-10 target schools',
      'Schedule unofficial visits to campuses',
      'Ask your HS/travel coaches to make calls on your behalf',
      'Narrow your list to 10-15 serious targets',
      'Be responsive — reply to every coach email within 24 hours',
      'Know the recruiting calendar — D1 coaches can call starting June 15 after sophomore year',
      'Start thinking about what you want academically, not just athletically',
    ],
  },
  {
    grade: 'Senior (12th)',
    title: 'Close the Deal',
    items: [
      'Follow up with all schools still recruiting you',
      'Schedule official visits (D1 allows 5 official visits)',
      'Compare financial aid packages carefully',
      'Sign during Early Signing Period (November) or Regular Period (April)',
      'Keep your grades up — admission can be revoked for grade drops',
      'Stay healthy — avoid unnecessary injury risks',
      'If uncommitted, explore JUCO as a strong development path',
      'Send thank-you notes to every coach who recruited you',
      'Make your decision based on FIT, not just name brand',
    ],
  },
]
