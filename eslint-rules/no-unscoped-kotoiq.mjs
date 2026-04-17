/**
 * ESLint Rule: no-unscoped-kotoiq (FND-04)
 *
 * Flags direct .from('kotoiq_*') usage without:
 *   - Using getKotoIQDb() helper, OR
 *   - An explicit .eq('agency_id', ...) in the same call chain
 *
 * This prevents accidental cross-agency data access on kotoiq_* tables.
 *
 * Correct:
 *   const db = getKotoIQDb(agencyId)
 *   db.from('kotoiq_templates').select('*')          // ✅ scoped by helper
 *
 *   sb.from('kotoiq_templates').select('*').eq('agency_id', agencyId)  // ✅ explicit
 *
 * Incorrect:
 *   sb.from('kotoiq_templates').select('*')           // ❌ no agency scoping
 *   getSupabase().from('kotoiq_campaigns').select()   // ❌ raw client, no scope
 */

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require agency scoping on all kotoiq_* table queries',
    },
    messages: {
      unscopedKotoiq:
        'Direct .from(\'kotoiq_*\') without getKotoIQDb() or .eq(\'agency_id\', ...) — use getKotoIQDb(agencyId) from src/lib/kotoiqDb.ts instead.',
    },
    schema: [],
  },

  create(context) {
    // Track whether the current file imports getKotoIQDb
    let hasKotoIQDbImport = false

    return {
      // Check imports for getKotoIQDb
      ImportDeclaration(node) {
        const source = node.source.value
        if (
          typeof source === 'string' &&
          (source.includes('kotoiqDb') || source.includes('kotoiq-db'))
        ) {
          for (const spec of node.specifiers) {
            if (
              spec.type === 'ImportSpecifier' &&
              spec.imported.name === 'getKotoIQDb'
            ) {
              hasKotoIQDbImport = true
            }
          }
        }
      },

      // Look for .from('kotoiq_*') calls
      CallExpression(node) {
        // Match: *.from('kotoiq_...')
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.property.name !== 'from' ||
          node.arguments.length < 1
        ) {
          return
        }

        const arg = node.arguments[0]
        if (arg.type !== 'Literal' || typeof arg.value !== 'string') return
        if (!arg.value.startsWith('kotoiq_')) return

        // If the file imports getKotoIQDb, assume it's using the scoped helper
        // (the helper's .from() also calls supabase.from internally)
        if (hasKotoIQDbImport) return

        // Check if this is inside a file that IS kotoiqDb.ts (self-reference is OK)
        const filename = context.filename || context.getFilename()
        if (filename.includes('kotoiqDb')) return

        // Walk up the call chain looking for .eq('agency_id', ...)
        let current = node.parent
        let depth = 0
        while (current && depth < 15) {
          if (
            current.type === 'CallExpression' &&
            current.callee.type === 'MemberExpression' &&
            current.callee.property.name === 'eq' &&
            current.arguments.length >= 1
          ) {
            const eqArg = current.arguments[0]
            if (
              eqArg.type === 'Literal' &&
              eqArg.value === 'agency_id'
            ) {
              return // Explicit .eq('agency_id', ...) found — OK
            }
          }
          current = current.parent
          depth++
        }

        // No scoping found — report
        context.report({
          node,
          messageId: 'unscopedKotoiq',
        })
      },
    }
  },
}

export default rule
