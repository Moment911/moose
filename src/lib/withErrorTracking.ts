import 'server-only' // fails the build if this module is ever imported from a client component
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function withErrorTracking(
  handler: (req: NextRequest) => Promise<NextResponse>,
  serviceName: string
) {
  return async (req: NextRequest) => {
    const start = Date.now()

    try {
      const response = await handler(req)
      const duration = Date.now() - start

      // Log slow responses as performance warnings
      if (duration > 5000) {
        try {
          const sb = getSupabase()
          await sb.from('koto_system_logs').insert({
            level: 'warn',
            service: serviceName,
            action: 'slow_response',
            message: `Slow response: ${req.method} ${new URL(req.url).pathname} took ${duration}ms`,
            metadata: {
              method: req.method,
              url: req.url,
              pathname: new URL(req.url).pathname,
              duration_ms: duration,
              status: response.status,
            },
            duration_ms: duration,
          })
        } catch {
          // Don't let logging failures break the response
        }
      }

      return response
    } catch (e: any) {
      const duration = Date.now() - start

      // Log the error to koto_system_logs
      try {
        const sb = getSupabase()
        await sb.from('koto_system_logs').insert({
          level: 'error',
          service: serviceName,
          action: 'unhandled_exception',
          message: e.message || 'Unknown error',
          metadata: {
            stack: e.stack,
            method: req.method,
            url: req.url,
            pathname: new URL(req.url).pathname,
            duration_ms: duration,
          },
          duration_ms: duration,
        })
      } catch {
        console.error(`[withErrorTracking:${serviceName}] Failed to log error:`, e.message)
      }

      return NextResponse.json(
        { error: e.message || 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
