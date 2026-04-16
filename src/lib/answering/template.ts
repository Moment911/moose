/**
 * Minimal Handlebars-style template renderer for answering-service system prompts.
 * Ported from backend/src/utils/template.js.
 * Supports:
 *   {{variable}}
 *   {{var | default}}    fallback if missing/empty
 * Arrays are joined with ", ". Objects are JSON-stringified.
 * Missing vars render as "[not provided]" so the prompt never breaks mid-call.
 */
export function renderTemplate(template: string, vars: Record<string, any> = {}): string {
  if (!template) return ''
  return template.replace(/\{\{\s*([^}|]+?)(?:\s*\|\s*([^}]+?))?\s*\}\}/g, (_m, key: string, fallback?: string) => {
    const path = key.trim().split('.')
    let val: any = vars
    for (const p of path) {
      val = val?.[p]
      if (val === undefined) break
    }
    if (val === undefined || val === null || val === '') {
      return fallback ? fallback.trim() : '[not provided]'
    }
    if (Array.isArray(val)) return val.join(', ')
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  })
}
