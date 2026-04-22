import 'server-only'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer — streamSonnet.ts
//
// Streaming wrapper for Anthropic /v1/messages.  Returns a ReadableStream of
// NDJSON lines suitable for direct use as a Response body.
//
// Event types emitted:
//   {"type":"text_delta","text":"..."}     — conversational text chunk
//   {"type":"fields","extracted":{...}}    — tool_use result (field updates)
//   {"type":"done","usage":{...}}          — end of response
//   {"type":"error","error":"..."}         — stream-level error
//
// Mirrors callSonnet's transport (raw fetch, same headers) but with
// stream:true and SSE parsing.
// ─────────────────────────────────────────────────────────────────────────────

import { MODELS } from './trainerConfig'
import { logTokenUsage } from '../tokenTracker'
import type { SonnetTool } from './sonnetRunner'

export type StreamSonnetArgs = {
  featureTag: string
  systemPrompt: string
  tools: SonnetTool[]
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  agencyId: string
  maxTokens?: number
  metadata?: Record<string, unknown>
}

export function streamSonnetChat(args: StreamSonnetArgs): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const modelId = MODELS.SONNET

  function emit(controller: ReadableStreamDefaultController<Uint8Array>, obj: Record<string, unknown>) {
    controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
  }

  return new ReadableStream({
    async start(controller) {
      // Build Anthropic messages array.  Convert our simplified string
      // messages into the content-block format Anthropic expects.
      const apiMessages = args.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: [{ type: 'text' as const, text: m.content }],
      }))

      // If no messages, send a single user turn to trigger the greeting.
      if (apiMessages.length === 0) {
        apiMessages.push({
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'Hey, I\'m ready to get started!' }],
        })
      }

      const body = {
        model: modelId,
        max_tokens: args.maxTokens ?? 4000,
        stream: true,
        system: args.systemPrompt,
        tools: args.tools,
        messages: apiMessages,
      }

      let response: Response
      try {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'anthropic-version': MODELS.ANTHROPIC_VERSION,
            'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          },
          body: JSON.stringify(body),
        })
      } catch (e) {
        emit(controller, { type: 'error', error: `fetch_failed:${e instanceof Error ? e.message : String(e)}` })
        controller.close()
        return
      }

      if (!response.ok) {
        let detail = ''
        try { detail = (await response.text()).slice(0, 500) } catch { /* ignore */ }
        emit(controller, { type: 'error', error: `anthropic_http_${response.status}:${detail}` })
        controller.close()
        return
      }

      if (!response.body) {
        emit(controller, { type: 'error', error: 'no_response_body' })
        controller.close()
        return
      }

      // Parse SSE from Anthropic's streaming response.
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let toolJsonBuffer = ''
      let inputTokens = 0
      let outputTokens = 0

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            let event: Record<string, unknown>
            try {
              event = JSON.parse(data) as Record<string, unknown>
            } catch {
              continue
            }

            const eventType = event.type as string

            // Debug: log all events to see what Anthropic sends.
            if (eventType === 'content_block_start' || eventType === 'content_block_delta' || eventType === 'content_block_stop') {
              console.log('[streamSonnet]', eventType, JSON.stringify(event).slice(0, 200))
            }

            if (eventType === 'message_start') {
              const msg = event.message as Record<string, unknown> | undefined
              const usage = msg?.usage as Record<string, number> | undefined
              if (usage?.input_tokens) inputTokens = usage.input_tokens
            }

            if (eventType === 'content_block_delta') {
              const delta = event.delta as Record<string, unknown> | undefined
              if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
                emit(controller, { type: 'text_delta', text: delta.text })
              }
              if (delta?.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
                toolJsonBuffer += delta.partial_json
              }
            }

            if (eventType === 'content_block_stop' && toolJsonBuffer) {
              try {
                const toolResult = JSON.parse(toolJsonBuffer) as Record<string, unknown>
                emit(controller, { type: 'fields', extracted: toolResult.extracted ?? {}, about_you_append: toolResult.about_you_append ?? '' })
              } catch {
                emit(controller, { type: 'error', error: 'tool_json_parse_failed' })
              }
              toolJsonBuffer = ''
            }

            if (eventType === 'message_delta') {
              const usage = (event as Record<string, unknown>).usage as Record<string, number> | undefined
              if (usage?.output_tokens) outputTokens = usage.output_tokens
            }

            if (eventType === 'message_stop') {
              emit(controller, { type: 'done', usage: { input_tokens: inputTokens, output_tokens: outputTokens } })
            }
          }
        }
      } catch (e) {
        emit(controller, { type: 'error', error: `stream_read_failed:${e instanceof Error ? e.message : String(e)}` })
      }

      // Log token usage fire-and-forget.
      void logTokenUsage({
        feature: args.featureTag,
        model: modelId,
        inputTokens,
        outputTokens,
        agencyId: args.agencyId,
        metadata: args.metadata ?? {},
      })

      controller.close()
    },
  })
}
