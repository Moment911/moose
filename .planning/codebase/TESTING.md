# Testing Patterns

**Analysis Date:** 2026-04-11

## Status: No Test Infrastructure

**Critical Finding:** This codebase has **zero automated tests**. No test files exist in `src/`, no test runner is configured, and testing is not enforced by CI/CD.

**What's Missing:**
- No `vitest.config.ts`, `jest.config.js`, or equivalent test runner config
- No test framework dependency in `package.json` (no `jest`, `vitest`, `@testing-library/react`, etc.)
- Zero `.test.ts`, `.test.tsx`, `.test.jsx`, or `.spec.*` files under `src/`
- No test scripts in `package.json` (`npm test` doesn't exist)
- No CI pipeline enforcing test coverage (GitHub Actions, etc.)

## Framework: None Detected

**If Adding Tests in the Future:**

### Recommended Setup
- **Runner:** `vitest` (modern, fast, ESM-native, excellent for Next.js)
- **React Testing:** `@testing-library/react` with `@testing-library/user-event`
- **E2E:** `playwright` or `cypress` (for routes under `src/app/`)

### Installation Example
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/user-event
npm install -D @playwright/test  # For E2E
```

### Config File (vitest.config.ts)
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx,jsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### Package.json Scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test"
  }
}
```

## Test Structure (When Implemented)

### File Organization

**Recommended Pattern (Co-located):**
```
src/
├── components/
│   ├── Button.tsx
│   ├── Button.test.tsx          # Co-located with component
│   ├── Modal.tsx
│   └── Modal.test.tsx
├── hooks/
│   ├── useAuth.jsx
│   ├── useAuth.test.jsx         # Co-located with hook
│   └── useLiveTranscription.ts
│   └── useLiveTranscription.test.ts
├── lib/
│   ├── supabase.js
│   └── supabase.test.js         # Co-located
│   ├── clientHealthScore.ts
│   └── clientHealthScore.test.ts
├── app/
│   └── api/
│       ├── onboarding/
│       │   ├── route.ts
│       │   └── route.test.ts    # Test API route
└── test/
    └── setup.ts                 # Global test setup
```

**Benefits:** Easier to find tests, easier to refactor, tests live with code.

### Naming Convention

- Test file: `[FileName].test.ts` or `.test.tsx`
- Suite name matches component: `describe('Button', () => { ... })`
- Test case names: `it('should [behavior]', () => { ... })`

### Example Test Structure

**Component Test (Button.test.tsx):**
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

describe('Button', () => {
  it('should render text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('should call onClick when clicked', async () => {
    const handleClick = vitest.fn()
    const user = userEvent.setup()
    render(<Button onClick={handleClick}>Click</Button>)
    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalled()
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

**Hook Test (useAuth.test.jsx):**
```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './useAuth'

describe('useAuth', () => {
  it('should return user after login', async () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.user).toBeNull() // Initially null
    expect(result.current.loading).toBe(true)

    // Wait for auth check
    await act(async () => {
      await new Promise(r => setTimeout(r, 100))
    })

    // Assertions on result.current
  })

  it('should provide agencyId from context', () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.agencyId).toBeDefined()
  })
})
```

**Utility Test (clientHealthScore.test.ts):**
```typescript
import { describe, it, expect } from 'vitest'
import { calculateHealthScore } from './clientHealthScore'

describe('calculateHealthScore', () => {
  it('should return 0 for client with no data', () => {
    const client = { }
    expect(calculateHealthScore(client)).toBe(0)
  })

  it('should return 100 for fully complete client', () => {
    const client = {
      onboarding_status: 'completed',
      website: 'https://example.com',
      phone: '+1234567890',
      // ... all required fields
    }
    expect(calculateHealthScore(client)).toBe(100)
  })

  it('should weight onboarding completion at 25%', () => {
    const client = {
      onboarding_status: 'partial',
      // Only onboarding data
    }
    const score = calculateHealthScore(client)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(25)
  })
})
```

**API Route Test (api/onboarding/route.test.ts):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: '1', name: 'Test Client' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
      }),
    }),
  })),
}))

describe('POST /api/onboarding', () => {
  it('should autosave form data', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        action: 'autosave',
        clientId: 'client-1',
        formData: { name: 'Acme Inc' },
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toBeDefined()
  })

  it('should return 400 for unknown action', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        action: 'unknown_action',
        clientId: 'client-1',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Unknown action')
  })
})
```

## Mocking

**Framework:** `vitest` built-in mocking

**What to Mock:**
- External APIs: Supabase, OpenAI, Anthropic, Resend
- Browser APIs: `window.location`, `navigator.clipboard`, Web Speech API
- File uploads: Supabase storage
- Network requests: `fetch()`
- Date/time: When testing time-dependent logic

**What NOT to Mock:**
- React components (unless they're genuinely external)
- Utility functions internal to the module
- Local state and hooks (test through component behavior)

**Example Mocks:**

```typescript
// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ id: '1', name: 'Client' }],
          error: null,
        }),
      }),
    }),
  },
}))

