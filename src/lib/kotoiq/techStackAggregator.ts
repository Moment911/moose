// ─────────────────────────────────────────────────────────────
// Tech Stack Aggregator — Phase H
//
// Reads kotoiq_page_snapshots.detected_tech (populated on every
// scan by the techStackDetector) and unions the technologies
// across all tracked pages per competitor.
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DetectedTech } from './techStackDetector'

const BUCKETS: (keyof Omit<DetectedTech, 'raw_signals_count'>)[] = [
  'cms', 'framework', 'analytics', 'esp', 'chat', 'ads', 'fonts', 'payment',
]

export interface CompetitorTechStack {
  competitor_domain: string
  captured_at: string | null
  tech: Record<string, string[]>      // bucket → array of vendor names
  signals_count: number
  pages_scanned: number
}

export async function getTechStackByCompetitor(
  s: SupabaseClient,
  body: { client_id: string },
): Promise<{ competitors: CompetitorTechStack[] }> {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data: pages } = await s.from('kotoiq_tracked_pages')
    .select('id, competitor_domain')
    .eq('client_id', client_id)
    .eq('is_active', true)

  if (!pages?.length) return { competitors: [] }

  // Latest snapshot per page with detected_tech
  const grouped = new Map<string, CompetitorTechStack>()
  for (const p of pages) {
    const { data: snap } = await s.from('kotoiq_page_snapshots')
      .select('captured_at, detected_tech')
      .eq('tracked_page_id', p.id)
      .not('detected_tech', 'is', null)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!snap?.detected_tech) continue

    let row = grouped.get(p.competitor_domain)
    if (!row) {
      row = {
        competitor_domain: p.competitor_domain,
        captured_at: snap.captured_at,
        tech: {},
        signals_count: 0,
        pages_scanned: 0,
      }
      for (const b of BUCKETS) row.tech[b] = []
      grouped.set(p.competitor_domain, row)
    }

    row.pages_scanned += 1
    if (!row.captured_at || snap.captured_at > row.captured_at) row.captured_at = snap.captured_at

    for (const b of BUCKETS) {
      const found: string[] = snap.detected_tech[b] || []
      for (const name of found) {
        if (!row.tech[b].includes(name)) {
          row.tech[b].push(name)
          row.signals_count += 1
        }
      }
    }
  }

  return {
    competitors: Array.from(grouped.values()).sort((a, b) => b.signals_count - a.signals_count),
  }
}
