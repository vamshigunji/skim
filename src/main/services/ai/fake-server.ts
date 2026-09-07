import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

// Test-only stand-in for Ollama, OpenAI-compatible, and Anthropic endpoints. Streams three chunks and reports usage.
export function startFakeServer() {
  const calls: { url: string; auth: string | undefined; body: unknown }[] = []
  const server: Server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', async () => {
      const body = raw ? JSON.parse(raw) : null
      calls.push({ url: req.url!, auth: req.headers.authorization ?? (req.headers['x-api-key'] as string | undefined), body })
      const slow = body?.model === 'slow-model'
      const chunk = async (s: string) => {
        res.write(s)
        if (slow) await new Promise((r) => setTimeout(r, 300))
      }
      if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'llama3.2:latest' }, { name: 'nomic-embed-text' }] }))
      if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'fake-model' }] }))
      if (req.url === '/api/chat') {
        res.writeHead(200, { 'content-type': 'application/x-ndjson' })
        for (const w of ['Hello', ' from', ' fake']) await chunk(JSON.stringify({ message: { content: w }, done: false }) + '\n')
        return res.end(JSON.stringify({ message: { content: '' }, done: true, prompt_eval_count: 5, eval_count: 3 }) + '\n')
      }
      if (req.url === '/v1/chat/completions') {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        for (const w of ['Hello', ' from', ' fake']) await chunk(`data: ${JSON.stringify({ choices: [{ delta: { content: w } }] })}\n\n`)
        await chunk(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 5, completion_tokens: 3 } })}\n\n`)
        return res.end('data: [DONE]\n\n')
      }
      if (req.url === '/v1/messages') {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        await chunk(`event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 5 } } })}\n\n`)
        for (const w of ['Hello', ' from', ' fake'])
          await chunk(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: w } })}\n\n`)
        await chunk(`event: message_delta\ndata: ${JSON.stringify({ type: 'message_delta', usage: { output_tokens: 3 } })}\n\n`)
        return res.end(`event: message_stop\ndata: {"type":"message_stop"}\n\n`)
      }
      res.writeHead(404).end()
    })
  })
  return new Promise<{ url: string; calls: typeof calls; close: () => Promise<void> }>((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        calls,
        close: () => new Promise((r) => server.close(() => r())),
      }),
    ),
  )
}
