# Coding Conventions

**Analysis Date:** 2026-04-11

## Language & File Types

**File Extensions:**
- `.jsx` — React components (client-side views, context providers, hooks)
- `.tsx` — TypeScript React components (newer App Router pages, some components)
- `.ts` — TypeScript API routes, utilities, server functions
- `.js` — Legacy utilities (e.g., `src/lib/supabase.js`)

**Why Mixed JSX/TSX:**
The codebase is in transition. Older code (`src/views/`, `src/components/`, `src/hooks/`) uses JSX. Newer code (App Router pages under `src/app/`, some newer API routes) uses TSX. Both coexist and are valid.

**Type Safety:**
- `tsconfig.json` has `"strict": true` — enable strict mode
- JSX files are not type-checked; TSX files are
- API routes use TypeScript exclusively for type safety with external APIs

## Naming Patterns

**Files:**
- Components: `PascalCase.jsx` or `.tsx`
  - Example: `KotoProofToolbar.jsx`, `ClientDetailPage.jsx`, `OnboardingPage.jsx`
- Utilities/helpers: `camelCase.js` or `.ts`
  - Example: `supabase.js`, `clientHealthScore.ts`, `tokenTracker.ts`
- Hooks: `use[Name].jsx` or `.ts`
  - Example: `useAuth.jsx`, `useLiveTranscription.ts`, `useMobile.js`
- Context: `[Name]Context.jsx`
  - Example: `AuthContext.jsx`, `ThemeContext.jsx`

**Functions:**
- Component functions: `PascalCase`
  - Example: `function OnboardingPage()`, `export default function AnnotationToolbar()`
- Non-component functions: `camelCase`
  - Example: `createClient_`, `calculateHealthScore`, `mapFormDataToClientColumns`
- Helpers with `_` suffix: Indicates async Supabase helper or complex operation
  - Example: `createClient_`, `deleteClient`, `getClients`

**Variables:**
- State: `camelCase`
  - Example: `const [user, setUser]`, `const [agencyId, setAgencyId]`
- Constants: `UPPER_SNAKE_CASE` (for truly global, immutable values)
  - Example: `BYPASS_AUTH`, `ACCENT`, `APP_URL`
- Refs: `camelCaseRef`
  - Example: `recognitionRef`, `onFinalResultRef`, `fullTranscriptRef`

**Types/Interfaces:**
- Custom types: `PascalCase`
  - Example: `type TranscriptSegment = { ... }`
  - Example: `type OnFinalResult = (sentence: string) => void`

## Code Style

**Formatting:**
- Tailwind CSS v4 with `@tailwindcss/postcss` for all styling
- No CSS files for component styles — use `className` with Tailwind utilities
- Custom CSS in `src/app/globals.css` for design tokens (colors, fonts, radii)
- Custom properties (CSS variables) for theme: `--red`, `--teal`, `--bg`, `--surface`, etc.

**Linting:**
- ESLint v9 with Next.js config: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Config: `eslint.config.mjs` (flat config format, not `.eslintrc`)
- No Prettier — no explicit formatter specified; code follows implicit conventions

**Example Tailwind Usage:**
```jsx
className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
  isActive
    ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-300'
    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
}`}
```

**Design Tokens (from globals.css):**
- Colors: `--red: #E6007E`, `--teal: #00C2CB`, `--black: #111111`
- Surfaces: `--surface: #ffffff`, `--surface-2: #F5F5F5`, `--bg: #F9F9F9`
- Text: `--text-primary: #111111`, `--text-secondary: #555555`, `--text-muted: #999999`
- Radii: `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 16px`, `--radius-xl: 24px`
- Use via CSS variables: `style={{ backgroundColor: 'var(--bg)' }}`

## Import Organization

**Order (from examples in codebase):**
1. React core: `import { useState, useEffect } from 'react'`
2. Next.js/routing: `import { useParams, useNavigate } from 'react-router-dom'` or `next/router`
3. Custom hooks: `import { useAuth } from '@/hooks/useAuth'`
4. Components: `import Sidebar from '@/components/Sidebar'`
5. Utils/libraries: `import { supabase } from '@/lib/supabase'`
6. External packages: `import toast from 'react-hot-toast'`
7. Icons: `import { ChevronRight, Check } from 'lucide-react'`

**Path Aliases:**
- `@/` maps to `src/` (configured in `tsconfig.json`)
- Always use `@/` for imports, not relative paths
- Example: `import { useAuth } from '@/hooks/useAuth'` not `import { useAuth } from '../hooks/useAuth'`

**Relative paths are acceptable ONLY for:**
- Sibling files in same directory: `import ColorPicker from './ColorPicker'`

## Error Handling

**Patterns:**
- API routes: Wrap in `try-catch`, return `NextResponse.json({ error: message }, { status: code })`
  ```typescript
  try {
    // API logic
    return NextResponse.json({ data: result })
  } catch (e: any) {
    console.error('API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
  ```

- Async operations: Silent failures with fallback return values
  ```typescript
  async function searchGoogle(query: string): Promise<any[]> {
    try {
      const res = await fetch(url)
      return res.json()
    } catch { return [] }  // No logging, just return empty
  }
  ```

- Supabase queries: Check `{ data, error }` destructuring
  ```typescript
  const { data, error } = await supabase.from('clients').select('*')
  if (error || !data) return { data, error }
  ```

- Fire-and-forget operations: Wrap in `.catch()` with `console.warn`
  ```typescript
  fetch(`${appUrl}/api/onboarding/telnyx-provision`, {
    method: 'POST',
    body: JSON.stringify({ action: 'init' }),
  }).catch((e) => {
    console.warn('[createClient_] auto-provision failed:', e)
  })
  ```

