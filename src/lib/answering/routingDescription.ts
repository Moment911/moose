/**
 * Format routing targets as natural language for the agent system prompt.
 * The agent doesn't get phone numbers in-prompt -- those resolve at transfer
 * time via the resolve_transfer_target tool.
 */
export type RoutingTarget = {
  label: string
  phone_number?: string
  email?: string | null
  priority?: number
  conditions?: { intent?: string; hours?: string } & Record<string, any>
}

export function describeRouting(targets: RoutingTarget[] = []): string {
  if (!targets.length) {
    return 'No routing targets configured. Take a message instead of attempting transfers.'
  }

  const sorted = [...targets].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
  const lines = ['When transferring, choose the appropriate target:']

  for (const t of sorted) {
    const cond = t.conditions || {}
    const parts: string[] = []
    if (cond.intent && cond.intent !== 'any') parts.push(`intent=${cond.intent}`)
    if (cond.hours) parts.push(`when ${cond.hours}`)
    const condStr = parts.length ? ` (${parts.join(', ')})` : ''
    lines.push(`  - ${t.label}${condStr}`)
  }

  lines.push('\nUse the resolve_transfer_target tool to get the actual phone number before transferring.')
  return lines.join('\n')
}
