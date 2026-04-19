/**
 * Extracted from src/views/KotoProposalBuilderPage.jsx:47 (Phase 7 / Plan 1, Task 4).
 *
 * Resolves a client field across:
 *   - client[key]                       — dedicated column (voice agent writes here)
 *   - client.onboarding_answers[key]    — jsonb spillover (web form writes here)
 *   - client.onboarding_data[key]       — legacy jsonb name some routes still use
 *
 * Returns:
 *   - joined string for arrays (', ' separator, falsy entries dropped)
 *   - String(value) for scalars
 *   - '' if all keys empty / missing.  First non-empty match wins.
 *
 * Semantics preserved verbatim from the original — DO NOT change behavior;
 * downstream callers (KotoProposalBuilderPage left panel, Phase 7 Plan 2 ingest
 * pullers, future seeder helpers) depend on the existing first-non-empty-wins
 * contract.
 */
export function pick(
  client: Record<string, any> | null | undefined,
  ...keys: string[]
): string {
  if (!client) return ''
  const answers = (client as any).onboarding_answers || (client as any).onboarding_data || {}
  for (const k of keys) {
    const direct = (client as any)[k]
    if (direct !== null && direct !== undefined && String(direct).trim() !== '') {
      return Array.isArray(direct) ? direct.filter(Boolean).join(', ') : String(direct)
    }
    const jsonb = (answers as any)[k]
    if (jsonb !== null && jsonb !== undefined && String(jsonb).trim() !== '') {
      return Array.isArray(jsonb) ? jsonb.filter(Boolean).join(', ') : String(jsonb)
    }
  }
  return ''
}