## Logging

**Framework:** `console` (built-in)

**Patterns:**
- Error context in brackets: `console.error('[module/action] message', error)`
- Warning for expected failures: `console.warn('[action] non-critical issue', error)`
- Info for important actions: `console.log('[action] result')`
- Debug logs should be wrapped in try-catch or conditional checks

**Examples from codebase:**
```typescript
console.error('[createClient_] token creation failed:', e)
console.warn('[agency/white-label GET]', error.message)
console.log('[clearTestRowsForTable] ${table}: about to delete ${count} rows')
```

## Comments

**When to Comment:**
- Complex algorithms: Full prose explanation at the top
- Non-obvious parameter mappings: Inline comment explaining `FIELD_MAP`
- State machine behaviors: Document state flow and transitions
- Workarounds: Prefix with `// Workaround:` or `// Fix:` with context

**Example:**
```javascript
// ─── Clients ─────────────────────────────────────────────────────────────
// Client creation is two-stage:
// 1. Insert client row + create onboarding token
// 2. Fire and forget — provision Retell number + PIN
// Never block on step 2 because it's external I/O.
export const createClient_ = async (name, email, agencyId = null) => { ... }
```

**JSDoc/TSDoc:**
- Used for function types (especially in `.ts` files)
- Example:
  ```typescript
  async function researchWithGPT(keyword: string, city: string, state: string, topContent: string[]): Promise<any> { ... }
  ```

## React Patterns

**Components:**
- Functional components only (no class components)
- Use `"use client"` directive at top of file for client components
  ```jsx
  "use client";
  import { useState } from 'react'
  
  export default function MyComponent() { ... }
  ```

**State Management:**
- Local state: `useState` for simple values
- Context: `AuthContext` in `src/hooks/useAuth.jsx` provides user, agencyId, role, agency
  - Usage: `const { user, agencyId } = useAuth()`
- No Redux or external state managers

**Hooks:**
- Exported as named functions: `export function useLiveTranscription()`
- Custom hooks handle refs carefully (keep latest callback in ref)
  ```typescript
  const onFinalResultRef = useRef<OnFinalResult | undefined>(onFinalResult)
  useEffect(() => {
    onFinalResultRef.current = onFinalResult
  }, [onFinalResult])
  ```

**Client/Server Boundary:**
- All route handlers are server-side (in `src/app/api/`)
- Components in `src/views/` and `src/components/` are client-side
- Never pass non-serializable objects through props
- For server actions, use `"use server"` directive (minimal usage in this codebase)

## Supabase Patterns

**Helpers in `src/lib/supabase.js`:**
- Lazy-load singleton: `const supabase = new Proxy({ ... })`
- Exported helpers: one per query
  ```javascript
  export const getClients = (agencyId = null, includeDeleted = false) => { ... }
  export const createClient_ = async (name, email, agencyId = null) => { ... }
  export const updateClient = (id, data) => { ... }
  ```

**Usage Pattern:**
```javascript
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('id', id)
  .single()

if (error || !data) return { data, error }
```

**Soft Delete:**
- Use `.update({ deleted_at: new Date().toISOString() })` not hard delete
- Always filter results: `.is('deleted_at', null)`

**Storage:**
```javascript
export const uploadFile = async (file, path) => {
  const { data, error } = await supabase.storage
    .from('review-files')
    .upload(path, file, { upsert: false })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('review-files').getPublicUrl(path)
  return urlData.publicUrl
}
```

## API Route Patterns

**Action Dispatch Pattern (src/app/api/{module}/route.ts):**
```typescript
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, clientId, data } = body
  
  switch (action) {
    case 'autosave':
      return handleAutosave(clientId, data)
    case 'complete':
      return handleComplete(clientId, data)
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
```

**Helper Functions:**
- Top-level in route file or imported from utils
- Return `NextResponse.json()`
- Handle errors with `try-catch` wrapping entire handler

**Example (src/app/api/onboarding/route.ts):**
```typescript
function mapFormDataToClientColumns(form_data: Record<string, any>): {
  updateData: Record<string, any>
  unmappedFields: Record<string, any>
} {
  // Maps form fields to database columns
  const FIELD_MAP: Record<string, string> = { ... }
  // Implementation...
}
```

## Tailwind Utilities (Common)

**Sizing:**
- `w-8 h-8` — icon buttons
- `px-4 py-2` — padding
- `gap-3` — spacing between flex items

**Flex:**
- `flex items-center justify-center` — centered flex
- `flex-shrink-0` — prevent flex growth

**Colors:**
- `text-gray-500`, `bg-gray-100`, `text-brand-600`
- Custom brand colors via theme variables
- `ring-1 ring-gray-300` — borders with ring utility

**Transitions:**
- `transition-colors` — smooth color changes on hover
- `disabled:opacity-30` — disabled state styling

**Dark/Light:**
- No dark mode detected; single light theme
- Use CSS variables from globals.css for theme values

## Accessibility Notes

**Icons:**
- Lucide React icons imported as components
  ```jsx
  import { ChevronRight, Check } from 'lucide-react'
  const Icon = ChevronRight
  <Icon size={16} />
  ```

**Buttons:**
- Always include `title` attribute for keyboard users
- `disabled` attribute respected by Tailwind (`disabled:opacity-30`)

**Semantic HTML:**
- Use `<button>` not `<div onClick>` for interactions
- Use proper heading hierarchy (`<h1>`, `<h2>`, etc.)

---

*Convention analysis: 2026-04-11*