// Mock browser API
vi.mock('@/hooks/useLiveTranscription', () => ({
  useLiveTranscription: () => ({
    startListening: vi.fn(),
    stopListening: vi.fn(),
    isListening: false,
    transcript: '',
  }),
}))

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ data: [] }),
    ok: true,
  })
)
```

## Fixtures and Test Data

**Test Data Location (If Implemented):**
```
src/test/
├── setup.ts              # Global setup (mocks, config)
├── fixtures/
│   ├── clients.ts        # Sample client objects
│   ├── agencies.ts       # Sample agency objects
│   └── auth.ts           # Sample user/auth objects
└── factories/
    ├── clientFactory.ts   # Builder for test clients
    └── projectFactory.ts  # Builder for test projects
```

**Example Fixture (clients.ts):**
```typescript
export const mockClient = {
  id: 'client-1',
  name: 'Acme Corp',
  email: 'contact@acme.com',
  phone: '+1234567890',
  website: 'https://acme.com',
  agency_id: 'agency-1',
  onboarding_status: 'completed',
  created_at: '2026-04-01T00:00:00Z',
  deleted_at: null,
}

export const mockClients = [
  mockClient,
  { ...mockClient, id: 'client-2', name: 'Beta LLC' },
]
```

**Example Factory (clientFactory.ts):**
```typescript
export function createTestClient(overrides = {}) {
  return {
    id: `client-${Math.random()}`,
    name: 'Test Client',
    email: 'test@example.com',
    agency_id: 'test-agency',
    onboarding_status: 'pending',
    ...overrides,
  }
}
```

## Coverage

**Coverage Requirements (If Enforced):**
```json
{
  "thresholds": {
    "lines": 70,
    "functions": 70,
    "branches": 60,
    "statements": 70
  }
}
```

**View Coverage (If Implemented):**
```bash
npm run test:coverage
# Opens coverage/index.html in browser
```

**Priority Areas for Testing (In Order):**
1. **Authentication & Authorization** — `useAuth.jsx`, auth guards
2. **Supabase Helpers** — `src/lib/supabase.js` (critical path)
3. **API Routes** — Action dispatch patterns in `src/app/api/`
4. **Form Validation** — Onboarding form, proposal builder
5. **State Machines** — Discovery session, KotoProof rounds
6. **Utility Functions** — Health score calculation, field mapping
7. **Components** — UI components, icons, buttons (lower priority)

## Test Types

### Unit Tests
**Scope:** Single function or component in isolation
**When:** Testing pure logic, helpers, utility functions
**Example:** `calculateHealthScore()` with various input combinations

### Integration Tests
**Scope:** Multiple components/modules working together
**When:** Testing API flows, complex state changes, data transformations
**Example:** Onboarding form autosave + client creation flow

### E2E Tests (Not Implemented)
**Scope:** Full user workflows through the browser
**Framework:** Playwright or Cypress
**When:** Critical paths like client onboarding, proposal generation
**Example:** User fills form → form autosaves → completes → gets email

## Common Patterns

**Async Testing (vitest):**
```typescript
it('should fetch data', async () => {
  const { result } = renderHook(() => useClientData(), {
    wrapper: AuthProvider,
  })

  // Use act() for state updates from async operations
  await act(async () => {
    await new Promise(r => setTimeout(r, 100))
  })

  expect(result.current.clients).toHaveLength(1)
})
```

**Error Testing:**
```typescript
it('should handle Supabase errors gracefully', async () => {
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockResolvedValue({
      data: null,
      error: new Error('Database connection failed'),
    }),
  } as any)

  const { data, error } = await getClients('agency-1')
  expect(error).toBeDefined()
  expect(data).toBeNull()
})
```

**Component User Interaction:**
```typescript
it('should submit form on button click', async () => {
  const user = userEvent.setup()
  const handleSubmit = vi.fn()

  render(<Form onSubmit={handleSubmit} />)

  const submitBtn = screen.getByRole('button', { name: /submit/i })
  await user.click(submitBtn)

  expect(handleSubmit).toHaveBeenCalled()
})
```

## CI/CD Integration

**Current State:** No test CI/CD detected

**Recommended GitHub Actions (If Adding):**

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npm run test:e2e
```

---

*Testing analysis: 2026-04-11*

**Note:** This codebase currently has zero automated tests. The patterns and setup recommendations above describe best practices for implementation when test infrastructure is added in the future.
