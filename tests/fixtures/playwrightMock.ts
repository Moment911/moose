import { vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 — Shared Playwright mock for tests that exercise browser code paths
// without launching a real Chromium instance.
// ─────────────────────────────────────────────────────────────────────────────

export type MockPages = Record<string, { html: string; title?: string; text?: string }>

/** Creates a mock playwright-core + @sparticuz/chromium setup.
 *  `pages` maps URL → { html, title?, text? }.
 *  The mock browser tracks which URL was last navigated to. */
export function mockPlaywright(pages: MockPages) {
  let lastUrl = ''

  const mockPage = {
    goto: vi.fn().mockImplementation(async (url: string) => { lastUrl = url }),
    evaluate: vi.fn().mockImplementation(async () => {
      const entry = pages[lastUrl]
      if (!entry) return ''
      if (entry.text) return entry.text
      // Strip tags for a rough innerText approximation
      return entry.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }),
    title: vi.fn().mockImplementation(async () => pages[lastUrl]?.title ?? ''),
    content: vi.fn().mockImplementation(async () => pages[lastUrl]?.html ?? ''),
    close: vi.fn().mockResolvedValue(undefined),
  }

  const browser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  }

  const chromiumMock = {
    default: {
      args: [],
      executablePath: vi.fn().mockResolvedValue('/noop'),
      headless: true,
    },
  }

  const playwrightMock = {
    chromium: {
      launch: vi.fn().mockResolvedValue(browser),
    },
  }

  return { browser, mockPage, chromiumMock, playwrightMock }
}

export function resetPlaywrightMock() {
  vi.doUnmock('playwright-core')
  vi.doUnmock('@sparticuz/chromium')
}
