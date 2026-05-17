// Legacy shim: this file used to be a parallel 9-token stub of theme.ts that
// silently shipped stale brand values (cyan T, Bebas FH) to anything webpack
// resolved here instead of theme.ts. Now it re-exports the canonical theme so
// `from '../lib/theme'` resolves identically regardless of extension order.
export * from './theme.ts'
