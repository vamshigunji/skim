import type { ChatDelta, ChatRequest, ProviderConfig } from '../../../shared/types/ai'

export interface AIProvider {
  local: boolean
  embedModel: string | null
  chat: (req: ChatRequest, signal: AbortSignal) => AsyncIterable<ChatDelta>
  embed: (texts: string[]) => Promise<Float32Array[]>
  listModels: () => Promise<string[]>
}

const defaults: Record<ProviderConfig['kind'], string> = {
  ollama: 'http://127.0.0.1:11434',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
}

async function* lines(res: Response) {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}`)
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    buf += dec.decode(r.value, { stream: true })
    const parts = buf.split('\n')
    buf = parts.pop()!
    for (const line of parts) if (line.trim()) yield line
  }
  if (buf.trim()) yield buf
}

const json = (url: string, body: unknown, headers: Record<string, string>, signal?: AbortSignal) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal })

// Default embedding model per wire format (design/04). Anthropic has none.
const EMBED: Record<ProviderConfig['kind'], string | null> = { ollama: 'nomic-embed-text', openai: 'text-embedding-3-small', anthropic: null }
const vectors = (rows: number[][]) => rows.map((v) => Float32Array.from(v))

const data = (line: string) => (line.startsWith('data: ') ? line.slice(6) : null)

// One adapter per wire format. Ollama speaks NDJSON on /api/chat; OpenAI-compatible and Anthropic speak SSE.
export function createProvider(cfg: ProviderConfig, key: string | null): AIProvider {
  const base = (cfg.base_url || defaults[cfg.kind]).replace(/\/$/, '')
  const get = async (path: string, headers: Record<string, string> = {}) => (await fetch(base + path, { headers })).json()
  const post = async (path: string, body: unknown, headers: Record<string, string> = {}) => (await json(base + path, body, headers)).json()

  if (cfg.kind === 'ollama')
    return {
      local: true,
      embedModel: EMBED.ollama,
      embed: async (texts) => vectors((await post('/api/embed', { model: EMBED.ollama, input: texts })).embeddings),
      async *chat(req, signal) {
        for await (const line of lines(await json(`${base}/api/chat`, { model: req.model, messages: req.messages, stream: true }, {}, signal))) {
          const j = JSON.parse(line)
          if (j.message?.content) yield { type: 'text', text: j.message.content }
          if (j.done) yield { type: 'usage', input: j.prompt_eval_count ?? 0, output: j.eval_count ?? 0 }
        }
        yield { type: 'done' }
      },
      listModels: async () => ((await get('/api/tags')).models as { name: string }[]).map((m) => m.name),
    }

  if (cfg.kind === 'anthropic') {
    const headers = { 'x-api-key': key ?? '', 'anthropic-version': '2023-06-01' }
    return {
      local: false,
      embedModel: null,
      embed: async () => {
        throw new Error('Anthropic has no embedding models; semantic retrieval is off')
      },
      async *chat(req, signal) {
        const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
        const body = { model: req.model, max_tokens: 1024, stream: true, system: system || undefined, messages: req.messages.filter((m) => m.role !== 'system') }
        let input = 0
        for await (const line of lines(await json(`${base}/v1/messages`, body, headers, signal))) {
          const d = data(line)
          if (!d) continue
          const j = JSON.parse(d)
          if (j.type === 'message_start') input = j.message.usage.input_tokens
          else if (j.type === 'content_block_delta' && j.delta.text) yield { type: 'text', text: j.delta.text }
          else if (j.type === 'message_delta') yield { type: 'usage', input, output: j.usage.output_tokens }
        }
        yield { type: 'done' }
      },
      listModels: async () => ((await get('/v1/models', headers)).data as { id: string }[]).map((m) => m.id),
    }
  }

  const headers = { authorization: `Bearer ${key ?? ''}` }
  return {
    local: false,
    embedModel: EMBED.openai,
    embed: async (texts) => vectors((await post('/v1/embeddings', { model: EMBED.openai, input: texts }, headers)).data.map((d: { embedding: number[] }) => d.embedding)),
    async *chat(req, signal) {
      const body = { model: req.model, messages: req.messages, stream: true, stream_options: { include_usage: true } }
      for await (const line of lines(await json(`${base}/v1/chat/completions`, body, headers, signal))) {
        const d = data(line)
        if (!d || d === '[DONE]') continue
        const j = JSON.parse(d)
        const text = j.choices?.[0]?.delta?.content
        if (text) yield { type: 'text', text }
        if (j.usage) yield { type: 'usage', input: j.usage.prompt_tokens, output: j.usage.completion_tokens }
      }
      yield { type: 'done' }
    },
    listModels: async () => ((await get('/v1/models', headers)).data as { id: string }[]).map((m) => m.id),
  }
}
