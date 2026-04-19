import { defineConfig } from 'vitest/config'
import path from 'node:path'

// ── Vitest config for the Koto repo (Phase 7 introduces the first suite) ───
// Tests live in tests/**/*.test.ts.  Production code under src/lib/* uses
// `import 'server-only'` which throws when the package's `default`
// export condition is selected; we add the `react-server` condition so
// `server-only` resolves to its no-op `empty.js` stub inside the test
// runner, just like Next.js does at build time.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Tells vite/vitest to pick the `react-server` condition when resolving
    // package exports — neutralises the `server-only` runtime guard.
    conditions: ['react-server', 'node', 'import', 'default'],
  },
})
