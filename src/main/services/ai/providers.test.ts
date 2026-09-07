// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ChatDelta, ProviderConfig } from '../../../shared/types/ai'
import { startFakeServer } from './fake-server'
import { createProvider } from './provider'

let fake: Awaited<ReturnType<typeof startFakeServer>>
beforeAll(async () => (fake = await startFakeServer()))
afterAll(() => fake.close())

const cfg = (kind: ProviderConfig['kind'], model = 'fake-model'): ProviderConfig => ({ id: kind, kind, base_url: fake.url, model, enabled: 1, is_default: 0 })
const messages = [{ role: 'user' as const, content: 'hi' }]

async function collect(it: AsyncIterable<ChatDelta>) {
  const out: ChatDelta[] = []
  for await (const d of it) out.push(d)
  return out
}

describe.each(['ollama', 'openai', 'anthropic'] as const)('%s provider', (kind) => {
  it('streams text deltas, then usage, then done', async () => {
    const p = createProvider(cfg(kind), kind === 'ollama' ? null : 'sk-test')
    const deltas = await collect(p.chat({ model: 'fake-model', messages }, new AbortController().signal))
    expect(deltas.filter((d) => d.type === 'text').map((d) => (d as { text: string }).text).join('')).toBe('Hello from fake')
    expect(deltas).toContainEqual({ type: 'usage', input: 5, output: 3 })
    expect(deltas.at(-1)).toEqual({ type: 'done' })
  })
  it('lists models and reports locality', async () => {
    const p = createProvider(cfg(kind), 'sk-test')
    expect(p.local).toBe(kind === 'ollama')
    expect((await p.listModels()).length).toBeGreaterThan(0)
  })
})

describe('keys and cancellation', () => {
  it('sends the key as a header for hosted providers and never for Ollama', async () => {
    await collect(createProvider(cfg('openai'), 'sk-test').chat({ model: 'fake-model', messages }, new AbortController().signal))
    await collect(createProvider(cfg('anthropic'), 'sk-ant').chat({ model: 'fake-model', messages }, new AbortController().signal))
    await collect(createProvider(cfg('ollama'), 'should-not-send').chat({ model: 'fake-model', messages }, new AbortController().signal))
    const byUrl = (u: string) => fake.calls.filter((c) => c.url === u).at(-1)!.auth
    expect(byUrl('/v1/chat/completions')).toBe('Bearer sk-test')
    expect(byUrl('/v1/messages')).toBe('sk-ant')
    expect(byUrl('/api/chat')).toBeUndefined()
  })
  it('stops streaming when the signal aborts', async () => {
    const ac = new AbortController()
    const p = createProvider(cfg('openai'), 'sk-test')
    const seen: ChatDelta[] = []
    await expect(async () => {
      for await (const d of p.chat({ model: 'slow-model', messages }, ac.signal)) {
        seen.push(d)
        ac.abort()
      }
    }).rejects.toThrow(/abort/i)
    expect(seen.length).toBeLessThan(4)
  })
})
